# F31 Backend Compatibility Gaps — Manajemen Pengguna

| Field | Value |
|---|---|
| Date | 2026-10-09 |
| Purpose | Register of backend behaviour the F31 frontend must accommodate, under the pragmatic migration directive (backend as it exists is the source of truth) |
| Backend state | `gpos-b2b-account-service` `origin/development` = `c712ba6` (local ref, last fetch 2026-10-08). The remediation exists only as **uncommitted changes** on `fix/f31-cms-customer-sql-injection`; it is **not merged** (`F31_POST_MERGE_VERIFICATION_REPORT.md`) |
| Evidence base | `F31_CONTRACT_AUDIT.md`, `F31_ARCHITECTURE_READINESS.md`, `F31_BACKEND_SECURITY_REMEDIATION_GATE.md`, `F31_BACKEND_FRESH_REVERIFICATION.md`, `F31_BACKEND_REMEDIATION_REVIEW.md`, `F31_POST_MERGE_VERIFICATION_REPORT.md`; backend source at `c712ba6`; legacy CMS source |
| Not available | `cms/F31_BACKEND_SECURITY_REMEDIATION_REPORT.md` does not exist; that report lives only in the backend repository root and is uncommitted. No live / runtime evidence exists for F31 |

**Severity is the backend risk, not the frontend workaround.** A frontend mitigation does not lower it.

## Register

