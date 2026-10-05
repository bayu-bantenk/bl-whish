import { mkdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterAll, describe, expect, it } from 'vitest'
import nextEnv from '@next/env'
import { CAPABILITIES } from '@/shared/authorization/capabilities'
import { createGrantPolicy } from '@/shared/authorization/policy'
import { loadServerConfig, type ServerConfig } from '@/shared/infrastructure/config/server-config'
import { composeFeatures, createRequestScope, type Features } from '@/shared/infrastructure/container/server-container'
import type { SessionMode } from '@/shared/infrastructure/session/session-manager'
import { parseTableQuery } from '@/shared/table/url-codec'
import { AUTH_CONTRACTS } from '@/packages/auth/repository/dto'
import { PRODUCT_RESTRICTION_TABLE_SPEC } from '@/packages/product-restriction/domain/product-restriction'
import { CUSTOMER_CHANNELS_PATH, PRODUCT_RESTRICTION_PATH, PRODUCTS_PATH } from '@/packages/product-restriction/repository/dto'

// F11 live-WRITE fixture discovery: READ-ONLY.
//   npx vitest run --config vitest.live.config.js test/live/f11-fixture-discovery.live.test.ts
// Optional: LIVE_DISCOVERY_TERM (product search term, default "a").
//
// Through F11's production use cases only (request scope → use case → repository → GatewayClient).
// The guard allows GET on the three F11 read paths and the auth POSTs; anything else throws before
// it leaves the process. Output: product / channel ids, codes and names (needed to choose the
// fixture); never tokens, cookies, passwords or the API key.
//
// "No restriction" assertion: there is no restriction-by-product endpoint, so the strongest contract
// read is the restriction list with keyword = product id (backend: pr.product_id LIKE ?) filtered by
// an exact productId match, read across every result page.

const ROOT = resolve(__dirname, '..', '..', '..')
nextEnv.loadEnvConfig(resolve(__dirname, '..', '..'), false, { info: () => {}, error: () => {} })
const env = process.env
const OUT_DIR = resolve(env.MODULE_LIVE_OUT_DIR ?? join(tmpdir(), 'module-live'), 'product-restriction')
const TERM = (env.LIVE_DISCOVERY_TERM ?? 'a').trim() || 'a'

let config: ServerConfig | null = null
let gate: string | null = null
try {
  config = loadServerConfig()
  const host = new URL(config.gateway.baseUrl).hostname
  if (env.A55R_CONFIRM_NON_PRODUCTION !== 'yes') gate = 'A55R_CONFIRM_NON_PRODUCTION=yes not set'
  else if (!env.A55R_ALLOWED_HOST || env.A55R_ALLOWED_HOST !== host) gate = 'A55R_ALLOWED_HOST does not match the API_HOST hostname'
  else if (!env.A55R_EMAIL || !env.A55R_PASSWORD) gate = 'A55R_EMAIL / A55R_PASSWORD (test account) not set'
  else if (OUT_DIR.startsWith(ROOT)) gate = 'MODULE_LIVE_OUT_DIR must be outside the repository'
} catch (e) {
  gate = `server config invalid: ${(e as Error).message}`
}

const basePath = config ? new URL(config.gateway.baseUrl).pathname.replace(/\/$/, '') : ''
const contract = config ? AUTH_CONTRACTS[config.gateway.authContract] : null
const AUTH_POSTS = new Set([contract?.loginPath, contract?.refreshPath, contract?.logoutPath].filter(Boolean) as string[])
const READ_PATHS = new Set([PRODUCT_RESTRICTION_PATH, PRODUCTS_PATH, CUSTOMER_CHANNELS_PATH])
const requests: { method: string; path: string; status: number | 'network-error' }[] = []

function guardedFetch(requestId: string): typeof fetch {
  return (async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const rel = url.pathname.slice(basePath.length) || '/'
    const method = String(init.method ?? 'GET').toUpperCase()
    const allowed = (method === 'GET' && READ_PATHS.has(rel)) || (method === 'POST' && AUTH_POSTS.has(rel))
    if (!allowed) throw new Error(`discovery guard: refused ${method} ${rel}`)
    if (method === 'GET' && init.body) throw new Error('discovery guard: GET with a body refused')
    if (new Headers(init.headers).get('x-request-id') !== requestId) throw new Error('discovery guard: request id mismatch')
    const entry: { method: string; path: string; status: number | 'network-error' } = { method, path: rel, status: 'network-error' }
    requests.push(entry)
    const res = await fetch(url, init)
    entry.status = res.status
    return res
  }) as typeof fetch
}

const policy = createGrantPolicy({ name: 'f11-discovery', vocabulary: CAPABILITIES, grants: { discovery: ['product-restriction.read', 'product-restriction.create'] } })
let cookies: Record<string, string> = {}
function scope(mode: SessionMode): Features & { store: Map<string, string> } {
  const requestId = `discovery-${randomUUID()}`
  const store = new Map(Object.entries(cookies))
  const s = createRequestScope({
    jar: { get: (n: string) => store.get(n), set: (n: string, v: string, o: { maxAge: number }) => (o.maxAge === 0 ? store.delete(n) : store.set(n, v)) },
    mode,
    requestId,
    config: config!,
    policy,
    accountResolver: () => ({ type: 'discovery' }),
    fetchImpl: guardedFetch(requestId),
  })
  return { ...composeFeatures(s), store }
}

