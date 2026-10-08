# F31 Backend Fresh Reverification

| Field | Value |
|---|---|
| Date | 2026-10-08 (fetch 16:23 WIB) |
| Type | Verification only. Remote refs fetched; no local branch reset, merge or checkout; no code, test, package, environment or data change; no live call |
| Previous gate | `F31_BACKEND_SECURITY_REMEDIATION_GATE.md` (HOLD) |
| Result | **HOLD**: no change to any F31 blocker |

## 1. Previous Commit

`gpos-b2b-account-service` `3001bc0` (2026-09-11 09:52 +0700), which was `origin/development` at the previous gate (clone fetched 2026-09-14).

## 2. Current Remote Commit

`git fetch origin` (exit 0, credentials redacted) advanced the remote-tracking refs only.

| Ref | Before | After |
|---|---|---|
| account-service `origin/development` | `3001bc0` | **`c712ba6`** (2026-10-07 22:55 +0700, "fix: remove ship_to_id not null condition in GetShipToListByCustomerId query"), 18 commits ahead |
| account-service `origin/master` | `f23a5da` | `d22d79c` |
| account-service new remote branches | — | `BE-Account-Service-Create-New-API-Get-List-Ship-To-by-Customer-ID`, `add-field-response-branch_name-in-users-need-approval`, `release/cms-sync-customer`, `release/ship-to-selection` |
| account-service local `development` | `3001bc0` | `3001bc0` (unchanged); working tree clean |
| gateway `origin/development` | `fb68a8f` | `fb68a8f` (2026-08-31), no new commits after fetch |

## 3. Files Changed

**Diff `3001bc0..c712ba6`:** 26 files, +732 / −106.

**F31 / authorization path:**

| File | Changed? | Nature of change |
|---|---|---|
| `mapper/cms_customer.go` | **no** | — |
| `mapper/cms_customer_area.go` | **no** | — |
| `handler/cms_customer.go`, `handler/cms_customer_area.go`, `dto/cms_customer.go` | **no** | — |
| `usecase/role.go`, `repository/role.go`, `helper/auth.go` | **no** | — |
| `repository/buyer.go` | yes (+16) | new `GetPreloadBuyerListExcludePJRelasi` (bound `IN ?`); `CmsGetPreloadBuyerList` unchanged |
| `usecase/cms_customer.go` | yes (+17) | `CmsUpdateUserStatus` (toggle, CONTRACT-ONLY for F31): new duplicate-phone check before activation; list use case unchanged |
| `usecase/auth.go` | yes (+34) | `Login` only (restricted PJ Relasi customers, gamification flag); `Verify` / `CanAccess` call unchanged |
| `server/routes.go` | yes (1 line) | `NewCustomerSiteUseCase` wiring; no route or middleware change |
| `seed.sql` | **no** | — |
| gateway `plugin/auth-plugin`, `krakend.gtpl`, `setting/endpoints.json` | **no** | — |

**Other remote branches:**
- `mapper/cms_customer.go` and `mapper/cms_customer_area.go` were compared against every `origin/*` branch.
- No branch contains a remediation. Most differ only by lacking the `ToUpper` line from `33cc048`, i.e. they are older.
- `origin/preprod` (2023-11-09) and three others still contain the raw `IN (` construction.

## 4. F31-CA-01

| | |
|---|---|
| Previous | NOT RESOLVED |
| **Current** | **NOT RESOLVED** (VERIFIED FROM SOURCE, `origin/development` @ c712ba6) |
| Evidence of change | **none**: `mapper/cms_customer.go` is byte-identical to `3001bc0` |

| Check | Current code (`origin/development:mapper/cms_customer.go`) | Verdict |
|---|---|---|
| IN values | `f.Column+" "+f.Opr+" ("+fmt.Sprintf("%v", f.Value)+")"` (`:30`) | FAIL: raw value becomes SQL text |
| Filter column | `strings.ToUpper(f.Column[:1]) + f.Column[1:]`, then concatenated (`:28, :30, :32`) | FAIL: no allowlist |
| Filter operator | `f.Opr` concatenated; IN detected by `strings.Contains(f.Opr, "IN")` (`:29-32`) | FAIL: no allowlist |

## 5. F31-CA-02

| | |
|---|---|
| Previous | OPEN (not resolved) |
| **Current** | **NOT RESOLVED** (VERIFIED FROM SOURCE) |
| Evidence of change | none |

| Check | Current code | Verdict |
|---|---|---|
| `search_by` | `spec.SearchBy+" LIKE "+" ?"` (`mapper/cms_customer.go:38`) | FAIL |
| `sort_by` | `OrderBy: spec.SortBy + " " + spec.AscDesc` (`:21`); `mapper/cms_customer_area.go:19` | FAIL |
| `asc_desc` | same concatenation | FAIL |
| `customer-areas` filters | `f.Column+" "+f.Opr+" ?"` (`mapper/cms_customer_area.go:26`) | FAIL (identifier / operator) |

