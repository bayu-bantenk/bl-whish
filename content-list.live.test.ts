import { mkdirSync, writeFileSync } from 'node:fs'
import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import nextEnv from '@next/env'
import { CAPABILITIES } from '@/shared/authorization/capabilities'
import { createGrantPolicy } from '@/shared/authorization/policy'
import { loadServerConfig, type ServerConfig } from '@/shared/infrastructure/config/server-config'
import { composeFeatures, createRequestScope } from '@/shared/infrastructure/container/server-container'
import type { SessionMode } from '@/shared/infrastructure/session/session-manager'
import type { SessionRecord } from '@/shared/infrastructure/session/session-record'
import { createSessionSealer } from '@/shared/infrastructure/session/session-sealer'
import { AUTH_CONTRACTS } from '@/packages/auth/repository/dto'
import { parseTableQuery } from '@/shared/table/url-codec'
import type { TableQuery } from '@/shared/table/contracts'
import { CONTENT_TABLE_SPEC, isContentId, type ContentListItem } from '@/packages/content/domain/content'
import { GatewayContentRepository } from '@/packages/content/repository/content.repository'
import { CONTENT_LIST_PATH } from '@/packages/content/repository/dto'

// A5.5R: real-backend verification of the Content list through the production path.
// Observations are structural only (see README). The harness never fakes a result: a
// step that cannot run is recorded as NOT_RUN with the reason.

const ROOT = resolve(__dirname, '..', '..', '..')
nextEnv.loadEnvConfig(resolve(__dirname, '..', '..'), false, { info: () => {}, error: () => {} })

type Shape = string | { [k: string]: Shape } | Shape[]
const shape = (v: unknown, depth = 0): Shape => {
  if (Array.isArray(v)) return depth > 3 ? `array(${v.length})` : [`array(${v.length})`, ...(v.length ? [shape(v[0], depth + 1)] : [])]
  if (v && typeof v === 'object') return depth > 3 ? 'object' : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x, depth + 1)]))
  return v === null ? 'null' : typeof v
}

type Observation = {
  step: string
  method: string
  path: string // relative to API_HOST
  query: Record<string, string>
  status: number | 'network-error'
  contentType: string | null
  auth: boolean
  apiKey: boolean
  requestIdPropagated: boolean
  getBody: boolean
  envelopeCode?: unknown
  body?: Shape
}
const evidence: { startedAt: string; target: Record<string, unknown>; steps: Record<string, unknown>; observations: Observation[] } = {
  startedAt: new Date().toISOString(),
  target: {},
  steps: {},
  observations: [],
}
let currentStep = 'init'

const env = process.env
const confirmed = env.A55R_CONFIRM_NON_PRODUCTION === 'yes'
let config: ServerConfig | null = null
let gate: string | null = null
try {
  config = loadServerConfig()
  const host = new URL(config.gateway.baseUrl).hostname
  if (!confirmed) gate = 'A55R_CONFIRM_NON_PRODUCTION=yes not set'
  else if (!env.A55R_ALLOWED_HOST || env.A55R_ALLOWED_HOST !== host) gate = 'A55R_ALLOWED_HOST does not match the API_HOST hostname'
  else if (!env.A55R_EMAIL || !env.A55R_PASSWORD) gate = 'A55R_EMAIL / A55R_PASSWORD (test account) not set'
} catch (e) {
  gate = `server config invalid: ${(e as Error).message}`
}

const basePath = config ? new URL(config.gateway.baseUrl).pathname.replace(/\/$/, '') : ''
const contract = config ? AUTH_CONTRACTS[config.gateway.authContract] : null
const AUTH_POSTS = new Set([contract?.loginPath, contract?.refreshPath, contract?.logoutPath].filter(Boolean) as string[])

// Node's fetch cannot send a body with GET; Test B uses node:http(s) for that one probe.
async function fetchWithGetBody(url: string, init: RequestInit & { getBody?: string }): Promise<Response> {
  const u = new URL(url)
  const headers = Object.fromEntries(new Headers(init.headers).entries())
  const body = init.getBody ?? (typeof init.body === 'string' ? init.body : undefined)
  if (body) {
    headers['content-type'] = 'application/json'
    headers['content-length'] = String(Buffer.byteLength(body))
  }
  return new Promise((ok, fail) => {
    const req = (u.protocol === 'https:' ? httpsRequest : httpRequest)(u, { method: init.method, headers, signal: init.signal ?? undefined }, (res) => {
      const chunks: Buffer[] = []
      res.on('data', (c) => chunks.push(c))
      res.on('end', () => ok(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 0, headers: res.headers as Record<string, string> })))
    })
    req.on('error', fail)
    if (body) req.write(body)
    req.end()
  })
}

