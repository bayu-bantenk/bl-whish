# N-2B S2 — Platform Principal Separation & Playwright Fixture Migration: Report

**Date:** 2026-10-13
**Implements:** stage **S2 only** of `N2B_APPLICATION_OWNERSHIP_HARDENING_PLAN.md`: plan items A-1 to A-4 and A-7, plus the §5 fixture migration.
**Starting status:** S1 CONDITIONAL GO (`N2B_S1_STRICT_MUTATION_OWNERSHIP_REPORT.md`).
**Provenance:** Commit: NONE · Push: NONE

```text
N-2B S2: CONDITIONAL GO
  A signed `scp` access-token claim separates PLATFORM from TENANT principals; platform scope is
  minted only for a tenant-less superuser at login/refresh, never with a tenant, never by omission.
  `require_platform_admin` = platform scope only (not *.*.*, not role names, not is_superuser).
  All 12 tenant business routers (147 method/route pairs) refuse a platform principal (403).
  Playwright: tenant-scoped Studio / operator users; `admin` only for module lifecycle;
  full suite 137/137 PASSED live (real backend + real browser + real PostgreSQL). 7/7 mutations detected.
  Conditions: module-lifecycle (platform) routes still authorize by `core.modules.admin`,
  which `*.*.*` satisfies (B-5, §8); Studio template ownership (B-3) unresolved;
  Workflow-engine ownership idiom unresolved.
```

---

## 1. Assessment (before editing)

### 1.1 Principal and tenant representations found

| Representation | Where | Before S2 |
|---|---|---|
| Access-token claims | `core/auth/jwt.py::create_access_token` (HS256, `settings.SECRET_KEY`) | `sub`, `type`, `exp`, `iat`, `roles`, `permissions`, optional `tid`. **No `iss`/`aud`** exists to preserve |
| Verification | `JWTService.decode` (signature, `exp`), `verify_access_token` (`type`) | unchanged by S2 |
| Request principal | `core/auth/dependencies.py::UserContext` | `user_id`, `tenant_id`, `roles`, `permissions`, `is_superadmin` (derived from the role-name string `superadmin`) |
| Superuser | `api/v1/auth.py::_load_role_names_and_permissions` | `is_superuser` → `roles=["superadmin"]`, `permissions=["*.*.*"]`, which satisfies **every** `require_permission`, including `core.modules.admin` |
| Tenant | `tid` claim ← `users.tenant_id`; `TenantContextMiddleware` → ContextVar | a missing `tid` means a tenant-less caller |
| Auth contract | `contracts/auth/impl.py` | `authenticate`/`refresh_token` call `create_access_token(subject=…)`, a keyword the service does not accept. **This path is already broken (pre-existing)**; it cannot mint the new scope. Not changed |
| Impersonation | `core/workflow/security/impersonation` | unreachable from HTTP (N-2A); unchanged |

### 1.2 A fact that refines S1 condition C-1

In this test database, `admin` is a **superuser with tenant `demo`**. No code path does this; the assignment was made out-of-band. A fresh `scripts/db.py` seed makes `admin` tenant-less.

The S1 report's C-1 ("Playwright Studio specs will fail until S2") therefore held for a fresh seed. For this database, the Studio rows were created as tenant `demo`.

The S2 fixtures no longer depend on how `admin` is configured (§5).

## 2. Final Principal / Scope Model

| Decision point | Rule | Code |
|---|---|---|
| **Mint** | `scp` is always written. `platform` only via `principal_scope=PLATFORM`; a platform scope **with** a tenant raises `ValueError`; `extra_claims` may not carry `scp`; unknown scopes raise | `jwt.py::create_access_token`, `PrincipalScope` |
| **Who is platform** | `is_superuser and tenant_id is None`, re-derived from the DB row on **every** login and refresh, never copied from a presented token | `api/v1/auth.py::_principal_scope` (the only minting site, AST-pinned) |
| **Parse** | read only after `verify_access_token` (signature, expiry, type). Exactly `"platform"` → platform; anything else (missing, wrong case, list, bool, trailing space) → tenant. `platform` + `tid` → **401** | `dependencies.py::get_current_user` |
| **Platform authority** | `require_platform_admin`: the platform scope **only**; `*.*.*`, `superadmin` role and `is_superadmin` do not count | `dependencies.py` |
| **Business routes** | `reject_platform_principal` as a router-level dependency → **403** "Platform principals cannot perform tenant business operations" | 12 routers (§3) |
| **Tenant context** | `require_tenant_context`: 403 for a missing or malformed `tid`, whatever the permissions. **Available; not applied to creates (S3)** | `dependencies.py` |
| **Unchanged** | RBAC (`RBACEngine` wildcard semantics), JWT signing, secret, algorithm, expiry; `is_superadmin` kept for compatibility and documented as conferring nothing | — |

