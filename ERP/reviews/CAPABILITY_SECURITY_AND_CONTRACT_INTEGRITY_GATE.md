# Capability Security & Contract Integrity — Architecture Gate

**Date:** 2026-10-08
**Type:** AUDIT ONLY. No production, frontend, schema, RLS, seed or test change was made.
**Scope:**
- the two proven capabilities, `leave_management.leave_request.create:v1` and `sales.customer.create:v1`;
- the open findings N-2 (tenant-less/global rows), N-3 (cross-tenant references) and H-1 (contract/version integrity).

**Inputs:**
- `CAPABILITY_PLATFORM.md`, `FORM_BUILDER_PLATFORM.md`, `FORM_DEFINITION_PLATFORM.md`;
- the reviews `FORM_CAPABILITY_FOUNDATION_{AUDIT,READINESS}`, `FORM_BUILDER_PREREQUISITES_READINESS`, `FORM_BUILDER_PHASE_3{A,B}_READINESS`, `FORM_BUILDER_PHASE_3C_ARCHITECTURE_GATE`, `CAPABILITY_EXPANSION_ARCHITECTURE_GATE`, `SALES_CUSTOMER_CAPABILITY_READINESS`;
- the implementation itself. Where a document and the code disagree, the code was taken as the truth.

**Provenance:** Commit: NONE · Push: NONE

---

## 1. Executive Summary

The two published capabilities are **safe within their current scope**:

- tenant identity comes only from the executor;
- both handlers are insert-only (they read no existing row);
- neither input contract carries a foreign-record reference;
- `sales.customer.create:v1` has a full contract pin.

No P0/P1 issue was proven for capability execution. The capability foundation and the Form Builder boundary remain sound.

The platform underneath is **not yet safe for general expansion**. Three facts, established in this audit, change the risk for the *next* capabilities:

1. **N-2 is broader than "the HTTP route can create global customers".** On all 63 RLS-protected tables the policy is `USING / WITH CHECK (tenant_id IS NULL OR … OR tenant_id = current_tenant)`. At the database layer, a NULL-tenant row is **readable and writable from every tenant session**, and any session may insert one. The capability executor's tenant refusal does not change this. It only means the current capabilities never *create* such rows.
2. **N-3 is systemic.** Every foreign key in the business schemas (Sales, HR, Accounting, Inventory, Leave) references `id` alone, and none is composite with `tenant_id`. PostgreSQL referential-integrity checks are not subject to RLS, so the database does not guarantee `referenced.tenant_id == caller.tenant_id`. Three of the four likely next candidates (sales order, HR employee, journal entry) store caller-supplied reference ids without any tenant-scoped lookup. Exploitation was **not executed** (it requires writes); the conclusion comes from code and schema.
3. **H-1 is real, and permission is part of it.** In-memory probes on a private registry instance (§5.3) showed four things:
   - the registry silently accepts a re-registration of the same `(id, version)` with a different input contract **and a weaker permission**;
   - Form Versions pin only `(id, version)`, not the contract or the permission;
   - a published form whose contract lost a presented field fails with an unhandled `KeyError`, which becomes an HTTP 500;
   - the runtime applies whatever permission the *current* descriptor declares.

   The only mechanical guard is the per-capability pin test: full for Sales (E-3), partial for Leave.

```text
FINAL DECISION: GO-WITH-CONDITIONS
```

The current two capabilities may stay in service. Three conditions (RC-1, RC-2, RC-3; §11) must be met **before any further capability is published**. They are scoped rules and tests per new capability, not platform rewrites.

---

## 2. Current Capability Inventory

The inventory comes from code: `grep CapabilityDescriptor( / capability_registry.register(` over `app/` and `external_modules/` finds exactly two descriptors.

