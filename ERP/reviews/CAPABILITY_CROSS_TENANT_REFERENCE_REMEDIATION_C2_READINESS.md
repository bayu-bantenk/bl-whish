# C-2 — Cross-Tenant Reference Integrity Remediation: Readiness

**Date:** 2026-10-12
**Source finding:** `CAPABILITY_EXPANSION_HARDENING_RC1_READINESS.md` (2026-10-09), condition C-2, plus the gate's S-4 / N-3.
**Scope:**
- Sales order create (reachable via `POST /sales/orders`);
- HR employee create and update;
- Accounting journal entry create.

No capability was added or published. H-1 and stock adjustment are out of scope.

**Provenance:** Commit: NONE · Push: NONE

```text
C-2 CROSS-TENANT REFERENCE REMEDIATION: GO-WITH-CONDITIONS
  FIXED + VERIFIED (real PostgreSQL, service and HTTP):
    sales order customer_id · employee department_id/position_id (create AND update) · journal lines[].account_id
  STILL OPEN (bounded, documented): sales order lines[].product_id
    It is an opaque id into the Inventory module; validating it needs a cross-module architecture decision (§10, CND-1)
```

---

## 1. Root Cause

1. The three services stored the caller-supplied ids **as given**:
   - `SalesService.create_order` stored `customer_id` and `lines[].product_id`;
   - `HRService.create_employee` / `update_employee` stored `department_id` and `position_id`;
   - `AccountingService.create_journal_entry` stored `lines[].account_id`.

   None of them resolved the id under the caller's tenant.
2. The database cannot catch this:
   - all business FKs reference `(id)` only;
   - PostgreSQL referential-integrity checks are **not subject to RLS**;
   - so an FK proves only that the row exists *in some tenant*.

   The RC-1 report proved this on real PostgreSQL: another tenant's department is invisible under RLS, yet the FK accepts it.
3. `sales_order_lines.product_id` has no FK at all (by design, `sales/models.py`: "to avoid cross-schema dependency with the inventory schema").

**A latent type trap, avoided:**
- The *create* routes pass `ctx.tenant_id` as a **str**; `update_employee`'s route passes a UUID.
- A plain `row.tenant_id != tenant_id` check would therefore reject **every** same-tenant reference on the create paths.
- Every new check normalizes the tenant to `uuid.UUID` first.
- The service tests call the create paths with a str tenant, exactly as the routes do.

## 2. Reference Inventory (from the actual DTOs and services)

| Operation | DTO | Field | Referenced table (owner) | Tenant column | Checked now |
|---|---|---|---|---|---|
| `SalesService.create_order` | `SalesOrderCreate` | `customer_id` | `sales.customers` (Sales) | yes | ✅ |
| | `OrderLineCreate` | `lines[].product_id` (optional) | `inventory.products` (Inventory; no FK) | yes | ❌ **CND-1** |
| `HRService.create_employee` | `EmployeeCreate` | `department_id`, `position_id` (optional) | `hr.departments`, `hr.positions` (HR) | yes | ✅ |
| `HRService.update_employee` | `EmployeeUpdate` | `department_id`, `position_id` (optional) | same | yes | ✅ |
| `AccountingService.create_journal_entry` | `JournalLineCreate` | `lines[].account_id` | `accounting.accounts` (Accounting) | yes | ✅ |

The remaining fields were checked and are **not** record references:
- `SalesOrderCreate`: `order_date`, `tax_percent`, `shipping_address`, `notes`; line `description`, `quantity`, `unit_price`, `discount_percent`.
- `EmployeeCreate` / `EmployeeUpdate`: `employee_code`, names, `email`, `phone`, `hire_date`, `employment_type`, `status`.
- `JournalEntryCreate`: `entry_date`, `description`, and `reference`. `reference` is free text of at most 200 characters, never resolved and with no FK.

No DTO accepts `tenant_id`. The tenant always comes from `UserContext` (JWT) through the route.

## 3. Fix (authoritative service layer)

| Service | Change |
|---|---|
| `sales/service.py` | `SalesReferenceNotFoundError(ValueError)`; `_as_tenant()` normalizer. `create_order` checks `get_customer(customer_id, tenant)` **before** numbering, inserting the order or adding lines |
| `hr/service.py` | `HRReferenceNotFoundError(ValueError)`; module-private `_check_references()` for `department_id` / `position_id`. Called in `create_employee` before the insert, and in `update_employee` **after** the employee's own tenant check and **before any attribute is set** |
| `accounting/service.py` | `AccountReferenceNotFoundError(ValueError)`. `create_journal_entry` checks every distinct `account_id` with the existing `get_account(…, tenant)`, after the balance check and **before** numbering or inserting the entry or lines |

