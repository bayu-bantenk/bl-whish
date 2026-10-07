# F27 — Verifikasi Akun Module Gate

| Field | Value |
|---|---|
| Date | 2026-10-07 |
| Inputs | `F27_IMPLEMENTATION_REPORT.md`, coordinator gate logs (2026-10-07 23:05–23:18), source inspection |
| Owner gate run | **in progress** (quality → e2e:build → full E2E → build → check:bundle); results not yet supplied |

## 1. Gate Decision

**CONDITIONAL GO — PROVISIONAL.**

The implementation is sound and inside the locked READ scope. Open backend findings F27-CA-03, F27-CA-08, R-09 and R-10 keep the gate conditional.

The decision is **not final**: `npm run build`, `check:bundle` and the owner's full E2E are **PENDING OWNER RESULT**, and live READ has not been performed. It becomes final once the owner's gate results are recorded.

**Downgrade to HOLD if:**
- `build` or `check:bundle` fails, or
- an F27 test fails in the owner's run.

## 2. Scope Verification

| Item | Implemented? | Evidence |
|---|---|---|
| List, status filter, Cust. ID / Email search, pagination, backend order, review page, current-page CSV, navigation, authorization | YES | `F27_IMPLEMENTATION_REPORT.md` §3–§14 |
| approve / reject / update / register / phone approval / create / delete / role / permission / XLSX | **NO** | grep over the F27 package, routes and live adapter: these words appear only in "CONTRACT ONLY" comments and in the `REJECTED` status value (not a write). No non-GET request exists in F27 code |
| New dependency | **NO** | `package.json` / `package-lock.json` last modified 2026-09-30, before F27 |
| F04 / order-review touched | **NO** | no order-review file is newer than the readiness document |

## 3. Architecture Compliance

| Requirement | Status |
|---|---|
| Request path is Page → DAL → use case → port → repository → shared gateway | ✓ |
| No new HTTP client, gateway, DAL, auth, pagination or table framework | ✓ |
| Wire names live only in `repository/dto.ts` (zod); `'server-only'` repository | ✓ |
| The 404 → empty rule exists only in the list use case (`listNotFoundMeansEmpty`); the gateway is unchanged | ✓ |
| No sort parameters and no identity headers are sent | ✓ |
| Copy-adapt approach; no generic CRUD or export framework; no `legacy/`, `migration/` or `adonis/` folders | ✓ |
| Shared files touched are limited to the allowed list | ✓ |

The shared files touched are:
- `capabilities.ts`
- `registry.ts`
- `navigation/types.ts`
- `nav-icon.tsx`
- `server-container.ts`
- `dal.test.ts`
- `playwright.config.ts`
- `authorization.spec.ts`
- `mock-backend.mjs`
- `fixtures.ts`
- `test/live/modules/index.ts`

**Documented deviations:**
1. F27 validates the list query with its own zod schema instead of the shared `validateTableQuery`, because the shared validator rejects the descriptive default sort when no column is sortable.
2. The Cust. ID validation message appears in the table alert, because the shared toolbar has no slot for field errors.
3. The shared search-type select keeps its "Semua" option, which falls back to Cust. ID.
4. The `REJECTED` badge uses solid destructive colours, because the tinted variant failed axe contrast.

All four are accepted implementation constraints. The shared toolbar is not redesigned for F27.

## 4. Authorization

`account-verification.read` is fail-closed at three layers:

| Layer | Enforcement |
|---|---|
| Navigation | `registry.ts` `requires` → the menu entry is hidden without the capability |
| Route | `guardRoute('account-verification.list' / '.detail')` on both pages → AccessDenied |
| Use case | `authorization.require` runs before validation and before any repository call |

- **Order:** authorize → validate → backend call (`account-verification.usecase.ts` `list` / `get`).
- **Tests:** E2E runs a reader instance without the capability (menu hidden, 403, 0 backend calls), and the contract test checks Forbidden with 0 calls.
- **Backend role enforcement:** not added and not claimed (F27-CA-08).

## 5. Automated Evidence

