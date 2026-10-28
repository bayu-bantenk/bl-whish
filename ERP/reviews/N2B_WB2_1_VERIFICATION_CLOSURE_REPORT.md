# N-2B WB-2.1 — Verification Closure

**Date:** 2026-10-28
**Input:** `N2B_WB2_LEGACY_INSTANCE_APPROVAL_OWNERSHIP_REPORT.md` (§5, §8 R-4, R-8, R-9, §9 conditions).
**Scope:** audit, verification and documentation only. No application code, test, schema, migration, RLS, grant or permission was changed.

**Verdict:** **CONDITIONAL GO** for WB-2 (§6).
- Workstream A (test count): **closed.** The gap was an arithmetic error in the WB-2 report, not a test change.
- Workstream B (Playwright): **blocked by environment.** Needs an authorised browser download.
- Workstream C (tenant-less list reads): **policy recommended, not implemented.**

**WB-3 and S3:** **not started, not authorised by this phase** (§7).

---

## Executive Summary

- **The 365 vs 377 gap was not real.**
  - WB-2's own working log shows the 39 shared files passed **374** in the first loop, with 3 failures that WB-2 then fixed. 374 + 3 = **377**, the same as WB-1.
  - The WB-2 report labelled that 39-file first-loop figure (374) as the 40-file total, then subtracted the 9 new WB-2 tests again to get 365.
  - A fresh per-file run today confirms it: **39 shared files: 377 passed, 1 xfailed. All 40 files: 386 passed, 1 xfailed, 387 collected, 0 failed, 0 skipped, 0 deselected.**
  - It also matches S2.2's two recorded subtotals exactly (§1.4).
- **Playwright:** the repository pins `@playwright/test` 1.62.1, and its only project is `chromium`. No Playwright browser is installed on this machine. The supported command is `cd frontend/shell && npx playwright install chromium`. It downloads about 3 archives from `cdn.playwright.dev`; I did not run it. No spec was executed in this phase.
- **Tenant-less list reads:**
  - `GET /workflow/instances` and `GET /workflow/approvals/pending` still answer a caller with no tenant, returning NULL-tenant rows.
  - A third route has the same pattern and is wider: `GET /workflow/definitions` applies **no tenant filter at all** when the caller has no tenant. Every tenant's active definitions are returned. This is found by code reading and **not reproduced** (§4.2, finding V-1).
  - Recommendation: every tenant-facing list endpoint requires a valid tenant and returns 403 without one. The existing, currently unused `require_tenant_context` dependency already implements exactly this.

---

## 1. Workstream A — PostgreSQL test count reconciliation

### 1.1 Evidence available

| Source | What it records |
|---|---|
| WB-1 report §5 (`N2B_WB1_…_REPORT.md:214`) | 39 files, one per invocation: **377 passed, 1 xfailed**. **No per-file counts.** |
| WB-2 report §5 (`N2B_WB2_…_REPORT.md:215, 222–225`) | 40 files: "374 passed"; 39 shared files: "365". |
| WB-2 working log `scratchpad/wb2/pg_results.txt` (session scratchpad, not in the repo) | One pytest summary line per file for the WB-2 **first** loop, before the provisioning-test fix |
| S2.2 report §5 (`N2B_S2_2_…BOUNDARIES.md:159–160`) | 30 non-Sales/Accounting files in one invocation: **334 passed, 1 xfailed**; 8 Sales/Accounting files: **38** (7, 4, 2, 4, 7, 2, 4, 8) |
| Current repo | 40 `test_*.py` files in `backend/tests/integration/workflow_postgres/` |

### 1.2 What the WB-2 log actually says

From `pg_results.txt`, which has one line per file:

| | Passed |
|---|---|
| All 40 files, first loop | 383 |
| minus `test_n2b_wb2_legacy_instance_ownership.py` (9) | **374** (the 39 shared files) |
| plus the 3 first-loop failures fixed in WB-2 §5.3 (`test_workflow_definition_provisioning.py` 10→11, `test_sales_accounting_workflow_definition_provisioning.py` 2→4) | **377** |

