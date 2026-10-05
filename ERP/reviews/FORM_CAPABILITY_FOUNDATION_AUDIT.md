# FORM PLATFORM — PHASE 1 — CAPABILITY FOUNDATION AUDIT

**Status:** AUDIT (mandatory pre-implementation gate, brief §2–§3) — COMPLETE
**Decision:** **GO for a minimal implementation** — one new, small core package (`app/core/capabilities/`) plus one real capability registered by the existing Leave Management module. No existing mechanism can be extended without either changing its identity model or inverting a dependency direction (§B, §E).
**Production changes made while writing this audit:** 0
**Date:** 2026-10-05

---

## 0. Method

Every claim below was verified by reading the code it cites, not inferred from earlier review docs. Where an earlier review doc was used, it is cited by name. Verification also included two live checks:

- `LeaveRequestCreate.model_json_schema()` / `LeaveRequestOut.model_json_schema()`, dumped with `backend/.venv/bin/python` (§A.6).
- `pg_class.relrowsecurity` / `relforcerowsecurity` for `leave_management.leave_requests`, and the runtime role's `rolsuper` / `rolbypassrls`, queried against the running `erp_postgres` container (§A.10).

Note on repository state: the project memory says this directory is not a git repository. It is one now, but every file is still only *staged* (`git status` → `A …`) and there are **no commits**. File mtimes and the review docs are still the only real history.

---

## A. Existing Architecture

### A.1 Map

| Concern | Where it lives | Notes |
|---|---|---|
| Business modules (built-in) | `backend/app/modules/{sales,accounting,hr,inventory}` | Plus `workflow_studio`, which is a platform tool and not a business module. |
| Business modules (external) | `backend/external_modules/{leave_management,external_boundary_probe}` | Imported as `external_modules.<name>` (`app/core/module_system/manifest.py:196-208`). |
| Domain + application layer | Per module, in `service.py` (e.g. `external_modules/leave_management/service.py`) | There is no separate `domain/` or `application/` package. The **service is the application layer**; it enforces business rules and owns state transitions (e.g. `LeaveRequestService.submit_request` checks `status != "draft"`, and every check-then-act takes `SELECT … FOR UPDATE`). |
| Contracts / DTOs | Per module, in `schemas.py` (Pydantic v2) | `LeaveRequestCreate`, `LeaveRequestOut`, `CustomerCreate`, `SalesOrderCreate`, `JournalEntryCreate`, … These are the canonical DTOs. |
| Inter-module service contracts | `backend/app/contracts/` | `ServiceContract` ABCs and `ContractRegistry` (§B.1). |
| Persistence | Per module, in `models.py` (SQLAlchemy) + `backend/alembic/versions/*` | Postgres schema per module (`leave_management.leave_requests`). |
| Runtime | `app/core/runtime/engine.py` (`RuntimeEngine`: `service_registry`, `event_bus`, `contract_registry`, …) | |
| Module registry / lifecycle | `app/core/module_system/` (`loader.py`, `lifecycle.py`, `manifest.py`, `cleanup.py`) | `MODULES_PATH` supports multiple roots (Phase 5.11 / F-7). `activate()` is the only caller of `mod.setup(app, service_registry, event_bus)` (`lifecycle.py:421`). Deactivation runs `on_deactivate`, then `ModuleCleanup.full_cleanup`, then `contract_registry.unregister_module` (`lifecycle.py:490-510`). |
| Workflow Platform | `app/core/workflow/**` (engine, Foundation security, …); modules reach it **only** through the frozen `WorkflowServiceContractV1` (`app/contracts/workflow/v1.py`) | Architecture tests enforce this (`tests/unit/test_leave_management_architecture.py`). |
| Application Flow (orchestration) | `app/core/application_flow/` | Flow definitions plus plain-dict seams: actions, workflow steps, task presenters (§B.2). |
| Form / SchemaForm | Frontend only: `frontend/shell/src/components/form/SchemaForm.tsx` (Phase 5.12 Stage B) | The renderer does no field-name branching. Its input is a **feature-authored** `FieldSpec[]` that *mirrors* the DTO. It is **not** generated from backend JSON Schema at runtime: `/openapi.json` is disabled in production (`app/main.py:70`, per the Phase 5.12 doc). |
| Legacy metadata engine | `app/core/metadata_engine/` (`MetaModel`, `ModelField`, `FormSchema`, `TableSchema`, `UiLayout`, `ValidationRule`) + `app/api/v1/metadata.py` CRUD | A pre-existing, generic "dynamic form/table schema" store. No review phase has assessed it (§D, R-10). |
| Permission system | `app/core/auth/dependencies.py` (`UserContext`, `get_current_user`, `require_permission`) → `app/core/auth/rbac.py::RBACEngine.has_permission` | Permission codes are module-declared, `<module>.<resource>.<action>` (e.g. `leave_management.requests.write`, in `module.json` + `ModuleMetadata.permissions`). `PermissionRegistry` is for **listing only** and is never consulted for enforcement (`app/core/registry/permission_registry.py` docstring, Phase 3.1B finding). |
| Tenant context | `app/core/database/context.py` (`_tenant_ctx` ContextVar, `async_tenant_context`, `system_context`) ← `TenantContextMiddleware` (`app/core/multi_tenancy/middleware.py`, JWT `tid` claim only, since 3.0G) | Layer 1 is the service-level filter (`_load_tenant_scoped_request`). Layer 2 is Postgres RLS: `FilteredSyncSession.after_begin` runs `SET LOCAL app.current_tenant_id` from the ContextVar (`app/core/database/filters.py:63-80`). |
| Audit | `app/core/audit/service.py` (`AuditService.record`), `app/api/middleware/audit.py` (`AuditMiddleware`) | Business writes are audited **at the HTTP layer** (POST/PUT/PATCH/DELETE), not by business services. Leave Management's service writes no audit rows of its own. |
| DI | `app/core/registry/service_registry.py` (`ServiceRegistry.register_instance` / `resolve`), reached from modules via `app.contracts.dependencies.get_service_registry()` | Leave registers `LeaveRequestService` in `setup()`. |