| ID | Finding | Evidence | Frontend impact | Severity | Class | Handling | Blocks | Owner / action | Verification |
|---|---|---|---|---|---|---|---|---|---|
| **F31-CA-01** | Branch filter `filters[].value` is concatenated into `IN (…)`; filter column / operator are raw | `c712ba6` `mapper/cms_customer.go:28-32` (source) | The branch filter uses this exact path. The frontend can send only constant column / operator and UUID-validated, double-quoted ids. That creates no new exposure, but **cannot make the backend safe**: any authorized token can still inject directly | **CRITICAL** | SECURITY | `ADAPT_IN_FRONTEND` (defence-in-depth input constraint) + `BACKEND_FOLLOW_UP` | Only the branch-filter operation would be affected; the frontend does not widen the risk. Production exposure needs a security-owner decision (see Readiness §6) | Backend: merge the reviewed fix (`F31_BACKEND_REMEDIATION_REVIEW.md`, CONDITIONAL PASS). Security owner: accept or wait | source-verified open; fix branch-only |
| **F31-CA-02** | `search_by`, `sort_by`, `asc_desc` concatenated into SQL (`customers/users`, `customer-areas`) | `mapper/cms_customer.go:21, 38`; `mapper/cms_customer_area.go:19, 26` (source) | The frontend sends constants only: `search_by` ∈ {`customer.name`, `user.email`}; `sort_by=aam_customer_id`; `asc_desc=desc`; areas `sort_by=name`, `asc_desc=asc` | **HIGH** | SECURITY | `ADAPT_IN_FRONTEND` + `BACKEND_FOLLOW_UP` | no | Backend: merge the fix | source-verified open |
| **F31-CA-13** | Empty `filters[].column` → `f.Column[:1]` panic → 500 | `mapper/cms_customer.go:28` (source) | The frontend never sends a filter without the constant column; with no branch selected it sends **no `filters` at all** | MEDIUM | FUNCTIONAL | `ADAPT_IN_FRONTEND` + `BACKEND_FOLLOW_UP` | no | Backend: merge the fix | source-verified open |
| **F31-CA-04** | Target-environment role grants (`role_key` / `role_key_mapping`) for `GET /cms/customers/users`, `GET /cms/customer-areas`, `PUT /cms/customers/users/{id}/status`, `DELETE /cms/customers/users/{id}` not evidenced. The service checks only `X-UserId` presence; the gateway `CanAccess` allowlist is the real boundary (source-verified) | `F31_BACKEND_SECURITY_REMEDIATION_GATE.md` §4; `seed.sql` has no rows for these paths | The frontend capability `user-management.read` gates the UI only and is **not** proof of backend authorization. If grants are missing, the API returns 403 and the UI shows AccessDenied / error. A CMS role may also hold the toggle / delete grants, which the frontend never calls | **HIGH** | SECURITY | `DOCUMENT_ONLY` (frontend fail-closed) + `BACKEND_FOLLOW_UP` | no (read works or fails closed) | Platform / security: non-secret role-grant export | PARTIALLY VERIFIED |
| **G-01** | SQL remediation not merged; `origin/development` still vulnerable | `git cat-file -e origin/development:mapper/cms_query_allowlist.go` → absent; never committed | The frontend targets current behaviour. The planned parameters are **forward-compatible** with the reviewed fix's allowlists (same values accepted) | **CRITICAL** (inherits CA-01) | SECURITY | `BACKEND_FOLLOW_UP` | no for implementation; yes for a "remediated" claim | Backend owner: commit, PR, review, merge; then rerun the post-merge gate | NOT MERGED |
| **G-02** | Pagination: `page` / `take` are strings; parse errors are ignored; `take=-1` is unbounded; `total_rows` is a filtered `Count` (source); no `total_pages`; page beyond the last → 200 with empty rows | `mapper/cms_customer.go:14-16`; `repository/buyer.go:204-215`; F31-CA-06 / CA-11 | Send integer strings from fixed page sizes (15 / 25 / 50 / 100); never "All"; derive pages from `total_rows` with the shared `pageCount`. If `total_rows` is missing or not an int → **Contract error** (no guessed total) | MEDIUM | CONTRACT | `ADAPT_IN_FRONTEND` | no | — | source-derived; runtime NOT VERIFIED |
| **G-03** | Unstable ordering within one customer: `ORDER BY aam_customer_id` has no tiebreaker | F31-CA-11 | Rows of the same customer may shift between pages. Documented; no client re-sorting | LOW | DATA_QUALITY | `DOCUMENT_ONLY` + `BACKEND_FOLLOW_UP` | no | Backend: add a tiebreaker | source-derived |
| **G-04** | The base set depends on runtime flags. `DELETE_USER_APJ_UPDATE_CUSTOMER` off → only active users listed; `CRM_VALIDATE_NEW_USER` → users with `approval_status` excluded. Flag values come from `config_service` (source absent) or env | `repository/buyer.go:185-202`; `config/variable.go:40-66` | Show `user_activation` exactly as returned; no status filter (none exists); a fixed note that inactive users may not be listed; never claim the list is complete | MEDIUM | DATA_QUALITY | `ADAPT_IN_FRONTEND` (honest display) + `DOCUMENT_ONLY` | no (status display only) | Backend / product: confirm flag values per environment | NOT VERIFIED |
| **G-05** | Empty list → 200 `{total_rows: 0, rows: []}`; never 404 | `repository/buyer.go:204-215` | Empty state only on a 200 with empty rows. Every 4xx / 5xx stays an error; no 404 → empty rule (unlike F27) | LOW | CONTRACT | `ADAPT_IN_FRONTEND` | no | — | source-derived |
| **G-06** | Errors: bad input / DB errors → 500 "Internal Server Error" (no SQL detail returned); 400 validation for missing required params; 403 without `X-UserId` | `global/error.go:59-76`; F31-CA-09 | Map to the existing typed errors (`Server`, `Validation`, `Forbidden`, `Unauthenticated`); never show raw messages beyond the shared conventions | LOW | CONTRACT | `ADAPT_IN_FRONTEND` | no | — | source-derived |
| **G-07** | No detail endpoint for a single user | F31-CA-07 | No detail page; the list is the only view | LOW | CONTRACT | `BLOCK_AFFECTED_OPERATION` (detail not offered) | detail only | — | source-verified |
| **G-08** | Legacy "Pembaruan No. Telepon" shows `user_last_updated` (record update time); `user_last_order` is always null | `mapper/cms_customer.go:100-132`; F31-CA-08 | Label "Terakhir Diperbarui"; `user_last_order` not mapped | LOW | DATA_QUALITY | `ADAPT_IN_FRONTEND` | no | — | source-verified |
| **G-09** | The legacy "All" branch option sends `IN ("ALL")` → 0 rows | `Helper.js:84-87`; F31-CA-10 | No "All" option; no selection = no `filters` param | LOW | FUNCTIONAL | `ADAPT_IN_FRONTEND` | no | — | source-verified |
| **G-10** | `search_by` values `customer.name` / `user.email` vs GORM join aliases `Customer` / `User` (case) | F31-CA-05 | Send the legacy values unchanged. A runtime 500 on search would surface as an error, not as empty results | LOW | CONTRACT | `DOCUMENT_ONLY` | search only, if it fails at runtime | Verify in live READ | NOT VERIFIED |
| **G-11** | Response carries fields the UI does not need (address, org / area / channel / customer ids, `user_last_order`) | `dto/cms_customer.go:25-46`; F31-CA-12 | Strict DTO allowlist at the repository boundary; excluded fields never reach the client or logs | LOW | SECURITY (privacy) | `ADAPT_IN_FRONTEND` | no | — | source-verified |
| **G-12** | `GET /cms/customer-areas` (branch options): ORDER BY concatenation; filters raw | `mapper/cms_customer_area.go:19, 26` | Fixed params (`sort_by=name`, `asc_desc=asc`, `page=1`, `take=1000`, optional keyword); no filters | covered by CA-02 | SECURITY | `ADAPT_IN_FRONTEND` + `BACKEND_FOLLOW_UP` | no | (CA-02) | source-verified open |
| **G-13** | Separate: `mapper/cms_customer_channel.go` (`GET /cms/customer-channels`) concatenates `sort_by` / `asc_desc` and filter column / operator | `:19`, `:26` (source, unchanged) | F31 does not call this endpoint. Used by F18 / F11 / legacy notification | **HIGH** | SECURITY | `BACKEND_FOLLOW_UP` | not F31 | Backend: separate remediation task + gate | open |
| **G-14** | No runtime evidence for F31 (no live READ, no DB / HTTP test) | `F31_POST_MERGE_VERIFICATION_REPORT.md` §5 | The contract is **source-derived**; the module gate will require an owner-run GET-only live READ | MEDIUM | TEST_COVERAGE | `DOCUMENT_ONLY` | no | Owner: live READ after implementation | NOT VERIFIED |

