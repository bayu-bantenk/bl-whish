# CND-1 — Sales → Inventory Product Reference: Architecture Decision

**Date:** 2026-10-12
**Blocker addressed:** CND-1 in `CAPABILITY_CROSS_TENANT_REFERENCE_REMEDIATION_C2_READINESS.md` §10. `POST /sales/orders` validates `customer_id`, but still stores `lines[].product_id` unchecked.
**Nature of this phase:** decision and implementation plan only. **Nothing was implemented.** No production, test, schema or configuration file changed.
**Provenance:** Commit: NONE · Push: NONE

```text
DECISION:          Option A. An Inventory-provided service contract, ProductReferenceContractV1
                   (interface in app/contracts/inventory/, implementation registered by the Inventory module),
                   consumed by SalesService.create_order through ServiceDiscovery.discover_optional.
                   Fail closed whenever ownership cannot be verified.
IMPLEMENTATION GATE: GO-WITH-CONDITIONS. Implementation may start once a reviewer signs off decisions D-1, D-2 and D-3 (§5, §6)
```

---

## 1. Verified Facts (inspected 2026-10-12)

| # | Fact | Evidence |
|---|---|---|
| F-1 | **Inventory is dormant and cannot be activated today.** `app/modules/inventory/` has no `module.json`. `ModuleLoader.discover()` finds modules only through `module.json`/`module.yaml`/`module.yml`, so Inventory is never discovered, loaded, activated, or given its routes. | `ls app/modules/inventory/`; `manifest.py::find_manifests`; `system.module_runtime_state` lists `sales`, `accounting`, `leave_management`, `external_boundary_probe` only |
| F-2 | Sales declares **no dependency** on Inventory. `sales_order_lines.product_id` is a bare UUID with **no FK**, "to avoid cross-schema dependency with the inventory schema". | `sales/module.json` (`depends_on: []`); `sales/models.py` docstring and line 168 |
| F-3 | `product_id` is **optional per line** and is **only written, never read** anywhere in Sales. | `OrderLineCreate.product_id: Optional[UUID] = None`; the only use is `service.py` `create_order` |
| F-4 | **No real usage:** 0 of 1,699 stored order lines have a `product_id`; there are 0 rows in `inventory.products`. The frontend declares `product_id` only in the order **output** type (`features/sales/types.ts`); no form sends it. | read-only SQL with RLS bypassed; frontend grep |
| F-5 | The `inventory` schema and tables exist in the database (`products`, `stock_levels`, `stock_locations`, `product_categories`, `stock_movements`), but nothing in the running app can create a product (F-1). | `information_schema.tables` |
| F-6 | The platform already has a sanctioned cross-module seam for exactly this. `ServiceContract` is an ABC that any package can subclass. A module publishes an implementation in `register_contracts()` (called on activation), and its registrations are removed with `contract_registry.unregister_module(name)` plus `service_discovery.invalidate()` on deactivation. Consumers resolve it at request time through `app.contracts.dependencies.get_service_discovery()`, using `discover()` or `discover_optional()`. The `ServiceContract` docstring even uses `InventoryServiceContractV1` as its example. | `app/contracts/base.py:40-56`, `discovery.py:56-92`, `dependencies.py`, `module_system/base.py:193-207`, `lifecycle.py:418-420, 505-512`; working precedent `external_modules/external_boundary_probe/` |
| F-7 | Every core contract (`workflow`, `notification`, `auth`, `metadata`) passes **plain types only**: `str` ids, dataclass DTOs, no ORM and no `AsyncSession`. Implementations that need the database open their own `DatabaseFactory.get_session()`. | `contracts/workflow/v1.py`, `contracts/notification/impl.py` |
| F-8 | `requires_contracts` is enforced at **activation**: `RequiredContractNotSatisfiedError` is raised when a required contract is not registered. | `lifecycle.py:826-843` |
| F-9 | `optional_deps` in a manifest has **no runtime semantics**; it is metadata only. | grep of `app/core` |
| F-10 | **Inventory's single-record convention admits global rows:** `get_product` accepts `tenant_id IS NULL`. Inventory's `on_install` seeds **global locations and categories**, but **no global products**. | `inventory/service.py:119-133`, `module.py::on_install` |
| F-11 | A product's tenant cannot change after creation (`ProductUpdate` has no `tenant_id`), and Inventory has no product delete path. | `inventory/schemas.py`, `service.py`, `api.py` |

