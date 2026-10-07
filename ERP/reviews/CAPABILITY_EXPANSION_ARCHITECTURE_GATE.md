# Business Capability Expansion — Architecture Decision Gate

**Type:** audit only, no implementation · **Date:** 2026-10-07 · **Auditor role:** Principal Architect
**Follows:** `FORM_BUILDER_PHASE_3C_ARCHITECTURE_GATE.md` (DEFER: only one capability exists) · **Decision:** **PROCEED** with one capability (§18, §20)

> No production code, test, schema, migration, API, UI or dependency was changed. The only file created is this document. Read-only checks are listed in §21.

---

## 1. Executive Summary

The system registers **one** capability, `leave_management.leave_request.create:v1`. I inventoried every business operation exposed through HTTP in the five business modules found:

- `leave_management` (`backend/external_modules/`);
- `hr`, `sales`, `inventory`, `accounting` (`backend/app/modules/`).

Each candidate was checked against the contract, domain, parity, tenant and Form Platform renderability criteria. Most operations are **not ready**, for four recurring, evidence-backed reasons:

1. **Workflow-bound lifecycle operations.** Leave submit/cancel, Sales confirm/decide/cancel and Accounting post/decide run through the Workflow caller-identity bridge (`_workflow_caller_context`). Architecture tests confine that bridge to `api.py` / `flow_step.py`, and the capability executor does not establish it.
2. **Cross-tenant reference gaps.** HR employee/position create, Sales order create and Accounting journal create accept foreign-key ids that the service never resolves through a tenant-scoped lookup.
3. **Nested contracts the Form Platform cannot render.** Sales order lines and journal lines are lists of objects.
4. **Untyped error models.** Duplicate unique codes raise a raw `IntegrityError`, which becomes HTTP 500, in every module. No module API handles it.

**One operation meets every PROCEED criterion:** `sales.customer.create`.

- **Contract:** a flat `CustomerCreate` DTO, already the HTTP contract. Every field renders in the Form Platform today.
- **Service:** the authoritative `SalesService.create_customer`, shared with the HTTP route.
- **References:** none, so there is no cross-tenant reference risk.
- **Permission and RLS:** existing permission `sales.customers.write`; `sales.customers` is under forced RLS.
- **Module state:** `sales` is the module normally kept active.
- **Value:** it is master data that every sales order depends on, and it gives the Form Builder its first form outside HR/Leave with **no Builder change**.

It carries **three phase-entry conditions**, all owned by the Sales module (§18). None requires a platform change:

- a typed duplicate-code rejection;
- an `on_deactivate` withdrawal hook;
- a pinned v1 contract snapshot.

**Contract integrity (H-1)** today rests on a written policy plus developer discipline. Nothing enforces it in code. This is non-blocking debt at a count of two capabilities, and a blocker for Transport or for a large capability surface (§16).

---

## 2. Current Capability Baseline: `leave_management.leave_request.create:v1`

| Aspect | Verified fact |
|---|---|
| Owner / resource / action / version | `leave_management` / `leave_request` / `create` / `1` (`external_modules/leave_management/capabilities.py:35`) |
| Input | `LeaveRequestCreate` (`schemas.py`): `leave_type` (validated against `annual/sick/unpaid`), `start_date`, `end_date` (≥ start), `reason` ≤ 2000 |
| Output | `LeaveRequestOut` |
| Permission | `leave_management.requests.write`, the same code `POST /leave-management/requests` requires |
| Authorization | Executor step 3 → `caller.has_permission` → RBAC |
| Tenant | Executor `_resolve_tenant` (caller only, must match the ambient tenant, no bypass) → `async_tenant_context` → RLS `SET LOCAL` |
| Service invoked | `LeaveRequestService.create_request(session, tenant_id=ctx.tenant_id, requester_user_id=ctx.caller.user_id, data=data)`: the **same call and arguments** as `api.py::create_leave_request` |
| Persistence | `LeaveRequest` row, `status="draft"`; executor-owned unit of work and commit |
| Registration | `module.setup()` → `register_capabilities()`; `on_deactivate()` → `unregister_capabilities()` |
| Tests | PG `test_capability_leave_management.py`, 9 passed today. Covers activation/withdrawal, caller-tenant write, **HTTP/capability shared contract**, RLS, injected `tenant_id` ignored, unauthorized → nothing written, missing tenant refused, cross-tenant refused, domain validation stays in the module. |
| Form Runtime usage | Bound by every Form Builder E2E and runtime proof (recorded: `form-runtime-proof`, `form-builder-proof`, `form-lifecycle-proof`) |
| Deliberately not published | submit / approve / reject / cancel (Workflow caller bridge) and update (does not exist), per the module's own docstring |

