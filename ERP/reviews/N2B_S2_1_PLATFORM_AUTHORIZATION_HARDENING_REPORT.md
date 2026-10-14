# N-2B S2.1 — Platform Route Authorization Hardening: Report

**Date:** 2026-10-14
**Scope:** close condition B-5 from S2 (platform routes authorized by permissions that `*.*.*` satisfies). Also investigate two reported defects: auth-contract token minting (`subject=`) and the seed permission lookup ignoring `module_name`.
**Not in scope (and not started):** S3 tenant-less-create rejection, S4 read/reference changes, schema/RLS/grants, the 269 unpinned form versions, capability changes, cleanup.
**Inputs:** `N2B_S2_PLATFORM_PRINCIPAL_AND_E2E_FIXTURE_REPORT.md` (§8 condition 1), `N2B_APPLICATION_OWNERSHIP_HARDENING_PLAN.md` (B-5).
**Verdict:** **CONDITIONAL GO** (§10).

---

## Executive Summary

- **Which routes count as platform-only.** I inventoried all 13 core routers (114 routes) plus the module-mounted routers. A route was classed platform-only only when its effect is **process-global or tenant-less**, so that one tenant's call changes or reveals state for every tenant. Exactly **11 routes** meet that test:
  - 6 module-lifecycle routes;
  - 2 event-bus dead-letter routes;
  - 3 rate-limit-rule routes.
- **What the 11 routes require now.** Each one now needs `require_platform_permission(<code>)`, a new, narrow dependency factory. It combines the existing S2 `require_platform_admin` (signed `scp=platform`) with the route's existing permission. A tenant principal is refused whatever it holds, including `*.*.*`, the superuser flag, the `superadmin` role, or an explicit `core.*.admin` grant.
- **Proof.** All of this is shown by:
  - real HTTP login and refresh on the real app;
  - the real routers with real signed JWTs;
  - a live run against the local backend and test DB;
  - Playwright **137/137**.
- **Ambiguous routes are unchanged.** Every route whose classification is ambiguous was left alone and is listed for review (§2.3).
  - Most notably, the S2 business guard does not cover the **core tenant-data routers**, such as metadata, dashboards, the workflow registry and the scheduler. A platform principal can still reach them. This is recorded as condition C-2, not changed.
- **Defect A (token minting) is real but unreachable in-repo.**
  - `CoreAuthServiceImpl.authenticate` and `.refresh_token` raise `TypeError` before any token exists.
  - No in-repo code calls them, and HTTP login and refresh are unaffected.
  - **It is pinned, not fixed.** Simply renaming the argument would bring alive a refresh path that skips the active-user re-check that `/auth/refresh` performs, which is the N7 incident class. A fix design needs approval (§4.A).
- **Defect B (seed permission lookup) is a latent identity mismatch.**
  - `auth.permissions` is unique on `(resource, action, scope)`, while the authorization identity is `module_name.resource.action`.
  - **The seed now refuses** to reuse another module's row instead of silently granting it.
  - **The production half is a schema matter:** `module_name` is missing from the unique key. It is reported, not changed (§4.B).
  - There are no collisions today: 65 permission codes in code, 0 cross-module `(resource, action)` collisions.

---

## 1. Audit Method

1. I read every router mounted in `app/api/v1/__init__.py`, plus the module routers (`app/modules/*/api`, `external_modules/*/api`).
2. For each route I recorded the method, path, auth dependency, the service it calls, and whether that service's state is **tenant-scoped** or **process-global / tenant-less**.
3. To decide tenant-scoping I checked:
   - the model's `tenant_id` column;
   - the RLS table lists in `alembic/versions/f8a2e3b1c9d7_…`, `96f77be121c8_…` and `2dc44c64c03d_…`;
   - whether the state lives in memory on `runtime_engine`.
4. I ran an AST scan over `app/`, `external_modules/` and `scripts/` for every call to `install`, `activate`, `deactivate`, `reload`, `uninstall`, `install_all`, `activate_all`, `clear_dead_letters`, `create_rule` and `delete_rule`, to find **alternate entry points**.
5. I ran an AST scan for every `require_permission("….admin")` to find wildcard-satisfiable admin gates.
6. A `/platform` URL prefix was **not** relied on; none exists anyway.