| Property | `leave_management.leave_request.create:v1` | `sales.customer.create:v1` |
|---|---|---|
| Owner module | `leave_management` (external module) | `sales` |
| Descriptor | `external_modules/leave_management/capabilities.py:35` | `app/modules/sales/capabilities.py:39` |
| Status | `active` (default) | `active` (default) |
| Permission | `leave_management.requests.write` | `sales.customers.write` |
| Input contract | `LeaveRequestCreate` (`leave_type`, `start_date`, `end_date`, `reason`) | `CustomerCreate` (8 flat fields) |
| Output contract | `LeaveRequestOut` | `CustomerOut` |
| Foreign references in input | none: `leave_type` is a validated enum string; the requester comes from `ctx.caller` | none |
| Registry registration | `register_capabilities()` from `setup()` | `register_capabilities()` from `setup()` |
| Lifecycle withdrawal | `on_deactivate` → `unregister_module` | `on_deactivate` → `unregister_module` (E-2) |
| Executor path | `execute_capability` → resolve → status → `has_permission` → `_resolve_tenant` → `model_validate` → `async_tenant_context` + `get_session` → handler → commit | same |
| Application service | `LeaveRequestService.create_request` (insert-only) | `SalesService.create_customer` (insert-only; E-1 conflict translation) |
| Tenant behaviour | `tenant_scoped=True`; tenant from `caller.tenant_id`; refused when missing, malformed, under bypass, or mismatching the ambient tenant | same |
| Authorization | existing RBAC (`UserContext.has_permission`), same code as the HTTP route | same |
| Builder/Runtime discovery | `GET /api/v1/capabilities` (gated by `core.forms.design`); runtime resolves the exact version | same |
| Contract pin | **partial**: `test_capability_registry.py::test_leave_management_create_capability_contract` asserts id, version, permission, contract names, `required`, the `start_date` format and the absence of `tenant_id`. **No full schema or output pin.** | **full**: `describe()` equals the committed fixture `capability_contracts/sales.customer.create.v1.json` |

**Genericity (checked 2026-10-08):**
- No business identifier (`sales`, `customer`, `leave_management`, `leave_request`) appears in the production code of `app/core/capabilities/`, `app/core/form_platform/`, `frontend/shell/src/features/form_builder/` or `frontend/shell/src/features/form_runtime/`. They appear only in tests and fixtures.
- This is AST-guarded by:
  - `test_capability_architecture.py::test_capability_package_never_imports_a_business_module_or_framework`;
  - `test_form_platform_architecture.py::test_runtime_and_service_are_generic_no_business_names`;
  - the 3A/3B `architecture.test.ts` guards.

---

## 3. N-2 — Tenant-less / Global Row Audit

### 3.1 Database facts

These were read-only queries inside a `READ ONLY` transaction, run as the application role `erp_user` (not superuser, no BYPASSRLS, owner of all tables) on the dev database (Homebrew PostgreSQL 14.20), 2026-10-08.

| Question | Answer |
|---|---|
| Tables with a `tenant_id` column | 132, including partition children |
| `tenant_id` nullable | **every one of them except** `auth.branches`, `auth.organizations`, `auth.user_roles`, `form_platform.form_definitions` and `form_platform.form_versions` (NOT NULL) |
| RLS-enabled + FORCED | 63 tables, one `tenant_isolation` policy each (`ALL`, `PERMISSIVE`, role `public`) |
| Policy expression (all 63; 57 uuid-typed, 6 text-typed) | `USING` **and** `WITH CHECK`: `(tenant_id IS NULL) OR (current_setting('app.bypass_rls') = 'true') OR (current_tenant IS NOT NULL AND tenant_id = current_tenant)` |
| NULL interpreted as global | **Yes**, at three layers: the RLS policy above; ORM `TenantFilter` (`app/core/database/query_filters.py:140`, `tenant_id = ctx OR tenant_id IS NULL`); and the documented "system record" convention (`SalesService.get_customer` docstring) |
| Partition children (`audit.*_YYYY_MM`, `eventbus.*_YYYY_MM`, `*_default`) | RLS **not** enabled on the children. Access through the parent applies the parent's policy; direct access to a child does not. Not reachable by any capability. |
| Existing NULL-tenant rows visible with **no** tenant set | `sales.customers` **69**, `auth.users` 3,966, `auth.roles` 3; 0 in `sales_orders`, `hr.*`, `inventory.*`, `accounting.*`, `leave_requests` |
| Duplicate NULL-tenant customer codes present today | none (`GROUP BY code HAVING count(*) > 1` → `[]`) |
| `sales.customers` unique keys | `customers_pkey (id)`, `customers_code_tenant_id_key UNIQUE (code, tenant_id)`. No `NULLS NOT DISTINCT` (it needs PostgreSQL ≥ 15; this server is 14). |