**Not introduced:** implicit tenant selection, impersonation, a new signing mechanism or secret.

**Deviation from plan A-4, explained.** The plan proposed requiring an additional explicit `platform.admin` permission. It was not added:
- it would be granted from the same `is_superuser` fact the scope is minted from, so it adds no independent evidence;
- a permission-based check is exactly what `*.*.*` wildcard matching can satisfy;
- the scope is a signed claim that cannot be satisfied by any permission.

## 3. Files and Behaviour Changed

**Backend (production):**

| File | Change |
|---|---|
| `app/core/auth/jwt.py` | `PrincipalScope`; `create_access_token(principal_scope=…)` with the minting rules; `scp` always written |
| `app/core/auth/dependencies.py` | `UserContext.principal_scope`, `is_platform_principal`; scope parsing; `require_platform_admin`, `reject_platform_principal`, `require_tenant_context` |
| `app/api/v1/auth.py` | `_principal_scope(user)` used by `/token` and `/refresh`; `/me` adds `principal_scope` (additive field) |
| `app/modules/{sales,hr,accounting,inventory}/api.py`, `external_modules/{leave_management,external_boundary_probe}/api.py`, `app/modules/workflow_studio/api/__init__.py` (`studio_router`; its 8 sub-routers inherit), `app/api/v1/{form_platform (2 routers),capabilities,application_flow,worklist}.py` | `dependencies=[Depends(reject_platform_principal)]` on the router |

**Not guarded, by S2 scope** (platform / Workflow domain, B-5):
- `auth`, `modules`, `dashboard`, `metadata`, `notifications`, `gateway`, `scheduler`, `system`, `audit`, `health`;
- `workflow`, `workflow_registry`.

The unguarded state is pinned by `test_platform_and_workflow_routers_are_not_business_guarded_in_s2`.

**Backend (seed, test data process):** `backend/scripts/seed_worklist_e2e.py`, idempotent like the existing roles.
- **Permissions:**
  - `studio.{workspace,draft}.{read,write}`, `studio.publish.execute`, `studio.simulation.execute`, `studio.{template,review}.{read,write}`;
  - `core.workflow.{read,start,advance}`, `core.workflow.node.execute`;
  - `external_boundary_probe.items.{read,write}`;
  - `core.modules.read`.
- **Roles (per tenant):**
  - `phase_s2_studio_designer`: all 10 `studio.*` codes, plus `core.workflow.read/start/node.execute`;
  - `phase_s2_e2e_operator`: probe items read/write, leave requests read/write/approve, `core.workflow.read/advance`, `sales.orders.read`, `sales.customers.read`, `accounting.journal.read`, `core.modules.read` (the shell builds its nav from `GET /modules/`).
- **Users:**
  - `phase_s2_studio_designer_a` (tenant A);
  - `phase_s2_studio_designer_b` (tenant B);
  - `phase_s2_e2e_operator_a` (tenant A);
  - **platform user** `phase_s2_platform_admin`: `is_superuser`, **no tenant**. A user row, not business data. It gives a live platform principal independent of `admin`'s configuration.
- **Not changed:** `scripts/db.py`. The seeded `admin` stays tenant-less in a fresh seed, so it is a platform principal there (plan A-7).

**Backend (tests):**
- `tests/unit/test_n2b_s2_platform_principal.py` (new, 49 tests);
- `tests/integration/test_n2b_s2_login_principal_scope.py` (new, 3 tests);
- `tests/integration/workflow_postgres/test_n2b_s2_platform_principal_http.py` (new, 2 tests).

**Frontend (Playwright only, no `src/` change):** see §5.

## 4. Compatibility