## 2. Options Evaluated

### Option A — Inventory-provided public contract, consumed by Sales (**SELECTED**)

- **Ownership / direction:**
  - The interface is `app/contracts/inventory/v1.py::ProductReferenceContractV1`, a platform-namespaced interface like `contracts/workflow`.
  - The **implementation is owned by Inventory**: `app/modules/inventory/contract_impl.py`, registered by `InventoryModule.register_contracts()` with `module_name="inventory"`.
  - Sales depends only on `app.contracts.inventory.v1` and `app.contracts.dependencies`.
  - Neither business module imports the other.
- **Inventory dormant, unavailable or deactivated:**
  - the contract is not registered, so `discover_optional()` returns `None`;
  - Sales then **rejects any order that carries a `product_id`** (fail closed);
  - orders with no product lines are unaffected.
  - On deactivation the platform removes the registration and invalidates the discovery cache (F-6), so the very next request fails closed.
- **Tenant and global semantics:** decided **inside Inventory**, which owns what a product is (§5).
- **Validation without Inventory internals:** yes. Plain `str`/UUID ids in, plain `frozenset` out (F-7 convention). There is no ORM, model or `InventoryService` import in Sales.
- **Modular activation / external modules:** compatible.
  - The contract is optional for Sales, so Sales keeps activating without Inventory.
  - Any module, including an external one, can provide or consume it.
  - A future replacement Inventory implementation only has to register the same contract.
- **Errors:**
  - a nonexistent or another tenant's product → the existing `SalesReferenceNotFoundError("Product", id)` → **422** `Product '<id>' not found`, the same shape C-2 uses for customers;
  - Inventory unavailable → a distinct **typed** error, `SalesReferenceUnavailableError` (§6, D-3).
- **Testing:** unit tests for the contract shape and the Sales consumer with a fake contract; real-PG tests for the implementation; HTTP tests with the contract registered, unregistered, and removed through deactivation; an architecture guard (§7).
- **Migration / runtime impact:** no schema change. One extra indexed `SELECT … WHERE id IN (…)` per order that has product lines.
- **Risks:**
  - Inventory currently cannot activate (F-1), so in production **every** `product_id` is rejected until Inventory gets a manifest. Real usage is zero (F-4).
  - The contract's implementation reads in its **own session**, a separate READ COMMITTED transaction (§8).

### Option B — explicit Sales → Inventory module dependency (`depends_on: ["inventory"]`, or `requires_contracts`) — **REJECTED**

- **Ownership / direction:** a hard Sales → Inventory edge.
- **Inventory dormant:** Sales could no longer activate. `depends_on` blocks activation, and `requires_contracts` raises `RequiredContractNotSatisfiedError` (F-8). Because Inventory cannot be activated at all today (F-1), **this would take the live Sales module down**.
  - It would also block Inventory deactivation while Sales is active (`_active_dependents`).
- **No validation API by itself:** a dependency edge gives Sales no lookup. It would have to be combined with A anyway, or Sales would import Inventory internals.
- **Rejected because** it couples availability of an optional reference to the whole Sales module, for a field that is optional and unused (F-3, F-4).

  A *soft* edge (`optional_deps: ["inventory"]`) is recommended **only as documentation** alongside A. It has no runtime effect (F-9).

### Option C — Sales-owned product validation — **REJECTED**

