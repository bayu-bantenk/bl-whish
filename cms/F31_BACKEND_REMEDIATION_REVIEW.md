# F31 Backend Remediation Review Gate

| Field | Value |
|---|---|
| Date | 2026-10-09 |
| Type | Read-only review. No source, test, dependency, environment, data or documentation change in the backend; no merge, commit, deploy or live call |
| Branch | `gpos-b2b-account-service` `fix/f31-cms-customer-sql-injection` (HEAD = `c712ba6` + uncommitted working-tree changes) |
| Reviewed against | the actual diff and source, an independent baseline run on a clean export of `c712ba6`, and the legacy / frontend caller code. The remediation report was **not** accepted as proof by itself |
| Reviewer note | the same assistant wrote the remediation. To offset that, every conclusion below rests on re-executed evidence: a fresh baseline export, a fresh test run, and a direct caller sweep |
| **Result** | **CONDITIONAL PASS** |

## 1. Scope and Git Safety

| Check | Evidence | Result |
|---|---|---|
| Based on `c712ba6` | `git merge-base --is-ancestor c712ba6 HEAD` true; `HEAD` = `c712ba6`; 0 commits on top; local `origin/development` = `c712ba6` | ✓ |
| Changed files | modified: `mapper/cms_customer.go`, `mapper/cms_customer_area.go`, `usecase/cms_customer.go`, `usecase/cms_customer_area.go`; new: `mapper/cms_query_allowlist.go`, `test/mapper/cms_query_security_test.go`, `test/security/cms_query_sql_test.go`, `test/usecase/customer_area/get_customer_area_list_test.go`, `F31_BACKEND_SECURITY_REMEDIATION_REPORT.md` | only F31 paths ✓ |
| Handlers, routes, repositories, DTOs, auth / role code | unchanged | ✓ |
| Dependencies / environment | `go.mod`, `go.sum`, `.env*`, `Dockerfile`: no diff | ✓ |
| Frontend | no file under `frontend/src`, `test`, `e2e` or `package.json` is newer than the previous gate | ✓ |
| Secrets / artifacts | none. The DryRun DSN `dryrun:dryrun@tcp(127.0.0.1:1)/dryrun` is a dummy, never connected (`DisableAutomaticPing`, DryRun) | ✓ |
| `git diff --check` | exit 0 | ✓ |
| `gofmt -l` (changed files), `go build ./...`, `go vet` (mapper, usecase, new test packages) | clean | ✓ |
| Commit / merge | **not committed, not merged**. The fix exists only in this local working tree | open |

## 2. F31-CA-01 (P0): **PASS**

Source (`mapper/cms_customer.go` `toCustomerDatatable`; `mapper/cms_query_allowlist.go`):

