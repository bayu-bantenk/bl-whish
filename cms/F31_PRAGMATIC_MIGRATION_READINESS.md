# F31 Pragmatic Migration Readiness — Manajemen Pengguna

| Field | Value |
|---|---|
| Date | 2026-10-09 |
| Directive | F31 pragmatic frontend migration gate (owner instruction, 2026-10-09): migrate against the backend **as it exists**, document every gap, never bypass security, never fabricate data |
| Scope | READ-ONLY: list, search, branch filter, sorting (as supported), pagination, active / inactive display from returned data |
| Gap register | `F31_BACKEND_COMPATIBILITY_GAPS.md` |
| **Status** | **READY WITH DOCUMENTED GAPS** (implementation) |

## 1. Readiness Status and Relation to Earlier Gates

**Implementation: `READY WITH DOCUMENTED GAPS`.** Every condition of the directive holds:

| Condition | Evidence |
|---|---|
| The read contract can be derived from source | §2 |
| Shared auth / API architecture can be reused | §5 |
| Unsupported behaviour can be omitted | §4 |
| Gaps are documented | gap register |
| No operation requires bypassing a security control or fabricating data | §3, §4 |

**This document supersedes only the *implementation* HOLD in `F31_ARCHITECTURE_READINESS.md` §18,** on the owner's explicit directive. It does **not**:
- close, accept or downgrade any security finding;
- record a formal risk acceptance of F31-CA-01;
- claim that the SQL remediation is merged or deployed. It is **not merged**: `origin/development` `c712ba6` is still vulnerable; see `F31_POST_MERGE_VERIFICATION_REPORT.md`.

**Production exposure is a separate decision (§6).**

## 2. Observable API Contract (source-derived; not runtime-verified)

All requests are `GET` through the shared gateway client (Bearer; the gateway injects identity headers).

### `GET /api/v1/cms/customers/users` (list)

| Item | Contract (backend `c712ba6`) | Frontend use |
|---|---|---|
| Required query | `search_by`, `sort_by`, `asc_desc`, `page`, `take` (strings) → missing → 400 | always sent |
| `keyword` | `<search_by> LIKE %keyword%` (bound); empty → no clause | trimmed, max 100 |
| `search_by` | raw column (CA-02) | constant: `customer.name` (Nama Relasi, default) or `user.email` (Email) |
| `sort_by` / `asc_desc` | raw ORDER BY (CA-02) | constant `aam_customer_id` / `desc` (legacy); no sort UI |
| Branch filter | `filters[0][column]=customer_area_id`, `filters[0][opr]=IN`, `filters[0][value]="id1","id2"`; the value is **concatenated** (CA-01) | constants plus UUID-validated ids (max 50), double-quoted, comma-joined; **omitted entirely when no branch is selected** |
| Pagination | 1-based `page`; `take` (no max; `-1` = unbounded); filtered `total_rows`; page beyond last → empty rows | sizes 15 / 25 / 50 / 100 (default 15); never `-1` |
| Success | `{code: 200, status, data: {total_rows: int, rows: [...]}, message}` | strict parse; a missing / non-int `total_rows` or non-array `rows` → `Contract` error |
| Empty | 200, `total_rows: 0`, `rows: []` | empty state |
| Errors | 400 validation; 403 no `X-UserId`; 401 at gateway; 500 DB / input errors ("Internal Server Error") | typed shared errors; never an empty list |
| Base set | flag-dependent (G-04) | displayed as returned, with a completeness note |

### `GET /api/v1/cms/customer-areas` (branch options)

| Item | Contract | Frontend use |
|---|---|---|
| Required query | `sort_by`, `asc_desc`, `page`, `take` | `name`, `asc`, `1`, `1000` (constants) |
| `keyword` | repository: `name like %k% OR aam_code = k OR id = k` (bound) | optional |
| Response | `{total_rows, rows: [{id, aam_code, name, description, …}]}` | option label `[aam_code] name - description` |

### Canonical DTO: `UserManagementRow`

Mapped in `repository/dto.ts` only.

| Canonical | Wire | Nullable | Notes |
|---|---|---|---|
| `userId` | `user_id` | yes | row key only; no route, no action |
| `isActive` | `user_activation` (bool) | no | badge "Aktif" / "Nonaktif" |
| `aamCustomerId` | `aam_customer_id` | no | Cust. ID |
| `customerName` | `name` | no ("" allowed) | Nama Relasi |
| `branch` | `customer_area_code` / `_name` / `_description` | yes (object null when all absent) | Nama Cabang |
| `channel` | `customer_channel_code` / `_name` | yes | Sales Channel |
| `email` | `user_email` | yes | personal data; not logged |
| `userName` | `user_name` | yes | personal data |
| `phone` | `user_phone` | yes | personal data |
| `userLastUpdatedAt` | `user_last_updated` | yes | label "Terakhir Diperbarui" (G-08) |
| `lastLoginAt` | `user_last_login` | yes | Tgl. Masuk Terakhir |

**Excluded (never mapped):** `customer_id`, `org_id`, `address`, `customer_area_id`, `customer_channel_id`, `user_last_order`.

**Dates:** Go zero time → `null`; unparsable → `Contract`. No field is invented.

## 3. Backend Behaviour the Frontend Must Accommodate

