# CND-1 — Sales → Inventory Product Reference: Implementation Readiness

**Date:** 2026-10-12
**Implements:** `CND1_SALES_INVENTORY_PRODUCT_REFERENCE_DECISION.md`, approved as follows:
- Option A;
- **D-1:** own-tenant products only, global products not eligible;
- **D-2:** no `is_active`/`is_sellable` rule;
- **D-3:** unavailable contract → HTTP 422, before any write.

**Closes:** CND-1 from `CAPABILITY_CROSS_TENANT_REFERENCE_REMEDIATION_C2_READINESS.md` §10.
**Provenance:** Commit: NONE · Push: NONE

```text
CND-1 PRODUCT REFERENCE CONTRACT: GO
  POST /sales/orders lines[].product_id: own-tenant only, verified through Inventory's contract; fail closed otherwise.
  Proven on real PostgreSQL + real HTTP + the real ModuleLifecycleManager; 8/8 mutations detected.
  Production state: Inventory stays dormant, so every product-bearing order is rejected (422) until a separately approved activation phase.
```

---

## 1. Pre-Implementation Verification (2026-10-12)

| Item | Verified behaviour | Source |
|---|---|---|
| Activation | `before_activate` → `on_activate` → **`register_contracts`** → `service_discovery.invalidate()` → `setup()` | `lifecycle.py:376-440` |
| Deactivation | `on_deactivate` → `ModuleCleanup.full_cleanup` (routes, services by tag, …) → **`contract_registry.unregister_module(name)`** → `service_discovery.invalidate()` when anything was removed | `lifecycle.py:493-515` |
| Registration | `ContractRegistry.register` type-checks the implementation (`isinstance`) and refuses a duplicate without `override` | `contracts/registry.py:80-120` |
| `discover_optional` | Returns `None` on `ServiceNotFoundError`. `discover()` caches; `invalidate()` clears the cache | `contracts/discovery.py:56-120` |
| Request-time access | `app.contracts.dependencies.get_service_discovery()` returns `runtime_engine.service_discovery`, the **same** instance the lifecycle invalidates | `contracts/dependencies.py` |
| Manifests | Sales `module.json` existed with `depends_on: []`. **Inventory has no manifest** and stays dormant | file system; `system.module_runtime_state` |
| Install hooks | `InventoryModule.on_migrate` / `on_rollback` run Alembic only if `<repo>/alembic.ini` resolves. It resolves to `version 1.0/alembic.ini`, which **does not exist**, so migration is skipped. The tests guard this, and **never uninstall** | `inventory/module.py:128-163` |
| Sales route tenant | `POST /sales/orders` runs inside `async_tenant_context` (from `get_current_user`) and passes `ctx.tenant_id` as a **str** | `sales/api.py` |

**Conclusion:** the existing lifecycle supports the contract safely. No parallel lifecycle was needed and the module manager was not bypassed.

## 2. Contract Shape

`backend/app/contracts/inventory/v1.py`:

```python
class ProductReferenceContractV1(ServiceContract):
    contract_meta = ContractMeta(name="InventoryProductReference", version="1.0", ...)

    @abstractmethod
    async def find_order_referenceable_products(
        self, *, tenant_id: Optional[str], product_ids: Sequence[str],
    ) -> FrozenSet[str]: ...
```

- **Plain identifiers in, a plain subset out.** There is no ORM type, no session and no reason.
  - Unknown, other-tenant, global and malformed ids are simply absent from the result.
  - Errors propagate, and consumers must never treat an error as "eligible".
- **Exports:** it is exported from `app.contracts.inventory` and `app.contracts`, like the other contracts.
- **Imports:** the package imports only `app.contracts.base`.
- **Implementation:** `backend/app/modules/inventory/contract_impl.py::InventoryProductReferenceImpl`.
  - It runs `SELECT id FROM inventory.products WHERE id IN (:ids) AND tenant_id = :tenant` through Inventory's own model, so the tenant filter is in the query.
  - It deliberately does **not** use `get_product`, which admits global rows.
  - It opens its own `DatabaseFactory.get_session()` under the request's tenant context, where RLS is a second, independent layer.
  - Without a tenant, or with no parseable ids, it returns `frozenset()` without querying.