**Why `*.*.*` mattered.** `RBACEngine._matches_any` (`app/core/auth/rbac.py:91-101`) returns True for any code when `*.*.*` is granted. Login grants `*.*.*` to **every** superuser (`app/api/v1/auth.py:65-66`), with or without a tenant. Before this phase, every `require_permission("core.X.admin")` therefore admitted a tenant superuser.

---

## 2. Platform Route Inventory

Prefix: `/api/v1`. "Before" means the state at the end of S2.

**Expected principal values:**
- **P:** platform principal;
- **T:** tenant principal;
- **any:** any authenticated caller;
- **none:** unauthenticated.

### 2.1 Confirmed platform-only, hardened in S2.1 (11 routes)

| # | Method + path | Handler (file) | Service entry point | Why platform-only | Before | After | Test coverage |
|---|---|---|---|---|---|---|---|
| 1 | `GET /modules/{name}/diagnostics` | `module_diagnostics` (`api/v1/modules.py`) | `ModuleDiagnostics.diagnose` | process-wide lifecycle / contract registry internals ("admin/ops use only") | `require_permission("core.modules.admin")`, wildcard-satisfiable | `require_platform_permission("core.modules.admin")` | U, I, L |
| 2 | `POST /modules/{name}/install` | `install_module` | `lifecycle.install` | one module state for the whole process / all tenants | same | same | U, I |
| 3 | `POST /modules/{name}/activate` | `activate_module` | `lifecycle.activate` | same | same | same | U, I, L, PW |
| 4 | `POST /modules/{name}/deactivate` | `deactivate_module` | `lifecycle.deactivate` | same; withdraws capabilities for every tenant | same | same | U, I, PW |
| 5 | `POST /modules/{name}/reload` | `reload_module` | `lifecycle.reload` | same | same | same | U, I |
| 6 | `DELETE /modules/{name}` | `uninstall_module` | `lifecycle.uninstall` | same | same | same | U, I |
| 7 | `GET /system/events/dead-letters` | `dead_letters` (`api/v1/system.py`) | `event_bus.get_dead_letters` | **in-memory**, process-wide, unfiltered, so it exposes every tenant's event payloads | `require_permission("core.system.admin")` | `require_platform_permission("core.system.admin")` | U, I, L |
| 8 | `DELETE /system/events/dead-letters` | `clear_dead_letters` | `event_bus.clear_dead_letters` | wipes every tenant's dead letters | same | same | U, I |
| 9 | `GET /gateway/rate-limits` | `list_rate_limits` (`api/v1/gateway.py`) | `GatewayService.list_rules` | `gateway.rate_limit_rules` has **no `tenant_id`** and no RLS; rules are global | `require_permission("core.gateway.admin")` | `require_platform_permission("core.gateway.admin")` | U, I, L |
| 10 | `POST /gateway/rate-limits` | `create_rate_limit` | `GatewayService.create_rule` | one tenant could create a `scope="tenant"`/`"global"` rule that throttles **other** tenants | same | same | U, I, `test_gateway.py` |
| 11 | `DELETE /gateway/rate-limits/{id}` | `delete_rate_limit` | `GatewayService.delete_rule` | deletes a global rule by id | same | same | U, I, `test_gateway.py` |

**Coverage key:**
- **U:** `tests/unit/test_n2b_s2_1_platform_authorization.py` (real routers, real signed JWTs);
- **I:** `tests/integration/test_n2b_s2_1_platform_routes_login.py` (real login and refresh, real app, SQLite);
- **L:** live check against the running backend and local test DB (§6.3);
- **PW:** Playwright (`dynamic-module`, `form-sales-customer-proof` SC3, and the four leave/probe-dependent suites through setup).

### 2.2 Not platform-only, unchanged (tenant-scoped data or per-user)

| Router | Routes | Auth | Data | Classification |
|---|---|---|---|---|
| `auth` | 3 (`/token`, `/refresh`, `/me`) | none / none / any | users | identity issuance |
| `gateway` keys | 4 (`/keys` GET/POST, `/keys/{id}` GET/DELETE) | `get_current_user` | `gateway.api_keys` (RLS, per-user) | per-user, tenant |
| `audit` | 2 | `core.audit.read` | `audit.audit_logs` (RLS) | tenant |
| `notifications` | 4 | `get_current_user` | `notification.notifications` (RLS) | per-user, tenant |
| `dashboard` | 14 | `get_current_user` / `core.dashboard.manage` | `dashboard.*` (RLS) | tenant |
| `metadata` | 26 | `core.metadata.read` / `.manage` | `metadata.*` (RLS) | tenant |
| `workflow` | 9 | `core.workflow.*` | `workflow.wf_*` (RLS) | tenant (Workflow-engine risk, untouched) |
| `workflow-registry` | 18 | `core.workflow.read` / `.manage` | `workflow.wf_registry_*` (RLS, 3.0H) | tenant |
| S2 business routers (Sales, HR, Accounting, Inventory, Leave, probe, Studio, Form Platform ×2, Capabilities, Application Flow, Worklist) | 147 method/route pairs | `reject_platform_principal` + RBAC | tenant (S1 ownership) | tenant business, unchanged |

