# F31 Contract Audit — Manajemen Pengguna

| Field | Value |
|---|---|
| Date | 2026-10-08 |
| Phase | Batch 4 · Phase 2 · **Contract Audit (audit only)** |
| Scope authority | `BATCH4_SCOPE_LOCK.md` §D |
| Pattern reference | `F27_CONTRACT_AUDIT.md`. Used for audit structure only; no F27 logic or ids are reused |
| Legacy source | `gpos-b2b-cms` `00bc6ead` (2026-09-25) |
| Backend source | `gpos-b2b-account-service` `3001bc0` (2026-09-11, equal to `origin/development`; local refs only) |
| Gateway | `gpos-b2b-api-gateway/setting/endpoints.json` `fb68a8f` |

## 1. Audit Status

- **Status: complete.** All evidence comes from source code; no live call was made (§17).
- **Readiness: CONDITIONAL — CONTRACT GAPS REQUIRE ARCHITECTURE DECISION** (§21).
- **Findings:** P0 1 · P1 3 · P2 7 · INFO 1.
- **The P0 is a backend SQL-injection surface** in the list filter (F31-CA-01). It exists for any caller of the API, whether or not the frontend is migrated. A frontend that sends only validated values does not widen it, but the owner must acknowledge it before implementation.
- **Live WRITE operations performed: 0.**

## 2. Scope

From `BATCH4_SCOPE_LOCK.md` §D (takes precedence) and the task brief:

| Class | Items |
|---|---|
| **IN (READ)** | user list, search, branch filter, sorting (as far as the contract supports it, §10), pagination, active / inactive status visibility |
| **NEEDS EVIDENCE / OUT** | user detail: no detail endpoint exists (§5); role / permission display: not in the contract |
| **CONTRACT-ONLY / OUT OF IMPLEMENTATION SCOPE** | active toggle (`PUT …/status`), delete (`DELETE …/:id`) |
| **OUT** | create, update / edit, bulk delete, password reset, role / permission / branch mutation, any other user mutation, client-side export buttons (owner decision, §20) |

## 3. Legacy Screen / Route

| Item | Evidence |
|---|---|
| Menu | "Manajemen Pengguna", superadmin menu, `fa fa-user` (`app/Middleware/Extender.js:254-256`) |
| Routes | `Route.resource("user-management", …)`, `POST user-management/datatable`, `POST user-management/delete`, `POST user-management/:id/update-is-active` (`start/routes.js:449-452`) |
| Screen | `resources/views/user_management/list.edge` (270 lines); `create.edge` and `edit.edge` exist, but their controller methods are commented out (`UserManagementController.js:52-147`) |
| Table columns (`list.edge:36-46`) | Aktif/Nonaktif Akun · Cust. ID · Nama Relasi · Nama Cabang · Sales Channel · Email Pengguna · Nama Pengguna · Nomor Telepon · **Pembaruan No. Telepon** · Tgl. Masuk Terakhir ("Edit" column commented out) |
| Branch filter | select2 multiple "Branch", placeholder "Filter dengan nama cabang", options from `GET /banner/branch` (`list.edge:23-31`) |
| Search | select Nama Relasi (`customer.name`, default) / Email (`user.email`) plus a text box (`list.edge:170-196`) |
| Sort controls | **none.** Every column is unsortable (`aoColumnDefs bSortable:false` for columns 0–9, `list.edge:123-125`) |
| Pagination | default 15; menu 15 / 25 / 50 / 100 / All (`list.edge:119-122`) |
| Row grouping | client-side group header row per Cust. ID (`list.edge:129-142`) |
| Row actions | active **toggle** (bootstrap-toggle) per row → `POST /user-management/:id/update-is-active` (`list.edge:238-262`) |
| Delete | delete modal and form exist (`list.edge:61-90`), but the row's delete button is **commented out** (`UserManagementMapper.js:45`). No visible trigger |
| Detail link | none |
| Export | default `buildtable` buttons (copy / excel / pdf / print / colvis); print / pdf configured for columns 0,1,2,3,4,5,8,9 (`list.edge:153-164`; `public/assets/js/main.js:10-51`) |
| Dead references | the form action uses `route('UserManagementController.multidelete')` (`list.edge:19`), which is not registered; the edit AJAX targets `UserManagementController.update` (`list.edge:214`), whose method is commented out |