- **Ownership:** Sales does not own products. Inventory owns the model, the tenant rules and the lifecycle (F-10).
- **The only way to do it** is raw SQL from Sales against `inventory.products`, or importing `app.modules.inventory.models`. Either one:
  - reintroduces the cross-schema dependency `sales/models.py` explicitly avoids (F-2);
  - duplicates Inventory's ownership rules in another module;
  - breaks when the Inventory schema is absent in a deployment without Inventory;
  - and the brief forbids "direct cross-module ORM/model imports".
- **The variant "Sales owns its own product catalogue"** is a new business domain, not a fix.

### Option D — other existing seams — **REJECTED as alternatives (A *is* the existing seam)**

| Seam | Why not |
|---|---|
| `ServiceRegistry` + `InventoryService` | Resolution is by class, so Sales would have to import `app.modules.inventory.service.InventoryService`, which is an Inventory internal. `get_product` also admits global rows, against §5 |
| Capability platform (`inventory.product.read`) | It would publish a new capability (RC-1/2/3 gates apply). It needs the caller to hold `inventory.products.read`, which order writers may not have. The executor runs its own unit of work. A capability is a consumer-facing business operation, not an internal integrity check |
| Event bus / Application Flow | Asynchronous; cannot reject a request synchronously |
| Cross-schema FK `sales_order_lines.product_id → inventory.products(id)` | Couples schemas and module install order. **RI checks bypass RLS**, so an FK would still accept another tenant's product, which is the very C-2 root cause. It would also need a migration and fails on deployments without Inventory |

The **ContractRegistry / ServiceDiscovery** seam is the platform-approved mechanism of option D, and option A uses it as designed.

## 3. Selected Boundary

```text
Sales (consumer)                                    Inventory (provider)
SalesService.create_order                           InventoryModule.register_contracts()
  │ customer check (C-2, unchanged)                   └─ contract_registry.register(
  │ product ids = distinct non-null lines[].product_id      ProductReferenceContractV1,
  │ if ids:                                                 InventoryProductReferenceImpl(),
  │   c = get_service_discovery()                           module_name="inventory")
  │         .discover_optional(ProductReferenceContractV1)
  │   c is None → SalesReferenceUnavailableError ──► 422 (fail closed)
  │   ok = await c.find_order_referenceable_products(tenant_id=…, product_ids=[…])
  │   first id not in ok → SalesReferenceNotFoundError("Product", id) ──► 422
  ▼ number + insert order + lines (unchanged)

                 app/contracts/inventory/v1.py  (interface only; plain types; no ORM; no session)
```

**Contract** (proposed text):

```python
class ProductReferenceContractV1(ServiceContract):
    contract_meta = ContractMeta(name="InventoryProductReference", version="1.0",
                                 description="Which product ids a tenant may reference from another module.")

    @abstractmethod
    async def find_order_referenceable_products(
        self, *, tenant_id: Optional[str], product_ids: Sequence[str],
    ) -> FrozenSet[str]:
        """Subset of `product_ids` the tenant may reference on an order line.
        Ids that are unknown, not the tenant's, or otherwise ineligible are
        simply absent: the result never says WHY an id is absent."""
```

- **Why "subset in, subset out":**
  - one round trip per order;
  - Inventory owns the eligibility rule;
  - the response cannot distinguish "nonexistent" from "another tenant's", so there is no disclosure.
- **Why no session parameter:** this is the F-7 convention.
  - The implementation opens `DatabaseFactory.get_session()` under the ambient request tenant. Sales' routes run inside `async_tenant_context` from `get_current_user`.
  - It also filters on the explicit `tenant_id` argument, so it never relies on RLS alone.
  - If the ambient tenant were missing, RLS would show only global rows, and the strict filter returns nothing, so the order is rejected (fail closed).

## 4. Behaviour When Inventory Is Dormant or Unavailable

