# N-2B S1 — Strict Ownership for Updates and Transitions: Report

**Date:** 2026-10-13
**Implements:** stage **S1 only** of `N2B_APPLICATION_OWNERSHIP_HARDENING_PLAN.md`. It closes N-2 defect **D-1** / N-2B finding **F-1** and the ID-based part of **F-5**.
**Provenance:** Commit: NONE · Push: NONE

```text
N-2B S1: CONDITIONAL GO
  Every ID-based update / delete / transition of a tenant-owned row now loads it with
  `load_owned`: tenant predicate inside the SQL, row lock only on an owned row,
  NULL-tenant rows never owned, missing/malformed tenant → 403 before any lookup.
  Real PostgreSQL (RLS on AND bypassed) + HTTP + static guards; 15/15 mutations detected.
  Conditions (§7):
    C-1 Playwright Studio specs (tenant-less `admin`) will now get 403/404 on Studio
        mutations → S2 fixture migration before any Playwright run or deployment.
    C-2 Studio templates are always created global → template update/delete is now
        404 for every tenant until decision B-3 / S3 assigns template ownership.
```

---

## 1. Pre-Implementation Checklist (as executed)

| # | Mutation path (entry points) | Ownership check before S1 | Defect | Change | Error / status mapping kept |
|---|---|---|---|---|---|
| 1 | Sales `confirm_order`, `decide_order_approval`, `cancel_order` (HTTP confirm/decide/cancel; worklist `_decide`; flow step `submit_sales_order_for_approval`) | `_load_tenant_scoped_order(for_update=True)`: unscoped `SELECT … FOR UPDATE`, then `tenant_id is not None and != caller` | a global order was locked **and** mutated; the lock was taken before ownership was known | `_load_owned_order` → `load_owned(..., for_update=True)`. The read loader keeps reads only (its `for_update` branch is removed) | `None` → route 404; `ValueError` → existing 409/422 |
| 2 | Accounting `post_journal_entry`, `decide_entry_approval` (HTTP post/decide, worklist, flow step) | same, `_load_tenant_scoped_entry` | same | `_load_owned_entry` | unchanged |
| 3 | Leave `submit_request`, `decide_request` (approve/reject), `cancel_request` (HTTP, worklist, flow step) | same, `_load_tenant_scoped_request` | same | `_load_owned_request` | `LeaveRequestNotFoundError` → 404; state errors → 409 |
| 4 | HR `PATCH /hr/employees/{id}` → `update_employee` | `session.get` + idiom; route `uuid.UUID(tid) if tid else None` | tenant-less and tenant callers could edit global rows; a malformed `tid` gave a 500 | `load_owned`; route `require_tenant` → 403 | 404; C-2 reference 422 unchanged |
| 5 | Inventory `PATCH /inventory/products/{id}` → `update_product` (module dormant) | same | same | same | 404 |
| 6 | Studio `update`/`delete` (workspace, draft, template), version `update`, publish-from-draft | `_enforce_tenant` returned early for NULL rows and under bypass | any tenant could edit, delete or publish global Studio rows | `_load_owned_or_raise` → `load_owned`; new `SqlAlchemyDraftRepository.get_owned` for publish; `TenantRequiredError` → 403 in `studio_error_to_http` | `*NotFoundError` → 404 |
| 7 | Application Flow `resume`; worklist `execute_task_action` | `instance.tenant_id != _tenant_uuid(user)` | `None == None` let a tenant-less caller act on a NULL-tenant instance | `load_owned(..., for_update=True)`; routes map `TenantRequiredError` → 403 | `FlowInstanceNotFoundError` → 404; 409/422 unchanged |

**B-4 (from the plan) resolved.** Studio `simulation` and `collaboration` routes are process-local in-memory services (`api/dependencies.py` tier 2). They touch no database row, so they are outside S1's DB ownership scope (§6).

**Paths deliberately not changed in S1:**
- reads (`get_*`, the read loaders, lists);
- reference checks (C-2, stock adjust);
- creates, including flow start (`submit_step`);
- Studio version archive/rollback (Workflow Registry rows);
- the Workflow engine (§6).

## 2. Design

`app/core/multi_tenancy/ownership.py` (new; SQLAlchemy and `uuid` only, so it imports no module and no middleware):

```text
require_tenant(t)  -> UUID      None / "" / malformed / non-str → TenantRequiredError
owned_by(model, t)              model.tenant_id == t   (text compare for String columns; never an IS NULL branch)
load_owned(session, model, id, t, for_update=False)
                                SELECT … WHERE id = :id AND tenant_id = :t [FOR UPDATE]
                                → the row, or None for another tenant's / global / missing row
```