## 6. F31-CA-04

| | |
|---|---|
| Previous | PARTIALLY RESOLVED |
| **Current** | **PARTIALLY RESOLVED** |
| Evidence of change | none in the authorization chain; role-grant evidence still unavailable |

**Authorization chain, reconfirmed against the current refs** (VERIFIED FROM SOURCE):
1. Client → gateway `fb68a8f`.
2. `auth-plugin` is applied to every `public` path (`krakend.gtpl:276-291`). The four F31 endpoints are listed (`setting/endpoints.json:42-44, 46`).
3. The plugin deletes the client `X-UserId` (`auth-plugin.go:72`).
4. `GET {account_service}/api/v1/auth/verify` is called with `X-Path` / `X-Method`.
5. `authUseCase.Verify` (`usecase/auth.go`, call unchanged in `c712ba6`) → `roleUseCase.CanAccess` (`usecase/role.go`, unchanged) → `roleRepo.GetAccess` (`repository/role.go`, unchanged). This is a fail-closed allowlist of `role_key` rows by method + path, with `is_allow = true`.

**Role-grant evidence (method, path, role name, `is_allow`):** **not available.**
- `seed.sql` is unchanged and has no rows for `/api/v1/cms/customers/users` or `/api/v1/cms/customer-areas`.
- No target-environment export has been supplied.

Therefore the status stays **PARTIALLY RESOLVED**.

## 7. F31-CA-13

| | |
|---|---|
| Previous | OPEN |
| **Current** | **NOT RESOLVED** (VERIFIED FROM SOURCE; runtime response NOT VERIFIED) |
| Evidence of change | none |

- **The panic remains:** `f.Column = strings.ToUpper(f.Column[:1]) + f.Column[1:]` (`mapper/cms_customer.go:28`) still slices an empty `filters[].column` → index-out-of-range panic.
- **Recovery is not hardening:** `PanicHandler` recovers (`server/routes.go:33`), so a 500 is the likely response. There is no guard that rejects or ignores the empty column.

## 8. Evidence

| Evidence | Quality |
|---|---|
| `git fetch origin` exit 0; ref movements in §2 | VERIFIED (local git) |
| `git diff 3001bc0 origin/development` for the files in §3 | VERIFIED FROM SOURCE |
| `git show origin/development:mapper/cms_customer.go` lines 21, 28-39 | VERIFIED FROM SOURCE |
| `git show origin/development:mapper/cms_customer_area.go` lines 19-30 | VERIFIED FROM SOURCE |
| All `origin/*` branches compared on the two mapper files | VERIFIED FROM SOURCE |
| Gateway fetch: `origin/development` still `fb68a8f`; endpoints and plugin unchanged | VERIFIED FROM SOURCE |
| Target-environment role grants | NOT VERIFIED |
| Live behaviour | NOT VERIFIED (no live call) |

**Side observations (not F31 blockers):**
- **Toggle now refuses duplicate active phones:** `CmsUpdateUserStatus` gained a duplicate-phone validation on activation. It is CONTRACT-ONLY for F31, so there is no impact.
- **Possible F27 relevance:** a new remote branch `add-field-response-branch_name-in-users-need-approval` exists. It is not merged into `origin/development` and is noted for F27 only. F27 is not reopened.

## 9. Decision

```text
F31 FRESH BACKEND REVERIFICATION: HOLD
F31-CA-01: NOT RESOLVED · F31-CA-02: NOT RESOLVED · F31-CA-04: PARTIALLY RESOLVED · F31-CA-13: NOT RESOLVED
Implementation: NOT READY · Production: BLOCKED
```

No blocker changed between `3001bc0` and `c712ba6`. `F31_ARCHITECTURE_READINESS.md` (HOLD) and its design decisions remain valid unchanged.

## 10. Remaining Blockers

1. **F31-CA-01 (P0):** bind `IN` values as parameters; allowlist filter column and operator (`mapper/cms_customer.go:28-32`).
2. **F31-CA-02 (P1):** allowlist `search_by`, `sort_by` and `asc_desc`, plus the `customer-areas` filters / sort (`mapper/cms_customer.go:21, 38`; `mapper/cms_customer_area.go:19, 26`).
3. **F31-CA-04:** a target-environment export (no secrets) of `role_key` / `role_key_mapping` rows for `GET /api/v1/cms/customers/users`, `GET /api/v1/cms/customer-areas`, `PUT /api/v1/cms/customers/users/{id}/status` and `DELETE /api/v1/cms/customers/users/{id}`, giving method, path, role name and `is_allow`.
4. **F31-CA-13 (P2):** reject or ignore an empty `filters[].column` instead of panicking.
5. **Alternative to items 1–2 for implementation only:** a written, authorized risk acceptance recorded in `cms/`. Production stays blocked until remediation.
