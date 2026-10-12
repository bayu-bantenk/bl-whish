# N-2A — Read-Only Global Data Inventory

**Date:** 2026-10-12
**Type:** READ-ONLY INVENTORY. No database, schema, configuration, source-code or data change was made.
**Inputs:**
- `N2_GLOBAL_ROW_POLICY_DECISION.md`;
- `CAPABILITY_SECURITY_AND_CONTRACT_INTEGRITY_GATE.md`;
- the RC-1, C-2, CND-1 and H-1 readiness reports;
- the current code and database catalog.

**Provenance:** Commit: NONE · Push: NONE

```text
N-2A INVENTORY: INCOMPLETE — NO AUTHORIZED NON-TEST DATABASE AVAILABLE
  Real (non-test) database inspected: NO. None is configured; the only other candidate
  (Docker erp_postgres, persistent volume) is not running and was NOT started.
  Inspected instead: the local TEST database erp_platform, read-only, as the app role, without
  any RLS bypass. Only global (tenant_id IS NULL) rows and non-RLS tables are measurable;
  per-tenant distributions and cross-tenant references are NOT MEASURED.
  Findings on test data are NOT ownership evidence for any real deployment.
  N-2 implementation readiness: NOT ESTABLISHED for data-dependent steps.
```

---

## 1. Executive Summary

- **No real data was inspected.** The repository configures exactly one database target, the local `erp_platform`. It is the project's own test database (§2).
- **Global rows in the test DB are test artefacts, traced to source code:**
  - 591 of the 596 global Workflow Studio workspaces and 587 of the 592 global drafts were created by the Playwright fixture `seedWorkspaceAndDraft`, logged in as the seeded tenant-less `admin`. The name grammar matches 591/591, and the timestamp embedded in each name agrees with `created_at` within 120 s for 591/591;
  - all 5,510 global users are the PG conftest's `pg_admin_<hex>` superusers;
  - the 693 global legacy workflow definitions carry test-module names.
- **5 Studio workspaces and 5 drafts** (`manual_test_ws`, `fixverify_ws`, `fixverify_ws2`, `undoredo_ws`, `curltest_ws`) look like manual developer verification. That can't be proven, so they need **manual owner review**.
- **Measurable references to global rows: 0:**
  - 0 / 1,406 journal lines reference a global account;
  - 0 / 1,747 order lines belong to a global order;
  - 0 order lines carry a `product_id`.
- **Not measured** (requires an RLS bypass that was not authorized): customer, employee and parent references from tenant-owned rows, and any cross-tenant reference.
- **Superadmin:**
  - "platform administrator" is the `users.is_superuser` flag, which yields the role `superadmin` and the permission `*.*.*` at login;
  - the token's tenant is simply `users.tenant_id`;
  - no tenant-selection or impersonation path reaches HTTP;
  - so the auth model **cannot distinguish** platform administration from a tenant-less business operation. Both are "no `tid` claim".
- **New compatibility fact for N-2 P-4** ("tenant-less creates → 403"): the Playwright Studio fixture depends on tenant-less `admin` creating workspaces and drafts. P-4 would break it unless the admin model (N-2 Q-3) is decided first.
- **Not sufficient** to start the data-dependent N-2 work: the C-2 reversal, the RLS tightening and `NOT NULL`.

## 2. Database Target Classification

