# FORM PLATFORM — PHASE 1 — CAPABILITY FOUNDATION READINESS

**Status:** **GO-WITH-CONDITIONS**
**Date:** 2026-10-05
**Audit (pre-implementation gate):** `FORM_CAPABILITY_FOUNDATION_AUDIT.md`
**Architecture:** `../CAPABILITY_PLATFORM.md`

---

## 1. Executive Summary

Phase 1 adds one small core package, `backend/app/core/capabilities/` (546 lines), and publishes one **real** business capability from the existing Leave Management module: `leave_management.leave_request.create` v1.

A consumer can now discover that operation, get its input/output JSON Schema, and execute it **by id only**. Execution runs through the existing authorization (`UserContext` → `RBACEngine`), the existing tenant context (ContextVar → PostgreSQL RLS `SET LOCAL`), the module's own DTO validation, and the module's own `LeaveRequestService`.

This was proven against **real PostgreSQL with RLS enabled and FORCED**, through real module activation and deactivation, with independent read-back over the module's real HTTP route. A mutation check showed the RLS proof is load-bearing (§7.3).

**Why GO-WITH-CONDITIONS, not GO:** only **one** capability is published, it is the *create* operation, and it has no HTTP surface or audit trail. The foundation is architecturally sound, but Phase 2 must start under the named conditions in §13.
**Why not NO-GO:** every Definition-of-Done item is met with real-database evidence. Nothing found blocks Phase 2.

---

## 2. Implemented

| Piece | File | Lines |
|---|---|---|
| Capability contract: `CapabilityDescriptor`, `CapabilityStatus`, `CapabilityContext`, id grammar, `describe()` | `backend/app/core/capabilities/contract.py` | 168 |
| Registry: register / resolve / get_descriptor / describe / list / unregister_module | `backend/app/core/capabilities/registry.py` | 141 |
| Executor: the single execution path | `backend/app/core/capabilities/executor.py` | 114 |
| Typed, transport-neutral errors | `backend/app/core/capabilities/errors.py` | 65 |
| Public API | `backend/app/core/capabilities/__init__.py` | 58 |
| Leave capability (descriptor + handler) | `backend/external_modules/leave_management/capabilities.py` | 71 |
| Registration in `setup()`, withdrawal in `on_deactivate()` | `backend/external_modules/leave_management/module.py` | +17 |
| Architecture documentation (with Mermaid diagrams) | `docs/architecture/CAPABILITY_PLATFORM.md` | — |

**Explicitly not implemented** (brief §17, all verified 0): Form Builder UI, designer, form definitions, table/SQL/ORM generators, dynamic code or method execution, rule engine, Workflow / permission / tenant replacement, direct form writes, HTTP endpoints, frontend changes, migrations, dependencies.

## 3. Reused (not rebuilt)

| Existing mechanism | How it is reused |
|---|---|
| `UserContext.has_permission` → `RBACEngine` (`app/core/auth/`) | The **only** authorization check. The descriptor names an existing permission code. |
| `async_tenant_context` / `get_tenant_id` / `is_tenant_filter_bypassed` (`app/core/database/context.py`) | Tenant binding, ambient-mismatch check, bypass refusal |
| `FilteredSyncSession.after_begin` RLS `SET LOCAL` (`app/core/database/filters.py`) | Reached automatically because the session opens inside the tenant context |
| `DatabaseFactory.get_session()` | The unit of work, with rollback on error. Same as Flow actions, scheduler and notifications. |
| `ServiceRegistry` / `get_service_registry()` | The handler resolves `LeaveRequestService` exactly as `api.py` does |
| `api.py::_out` | The handler reuses the module's own ORM → `LeaveRequestOut` mapping, so the capability output is byte-identical to the HTTP response (§7.2). |
| `LeaveRequestCreate` / `LeaveRequestOut` + `model_json_schema()` | Input/output contracts and JSON Schema, by reference |
| `ERPModule.setup()` / `on_deactivate()` | Registration lifecycle. **0 `module_system` changes.** |
| Application Flow's plain-dict + no-dynamic-dispatch safety model | Copied as a *pattern*, with the same source guard |

## 4. New infrastructure, and why it is not a duplicate

One package, `app.core.capabilities`. The audit (§B) shows why neither candidate could be extended:

