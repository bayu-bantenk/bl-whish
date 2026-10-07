# F27 — Verifikasi Akun Architecture Readiness

| Field | Value |
|---|---|
| Date | 2026-10-07 |
| Phase | Batch 4 · Phase 1 · **Architecture Readiness (design only)** |
| Inputs | `F27_CONTRACT_AUDIT.md` (contract), `BATCH4_SCOPE_LOCK.md` §C (scope), owner decisions ADR-01…04 (this phase), frontend working tree (patterns) |
| Pattern source | the F04 Order Review slice (read-only list + `detail/[id]`) is the closest **copy-adapt template**. It is used as a pattern only; F04 stays SKIP and is **not** a dependency, and none of its code is imported or changed |

## 1. Executive Summary

- **Status: READY FOR IMPLEMENTATION** (§17), within the READ-only scope.
- **Shape of F27:**
  - Two read endpoints, verified in source: list and detail.
  - One list page and one read-only review page.
  - Client-side CSV export of the loaded page.
  - Capability `account-verification.read`.
- **New code is limited to:** the F27 package, two routes, one capability, one nav icon key, and an F27-local CSV helper.
- **No new dependency,** no new HTTP client, gateway, DAL, authorization, pagination or table framework.
- **Backend findings are not fixed in the frontend:**
  - F27-CA-01: the list returns 404 when empty. This is handled by a documented compatibility rule in the use case.
  - F27-CA-02 and F27-CA-03: customer-id search returns 500 or wrong results.
  - F27-CA-08: backend role enforcement is not proven.
- **Module-gate ceiling:** because those three findings stay open, the F27 module gate can at best be CONDITIONAL GO.
- **One new contract fact surfaced in this phase:** the **detail endpoint returns no decision date**. The review page therefore cannot show "Tgl. Persetujuan/Penolakan" (§6, R-09).

## 2. Scope Compliance

| Class | Items | Design treatment |
|---|---|---|
| **IN** | list, status filter, search (email / customer id), pagination, backend-fixed order, read-only review, CSV export of the loaded page | designed below |
| **CONTRACT ONLY / NOT IMPLEMENTED** | approve, reject, update | no use case, repository method, action, capability, button or route |
| **OUT** | registration, preregistration, phone approval, role / permission, credentials, create / delete user, F31 surface | not referenced by the F27 package |
| **Live** | READ only, by the owner, after implementation | READ-only harness adapter; no write adapter |

## 3. Architecture Decision Record

### ADR-01 Capability

- **Decision:** a single capability, `account-verification.read`, covers the list, the review page and the CSV export. It is fail-closed and granted only through the existing policy, with the interim grant set via `AUTHZ_INTERIM_GRANTS`.
- **No write capabilities:** none are added for approve, reject or update.
- **Evidence:**
  - The legacy app has no permission for this screen (token-expiry check plus the superadmin menu).
  - account-service only checks that `X-UserId` is present.
  - Gateway role enforcement is unknown (A2-U04).
- **Consequence:** frontend authorization is the only enforced gate that is proven. It is not weakened because the backend accepts the request. The backend gap is recorded as R-04.

### ADR-02 Export

- **Decision:** client-side **CSV** of the rows currently loaded on the page, with no API call, no extra page requests and no new package.
- **Evidence:** legacy is client-side, exports the current DataTables page (`main.js:62`, `list.edge:296`), and has no export endpoint.
- **Replaces:** the legacy `.xlsx` output. This deviation is intentional and was approved in this phase. F27-CA-12 is closed by this decision.

### ADR-03 Empty-ID Rows

- **Decision:** keep the row.
  - The canonical row carries `userId: string | null`; a wire `""` becomes `null`, recording that the id is absent. No synthetic id is created and no other identifier is substituted.
  - The row is rendered and is non-actionable: the review affordance is disabled with the text "Tinjauan tidak tersedia", and no URL is ever built from it.