| Target | Evidence | Classification | Inspected? |
|---|---|---|---|
| `localhost:5432` / `erp_platform` (PostgreSQL 14.20) | It is `backend/.env`'s only DB target (`APP_ENV=development`; keys listed, values not printed). `tests/integration/workflow_postgres/conftest.py` builds its engine from the same `settings.database_url` and runs `create_all` against it. Every PG test in this programme wrote to it. It holds conftest-generated `pg_admin_*` users and fixture-named Studio rows (§6) | **TEST/DEV (shared local), confirmed** | **Yes**, read-only (§3) |
| `localhost` / `erp_db` | Catalog only: `public` schema, no ERP schemas (seen in N-2) | Empty | No business data exists |
| `localhost` / `erp_*_fresh_*` (7) | Names match the throwaway-DB fixtures of the fresh-migration tests | Test leftovers | **No** |
| `localhost` / `iil_lims`, `postgres` | Not an ERP database | Unrelated | **No** |
| Docker `erp_postgres` (`docker-compose.yml`: `postgres:16-alpine`, `POSTGRES_DB: erp_platform`, named volume `postgres_data`) | Docker daemon not running. The volume's contents are unknown | **UNKNOWN** | **No.** Not started, per the brief (persistent volume of unknown content) |
| Kubernetes `overlays/dev`, `overlays/prod` | Both directories are empty; `base/backend-deployment.yaml` names no DB host | No target configured | n/a |

- **Migration revision of `erp_platform`:** `d4e5f6a7b8c9` (H-1 head).
- No staging or production database is identifiable from the repository.

## 3. Inspection Role, Privileges and RLS Limitations

**Connection:**
- the application's configured role, via `settings.database_url` (never printed);
- `server_settings={"default_transaction_read_only": "on"}`, plus `SET TRANSACTION READ ONLY`;
- `SHOW transaction_read_only = on` is asserted before every query batch, and each batch ends in `ROLLBACK`.

The helper is a scratchpad script (not in the repo). It never sets `app.bypass_rls` or `app.current_tenant_id`. Both were verified as `<unset>`.

| Property | Value |
|---|---|
| `current_user` | `erp_user` |
| superuser / BYPASSRLS / CREATEROLE / CREATEDB | false / false / false / false |
| Write privileges | **Yes.** It owns all 199 user tables and has INSERT on all 199. **It is not a read-only role**; read-only was enforced per transaction only. |
| Dedicated read-only audit role | **None exists.** None was created, as required. |
| RLS on business tables | Enabled and FORCED on all tenant-column tables in sales, hr, accounting, inventory, leave_management, form_platform, workflow_studio and application_flow. **Not** on `sales_order_lines`, `journal_lines`, `account_types`, `auth.user_roles` and `workflow.wf_registry_definitions` |

**What this access can and cannot see.** With no tenant set, the RLS policy `tenant_id IS NULL OR bypass OR tenant_id = current` returns **exactly the global rows**. Every visible row was checked to have `tenant_id IS NULL`; for every table, visible = NULL-filtered.
- **Measurable:**
  - exact global-row counts;
  - complete counts of non-RLS tables;
  - references *from* non-RLS tables *into* global rows.
- **Not measurable:**
  - totals and per-tenant distributions of RLS tables;
  - invalid tenant values such as an empty string in the varchar `workflow_studio.tenant_id`;
  - cross-tenant references;
  - references from tenant-owned rows of RLS tables.

**`pg_stat_user_tables.n_live_tup` is unusable.** The statistics are stale: 8 workspaces against 596 visible global rows, 7 account types against 159 counted. Running `ANALYZE` would write statistics, so it was **not run**.

**Not reused:** the N-2 phase's earlier counts, made with the OS superuser, are historical. They are not substituted here as current results.

## 4. Table-by-Table Ownership Counts (`erp_platform`, 2026-10-12)