Each module keeps its own exception, in the style of `CustomerCodeConflictError`. There is no new shared abstraction and no cross-module import.

**Ownership rule:** this is the platform's established *tenant-or-mismatch-is-not-found* convention, the same one `get_customer` / `get_account` / `get_employee` / `get_product` apply (Phase 3.0G, 3.10). A reference passes only if:
- the row exists, **and**
- `row.tenant_id == caller tenant`, **or** `row.tenant_id IS NULL` (global; see §4).

For a tenant-less caller (N-2 path), only global rows pass.

## 4. Behaviour Matrix

| Reference | Same tenant | Another tenant | Nonexistent | Global (`tenant_id IS NULL`) |
|---|---|---|---|---|
| order `customer_id` | accepted | **rejected** | **rejected** (was an FK 500) | accepted |
| employee `department_id` / `position_id` (create, update) | accepted | **rejected** | **rejected** (was an FK 500) | accepted |
| journal `lines[].account_id` | accepted | **rejected** | **rejected** (was an FK 500) | accepted |
| order `lines[].product_id` | accepted | **accepted (open, CND-1)** | accepted (no FK) | accepted |

**Global rows were not changed by C-2.**
- **Grounding:** `app/core/database/base.py` defines `tenant_id NULL = global/system record`. `PHASE_3_0G_RLS_ACTIVATION_AND_TENANT_ISOLATION.md` §275 calls global-row visibility "intentional, not a defect". `PHASE_3_10_DORMANT_MODULE_TENANT_ISOLATION_HARDENING.md` §83/§126 says global rows "remain visible by design".
- The existing single-record loaders apply exactly this rule. Stock adjustment, the one candidate the RC-1 report found safe, also accepts global products through `get_product`.
- So C-2 neither broadens access (the old code accepted *any* row) nor invents a new restriction.
- Each global case has its own test (§6).

**Data check (2026-10-12, read-only, RLS bypassed):**
- every existing order → customer and journal line → account pair is **same-tenant** (1,713 and 1,266 rows);
- no tenant row references a global row;
- 72 global customers exist (N-2 artefacts); there are 0 global departments, positions and accounts.

> **Decision still owed (N-2 platform, not C-2):** whether a *tenant* record may reference a *global* record at all. The list endpoints (`list_customers`, `list_departments`, …) already hide global rows from tenant callers, while the single-record loaders show them. That asymmetry belongs to the deferred N-2 global-row model (gate §12). If the decision is "never", the change is a one-line predicate in each check: drop the `tenant_id is None` allowance.

## 5. Error Behaviour and Non-Disclosure

| Route | Before C-2 (another tenant / nonexistent) | After C-2 (both) |
|---|---|---|
| `POST /sales/orders` | 201 / 500 (FK) | **422** `{"detail": "Customer '<id>' not found"}` |
| `POST /hr/employees` | 201 / 500 (FK) | **422** `{"detail": "Department '<id>' not found"}` / `"Position '<id>' not found"` |
| `PATCH /hr/employees/{id}` | 200 / 500 (FK) | **422**, same messages |
| `POST /accounting/journal-entries` | 201 / 500 (FK) | **422** `{"detail": "Account '<id>' not found"}` (existing `ValueError` → 422 mapping; no route change) |

**Why 422:** this follows the project's precedent for references in the request body. `POST /inventory/stock/adjust` maps `ValueError("Product '<id>' not found")` to 422, and `POST /journal-entries` already maps service `ValueError`s to 422. The 404 convention is used for the **path** resource, and that is unchanged: a cross-tenant `PATCH /hr/employees/{id}` is still a 404, and it is checked *before* the references, so it gives away nothing about them.

**Non-disclosure:**
- The message carries only the caller's own input id.
- It is identical in shape for "nonexistent" and "another tenant's". This is asserted by tests that normalize the id and compare the message sets.
- The exception holds no tenant or row data, and the services log nothing about the referenced row.

**Unchanged:** RBAC (`require_permission` runs before the service), the employee-not-found 404, the unbalanced-entry 422, and every other error path. Unexpected database errors still propagate.