- **Evidence:** `mapper/cms_user.go:18-38`. A user without a buyer yields zero values for **every** field: `id ""`, `status null`, `aam_customer_id 0`, empty strings, and zero time for `approval_request_date`.
- **Consequences:**
  - The schema must accept `status: null` (see §6).
  - The table's React row key for such rows is a **render-only position key** (`no-id-<absolute position>`). It is not an identifier, is never displayed, exported or navigated, and the table is non-selectable.

### ADR-04 Review UI

- **Decision:** a dedicated read-only page at **`/dashboard/account-verification/detail/[id]`**. This follows the project convention for read-only detail pages (`order-review/detail/[id]`).
- **Identifier:** the record identifier is the **user id**; no `verification_id` exists.
- **Empty id:** rows with an empty id link nowhere.
- **No mutation controls:** approve, reject and edit are not rendered on the page.

## 4. Verified Contract Summary

From `F27_CONTRACT_AUDIT.md` (account-service `3001bc0` = `origin/development`; gateway `endpoints.json:67-68`):

| Operation | Request | Success | Errors |
|---|---|---|---|
| List | `GET /api/v1/cms/users/need-approvals?page&take&status[&search_by&keyword]` | envelope `code 200`, `data: {total_rows, rows[]}` | 404 when `total_rows == 0` (CA-01); 500 on non-numeric / unknown customer id (CA-02); 400 on an invalid `search_by` (never sent) |
| Detail | `GET /api/v1/cms/users/need-approvals/{id}` | envelope `code 200`, `data: {...}` | 404 unknown id / missing buyer; 500 DB error |

- **Order:** fixed `updated_at DESC`. `updated_at` is **not** in the response.
- **Total:** filtered count.
- **Page beyond last:** 200 with empty rows.
- **Authentication:** Bearer token. The gateway injects `X-UserId`; the frontend must never send it.

## 5. Target Architecture

```text
app/(dashboard)/dashboard/account-verification/page.tsx            (Server Component, guardRoute)
app/(dashboard)/dashboard/account-verification/loading.tsx
app/(dashboard)/dashboard/account-verification/detail/[id]/page.tsx (Server Component, guardRoute)
        ↓ getReadServices() / resolvePageResult()            (shared DAL — REUSE)
packages/account-verification/usecases/account-verification.usecase.ts   (authorize → validate → port)
        ↓ AccountVerificationPort                             (domain/account-verification.port.ts)
packages/account-verification/repository/account-verification.repository.ts ('server-only')
        ↓ requestEnvelope(gateway, req, 200)                  (shared gateway — REUSE)
account-service via gateway
```

| Concern | Primitive | Decision |
|---|---|---|
| Page routing / route guard | App Router pages + `guardRoute()` (`app/(dashboard)/_shell/route-guard.tsx`), registry entries | REUSE |
| Server-side loading | Server Components + `getReadServices()` | REUSE |
| DAL | `dal/services.ts`, `dal/page-result.ts` (`resolvePageResult`; NotFound → `notFound()`) | REUSE |
| Composition | `composeFeatures()` in `container/server-container.ts` | EXTEND (new `accountVerification` key) + `dal.test.ts` allowlist |
| Authorization | `capabilities.ts`, `policy.ts`, `interim-policy.ts`, `route-access.ts` | EXTEND (one capability string) |
| Navigation | `navigation/registry.ts`, `types.ts` `NavIconKey`, `nav-icon.tsx` | EXTEND (2 routes; icon `user-plus` = legacy `fa-user-plus`) |
| Gateway / envelope | `http/gateway-client.ts`, `requestEnvelope` | REUSE |
| Error normalization | `shared/errors/app-error.ts`, `gateway-errors.ts` (404 → NotFound, 403 → Forbidden, 5xx → Server) | REUSE |
| DTO validation | zod in `repository/dto.ts` (feature-local, as every module) | REUSE pattern |
| Pagination / URL state | `shared/table/{contracts,url-codec}.ts` (`TableSpec`, `parseTableQuery`, `Page<T>`) | REUSE |
| Table | `ServerDataTable` (+ toolbar select filters, `toolbarActions`, `emptyTitle`) | REUSE |
| Status filter / search type | toolbar `FilterDefinition` selects (`status`, `searchBy`) | REUSE |
| Empty / error / forbidden | `EmptyState` (inside the table), `molecules/feedback/error-state`, `templates/access-denied` | REUSE |
| Not found | `resolvePageResult` → `notFound()` → `(dashboard)/not-found.tsx` | REUSE |
| CSV | none exists in `src/` | **NEW (F27-local)** — `presentation/account-verification-csv.ts` (pure) + download button; no generic framework (copy-adapt-first) |
| Live READ | `test/live/module-smoke.live.test.ts` + new READ-only module adapter | REUSE harness, NEW adapter |
| E2E | `e2e/mock/mock-backend.mjs` + new `account-verification-backend.mjs`; `fixtures.ts` stats | EXTEND |

