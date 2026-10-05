# FORM PLATFORM — PHASE 2 — FORM DEFINITION METADATA AUDIT

**Status:** AUDIT (mandatory hard gate, brief §5–§7) — COMPLETE
**Verdict:** **NEW BOUNDARY REQUIRED.** The legacy `app/core/metadata_engine` is **not** reused, extended or replaced. A new, small `app/core/form_platform` boundary is recommended (§F), and `metadata_engine` is left untouched.
**Production changes made while writing this audit:** 0
**Date:** 2026-10-05

---

## 0. Method and path note

- The brief's `ERP/` paths map to this repo's **`docs/architecture/`**. **`summary.md` does not exist anywhere in the repository** (`find . -name summary.md` outside `.venv` / `node_modules` → empty). The other three named docs were read: `CAPABILITY_PLATFORM.md` and `reviews/FORM_CAPABILITY_FOUNDATION_{AUDIT,READINESS}.md`.
- **Phase 1 re-inspected:** `backend/app/core/capabilities/{contract,registry,executor,errors}.py` and `external_modules/leave_management/capabilities.py`. `find -newer FORM_CAPABILITY_FOUNDATION_READINESS.md` over `backend/`, `frontend/shell/src`, `docs` → **empty**, so nothing has changed since Phase 1 closed. **No Phase 1 defect blocks Phase 2.**
- Live checks of row counts, `pg_class.relrowsecurity` / `relforcerowsecurity`, and the `pg_policies` text for schema `metadata` (§B.6) were run against **both** PostgreSQL servers present on this machine, with identical results (see the environment note below).
- **Environment note (finding F-8):** `localhost:5432` is served by a **local Homebrew PostgreSQL 14** (pid bound to `127.0.0.1` / `::1`), *not* by the Docker `erp_postgres` container (PG 16, bound to `*:5432`). The more specific loopback bind wins. `scripts/db.py`, Alembic and every "real PostgreSQL" test in `tests/integration/workflow_postgres/` therefore use the **Homebrew** database, while the `erp_backend` container (port 8000) uses the **container** database. The first draft of this audit queried the container via `docker exec`. Every fact was then re-verified with `psql -h localhost` against the database the tests use, and all results are identical.
- Repo-wide search terms: `FormSchema`, `UiLayout`, `FormDefinition`, `FormVersion`, `metadata_engine`, `MetadataService`, `/metadata/`, `form-schemas`, `SchemaForm`. **`FormDefinition` and `FormVersion` exist nowhere** in backend or frontend.

---

## A. Existing form/metadata concepts