### 2.3 Ambiguous: documented, changes stopped pending review

| Route(s) | Current auth | Why ambiguous | Effect of leaving it |
|---|---|---|---|
| `GET /modules/`, `/modules/{name}`, `/modules/{name}/health`, `/modules/lifecycle/history` (`core.modules.read`) | tenant- and platform-readable | Process-global state, but **every** shell user needs `GET /modules/` at boot (`RuntimeEngine.ts:141`). The history (`lifecycle.audit_history`) may include actor identifiers across tenants. | Read-only; no change. History visibility to tenants needs a product decision. |
| `GET /modules/health` | `core.modules.read` | Shadowed by `/{module_name}` (finding F-3, §5); unreachable | none |
| `GET /system/status`, `/system/permissions`, `/system/services` (`core.system.read`) | wildcard-satisfiable | Process-wide runtime info (engine status, permission catalog, service registry). Read-only, but platform internals. | A tenant superuser can read runtime internals. |
| `GET /gateway/metrics/summary` (`core.gateway.admin`) | wildcard-satisfiable | `gateway.gateway_metrics` is tenant-scoped under RLS (3.0H). Under a tenant session it aggregates that tenant's rows plus NULL-tenant rows, so it could be a tenant-admin view or a platform view. | Pinned by `test_no_route_anywhere_authorizes_a_platform_admin_code_by_permission_alone` as the **only** remaining `require_permission("*.admin")`. |
| `GET /ws/stats` | **unauthenticated** (explicit: "no auth required for health monitoring") | Deliberate monitoring endpoint; process-wide connection counts | Pre-existing; reported only. |
| `GET /health/live`, `/health/ready`, `/health/` | unauthenticated | Probes. The deep check returns app name, version, environment and component status. | Pre-existing; reported only. |
| `scheduler` (9 routes; `GET /scheduler/status`, `POST /scheduler/jobs/{id}/trigger`) | `core.scheduler.read` / `.manage` | Jobs are tenant rows (RLS), but run in the shared runner; `status` is process-wide | Unchanged. |
| Core tenant-data routers in §2.2 (metadata, dashboard, workflow-registry, scheduler, audit, notifications, gateway keys) **for a platform principal** | not guarded by `reject_platform_principal` | S2 guarded the business routers it listed. These core tenant-data routers were not in that list, so a tenant-less platform principal still reaches them with no tenant context. | **Condition C-2.** Not changed: it is a business-route question (and overlaps S3 tenant-less creates), not platform hardening. |

### 2.4 Alternate entry points

The AST scan (pinned by `test_platform_mutations_have_no_alternate_entry_point`) found these callers:

| Caller | Mutation | Principal | Verdict |
|---|---|---|---|
| `app/api/v1/modules.py` | lifecycle install/activate/deactivate/reload/uninstall | HTTP, now platform-only | hardened |
| `app/api/v1/system.py`, `app/api/v1/gateway.py` | `clear_dead_letters`, `create_rule`, `delete_rule` | HTTP, now platform-only | hardened |
| `app/core/runtime/engine.py:227,232` | `install_all`, `activate_all` | process startup, no request principal | not an HTTP entry point |
| `app/core/module_system/lifecycle.py` | internal `self.install/activate/deactivate` (reload, dependency cascades) | reached only through the above | internal |
| `app/modules/workflow_studio/publishing/stages.py:220` | `gateway.activate(version)` | Studio publish (tenant Registry version) | **not** a platform op; S1-guarded |
| `app/modules/workflow_studio/extension/{service,registry}.py` | Studio plugin `activate/deactivate` | **no HTTP caller** (`test_studio_plugin_activation_is_not_reachable_over_http`) | in-process only |

There is **no other HTTP route, websocket handler or module router** that reaches a platform mutation. Of the permission codes enforced in code, none in a module router ends in `.admin`.

---

## 3. Implementation