## 6. Real-PostgreSQL Evidence

**File:** `tests/integration/workflow_postgres/test_c2_cross_tenant_reference_remediation.py` (17 tests).

There are two tiers:
- **Service tier:** one transaction per scenario, **rolled back**. Tenant B's rows are inserted under B's RLS context, then the transaction switches to A.
- **HTTP tier:** the real Sales/HR/Accounting routers behind `TenantContextMiddleware`, with real JWTs. Rows are **committed** and deleted in `finally`, and every test asserts that zero of its rows remain.

All "nothing written" counts run with **RLS bypassed** (across all tenants), so a zero is never an artefact of RLS hiding a row.

| Area | Scenario | Database-state assertion |
|---|---|---|
| Sales | own customer (str tenant, as the route passes) | 1 order + 1 line; `order.tenant_id = A` |
| Sales | another tenant's customer / nonexistent | same exception, same message shape; **0 orders, 0 lines** |
| Sales | tenant-less caller → A's customer | rejected; 0 orders |
| Sales | global customer | accepted; the order is owned by A (convention test) |
| HR | own department + position | employee with both references, `tenant_id = A` |
| HR | another tenant's / nonexistent `department_id`; same for `position_id` | same exception, same message shape; **0 employees** |
| HR | update with a foreign department + other field; foreign position + other field; nonexistent department | rejected each time. `first_name`, `department_id`, `position_id`, `version` and `updated_at` are unchanged in memory **and** in the database (the SELECT autoflushes, so a partial mutation would show) |
| HR | update with own references | applied |
| HR | global department | accepted (convention test) |
| Journal | own accounts | 1 entry + 2 lines |
| Journal | foreign / nonexistent account on the debit side, and on the credit side | same exception, same message shape; **0 entries, 0 lines**; both accounts' `balance` unchanged |
| Journal | global account | accepted (convention test) |
| **HTTP** | `POST /sales/orders`: foreign customer, nonexistent customer, then own customer | 422 + exact body for both rejections, with 0 orders after them; own → 201; 1 order + 1 line, `tenant_id = A`; cleanup leaves 0 |
| **HTTP** | `POST /hr/employees` (foreign department), then `PATCH` an existing employee with `first_name` + foreign department | both 422 + exact body; the rejected employee does not exist; the patched row is still `("Before", NULL, version 1)`; cleanup leaves 0 |
| **HTTP** | `POST /accounting/journal-entries` with one foreign account | 422 + exact body; 0 entries/lines; cleanup leaves 0 |

**RC-1 acceptance tests** (`test_rc1_reference_candidates.py`):
- The `xfail(strict=True)` tests for HR department, Sales customer and journal account **turned into XPASS(strict)** as soon as the fix landed. That is the designed signal.
- They are now normal tests asserting the specific typed errors.
- The Sales **product** test stays `xfail(strict=True)`, with its reason updated to CND-1.

**Residue check after all runs (bypass-RLS SQL):**
- 0 orders, entries and employees tagged `c2…`;
- 0 customers, departments, positions and accounts matching the exact tag patterns `^c2[0-9a-f]{14}$` / `^rc1…`.

A broader `c2%` prefix also matches 85 customers and 32 accounts. Those belong to other test suites: `test_p30g_rls_activation.py` codes are `c` + 10 hex, so they can start with `c2`. None have this phase's tag length.

**Mutation check.** Each fix was disabled on its own and the C-2 file re-run. Files were restored and `cmp` verified.

```text
M1 Sales customer check removed            3 failed
M2 HR reference check no-op                4 failed
M3 HR update check moved after setattr     1 failed   (partial-update protection is really tested)
M4 Accounting account check removed        3 failed
M5 HR rule made strict (globals rejected)  1 failed   (global convention is really tested)
M6 Sales 422 route mapping removed         1 failed   (HTTP behaviour is really tested)
```

All 6 were detected.

## 7. Test Commands and Results (2026-10-12, `backend/`, `.venv/bin/pytest -p no:cacheprovider -q`)