| Situation | Order without product lines | Order with ≥ 1 `product_id` |
|---|---|---|
| Inventory dormant (today, F-1) / never installed | **accepted** (unchanged) | **rejected** 422, `SalesReferenceUnavailableError`; nothing written |
| Inventory active | accepted | accepted only if every id is eligible (§5); otherwise 422 `Product '<id>' not found`; nothing written |
| Inventory deactivated at runtime | accepted | rejected from the next request on (registration removed and discovery cache invalidated, F-6) |
| Contract raises (database error inside the implementation) | n/a | the exception propagates and the request fails (500), nothing written. It is **never** treated as "valid" |

**Compatibility of fail-closed while dormant:** 0 historical lines and no client use `product_id` (F-4). Legitimate same-tenant order creation without products keeps working exactly as today.

## 5. Tenant and Global-Record Policy

| Product | Eligible on an order line | Basis |
|---|---|---|
| Same tenant (`product.tenant_id == caller tenant`) | **yes** | ownership |
| Another tenant's | **no**, absent from the result | C-2 / RC-1 |
| Nonexistent | **no**, absent from the result | C-2 |
| Global (`tenant_id IS NULL`) | **no** (**D-1**, proposed) | below |
| Caller without a tenant (N-2 path) | **no** product is eligible | fail closed; the strict equality never matches a NULL caller |

**D-1: global products are *not* order-referenceable (proposed; needs reviewer sign-off).**
- Global *visibility* (Phase 3.0G "system record" convention, `get_product`) is not treated as *eligibility*, as the brief requires.
- **Reasons:**
  - no global products exist (F-4);
  - nothing seeds them (F-10: Inventory seeds global locations and categories only);
  - Inventory's own list paths already hide global rows from tenant callers;
  - the stricter rule fails closed and can be relaxed later by changing one predicate *inside Inventory*, without touching Sales.
- **This intentionally differs** from C-2's customer, department, position and account checks, which kept global rows eligible because those resources have live global rows and an existing loader that already admitted them.
- The final global-row model stays with N-2 (gate §12).
- The implementation must therefore **not** reuse `InventoryService.get_product`. It runs a strict query: `SELECT id FROM inventory.products WHERE id = ANY(:ids) AND tenant_id = :tenant`.

**D-2: business eligibility (`is_active`, `is_sellable`) — proposed: not enforced in this fix.**
- Today an order can carry any product id. Rejecting inactive or unsellable products is a new business rule, not a security fix.
- The contract's name and docstring ("referenceable … or otherwise ineligible") leave room for Inventory to add it later without changing Sales.
- Record it as a separate product decision.

## 6. Error Mapping and Non-Disclosure

| Case | Service error | HTTP (`POST /sales/orders`) |
|---|---|---|
| Customer not visible (C-2, unchanged) | `SalesReferenceNotFoundError("Customer", id)` | 422 `Customer '<id>' not found` |
| Product nonexistent / another tenant's / global (D-1) | `SalesReferenceNotFoundError("Product", id)`, the **first** ineligible id in request order | 422 `Product '<id>' not found` |
| Inventory not available | `SalesReferenceUnavailableError` (new, `ValueError` subclass) | **D-3, proposed:** 422 `Product references cannot be verified` |

**D-3: status for "unavailable" (proposed 422; alternative 503).**
- 422 is proposed because the condition is configuration ("this deployment has no Inventory"), not a transient outage, so 503's retry semantics would mislead clients. It also keeps one status for every body-reference rejection.
- The detail reveals only platform configuration, never tenant data.
- If reviewers prefer 503, only the route mapping changes.

**Non-disclosure:**
- The contract returns only a subset, so no reason travels.
- The message echoes only the caller's own input id, and its shape is identical for nonexistent, other-tenant and global products.
- Check order: the customer is checked first (unchanged), then products. Both run before numbering or any write.

## 7. Implementation Plan (ordered; for the next phase)

