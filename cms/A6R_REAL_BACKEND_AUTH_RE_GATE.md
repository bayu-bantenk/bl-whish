# A6-R — Real Backend & Authentication Verification (A6 Re-Gate)

| Field | Value |
|---|---|
| Date | 2026-09-30 |
| Repo / branch | `frontend/` · `chore/a5.0-foundation-remediation` (uncommitted A5.0–A6 work; nothing committed in A6-R) |
| Evidence classes | **TEST_ADAPTER** (mock backend, E2E / unit) and **REAL_BACKEND** (actual gateway) are kept separate. No TEST_ADAPTER result is claimed as REAL_BACKEND |

## Executive status

```text
A6-R STATUS:     BLOCKED — REAL BACKEND INACCESSIBLE (target unconfirmed) + REAL TEST ACCOUNT UNAVAILABLE
A6 FINAL STATUS: BLOCKED (unchanged)
ATTEMPT 2:       STOPPED at pre-flight — API_HOST (localhost) ≠ confirmed gateway devb2b-api.gpos.id;
                 gate variables not visible to the agent process
ATTEMPT 3:       gateway REACHABLE; credential-free REAL_BACKEND probes executed (below);
                 authenticated verification BLOCKED — gate variables still absent from the agent process
ATTEMPT 4:       target configured (.env.local); harness extended (read-only); npm run test:live
                 refused by the gate — A55R_* still not in the agent process → BLOCKED
```

## Execution attempt 4 — 2026-09-30

### Pre-flight (REAL_BACKEND)

| Check | Observed | Result |
|---|---|---|
| `printf 'CONFIRM=%s' "$A55R_CONFIRM_NON_PRODUCTION"` | `CONFIRM=` (empty) | BLOCKED |
| `HOST` / `EMAIL` | empty / empty; `A55R_PASSWORD` unset (presence checked, not printed) | BLOCKED |
| `zsh -i`, `zsh -l`, parent-process environment | 0 `A55R_*` variables | BLOCKED |
| Agent process | same PID as attempt 3, uptime 12 h 31 m. Launched with `--input-format stream-json --output-format stream-json`, i.e. by an IDE / SDK host, **not** by the owner's terminal. Restarting from the terminal did not change the process this session runs in | root cause |
| `frontend/.env.local` | **created**, gitignored (`.gitignore:34 .env*`). Contains only `API_HOST=https://devb2b-api.gpos.id` and `GATEWAY_AUTH_CONTRACT=legacy-v1`. Effective config: host `devb2b-api.gpos.id`, path `/`, contract `legacy-v1` | done |
| `.env` | not modified | — |

```text
$ npm run test:live
A5.5R BLOCKED by safety gate: A55R_CONFIRM_NON_PRODUCTION=yes not set
Tests  1 passed | 12 skipped (13)
```

**Harness extension** (`test/live/content-list.live.test.ts`, still read-only; the gate is unchanged):
- `S2b` detail: existing id + unknown id; GET on `/api/v1/cms/contents/:id` is allowed only for ids passing `isContentId`;
- `S10` rotation booleans;
- `S11` refresh failure on a session *copy*;
- logout: local clear + whether the old access token is still accepted.

No write step was added. Content create / update stays out of the harness until read access and write permission are shown for the account.

### REAL_BACKEND matrix (attempt 4)

| # | Check | State |
|---|---|---|
| 1 | Login | BLOCKED |
| 2 | Authenticated Content list | BLOCKED |
| 3 | Content detail | BLOCKED |
| 4 | Content create | NOT VERIFIED — write permission of the test account not established (no login) |
| 5 | Content update | NOT VERIFIED — as 4 |
| 6 | Refresh endpoint `POST /api/v1/auth/refresh` | BLOCKED (existence + invalid-token 400 observed in attempt 3) |
| 7 | Refresh-token rotation | BLOCKED |
| 8 | 401 → refresh → retry | BLOCKED (invalid Bearer → 401 observed in attempt 3) |
| 9 | Refresh failure / session invalidation | BLOCKED |
| 10 | Logout | BLOCKED |
| 11 | Authorization | BLOCKED |
| 12 | Browser token boundary | BLOCKED (TEST_ADAPTER: PASS) |