| Check | Finding |
|---|---|
| Branch values bound | `statements = append(statements, column+" IN ?")`; `params = append(params, values)` where `values` is a `[]string` from `parseInFilterValues`. No value is placed into SQL text |
| Binding with the real driver | the DryRun test uses `gorm.io/driver/mysql` (the service's driver) and the real `repository.NewBuyerRepo(...).CmsGetPreloadBuyerList`. The captured SQL is `… WHERE User.is_active = ? AND Customer_area_id IN (?,?) …`, with the payloads in `Statement.Vars` |
| Malicious values | `' OR 1=1 --`, `1); DROP TABLE buyer; --`, `x') UNION SELECT password FROM user --` never appear in any captured SQL string, and appear as bound variables (`TestCustomerUserList_BranchFilterPayload_IsBoundNotInterpolated`) |
| Column allowlist (per endpoint) | `customers/users`: `customer_area_id` → constant `Customer_area_id`. `customers`: empty map (any filter → 400). `customer-areas`: any filter → 400 |
| Operator allowlist | only `IN` (`isInOperator`, case-insensitive). `=`, `!=`, `LIKE`, `NOT IN`, `IN (`, injected text → 400 |
| Malformed IN | empty value, `""`, empty elements (`"a",,"b"`), whitespace, more than 1000 values → 400 (`parseInFilterValues`) |
| Remaining raw fragments | none on these paths. The only string joins are allowlist constants (`column+" IN ?"`, `searchColumn+" LIKE ?"`, `column + " " + direction`). `fmt.Sprintf("%%%s%%", keyword)` builds a **bound value** |

## 3. F31-CA-02 (P1): **PASS**

| Item | `customers/users` | `customers` | `customer-areas` |
|---|---|---|---|
| `search_by` | `customer.name`, `user.email` | `aam_customer_id`, `id` | not in the DTO (no SQL use) |
| `sort_by` | `aam_customer_id`, `id` | `name`, `id` | `name` |
| `asc_desc` | `asc` / `desc` → `ASC` / `DESC` (shared) | same | same |
| Unknown / injected | 400 | 400 | 400 |

- **Callers:** `GetCustomerList` → `ToCustomerDatatableFromSpec`; `CmsGetCustomerUser` → `ToCustomerUserDatatableFromSpec`; `GetCustomerAreaList` → `ToCustomerAreaDatatableFromSpec`. These are the only writers of these `WhereStatement` / `OrderBy` fields.
- **Error messages:** constant `Invalid <param>` text (`invalidQueryParam`); the rejected value is never echoed (`TestQueryErrors_DoNotEchoInput`).
- **Keyword:** always bound on all three repositories (`Where("name like ?", …)`, `Or(column, arg)`, mapper `LIKE ?`).

## 4. F31-CA-13 (P2): **PASS**

- **Panic removed:** the `f.Column[:1]` slice no longer exists.
- **Empty column:** an empty or whitespace column fails the allowlist map lookup → 400 (`TestCustomerUserQuery_EmptyFilterColumn_DoesNotPanic`, `assert.NotPanics`).
- **Customer areas:** any filter, including an all-empty one, → 400 (`TestCustomerAreaQuery_Filters_AreRejectedWithoutPanic`, `TestGetCustomerAreaList_InvalidQuery_RejectedBeforeRepository`; the repository is not called).
- **Response convention:** `global.BadRequestError` → `gposError{StatusCode: 400}` → the unchanged handler path `err.ToResponse(c)` writes HTTP 400 with the standard failure envelope. This is verified from source; there is no HTTP-level test (see §7).

## 5. Shared Mapper Compatibility: **PASS** (for every caller found in the repositories)

**Caller sweep:**
- **Legacy:** only `CustomerRepository.getCustIDOptions` (`/cms/customers`), `CustomerRepository.getBranchOptions` (`/cms/customer-areas`) and `UserManagementRepository.getListUserManagement` (`/cms/customers/users`) reach these endpoints. `CustomersListOptionsRepository` targets a different path.
- **Frontend:** `customer-group` and `banner` only.
- **Backend services:** none call these CMS routes.

| Caller | Endpoint | Sent values | Accepted? | SQL vs before |
|---|---|---|---|---|
| Legacy F31 user list (`UserManagementMapper.js:15-27`) | users | `search_by` `customer.name` / `user.email`; `sort_by` `aam_customer_id`; `asc_desc` from DataTables (`desc` default); branch `customer_area_id` `IN` `"id1","id2"` | ✓ | same identifiers; IN values bound instead of interpolated; `DESC` upper-case |
| Legacy F15 Mutasi & Redeem (`MutasiRedeemPoinMapper.js:17-26`) | users | `customer.name`, `id`, `asc`, `take=-1`, branch IN (same format, `filter.edge:97`) | ✓ | same; pagination (incl. `take=-1`) unchanged |
| Legacy Banner `ToBannerRestrictCustomer` (`BannerMapper.js:325-336`) | customers / areas | `aam_customer_id`, `name asc`, `take` 1000 | ✓ | same |
| Legacy Notification `ToRestrictCustomer` / `ById` (`NotificationMapper.js:424-446`) | customers / areas | `aam_customer_id` or `id`, `name asc` | ✓ | same |
| Legacy Point-Voucher (`PoinVoucherController.js:103-111`; branch options `:316, :408`) | customers / areas | `id`, `id asc`; Banner payload for areas | ✓ | same |
| Frontend customer-group `toCustomerSearchParams` | customers | `aam_customer_id`, `name asc` | ✓ | same |
| Frontend banner `toCustomerParams`, `toAreaParams` | customers / areas | `aam_customer_id`, `name asc` | ✓ | same |

**Behaviours checked:**

| Behaviour | Result |
|---|---|
| Empty filter | no `filters` → no IN clause (unchanged) |
| Search | applied only when the keyword is non-empty (previously `SearchBy != "" && Keyword != ""`; `search_by` is DTO-required, so equivalent). `LIKE %k%` semantics unchanged |
| Sort | same columns and direction; default chosen by caller (unchanged) |
| Pagination | `page` / `take` parsing untouched |
| Customer-area lookup | the keyword `name / aam_code / id` search in the repository is unchanged; the only SQL difference is `ORDER BY name ASC` instead of `name asc` |
| Legacy "All" branch option (`IN ("ALL")`) | still returns 0 rows, now as a bound value; the legacy bug's behaviour is unchanged, not fixed |

**Behaviour changes (all for inputs no repository caller sends)** — now 400 instead of SQL text, a 500 or a panic:
- unknown `search_by` with an empty keyword (previously ignored);
- unknown `sort_by` / `asc_desc`;
- any filter other than `customer_area_id IN` on users;
- any filter on `customers` / `customer-areas`;
- malformed IN.

**Residual:** a caller outside the inspected repositories (legacy CMS, new frontend, `~/Developments/BE/*`) using other values would now get 400. None was found. This is recorded, not assumed safe.

## 6. Test Evidence

| Category | Evidence | Result |
|---|---|---|
| Remediation-specific | `test/mapper/cms_query_security_test.go` (21 tests), `test/security/cms_query_sql_test.go` (5), `test/usecase/customer_area/get_customer_area_list_test.go` (2) | all pass (fresh `go test -count=1 ./...` on 2026-10-09) |
| Regression | `test/global`, `handler`, `helper`, `mapper` (existing tests), `usecase/{buyer, cms_user, customer, customer_document, customer_site, feedback, gpos_lite, relation, role}` | all pass on the branch, as on the base |
| **Baseline equivalence** | clean `git archive c712ba6` export in `/tmp/f31review/base`, `go test ./...`, compared with the branch run | **VERIFIED**: identical failing packages (`test/repository`, `test/usecase/auth`, `test/usecase/user`) and identical failing tests (`TestFailedLoginWithWrongEmail`, `Test_LoginWithPjRelasi_Success`, `TestRegisterPjRelasi_CRMValidation_FeatureFlagOff_CRMNotCalled`) |
| Baseline failure causes | `test/repository`: ".env is not loaded properly / open ../../.env: no such file" (needs a MySQL test DB); auth / user: assertion failures and panics in login / registration tests | unrelated to F31 paths |
| Untested | real MySQL execution of the new statements (DryRun only); HTTP-level 400 through Fiber (verified by source only); target-environment data | **gap** |

## 7. Gaps (why CONDITIONAL)

1. **No database execution.** Binding is proven with the real driver in DryRun, but no query ran against MySQL. In particular, `Customer_area_id IN (?,?)` on the joined `customers/users` query, and `ORDER BY … ASC/DESC`, have not been executed. Previously the same identifiers ran with interpolated values, so the risk is low.
2. **No HTTP-level test** of the 400 response through the Fiber handlers (source-verified pass-through only).
3. **Not committed / merged.** A review of uncommitted working-tree changes; the merged commit must be re-verified.
4. **Callers outside the inspected repositories** are unknown (§5 residual).

None of these is a remaining vulnerability on the reviewed paths, and none breaks a known valid caller.

## 8. Authorization: PARTIALLY VERIFIED (unchanged)

- **Mechanism:** gateway auth-plugin → `/api/v1/auth/verify` → `roleUseCase.CanAccess` method + path allowlist. It is not modified by this branch.
- **Missing:** target-environment `role_key` / `role_key_mapping` grants for `GET /api/v1/cms/customers/users`, `GET /api/v1/cms/customer-areas`, `PUT /api/v1/cms/customers/users/{id}/status` and `DELETE /api/v1/cms/customers/users/{id}`. Still not evidenced (F31-CA-04).

## 9. Separate Security Follow-up (not fixed here)

`mapper/cms_customer_channel.go` (`GET /api/v1/cms/customer-channels`):
- **Unchanged:** it still builds `OrderBy: spec.SortBy + " " + spec.AscDesc` and `f.Column+" "+f.Opr+" ?"`. It is the same vulnerability class, reachable by any token granted that path.
- **Callers:** used by F18 Banner, F11 Product Restriction and legacy Notification channel options.
- **Recommendation:** the same allowlist treatment, in a separate tracked change.

## 10. Decision

```text
F31 BACKEND REMEDIATION REVIEW: CONDITIONAL PASS
F31-CA-01 PASS · F31-CA-02 PASS · F31-CA-13 PASS · Compatibility PASS (all in-repo callers)
Test baseline VERIFIED · Live verification NOT PERFORMED · Authorization PARTIALLY VERIFIED
```

**F31 frontend implementation stays on HOLD** until:
1. the backend remediation is reviewed by the backend team and merged;
2. a fresh verification runs against the merged commit, ideally with one real-DB or live READ execution of `customers/users` (with a branch filter) and `customer-areas`;
3. authorization grants for the four F31 endpoints are evidenced for the intended scope.

A successful source review does not establish deployment or production authorization.

## 11. Remaining Blockers

1. Backend team review and merge of `fix/f31-cms-customer-sql-injection` (currently uncommitted).
2. Fresh verification on the merged commit: source re-check plus database / live READ execution.
3. F31-CA-04 role-grant evidence for the four endpoints.
4. Separate follow-up: `mapper/cms_customer_channel.go` SQL concatenation.