- **Lock safety:** the tenant predicate and `FOR UPDATE` are one statement, so PostgreSQL never locks a row the caller does not own (proven in §4.3).
- **Module boundaries:**
  - each module keeps its typed errors and HTTP mappings;
  - Sales, Accounting and Leave gained a thin private `_load_owned_*` wrapper so their call sites read the same;
  - no cross-module import was added;
  - Leave (an external module) imports only `app.core.multi_tenancy.ownership`, which was added to its boundary allowlist with a comment (`test_leave_management_architecture.py`).
- **RLS is not relied on:** every rule holds with `app.bypass_rls = 'true'` (§4.1, mode `bypass`).
- **The ORM auto-filter** (`FilteredSyncSession._inject_global_filters`) is dormant, because no business model inherits `BaseEntity`, so it plays no part.

## 3. Before / After

| Caller vs. row | Before S1 (mutation by id) | After S1 |
|---|---|---|
| Same tenant | allowed | **allowed**; business rules and state machines unchanged |
| Other tenant | 404 (refused, but the row was locked first on the `for_update` paths) | **404**, no lock taken |
| Global row (`tenant_id IS NULL`), tenant caller | **mutated** (proven: HTTP cancel → 200) | **404**, unchanged |
| Missing row | 404 | 404 |
| No tenant / malformed tenant | global rows mutable; tenant rows 404; malformed HR/Inventory `tid` → 500 | **403** before any lookup |
| Reads (`GET …/{id}`, lists) | global visible by id | **unchanged** (S4) |

## 4. Evidence

### 4.1 Real PostgreSQL — `tests/integration/workflow_postgres/test_n2b_s1_strict_mutation_ownership.py` (139 tests)

**Setup:**
- service tier, one rolled-back transaction per case;
- the non-superuser, non-BYPASSRLS role is asserted in every case;
- rows are inserted under their owner's own RLS context;
- workflow-backed transitions use a recording fake workflow, so "workflow never called" is observable.

| Test | Cases | Result |
|---|---|---|
| `test_mutation_ownership_matrix` | 11 families × {own, other, global, missing} × {`rls`, `bypass`} = 88 | ✅ own → transition happens and the expected workflow calls are made; other/global/missing → `None`/not-found, row unchanged, **0 workflow calls**, in both modes |
| `test_mutation_without_a_valid_tenant_is_refused_before_any_lookup` | 11 families × {None, "", malformed} = 33 | ✅ `TenantRequiredError`, global row unchanged, 0 workflow calls |
| `test_flow_instance_mutations_are_strict` | {resume, worklist action} × {other, global, missing, tenant-less on global, malformed} = 10 | ✅ 404-class / `TenantRequiredError`; instance stays `waiting` |
| `test_flow_instance_owned_by_the_caller_is_loaded_and_locked` | 1 | ✅ |
| `test_studio_workspace_update_and_delete_are_strict` | {own, other, global, missing, tenant-less} = 5 (varchar tenant column, text RLS policy) | ✅ own updated and deleted; others `WorkspaceNotFoundError` / `TenantRequiredError`, row intact |
| `test_row_lock_is_taken_only_on_a_row_the_caller_owns` | own / other-tenant / global, with a second real session probing `FOR UPDATE NOWAIT` | ✅ lock held only for the owned row; committed rows cleaned, 0 residue |
| `test_http_mutation_routes_refuse_other_tenant_global_and_tenantless` | real routers + `TenantContextMiddleware` + real JWTs (see below) | ✅ every row read back unchanged except the intended own update; 0 residue |

The HTTP test covers:
- Sales confirm and cancel (other tenant, global, tenant-less);
- Accounting post;
- Leave submit and cancel;
- HR PATCH (own 200; other and global 404; tenant-less and malformed 403);
- Inventory PATCH;
- Application Flow resume;
- the worklist action.

The 11 families are:
- `sales.cancel`, `sales.confirm`, `sales.decide`;
- `accounting.post`, `accounting.decide`;
- `leave.submit`, `leave.approve`, `leave.reject`, `leave.cancel`;
- `hr.update_employee`, `inventory.update_product`.

**Why both modes.** Under `rls`, PostgreSQL itself hides another tenant's row, but **not** a global one. Under `bypass` the database would return every row. Mutation M1 (§4.4) was caught **only** by `…-other-bypass`, which shows the application layer, not RLS, is what enforces ownership.