### TEST_ADAPTER (separate)

- `npm run quality`: 35 files, 511 passed (after the attempt-3 `legacy-v1` refresh change).
- `tsc` 0 errors and eslint clean after the harness extension.

### Unblock (one command, in the owner's terminal)

The owner's terminal has the variables, and `.env.local` now supplies the target. Run there:

```bash
cd frontend && npm run test:live
```

- Sanitized evidence is written to `$TMPDIR/a55r-live/evidence.json`: statuses, field names, counts and booleans; no values or tokens.
- The agent can read that file to complete this report.
- Alternatively, start the agent from that terminal as a plain CLI session (`claude` run in that shell), so the tool shell inherits the variables.

## Execution attempt 3 — 2026-09-30 22:30–22:45 WIB

### Pre-flight

| Check | Observed | Result |
|---|---|---|
| `A55R_CONFIRM_NON_PRODUCTION`, `A55R_ALLOWED_HOST`, `A55R_EMAIL`, `A55R_PASSWORD` in the agent's shell | **all MISSING**, also in `zsh -i` | BLOCKED |
| Why | The agent process (`claude`, parent of every tool shell) was started ~12 h before the owner exported the variables. A child process cannot see variables exported later in another terminal | — |
| `frontend/.env.local` | does not exist | — |
| `API_HOST` | still `localhost:4001/api/v1` (not changed; brief §3) | mismatch persists |

`npm run test:live` was therefore **not run**. It would stop at `A55R_CONFIRM_NON_PRODUCTION=yes not set`, and the gate was not touched.

### REAL_BACKEND — credential-free probes (executed)

**Method:**
- Direct HTTPS from this machine to the owner-confirmed non-production host `https://devb2b-api.gpos.id`.
- **No credentials or tokens were sent.** The only token used was the literal string `a6r-invalid-probe`.
- The configured `KONG_API_KEY` was sent in two probes only to test whether it is required. It was read inside the process and never printed.
- Recorded: status, content type, envelope keys and types, the `code` / `status` / `error_code` / `message` fields, and `X-Request-Id` echo.
- Scripts: `/tmp/a6r2/probe*.mjs` (outside the repo).

| # | Request | Status | Envelope | Classification |
|---|---|---|---|---|
| P1 | `GET /api/v1/cms/contents?page=1&take=5`, no auth | **403** | `{code:403, status:"FAILED", data:null, message:"Forbidden"}` | VERIFIED_RUNTIME |
| P2 | same, `Authorization: Bearer <invalid>` | **401**, **empty body**, no content-type, no `WWW-Authenticate` | — | VERIFIED_RUNTIME |
| P3 | same, `Api-Key` only | 403 (same as P1) | same as P1 | VERIFIED_RUNTIME |
| P4 | same, invalid Bearer + `Api-Key` | 401 (same as P2) | — | VERIFIED_RUNTIME |
| P5 | `POST /api/v1/auth/refresh {refresh_token:"<invalid>"}` | **400** | `{code:400, status:"FAILED", data:null, message:"Invalid token"}` | VERIFIED_RUNTIME |
| P6 | `POST /api/v1/auth/refresh {}` | 400 | `{code:400, status:"FAILED", error_code:"ERR_VALIDATION_ERROR", message:"Validation Error", data:[{FailedField:"RefreshTokenRequest.RefreshToken", Tag:"required", Value:""}]}` | VERIFIED_RUNTIME |
| P7 | `POST /api/v1/auth/login {}` | 400 | same validation envelope; `data` holds 2 items: `LoginRequest.Email` and `LoginRequest.Password`, both `required` | VERIFIED_RUNTIME |
| P8 | `POST /api/v1/auth/logout`, no auth | **500** | `{code:500, status:"FAILED", data:null, message:"Internal Server Error"}` | VERIFIED_RUNTIME |
| P9 | `POST /api/v1/auth/refresh-token` (old path) | 404 `text/plain` | — | VERIFIED_RUNTIME |