**Baseline verdict: sound.** It is the template the next capability must follow.

---

## 3. Business Module Inventory

| Module | Location | Kind | Has HTTP API + service | Workflow-coupled | Notes |
|---|---|---|---|---|---|
| `leave_management` | `backend/external_modules/` | Business | Yes | Yes (approval) | Only module with a capability |
| `hr` | `backend/app/modules/` | Business | Yes | No | No `on_deactivate` hook |
| `sales` | `backend/app/modules/` | Business | Yes | Yes (order approval) | No `on_deactivate` hook; normally active (recorded baseline) |
| `inventory` | `backend/app/modules/` | Business | Yes | No | Has `on_deactivate` |
| `accounting` | `backend/app/modules/` | Business | Yes | Yes (journal approval) | No `on_deactivate` hook |
| `workflow_studio` | `backend/app/modules/` | **Platform** (workflow design tooling) | — | — | Not a business module; excluded |
| `external_boundary_probe` | `backend/external_modules/` | **Test probe** | — | — | Not a business module; excluded |

**Not found:** separate **CRM** and **Finance** modules. Customer records live in `sales`, and the ledger lives in `accounting`. No capability is invented for modules that don't exist.

Module activation state could not be read directly: `core.modules` is under forced RLS, and a tenant-less read returns no rows. "Sales active, others inactive" is the **recorded** dev baseline from earlier phases.

---

## 4. Existing Business Operation Inventory

Only operations backed by an HTTP route **and** a service method are listed (`api.py` → `service.py`, read for this gate).

| Module | Existing operation | Existing API | Application service | Capability exists | Candidate |
|---|---|---|---|---|---|
| Leave | create request | `POST /requests` (`requests.write`) | `create_request` | **YES** (v1) | — |
| Leave | submit for approval | `POST /requests/{id}/submit` (`write`) + caller bridge | `submit_request` → starts workflow | NO | `leave_management.leave_request.submit` |
| Leave | approve / reject | `POST /requests/{id}/approve\|reject` (`approve`) + bridge | `decide_request` | NO (registered as Human Task actions) | — (Workflow action) |
| Leave | cancel | `POST /requests/{id}/cancel` (`write`) + bridge | `cancel_request` (cancels workflow if pending) | NO | `leave_management.leave_request.cancel` |
| Leave | get / list | `GET /requests[/{id}]` (`read`) | `get_request` / `list_requests` | NO | (query; see §13) |
| HR | create department | `POST /departments` (`departments.write`) | `create_department` | NO | `hr.department.create` |
| HR | create position | `POST /positions` (`departments.write`) | `create_position` | NO | `hr.position.create` |
| HR | create employee | `POST /employees` (`employees.write`) | `create_employee` | NO | `hr.employee.create` |
| HR | update employee | `PATCH /employees/{id}` (`employees.write`) | `update_employee` | NO | `hr.employee.update` |
| Sales | create customer | `POST /customers` (`customers.write`) | `create_customer` | NO | **`sales.customer.create`** |
| Sales | create order | `POST /orders` (`orders.write`) | `create_order` | NO | `sales.sales_order.create` |
| Sales | confirm order | `POST /orders/{id}/confirm` (`orders.write`) | `confirm_order` → starts workflow | NO | `sales.sales_order.confirm` |
| Sales | decide approval | `POST /orders/{id}/approval/decide` (`orders.approve`) | `decide_order_approval` | NO | — (Workflow action) |
| Sales | cancel order | `POST /orders/{id}/cancel` (`orders.write`) | `cancel_order` | NO | `sales.sales_order.cancel` |
| Inventory | create category / location | `POST /categories`, `/locations` | `create_category` / `create_location` | NO | `inventory.product_category.create`, `inventory.stock_location.create` |
| Inventory | create / update product | `POST /products`, `PATCH /products/{id}` (`products.write`) | `create_product` / `update_product` | NO | `inventory.product.create` / `.update` |
| Inventory | adjust stock | `POST /stock/adjust` (`stock.write`) | `adjust_stock` | NO | `inventory.stock.adjust` |
| Accounting | create account | `POST /accounts` (`accounts.write`) | `create_account` | NO | `accounting.account.create` |
| Accounting | create journal entry | `POST /journal-entries` (`journal.write`) | `create_journal_entry` | NO | `accounting.journal_entry.create` |
| Accounting | post entry / decide approval | `POST …/post`, `…/approval/decide` | `post_journal_entry` / `decide_entry_approval` | NO | — (Workflow-bound) |