| # | File | Change |
|---|---|---|
| 1 | `backend/app/contracts/inventory/__init__.py`, `backend/app/contracts/inventory/v1.py` | **new**: `ProductReferenceContractV1` (§3). Imports only `app.contracts.base` and `typing` |
| 2 | `backend/app/modules/inventory/contract_impl.py` | **new**: `InventoryProductReferenceImpl`. Strict tenant query (§5), own `DatabaseFactory.get_session()`, returns `frozenset[str]`. Malformed ids are treated as absent |
| 3 | `backend/app/modules/inventory/module.py` | `provides_contracts = [ProductReferenceContractV1]`; implement `register_contracts()`, mirroring `external_boundary_probe/module.py` |
| 4 | `backend/app/modules/sales/service.py` | `SalesReferenceUnavailableError`. `SalesService.__init__` accepts an optional `service_discovery` (the `SalesOrderWorkflowService` pattern), lazily defaulting to `get_service_discovery()`. Product check in `create_order` after the customer check, before `_next_order_number`; skipped when no line has a `product_id` |
| 5 | `backend/app/modules/sales/api.py` | `POST /orders` maps `SalesReferenceUnavailableError` → 422 (D-3) |
| 6 | `backend/app/modules/sales/module.json` | `"optional_deps": ["inventory"]`, documentation only (F-9) |
| 7 | `backend/tests/unit/` | new architecture guard: Sales never imports `app.modules.inventory*`; `app/contracts/inventory/**` imports no `app.modules.*`. Plus contract-shape and consumer unit tests with a fake contract |
| 8 | `backend/tests/integration/workflow_postgres/test_rc1_reference_candidates.py` | product `xfail(strict=True)` → a normal test, run with the contract registered. It will XPASS-fail first, which is the designed signal |
| 9 | `backend/tests/integration/workflow_postgres/test_c2_cross_tenant_reference_remediation.py` or a new `test_cnd1_product_reference.py` | §8 scenarios |
| 10 | `docs/architecture/reviews/CND1_…_READINESS.md` (new); `CAPABILITY_PLATFORM.md` / module docs | evidence; record the new contract |

There is **no** change to Inventory's HTTP routes, `InventoryService.get_product`, stock adjustment, customer validation, Form Builder, capabilities or Workflow.

**Making Inventory activatable** (adding a `module.json`) is **not** part of this plan. It is a separate product and platform decision with its own install, migration, seed and RBAC review. Until then, step 4's fail-closed path is the production behaviour.

## 8. Acceptance Criteria (next phase)

**Unit:**
- `ProductReferenceContractV1` is an ABC with plain-typed signatures (no ORM, no `AsyncSession` in its annotations).
- Sales consumer with a fake contract:
  - no product ids → contract not called;
  - contract absent → `SalesReferenceUnavailableError`;
  - a partial subset → `SalesReferenceNotFoundError` naming the first absent id;
  - ids are de-duplicated;
  - the tenant is passed as the caller's tenant (str/UUID normalized).
- Architecture guard (step 7).
- All existing capability, architecture and snapshot tests are unchanged and passing.

**Real PostgreSQL** (implementation + Sales; rolled-back transactions, tenant B's rows inserted under B's RLS context):
1. Tenant A's own product → order + lines created, `line.product_id` stored, `order.tenant_id = A`.
2. Tenant B's product → 422-equivalent error; **0 orders, 0 lines**, counted with RLS bypassed.
3. Nonexistent product → the same error type and message shape as (2).
4. Global product → rejected (D-1), 0 rows.
5. Mixed lines (one own product, one foreign) → rejected; 0 orders, 0 lines (no partial order).
6. Tenant-less caller → rejected.
7. Contract unregistered → `SalesReferenceUnavailableError`, 0 rows. An order without product lines in the same setup → created.
8. The implementation filters on `tenant_id` **independently of RLS**: under a bypass-RLS session it still returns only tenant A's ids.

