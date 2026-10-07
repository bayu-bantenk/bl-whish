# F27 — Verifikasi Akun Contract Audit

| Field | Value |
|---|---|
| Date | 2026-10-07 |
| Phase | Batch 4 · Phase 1 · **Contract Audit (audit only)** |
| Scope authority | `BATCH4_SCOPE_LOCK.md` §C |
| Legacy source | `gpos-b2b-cms` `00bc6ead` (2026-09-25) |
| Backend source | `gpos-b2b-account-service` `3001bc0` (2026-09-11, = `origin/development`, local refs only) |
| Gateway | `gpos-b2b-api-gateway/setting/endpoints.json` `fb68a8f` (2026-08-31) |

## 1. Executive Summary

- **Audit status:** complete (source evidence; no live call).
- **Scope:** F27 READ surface — list, status filter, search, pagination, review / detail, field display, client-side export. Approve / reject / update audited at contract level only.
- **Overall readiness:** **CONDITIONAL READY.** Both read endpoints are verified in backend source and match the legacy calls. No P0. Five P1 findings are backend behaviours (404 on an empty list, 500 / wrong results on customer-id search, no backend role check) plus an undecided frontend capability name; each has a safe frontend handling rule or an owner action. Live READ has not been executed.
- **Live mutation status:** none. No live request of any kind was made.

## 2. Scope Compliance

| Class | Items |
|---|---|
| **IN** | list (`GET /cms/users/need-approvals`); status filter (ALL / PENDING / APPROVED / REJECTED); search by email or customer id; pagination; review / detail (`GET /cms/users/need-approvals/:id`); display of verified fields; loading / empty / error states |
| **IN (decision recorded here)** | client-side Excel export of the currently loaded page — `KEEP — CLIENT SIDE` (§10), subject to F27-CA-12 |
| **CONTRACT ONLY / NOT IMPLEMENTED** | approve (`POST …/:id/approve`), reject (`POST …/:id/reject`), update (`PUT …/:id`) — legacy TINJAU / EDIT modal buttons "Setujui", "Tolak", edit validity |
| **OUT** | registration (`POST /cms/users/register`, `/cms/users/preregister`), phone approvals (`POST /cms/users/:id/phone-approvals`), create / delete account, role / permission / credential changes, any other mutation |
| **DEFERRED** | F27 WRITE (approve / reject / update) → separate WRITE gate; live READ → owner terminal after implementation |
| Not supported | sorting (backend sort is fixed — §7) |

## 3. Legacy Evidence

### Routes

`start/routes.js:526-532` (no `Route.resource`):

| Route | Controller | Purpose |
|---|---|---|
| GET `/user-verification` | `UserVerificationController.index` | renders `user_verification/list.edge` |
| POST `/user-verification/datatable` | `.datatable` | list (DataTables server-side) |
| GET `/user-verification/:id/detail` | `.detail` | JSON detail for the modals |
| POST `/user-verification/:id/reject` | `.reject` | mutation — contract only |
| POST `/user-verification/:id/approve` | `.approve` | mutation — contract only |
| POST `/user-verification/:id/update` | `.update` | mutation — contract only |

### Screens

One screen, `resources/views/user_verification/list.edge` (603 lines): card header with **"Unduh Data"** button (`:14-16`), table (`:23-38`), review modal `#reviewModal` (`:46-110`), edit modal `#editModal` (`:112-175`), reject-confirm modal (`:177+`). Menu: `app/Middleware/Extender.js:231` (superadmin).

### API Calls

Path: page → `UserVerificationController` → `UserVerificationMapper` → `UserVerificationRepository` (`basePath = '/api/v1/cms/users'`, `:4`) → `ApiService` → gateway.

| Legacy call | Backend request | Evidence |
|---|---|---|
| list | GET `/api/v1/cms/users/need-approvals` with `{page, take, status}` + optional `{search_by, keyword}` | `UserVerificationRepository.js:33-36`; mapper `toListRequest` `UserVerificationMapper.js:59-100` |
| detail | GET `/api/v1/cms/users/need-approvals/{id}` | `Repository.js:42-45`; controller `:45-68` |
| reject | POST `…/{id}/reject`, body `{}` | `Repository.js:51-54` |
| approve | POST `…/{id}/approve`, body `{active_start_at, active_end_at}` | `Repository.js:60-63` |
| update | PUT `…/{id}`, body `{id, active_end_at}` | `Repository.js:70-73` |