- **`ContractRegistry`** is keyed by Python ABC type. Using it would leak class identity into the capability id or turn it into a string service locator.
- **The Application Flow action seam** is Flow-owned. Its `ActionResult` carries transition semantics, it has no metadata, versioning, namespace ownership or deactivation cleanup, and Form Platform depending on it would invert the dependency direction.

**Deliberately NOT created:** a new principal or identity type (`UserContext` is reused), a permission registry, a tenant mechanism, an HTTP layer, a DI container, and a contract-versioning framework.

## 5. Capabilities registered

| Key | Input → Output | Permission | Tenant | Status |
|---|---|---|---|---|
| `leave_management.leave_request.create:v1` | `LeaveRequestCreate` → `LeaveRequestOut` | `leave_management.requests.write` | required | active |

**Not registered, with reasons:**

| Brief's candidate | Reason |
|---|---|
| `…leave_request.submit` / `approve` / `reject` / `cancel` | Each crosses the Workflow caller-identity bridge (`AmbientCaller` / `async_caller_context`). `tests/unit/test_leave_management_architecture.py` confines that disclosed security import to `api.py` and `flow_step.py`. A capability handler would be a **third** file, which widens a security exception and needs its own decision (condition C-2). |
| `…leave_request.update` | **No update operation exists** in `LeaveRequestService`. Not fabricated (brief §16). |
| LeaveBalance / LeavePolicy | They don't exist in the domain. Not fabricated. |

## 6. Tests

New tests (all pass):

