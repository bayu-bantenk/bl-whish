# F31 Architecture Readiness — Manajemen Pengguna

| Field | Value |
|---|---|
| Date | 2026-10-08 |
| Phase | Batch 4 · Phase 2 · **Architecture Readiness (design only)** |
| Primary input | `F31_CONTRACT_AUDIT.md` (CONDITIONAL; P0 1 · P1 3 · P2 7 · INFO 1) |
| Scope authority | `BATCH4_SCOPE_LOCK.md` §D |
| Pattern reference | F27 readiness / implementation (structure only; no F27 logic reused) |

## 1. Readiness Status

```text
HOLD — SECURITY / CONTRACT REMEDIATION REQUIRED BEFORE IMPLEMENTATION
```

- **Reason:** **F31-CA-01 (P0)**. The user list endpoint concatenates the branch-filter value and column into SQL.
  - The repository has no evidence of a backend remediation.
  - It has no formal risk-acceptance record either: searching `cms/` found no risk-acceptance or security sign-off document.
  - Default: **P0 = NOT ACCEPTED · F31 PRODUCTION EXPOSURE = HOLD**.
- **The design below is complete,** so implementation can start as soon as the HOLD is lifted. A frontend-only implementation would **not** resolve the P0. The endpoint is vulnerable for any caller, with or without the branch filter.
- **Live READ:** NOT VERIFIED. **Live WRITE:** 0. **Implementation:** NOT STARTED.

## 2. Locked Scope

| Class | Items |
|---|---|
| **IN (READ-ONLY)** | user list, search, branch filter, sorting (fixed, §9), pagination, active / inactive status visibility (with the §11 limitation) |
| **CONTRACT-ONLY** | active toggle (`PUT …/users/{id}/status`), delete (`DELETE …/users/{id}`); legacy controls exist; **not implemented** |
| **OUT** | create, update, activate, deactivate, delete, bulk delete, password reset, role / permission / branch mutation, any other user mutation, **detail page** (no backend endpoint), export buttons (separate owner decision), legacy "All" page size, legacy "All" branch option, row grouping by Cust. ID |

## 3. Contract Summary

| Endpoint | Use | Key facts (audit §5–§13) |
|---|---|---|
| `GET /api/v1/cms/customers/users` | list | Required `search_by`, `sort_by`, `asc_desc`, `page`, `take` (strings); optional `keyword`, `filters[]`. **Raw SQL** for `filters[].value` / `column` (IN), `search_by`, `sort_by`, `asc_desc`. Envelope `{code, status, data: {total_rows, rows}, message}`; filtered count; an empty result is 200 with `[]` (never 404); DB errors → 500 |
| `GET /api/v1/cms/customer-areas` | branch options | Required `sort_by`, `asc_desc`, `page`, `take`; `keyword`; ORDER BY concatenated |

Further contract facts:
- **Base set:** depends on runtime flags `DELETE_USER_APJ_UPDATE_CUSTOMER` and `CRM_VALIDATE_NEW_USER`.
- **Missing endpoints:** no detail endpoint and no status filter parameter.
- **Authorization:** `X-UserId` presence only.

## 4. Security Decision

### F31-CA-01 — SQL injection (P0)

| Option | Assessment |
|---|---|
| **A. Backend remediation before production exposure** | **Required path.** Fix in account-service: bind IN values as parameters (`Where("customer_area_id IN ?", ids)`), and allowlist filter columns, `search_by`, `sort_by` and `asc_desc` server-side (`mapper/cms_customer.go:13-46`) |
| B. Formal risk acceptance | **Not available:** no documented owner acceptance, authority or compensating-control record exists in the repository. Not chosen; speed of migration is not a valid reason |
| **C. Implementation HOLD until remediation** | **Chosen as the current state** |

**Decision:** `P0 = NOT ACCEPTED`. F31 implementation is on **HOLD**. When Option A is delivered and verified, the HOLD moves to CONDITIONAL / READY. Option B lifts the implementation HOLD only through an explicit, written acceptance by an authorized owner, recorded in `cms/`. Production exposure then still depends on compensating controls.