### 3.2 Security consequence

- **NULL-tenant rows are cross-tenant by construction at the database layer.**
  - Any tenant session can SELECT them, and also UPDATE or DELETE them (both are governed by the same `USING` clause).
  - The `WITH CHECK` clause allows any session to INSERT a row with `tenant_id NULL`, or to UPDATE a row's tenant to NULL.
  - Whether a given HTTP path does any of this depends only on application code.
- **`UNIQUE(code, tenant_id)` with `tenant_id = NULL`:** under PostgreSQL 14 semantics, NULLs are distinct in a unique index. Any number of tenant-less customers with the **same code** can therefore coexist, and E-1's conflict translation never fires for them. This is established from documented PostgreSQL semantics and the absence of `NULLS NOT DISTINCT`. It was **not executed**: proving it would need a write.
- **Application-layer asymmetry (Sales):**
  - `list_customers` with a tenant filters `tenant_id == caller` and excludes global rows;
  - `get_customer` returns a NULL-tenant row to **any** tenant (`service.py:167`, by design);
  - tenant-less HTTP callers (a valid JWT without a `tid` claim) create global rows (`api.py:137`, `tenant_id = ctx.tenant_id if ctx.tenant_id else None`);
  - there is no customer update/delete route, so no HTTP path modifies a global customer today.

### 3.3 Capability reachability

| Question | Answer | Evidence |
|---|---|---|
| Executor refuses tenant-less callers | **Yes**, for `tenant_scoped=True` (both capabilities) | `executor.py::_resolve_tenant`; unit `test_missing_or_malformed_tenant_context_is_refused`; PG `test_missing_tenant_context_is_refused` |
| Executor refuses execution under an RLS bypass | **Yes** | unit `test_execution_under_a_tenant_bypass_is_refused` |
| Caller-supplied `tenant_id` ignored | **Yes.** It is structurally impossible: descriptors refuse input contracts that declare `tenant_id` (`contract.py::_FORBIDDEN_INPUT_FIELDS`), and Pydantic drops extra keys. | unit `test_descriptor_rejects_input_contract_that_carries_tenant_id`, `test_tenant_id_injected_in_payload_is_never_trusted`; PG `test_tenant_id_injected_into_the_payload_is_ignored` (both capabilities) |
| `sales.customer.create:v1` can create a tenant-less customer | **No**, through any capability path, including the Form Runtime (it calls the executor). **Yes**, through the HTTP route `POST /sales/customers` for a tenant-less caller holding `sales.customers.write`. This is N-2, unchanged. | above; `api.py:137` |
| Capability execution can reach existing NULL-tenant rows | **Not today**: both handlers are insert-only. **Yes, for any future read/update capability**, because under the executor's tenant context RLS still exposes NULL-tenant rows, unless the domain lookup uses strict tenant equality. | `LeaveRequestService.create_request`, `SalesService.create_customer` (no reads); the policy expression |
| `tenant_scoped=False` | Allowed by the platform (`contract.py:90`). The executor then runs with **no** tenant context, where RLS shows only NULL-tenant rows and `WITH CHECK` accepts NULL-tenant writes, so such a capability would create global rows. No capability declares it, no test covers it, and `CAPABILITY_PLATFORM.md` gives it one line. | code read |

**Distinction kept explicit:** "the capability rejects tenant-less callers" (true) does **not** mean "the ERP has no tenant-less/global-row risk" (false: §3.2).

**Classification:**
- N-2 for the current capabilities: **NON-BLOCKING**.
- N-2 for the platform: **FUTURE HARDENING** (cross-module).
- N-2's consequence for future read/update and non-tenant-scoped capabilities: **REQUIRED BEFORE NEXT EXPANSION** (RC-3).

---

## 4. N-3 — Cross-Tenant Reference Audit

### 4.1 The current capabilities

- `CustomerCreate` = `code, name, email, phone, address, contact_person, credit_limit, notes`. All fields are scalar: no id or reference to any user, department, warehouse, customer group, price list, account or tax configuration. The pinned fixture asserts the exact field list.
- `LeaveRequestCreate` = `leave_type` (enum string), `start_date`, `end_date`, `reason`. The requester comes from the caller.

