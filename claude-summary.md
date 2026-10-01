The live run verifies login, the Content reads (list, detail, paging, sort, search), refresh with token rotation, the full 401 → refresh → retry chain, refresh rejection, logout and server-side token revocation. Two points in your provisional list need correcting: the unknown id ended as `Forbidden`, not `NotFound`; and logout was not triggered by the failed refresh.

Source: `evidence.json` (18 332 bytes, run started 2026-10-01T02:28:22Z), 20 observations, read only. Target: https, no path prefix, contract `legacy-v1`, API key configured, host confirmed by you.

### 1–2. Every backend request and its status

| # | Step | Request | HTTP | Envelope `code` | Content-Type |
|---|---|---|---|---|---|
| 0 | login | `POST /api/v1/auth/login` | 200 | 200 | json |
| 1 | default | `GET /api/v1/cms/contents` page 1, take 5, sort `created_at desc` | 200 | 200 | json |
| 2 | detail | `GET /api/v1/cms/contents/:id` (first listed row) | 200 | 200 | json |
| 3 | detail | `GET /api/v1/cms/contents/:id` (id `999999999`) | **403** | — | **none, empty body** |
| 4–7 | pagination | `GET …/contents`, page 1 / 2 / 0 / 5, take 5 | 200 ×4 | 200 | json |
| 8–9 | sort | `GET …/contents`, `sort_by=code`, asc / desc, take 25 | 200 ×2 | 200 | json |
| 10–12 | search | `GET …/contents`: empty keyword (to pick a term), keyword `<term>` ×2 | 200 ×3 | 200 | json |
| 13 | refresh | `GET …/contents` with an invalid access token | **401** | — | none, empty |
| 14 | refresh | `POST /api/v1/auth/refresh` | 200 | 200 | json |
| 15 | refresh | `GET …/contents` (retry) | 200 | 200 | json |
| 16 | refresh-failure | `GET …/contents` with an invalid access token | 401 | — | none, empty |
| 17 | refresh-failure | `POST /api/v1/auth/refresh` with an invalid refresh token | **400** | 400 | json |
| 18 | logout | `POST /api/v1/auth/logout` | 200 | 200 | json |
| 19 | post-logout | `GET …/contents` with the logged-out access token | **401** | — | none, empty |

Five endpoints were contacted: login, refresh, logout, the Content list and Content detail. There were no writes; the harness guard allows nothing else.

### 3. What is verified and what isn't

| Scenario | Status | Why |
|---|---|---|
| Login | VERIFIED | #0 |
| Content list | VERIFIED | #1 |
| Detail (existing id) | VERIFIED | #2 |
| Detail (unknown id) | VERIFIED as *observed* (403) | **Not `NotFound`.** See §10 |
| Pagination | VERIFIED | #4–7 |
| Sort by `code` | VERIFIED | #8–9 |
| Sort by `created_at` (the default) | UNKNOWN | accepted (200), but rows have no `created_at` to check against |
| Search | VERIFIED | #10–12 |
| Local deny (S8) | VERIFIED, app only | `Forbidden`, 0 gateway calls |
| Forged / expired session (S9) | VERIFIED, app only | `Unauthenticated`, 0 gateway calls; no backend 401 involved |
| 401 → refresh → retry | VERIFIED | #13–15 |
| Refresh rotation | VERIFIED | §5 |
| Refresh rejection → session cleared | VERIFIED | #16–17 |
| Logout + server-side revocation | VERIFIED | #18–19 |
| S6 GET body | NOT VERIFIED (skipped) | `"NOT_RUN: A55R_PROBE_GET_BODY not set"` |
| S7 without API key | NOT VERIFIED (skipped) | `"NOT_RUN: probe not enabled or no API key configured"` |
| Content create / update | NOT VERIFIED | outside the harness, no write was sent |
| Request ID handling by the backend | UNKNOWN | the app sent `X-Request-Id` on all 20 requests; the gateway doesn't echo it (attempt 3) |