- **Across P1–P9:** `server: nginx-more`, **no `X-Request-Id` echo**, latency 14–251 ms.
- **Network:** plain internet HTTPS works from this machine; no VPN or proxy needed, and the TLS chain was accepted by Node 24.

### What the probes establish

1. **Reachability:** the confirmed gateway is reachable. RK "network/VPN" is closed for this host.
2. **Paths exist:**
   - `/api/v1/auth/login`, `/api/v1/auth/refresh`, `/api/v1/auth/logout` and `/api/v1/cms/contents` are routed (JSON envelopes).
   - `/api/v1/auth/refresh-token` does not exist (404), so the old `b0` refresh path is wrong for this host.
3. **Request fields:**
   - Login takes `Email` and `Password` (Go struct `LoginRequest`), which fits `legacy-v1` `{email, password}`. The exact JSON key casing is INFERRED until a real login.
   - Refresh takes `refresh_token` (`RefreshTokenRequest.RefreshToken`), which fits the backend-provided contract.
4. **Envelope:** `{code, status:"SUCCESS|FAILED"?, data, message, error_code?}`. On errors `code` equals the HTTP status. `status:"FAILED"` was observed; the success value is UNKNOWN.
5. **Auth semantics:**
   - **No Bearer → 403.** Invalid Bearer → **401 with an empty body.** The existing `GatewayClient` refreshes on HTTP 401 only, which matches: an expired token (presented but rejected) would take the 401 → refresh path.
   - The app never sends a Content request without a Bearer (session required first), so the P1 403 is not reachable in-app.
   - An empty 401 body is handled by status, not envelope. That the app treats it as Unauthenticated is TEST_ADAPTER-covered (`gateway-client.test.ts`), not yet real-run.
6. **Refresh rejection:** a bad refresh token gets **HTTP 400** (not 401). The session manager treats any failed refresh as terminal (session cleared → login), so 400 lands on the correct path. This is TEST_ADAPTER-covered; the real end-to-end run is still pending.
7. **API key:** no observable effect on an unauthenticated or invalid-token request (P1 = P3, P2 = P4). This does **not** prove it is unnecessary for authenticated calls. **UNKNOWN**; kept as configured.
8. **Request ID:** the gateway does **not echo** `X-Request-Id`. Whether it reaches the backend is UNKNOWN (not observable from outside).
9. **Logout without a token → 500.** The backend answers a malformed logout with a server error. The app's logout always sends a Bearer and clears the local session regardless of the result (A5.1), so this is safe for users. It is recorded as a backend robustness issue.

### Code change (evidence-driven, minimal)

| Step | Detail |
|---|---|
| Observed | `/api/v1/auth/refresh` exists (P5/P6, and the backend-provided contract); `/refresh-token` doesn't (P9) |
| Mismatch | `legacy-v1.refreshPath = null` → the app would never refresh on this gateway; a 401 would end the session instead |
| Correction | `src/packages/auth/repository/dto.ts` `legacy-v1` profile:<br>- `refreshPath: '/api/v1/auth/refresh'`;<br>- `parseRefresh` maps `data {access_token, expires_at, refresh_token}` through the shared `legacyTokens` (the zone-less `expires_at` rule is unchanged);<br>- `parseLogin` now also keeps an optional `refresh_token`.<br>No new auth implementation. Session, single-flight, retry and no-replay rules are unchanged |
| Tests | `auth.repository.test.ts`, replacing the old "no refresh endpoint" test:<br>- login keeps `refresh_token`;<br>- refresh posts `{refresh_token}` to `/api/v1/auth/refresh` with no Bearer and maps the rotated pair;<br>- missing expiry / token → Contract;<br>- 400 "Invalid token" → failure |
| Unverified | Refresh success envelope `code` (the repository expects 200, INFERRED from error codes = HTTP status); login response field names; whether login returns `refresh_token` |

`server-config.ts` comment updated. **No configuration was changed** (`API_HOST` and `GATEWAY_AUTH_CONTRACT` untouched).

### REAL_BACKEND verification matrix