All candidate names follow `<module>.<resource>.<action>` with a business-intent action. None is a mechanical name such as `repository.insert`.

---

## 5. Candidate Capability Matrix

Kinds: **R** = renders in the Form Platform today, according to `contract_fields()` run against the DTO's JSON Schema; **WF** = needs the Workflow caller bridge; **XT** = unchecked cross-tenant reference; **DUP** = unique-key violation becomes a 500.

| Candidate | R | WF | XT | DUP | Readiness |
|---|---|---|---|---|---|
| `sales.customer.create` | **Yes**: all 8 fields (`code`, `name` required text; `credit_limit` number; rest optional text) | No | **None** (no references) | Yes (`uq_sales_customer_code_tenant`) | **READY-WITH-CONDITIONS** |
| `hr.employee.create` | **No**: `department_id`, `position_id` (uuid) and `hire_date` (datetime) have no kind | No | **Yes** (`department_id`, `position_id`) | Yes | NOT READY: business contract incomplete |
| `hr.employee.update` | No (same fields; record-targeting) | No | Yes | — | NOT READY |
| `hr.department.create` | Partly (`parent_id` uuid) | No | Yes (`parent_id`) | Yes | NOT READY (low value, XT) |
| `inventory.product.create` | Partly (`category_id` uuid, `attributes` free dict) | No | Yes (`category_id`) | Yes (`sku`) | NOT READY |
| `inventory.stock.adjust` | Partly (two uuids) | No | **Checked** (tenant-scoped product/location lookups) | — | READY-WITH-CONDITIONS on the domain, but **no row lock** on `StockLevel` (concurrent adjustments lose updates) and free-string `movement_type` / `reference_type` |
| `sales.sales_order.create` | **No** (`lines: List[OrderLineCreate]`) | No | **Yes** (`customer_id`, `product_id`) | — | NOT READY |
| `accounting.journal_entry.create` | **No** (`lines`, min 2) | No | **Yes** (`account_id`) | — | NOT READY (domain invariant "balanced" is good) |
| `leave_management.leave_request.submit` / `.cancel` | n/a (id-only input) | **Yes** | — | — | NOT READY (bridge decision, ownership rule; §13) |
| `sales.sales_order.confirm` / `.cancel` | n/a | **Yes** | — | — | NOT READY |
| Approve / reject / decide / post | n/a | **Yes** | — | — | **Not capabilities for Form**: Workflow / Human Task actions |

---

## 6. Contract-First Audit

| Contract element | `sales.customer.create` | Others (summary) |
|---|---|---|
| Input DTO | `CustomerCreate`, flat, `code`/`name` required, max lengths, `credit_limit ≥ 0` | Exist for all candidates; nested or uuid-heavy for orders, journals and employees |
| Output DTO | `CustomerOut` (route `response_model`) | Exist |
| Validation | Pydantic in the module DTO | Same |
| Authorization | `sales.customers.write` | Existing per-route codes |
| Tenant | Caller-derived; executor fail-closed | Same executor; see §9 for reference gaps |
| Domain invariant | Unique `(code, tenant_id)`; non-negative credit limit | Journal: balanced (enforced); stock: non-negative (enforced); others thin |
| Transaction | One insert; executor unit of work | Order/journal: multi-row, single transaction (fine) |
| Error model | **Gap:** duplicate code → `IntegrityError` → 500 (no module API handles `IntegrityError`) | Same gap wherever a unique key exists |
| Idempotency | None. A duplicate submit is rejected by the unique code, which is a natural idempotency key **once typed** | Orders, journals, stock: **no natural key**; a double submit creates two documents or two movements |
| Audit | Inherits the HTTP AuditMiddleware on the Form Runtime route; in-process executor logs one line (Phase 1 R-13, unchanged) | Same |