**Conclusion confirmed: neither capability carries a cross-tenant reference.**

### 4.2 Database structure (read-only, 2026-10-08)

There are 15 foreign keys across `sales`, `hr`, `accounting`, `inventory` and `leave_management`. **All reference `<table>(id)` only; composite `(…, tenant_id)` FKs = 0.** `sales.sales_order_lines.product_id` has **no FK at all**.

PostgreSQL referential-integrity checks are not subject to row-level security, so an FK proves only that the referenced row *exists*. It does not prove that the row belongs to the caller's tenant. **The database does not guarantee `referenced.tenant_id == caller.tenant_id`.**

### 4.3 Likely next candidates

| Candidate | Reference fields | Service behaviour | Classification |
|---|---|---|---|
| HR employee create | `department_id`, `position_id` | `HRService.create_employee` stores both as given, with no lookup | **theoretically unsafe unchecked reference.** The FK accepts another tenant's id. |
| Sales order create | `customer_id`; `lines[].product_id` | `SalesService.create_order` stores both as given, with no lookup. `product_id` has no FK at all. | **theoretically unsafe unchecked reference** |
| Journal entry create | `lines[].account_id` | `AccountingService.create_journal_entry` stores as given, with no lookup | **theoretically unsafe unchecked reference** |
| Stock adjustment | `product_id`, `location_id` | `InventoryService.adjust_stock` resolves both through tenant-checked lookups (`get_product(…, tenant_id)`, `list_locations(…, tenant_id)`) and rejects unknown ids; this was fixed in an earlier phase | **safe because the application service verifies the tenant** (global rows remain eligible by convention) |

Other unchecked references were seen in passing: `DepartmentCreate.parent_id`, `PositionCreate.department_id`, `ProductCreate.category_id`, `AccountCreate.account_type_id` and `parent_id`. None was examined in depth.

**Proven exploitable cross-tenant path:**
- **none proven.** Proving one requires writes, and this audit is read-only. The existing tests cover cross-tenant **read** isolation (`test_p30g_rls_activation.py::test_http_end_to_end_*_cross_tenant_denied`), not reference integrity on create.
- Data note: a *global* (NULL-tenant) referenced row is legitimately referenceable by every tenant under the current convention, which is another reason N-2 and N-3 must be designed together.

**Missing enforcement boundary:**
- The **domain/application service layer** of HR, Sales orders and Accounting: the reference is never resolved under the caller's tenant before the insert.
- Below that, the schema: no composite `(id, tenant_id)` FKs.

**Classification:**
- N-3 for the current capabilities: **NON-BLOCKING** (not applicable).
- N-3 for any capability whose input carries a tenant-owned reference: **REQUIRED BEFORE NEXT EXPANSION** (RC-1).
- Platform-level guarantees (composite FKs, a shared tenant-scoped reference resolver): **FUTURE HARDENING**.

---

## 5. H-1 — Capability Contract Integrity Audit

### 5.1 What exists

| Mechanism | Enforced how | Location |
|---|---|---|
| Id grammar, module namespace, integer version ≥ 1, no `tenant_id` input, permission inside the module namespace | **mechanically**, at descriptor construction or registration | `contract.py::__post_init__`, `registry.py::register` |
| Only the owning module can register its ids | **mechanically** | `registry.py::register` |
| Form Versions bind to an exact `(capability_id, capability_version)`; no default/latest resolution | **mechanically** | `service.py::_bind`, `runtime.py:64,102` |
| Presentation is valid against the bound contract | **mechanically on save, submit and publish only** | `service.py:331,353` (`validate_against_contract`) |
| "A breaking change needs a new version" | **policy only** | `CAPABILITY_PLATFORM.md` §versioning |
| `sales.customer.create:v1` contract unchanged | **CI test** (full `describe()` equality) | `test_sales_customer_capability.py::test_v1_public_contract_matches_the_pinned_fixture` |
| `leave_management.leave_request.create:v1` contract unchanged | **CI test, partial** (essentials only) | `test_capability_registry.py::test_leave_management_create_capability_contract` |

### 5.2 Compatibility questions