| # | Test | State | Reason |
|---|---|---|---|
| 1 | Real login | **BLOCKED** | no credentials visible to the agent. Route and field names only (P7) |
| 2 | Authenticated Content list | **BLOCKED** | needs 1. Route exists; auth semantics observed (P1–P4) |
| 3 | Content detail | BLOCKED | needs 1 |
| 4 | Content create | BLOCKED | needs 1 + write permission |
| 5 | Content update + read-back | BLOCKED | needs 1 + 4 |
| 6 | Token refresh (success) | **BLOCKED** | needs a real refresh token. Endpoint existence **PASS** (P5/P6) |
| 7 | Refresh-token rotation | BLOCKED | needs 6 |
| 8 | 401 → refresh → retry | BLOCKED | invalid-token → 401 semantics **PASS** (P2); the full chain needs a session |
| 9 | Refresh failure → session invalidation | NOT VERIFIED end-to-end | backend rejection semantics **PASS** (P5: 400 "Invalid token"); app behaviour is TEST_ADAPTER only |
| 10 | Logout | BLOCKED | needs a token. Unauthenticated logout = 500 (P8) |
| 11 | Browser token boundary | BLOCKED | needs a real login in the browser. TEST_ADAPTER PASS |
| 12 | Authorization | BLOCKED | needs an account. No-token → 403 observed |
| 13 | Request ID | **PARTIAL** | not echoed (P1–P9); propagation to the backend UNKNOWN |
| 14 | Error mapping | **PARTIAL** | 400 validation (`ERR_VALIDATION_ERROR`, `data[] {FailedField, Tag, Value}`), 400 invalid token, 401 empty, 403, 404 text/plain, 500 observed. **The Content write 400/409/422 shapes are unobserved.** The A6 field-error mapper assumes `{errors:{field:[…]}}`, which does **not** match the observed `data[]{FailedField}` style (RK-A6-05 confirmed as a real risk; fix once a Content validation response is seen) |

### Security notes from attempt 3

- **SN-A6R-02:**
  - Backend validation errors echo the submitted `Value` per failed field. A password that fails a non-`required` rule could come back in the response body.
  - The app never logs gateway bodies (`gateway-client.ts` logs status / duration / kind only) and does not forward the raw `data` to the browser.
  - Keep it that way; don't add body logging.
- **SN-A6R-03:** unauthenticated logout → 500 (backend robustness). No app exposure.
- Nothing secret was printed: no credential was used; the API key was sent twice and never printed.

### To finish A6-R

1. Restart Claude Code **from the terminal where the `A55R_*` variables are exported**, so the agent process inherits them. Alternatively, run the steps yourself.
2. Approve a gitignored `frontend/.env.local` with `API_HOST=https://devb2b-api.gpos.id` (bare origin; the paths already carry `/api/v1`) and `GATEWAY_AUTH_CONTRACT=legacy-v1`.
3. Then `npm run test:live` (login + list, read-only).
4. The next harness extension (reviewed) covers:
   - detail;
   - a forced 401 via an invalidated access token on a copy of the session record;
   - refresh / rotation;
   - refresh failure;
   - logout;
   - create / update + read-back of a `A6R-TEST-*` record only.

**No request was sent to any real backend in A6-R.** The preconditions for a safe contact are all missing, and none changed since A5.5R:
- a confirmed **non-production** target host;
- an approved **test account**;
- the operator's confirmation variables.

- The live harness refuses to run, as designed. The safety gate was **not** modified or bypassed.
- The TEST_ADAPTER suites, build and bundle remain green (re-run below).
- One security finding was made and fixed in the working tree: **SF-A6R-01**, a committed API-key value in `.env.example`.

## Execution attempt 2 — 2026-09-30 (stopped at pre-flight)

**Inputs from the owner:**
- Confirmed non-production gateway: `https://devb2b-api.gpos.id`.
- Backend-provided refresh contract: `POST /api/v1/auth/refresh {refresh_token}` → `data {access_token, expires_at, refresh_token}`.
- Backend-provided logout contract: `POST /api/v1/auth/logout`, `Authorization: Bearer`.
- These are classified **BACKEND_DOC**: owner-supplied, not yet observed. Only a real response makes them VERIFIED_RUNTIME.

