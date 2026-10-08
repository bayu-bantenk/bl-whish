# F31 Backend Security Remediation Verification Gate

| Field | Value |
|---|---|
| Date | 2026-10-08 |
| Type | Verification only. No code, test, package, environment or data change; no live call; no exploit attempt |
| Inputs | `F31_CONTRACT_AUDIT.md`, `F31_ARCHITECTURE_READINESS.md`, `BATCH4_SCOPE_LOCK.md`, `BATCH4_SCOPE_DISCOVERY.md`, `F27_CONTRACT_AUDIT.md`, `F27_ARCHITECTURE_READINESS.md`, current backend source |
| Result | **HOLD**: F31-CA-01 NOT RESOLVED; F31-CA-04 PARTIALLY RESOLVED (audit correction, see §4) |

## 1. Scope

The gate checks whether the account-service code behind two endpoints has been remediated:
- `GET /api/v1/cms/customers/users`, for F31-CA-01 (P0 SQL injection);
- `GET /api/v1/cms/customer-areas`, for the F31-CA-04 authorization / personal-data boundary.

It also checks whether the F31 Architecture Readiness decisions remain valid. Remediation is never inferred from frontend validation.

## 2. Evidence Inspected

| Repository | State | Evidence quality |
|---|---|---|
| `gpos-b2b-account-service` | HEAD `3001bc0` (2026-09-11) = `development` = `origin/development`; working tree clean; last fetch 2026-09-14 | VERIFIED FROM SOURCE (as of the local clone) |
| Other local refs | `MPGGPO-S-23-OTP-Verification-for-e-Faktur-Access`: no diff on the F31 path vs `development`. `e-faktur-otp` and `master`: **older**, missing 48 lines on the path, so no fix there | VERIFIED FROM SOURCE |
| History on the F31 path since 2026-09-01 | `33cc048` (2026-09-07) only adds `f.Column = strings.ToUpper(f.Column[:1]) + f.Column[1:]`; `3001bc0` touches no query construction | VERIFIED FROM SOURCE |
| `gpos-b2b-api-gateway` | HEAD `fb68a8f` (2026-08-31) = `origin/development`; `krakend.gtpl`, `plugin/auth-plugin/auth-plugin.go`, `setting/endpoints.json` | VERIFIED FROM SOURCE |
| Tests | no `*_test.go` references `ToCustomerDatatableFromSpec`, `CmsGetCustomerUser` or `CmsGetPreloadBuyerList` | no test evidence |
| Live | none in this task | NOT VERIFIED |

**Freshness limit:** the remote was not fetched, since this task is read-only. A fix merged upstream after 2026-09-14 would be invisible here, so that possibility is **UNKNOWN**.

## 3. F31-CA-01 Verification

**Result: `NOT RESOLVED`** (VERIFIED FROM SOURCE, local `origin/development` @ 3001bc0).

Query path: `handler/cms_customer.go:110-131` → `usecase/cms_customer.go:77-97` → `mapper.ToCustomerDatatableFromSpec` (`mapper/cms_customer.go:13-46`) → `repository/buyer.go:180-215` (`Where(datatable.WhereStatement, …).Count(…).Order(datatable.OrderBy)…`).

| Check | Code | Verdict |
|---|---|---|
| Branch filter `IN (…)` | `statements = append(statements, f.Column+" "+f.Opr+" ("+fmt.Sprintf("%v", f.Value)+")")` (`mapper/cms_customer.go:30-31`). The raw request value is interpolated into SQL; nothing is bound | **FAIL** |
| Filter column / operator | `f.Column` (first letter upper-cased, `:28`) and `f.Opr` are concatenated verbatim; IN detection is `strings.Contains(f.Opr, "IN")` | **FAIL** |
| Sort column | `OrderBy: spec.SortBy + " " + spec.AscDesc` (`:21`); `sort_by` is a free required string (`dto/cms_customer.go:10`), with no allowlist | **FAIL** |
| Sort direction | `asc_desc` concatenated (`:21`), no enum (`dto:11`) | **FAIL** |
| `search_by` | `statements = append(statements, spec.SearchBy+" LIKE "+" ?")` (`:38-39`); the column is raw, the keyword is bound | **FAIL** (identifier); keyword PASS |
| Non-IN filters | `f.Column+" "+f.Opr+" ?"` with a bound value (`:32`): the value is safe, column and operator are raw | **FAIL** (identifier) |
| Branch-options endpoint `customer-areas` | `OrderBy: spec.SortBy + " " + spec.AscDesc` (`mapper/cms_customer_area.go:19`); filters loop at `:25` | **FAIL** (same class) |