### 3.1 Mechanism (reuses S2; no new signing, claim or secret)

`app/core/auth/dependencies.py` gains a dependency factory:

```python
def require_platform_permission(permission_code: str):
    async def _check(user: UserContext = Depends(require_platform_admin)) -> UserContext:
        if not user.has_permission(permission_code):
            raise HTTPException(403, f"Permission denied: '{permission_code}' required.")
        return user
    return _check
```

- **The platform gate is S2's `require_platform_admin`, unchanged.** Platform authority comes only from the signed `scp=platform` claim, read only after signature, expiry and type verification. `platform` together with a `tid` gives 401.
- **The permission is kept** so the existing RBAC gate still applies to platform users. A platform token without `core.modules.admin` gets 403 (`test_platform_principal_still_needs_the_operation_permission`). A platform user is a tenant-less superuser and receives `*.*.*` at login, so this is satisfied in practice.
- **Deliberately not created:**
  - a `platform.admin` permission, which `*.*.*` would satisfy (the reason S2 dropped it);
  - a role-name or superuser-flag check;
  - a `/platform` prefix.
- **No tenant is selected or impersonated.** The platform handlers read process state or tenant-less tables; none of them sets a tenant context.

### 3.2 Before / after authorization behaviour (the 11 routes)

| Caller | Before (S2) | After (S2.1) |
|---|---|---|
| Signed platform principal (`scp=platform`, no `tid`, `*.*.*`) | allowed | **allowed** |
| Platform principal without the operation permission | 403 | 403 |
| Tenant superuser (`tid`, `*.*.*`) | **allowed** (the gap) | **403** "Platform administrator principal required." |
| Tenant user explicitly granted `core.modules.admin` / `core.system.admin` / `core.gateway.admin` | **allowed** | **403** |
| Tenant-less non-platform token (scope tenant) | allowed if it had the permission | **403** |
| Pre-S2 token without `scp`; `scp` in the wrong case or as a list | allowed with `*.*.*` | **403** (parsed as tenant) |
| No token / garbage / forged signature / refresh token used as access / platform + `tid` | 401 | 401 |

Non-platform behaviour is unchanged:
- `GET /modules/` and `/modules/lifecycle/history` stay readable by tenant users with `core.modules.read`;
- tenant business routes keep RBAC and S1 ownership;
- `/gateway/keys` and `/gateway/metrics/summary` are untouched.

### 3.3 Compatibility consequence

- In the local test DB, `admin` is a superuser **with** tenant `demo` (set outside any code; S2 report §7), so it is a tenant principal and **now gets 403 on module lifecycle** (verified live, §6.3). The E2E platform operations now use the dedicated platform principal `phase_s2_platform_admin` (seeded in S2).
- A freshly seeded `admin` (tenant-less, from `scripts/db.py`) is a platform principal and keeps module management.
- The Modules admin page (`/admin/modules`) therefore needs a platform login for writes. **This needs a release note.**

---

## 4. Defect Investigations

### 4.A Auth-contract token minting (`subject=`)

| Question | Finding | Evidence |
|---|---|---|
| Where | `app/contracts/auth/impl.py:89,95` (`authenticate`) and `:147,148` (`refresh_token`) call `create_access_token(subject=…)` / `create_refresh_token(subject=…)`. `JWTService` accepts keyword-only `user_id` (`app/core/auth/jwt.py:47-56, 81-86`). | AST guard `test_every_mint_call_site_binds_to_the_real_signature_except_the_pinned_contract_sites`: exactly these 4 sites fail to bind; every other site binds. |
| Runtime error with the installed libraries? | **Yes:** `TypeError: JWTService.create_access_token() got an unexpected keyword argument 'subject'`. It comes from the project's own `JWTService` signature, not PyJWT (installed: PyJWT 2.10.1). It is raised **before** any token exists. | Reproduced through the real call path: `CoreAuthServiceImpl().refresh_token(<valid refresh token>)` (`test_the_contract_refresh_path_fails_closed_and_issues_no_token`). |
| Reachable? | Registered at startup as the `AuthServiceContractV1` implementation (`app/core/runtime/engine.py:490-506`), so discoverable through service discovery. **No in-repo caller:** no module, script or route calls `.authenticate(` / `.refresh_token(` on it. | `test_no_in_repo_caller_reaches_the_contract_mint_paths`; `rg` across `app/`, `external_modules/`, `scripts/`, `tests/` (only `test_contract_system.py` checks its abstract surface). |
| Login / refresh impacted? | **No.** `POST /auth/token` (`login`) and `POST /auth/refresh` (`refresh`) in `app/api/v1/auth.py` mint with `user_id=` and are the supported paths. `/refresh` mints an access token only; it does not rotate the refresh token. | Same AST guard (login: access + refresh; refresh: access). Real HTTP: `test_n2b_s2_login_principal_scope.py` (3) and `test_n2b_s2_1_platform_routes_login.py::test_platform_principal_from_real_login_and_refresh_…`. |
| Did existing tests cover the real path? | The HTTP paths, yes (S2). The contract path, **no**: only its abstract method names were checked. | — |