## 4. Legacy Data Flow

```text
list.edge (DataTables server-side, POST /user-management/datatable)
→ UserManagementController.datatable (UserManagementController.js:29-50)
→ UserManagementMapper.ToUserManagementListRequest (UserManagementMapper.js:5-29)
→ UserManagementRepository.getListUserManagement (UserManagementRepository.js:7-10)
→ ApiService GET /api/v1/cms/customers/users
```

**Request built** (`UserManagementMapper.js:15-27`):

| Param | Value |
|---|---|
| `sort_by` | `columns[1].name`, **always `aam_customer_id`** |
| `asc_desc` | `order[0].dir`; the `buildtable` default order is the last column, `DESC` (`main.js:59`), so effectively `desc` |
| `page` | `start / length + 1` |
| `take` | `length`; "All" sends **`-1`** |
| `keyword`, `search_by` | default `{type: "customer.name", keyword: ""}`, so `search_by` is always sent |
| `filters[0][column]`, `filters[0][opr]`, `filters[0][value]` | only when branches are selected: `customer_area_id`, `IN`, `"<id1>","<id2>"` (quoted, comma-joined) (`list.edge:146-151`) |

**Response handling:**
- `code == 200` → rows mapped (`UserManagementMapper.js:31-58`).
- Any other code → empty table (`Controller.js:41-43`).
- Exception → flash message and redirect back (`:45-49`).
- `recordsTotal` and `recordsFiltered` both come from `total_rows`.

**Branch options:** `GET /banner/branch` → `BannerController.getBannerBranchOptions` (`BannerController.js:304-314`) → `CustomerRepository.getBranchOptions` → `GET /api/v1/cms/customer-areas` (`CustomerRepository.js:4, 17-20`).
- Params: `{keyword: term, page: 1, take: 1000, search_by: 'aam_customer_id', sort_by: 'name', asc_desc: 'asc'}` (`BannerMapper.js:325-336`).
- Options are formatted `[aam_code] name - description`, with an extra `{id: 'ALL', text: 'All'}` (`Helper.js:77-87`).

**Mutations (legacy):**

| Action | Request | Status |
|---|---|---|
| Toggle | `PUT /api/v1/cms/customers/users/{id}/status {is_active}` (`Repository.js:32-35`; controller `:150-165`) | exposed in the UI |
| Delete | `DELETE /api/v1/cms/customers/users/{id}` (`Repository.js:27-30`; controller `:167-184`) | no UI trigger |
| create / edit / getById / bulk / options | repository methods (`Repository.js:12-25, 37-51`) | no backend handler and no active controller method (dead code) |

## 5. Backend Endpoint Contract

Routes: `handler/cms_customer.go` (group `/cms/`). Gateway: `endpoints.json:42-46` (account_service).

| Method | Endpoint | Purpose | Evidence | Status |
|---|---|---|---|---|
| GET | `/api/v1/cms/customers/users` | user list | handler `:27, 110-131`; DTO `dto/cms_customer.go:7-15, 25-46, 58-61`; mapper `mapper/cms_customer.go:13-46, 76-133`; usecase `usecase/cms_customer.go:77-97`; repository `repository/buyer.go:180-215`; GW `:42` | **VERIFIED (source)**: READ, in scope |
| GET | `/api/v1/cms/customer-areas` | branch options | handler `cms_customer_area.go:26, 46-60`; DTO `dto/cms_customer_area.go:19-26`; GW `:46` | **VERIFIED (source)**: READ lookup |
| PUT | `/api/v1/cms/customers/users/{id}/status` | active toggle | handler `:32, 206-221`; body `{is_active: bool}` (`dto:104-106`); usecase `:139-170` (deactivate → logout of all live tokens) | CONTRACT-ONLY |
| DELETE | `/api/v1/cms/customers/users/{id}` | delete user | handler `:31`; usecase `:99-136` (DB delete → AAM delete user → restore on AAM failure) | CONTRACT-ONLY |
| GET `/{id}`, POST, PUT `/{id}`, DELETE `/bulk`, GET `/options` | legacy repository only | — | **no handler, no gateway route** | not available |

- **No detail endpoint** for a single user exists.
- **Authentication:** every handler calls `helper.GetUserID` (403 when `X-UserId` is missing). The gateway validates the Bearer token and injects `X-UserId`.
- **Authorization:** see §14.