- **Registration:** `InventoryModule.provides_contracts = [ProductReferenceContractV1]`. `register_contracts()` registers it with `module_name=ctx.module_name` (`"inventory"`). Removal is the lifecycle manager's own cleanup.

## 3. Sales Consumer

**`SalesService.create_order`**, in order:
1. the **customer** check (C-2, unchanged and still first);
2. **`_check_product_references`**;
3. then numbering and writes (unchanged).

**`_check_product_references`:**
- It takes the distinct non-null `lines[].product_id` values, in request order.
- With none, it returns **without consulting Inventory**, so plain orders keep working while Inventory is dormant.
- Otherwise it calls `discover_optional(ProductReferenceContractV1)`:
  - `None` → raises `SalesReferenceUnavailableError` (`"Product references cannot be verified"`);
  - else calls the contract with the tenant normalized to a canonical UUID string (or `None`), and raises `SalesReferenceNotFoundError("Product", id)` for the **first** id not returned.
- Discovery is the platform's shared request-time instance, injected lazily (the `SalesOrderWorkflowService` pattern), and can be injected for tests.

**`POST /sales/orders`** maps `SalesReferenceNotFoundError` and `SalesReferenceUnavailableError` to **422** `{"detail": str(exc)}`.

**Request and response schemas are unchanged.** Error behaviour of the route:

| Case | Response |
|---|---|
| Own-tenant product (Inventory active) | 201 |
| Another tenant's / nonexistent / global product | 422 `Product '<id>' not found`, an identical shape |
| No tenant in the JWT | 422 `Product '<id>' not found` (nothing is eligible) |
| Inventory dormant, deactivated or contract missing | 422 `Product references cannot be verified` |
| Provider raises | the exception propagates, the request fails, nothing is written (never treated as eligible) |
| Invalid customer (any Inventory state) | 422 `Customer '<id>' not found`, checked first |

## 4. Files Changed

Line counts are measured against pre-phase backups.

| File | Change | Reason |
|---|---|---|
| `backend/app/contracts/inventory/__init__.py`, `v1.py` | **new** (4 + 55 lines) | the approved contract |
| `backend/app/contracts/__init__.py` | +4 | index docstring and export, like the other contracts |
| `backend/app/modules/inventory/contract_impl.py` | **new** (56 lines) | Inventory-owned implementation, D-1 rule |
| `backend/app/modules/inventory/module.py` | +18 | `provides_contracts`, `register_contracts()`, docstring |
| `backend/app/modules/sales/service.py` | +50 / −4 | `SalesReferenceUnavailableError`; optional `service_discovery` injection; `_check_product_references`; call after the customer check; the C-2 "product not validated" comment removed |
| `backend/app/modules/sales/api.py` | +7 / −2 | 422 mapping for the unavailable case |
| `backend/app/modules/sales/module.json` | `optional_deps: ["inventory"]` | documentation only (no runtime semantics), as the decision planned |
| `backend/tests/unit/test_cnd1_product_reference_contract.py` | **new**, 14 tests | contract shape, module boundary, consumer behaviour |
| `backend/tests/integration/workflow_postgres/test_cnd1_product_reference.py` | **new**, 10 tests | lifecycle, tenant isolation, HTTP, fail-closed, ordering |
| `backend/tests/integration/workflow_postgres/test_rc1_reference_candidates.py` | +11 / −15 | the product `xfail(strict=True)` turned **XPASS(strict)** (the designed signal); now a normal test asserting `SalesReferenceUnavailableError` while dormant |
| `docs/architecture/reviews/CND1_SALES_INVENTORY_PRODUCT_REFERENCE_IMPLEMENTATION_READINESS.md` | **new** | this report |