function observing(opts: { requestId: string; getBody?: (query: URLSearchParams) => string | undefined }): typeof fetch {
  return (async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input))
    const rel = url.pathname.slice(basePath.length) || '/'
    const method = String(init.method ?? 'GET').toUpperCase()
    // Read-only guard: GET on the content list / detail, POST only on the auth endpoints.
    const detail = rel.startsWith(CONTENT_LIST_PATH + '/') && isContentId(rel.slice(CONTENT_LIST_PATH.length + 1))
    const allowed = (method === 'GET' && (rel === CONTENT_LIST_PATH || detail)) || (method === 'POST' && AUTH_POSTS.has(rel))
    if (!allowed) throw new Error(`A5.5R guard: refused ${method} ${rel}`)
    const headers = new Headers(init.headers)
    const getBody = method === 'GET' ? opts.getBody?.(url.searchParams) : undefined
    const query = rel === CONTENT_LIST_PATH ? Object.fromEntries(url.searchParams) : {}
    if (query.keyword) query.keyword = '<term>'
    const obs: Observation = {
      step: currentStep,
      method,
      path: detail ? `${CONTENT_LIST_PATH}/:id` : rel,
      query,
      status: 'network-error',
      contentType: null,
      auth: headers.has('authorization'),
      apiKey: !!config?.gateway.apiKey && headers.has(config.gateway.apiKey.header),
      requestIdPropagated: headers.get('x-request-id') === opts.requestId,
      getBody: !!getBody,
    }
    evidence.observations.push(obs)
    const res = getBody ? await fetchWithGetBody(url.toString(), { ...init, getBody }) : await fetch(url, init)
    obs.status = res.status
    obs.contentType = res.headers.get('content-type')
    try {
      const json = await res.clone().json()
      obs.envelopeCode = json && typeof json === 'object' ? (json as Record<string, unknown>).code : undefined
      // Auth responses: key names only (they contain tokens). Content: structural shape.
      obs.body = rel === CONTENT_LIST_PATH || detail ? shape(json) : Object.keys(json ?? {})
    } catch {
      obs.body = 'non-json'
    }
    return res
  }) as typeof fetch
}

const policy = createGrantPolicy({ name: 'a55r-harness', vocabulary: CAPABILITIES, grants: { a55r: ['content.read'] } })
const sealer = config ? createSessionSealer(config.session.secret) : null
let sessionCookie: Record<string, string> = {}
let firstId: string | null = null
// Token comparisons are recorded as booleans only; values never leave the process.
const openRecord = (cookies: Record<string, string>) => (sealer!.open(Object.values(cookies)[0] ?? '') as SessionRecord | null)

function memoryJar(initial: Record<string, string>) {
  const store = new Map(Object.entries(initial))
  return {
    store,
    jar: {
      get: (n: string) => store.get(n),
      set: (n: string, v: string, o: { maxAge: number }) => (o.maxAge === 0 ? store.delete(n) : store.set(n, v)),
    },
  }
}

function scope(mode: SessionMode, cookies: Record<string, string>, opts: { noApiKey?: boolean; getBody?: (q: URLSearchParams) => string | undefined; deny?: boolean } = {}) {
  const requestId = `a55r-${randomUUID()}`
  const cfg: ServerConfig = opts.noApiKey ? { ...config!, gateway: { ...config!.gateway, apiKey: null } } : config!
  const { jar, store } = memoryJar(cookies)
  const s = createRequestScope({
    jar,
    mode,
    requestId,
    config: cfg,
    policy: opts.deny ? createGrantPolicy({ name: 'a55r-deny', vocabulary: CAPABILITIES, grants: { a55r: ['dashboard.read'] } }) : policy,
    accountResolver: () => ({ type: 'a55r' }),
    fetchImpl: observing({ requestId, getBody: opts.getBody }),
  })
  const features = composeFeatures(s)
  return { ...s, ...features, contentList: features.content, store }
}