| Dimension | Can `v1` change incompatibly without a version bump? |
|---|---|
| **A. Input**: remove a field, change a type, optional↔required, change meaning | **Sales:** nothing prevents it at runtime; the pin test fails in CI. **Leave:** the pin catches a change to `required` or the `start_date` format, but **not** an added optional field, a removed `reason`/`leave_type`, or a type change of `reason`/`leave_type`. **Semantic meaning:** untestable by schema, policy only, for both. |
| **B. Output** | **Sales:** pin test (full output schema). **Leave:** only the contract *name* is asserted; the output schema is unprotected. |
| **C. Permission** | **Sales and Leave:** both pin tests assert the permission string. At runtime, nothing stops it: `_authorized_capability` and the executor use the *current* descriptor's permission, and the Form Version does not store it. A weakened permission applies silently to every published form. |
| **D. Metadata** (field titles, `maxLength`, enum, default, which the Builder relies on) | **Sales:** pinned. **Leave:** unpinned. Published forms take the current metadata on every render. |
| **E. Registry**: same `id:v1`, different behaviour after deploy | **Yes.** `register()` replaces an existing key without comparing descriptors (`registry.py`: "replaced"), within a process (re-activation) and across deployments. Handler behaviour (business semantics) is never versioned mechanically. |

### 5.3 In-memory probe (2026-10-08)

**Method:** a private `CapabilityRegistry()` instance and the pure functions in `app/core/form_platform/presentation.py`. No database, no process-global state, and no file added to the repository. The script lived in the session scratchpad only.

This was justified as the minimum needed to turn the gate's H-1 *hypothesis* ("same-version drift → 500") into evidence without writing tests or touching the database.

```text
A. same key re-registered with different input+permission accepted: True
   | permission now: sales.customers.read | fields: ['code', 'name', 'notes']
B. presentation valid against ORIGINAL v1 at publish: ok
C. save/publish validation vs drifted v1 rejects: FormDefinitionInvalidError
D. runtime render (published form, no re-validation) vs drifted v1 raises: KeyError 'email'
E. surviving fields render with drifted kinds: {'code': 'text', 'name': 'text', 'notes': 'number'}
```

`KeyError` is not in the runtime API's handled-error tuple (`app/api/v1/form_platform.py::_HANDLED`), so a drifted published form becomes an **HTTP 500**.

Execution still **fails closed** in this case: render fails before submit, and submit re-validates against the current contract. But a published form cannot detect that its capability changed underneath it.

**Assessment:**
- For two capabilities, each with a pin test (one full, one partial), owned by one team, and with no transport/promotion, the control is **adequate for the current scope**.
- It is **not** a defensible compatibility model for more capabilities. Integrity depends on each capability having a full pin test and on CI running it.
- Full JSON equality, as the Sales pin uses, deliberately rejects even compatible additions. That is acceptable per capability (the fixture is updated deliberately) and is **not** proposed as a platform rule.

**Classification:**
- A full pin for every published capability, including Leave: **REQUIRED BEFORE NEXT EXPANSION** (RC-2).
- Platform compatibility model: **FUTURE HARDENING**. It covers registry same-key equality checks, a publish-time contract fingerprint stored on the Form Version, runtime drift → typed 409/422 instead of 500, and transport validation.

---

## 6. Form Definition Interaction

```text
Form Version (capability_id, capability_version: NOT NULL columns, models.py:95-96)
  → registry.resolve(id, version)   explicit version only: no default/latest path is used by Form Platform
  → _authorized_capability          the current descriptor's permission (H-1 §5.2 C)
  → execute_capability(..., version=v.capability_version)
```