| Name | Location | Responsibility | Current consumers | Persistence | Versioning | Tenant awareness | Reusable? | Reason |
|---|---|---|---|---|---|---|---|---|
| `MetaModel` | `app/core/metadata_engine/models.py:42` | **Dynamic entity definition** (`name`, `module_name`, **`table_name`**, `is_virtual`) | `/api/v1/metadata/models` CRUD only | `metadata.meta_models`, **0 rows** | `VersionMixin` (optimistic-lock counter, not version history) | Nullable `tenant_id`; RLS enabled+forced | **No** | It is the "domain model / table definition" shape brief §3 prohibits. A form must bind to a capability, not to an entity or table. |
| `ModelField` | `models.py:76` | Dynamic entity field (type, required, unique, options, validation_rules, placeholder, tooltip, group) | metadata API only | `metadata.model_fields`, **no RLS**, no `tenant_id` | `VersionMixin` | **None** | **No** | It redefines business data shape (`is_required`, `is_unique`, `validation_rules`) independently of any capability contract, which brief §16 forbids. |
| `FieldType` | `models.py:112` | Seeded catalog of 20 widget/data types | metadata API only | `metadata.field_types` | none | global | **No** (only the idea) | It mixes data types (`decimal`, `json`, `relation`) with widgets. SchemaForm supports only 4 kinds. |
| `FormSchema` | `models.py:130` | Named form layout blob, optionally tied to a `MetaModel` | metadata API only | `metadata.form_schemas`, **0 rows** | single mutable `version int` column, no history | Nullable `tenant_id`, **client-supplied**; RLS enabled+forced | **No** | §B |
| `TableSchema` | `models.py:159` | List/table column config | metadata API only | `metadata.table_schemas` | `VersionMixin` | as `FormSchema` | Out of scope | It is a list view, not a form. |
| `ValidationRule` | `models.py:190` | Named rule catalogue (`rule_type`, `config`) | metadata API only | `metadata.validation_rules`, no `tenant_id` | none | global | **No** | It is a free-form rule config with no evaluator. Business validation belongs to the capability (§19). |
| `UiLayout` | `models.py:206` | Generic named layout blob (`layout_type`, `definition`) | metadata API only | `metadata.ui_layouts`, **0 rows** | `VersionMixin` | as `FormSchema` | **No** | §C |
| `MetadataService` | `app/core/metadata_engine/service.py` | CRUD for all of the above | `api/v1/metadata.py`, `MetadataServiceImpl` | — | — | `list_*` filter by an *optional* `tenant_id`, and the API passes none; `get_*` / `update_*` / `delete_*` take **no tenant at all** | **No** | §B.5 |
| `MetadataServiceContractV1` + `MetadataServiceImpl` | `app/contracts/metadata/{v1,impl}.py` | Inter-module "entity metadata" contract | Registered in `RuntimeEngine` (`engine.py:490-518`). **No module consumes it** (grep). | — | — | — | **No** | **Broken adapter (finding F-6):** it calls `register_entity_schema`, `get_entity`, `list_entities` and `list_modules`, **none of which exist on `MetadataService`**. Every call fails into a swallowed `logger.warning`. |
| `/api/v1/metadata/*` router | `app/api/v1/metadata.py` | REST over `MetadataService` | Mounted (`api/v1/__init__.py:39`). **No frontend caller** (grep `frontend/shell/src` → only an unrelated Workflow Studio test string). | — | — | §B.6 | **No** | Live surface with the defects in §B.6 |
| `SchemaForm` | `frontend/shell/src/components/form/SchemaForm.tsx` | Field-name-free renderer: `FieldSpec[]` → `@design` controls | `CustomerCreateView`, `LeaveRequestCreateView` (Phase 5.12) | none (props only) | n/a | n/a | **Yes, unchanged, as the render target** | §D |
| Feature field specs | `features/sales/customerForm.ts`, `features/leave_management/leaveRequestForm.ts` | Hand-authored `FieldSpec[]` mirroring a DTO | the two create views | none (source code) | source control | n/a | Precedent only | They prove the presentation vocabulary a Form Version must carry (label, kind, options, hint, placeholder) |
| Workflow Studio drafts/versions | `app/modules/workflow_studio/{draft,versioning,publishing}`, `infrastructure/models.py:230` `VersionORM` | Workflow graph design-time lifecycle | Workflow Studio | `workflow_studio.*` | `(definition_id, version_number)`, status, `published_by/at` | `tenant_id String(100)` | **Pattern only** | Reusing it would make Form depend on Workflow, which brief §35 forbids. Its `(definition, version_number)` + status + `published_*` shape is the precedent the new model follows. |
| Capability descriptor `describe()` | `app/core/capabilities/contract.py` | Input/output JSON Schema + metadata | Phase 1 tests | — | `(id, version)` | — | **Yes, authoritative** | It is the business contract a form binds to (§16) |
| `AuditService.record` | `app/core/audit/service.py:26` | Append `AuditLog` row | many | `audit.audit_logs` | — | `tenant_id` column | **Yes** | Reused for lifecycle audit (brief §22). Note: it **commits the session it is given** (`service.py:~59`), so it must be the last step of a lifecycle transaction. |

## B. `FormSchema` analysis