const q = (qs = '') => parseTableQuery(new URLSearchParams(qs), CONTENT_TABLE_SPEC)
const summary = (r: { ok: boolean; value?: { items: ContentListItem[]; total: number }; error?: { kind: string } }) =>
  r.ok ? { ok: true, rows: r.value!.items.length, total: r.value!.total } : { ok: false, kind: r.error!.kind }

async function list(query: TableQuery, cookies = sessionCookie, mode: SessionMode = 'render', opts = {}) {
  const s = scope(mode, cookies, opts)
  const res = await s.contentList.list(query)
  return { res, store: s.store }
}

describe.skipIf(!!gate)('A5.5R Content list against the real gateway', () => {
  beforeAll(async () => {
    const host = new URL(config!.gateway.baseUrl)
    evidence.target = {
      scheme: host.protocol,
      hostConfirmedByOperator: true,
      basePathPresent: basePath !== '',
      authContract: config!.gateway.authContract,
      apiKeyConfigured: !!config!.gateway.apiKey,
    }
    currentStep = 'login'
    const s = scope('mutable', {})
    const login = await s.auth.login({ email: env.A55R_EMAIL!, password: env.A55R_PASSWORD!, loginBy: 'credentials' })
    evidence.steps.login = login.ok ? { ok: true } : { ok: false, kind: login.error.kind }
    sessionCookie = Object.fromEntries(s.store)
  })

  afterAll(async () => {
    currentStep = 'logout'
    const last = Object.keys(sessionCookie).length ? openRecord(sessionCookie) : null
    if (last) {
      const s = scope('mutable', sessionCookie)
      await s.auth.logout()
      evidence.steps.logout = { sessionCleared: s.store.size === 0 }
      // Is the access token revoked server-side? One GET with the logged-out token, no refresh.
      currentStep = 'post-logout'
      const before = evidence.observations.length
      const { res } = await list(q(), { [config!.session.cookieName]: sealer!.seal({ ...last, refreshToken: undefined }) })
      ;(evidence.steps.logout as Record<string, unknown>).oldAccessToken = {
        result: summary(res as never),
        sequence: evidence.observations.slice(before).map((o) => `${o.method} ${o.path} → ${o.status}`),
      }
    }
    const out = resolve(env.A55R_OUT ?? join(tmpdir(), 'a55r-live', 'evidence.json'))
    if (out.startsWith(ROOT)) throw new Error('A55R_OUT must be outside the repository')
    mkdirSync(dirname(out), { recursive: true })
    const text = JSON.stringify(evidence, null, 2)
    // Last line of defence: nothing token- or credential-like may be written.
    if (env.A55R_PASSWORD && text.includes(env.A55R_PASSWORD)) throw new Error('refusing to write: password found')
    writeFileSync(out, text)
    process.stdout.write(`A5.5R evidence written outside the repo (${evidence.observations.length} observations)\n`)
  })

  it('login succeeded through the auth use case', () => {
    expect(evidence.steps.login).toEqual({ ok: true })
  })

  it('S2 default list (Test A: query only) → Page', async () => {
    currentStep = 'default'
    const { res } = await list(q())
    evidence.steps.default = summary(res as never)
    firstId = res.ok ? (res.value.items[0]?.id ?? null) : null
    expect(evidence.observations.at(-1)?.requestIdPropagated).toBe(true)
  })

  it('S2b detail: existing id → Content (is_active present?), unknown id → NotFound', async () => {
    currentStep = 'detail'
    if (!firstId) {
      evidence.steps.detail = 'NOT_RUN: list returned no row'
      return
    }
    const s = scope('render', sessionCookie)
    const found = await s.content.get(firstId)
    const unknown = await scope('render', sessionCookie).content.get('999999999')
    evidence.steps.detail = {
      existing: found.ok ? { ok: true, fields: Object.keys(found.value).sort() } : { ok: false, kind: found.error.kind },
      unknown: unknown.ok ? { ok: true } : { ok: false, kind: unknown.error.kind },
    }
  })

  it('S3 pagination: page 1 vs page 2 (disjoint ids), page 0 probe, out-of-range', async () => {
    currentStep = 'pagination'
    const p1 = await list(q('per_page=5'))
    const p2 = await list(q('per_page=5&page=2'))
    const ids = (r: typeof p1) => (r.res.ok ? r.res.value.items.map((i) => i.id) : [])
    const s0 = scope('render', sessionCookie)
    const p0 = await new GatewayContentRepository(s0.gateway).list({ ...q('per_page=5'), page: 0 }).catch(() => null)
    const total = p1.res.ok ? p1.res.value.total : 0
    const last = Math.max(1, Math.ceil(total / 5))
    const beyond = await list(q(`per_page=5&page=${last + 1}`))
    evidence.steps.pagination = {
      page1: summary(p1.res as never),
      page2: summary(p2.res as never),
      disjoint: ids(p1).every((id) => !ids(p2).includes(id)),
      page0: p0 ? { ...summary(p0 as never), sameAsPage1: p0.ok && JSON.stringify(p0.value.items.map((i) => i.id)) === JSON.stringify(ids(p1)) } : 'error',
      outOfRange: summary(beyond.res as never),
    }
  })

  it('S4 sorting: code asc vs desc', async () => {
    currentStep = 'sort'
    const asc = await list(q('sort=code.asc&per_page=25'))
    const desc = await list(q('sort=code.desc&per_page=25'))
    const codes = (r: typeof asc) => (r.res.ok ? r.res.value.items.map((i) => i.code) : [])
    const monotonic = (xs: string[], cmp: (a: string, b: string) => number) => xs.every((x, i) => i === 0 || cmp(xs[i - 1], x) <= 0)
    evidence.steps.sort = {
      asc: summary(asc.res as never),
      desc: summary(desc.res as never),
      ascSortedLocale: monotonic(codes(asc), (a, b) => a.localeCompare(b)),
      ascSortedBinary: monotonic(codes(asc), (a, b) => (a < b ? -1 : a > b ? 1 : 0)),
      descIsReverseWhenSinglePage: asc.res.ok && asc.res.value.total <= 25 ? JSON.stringify(codes(asc).reverse()) === JSON.stringify(codes(desc)) : 'multi-page',
    }
  })

  it('S5 search: known term and a no-match term (empty ≠ error)', async () => {
    currentStep = 'search'
    const first = (await list(q())).res
    const term = env.A55R_SEARCH ?? (first.ok ? first.value.items[0]?.code : undefined)
    if (!term) {
      evidence.steps.search = 'NOT_RUN: no rows to derive a term and A55R_SEARCH not set'
      return
    }
    const hit = await list(q(`q=${encodeURIComponent(term)}`))
    const none = await list(q(`q=${encodeURIComponent(`zz-a55r-${randomUUID().slice(0, 8)}`)}`))
    const lower = term.toLowerCase()
    evidence.steps.search = {
      hit: summary(hit.res as never),
      allRowsMatchCodeOrName: hit.res.ok && hit.res.value.items.every((i) => i.code.toLowerCase().includes(lower) || i.name.toLowerCase().includes(lower)),
      noMatch: summary(none.res as never),
    }
  })

  it('S6 GET body (Test B, optional): same query with the legacy JSON body', async () => {
    currentStep = 'get-body'
    if (env.A55R_PROBE_GET_BODY !== 'yes') {
      evidence.steps.getBody = 'NOT_RUN: A55R_PROBE_GET_BODY not set'
      return
    }
    const a = await list(q('sort=code.asc&per_page=5'))
    const b = await list(q('sort=code.asc&per_page=5'), sessionCookie, 'render', {
      getBody: (p: URLSearchParams) => JSON.stringify({ sort_by: p.get('sort_by'), asc_desc: p.get('asc_desc'), page: Number(p.get('page')), take: Number(p.get('take')), keyword: p.get('keyword') ?? '' }),
    })
    const ids = (r: typeof a) => (r.res.ok ? r.res.value.items.map((i) => i.id) : null)
    evidence.steps.getBody = { queryOnly: summary(a.res as never), queryPlusBody: summary(b.res as never), sameRows: JSON.stringify(ids(a)) === JSON.stringify(ids(b)) }
  })

  it('S7 API key (optional): request without the configured key', async () => {
    currentStep = 'no-api-key'
    if (env.A55R_PROBE_NO_API_KEY !== 'yes' || !config!.gateway.apiKey) {
      evidence.steps.noApiKey = 'NOT_RUN: probe not enabled or no API key configured'
      return
    }
    const { res } = await list(q(), sessionCookie, 'render', { noApiKey: true })
    evidence.steps.noApiKey = summary(res as never)
  })

  it('S8 local policy denial: Forbidden without any gateway call', async () => {
    currentStep = 'local-deny'
    const before = evidence.observations.length
    const { res } = await list(q(), sessionCookie, 'render', { deny: true })
    evidence.steps.localDeny = { ...summary(res as never), gatewayCalls: evidence.observations.length - before }
    expect(res).toEqual({ ok: false, error: { kind: 'Forbidden' } })
    expect(evidence.observations.length).toBe(before)
  })

  it('S9 invalid / expired session: Unauthenticated without any gateway call', async () => {
    currentStep = 'invalid-session'
    const before = evidence.observations.length
    const forged = await list(q(), { [config!.session.cookieName]: 'v1.forged.cookie.value' })
    const record = sealer!.open(Object.values(sessionCookie)[0] ?? '') as SessionRecord | null
    const expired = record ? await list(q(), { [config!.session.cookieName]: sealer!.seal({ ...record, accessTokenExpiresAt: Date.now() - 1000, refreshToken: undefined }) }) : null
    evidence.steps.invalidSession = { forged: summary(forged.res as never), expiredNoRefresh: expired ? summary(expired.res as never) : 'NOT_RUN', gatewayCalls: evidence.observations.length - before }
    expect(evidence.observations.length).toBe(before)
  })

  it('S10 401 → refresh → retry once (A5.1), last because it rotates the refresh token', async () => {
    currentStep = 'refresh'
    const record = sealer!.open(Object.values(sessionCookie)[0] ?? '') as SessionRecord | null
    if (!record?.refreshToken) {
      evidence.steps.refresh = `NOT_RUN: session has no refresh token (contract ${config!.gateway.authContract})`
      return
    }
    const bogus = { ...record, accessToken: 'a55r-invalid-access-token', accessTokenExpiresAt: Date.now() + 3_600_000 }
    const before = evidence.observations.length
    const { res, store } = await list(q(), { [config!.session.cookieName]: sealer!.seal(bogus) }, 'mutable')
    evidence.steps.refresh = {
      result: summary(res as never),
      sequence: evidence.observations.slice(before).map((o) => `${o.method} ${o.path} → ${o.status}`),
    }
    const after = store.size ? openRecord(Object.fromEntries(store)) : null
    ;(evidence.steps.refresh as Record<string, unknown>).rotation = after
      ? {
          accessTokenChanged: after.accessToken !== record.accessToken && after.accessToken !== bogus.accessToken,
          refreshTokenPresent: !!after.refreshToken,
          refreshTokenRotated: !!after.refreshToken && after.refreshToken !== record.refreshToken,
          expiryInFuture: after.accessTokenExpiresAt > Date.now(),
        }
      : 'no session written'
    if (store.size) sessionCookie = Object.fromEntries(store)
  })

  it('S11 refresh rejected → Unauthenticated, session cleared, no loop', async () => {
    currentStep = 'refresh-failure'
    const record = openRecord(sessionCookie)
    if (!record?.refreshToken) {
      evidence.steps.refreshFailure = 'NOT_RUN: session has no refresh token'
      return
    }
    // A copy of the session with an invalid access AND refresh token; the real session is untouched.
    const broken = { ...record, accessToken: 'a6r-invalid-access-token', refreshToken: 'a6r-invalid-refresh-token', accessTokenExpiresAt: Date.now() + 3_600_000 }
    const before = evidence.observations.length
    const { res, store } = await list(q(), { [config!.session.cookieName]: sealer!.seal(broken) }, 'mutable')
    evidence.steps.refreshFailure = {
      result: summary(res as never),
      sequence: evidence.observations.slice(before).map((o) => `${o.method} ${o.path} → ${o.status}`),
      sessionCleared: store.size === 0,
    }
  })
})

describe.runIf(!!gate)('A5.5R safety gate', () => {
  it('refuses to contact any backend', () => {
    process.stdout.write(`A5.5R BLOCKED by safety gate: ${gate}\n`)
    expect(gate).toBeTruthy()
  })
})