| Property | Result | Evidence |
|---|---|---|
| Exact pin, never upgraded | ✅ `_bind` and `runtime` always pass the stored version. Changing the version is an explicit designer edit on a **draft** only. `copy_from` copies the source pin unchanged. | PG `test_form_platform.py::test_form_versions_stay_pinned_to_their_exact_capability_version` |
| Withdrawn capability fails closed | ✅ `CapabilityNotFoundError` → 404 on GET and POST; no execution | PG `test_published_form_fails_closed_when_its_capability_is_withdrawn`, `test_capability_sales_customer.py::test_published_customer_form_fails_closed_while_sales_is_deactivated`; E2E SC3 (2026-10-07) |
| Disabled capability | ✅ never executable (executor) and cannot be bound or published | unit `test_disabled_version_is_never_executable`; `service.py::_bind` |
| No silent fallback or version substitution | ✅ `resolve(id, version)` with an explicit version raises when it is absent. The default "highest active" branch is unreachable from Form Platform. | `registry.py::resolve`; unit `test_unknown_capability_and_unknown_version_raise_not_found`, `test_version_resolution_is_deterministic` |
| Unauthorized execution | ✅ permission is checked in the runtime **and** the executor | PG and E2E SC2 (manager → 403) |
| **Gap** | Same-version contract drift is not detected (§5.3 D/E) | H-1 |

---

## 7. Form Builder Boundary Assessment

None of the findings moves responsibility into the Builder, and the Builder takes none on:

- **Tenant:** never chosen or shown; the server scopes everything (`FormBuilderList.tsx:11`). No tenant logic exists in `form_builder` or `form_runtime` (grep, 2026-10-08).
- **References:** the Builder renders contract fields only; it has no reference picker (a 3C non-goal) and performs no cross-tenant validation.
- **Version compatibility:** the Builder never upgrades or compares versions. The server owns binding (`_bind`) and re-validates on save, submit and publish.
- **Contracts and authorization:** the Builder reads `GET /capabilities` (read-only metadata) and cannot modify a contract. Runtime use is authorized server-side by the capability permission.
- **Database metadata:** the Builder's field facts come from the capability's JSON Schema (`contract_fields`), not from database or ORM metadata. `metadata_engine` stays untouched (AST guard `test_form_platform_never_touches_metadata_engine_workflow_flow_modules_or_framework`).

**The fixes for RC-1, RC-2 and RC-3 belong in the domain services, capability tests and platform, never in the Builder.**

---

## 8. Workflow Boundary Assessment

- No `app.core.workflow` or `app.core.application_flow` import exists in `app/core/capabilities/`, `app/core/form_platform/` or either capability file (grep, 2026-10-08).
- This is AST-guarded by:
  - `test_capability_architecture.py::test_capability_package_imports_only_the_approved_platform_primitives`, `test_owning_module_depends_on_the_platform_never_the_reverse`;
  - `test_sales_customer_capability.py::test_capability_has_no_orm_sql_or_workflow_dependency`;
  - `test_form_platform_architecture.py::test_form_platform_never_touches_metadata_engine_workflow_flow_modules_or_framework`.
- The intended direction, `Workflow / Flow Action → Capability Executor → Business Capability`, is preserved and **not** implemented.
- Note for that future bridge: it will execute capabilities in-process. RC-1, RC-2 and RC-3 therefore apply to it equally, and R-13 (in-process audit gap) remains open.

---

## 9. Security / Test Evidence (2026-10-08, this audit)

| Command | Result |
|---|---|
| `pytest -p no:cacheprovider tests/unit/test_capability_{architecture,registry,executor,discovery}.py test_sales_customer_capability.py test_form_platform_architecture.py test_form_presentation.py test_form_rule_parity.py test_form_builder_contract_parity.py test_form_lifecycle_contract.py test_leave_management_architecture.py test_sales_workflow_architecture.py` | **135 passed** |
| `pytest -p no:cacheprovider tests/integration/workflow_postgres/test_capability_leave_management.py test_capability_sales_customer.py test_capability_discovery.py test_form_platform.py test_p30g_rls_activation.py test_sales_module_production_activation.py` (real PostgreSQL) | **64 passed** |
| Read-only SQL (`READ ONLY` transaction): tenant columns, RLS flags, policies, FKs, unique indexes, NULL-tenant counts | §3.1, §4.2 |
| In-memory H-1 probe (scratchpad, private registry) | §5.3 |

**Not run in this audit:**
- the full backend suites;
- Vitest;
- Playwright (the latest browser evidence is 13/13 Form E2E on 2026-10-07, recorded in `SALES_CUSTOMER_CAPABILITY_READINESS.md`).