Classified **NOT READY — BUSINESS CONTRACT INCOMPLETE:**

- `hr.employee.create`/`.update`, `hr.department.create`, `hr.position.create`, `inventory.product.create`: unchecked references; `attributes` is a free dict.
- `sales.sales_order.create`, `accounting.journal_entry.create`: unchecked references, no idempotency key, nested lines.

---

## 7. Domain Ownership Audit

Every candidate already follows **Capability → module Application Service → domain rules → ORM/RLS**. No candidate would require a capability to reach a repository, the ORM or SQL directly. The handler is a thin adapter, exactly like `leave_management/capabilities.py::create_leave_request`.

The weakness is **thin domains**, not wrong ownership. `create_employee`, `create_customer` and `create_product` construct a row from the DTO without further rules. For `sales.customer.create` that is acceptable: the business meaning of "create a customer record" is the uniqueness plus validation already present, and the module still owns it. For employees, orders and journals, the missing tenant-scoped reference resolution is a **domain gap the module must close before** exposure. A capability must not compensate for it.

---

## 8. API / Capability Parity Audit

| Candidate | HTTP path | Capability path (as required) | Parity |
|---|---|---|---|
| `leave_request.create` (existing) | `api.py` → `create_request` | `capabilities.py` → `create_request` (same args) | ✅ proven by the PG test `test_capability_and_http_route_share_one_contract` |
| `sales.customer.create` | `api.py:131` → `SalesService.create_customer(session, data, tenant_id=…)` | Must call the **same** method with `tenant_id=ctx.tenant_id` | ✅ achievable without a second service |

**Disclosed divergence (pre-existing, not fixed):** HTTP routes in `hr`, `sales`, `inventory` and `accounting` compute `tenant_id = ctx.tenant_id if ctx.tenant_id else None`. A caller with **no tenant** therefore creates a `tenant_id IS NULL` row, which the shared RLS policy treats as **global** (`rls.py` line 39). This is the same class as Phase 2's F-5.

The capability path is **stricter**: the executor refuses a tenant-less caller, so the capability cannot reproduce that behaviour. That is acceptable (fail-closed) and must be documented as a deliberate difference, not "fixed" by loosening the capability.

---

## 9. Tenant / Security Audit

| Check | `sales.customer.create` | Notes for others |
|---|---|---|
| Tenant from `caller.tenant_id` only | ✅ executor | ✅ for all, via the executor |
| Authenticated caller + RBAC | ✅ `sales.customers.write` | ✅ |
| RLS | ✅ `sales.customers` is in `RLS_TABLES` (Phase 3.0G), forced | HR / Inventory forced in `p1q2r3s4t5u6`; Accounting `accounts`, `journal_entries` in `RLS_TABLES` |
| Cross-tenant: tenant A writes only tenant A | ✅ no foreign keys in the input | ❌ **XT gap:** PostgreSQL foreign-key checks are not filtered by RLS, so an unresolved `department_id` / `customer_id` / `account_id` from another tenant would be accepted as a reference (*code reading; not executed — proving it needs a cross-tenant write, outside audit scope*) |
| Module activation / deactivation | ⚠ **condition:** `sales/module.py` has `setup()` but **no `on_deactivate`**, so a registered capability would keep resolving after deactivation | Inventory has a hook; HR and Accounting don't |
| Audit | Form Runtime HTTP route → AuditMiddleware; executor log line | Same |
| Client-supplied tenant | ✅ an input contract may not contain `tenant_id` (checked at registration) | ✅ |

---

## 10. Versioning Audit

The **project policy exists**: `docs/architecture/CAPABILITY_PLATFORM.md` lines 100–101.

- **Same version (compatible):** adding an optional input field or an output field.
- **New version (breaking):** removing or renaming a field, adding a required input, or changing semantics. The previous version then moves `deprecated` (still executable for pinned consumers) → `disabled` → removed.

Compared with the brief's list:

| Brief item | Policy covers it? |
|---|---|
| Remove an input field | ✅ breaking |
| Change field meaning / semantic behaviour | ✅ "changing semantics" |
| Change requiredness | ⚠ Partly: "adding a required input" is covered; **optional → required on an existing field is not named explicitly** |
| Incompatible type change | ⚠ Implied by "renaming / semantics", **not named** |
| Change the result contract | ⚠ Only *adding* output fields is named compatible; **removing or retyping output is not named** |
| Internal refactor / performance | ✅ implicitly compatible |

**Debt:** the policy is incomplete on requiredness, type and output removal, and **nothing enforces it in code** (§16).

Every candidate here is proposed as `:v1`, explicitly.

---

## 11. Form Builder Reuse Analysis

| Candidate | New Form Builder use case | Works with today's Builder (no Builder change)? |
|---|---|---|
| `sales.customer.create:v1` | **Customer onboarding / registration form**, the first Sales form, with a form `owner_module = sales` | **Yes.** All fields map to `text`/`number`; `select` for a closed list is possible on text fields |
| `hr.employee.create` | Employee onboarding (high value) | **No:** uuid and datetime fields unrenderable; needs reference pickers (a Builder/runtime feature, deferred by the 3C gate) |
| `inventory.stock.adjust` | Stock adjustment form | Partly (uuid fields) |
| Order / journal create | Order entry, journal entry | **No:** line tables are not supported by SchemaForm |
| Submit / cancel / approve | "Cancel leave" form | **Low value:** id-only input; a button on the object page, not a form |

`sales.customer.create` is the only candidate that creates a **real new form today**. It also tests something the single leave capability cannot: a form bound to a **second module**, an internal `app/modules` module rather than an `external_modules` one.

---

## 12. Workflow Reuse Analysis

Required direction: **Workflow → Capability → Application Service → Domain**. A capability never imports Workflow.

- **`sales.customer.create`:** workflow-unaware (no workflow import in `create_customer`). Reusable as a step in a future "customer onboarding" flow or by Application Flow action handlers. Moderate Workflow value.
- **Leave submit/cancel, Sales confirm/cancel:** these *start or cancel* workflows from inside the service, so they are **workflow-triggering** operations. Exposing them as capabilities means deciding how the executor carries the caller identity into Workflow's authorization hook. That is the Phase 1 condition C-2, and it is not taken here.
- **Approve / reject / decide:** already Human Task actions (`register_task_action` in `leave_management/module.py:177-178`). **They must not become Form capabilities.**

---

## 13. Leave Module Deep Audit