**HTTP** (real routers behind `TenantContextMiddleware`, real JWTs, committed rows with verified cleanup):
- `POST /sales/orders`:
  - own product → 201;
  - foreign, nonexistent or global product → 422 with an identical `{"detail": "Product '<id>' not found"}` shape;
  - no Inventory contract → 422 `Product references cannot be verified`;
  - no order or lines after any rejection; cleanup leaves 0.
- **Lifecycle:** a real `ModuleLifecycleManager` activates `InventoryModule()` (registered directly, since it has no manifest), so the contract is registered; deactivating it unregisters the contract; the next product order is rejected.

**Regression:**
- C-2 and RC-1 PG files; the existing Sales PG files run **one file per invocation** (known order-dependence);
- `tests/integration/workflow` (SQLite tier);
- `tests/unit --ignore=tests/unit/test_engine_execution.py`;
- mutation check: remove the product check, return all ids from the implementation, admit global products, and treat a missing contract as valid. Each must fail a test.

## 9. Compatibility and Regression Risks

| Risk | Assessment |
|---|---|
| Clients sending `product_id` get 422 while Inventory is dormant | Behaviour change, by design (fail closed). Observed usage: **0** (F-4) |
| Sales' activation depends on Inventory | **No.** The contract is optional (not `requires_contracts`, not `depends_on`) |
| Discovery cache holds a stale implementation after deactivation | Covered by the platform's `invalidate()` on deactivation (F-6). HTTP lifecycle test required (§8) |
| Separate read transaction (implementation's own session) | There is no FK on `product_id`, and no product delete or tenant-change path exists (F-11), so a product cannot become another tenant's between check and insert. Residual: none known for ownership. This is reasoned from the code; no concurrency test is required |
| Extra query latency | One indexed `IN` query per order with products; negligible |
| SQLite-tier tests using `product_id` | None found (grep). If added later, they must register a fake contract |
| `get_product` and stock adjustment still admit global products | Unchanged and out of scope; D-1 applies to order references only |
| Inventory's own `register_contracts` is never exercised in production | True until Inventory has a manifest. The lifecycle test (§8) exercises it directly |

## 10. Schema, Migrations, RLS, Public Contracts

- **Database schema / FKs / migrations:** **no change.** A cross-schema FK was evaluated and rejected (§2-D): RI checks bypass RLS, it couples install order, and it would not fix the tenant problem.
- **RLS:** no change.
- **Capability contracts / ids / versions / RC-2 snapshots:** no change. No capability is published; Sales order create stays unpublished.
- **New public service contract:** `ProductReferenceContractV1`, internal (module to module), versioned through `ContractMeta`.
- **HTTP behaviour of `POST /sales/orders`:** new 422 responses for product references (§6). The request and response schemas are unchanged.
- **Module manifest:** Sales `optional_deps` (documentation only).

## 11. Implementation Gate

```text
GO-WITH-CONDITIONS
```

Implementation (§7) may start when a reviewer has signed off:
- **D-1:** global products are not order-referenceable;
- **D-2:** `is_active` / `is_sellable` are not enforced in this fix;
- **D-3:** "Inventory unavailable" → 422 (or 503).

**Standing conditions:**
- Sales order create stays **unpublished** as a capability until the implementation's readiness report shows §8 met.
- Making Inventory activatable is a separate decision. Until then, production rejects every order line with a `product_id`, which is the intended fail-closed state.

**Not blocked:** none of this needs a schema, RLS or capability-contract change, and the seam already exists and is exercised by `external_boundary_probe`.

## 12. Files Changed in This Phase

| File | Change |
|---|---|
| `docs/architecture/reviews/CND1_SALES_INVENTORY_PRODUCT_REFERENCE_DECISION.md` | **new**: this decision |

- **Production code changed:** NO.
- **Tests changed:** NO.
- **Frontend changed:** NO.
- **Database / migrations / RLS changed:** NO.
- **Capability published:** NONE.