**Evidence gaps (recorded, not filled):**
- no test proves duplicate NULL-tenant codes coexist (N-2);
- no test covers cross-tenant reference rejection on any create path (N-3);
- no test covers drift of a published form → its HTTP status (H-1);
- no test covers `tenant_scoped=False` execution semantics.

---

## 10. Findings Classification

| ID | Finding | Status | Classification |
|---|---|---|---|
| **S-1** (N-2) | RLS treats NULL-tenant rows as global: readable and writable from every tenant session; any session may insert them | established (policy text) | FUTURE HARDENING (cross-module) |
| **S-2** (N-2) | Tenant-less HTTP `POST /sales/customers` creates global customers; `UNIQUE(code, tenant_id)` allows duplicate NULL-tenant codes on PG 14; `get_customer` exposes them to all tenants | established (code and documented PG semantics); duplicates not executed | FUTURE HARDENING, non-blocking for the capability (which refuses tenant-less callers) |
| **S-3** (N-2) | Future read/update capabilities would see NULL-tenant rows under RLS; `tenant_scoped=False` would create global rows; neither is gated or tested | established (code) | **REQUIRED BEFORE NEXT EXPANSION** → RC-3 |
| **S-4** (N-3) | No composite tenant FKs; RI checks bypass RLS; HR employee, Sales order and Journal entry create store unchecked references (`order_lines.product_id` has no FK) | theoretically unsafe; **not proven exploitable** | **REQUIRED BEFORE NEXT EXPANSION** (for any reference-bearing capability) → RC-1; platform fix = FUTURE HARDENING |
| **S-5** (H-1) | The registry replaces the same `(id, version)` silently; Form Versions do not pin contract or permission; drift → 500 on render; the current permission applies to published forms | proven in-memory (§5.3), not over HTTP | Current scope: NON-BLOCKING. Leave full pin: **REQUIRED BEFORE NEXT EXPANSION** → RC-2. Platform model: FUTURE HARDENING <br>**Superseded 2026-10-12: CLOSED by H-1 (§15).** |
| S-6 | Partition children of audit/eventbus/notification tables have no RLS of their own | established | NON-BLOCKING DEBT (not capability-reachable) |
| — | Capability foundation and generic Builder/Runtime | verified | SOUND |

**No P0/P1 finding is proven against capability execution.** No current capability allows a cross-tenant mutation, and version pinning cannot be bypassed in a way that executes a published form against a different version.

---

## 11. Required Conditions (before publishing any further capability)

These are scoped, per-capability rules. They do not change the two existing capabilities' behaviour (RC-2 adds a test only).

- **RC-1: tenant-owned references (N-3).** A capability whose input carries an id of a tenant-owned record must:
  - resolve that id in its **domain service** with a strict tenant-scoped lookup before writing, and reject it as a typed business error when absent;
  - decide and document whether global (NULL-tenant) records are eligible;
  - have a real-PostgreSQL test proving that another tenant's id is rejected and nothing is written.

  The executor and the Builder are not the place for this check.
- **RC-2: full contract pin for every published capability (H-1).**
  - Leave gets a full `describe()` fixture pin, like Sales (E-3).
  - Every new capability ships with one.
  - The pin includes the permission.
  - A pin change requires a recorded compatible/breaking decision (breaking → new version).
- **RC-3: tenant-scoping rules (N-2).**
  - No capability may declare `tenant_scoped=False` without its own gate decision on global-row semantics.
  - A capability that reads or updates existing rows must use strict `tenant_id == ctx.tenant_id` lookups (or an explicit, documented global-row rule) and must not rely on RLS alone, because RLS exposes NULL-tenant rows.
  - Such a capability needs a PG test with a NULL-tenant row present.

## 12. Deferred Hardening

- **N-2 platform:**
  - decide the global-row model: tighten the `WITH CHECK` side, or make `tenant_id` NOT NULL on business tables with explicit global tables, and revisit `get_customer`'s global visibility;
  - tenant-less HTTP writes;
  - PG 15+ `NULLS NOT DISTINCT`, or an equivalent, for global codes;
  - RLS on partition children (S-6).