**Pre-flight result: STOP.** No request was sent, and no code or config was changed.

| Check | Observed | Result |
|---|---|---|
| Gate variables visible to the agent process | `A55R_CONFIRM_NON_PRODUCTION`, `A55R_ALLOWED_HOST`, `A55R_EMAIL`, `A55R_PASSWORD`: **none present**. They were exported in the owner's terminal, which this process does not inherit | BLOCKED |
| `API_HOST` (frontend `.env`) | `http://localhost/api/v1` form: host **`localhost`**, port 4001, path prefix `/api/v1` | **MISMATCH** with `devb2b-api.gpos.id` |
| Legacy `APIGATEWAY_URL` | https, hostname **equals** `devb2b-api.gpos.id` | matches (legacy config) |
| `GATEWAY_AUTH_CONTRACT` | unset → `b0` (`/auth/login`, `/auth/refresh-token`) | wrong profile for this gateway |
| `KONG_API_KEY` | set (value not read or printed) | requirement UNKNOWN (OD-03) |
| Path prefix | `legacy-v1` and Content paths already contain `/api/v1`. For this gateway `API_HOST` must be the bare origin, or requests become `/api/v1/api/v1/...` | configuration note |

This resolves OD-02 in principle: the confirmed gateway is the legacy `APIGATEWAY_URL` host.

**Implementation gaps against the backend-provided contract.** Code change is deferred until config is aligned; the change must stay inside the existing `legacy-v1` profile, with no new auth implementation:

| Profile item | Current `legacy-v1` | Backend-provided | Minimal correction |
|---|---|---|---|
| `refreshPath` | `null` (re-login) | `/api/v1/auth/refresh` | set path |
| `refreshBody` | `{refresh_token}` | `{refresh_token}` | none |
| `parseRefresh` | always Contract error | `data {access_token, expires_at, refresh_token}` | parse like login (`parseExpiresAt`) |
| `parseLogin` refresh token | not read | UNKNOWN: login response not yet observed | read `refresh_token` if present, after the real login confirms it |
| `logoutBody` | none; Bearer by GatewayClient | Bearer, no body | none |

**Harness scope gap.** `test:live` is read-only: GET on the content list plus POST to the auth endpoints. Detail, create, update, forced-401 refresh, refresh failure and logout checks need an explicit, reviewed extension, including a write allowlist for the test record only. The safety gate itself stays unchanged.

## Backend environment

| Item | Finding | Class |
|---|---|---|
| Environment | Not confirmed. Two candidate hosts, both only *named* like non-production (A5.5R) | UNKNOWN |
| Backend / gateway host (new CMS) | `API_HOST` in `frontend/.env`: `http:` (no TLS), has a path prefix, resolves to **private** addresses → probably needs the corporate network / VPN | INFERRED (A5.5R DNS) |
| Gateway host (legacy) | `APIGATEWAY_URL` in `gpos-b2b-cms/.env`: `https:`, no path, **public** address; a different host from `API_HOST` | INFERRED (A5.5R DNS) |
| Authoritative host (OD-02) | **Undecided.** Neither `.env` has changed since A5.5R (mtimes 2026-09-29 / 2026-09-14) | UNKNOWN |
| Deployment config | `frontend/Jenkinsfile`: builds the image and runs `kubectl set image`; no env values. Legacy `Jenkinsfile*` copy `.env` from a server path or k8s secret (`secret-<deployment>`) — not readable here, and not read | LEGACY_CODE |
| Network requirement | Private-address `API_HOST` suggests VPN or corporate network; the corporate network intercepts HTTPS (project memory) | INFERRED |
| TLS | `API_HOST` is plain http. The legacy host is https, and the proxy may need the corporate CA | INFERRED |
| Proxy | No `HTTP(S)_PROXY` / `NO_PROXY` set in the shell | VERIFIED (local shell) |
| API key requirement | Legacy sends **none** (A5.5 capture). New CMS sends `Api-Key` when `KONG_API_KEY` is set (OD-03) | legacy VERIFIED_RUNTIME (capture); backend UNKNOWN |
| Test account | **None.** No `A55R_EMAIL` / `A55R_PASSWORD` (or any credential variable) in the environment. The legacy login page's prefilled values are not an approved account (A5.5R) | — |
| Operator confirmation | `A55R_CONFIRM_NON_PRODUCTION` and `A55R_ALLOWED_HOST` are unset | — |