| Command | Result |
|---|---|
| `tests/integration/workflow_postgres/test_c2_cross_tenant_reference_remediation.py` (new) | **17 passed** |
| `tests/integration/workflow_postgres/test_rc1_reference_candidates.py` (updated) | **7 passed, 1 xfailed** (product, CND-1; **not** a passing security fix) |
| PG set: the two files above + `test_capability_tenant_scoping.py test_capability_leave_management.py test_capability_sales_customer.py test_capability_discovery.py test_form_platform.py test_p30g_rls_activation.py test_accounting_module_production_activation.py test_sales_module_production_activation.py` | **94 passed, 1 xfailed** |
| Existing PG Sales/Accounting service tests, **one file per invocation**: `test_accounting_application_flow_proof.py` / `test_accounting_journal_entry_concurrency.py` / `test_f7_multi_module_runtime_path.py` / `test_sales_application_flow_proof.py` / `test_sales_order_concurrent_confirm.py` / `test_sales_order_full_state_machine_concurrency.py` | **7 / 4 / 6 / 7 / 4 / 8 passed** |
| Existing SQLite-tier service/route tests: `tests/integration/workflow/test_accounting_journal_posting_workflow.py test_p30f_tenant_isolation_audit.py test_p310_hr_inventory_tenant_isolation.py test_sales_order_approval_workflow.py` | **38 passed** |
| `tests/integration/workflow` (whole SQLite-tier directory) | **172 passed, 5 skipped**. The skips are pre-existing and unrelated: `test_concurrency_lite.py` ×3 "Fixed in Phase 2.0B.5N3A"/"CUT", `test_security_enforcement.py` ×2 "CUT: … no HTTP-reachable entry point" |
| Capability, contract and architecture unit tests (`test_capability_*`, `test_leave_management_*`, `test_sales_customer_capability.py`, `test_form_platform_architecture.py`, `test_service_dependency_boundary_architecture.py`, `test_sales_workflow_architecture.py`) | **128 passed** |
| RC-2 snapshots: `tests/unit/test_leave_management_capability_contract.py tests/unit/test_sales_customer_capability.py -k pinned_fixture` | **3 passed** |
| `tests/unit --ignore=tests/unit/test_engine_execution.py` (full unit suite, known exclusion) | **3,675 passed** |

**Failures observed during the phase, all explained:**

1. **3 × XPASS(strict)** in `test_rc1_reference_candidates.py` right after the fix. This was **expected**: the acceptance tests detected the fix. They were converted to normal assertions.
2. **12 failures** when the six existing PG Sales/Accounting files ran **in one invocation**: `POST /api/v1/sales/customers` returned a route-level 404 during fixture setup. This is a **pre-existing, environment/test-ordering issue**, not a regression:
   - the identical combined run on the **pre-phase code** (backups restored, then re-applied and `cmp`-verified) failed the same 12;
   - each file passes on its own, with and without C-2.

   It matches the route-mounting order-dependence documented in `test_p30g_rls_activation.py` (Phase 4.9).
3. **1 test defect in a new test:** `expire_all()` followed by the service's synchronous attribute access raised `MissingGreenlet`. It was fixed in the test only (the expiry was removed). The assertion was strengthened to check the in-memory object as well as the autoflushed database row.
4. **Two of my combined commands initially ran no tests:** zsh does not word-split `$T`. They were re-run with `${=T}`; the results above are from the re-runs.

**NOT RUN:** the full `tests/integration/workflow_postgres` directory in one invocation (known order-dependence, see failure 2), any other integration directories, Vitest, Playwright.

## 8. Files Changed

| File | Change | Reason |
|---|---|---|
| `backend/app/modules/sales/service.py` | +31 lines: `SalesReferenceNotFoundError`, `_as_tenant`, customer check in `create_order` | fix |
| `backend/app/modules/sales/api.py` | +7: `POST /orders` maps the error to 422 | otherwise an unhandled 500 |
| `backend/app/modules/hr/service.py` | +36: `HRReferenceNotFoundError`, `_check_references`, calls in create/update | fix |
| `backend/app/modules/hr/api.py` | +12: `POST /employees`, `PATCH /employees/{id}` map the error to 422 | otherwise an unhandled 500 |
| `backend/app/modules/accounting/service.py` | +21: `AccountReferenceNotFoundError`, account check in `create_journal_entry` | fix; the route already maps `ValueError` |
| `backend/tests/integration/workflow_postgres/test_c2_cross_tenant_reference_remediation.py` | **new**, 17 tests | proof (§6) |
| `backend/tests/integration/workflow_postgres/test_rc1_reference_candidates.py` | 3 strict xfails → normal tests with typed errors; product xfail reason → CND-1; docstring | the acceptance tests now pass |
| `docs/architecture/reviews/CAPABILITY_CROSS_TENANT_REFERENCE_REMEDIATION_C2_READINESS.md` | **new** | this report |