| Table | Tenant column | RLS | Global rows (exact) | Total / per-tenant |
|---|---|---|---|---|
| `sales.customers` | nullable uuid | forced | **76** | NOT MEASURED |
| `sales.sales_orders` | nullable uuid | forced | **0** | NOT MEASURED |
| `sales.sales_order_lines` | none (via order) | none | n/a | **1,747** (0 with `product_id`) |
| `accounting.accounts` | nullable uuid | forced | **0** | NOT MEASURED |
| `accounting.journal_entries` | nullable uuid | forced | **0** | NOT MEASURED |
| `accounting.journal_lines` | none (via entry) | none | n/a | **1,406** |
| `accounting.account_types` | **none** | none | n/a (platform catalogue) | **159** |
| `hr.departments` / `positions` / `employees` | nullable uuid | forced | **0 / 0 / 0** | NOT MEASURED |
| `inventory.products` / `product_categories` / `stock_locations` / `stock_levels` / `stock_movements` | nullable uuid | forced | **0** each | NOT MEASURED |
| `leave_management.leave_requests` | nullable uuid | forced | **0** | NOT MEASURED |
| `application_flow.flow_instances` | nullable uuid | forced | **0** | NOT MEASURED |
| `form_platform.form_definitions` / `form_versions` | **NOT NULL** uuid | forced | **0 / 0** (by construction) | NOT MEASURED. The 269 unpinned H-1 versions were **not** queried or touched |
| `workflow_studio.workflow_studio_workspaces` | nullable varchar | forced | **596** | NOT MEASURED |
| `workflow_studio.workflow_studio_drafts` | nullable varchar | forced | **592** | NOT MEASURED |
| `workflow_studio.workflow_studio_versions` | nullable varchar | forced | **77** | NOT MEASURED |
| `workflow_studio.workflow_studio_projects` / `revisions` / `templates` | nullable varchar | forced | **0 / 0 / 0** | NOT MEASURED |
| `workflow.wf_definitions` (legacy) | nullable uuid | forced | **693** | NOT MEASURED |
| `workflow.workflow_definitions` (foundation) | nullable uuid | forced | **64** | NOT MEASURED |
| `workflow.wf_registry_definitions` | nullable uuid, **sentinel** | none | **5** NULL | **66** total: 61 sentinel `00000000-…`, **0** real-tenant |
| `auth.users` | nullable uuid | forced | **5,510** | NOT MEASURED |
| `auth.roles` | nullable uuid | forced | **3** (`superadmin` scope global; `manager`, `user` scope tenant; all `is_system`) | NOT MEASURED |
| `auth.user_roles` | varchar, **sentinel** | none | — | **19**: 1 sentinel (`superadmin`), 18 tenant |
| `system.sys_settings`, `core.feature_flags` | nullable uuid | forced | **0 / 0** | NOT MEASURED |

**Tenant identifiers:** none are printed. The only tenant-valued facts reported are NULL vs sentinel vs "real" counts.

## 5. Cross-Tenant and Global-Reference Findings