1. **What does it represent?** A named, mutable layout document (`layout: Dict[str, Any]`, `settings: Dict[str, Any]`) keyed by `(name, module_name, tenant_id)`, optionally pointing at a dynamic `MetaModel`.
2. **Runtime schema or persistent definition?** A persistent definition, but with **no lifecycle**: `is_active` is a boolean, and `update_form_schema` overwrites `layout` in place. There is nothing to "publish", so nothing is reproducible.
3. **Business semantics?** Indirectly. Through `model_id` → `MetaModel` → `ModelField` it is bound to a *dynamically defined entity* whose fields carry `is_required` / `is_unique` / `validation_rules`. That is a second, parallel definition of business data shape.
4. **References domain models / database tables?** **Yes.** `MetaModel.table_name` is a database table name.
5. **References services?** No. But **its service has a mass-assignment shape**: `update_form_schema(**kwargs)` does `if hasattr(schema, key): setattr(schema, key, value)` (`service.py:306-317`). Today it is reached only through `UpdateFormSchemaRequest`, which limits the keys, so it is not exploitable via HTTP. It is still a fragile pattern that the new boundary must not reuse.
6. **Tenant behaviour, verified live:**
   - `CreateFormSchemaRequest.tenant_id` / `CreateUiLayoutRequest.tenant_id` are taken **from the client payload** (`schemas.py`). Under real RLS, a *different* tenant's id is rejected by the policy `WITH CHECK`.
   - But the RLS policy on `metadata.{meta_models,form_schemas,table_schemas,ui_layouts}` (live `pg_policies`) is `tenant_id IS NULL OR bypass OR tenant_id = current_tenant`. **`tenant_id` defaults to `None`**, so **every schema/layout created through this API without an explicit tenant is a GLOBAL row**. It is visible to **and updatable/deletable by** every tenant's `core.metadata.manage` holder.
   - This is **finding F-5** (§G). Severity: **HIGH** (cross-tenant integrity of configuration data). It is *not live-exploited*: all tables are empty (0 rows). It is gated on the DB-granted `core.metadata.manage` permission.
7. **Can it safely become part of Form Definition?** **No.** It would need: removal of the `MetaModel` / table coupling, a capability binding, version history, a lifecycle, immutability, a non-nullable server-derived tenant, and a validated (not `Dict[str, Any]`) configuration. That changes every property except the name, which makes it a REPLACE in disguise. It would also leave the live `/metadata/form-schemas` API still writing the *old* semantics into the *same* table: two write paths, one unsafe.
8. **Should it remain a runtime schema abstraction?** It is not one today, and the runtime schema is already the capability's `describe()["input"]["schema"]`. `FormSchema` should be **left untouched** in Phase 2 and formally deprecated by a separate decision (condition, §H).

## C. `UiLayout` analysis

| Question | Answer |
|---|---|
| What does it represent? | A generic named JSON blob (`definition`) with a free-text `layout_type`. There is no schema for `definition` and no binding to a form, capability or entity. |
| Presentation-only? | By intent, yes. But nothing enforces it: `definition` is `Dict[str, Any]` and could hold anything. |
| Reusable? | **No.** Its only reusable content is "a JSONB column", which carries no architectural value. Using it as the form layout store would split one immutable Form Version across two independently mutable rows in two tables. |
| Leaks frontend implementation details? | Unknown by construction: the content is unvalidated. |
| Business logic? | None by design, but there is no validation to prevent it. |
| Versioned? | **No.** `VersionMixin` is an optimistic-lock counter, and `update_layout` overwrites in place. |
| Tenant-aware? | The same defect as `FormSchema` (F-5): client-supplied `tenant_id`, NULL → global. |

## D. `SchemaForm` analysis

| Question | Answer (verified by reading the source) |
|---|---|
| How does it consume schema? | It does **not** consume JSON Schema. It consumes a `FieldSpec[]` (`name`, `label`, `kind`, `required?`, `maxLength?`, `options?`, `hint?`, `placeholder?`) plus `values` / `errors` / `onChange`. |
| Generic? | **Yes.** It is a 4-branch `switch (spec.kind)` over `'text' \| 'number' \| 'date' \| 'select'`, imports only `@design`, and a Vitest guard (Phase 5.12) asserts no field or entity literals. |
| Field-name branching? | **None.** `spec.name` is used only as key, state key and `onChange` argument. |
| Can it consume a persisted Form Definition? | **Yes, if the runtime emits `FieldSpec`-shaped field entries.** A published Form Version's resolved render model (capability input schema + version presentation) can be projected into exactly that shape. The backend should therefore restrict widgets to SchemaForm's 4 kinds now, so every published form is renderable by the existing component. |
| Needs changes in Phase 2? | **No.** Sections, columns and rules (visibility/readonly) are layout-level concerns that a future runtime *view* composes around `SchemaForm` (one `SchemaForm` per section, filtering `specs` by rule state). The renderer itself stays a switch. |
| Independent from the Form Platform domain? | **Must remain so.** The dependency is Form Runtime API → (future) runtime view → `SchemaForm`. `SchemaForm` never imports a form-platform type. |
| Note | The brief says "shadcn/ui". This frontend's primitives are the in-house **`@design` `Sap*` components** (`SapInput`, `SapNumberInput`, `SapSelect`), not shadcn/ui. The architecture docs use the real name. |

## E. Duplication risk