**Why it is not fixed.** Renaming `subject=` to `user_id=` would turn a fail-closed crash into a working, divergent issuance path:
1. **`refresh_token` would skip the user check.** It would mint from the refresh token **without** checking that the user still exists and is active. `/auth/refresh` deliberately re-derives this from the DB ("a deactivated user … must take effect on the very next refresh"). This is the N7 privilege-escalation class.
2. **The tenant would be dropped.** It would drop `tid`, minting tenant-less tokens: the legacy shape S3 is about to restrict.
3. **The identity would differ from HTTP login.** `authenticate` would use `sub = user.id` (UUID), while HTTP login uses `sub = username`. It would also produce `roles=[]`, because `User` has no `roles` attribute (`hasattr` is false), and it never derives a principal scope.

**Proposed fix, awaiting approval.** Make the contract delegate to the same user lookup and claim derivation the HTTP routes use (`_load_role_names_and_permissions`, `_principal_scope`, active/deleted check, `sub = username`, `tid` from the row). Alternatively, if no consumer is planned, remove `authenticate` / `refresh_token` from the v1 contract. Either option changes a contract surface and is outside "do not change unrelated token claims"; it is left for review. The regression tests **pin** the current fail-closed behaviour and say so. They are not presented as a fix.

### 4.B Seed permission lookup ignoring `module_name`

| Question | Finding | Evidence |
|---|---|---|
| Identity rules | Login derives each permission code as `f"{perm.module_name or '*'}.{perm.resource}.{perm.action}"` (`app/api/v1/auth.py:72`). The runtime `PermissionRegistry` keys by the same code. **The authorization identity is `module.resource.action`.** | `test_the_token_code_login_derives_is_module_qualified` |
| DB identity | `auth.permissions` is unique on `(resource, action, scope)` (`uq_permission_resource_action_scope`, `c89c94f25c8b_foundation_schemas.py:342`; model `app/core/auth/models.py:248`). **`module_name` is not part of it.** | — |
| Can identifiers collide across modules? | **Yes, in principle.** Two modules declaring the same `resource.action` (e.g. `inventory.items.read` and `external_boundary_probe.items.read`) map to one DB row. **Today: no collision.** I checked 65 codes enforced in code and every `module.json`, finding 0 cross-module `(resource, action)` pairs; the local DB's 34 rows all carry the expected `module_name`. | AST/grep scan in §6.1; read-only `SELECT module_name, resource, action, scope FROM auth.permissions`. |
| Could the old lookup assign the wrong privilege? | **Yes, latently.** `scripts/seed_worklist_e2e.py` looked up by `(resource, action, scope)` only and reused whatever row came back. With a collision, a role meant for module A would have been granted **module B's** permission silently (the token would carry `B.items.read`). | `test_row_of_another_module_with_the_same_resource_action_is_refused_not_reused` |
| Seed-only or production? | The **lookup** is seed-only: `seed_worklist_e2e.py` is the only code that creates `auth.permissions` rows (`scripts/db.py` seeds wildcard-granted superusers, not permission rows). Production authorization is **consistent with whatever row exists**, because login reads `module_name` from the row. The **production half is the DB constraint**: a second module's same-named permission is unrepresentable, and any future writer that keys on `(resource, action)` would repeat the bug. | — |

**Fix applied (seed only; no production semantics changed).** `_get_or_create_permission` (`scripts/seed_worklist_e2e.py`) still finds the row by the DB key, but:
- if the row's `module_name` differs, it raises `PermissionIdentityConflict`;
- it never reuses another module's row;
- new rows are created with their `module_name`.

The seed ran cleanly against the local test DB with the check active (§6.3).

**Proposed, needs approval (schema): not done.** Add `module_name` to the unique key, i.e. `(module_name, resource, action, scope)`, through a migration. That is a schema change and is forbidden in this phase.