### What the variables mean

| Variable | Meaning in code | Consumer |
|---|---|---|
| `API_HOST` | Base URL of the gateway **including any path prefix**. `GatewayClient` appends feature paths to it (e.g. `+ /api/v1/cms/contents`) | `server-config.ts` → `GatewayClient` (server-only; never inlined — `next.config.ts` has no `env` block) |
| `APIGATEWAY_URL` | Legacy Adonis gateway base (no prefix); legacy `ApiService` prepends it to `/api/v1/...` | legacy only |
| `KONG_API_KEY` | Optional. Sent as the `Api-Key` header on every gateway request when non-empty | server-only |
| `GATEWAY_AUTH_CONTRACT` | Selects the auth wire profile:<br>- `b0` (default) = template contract `/auth/login`, `/auth/refresh-token`, `/auth/logout`;<br>- `legacy-v1` = `/api/v1/auth/login`, `/api/v1/auth/logout`, **no refresh endpoint** (`refreshPath: null` → re-login) | `packages/auth/repository/dto.ts` |

## Live harness: exact blocker

```text
$ npm run test:live
A5.5R BLOCKED by safety gate: A55R_CONFIRM_NON_PRODUCTION=yes not set
Tests  1 passed | 10 skipped (11)
```

The gate checks, in order (`test/live/content-list.live.test.ts` L59–68):
1. `A55R_CONFIRM_NON_PRODUCTION=yes` — **missing**;
2. `A55R_ALLOWED_HOST` equal to the `API_HOST` hostname — **missing**;
3. `A55R_EMAIL` / `A55R_PASSWORD` — **missing**.

These are operator inputs. Setting them myself would mean guessing the environment and inventing an account, which the brief forbids. The gate was left intact.

## Authentication contract

| Item | Legacy evidence | Real backend evidence | Status |
|---|---|---|---|
| Login endpoint | `POST /api/v1/auth/login` on `APIGATEWAY_URL` (A2, A3.1 capture) | none | LEGACY_CODE / VERIFIED_RUNTIME (legacy side only); backend **UNKNOWN** |
| Method | POST | none | LEGACY_CODE |
| Request fields | email, password (+ login-by field, A3.1) | none | LEGACY_CODE |
| Response | envelope `{code, data}` | none | UNKNOWN |
| Access token | `data` token field (A5.1 `legacy-v1` parser) | none | LEGACY_CODE |
| Refresh token | none used by legacy | none | UNKNOWN |
| Expiry | zone-less `expires_at` (WIB) | none | LEGACY_CODE |
| Identity | user fields in the login data | none | LEGACY_CODE |
| Refresh endpoint | **none**: legacy re-logs in. `b0` assumes `/auth/refresh-token` | none | UNKNOWN (which contract the real host speaks) |
| Logout | `POST /api/v1/auth/logout` + local session destroy | none | LEGACY_CODE |

## Content contract

| Item | Legacy | A6 | Real backend | Status |
|---|---|---|---|---|
| List | `GET /api/v1/cms/contents` + query **and** GET body (A5.5 capture) | same path, query only (OD-31) | none | BLOCKED |
| Pagination | `page`, `take` → `data.total_rows` | `page`, `take` → `Page<T>` | none | BLOCKED |
| Sort | `sort_by`, `asc_desc` | same | none | BLOCKED |
| Search | `keyword` | same | none | BLOCKED |
| Create | `POST` body `{code, name, is_active:boolean, value:string\|null}`; success iff `code 201` | identical request; same rule | none | BLOCKED |
| Update | `PUT /:id`, same body; success `code 200` | identical | none | BLOCKED |
| Detail | `GET /:id`; legacy ignores `is_active` | requires `is_active` | none | BLOCKED |

## Runtime flow