## 6. Domain / Canonical DTO

`domain/account-verification.ts` holds the verified data only. Wire names never leave `repository/dto.ts`.

```ts
type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED'

interface AccountVerification {          // list row
  userId: string | null                  // wire id; "" → null (ADR-03). The only record identifier.
  status: VerificationStatus | null      // null only for buyer-less rows (zero values)
  aamCustomerId: number | null           // wire int; 0 (zero value) → null
  customerName: string                   // "" allowed (shown as "-")
  branchName: string                     // list only; "" allowed
  requestedAt: string | null             // approval_request_date = user.created_at; Go zero time → null
  email: string                          // backend already strips the REJECTED-<ts>- prefix
  phone: string
  decidedAt: string | null               // wire approved_at: approval date (APPROVED) OR rejection date (REJECTED)
  decidedBy: string | null               // wire verified_by: approver or rejecter; value format UNKNOWN (shown verbatim)
}

interface AccountVerificationDetail {    // review page
  userId: string                         // non-empty (route id validated; detail only reachable with an id)
  status: VerificationStatus | null
  aamCustomerId: number | null
  customerName: string
  requestedAt: string | null
  email: string
  phone: string
  activeStartAt: string | null
  activeEndAt: string | null
  decidedBy: string | null
  // no branchName, no decidedAt: the detail endpoint does not return them (R-09)
}
```

**Excluded on purpose:**
- `verification_id`: no such field exists.
- `rejection_reason`, `rejection_note`, `rejection_comment`: the backend does not store a reason.
- `updated_at`: not returned.
- Role and permission data: not returned.

**Zero-value rules:**
- These follow the established F04 precedent: Go zero time or absent → `null`, and an unparsable value → Contract error.
- An unknown status string → **Contract**: the field is an enum.
- `aamCustomerId` 0 → `null`. This is the zero value of a buyer-less row; a real AAM id of 0 is not evidenced.

**Labels:**
- The list column uses **"Tgl. Persetujuan/Penolakan"** for `decidedAt`, so it is accurate for both statuses. This is an intentional copy deviation from the legacy "TGL. PERSETUJUAN".
- "Ditinjau oleh" is kept for `decidedBy`.

## 7. Repository Contract

`repository/account-verification.repository.ts` (`'server-only'`) implements the port:

| Method | Wire | Mapping |
|---|---|---|
| `list(q: AccountVerificationQuery): Promise<Result<Page<AccountVerification>>>` | `GET USERS_NEED_APPROVAL_PATH` with `page`, `take`, `status` (`ALL` when no filter), and `search_by` + `keyword` **only** when `q.search` is non-empty | `requestEnvelope(…, 200)` → zod `{total_rows: int ≥ 0, rows: array}` → rows → `Page{items, total, page, pageSize}`; any shape mismatch → `Contract` |
| `get(userId: string): Promise<Result<AccountVerificationDetail>>` | `GET USERS_NEED_APPROVAL_PATH/{encodeURIComponent(id)}` | zod detail schema; mismatch → `Contract`; an empty `id` in the response → `Contract` |

**Requests:**
- No sort parameters are sent: `sort_by` and `asc_desc` are not part of this contract.
- No identity headers are sent.

**Errors:**
- The repository passes gateway errors through **unchanged**, so a list 404 arrives as `NotFound`. The repository does **not** hide CA-01; the use case normalizes it (§8).

**Wire constants:** `USERS_NEED_APPROVAL_PATH = '/api/v1/cms/users/need-approvals'`. The legacy-v1 contract profile uses a bare origin, as the other modules do.