### A.2 Leave Management: the real HR leave module

There is **no** leave feature in `app/modules/hr` (grep `-i leave` → only an unrelated hit in `models.py`). The real leave module is `external_modules/leave_management`. Per brief §16, **no parallel HR leave module will be invented.**

| Brief's target shape (§16) | Actual |
|---|---|
| Domain: Leave, LeaveType, LeaveBalance, LeavePolicy | `LeaveRequest` only. `leave_type` is a validated string (`schemas.py:9,18-23`). **There is no LeaveBalance or LeavePolicy.** |
| Application: Create / Update / Cancel / Approve | `create_request`, `submit_request`, `decide_request(approved/rejected)`, `cancel_request`. **There is no update operation.** |
| Contracts: LeaveCreateDTO, LeaveDTO | `LeaveRequestCreate`, `LeaveRequestOut`, `LeaveDecisionRequest` |
| Repository | None. The service queries the ORM directly. |
| Persistence | `leave_management.leave_requests`, RLS-enabled and FORCED (§A.10) |

Per brief §16 ("do not fabricate business rules"), Phase 1 must not invent LeaveBalance, LeavePolicy or an update operation.

### A.3 How the leave operations are reached today

| Operation | HTTP route (authoritative) | Permission | Crosses Workflow? |
|---|---|---|---|
| create | `POST /leave-management/requests` (`api.py:78-88`) | `leave_management.requests.write` | **No** |
| submit | `POST …/{id}/submit` | `…write` | Yes (needs `_workflow_caller_context`) |
| approve / reject | `POST …/{id}/approve` and `…/reject` | `…approve` | Yes |
| cancel | `POST …/{id}/cancel` | `…write` | Yes, when `workflow_instance_id` is set |

The Workflow-crossing routes depend on `_workflow_caller_context` (`api.py:26-55`). It uses the disclosed exception import of `app.core.workflow.security.context` (`AmbientCaller` / `async_caller_context`). `tests/unit/test_leave_management_architecture.py::_ALLOWED_SECURITY_IMPORT_FILES` confines that import to exactly `api.py` and `flow_step.py` (the latter was added in Phase 4.3).

### A.4 Transaction behaviour