| File | Tier | Tests | Covers |
|---|---|---|---|
| `tests/unit/test_capability_registry.py` | unit | 29 | Id grammar, version validation, namespace-scoped permission, `tenant_id`-in-input rejection, non-Pydantic contracts, `describe()` JSON-only and leak-free, register/resolve, unknown id/version, cross-module registration rejected, owner re-registration replaces, sync handler rejected, deterministic version resolution (active/deprecated/disabled, order-independent), list sorting and filtering, `unregister_module`, no handler via the public API, the real leave contract, the module's own validators |
| `tests/unit/test_capability_executor.py` | unit | 17 | Happy path (one commit, tenant ContextVar = caller's, restored afterwards), injected `tenant_id` ignored, structured field errors with no session opened, non-object payload, wrong output contract → rollback, module rejection → rollback, unknown id, disabled version, **authorization before validation**, `*.*.*` through `RBACEngine`, missing/empty/malformed tenant, **cross-tenant ambient mismatch**, `system_context` / `cross_tenant_context` refused |
| `tests/unit/test_capability_architecture.py` | unit (AST) | 6 | Package import allowlist, no module/framework/ORM/Workflow/Flow/contracts imports, no dynamic dispatch, **consumer imports no leave symbol (brief §19)**, dependency direction |
| `tests/integration/workflow_postgres/test_capability_leave_management.py` | **real PostgreSQL + real HTTP** | 9 | §7 below |

The executor unit tests replace `DatabaseFactory.get_session` with a recording fake **only** to count commit/rollback. Everything else is production code. The same flows run unfaked on real PostgreSQL.

Modified test: `tests/unit/test_leave_management_architecture.py` adds `"app.core.capabilities"` to `_ALLOWED_APP_PREFIXES`. This is a disclosed allowlist extension with the same shape as Phase 4.3's `app.core.application_flow` entry.

### 6.1 Regression (four separate invocations, per the Phase 3.1C/3.7 rule)

| Invocation | Baseline (before) | After |
|---|---|---|
| `pytest tests/architecture` | 8 passed | **8 passed** |
| `pytest tests/unit --ignore=tests/unit/test_engine_execution.py` | 3,515 passed | **3,567 passed** (+52 new) |
| `pytest tests/integration --ignore=tests/integration/workflow_postgres` | 179 passed, 5 skipped | **179 passed, 5 skipped** |
| `pytest tests/integration/workflow_postgres` (real PG) | 126 passed | **135 passed** (+9 new) |
| `pytest tests/unit/test_engine_execution.py` (isolated) | not run pre-change | 68 passed, **27 failed**. See note below. |
| **Total** | **3,828 passed, 5 skipped, 0 failed** | **3,889 passed, 5 skipped, 0 failed** (+61 = exactly the new tests) |

**Note on `test_engine_execution.py`:** all 27 failures are the same error, `RuntimeError: There is no current event loop in thread 'MainThread'`, in sync tests of the FROZEN `app/core/workflow/engine_execution` component. That is the event-loop fragility already documented for this file since Phase 3.1B. Neither that file nor the component changed in this phase (`find -newer` shows nothing), and neither references anything this phase added (grep for `capabilit|leave_management`: 0 hits). **Limitation, disclosed:** this file was not run in isolation *before* the change, so there is no same-day before/after pair for it. The attribution to the pre-existing defect rests on the unchanged-inputs argument above, not on a baseline comparison.

Static checks on the new and changed code: `ruff check` → *All checks passed*. `mypy app/core/capabilities` → **0 errors in the package**. The run prints 100 errors in 36 pre-existing files mypy follows transitively, e.g. `app/core/runtime/engine.py:498`. Those are untouched by this phase.

## 7. Security verification (real PostgreSQL)

### 7.1 Evidence matrix

| Scenario | Result | Test (`test_capability_leave_management.py`) |
|---|---|---|
| Activation publishes; `describe()` exposes contract and schema | `[…create:v1]`, schema props = DTO fields | `test_module_activation_publishes_and_deactivation_withdraws_the_capability` |
| Deactivation withdraws | `resolve` and `execute` → `CapabilityNotFoundError` | same |
| Re-activation re-publishes | v1 resolves again | same |
| Execute by id → real row, caller's tenant, module's initial state (`draft`) | ✅ | `test_capability_creates_a_real_leave_request_in_the_callers_tenant` |
| Independent HTTP read-back, same tenant | 200, **body == capability output** | same |
| HTTP read-back, other tenant | **404** | same |
| HTTP route and capability share one contract | Identical key sets, both `draft` | `test_capability_and_http_route_share_one_contract` |
| `tenant_id` injected into payload | Ignored; row in caller's tenant; none under the victim's | `test_tenant_id_injected_into_the_payload_is_ignored` |
| Caller lacks `…requests.write` | `CapabilityPermissionDeniedError`; 0 rows written | `test_unauthorized_caller_is_denied_and_nothing_is_written` |
| Caller has no tenant | `CapabilityTenantError` | `test_missing_tenant_context_is_refused` |
| Request bound to tenant A, caller claims B | `CapabilityTenantError`; 0 rows in B | `test_cross_tenant_execution_attempt_is_refused` |
| `end_date < start_date` | Module's own validator message in `CapabilityInputError.errors`; 0 rows | `test_domain_validation_stays_in_the_module` |

### 7.2 What makes the HTTP equivalence meaningful

`own.json() == out` compares the module's real `GET` response (real JWT, real `require_permission`, real service tenant filter) with the capability's output **field by field**. The capability is not a parallel implementation of the operation. It reaches the same service and the same mapping.

### 7.3 Tenant isolation verification (RLS, layer 2)

`test_rls_isolates_the_capability_written_row_at_the_database_layer` first **asserts its own preconditions** against the live catalog:

- `leave_management.leave_requests` has `relrowsecurity` and `relforcerowsecurity` set.
- `current_user` has neither `rolbypassrls` nor `rolsuper`.

Then it counts the capability-written row with raw SQL, bypassing the service-layer filter entirely, under three contexts:

| Context | Count |
|---|---|
| Tenant A | **1** |
| Tenant B | **0** |
| No tenant | **0** (fail-closed) |

**Mutation check (performed, then reverted):** I changed the executor's `async_tenant_context(tenant)` to `async_tenant_context(None)`. Real PostgreSQL then rejected every capability INSERT with `asyncpg.exceptions.InsufficientPrivilegeError: new row violates row-level security policy for table "leave_requests"`, and **4 of 9 integration tests failed**. With the original line restored, all 9 pass. The executor's tenant binding is what makes these writes possible under RLS, so the proof isn't vacuous.

## 8. Architecture boundary verification (AST, permanent)

| Rule | Test |
|---|---|
| `app.core.capabilities` imports only `app.core.capabilities`, `app.core.auth.dependencies`, `app.core.database.context`, `app.core.database.factory` + `pydantic` (+ `sqlalchemy.ext.asyncio` for a type hint) | `test_capability_package_imports_only_the_approved_platform_primitives` |
| Never `app.modules`, `external_modules`, `fastapi`, `starlette`, `sqlalchemy.orm`, `app.core.workflow`, `app.core.application_flow`, `app.contracts`, `app.core.metadata_engine`, `app.core.database.base`, `app.api` | `test_capability_package_never_imports_a_business_module_or_framework` |
| No `getattr(` / `eval(` / `exec(` / `importlib.import_module` / `__import__(` | `test_capability_resolution_is_a_plain_dict_lookup_not_dynamic_dispatch` |
| The consumer imports no `external_modules`, `leave_management` or `app.modules` module, none of `LeaveRequestService` / `LeaveRequest` / `LeaveRequestCreate` / `LeaveRequestOut` / `router` / the handler / the descriptor, and does import `app.core.capabilities` | `test_consumer_executes_a_real_capability_without_knowing_its_implementation` |
| Module → platform, never the reverse | `test_owning_module_depends_on_the_platform_never_the_reverse` |
| Leave Management keeps its own import allowlist, extended by exactly one seam | `test_leave_management_app_imports_are_all_on_the_approved_allowlist` |

## 9. Findings disclosed during this phase

| # | Finding | Severity | Action |
|---|---|---|---|
| **F-1** | Application Flow seams (`_HANDLERS`, flow definitions, workflow handlers, task presenters) are **not cleared on module deactivation** (`ModuleCleanup.full_cleanup` has no Flow step). A deactivated module's Flow action handler stays invocable in-process. | Medium | **Pre-existing; not fixed** (Flow is out of scope). The capability seam does not repeat it (proven in §7.1). |
| **F-2** | `ModuleCleanup.unregister_routes` (`app/core/module_system/cleanup.py:212-229`) assigns `app.routes = [...]`. On FastAPI 0.115.6 that is a read-only property, so the call fails and is only logged: `Route cleanup failed for 'leave_management': property 'routes' of 'FastAPI' object has no setter`. **A deactivated module's HTTP routes therefore stay mounted until process restart.** Reproduced in the **unmodified** `test_leave_management_real_flow.py` (5 occurrences in one run), so it is not caused by this phase. Authentication, permission and tenant checks still apply on those routes, so this is a lifecycle-integrity defect, not a privilege escalation. | **High** (lifecycle) | **Pre-existing; not fixed.** It is a `module_system` core change outside this brief. Recommended as its own small hardening item before any "deactivate = stop serving" guarantee is relied on. |
| F-3 | The audit's first draft said the Workflow security import was confined to `api.py`. The architecture test allows `api.py` **and** `flow_step.py`. | Doc accuracy | Corrected in the audit and in `capabilities.py`. |
| F-4 | The repository is a git repo with every file staged and **no commits**. The project memory says it is not a git repo. | Info | Noted. History is still mtime-only. |

## 10. Architecture risks (post-implementation)

| Risk | State |
|---|---|
| R-10a: two string-keyed operation registries (Flow actions and capabilities) | **Open, disclosed.** Convergence = Flow Action step calls `execute_capability`. |
| R-10b: legacy `metadata_engine.FormSchema` / `UiLayout` store versus a future Form Definition store | **Open.** Must be assessed at the start of Phase 2. |
| R-13: no `AuditLog` row for in-process executions | **Open.** It closes automatically for HTTP execution through `AuditMiddleware`. In-process callers get a structured log line only (`capability.executed key=… user=… tenant=…`, `capability.denied …`). |
| R-1: `UserContext` lives in a module that imports FastAPI | **Residual, accepted.** The type is a plain dataclass, and the Flow seam has the same import. |
| R-14: process-global registry | **Mitigated.** Namespace ownership, owner-only idempotent replace, and module-owned unregistration on deactivate. |
| Core Freeze (Phase 5.11 §B17) | **Respected.** Additive core change backed by a named consumer and real-module evidence. 0 lines changed in existing core files. |

## 11. Remaining gaps

1. **Only `create` is published.** Lifecycle operations need the Workflow caller-bridge decision (C-2).
2. **No HTTP discovery or execution endpoint** (deliberate). The Form Runtime phase needs one, with response mapping for the typed errors and an exposure policy for `describe()`, e.g. whether to list only capabilities the caller is permitted to execute.
3. **Schema expressiveness gaps from Phase 5.12 are unchanged:** the `leave_type` enum lives only in a validator, so it is absent from the JSON Schema; relations are bare `uuid`; there is no `Field(description=…)` help text. These are module-DTO changes, not registry changes.
4. **Audit trail for in-process execution** (R-13).
5. **F-1 and F-2** lifecycle-cleanup defects in Flow and module_system.
6. **Only one consumer shape is proven** (direct in-process call). Flow, integration runtime and Workflow as consumers are documented, not built.

## 12. Definition of Done

| Item | Status |
|---|---|
| Existing architecture audited first | ✅ `FORM_CAPABILITY_FOUNDATION_AUDIT.md`, written before any code |
| No duplicate registry created unnecessarily | ✅ §4. One remaining overlap is disclosed (R-10a). |
| Capability Contract exists | ✅ `contract.py` |
| Capability Registry exists | ✅ `registry.py` |
| Capability IDs implementation-independent | ✅ Grammar plus leak tests |
| Metadata discoverable | ✅ `list_capabilities` / `describe` |
| Input contract discoverable | ✅ `describe()["input"]["contract"]` |
| JSON Schema obtainable | ✅ `describe()["input"/"output"]["schema"]`; generation checked at registration |
| Execution resolves internally to application logic | ✅ Real PG: id → registry → executor → handler → `LeaveRequestService` |
| Consumers don't depend on service classes | ✅ AST-enforced on the real consumer |
| Existing authorization authoritative | ✅ `UserContext` → `RBACEngine`, no second system |
| Existing tenant isolation authoritative | ✅ ContextVar → RLS, mutation-proven |
| Domain rules stay in modules | ✅ Module DTO validators and service; platform adds none |
| One real capability integrated | ✅ `leave_management.leave_request.create` v1 |
| Tests exist | ✅ 61 new (52 unit/AST + 9 real-PG) |
| Architecture documentation exists | ✅ `CAPABILITY_PLATFORM.md` with Mermaid |
| No Form Builder UI | ✅ 0 frontend files |
| No business logic moved into the platform | ✅ |
| No database-generation mechanism | ✅ 0 migrations, 0 models |

## 13. Final Gate Decision: **GO-WITH-CONDITIONS**

**Recommendation for the next phase:** proceed to **PHASE 2 — FORM DEFINITION + VERSIONING**, not the visual Form Builder, under these conditions:

- **C-1:** Phase 2 **starts by assessing `app/core/metadata_engine`** (`FormSchema`, `UiLayout`, `MetaModel`) and decides reuse, wrap, or formal retirement **before** creating any form-definition store. No second form store may be built silently (R-10b).
- **C-2:** a form definition binds to an exact **`(capability id, version)`** and stores no business semantics. Binding beyond `create` (lifecycle actions) first needs an explicit decision on extending the Workflow caller-identity bridge to module `capabilities.py` files.
- **C-3:** any HTTP surface added for discovery or execution must reuse the typed errors and inherit `AuditMiddleware`, and must decide whether discovery is filtered by the caller's permissions.
- **C-4:** F-2 (route cleanup on deactivation) should be scheduled as a separate small hardening item. It doesn't block Phase 2, but nothing in the Form Platform may rely on "deactivated module = unreachable" over HTTP until it is fixed.

**Why not the stronger GO:** the foundation has exactly one capability, no HTTP or audit path, and two open overlaps (R-10a/b) that Phase 2 must resolve rather than inherit by accident.

**Why not the weaker verdict:** every boundary the brief requires is enforced by a permanent test, and the security-relevant ones are proven on real PostgreSQL with a mutation check, not only on mocks.

## 14. Files Changed

**New (production):** `backend/app/core/capabilities/{__init__,contract,registry,executor,errors}.py`, `backend/external_modules/leave_management/capabilities.py`
**Modified (production):** `backend/external_modules/leave_management/module.py` (+`on_deactivate`, +capability registration in `setup()`)
**New (tests):** `backend/tests/unit/test_capability_{registry,executor,architecture}.py`, `backend/tests/integration/workflow_postgres/test_capability_leave_management.py`
**Modified (tests):** `backend/tests/unit/test_leave_management_architecture.py` (+1 allowlist entry)
**Docs:** `docs/architecture/CAPABILITY_PLATFORM.md`, `docs/architecture/reviews/FORM_CAPABILITY_FOUNDATION_AUDIT.md`, this file

**Unchanged (verified with `find -newer` against the pre-change baseline marker):** `app/contracts`, `app/core/application_flow`, `app/core/module_system`, `app/core/workflow`, `app/core/auth`, `app/core/database`, `app/api`, `alembic/`, `frontend/`, `requirements*.txt`.