The line counts are measured against pre-phase backups. A `git diff` against the index also shows earlier, uncommitted Sales work (D-1's `CustomerCodeConflictError` / 409 mapping), which is not part of C-2.

`CAPABILITY_EXPANSION_HARDENING_RC1_READINESS.md` was **not edited**. Its §3 and §5.2 "UNSAFE / xfail" statements for HR, Sales customer and journal accounts are superseded by this report; the product statement still stands.

## 9. What Changed in the Product

- **Production code changed: YES.** Three services and two route modules (5 files). Error handling changed only for the reference-rejection cases above.
- **Frontend / Form Builder:** NO.
- **Database / migrations / schema:** NO.
- **RLS policies:** NO.
- **RBAC:** NO. Permissions and their order are unchanged.
- **Capability contracts / ids / versions / RC-2 snapshots:** NO. Snapshots re-run: pass.
- **New or published capability:** **NONE.**
- **Workflow:** NO.

## 10. Remaining Risks and Conditions

**CND-1: order `lines[].product_id` is still unchecked.** It is bounded, but **still unsafe**.
- The product belongs to the Inventory module.
- Sales declares no dependency on Inventory (`module.json` `depends_on: []`), the column deliberately has no FK, and Inventory is dormant (no `module.json`).
- Validating it from Sales needs one of these: a sanctioned cross-module seam (an Inventory contract under `app.contracts`), a declared module dependency, or a decision that Sales owns product validation. All of these are architecture changes the brief forbids, so this phase stopped here.

Today the stored id is **never resolved** anywhere in Sales (only `create_order` reads it), so there is no disclosure, but it is an integrity gap. **Sales order create must not be published as a capability until CND-1 is decided and fixed.**

**Residual race, not proven safe by a test.** The check and the insert run in one READ COMMITTED transaction, with no lock on the referenced row.
- **Concurrent delete** of the referenced row after the check:
  - customers and accounts are `ON DELETE RESTRICT`; departments and positions are `SET NULL`;
  - the INSERT's own FK check runs at statement time, sees the committed delete, and raises an FK violation;
  - so the request fails closed (an unhandled 500, **nothing written**). It never stores a dangling or foreign reference.
- **Concurrent ownership change:** no code path in these modules updates `tenant_id` on an existing row (the update DTOs have no `tenant_id`), so a row cannot "move" into another tenant between check and write.
- No row lock (`FOR SHARE`) was added, since none is needed for the security property. This reasoning is from the code and the FK semantics, not from a concurrency test.

**Global-row eligibility** (§4): this keeps the documented convention and is a decision owed to N-2, not a C-2 defect.

**Other unchecked references, out of C-2 scope** (RC-1 report §3):
- `PositionCreate.department_id`;
- `DepartmentCreate.parent_id`;
- `ProductCreate.category_id`;
- `AccountCreate.parent_id`.

They stay platform N-3 hardening.

**Smaller items:**
- **Pre-existing test order-dependence:** the 12 PG Sales concurrency tests fail when run in one invocation with the other Sales/Accounting PG files (failure 2 in §7), so they must be run per file.
- **Inherited semantics:** `EmployeeUpdate` cannot clear a reference (`exclude_none`), and position↔department consistency is not enforced. C-2 changed neither.

## 11. Condition and Finding Status

| Item | Status |
|---|---|
| **`POST /sales/orders` cross-tenant customer** | **FIXED and VERIFIED** on real PostgreSQL over real HTTP (422, nothing written; own customer still 201) |
| **`POST /sales/orders` cross-tenant product** | **NOT FIXED**: CND-1 |
| HR employee create/update (department, position) | **FIXED and VERIFIED** (service + HTTP; the route module is dormant in the target DB, tested by mounting its real router) |
| Journal entry create (accounts) | **FIXED and VERIFIED** (service + HTTP; the module is inactive in the target DB, tested by mounting its real router) |
| RC-1 | CLOSED for the published set (unchanged). Candidates: HR employee create and journal entry create are now RC-1-clean at the service layer; Sales order create **stays blocked** on CND-1 |
| RC-2 | CLOSED (snapshots pass) |
| RC-3 | CLOSED (tests pass) |
| H-1 | OPEN, out of scope |