---

## 5. Side Findings (disclosed, not fixed)

| # | Finding | Evidence | Disposition |
|---|---|---|---|
| F-1 | `MagicMock` users in `tests/unit/test_gateway.py` satisfied every scope or permission check **vacuously**: `MagicMock().has_permission(...)` and `.is_platform_principal` are truthy. | Inspection | **Fixed in-test:** a real `UserContext(principal_scope=PLATFORM)`; 44 passed. |
| F-2 | Before S2.1, a tenant superuser could deactivate Sales and so withdraw `sales.customer.create` for **every** tenant. | `form-sales-customer-proof` SC3 shows the global effect | Closed by #4. |
| F-3 | `GET /modules/health` is unreachable: `/{module_name}` is declared first, so it answers `404 "Module 'health' not found"`. | Verified with the real router (2026-10-14) | Pre-existing route-order bug; reported only. |
| F-4 | `GET /ws/stats` is unauthenticated by design; the deep health check reveals environment/version. | `app/api/v1/ws.py:140`, `health.py:38` | Reported (§2.3). |
| F-5 | The new unit file initially used `asyncio.run()` in sync tests. That cleared the thread's event loop, and the next full run had **1,141 failed** later async tests ("There is no current event loop in thread 'MainThread'"). | `s21_unit.txt` | **Fixed:** converted to `pytest.mark.asyncio`; full rerun **3,862 passed**. |

---

## 6. Tests and Results

### 6.1 Tests added or changed

- **`tests/unit/test_n2b_s2_1_platform_authorization.py`, 40 tests (new).** Static checks are AST-only; no module router or ORM model is imported at collection time.
  - **Static inventory:**
    - each of the 11 routes uses `require_platform_permission(<code>)` and no `require_permission` (11);
    - no other route anywhere authorizes a `*.admin` code by permission alone (only gateway metrics remains, pinned);
    - there is no alternate entry point;
    - the Studio plugin activation has no HTTP caller.
  - **Behaviour** (real `modules`/`system`/`gateway` routers, real signed JWTs, fake process-global lifecycle and event bus):
    - the platform principal activates, deactivates, reloads and uninstalls (each recorded) and reads/clears dead letters;
    - the platform principal without the permission gets 403;
    - six refused tenant token kinds × 11 routes give 403 with **no mutation recorded**;
    - tenant module reads stay 200;
    - five invalid principal kinds × 11 routes give 401.
  - **Defect A:** the call-site signature guard (pins exactly the 4 contract sites, and checks that login and refresh bind); the contract `refresh_token` real call path raises `TypeError` and issues no token (**pin**); no in-repo caller.
  - **Defect B:**
    - same-module row reused;
    - other-module row refused, nothing added;
    - missing row created with its `module_name`;
    - login code is module-qualified;
    - the seed list has no internal key collision.
- **`tests/integration/test_n2b_s2_1_platform_routes_login.py`, 3 tests (new).** Real `/auth/token` and `/auth/refresh` on the real `app.main` stack:
  - the platform principal passes authorization on all 11 routes, with both the login **and** the refreshed token, and reads dead letters with 200;
  - a tenant superuser with `*.*.*`, a plain tenant user and a tenant-less user get 403 on all 11, and the tenant superuser keeps `/modules/` and `/capabilities`;
  - no token or a garbage token gives 401 on all 11.
  - Limitation: this tier never initialises the module lifecycle manager, so a platform call that passes authorization ends at the handler's 503. Real lifecycle success is shown live and in Playwright.
- **`tests/unit/test_gateway.py`:** a real platform `UserContext` instead of `MagicMock` (F-1).

### 6.2 Commands and results (backend: `cd backend && .venv/bin/pytest -p no:cacheprovider -q …`)

| Command | Result |
|---|---|
| `tests/unit/test_n2b_s2_1_platform_authorization.py tests/unit/test_n2b_s2_platform_principal.py tests/unit/test_gateway.py` | **133 passed** (40 + 49 + 44) |
| `tests/integration --ignore=tests/integration/workflow --ignore=tests/integration/workflow_postgres` | **13 passed** (10 + 3 new) |
| `tests/integration/workflow` (SQLite) | **172 passed, 5 skipped** (the same pre-existing static skips) |
| PG, **one invocation**, the 26 non-Sales/Accounting files in `tests/integration/workflow_postgres/`, including S1's `test_n2b_s1_strict_mutation_ownership.py` and S2's `test_n2b_s2_platform_principal_http.py` | **323 passed, 1 xfailed.** The xfail is the S5 DB-layer N-2 case and remains an expected failure, **not** a fix. |
| PG Sales/Accounting, **one file per invocation** (8 files) | **38 passed** (7, 4, 2, 4, 7, 2, 4, 8) |
| `tests/unit --ignore=tests/unit/test_engine_execution.py`, first run | **1,141 failed, 2,721 passed**, all from F-5 (my test) |
| same, after the F-5 fix | **3,862 passed** (3,822 at S2 + 40) |

