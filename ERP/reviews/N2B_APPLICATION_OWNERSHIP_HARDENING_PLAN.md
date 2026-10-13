# N-2B — Application Ownership Hardening: Plan

**Date:** 2026-10-12
**Type:** PLANNING AND CODE-PATH ANALYSIS ONLY.
- No production code, test, schema, RLS, migration, configuration, authentication or data change was made.
- No database was queried in this phase.

**Inputs:**
- `N2_GLOBAL_ROW_POLICY_DECISION.md` (policy P-1 to P-7, defects D-1 to D-7);
- `N2A_READ_ONLY_GLOBAL_DATA_INVENTORY.md`;
- the C-2, CND-1, RC-1/2/3 and H-1 readiness reports;
- the current source.

**Provenance:** Commit: NONE · Push: NONE

```text
N-2B PLAN: READY FOR REVIEW (no implementation)
  One reusable, module-agnostic ownership helper (strict by default) + per-module typed errors.
  Five stages with separate GO gates:
    S1  strict pre-mutation ownership (closes D-1)            application-only, data-independent
    S2  platform-admin principal + require-tenant dependency, Playwright fixture migration
    S3  refuse tenant-less business creates (closes D-3)      needs S2
    S4  strict reads + strict references (C-2 withdrawal)     BLOCKED: real-database inventory
    S5  RLS tightening / NOT NULL                             BLOCKED: real-database inventory (separate DB phase)
  Correction to N-2A §7: the Leave HTTP create route does NOT refuse a tenant-less caller.
```

---

## 1. Endpoint and Service Inventory

**Legend:**
- **Tenant source:**
  - **REQ** = refuses a missing `tid` with 403 before the service runs;
  - **NULLABLE** = passes `None` and the service stores or uses `tenant_id NULL`.
- **Loader:**
  - **G** = admits `tenant_id IS NULL` rows (the idiom `row.tenant_id is not None and row.tenant_id != tenant_id → None`);
  - **S** = strict `row.tenant_id == tenant`;
  - **C** = create, no load.
- **Other-tenant rows** are refused by every loader below, "not found" style. That was verified by the Phase 3.0F / 3.10 tests. Only the global-row and tenant-less behaviour is at issue.

### 1.1 Sales (`app/modules/sales`)

| Endpoint | Permission | Tenant | Service → loader | Ownership today | Existing tests |
|---|---|---|---|---|---|
| `POST /sales/customers` | `sales.customers.write` | NULLABLE | `create_customer` (C) | tenant-less creates global | `test_capability_sales_customer.py`, `test_n2_…::test_http_tenantless_…` |
| `POST /sales/orders` | `sales.orders.write` | NULLABLE | `create_order` (C) → customer `get_customer` (**G**) → CND-1 contract (S) | tenant-less creates global order; global customer accepted | `test_c2_…` (incl. `…global_customer…`), `test_cnd1_product_reference.py`, `test_n2_…` |
| `POST /sales/orders/{id}/confirm` | `sales.orders.write` | REQ (`_workflow_caller_context`) | `confirm_order` → `_load_tenant_scoped_order` (**G**, FOR UPDATE) | tenant can confirm a global order | `test_sales_order_concurrent_confirm.py`, `test_sales_order_approval_workflow.py` |
| `POST /sales/orders/{id}/approval/decide` | `sales.orders.approve` | REQ | `decide_order_approval` → same (**G**) | tenant can decide a global order | `test_sales_order_full_state_machine_concurrency.py` |
| `POST /sales/orders/{id}/cancel` | `sales.orders.write` | REQ | `cancel_order` → same (**G**) | **proven:** tenant cancels a global order (HTTP 200) | `test_n2_…::test_http_a_tenant_cannot_cancel_a_global_sales_order` (strict xfail) |
| Worklist actions `approve`/`reject` on a Sales task | via flow instance | REQ (in `task_presenter._decide`) | `decide_order_approval` (**G**) | the order id comes from the tenant's own flow instance, so global reach needs a global order linked to a tenant flow | `test_sales_application_flow_proof.py` |
| `GET /sales/customers/{id}`, `GET /sales/orders/{id}`, `GET …/approval` | read | NULLABLE | `get_customer` / `get_order` (**G**) | global visible by id, hidden from lists | `test_n2_…::test_by_id_loaders_…` |