1. **Raw SQL construction.** The backend concatenates the branch-filter values and the search / sort identifiers (CA-01 / CA-02). The frontend sends only constants and validated ids. This is defence in depth, not a fix.
2. **Empty filter column panics** (CA-13). The frontend never sends a `filters` structure without the constant column, and sends none when no branch is selected.
3. **Ordering.** The sort is fixed to `aam_customer_id desc` with no tiebreaker (G-03): no client re-sorting, documented.
4. **Base set depends on feature flags** (G-04). Status is shown as returned, with no completeness claim.
5. **No 404 for empty lists** (G-05). An empty list is 200 with `[]`; every error stays an error.
6. **No detail endpoint** (G-07). There is no detail view.
7. **Misleading legacy label** (G-08). Relabelled to "Terakhir Diperbarui".
8. **Legacy "All" bugs** (G-09, and "All" page size, G-02). Not reproduced.
9. **Unnecessary personal / internal fields in the response** (G-11). Dropped by a strict DTO.
10. **Authorization** (CA-04). Backend role grants are unverified. The frontend stays fail-closed with `user-management.read` (navigation, route guard, use case before any request). That capability is **not** backend authorization: a backend 403 shows AccessDenied.

**Forward compatibility.** Every parameter value above is accepted unchanged by the reviewed remediation's allowlists. If the fix merges, the frontend needs no change.

## 4. Operations

| Operation | Status | Note |
|---|---|---|
| User list + pagination | **PROCEED** | §2 |
| Search (Nama Relasi / Email) | **PROCEED** | G-10 runtime NOT VERIFIED |
| Branch filter (multi-select) + options lookup | **PROCEED with input constraints** | **CRITICAL backend gap CA-01 remains**; the frontend adds no exposure (legacy uses the same path); production exposure per §6 |
| Fixed sort `aam_customer_id desc` | **PROCEED** | no sort UI |
| Active / inactive display | **PROCEED** (display only) | completeness NOT VERIFIED (G-04) |
| Detail page | **UNAVAILABLE** | no endpoint (G-07) |
| Status filter | **UNAVAILABLE** | no backend parameter |
| Sort controls / other sort fields | **UNAVAILABLE** | not supported safely (CA-02) |
| Export (copy / excel / pdf / print) | **UNAVAILABLE** pending an owner decision | not in the locked scope |
| Toggle active, delete, create, edit, bulk delete | **UNAVAILABLE (out of scope)** | CONTRACT-ONLY |

## 5. Architecture Reuse

The flow follows `F31_ARCHITECTURE_READINESS.md` §5–§14 (design unchanged):

```text
Page → DAL → use case → port → repository → shared gateway
```

- **Package:** `src/packages/user-management`.
- **Capability:** `user-management.read`.
- **Route:** `/dashboard/user-management` (list only).
- **Branch filter:** an F31-local control built from the existing `multiple-selector`, placed in `toolbarActions`.
- **Branch lookup:** copy-adapted from the F18 area mapping.

No second HTTP client, gateway, auth, pagination or table framework.

## 6. Security Risks That Remain Unresolved

| Risk | Status |
|---|---|
| **F31-CA-01 (CRITICAL)** SQL injection via the branch filter on `origin/development` | open; fix reviewed (CONDITIONAL PASS) but **not merged** |
| **F31-CA-02 (HIGH)** raw `search_by` / `sort_by` / `asc_desc` | open (same fix) |
| **F31-CA-04 (HIGH)** role grants for the four F31 endpoints | not evidenced; PARTIALLY VERIFIED |
| **G-13 (HIGH)** `cms_customer_channel.go` concatenation | separate follow-up |

**Production exposure is not authorized by this document.** These risks exist for any API caller today (the legacy CMS already uses the same endpoints), and the migrated frontend does not widen them. Releasing F31 to production users should follow either:
1. the merged and verified backend fix plus role-grant evidence, or
2. an explicit, written decision by the security owner recorded in `cms/`.

That decision is the owner's; it is not made here.

## 7. Test Evidence and Limitations

- **No tests run for this gate.** No F31 frontend code exists yet (`src/packages/user-management` is absent) and no code was changed in this task, so there are no F31 frontend tests to run. Backend evidence comes from earlier gates.
- **Contract is source-derived, not runtime-verified** (G-14).
- **Required at implementation:**
  - normal list; empty 200 list; null / missing optional fields (null branch / channel / phone / dates);
  - backend 500 / 400 / 403 → typed errors, never empty;
  - malformed `total_rows` / `rows` → Contract error;
  - pagination params (fixed sizes, never `-1`);
  - branch filter with valid UUIDs → exact `filters[0]` params, no `filters` when none are selected, invalid ids dropped before any request;
  - status badge from `user_activation`;
  - capability denied → AccessDenied with 0 backend calls;
  - static and mock assertion that only GET requests exist;
  - excluded fields absent from client props;
  - axe; bundle / wire scan;
  - full E2E (`npm run test:e2e:full`).
- **Module gate:** an owner-run GET-only live READ: default list, both searches, branch filter, pagination, empty result, presence of inactive rows.

## 8. Next Recommended Action

1. **Frontend:** implement F31 per §2–§5 and the readiness design (READ-only), then run the module gate with the owner live READ.
2. **Backend owner, in parallel:** commit, review and merge `fix/f31-cms-customer-sql-injection`; rerun the post-merge gate; open a separate ticket for `cms_customer_channel.go`.
3. **Security / platform owner:** provide the non-secret role-grant export for the four endpoints, and decide on production exposure (§6).