## Severity Summary

| Severity | Items |
|---|---|
| CRITICAL | F31-CA-01, G-01 |
| HIGH | F31-CA-02, F31-CA-04, G-13 |
| MEDIUM | F31-CA-13, G-02, G-04, G-14 |
| LOW | G-03, G-05, G-06, G-07, G-08, G-09, G-10, G-11 |
| (covered by F31-CA-02, HIGH) | G-12 |

**No item was downgraded.** The status of each item is unchanged from the latest gate evidence, except G-01, which records the observed non-merge.

## Implementation Handling Status (2026-10-09)

Added after the F31 frontend implementation (`F31_IMPLEMENTATION_REPORT.md`). **No severity or verification status above was changed.** This section only records how the implemented frontend handles each item. All evidence is from mocked tests and source; none is live.

| ID | Implemented handling | Evidence |
|---|---|---|
| F31-CA-01 | branch column / operator constants; only UUID-validated, double-quoted ids; max 50; hostile URL ids dropped before any request. **Backend still vulnerable** | contract tests; E2E `user-management.spec.ts:78, :105` |
| F31-CA-02 | `search_by` from a constant map (`customer.name` / `user.email`); `sort_by=aam_customer_id`, `asc_desc=desc`; areas `sort_by=name`, `asc_desc=asc` | contract tests; E2E |
| F31-CA-13 | no `filters` keys at all without a valid selection | contract tests; E2E clear case |
| F31-CA-04 | `user-management.read` fail-closed in registry, `guardRoute` and both use cases (0 calls when denied). Backend grants still unverified | unit + E2E reader instance |
| G-01 | unchanged: fix **not merged** | `F31_POST_MERGE_VERIFICATION_REPORT.md` |
| G-02 | page sizes 15 / 25 / 50 / 100; `total_rows` must be an int; `total_rows < rows.length` or rows > pageSize → `Contract` | contract tests |
| G-04 | status badge from `user_activation`; completeness note shown | page tests; E2E |
| G-05 / G-06 | empty 200 → empty state; errors stay typed errors (no 404 → empty rule) | contract, page, E2E |
| G-07 | no detail route or links | E2E (no links) |
| G-08 | label "Terakhir Diperbarui"; `user_last_order` not mapped | page tests |
| G-09 | no "All" option; no-selection omits `filters` | E2E |
| G-11 | strict DTO; excluded fields asserted absent | contract tests |
| G-03, G-10, G-14 | open; to be checked in the owner live READ | — |
| G-13 | not called by F31; separate follow-up | — |

**Test-coverage note:** the shared `url-codec.ts` change (array filters as repeated params) is covered at unit level **indirectly** by `user-management.contract.test.ts:154` (via `userManagementSearchParams` → `toTableSearchParams`) and by E2E (`user-management.spec.ts:78`); there is no dedicated case in `url-codec.test.ts`. Classification `TEST_COVERAGE`, LOW, `DOCUMENT_ONLY` (optional: add a dedicated `url-codec.test.ts` case).