**Frontend input validation (allowlists, UUID checks) is defence in depth, not a fix.** It narrows what the migrated UI sends. It cannot make unsafe backend SQL safe and does not protect against direct API callers. Hiding the branch filter is **not** a mitigation either: the same endpoint stays callable with a hostile `filters` value.

### F31-CA-04 — Authorization / personal data (P1)

- **Unresolved security boundary:** account-service checks only for `X-UserId`, and gateway role enforcement is unproven (A2-U04). Frontend authorization (§5) **does not** replace backend authorization.
- **Data minimisation:** the canonical DTO (§6) is a strict allowlist. Address, org id, area / channel ids, customer id and `user_last_order` are dropped at the repository boundary and never reach the client.
- **Fields kept because the legacy UI needs them:** email and phone are displayed by the legacy screen (`list.edge:41, 44`) and are kept.
- **Backend requirement:** role enforcement on `customers/users` (list, status, delete), at the gateway or in account-service.

## 5. Authorization / Capability

**Naming convention:** every capability is `<feature-route-slug>.<operation>`, for example `customer-group.read`, `account-verification.read`, `product-restriction.read` (`src/shared/authorization/capabilities.ts`). There is no `user.*` or `user-management.*` capability today, and no clash.

```text
Capability:
user-management.read

Required for:
- navigation (registry `requires.capabilities`; menu hidden without it)
- route guard (guardRoute on the list page → AccessDenied)
- use case (authorization.require before validation and before any repository call; 0 calls when denied)
- backend request boundary (repository calls only reachable through the authorized use case; the browser never calls the gateway)
```

**Other rules:**
- **Fail-closed:** granted only through the existing policy (interim `AUTHZ_INTERIM_GRANTS`). No UI-only hiding.
- **Lookup gating:** the branch-options lookup is gated by the **same** capability. It is not gated by `banner.*`.
- **No write capabilities:** no toggle, delete or update capability is created.

## 6. Canonical DTO

`UserManagementRow`: verified fields only, with stable semantic names. Wire names stay in `repository/dto.ts`.

| Field | Backend Source | Required UI | Nullable | Sensitive | Canonical Name |
|---|---|---|---|---|---|
| user id | `user_id` (*string) | row key only (no action, no route) | yes → `null` | internal id (not displayed) | `userId` |
| active state | `user_activation` (bool) | Status column | no | no | `isActive` |
| Cust. ID | `aam_customer_id` (uint) | yes | no | business id | `aamCustomerId` |
| Nama Relasi | `name` | yes | no ("" allowed) | personal / business name | `customerName` |
| Nama Cabang | `customer_area_code`, `customer_area_name`, `customer_area_description` | yes (`[code] name - description`) | yes | no | `branch: {code, name, description} \| null` |
| Sales Channel | `customer_channel_code`, `customer_channel_name` | yes (`[code] name`) | yes | no | `channel: {code, name} \| null` |
| Email Pengguna | `user_email` | yes | yes | **personal data** | `email` |
| Nama Pengguna | `user_name` | yes | yes | **personal data** | `userName` |
| Nomor Telepon | `user_phone` | yes | yes | **personal data** | `phone` |
| record update time | `user_last_updated` (= `user.updated_at`, fallback `created_at`) | yes | yes | no | `userLastUpdatedAt` |
| last login | `user_last_login` | yes | yes | no | `lastLoginAt` |

**Excluded at the repository boundary:**
- `customer_id`, `org_id`, `address`
- `customer_area_id`, `customer_channel_id`
- `user_last_order` (always null)

**Rules:**
- No field is invented. Go zero time or absent → `null`; unparsable → Contract.
- Exclusion means the field is not mapped and not passed to the client.
- **Personal data:** never logged; the gateway log already records only the path template.

**Column label (F31-CA-08):**
- The legacy header "Pembaruan No. Telepon" is **misleading**, because the value is the user record's update time, not a phone-update time.
- **Decision:** the canonical name is `userLastUpdatedAt`, and the UI label is **"Terakhir Diperbarui"**. This is an intentional deviation from legacy text, for semantic accuracy.

## 7. Search Decision