Headers: `Authorization: Bearer`, `X-UserId` (`Repository.js:11-27`). The gateway deletes a client `X-UserId` and injects its own (`auth-plugin.go:72, 138`), so the new frontend must not send it.

### UI Behavior

- **Columns** (all `no-sort`, `list.edge:26-35`): AKSI · STATUS · CUSTOMER ID · NAMA RELASI · CABANG · TGL. PERMINTAAN · EMAIL · NOMOR TELEPON · TGL. PERSETUJUAN · DITINJAU OLEH. Cell mapping `UserVerificationMapper.js:108-119` (dates `DD/MM/YYYY HH:mm`; `-` for empty branch / dates / verified_by).
- **Status tabs:** Semua / Pending / Approved / Rejected (`list.edge:250-253`), sent as `filters[0]` and mapped to `status` (`Mapper.js:86-90`, allowlisted to the four values).
- **Search:** select `Cust. ID` (`customer_id`) / `Email` + text box (`list.edge:257-279`); search is sent only when a type is set (`Mapper.js:82-98`).
- **Pagination:** default 5; length menu 5 / 10 / 25 / 50 / 100 / All (`list.edge:220-223`); "All" (`-1`) becomes `take=10000` (`Mapper.js:63-67`).
- **Sorting:** none (every column `no-sort`; the mapper sends no sort).
- **Action buttons:** PENDING → **TINJAU** (review modal), APPROVED → **EDIT** (edit modal), REJECTED → none (`Mapper.js:38-50`). Both modals load the detail endpoint first (`list.edge:366-386, 484-503`).
- **Review modal fields** (`list.edge:336-365`): Customer ID (`aam_customer_id`), Nama Relasi (`customer_name`), Tanggal Permintaan (`approval_request_date`), Email, Nomor Telepon, Status Akun (`status` badge), plus date inputs pre-filled from `active_start_at` / `active_end_at` that feed **approve** (contract only).
- **Empty / error:** any non-success list response → empty table (`Controller.js:85-86`), exception → flash + redirect back (`:87-91`); detail failure → toast "Gagal memuat detail verifikasi" (`list.edge:382-386`). Legacy therefore hides list errors (and the backend's 404-on-empty) behind an empty table.
- **Loading:** DataTables default processing indicator.

### Permissions

- `index` calls `Authorization.checkAuth(authUser)` (`Controller.js:33`), which only compares token expiry (`app/Helper/Authorization.js:4-9`). `datatable` / `detail` do not call it.
- No per-feature permission in legacy; the superadmin menu (`Extender.js:231`, chosen by hard-coded email, OD-06) is the only gate.

## 4. Backend Contract Evidence

Routes `handler/cms_user.go:22-32` (group `/cms/`); gateway `endpoints.json:64-71` (service `account_service`).

| Method | Endpoint | Purpose | Evidence | Status |
|---|---|---|---|---|
| GET | `/api/v1/cms/users/need-approvals` | verification list | handler `cms_user.go:27, 114-131`; DTO `dto/cms_user.go:37-43, 90-106`; usecase `usecase/cms_user.go:350-435`; repo `repository/user.go` `CmsGetUserNeedApprovalList`; mapper `mapper/cms_user.go:10-50`; GW `:67` | **VERIFIED** (source) |
| GET | `/api/v1/cms/users/need-approvals/{id}` | verification detail | handler `:28, 143-160`; DTO `:54-56, 108-119`; usecase `:437-470`; repo `CmsGetUserNeedApprovalById`; GW `:68` | **VERIFIED** (source) |
| PUT | `/api/v1/cms/users/need-approvals/{id}` | update validity end | handler `:29`; DTO `:58-61`; GW `:69` | VERIFIED — **CONTRACT ONLY** |
| POST | `/api/v1/cms/users/need-approvals/{id}/approve` | approve (activation email) | handler `:30`; DTO `:69-72`; GW `:70` | VERIFIED — **CONTRACT ONLY** |
| POST | `/api/v1/cms/users/need-approvals/{id}/reject` | reject (email renamed, rejection email) | handler `:31`; DTO `:81-83`; GW `:71` | VERIFIED — **CONTRACT ONLY** |
| POST | `/api/v1/cms/users/register`, `/preregister`, `/{id}/phone-approvals` | other account flows | handler `:25-26`; GW `:64-66` | **OUT** |

**Response envelope** (success): `{code, status, data, message}` (`global/response.go:19-25, 47-55`). **Error envelope:** `{code, status: FAILED, data, message, error_code?}` (`global/error.go:59-76`); stack traces are logged, not returned.

**Authentication:** both read handlers call `helper.GetUserID` → 403 when `X-UserId` is missing; the gateway auth plugin validates the Bearer token and injects `X-UserId` (`auth-plugin.go:72, 138`). **Authorization:** no role check in account-service; the gateway adds `X-RoleName` (`auth-plugin.go:167`) but whether any role is enforced is **NEEDS EVIDENCE** (A2-U04).

## 5. Read Contract Matrix

| Capability | Legacy | Backend | Frontend Contract | Status |
|---|---|---|---|---|
| List | `Repository.js:33-36` | `cms_user.go:27`; repo query `approval_status IS NOT NULL` | GET `need-approvals`, envelope code 200, `data: {total_rows, rows[]}` | **VERIFIED** |
| Status filter | tabs → `status` | `Status` enum PENDING / APPROVED / REJECTED / ALL, default ALL, **not validated** | send only the four allowlisted values | **VERIFIED** (with F27-CA-07) |
| Search — email | `search_by=email`, `keyword` | `email LIKE %k%` | send `search_by=email&keyword=` only when keyword non-empty | **VERIFIED** |
| Search — customer id | `search_by=customer_id` | `Atoi(keyword)` → customer by `aam_customer_id` → buyers → user ids | numeric-only input; see F27-CA-02 / F27-CA-03 | **VERIFIED with defects** |
| Pagination | `page`, `take` (5…100, All = 10000) | defaults page 1 / take 10; no max; `Offset((page-1)*take).Limit(take)` | page sizes 5 / 10 / 25 / 50 / 100; never "All" / unbounded | **VERIFIED** |
| Total count | `total_rows` → recordsTotal / recordsFiltered | `query.Count` on the filtered query before order / offset | `total_rows` reflects filters | **VERIFIED** (source) — live NOT YET VERIFIED |
| Sorting | none | fixed `ORDER BY updated_at DESC`; no sort params accepted | no sort controls | **NOT SUPPORTED** (by contract) |
| Review / detail | `Repository.js:42-45` | `cms_user.go:28`; NotFound → 404 | GET `need-approvals/{id}`, code 200 | **VERIFIED** |
| Export | DataTables Excel, client-side, current page | no endpoint | client-side export of loaded rows | **VERIFIED (client-side)** — see §10 |
| Authentication | Bearer + `X-UserId` | gateway token check + `X-UserId` presence | shared session / gateway (Bearer only) | **VERIFIED** |
| Authorization | token expiry + menu only | none in service; gateway role enforcement unknown | new fail-closed capability (name to decide) | **GAP** (F27-CA-08) |

**Mismatches (documented, not fixed):** legacy hides list errors and the 404-on-empty as an empty table; legacy allows "All" (`take=10000`); legacy sends `X-UserId` (gateway overrides it). No parameter-name or envelope mismatch was found between legacy and backend.

## 6. DTO Mapping

List row: `CmsGetUserNeedApprovalListUserResponse` (`dto/cms_user.go:95-106`), filled by `mapper/cms_user.go:18-48` from the user's **buyer** record. Detail: `CmsGetUserNeedApprovalByIdResponse` (`:108-119`), filled by `usecase/cms_user.go:437-470`. Canonical names are proposals for the domain model; wire names stay in `repository/dto.ts`.

| Legacy/API Field | Canonical Frontend Field | Type | Nullable | Evidence |
|---|---|---|---|---|
| `id` | `id` (user id; the verification record **is** the user row) | string (UUID) | no in DTO; **empty string possible** in list (F27-CA-04) | mapper `:30` (`userBuyer.UserId`); detail `user.Id` |
| `status` | `status`: `PENDING \| APPROVED \| REJECTED` | enum string | pointer, but query requires `approval_status IS NOT NULL` | DTO `:97`; repo filter |
| `aam_customer_id` | `aamCustomerId` ("Customer ID") | integer | no (0 when no buyer) | mapper `:32` |
| `customer_name` | `customerName` ("Nama Relasi") | string | no ("" when no buyer) | mapper `:33` |
| `branch_name` (list only) | `branchName` ("Cabang") | string | no ("" when no customer area) | mapper `:24-27, 34` |
| `approval_request_date` | `requestedAt` ("Tgl. Permintaan") | ISO datetime | no | = `user.created_at` (mapper `:35`; usecase detail) — F27-CA-15 |
| `email` | `email` | string | no | `REJECTED-<14 digits>-` prefix stripped (mapper `:21-22`; usecase detail) |
| `phone` | `phone` | string | no | mapper `:37` |
| `verified_by` | `decidedBy` ("Ditinjau oleh") | string | yes | `approved_by`, else `rejected_by` (mapper `:40-48`); value format (id / name / email) **UNKNOWN** |
| `approved_at` (list only) | `decidedAt` ("Tgl. Persetujuan") | ISO datetime | yes | `approved_at`, or **`rejected_at` for rejected rows** (mapper `:42, 45`) — F27-CA-09 |
| `active_start_at` (detail only) | `activeStartAt` | ISO datetime | yes | DTO `:116` |
| `active_end_at` (detail only) | `activeEndAt` | ISO datetime | yes | DTO `:117` |
| rejection reason | — | — | — | **not in any response** (reject body has no reason) |
| verification id separate from user id | — | — | — | **does not exist** — UNKNOWN beyond "user id" |

## 7. Search / Filter / Sort / Pagination

- **Query DTO** (`dto/cms_user.go:37-43`): `search_by` (`omitempty,oneof=email customer_id` → other values 400), `keyword`, `status` (default ALL, no validation), `page`, `take`.
- **Base set:** users with `approval_status IS NOT NULL`.
- **Status:** `ALL` → no filter; any other value → `approval_status = ?`. An unknown value yields 0 rows → **404** (F27-CA-07).
- **Email search:** `email LIKE %keyword%` (raw stored email, so rejected users still match on the original address inside the prefixed value).
- **Customer-id search:** keyword must be an integer (`Atoi`, else **500**); unknown `aam_customer_id` → customer lookup NotFound is wrapped into **500**; a known customer with **no buyers** produces an empty id list, the `id IN` filter is skipped and **all users are returned** (F27-CA-03).
- **Empty keyword:** no search filter (both types).
- **Sort:** fixed `updated_at DESC`, no tiebreaker → rows with equal `updated_at` can shift between pages (F27-CA-05).
- **Pagination:** `page` 0 → 1, `take` 0 → 10; no upper bound; page beyond the last → 200 with empty `rows` and the real `total_rows` (only `total_rows == 0` returns 404).
- **Total:** `Count` on the filtered query → `total_rows` follows status / email / customer filters (independent of Batch 3's B3-04; no evidence that it applies here).

## 8. Review / Detail Contract

**A dedicated detail endpoint exists:** `GET /api/v1/cms/users/need-approvals/{id}`.

- Path param bound by `c.ParamsParser` into a struct with only a `json:"id"` tag (`dto/cms_user.go:54-56`); legacy uses this endpoint in production, so the binding works in practice — live READ to confirm.
- Lookup `id = ? AND approval_status IS NOT NULL` → NotFound **404**; then buyer by user id → NotFound **404** / DB error **500**.
- Fields: `id, status, aam_customer_id, customer_name, approval_request_date, email, phone, active_start_at, active_end_at, verified_by`. **No `branch_name`, no `approved_at`** (list-only).
- Frontend review screen (read-only): Customer ID, Nama Relasi, Tanggal Permintaan, Email, Nomor Telepon, Status Akun, plus `active_start_at` / `active_end_at` displayed read-only. The approve / reject / edit controls are **not rendered** (CONTRACT ONLY).
- Legacy shows TINJAU only for PENDING and EDIT only for APPROVED; a read-only review can be offered for every row with a non-empty id (decision for architecture readiness; no extra endpoint involved).

## 9. Authorization

| Item | Evidence | Status |
|---|---|---|
| Legacy permission | none (token expiry + superadmin menu) | VERIFIED |
| Backend (account-service) | `X-UserId` presence only (`helper.GetUserID`); no role | VERIFIED |
| Gateway role enforcement | auth plugin injects `X-RoleName`; enforcement unknown (A2-U04) | **NEEDS EVIDENCE** |
| Frontend capability | **none exists** for F27 in `src/shared/authorization/capabilities.ts` | **NEEDS DECISION** — name to be fixed in Architecture Readiness following the existing `<feature>.read` convention; fail-closed; interim grant via `AUTHZ_INTERIM_GRANTS` |
| List / review / export access | one read capability covers all three (they use only the two read endpoints) | proposal |
| Approve / reject / update | separate write capabilities, defined only when a WRITE gate authorizes them | DEFERRED |

## 10. Excel Export Audit

| Question | Answer | Evidence |
|---|---|---|
| Present? | yes — "Unduh Data" button | `list.edge:14-16, 296-299` |
| Client-side? | yes — DataTables Buttons `excel` (`buttons.html5.js` + JSZip) | `main.js:20-27`; `layouts.edge:255-260` |
| Exports loaded rows? | yes — server-side table, so only the rows of the current page | `main.js:62` (`serverSide: true`); comment `list.edge:296` |
| Fetches extra data? | no | — |
| Dedicated backend endpoint? | no | — |
| Filtered data? | yes, as far as the current page reflects the active status tab and search | — |
| Paginated or all matching? | current page only (all matching only when the user picked "All" = `take=10000`) | `Mapper.js:63-67` |
| Columns | 1–9 (everything except AKSI) | `list.edge:238-240` |
| Mutation / unsafe request? | none | — |

**Classification: `KEEP — CLIENT SIDE`** — export of the currently loaded page, columns STATUS…DITINJAU OLEH, no backend call. Constraint: the frontend has no spreadsheet library today (F27-CA-12); producing `.xlsx` needs an approved dependency, otherwise the format must be decided (e.g. CSV). The legacy "All" path is not carried over (no unbounded `take`).

## 11. Error Contract

| Case | Backend behaviour | Class | Frontend handling |
|---|---|---|---|
| empty list (`total_rows == 0`) | **404** NotFound (`usecase/cms_user.go:405-407`) | expected business outcome encoded as error | **temporary compatibility rule:** list 404 → empty state (only `total_rows == 0` yields 404 on this endpoint). Documented, not a workaround of a broken contract |
| `search_by` not email / customer_id | 400 validation (`ValidateQuery`) | contract / validation | never sent (allowlist) |
| customer-id keyword not numeric | **500** (`usecase :358-361`) | backend defect | validate numeric before calling |
| unknown `aam_customer_id` | **500** (NotFound wrapped, `usecase :363-366`) | backend defect | typed Server error; no fabrication |
| detail id unknown | 404 | expected | `notFound()` |
| detail buyer missing | 404 / 500 | data issue | typed error |
| missing `X-UserId` | 403 (`helper.GetUserID`) | authorization | not expected (gateway injects) |
| invalid / expired Bearer | 401 at gateway (A6R: empty body) | session | shared session refresh / login redirect |
| 409 / 422 / 429 | not produced by these handlers | — | shared mapping |
| DB failure | 500 | server | typed Server error with retry |
| network failure | — | network | shared Network / Timeout kinds |

## 12. Shared Frontend Foundation Reuse

| Need | Existing primitive |
|---|---|
| HTTP | `src/shared/infrastructure/http/gateway-client.ts`, `requestEnvelope` (`gateway-envelope.ts`, okCode 200) |
| Errors | `src/shared/errors/app-error.ts` kinds (`NotFound`, `Server`, `Contract`, `Forbidden`, `Unauthenticated`, `Network`, `Timeout`) |
| Session / auth | `src/shared/infrastructure/session/*` (Bearer, refresh, single-flight) |
| DAL / composition | `dal/services.ts` (`getReadServices`), `dal/page-result.ts` (`resolvePageResult`), `container/server-container.ts` (`composeFeatures`); `dal.test.ts` allowlist |
| Authorization | `src/shared/authorization/{capabilities,policy,interim-policy,route-access}.ts`; `guardRoute()` in `app/(dashboard)/_shell/route-guard.tsx` |
| Navigation | `src/shared/navigation/registry.ts` (legacy menu order) |
| Table | `components/organisms/data-table/server-data-table*.tsx` (filters, toolbar actions, empty title); `src/shared/table/{contracts,url-codec}.ts` |
| Detail / review UI | shadcn `Dialog` (pattern used by F06 stock dialog) or a detail page |
| Live READ harness | `test/live/module-smoke.live.test.ts` + `test/live/modules/<name>.ts` (READ adapter, no write) |
| E2E | `e2e/mock/mock-backend.mjs` + per-module mock; `e2e/support/fixtures.ts` |
| Excel export | **none** (no spreadsheet library in `package.json`) |

No new HTTP client, gateway, DAL, session, authorization, table or CRUD framework is needed.

## 13. Findings

| ID | Severity | Finding | Evidence | Impact | Action |
|---|---|---|---|---|---|
| F27-CA-01 | P1 | Empty list returns **404**, not 200 with empty rows | `usecase/cms_user.go:405-407` | naive handling shows an error for every empty tab / search | Frontend may proceed with the documented rule "list 404 → empty state". Owner: backend (return 200) — non-blocking |
| F27-CA-02 | P1 | Customer-id search: non-numeric keyword → 500; unknown `aam_customer_id` → 500 | `usecase :357-366` | user sees a server error instead of "no results" | Frontend proceeds: numeric validation; unknown id shows typed error (no fabrication). Owner: backend — fix error mapping |
| F27-CA-03 | P1 | Customer-id search for a customer **without buyers** drops the filter and returns **all** users | `usecase :357-376` + `repository/user.go:339` (`if len(spec.UserIds) > 0`) | wrong results presented as matches | Frontend proceeds without a workaround; record in live READ (R4) if observed. Owner: backend. Next action: backend fix (empty id list → empty result) |
| F27-CA-04 | P2 | List rows are built from the buyer map; a user without a buyer yields `id: ""`, blank name, `aam_customer_id: 0` | `mapper/cms_user.go:18-38` | strict mapping would reject the whole page; empty id cannot open review | Architecture Readiness must fix the rule (row kept, review disabled, or Contract error) — NEEDS EVIDENCE whether such rows exist (live READ) |
| F27-CA-05 | P2 | Fixed sort `updated_at DESC` without tiebreaker | repository list query | possible page overlap on ties | document; no sort controls |
| F27-CA-06 | P2 | `take` unbounded; legacy "All" = 10000 | DTO; `Mapper.js:63-67` | heavy requests | frontend page sizes 5–100 only |
| F27-CA-07 | P2 | `status` not validated; unknown value → 0 rows → 404 | DTO `:40` (no `oneof`) | silent empty | frontend allowlist |
| F27-CA-08 | P1 | No backend role authorization; gateway enforcement unknown (A2-U04); no legacy permission; no frontend capability yet | `helper.GetUserID`; `auth-plugin.go:167`; capabilities.ts | any authenticated CMS token can read user PII (email / phone) if the gateway does not enforce roles | Frontend proceeds fail-closed with a new read capability. Owner: product / architecture (capability name), backend (A2-U04) |
| F27-CA-09 | P2 | `approved_at` carries `rejected_at` for rejected rows; `verified_by` = approver or rejecter, value format unknown | `mapper/cms_user.go:40-48` | label "Tgl. Persetujuan" is misleading for rejected rows | canonical names `decidedAt` / `decidedBy`; legacy labels kept |
| F27-CA-10 | INFO | Detail lacks `branch_name` / `approved_at`; list lacks validity dates | DTO `:95-119` | review needs detail call for validity dates | use detail endpoint for review |
| F27-CA-11 | INFO | Backend strips `REJECTED-<ts>-` prefix from email in responses | mapper `:21-22`; usecase detail | display shows the original email | none |
| F27-CA-12 | P2 | No spreadsheet library in the frontend | `package.json` | `.xlsx` export needs a new dependency | decision in Architecture Readiness (approve dependency or CSV) |
| F27-CA-13 | INFO | Legacy hides list errors as an empty table | `Controller.js:85-91` | — | new UI shows typed error states (legacy bug fixed) |
| F27-CA-14 | INFO | Detail path binding relies on Fiber matching `id` to a field with only a `json` tag | `dto/cms_user.go:54-56` | — | confirm in live READ (legacy uses it) |
| F27-CA-15 | INFO | "Tanggal Permintaan" = `user.created_at` (no separate request timestamp) | mapper `:35` | semantics | document |

Totals: P0 0 · P1 4 · P2 6 · INFO 5. (F27-CA-08 counts the authorization gap and the undecided capability name together.)

## 14. Implementation Readiness

**`CONDITIONAL READY`**

- Both read endpoints (list, detail) are verified in backend source, match the legacy calls exactly, and live on a clone equal to `origin/development`.
- No P0: every P1 has a safe frontend rule that adds no fabricated data (404 → empty state; numeric validation; no workaround for CA-03; fail-closed capability).
- Conditions: capability name decision (F27-CA-08), export format / dependency decision (F27-CA-12), empty-id row rule (F27-CA-04), and live READ confirmation of totals, detail binding and the customer-id search behaviour.

## 15. Implementation Constraints

1. READ only: implement exactly `GET /api/v1/cms/users/need-approvals` and `GET /api/v1/cms/users/need-approvals/{id}`. No approve / reject / update UI, action, use case or repository method until a WRITE gate.
2. Never call `register`, `preregister`, `phone-approvals` or any F31 endpoint from F27.
3. Do not send `X-UserId` or any identity header; rely on the shared gateway client.
4. `status` ∈ {ALL, PENDING, APPROVED, REJECTED}; `search_by` ∈ {email, customer_id} and sent only with a non-empty keyword; customer-id keyword must be digits only (validated in the shared zod schema).
5. Page sizes 5 / 10 / 25 / 50 / 100 (default 5, legacy); never "All" or an unbounded `take`.
6. No sort controls (backend sort is fixed).
7. List 404 → empty state (documented compatibility rule, F27-CA-01); every other error → typed error state; never fabricate rows or totals.
8. No frontend workaround for F27-CA-02 / F27-CA-03.
9. Wire names only in `repository/dto.ts`; strict mapping → Contract errors; ids `/^[A-Za-z0-9-]{1,64}$/` → NotFound without a call (detail).
10. Fail-closed capability, checked in the page (`guardRoute`) and first in every use case; menu entry in legacy order (Extender.js `:231`).
11. Export: client-side, loaded rows only, columns STATUS…DITINJAU OLEH, only after the format / dependency decision; no export endpoint.
12. Reuse §12 primitives; copy-adapt from an existing module; no generic CRUD engine; no Bootstrap / jQuery / legacy components.
13. Live READ by the owner only, through a READ-only harness adapter (no write adapter); mutations must stay 0; secret scan 0.

## 16. Live Safety Statement

- Live reads performed: **no** — `LIVE READ NOT EXECUTED — ENVIRONMENT/CONTRACT EVIDENCE UNAVAILABLE` (credentials exist only in the owner's terminal; no harness adapter exists for F27 yet).
- Live writes performed: **0**
- POST: 0 · PUT: 0 · PATCH: 0 · DELETE: 0
- Approval / rejection mutations: 0
- F11 W3: **NOT STARTED**

## 17. Recommended Next Step

`F27 Architecture Readiness → F27 Implementation → F27 Module Gate`

Architecture Readiness must close: capability name (F27-CA-08), export format / dependency (F27-CA-12), empty-id row rule (F27-CA-04), and the review presentation (dialog vs page; read-only for all statuses).