| Introducing… | Duplicates existing infrastructure? | Decision |
|---|---|---|
| `FormDefinition` (stable identity) | Partially overlaps `FormSchema`'s *name* role, but `FormSchema` has no stable-identity/version split | New, justified by §B.7 |
| `FormVersion` (immutable, capability-bound) | **Nothing equivalent exists.** `FormSchema.version` is a mutable int, and Workflow Studio's `VersionORM` is Workflow-owned. | New |
| A new "FormSchema" (runtime schema) | **Would duplicate** the capability's `describe()` JSON Schema | **Not created.** The runtime schema *is* the bound capability's input schema. |
| A new "UiLayout" table | **Would duplicate** `metadata.ui_layouts` without adding value | **Not created.** Layout lives *inside* the immutable Form Version's presentation document. |
| A second runtime renderer | Would duplicate `SchemaForm` | **Not created** |

**Residual duplication (accepted, disclosed):** after Phase 2 the repository has two places a "form layout" can be stored: legacy `metadata.form_schemas` (dormant, 0 rows, no consumer) and the new `form_platform.form_versions`. Mitigation: no new code may read or write `metadata.form_schemas`, an architecture test forbids `app.core.form_platform` importing `app.core.metadata_engine`, and a deprecation decision is recommended (§H).

## F. Gate verdict: **NEW BOUNDARY REQUIRED**

| Option | Verdict | Why |
|---|---|---|
| REUSE `FormSchema` / `UiLayout` | ✗ | No capability binding, no lifecycle, no immutability, `MetaModel` / table coupling, unvalidated JSON, NULL-means-global tenancy (§B, §C) |
| EXTEND | ✗ | Every property would change, and the live legacy API keeps writing the old, unsafe semantics into the same tables, so there would be two write paths (§B.7) |
| REPLACE (modify or remove `metadata_engine`) | ✗ (for Phase 2) | It is an unrelated refactor of a live, mounted API surface (brief §36 / §43 forbid unrelated refactoring). Recommended as its own decision. |
| **NEW BOUNDARY** | ✅ | `app/core/form_platform`: a platform capability at the same layer as `app/core/capabilities` and `app/core/application_flow`. It depends only on the capability registry, existing auth, the tenant context and audit. |

### F.1 Recommended minimal design (to be approved before persistence, brief §23)

**Package** `backend/app/core/form_platform/`, plus a core Postgres schema `form_platform` (the same treatment `application_flow` received in Phase 4.4: `pg_schema`, `_CORE_SCHEMAS`, a static import in `alembic/env.py`).

**Tables (2):**

| `form_platform.form_definitions` | |
|---|---|
| `id` uuid7 PK, **`tenant_id` UUID NOT NULL** | **TENANT scope only.** NOT NULL deliberately avoids the RLS `tenant_id IS NULL → global` branch that F-5 exposes. Global or module-provided templates are future scope. |
| `key` (`^[a-z][a-z0-9_]{2,99}$`), `name`, `description`, `owner_module` | The stable identity. `UNIQUE (tenant_id, key)`. |
| `created_by`, `created_at`, `updated_at` | |

| `form_platform.form_versions` | |
|---|---|
| `id`, **`tenant_id` NOT NULL**, `form_definition_id` FK, `version_number` | `UNIQUE (form_definition_id, version_number)` |
| `status` ∈ `draft \| review \| published \| archived` | **Partial unique index: at most one `published` per definition.** Resolution can never be ambiguous. |
| `capability_id`, `capability_version` (int) | **Exact capability binding.** Stored as data, never as a class or route. |
| `presentation` JSONB | Validated against a closed Pydantic schema (`extra="forbid"`): `fields[]` (`name`, `label`, `help`, `placeholder`, `widget ∈ text\|number\|date\|select`, `options`, `readonly`, `hidden`), `sections[]` (`id`, `title`, `columns 1–4`, field names), `rules[]` (`when {field, op ∈ eq\|neq\|in\|not_in\|empty\|not_empty, value}` → `then {action ∈ show\|hide\|readonly, fields}`). Every field name **must exist in the bound capability's input schema**; required-without-default fields must be present and not hidden. **No custom or computed fields in Phase 2** (documented future scope, brief §17). |
| `created_by/at`, `submitted_by/at`, `reviewed_by/at`, `published_by/at`, `archived_by/at` | Traceability: who, when, which version, which capability version |