- **Cause:** the WB-2 report took 374, the 39-file first-loop figure before the fix, and reported it as the final 40-file total. It then subtracted the 9 WB-2 tests a second time, giving "365".
- **What it is not:** no test was removed, deselected, skipped or collected differently. Database or module state played no part.
- **Correct WB-2 figures:** 40 files: 386 passed, 1 xfailed. 39 shared files: 377.
- **WB-2 report not edited:** this phase is documentation-only for this deliverable. The WB-2 report lines 42, 215 and 222–225 are **superseded by this section.**

### 1.3 Fresh baseline (2026-10-28, current working tree)

**Command:** from `backend/`, each file in its own invocation, with collection first and then the run:

```
for f in tests/integration/workflow_postgres/test_*.py; do
  .venv/bin/pytest "$f" --collect-only -q -p no:cacheprovider | tail -1
  .venv/bin/pytest "$f" -q -p no:cacheprovider | tail -1
done
```

**Target:** the local Homebrew PostgreSQL 14 test database from `backend/.env` (`localhost:5432`, `erp_platform`), as in every earlier phase.

| File | Collected | Result |
|---|---:|---|
| test_accounting_application_flow_proof.py | 7 | 7 passed |
| test_accounting_journal_entry_concurrency.py | 4 | 4 passed |
| test_accounting_module_production_activation.py | 2 | 2 passed |
| test_alembic_schema_qualification_regression.py | 2 | 2 passed |
| test_c2_cross_tenant_reference_remediation.py | 17 | 17 passed |
| test_capability_discovery.py | 2 | 2 passed |
| test_capability_leave_management.py | 9 | 9 passed |
| test_capability_sales_customer.py | 12 | 12 passed |
| test_capability_tenant_scoping.py | 4 | 4 passed |
| test_cnd1_product_reference.py | 10 | 10 passed |
| test_external_boundary_probe_fresh_database_migration.py | 1 | 1 passed |
| test_external_boundary_probe_lifecycle.py | 4 | 4 passed |
| test_f7_multi_module_runtime_path.py | 6 | 6 passed |
| test_form_platform.py | 10 | 10 passed |
| test_form_platform_fresh_database_migration.py | 1 | 1 passed |
| test_h1_contract_version_integrity.py | 11 | 11 passed |
| test_hr_inventory_rls_hardening_fresh_database.py | 1 | 1 passed |
| test_leave_management_fresh_database_migration.py | 1 | 1 passed |
| test_leave_management_lifecycle.py | 10 | 10 passed |
| test_leave_management_real_flow.py | 5 | 5 passed |
| test_leave_management_worklist.py | 8 | 8 passed |
| test_n2_global_row_current_behavior.py | 11 | 10 passed, **1 xfailed** (pre-existing strict N-2 xfail) |
| test_n2b_auth_contract_postgres.py | 1 | 1 passed |
| test_n2b_permission_identity_preflight.py | 2 | 2 passed |
| test_n2b_s1_strict_mutation_ownership.py | 139 | 139 passed |
| test_n2b_s2_2_audit_tenant_boundary.py | 3 | 3 passed |
| test_n2b_s2_2_workflow_registry_tenant_boundary.py | 5 | 5 passed |
| test_n2b_s2_platform_principal_http.py | 2 | 2 passed |
| test_n2b_wb1_publication_tenant_isolation.py | 5 | 5 passed |
| test_n2b_wb2_legacy_instance_ownership.py *(new in WB-2)* | 9 | 9 passed |
| test_p30g_rls_activation.py | 29 | 29 passed |
| test_pg_schema_import_order_regression.py | 5 | 5 passed |
| test_postgres_production_context_activation.py | 5 | 5 passed |
| test_rc1_reference_candidates.py | 8 | 8 passed |
| test_sales_accounting_workflow_definition_provisioning.py | 4 | 4 passed |
| test_sales_application_flow_proof.py | 7 | 7 passed |
| test_sales_module_production_activation.py | 2 | 2 passed |
| test_sales_order_concurrent_confirm.py | 4 | 4 passed |
| test_sales_order_full_state_machine_concurrency.py | 8 | 8 passed |
| test_workflow_definition_provisioning.py | 11 | 11 passed |
| **40 files** | **387** | **386 passed, 1 xfailed, 0 failed, 0 skipped, 0 deselected, 0 errors** |
| **39 files shared with WB-1** | **378** | **377 passed, 1 xfailed** = WB-1 |