| Who | Effect |
|---|---|
| Every token minted before S2 (no `scp`) | **Tenant** principal, so no platform rights can be acquired. Legacy tenant-less tokens keep their pre-S2 business-route behaviour **until S3** (`test_legacy_tenantless_token_keeps_pre_s2_business_behaviour_until_s3`) |
| Tenant users, including a superuser **with** a tenant (`*.*.*`) | unchanged; business routes 200 (`test_tenant_principals_keep_their_business_access`) |
| A **tenant-less superuser** at its next login/refresh (fresh-seed `admin`, the conftest `pg_admin_*` users) | becomes a **platform** principal: platform routers OK; every tenant business router 403. **This is the intended A-7 behaviour change**: the demo platform admin must use a tenant user (`manager`, `user1`, or the seeded phase users) for business data |
| `/auth/me` consumers | additive `principal_scope` field |
| Module lifecycle (`/modules/*`) | **unchanged**: `core.modules.admin`, still satisfied by `*.*.*` (§8 condition) |
| Required migrations | **No token migration.** **Seed migration:** run `backend/scripts/seed_worklist_e2e.py` before Playwright; it adds the users, roles and permissions above, idempotently |

## 5. Playwright Fixture Migration — all files covered

`frontend/shell/e2e/fixtures/users.ts` (new) names every E2E principal.

`api-setup.ts`:
- `getUserToken` (per-user cache), `getStudioToken`, `getOperatorToken`;
- `getAdminToken` now documented as platform-only;
- `seedWorkspaceAndDraft` runs as the Studio designer and **refuses** a tenant-less workspace or draft;
- new `cleanupStudioFixture` (owner deletes the draft and archives the workspace).

`authenticated-test.ts`: the session user is a worker **option**, defaulting to the tenant operator, and the fixture refuses a non-tenant session.

| # | File | Before | After |
|---|---|---|---|
| 1 | `e2e/auth.setup.ts` | UI login `admin` (reference script, not run by config) | unchanged (login only) |
| 2 | `e2e/fixtures/api-setup.ts` | admin token for everything; Studio rows as `admin` | per-user tokens; Studio rows as `phase_s2_studio_designer_a`; tenant-ownership assertion; cleanup helper |
| 3 | `e2e/fixtures/authenticated-test.ts` | UI session always `admin` | `sessionUser` option (default tenant operator); scope check |
| 4 | `e2e/tests/auth.spec.ts` | UI login as `admin` | unchanged (tests login; `/` is not a business route) |
| 5 | `declarative-flow-action-proof` | business action as `admin` | tenant operator; `user1` stays the unauthorized case |
| 6 | `declarative-flow-persisted-wait-proof` | flow + workflow advance as `admin` | tenant operator |
| 7 | `declarative-flow-real-erp-proof` | leave flow + approval as `admin` | tenant operator |
| 8 | `declarative-flow-workflow-step-proof` | workflow step + instance read as `admin` | tenant operator |
| 9 | `dynamic-module.spec.ts` | UI as `admin`; module deactivate/activate as `admin` | UI as tenant operator; **admin only for module lifecycle** |
| 10 | `form-sales-customer-proof.spec.ts` | `admin` only for Sales deactivate/activate | unchanged (already platform-only) |
| 11 | `multi-module-runtime.spec.ts` | UI as `admin`; `GET /modules` as `admin` | UI as tenant operator; **admin only for `/modules`** |
| 12–18 | `studio-collaboration`, `studio-editor-basics`, `studio-execute`, `studio-history-version`, `studio-simulation`, `studio-ux`, `studio-validate-publish` | UI as `admin`, rows created as `admin` | `test.use({ sessionUser: STUDIO_DESIGNER_A })`; rows tenant-A-owned; unused `getAdminToken` import removed |
| + | `declarative-flow-proof.spec.ts` (not in the original 17; found because it imports `authenticated-test`) | UI as `admin` | tenant operator via the fixture default |
| + | `studio-tenant-ownership.spec.ts` (**new**) | — | owner create/edit/publish/cleanup; tenant B 404 on read/edit/delete/publish; admin 403 (platform) or 404 (tenant-carrying); a real **platform principal**: Studio GET and POST 403, Sales/Leave/Capabilities/Forms 403, `/modules/` 200 |

**No S1 check was disabled, and no global business row was created.** Global Studio rows stayed at 596 workspaces and 592 drafts before and after all runs; 0 global templates. A template test was **deliberately not added**: any template a spec creates would be a global row that no tenant can delete (B-3, §7).

## 6. Test Commands and Results (2026-10-13)

**Backend** (`backend/`, `.venv/bin/pytest -p no:cacheprovider -q`):