## 6. Request Contract

`CmsCustomerListRequest` (`dto/cms_customer.go:7-15`, query string):

| Param | Type | Validation | Backend use |
|---|---|---|---|
| `keyword` | string | none | `LIKE %keyword%` on `search_by` |
| `search_by` | string | **required** | raw column name in `WHERE <search_by> LIKE ?` (`mapper/cms_customer.go:37-40`) |
| `sort_by` | string | **required** | raw in `ORDER BY <sort_by> <asc_desc>` (`:21`) |
| `asc_desc` | string | **required** | raw (`:21`) |
| `page` | string | **required** | `strconv.Atoi`, error ignored (`:14-16`) |
| `take` | string | **required** | `strconv.Atoi`, error ignored |
| `filters[i][column\|opr\|value]` | list | none | column first letter upper-cased; `opr` containing `IN` → `column opr (value)` with the **value concatenated raw**; otherwise `column opr ?` (`:27-35`) |

## 7. Response Contract

- **Envelope:** `{code: 200, status, data: {total_rows, rows[]}, message}` (`global/response.go:19-25`; `CmsCustomerUserListResponse` `dto:58-61`).
- **Error envelope:** `{code, status: FAILED, data, message, error_code?}`.
- **One row per buyer / user** (`mapper/cms_customer.go:84-133`).

| Field | Type | Nullable | Legacy column |
|---|---|---|---|
| `user_id` | string | yes (pointer) | toggle `data-id` |
| `customer_id` | string | no | — |
| `name` | string | no | Nama Relasi |
| `org_id` | uint | no | — |
| `aam_customer_id` | uint | no | Cust. ID |
| `address` | string | no | — (not displayed) |
| `customer_area_id` | string | yes | — |
| `customer_area_code` | string | yes (`""` when no area) | Nama Cabang `[code] name - description` |
| `customer_area_name`, `customer_area_description` | string | yes | Nama Cabang |
| `customer_channel_id` / `_code` / `_name` | string | yes | Sales Channel `[code] name` |
| `user_name` | string | yes | Nama Pengguna |
| `user_phone` | string | yes | Nomor Telepon |
| `user_email` | string | yes | Email Pengguna |
| `user_activation` | bool | no | toggle state |
| `user_last_updated` | datetime | yes | **"Pembaruan No. Telepon"**: actually `user.updated_at` (fallback `created_at`), not a phone-update date (F31-CA-08) |
| `user_last_login` | datetime | yes | Tgl. Masuk Terakhir |
| `user_last_order` | datetime | **always null** (`mapper:132`) | — |

If a buyer's customer is missing from the preload map, the customer fields are zero values (`mapper:87`).

## 8. Search Contract

- **Columns:** legacy offers `customer.name` (Nama Relasi, default) and `user.email`. The backend accepts **any** string as `search_by` and concatenates it into SQL (F31-CA-02).
- **Matching:** partial, `LIKE %keyword%`, and the keyword is bound as a parameter. `%` and `_` in the keyword are **not escaped**, so they act as wildcards.
- **Case sensitivity:** depends on the MySQL collation. **NEEDS EVIDENCE.**
- **Empty keyword:** no search clause. `search_by` must still be sent because it is `required`.
- **No minimum length;** no normalization.
- **No result:** 200 with `rows: []` and `total_rows: 0`. No 404 (`repository/buyer.go:204-215`).
- **Join aliases:** filters are capitalized (`Customer…`), but `search_by` is sent verbatim (`customer.name`, `user.email`) while the GORM joins alias the tables as `Customer` and `User`. Resolution relies on case-insensitive alias handling, which is **NEEDS EVIDENCE** (live). Legacy uses these values in production (F31-CA-05).

## 9. Branch Filter Contract

- **Basis:** branch **ID** (`customer_area_id`, UUID), not the name.
- **Server-side:** sent as `filters[0][column]=customer_area_id`, `filters[0][opr]=IN`, `filters[0][value]="id1","id2"`. The backend builds `Customer_area_id IN ("id1","id2")` with the **value concatenated raw** (`mapper/cms_customer.go:27-31`), which is F31-CA-01.
- **Options source:** a separate endpoint, `GET /api/v1/cms/customer-areas`. It requires `sort_by`, `asc_desc`, `page`, `take`; accepts `keyword` and `filters`; and its `OrderBy` is also concatenated (`mapper/cms_customer_area.go:19-25`).
  - Legacy sends `take=1000` and `sort_by=name asc`.
  - The F18 Banner package already maps this endpoint (`packages/banner/repository/dto.ts:26, 32, 64, 196-206`), gated by the banner capability.