**Mutation check (6/6 detected; each file restored from a byte copy and re-verified):**

| # | Mutation | Failing tests |
|---|---|---|
| M1 | `activate_module` back to `require_permission("core.modules.admin")` | 8 |
| M2 | `require_platform_permission` depends on `get_current_user` (platform-scope gate dropped) | 6 |
| M3 | platform-permission check dropped | 1 |
| M4 | `create_rate_limit` guarded by `get_current_user` only | 7 |
| M5 | seed identity check dropped (`elif False`) | 1 |
| M6 | lenient `scp` parsing (case-insensitive / list) | 2 |

### 6.3 Live environment and Playwright (local test DB `erp_platform` only)

**Setup:**
- `.venv/bin/python scripts/seed_worklist_e2e.py`: exit 0, with the new identity check active.
- Backend: `MODULES_PATH=app/modules,external_modules RATE_LIMIT_REQUESTS=5000 WORKFLOW_FOUNDATION_DEFINITION_CODES=e2e_p30a_execute_demo .venv/bin/uvicorn app.main:app --port 8000`.
- Frontend: `npm run dev`.

**Live check (tokens were never printed):**

| Caller | Request | Result |
|---|---|---|
| `admin` (scope `tenant`, tenant `demo`, `*.*.*`) | `POST /modules/leave_management/activate` | **403** "Platform administrator principal required." |
| `admin` | `GET /system/events/dead-letters` | **403** |
| `admin` | `GET /gateway/rate-limits` | **403** |
| `admin` | `GET /modules/sales/diagnostics` | **403** |
| `admin` | `GET /modules/` | 200 |
| `phase_s2_platform_admin` | activate `leave_management` | **202** |
| `phase_s2_platform_admin` | activate `external_boundary_probe` | **202** |
| `phase_s2_platform_admin` | dead letters | 200 |
| `phase_s2_platform_admin` | rate limits | 200 (`[]`) |
| `phase_s2_platform_admin` | diagnostics | 200 |

**Playwright** (`frontend/shell`, `npx playwright test --reporter=line`): **137 passed (3.0 min)**, 0 failed, 0 skipped, 0 flaky.
- Platform operations now run as the platform principal: `dynamic-module` deactivate/re-activate; `form-sales-customer-proof` SC3 Sales deactivate/re-activate; `multi-module-runtime` module list.
- `studio-tenant-ownership` takes its platform branch (403).

**Afterwards:**
- Leave and the probe module deactivated as the platform principal (202, 202). Final module states: accounting active, sales active, external_boundary_probe inactive, leave_management inactive.
- Rate-limit rules: 0 before and after.
- Global Studio rows: **596 workspaces / 592 drafts / 0 templates** before and after.
- Servers stopped.

**NOT RUN:**
- `tests/unit/test_engine_execution.py` (known event-loop poisoning; excluded by programme rule);
- the whole `tests/integration/workflow_postgres` directory in **one** invocation (the Sales/Accounting files must run one per invocation);
- Vitest (no `frontend/shell/src` file changed);
- any check against the Docker `erp_postgres` database or any non-test database.

---

## 7. S1 and S2 Remain Intact

- **S1 ownership:**
  - no S1 loader, `load_owned`, `owned_by` or `TenantRequiredError` mapping was touched;
  - `test_n2b_s1_strict_mutation_ownership.py` and `test_n2b_s1_ownership_architecture.py` pass inside the PG run and the full unit run;
  - no S1 check was disabled for E2E; global Studio rows are unchanged.
- **S2 principal separation:**
  - `get_current_user` scope parsing, `require_platform_admin`, `reject_platform_principal`, `_principal_scope` and `create_access_token`'s minting guards are unchanged;
  - `test_n2b_s2_platform_principal.py` (49), `test_n2b_s2_login_principal_scope.py` (3) and the PG sweep `test_n2b_s2_platform_principal_http.py` (147 method/route pairs, all 403 for a platform token) pass;
  - M6 shows the new tests also detect a weakened `scp` parse.

