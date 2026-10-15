# N-2B S2.2 Workstream A — Route Classification and Principal Boundaries

**Date:** 2026-10-14
**Inputs:** `N2B_S2_1_PLATFORM_AUTHORIZATION_HARDENING_REPORT.md` §2.3 (unresolved routes), condition C-2.
**Companion reports:** `N2B_AUTH_CONTRACT_TOKEN_MINTING_FIX_REPORT.md` (Workstream B), `N2B_PERMISSION_IDENTITY_MIGRATION_PLAN.md` (Workstream C).
**Verdict (Workstream A):** **CONDITIONAL GO** (§8).

---

## Executive Summary

The classification audit turned up **three critical defects that I reproduced or confirmed**. Each was raised with you mid-phase and fixed only after your explicit choice:

| # | Defect | How established | Your decision | Fixed |
|---|---|---|---|---|
| **A-C1** | **Workflow Registry: cross-tenant read, update, delete and create-into-other-tenant.** A tenant-A user holding only `core.workflow.read/manage` read, updated and deleted tenant B's definitions, and created a definition **inside** tenant B through a body `tenant_id`. `workflow.wf_registry_definitions` deliberately has no RLS (Phase 3.0J), so nothing else enforced isolation. | Reproduced on real PostgreSQL (real router, signed tokens) | "Fix now, narrowly" | yes |
| **A-C2** | **Audit logs: cross-tenant read including record contents.** A tenant-A user holding only `core.audit.read` listed tenant B's audit rows, `new_values` included. The router runs on `cross_tenant_admin_session()` and was gated by a permission that `*.*.*` satisfies. | Reproduced on real PostgreSQL | "Split by principal" | yes |
| **A-C3** | **Scheduler: caller-supplied `handler_path` resolved by dynamic import.** Any holder of `core.scheduler.manage`, including every tenant superuser, could make the shared runner execute an arbitrary importable callable (a code-execution class). | **Code reading only; deliberately not demonstrated** | "Fix now, narrowly" | yes |

Clear, low-risk fixes applied under the brief's default rules:
- **Metadata:** refuses platform principals and refuses a body `tenant_id` naming another tenant.
- **Runtime internals platform-only:** `/system/status` and `/system/services`.
- **Deep `/health/` platform-only;** `/live` and `/ready` stay public.
- **Dashboard widget-type registration** (a tenant-less global catalog) is platform-only.

Ambiguous routes are classified with their options and left unchanged (§5).

---

## 1. Method

- **Code review:** every route of `metadata`, `dashboard`, `workflow-registry`, `scheduler`, `audit`, `notifications`, `gateway` (keys and metrics), `system`, `ws`, `health`, the `modules` reads, and (classification only) `/workflow`.
- **Per route, recorded:**
  - authentication and permission dependency;
  - principal-scope dependency;
  - session type (`get_db_session` = RLS-filtered by caller tenant; `cross_tenant_admin_session` = tenant filter bypassed);
  - where the written `tenant_id` comes from;
  - whether rows with `tenant_id IS NULL` can be created or exposed;
  - response sensitivity.
- **RLS state** read from the database (`pg_class.relrowsecurity` / `relforcerowsecurity`) rather than assumed:
  - `wf_registry_definitions`: **off**;
  - `widget_registry`, `dashboard_widgets`, `model_fields`, `job_runs`, `recurring_tasks`: **off**;
  - `meta_models`, `form_schemas`, `table_schemas`, `ui_layouts`, `user_dashboards`, `dashboard_templates`, `scheduled_jobs`, `api_keys`, `notifications`, `audit_logs`, `gateway_metrics`: **ENABLE + FORCE**.
- **Consumers:** frontend callers (`frontend/shell/src`) and infrastructure (Kubernetes, Docker, compose, nginx) checked with grep before any change.
- **Workflow Registry data model** inspected rather than classified wholesale (as the brief required):
  - definitions carry a real `tenant_id`;
  - versions, nodes and transitions carry `definition_id`;
  - Studio publications are stored under a **zero-UUID sentinel** tenant (`RegistryPublishingGateway._NO_TENANT_SENTINEL`).

---

## 2. Classification Matrix

**Key:**
- **Scope:** **P** = public; **T** = tenant-scoped; **PL** = platform-only.
- **R/W:** persistent read/write.
- **NULL rows:** can the route create (C) or expose (E) `tenant_id IS NULL` rows?

### 2.1 Changed in S2.2