- **"All":** no filter. The legacy **"All" option (`id 'ALL'`)** would be sent as `IN ("ALL")` and return 0 rows (legacy bug, F31-CA-10; must not be migrated).
- **Invalid branch id:** a well-formed but unknown UUID returns 0 rows. A malformed value goes into SQL as-is, so the frontend must validate it.
- **Tenant / role scoping of branches:** none in source. NEEDS EVIDENCE.

## 10. Sorting Contract

- **Legacy UI:** no sort control (all columns unsortable). The request always carries `sort_by=aam_customer_id`, `asc_desc=desc` (`Mapper.js:16-17`; `main.js:59`).
- **Backend:** any `sort_by` / `asc_desc` string is concatenated into `ORDER BY` (F31-CA-02). An unknown column raises an SQL error → **500**. There is no tiebreaker: users of the same customer share an `aam_customer_id`, so ordering inside a customer is unstable across pages.
- **Compatibility rule (for architecture readiness):** the only evidenced sort is `aam_customer_id`. An allowlist limited to `aam_customer_id` asc / desc, with default **desc** as in legacy, is the maximum supported by evidence. Any other column needs evidence. No client-side sorting.

## 11. Pagination Contract

- **Parameters:** `page` (1-based), `take`, both strings and both required.
- **Offset:** `(page-1)*take`.
- **Atoi errors are ignored:** a non-numeric value becomes 0.
- **`take=-1`** (legacy "All") gives an unbounded `LIMIT` (F31-CA-06).
- **Page sizes:** legacy 15 / 25 / 50 / 100 (default 15). "All" is not migrated.
- **`total_rows`:** `Count` on the filtered query before ordering and offset (`repository/buyer.go:204-207`), so it reflects search and branch filters (source; live NOT VERIFIED). Independent of Batch 3 / F27 findings.
- **Page beyond the last:** 200 with empty `rows`.
- **Filters / sort resetting the page:** a UI concern; legacy DataTables resets to page 1 on search / draw.

## 12. Status Contract

- **Field:** `user_activation` (bool) = `user.is_active`.
- **Base set depends on runtime feature flags** (`repository/buyer.go:185-202`):

| Flag | Effect |
|---|---|
| `FeatureFlagDeleteUserAPJUpdateCustomer` **off** | adds `User.is_active = true`: **inactive users are not listed at all** |
| `FeatureFlagCrmValidateNewUser` on | adds `User.approval_status IS NULL`: users from the F27 verification flow are excluded |

- **No status filter parameter** exists, and legacy has no status filter.
- "Active / inactive status visibility" is therefore only meaningful if the first flag is on. **NEEDS EVIDENCE** (F31-CA-03).

## 13. Error Semantics

| Case | Behaviour (source) | Class |
|---|---|---|
| 200 | list (possibly empty) | success |
| 400 | missing required query param (`ValidateQuery`) | contract / validation |
| 401 | gateway token rejection | session |
| 403 | missing `X-UserId` (`helper.GetUserID`) | authorization |
| 404 | **not produced** by the list (empty = 200 + `[]`) | — |
| 422 | not produced | — |
| 500 | any DB error: unknown sort or search column, malformed filter, SQL error (`buyer.go:212-213`; `usecase:81-83, 91-93`) | backend |
| network / malformed | shared gateway kinds (`Network`, `Timeout`, `Contract`) | client |

- **No F31-specific compatibility rule is needed:** unlike F27-CA-01, an empty list is 200.
- **Error message:** "Internal Server Error". Stack traces are logged, not returned.

## 14. Authorization / Security