**Not changed:**
- `InventoryService` / `get_product` / stock adjustment;
- the customer check;
- Inventory's HTTP routes;
- Form Builder, capabilities and Workflow.

## 5. Lifecycle Registration Evidence (real `ModuleLifecycleManager`)

**Setup:** `ModuleLifecycleManager(FastAPI(), runtime_engine, persistence=None)` holds the real `InventoryModule()`.
- It is registered with the manager directly, because Inventory has no manifest and `ModuleLoader` cannot discover it.
- Install, activate and deactivate are the manager's own.
- `persistence=None`, so **no module-state row is written**. After all runs `system.module_runtime_state` has **0** `inventory` rows.
- Inventory is not made activatable in production by this phase.

**`test_activation_registers_and_deactivation_removes_the_contract` checks, in order:**
1. **Before activation:** `discover_optional` → `None`.
2. **After activation:**
   - `list_registrations()` shows `ProductReferenceContractV1`, owned by module `inventory`, implemented by `InventoryProductReferenceImpl`, logical name `InventoryProductReference` v1.0;
   - discovery resolves it and caches it;
   - `InventoryService` is registered (`setup()`).
3. **After deactivation:**
   - the contract is unregistered;
   - it is **absent from the discovery cache** (invalidated);
   - `discover_optional` → `None`;
   - `InventoryService`'s descriptor is gone and resolving it raises `KeyError`.
4. **Re-activation** registers the contract again, with no duplicate-registration error.

`test_deactivated_inventory_rejects_from_the_next_request`:
- with Inventory active, an order succeeds and **warms the discovery cache**;
- after deactivation, the **next** request is rejected with 422 "cannot be verified".

## 6. Real-PostgreSQL and HTTP Evidence

**HTTP:** the real Sales router behind `TenantContextMiddleware`, with real JWTs.

**Data:**
- products, customers and orders are **committed**, because the contract implementation reads in its own session;
- everything is tagged and deleted in `finally`, and each test asserts that 0 tagged orders, customers and products remain;
- all counts run with RLS bypassed (all tenants).

| Test | Proves | Database-state assertion |
|---|---|---|
| `test_own_product_is_accepted` | own-tenant product works | 201; 1 order + 1 line; the line's `product_id` is stored; `order.tenant_id = A` |
| `test_foreign_nonexistent_and_global_products_are_rejected_identically_and_write_nothing` | cross-tenant, nonexistent, **global (D-1)**, and own+foreign mixed | each → 422 with the exact body `Product '<id>' not found`; **0 orders, 0 lines** after each (no partial order) |
| `test_customer_check_still_runs_first` | ordering is preserved | foreign customer + foreign product → `Customer '<id>' not found`, both with Inventory unavailable and active; 0 orders |
| `test_missing_tenant_context_has_no_eligible_product` | a JWT without a tenant | 422 `Product '<id>' not found`; 0 orders |
| `test_dormant_inventory_rejects_product_orders_but_not_plain_orders` | today's production state | product order → 422 `Product references cannot be verified`, 0 rows; plain order → 201 |
| `test_deactivated_inventory_rejects_from_the_next_request` | deactivation fails closed despite a warm cache | only the order made while active exists |
| `test_provider_exception_fails_closed_and_writes_nothing` | a provider error is never "eligible" | a broken provider (registered under a test module, removed in `finally`) raises; the request fails; 0 orders |
| `test_implementation_filters_by_tenant_independently_of_rls` | the tenant filter is the query's own | under `system_context()` (RLS bypassed), `{own, foreign, global, missing, "not-a-uuid"}` → `{own}`; with tenant `None` → `∅`; same result under A's context |
| `test_rejection_happens_before_numbering_or_any_write` | "before any order write" | inside **one** caller transaction, after the rejection (dormant, then active+foreign): `session.new` and `session.dirty` are empty, and a same-transaction `SELECT` sees 0 orders, so nothing was even flushed |
| `test_activation_registers_and_deactivation_removes_the_contract` | lifecycle | §5 |