| Gate | Result | Evidence |
|---|---|---|
| npm run quality | **PASS** | coordinator 23:05: exit 0, vitest 73 files / 1099 passed |
| e2e:build | **PASS** | coordinator 23:05: exit 0 |
| Full E2E | **171 / 172** (coordinator) · **PENDING OWNER RESULT** | the one failure is unrelated: `banner.spec.ts:36` (see §6) |
| npm run build | **PENDING OWNER RESULT** | coordinator chain stopped before build so it would not overwrite `.next` during the owner's run |
| check:bundle | **PENDING OWNER RESULT** | as above |
| F27 focused tests | **PASS** | 32 / 32: contract 16, pages 10, CSV 6 (inside the 1099) |
| F27 E2E | **PASS** | 11 / 11 (coordinator full run) |
| TypeScript | **PASS** | `tsc` in quality |
| ESLint | **PASS** | 0 errors; 28 pre-existing warnings, none in F27 files |

## 6. E2E Evidence

**F27 spec, 11 / 11 passed:**
- menu → list: legacy columns, backend order, axe
- status filter select → backend `status` parameter
- email search
- Cust. ID search (default type) and non-numeric validation without a request
- pagination
- buyer-less row shown but not actionable
- review page: read-only fields, only "Kembali", axe
- CSV "Unduh Data": current page only, no extra request
- list 500 → error state
- 404 → empty state (F27-CA-01)
- reader instance without the capability → blocked

The authorization spec, including the updated menu, passed in the same run.

**Unrelated failure:** `banner.spec.ts:36` (Batch 2, "inline: Active toggle and Sequence save immediately"). The last row did not show "Banner Uji 1" within 8 s.
- **Conditions:** load average ≈ 30, with another vitest process running at the same time.
- **Relation to F27:** F27 touches no banner code, mock route or shared component used by that path.
- **Classification:** suite-level / load observation, in the same class as T-01.
- **Not rerun:** the owner's E2E run would conflict on ports.

## 7. Build Evidence

**PENDING OWNER RESULT.** The implementation agent reported `npm run build` PASS, with both F27 routes built, on the code before the host reboot. That result was not re-verified by the coordinator.

## 8. Bundle Evidence

**PENDING OWNER RESULT.** The implementation agent reported `check:bundle` PASS before the reboot (no wire paths and no `total_rows` in the client bundle). Not re-verified.

## 9. Security Evidence

| Check | Result |
|---|---|
| Secrets, tokens and credentials in F27 code / tests | none (no literals; the live adapter reads credentials from the harness environment only) |
| PII logging | no logging in F27 code. The shared gateway log records the path template, method and status only, with no query, so neither the keyword nor the email is logged |
| Identity headers | none sent; the gateway injects them |
| CSV formula injection | guard `^[=+\-@\t\r]` → leading `'`, covered by a unit test |
| Fail-closed authorization | three layers (§4) |
| Unauthorized backend access | Forbidden → 0 repository calls (unit + E2E) |
| Live writes | 0 |

## 10. Backend Findings

| ID | Status | Frontend treatment |
|---|---|---|
| F27-CA-01 list 404 when empty | open | named compatibility rule `listNotFoundMeansEmpty` (list only) |
| F27-CA-02 Cust. ID search → 500 | open | digits-only ≤ 18 validation; a 500 stays an error |
| **F27-CA-03** buyer-less customer → all users | **open** | no workaround; live R4 checks for it |
| **F27-CA-08** backend role enforcement unproven | **open** | frontend fail-closed |
| **R-09** detail has no decision date | **open** | not shown, not fabricated |
| **R-10** backend order not verifiable (`updated_at` not returned) | **open** | no ordering claim |
| F27-CA-04 / R-05 empty-id rows | open (existence unproven) | row kept, `userId: null`, "Tinjauan tidak tersedia" |

## 11. Known Limitations

- The Cust. ID validation message appears in the table alert, not next to the field.
- The search-type "Semua" option behaves as Cust. ID.
- Status filter is a select, and review is a page instead of the legacy modal. Visual parity: **NOT VERIFIED**.
- CSV replaces the legacy `.xlsx`. Phone numbers starting with `+` are exported with a leading `'` by the formula guard.
- The review page has no decision date (R-09).