**RLS:** both tables use `app.core.database.rls.enable_statements(...)` in the migration, the identical policy every tenant table uses.

**Immutability:** enforced twice.
1. **Service layer:** only `draft` versions are editable.
2. **Database layer:** a `BEFORE UPDATE` trigger rejects any change to `capability_id`, `capability_version`, `presentation`, `version_number`, `form_definition_id` or `tenant_id` once `OLD.status <> 'draft'`, and any status change not on the allowed transition list.

The trigger proves immutability even against a code path that forgets the service rule. It is new to this repo, so it is flagged for approval.

**Lifecycle:** `draft → review` (submit), `review → draft` (reject), `review → published` (publish; any previously published version of the same form becomes `archived` in the same transaction, i.e. *superseded*), `published → archived`. `archived` is terminal; to bring a form back, create a new draft version from it.

**Resolution:** `form key` → the single `published` version (or an explicit `version_number`) → its exact `(capability_id, capability_version)` → `capability_registry.describe(id, version)` → render model. **The capability version underneath a version never changes.**

**Runtime (generic):**
- `get_runtime_form(key, caller, version=None)` returns the render model. Field entries are `FieldSpec`-compatible and merged from the capability input schema plus the presentation.
- `execute_form(key, payload, caller, version=None)` checks that the payload keys are fields of the form version, then calls `execute_capability(capability_id, payload, caller=…, version=capability_version)`. There is **no** branching on form key, field or module.

**Permissions** (existing `core.*` platform-permission convention, `engine.py:470-475`; enforcement stays `require_permission` → `RBACEngine`):
- `core.forms.read`: list and view definitions/versions, including drafts.
- `core.forms.design`: create a definition, create and edit drafts, submit.
- `core.forms.review`: reject.
- `core.forms.publish`: publish and archive.
- **Runtime use needs no new permission.** It requires the *bound capability's* own permission (enforced by the executor, plus a pre-check before rendering), so "can use the form" equals "can perform the business operation".

**Audit:** `AuditService.record(action="form.<op>", resource_type="form_version", new_values={key, version, status, capability_id, capability_version})` inside each lifecycle transaction, as its final committing step. HTTP routes additionally pass through `AuditMiddleware`.

**HTTP (thin, `app/api/v1`):** `/form-definitions`, `/form-definitions/{key}`, `/form-definitions/{key}/versions[/{n}[/submit|reject|publish|archive]]`, `/form-runtime/{key}` (GET render model, POST execute). No class, service, route or table names are exposed.

**Frontend:** **0 changes** (no builder, no runtime page). The `FieldSpec` compatibility of the render model is asserted by a backend contract test against SchemaForm's four kinds.

## G. Findings

| # | Finding | Severity | Proposed handling |
|---|---|---|---|
| **F-5** | Legacy metadata API: `tenant_id` is client-supplied and defaults to NULL, and RLS treats NULL as **global, writable by all tenants** (`metadata.{meta_models,form_schemas,table_schemas,ui_layouts}`). `get_*` / `update_*` / `delete_*` have no service-level tenant check (RLS is the only guard, and it allows NULL rows). | **HIGH**: cross-tenant config integrity. Dormant: 0 rows, no frontend caller. | Not part of Form Definition. **Needs your decision** (fix now as an isolated hardening change, or document and defer). |
| **F-6** | `MetadataServiceImpl` calls 4 methods that do not exist on `MetadataService`. The contract is a silent no-op. | Medium (correctness; no consumer today) | Document and defer |
| F-7 | `metadata_engine` and the new `form_platform` will coexist | Info | Deprecation decision recommended |
| F-1 / F-2 (Phase 1) | Flow handlers survive deactivation; routes are not unmounted on FastAPI 0.115.6 | (unchanged) | Untouched. **Phase 2 does not depend on either**: forms bind to capabilities, which *are* withdrawn on deactivation (Phase 1, proven), and a published form whose capability is gone fails closed at runtime with `CapabilityNotFoundError`. |

## H. Conditions carried into implementation

1. `app.core.form_platform` must not import `app.core.metadata_engine`, `app.core.workflow`, `app.core.application_flow`, `app.modules`, `external_modules` or `fastapi` (the API adapter lives in `app/api/v1`). This is AST-enforced.
2. No new code reads or writes `metadata.*`.
3. A separate decision should formally deprecate `metadata.form_schemas` / `ui_layouts`, and handle F-5.
