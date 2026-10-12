# N-2 — Global Row Policy: Audit and Architecture Decision

**Date:** 2026-10-12
**Type:** AUDIT + DECISION.
- No production code, schema, migration, RLS, RBAC, capability contract or existing data was changed.
- The only file added outside this document is a non-production evidence test: `backend/tests/integration/workflow_postgres/test_n2_global_row_current_behavior.py`.

**Inputs:**
- the gate (`CAPABILITY_SECURITY_AND_CONTRACT_INTEGRITY_GATE.md`: §3 N-2, S-1 to S-3, §12, §15);
- the readiness docs `CAPABILITY_EXPANSION_HARDENING_RC1/RC3`, `CAPABILITY_CROSS_TENANT_REFERENCE_REMEDIATION_C2`, `CND1_…_DECISION` / `…_IMPLEMENTATION_READINESS`, and `CAPABILITY_CONTRACT_VERSION_INTEGRITY_H1_READINESS`;
- the current code, schema and live test database, which are authoritative.

**Provenance:** Commit: NONE · Push: NONE

```text
N-2 DECISION: GO-WITH-CONDITIONS
  Recommended: Option C with a strict default — "owner-declared reference policy, same-tenant unless declared".
    Business entities are tenant-owned; NULL tenant is not an owner a tenant API may create, change or rely on.
    Platform-owned reference data lives in tenant-less tables (the accounting.account_types precedent),
    or behind an explicit, gate-approved per-entity declaration.
  Confirmed defects (current behaviour, executed on real PostgreSQL):
    D-1 HIGH   a tenant can MUTATE global rows (HTTP: cancel a global sales order → 200).
    D-2 HIGH   RLS lets any tenant session INSERT/UPDATE/DELETE/claim/publish global rows (WITH CHECK admits NULL).
    D-3 MEDIUM every create route turns a tenant-less caller (the seeded superadmin) into an implicit global-row writer.
  Conditions: owner sign-off on decisions P-1…P-7 (§6), and a production data inventory (§12) before any implementation.
  Implementation: NOT performed.
```

---

## 1. Executive Summary

Today **"global" is not a concept anywhere in the platform. It is a side effect.** A row is global when `tenant_id IS NULL`, and that happens in three ways:
- any create route called by a principal without a `tid` claim;
- the seeded superadmin is such a principal (`scripts/db.py:DEMO_USERS`, `tenant_slug: None`);
- a tenant session using raw SQL (RLS permits it).

Once a row is NULL-tenant, three rules apply uniformly:
- **RLS** treats it as readable **and writable** by every tenant;
- **every by-id loader** returns it to every tenant, including the loaders used before mutations;
- **every list** hides it from tenants.

Reference eligibility was then decided per phase:
- C-2 accepts global customers, departments, positions and accounts;
- CND-1 rejects global products;
- Inventory's own stock adjust accepts a global product but not a global location.

The live test database holds **0** references to a global row in **any** reference column (§2.3). The only global business rows are 75 test-created customers. The only *intentionally* platform-owned reference data in the schema, `accounting.account_types`, does **not** use NULL-tenant rows at all: it is a separate table with no `tenant_id`.

**Recommendation: Option C, with Option A as the default.**
- Every reference field has an owner-declared policy.
- The default, and the only policy any current entity needs, is **same-tenant only**.
- Global reference eligibility is an explicit, gate-approved exception. The precedent is RC-3's `UNSCOPED_CAPABILITY_APPROVALS`.
- Platform reference data belongs in tenant-less tables, never in NULL-tenant rows of a tenant table.
- Writes to global data are never possible from a tenant context.

**Decision status: GO-WITH-CONDITIONS.** The policy is evidence-backed, but two inputs are outside this phase's evidence:
- the owner's sign-off, because it **reverses C-2's global eligibility**;
- the ownership distribution of a real (non-test) database, which was not inspected (§13 Q-1).

## 2. Current State

### 2.1 Representation (live `erp_platform`, read-only catalog queries)

- **Single mechanism:** a nullable `tenant_id` column. There is no `is_global` flag and no separate global tables, except `accounting.account_types`, which has **no** `tenant_id` and is excluded from RLS (`rls.py` "intentionally EXCLUDED").
- **RLS:** 63 policies, all `FOR ALL TO public`, **USING ≡ WITH CHECK**. Two textual variants exist (57 uuid, 6 text `workflow_studio`), with identical semantics:
  ```text
  tenant_id IS NULL
  OR current_setting('app.bypass_rls') = 'true'
  OR (current_tenant_id IS NOT NULL AND tenant_id = current_tenant_id)
  ```