- Collected equals passed plus xfailed in every file, so nothing was skipped or deselected.
- Raw output: `scratchpad/wb2_1/baseline.tsv` (session scratchpad).

### 1.4 Cross-check against S2.2

- S2.2's 30 non-Sales/Accounting files today: 386 − 9 (WB-2 file) − 5 (WB-1 file) − 38 (Sales/Accounting) = **334**. This equals S2.2's 334.
- The 8 Sales/Accounting files today: 7, 4, 2, 4, 7, 2, 4, 8 = **38**. This equals S2.2, file for file.
- S2.2 (372) + the WB-1 file (5) = **377**. This equals WB-1.
- So the historical chain S2.2 → WB-1 → WB-2 is consistent once the WB-2 arithmetic is corrected.

### 1.5 Limitation

- WB-1 still has no per-file record, so the WB-1 figure is matched only **in total**, not file by file.
- The S2.2 subtotals and today's per-file run make a per-file divergence that nets to zero very unlikely, but it is **not provable** from WB-1's evidence.
- The per-file table in §1.3 is the reproducible baseline from now on.

### 1.6 Side effects of the run

- The run left new test rows in the test database, as every earlier PG run does. Nothing was cleaned up, per the programme rule.
- Module runtime state after the run (WB-1 R-8: Accounting lifecycle tests can leave `accounting` inactive) was **not inspected**. A read-only DB query was refused by the environment's classifier in WB-2, and nothing was re-activated.

---

## 2. Workstream B — Playwright

### 2.1 Configuration (`frontend/shell/playwright.config.ts`)

| Item | Value |
|---|---|
| Runner | `@playwright/test` **1.62.1** (`frontend/shell/package.json`: `^1.62.1`; installed `node_modules/@playwright/test` 1.62.1) |
| Script | `npm run test:e2e` → `playwright test` |
| Projects | one: `chromium` (`devices['Desktop Chrome']`), headless by default |
| Execution | `workers: 1`, `fullyParallel: false`; `retries: 0` locally |
| Artifacts | `trace` / `video` `retain-on-failure`, `screenshot` `only-on-failure` (video needs ffmpeg) |
| Servers | **manual**, no `webServer`: the backend on :8000 (`RATE_LIMIT_REQUESTS=5000` required) and Vite on :5173 |
| Suite size | `npx playwright test --list`: **138 tests in 31 files** (same 138 as WB-1) |

### 2.2 Browser requirement and install command

- **Missing:** `~/Library/Caches/ms-playwright` does not exist, and `PLAYWRIGHT_BROWSERS_PATH` is unset.
- **Needed:** `npx playwright install --dry-run chromium` (prints only, downloads nothing) lists three items:

| Component | Version | Install location | Source |
|---|---|---|---|
| Chrome for Testing | 151.0.7922.34 (chromium r1234) | `~/Library/Caches/ms-playwright/chromium-1234` | `https://cdn.playwright.dev/builds/cft/151.0.7922.34/mac-arm64/chrome-mac-arm64.zip` |
| Chrome Headless Shell | 151.0.7922.34 (r1234) | `…/chromium_headless_shell-1234` | `https://cdn.playwright.dev/builds/cft/151.0.7922.34/mac-arm64/chrome-headless-shell-mac-arm64.zip` |
| FFmpeg | r1011 | `…/ffmpeg-1011` | `https://cdn.playwright.dev/dbazure/download/playwright/builds/ffmpeg/1011/ffmpeg-mac-arm64.zip` (2 fallbacks) |

- **Exact command (needs authorisation for an external download):**
  ```
  cd frontend/shell && npx playwright install chromium
  ```
- **Firefox and WebKit:** not needed. The config has no project for them, so a bare `npx playwright install` would download unused browsers.
- **Google Chrome:** a system `Google Chrome.app` exists. Using it would need `channel: 'chrome'` in the config, which is a test-config change and outside this phase. It is not recommended as a substitute for the pinned build.

### 2.3 Spec status in this phase

| Specs | Status | Reason |
|---|---|---|
| All 31 files / 138 tests | **not executed** | No browser installed. No download was authorised. |
| `sales-order-approval-actions` S4, S6 (request-only) | **not re-executed here** | They passed in WB-2 (§5.5) without a browser. They were not re-run because they cannot close the browser gap on their own. |
| The 15 browser tests WB-2 attempted (`sales-order-approval-actions`, `accounting-journal-entry-actions`, `studio-execute`) | **blocked** | Same missing executable (`chromium_headless_shell-1234`) |
| `declarative-flow-*`, `worklist-proof`, `leave-request-management`, and other specs that need `leave_management` or `external_boundary_probe` active | **not attempted, precondition unverified** | See below. |

