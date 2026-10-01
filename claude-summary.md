A5.5R can move from **BLOCKED to GO-WITH-RISKS**. A6 stays **BLOCKED**, mainly because Content create and update haven't run against the real backend.

The evidence file hasn't changed since the last assessment: 18 332 bytes, run started 2026-10-01T02:28:22Z, 20 observations. It's the run you just reported (12 passed, 1 skipped). This was read-only: I changed no files, sent no writes, and didn't open the GitHub link. Where older reports say A5.5R is BLOCKED, this evidence replaces them.

### 1. Status reconciliation (real backend)

| Area | Status | Evidence |
|---|---|---|
| Login | VERIFIED | `POST /api/v1/auth/login` 200, envelope `code 200`; session created with a refresh token |
| Backend `expires_at` | VERIFIED | RFC3339 with nanoseconds, `+07:00`, 30 days ahead; the parser accepted it |
| Content list | VERIFIED | 200; `data {limit, page, sort, total_rows, total_pages, rows[]}`; 5 of 19 rows |
| Content detail, existing ID | VERIFIED | 200; `id, name, code, value`, `is_active` as a boolean |
| Pagination | VERIFIED | pages 1 and 2 don't overlap; page 0 returns the same as page 1; page 5 returns 0 rows of 19 |
| Sorting by `code` | VERIFIED | asc and desc over all 19 rows; desc is the exact reverse |
| Sorting by `created_at` (the default) | UNKNOWN | the backend accepts it, but rows have no `created_at` field, so the order can't be checked |
| Search and no-match | VERIFIED | a hit returns 1 of 1 matching code or name; no match returns 0 of 0 as success, not an error |
| Authorization: backend read | VERIFIED | the test account can list and read detail |
| Authorization: app policy | VERIFIED (app only) | S8: `Forbidden` with 0 backend calls. S9: forged or expired session gives `Unauthenticated` with 0 backend calls |
| Authorization: backend write or denial | NOT VERIFIED | no write sent, and no restricted second account |
| 401 → refresh → retry | VERIFIED | `GET` 401 (empty body), then `POST /api/v1/auth/refresh` 200, then `GET` 200; exactly 1 refresh and 1 retry |
| Refresh rotation | VERIFIED | access token changed, refresh token present and rotated, new expiry in the future (compared as true/false inside the process; no values stored) |
| Failed refresh | VERIFIED | `GET` 401, then `POST /refresh` 400 with `data:null`; mapped to `Unauthenticated`; no loop |
| Session cleanup after failed refresh | VERIFIED (local) | session cleared. It did **not** call backend logout. The test used a copy of the session |
| Logout | VERIFIED | the harness's final step: `POST /api/v1/auth/logout` with the Bearer token, 200 `{message}`; local session cleared |
| Token revoked after logout | VERIFIED | the logged-out access token then gets `GET` 401 |
| Request ID | UNKNOWN (backend side) | the app sent `X-Request-Id` on all 20 requests; the gateway doesn't echo it back |

### 2. Unknown ID

- **Backend:** HTTP **403**, empty body, no content type (VERIFIED).
- **App mapping:** `gateway-errors.ts` maps 403 to `Forbidden`; only 404 maps to `NotFound`. The recorded result is `{ok:false, kind:"Forbidden"}`.
- **The final result is not `NotFound`.** The test passed only because that step has no assertion, so its name is misleading.
- The same account reads an existing ID fine, so a missing read permission isn't the cause. Whether 403 always means "not found" on this backend is UNKNOWN; one sample isn't enough.

### 3. S6 and S7

| Step | Status | Evidence |
|---|---|---|
| S6, GET request with a body | NOT VERIFIED (skipped) | `"NOT_RUN: A55R_PROBE_GET_BODY not set"`; no request in the run carried a GET body |
| S7, request without the API key | NOT VERIFIED (skipped) | `"NOT_RUN: probe not enabled or no API key configured"`; all 20 requests carried the API key |

The run still answers what the app needs from S6. Pagination, sort and search all responded correctly to query parameters alone, so **the app doesn't need a GET body** (OD-31, VERIFIED). Whether the backend would also accept one is UNKNOWN and doesn't matter to the app. Whether the backend *requires* the API key is UNKNOWN (OD-03).

### 4. Secrets

The pattern scan found nothing:
- no JWT strings, `Bearer` values or long opaque strings;
- no `authorization`, `cookie`, `set-cookie` or `password` keys, no API-key values, no email addresses.

No request bodies are stored. Authorization and the API key are recorded only as true/false. Tokens are recorded as types only, the expiry as a digit-masked format, and the search term as `<term>`.

### 5. A5.5R re-gate

**From BLOCKED to GO-WITH-RISKS.** Verified against the real non-production backend:
- the read contract: list, detail, pagination, sort by code, search;
- authentication: login, refresh with rotation, logout and revocation;
- error behavior: 401, 403, and 400 on a rejected refresh;
- the evidence contains no secrets.

It isn't GO because these are still open (non-critical, documented):
- whether the API key is required (OD-03);
- whether the backend accepts a GET body (not needed by the app);
- what the 403 on an unknown ID means;
- the missing `created_at` field;
- how the backend handles the request ID.

### 6. Gaps before A6

| ID | Gap | Impact | Needed |
|---|---|---|---|
| G1 | **Content create and update not verified** against the real backend | blocks A6 GO and GO-WITH-RISKS, because both ship in the slice | write permission for the test account, plus an approved harness write step limited to an `A6R-TEST-*` record |
| G2 | **Unknown ID returns 403**, mapped to `Forbidden` | the edit page shows "access denied" instead of 404; the A6 mock assumed 404 | decide: accept 403 as the contract, or ask the backend for 404. Then align the mock and tests |
| G3 | **No `created_at` or `content_date` in list rows** | the "Dibuat" column is empty; the default sort can't be checked | decide: drop the column or change the default sort, or ask the backend to add the field |
| G4 | Validation error shape: the backend returns `data[{FailedField, Tag, Value}]` (seen on login and refresh); the form mapper expects `{errors:{field:[…]}}` | real field errors won't attach to form fields | observe a real Content validation error during G1, then align the mapper |
| G5 | Backend write or denial authorization untested; no restricted account | denial is only tested inside the app | a second, restricted test account |
| G6 | `AUTHZ_INTERIM_GRANTS` applies to every signed-in user | needs a decision before any deploy | owner decision (OD-05/06) |
| G7 | Browser token boundary not run against the real backend | only mock-backend evidence | a browser or E2E smoke test against the real backend, after G1 |
| G8 | API key requirement (OD-03) and request-ID handling | low | optional S7 probe, or ask the backend team |
| G9 | Session ends after 7 days, token is valid for 30 days | policy question | owner decision |
| G10 | The unknown-ID harness step has no assertion | weak evidence quality | add an assertion once G2 is decided |

**Overall:** A6 needs at least G1 verified, and G2 and G3 decided and recorded, before it can reach GO-WITH-RISKS. Once you approve, I'll update `claude-summary.md` and the repo reports from this assessment.