The route owns the transaction. The service only `flush()`es, and the route calls `session.commit()` (`api.py:86-87`). Non-HTTP callers (Flow action handlers) open their own unit of work with `DatabaseFactory.get_session()` and commit after the service call (`leave_management/flow_actions.py:79-84`). `DatabaseFactory.get_session()` rolls back on any exception (`app/core/database/factory.py:166-175`).

### A.5 Tenant source of truth

The trusted tenant is `UserContext.tenant_id`, taken from the verified JWT `tid` claim (`dependencies.py:50`). Routes refuse a missing or invalid tenant with 403 (`api.py::_tenant_uuid`). No DTO carries `tenant_id` as **input**. `LeaveRequestOut` carries it as **output** only.

### A.6 JSON Schema from the canonical DTO (live dump)

```json
{"properties": {"leave_type": {"default": "annual", "title": "Leave Type", "type": "string"},
 "start_date": {"format": "date", "title": "Start Date", "type": "string"},
 "end_date": {"format": "date", "title": "End Date", "type": "string"},
 "reason": {"anyOf": [{"maxLength": 2000, "type": "string"}, {"type": "null"}], "default": null, "title": "Reason"}},
 "required": ["start_date", "end_date"], "title": "LeaveRequestCreate", "type": "object"}
```

Pydantic produces a valid JSON Schema with no extra tooling. Two known, already-documented gaps carry over unchanged from Phase 5.12:

- The `leave_type` enum is **not** in the schema; it lives in a validator.
- `end_date ≥ start_date` is not schema-expressible. It is business validation and stays server-authoritative.

### A.7–A.10 Security mechanics verified

- **A.7 Authorization:** `UserContext.has_permission(code)` → `RBACEngine.has_permission` is the single enforcement path, used both by HTTP `require_permission` and by in-process Flow handlers (`flow_actions.py:59`).
- **A.8 Tenant ContextVar:** `async_tenant_context(uuid)` sets it, and `system_context()` / `cross_tenant_context()` set **bypass** flags (`context.py`). Any new execution path must refuse to run under a bypass flag. Otherwise an in-process caller already inside `system_context()` would carry `app.bypass_rls='true'` into a business write.
- **A.9 Module deactivation:** the Application Flow seams (`_HANDLERS`, flow definitions, workflow handlers, task presenters) are **not** cleared on module deactivation. `ModuleCleanup.full_cleanup` (`cleanup.py:212-388`) covers routes, events, services, permissions, contracts, cache and realtime only. A deactivated module's Flow action handler therefore stays invocable in-process. This is **pre-existing**, recorded here as finding **F-1**, and not fixed in this phase. The new capability seam must not repeat it.
- **A.10 RLS, live:** `leave_management.leave_requests` has `relrowsecurity = t` and `relforcerowsecurity = t` in the dev database, and `erp_user` has `rolsuper = f`, `rolbypassrls = f`. RLS is genuinely enforced for the table the first capability writes.

---

## B. Existing Reusable Infrastructure