- **The 138/138 WB-1 result:** WB-1 recorded this, including these specs, so their module preconditions held in this test DB on 2026-10-15.
- **Preconditions now:**
  - Whether they still hold was not checked. That needs a DB read or a module-state API call with a live backend.
  - `declarative-flow-proof.spec.ts:25` documents activating `external_boundary_probe` as a manual precondition.
  - Activating any module is forbidden in this phase.
- **Data:** no fixture, test data or module state was changed. No server was started.

### 2.4 Prerequisites to close R-9

1. **Authorisation:** you authorise the download and run `cd frontend/shell && npx playwright install chromium`.
2. **Accounting state:** confirm `accounting` is still active after the PG run (WB-1 R-8). If it isn't, re-activate it as the platform principal, as WB-1 did. That is a module-state change and needs its own authorisation.
3. **Backend:** start it with `cd backend && RATE_LIMIT_REQUESTS=5000 .venv/bin/uvicorn app.main:app --port 8000`, with `DB_ENGINE` as in `.env`. Then start the frontend with `cd frontend/shell && npm run dev`.
4. **Specs:** run the WB-2 affected specs: `npx playwright test e2e/tests/sales-order-approval-actions.spec.ts e2e/tests/accounting-journal-entry-actions.spec.ts e2e/tests/studio-execute.spec.ts`. Then run the full `npx playwright test`.
5. **Expectation:** `studio-execute` has a documented, pre-existing WebSocket-timing flake (`playwright.config.ts` header). A failure there must be triaged and not assumed to be WB-2.

---

## 3. Workstream C — current tenant-less list reads (audit)

### 3.1 Inventory

| Route | Auth dependency | Tenant handling | Engine / query | Tenant-less caller gets |
|---|---|---|---|---|
| `GET /workflow/instances` (`api/v1/workflow.py:219–243`) | `require_permission("core.workflow.read")` | `uuid.UUID(user.tenant_id) if user.tenant_id else None` (:233) | `WorkflowEngine.list_instances` (`engine.py:452–481`): tenant → `== tenant`; none → `IS NULL` | **all NULL-tenant instances** |
| `GET /workflow/approvals/pending` (`:379–394`) | `get_current_user` **only**, no permission | same (:388) | `get_pending_approvals` (`engine.py:426–450`): `assigned_to == user_id` AND (tenant → `== tenant`; none → `IS NULL`) | NULL-tenant pending approvals assigned to its own user id |
| `GET /workflow/definitions` (`:430–457`) | `require_permission("core.workflow.read")` | `if user.tenant_id:` → own **or** global (:447–452); **no else branch** | inline `select(WfDefinition)` | **every tenant's active definitions, no tenant filter** (V-1) |
| Contract `list_active_workflows` (`integration/adapter.py:240`) | n/a, internal | ambient `get_tenant_id()` | `list_instances` | NULL-tenant non-terminal instances if the ambient tenant is unset |
| Dashboard `workflow_pending_approvals` (`core/dashboard/providers.py`) | dashboard | WB-2 F-2 | count | NULL-tenant count (same `IS NULL` pattern; fixed in WB-2 only for tenant callers) |

### 3.2 Who can reach these routes without a tenant

- **Router guard:** the workflow router (`api/v1/workflow.py:46`, mounted at `api/v1/__init__.py:44`) does **not** have the S2 `reject_platform_principal` guard. A platform principal is therefore not refused at the router.
- **Permission check:** `require_permission` is satisfied by `is_superuser` or wildcard permissions (`core/auth/dependencies.py:91+`). A platform principal (`is_superuser`, no tenant) reaches all three routes, as would any tenant-less token holding `core.workflow.read`.
- **Pending approvals:** `/approvals/pending` needs only authentication.
- **Malformed `tid`:**
  - `get_current_user` copies `payload["tid"]` unvalidated (`dependencies.py:~84`), and `uuid.UUID(...)` in these three routes would raise `ValueError`.
  - The outcome is probably a 500 rather than a 403. Whether a middleware intercepts it first is **unverified**: inferred from code, not tested.