- **Parameters:** `search_by` + `keyword`. `search_by` is always sent because the backend requires it.
- **Allowlist:** `customer.name` (UI "Nama Relasi", default) | `user.email` (UI "Email"). These are the only legacy values, mapped by a fixed table; client input never becomes a column name.
- **Semantics:** partial `LIKE %keyword%`.
  - Case behaviour depends on the backend collation and is **NOT VERIFIED**.
  - `%` and `_` act as wildcards. This is documented, not escaped client-side, because escaping would change backend semantics.
- **Empty keyword:** no search clause (the keyword is sent empty).
- **Length:** trimmed; max 100 characters (frontend guard).
- **No result:** 200 `[]` → empty state.
- **Page reset:** a new search or search type resets to page 1 (existing URL-state convention).
- **No client-side filtering.**
- **Open evidence:** whether the backend alias resolves `customer.name` / `user.email` (F31-CA-05) is NOT VERIFIED; live READ must confirm.

## 8. Branch Filter Decision

- **Mode: multi-select.** Legacy uses select2 `form_select_multiple` (`list.edge:23-31`), and the backend contract is `IN (…)`.
- **UI component:**
  - The shared toolbar `FilterDefinition` supports single values only, so the shared toolbar is **not** extended for F31.
  - An F31-local branch filter control is composed from the existing `components/molecules/multiple-selector` and rendered in the table's `toolbarActions` slot.
  - Shared extraction only after a second table consumer (copy-adapt-first).
- **URL state:** repeated param `branch=<uuid>` (`FilterValue` already allows `string[]`).
  - The F31 query schema accepts only values matching the UUID pattern, with a maximum of 50 values. These are frontend guards, not a security fix (§4).
- **Wire mapping:** only in `repository/dto.ts`:
  - fixed `filters[0][column]=customer_area_id`;
  - fixed `filters[0][opr]=IN`;
  - value = validated ids, each double-quoted, comma-joined, exactly as legacy.
  - Column and operator are constants, never user input.
- **"All" / no selection:** **no `filters` parameter at all.** No fake "ALL" id; the legacy bug (`IN ("ALL")` → 0 rows, F31-CA-10) is not reproduced.
- **Options source:** F31-local repository method for `GET /api/v1/cms/customer-areas`.
  - Fixed params: `sort_by=name`, `asc_desc=asc`, `page=1`, `take=1000` (legacy); `keyword` optional.
  - Gated by `user-management.read`.
  - Copy-adapted from the F18 area mapping. F18 code is not imported or changed; no generic shared lookup abstraction.
- **Option label:** `[aam_code] name - description`.
- **Invalid branch id:** a well-formed unknown UUID → 0 rows (backend). Malformed values are dropped by the query schema before any request.
- **Branch scoping by role / tenant:** none evidenced; **NOT VERIFIED**.

## 9. Sorting Decision

```text
Option A — preserve legacy behaviour only: aam_customer_id DESC (fixed)
```

- **Why A:**
  - Legacy exposes no sort control (all columns `bSortable:false`).
  - The backend concatenates `sort_by` / `asc_desc` (F31-CA-02).
  - There is no evidence of a safe sortable contract.
- **Not chosen:** Option B, an asc / desc toggle, is not adopted until the backend allowlists ORDER BY. Option C, a fixed sort until hardening, coincides with A.
- **How it is sent:** the repository always sends the constants `sort_by=aam_customer_id`, `asc_desc=desc`. The F31 `TableSpec` has `sortable: []`; the URL sort is ignored (descriptive default only, as in F27). No column sort UI, no client-side sorting.
- **Known instability (F31-CA-11):** no tiebreaker exists, so users of the same customer may reorder between pages. Documented, not compensated.

## 10. Pagination Decision

| Item | Decision |
|---|---|
| Page indexing | 1-based `page` (string), `take` (string) |
| Default page / size | page 1, size **15** (legacy) |
| Page sizes | 15 / 25 / 50 / 100 (legacy "All" = `take=-1` **excluded**, F31-CA-06) |
| Total rows / pages | `total_rows` (filtered count, source-verified); pages = `ceil(total / size)` via the shared `pageCount` |
| Page beyond range | 200 + empty rows → empty state with pagination intact |
| Reset | search, search type and branch changes reset to page 1 (existing URL-state convention); sort is fixed |
| Infrastructure | shared `TableSpec` / URL codec / `ServerDataTable` pagination; no F31-specific pagination |