**After the final runs (bypass-RLS SQL):**
- 0 `cnd1…` orders, customers and products;
- `inventory.products` has 0 rows in total;
- **0 stored order lines have a `product_id`**;
- 0 `inventory` module-state rows.

## 7. Mutation Check

Each safeguard was disabled on its own. The unit and PostgreSQL files ran in **separate** invocations, as the conftest guard requires. All files were restored and `cmp`-verified, and the baseline was re-run green.

```text
M1 implementation tenant filter removed                 pg 2 failed
M2 implementation admits global products                pg 2 failed
M3 missing provider treated as valid                    unit 1 + pg 3 failed
M4 product check removed from create_order              pg 6 failed
M5 provider error swallowed and treated as eligible     unit 1 + pg 1 failed
M6 Inventory never registers the contract               pg 7 failed
M7 product check moved after the order insert/flush     pg 1 failed   (the ordering test detects it)
M8 "unavailable" not mapped to 422                      pg 2 failed
```

All 8 were detected.

## 8. Test Commands and Results (2026-10-12, `backend/`, `.venv/bin/pytest -p no:cacheprovider -q`)

| Command | Result |
|---|---|
| `tests/unit/test_cnd1_product_reference_contract.py` (new) | **14 passed** |
| `tests/integration/workflow_postgres/test_cnd1_product_reference.py` (new) | **10 passed** |
| PG set: `test_cnd1_product_reference.py test_c2_cross_tenant_reference_remediation.py test_rc1_reference_candidates.py test_capability_tenant_scoping.py test_capability_leave_management.py test_capability_sales_customer.py test_capability_discovery.py test_form_platform.py test_p30g_rls_activation.py test_accounting_module_production_activation.py test_sales_module_production_activation.py` | **105 passed** (no xfail remains) |
| `tests/integration/workflow_postgres/test_external_boundary_probe_lifecycle.py` (the existing contract-lifecycle precedent) | **4 passed** |
| Existing Sales/Accounting PG files, **one per invocation** (known order-dependence, C-2 §7): `test_accounting_application_flow_proof` / `test_accounting_journal_entry_concurrency` / `test_f7_multi_module_runtime_path` / `test_sales_application_flow_proof` / `test_sales_order_concurrent_confirm` / `test_sales_order_full_state_machine_concurrency` | **7 / 4 / 6 / 7 / 4 / 8 passed** |
| `tests/integration/workflow` (SQLite tier, whole directory) | **172 passed, 5 skipped** (pre-existing "Fixed in Phase 2.0B.5N3A" / "CUT" skips, unchanged since C-2) |
| CND-1 + capability + architecture unit tests (13 files, incl. `test_service_dependency_boundary_architecture.py`, `test_sales_workflow_architecture.py`) | **142 passed** |
| RC-2 snapshots (`-k pinned_fixture`) | **3 passed** |
| `tests/unit --ignore=tests/unit/test_engine_execution.py` | **3,689 passed**: 3,675 before + 14 new, so no metadata pollution from Inventory models |

**Failures during the phase, all explained:**

1. **`test_rc1_reference_candidates.py::…_product` XPASS(strict).** This was expected: the RC-1 acceptance test detected the fix. It was converted to a normal test.
2. **The first version of my lifecycle test failed on `not service_registry.is_registered(InventoryService)` after deactivation.**
   - The service **was** removed (`get_all_names()` no longer lists it, and `resolve` raises `KeyError`).
   - However, `ServiceRegistry.unregister_module` leaves an empty type-index entry, so `is_registered(type)` keeps returning `True`.
   - This is a **pre-existing platform quirk**, unrelated to contracts, and **not fixed** (out of scope; §10). The test asserts the real state instead.