## 8. Use Case Contract

`usecases/account-verification.usecase.ts`:

| Use case | Steps | Result |
|---|---|---|
| `list(query: TableQuery)` | 1. `authorization.require('account-verification.read')`; on failure → `Forbidden` and **0 calls**. 2. Validate with the shared zod schema: page sizes, `status` ∈ allowlist, `searchBy` ∈ {customer_id, email} (default `customer_id`, as in the legacy select), search ≤ max length, **digits only when `searchBy = customer_id`**; on failure → `Validation` and 0 calls. 3. `port.list(...)`. 4. **CA-01 compatibility rule:** `NotFound` → `ok({items: [], total: 0, page, pageSize})`. This applies to the **list operation only** and is named and tested. 5. Every other error is returned unchanged; `Server` is never turned into an empty result | `Result<Page<AccountVerification>>` |
| `get(id: string)` | 1. Authorize (as above). 2. `id` must match `/^[A-Za-z0-9-]{1,64}$/`, otherwise `NotFound` with no call. 3. `port.get(id)`; `NotFound` stays `NotFound` | `Result<AccountVerificationDetail>` |

**No approve, reject or update use case exists.**

**`TableSpec`:**

| Field | Value |
|---|---|
| `pageSizes` | `[5, 10, 25, 50, 100]` |
| `defaultPageSize` | `5` (legacy) |
| `sortable` | `[]` |
| `defaultSort` | `{field: 'updatedAt', direction: 'desc'}`. Descriptive only; the repository never sends it |
| `maxSort` | `1` |
| `filters` | `status: ['PENDING', 'APPROVED', 'REJECTED']` (absent = ALL), `searchBy: ['customer_id', 'email']` |

## 9. DAL Contract

- `composeFeatures()` gains `accountVerification: {list, get}` (read use cases only). The feature is added to the `dal.test.ts` / architecture allowlist.
- **List page:** `getReadServices()` → `accountVerification.list(parseTableQuery(searchParams, ACCOUNT_VERIFICATION_TABLE_SPEC))` → `resolvePageResult(…)`.
  - `Unauthenticated` → session hand-over.
  - `Forbidden` → `AccessDenied`.
  - Error → `ErrorState`.
  - Success → table.
- **Detail page:** `getReadServices()` → `accountVerification.get(id)` → `resolvePageResult`; `NotFound` → `notFound()`.
- **No Server Actions:** there are no mutations. The CSV is built in the browser from the page data already rendered.

## 10. UI / Route Architecture

| Route | Registry id | Group / order | Capability |
|---|---|---|---|
| `/dashboard/account-verification` | `account-verification.list` (menu "Verifikasi Akun", icon `user-plus`) | `pengaturan`, **before** `principal.list` (legacy `Extender.js` order: Konfigurasi Channel (not migrated) → Verifikasi Akun → Prinsipal) | `account-verification.read` |
| `/dashboard/account-verification/detail/[id]` | `account-verification.detail` (hidden; parent = list) | — | `account-verification.read` |

**List page:**
- **Layout:** title "Verifikasi Akun"; an "Unduh Data" toolbar action (CSV); toolbar selects for Status (Semua / Pending / Approved / Rejected) and Cari berdasarkan (Cust. ID / Email); a search box.
- **Columns** (none sortable): Aksi, Status (badge), Customer ID, Nama Relasi, Cabang, Tgl. Permintaan, Email, Nomor Telepon, Tgl. Persetujuan/Penolakan, Ditinjau oleh.
  - Dates use the project-wide `Intl` id-ID format in Asia/Jakarta.
  - Empty values show "-".
  - Column definitions are at module scope.
- **Aksi:** a "Tinjau" link to the detail page for every row with a `userId`. Rows without one show disabled text, "Tinjauan tidak tersedia".
  - Legacy showed TINJAU only for PENDING and EDIT for APPROVED, both opening mutation modals. The read-only review applies to every status. This is an intentional difference, because no mutation is offered.
- **Row key:** `userId` or a render-only position key (ADR-03). `selectable = false`.

