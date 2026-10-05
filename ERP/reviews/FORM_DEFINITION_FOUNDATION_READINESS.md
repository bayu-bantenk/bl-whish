# FORM PLATFORM — PHASE 2 — FORM DEFINITION FOUNDATION READINESS

**Status:** **GO-WITH-CONDITIONS**
**Metadata audit result:** **NEW BOUNDARY** (`FORM_DEFINITION_METADATA_AUDIT.md`)
**Is the Form Definition foundation safe enough to begin building the Visual Form Builder?** **Not yet: NO for Phase 3 as of today.** The foundation itself is sound and every Phase 2 Definition-of-Done item is met with real-PostgreSQL evidence. But a builder UI has two hard prerequisites that do not exist yet (§16, B-1 and B-2). Per brief §45, Phase 3 must not start until they are closed and this report is re-issued as **GO**.
**Date:** 2026-10-05
**Architecture:** `../FORM_DEFINITION_PLATFORM.md`

---

## 1. Executive Summary

Phase 2 adds a new platform boundary, `app/core/form_platform`. It stores tenant-owned **Form Definitions** (stable key) and **Form Versions**. Each version is bound to an **exact** capability id and version, carries a validated presentation document (fields, sections, safe declarative rules), and moves through a lifecycle (draft → review → published → archived).

The boundary is exposed through a thin HTTP API: `/api/v1/form-definitions` and `/api/v1/form-runtime`. The Form Runtime resolves the single published version and executes it **only** through the Phase 1 capability executor. In the reference case, `employee_leave_request:v1` → `leave_management.leave_request.create:v1` → `LeaveRequestService` → PostgreSQL.

Published versions are immutable at **two independent layers**: the service, and a PostgreSQL trigger that a mutation run showed holds on its own. Tenant isolation holds at **two independent layers**: service filters, and forced RLS, which a mutation run showed holds on its own. Capability-version pinning is mutation-proven too.

The gate decisions approved by you at the audit gate: NEW BOUNDARY with persistence, the DB trigger, F-5 documented and deferred, and a thin HTTP API.

## 2. Metadata audit result: NEW BOUNDARY

`metadata.form_schemas` / `ui_layouts` / `meta_models` were found to be:
- dormant (0 rows; no frontend or module consumer),
- coupled to dynamic entities and table names,
- unversioned, mutable in place,
- holding unvalidated JSON,
- tenanted by a **client-supplied, NULL-by-default `tenant_id`** that RLS treats as global (**F-5, HIGH**).

Extending them would have changed every property and left the live legacy API writing the old semantics into the same tables. `metadata_engine` is **untouched**; the new package may not import it (AST test).

## 3. Existing infrastructure reused

| Reused | How |
|---|---|
| Capability registry + executor (Phase 1) | The only route from a form to business behaviour. `resolve(id, version)` for binding and schema, `execute_capability(…, version=pinned)` for submission. **0 Phase 1 changes.** |
| `UserContext` → `RBACEngine`, `require_permission` | All authorization, using ordinary `core.forms.*` codes (the same convention as `core.metadata.*` / `core.workflow.*`) |
| Tenant ContextVar + `TenantContextMiddleware` + `rls.enable_statements` | Tenant binding and RLS (the identical shared policy) |
| `AuditService.record` | Lifecycle audit in the same transaction. **No second audit system.** |
| Core-schema conventions of Phase 4.4 | `pg_schema`, `_CORE_SCHEMAS`, static `alembic/env.py` import, raw schema-qualified SQL migration, SQLite branch |
| `SchemaForm` / `FieldSpec` | The render model emits `FieldSpec`-shaped fields. **SchemaForm unchanged.** |

## 4. New infrastructure

| Item | Size |
|---|---|
| `app/core/form_platform/{models,presentation,service,runtime,errors,__init__}.py` | 989 lines |
| `app/api/v1/form_platform.py` (2 routers, 12 routes) | 257 lines |
| Migration `c3d4e5f6a7b8_form_platform_definitions` (2 tables, RLS, partial unique index, trigger) | 210 lines |
| Wiring | `api/v1/__init__.py` (+2 mounts), `schema_manager._CORE_SCHEMAS` (+1), `alembic/env.py` (+1 import), `runtime/engine.py` permission catalogue (+4 listing rows) |