| Reference | Measurable here? | Result |
|---|---|---|
| `journal_lines.account_id` → global account | **Yes** (lines unrestricted; accounts visible only if global) | **0 / 1,406** |
| Tenant-owned journal entry → global account | Yes (FK guarantees the entry exists, so an invisible entry is a tenant-owned one) | **0** |
| `sales_order_lines` belonging to a global order | Yes | **0 / 1,747** |
| `sales_order_lines.product_id` (no FK) | Yes | **0 / 1,747** non-null |
| `sales_orders.customer_id` → global customer, from tenant-owned orders | **No** (orders invisible) | NOT MEASURED |
| `hr.employees` → global department/position; `positions.department_id`; `departments.parent_id`; `accounts.parent_id`; `products.category_id`; `categories.parent_id` | **No** | NOT MEASURED |
| `accounts.account_type_id` → `account_types` (platform catalogue) | **No** (accounts invisible) | NOT MEASURED. This is the approved platform-reference pattern |
| Any cross-tenant reference | **No** (needs both owners' tenant ids) | NOT MEASURED |
| Orphans | FK-protected columns cannot orphan (all `RESTRICT`/`CASCADE`/`SET NULL`). `product_id` (no FK) is all NULL | 0 possible / 0 observed |
| Global Studio draft → workspace | Yes | **592 / 592** in a global workspace; 0 in an invisible (tenant-owned) workspace; 0 with a project |
| Studio `versions.definition_id` (no FK; client-supplied) | Yes | **77 / 77** → `workflow.wf_registry_definitions`; 0 → drafts / `wf_definitions` / `workflow_definitions` |

**Duplicate NULL-tenant codes** (gate S-2): `sales.customers` has 0 duplicates among its 76 global rows.

## 6. Workflow Studio Ownership Assessment

| Fact | Value |
|---|---|
| Counts vs. N-2 | **Unchanged:** 596 global workspaces, 592 global drafts (plus 77 global versions) |
| Linkage | 592 workspaces with exactly 1 draft, 4 with none; every global draft is in a global workspace; no projects |
| Created | 2026-08-07 → 2026-08-13 (6 distinct days); `created_by = owner_id = 'admin'` for all workspaces and drafts; status `ACTIVE`; no folder, no tags |
| Source code that creates this shape | `frontend/shell/e2e/fixtures/api-setup.ts::seedWorkspaceAndDraft`. It logs in as `admin` (the seeded tenant-less superuser, `scripts/db.py`) and POSTs a workspace named ``e2e_ws_${Date.now()}_${random6}`` with `owner_id: 'admin'`, then a draft named `'E2E Test Workflow'` with ``e2e_wf_…`` / fixed `e2e_p3a_execute_demo` codes |
| Match of the fixture grammar `^e2e_ws_[0-9]{13}_[a-z0-9]{1,6}$` | **591 / 596** workspaces |
| Embedded `Date.now()` vs `created_at` (< 120 s) | **591 / 591** |
| Drafts on fixture workspaces | **587**, all named `E2E Test Workflow`. The 4 empty fixture workspaces are consistent with a draft POST failing after the workspace POST |
| The other 5 workspaces, each with 1 draft | `manual_test_ws` / "Manual", `fixverify_ws` / "FixVerify", `fixverify_ws2` / "FixVerify2", `undoredo_ws` / "UR" (2026-08-07), `curltest_ws` / "curl test" (2026-08-10) |
| Versions (77) | all `DRAFT`, `created_by 'admin'`, `published_by` NULL, 52 distinct registry definitions (max version 26), 2026-08-10 → 2026-08-29 |
| Code treating them as shared templates | **None.** Templates live in `workflow_studio_templates` (0 global rows) or the in-code builtin registry (`templates/service.py::register_builtin`). Global workspaces and drafts are not read as templates |
| Active behaviour referencing them | `_enforce_tenant` (`repositories.py:89-102`) makes every global row readable **and updatable/deletable** by every tenant; `list_by_folder` / `list_by_workspace` include globals for tenants. No production job or seed reads them |

**Classification:**

| Records | Classification | Confidence | Basis |
|---|---|---|---|
| 591 workspaces + 587 drafts | **Playwright E2E fixture artefacts** | High | Code path, exact name grammar, timestamp agreement 591/591, creator, and creation window |
| 77 versions (`admin`, registry e2e definitions) | Probable E2E/Studio-UI artefacts | Medium | Creator and window; no single fixture reproduced exactly |
| 5 workspaces + 5 drafts (`manual_test_ws`, `fixverify_ws`, `fixverify_ws2`, `undoredo_ws`, `curltest_ws`) | **UNKNOWN — MANUAL OWNER REVIEW REQUIRED** | Low | Names suggest manual developer verification; no code creates them |

**Workflow-domain related data** (same tenant-less origin, test-module naming):
- `wf_definitions` global rows have module names such as `phase33_provisioning_test` (at least 323 rows across its top five name patterns; total not queried), `pg_audit_concurrent`, `pg_tenant_iso`, `pg_missing_tenant`, `pg_concurrent_decide` and `module_b`;
- `workflow_definitions` global rows use `pg_fnd_mod` (60), plus Studio and `n5_pg_contract` test codes.

Classification: **probable test-suite artefacts** (medium confidence, by naming). They are not N-2 business data; listed for the Workflow domain owner.

## 7. Superadmin and Tenant-less Creation Assessment

| Question | Finding | Evidence |
|---|---|---|
| How is the seeded superadmin represented? | `scripts/db.py::DEMO_USERS`: `admin`, `is_superuser: True`, `tenant_slug: None` (so `tenant_id` NULL), role `superadmin` (`scope: global`), with a `user_roles` row using the **sentinel** tenant `00000000-…` | source |
| Is it an explicit platform-admin role or just "no tenant"? | **Both, conflated.** Login gives `is_superuser` → `roles=["superadmin"]`, `permissions=["*.*.*"]` (`api/v1/auth.py::_load_role_names_and_permissions`). The JWT gets `tid` only if `users.tenant_id` is set (`auth.py:132`, `jwt.py:54`). A superuser with a tenant is an all-permission tenant user; without one, it is an all-permission tenant-less user | source |
| Seeded `admin` in this DB | **Not visible as a global user**: all 5,510 visible global users match `pg_admin_<hex>`. The one sentinel `superadmin` assignment's user is also not visible, so it is tenant-owned or absent. In August the Studio fixture wrote tenant-less rows as `admin`, so `admin` was tenant-less then. **Current state UNKNOWN** without bypass | §4, §6 |
| `pg_admin_*` users | 5,510, all `is_superuser = true`, `is_active = true`, tenant NULL. Created by `tests/integration/workflow_postgres/conftest.py:210-222`, one per PG test, with a fixed test password, and **never deleted**. Because the dev backend uses the same DB, these are loginable tenant-less superusers on this test DB | source + §4 |
| Create paths accepting a missing tenant | Accept, writing NULL: `POST /sales/customers`, `/sales/orders` (`ctx.tenant_id if … else None`), `/hr/departments`, `/hr/positions`, `/hr/employees`, `/accounting/accounts`, `/accounting/journal-entries`, `/inventory/categories`, `/inventory/products`, `/inventory/locations`, Studio workspace/draft/version (`tenant_id=user.tenant_id`), external probe. **Refuse (403):** Leave routes (`leave_management/api.py:50`), Sales/Accounting workflow-transition routes (`_workflow_caller_context`), Form Platform (`caller_tenant`), capability executor (`_resolve_tenant`) | grep, source |
| Services deriving ownership from authenticated context | All of them. No business input schema contains `tenant_id`, and none trusts a client-supplied tenant | N-2 §4 N2-D |
| Tenant selection / impersonation | **None reachable.** `TenantContextMiddleware` deliberately removed the `X-Tenant-ID` header override (Phase 3.0G). `app/core/workflow/security/impersonation/` exists but is referenced by no route or module (`grep` over `app/api`, `app/modules` → none; Workflow skips record it as CUT) | source |
| Can the model distinguish platform admin from tenant-scoped business work? | **No.** The only discriminator is the absence of `tid`, which also covers every tenant-less test user. `is_superuser` is not carried in the token as a claim distinct from `*.*.*` | source |

No user was created and no write endpoint was called.

## 8. Schema Constraints and Enforcement Gaps

- **Uniqueness:** `UNIQUE (code, tenant_id)` on customers, departments, positions, employees, accounts, products, categories and locations; `(order_number, tenant_id)`, `(entry_number, tenant_id)`. On PG 14 NULL is distinct, so global duplicates are not prevented (gate S-2; 0 present). `account_types.code` is globally unique. `form_definitions (tenant_id, key)` with `tenant_id NOT NULL` is the one fully enforced tenant-scoped uniqueness.
- **FKs (20 in the inspected schemas):** all are id-only, and none is composite with the tenant. Studio `versions.definition_id` and `sales_order_lines.product_id` have **no FK**.
- **RLS:** the uniform policy admits NULL in USING and WITH CHECK (N-2 D-2). There is no policy on child-line tables or on sentinel tables.
- **Can the current schema enforce the N-2 policy?**
  - **No** for "NULL tenant unsupported": every business tenant column is nullable.
  - **No** for "same-tenant references": child-line tables have no tenant column for a composite FK.
  - **Yes** for the platform catalogue pattern (`account_types`).

## 9. Comparison with the N-2 Policy

| N-2 policy point | Test-DB evidence | Real-DB evidence |
|---|---|---|
| Business data tenant-owned; NULL unsupported | Global business rows: only 76 test customers | **None** |
| Platform reference data separate | `account_types` (159), tenant-less table | **None** |
| References default same-tenant; C-2 global eligibility withdrawn | 0 measurable references to globals; customer/HR/parent refs NOT MEASURED | **None.** The withdrawal's data impact is unknown |
| Tenant-less callers must not create business data | All observed global rows trace to tenant-less test principals (`admin`, `pg_admin_*`) | **None** |
| Unknown ownership fails closed | 5 Studio records UNKNOWN | — |
| **New:** P-4 breaks the Playwright Studio fixture (tenant-less `admin`) | §6 source | — |

## 10. Cleanup or Migration Candidates (NOT performed; test DB only; each needs approval)

1. 591 fixture workspaces + 587 drafts (and their 77 versions, medium confidence).
2. 5,510 `pg_admin_*` superusers, plus a fix so the conftest stops leaking them. That is a test-code change for a later phase.
3. 76 global test customers.
4. 693 `wf_definitions` + 64 `workflow_definitions` global test-named rows; 5 NULL-tenant registry definitions (Workflow owner).
5. 7 `erp_*_fresh_*` throwaway databases left by fresh-migration tests.

**Untouched by design:** the 269 unpinned H-1 form versions.

## 11. Decisions Requiring a Business / Domain Owner

- **O-1.** Authorize a read-only inventory of a real database: Docker `erp_postgres` volume, staging, production.
  - This needs an independently authorized **read-only audit role** with a documented, approved way to see all tenants (BYPASSRLS on that role only, or `pg_read_all_data` plus an explicit RLS exemption).
  - Do **not** change `erp_user`.
- **O-2.** The 5 manual-looking Studio records: keep, assign an owner, or remove.
- **O-3.** The platform-admin model (N-2 Q-3): tenant-selecting admin login vs. explicit platform-admin endpoints. This now also determines how the Playwright fixture must authenticate.
- **O-4.** Whether the Workflow domain treats any global definition as a platform template (N-2 Q-4). The test-named ones suggest not.
- **O-5.** Approval of the §10 test-DB cleanup, separately from N-2.

## 12. Limitations, Queries Not Run, Confidence

**NOT RUN, deliberately:**
- any query on Docker `erp_postgres` (not started);
- any query on `iil_lims`, `postgres` or the `erp_*_fresh_*` databases;
- any query with `app.bypass_rls` or a tenant set;
- any superuser connection;
- `ANALYZE`;
- any query on H-1's 269 unpinned versions;
- any write endpoint, migration, seeder or cleanup.

**NOT MEASURED** (needs authorized all-tenant read access):
- totals and per-tenant counts of RLS tables;
- invalid tenant values in RLS tables;
- all cross-tenant references;
- tenant-owned → global references for customers, HR and parent/category columns.

**Confidence:**

| Item | Confidence |
|---|---|
| Global counts | High (exact, read-only, verified NULL) |
| Non-RLS counts | High |
| Studio fixture classification | High |
| Workflow definitions classification | Medium |
| Superadmin analysis | High from code; the current `admin` row state is UNKNOWN |
| Any statement about real deployments | **None possible** |

**Test-DB drift since N-2** (both are live values; N-2's numbers are not reused): customers 75 → 76 global; account types 158 → 159.

## 13. No Changes

No database, schema, migration, RLS, role, permission, configuration, source-code or data change was made.
- All queries ran in READ ONLY transactions, ended in rollback, as `erp_user`, without bypass.
- No container or service was started.
- No user was created, and no write endpoint was called.
- The 269 unpinned form versions were not touched.

The only files written were scratchpad helpers outside the repository, and this report.

## 14. No Commit / Push

No commit, no push, no Git remote change.