## 11. Status Decision

| Question | Answer |
|---|---|
| Is the flag enabled in the target environment? | **NOT VERIFIED.** Flags load at runtime from `config_service` (source absent) or the `FEATURE_FLAG` env (`config/variable.go:40-66`); not provable from the repository |
| Is there a backend status read filter? | **No.** No status parameter; the only status signal is `user_activation` on returned rows |
| Can the frontend display inactive users? | Only if the backend returns them (flag on) |

**Decision:**
- **Status column:** shows `isActive` exactly as returned, with an "Aktif" / "Nonaktif" badge. It is read-only; the toggle is not implemented.
- **No status filter** is offered, and inactive state is never inferred from missing rows.
- **Completeness is documented as unavailable:** the page shows a short fixed note, "Daftar mengikuti data dari server; pengguna nonaktif mungkin tidak ditampilkan." The live READ records whether any `user_activation=false` rows exist. If none exist, status parity stays **NOT VERIFIED** (not failed, not faked).
- **`CRM_VALIDATE_NEW_USER`** may exclude users from the F27 flow. This is documented, not compensated.

## 12. Error Semantics

All rules below are F31 use-case scoped; there is no global reinterpretation.

| Case | Mapping | UI |
|---|---|---|
| 200 with rows | `Page<UserManagementRow>` | table |
| 200 empty | empty `Page` | empty state ("Data tidak ditemukan" when criteria active) |
| 400 | `Validation` / `Contract` (should not occur: required params are always sent) | ErrorState |
| 401 | `Unauthenticated` | existing session refresh / login hand-over |
| 403 | `Forbidden` | AccessDenied |
| 404 | `NotFound` (not expected; no compatibility rule) | ErrorState — **not** converted to empty |
| 422 | not produced; shared mapping | ErrorState |
| 500 | `Server` | ErrorState with retry; never empty |
| network / timeout | `Network` / `Timeout` | ErrorState |
| malformed response | `Contract` | ErrorState |
| invalid client input (search too long, bad branch id) | dropped or `Validation` **before** any call | inline / table alert |

## 13. Architecture Flow

```text
app/(dashboard)/dashboard/user-management/page.tsx (+ loading.tsx)      guardRoute('user-management.list')
  → getReadServices() / resolvePageResult()                              shared DAL
  → userManagement.list(query) / userManagement.branchOptions(keyword)   F31 use cases: authorize → validate → port
  → GatewayUserManagementRepository ('server-only')                      requestEnvelope(gateway, req, 200)
  → shared GatewayClient → GET /api/v1/cms/customers/users, GET /api/v1/cms/customer-areas
```

**Placement and wiring:**
- **Menu:** "Manajemen Pengguna", group `pengaturan`, after "Konfigurasi Umum" (legacy `Extender.js` order). Icon key `user`, mapped to lucide `User` if not present.
- **Composition:** feature key `userManagement` in `composeFeatures`, plus the DAL allowlist.
- **No detail route.**

**Branch options loading:**
- **Initial load:** fetched server-side (one GET, keyword empty, `take` 1000).
- **Typed search:** if the multi-select needs keyword search, it goes through an F31 Server Action, read-only and authorized, through the same use case. The browser never calls the gateway.

## 14. Reuse vs New

| Item | Decision |
|---|---|
| Shared gateway, `requestEnvelope`, session / auth, error kinds, DAL (`getReadServices`, `resolvePageResult`), `composeFeatures`, `guardRoute`, registry, authorization policy | **REUSE** |
| `ServerDataTable` (TanStack), toolbar search, single select filter (search type), URL codec, `TableSpec`, `pageCount`, `EmptyState`, `ErrorState`, `AccessDenied`, shadcn `Badge` | **REUSE** |
| `components/molecules/multiple-selector` | **REUSE** inside an F31-local branch filter control |
| F31 package `src/packages/user-management/` (domain, schema, port, repository + dto, use case, presentation) | **NEW** |
| Route `/dashboard/user-management` (+ `loading.tsx`) | **NEW** |
| Capability `user-management.read`; registry entry; nav icon key (if `user` is missing) | **NEW** (small extensions of existing lists) |
| Branch lookup (customer-areas) | **NEW, F31-local** (copy-adapt from F18 mapping; no shared lookup abstraction) |
| New HTTP client, gateway, DAL, auth, pagination, table, CRUD or export framework | **NONE** |