**N-2 evidence file:** the four strict xfails (`test_a_tenant_cannot_cancel_a_global_sales_order`, `…update_a_global_employee`, `…update_a_global_product`, `test_http_a_tenant_cannot_cancel_a_global_sales_order`) became `XPASS(strict)` on the fix, as designed. They are now normal tests (`10 passed, 1 xfailed`). The remaining xfail is the database-level `test_the_database_refuses_a_global_insert_from_a_tenant_session` (N-2B S5).

### 4.2 Unit / HTTP (SQLite)

`tests/unit/test_n2b_s1_ownership_architecture.py` (31 tests).

**Helper contract:**
- `require_tenant` accepts only a UUID;
- `owned_by` never compiles an `IS NULL`/`OR` branch, and compares as text vs. UUID by column type;
- `load_owned` puts the tenant predicate and `FOR UPDATE` in one statement, and issues **no** statement without a tenant.

**AST guards** over `app/modules`, `external_modules` and `app/core/application_flow`:
- **a.** the idiom `x.tenant_id is not None and x.tenant_id != t` survives only in exactly 8 pinned read/reference functions (S4 scope);
- **b.** `with_for_update()` appears **only** in the ownership helper;
- **c.** every pinned mutation path (20 functions) reaches `load_owned` / `_load_owned_*` and calls no read loader and no unscoped `session.get`;
- **d.** each module's `_load_owned_*` delegates to `load_owned`;
- **e.** Studio `_enforce_tenant` is called only from `get()`;
- **f.** the HR/Inventory PATCH routes call `require_tenant`;
- **g.** the Workflow-engine occurrences outside scope are pinned exactly (§6).

**`tests/unit/test_workflow_studio_api.py`:**
- new `TestStudioMutationOwnership` (4 tests): same-tenant update/archive/delete succeed; another tenant and global rows → 404 for PUT, DELETE, archive and **publish**, with reads still 200; tenant-less → 403;
- the existing client now carries a real tenant UUID through the ambient context, as the middleware does.

**`tests/unit/test_workflow_studio_infrastructure.py`:** tenant literals `"tenant-1"`/`"tenant-a"`/`"tenant-b"` were replaced by UUID strings. The context variable is typed `Optional[uuid.UUID]`, and the strict helper rejects non-UUID tenants.

### 4.3 Commands and results (`backend/`, `.venv/bin/pytest -p no:cacheprovider -q`, 2026-10-13)

| Command | Result |
|---|---|
| `tests/integration/workflow_postgres/test_n2b_s1_strict_mutation_ownership.py` | **139 passed** |
| `tests/integration/workflow_postgres/test_n2_global_row_current_behavior.py` (before conversion) | 4 failed `[XPASS(strict)]`, 6 passed, 1 xfailed, as designed |
| same, after conversion | **10 passed, 1 xfailed** |
| `tests/unit/test_n2b_s1_ownership_architecture.py` | **31 passed** |
| `tests/unit/test_workflow_studio_api.py` / `test_workflow_studio_infrastructure.py` | **36 / 40 passed** |
| PG, **one invocation**, the 25 non-Sales/Accounting files of `workflow_postgres` | **321 passed, 1 xfailed** (the S5 DB xfail) |
| PG Sales/Accounting, one file per invocation: accounting_application_flow_proof 7, accounting_journal_entry_concurrency 4, accounting_module_production_activation 2, sales_accounting_workflow_definition_provisioning 4, sales_application_flow_proof 7, sales_module_production_activation 2, sales_order_concurrent_confirm 4, sales_order_full_state_machine_concurrency 8 | **38 passed** |
| `tests/integration/workflow` (SQLite tier) | **172 passed, 5 skipped** (pre-existing static skips) |
| `tests/unit --ignore=tests/unit/test_engine_execution.py`, run before the guard file was added | **3,742 passed** (3,738 baseline + 4 Studio ownership tests) |
| same, final run including the guard file | **3,773 passed**, 0 failed (3,742 + 31 guard tests) |

All 33 `workflow_postgres` files ran (321 + 38 = 359 passed, 1 xfailed) across 9 invocations.

**Regression detail:**

| Area | Result |
|---|---|
| RC-1 | PG `test_rc1_reference_candidates` 8, unit `test_capability_reference_inventory` 4 |
| RC-2 | Leave 11, Sales 14 |
| RC-3 | unit 21, PG 4 |
| C-2 | 17 (global reference cases unchanged, as S1 requires) |
| CND-1 | unit 14, PG 10 |
| H-1 | unit 49, PG 11; fingerprints unchanged |
| Form Platform | 10 |
| Leave | lifecycle 10, worklist 8, real flow 5 |
| RLS activation | 29 |
| Concurrency suites | green, so the lock semantics are preserved |