| Router · routes | Scope | Sensitive / cross-tenant exposure | R/W | NULL rows | Before | After |
|---|---|---|---|---|---|---|
| **workflow-registry** · all 18 (definitions CRUD/list, versions create/list/active/detail/clone/validate/activate/deprecate, nodes add/update/remove, transitions add/remove) | **T** | **was cross-tenant** (A-C1) | R/W | C (body), E | `require_permission(core.workflow.*)` only; tenant from body/query; id-only lookups | router `reject_platform_principal`; caller tenant from the **signed** principal (`require_tenant` → 403 if missing); **mutations: owner only** (another tenant's or a shared row → 404); **reads: owner + shared** (NULL and sentinel); list bounded to that visible set; create forced to the caller's tenant, foreign body `tenant_id` → 403 |
| **audit** · `GET /logs`, `GET /logs/{id}` | **T** for tenants; **PL** for the cross-tenant view | **was cross-tenant**, including `old_values`/`new_values` (A-C2) | R | E | `core.audit.read` on `cross_tenant_admin_session` | tenant principal: forced to its own tenant (foreign `?tenant_id` → 403; foreign or NULL-tenant log id → 404); signed platform principal + `core.audit.read`: all tenants (the 3.0G "authorized auditor"); tenant-less non-platform → 403; malformed `tenant_id` → 422 |
| **scheduler** · all 9 (`status`, jobs CRUD, `trigger`, runs) | **PL** | runner state is process-wide; jobs run in the shared runner | R/W | C (body `tenant_id`) | `core.scheduler.read/manage` (wildcard-satisfiable); `handler_path` resolved by `importlib` (A-C3) | router `require_platform_admin` (per-route permissions kept); `_resolve_handler` accepts **registered names only** (no import fallback; runs fail closed); create rejects an unregistered `handler_path` (422) |
| **metadata** · all 26 | **T** | — | R/W | C, E | `core.metadata.*` only | router `reject_platform_principal`; the 4 creates refuse a body `tenant_id` that is not the caller's (403, before the service; previously only RLS `WITH CHECK` stopped it, as a DB error) |
| **dashboard** · `POST /widget-types` | **PL** | writes the **tenant-less** `widget_registry` catalog every tenant sees | W | (no tenant column) | `core.dashboard.manage` | `require_platform_permission("core.dashboard.manage")` |
| **system** · `GET /status`, `GET /services` | **PL** | service registry, contract registrations, load order, lifecycle history, subscribed events | R (process) | — | `core.system.read` (wildcard-satisfiable) | `require_platform_permission("core.system.read")` |
| **health** · `GET /health/` (deep) | **PL** | environment, version, DB engine, **raw component exception text**, module state | R (process) | — | **unauthenticated** | `require_platform_admin` |

### 2.2 Classified, unchanged (no defect found)

| Router · routes | Scope | Exposure | R/W | NULL rows | Auth (unchanged) | Why no change |
|---|---|---|---|---|---|---|
| health · `/live`, `/ready` | **P** | `{"status": …}` (+ a fixed `reason` on 503) only | — | — | none | Minimal by construction; used by K8s probes, `Dockerfile`, compose and nginx |
| modules · `GET /`, `/{name}`, `/{name}/health`, `/lifecycle/history` | **T** (read of global platform state) | module names/versions/status; history entries are `{module, event, result, at}`, with no actor or tenant | R (process) | — | `core.modules.read` | Every shell user needs `GET /modules/` at boot (`RuntimeEngine.ts:141`); nothing tenant-specific is revealed |
| dashboard · widget list, widget data, templates, my dashboards (11 routes) | **T** / per-user | per-user (`user.user_id`) under RLS | R/W | C (decision D-3) | `get_current_user` / permission | Per-user ownership is service-enforced; widget data providers are registered in-process (no dynamic resolution) |
| notifications · 4 | **T** / per-user | own inbox | R/W (mark read) | E (own) | `get_current_user` | Per-user and RLS; creates none |
| gateway keys · 4 | per-user | own keys | R/W | C (platform user's own key) | `get_current_user` | API keys are **not used to authenticate** anything (only stored/listed/revoked; no middleware consumes them), so a key confers no access |
| `/workflow` (Legacy engine instances) · 9 | **T** | — | R/W | — | `core.workflow.*` + `_workflow_execution_context` (fail-closed on a missing tenant) | Classification only: this is the separately tracked Workflow-engine area (`engine.py`, `resolver.py`), and it is **not** claimed fixed |

---

## 3. Mechanisms (reused; nothing new invented)

- **Principal scope:** S2's `reject_platform_principal`, `require_platform_admin` and S2.1's `require_platform_permission`. Platform authority is still **only** the signed `scp=platform` claim.
- **Tenant requirement:** S1's `app.core.multi_tenancy.ownership.require_tenant` (`TenantRequiredError` mapped to 403).
- **Registry ownership:**
  - router-local `_authorize_definition` / `_authorize_child`;
  - a version, node or transition is checked through its `definition_id`;
  - the tenant cannot change after creation (`UpdateDefinitionRequest` has no `tenant_id`), so the check-then-call cannot race on ownership.
- **Registry list:** an **additive** `visible_tenant_ids` filter on `WorkflowDefinitionRepository.list_active` / `WorkflowRegistry.list_definitions`. The default is `None`, which is unbounded, so internal callers are unchanged.
- **`_wf_error_to_http` passes `HTTPException` through.** Otherwise the handlers' `except Exception` would turn the 403 into a 500.
- **Not changed:** Studio publishing, `RegistryPublishingGateway`, `resolver.py` / `engine.py`, and every Workflow service-level method (all non-HTTP callers).

---

## 4. Behaviour Changes Users Will Notice

1. **Registry router mutations need ownership.** A tenant can no longer mutate Studio-published Registry definitions (the shared sentinel bucket) through `/workflow-registry`. One existing test did exactly that (`test_publish_lifecycle.py::test_archive_active_version_then_reactivate_via_registry_directly`). It now asserts the archive through a Registry **read** and expects **404** for the activate (previously 422, a status check reached cross-tenant). Studio's own publish and archive routes are unaffected.
2. **Tenant users see only their own tenant's audit rows.** The tests that read **other tenants'** denial audit rows now read as the platform principal: `test_production_context_activation.py`, `test_postgres_production_context_activation.py` and `tests/unit/test_audit.py`.
3. **Platform-only routes:** `/scheduler/*`, `/system/status`, `/system/services`, deep `/health/` and `POST /dashboard/widget-types` now need the signed platform principal. `test_api_health.py::test_system_status_with_superadmin_token` now uses one and also asserts that a tenant `*.*.*` token is refused.
4. **Platform principal refused** on `/metadata/*` and `/workflow-registry/*`.
5. **Test fixtures using `MagicMock` users** (`test_metadata.py`, `test_scheduler.py`) satisfied every scope check vacuously. They now use real `UserContext` principals.

---

## 5. Unresolved Decisions (changes stopped pending review)

| # | Route(s) | Question | Options |
|---|---|---|---|
| **D-1** | metadata creates with **omitted** `tenant_id`, and update/delete of global metadata rows | Under RLS a tenant user can still create a **global** (NULL) metadata row and edit or delete global rows, because RLS admits NULL. Who owns global metadata? | (a) force the caller's tenant on create and owner-only mutations (S1 pattern; no HTTP path would then create global metadata); (b) global metadata is platform-managed, so add a platform-only create path; (c) leave as is |
| **D-2** | Registry **shared sentinel bucket** | Studio publishes **every** tenant's workflow under one zero-UUID sentinel tenant keyed by `definition_code`. Two tenants publishing the same code share **one** Registry definition (and the resolver reads it by name + sentinel). The router is now safe; the **publishing model** is not tenant-separated. | (a) publish under the workspace's tenant (touches Studio publishing and the resolver, i.e. the Workflow-engine scope); (b) keep shared and namespace codes per tenant; (c) accept as designed. **Separately tracked with the Workflow-engine risk; not fixed.** |
| **D-3** | dashboards for a platform principal | `get_or_create_default` for a tenant-less platform user creates a NULL-tenant per-user dashboard; the shell's home page calls it | (a) reject platform principals on `/dashboard` (the shell home would then show an error for platform users); (b) allow per-user NULL rows (status quo) |
| **D-4** | `GET /system/permissions` | Permission catalog (codes and names, not tenant data) | platform-only, or keep it readable for future tenant role management |
| **D-5** | `GET /gateway/metrics/summary` | RLS limits it to own + NULL-tenant metric rows; it's unclear whether this is a tenant-admin view or a platform view | (a) split by principal like audit; (b) platform-only |
| **D-6** | `GET /ws/stats` (unauthenticated) | Returns total connections, unique users, **unique tenants** and topics: aggregate, cross-tenant operational counts | (a) platform-only (the monitoring consumer would then need a token); (b) drop the tenant/user counts from the public response; (c) keep |
| **D-7** | scheduler NULL-tenant jobs | Jobs are now platform-only, but the body `tenant_id` is still accepted and jobs run without tenant context | define whether a job executes **as** its tenant (needs a runner change) |

---

## 6. Tests

**New:**

| File | Tier | Tests | Proves |
|---|---|---|---|
| `tests/integration/workflow_postgres/test_n2b_s2_2_workflow_registry_tenant_boundary.py` | PostgreSQL, real router | 5 | Another tenant: 404 on all 4 reads + 12 mutations, for a plain manager **and** a tenant `*.*.*`; nothing changes (snapshot compared). List excludes B even with `?tenant_id=B`. Owner full lifecycle over every route. Shared sentinel and NULL rows readable but 404 on 5 mutations. Create forced to the caller; foreign or sentinel body `tenant_id` → 403. Tenant-less → 403 and platform → 403 on every route; no token → 401. |
| `tests/integration/workflow_postgres/test_n2b_s2_2_audit_tenant_boundary.py` | PostgreSQL, real router + its real cross-tenant session | 3 | A tenant (plain and `*.*.*`) sees only its own row; foreign `tenant_id` → 403; foreign/NULL log id → 404. Platform sees all three, and still needs the permission. Tenant-less → 403; RBAC unchanged; no or bad token → 401; malformed id → 422. |
| `tests/unit/test_n2b_s2_2_route_boundaries.py` | unit, real routers, signed JWTs | 15 | Router-level dependencies (registry, metadata, scheduler). All 18 registry routes guarded. Both audit routes split. No `importlib` in the scheduler. Metadata creates refuse a foreign tenant (static + behaviour). `/system/status` and `/services` platform-only. `/system/permissions` unchanged. Deep health 401/403/200 with `/live` and `/ready` public and minimal. Widget-type registration platform-only. |
| `tests/unit/test_scheduler.py` (+2, 1 rewritten) | unit | 65 total | Unregistered `handler_path` → 422 and no job; all 9 routes 403 for a tenant superuser and a tenant-less `*.*.*`; dotted path never imported. |

**Mutation check (13/13 detected; files restored and re-verified):**

| # | Mutation | Detected by |
|---|---|---|
| A-M1 | shared registry rows mutable | registry PG |
| A-M2 | registry ownership check no-op | registry PG |
| A-M3 | create not forced to caller tenant | registry PG (4 tests) |
| A-M4 | list unbounded | registry PG |
| A-M5 | audit filter not forced | audit PG |
| A-M6 | audit `get_by_id` unscoped | audit PG |
| A-M7 | scheduler router not platform-only | `test_scheduler.py` |
| A-M8 | scheduler create accepts an unregistered handler | `test_scheduler.py` |
| A-M9 | deep health public again | `test_n2b_s2_2_route_boundaries.py` |

B-M1–B-M4 are in the Workstream B report.

**Suite results** (`backend/`, `.venv/bin/pytest -p no:cacheprovider -q`):

| Command | Result |
|---|---|
| `tests/unit --ignore=tests/unit/test_engine_execution.py`, first run | **16 failed**, 3,863 passed. All in `test_metadata.py`: `MagicMock` user refused by the new guard. Fixture fixed (§4.5). |
| same, after the fix | 3,879 passed |
| same, final (after the widget-type change) | **3,881 passed** |
| `tests/integration --ignore=…/workflow --ignore=…/workflow_postgres` | **21 passed** |
| `tests/integration/workflow` (SQLite), first run | 1 failed (§4.1, an intended behaviour change), then updated |
| `tests/integration/workflow` (SQLite), final | **172 passed, 5 skipped** (pre-existing) |
| PostgreSQL, **one invocation**, 30 non-Sales/Accounting files (S1, S2, S2.1 and all new S2.2 files) | **334 passed, 1 xfailed.** The xfail is the S5 DB-layer N-2 case; it is still an expected failure and **not** a fix. |
| PostgreSQL Sales/Accounting, one file per invocation | **38 passed** (7, 4, 2, 4, 7, 2, 4, 8) |

**Live run** (local test DB, platform principal `phase_s2_platform_admin`, tenant-carrying `admin`):

| Check | Result |
|---|---|
| anonymous `/health/` | 401 |
| tenant `admin` `/health/` | 403 |
| platform `/health/` | 200 |
| tenant `admin` `/system/status` | 403 |
| platform `/system/status` | 200 |
| tenant `admin` `/scheduler/jobs` | 403 |
| platform `/scheduler/jobs` | 200 |
| tenant `admin` audit with foreign `tenant_id` | 403 |
| tenant `admin` audit list | only its own tenant (1,813 rows) |
| platform audit list | 30,732 rows |
| platform `/metadata/models` | 403 |
| platform `/workflow-registry/definitions` | 403 |
| tenant operator `/workflow-registry/definitions` | 200 |

**Playwright** (`frontend/shell`, `npx playwright test --reporter=line`, setup as in S2.1):
- **Run 1:** 135 passed, **1 failed**, 1 did not run, in **10.1 min**, while the full unit suite ran concurrently. The failure was `form-lifecycle-proof.spec.ts` LF2 with "Test timeout of 30000ms exceeded" waiting for "In review". No route touched by S2.2 is involved.
- **Re-run of that spec alone:** 3 passed (29.2 s).
- **Full suite re-run, uncontended:** **137 passed (4.0 min)**, 0 failed, 0 skipped, 0 flaky.
- `POST /dashboard/widget-types` was changed **after** the Playwright runs. No spec or frontend code calls it (grep), so Playwright was not re-run for it; the final unit run covers it.

**Environment:**
- Leave and the probe module were activated, then deactivated, as the platform principal. Final states: sales/accounting active, leave/probe inactive.
- Global Studio rows: **596 / 592 / 0**, unchanged.
- Residue (tenant-owned or throwaway tenants; nothing cleaned up):
  - workspaces 1,110 → 1,152 (Playwright, tenant A);
  - Registry definitions 131 → 137 (Studio publishes and PG tests in random tenants);
  - one audit row and a few Registry rows from the two temporary reproductions, which were deleted afterwards.
- Servers stopped.

**NOT RUN:**
- `tests/unit/test_engine_execution.py`;
- the whole PostgreSQL directory in one invocation;
- Vitest (no `frontend/shell/src` change);
- Docker `erp_postgres` or any non-test database;
- a demonstration of A-C3.

---

## 7. S1 and S2 Intact

- **S1:**
  - `ownership.py` and all S1 loaders are unchanged;
  - `test_n2b_s1_strict_mutation_ownership.py` (139) and `test_n2b_s1_ownership_architecture.py` pass in the PostgreSQL and unit runs;
  - the Registry fix **adds** the S1 pattern to a router S1 did not cover.
- **S2:**
  - scope parsing and the S2 guards are unchanged;
  - `test_n2b_s2_platform_principal.py`, the login/refresh integration tests and the 147-route PG sweep pass;
  - one S2 static pin moved with the minting function (Workstream B report §3).

---

## 8. Verdict: **CONDITIONAL GO**

- **Achieved:**
  - three critical cross-tenant / privilege defects closed with real-PostgreSQL evidence (two of them) and mutation-tested guards;
  - platform internals and the global widget catalog are platform-only;
  - public health is minimal.
- **Why not GO:**
  - decisions D-1 to D-7 are open, D-2 most of all: Studio's shared Registry bucket is a cross-tenant **design** issue tied to the Workflow-engine risk;
  - the Workflow engine (`engine.py`, `resolver.py`) and Studio template ownership (B-3) remain unresolved.
- **Why not NO-GO:** no reproduced cross-tenant path remains open on the routers classified here, and every run tier passed.

---

## 9. Files Changed (Workstream A)

**Backend:**
- `app/api/v1/workflow_registry.py`: tenant boundary, router guard, `HTTPException` pass-through.
- `app/core/workflow/registry/repositories.py` and `app/core/workflow/registry/service.py`: additive `visible_tenant_ids`.
- `app/api/v1/audit.py`: `_audit_tenant_scope`.
- `app/api/v1/scheduler.py`: router `require_platform_admin`; handler validated at create.
- `app/core/scheduler/service.py`: registered-only resolution and `is_registered_handler`.
- `app/api/v1/metadata.py`: router guard and `_no_foreign_tenant`.
- `app/api/v1/dashboard.py`: widget-type create platform-only.
- `app/api/v1/system.py`: status and services platform-only.
- `app/api/v1/health.py`: deep check platform-only.

**Tests:**
- New: `test_n2b_s2_2_workflow_registry_tenant_boundary.py`, `test_n2b_s2_2_audit_tenant_boundary.py`, `tests/unit/test_n2b_s2_2_route_boundaries.py`.
- Updated: `tests/unit/test_scheduler.py`, `tests/unit/test_metadata.py`, `tests/unit/test_audit.py`, `tests/integration/test_api_health.py`, `tests/integration/workflow/test_publish_lifecycle.py`, `tests/integration/workflow/test_production_context_activation.py`, `tests/integration/workflow_postgres/test_postgres_production_context_activation.py`.

**No commit and no push.**