### 4. Login and `expires_at` (#0)

- Response keys: `code`, `status`, `data`, `message`. Steps record `login: {ok:true, refreshTokenInSession:true}`.
- `data` field types:

  | Field | Type |
  |---|---|
  | `access_token`, `refresh_token` | string |
  | `user_id`, `user_email`, `user_name`, `user_type`, `role_id`, `role_name` | string |
  | `customer_name`, `customer_email`, `aam_customer_id`, `customer_category_name`, `aam_customer_channel_id`, `area_name`, `org_id` | null |
  | `has_pin`, `restrict_gamification_loyalty_point` | boolean |

- `expires_at`: `{type:"string", format:"9999-99-99T99:99:99.999999999+99:99", zone:"+07:00", minutesFromNow:43200}`, i.e. 30 days. The parser accepted it.
- The login request carried no Bearer header, but did carry the API key and request id.

### 5. Refresh-token rotation (#14)

- `POST /api/v1/auth/refresh` → 200, envelope `code:200`.
- `data` keys: `access_token`, `refresh_token` (strings) and `expires_at` (same format, `+07:00`, 43 200 min).
- `steps.refresh.rotation`: `{accessTokenChanged:true, refreshTokenPresent:true, refreshTokenRotated:true, expiryInFuture:true}`. These are true/false comparisons made inside the process.
- The refresh request had no Bearer header (`auth=false`).

### 6. 401 → refresh → retry (#13–15)

- Sequence: `GET /api/v1/cms/contents → 401`, then `POST /api/v1/auth/refresh → 200`, then `GET /api/v1/cms/contents → 200`. That is exactly one refresh and one retry.
- Final result `{ok:true, rows:5, total:19}`.
- The 401 came from the real backend, triggered by an invalid access token placed in a sealed copy of the session.
- The backend's 401 body is empty, with no content type.

### 7. Failed refresh and session cleanup (#16–17)

- Sequence: `GET … → 401`, then `POST /api/v1/auth/refresh → 400`. Envelope `code:400`; `data` is `null`.
- The app mapped it to `Unauthenticated` and cleared the session (`sessionCleared:true`). There was no second refresh and no retry, so no loop.
- **Correction to your point 13:** the failed refresh did **not** trigger a backend logout. No logout request appears in that sequence; the session was cleared locally only. That test ran on a *copy* of the session.

### 8. Logout (#18–19)

- The logout in #18 was the harness's final cleanup step, run on the real session (after the rotation in §5), not a reaction to the failed refresh.
- `POST /api/v1/auth/logout` sent a Bearer header and got 200, with `data:{message:string}`. Local session cleared: `sessionCleared:true`.
- #19: the logged-out access token then gets 401. **The backend revokes the token on logout (VERIFIED).**

### 9. Content list, detail, pagination, sort, search