| Layer | Evidence | Status |
|---|---|---|
| Legacy | `Authorization.checkAuth` = token-expiry check (`app/Helper/Authorization.js:4-9`); the superadmin menu is the only gate (OD-06) | no per-feature permission |
| Frontend | no F31 capability exists in `src/shared/authorization/capabilities.ts` | **NEEDS DECISION** (name in Architecture Readiness; fail-closed; not assumed equal to F27's `account-verification.read`) |
| account-service | list / status / delete handlers only check that `X-UserId` is present | no role check |
| Gateway | auth plugin validates the token and injects identity, including `X-RoleName`; role enforcement unknown (A2-U04) | **NEEDS EVIDENCE** |
| Direct API access | any token the gateway accepts can call the list, and the toggle / delete endpoints, directly | **unprotected beyond authentication** (F31-CA-04) |

**Sensitive data in the list:**
- **Personal data:** email, phone, user name, customer name.
- **Address:** returned but not displayed.
- **Internal ids:** user_id, customer_id, org_id, area / channel ids.
- **No** credentials, tokens, password hashes or authorization metadata are returned.

**Injection surfaces (backend):** `filters[].value` with `IN` and `filters[].column` (F31-CA-01, P0); `search_by`, `sort_by`, `asc_desc` (F31-CA-02).

## 15. Contract Matrix

| Capability | Legacy Behavior | Backend Contract | Verified | Scope |
|---|---|---|---|---|
| List | DataTables → GET `customers/users` | handler `:27`; `{total_rows, rows}` | YES (source) | IN |
| Search | Nama Relasi / Email + keyword | `search_by` raw column + `LIKE %k%` | YES (source); alias behaviour NEEDS EVIDENCE | IN (allowlist) |
| Branch filter | select2 multi → `customer_area_id IN ("…")` | raw IN concatenation | YES (source); **P0** | IN (validated UUIDs only) |
| Branch options | GET `/banner/branch` → `customer-areas` | handler `cms_customer_area.go:26` | YES (source) | IN (lookup) |
| Sort | none in UI; fixed `aam_customer_id desc` | raw ORDER BY | YES (source) | IN as fixed / allowlist |
| Pagination | 15/25/50/100/All | page / take strings | YES (source) | IN ("All" excluded) |
| Status visibility | toggle reflects `user_activation` | bool; base set flag-dependent | partial — flags NEEDS EVIDENCE | IN (display only) |
| Detail | none | **no endpoint** | YES (absent) | OUT |
| Create | controller commented | no handler | YES (absent) | OUT |
| Update / edit | controller commented, dead AJAX | no handler | YES (absent) | OUT |
| Activate / Deactivate | toggle exposed | PUT `…/status` (logout on deactivate) | YES (source) | OUT (contract-only) |
| Delete | modal only, trigger commented | DELETE `…/:id` (+ AAM delete) | YES (source) | OUT (contract-only) |
| Bulk delete | form action to unregistered route | no handler | YES (absent) | OUT |
| Export | DataTables buttons | none | YES (client-side) | OUT (owner decision) |

## 16. Contract Findings

| ID | Sev | Title | Legacy Evidence | Backend Evidence | Observed | Expected | Impact | FE Workaround? | BE Fix? | Implementation Decision | Verification Needed |
|---|---|---|---|---|---|---|---|---|---|---|---|
| F31-CA-01 | **P0** | SQL injection via `filters[].value` / `column` (IN) | `list.edge:146-151` sends quoted ids | `mapper/cms_customer.go:27-31` concatenates value and column into WHERE | any caller can inject SQL through the branch filter | bound parameters, allowlisted columns | data exposure / tampering by any API caller | no workaround; **mitigation only**: send fixed column `customer_area_id`, opr `IN`, UUID-validated ids | **yes** | proceed only after owner acknowledgement; frontend never sends unvalidated filter input | backend fix confirmation |
| F31-CA-02 | P1 | `search_by` / `sort_by` / `asc_desc` concatenated into SQL | `Mapper.js:16-21` | `mapper/cms_customer.go:21, 37-40` | arbitrary column / expression accepted; unknown → 500 | allowlist server-side | injection surface; 500 on bad input | allowlist (`customer.name`, `user.email`; sort `aam_customer_id` asc / desc) | yes | frontend allowlist only | — |
| F31-CA-03 | P1 | Base set depends on runtime feature flags | toggle shown for every row | `repository/buyer.go:185-202` | flag off → inactive users hidden; CRM flag → F27 users excluded | documented, stable base set | "status visibility" may show only active users; deactivated users vanish | none | clarify | display `user_activation` as returned; no client filtering | live: do any rows have `user_activation=false`? |
| F31-CA-04 | P1 | No backend role authorization; personal data exposed to any authenticated token | no permission (menu only) | `helper.GetUserID` only; gateway role enforcement unknown | list, toggle and delete reachable directly | role-checked endpoints | personal-data exposure; account takeover of status / delete by any CMS token | frontend fail-closed capability | yes (or gateway) | new read capability (name: Architecture Readiness) | A2-U04 evidence |
| F31-CA-05 | P2 | `search_by` values vs join-alias case | `customer.name`, `user.email` | joins alias `Customer` / `User`; filters capitalized, search not | works only if alias resolution is case-insensitive | consistent aliases | possible 500 on search | none | maybe | send legacy values | live search |
| F31-CA-06 | P2 | `page` / `take` parse errors ignored; `take=-1` unbounded | "All" → `take=-1` | `mapper:14-16` | unbounded or zero results | validated paging | heavy request | fixed page sizes 15–100 | optional | never send "All" | — |
| F31-CA-07 | P2 | No detail endpoint | `getUserManagementById` unused | no handler | — | — | detail cannot be offered | — | — | detail OUT; no endpoint invented | — |
| F31-CA-08 | P2 | Field semantics: "Pembaruan No. Telepon" = `user_last_updated` (record update); `user_last_order` always null | `Mapper.js:47`; header `list.edge:45` | `mapper:100-110, 132` | misleading label | accurate label | wrong interpretation | relabel (decision) | — | label per evidence, e.g. "Terakhir diperbarui" | — |
| F31-CA-09 | P2 | DB errors → 500, including invalid input | — | `buyer.go:212-213` | 500 for bad sort / search | 400 for bad input | unclear errors | allowlists avoid it | optional | typed Server error; no reinterpretation | — |
| F31-CA-10 | P2 | Legacy "All" branch option sends `IN ("ALL")` → 0 rows | `Helper.js:84-87` | — | empty list when "All" selected | no filter | legacy bug | not migrated | — | empty selection = no filter | — |
| F31-CA-11 | P2 | Unstable order within one customer | sort `aam_customer_id` only | ORDER BY without tiebreaker | rows of one customer may shift between pages | stable order | duplicate / missing rows across pages | none | yes | document | live pagination |
| F31-CA-12 | INFO | Response carries fields not displayed (address, org / area / channel ids) | — | DTO `:25-46` | — | — | personal data in transit | do not render or log | — | map only displayed fields | — |

Totals: **P0 1 · P1 3 · P2 7 · INFO 1.**

## 17. Live READ Verification

```text
LIVE NOT VERIFIED — credentials/harness unavailable
```

- No live credentials or token are available in the coordinator shell; they exist only in the owner's terminal. No F31 live adapter exists yet.
- **Live WRITE operations performed: 0.** POST 0 · PUT 0 · PATCH 0 · DELETE 0.
- **To verify later** (GET only, owner-run): default list; search by name / email (F31-CA-05); branch filter with valid ids; page 1 / 2 overlap (F31-CA-11); empty result; presence of `user_activation=false` rows (F31-CA-03).

## 18. Architecture Impact

Target path: Page → DAL (`getReadServices`, `resolvePageResult`) → use case (authorize → validate) → port → repository (`requestEnvelope`, `'server-only'`) → shared gateway → `GET /api/v1/cms/customers/users`.

- **Contract-specific constraints:**
  - `search_by`, `sort_by`, `asc_desc`, `page`, `take` are always sent (required).
  - Wire names only in `repository/dto.ts`.
  - Strict allowlists for every raw-SQL parameter.
  - Branch ids validated as UUIDs before building `filters`.
- **No compatibility rule** for 404 (the list never returns it).
- **Lookup ownership:** branch options need a READ lookup of `customer-areas` under the **F31** capability. Calling the F18 banner use case would require banner capabilities, so architecture readiness decides between copy-adapting the area lookup into F31 and extracting a shared lookup after repetition.

## 19. Reuse vs New Components

| Item | Decision |
|---|---|
| Shared gateway, `requestEnvelope`, session / auth, DAL, error kinds, `guardRoute`, registry, `ServerDataTable` (TanStack), toolbar search + select filters, URL codec / `TableSpec`, `ErrorState`, `EmptyState`, `AccessDenied` | **Reuse** |
| Status display | **Reuse** pattern: shadcn `Badge` (as in the F27 status badge pattern; no import from F27) |
| Branch multi-select | **Check in readiness:** the toolbar `FilterDefinition` supports single-value selects only. A multi-branch filter needs either an existing multi-select (`components/molecules/multiple-selector`) or a single-branch constraint (decision) |
| New capability | **New**: F31 read capability (name to decide) |
| New route | **New**: `/dashboard/<f31-route>` list only (no detail) |
| New DTO / mapper / repository methods / use case | **New**: list (and area lookup per §18) |
| New infrastructure (HTTP client, gateway, DAL, auth, table, CRUD framework) | **None** |

No Bootstrap, jQuery, Adonis components, direct fetch from UI, or `legacy/` / `migration/` folders.

## 20. Explicit Exclusions

- **Not migrated:**
  - create, update / edit, active toggle, delete, bulk delete;
  - password reset, role / permission / branch mutation;
  - the detail page (no endpoint);
  - legacy "All" page size and "All" branch option;
  - row grouping by Cust. ID (visual; decision);
  - copy / excel / pdf / print / colvis export buttons (owner decision; F27's CSV precedent does not authorize F31 export);
  - dead legacy routes (`multidelete`, `update`).
- **Live WRITE:** not authorized.
- **Not reopened:** F11 W3; Batch 1–3 and F27 findings.

## 21. Readiness Assessment

**`CONDITIONAL — CONTRACT GAPS REQUIRE ARCHITECTURE DECISION`**

- **Implementable without backend changes?** Yes for the READ scope: list, search, branch filter, fixed / allowlisted sort, pagination and status display all map to verified source contracts.
- **Decisions required before implementation:**
  1. Owner acknowledgement of **F31-CA-01 (P0, backend SQL injection)** and F31-CA-04 (no backend role check), with the frontend mitigation (validated, fixed-column filter input).
  2. F31 capability name.
  3. Sort exposure: fixed `aam_customer_id desc`, or asc / desc toggle only.
  4. Branch filter: multi-select vs single-select, and lookup placement (copy-adapt vs shared).
  5. "Status visibility" given F31-CA-03; label for `user_last_updated` (F31-CA-08).
  6. Export: out, or a separate owner decision.
- **Why not BLOCKED:** the frontend does not create or widen the injection surface when it sends only allowlisted columns and UUID-validated values, and no read contract is missing.

## 22. Evidence Index

| Area | Source |
|---|---|
| Legacy routes | `gpos-b2b-cms/start/routes.js:449-452` |
| Legacy menu | `app/Middleware/Extender.js:254-256` |
| Controller | `app/Controllers/Http/UserManagementController.js:20-50, 52-147 (commented), 150-165, 167-184, 186-220 (commented)` |
| Repository | `app/Repositories/UserManagementRepository.js:4-51` |
| Mapper | `app/Mapper/UserManagementMapper.js:5-29, 31-58, 45` |
| View | `resources/views/user_management/list.edge:19, 23-31, 36-46, 61-90, 100-111, 119-125, 129-142, 146-152, 153-164, 170-196, 214, 238-262` |
| Table helper | `public/assets/js/main.js:10-51, 59` |
| Branch options | `BannerController.js:304-314`, `CustomerRepository.js:4, 17-20`, `BannerMapper.js:325-336`, `Helper.js:77-87` |
| Backend handler | `gpos-b2b-account-service/handler/cms_customer.go:27, 31-32, 110-131, 206-221`; `handler/cms_customer_area.go:26, 46-60` |
| Backend DTO | `dto/cms_customer.go:7-15, 25-46, 52-57, 58-61, 104-106`; `dto/cms_customer_area.go:19-26` |
| Backend mapper | `mapper/cms_customer.go:13-46, 76-133`; `mapper/cms_customer_area.go:19-25` |
| Backend usecase | `usecase/cms_customer.go:77-97, 99-136, 139-170` |
| Backend repository | `repository/buyer.go:180-215` |
| Gateway | `gpos-b2b-api-gateway/setting/endpoints.json:42-46`; `auth-plugin.go:72, 138-147, 167` |
| Frontend reuse | `frontend/src/packages/banner/repository/dto.ts:26, 32, 64, 196-206`; `banner.usecase.ts:190-193`; `components/organisms/data-table/server-data-table-toolbar.tsx:12` |
| Scope | `BATCH4_SCOPE_LOCK.md` §D; `BATCH4_SCOPE_DISCOVERY.md` §C, §F |