- **N-3 platform:** composite `(id, tenant_id)` FKs or a shared tenant-scoped reference resolver; the missing FK on `sales_order_lines.product_id`; the unchecked `parent_id` / `category_id` / `account_type_id` references.
- **H-1 platform:**
  - the registry refuses a same-key re-registration with a different contract or permission;
  - a contract fingerprint stored on the Form Version at publish, checked at runtime;
  - drift becomes a typed 409/422 instead of 500;
  - transport/promotion validation.
- **Carried forward, unchanged and not material to this gate:**
  - C-3A-1/2/3, P3B-1, G-3B-1;
  - the Workflow Studio full-suite flakiness;
  - the FastAPI 0.115.6 route cleanup limitation (deactivated modules keep HTTP routes; capabilities are still withdrawn);
  - legacy `metadata_engine` debt;
  - R-13 (in-process audit gap).

## 13. Final Decision

```text
GO-WITH-CONDITIONS
```

**Why not GO:**
- H-1 is controlled only by per-capability tests, and Leave's pin is partial.
- N-3 is systemic in exactly the modules that hold the next candidates.
- N-2's global-row semantics would silently affect any read/update or non-tenant-scoped capability.

The current two-capability scope is safe, but expanding without RC-1/2/3 would carry these risks forward unexamined.

**Why not BLOCKED:**
- no tenant-isolation vulnerability or cross-tenant mutation is proven in capability execution;
- both capabilities are insert-only, reference-free and tenant-bound;
- version pinning holds: a drifted published form fails with a 500 and never executes against another version;
- the foundation and the Builder/Workflow boundaries verified sound.

## 14. Recommended Next Phase

```text
CAPABILITY EXPANSION HARDENING — RC-1/RC-2/RC-3 baseline
```

1. **RC-2 now** (small, test-only): add a full contract pin for `leave_management.leave_request.create:v1`.
2. Record RC-1 and RC-3 as mandatory acceptance criteria in `CAPABILITY_PLATFORM.md`.
3. Only then, select the next capability. A reference-free candidate keeps RC-1 out of scope. If a reference-bearing candidate is chosen (for example `sales.order.create`), its phase must implement RC-1 in `SalesService` and prove it on real PostgreSQL.

The platform-level N-2, N-3 and H-1 hardening stays a separate cross-module phase. It is not a prerequisite for the next single capability.

---

## 15. Addendum: H-1 closure (2026-10-12)

**Source:** `CAPABILITY_CONTRACT_VERSION_INTEGRITY_H1_READINESS.md` (decision **GO**). The findings above are preserved as the historical record. Only the status of S-5 and of the "H-1 platform" deferrals changes.

| Item | Status | Evidence |
|---|---|---|
| §5.2 E / S-5: registry replaces the same `(id, version)` | **CLOSED.** An equivalent re-registration is a no-op; anything else raises `CapabilityConflictError`; the owner is recorded and enforced; platform cleanup removes a module's capabilities | unit `test_capability_version_integrity.py`; mutations M1-M4 |
| §5.2 C / S-5: Form Versions pin neither contract nor permission | **CLOSED.** `form_versions.capability_contract_fingerprint` (migration `d4e5f6a7b8c9`, approved schema change) pins the canonical public contract, including the permission. It is immutable after draft (service + trigger) | PG `test_h1_contract_version_integrity.py` |
| §5.3 D: drift → `KeyError` → HTTP 500 on render | **CLOSED.** Drift, a missing pin and a malformed pin give **409** before render or handler; a missing capability stays 404 | PG `…drifted_contract_before_the_handler[input-field-removed]` |
| §12 "H-1 platform": transport/promotion validation | **OPEN, not applicable.** No form transport exists | readiness §10 R-7 |
| §9 evidence gap "no test covers drift of a published form → its HTTP status" | **FILLED** | PG, 4 drift cases |

**Effect on this gate's decision:** §13 stays **GO-WITH-CONDITIONS**, because N-2 and N-3 platform items remain. The "Why not GO" bullet "H-1 is controlled only by per-capability tests, and Leave's pin is partial" no longer applies:
- RC-2 made Leave's pin full on 2026-10-09;
- H-1 adds the platform enforcement.

**New pre-publication conditions:** readiness §12. A new capability's fingerprint is pinned with its fixture, and its form-pin behaviour is tested on PostgreSQL. Pre-H-1 published forms must be re-published before the migration reaches a shared database.

