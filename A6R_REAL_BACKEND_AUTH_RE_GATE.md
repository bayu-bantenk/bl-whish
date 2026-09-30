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
```

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