| Existing mechanism | Location | Purpose | Reusable? | Reason |
|---|---|---|---|---|
| `ContractRegistry` + `ServiceContract` + `ServiceDiscovery` | `app/contracts/{base,registry,discovery,versioning}.py` | Type-keyed DI of inter-module **service interfaces** (ABC → implementation instance), with LSP-style V1/V2 compatibility | **Partly, as a pattern** (module ownership index, `unregister_module`, name+version index). **Not as the registry.** | Its identity is a Python ABC **type**. A capability's identity must be a stable **string** that is independent of Python names (brief §4–§5). Registering capabilities here would mean either a synthetic ABC per business operation (leaking class names into the identity) or turning `resolve_by_name` into a string → arbitrary-callable lookup, i.e. a **service locator** (brief §10). Its "versions" are ABC subclasses, and capability versions are independent DTO contracts. |
| Application Flow action seam | `app/core/application_flow/actions.py:74-99` (`_HANDLERS`, `register_action_handler`, `invoke_action`) | Lets a Flow **Action step** invoke a trusted, module-registered handler by a string name | **Not extended. It is the precedent for the safety model** (string → plain-dict lookup, registration only from trusted `setup()`, no `getattr` / `eval` / `importlib`, which is AST-guarded by `tests/unit/test_application_flow_architecture.py::test_action_registry_is_a_plain_dict_not_a_dynamic_dispatcher`). | (1) It is **owned by Application Flow**. If Form Platform depended on it, one platform capability would depend on another's internals. Capabilities belong *below* Flow, and Flow should become a *consumer* of them (§E). (2) `ActionResult(success, outcome, data)` carries **Flow transition semantics** and opaque display data, not a canonical output contract. (3) No metadata: no input/output contract, permission, version, status or schema. Each handler re-implements its own permission check (`flow_actions.py:59`). (4) Last-writer-wins registration with no namespace ownership. (5) Not cleaned up on deactivation (F-1). Re-shaping it would change 4 modules' handlers (sales, accounting, leave, probe), and brief §23 forbids unrelated refactoring. |
| `ServiceRegistry` | `app/core/registry/service_registry.py` | Typed DI container for service instances | **Reused by the capability handler** to resolve `LeaveRequestService`, exactly as `api.py::_get_service` and `flow_actions.py` already do | The capability handler is module-owned trusted code. Resolving its own module's service this way is the established pattern. |
| `UserContext` + `RBACEngine` | `app/core/auth/{dependencies,rbac}.py` | Authenticated caller and the single permission-enforcement path | **Reused as-is.** It is the capability layer's caller type. | Brief §13: do not build a second authorization system. |
| `async_tenant_context` / bypass accessors | `app/core/database/context.py` | Tenant ContextVar → ORM filter + RLS `SET LOCAL` | **Reused as-is** | Brief §12: integrate, don't duplicate. |
| `DatabaseFactory.get_session()` | `app/core/database/factory.py:166` | Standalone unit of work with rollback on error | **Reused as-is** | Same mechanism `flow_actions.py` and the scheduler/notifications/event-bus code use. |
| Canonical Pydantic DTOs + `model_json_schema()` | per-module `schemas.py` | Input/output contracts and JSON Schema | **Reused by reference.** The registry stores the DTO *type* and publishes its schema. It never defines a DTO. | Brief §7 ownership rule. |
| Permission codes in module manifest | `module.json` / `ModuleMetadata.permissions` | Module-declared permission catalogue | **Referenced** (a capability names an existing code) | |
| `ERPModule.setup()` / `on_deactivate()` hooks | `app/core/module_system/base.py:187-228` | Module lifecycle | **Reused.** Register in `setup()` and unregister in `on_deactivate()`, both module-owned. | **No `module_system` change is needed.** |
| `MetaModel` / `FormSchema` / `UiLayout` | `app/core/metadata_engine/` | Legacy DB-stored dynamic entity/form definitions | **No (Phase 1).** Must be assessed in Phase 2. | Phase 1 defines no forms. Its `MetaModel` / `ModelField` describe **dynamic entities**, which is the "arbitrary table generator" shape brief §17 forbids. Phase 2 (Form Definition) must decide whether `FormSchema` is reused, wrapped, or formally retired, and must not silently build a second form store next to it (R-10). |
| Frontend `SchemaForm` | `frontend/shell/src/components/form/SchemaForm.tsx` | Field-name-free renderer over `FieldSpec[]` | **Untouched.** Must not depend on the registry (brief §15). | The dependency direction is Registry → (future) Form Runtime → SchemaForm. Phase 1 changes 0 frontend files. |

**No existing "command bus", "use case" or "capability" abstraction exists.** Grep for `capabilit` outside `app/core/workflow/` finds only prose mentions of "Field Capability" and Workflow Studio's unrelated `ServiceCapability` (plugin negotiation flags).

---

## C. Architectural Gaps

```text
Business Module ──► Business Capability ──► Capability Registry ──► External Consumer
     (exists)          (MISSING)               (MISSING)             (Form Platform: future)
```