**Review page:**
- **Heading:** "Tinjau Verifikasi Akun".
- **Read-only fields:**
  - Customer ID, Nama Relasi, Tanggal Permintaan, Email, Nomor Telepon.
  - Status Akun (badge).
  - Masa Berlaku Mulai / Berakhir (`activeStartAt` / `activeEndAt`).
  - Ditinjau oleh.
- **Not shown:**
  - No decision date: the endpoint does not provide one (R-09).
  - No rejection reason: not stored.
- **Buttons:** only "Kembali" back to the list. No approve, reject or edit control and no form inputs.

**Status tabs:** legacy used tab buttons. The shared toolbar offers select filters, so the visual difference is recorded as **Visual parity: NOT VERIFIED**. The shared table is not extended just for tabs (copy-adapt-first).

## 11. Authorization Architecture

| Layer | Enforcement |
|---|---|
| Registry / menu | entries require `account-verification.read`; the menu item is hidden without it |
| Pages | `guardRoute('account-verification.list' / '.detail')` → `AccessDenied` (403 page) |
| Use cases | `authorization.require('account-verification.read')` **before** any gateway call |
| Gateway / backend | Bearer validation at the gateway; account-service only checks `X-UserId`; role enforcement NEEDS EVIDENCE (A2-U04) |
| Tests | `playwright.config.ts`: the editor instance gets `account-verification.read`, and a reader instance **without** it must see 403 with 0 backend calls. The expected menu in `e2e/specs/authorization.spec.ts` gains "Verifikasi Akun" in legacy position |

## 12. CSV Export Architecture

- **Placement:** `packages/account-verification/presentation/account-verification-csv.ts`. This is a pure, F27-local, unit-tested function, `toAccountVerificationCsv(rows, now) → {filename, content}`, with a small client button that downloads a `Blob` (`text/csv;charset=utf-8`). It does not use a generic export framework.
- **Data:** only the `items` of the page already rendered, which are the props the table received. There is **no API call, no Server Action and no pagination loop**. The button is disabled when the page is empty.
- **Columns, in fixed order:** Status, Customer ID, Nama Relasi, Cabang, Tgl. Permintaan, Email, Nomor Telepon, Tgl. Persetujuan/Penolakan, Ditinjau oleh. These are the legacy export columns 1–9; Aksi is excluded.
- **Values:**
  - Displayed values are exported, formatted as in the table, with dates in Asia/Jakarta.
  - Absent values are exported as an **empty field**, not "-".
  - Rows with an empty id are exported like any other row.
- **Encoding:**
  - UTF-8 with a leading BOM, so spreadsheet tools detect UTF-8.
  - `\r\n` line endings.
  - RFC 4180 quoting: wrap a field in `"` when it contains `,`, `"`, CR or LF, and double any embedded `"`.
- **Formula-injection guard (security):** a field starting with `=`, `+`, `-`, `@`, TAB or CR is prefixed with `'`. This is a documented OWASP CSV-injection mitigation, needed because names and emails come from users.
- **Filename:** `verifikasi-akun-<status|semua>-hal-<page>-<YYYYMMDD-HHmm>.csv`, ASCII only.
- **PII:** the export contains email and phone. It is gated by the same `account-verification.read` capability, and nothing is logged.

## 13. Error Handling

| Case | Source | Mapping | UI |
|---|---|---|---|
| List 404 | `total_rows == 0` (CA-01) | use case → empty `Page` (compatibility rule) | table empty state "Belum ada data" / "Data tidak ditemukan" when criteria are active |
| Detail 404 | unknown id / buyer missing | `NotFound` | `notFound()` → shell 404 page |
| Malformed detail id | route param | `NotFound` without a call | 404 page |
| Customer-id not numeric | client input | `Validation` without a call | field-level message "Customer ID harus berupa angka" |
| 401 | gateway | `Unauthenticated` | existing session refresh / login hand-over |
| 403 | backend / frontend policy | `Forbidden` | `AccessDenied` |
| 500 (incl. CA-02 unknown customer id) | backend | `Server` | `ErrorState` with "Coba lagi"; **never** empty |
| Shape mismatch | repository | `Contract` | `ErrorState` (contract errors are not suppressed) |
| Network / timeout | gateway client | `Network` / `Timeout` | `ErrorState` |