No Bootstrap, jQuery, Adonis components, direct fetch from UI components, or `legacy/` / `migration/` / `adonis/` folders.

## 15. Explicit Exclusions

- **Mutations:** create, update / edit, activate, deactivate (toggle), delete, bulk delete, password reset, role / permission / branch mutation.
- **No backend endpoint:** detail page.
- **Not migrated from legacy:**
  - "All" page size;
  - "All" branch option;
  - row grouping by Cust. ID;
  - dead routes (`multidelete`, `update`).
- **Export:** copy / excel / pdf / print / colvis buttons are out, pending a separate owner decision. F27's CSV decision does not extend to F31.
- **Sorting:** any sort other than fixed `aam_customer_id desc`.
- **Live WRITE:** any. F11 W3 is not started; Batch 1–3 and F27 are not reopened.

## 16. Contract Findings and Disposition

| Finding | Sev | Current status | Architecture impact | Frontend mitigation | Backend requirement | Production impact | Decision |
|---|---|---|---|---|---|---|---|
| F31-CA-01 SQL injection (IN filter) | **P0** | **REQUIRES BACKEND FIX** (not accepted) | implementation HOLD | constants for column / opr; UUID-validated ids (defence in depth only) | parameter binding + server allowlists | **blocks production exposure** | HOLD until fixed or formally accepted by an authorized owner |
| F31-CA-02 `search_by` / `sort_by` / `asc_desc` concatenated | P1 | REQUIRES BACKEND FIX | fixed / allowlisted values only | search allowlist; fixed sort | server allowlists | injection surface for direct callers | OPEN; frontend never sends free input |
| F31-CA-03 flag-dependent base set | P1 | NOT VERIFIED | status completeness unavailable | display as returned; no status filter; fixed note | document / stabilize the base set | status parity unproven | OPEN; verify in live READ |
| F31-CA-04 no backend role auth; personal data | P1 | REQUIRES BACKEND FIX | unresolved security boundary | `user-management.read` fail-closed (three layers); strict DTO allowlist | role enforcement (gateway or service) | blocks production exposure together with CA-01 | OPEN |
| F31-CA-05 alias case | P2 | NOT VERIFIED | none | legacy values | maybe | possible 500 on search | verify in live READ |
| F31-CA-06 `take=-1` / Atoi | P2 | OPEN | fixed page sizes | never send "All" | optional validation | — | mitigated in frontend input |
| F31-CA-07 no detail endpoint | P2 | CLOSED (scope) | no detail route | — | — | — | out of scope |
| F31-CA-08 misleading label / null `user_last_order` | P2 | CLOSED (design) | `userLastUpdatedAt`, label "Terakhir Diperbarui"; `user_last_order` excluded | — | — | — | decided |
| F31-CA-09 bad input → 500 | P2 | OPEN | none | allowlists avoid it | 400 for bad input | — | typed Server error |
| F31-CA-10 legacy "All" branch bug | P2 | CLOSED (not migrated) | no filters param for "all" | — | — | — | decided |
| F31-CA-11 unstable order | P2 | OPEN | documented | none | tiebreaker | possible page overlap | verify in live READ |
| F31-CA-12 extra fields in response | INFO | CLOSED (design) | strict DTO allowlist | not mapped / logged | optional slimmer DTO | — | decided |

No finding is marked ACCEPTED RISK: no acceptance evidence exists.

## 17. Production Exposure Decision

```text
Frontend migration feasibility:   FEASIBLE (design complete; READ contract verified in source)
Production security readiness:   NOT READY
F31 PRODUCTION EXPOSURE:          BLOCKED
```

**Blocked by:**
- F31-CA-01 (P0, backend SQL injection);
- F31-CA-04 (no proven backend role enforcement for personal-data reads).