| Operation | Exists? | Owner | Authorization | Lifecycle semantics | Capability or Workflow action? | Expose independently now? |
|---|---|---|---|---|---|---|
| create | Yes (v1 published) | Module | `requests.write` | → `draft` | Capability | Done |
| update | **No** (no method, no route) | — | — | — | — | **No:** not fabricated |
| submit | Yes | Module (starts the `leave_approval` workflow) | `requests.write` + caller bridge | `draft` → `pending_approval` | Module lifecycle that triggers Workflow | **No:** bridge decision (C-2); **no ownership rule** (any `write` holder in the tenant may submit anyone's draft; `service.py` never compares `requester_user_id`) |
| withdraw | **No** (cancel covers `pending_approval`) | — | — | — | — | No |
| cancel | Yes | Module (cancels the workflow if pending) | `requests.write` + caller bridge | `draft`/`pending_approval` → `cancelled` | Module lifecycle with a Workflow side-effect | **No:** same bridge and **ownership gap**; id-only input has low Form value. The service accepts `reason`, but the HTTP route never passes it, so the contract is unsettled. |
| approve / reject | Yes | **Workflow decides**; the module reacts (`decide_request`) | `requests.approve` + bridge | `pending_approval` → `approved`/`rejected` | **Workflow / Human Task action** | **No:** must not become a Form capability |
| balance inquiry | **No** (no balance model) | — | — | — | — | No |
| history / query | `get` / `list` | Module | `requests.read` | read-only | Query, not an operation | **No:** the Capability Platform models operations; read models have no consumer through Form Runtime |

**Ownership gap (recorded, not fixed):** submit and cancel authorize by permission only, not by "own request". This is a business-rule decision for the Leave module owner. It must be settled before either operation is published, so that a capability does not freeze the current permissive semantics into a versioned contract.

---

## 14. Other Module Readiness

| Module | Classification | Evidence |
|---|---|---|
| **Sales** | **READY-WITH-CONDITIONS** (for `customer.create` only) | Flat contract; no references; RLS; normally active. Conditions: typed duplicate rejection, `on_deactivate`, v1 snapshot. Orders: NOT READY (XT, nested, no idempotency, workflow-bound confirm/cancel). |
| **HR** | **NOT READY** | Unchecked `department_id`/`position_id`; uuid/datetime fields unrenderable; duplicate → 500; no `on_deactivate` |
| **Inventory** | **READY-WITH-CONDITIONS** for `stock.adjust` on the domain, **NOT READY** to expose | Tenant-checked references and an insufficient-stock rule ✅; no `StockLevel` row lock (lost update); free-string movement/reference types; inactive in the recorded baseline; product create has XT and a free `attributes` dict |
| **Accounting** | **NOT READY** | Balanced-entry invariant ✅; unchecked `account_id`; nested lines; posting/approval workflow-bound; no `on_deactivate` |
| CRM / Finance | **Not present** | No such modules |

---

## 15. Existing Debt / Conditions Audit

| Id | Prerequisite for a capability candidate? |
|---|---|
| C-3A-1 (draft concurrency) | No. It concerns form drafts, not capabilities. |
| C-3A-2 (AuthStore reload) | No |
| C-3A-3 (ESLint) | No |
| P3B-1 (archive stale UI) | No |
| G-3B-1 (list DTO) | No |
| O-1 (disabled capability renders) | No for `customer.create`. It becomes relevant when a capability is first moved to `disabled` (the version-retirement path in §10). |
| H-1 (same-version contract drift) | **Not a blocker for one more capability**, but expansion raises its exposure. The next phase must add a **module-level v1 contract snapshot test** (§16, §18). This is test-only and does not fix H-1 in the platform. |

**New findings** (recorded, not fixed):

- **N-1:** duplicate unique key → 500 in all module APIs.
- **N-2:** tenant-less HTTP creates produce global rows (§8).
- **N-3:** unchecked cross-tenant references in HR, Sales orders and Accounting journals (§9; hypothesis from code reading).
- **N-4:** Sales, HR and Accounting have no `on_deactivate`.
- **N-5:** Leave submit/cancel have no ownership rule.
- **N-6:** `StockLevel` adjustments are not row-locked.
- **N-7:** the versioning policy omits requiredness, type and output removal.

---

## 16. Capability Contract Integrity Assessment

> How does the system guarantee that `capability_id:v1` keeps the same public contract?

| Mechanism | Present? | Evidence |
|---|---|---|
| Immutable contract metadata | **No.** `CapabilityDescriptor` is a frozen dataclass per process, but re-registration of the same `(id, version)` **replaces** the entry, and nothing compares old and new | `registry.py` `register` |
| Schema fingerprint | **No** | No hash or digest in `core/capabilities` or `core/form_platform` |
| Registry validation | Partial: only that JSON Schema can be generated, the id namespace matches the module, and `tenant_id` is forbidden in input | `registry.py`, `contract.py` |
| Version compatibility check | **No** | — |
| Startup validation | **No** compatibility validation | — |
| Publish-time validation (Form) | ✅ The form presentation is re-validated against the **live** schema at publish | `form_platform/service.py::publish` |
| Runtime validation | ✅ The executor validates input against the live DTO. The renderer assumes presented fields still exist (`render_fields` `facts[f.name]`), so drift becomes an untyped 500 (H-1) | `executor.py`, `presentation.py` |
| Tests pinning a published contract | **No.** `test_capability_discovery.py:64` compares `describe()` with `model_json_schema()` at runtime, which is tautological for drift | — |

**Conclusion:** integrity relies **only on developer discipline**, guided by a written but incomplete policy (§10).

The policy also allows *additive* changes at the same version, so a future guard must be a **compatibility check** (no removed field, no new required field, no type narrowing), not schema equality.

**Classification:**

- **NON-BLOCKING DEBT** for growing from 1 to 2 capabilities, mitigated per capability by a pinned snapshot test;
- **FUTURE HARDENING** for the Capability Platform;
- **BLOCKER** for Transport/Promotion and for any broad multi-module expansion.

---

## 17. Capability Prioritization

The score is advisory; architectural correctness overrides it (marked †).

| Candidate | Business | Reuse | Contract | Domain | Security | Risk | Total | Recommendation |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| `sales.customer.create:v1` | 3 | 3 | 3 | 2 | 3 | 3 | **17** | **PROCEED (next phase)** |
| `inventory.stock.adjust:v1` | 3 | 2 | 2 | 3 | 2 | 1 | 13 | DEFER (row lock, typed movement types, module inactive) |
| `hr.employee.create:v1` | 3 | 3 | 2 | 1 | 1 | 2 | 12 | DEFER † (XT, unrenderable fields) |
| `accounting.journal_entry.create:v1` | 3 | 2 | 2 | 2 | 1 | 1 | 11 | DEFER † (XT, nested, no idempotency) |
| `sales.sales_order.create:v1` | 3 | 3 | 2 | 1 | 1 | 1 | 11 | DEFER † (XT, nested, no idempotency) |
| `inventory.product.create:v1` | 2 | 2 | 2 | 1 | 1 | 2 | 10 | DEFER † |
| `leave_management.leave_request.cancel:v1` | 2 | 2 | 1 | 2 | 1 | 2 | 10 | DEFER † (bridge, ownership, contract unsettled) |
| `leave_management.leave_request.submit:v1` | 2 | 2 | 2 | 2 | 1 | 2 | 11 | DEFER † (bridge, ownership) |
| `hr.department.create:v1` | 1 | 2 | 2 | 1 | 2 | 3 | 11 | DEFER (low value, XT on `parent_id`) |
| approve / reject / decide / post | — | — | — | — | — | — | — | **REJECT as capability** (Workflow / Human Task actions) |

---

## 18. Recommended Next Phase

```text
NEXT PHASE:
sales.customer.create:v1
```

**Objective.** Publish the existing Sales "create customer" business operation as a versioned capability. Form Runtime, Workflow and future consumers can then execute it through the executor, and the Form Builder gains its first non-Leave form without any Builder change.

**Capability ID.** `sales.customer.create:v1` (module `sales`, resource `customer`, action `create`).

**Existing application service.** `SalesService.create_customer(session, data, tenant_id)` (`app/modules/sales/service.py:43`). This is the same method `POST /sales/customers` calls; no second service.

**Input contract.** `CustomerCreate` (`app/modules/sales/schemas.py`), unchanged: `code`, `name` (required), `email`, `phone`, `address`, `contact_person`, `credit_limit ≥ 0`, `notes`.

**Output contract.** `CustomerOut`, the route's `response_model`, unchanged.

**Permission.** `sales.customers.write`, the same code as the HTTP route. No new permission.

**Tenant semantics.**

- The tenant comes only from `ctx.tenant_id`, set by the executor; the capability is `tenant_scoped`.
- A tenant-less caller is refused. This deliberately differs from the HTTP route's global-row behaviour (N-2), which stays unchanged and disclosed.

**Domain rules.**

- Owned by Sales: DTO validation and unique `(code, tenant_id)`.
- **Entry condition E-1:** a duplicate code must surface as a typed business rejection (`CapabilityRejectedError` with a stable reason, so the Form Runtime returns 409), not as an `IntegrityError` 500. The phase brief decides where this is implemented:
  - inside the Sales handler; or
  - as a module-owned check in the service shared with HTTP.

  Whether to also change the HTTP route's 500 is a **separate, explicit** decision, because that changes HTTP API behaviour.

**Transaction boundary.** The executor's unit of work: one insert, committed by the executor. The handler never commits.

**Audit.** Form Runtime submissions go through the audited HTTP route (AuditMiddleware) plus the executor log line. No new audit mechanism; R-13 (in-process audit gap) stays as it is.

**Module lifecycle registration.**

- `register` in `sales/module.py::setup()`.
- **Entry condition E-2:** add `on_deactivate` → `unregister_module("sales")`, mirroring Leave. Without it, a deactivated Sales module keeps its capability resolvable.

**Form Builder value.** A "Customer registration" form (`owner_module = sales`). Every field renders today as text or number, and an optional `select` can be configured over a text field.

**Workflow value.** A workflow-unaware operation, reusable later as a step in onboarding flows. The capability must not import Workflow.

**Tests required** (acceptance; mirror `test_capability_leave_management.py`):

- unit: descriptor and id grammar;
- **E-3:** a pinned v1 contract snapshot test (input and output JSON Schema committed as a fixture; a breaking change must fail CI, and an additive change must update the fixture deliberately);
- module architecture guard: no Workflow import from the capability file;
- real PostgreSQL:
  - activation publishes and deactivation withdraws;
  - creates in the caller's tenant;
  - HTTP and capability share one contract and service;
  - RLS isolates the written row;
  - an injected `tenant_id` is ignored or refused;
  - unauthorized → nothing written;
  - missing tenant refused;
  - cross-tenant refused;
  - duplicate code → typed rejection, nothing written;
  - domain validation stays in Sales;
- Form Platform PG test: a form bound to `sales.customer.create:v1` publishes and executes through the runtime;
- one Playwright proof: build, publish and submit a customer form as a seeded Sales-permitted persona.

**Explicit non-goals (this phase).** §19 below, plus:

- no customer update/list capability;
- no Sales order capability;
- no Builder or runtime change;
- no HTTP route behaviour change (unless E-1's separate decision is taken explicitly).

---

## 19. Explicit Non-Goals

This gate and the recommended phase do not do the following:

- publish any capability other than `sales.customer.create:v1`;
- expose approve/reject/decide/post as capabilities;
- widen the Workflow caller-bridge allowlist (C-2);
- add reference pickers, line-item editing or new widgets to the Form Builder;
- fix N-1…N-7, H-1, O-1, C-3A-1/2/3, P3B-1 or G-3B-1 (except E-1/E-2/E-3, which are scoped to Sales and the new capability);
- add a schema-fingerprint mechanism to the Capability Platform;
- create CRM/Finance modules;
- make Form Builder or Workflow authoritative over Sales;
- define query/read capabilities.

---

## 20. Final Decision

One existing operation, `sales.customer.create`, has:

- clear business value;
- a stable flat contract already used by HTTP;
- the authoritative module service;
- existing authorization;
- tenant safety by construction (no references; forced RLS);
- full testability on the Leave template;
- reuse across Form, API and future Workflow.

Its three gaps (E-1 typed duplicate, E-2 deactivation hook, E-3 contract snapshot) are small, module-owned and testable. They are phase-entry conditions, not blockers.

Every other candidate is deferred for specific, recorded reasons (§14, §17).

```text
CAPABILITY EXPANSION DECISION: PROCEED
```

---

## 21. Evidence / Tests

**Code read:**

- `backend/app/core/capabilities/{registry,executor,contract}.py`;
- `backend/app/core/form_platform/{service,runtime,presentation}.py`;
- `backend/external_modules/leave_management/{capabilities,schemas,service,api,module}.py`;
- `backend/app/modules/{hr,sales,inventory,accounting}/{api,service,schemas,models,module}.py`;
- `backend/app/core/database/rls.py`;
- `backend/alembic/versions/p1q2r3s4t5u6_hr_inventory_rls_hardening.py`;
- `tests/unit/test_{leave_management,sales_workflow}_architecture.py`;
- `tests/unit/test_capability_discovery.py`;
- `docs/architecture/CAPABILITY_PLATFORM.md` §versioning.

**Read-only commands run (2026-10-07):**

```text
pytest tests/unit/test_{leave_management,sales_workflow,accounting_workflow}_architecture.py   → 16 passed
pytest tests/integration/workflow_postgres/test_capability_leave_management.py (real PG)       →  9 passed
python: contract_fields(CustomerCreate.model_json_schema())
        → all 8 fields renderable (code,name required text; credit_limit number; others text)
python: contract_fields(EmployeeCreate.model_json_schema())
        → department_id, position_id, hire_date: kind None (not renderable)
psql core.modules (tenant-less) → no rows visible (forced RLS); activation state taken from the recorded baseline
```

Earlier the same day (Phase 3C gate):

- capability and form unit tests: 109 passed;
- real-PostgreSQL form and capability tests: 22 passed;
- Vitest (form_builder, form_runtime, shell navigation): 223 passed;
- `tsc --noEmit`: exit 0.

**Not executed (hypotheses):** N-3 (cross-tenant FK acceptance) and H-1 (same-version drift → 500). Proving either requires writes or code changes outside this audit's scope.

**Provenance:** Commit: NONE · Push: NONE.