## 14. Test Strategy

Tests are designed here and implemented later. There is no live-write test.

| Level | Coverage |
|---|---|
| **Contract** (`account-verification.contract.test.ts`) | list request params (status `ALL` default, search params only with a keyword, no sort / identity params); list DTO mapping; detail DTO mapping; **404 → empty page on list only**; 404 on detail stays NotFound; malformed envelope / rows / enum / dates → Contract; empty `id` → `userId: null` with zero-value fields → nulls; `aam_customer_id` 0 → null; Go zero time → null; 500 stays Server |
| **Use case** | Forbidden with 0 calls (no capability); list / status filter / search by email / search by customer id; non-numeric customer id → Validation with 0 calls; pagination params; empty result; detail; malformed id → NotFound with 0 calls; no write methods exist on the port |
| **UI** (`account-verification-pages.test.tsx`) | list render + columns (none sortable); status and search-type selects; pagination; backend order preserved (no client sort); empty state; error state; "Tinjau" link for rows with an id; **disabled "Tinjauan tidak tersedia" for empty-id rows**; review page read-only fields (no decision date, no reason, no inputs or buttons other than Kembali); 403 |
| **CSV** | column order and headers; quoting and escaping; empty values; BOM and line endings; formula-injection prefix; filename; only the given rows (no fetch spy calls) |
| **E2E** (`account-verification.spec.ts` + mock) | login → menu → list; status filter; search by email and customer id; pagination; open a valid review; empty-id row shown as non-actionable (synthetic mock fixture); CSV download content of the current page; list error state; reader instance without the capability → 403 and 0 calls; axe on list and review |
| **Regression** | full `npm run quality` and full E2E; F04 untouched; no existing test weakened (only the expected-menu list and the DAL allowlist gain entries) |
| **Live READ** (owner) | READ-only adapter: R1 list, R2 pagination, R3 order (see R-10), R4 email search with `total_rows` equal to the filtered count, R5 detail existing / unknown, R6 not applicable or a status-filter lookup. Mutations 0, secret scan 0 |

## 15. Risk Register

| ID | Severity | Decision | Impact | Owner | Status |
|---|---|---|---|---|---|
| R-01 (F27-CA-01) | P1 | **Accepted compatibility rule:** list 404 → empty page, in the use case only, named and tested | an empty tab or search would otherwise show an error | Backend (should return 200 + empty rows) | open — rule in place |
| R-02 (F27-CA-02) | P1 | **Implementation constraint:** digits-only validation; other 500s stay errors | an unknown customer id shows a server error, not "no results" | Backend (error mapping) | open |
| R-03 (F27-CA-03) | P1 | **Backend blocker for correctness, not for implementation:** no client-side filtering | a customer-id search for a buyer-less customer lists **all** users | Backend | open — unresolved evidence until live READ or backend fix |
| R-04 (F27-CA-08) | P1 | **Implementation constraint:** frontend fail-closed `account-verification.read`; no weakening | if the gateway does not enforce roles, any authenticated CMS token can read user PII via the API directly | Backend / architecture (A2-U04) | open — unresolved evidence |
| R-05 (F27-CA-04) | P2 | **Implementation constraint (ADR-03):** row kept, id `null`, non-actionable | blank rows may appear | Backend (mapper) | open — existence unproven (live READ) |
| R-06 (F27-CA-12) | P2 | **Accepted (ADR-02):** CSV, no dependency | format differs from legacy `.xlsx` | Product (accepted) | closed by decision |
| R-07 (CSV injection) | P2 | **Implementation constraint:** leading-character guard | spreadsheet formula execution from user-supplied text | Frontend | designed |
| R-08 (F27-CA-05) | P2 | **Accepted:** backend fixed order, no tiebreaker | possible row overlap between pages on equal `updated_at` | Backend | open |
| R-09 (new) | P2 | **Implementation constraint:** the review page omits the decision date | review lacks "Tgl. Persetujuan/Penolakan" (list has it) | Backend (detail DTO lacks `approved_at` / `rejected_at`) | open |
| R-10 (new) | P2 | **Unresolved evidence:** live R3 cannot verify order because `updated_at` is not returned | ordering is proven by source only | Frontend (harness adapter) | open — adapter records R3 as "fixed order, not verifiable" |
| R-11 (F27-CA-14) | INFO | detail path binding via `json` tag only | — | — | confirm in live R5 |
| R-12 (visual parity) | INFO | status tabs → selects; review page instead of modal | — | Product | NOT VERIFIED |