### 1.2 HR (`app/modules/hr`)

| Endpoint | Permission | Tenant | Service → loader | Ownership today | Existing tests |
|---|---|---|---|---|---|
| `POST /hr/departments` | `hr.departments.write` | NULLABLE | `create_department` (C); `parent_id` **unchecked** (N-3) | tenant-less creates global | `test_p310_hr_inventory_tenant_isolation.py` (SQLite) |
| `POST /hr/positions` | `hr.departments.write` | NULLABLE | `create_position` (C); `department_id` **unchecked** (N-3) | same | — |
| `POST /hr/employees` | `hr.employees.write` | NULLABLE | `create_employee` → `_check_references` (**G**) | global department/position accepted | `test_c2_…` (incl. `…global_department…`) |
| `PATCH /hr/employees/{id}` | `hr.employees.write` | NULLABLE | `update_employee` (**G**) → `_check_references` (**G**) | **proven:** tenant updates a global employee (service tier) | `test_n2_…::test_a_tenant_cannot_update_a_global_employee` (strict xfail) |
| `GET /hr/employees/{id}` | read | NULLABLE | `get_employee` (**G**) | global visible by id | `test_p310_…` |

### 1.3 Accounting (`app/modules/accounting`)

| Endpoint | Permission | Tenant | Service → loader | Ownership today | Existing tests |
|---|---|---|---|---|---|
| `POST /accounting/accounts` | `accounting.accounts.write` | NULLABLE | `create_account` (C); `parent_id` **unchecked** (N-3); `account_type_id` → platform catalogue (intended) | tenant-less creates global | `test_p30f_tenant_isolation_audit.py` |
| `POST /accounting/journal-entries` | `accounting.journal.write` | NULLABLE | `create_journal_entry` → account `get_account` (**G**) | global account accepted | `test_c2_…` (incl. `…global_account…`) |
| `POST /accounting/journal-entries/{id}/post` | `accounting.journal.write` | REQ | `post_journal_entry` → `_load_tenant_scoped_entry` (**G**, FOR UPDATE) | tenant can post a global entry (code; starts a real workflow) | `test_accounting_journal_posting_workflow.py`, `test_accounting_journal_entry_concurrency.py` |
| `POST /accounting/journal-entries/{id}/approval/decide` | `accounting.journal.approve` | REQ | `decide_entry_approval` → same (**G**) | same | `test_accounting_application_flow_proof.py` |
| Worklist actions on an Accounting task | via flow | REQ | `decide_entry_approval` (**G**) | as Sales | same |
| `GET /accounting/accounts/{id}`, `GET /journal-entries/{id}`, `GET …/approval` | read | NULLABLE | `get_account` / `get_journal_entry` (**G**) | global visible by id | `test_p30f_…` |
| `GET /accounting/account-types` | read | — | `list_account_types` | platform catalogue (tenant-less table), **correct** | — |

### 1.4 Inventory (`app/modules/inventory`, dormant: no `module.json`, routes not mounted)

| Endpoint | Permission | Tenant | Service → loader | Ownership today |
|---|---|---|---|---|
| `POST /inventory/categories` | `inventory.categories.write` | NULLABLE | `create_category` (C); `parent_id` **unchecked** (N-3) | tenant-less creates global |
| `POST /inventory/products` | `inventory.products.write` | NULLABLE | `create_product` (C); `category_id` **unchecked** (N-3) | same |
| `PATCH /inventory/products/{id}` | `inventory.products.write` | NULLABLE | `update_product` (**G**); `category_id` **unchecked** | **proven** at the service tier: tenant updates a global product (`test_n2_…`, strict xfail) |
| `POST /inventory/locations` | `inventory.locations.write` | NULLABLE | `create_location` (C) | tenant-less creates global |
| `POST /inventory/stock/adjust` | `inventory.stock.write` | NULLABLE | `adjust_stock` → product `get_product` (**G**), location `list_locations` (S) | global product accepted; inconsistent with CND-1 (`test_rc1_…::test_stock_adjust_global_row_semantics`) |
| CND-1 `ProductReferenceContractV1` | in-process | tenant required (empty for none) | `contract_impl` (**S**) | **already strict**: the model to follow |

### 1.5 Leave Management (`external_modules/leave_management`)