## 12. Live READ Readiness

```text
Live READ execution: NOT PERFORMED IN THIS TASK
Live WRITE execution: 0
```

Ready to run once the owner authorizes it, using the GET/HEAD-only procedure in §13.

## 13. Live READ Safety Plan

### Safety rules

- **GET / HEAD only.** The script aborts before sending any other method.
- **Endpoints:** only `/api/v1/cms/users/need-approvals` and `/api/v1/cms/users/need-approvals/{id}`.
- **Never performed:** no login POST (the owner supplies an already-established access token), no approve / reject / update / register, no data creation, no cleanup, no write adapter.
- **Output:** method, path, HTTP status and sanitized shapes or counts only. Never tokens, emails, phones, names or ids.
- **Evidence:** written to `$TMPDIR/f27-live/evidence-<ts>.json`, then secret-scanned. The run fails if the scan finds anything.

### Cases

| Case | What is checked |
|---|---|
| R1 Authentication / session | the owner-supplied token is accepted (a 401 aborts the run) |
| R2 Default list | status, envelope, DTO shape, row count, `total_rows`. Ordering is recorded as **not verifiable** (R-10) |
| R3 Status filter | PENDING / APPROVED / REJECTED: every row has the requested status, or 404 means empty (F27-CA-01) |
| R4 Cust. ID search | 1) valid numeric id taken from a list row (not printed): checks whether every returned row has that id, which detects F27-CA-03; 2) nonexistent numeric id: records the status (500 expected, F27-CA-02; **not** treated as empty); 3) non-numeric input: blocked by the frontend rule, so no request is sent |
| R5 Pagination | page 1 / page 2 (`take` 5) are disjoint, compared in memory; the page beyond the last returns 200 with empty rows |
| R6 Detail | the first non-empty id returns 200 with the shape, and records that `approved_at` is absent (R-09); a random UUID returns 404 |
| R7 Empty-id rows | counts naturally occurring empty-id rows in a 100-row sample, without creating data |
| R8 CSV | client-side check, not part of the script: in the browser DevTools Network tab, click "Unduh Data" and expect **0 new requests** |

### Command (prepared, not executed)

Save the script below outside the repository, for example as `$TMPDIR/f27-live-read.mjs`. It needs Node ≥ 18 and has no dependencies. Then run it from a terminal where the owner has exported the variables. Values are never echoed.

```bash
export F27_LIVE_CONFIRM_NON_PRODUCTION=yes
export F27_LIVE_ALLOWED_HOST=devb2b-api.gpos.id
export F27_LIVE_BASE_URL=https://devb2b-api.gpos.id
# F27_LIVE_ACCESS_TOKEN: an already-established access token, provided by the owner (not via this script)
# KONG_API_KEY: only if the gateway requires it
# optional: F27_LIVE_UNKNOWN_CUSTOMER_ID (digits); default 999999999999
node "$TMPDIR/f27-live-read.mjs"
```