- **Verified only under TEST_ADAPTER** (A6):
  ```text
  Browser → Next.js page / Server Action → DAL → use case → repository → GatewayClient → mock gateway
  ```
- **REAL_BACKEND:** not exercised.

## Refresh evidence

**REAL_BACKEND:** none. Note for the future run: if the real host speaks `legacy-v1`, there is no refresh endpoint. A 401 then ends the session (re-login) by design, and "401 → refresh → retry" is **not applicable** to that contract.

TEST_ADAPTER evidence (A5.1 / A6):
- single-flight refresh;
- 1 refresh + 1 retry per expired read;
- mutation not replayed;
- failed refresh → session cleared → login with `returnTo`.

## Browser security

- **REAL_BACKEND:** not run (no real login).
- **TEST_ADAPTER:** passes in all 65 E2E tests (A6), and the bundle check is re-run below.

**SF-A6R-01 (fixed in working tree):**
- `frontend/.env.example` contained a non-placeholder 32-character `KONG_API_KEY` value. It came from the DexanKit template commit `8c24d71` and is still in that commit's history.
- It is replaced by an empty placeholder.
- The value is not in `.next/static` (0 files) or in `src` (the name appears only in server-config and the architecture test).
- Whether it is a live gateway credential is UNKNOWN. **Owner action: treat it as exposed; rotate it if it is real.** Rewriting history is not done (destructive; your decision).

## Authorization

- **REAL_BACKEND:** no identity or role evidence (no account).
- The application side remains the A6 interim policy: `AUTHZ_INTERIM_GRANTS`, default none.
- The mapping from backend role to capability stays OD-05 / OD-06.

## Upload

Not applicable. The Content slice has no upload (A6). The real signed-URL contract remains BLOCKED from A5.6.

## Request ID

- `GatewayClient` sends `X-Request-Id` (TEST_ADAPTER verified).
- Whether the gateway or backend accepts or echoes it is **UNKNOWN** (no real call). The harness records `requestIdPropagated` once it runs.

## Test results

| Class | Command | Result |
|---|---|---|
| TEST_ADAPTER | `npm run quality` | exit 0; 35 files, **508 passed** |
| TEST_ADAPTER | `CI=1 npm run test:e2e:full` | 65 / 65 (A6 run, 2026-09-30; no code changed since, apart from `.env.example`) |
| build | `next build` | exit 0; `/dashboard/content`, `/create`, `/update/[id]` |
| bundle | `npm run check:bundle` | PASS (34 files) |
| REAL_BACKEND | `npm run test:live` | **not run**: refused by the safety gate (above) |

## Blockers

| ID | Blocker | Needed from | Unblocks |
|---|---|---|---|
| BL-1 | OD-02: which host serves the new CMS (`API_HOST` vs legacy `APIGATEWAY_URL`), and written confirmation that it is **non-production** | backend / infra owner | everything |
| BL-2 | Network path to that host (VPN / corporate CA for TLS interception) | infra | everything |
| BL-3 | Dedicated test account(s): one with Content write, ideally one without, for the negative test | backend owner | login, list, write, authz |
| BL-4 | Which auth contract the host speaks (`b0` vs `legacy-v1`; is there a refresh endpoint?) | backend owner (or the first harness run) | refresh / logout |
| BL-5 | Permission to **mutate** Content on that environment (create / update test rows, plus cleanup). The harness is read-only by design | backend owner | create / update |
| BL-6 | Is `KONG_API_KEY` required, and is the committed example value real (SF-A6R-01)? | gateway owner | API key, security |

**How to run once BL-1 to BL-4 are resolved:**
- Put the confirmed URL in `API_HOST` and `GATEWAY_AUTH_CONTRACT` in `frontend/.env.local` (gitignored).
- Then, from your own shell:
  ```bash
  A55R_CONFIRM_NON_PRODUCTION=yes A55R_ALLOWED_HOST=<host> A55R_EMAIL=… A55R_PASSWORD=… npm run test:live
  ```
- The sanitized evidence is written outside the repo. Share only that file.
- Browser, refresh, logout and write verification follow after that, per the A6-R brief §9–18.