- **Where WB-2 already enforces 403:** the WB-2 routes `get_instance`, `detail`, `advance`, `cancel`, `decide` and `start` already return 403 here, through `_workflow_execution_context` or `require_tenant`. Only the list routes are inconsistent.

### 3.3 Severity

| Item | Data exposed | Severity |
|---|---|---|
| R-4 instances list | NULL-tenant instances (owned by no tenant, legacy/global residue), read-only; not mutable since WB-2 | LOW–MEDIUM |
| R-4 pending approvals | NULL-tenant approvals assigned to the caller's own user id; not decidable since WB-2 | LOW |
| **V-1 definitions list** | **Tenant-owned** private definitions of **every** tenant (names, modules, step data in `WfDefinitionResponse`) | **MEDIUM–HIGH** (cross-tenant read disclosure). Bounded to tenant-less principals. Not reproduced. |

- **V-1 is new.** WB-2 R-4 named only the two instance/approval list routes.
- **Earlier coverage:** the 5N7 audit row "List definitions: own + global only" (`Workflow_Phase_2_0B_5N7_Security_Tenant_Audit.md:67`) covers a **tenant** caller only.
- **Why it wasn't stopped for:** it was found by code reading in an audit-only phase and not reproduced, and the brief forbids changing code here. It is therefore reported, not fixed, and not treated as a stop-the-line live CRITICAL.

---

## 4. Workstream C — recommended policy

### 4.1 Policy

> **Every tenant-facing Legacy workflow list endpoint requires a valid tenant context and fails closed (403) when it is absent or malformed. A tenant caller sees only rows owned by its own tenant (plus, for definitions only, the global definitions that S4 / D-2 has not yet decided). NULL-tenant rows are never returned to a tenant-less caller through a tenant-facing route.**

### 4.2 Rationale

- **Consistency:** after WB-2, every single-row instance and approval route already refuses a missing tenant. Lists are the only remaining tenant-less entry points to the same tables.
- **"Owned by nobody":** WB-2 made NULL-tenant rows owned by no one for writes. Serving them to tenant-less callers through tenant-facing routes keeps an implicit "no tenant = global reader" role alive. The S2.3 plan rejects that role: platform principals are not tenant business actors.
- **V-1 is the same root pattern:** `if user.tenant_id:` with no `else`. A fail-closed default removes the whole class instead of patching each branch.
- **Malformed `tid`:** a fail-closed 403 replaces the probable 500.

### 4.3 Recommended mechanism (for the implementing phase; **not done here**)

- **Dependency:**
  - Apply the existing `require_tenant_context` (`core/auth/dependencies.py:143–152`) to `list_instances`, `pending_approvals` and `list_definitions`.
  - It checks presence **and** UUID shape, returns 403, and is documented as "N-2B S2 (applied by S3)". It is currently unused.
  - No new abstraction is needed.
- **Engine:**
  - Make `list_instances` and `get_pending_approvals` take a required tenant via `require_tenant`.
  - Remove their `IS NULL` branch, so internal callers such as `adapter.list_active_workflows` with an unset ambient tenant also fail closed. They currently return `[]` on exception, so they would degrade safely.
- **Platform access:**
  - If a platform-operator view of NULL-tenant residue is ever needed, it must be a **separate platform route** with its own permission and audit.
  - It must not be a tenant-less fallthrough on a tenant route. That decision belongs to S4 / WB-5, not here.
- **Tests the implementing phase should add:**
  - 403 for a missing, malformed or platform token on all three routes, plus no DB statement;
  - tenant A never sees B's or NULL rows;
  - **V-1 reproduction first**, before the fix;
  - the dashboard count for a tenant-less caller.

### 4.4 Distinction from the Foundation resolver and WB-3

| | This policy (Workstream C) | WB-3 |
|---|---|---|
| **Layer** | Legacy HTTP list routes and `WorkflowEngine` list methods | Foundation runtime query path (`resolver.py::FoundationRuntimeStrategy.query`, `foundation_runtime.py:365, 551` `list_instances`) |
| **Files** | `api/v1/workflow.py`, `core/workflow/engine.py`, possibly `integration/adapter.py` | `core/workflow/integration/resolver.py`, `engine_execution/foundation_runtime.py`, Foundation instance service |
| **Rows** | Legacy `workflow.wf_*` tables | Foundation instance tables |
| **Constraint** | Must not touch the Foundation resolver, Registry publication, or shared-definition lookup | Owns the Foundation resolver |
| **Global definitions** | Leaves `_load_definition`'s tenant-or-global lookup and global-definition visibility to S4 / D-2 | Not involved |