**Unblocking requires both:**
1. **For CA-01, either:**
   - a verified backend fix, or
   - a written risk acceptance by an authorized owner, recorded in `cms/` with compensating controls and an expiry.
2. **For CA-04:** an explicit decision on role enforcement.

## 18. Implementation Readiness Decision

```text
HOLD — SECURITY / CONTRACT REMEDIATION REQUIRED BEFORE IMPLEMENTATION
```

**Moves to `CONDITIONAL — IMPLEMENTATION ALLOWED, PRODUCTION EXPOSURE BLOCKED` when either:**
- the owner records a formal, authorized risk acceptance for F31-CA-01 limited to non-production implementation; or
- the backend fix for F31-CA-01 is merged and its contract re-verified. In that case CA-02 / CA-04 are re-assessed, possibly reaching READY.

**Design stays valid:** the canonical DTO and the design in §5–§14 hold across both paths, so no redesign is needed when the HOLD lifts.

## 19. Verification Plan

**Automated** (at implementation; none executed now):

| Level | Coverage |
|---|---|
| Typecheck / lint | `npm run quality` (tsc, eslint) |
| Contract / repository | fixed `sort_by` / `asc_desc`; `search_by` allowlist; `filters` built only from validated UUIDs with constant column / opr; no `filters` when no branch; page / take strings; strict DTO (excluded fields absent); zero time → null; malformed → Contract; 500 stays Server; 404 not converted |
| Use case | Forbidden with **0 calls**; validation before calls (bad branch id dropped / rejected, long search rejected); branch options gated by the same capability |
| UI | columns and labels ("Terakhir Diperbarui"); status badge; search type + keyword; branch multi-select → URL; pagination; empty / error / 403; no sort UI; no toggle / delete / edit controls; status completeness note |
| Security tests | 1) route blocked without the capability; 2) use case blocked; 3) zero backend calls when unauthorized; 4) no credentials or tokens in the client (bundle + wire scan); 5) excluded personal / internal fields absent from the client payload; 6) branch values allowlisted / validated; 7) arbitrary sort column not injectable (sort is constant); 8) no mutation request in F31 code (static scan + mock records only GET); 9) no hidden mutation via direct URL (no mutation route or action exists); 10) no new HTTP client or gateway bypass (architecture test) |
| Accessibility | axe on list (E2E) |
| Build / bundle | `npm run build`, `npm run check:bundle`, client wire scan (`customers/users`, `customer-areas`, `search_by`, `filters[`, `aam_customer_id`) → 0 |
| Full E2E | `npm run test:e2e:full` (E2E build), including the F31 spec and the authorization spec (menu) |

**Live READ** (owner-run, GET only, after implementation):
- default list;
- search by name and by email (CA-05);
- branch filter with valid ids;
- default ordering (record only; CA-11 overlap check);
- pagination (page 1 / 2, beyond last);
- empty result;
- presence of `user_activation=false` rows (CA-03);
- authorization if safely testable.

**Live WRITE: 0.** No live mutation testing.

## 20. Evidence Index

| Area | Source |
|---|---|
| Contract | `cms/F31_CONTRACT_AUDIT.md` §3–§16, §22 |
| Capability convention | `frontend/src/shared/authorization/capabilities.ts` (`<slug>.read` pattern; no `user-management.*` present) |
| Feature flags | `gpos-b2b-account-service/constant/feature_flag.go:8, 16, 22`; `config/variable.go:40-66, 81-83`; `repository/buyer.go:185-202` |
| SQL construction | `mapper/cms_customer.go:13-46`; `mapper/cms_customer_area.go:19-25` |
| Legacy UI | `gpos-b2b-cms/resources/views/user_management/list.edge:23-31, 36-46, 119-125`; `UserManagementMapper.js:15-27, 45`; `Helper.js:84-87` |
| Reuse | `components/organisms/data-table/server-data-table.tsx:30-46`, `server-data-table-toolbar.tsx:12`; `components/molecules/multiple-selector/multiple-selector.tsx`; `shared/table/contracts.ts:11`; `packages/banner/repository/dto.ts:62-64, 196-206` |
| Risk acceptance | none found in `cms/` (search for risk-acceptance / security sign-off records) |