```js
// f27-live-read.mjs — F27 Verifikasi Akun LIVE READ. GET/HEAD only; aborts on any other method.
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

const env = process.env
const fail = (msg) => { console.error(`ABORT: ${msg}`); process.exit(2) }
if (env.F27_LIVE_CONFIRM_NON_PRODUCTION !== 'yes') fail('set F27_LIVE_CONFIRM_NON_PRODUCTION=yes')
const BASE = new URL(env.F27_LIVE_BASE_URL ?? '')
if (BASE.protocol !== 'https:' || BASE.hostname !== env.F27_LIVE_ALLOWED_HOST) fail('base URL must be https and equal F27_LIVE_ALLOWED_HOST')
const TOKEN = env.F27_LIVE_ACCESS_TOKEN
if (!TOKEN) fail('F27_LIVE_ACCESS_TOKEN missing (owner-supplied; this script never logs in)')
const API_KEY = env.KONG_API_KEY?.trim()
const UNKNOWN_CUSTOMER = env.F27_LIVE_UNKNOWN_CUSTOMER_ID ?? '999999999999'
const LIST = '/api/v1/cms/users/need-approvals'
const ALLOWED_METHODS = new Set(['GET', 'HEAD'])
const CUSTOMER_ID_RULE = /^\d{1,18}$/ // same rule as the frontend schema
const counts = { GET: 0, HEAD: 0, POST: 0, PUT: 0, PATCH: 0, DELETE: 0 }
const evidence = { module: 'account-verification', startedAt: new Date().toISOString(), steps: {}, observations: [] }

console.log('F27 LIVE READ SAFETY:\nGET/HEAD only\nPOST=0\nPUT=0\nPATCH=0\nDELETE=0\n')

const shape = (v) => Array.isArray(v) ? [`array(${v.length})`, ...(v.length ? [shape(v[0])] : [])]
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)]))
  : v === null ? 'null' : typeof v
const SAFE_PARAMS = new Set(['page', 'take', 'status', 'search_by'])

async function call(step, method, path, query = {}) {
  if (!ALLOWED_METHODS.has(method)) fail(`${method} is not allowed (GET/HEAD only)`)
  if (path !== LIST && !path.startsWith(`${LIST}/`)) fail(`endpoint outside F27 read scope: ${path}`)
  if (/\/(approve|reject)$/.test(path)) fail('mutation endpoint blocked')
  const url = new URL(path, BASE)
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, String(v))
  const headers = { Accept: 'application/json', Authorization: `Bearer ${TOKEN}` }
  if (API_KEY) headers['Api-Key'] = API_KEY
  counts[method]++
  const res = await fetch(url, { method, headers, redirect: 'error' })
  let body = null
  try { body = await res.json() } catch { body = null }
  const shownQuery = Object.fromEntries(Object.entries(query).map(([k, v]) => [k, SAFE_PARAMS.has(k) ? v : '<redacted>']))
  const shownPath = path === LIST ? LIST : `${LIST}/{id}`
  console.log(`${step} ${method} ${shownPath} ${JSON.stringify(shownQuery)} → ${res.status}`)
  evidence.observations.push({ step, method, path: shownPath, query: shownQuery, status: res.status, body: shape(body) })
  if (res.status === 401) fail('401 — token invalid or expired')
  return { status: res.status, data: body?.data ?? null }
}

const rowsOf = (r) => (r.status === 200 && Array.isArray(r.data?.rows) ? r.data.rows : [])

// R1 + R2
const def = await call('R1/R2', 'GET', LIST, { page: 1, take: 5, status: 'ALL' })
const defRows = rowsOf(def)
evidence.steps.R1 = { ok: def.status === 200 || def.status === 404 }
evidence.steps.R2 = { status: def.status, rows: defRows.length, total: def.data?.total_rows ?? null, ordering: 'not verifiable — updated_at not returned (R-10)' }

// R3
evidence.steps.R3 = {}
for (const s of ['PENDING', 'APPROVED', 'REJECTED']) {
  const r = await call(`R3:${s}`, 'GET', LIST, { page: 1, take: 5, status: s })
  const rows = rowsOf(r)
  evidence.steps.R3[s] = { status: r.status, rows: rows.length, total: r.data?.total_rows ?? null, allMatch: rows.every((x) => x.status === s), emptyVia404: r.status === 404 }
}

// R4
const sample = await call('R4/R7 sample', 'GET', LIST, { page: 1, take: 100, status: 'ALL' })
const sampleRows = rowsOf(sample)
const known = sampleRows.find((x) => Number.isInteger(x.aam_customer_id) && x.aam_customer_id > 0)
evidence.steps.R4 = {}
if (known) {
  const id = String(known.aam_customer_id)
  const r = await call('R4:valid', 'GET', LIST, { page: 1, take: 100, status: 'ALL', search_by: 'customer_id', keyword: id })
  const rows = rowsOf(r)
  evidence.steps.R4.valid = { status: r.status, rows: rows.length, total: r.data?.total_rows ?? null, allRowsMatchSearchedId: rows.every((x) => String(x.aam_customer_id) === id), totalEqualsRows: (r.data?.total_rows ?? -1) === rows.length }
} else evidence.steps.R4.valid = { skipped: 'no row with a customer id in the sample' }
if (!CUSTOMER_ID_RULE.test(UNKNOWN_CUSTOMER)) fail('F27_LIVE_UNKNOWN_CUSTOMER_ID must be digits (≤ 18)')
const unk = await call('R4:unknown', 'GET', LIST, { page: 1, take: 5, status: 'ALL', search_by: 'customer_id', keyword: UNKNOWN_CUSTOMER })
evidence.steps.R4.unknown = { status: unk.status, note: unk.status === 500 ? 'backend 500 (F27-CA-02) — recorded as error, not empty' : 'see status' }
evidence.steps.R4.nonNumeric = { blockedByFrontendRule: !CUSTOMER_ID_RULE.test('12a4'), requestSent: false }

// R5
const p1 = rowsOf(await call('R5:page1', 'GET', LIST, { page: 1, take: 5, status: 'ALL' }))
const p2 = rowsOf(await call('R5:page2', 'GET', LIST, { page: 2, take: 5, status: 'ALL' }))
const ids1 = new Set(p1.map((x) => x.id).filter(Boolean))
const total = def.data?.total_rows ?? 0
const beyond = await call('R5:beyond', 'GET', LIST, { page: Math.ceil(total / 5) + 1, take: 5, status: 'ALL' })
evidence.steps.R5 = { page1: p1.length, page2: p2.length, disjoint: p2.every((x) => !x.id || !ids1.has(x.id)), beyondLast: { status: beyond.status, rows: rowsOf(beyond).length } }

// R6
const withId = sampleRows.find((x) => typeof x.id === 'string' && x.id !== '')
evidence.steps.R6 = {}
if (withId) {
  const d = await call('R6:existing', 'GET', `${LIST}/${encodeURIComponent(withId.id)}`)
  evidence.steps.R6.existing = { status: d.status, sameId: d.data?.id === withId.id, hasApprovedAt: d.data ? 'approved_at' in d.data : null }
} else evidence.steps.R6.existing = { skipped: 'no row with an id' }
const u = await call('R6:unknown', 'GET', `${LIST}/${randomUUID()}`)
evidence.steps.R6.unknown = { status: u.status }

// R7
evidence.steps.R7 = { sampleRows: sampleRows.length, emptyIdRows: sampleRows.filter((x) => !x.id).length }
evidence.steps.R8 = { note: 'client-side: verify in browser DevTools that "Unduh Data" issues 0 requests' }

evidence.finishedAt = new Date().toISOString()
evidence.methods = counts
if (counts.POST + counts.PUT + counts.PATCH + counts.DELETE !== 0) fail('non-GET request recorded')
const dir = join(tmpdir(), 'f27-live'); mkdirSync(dir, { recursive: true })
const file = join(dir, `evidence-${evidence.startedAt.replace(/[-:.TZ]/g, '').slice(0, 14)}.json`)
writeFileSync(file, JSON.stringify(evidence, null, 2))
const text = readFileSync(file, 'utf8')
const hits = [/eyJ[\w-]{10,}/, /bearer\s/i, /[\w.+-]+@[\w-]+\.[\w.]+/, /\+?\d{9,}/].filter((re) => re.test(text)).length + (text.includes(TOKEN) ? 1 : 0)
console.log(`\nevidence: ${file}\nmethods: ${JSON.stringify(counts)}\nsecret scan hits: ${hits}`)
if (hits) fail('secret scan found sensitive content in evidence — do not share it')
```

### Alternative

The existing harness command `LIVE_MODULE=account-verification npx --no-install vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts` also reads only, through the READ-only adapter. However, it **logs in and out via POST**. Use it only if the owner explicitly allows that authentication POST. Login and logout are not business mutations, but this task forbids automating them.

## 14. Final Decision

```text
F27 MODULE GATE: CONDITIONAL GO — PROVISIONAL
Final once the owner records: npm run build, check:bundle, full E2E
Open: F27-CA-03, F27-CA-08, R-09, R-10 (+ F27-CA-01 / F27-CA-02 with frontend rules in place)
Live READ: NOT PERFORMED · Live WRITE: 0 · F11 W3: NOT STARTED
Next: OWNER-AUTHORIZED F27 LIVE READ (GET/HEAD only)
```