| Endpoint | Permission | Tenant | Service → loader | Ownership today | Existing tests |
|---|---|---|---|---|---|
| `POST /leave-management/requests` | `…requests.write` | **NULLABLE** (`_tenant_uuid` → None → stored) | `create_request` (C) | tenant-less creates a global leave request. **Correction:** N-2A §7 listed Leave under "refuse"; only the workflow-transition routes refuse | `test_leave_management_real_flow.py`, `test_capability_tenant_scoping.py::test_leave_create_with_a_global_leave_request_present` |
| `POST …/requests/{id}/submit`, `/approve`, `/reject`, `/cancel` | write / approve | REQ (`_workflow_caller_context`, `api.py:50`) | `submit_request` / `decide_request` / `cancel_request` → `_load_tenant_scoped_request` (**G**, `service.py:51-71`) | tenant can transition a global leave request (code; 0 global rows) | `test_leave_management_lifecycle.py`, `test_leave_management_worklist.py` |
| Capability `leave_management.leave_request.create:v1` | capability | executor REQ | `create_request` | **strict** (RC-3, H-1 pinned) | `test_capability_leave_management.py` |

### 1.6 Workflow Studio (`app/modules/workflow_studio`, about 54 mutating routes)

**Tenant source:** `tenant_id=user.tenant_id`. It is NULLABLE on every create (workspaces, drafts, versions, templates, imports, clones).

**Single loader for every DB-backed get/update/delete:** `infrastructure/repositories.py::_enforce_tenant` (`:89-102`). It returns early for `tenant_id IS NULL` (**G**). It is used by:
- `SqlAlchemyWorkspaceRepository.get/update/delete` (`:119-149`);
- `SqlAlchemyDraftRepository.get/update/delete` (`:179-212`);
- `SqlAlchemyTemplateRepository.get/update/delete` (`:230-277`);
- `SqlAlchemyVersionRepository.get/update` (`:302-330`).

`list_by_folder`/`list_by_workspace` return own **plus** global rows.

**Affected routes (all through those repositories):**
- workspaces: `POST /` create, `open`, `close`, `archive`, `restore`, `clone`, `lock`, `unlock`, `export`, `import`;
- drafts: `POST /`, `PUT /{id}`, `DELETE /{id}`, `autosave`, `checkpoint`, `undo`, `redo`, `validate`, `merge`, `conflicts`, `snapshot`, `restore`;
- versions: `POST /`, `tag`, `release-notes`, `merge`, `restore`;
- templates: `POST /`, `PUT`, `DELETE`, `import`;
- publish: `POST /{draft_id}`, `versions/{id}/archive`, `versions/{id}/rollback`;
- validation;
- simulation and collaboration: their DB access was **not traced** in this phase (see §9 B-4).

**Ownership today:** every tenant can update or delete the 596 global workspaces, 592 drafts and 77 versions, which are mostly Playwright artefacts (N-2A §6). Code evidence only; not executed.

**Domain-intended global concept:** `templates/registry.py::register_builtin` (`is_builtin=True`). This is the only place in the codebase that expresses "platform-provided, shared" intent (§3.4).

### 1.7 Platform runtime (cross-cutting)

| Path | Tenant | Loader | Ownership today |
|---|---|---|---|
| `POST /application-flows/{code}/steps/{step}/submit`, `/instances/{id}/resume` | `_tenant_uuid(user)` → None allowed | `runtime._load_instance_for_update` (`runtime.py:525-547`): `instance.tenant_id != _tenant_uuid(user)` | **S** for tenant callers. **Gap:** a tenant-less caller and a NULL-tenant instance compare equal (`None == None`), and a tenant-less start creates a NULL-tenant instance (0 rows today) |
| `POST /worklist/{instance}/actions/{action}` | same | `worklist.py:250-253`, same comparison | same gap; module actions then require a tenant (`task_presenter._decide`) |
| Form Platform (8 mutating routes) | `caller_tenant` REQ | strict tenant-filtered loaders; `tenant_id NOT NULL` | **already strict**; the 269 unpinned H-1 versions were not inspected |
| Capability executor | REQ (`_resolve_tenant`) | handler's service | strict for both published capabilities; unscoped refused (RC-3) |
| External boundary probe `POST /items` | REQ | contract | strict |
| `dashboard`, `metadata`, `notifications`, `gateway`, `scheduler`, `modules`, `system`, `workflow`, `workflow_registry` routers (about 62 mutating routes) | mixed | — | **Platform/Workflow domain, not N-2 business data.** Out of this plan's scope, except that S2's platform-admin principal must be applied to them in a later platform phase (§9 B-5) |