| # | Gap | Evidence |
|---|---|---|
| G-1 | **No implementation-independent identity for a business operation.** Today an operation is identified by an HTTP route (`POST /leave-management/requests`), a service method (`LeaveRequestService.create_request`), or a Flow-owned action name (`leave_management.create_leave_request`), all of which are implementation-shaped. | §A.3, §B |
| G-2 | **No discoverable metadata** binding an operation to its input/output contract, its permission, its owner module, its version and its status. A consumer such as a Form Builder cannot list "what can I bind a form to?" | §B row 2 (Flow seam has none) |
| G-3 | **No uniform execution path** that applies validation, authorization, tenant context and the transaction boundary once, outside HTTP. Each Flow handler re-implements permission + tenant parsing + session handling (`flow_actions.py:59-84`). | §A.4 |
| G-4 | **No versioning** for business operations. | §B row 2 |
| G-5 | **No namespace ownership.** Nothing stops module X registering a name in module Y's namespace (Flow seam: last-writer-wins). | `actions.py:77-83` |
| G-6 | **No lifecycle cleanup** for named operations (F-1). | §A.9 |

---

## D. Risks

| # | Risk | Assessment | Mitigation in the design |
|---|---|---|---|
| R-1 | Framework leakage | The descriptor would expose Python types if it stored them in public metadata. | Public metadata (`describe()`) is plain JSON: ids, strings, JSON Schema. DTO types and the handler stay internal. `UserContext` is imported from `app.core.auth.dependencies`, which imports FastAPI at module level. The *type* is a plain dataclass, but the import pulls in FastAPI. This is **residual**: it is the same import the Flow seam already makes, and moving `UserContext` is an unrelated auth refactor. |
| R-2 | Service-class coupling | A consumer could import `LeaveRequestService`. | Consumers use `execute_capability("<id>", payload, caller=…)`. An AST architecture test proves the consumer test module imports no `leave_management` symbol. |
| R-3 | Database coupling | A form could write the table directly. | The capability layer has no ORM/model imports (AST-guarded). The handler calls the module's own service. |
| R-4 | Arbitrary execution | String → callable dispatch could become `getattr` / `eval` / `importlib`. | Plain dict lookup, populated only by trusted `setup()` code. A source guard identical to the Flow seam's forbids `getattr(`, `eval(`, `exec(`, `importlib.import_module`, `__import__(` in the package. |
| R-5 | Tenant bypass | Tenant taken from the payload, or execution under `system_context()`. | Tenant comes **only** from `caller.tenant_id`. Registration **rejects** an input contract that declares a `tenant_id` field. Execution refuses under any tenant/soft-delete bypass flag, and refuses if an ambient tenant ContextVar disagrees with the caller's tenant. The executor opens the session *inside* `async_tenant_context`, so `after_begin` sets RLS. |
| R-6 | Permission bypass | The capability layer could forget, or duplicate, authorization. | One mandatory check, before the handler runs, through `UserContext.has_permission`, i.e. the existing RBAC. The descriptor only *names* an existing code, and registration enforces that the code is in the owning module's namespace. |
| R-7 | Unversioned contracts | | `(id, version: int ≥ 1)` is the registry key from day one (§E). |
| R-8 | Unstable identifiers | | `<module>.<resource>.<action>`, snake_case, regex-validated, and the first segment **must equal** the owning module's name (namespace ownership, fixes G-5). |
| R-9 | Runtime introspection of implementation details | | `describe()` never returns handler names, qualnames, or module paths. A test asserts this. |
| R-10 | **Duplicate registries / stores** | (a) The Flow action seam and the capability registry are now two string-keyed registries of business operations. (b) The legacy `metadata_engine.FormSchema` store versus a future Form Definition store. | (a) **Accepted, disclosed debt.** Convergence = Flow Action step → `execute_capability` in a later phase. Not done now (brief §23, no unrelated refactor). (b) Out of Phase 1 scope. **Phase 2 must assess `metadata_engine` first.** |
| R-11 | Circular dependencies | Core importing a module. | `app/core/capabilities` imports only `app.core.auth.dependencies`, `app.core.database.{context,factory}` and pydantic. The module imports core, never the reverse (AST-guarded). |
| R-12 | **Core Freeze policy** (Phase 5.11 §B17: core changes need evidence from a real module) | A new core package is a core-capability change. | Evidence: a named consumer (this brief's Form Platform program) plus a real module operation (Leave create) that today has no implementation-independent identity (G-1..G-3). The change is **additive** (a new package, 0 lines changed in existing core files). The Phase 5.12 verdict "Form Builder = DEFERRED" is **respected**: no Form Builder, form definition, UI or designer is built here. |
| R-13 | Audit gap for in-process execution | `AuditMiddleware` audits HTTP writes only. An in-process capability execution, like an in-process Flow action today, writes no `AuditLog` row. | **Disclosed, not fixed.** Phase 1 has no HTTP execution endpoint. When the Form Runtime adds one (Phase 2/3), it inherits `AuditMiddleware` automatically. The executor does emit a structured log line per execution. |
| R-14 | Process-global registry versus module re-activation | `setup()` runs again on every (re)activation, and the test suite builds many apps in one process. Strict "duplicate → error" for an owner's re-registration would break re-activation. | Re-registering the **same `(id, version)` by its owning module** replaces the entry, which is idempotent re-activation. Registration from any other module is rejected by namespace ownership. `on_deactivate` unregisters the module's capabilities (fixes G-6 for this seam). |

---

## E. Recommendation: the smallest architecture that establishes the boundary

1. **New core package `app/core/capabilities/`**, deliberately small:
   - `contract.py`: `CapabilityDescriptor` (frozen dataclass: `id`, `version`, `module` / `resource` / `action` derived from the id, `display_name`, `description`, `input_contract`, `output_contract` as Pydantic types, `permission`, `tenant_scoped`, `status`), `CapabilityStatus` (`active` / `deprecated` / `disabled`), `CapabilityContext` (what a handler receives: `caller`, `tenant_id`, `session`), the id grammar, and `describe()` → plain JSON metadata including the input/output JSON Schema.
   - `registry.py`: `CapabilityRegistry` with `register`, `resolve(id, version=None)` (deterministic), `get_descriptor`, `list_capabilities`, `describe`, `unregister_module`, plus a process-global `capability_registry`. **No handler is exposed through any public read method.**
   - `executor.py`: `execute_capability(id, payload, *, caller, version=None)`. Order: resolve → status gate → **authorization** → tenant resolution and bypass refusal → **input validation against the canonical DTO** → `async_tenant_context` → `DatabaseFactory.get_session()` → handler → output-contract check → commit (rollback on any error).
   - `errors.py`: typed, transport-neutral errors (not found, not executable, permission denied, tenant required/mismatch/bypass, input invalid, business-rule rejected, contract violation).
2. **The Leave Management module publishes one capability:** `leave_management.leave_request.create` v1 (input `LeaveRequestCreate`, output `LeaveRequestOut`, permission `leave_management.requests.write`). It does this through a new module-owned `capabilities.py` whose handler calls `LeaveRequestService.create_request`, the same service the HTTP route calls. It registers in `setup()` and unregisters in `on_deactivate()`.
   - **Deferred, with reasons:** `submit` / `approve` / `reject` / `cancel` cross the Workflow caller-identity bridge (`AmbientCaller`). An architecture test confines that bridge to `api.py` and `flow_step.py`. Adding a third file (`capabilities.py`) would widen a disclosed security exception, which is a separate, explicit decision. `update` **does not exist** in the module, so it is not fabricated.
3. **0 changes** to: `app/contracts`, `app/core/application_flow`, `app/core/module_system`, `app/core/workflow`, `app/core/auth`, `app/core/database`, the frontend, migrations, dependencies.
4. **No HTTP surface in Phase 1.** Discovery and execution are in-process APIs. A read-only discovery endpoint and the Form Runtime execution endpoint belong to Phase 2/3, where the audit and exposure questions (R-13) are decided with a real consumer.
5. **ID convention:** `<module>.<resource>.<action>`, where `<module>` is the **owning module's registered name** (`leave_management`, not a conceptual "employee" or "hr"). That makes ownership machine-checkable. The brief's `employee.leave.create` is illustrative. The real id is `leave_management.leave_request.create`.
6. **Tests:** unit tier (registry/contract/executor with test-only DTOs and an in-memory handler, no ORM import, respecting the `Base.metadata` pollution rule) + AST architecture tier + **real PostgreSQL integration tier** (real module activation, real service, real RLS-enabled table, cross-tenant and permission denial, and an independent read-back over the module's real HTTP `GET`).