- **Tables outside that policy:**
  - `form_platform` (`tenant_id NOT NULL` by design, Phase 2);
  - `auth.organizations` / `branches` (NOT NULL);
  - `auth.user_roles` and `workflow.wf_registry_definitions` (sentinel UUID, no RLS);
  - `system.module_*` (no RLS);
  - all partition children of audit/eventbus/notification (no RLS of their own; gate S-6).
- **FKs (15 in sales/hr/accounting/inventory/leave):** all are `REFERENCES x(id)` on the id alone, and **none** includes `tenant_id`. Eight are `ON DELETE SET NULL`, four are `ON DELETE CASCADE` and three are `RESTRICT`.

### 2.2 Entity matrix: current behaviour

**Legend:**
- **R** = by-id read, **L** = list, **Ref** = accepted as a reference, **C/U/D** = create / update / delete of a global row.
- "Tenant" means a caller with a tenant; "tenantless" means a JWT without `tid`.
- **App** = service layer; **DB** = RLS alone.

| Entity (table) | Global rows (test DB) | R (tenant) | L (tenant) | Ref by tenant-owned rows | C global | U/D global by tenant | Source |
|---|---|---|---|---|---|---|---|
| Customer (`sales.customers`) | 75 / 2,995 | **yes** (`get_customer`) | no | **yes**: order `customer_id` (C-2) | tenantless `POST /sales/customers`; DB: any session | no route; **DB: yes** | `sales/service.py:213-238`, `sales/api.py:130-150` |
| Sales order (`sales.sales_orders`) | 0 / 1,830 | **yes** (`_load_tenant_scoped_order`) | no | — | tenantless `POST /sales/orders` | **App: yes**: `cancel_order`/`confirm_order`/`decide_order_approval` load via the same loader. **HTTP proven** | `sales/service.py:368-415, 515-563` |
| Order line → product (`sales_order_lines.product_id`, no FK) | — | — | — | **no**: CND-1 contract, own tenant only | — | — | `inventory/contract_impl.py`, `sales/service.py::_check_product_references` |
| Product (`inventory.products`) | 0 | **yes** (`get_product`) | no | Sales: **no** (CND-1). Inventory stock adjust: **yes** | tenantless `POST /inventory/products` (module dormant) | **App: yes** (`update_product`). **Service proven** | `inventory/service.py:120-153, 288` |
| Product category | 0 | (by list only) | no | product `category_id`: **unchecked** (N-3) | tenantless create | DB: yes | `inventory/service.py:56-90, 94-110` |
| Stock location | 0 | — | own only | stock adjust: **own only** | tenantless create | DB: yes | `inventory/service.py:207-216, 291` |
| Department (`hr.departments`) | 0 | `_check_references` admits | no | **yes**: employee `department_id` (C-2); position `department_id` and department `parent_id`: **unchecked** (N-3) | tenantless create | no route; DB: yes | `hr/service.py:45-60, 63-120` |
| Position (`hr.positions`) | 0 | `_check_references` admits | no | **yes**: employee `position_id` (C-2) | tenantless create | no route; DB: yes | same |
| Employee (`hr.employees`) | 0 | **yes** (`get_employee`) | no | — | tenantless create | **App: yes** (`PATCH /hr/employees/{id}` → `update_employee`). **Service proven** | `hr/service.py:177-211`, `hr/api.py:200-214` |
| Account (`accounting.accounts`) | 0 / 1,516 | **yes** (`get_account`) | no | **yes**: journal line `account_id` (C-2); account `parent_id`: **unchecked** (N-3) | tenantless create | no route; DB: yes | `accounting/service.py:66-135` |
| Journal entry | 0 / 703 | **yes** (`_load_tenant_scoped_entry`) | no | — | tenantless create | **App: yes** by code: `post_journal_entry`/`decide_entry_approval` use the global-admitting loader. Not executed (starts a real workflow) | `accounting/service.py:245-305` |
| Account type (`accounting.account_types`) | n/a (158 rows, **no `tenant_id`**) | yes | yes | **yes**: account `account_type_id`, by design | no route | no route | `accounting/api.py:86-97`, `rls.py` exclusion |
| Leave request | 0 / 1,168 | `_load_tenant_scoped_request` admits globals (RC-3 note) | — | — | capability: **no** (executor requires a tenant) | — | RC-3 readiness |
| Workflow Studio workspace/draft/version/template | 596 / 991 ws; 592 / 861 drafts; 77 / 77 versions | **yes** (`_enforce_tenant` returns early on NULL) | own + global (`list_by_folder`/`list_by_workspace`) | — | — | **App: yes** by code: `update`/`delete` call `_enforce_tenant`. Not executed (Workflow domain, out of this phase's probe scope) | `workflow_studio/infrastructure/repositories.py:89-160` |
| `auth.roles` | 3 / 21 (`scope: global` system roles) | — | — | user_roles | seed only | no mutating route found | `scripts/db.py:DEMO_ROLES` |
| Capabilities (2 published) | — | — | — | none (no reference inputs, RC-1) | **never**: the executor refuses a tenantless caller; `tenant_scoped=False` is refused without an approval (RC-3) | — | `capabilities/executor.py::_resolve_tenant` |

### 2.3 Existing data (read-only, `erp_platform`, bypass via the superuser OS role, counts only)

| Reference | Points to a global row | Points to another tenant's row | Rows |
|---|---|---|---|
| `sales_orders.customer_id` | 0 | 0 | 1,830 |
| `sales_order_lines.product_id` | 0 non-null | — | 1,747 |
| `journal_lines.account_id` | 0 | 0 | 1,406 |
| `accounts.parent_id` | 0 | 0 | 0 |
| `hr.*`, `inventory.*` | tables empty | | 0 |

- **Global customers:** 75, with 75 distinct codes (no duplicate NULL-tenant codes exist yet; gate S-2's PG 14 `UNIQUE` gap remains theoretical here).
- **`auth.users`:** 5,398 / 5,494 have no tenant (test residue), so tenant-less tokens are plentiful in this DB.
- **`erp_db` (localhost):** empty (`public` schema only).
- **Docker `erp_postgres`:** **NOT INSPECTED.** The daemon was not running (§13 Q-1).

## 3. Evidence: `test_n2_global_row_current_behavior.py`

**Tiers:**
- service/raw-SQL scenarios run in rolled-back transactions under the real non-superuser, non-BYPASSRLS role (asserted in the first test);
- the HTTP tier uses the real Sales router plus `TenantContextMiddleware` and real JWTs, and commits rows that are then deleted, with zero left (asserted).

**The xfail tests encode the one rule all options share:** a tenant must not mutate, claim or create a global row. I re-ran them with `--runxfail` to confirm that **each fails on the defect itself**, not on a test error:

```text
assert <SalesOrder …> is None                       (service cancel_order returned the global order)
assert <Employee …> is None                         (update_employee changed a global employee)
assert <Product …> is None                          (update_product changed a global product)
Failed: DID NOT RAISE                               (DB accepted a NULL-tenant INSERT from tenant A)
assert 200 == 404   … "status":"cancelled" …        (HTTP POST /sales/orders/{global}/cancel by tenant A)
```

| Test | Kind | Layer that decides | Result |
|---|---|---|---|
| `test_rls_lets_a_tenant_session_read_insert_update_and_delete_global_rows` | characterization | DB | tenant A reads, inserts, updates and deletes global; B's row hidden and untouched (control) |
| `test_rls_lets_a_tenant_claim_a_global_row_and_publish_its_own_row_globally` | characterization | DB | `SET tenant_id = A` on a global row and `SET tenant_id = NULL` on A's row both succeed; an unrelated tenant then sees A's row |
| `test_rls_does_not_constrain_a_reference_to_another_tenants_row` | characterization | DB | A's order → B's customer accepted (FK proves existence only) |
| `test_services_create_global_rows_for_a_tenantless_caller` | characterization | App | `create_order(tenant_id=None)` → `tenant_id NULL` |
| `test_by_id_loaders_show_a_global_row_that_the_tenant_list_hides` | characterization | App | `get_customer`/`get_order` return it; `list_customers`/`list_orders` omit it |
| `test_http_tenantless_caller_creates_global_rows_that_every_tenant_can_read_and_reference` | characterization | HTTP | tenantless POST customer and order → 201, both NULL tenant; tenant A GET order and customer → 200, but absent from its list; A's own order on the global customer → 201 |
| `test_a_tenant_cannot_cancel_a_global_sales_order` | **xfail strict** | App | **defect D-1** |
| `test_a_tenant_cannot_update_a_global_employee` | **xfail strict** | App | **defect D-1** |
| `test_a_tenant_cannot_update_a_global_product` | **xfail strict** | App | **defect D-1** (Inventory dormant: in-process only) |
| `test_the_database_refuses_a_global_insert_from_a_tenant_session` | **xfail strict** | DB | **defect D-2** |
| `test_http_a_tenant_cannot_cancel_a_global_sales_order` | **xfail strict** | HTTP | **defect D-1, live route** |

**Prior executed evidence reused:**
- `test_p30g_rls_activation.py::test_null_tenant_row_is_globally_visible_by_design` (Phase 3.0G intent);
- C-2's three `…_global_…_follows_the_system_record_convention` tests;
- `test_cnd1_product_reference.py` (global product rejected);
- `test_rc1_reference_candidates.py::test_stock_adjust_global_row_semantics`;
- `test_capability_tenant_scoping.py` (RC-3, NULL-tenant rows present).

## 4. Findings

### N2-A — Global data semantics

The brief's five concepts against the evidence:

| Concept | Exists today? | Where | Needed? |
|---|---|---|---|
| Platform-owned **immutable** reference data | **Yes, done right:** a separate tenant-less table | `accounting.account_types` (158 rows, RLS-excluded, read-only API) | **Yes.** This is the canonical representation |
| Platform-owned **mutable** configuration | Implicitly: `system.sys_settings`, `core.feature_flags`, global `auth.roles`, `workflow.wf_definitions` (693 global), Studio (596 global workspaces) | NULL-tenant rows in RLS tables | Yes for platform tables, but **write = platform admin only**. That is not the case today (D-1, D-2) |
| Tenant-owned data | Every business table | — | Yes |
| Tenant-owned references to approved global data | Only `accounts.account_type_id` (tenant-less table, by FK). NULL-tenant customer/department/position/account references are accepted by C-2 but **never used** (0 rows) | — | Only through the tenant-less reference-table pattern or an explicit declaration. **No current entity needs it.** |
| Global data visible but not referenceable | De facto: products for Sales (CND-1), locations for stock | — | Possible per entity, but only if declared |

**Conclusion:** the platform needs the distinction, and today it encodes none of it. "NULL tenant" conflates platform reference data, platform configuration and accidental tenant-less writes. Phase 3.0G (`rls.py` docstring) described it as "global/system record, shared across all tenants by design (e.g. seeded reference data)". **No business seed creates such rows.** `scripts/db.py` and `seed_worklist_e2e.py` seed no customer, department, account or product, no migration inserts into `sales`, `hr`, `accounting.accounts` or `inventory`, and the actual reference catalog uses a separate table.

### N2-B — Reference eligibility

| Rule | Source | Justified by domain ownership? |
|---|---|---|
| C-2: global customer / department / position / account eligible | C-2 kept the Phase 3.0G "system record" loader convention **deliberately, to avoid changing global-row policy** (C-2 readiness; test names `…follows_the_system_record_convention`) | **No.** A customer is a counterparty of one company, and departments, positions and ledger accounts are a company's own structure. No seed, route or data uses a shared one (0 references). C-2's choice was a holding position, not a domain decision. |
| CND-1: global product ineligible (D-1 of CND-1, approved) | approved decision | **Yes** (products are a tenant's catalogue). It is also the **only** rule that was decided on domain grounds. |
| Inventory stock adjust: global product eligible, global location not | `inventory/service.py:288-293` | **Inconsistent** with CND-1 for the same entity. It is an artefact of `get_product` vs `list_locations` filters. |
| `account_type_id` → tenant-less catalogue | schema | **Yes.** Genuine platform reference data. |
| Unchecked: `positions.department_id`, `departments.parent_id`, `accounts.parent_id`, `product_categories.parent_id`, `products.category_id` | create paths | **N-3**, not N-2: no ownership check at all. Listed so that N-2's rule is applied to them by the N-3 phase. |

### N2-C — Read and write isolation

For every global-capable business entity the current code gives:
- **read = reference = update = (DB) delete**;
- **create = anyone without a tenant**.

The brief's premise is violated: readability currently **does** imply mutability.

**D-1 (HIGH, confirmed): tenant mutation of global rows.**
- **Root cause:** the shared loader idiom `if row.tenant_id is not None and row.tenant_id != tenant_id: return None` (sales, hr, accounting, inventory, `_enforce_tenant` in Studio) is used for **both** reads and pre-mutation fetches.
- **Proven:**
  - HTTP `POST /sales/orders/{id}/cancel` → 200 and the global order is `cancelled`;
  - service `update_employee` and `update_product` (Inventory dormant).
- **By code, not executed:**
  - `confirm_order`, `decide_order_approval`, `post_journal_entry`, `decide_entry_approval`;
  - Studio `update`/`delete` of workspaces, drafts, versions and templates.
- **Impact:** one tenant changes the state of a row every tenant sees. Today that is limited by data: 0 global orders and 0 global employees in the test DB. Global Studio workspaces (596) are the largest exposed set, and are code-evidenced only.
- **Not a disclosure** of another tenant's private data.

**D-3 (MEDIUM, confirmed): implicit global writers.**
- Every create route uses `tenant_id = ctx.tenant_id if ctx.tenant_id else None`: sales, hr, accounting and inventory, about 10 routes.
- The seeded `admin` superuser has no tenant, so anything it creates is shared with every tenant.
- Sales' workflow routes and the capability executor already **refuse** a tenantless caller. The plain create routes do not, which is inconsistent within one module.

**D-4 (MEDIUM, confirmed): inconsistent reads.** By-id reads show global rows; tenant lists hide them (§3). A tenant can therefore act on rows it cannot discover. Disclosure of a global row is by design, but the inconsistency is undocumented.

### N2-D — Database and RLS limitations

**D-2 (HIGH, confirmed at the DB layer; not reachable through current application inputs).**
- `WITH CHECK` admits `tenant_id IS NULL`. Any tenant session can therefore:
  - insert a global row;
  - update or delete any global row;
  - claim one (`NULL → A`);
  - **publish its own row to every tenant (`A → NULL`)**.
- With `ON DELETE SET NULL/CASCADE` FKs, deleting a global row would detach or cascade other tenants' references.
- **Reachability:** no route or schema lets a caller write `tenant_id`. No business `*Update`/`*Create` schema has the field; HR/Inventory `setattr` loops iterate only schema fields; Studio's `_copy_fields` copies the loaded row's own `tenant_id`.
- The database is therefore **not** a second line of defence for global rows. Every guarantee is application-only.

| Question | Answer |
|---|---|
| Does RLS hide global rows? | **No**, by policy text, for all 63 tables |
| Where is an explicit tenant filter required? | **Every** read that must exclude globals, every pre-mutation fetch, and every reference check (C-2/CND-1 pattern) |
| Service code that weakens scoping | The shared loader idiom (D-1) and the `ctx.tenant_id or None` create idiom (D-3). **No bypass misuse found:** `bypass_rls` is set only by `system()`/`admin_session()` |
| FK = existence only | All 15 business FKs (§2.1); proven again in §3 |
| Cross-module reference needs a contract | Already the rule (CND-1): product references go through `ProductReferenceContractV1`. The policy below keeps eligibility inside the **owning** module's contract |

**Enforceability:** the intended policy (§6) can be enforced by the database without new privileges or bypasses.
- Business tables would get a strict policy, `bypass OR tenant_id = current`, in USING and WITH CHECK, or `tenant_id NOT NULL`.
- Platform tables keep the current policy, but their write side is gated by platform-admin code paths under the existing `system()` bypass.
- Composite `(id, tenant_id)` FKs (N-3) would make same-tenant references database-enforced.

Nothing here is implemented (§8).

### N2-E — Capability safety

**Current state:** safe by construction.
- The executor requires a tenant (`_resolve_tenant`), so a capability can never create a global row (RC-3).
- Both published capabilities are create-only and have no reference inputs (RC-1 inventory).
- H-1 pins their contracts.

**Gap for future capabilities:** a reference-bearing capability would inherit whichever loader its service uses. Today that admits globals (C-2) or not (CND-1), so the platform would expose two different rules through capability contracts.

**Rule:** a capability input field that carries a record id must have a **declared reference policy** in its owning service:
- `same_tenant`, the default and the only one approvable today;
- or `same_tenant_or_approved_global(<entity>)`, which requires a gate decision recorded like RC-3's approvals.

The policy is a fact of the domain service, not of the capability contract. The contract stays implementation-free (H-1 fingerprints unaffected). **Unknown or unverifiable ownership fails closed**, as CND-1's unavailable contract does (422).

## 5. Defects vs. Intentional Behaviour

| ID | Finding | Classification | Remediation |
|---|---|---|---|
| **D-1** | Tenant can mutate global rows through the app (orders, employees, products; journal entries and Studio by code) | **Security/integrity defect**, HIGH | **Required** (P1) |
| **D-2** | RLS `WITH CHECK` admits NULL tenant: tenant sessions can create, change, delete, claim or publish global rows | **Defence-in-depth defect**, HIGH (not reachable via current inputs) | **Required** (P2) |
| **D-3** | Tenant-less callers implicitly create global business rows (~10 create routes; seeded superadmin) | **Defect**, MEDIUM | **Required** (P1) |
| **D-4** | by-id read shows global rows, list hides them | Inconsistency, MEDIUM | Resolved by P-2 |
| **D-5** | Reference eligibility differs: C-2 allows globals, CND-1 rejects, stock adjust mixes | Inconsistency, MEDIUM. C-2's globals rule is **not** domain-justified | **Required** (P3), behaviour change |
| D-6 | FK existence only (all 15) | Known N-3 | N-3 phase |
| D-7 | Unchecked references `positions.department_id`, `departments.parent_id`, `accounts.parent_id`, `categories.parent_id`, `products.category_id` | Known N-3 | N-3 phase, applying §6 |
| — | `account_types` as a tenant-less shared catalogue | **Intentional, correct** | Keep; it is the model |
| — | Global `auth.roles` (`scope: global`), sentinel `user_roles` | Intentional platform data | Out of business scope; keep, writes platform-admin only |
| — | Capabilities refuse tenantless callers; `tenant_scoped=False` gated | Intentional (RC-3) | Keep |

## 6. Recommended Canonical Policy (for sign-off)

Each rule is labelled for approval: **P-1 to P-7**.

- **P-1. Two kinds of data, two representations.**
  - **Tenant-owned business data:** customers, orders, employees, departments, positions, accounts, journal entries, products, categories, locations, stock, leave, form definitions. Every row has a non-NULL owner tenant.
  - **Platform-owned data:** reference catalogues and platform configuration. It lives in **tenant-less tables** (`account_types` precedent), or for the existing platform tables (`sys_settings`, `feature_flags`, `roles`, workflow definitions, Studio templates) in NULL-tenant rows **whose write path is platform-admin only**.
  - A NULL tenant in a business table is not a supported state.
- **P-2. Read.** A tenant reads its own rows. Global rows are readable only for entity types declared `globally_readable`. The default for business entities is **not readable**. Reads must be consistent: by-id and list use the same predicate (fixes D-4).
- **P-3. Reference (eligibility ≠ visibility).**
  - Every reference field declares a policy in its owning domain service. The default is **`same_tenant`**.
  - `same_tenant_or_approved_global` is allowed only for an entity that P-1 classifies as platform-owned, and only with a recorded gate decision.
  - Cross-module references go through the owning module's public contract (CND-1 pattern).
  - **C-2's global eligibility for customers, departments, positions and accounts is withdrawn.** This aligns them with CND-1's approved product rule.
- **P-4. Create.** Tenant APIs never create a NULL-tenant row. A business create route called without a tenant is **refused (403)**, like Sales' workflow routes and the capability executor already are (fixes D-3).
- **P-5. Update / Delete.** A tenant-scoped caller can never update, delete, claim or publish a global row. Pre-mutation loaders use **strict** ownership (`tenant_id == caller`); they never use the read loader (fixes D-1). Changing `tenant_id` is never permitted through any business path.
- **P-6. Platform administration.** Global or platform data is written only by explicit platform-admin operations, under the existing `TenantContext.system()` bypass, with a platform permission. A missing `tid` claim is **not** a platform-admin credential. Cross-tenant superadmin operation is a separate, explicit concern (§13 Q-3).
- **P-7. Fail closed.** Unknown, unverifiable or undeclared ownership is rejected: 422 for references (C-2/CND-1 convention), 404 for by-id access (tenant-or-mismatch-is-not-found). This applies to capabilities unchanged (§4 N2-E).

### 6.1 Options compared

| Criterion | **A** strict tenant ownership | **B** approved global references | **C** entity-specific policy, strict default (**recommended**) |
|---|---|---|---|
| Tenant isolation | Strongest | Strong if approvals are gated | Same as A for every current entity; exceptions gated |
| Domain correctness | Wrong for `account_types` and roles unless they are restated as exceptions (they already are, via tenant-less tables) | Correct, but per-reference only; says nothing about read/write | Correct: separates read, reference, create, update and delete per entity |
| Current-data compatibility | 0 references to global rows; 75 global test customers become unreachable to tenants | Same | Same |
| Cross-module boundaries | Neutral | Neutral | Eligibility stays in the owning module and its contract |
| DB/RLS enforceability | Strict policy everywhere; platform tables need a different policy anyway | Requires per-entity policy variants | Two policy classes (strict business, platform) |
| Migration complexity | Medium | Medium | Medium. Same work as A plus a declaration mechanism |
| Testability / ops risk | Simple | Approval list to maintain | Declaration + default, tested like RC-3's approval set |

**Why not A alone:** the platform does own data (`account_types`, roles, workflow definitions, templates). A would have to grow C's exception mechanism anyway, so C states it up front.
**Why not B alone:** B only governs references. D-1, D-2 and D-3 are read/write and create defects that B does not address.

## 7. Ownership and Eligibility Rules (implementation contract)

1. Each tenant-owned entity's owning service exposes **two** loaders:
   - `load_owned(id, tenant)`: strict `tenant_id == tenant`, used for every mutation and every reference check;
   - `load_visible(id, tenant)`: `load_owned`, plus global rows **only** if the entity is declared globally readable.
2. A reference check is `load_owned` unless the field's declared policy is `same_tenant_or_approved_global`.
3. A tenantless caller on a tenant-owned entity is refused before any lookup.
4. A cross-module reference uses the owning module's contract, which applies its owner's declared policy. The CND-1 contract already conforms.
5. A declared exception is listed in one reviewable registry per module. Like `UNSCOPED_CAPABILITY_APPROVALS`, it is empty by default and pinned by a test.

## 8. Database / RLS Implications (not implemented)

- **Business tables:**
  - **(a)** a strict policy, `bypass OR (current IS NOT NULL AND tenant_id = current)`, in USING and WITH CHECK; and/or
  - **(b)** `tenant_id NOT NULL` once no NULL rows remain. (b) also removes gate S-2's duplicate-NULL-code issue.
  - Either closes D-2 at the database layer.
- **Platform tables:** they keep `tenant_id IS NULL` visibility, but should split the policy (`FOR SELECT` permissive with NULL; `FOR INSERT/UPDATE/DELETE` without the NULL branch except under bypass), so that tenant sessions cannot write global rows.
- **Composite FKs** `(ref_id, tenant_id) → (id, tenant_id)`: N-3. They require `UNIQUE (id, tenant_id)` on referenced tables and a tenant column on the child-line tables (`sales_order_lines`, `journal_lines`), which today have none.
- `account_types` stays RLS-excluded and tenant-less.
- No privilege broadening or bypass is proposed; the existing single-role FORCE RLS model is kept.

## 9. Compatibility Impact

| Change | Affected | Observable effect |
|---|---|---|
| P-4 refuse tenantless creates | `POST /sales/customers`, `/sales/orders`, `/hr/departments`, `/hr/positions`, `/hr/employees`, `/accounting/accounts`, `/accounting/journal-entries`, `/inventory/*` creates | 403 for a token without `tid`; **the seeded superadmin can no longer create business rows** without a tenant (§13 Q-3) |
| P-3 withdraw C-2 global eligibility | `create_order.customer_id`, `create/update_employee.department_id/position_id`, `create_journal_entry.lines[].account_id` | A global id becomes 422 "not found". The C-2 tests `…follows_the_system_record_convention` (3) invert. Data impact in the test DB: **0 rows** |
| P-2 consistent reads | every `GET …/{id}` on business entities | A global row becomes 404 for tenants (currently 200) |
| P-5 strict pre-mutation loads | cancel/confirm/decide order, post/decide entry, `PATCH employee`, `PATCH product`, Studio update/delete | A global row becomes 404 (currently mutated) |
| P-1/§8 DB policy | 63 RLS tables (business subset) | Raw tenant-session writes of NULL rows are rejected |
| Inventory stock adjust | `POST /inventory/stock/adjust` (dormant) | A global product becomes not-found, consistent with CND-1 |
| Capabilities | none published with references | No change; RC-1/2/3, H-1 and CND-1 unaffected |
| Frontend | none expected | Error statuses only |

## 10. Remediation, by Priority (each phase separately approved)

| Priority | Work | Closes |
|---|---|---|
| **P1** | Strict pre-mutation loaders in sales (cancel/confirm/decide), accounting (post/decide), hr (`update_employee`) and inventory (`update_product`, stock adjust), plus refusing tenantless callers on business create routes | D-1, D-3 |
| **P1 (Workflow domain)** | The same for Workflow Studio `update`/`delete` (`_enforce_tenant`); probe first, it is code-evidenced only | D-1 (Studio) |
| **P2** | DB: strict policy for business tables, and a write-split policy for platform tables (§8), after the §12 data inventory | D-2 |
| **P3** | Withdraw C-2 global eligibility; owner-declared reference policy + loader split (§7); consistent reads | D-4, D-5 |
| **P4** | `tenant_id NOT NULL` on business tables, once the inventory shows zero NULL rows or they are migrated | D-2 structurally; S-2 |
| N-3 (separate) | Composite FKs; the unchecked references (D-7) using `load_owned` | D-6, D-7 |

## 11. Required Regression Tests

- **Invert the 5 strict xfails** in `test_n2_global_row_current_behavior.py` into normal tests. They will XPASS-fail the suite once P1/P2 land, which forces the conversion.
- **Re-express the 6 characterization tests** as policy tests:
  - RLS rejects NULL insert/claim/publish from a tenant session;
  - reads are consistent;
  - tenantless creates get 403.
- **For every entity in §2.2,** on real PostgreSQL with a NULL-tenant row **and** another tenant's row present:
  - read, reference, create, update and delete are each rejected for a tenant caller;
  - nothing is written (row counts under bypass);
  - the enforcing layer is identified by repeating the case with RLS disabled (bypass session) to prove the **application** rejects, and via raw SQL to prove the **database** rejects.
- **HTTP tier** for every live route in §9, with real JWTs including tenantless ones.
- **Keep:** RC-1 (`test_capability_reference_inventory`, `test_rc1_reference_candidates`), RC-2 snapshots, RC-3 (unit 21 + PG 4), C-2 (inverted global cases), CND-1 (unit 14 + PG 10), H-1 (unit 49 + PG 11, fingerprint pins unchanged).
- **Pin** each module's declared-exception registry as empty, the same way as `UNSCOPED_CAPABILITY_APPROVALS`.

## 12. Migration and Rollout Strategy

1. **Inventory first** (read-only, per database), for every business table:
   - `count(*)` and `count(*) FILTER (WHERE tenant_id IS NULL)`;
   - references **to** NULL-tenant rows and **across** tenants (the §2.3 queries);
   - duplicate NULL-tenant codes;
   - NULL-tenant users holding business write permissions.
2. **Classify every NULL-tenant business row:**
   - test residue: delete in non-production only, with approval;
   - tenant-less admin artefact: assign an owner tenant with explicit owner sign-off per row set;
   - genuine shared reference data: move to a tenant-less catalogue table (`account_types` pattern).
   - No automatic reassignment.
3. **Application first (P1/P3), then database (P2/P4):** the app's stricter rules are reversible and observable before the DB enforces them.
4. **Release order:** P1 behind the existing routes (status-code changes only) → P3 → P2 per schema, with the fresh-database migration test pattern (upgrade/downgrade/upgrade) → P4.
5. **Untouched:** H-1's 269 unpinned form versions in `erp_platform`. `form_platform` is already `tenant_id NOT NULL` and outside N-2.

## 13. Open Questions (not resolvable from current evidence)

- **Q-1.** What is the ownership distribution in any non-test database (Docker `erp_postgres`, staging, production)? Not inspected; the daemon was not running. **Blocking for P2/P4 and for the C-2 reversal.**
- **Q-2.** Are there real shared business records today (for example a shared "cash customer", a standard chart of accounts template)? If so, the §12 classification decides between a tenant-less catalogue and per-tenant copies.
- **Q-3.** What is the platform-admin model? Today the superadmin is tenant-less and acts as an implicit global writer. P-4/P-6 require either a tenant-selecting admin flow or explicit platform-admin endpoints. Product decision.
- **Q-4.** Workflow Studio's 596 global workspaces and 592 global drafts, and 693 global `wf_definitions`: platform templates or tenant-less test artefacts? This needs a Workflow-domain decision before its P1 item.
- **Q-5.** Should `globally_readable` exist for any business entity at all? This decision recommends **no**, pending Q-2.

## 14. Test Commands and Results (2026-10-12, `backend/`, `.venv/bin/pytest -p no:cacheprovider -q`)

| Command | Result |
|---|---|
| `tests/integration/workflow_postgres/test_n2_global_row_current_behavior.py -rxXfE` | **6 passed, 5 xfailed** (strict) |
| same with `--runxfail` | 5 failed, each on the defect assertion (§3), 6 passed |
| `test_n2_…` + `test_c2_…` + `test_cnd1_product_reference` + `test_rc1_reference_candidates` + `test_capability_tenant_scoping` + `test_p30g_rls_activation` + `test_h1_contract_version_integrity`, **one invocation** | **85 passed, 5 xfailed** |

**HTTP-tier residue:** asserted zero after each test.

**Read-only DB queries:** shown in §2.

**NOT RUN:**
- the unit suite (no unit-tier file changed);
- the remaining `workflow_postgres` files;
- the SQLite tier;
- Vitest and Playwright.

## 15. Confirmations

- No production code, schema, migration, foreign key, RLS policy, RBAC, capability contract or existing data was changed.
- The H-1 unpinned form versions were neither repaired nor touched.
- Inventory was not activated, no capability was published, and N-3 was not started.
- **No commit, no push**, no Git remote change.