## 2. Findings and Severity

| ID | Finding | Severity | Scope | Closes in |
|---|---|---|---|---|
| **F-1** | Pre-mutation loaders admit global rows. Affected: Sales confirm/decide/cancel (+ worklist actions), Accounting post/decide (+ worklist), HR `update_employee`, Inventory `update_product`, Leave submit/approve/reject/cancel, Studio update/delete (≈ 40 routes) | **HIGH** (N-2 D-1; proven for cancel over HTTP and for update_employee/update_product at the service tier) | app | **S1** |
| **F-2** | Tenant-less callers create business rows: 12 business create routes (Sales 2, HR 3, Accounting 2, Inventory 4, Leave 1), plus Studio creates, flow start | **MEDIUM** (N-2 D-3) | app + auth | **S3** (after S2) |
| **F-3** | By-id reads admit global rows while lists hide them | MEDIUM (N-2 D-4) | app | S4 |
| **F-4** | Reference checks admit global rows: `create_order.customer_id`, `create/update_employee.department_id/position_id`, `create_journal_entry.lines[].account_id` (C-2), `adjust_stock.product_id` | MEDIUM (N-2 D-5) | app; data-dependent | **S4** (blocked, §9) |
| **F-5** | Flow and worklist `None == None` ownership match for tenant-less callers on NULL-tenant instances | LOW (0 rows) | app | S3 (tenant required) |
| **F-6** | **N-2A §7 correction:** Leave HTTP create is NULLABLE, not REQ | Documentation error | — | this doc |
| F-7 | Unchecked references `departments.parent_id`, `positions.department_id`, `accounts.parent_id`, `product_categories.parent_id`, `products.category_id` (create + `update_product`) | Known N-3 | app | N-3 (will use the S1 helper) |
| F-8 | The auth model cannot distinguish a platform admin from a tenant-less business caller (both "no `tid`"); `is_superuser` → `*.*.*` | MEDIUM (design) | auth | **S2** |

## 3. Proposed Ownership Enforcement

### 3.1 One helper, module-agnostic

**Location:** a new `app/core/multi_tenancy/ownership.py`.
- It depends only on SQLAlchemy and `uuid`, so every module, including external ones, can import it. That is the same layer as `async_tenant_context`.
- It never imports a module.
- RLS stays the second layer; nothing here relies on it.

```python
class TenantRequiredError(Exception): ...          # → 403 at the HTTP edge

def require_tenant(tenant: str | uuid.UUID | None) -> uuid.UUID:
    """Normalize (str/UUID), refuse None/malformed. The ONLY accepted owner."""

def is_owned(row, tenant: uuid.UUID) -> bool:
    """row.tenant_id is not None and row.tenant_id == tenant (str/UUID-safe)."""

async def load_owned(session, model, row_id, tenant, *, for_update=False):
    """Strict: SELECT … WHERE id = :id AND tenant_id = :tenant [FOR UPDATE].
    Returns None for missing, other-tenant AND global rows (indistinguishable).
    Used for EVERY mutation and EVERY reference check."""

async def load_visible(session, model, row_id, tenant, *, global_readable: bool = False):
    """load_owned, plus a global row only when the entity is declared
    globally readable. Used for by-id reads only."""
```

- Studio's tenant column is varchar, so the helper compares `str(tenant)` for string columns, keyed on the column type. This is the same normalization C-2 needed (`_as_tenant`).
- The query embeds the tenant predicate (`WHERE … AND tenant_id = :t`) instead of `session.get()` plus a Python check. That keeps the `FOR UPDATE` lock and the ownership check atomic.

### 3.2 Module usage (boundaries preserved)

- Each module keeps its **own** typed errors and HTTP mapping: `SalesReferenceNotFoundError`, `HRReferenceNotFoundError`, `AccountReferenceNotFoundError` (C-2), `CustomerCodeConflictError`, Studio `*NotFoundError`. The helper returns `None`; the module decides the error.
- The existing loaders change in place, so their signatures and callers stay the same:
  - `_load_tenant_scoped_order`, `_load_tenant_scoped_entry`, `_load_tenant_scoped_request`, `update_employee`, `update_product`, Studio `_enforce_tenant` → `load_owned`;
  - `get_*` → `load_visible`.