**The vulnerable path is unchanged since the contract audit.** No backend allowlist, parameter binding or test exists. Frontend allowlists / UUID checks remain defence in depth only.

## 4. F31-CA-04 Verification

**Result: `PARTIALLY RESOLVED`.** This is **not** a backend remediation. It corrects the audit's description of the boundary.

**Authorization path:**

| Step | Evidence |
|---|---|
| 1. Gateway applies `auth-plugin` to every `public` path of each service | `krakend.gtpl:276-291` |
| 2. `GET /api/v1/cms/customers/users`, its `DELETE` / `PUT …/status`, and `GET /api/v1/cms/customer-areas` are in `account_service.public` | `setting/endpoints.json:42-46` |
| 3. The plugin deletes a client-supplied `X-UserId` | `auth-plugin.go:72` |
| 4. Bearer requests are sent to `GET {account_service}/api/v1/auth/verify` with `X-Path` and `X-Method` | `auth-plugin.go:75-102`; `krakend.gtpl:291` |
| 5. A non-200 verify response stops the request: 401, otherwise 403 | `auth-plugin.go:93-101` |
| 6. `authUseCase.Verify` validates the token, loads the user, then calls `roleUseCase.CanAccess(user.RoleId, spec.Path, spec.Method)` → 403 if denied | `usecase/auth.go:630-655` |
| 7. `CanAccess` normalizes the path (`/{id}`) and allows only if the role has an allowed `role_key` row for the exact method + path (**allowlist, fail-closed**) | `usecase/role.go:29-40`; `repository/role.go` `GetAccess`, `GetAllowedRoleKeyListByRoleId` (`role_key` ⋈ `role_key_mapping` with `is_allow = true`) |
| 8. The API-key path also calls `CanAccess` | `usecase/auth.go:582-628` (`:612`) |
| 9. Without a token or API key, `X-UserId` is forwarded empty → the service returns 403 | `auth-plugin.go:138`; `helper.GetUserID` |
| 10. In the service, the handlers check only that `X-UserId` is present | `handler/cms_customer.go:111`; no role check in account-service routes |

**What this proves** (VERIFIED FROM SOURCE): a **role-based, method + path allowlist** is enforced at the gateway for these endpoints. "Account-service checks only `X-UserId`" (F31 audit §14 / §16) is true of the handler, but incomplete for the request path through the gateway.

**What remains unproven:**

| Item | Status |
|---|---|
| Which roles hold `role_key` grants for `GET /api/v1/cms/customers/users`, `customer-areas`, `PUT …/status`, `DELETE …/{id}` | **NOT VERIFIED**: this is environment data. The repository `seed.sql` has no row for these CMS paths (it has `GET /api/v1/customers/users`, buyer side, `seed.sql:1001-1007`) |
| Whether non-CMS (buyer) roles are denied on these paths | **UNKNOWN**: depends on that data; the mechanism denies by default |
| Gateway bypass (direct service access) | not in scope; the service itself does no role check |
| Decision caching | `GetAccess` caches **allow** results for 1 h in Redis, so revocation may lag by up to 1 h (minor) |

**Personal data:** the list returns email, phone, user name, customer name, address, and user / customer / org / area / channel ids (`dto/cms_customer.go:25-46`).
- Email, phone, user name, customer name and branch / channel are required by the legacy-compatible UI (`list.edge:36-46`).
- Address and internal ids are not; F31 readiness already drops them at the repository boundary.
- Whether exposure is acceptable for the roles actually granted depends on the unverified `role_key` data.

**Cross-reference (not reopening F27):** the same gateway mechanism also covers `/api/v1/cms/users/need-approvals`. The F27 live READ (2026-10-07) received 200 with the owner's CMS token: VERIFIED FROM LIVE READ for **that** role and path only. F27 documents are not changed.

## 5. SQL Construction Findings

| ID | Location | Construct | Status |
|---|---|---|---|
| F31-CA-01 | `mapper/cms_customer.go:30-31` | `IN (` + raw value + `)` | NOT RESOLVED (P0) |
| F31-CA-02 | `mapper/cms_customer.go:21, 28, 30, 32, 38`; `mapper/cms_customer_area.go:19` | raw identifiers: filter column, operator, `search_by`, `sort_by`, `asc_desc` | NOT RESOLVED (P1) |
| **F31-CA-13 (new)** | `mapper/cms_customer.go:28` | `f.Column[:1]` panics on an empty `filters[].column` (index out of range); `PanicHandler` recovers (`server/routes.go:33`, `server/middleware.go:17`), so the likely result is a 500 | NEW (P2, robustness), VERIFIED FROM SOURCE; runtime response NOT VERIFIED |