### 4.4 Mutation check (15/15 detected)

Script: scratchpad `s1_mutate.py`. Each mutation was applied in place and the stated suite run with `-x`. Files were restored from backup, and `shasum -c` over all 12 touched production files reported no change.

| # | Mutation | Detected by |
|---|---|---|
| M1 | `load_owned` without the tenant predicate | `…matrix[accounting.decide-other-bypass]` (**bypass only**: RLS hid it) |
| M2 | `owned_by` admits NULL | `…matrix[accounting.decide-global-rls]` |
| M3 | `require_tenant` lets `None` through | `…refused_before_any_lookup` |
| M4 | `FOR UPDATE` dropped | `test_row_lock_is_taken_only_on_a_row_the_caller_owns` |
| M5 | Sales confirm via the read loader | `…matrix[sales.confirm-global-rls]` |
| M6 | Accounting post via the read loader | `…matrix[accounting.post-global-rls]` |
| M7 | Leave cancel via the read loader | `…matrix[leave.cancel-global-rls]` |
| M8 | HR update reverted to the idiom | `…matrix[hr.update_employee-global-rls]` |
| M9 | Inventory update reverted to the idiom | `…matrix[inventory.update_product-global-rls]` |
| M10 | Studio workspace update reverted to `_enforce_tenant` | `test_studio_workspace_update_and_delete_are_strict[other]` |
| M11 | Flow resume reverted | `…flow…[tenantless_on_global-resume]` |
| M12 | Worklist action reverted | `…flow…[tenantless_on_global-worklist_action]` |
| M13 | HR PATCH route drops `require_tenant` | HTTP test |
| M14 | Studio `TenantRequiredError` unmapped | `TestStudioMutationOwnership::test_tenantless_caller_cannot_mutate_even_its_own_global_rows` |
| M15 | Publish reverted to the read `get()` | `TestStudioMutationOwnership::test_global_rows_are_readable_but_not_mutable_by_a_tenant` |

### 4.5 Final unit run

`tests/unit --ignore=tests/unit/test_engine_execution.py` → **3,773 passed**, 0 failed. `test_engine_execution.py` is excluded, as a known unrelated event-loop-poisoning file.

## 5. Files Changed

**Production:**
- `backend/app/core/multi_tenancy/ownership.py` (**new**);
- `backend/app/modules/sales/service.py`: `_load_owned_order`; three transitions use it; read loader read-only;
- `backend/app/modules/accounting/service.py`: `_load_owned_entry`; post/decide use it;
- `backend/external_modules/leave_management/service.py`: `_load_owned_request`; submit/decide/cancel use it;
- `backend/app/modules/hr/service.py`: `update_employee` → `load_owned`;
- `backend/app/modules/hr/api.py`: PATCH `require_tenant` → 403;
- `backend/app/modules/inventory/service.py`: `update_product` → `load_owned`;
- `backend/app/modules/inventory/api.py`: PATCH `require_tenant` → 403;
- `backend/app/modules/workflow_studio/infrastructure/repositories.py`: `_load_owned_or_raise` for 7 update/delete methods, new `get_owned`; `_enforce_tenant` documented as read-only;
- `backend/app/modules/workflow_studio/api/errors.py`: `TenantRequiredError` → 403;
- `backend/app/modules/workflow_studio/api/publish_router.py`: publish loads the draft with `get_owned`;
- `backend/app/core/application_flow/runtime.py`: `_load_instance_for_update` → `load_owned`;
- `backend/app/core/application_flow/worklist.py`: `execute_task_action` → `load_owned`;
- `backend/app/api/v1/application_flow.py`, `backend/app/api/v1/worklist.py`: `TenantRequiredError` → 403.

**Tests:**
- new `tests/unit/test_n2b_s1_ownership_architecture.py`;
- new `tests/integration/workflow_postgres/test_n2b_s1_strict_mutation_ownership.py`;
- updated:
  - `tests/integration/workflow_postgres/test_n2_global_row_current_behavior.py` (4 xfails → normal);
  - `tests/unit/test_workflow_studio_api.py`: tenant-carrying client, 4 ownership tests, and the template update now asserts 404 (C-2 condition);
  - `tests/unit/test_workflow_studio_infrastructure.py`: UUID tenants;
  - `tests/unit/test_leave_management_architecture.py`: one allowlist entry.

**Docs:**
- this report;
- corrections in `N2B_APPLICATION_OWNERSHIP_HARDENING_PLAN.md` (F-6 withdrawn; F-2/S3 route count 12 → 11) and `N2A_READ_ONLY_GLOBAL_DATA_INVENTORY.md` (erratum withdrawn).