- Cross-module references keep going through the owning module's contract. The CND-1 `ProductReferenceContractV1` already implements `load_owned` semantics; no direct ORM import is introduced.

### 3.3 Required behaviour

| Case | By-id read | Mutation (update / delete / transition) | Reference in a create or update | Create |
|---|---|---|---|---|
| Missing tenant context | 403 `No tenant context resolved` (route dependency, before any lookup) | 403 | 403 | 403 |
| Same-tenant row | 200 | allowed (business rules apply) | accepted | row owned by the caller's tenant |
| Other-tenant row | 404 (same body as missing) | 404 | 422 `<Entity> '<id>' not found` (C-2/CND-1 shape) | — |
| Global row, entity **not** globally readable (all business entities) | 404 | 404 | 422 | never created by a tenant API |
| Global row, entity declared globally readable (candidate: Studio `is_builtin` templates, §3.4) | 200 | **403** `platform-owned record` (existence already disclosed) | only with an approved `same_tenant_or_approved_global` declaration | never by a tenant API |
| Missing row | 404 | 404 | 422 | — |
| Platform-admin caller on a business route | 403 unless it carries a tenant (§4) | 403 | 403 | 403 |
| Platform-admin caller on a `/platform/*` route | per platform endpoint, under `TenantContext.system()` | same | n/a | creates platform data only |

Service-layer defence in depth: every service mutation path calls `require_tenant(...)` itself. A non-HTTP caller (worklist, flow, Application Flow action) with `None` raises `TenantRequiredError`; it never falls back to global.

### 3.4 Declarations

- Each module has `GLOBAL_READABLE: frozenset[type]` and `GLOBAL_REFERENCE_APPROVALS: frozenset[tuple[str, str]]` (`(entity, field)`).
- Both are **empty** and pinned by a test, in the RC-3 `UNSCOPED_CAPABILITY_APPROVALS` style.
- The only candidate entry is Studio builtin templates (`GLOBAL_READABLE`). It requires a Workflow-domain decision (§9 B-3).
- C-2 and CND-1 are preserved as approved: references are same-tenant by default; any global exception needs separate approval. **No entry is added by this plan.**

### 3.5 Regression guard (AST, unit tier)

These forbid reintroducing the patterns in `app/modules/**` and `external_modules/**`:
- the idiom `X.tenant_id is not None and X.tenant_id != tenant_id`;
- `session.get(<TenantModel>, …)` followed by a Python ownership check;
- `ctx.tenant_id if ctx.tenant_id else None` in route modules.

The existing allow-listed exceptions are listed explicitly, the same way as `test_modules_mutate_only_their_own_capability_registrations` (H-1).

## 4. Platform-Admin Authentication and Endpoint Design (working assumption: explicit platform-admin endpoints)

**Today:**
- login → `is_superuser` → `roles=["superadmin"]`, `permissions=["*.*.*"]`;
- `tid` only from `users.tenant_id`;
- no claim distinguishes platform scope;
- `*.*.*` satisfies **every** `require_permission`.

**Required changes before S3:**