## 16. Implementation Constraints

1. READ only. Exactly two endpoints. No approve / reject / update code in any layer; no write capability.
2. Use the package `src/packages/account-verification` and feature key `accountVerification`. Use the routes in §10, capability `account-verification.read`, and nav icon key `user-plus`.
3. Copy-adapt from the F04 read-only slice pattern without importing from or modifying F04.
4. Wire names only in `repository/dto.ts`. Use strict zod with Contract errors, `userId: string | null`, zero values → null, enum status, and no invented fields.
5. CA-01 rule lives only in the list use case. No other error becomes an empty result.
6. Send no sort params and no identity headers. Use page sizes 5–100 (default 5), never unbounded. Status and search type come from the allowlist only. A customer-id search is digits-only.
7. Empty-id rows are rendered, non-actionable, never navigated, and use a render-only key.
8. The review page is read-only, has no decision date and no rejection reason, and has only a "Kembali" control.
9. CSV is F27-local and pure; it uses the loaded page only, makes no request, adds no dependency, applies the formula-injection guard, and uses an ASCII filename.
10. Reuse every shared primitive in §5. Add no new HTTP client, gateway, DAL, auth, pagination, table or export framework. No Bootstrap, jQuery or legacy code, and no `legacy/`, `migration/` or `adonis/` folders.
11. Authorization is checked in three places: registry, `guardRoute` and the use case.
12. The live harness adapter is READ-only, with no `write`. Mutations must stay 0 and the secret scan 0.
13. Allowed shared touches are limited to: `capabilities.ts`, `registry.ts`, `navigation/types.ts`, `nav-icon.tsx`, `server-container.ts`, `dal.test.ts`, `playwright.config.ts`, `e2e/specs/authorization.spec.ts`, `e2e/mock/mock-backend.mjs`, `e2e/support/fixtures.ts` and `test/live/modules/index.ts`.

## 17. Architecture Readiness Decision

**`READY FOR IMPLEMENTATION`**

- **Why:**
  - Both read endpoints are verified in source on an up-to-date clone.
  - All four architecture decisions are locked (ADR-01…04).
  - Every component maps to an existing primitive, or to a small F27-local addition with a stated reason.
  - Every backend finding has an explicit, non-fabricating frontend treatment.
- **Not conditions for implementation:** R-01…R-04 and R-09 constrain the **module gate**, not implementation. While R-02, R-03 and R-04 stay open, the F27 module gate cannot exceed **CONDITIONAL GO**.
- **Still to prove by live READ:** R-05 (empty-id rows exist?), R-03 (wrong customer-id results), R-10 (order) and R-11 (detail binding).

## 18. Implementation Sequence

1. Contract DTOs (`repository/dto.ts`, `domain/account-verification.ts`, schema)
2. Repository
3. Use case (with CA-01 rule)
4. DAL wiring (`composeFeatures`, allowlist, capability, registry, nav icon)
5. Routes / pages (list, loading, detail)
6. DataTable (columns, row key, review link / disabled state)
7. Filters, search, pagination (TableSpec, toolbar selects, validation message)
8. Review page
9. CSV export
10. Tests (contract, use case, UI, CSV, E2E + mock, live READ adapter)
11. Module gate (quality, E2E, build, bundle / wire scan, owner live READ, report)

Not implemented in this phase.

## 19. Live Safety

- Live reads: **0**
- Live writes: **0**
- POST: 0 · PUT: 0 · PATCH: 0 · DELETE: 0
- Approval / rejection: 0
- F11 W3: **NOT STARTED**