| Command | Result |
|---|---|
| `tests/unit/test_n2b_s2_platform_principal.py` | **49 passed** |
| `tests/integration/test_n2b_s2_login_principal_scope.py` | **3 passed** |
| `tests/integration --ignore=…/workflow --ignore=…/workflow_postgres` (incl. `test_api_health.py`) | **10 passed** |
| `tests/integration/workflow_postgres/test_n2b_s2_platform_principal_http.py` | **2 passed** (sweep of **147** method/route pairs, all 403 for a platform token) |
| PG, one invocation, the 25 non-Sales/Accounting files (incl. S1's `test_n2b_s1_strict_mutation_ownership.py` 139, N-2, RC-1, RC-3, C-2, CND-1, H-1) | **321 passed, 1 xfailed** (the S5 DB-layer N-2 xfail). Run before the new HTTP file was added; the new file passed separately |
| PG Sales/Accounting, one file per invocation | **38 passed** (7, 4, 2, 4, 7, 2, 4, 8) |
| `tests/integration/workflow` (SQLite) | **172 passed, 5 skipped** (pre-existing static skips) |
| `tests/unit --ignore=tests/unit/test_engine_execution.py` | **3,822 passed** (3,773 after S1 + 49) |

**Failures during the phase:**
1. **The first full unit run: 3,232 passed, 589 errors.**
   - **Cause:** the new unit test imported the module routers at **collection time**. That put the schema-qualified Leave ORM models on `Base.metadata` and broke later SQLite `create_all` (the known unit-tier metadata rule).
   - **Fix:** the unit tier checks router constructors statically (AST); the runtime route sweep moved to the PG tier.
   - **Re-run:** 3,822 passed.
   - Re-running the erroring file alone had passed, which ruled out run interference.
2. Two static tests needed corrections to their own logic (`ast.unparse` quoting; function-level PLATFORM-usage map).
3. `/api/v1/worklist` redirects (307) without a trailing slash; the test now uses the slash path.
4. **Playwright, first run (affected subset: 44 passed, 7 failed, 2 did not run).** All causes were environment or fixture-permission gaps, none from S2's ownership logic:
   - **a.** the backend was started with `MODULES_PATH=external_modules`, so Sales and Accounting were not loaded. The spec header requires `app/modules,external_modules`;
   - **b.** the new operator lacked `core.modules.read` (the shell's nav) and `accounting.journal.read`. `admin`'s wildcard had masked both;
   - **c.** `studio-execute` hit 400 "Authorization denied … `core.workflow.node.execute`". The Foundation per-node permission was masked by the wildcard and is now granted to the Studio role.
5. **Second affected run: 52 passed, 1 failed** (`studio-execute`, cause c). After the fix, the full suite passed.

**Playwright** (`frontend/shell`, `npx playwright test --reporter=line`):
- **Backend:** `MODULES_PATH=app/modules,external_modules RATE_LIMIT_REQUESTS=5000 WORKFLOW_FOUNDATION_DEFINITION_CODES=e2e_p30a_execute_demo .venv/bin/uvicorn app.main:app --port 8000`.
- **Frontend:** `npm run dev`.
- **Local test DB:** `erp_platform`.
- **Seed:** `seed_worklist_e2e.py` run before the suite.

| Run | Result |
|---|---|
| Full suite (136 tests, before the platform-principal spec test was added) | **136 passed** |
| `studio-tenant-ownership.spec.ts` | **2 passed** |
| **Final full suite** | **137 passed** (2.9 min), 0 failed, 0 skipped, 0 flaky |

**Mutation check (7/7 detected; files restored, `shasum -c` OK):**

| # | Mutation | Detected by |
|---|---|---|
| S2-M1 | scope parsed by truthiness | `test_nothing_but_the_exact_signed_scope_grants_platform_authority` |
| S2-M2 | a `platform.admin` permission (wildcard-satisfiable) also accepted | same |
| S2-M3 | business guard is a no-op | unit + login integration + PG sweep |
| S2-M4 | every superuser minted platform | unit + login integration (the minting guard also refused it) |
| S2-M5 | Sales router unguarded | static unit + PG sweep |
| S2-M6 | platform + `tid` accepted | `…invalid_tokens…[platform-with-tenant]` |
| S2-M7 | `scp` smuggled through `extra_claims` | `test_scp_cannot_be_smuggled_through_extra_claims` |

**NOT RUN:**
- `tests/unit/test_engine_execution.py`;
- the full `workflow_postgres` directory in one invocation;
- **Vitest** (no `frontend/shell/src` file changed).

**Environment actions taken (test database and local processes only):**
- `seed_worklist_e2e.py` was run (users, roles and permissions above);
- local uvicorn and Vite were started and stopped;
- `leave_management` and `external_boundary_probe` were activated for the run, then **restored to inactive** (their state before the run); `sales`/`accounting` stayed active;
- **residue:**
  - 86 tenant-A Studio workspaces with their drafts, from three Playwright passes;
  - 2 tenant-owned Foundation workflow instances from manual diagnosis of the 400 (`probe-s2-admin`, `probe-s2b`);
  - probe items and leave requests created by the specs (no delete API exists);
  - all tenant-owned, none global.

## 7. S1 Protections and Remaining Decisions

- **S1 remains in force:**
  - `test_n2b_s1_strict_mutation_ownership.py` passes (139) in the PG run;
  - S1's unit guards are within the 3,822;
  - nothing in S2 touches loaders or ownership.
- **S1 condition C-1 (Playwright Studio): resolved, with evidence.**
  - Studio specs run as tenant-scoped users;
  - fixtures assert tenant ownership;
  - 137/137 pass live;
  - a real platform principal is refused live.
- **S1 condition C-2 / plan B-3 (Studio templates): UNRESOLVED.**
  - `create_template` still never assigns a tenant, so template update/delete are 404 for every tenant;
  - no exception was added;
  - it needs a domain decision: tenant-owned templates (a create-path change, S3 scope) or platform-managed templates (a platform endpoint).
- **S1 condition C-3 (real data):** unchanged. Real databases remain uninspected (N-2A O-1).
- **Workflow-engine ownership risk: UNRESOLVED.**
  - `app/core/workflow/engine.py::WorkflowEngine._load_instance` / `decide_approval` and `integration/resolver.py::FoundationRuntimeStrategy.query` still use the global-admitting idiom;
  - pinned by S1's static test;
  - S2 does not change or resolve them;
  - the `workflow` and `workflow_registry` routers are not business-guarded in S2.

## 8. Conditions for the GO

- **C-1 — platform routers still accept wildcard authority (B-5).**
  - Module lifecycle (`/modules/*/activate|deactivate|install|…`), `system`, `dashboard`, `metadata`, `gateway`, `scheduler` and `notifications` authorize with permissions such as `core.modules.admin`, which `*.*.*` satisfies, so a **tenant** superuser can still perform them.
  - S2 provides `require_platform_admin` but applies it to no production route. The approved plan scopes platform-router hardening as B-5, and switching module lifecycle now would also change `admin`'s access wherever `admin` carries a tenant, as it does here.
  - **Required before claiming "wildcard never establishes platform authority" platform-wide:** a B-5 phase that classifies each platform route and applies `require_platform_admin`.
- **C-2 — Studio template ownership (B-3)** (§7).
- **C-3 — Workflow-engine ownership** (§7).
- **C-4 — demo `admin` (fresh seed)** is a platform principal and can no longer use business UI pages. The demo business users must be used instead; document this in the release notes (A-7).

## 9. Forbidden Scope: Confirmation

None of the following was done:
- S3 tenant-less-create rejection: `require_tenant_context` exists but is applied to no route; legacy tenant-less tokens behave as before;
- read or reference behaviour changes;
- S4 work;
- schema, migration, RLS or grant changes;
- production-data changes (only the test-DB E2E seed and test runs);
- tenant impersonation or implicit tenant selection;
- dormant-module activation (only `leave_management`/`external_boundary_probe` were activated for the run and restored; Inventory was untouched);
- capability contract, fingerprint, snapshot or registry changes;
- touching the 269 unpinned form versions;
- cleanup of Studio workspaces, workflow definitions or other records;
- treating the Workflow-engine issue as resolved;
- a commit or push.

**Pre-existing issues noticed, not fixed:**
- the auth contract's broken `create_access_token(subject=…)` calls (§1.1);
- the seed's permission lookup ignores `module_name` (keyed on resource + action + scope). There is no collision today: verified, none of the new resources existed.

## 10. Verdict

```text
CONDITIONAL GO
```

**Why not GO:** C-1 is open. The brief's "wildcard must never independently establish platform-admin authority" holds for the new platform principal and every business router, but not yet for the existing platform routers (B-5). Template ownership and Workflow-engine ownership also remain open.

**Why not NO-GO:**
- the platform scope is signed, minted in one place, fail-closed on every malformed variant, and cannot be acquired by legacy tokens, wildcard permissions or role names;
- all 147 business method/route pairs refuse it;
- tenant access is unchanged;
- S1 holds;
- the full Playwright suite passes live under tenant-scoped principals without creating global rows.