3. **My first mutation run executed nothing:** the conftest guard refuses unit and PostgreSQL tests in one invocation, and one anchor (M7) was not unique. It was re-run correctly; the results above are from the re-run.

**NOT RUN:** the full `tests/integration/workflow_postgres` directory in one invocation (known order-dependence), any other integration directories, Vitest, Playwright.

## 9. Confirmations

- **No writes on rejected requests:** for every rejection path (cross-tenant, nonexistent, global, mixed, tenant-less, dormant, deactivated, provider error, customer first):
  - 0 orders and 0 lines, counted across all tenants;
  - plus the same-transaction proof that nothing is pending or flushed (§6).
- **Sales does not import Inventory internals.** These AST tests fail on any violation:
  - `test_sales_never_imports_inventory` (all of `app/modules/sales/**`);
  - `test_inventory_never_imports_sales`;
  - `test_contract_package_imports_no_business_module`.

  Sales imports only `app.contracts.inventory.v1`, `app.contracts.discovery` and, lazily, `app.contracts.dependencies`.
- **Frontend:** NO change.
- **Database schema / FKs / migrations:** NO change.
- **RLS policies:** NO change.
- **RBAC:** NO change. Permissions and their order are unchanged; no new permission.
- **Capability contracts / ids / versions / RC-2 snapshots:** NO change. Snapshots pass.
- **Sales Order capability:** **not published.**
- **Inventory activation:** NOT made activatable; no `module.json` was added.
- **Out of scope:** H-1, stock adjustment, and `is_active`/`is_sellable` (D-2).

## 10. Remaining Risks

1. **Inventory remains dormant.** In production, every `POST /sales/orders` with a `lines[].product_id` is rejected with **422 "Product references cannot be verified"**. This holds until Inventory is activated in a separately approved phase (manifest, install and migration review, seed, RBAC).
   - This is the intended fail-closed state.
   - Observed usage is **0**: no stored line has ever carried a `product_id`, and no frontend form sends one.
   - Orders without products are unaffected.
2. **The Inventory implementation has never run in production** (no manifest). It is proven only through the real lifecycle manager in tests. The activation phase must re-run `test_cnd1_product_reference.py` against the real activation path.
3. **Separate read transaction.** The check reads in its own session (READ COMMITTED) before Sales writes. `product_id` has no FK, but Inventory has no product delete path and no way to change a product's tenant (`ProductUpdate` has no `tenant_id`), so a product cannot become another tenant's between check and write. This is reasoned from the code; it is not covered by a concurrency test.
4. **Ambient tenant mismatch** (defence in depth): if the request context and the passed tenant ever disagreed, RLS would hide the rows and the strict filter would return nothing. The order would be rejected, never accepted.
5. **The provider-error path returns a 500** (unhandled exception, nothing written), not a 422. This is deliberate: an infrastructure failure is not a client error, and it never yields "eligible".
6. **Pre-existing, out of scope:** `ServiceRegistry.is_registered(type)` stays `True` after `unregister_module` (§8 failure 2). Code that relies on `is_registered` to detect a deactivated module's service will be wrong. Recorded for platform follow-up.
7. **Global products are rejected (D-1)**, while C-2 kept global customers, departments and accounts eligible. This intentional asymmetry stays with the N-2 global-row decision.

## 11. Condition Status

| Item | Status |
|---|---|
| **CND-1** (order `lines[].product_id`) | **CLOSED**: implemented and proven (§5-§7) |
| `POST /sales/orders` cross-tenant references | customer (C-2) and product (CND-1) both **fixed and verified over real HTTP** |
| Sales order create as a capability | still **unpublished**; it would also need its own RC-2 pin and RC-3 inventory entry |
| RC-1 / RC-2 / RC-3 | CLOSED (re-run: pass) |
| H-1 | OPEN, out of scope |
