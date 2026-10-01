A5.5R can move from **BLOCKED to GO-WITH-RISKS**. A6 has to stay **BLOCKED**, because create and update ship in the slice and haven't been run against the real backend. This is assessment only: I changed no files, sent no writes, and didn't open the GitHub link.

**Source.** The evidence file is the same one reviewed last turn: 18 332 bytes, `startedAt` 2026-10-01T02:28:22.877Z, 20 observations. It matches your latest live result (12 passed, 1 skipped). Where older reports say A5.5R is BLOCKED, this evidence replaces them.

### 1. Status reconciliation (REAL_BACKEND)

| Area | Status | Evidence |
|---|---|---|
| Login | VERIFIED | `POST /api/v1/auth/login` → 200 / `code 200`; session created with a refresh token |
| Backend `expires_at` | VERIFIED | RFC3339 with nanoseconds, `+07:00`, +43 200 min (30 days); parser accepted it |
| Content list | VERIFIED | 200; `data {limit, page, sort, total_rows, total_pages, rows[]}`; 5 of 19 rows |
| Content detail (existing id) | VERIFIED | 200; `id, name, code, value, is_active:boolean` |
| Pagination | VERIFIED | page 1 and 2 don't overlap; page 0 returns the same as page 1; page 5 returns 0 rows, total 19 |
| Sorting by `code` | VERIFIED | asc and desc over all 19 rows; desc is the exact reverse |
| Sorting by `created_at` (default) | UNKNOWN | backend accepts it, but rows have no `created_at` to check the order |
| Search, including no-match | VERIFIED | a hit returns 1 of 1, matching code or name; no-match returns 0/0 as `ok`, not an error |
| Authorization: backend read | VERIFIED | the account can list and read detail |
| Authorization: local policy | VERIFIED (app only) | S8 `Forbidden`, 0 gateway calls; S9 forged/expired session → `Unauthenticated`, 0 calls |
| Authorization: backend write / denial | NOT VERIFIED | no write sent; no restricted second account |
| 401 → refresh → retry | VERIFIED | `GET 401` (empty body), then `POST /api/v1/auth/refresh` 200, then `GET 200`; exactly 1 refresh and 1 retry |
| Refresh rotation | VERIFIED | access token changed, refresh token present and rotated, new expiry in the future (true/false checks inside the process) |
| Failed refresh | VERIFIED | `GET 401`, then `POST /refresh` → **400**, `data:null`; mapped to `Unauthenticated`; no loop |
| Session cleanup after failed refresh | VERIFIED (local) | `sessionCleared:true`. It did **not** call backend logout |
| Logout | VERIFIED | `POST /api/v1/auth/logout` with Bearer → 200 `{message}`; local session cleared |
| Revocation after logout | VERIFIED | the logged-out access token then gets `GET 401` |
| Request ID | UNKNOWN (backend side) | the app sent `X-Request-Id` on all 20 requests; the gateway doesn't echo it |

### 2. Unknown id

- **Backend:** HTTP **403**, empty body, no content type. VERIFIED.
- **App mapping:** `gateway-errors.ts` maps 403 to `Forbidden`; only 404 maps to `NotFound`. The recorded result is `{ok:false, kind:"Forbidden"}`.
- **The final result was not `NotFound`.** The test passed only because the step has no assertion; its name is misleading.
- The same account reads an existing id fine, so this isn't a missing read permission.
- Whether 403 always means "not found" on this backend is UNKNOWN, from one sample.

### 3. S6 and S7

| Step | Status | Evidence |
|---|---|---|
| S6, GET request with a body | NOT VERIFIED (skipped) | `"NOT_RUN: A55R_PROBE_GET_BODY not set"`; `getBody=false` on all 20 requests |
| S7, request without API key | NOT VERIFIED (skipped) | `"NOT_RUN: probe not enabled or no API key configured"`; `apiKey=true` on all 20 requests |

Even though S6 was skipped, the run does settle what the app needs: a query-string-only request is enough. Pagination, sort and search all responded correctly to query parameters with no GET body, so the app doesn't need a GET body (OD-31). Whether the backend *also* accepts one is UNKNOWN, and the app doesn't need it.

For S7, the API key is always sent and the requests work. Whether the backend *requires* it is UNKNOWN (OD-03).

### 4. Secrets

- Pattern scan, all absent: JWT strings, `Bearer` values, long opaque strings, `authorization` / `cookie` / `set-cookie` / `password` keys, API-key values, email addresses.
- No request bodies are stored. Authorization and API key appear only as true/false fields. Tokens are recorded as types only, the expiry as a digit-masked format, and the search term as `<term>`.
- **No secrets were found.**

### 5. A5.5R re-gate

**From BLOCKED to GO-WITH-RISKS.** A5.5R's scope (the real read contract and authentication) is verified against the real non-production backend:
- login, refresh with rotation, and logout;
- the list contract, including paging, sort and search;
- error behavior for 401, 403 and refresh 400;
- no secrets recorded.

It's not GO because these are still open (non-critical, documented):
- whether the API key is required (OD-03);
- whether a GET body is accepted (irrelevant to the app);
- what the 403 for an unknown id means;
- the missing `created_at` field;
- backend handling of the request id.

### 6. Gaps before A6 can be re-gated

| ID | Gap | Impact | Needed |
|---|---|---|---|
| G1 | **Content create and update not verified** against the real backend | blocks A6 GO and GO-WITH-RISKS, because they ship in the slice | write permission for the test account, plus an approved harness write step on an `A6R-TEST-*` record |
| G2 | **Unknown id → 403, mapped to `Forbidden`** | the edit page shows "access denied" instead of 404; the A6 mock assumed 404 | a decision: accept 403 as the contract, or ask the backend for 404. Then align the mock and tests |
| G3 | **No `created_at` / `content_date` in rows** | the "Dibuat" column is empty; the default sort can't be checked | a decision: drop the column or change the default sort, or ask the backend to add the field |
| G4 | Validation error shape: the backend uses `data[{FailedField, Tag, Value}]` (seen on login/refresh), but the form mapper assumes `{errors:{field:[…]}}` | real field errors won't attach to form fields | observe a real Content validation error during G1, then align the mapper |
| G5 | Backend write/deny authorization; no restricted account | denial path only tested in the app | a second, restricted test account |
| G6 | `AUTHZ_INTERIM_GRANTS` policy decision (grants apply to every user) | needed before any deploy | owner decision, OD-05/06 |
| G7 | Browser token boundary not run against the real backend | only mock-backend evidence | E2E or a browser smoke test against the real backend, after G1 |
| G8 | API key requirement (OD-03), request id handling | low | optional S7 probe; ask the backend team |
| G9 | Session lifetime is 7 days, token lifetime 30 days | policy question | owner decision |
| G10 | Harness: the unknown-id step has no assertion | evidence-quality gap | add an assertion based on whichever G2 contract is chosen |

**Summary:**
- **A5.5R:** GO-WITH-RISKS, based on the latest live evidence.
- **A6:** stays BLOCKED until at least G1 is verified. G2 and G3 must be decided and recorded before A6 can be GO-WITH-RISKS.
- `claude-summary.md` and the repo reports should be updated from this assessment once you approve.