- Implementing this policy neither requires nor starts WB-3, and WB-3 does not close R-4 or V-1.
- The policy can be scheduled as its own small slice (for example, WB-2.2) or folded into S3 or WB-5, as the reviewer decides.

---

## 5. Unresolved limitations

| ID | Limitation | Effect | Closure |
|---|---|---|---|
| L-1 | WB-1 has no per-file PG counts | WB-1 is matched in total, and through S2.2's subtotals, but not file by file | none possible; §1.3 is the new baseline |
| L-2 | No Playwright browser installed | **No browser-level evidence for WB-2** (R-9 stays open) | authorise §2.4 |
| L-3 | `leave_management` / `external_boundary_probe` / `accounting` runtime state not inspected | Some browser specs may need module re-activation before they can pass | inspect with authorisation; activation needs its own approval |
| L-4 | V-1 is code-read, not reproduced | Severity is an estimate | reproduce in the implementing phase before the fix |
| L-5 | Malformed-`tid` behaviour on the list routes (500 vs 403) is inferred | Unknown status code | test in the implementing phase |
| L-6 | The WB-2 report still contains the wrong 374/365 figures | Readers of WB-2 alone see a false discrepancy | this report supersedes WB-2 lines 42, 215, 222–225; the reviewer may annotate WB-2 |

---

## 6. Gate decision

**WB-2: CONDITIONAL GO, unchanged.**

| WB-2 condition | Status |
|---|---|
| Accept or revert the `start()` tenant requirement (WB-2 D-1 / R-8) | **Closed: accepted** by the architecture decision. The behaviour is kept, and its coverage is retained, unchanged in this phase: unit `tests/unit/test_n2b_wb2_legacy_instance_ownership.py` (AST guard that `start` calls `require_tenant`, plus missing/malformed-tenant refusal with zero DB statements); PG `test_n2b_wb2_legacy_instance_ownership.py` (tenant-less / malformed / platform `start` → 403, counts unchanged), 9/9 passing in §1.3; module provisioning starts with a tenant (`test_workflow_definition_provisioning.py`, `test_sales_accounting_workflow_definition_provisioning.py`), 11/11 and 4/4 |
| PG count discrepancy | **Closed:** arithmetic error; fresh baseline 377/39 = WB-1, 386/40 |
| Browser Playwright evidence (R-9) | **Open:** blocked on authorisation (§2.4) |
| Tenant-less list reads (R-4) | **Policy decided as a recommendation (§4); implementation open.** V-1 added. |

- **Why not GO:** browser-level evidence is still missing, and V-1 / R-4 are open read exposures.
- **Why not NO-GO:** every WB-2 guarantee is re-proven on PostgreSQL today (386 passed, 0 failed). The remaining items are an evidence gap and read-only list exposures outside WB-2's mutation scope, not regressions.

---

## 7. WB-3 / S3 authorisation status

- **WB-3: not started.** Not authorised by this brief. No Foundation resolver, Registry publication or shared-definition code was read for change or modified.
- **S3: not started.** Not authorised; S2.3's S3 NO-GO stands.
- This report does not authorise either. The list-read policy in §4 is explicitly separate from both (§4.4).

---

## 8. Constraint confirmation

- **Changes:** none to application code, tests, test config, schema, migrations, RLS, grants or permissions. The only file created is this report. The WB-2 report was not edited.
- **Database:** only the local Homebrew PostgreSQL 14 test database (`localhost:5432/erp_platform`, from `backend/.env`) was used, through the PG test suite. No other database was accessed.
- **No cleanup:** existing and newly created test rows were left in place.
- **No activation:** no module was activated or deactivated. No server was started.
- **No external downloads:** no browser installation. `--dry-run` and `--list` only.
- **No Git commit or push.**

## Files changed

- **Added:** `docs/architecture/reviews/N2B_WB2_1_VERIFICATION_CLOSURE_REPORT.md`.