**List response (#1):**
- `data` contains `limit`, `page`, `sort`, `total_rows`, `total_pages` and `rows[]`.
- Each row has `id` (string), `name`, `code`, `value` (strings) and `is_active` (boolean).
- Mapped result: 5 rows, total 19.

**Detail (#2):** `data` has the same 5 fields, and `is_active` is present as a boolean. Mapped fields: `active`, `code`, `id`, `name`, `value`.

**Pagination:**
- Pages 1 and 2 each returned 5 rows of 19, with no overlapping ids.
- Page 0 returned the same as page 1 (backend behaviour; the harness sent `page=0` as-is).
- Page 5 returned 0 rows, total 19: empty, not an error.

**Sort:** `code` asc and desc (take 25) each returned all 19 rows. Ascending order was correct by locale and by binary comparison, and desc was the exact reverse.

**Search:**
- One term hit 1 row of 1, and every returned row matches on code or name.
- A no-match term returned 0 rows, total 0, as `ok`. Empty ≠ error: VERIFIED.
- The search term is recorded only as `<term>`.

### 10. Unknown id

- **Backend:** HTTP **403**, empty body, no content type.
- **App mapping:** `gateway-errors.ts` maps 403 to `Forbidden`; only 404 maps to `NotFound`. Recorded result: `"unknown": {"ok": false, "kind": "Forbidden"}`.
- **Final result was not `NotFound`.** The step has no assertion, so it "passed" while contradicting its own name.
- The same account read an existing id successfully, so the 403 is not a missing `content.read` permission.
- Whether this backend uses 403 to mean "not found" in general is UNKNOWN; one sample can't settle it.

### 11–12. S6 and S7

Both were skipped; see §3. Every Content request in this run had `getBody=false`. Every request carried the API key (`apiKey=true` on all 20), so behaviour without the key is still untested.

### 13. Secret content in the evidence file

- Pattern scan, all **absent**: JWT strings, `Bearer` values, long opaque strings (40+ characters), `authorization` / `cookie` / `set-cookie` / `password` keys, API-key values, email addresses.
- No request bodies are stored. Authorization and API key appear only as true/false fields.
- Token and expiry fields are recorded as types only; the expiry has a digit-masked format, and the search term is `<term>`.
- **Nothing secret is present.**

### 14. Contract discrepancies and risks

| ID | Finding | Classification |
|---|---|---|
| D1 | **Unknown id → 403 with an empty body**, mapped to `Forbidden`. The A6 edit page would show "access denied" instead of 404 for a missing record. The A6 TEST_ADAPTER mock assumed 404 | Backend behaviour VERIFIED; meaning UNKNOWN; A6 mock assumption contradicted |
| D2 | **List rows have no `created_at` or `content_date`.** The A6 table's "Dibuat" column will be empty on the real backend (the mapper treats it as optional, so no error). The default sort `sort_by=created_at` is accepted, but the order can't be checked | Real response VERIFIED; A6 UI and sort assumption at risk |
| D3 | All 401s (#13, 16, 19) have an empty body and no content type. The app relies on the status code only, which works | VERIFIED |
| D4 | A bad refresh token gets 400 (not 401) with `data:null`. The app correctly treats it as end of session | VERIFIED |
| D5 | The failed refresh didn't call backend logout, so the backend refresh token behind a broken local session isn't revoked. Low impact: the refresh token was already rejected | App behaviour VERIFIED; matches the A5.1 design |
| D6 | Access and refresh responses both give 30-day expiries, and the local session ends after 7 days | VERIFIED values; policy question (AD-A6R-01) |
| D7 | `id` is a string on the wire; `isContentId` accepts it | VERIFIED |
| D8 | Page 0 is treated as page 1 by the backend; the app never sends 0 | VERIFIED backend behaviour |
| D9 | The list `data` has extra fields (`limit`, `page`, `sort`, `total_pages`) that the mapper ignores | VERIFIED; harmless |
| D10 | S6 and S7 skipped; GET-body (OD-31) and API-key (OD-03) requirements still open | NOT VERIFIED |
| D11 | The unknown-id step has no assertion and so passes regardless of result. This is a harness gap; the evidence record itself is correct | Harness defect |

### Assessment

The evidence supports **VERIFIED** for:
- real login and session creation, with the backend `expires_at` accepted;
- authenticated Content list and detail (including `is_active`), pagination, `code` sort, and search, with empty results not treated as errors;
- `401 → /api/v1/auth/refresh → rotated pair → one retry`, which succeeded;
- refresh rejection (400) → local session cleared, no loop;
- logout, followed by server-side token revocation.

No secrets were found in the evidence file.

**Not verified:**
- S6 GET body: skipped.
- S7 API key: skipped.
- Content create and update.
- Backend handling of the request id.

**Corrections to your provisional list:**
- **Unknown-id mapping:** the result is `Forbidden` from a real 403, not `NotFound`.
- **"Logout after the failed refresh":** didn't happen. The logout was the separate final cleanup step.

Two A6 contract risks to note before continuing:
- **D1:** unknown id returns 403.
- **D2:** there is no `created_at` field for the "Dibuat" column or for the default sort.

No files were changed.