// Every restriction whose product_id matches exactly, across all pages.
async function restrictionsOf(productId: string): Promise<{ ok: true; ids: string[] } | { ok: false; kind: string }> {
  const ids: string[] = []
  for (let page = 1; page <= 20; page++) {
    const q = parseTableQuery(new URLSearchParams({ q: productId, per_page: '50', page: String(page) }), PRODUCT_RESTRICTION_TABLE_SPEC)
    const res = await scope('render').productRestriction.list(q)
    if (!res.ok) return { ok: false, kind: res.error.kind }
    ids.push(...res.value.items.filter((r) => r.productId === productId).map((r) => r.id))
    if (page * 50 >= res.value.total) return { ok: true, ids }
  }
  return { ok: false, kind: 'TooManyPages' }
}

const report: Record<string, unknown> = { startedAt: new Date().toISOString(), searchTerm: TERM }

describe.skipIf(!!gate)('F11 live-WRITE fixture discovery (READ-ONLY)', () => {
  afterAll(async () => {
    if (Object.keys(cookies).length) {
      const s = scope('mutable')
      await s.auth.logout()
      report.logout = { sessionCleared: s.store.size === 0 }
    }
    report.requests = requests
    report.mutations = requests.filter((r) => r.method !== 'GET' && !AUTH_POSTS.has(r.path)).length
    report.finishedAt = new Date().toISOString()
    const text = JSON.stringify(report, null, 2)
    if (env.A55R_PASSWORD && text.includes(env.A55R_PASSWORD)) throw new Error('refusing to write: password found')
    mkdirSync(OUT_DIR, { recursive: true })
    const file = join(OUT_DIR, `fixture-discovery-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}.json`)
    writeFileSync(file, text)
    process.stdout.write(`fixture discovery: ${file}\n${JSON.stringify(report.fixture ?? report.result ?? null, null, 2)}\n`)
  })

  it('discovers one unrestricted product and two distinct channels', async () => {
    report.environment = { scheme: new URL(config!.gateway.baseUrl).protocol, host: new URL(config!.gateway.baseUrl).hostname, authContract: config!.gateway.authContract }
    const l = scope('mutable')
    const login = await l.auth.login({ email: env.A55R_EMAIL!, password: env.A55R_PASSWORD!, loginBy: 'credentials' })
    report.login = login.ok ? { ok: true } : { ok: false, kind: login.error.kind }
    expect(login.ok).toBe(true)
    cookies = Object.fromEntries(l.store)

    // Channels: the same list the F11 form and use case validate against.
    const channels = await scope('render').productRestriction.channelOptions()
    report.channelList = channels.ok ? { ok: true, count: channels.value.length } : { ok: false, kind: channels.error.kind }
    expect(channels.ok).toBe(true)
    const distinct = channels.ok ? channels.value.filter((c, i, all) => all.findIndex((x) => x.id === c.id) === i) : []
    const [ch1, ch2] = distinct

    // Products: smallest practical search; first candidate without any restriction wins.
    const products = await scope('render').productRestriction.searchProducts(TERM)
    report.productSearch = products.ok ? { ok: true, count: products.value.length } : { ok: false, kind: products.error.kind }
    expect(products.ok).toBe(true)
    const candidates: Record<string, unknown>[] = []
    let chosen: { id: string; code: string; name: string } | null = null
    for (const p of products.ok ? products.value : []) {
      const r = await restrictionsOf(p.id)
      candidates.push({ productId: p.id, code: p.code, name: p.name, restriction: r.ok ? (r.ids.length ? `EXISTS (${r.ids.length})` : 'NOT_FOUND') : `UNKNOWN (${r.kind})` })
      if (r.ok && r.ids.length === 0) {
        chosen = p
        break
      }
    }
    report.productCandidates = candidates

    if (!chosen || !ch1 || !ch2) {
      report.result = { status: 'NO_SAFE_FIXTURE_FOUND', reason: !chosen ? 'no searched product without a restriction' : 'fewer than two distinct channels' }
      return
    }
    // Re-verify right before reporting (state could change between reads).
    const recheck = await restrictionsOf(chosen.id)
    const recheckOk = recheck.ok && recheck.ids.length === 0
    report.fixture = {
      status: recheckOk ? 'CANDIDATE_VERIFIED' : 'RECHECK_FAILED',
      product: { id: chosen.id, code: chosen.code, name: chosen.name, restriction: recheckOk ? 'NOT_FOUND' : 'CHANGED_OR_UNKNOWN' },
      channel1: { id: ch1.id, aamCode: ch1.aamCode, name: ch1.name },
      channel2: { id: ch2.id, aamCode: ch2.aamCode, name: ch2.name },
      channelIdsDistinct: ch1.id !== ch2.id,
      verifiedAt: new Date().toISOString(),
    }
    expect(recheckOk).toBe(true)
  })
})

describe.runIf(!!gate)('F11 fixture discovery: safety gate', () => {
  it('refuses to contact the backend', () => {
    process.stdout.write(`fixture discovery BLOCKED by safety gate: ${gate}\n`)
    expect(gate).toBeTruthy()
  })
})