**Deliberately not created:** a runtime schema store (the capability's JSON Schema *is* the runtime schema), a layout table, a rule engine or expression language, custom/computed field persistence, a "form use" permission, frontend code, and any table per form.

## 5. Form Definition model

`form_platform.form_definitions`: `id`, **`tenant_id NOT NULL`**, `key` (`UNIQUE (tenant_id, key)`, CHECK `^[a-z][a-z0-9_]{2,99}$`), `name`, `description`, `owner_module`, `created_by/at`, `updated_at`. RLS is enabled and forced.

## 6. Form Version model

`form_platform.form_versions`: `id`, `tenant_id NOT NULL`, `form_definition_id` FK, `version_number` (`UNIQUE` per definition), `status` (CHECK ∈ draft/review/published/archived; **partial UNIQUE: one published per definition**), `capability_id`, `capability_version`, `presentation` JSONB (validated, closed schema), plus who/when for creation, submission, review (+comment), publication and archive. RLS is enabled and forced, and the `form_versions_guard` trigger is attached.

## 7. Capability binding

An exact `(capability_id, capability_version)` is stored as data.

| Check | Result |
|---|---|
| Unknown id or wrong version | 422 |
| Another module's capability | 422 (`owner_module`) |
| `disabled` | 422 |
| `deprecated` | Draftable, **not publishable** |
| At publish | Re-validated against the live registry |
| Owning module deactivated | Published form fails closed (404) |

Mandatory §32 scenario: form v1 → cap v1 and form v2 → cap v2. Publishing form v2 did **not** change form v1's binding or presentation. While v1 was published and cap v2 existed, the runtime still executed cap v1.

## 8. Lifecycle

`draft → review` (submit, design), `review → draft` (reject, review, with comment), `review → published` (publish, publish; previous published → archived in the same transaction), `published → archived` (archive, publish). `archived` is terminal; revival is a new version via `copy_from`. **Only `draft` is editable.** The same rules are enforced by the service (409) and the trigger (`check_violation`).

## 9. Runtime resolution

A form key resolves to the single published version (guaranteed by the index), or to a pinned `version` that must still be published (409 otherwise). From there: the exact capability version, then `describe()` input schema, then the render model (FieldSpec fields + sections + rules). On execute, the submitted keys must be a subset of the form's fields (422 otherwise), then `execute_capability(id, values, version=pinned)` runs. The runtime is generic: no business-name literals in executable code (AST).

## 10. SchemaForm integration

The render model's `fields[]` uses the `FieldSpec` keys. The widget vocabulary equals SchemaForm's `FieldKind` exactly; `test_widget_vocabulary_is_exactly_schemaforms_fieldkind` parses `SchemaForm.tsx`. SchemaForm is unchanged and references nothing from the Form Platform (test).

**Limitation, disclosed:** the render model → SchemaForm path is proven by **contract tests only**, not by a browser E2E. No runtime view exists yet (condition B-2).

## 11. Tenant isolation

TENANT scope with `tenant_id NOT NULL`. The service derives the tenant from the caller only, refuses a caller/session tenant mismatch (tested in-process), and refuses tenant bypass.

Mandatory §33 test, on real HTTP with tenants A and B both owning `employee_leave_request:v1`:
- Each tenant sees only its own presentation.
- A gets **404** for B's form on read, read-version, new-version, edit, archive, publish, runtime render and runtime execute.
- A's list shows only A's forms.

RLS layer 2 via raw SQL: B's rows are visible under B (1), under A (0), and with no tenant (0). **Mutation:** with the service's tenant filter removed, the isolation test still passed (RLS alone).

## 12. Authorization

| Who | Permission | Proven |
|---|---|---|
| Designer | `core.forms.design` | Without it: 403 on create, version and submit |
| Reviewer | `core.forms.review` | Designer cannot reject (403) |
| Publisher | `core.forms.publish` | Designer and reviewer cannot publish (403); publisher can |
| Reader | `core.forms.read` | Without it: list 403 |
| Runtime user | The **bound capability's** permission | `leave_management.requests.write` is required. A user with only `requests.read` plus every form permission gets 403 on render and execute. |

There is no second authorization system.

## 13. Audit

The tested sequence for one form is `form.definition_created → form.version_created → form.submitted → form.published`. The `form.published` row carries `user_id` (who), `created_at` (when), `form_key`, `version`, `capability_id` and `capability_version`. The audit write commits **atomically** with the lifecycle change. HTTP writes are also recorded by `AuditMiddleware` in the real app (not mounted in the test app).

## 14. Tests

| File | Tier | Tests | Covers |
|---|---|---|---|
| `tests/unit/test_form_presentation.py` | unit | 22 | Cross-stack widget = `FieldKind`, contract introspection, valid document, FieldSpec render model, enum options, **custom field rejected**, required-field rules, widget/option compatibility, sections, rule may not hide required, **arbitrary code/SQL/service/route/table rejected** (10 cases), code-like values inert, rule semantics |
| `tests/unit/test_form_platform_architecture.py` | unit (AST) | 8 | Import allowlist; no metadata_engine / workflow / flow / modules / FastAPI; **generic: no business literals**; no dynamic dispatch; API imports no module; consumer imports no Leave symbol; SchemaForm independent |
| `tests/integration/workflow_postgres/test_form_platform.py` | **real PG + HTTP** | 10 | RLS + trigger preconditions; identity; **lifecycle + §31 immutability (service + 4 direct-SQL trigger rejections) + v2 supersede**; binding validation; **§32 version pinning**; runtime execute with independent read-back over the Leave route; withdrawn capability fails closed; **authorization matrix**; **§33 tenant isolation** (+ RLS + session mismatch); audit trail |
| `tests/integration/workflow_postgres/test_form_platform_fresh_database_migration.py` | real PG, throwaway DB | 1 | **Clean DB upgrade** (RLS, 2 policies, trigger, partial index), **downgrade** removes everything, **re-upgrade** |

**Upgrade from the current database state:** the dev database (`localhost:5432/erp_platform`) was upgraded from `b2c3d4e5f6a7` to `c3d4e5f6a7b8` with `scripts/db.py migrate`, and the facts were verified with `psql`.

**Mutation checks (performed, each reverted, files byte-identical afterwards):**
- Service draft-only check removed → the DB trigger alone rejected the write (`CheckViolationError … immutable`).
- Runtime resolving the latest capability version → the pinning test **failed**.
- Service tenant filter removed → the tenant test **still passed**, because RLS is independent.

### 14.1 Regression (four separate invocations)

| Invocation | Before (Phase 1 close) | After |
|---|---|---|
| `tests/architecture` | 8 | **8** |
| `tests/unit` (excl. `test_engine_execution.py`) | 3,567 | **3,597** (+30 new) |
| `tests/integration` (excl. `workflow_postgres`) | 179 + 5 skipped | **179 + 5 skipped** |
| `tests/integration/workflow_postgres` (real PG) | 135 | **146** (+11 new) |

**Total: 3,889 → 3,930 passed, 5 skipped, 0 failed** (+41 = exactly the new tests). `test_engine_execution.py` was not re-run: it is unchanged, and its known event-loop defect was characterised in Phase 1.

Static: `ruff check` (all new and changed files) → *All checks passed*. `mypy app/core/form_platform app/api/v1/form_platform.py` → **0 errors in these files**; the 2 initial errors were fixed.

## 15. Known risks

| # | Risk | State |
|---|---|---|
| **F-5** | Legacy `/api/v1/metadata` NULL-means-global tenancy and client-supplied `tenant_id` | **Open, deferred by decision.** Dormant (0 rows). The new platform avoids it by `NOT NULL`. |
| F-6 | `MetadataServiceImpl` calls 4 non-existent methods (silent no-op contract) | Open, documented |
| F-7 | `metadata_engine` and `form_platform` coexist | Open. Deprecation decision recommended. |
| **F-8** | **Two PostgreSQL servers on :5432.** `localhost` is Homebrew PG14, used by tests, Alembic and `db.py`. The Docker `erp_postgres` (PG16) backs the `erp_backend` container. The dev DB used by tests is migrated to `c3d4e5f6a7b8`. **The Docker container's DB is still at `b2c3d4e5f6a7`**, so the running container app has no `form_platform` schema until it is migrated. Earlier `docker exec` evidence was re-verified against `localhost` with identical results, and the docs are corrected. | Open (environment) |
| R-1 | A raw DB integrity error from the trigger surfaces as a 500 if some future code path bypasses the service | Accepted. Only reachable by bypassing the service, which is exactly what the trigger exists to stop. |
| R-2 | No separation of duties (one user may design, review and publish) | Open, policy decision |
| R-3 | `AuditService.record` commits the session it is handed | Relied on deliberately as the final step. A future refactor of `AuditService` must keep lifecycle and audit atomic. |
| R-4 | Rules are evaluated client-side only. The server does not enforce hide/readonly. | By design: rules are presentation; business validity is re-checked by the capability. Documented. |

## 16. Outstanding conditions

**Blockers for Phase 3 (Visual Form Builder). These must be closed before GO:**
- **B-1: HTTP capability discovery.** A builder must list bindable capabilities and their input schemas. Phase 1 discovery is in-process only. Needed: a read-only, **permission-filtered** `GET` over `capability_registry.list_capabilities` / `describe` (Phase 1 condition C-3).
- **B-2: a generic runtime view proven in a browser.** One field-name-free view that renders `/form-runtime/{key}` through the unchanged `SchemaForm` (sections + rules) and submits it, with a Playwright E2E on real PG. Without it, the render-model → SchemaForm contract is only test-asserted, and a builder would design for an unproven renderer.

**Conditions (do not block, must be tracked):**
- C-1: decide F-5 and F-7 (fix the legacy tenant handling, or deprecate and remove the legacy form/layout API).
- C-2: migrate the Docker container DB (F-8) before anyone demos the Form Platform against the running container app.
- C-3: separation-of-duties policy (R-2).
- C-4: custom fields need a module-owned extension contract, and computed fields need a safe expression model. Both are out of scope until a real module requires them.
- C-5: **more than one capability.** Lifecycle capabilities (submit/approve/cancel) still wait on the Phase 1 C-2 decision (Workflow caller-bridge allowlist). Until then, every form is a *create* form.

## 17. Phase 1 debts affected

| Debt | Effect |
|---|---|
| F-1 (Flow handlers survive deactivation) | **Not touched, not worsened.** The Form Platform binds only to capabilities, never to Flow handlers. |
| F-2 (routes not unmounted on FastAPI 0.115.6) | **Not touched, not worsened.** The Form Platform does not rely on route unmounting: a deactivated module's capability disappears from the registry, and its published forms fail closed with 404 (tested), even though the module's own routes would stay mounted. |
| R-10a (Flow actions vs capabilities) | Unchanged. The Form Platform does not depend on Workflow or Flow. |
| R-10b (legacy `metadata_engine` vs Form Definition store) | **Resolved as a decision:** NEW BOUNDARY, with the legacy left untouched (now F-7). |

## 18. Definition of Done

| Item | Status |
|---|---|
| Phase 1 implementation inspected | ✅ Audit §0; no blocking defect |
| Metadata Engine / `FormSchema` / `UiLayout` / `SchemaForm` audited | ✅ Audit §A–§D |
| Duplication risk evaluated | ✅ Audit §E |
| Existing infrastructure reused where appropriate | ✅ §3 |
| Form Definition boundary documented | ✅ `FORM_DEFINITION_PLATFORM.md` |
| Form identity / Form Version / capability binding with explicit version | ✅ §5–§7 |
| Published versions immutable · lifecycle enforced | ✅ Service + trigger, mutation-proven |
| Runtime resolution deterministic · runtime generic | ✅ Partial unique index + pinned-version rule; AST |
| No business logic in the platform · no arbitrary code or service invocation | ✅ AST + rule tests |
| Tenant isolation · existing authorization · existing audit | ✅ §11–§13 |
| SchemaForm generic and unchanged · no Form Builder UI | ✅ 0 frontend files |
| Tests: lifecycle, immutability, version binding, tenant, authorization, runtime | ✅ §14 |
| Documentation | ✅ |
| Relevant tests pass | ✅ §14.1 |
| No unrelated refactoring | ✅ Only additive wiring (§4); `metadata_engine`, Phase 1, Workflow and Flow untouched |

## 19. Recommendation

**GO-WITH-CONDITIONS for the Form Definition foundation. NOT YET GO for the Visual Form Builder.**

The next step should be a short, narrowly scoped **"Phase 2.5: Builder Prerequisites"** that closes B-1 (permission-filtered capability discovery API) and B-2 (generic runtime view + browser E2E). After that, re-issue this report. Only a re-issued **GO** opens Phase 3. Phase 3 must not start automatically.

**Why not GO:** a builder without capability discovery cannot know what to bind, and a builder designing for a renderer that has never run in a browser would be building on an unproven contract.
**Why not NO-GO:** nothing in the foundation is unsafe. Every boundary is enforced by permanent tests, and the security-critical ones are proven on real PostgreSQL with mutation checks.

## 20. Files Changed

**New (production):** `backend/app/core/form_platform/{__init__,errors,models,presentation,service,runtime}.py`, `backend/app/api/v1/form_platform.py`, `backend/alembic/versions/c3d4e5f6a7b8_form_platform_definitions.py`
**Modified (production, additive wiring only):** `backend/app/api/v1/__init__.py`, `backend/app/core/database/schema_manager.py`, `backend/alembic/env.py`, `backend/app/core/runtime/engine.py`
**New (tests):** `backend/tests/unit/test_form_presentation.py`, `backend/tests/unit/test_form_platform_architecture.py`, `backend/tests/integration/workflow_postgres/test_form_platform.py`, `backend/tests/integration/workflow_postgres/test_form_platform_fresh_database_migration.py`
**Docs:** `docs/architecture/FORM_DEFINITION_PLATFORM.md`, `reviews/FORM_DEFINITION_METADATA_AUDIT.md`, this file. `reviews/FORM_CAPABILITY_FOUNDATION_AUDIT.md` received a citation correction only (F-8).
**Database:** dev DB (`localhost`) migrated `b2c3d4e5f6a7 → c3d4e5f6a7b8`. The Docker container DB was not migrated.
**Unchanged (verified with `find -newer`):** `app/core/capabilities`, `app/core/metadata_engine`, `app/core/application_flow`, `app/core/workflow`, `app/core/auth`, `app/core/module_system`, `external_modules/`, `frontend/`, `requirements*.txt`.