Bound parameters that are safe: the keyword in `LIKE ?`, and non-IN filter values (`?`).

## 6. Authorization Findings

| Topic | Finding | Evidence quality |
|---|---|---|
| Gateway authorization | role + method + path allowlist through `/auth/verify` → `CanAccess` | VERIFIED FROM SOURCE |
| Grants for the F31 paths | unknown (DB data, not seeded in the repo) | NOT VERIFIED |
| Service-level authorization | `X-UserId` presence only | VERIFIED FROM SOURCE |
| Effect on F31-CA-01 | exploitation needs a token whose role is granted the F31 list path, which narrows who can exploit the P0 but does **not** close it | VERIFIED FROM SOURCE (mechanism) |
| Frontend capability | `user-management.read` (design) is defence in depth and is **not** used as evidence here | — |

## 7. Frontend Impact

All F31 Architecture Readiness decisions **remain valid**; none needs to change:

| Decision | Status |
|---|---|
| Capability `user-management.read`, fail-closed (navigation, route, use case) | valid. The gateway role allowlist is complementary, not a replacement |
| Fixed sort `aam_customer_id DESC`, no sort UI, constants only | valid (CA-02 unresolved) |
| Multi-select branch filter; F31-local `/customer-areas` lookup; no filter param when empty | valid. Constant column / operator and UUID-validated values remain defence in depth only (CA-01 unresolved) |
| Strict canonical DTO (address / internal ids excluded) | valid |
| Read-only scope | valid |
| Readiness §4 / §16 wording that "account-service checks only `X-UserId`" | **factually incomplete**. Corrected here (§4); the readiness and audit documents are left unchanged as historical records |

**Added constraint:** never send `filters` with an empty column. the constant filter construction in F31 readiness §8 already guarantees this (CA-13).

## 8. Implementation Readiness

**`NOT READY`**: F31 implementation stays on **HOLD** per `F31_ARCHITECTURE_READINESS.md` §18. F31-CA-01 is unresolved, and there is no written risk acceptance by an authorized owner in `cms/`.

## 9. Production Exposure

**`BLOCKED`.**
- The P0 is unresolved.
- Role grants for the F31 paths are unverified.

## 10. Final Decision

```text
F31 BACKEND SECURITY REMEDIATION GATE: HOLD
F31-CA-01: NOT RESOLVED        (VERIFIED FROM SOURCE)
F31-CA-04: PARTIALLY RESOLVED  (gateway role allowlist VERIFIED FROM SOURCE; F31 path grants NOT VERIFIED)
Implementation: NOT READY · Production: BLOCKED
```

## 11. Remaining Blockers

1. **F31-CA-01 (P0):** account-service must bind the IN values (`Where("customer_area_id IN ?", ids)`) and allowlist filter columns / operators server-side.
2. **F31-CA-02 (P1):** server-side allowlists for `search_by`, `sort_by` and `asc_desc`, on both `customers/users` and `customer-areas`.
3. **F31-CA-04 (remaining part):** evidence of which roles hold `role_key` grants for `GET /api/v1/cms/customers/users` and `GET /api/v1/cms/customer-areas` in the target environment, and confirmation that buyer roles are denied.
4. **F31-CA-13 (P2):** guard against an empty `filters[].column` (robustness).
5. **Clone freshness:** re-check against an up-to-date `origin/development` (fetch by the owner) before declaring any of the above resolved.

## 12. Exact Next Action

1. **Backend team:** remediate F31-CA-01 / CA-02 / CA-13 in `mapper/cms_customer.go`:
   - IN values bound as parameters;
   - fixed column map for filters (e.g. `branch → customer_area_id`);
   - `search_by` ∈ {`customer.name`, `user.email`};
   - `sort_by` ∈ {`aam_customer_id`} and `asc_desc` ∈ {`asc`, `desc`}.

   Apply the same treatment to `mapper/cms_customer_area.go`, and add unit tests that prove hostile values are rejected or bound.
2. **Owner / platform:** export, without secrets, the `role_key` / `role_key_mapping` rows for the four F31 paths (method, path, role name, `is_allow`) as CA-04 evidence.
3. **Rerun this gate** against the updated source (owner fetch) and that evidence:
   - if CA-01 is resolved → readiness can move to **CONDITIONAL** or **READY**;
   - otherwise → stays **HOLD**.

   Alternatively, a written, authorized risk acceptance recorded in `cms/` lifts only the implementation HOLD; production stays blocked.