| # | Change | Where | Why |
|---|---|---|---|
| A-1 | A distinct, signed principal-scope claim, e.g. `"scp": "platform"` for an `is_superuser` user with no tenant, `"scp": "tenant"` otherwise. It is set at login **and** refresh | `api/v1/auth.py:132` (token), `:188` (refresh), `core/auth/jwt.py` | Platform administration must be an explicit credential, never inferred from a missing `tid` (N-2 P-6) |
| A-2 | `UserContext.scope` parsed from the claim. A missing claim on an old token means `tenant` (fail closed: no platform rights) | `core/auth/dependencies.py:56` | Backward-compatible tokens get no new power |
| A-3 | `require_tenant_context` dependency: 403 when `tid` is missing or malformed, **regardless of permissions** (also for `*.*.*`) | new, in `core/auth/dependencies.py`; applied to every business route in §1.1–1.6 | Replaces the per-module copies (`_workflow_caller_context`'s check, Leave `api.py:50`) with one rule |
| A-4 | `require_platform_admin` dependency: needs `scope == "platform"` **and** an explicit `platform.admin` permission check that **does not match by wildcard** | new | `*.*.*` must not silently become platform authority, and a tenant superuser must not reach platform routes |
| A-5 | Platform endpoints under `/api/v1/platform/…`, executed inside `TenantContext.system()` with audit (`AuditService.record`, actor plus `scope=platform`) | new router; **no endpoint is required for N-2 itself**, because no platform-data write route exists today | Gives P-6 a home: the account-type catalogue, builtin Studio templates and global roles when needed |
| A-6 | **Not in scope:** tenant impersonation or tenant selection for support staff. `workflow/security/impersonation` stays unreachable. A future "act as tenant" flow needs its own gate (short-lived tenant token, reason, audit) | — | Avoids reintroducing the removed `X-Tenant-ID` override |
| A-7 | Seeded `admin` (`scripts/db.py`) stays the tenant-less superuser and becomes a **platform** principal. Demo business data uses the demo tenant users (`manager`, `user1`) | `scripts/db.py` (seed text only) | The demo platform admin can no longer create global business rows |

**Effect:** a superuser *with* a tenant keeps today's behaviour inside that tenant (`*.*.*`, `scope=tenant`). A superuser *without* one can no longer reach business routes. RBAC semantics (`RBACEngine`, wildcard matching for tenant permissions) are unchanged.

## 5. Playwright Fixture Transition

- **Current:** `frontend/shell/e2e/fixtures/api-setup.ts::getAdminToken` logs in `admin`/tenant-less, and `seedWorkspaceAndDraft` creates global Studio workspaces and drafts. That produced 591 / 587 of the global Studio rows (N-2A §6).
- **Specs using the admin token (17):**
  - `studio-collaboration`, `studio-editor-basics`, `studio-execute`, `studio-history-version`, `studio-simulation`, `studio-ux`, `studio-validate-publish`;
  - `dynamic-module`, `multi-module-runtime`;
  - `declarative-flow-{action,persisted-wait,real-erp,workflow-step}-proof`;
  - `form-sales-customer-proof` (module activation part), `auth.spec`;
  - `auth.setup.ts`, `authenticated-test.ts`.
- The business specs (sales, leave, accounting, worklist, form builder) already log in as **tenant** users seeded by `backend/scripts/seed_worklist_e2e.py` (`phase46-tenant-a/b`, password `worklist123`).

**Migration, with no production rule weakened:**
1. Extend `seed_worklist_e2e.py` (test seed only) with a tenant-scoped role `phase_studio_designer` and users `phase_studio_designer_a/b`, holding `studio.workspace.*`, `studio.draft.*`, `studio.publish.execute`, `studio.simulation.execute`, `studio.template.read`, `studio.review.*`, in `phase46-tenant-a/b`. Same idempotent pattern as the existing roles.
2. Add `getStudioToken(tenant)` to `api-setup.ts`. `seedWorkspaceAndDraft` uses it, so Studio fixtures become **tenant-owned**.
3. Keep `getAdminToken` only for genuinely platform operations: module activation in `dynamic-module` and `multi-module-runtime`, and the activation steps of the form proofs. Classify each of the 17 specs during S2. Where a spec currently mixes a platform step and business steps, split the token use.
4. Add a cross-tenant Studio assertion (tenant B gets 404 on tenant A's workspace) to `studio-editor-basics`.
5. Order: the fixture migration lands **in S2, before S3**, so S3's 403 never meets an unmigrated fixture. The UI Studio pages run as the logged-in user, so specs that log in through the UI as `admin` must switch to the Studio user.
6. **Leftover data:** the existing global E2E rows are **not** migrated or deleted by this plan (N-2A §10 cleanup candidates; separate approval).

## 6. Global Rows and Reference Fields Whose Behaviour Changes

| Data (test DB, N-2A) | S1 | S3 | S4 |
|---|---|---|---|
| 76 global `sales.customers` (test) | — | no new ones | 404 by id; 422 as an order's `customer_id` |
| Global orders, entries, employees, products, leave requests (0 each) | become immutable for tenants (404) | no new ones | 404 by id |
| 596 / 592 / 77 global Studio workspaces / drafts / versions (591/587 E2E, 5 unknown) | **tenants can no longer update or delete them** (404) | no new ones | 404 by id; disappear from `list_by_folder`/`list_by_workspace` |
| Studio builtin templates (0 rows in DB; registry seeds) | write 403 | — | readable only if declared |
| Reference fields | — | — | `sales_orders.customer_id`, `employees.department_id/position_id`, `journal_lines.account_id`, `stock adjust product_id` → same-tenant only |
| Already strict, unchanged | `sales_order_lines.product_id` (CND-1), Form Platform, capabilities, flow instances (tenant callers) | | |

**Real-database equivalents:** unknown (N-2A: NOT INSPECTED).

## 7. Required Tests

**Unit (no DB):**
- `ownership.py` matrix: owned, other, global, missing, None tenant, malformed tenant, str-vs-UUID and varchar columns, `for_update` predicate present in the compiled SQL;
- `require_tenant`;
- the declaration registries pinned empty;
- the AST regression guard (§3.5);
- auth: claim present and absent on login and refresh, `UserContext.scope` default, `require_tenant_context` 403 even with `*.*.*`, `require_platform_admin` not satisfiable by wildcard nor by a tenant-scoped superuser.

**Real PostgreSQL, service tier** (rolled back; own + other-tenant + **global** + missing rows present; counts under bypass prove nothing was written):
- every loader in §1 for read, mutate and reference;
- each case run once **with RLS active** (the app role, as N-2's tests do) and once **inside a bypass session**, to prove the **application** layer rejects even when the database would allow it (N-2 §11).

**HTTP tier** (real routers, `TenantContextMiddleware`, real JWTs incl. tenant-less and platform-scope tokens, commit + cleanup with a zero-residue assertion):
- every endpoint in §1.1–1.6: 403 missing tenant, 404 other and global, 200 own, 422 for references;
- Studio covered per repository method, with at least one route each.

**Inversions:**
- N-2's 5 strict xfails become normal tests in S1 (cancel / update_employee / update_product) and S5 (DB insert). They XPASS-fail until converted.
- N-2's characterization tests (`…tenantless_caller_creates_global_rows…`, `…by_id_loaders_show…`) invert in S3/S4.
- C-2's three `…global_…_follows_the_system_record_convention` tests invert in **S4**.
- `test_rc1_…::test_stock_adjust_global_row_semantics` updates in S4.

**Must stay green:**
- RC-1 (`test_capability_reference_inventory`, `test_rc1_reference_candidates`);
- RC-2 snapshots;
- RC-3 (unit 21, PG 4);
- C-2 non-global cases (14);
- CND-1 (unit 14, PG 10);
- H-1 (unit 49, PG 11; fingerprints unchanged, since no capability contract changes);
- Workflow `test_tenant_isolation.py::test_global_definition_still_startable_by_any_tenant`, which is platform data and intentionally global.

**Mutation check per stage** (house standard): remove each strict predicate, `require_tenant` call and dependency in turn, and show a test fails.

**Playwright:** the full suite after S2 (fixture migration) and after S3.

## 8. Compatibility Risks and Rollout Order

| Risk | Stage | Mitigation |
|---|---|---|
| A deployment relying on tenants confirming, cancelling or editing rows created by a tenant-less admin breaks (404) | S1 | This is the policy's intent. The S1 gate requires owner acknowledgement. Real-DB counts of global *mutable* rows (orders, entries, employees, leave) are desirable, but S1 only removes tenant *write* access to rows no tenant owns, and it fails closed |
| Seeded/demo `admin` can no longer create business data | S3 | A-7: use the demo tenant users; documented in the release notes |
| 17 Playwright specs use the tenant-less admin | S2/S3 | §5 migration lands in S2 |
| Old tokens without a scope claim | S2 | Default `tenant`, so no platform rights. Tenant-less old tokens hit 403 on business routes from S3, which is intended |
| Studio users lose sight of global E2E workspaces and drafts | S1 (write), S4 (read) | Test data only (N-2A). The 5 unknown records need an owner decision **before S4** |
| C-2 reversal rejects global references | S4 | Blocked until the real-DB inventory shows how many tenant rows reference global customers, departments, positions or accounts |
| Workflow routing: Sales/Accounting/Leave transitions start real workflows | S1 | The strict loader runs before any workflow call. Concurrency tests (`…concurrent_confirm`, `…full_state_machine`) must stay green |

**Rollout order:**
1. S1;
2. S2, with the fixture migration;
3. S3;
4. **real-DB inventory** (N-2A O-1);
5. S4;
6. S5 (a separate N-2 DB phase).

## 9. Blockers Requiring Real-Database Evidence (or an owner decision)

- **B-1 (blocks S4, S5).** A real-DB inventory through an authorized read-only audit role (N-2A O-1), covering:
  - tenant-owned → global references for `customer_id`, `department_id`, `position_id` and `account_id`;
  - global mutable rows (orders, entries, employees, leave);
  - NULL-tenant counts per business table.
- **B-2 (blocks S5).** Classification of every NULL-tenant business row (N-2 §12) before `NOT NULL`/RLS changes.
- **B-3 (blocks the Studio part of S4).** A Workflow-domain decision on builtin templates (`GLOBAL_READABLE`?), on the 5 unknown Studio records, and on whether global `wf_definitions` are platform templates (`test_global_definition_still_startable_by_any_tenant` suggests yes for some).
- **B-4 (blocks the Studio part of S1).** A trace of whether simulation and collaboration routes touch DB rows outside the four repositories. Not done in this phase.
- **B-5 (not blocking N-2).** Applying A-3/A-4 to the platform routers (`dashboard`, `metadata`, `notifications`, `gateway`, `scheduler`, `modules`, `system`, `workflow`, `workflow_registry`) is a separate platform phase.

S1, S2 and S3 do **not** need real-DB evidence to be safe: they only remove tenant access to rows no tenant owns, and refuse tenant-less creation. They do need the owner's acknowledgement of the §8 compatibility risks.

## 10. Staged Implementation Sequence and GO Gates

| Stage | Content | Entry condition | GO gate (all required) |
|---|---|---|---|
| **S1 Strict mutations** | `ownership.py` (`require_tenant`, `is_owned`, `load_owned`); convert all pre-mutation loaders (§1) incl. Studio `_enforce_tenant` for update/delete; service-level `require_tenant`; AST guard | approval of this plan + §8 acknowledgement + B-4 for Studio | N-2 cancel/update_employee/update_product xfails converted and green; per-loader PG matrix with RLS on/off; HTTP matrix for every mutating route; mutation check 100 %; RC-1/2/3, C-2, CND-1, H-1, concurrency suites green; no read or reference behaviour changed |
| **S2 Platform principal + fixtures** | A-1 to A-4, A-7; `require_tenant_context` available (not yet applied to creates); Playwright §5 migration + seed users | S1 GO | auth unit matrix; old-token compatibility test; Playwright full suite green with Studio specs on tenant users; no business route behaviour changed |
| **S3 Refuse tenant-less creates** | apply `require_tenant_context` to the 12 business create routes + Studio creates + flow start; close F-5 | S2 GO | HTTP 403 matrix incl. `*.*.*` tenant-less and platform-scope tokens; N-2 `…tenantless_caller_creates_global_rows…` inverted; Playwright green |
| **S4 Strict reads + references** | `load_visible` for by-id reads (lists already strict); C-2 references + stock adjust → `load_owned`; declarations (empty unless approved) | **B-1**, B-3, owner sign-off on the C-2 reversal | C-2 global tests inverted; RC-1 stock test updated; read matrix (404 for global); real-DB inventory attached to the gate |
| **S5 Database enforcement** | strict RLS for business tables, write-split for platform tables, then `NOT NULL` (N-2 §8) | **B-1, B-2**, data classified/migrated | fresh-DB upgrade/downgrade/upgrade; N-2 DB xfails converted; full PG suite per-file green |

Each stage is a separate phase with its own readiness report, and none is started by this plan.

## 11. Preserved Guarantees

- **RC-1:** reference inventory is unchanged, and published capabilities have no reference inputs.
- **RC-2/H-1:** no capability descriptor changes, so the pinned fingerprints and snapshots are unchanged; the registry and form-pin rules are untouched.
- **RC-3:** the executor already requires a tenant. `UNSCOPED_CAPABILITY_APPROVALS` stays empty.
- **C-2 / CND-1:** same-tenant default; global exceptions only by separate approval (§3.4).
- **Form Platform:** already strict. The 269 non-draft versions without H-1 fingerprints were **not inspected or rewritten**.

## 12. Confirmations

- No production code, test, schema, RLS, migration, configuration, authentication or data change was made.
- No database was queried in this phase.
- Inventory was not activated, and no capability was published.
- **No commit, no push**, no Git remote change.