---

## 8. Remaining Risks

- **Studio template ownership (B-3): unresolved.** Templates are always created global, so no tenant can update or delete them (404 under S1). It was not "resolved" by allowing global mutation.
- **Workflow engine (`engine.py`, `resolver.py`):** the global-admitting `x.tenant_id is not None and x.tenant_id != tenant` idiom is still present, pinned by the S1 architecture test, and **not** fixed.
- **Core tenant-data routers are open to platform principals (C-2).**
  - A tenant-less platform principal is not rejected by metadata, dashboards, the workflow registry, the scheduler, audit, notifications or gateway keys, and acts there without a tenant.
  - Under the shared RLS policy, rows it creates there would be global. This overlaps S3.
- **Ambiguous platform-flavoured reads (§2.3):** `core.system.read` routes and `gateway/metrics/summary` are still wildcard-satisfiable by a tenant superuser. Lifecycle history is visible to tenant readers.
- **Contract auth path (§4.A):** dormant, broken, and divergent from HTTP auth. Harmless only while it stays uncalled.
- **Permission identity at the schema level (§4.B):** a future same-named cross-module permission cannot be stored.

---

## 9. Forbidden Scope: Confirmation

- **S3 not started:** there is no tenant-less-create rejection, and `require_tenant_context` is still applied to no route.
- **No read or reference behaviour changed;** no S4 work.
- **No database changes:** no schema, migration, RLS or grant change, and no production data touched. The local test DB received only the idempotent E2E seed (no new rows; all existed), Playwright tenant-A rows (21 new tenant-owned workspaces; 1,087 → 1,108 total) and temporary module activation, since restored.
- **No tenant impersonation** or implicit tenant selection.
- **Studio template ownership** was not resolved by allowing global mutations.
- **The Workflow engine issue is not claimed fixed.**
- **Untouched:** capability contracts, fingerprints, snapshots and the 269 unpinned form versions.
- **No E2E or global data cleaned up.**
- **No commit, no push**, and Git remotes are unchanged.

---

## 10. Verdict: **CONDITIONAL GO**

**What is achieved:**
- Every endpoint confirmed platform-only now requires a signed platform principal.
- The `*.*.*` wildcard, the superuser flag and role names no longer confer platform authority on any of them.
- There is no alternate entry point.
- All of this is proven by real login/refresh HTTP, real routers with signed tokens, a live run and the full Playwright suite.

**Why not GO:**
- **C-1:** the ambiguous routes in §2.3 still need classification. Most importantly, `core.system.read` and gateway metrics are still wildcard-satisfiable.
- **C-2:** core tenant-data routers are not closed to platform principals.
- **C-3:** both defects need approved follow-ups. Defect A needs a contract fix design (it is pinned, not fixed). Defect B needs a schema decision; only the seed half is fixed.
- **C-4:** module administration is now unavailable to the local tenant-carrying `admin`. This needs a release note.

**Why not NO-GO:** no platform-only operation remains reachable by a tenant principal; S1 and S2 are intact; and every test tier that was run passed.

---

## 11. Files Changed (S2.1)

**Backend:**
- `app/core/auth/dependencies.py`: `require_platform_permission` (new factory).
- `app/api/v1/modules.py`: 6 routes; docstring and section comment.
- `app/api/v1/system.py`: 2 routes.
- `app/api/v1/gateway.py`: 3 rate-limit routes (metrics unchanged).
- `scripts/seed_worklist_e2e.py`: `_get_or_create_permission`, `PermissionIdentityConflict`.
- `tests/unit/test_n2b_s2_1_platform_authorization.py` (new, 40).
- `tests/integration/test_n2b_s2_1_platform_routes_login.py` (new, 3).
- `tests/unit/test_gateway.py`: real platform `UserContext` (F-1).

**Frontend (`frontend/shell/e2e/`):**
- `fixtures/users.ts`: `PLATFORM_ADMIN` is now `phase_s2_platform_admin`; `PLATFORM_PRINCIPAL` is an alias of it.
- `tests/form-sales-customer-proof.spec.ts`: SC3 module toggle as the platform principal.
- Header run instructions only: `form-lifecycle-proof`, `form-runtime-proof`, `schema-to-form-proof`, `form-builder-proof`.

**Docs:** this report.