The Leave HTTP create route **does** refuse a tenant-less caller (`api.py::_tenant_uuid` raises 403). The 2026-10-12 "correction" had confused it with the worklist's same-named helper. N-2A's original text was right.

## 6. Remaining Uncovered Mutation Paths and Limitations

- **Workflow engine** (`app/core/workflow/engine.py::WorkflowEngine._load_instance` / `decide_approval`; `integration/resolver.py::FoundationRuntimeStrategy.query`). The same global-admitting idiom is used on Workflow instances. **Not changed:** Workflow is outside this programme's change scope, and it was classified as Workflow domain in N-2B (B-5). It is pinned by `test_out_of_scope_workflow_occurrences_are_exactly_the_recorded_ones`, so it cannot grow silently. It needs its own Workflow-domain phase.
- **Studio version archive/rollback** act on Workflow Registry rows (sentinel tenant): Workflow domain, not changed.
- **Studio simulation/collaboration** are in-memory, process-wide state with no tenant partitioning of their own. Not a DB-row path; out of S1, recorded for the Studio owner.
- **Platform routers** (`dashboard`, `metadata`, `notifications`, `gateway`, `scheduler`, `modules`, `system`, `workflow`, `workflow_registry`): not inventoried for S1, per N-2B §1.7 / B-5.
- **Reads and references** keep global visibility: 8 pinned functions, S4.
- **Creates** still accept tenant-less callers (S3).
- **Database** still allows tenant sessions to write global rows (S5; the N-2 xfail remains).
- **Not proven:** that the whole ERP is free of other ownership defects. S1 covers exactly the inventoried paths in §1.

## 7. Conditions for the GO

- **C-1 — Playwright Studio specs will fail until S2.** `frontend/shell/e2e/fixtures/api-setup.ts` logs in as tenant-less `admin` and creates global workspaces and drafts. Every later Studio mutation (PUT draft, autosave, archive, publish) now returns 403, or 404 for the UI user. The S2 fixture migration (N-2B §5) must land before any Playwright run or deployment of S1. **Playwright was NOT RUN.**
- **C-2 — Studio templates.**
  - `TemplateService.create_template` never assigns a tenant, so every template is a global row.
  - Under S1 no tenant can update or delete any template: the API returns 404, and `test_create_get_update_template` now asserts it.
  - Making templates tenant-owned on create, or platform-managed through S2's platform endpoints, is a create-path and classification decision (N-2B B-3 / S3).
  - **No global-mutation exception was added**, per the brief.
- **C-3 — real data.** In any database where tenants work on global orders, entries, leave requests, employees, products or Studio rows, those actions now fail closed (404). The N-2A test database holds 0 global orders, entries, leave requests, employees or products, and 596/592 global Studio workspaces/drafts (mostly E2E artefacts). Real databases remain uninspected (N-2A O-1).

## 8. Forbidden Scope: Confirmation

None of the following was done:
- S2 platform principals, scope claims or platform endpoints;
- authentication or authorization semantics changes. The only additions are 403 mappings for a missing or malformed tenant on S1 mutation routes; RBAC and JWT are untouched;
- refusing tenant-less creates;
- read visibility or reference-validation changes, including C-2's global-reference behaviour;
- schema, migration, RLS, grant or configuration changes;
- module activation (Inventory's router was mounted only inside the test app);
- capability contract, fingerprint, snapshot or registry changes;
- touching the 269 unpinned form versions;
- cleaning test data, global rows, Studio workspaces or workflow definitions;
- global-row mutation exceptions;
- a commit or push.

## 9. Verdict

```text
CONDITIONAL GO
```

**Why not GO:**
- C-1 knowingly breaks the current Playwright Studio fixtures until S2;
- C-2 disables template editing until templates get an owner.

Both are direct consequences of the approved rule ("global row → 404, no exceptions"), not defects in S1.

**Why not NO-GO:** every inventoried S1 mutation path is strict, proven on real PostgreSQL with RLS both active and bypassed, at the HTTP edge and statically, with 15/15 mutations detected. No guarded regression suite failed.

## 10. Final unit-suite result

**3,773 passed**, 0 failed (`tests/unit --ignore=tests/unit/test_engine_execution.py`, 2026-10-13).

**NOT RUN:**
- `test_engine_execution.py`;
- the full `workflow_postgres` directory in a single invocation (Sales/Accounting order-dependence);
- Vitest;
- Playwright (see C-1).
