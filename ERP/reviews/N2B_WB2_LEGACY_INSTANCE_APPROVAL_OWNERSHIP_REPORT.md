# N-2B WB-2 — Legacy Workflow Instance and Approval Ownership

**Date:** 2026-10-28
**Inputs:**
- `N2B_WB1_WORKFLOW_PUBLICATION_TENANT_ISOLATION_REPORT.md` §7 (R-5);
- `N2B_S2_3_DECISION_CLOSURE_AND_WORKFLOW_BOUNDARY_PLAN.md` §2.1, §4.1, §4.2 (WB-2);
- `N2B_S1_STRICT_MUTATION_OWNERSHIP_REPORT.md` (the `load_owned` helper).

**Verdict:** **CONDITIONAL GO** (§9).
**S3 and WB-3:** **not started.** WB-4 and WB-5 were not implemented.

---

## Executive Summary

- **The G idiom is reproduced on PostgreSQL through the real HTTP chain.**
  - On the pre-WB-2 code, tenant C had never touched these workflows. Against NULL-tenant instances it could:
    - read their detail (200);
    - **decide** their approval (200, instance `completed`);
    - **cancel** them (200, `cancelled`);
    - **advance** them (200, `completed`).
  - A token **with no tenant at all** could decide one too (200).
  - With WB-2 every one of these calls is refused, and the rows are unchanged (§1).
- **Fixed by routing the Legacy engine's two ownership checks through the S1 strict loader** (`app.core.multi_tenancy.ownership.load_owned`):
  - `_load_instance`, which every get / advance / cancel goes through;
  - `decide_approval`, which now checks the approval **and** its instance.
- **Tenant behaviour:**
  - the tenant is now required;
  - a NULL-tenant row is owned by no one;
  - another tenant's, a NULL-tenant and a missing id produce the same response.
- **Two adjacent changes, both on the same ownership line:**
  - `start()` now requires a tenant, so no new ownerless instance can be created (§3, D-1);
  - the dashboard pending-approvals count no longer counts NULL approvals (§3, F-2).
- **Caller audit:** no legitimate tenant-less production caller exists (§2). The tenant-less callers found are **tests only** (9 updated, §5.3).
- **Existing NULL-tenant data was not touched** (§7).
- **Tests:**

| Suite | Result |
|---|---|
| Unit | 3,914 passed, 0 failed (+14 new) |
| SQLite workflow | 172 passed, 5 skipped (= WB-1) |
| PostgreSQL | 40 files, one per invocation: 374 passed, 1 xfailed (pre-existing N-2), 0 failed |
| Top-level integration | 21 passed |
| Mutations | 8/8 caught |
| Playwright | **not run** for browser specs: no browser binary is installed (§5.5) |

---

## 1. Reproduction (pre-WB-2 code, local test DB)

**Method:**
- A temporary probe, `tests/integration/workflow_postgres/test_wb2_reproduction_probe.py`, ran through the real `app.main.app` with signed tokens.
- It ran once against the pre-WB-2 `engine.py`, `api/v1/workflow.py` and `dashboard/providers.py`, restored from the git index. Their diff against the working files is exactly the WB-2 edits.
- It then ran once against the WB-2 code.
- The probe was deleted afterwards; a copy is kept outside the repo (scratchpad).

**Setup:**
- one global Legacy definition, `start → approval (assigned wb2-checker) → end`;
- tenant A started four instances, and the probe cleared each instance's and approval's tenant (the shape of the 117/117 NULL rows S2.3 §2.2 recorded);
- tenant C acted on them.

| Operation by | Pre-WB-2 | WB-2 |
|---|---|---|
| C `GET /instances/{id}/detail` | **200** (instance + pending approval) | 404 |
| C `POST /approvals/{id}/decide` | **200**; instance `completed`, approval `approved` | 400 "not found"; `active` / `pending` |
| C `POST /instances/{id}/cancel` | **200**; `cancelled` / `cancelled` | 400; unchanged |
| C `POST /instances/{id}/advance` | **200**; `completed` / `approved` | 400; unchanged |
| Tenant-less token, `decide` | **200**; `completed` / `approved` | **403**; unchanged |

**Handling:**
- The defect was already known and planned (S2.3 §2.1, severity MEDIUM, WB-2).
- The brief authorises the fix, so I proceeded without an interrupt.
- No new CRITICAL finding was made.

---

## 2. Caller and Authorization Audit (Stage 1)

**Method:**
- grep over `app/` and `scripts/` for `_load_instance`, `decide_approval(`, `.advance(`, `.cancel(`, `get_instance(`, `get_pending_approvals(`, `list_instances(`, `WorkflowEngine`, `WfInstance`, `WfApproval`, and for every `WorkflowServiceContractV1` verb;
- every hit was read.

### 2.1 Engine entry points and their production callers

| Engine method | Reads / mutates | Production callers |
|---|---|---|
| `_load_instance` | read (choke point) | `get_instance`, `advance`, `cancel` (and `decide_approval` via `advance`) |
| `get_instance` | read | `api/v1/workflow.py` `_load_instance_response` (:161), `get_instance_detail` (:290); `integration/resolver.py` `LegacyRuntimeStrategy.query` (:323), `.history` (:337) |
| `advance` | mutate | `LegacyRuntimeStrategy.resume` (:241); `decide_approval` |
| `cancel` | mutate | `LegacyRuntimeStrategy.cancel` (:264) |
| `decide_approval` | mutate (approval + instance) | `api/v1/workflow.py` `decide_approval` route (:402) **only** |
| `start` | write (new instance) | `LegacyRuntimeStrategy.start` |
| `list_instances` / `get_pending_approvals` | read (lists) | `/workflow/instances`, `/workflow/approvals/pending`, adapter `list_active_workflows` — **not changed** (§8, R-4) |

**Not callers:**
- No `resume`, `suspend`, `complete` or `rollback` exists for Legacy (`OperationNotSupportedError`).
- Sales and Accounting have no `decide_approval` of their own on the engine. Their decisions go through `WorkflowServiceContractV1.transition` → `advance`.

### 2.2 How each entry point gets its tenant

| Entry point | Authorization | Tenant source | Tenant-less caller possible? |
|---|---|---|---|
| `/workflow/instances` POST, `/{id}` GET, `/{id}/advance`, `/{id}/cancel` | `require_permission(core.workflow.*)` + `_workflow_execution_context` | JWT `tid` → `async_tenant_context`; 403 if missing or malformed (pre-existing) | no |
| `/workflow/instances/{id}/detail` | `require_permission(core.workflow.read)` | JWT `tid`, passed as `None` when absent (**pre-WB-2**) | **yes → now 403** |
| `/workflow/approvals/{id}/decide` | `require_permission(core.workflow.decide)` | same | **yes → now 403** |
| Contract path (`IntegrationWorkflowServiceAdapter`) | Foundation authorize hook (Foundation-routed only); Legacy relies on the engine check | ambient `get_tenant_id()`, set by `TenantContextMiddleware` (`main.py:100`) from the JWT and by the Sales/Accounting/`/workflow` bridges | only if a caller enters without a tenant. Every production caller below has one |
| Sales `/orders/{id}/approval*`, `/cancel`, `/confirm` (`sales/api.py:301,336,378,418`) | `require_permission` + `_workflow_caller_context` (403 without tenant) | bridge | no |
| Accounting `/journal-entries/{id}/post`, `/approval*` (`accounting/api.py:249,284,321`) | same | bridge | no |
| Sales flow step `submit_sales_order_for_approval` | `user.has_permission`; tenant validated (`flow_step.py:83-88`) | `SalesService.confirm_order(tenant_id=…)` + ambient tenant from `TenantContextMiddleware` (HTTP request of the flow runtime) | no |
| Sales/Accounting `observe_*` flow steps | tenant validated, then `_ambient_workflow_context` | bridge | no (returns `None` without a tenant) |
| Dashboard widget `workflow_pending_approvals` | authenticated dashboard route | `user.tenant_id` | read only |

### 2.3 System and lifecycle operations

- **None reach these paths:**
  - `core/module_system/*`: no workflow-instance code;
  - `core/workflow/provisioning.py`: definitions only;
  - the scheduler: no handler registered (S2.3 §2.3);
  - `core/realtime/bridge.py`: pushes events only and never calls the engine;
  - the event bus: no subscriber in `app/modules` acts on workflow events.
- `scripts/phase_3_8_*.py` are standalone proof scripts that write `WfInstance` rows directly. They don't call the engine.

**Conclusion:**
- Tenant-less execution is **not** required by any production path.
- The only tenant-less callers were **tests**:
  - SQLite unit tests;
  - two module-provisioning PG tests that start instances inside `admin_session()` / `system_context()`.
- No architecture decision was needed, so I proceeded to Stage 2.

---

## 3. Root Cause and Code Changes

**Root cause:**
- `engine.py` `_load_instance` used `instance.tenant_id is not None and instance.tenant_id != tenant_id`.
- `decide_approval` used the same test on the approval.
- In both, a NULL row passed for **every** caller.
- The Phase 3.0H fix only closed the reverse case (a tenant-less caller seeing tenant rows).

| File | Change |
|---|---|
| `app/core/workflow/engine.py` | `_load_instance` (:778): `load_owned(session, WfInstance, id, tenant_id)`. The tenant is required (`TenantRequiredError` before any statement), the predicate is in the SQL, and NULL is never matched. A miss is the same `WorkflowError("Workflow instance … not found")`. |
| | `decide_approval` (:338): `owner = require_tenant(tenant_id)` first. The approval is loaded with `load_owned(…, for_update=True)` (:370), so tenant predicate and lock are **one** statement, replacing the separate `with_for_update()` select. The **instance** is loaded with `load_owned` (:375) **before any write**, and either miss is `"Approval … not found"`. The `instance is not None` branch around SoD is gone: the instance is now always present. `advance` gets `owner`. |
| | `start` (:115): `tenant_id = require_tenant(tenant_id)` before `_load_definition` (decision D-1 below). |
| | Docstrings updated. The keyword `tenant_id: Optional[...] = None` is kept for signature compatibility; omitting it is refused. |
| `app/api/v1/workflow.py` | `get_instance_detail` (:287) and `decide_approval` (:411): `require_tenant(user.tenant_id)` → 403 before any lookup, matching `_workflow_execution_context`. Without this, the now-strict engine would have turned a tenant-less request into a 500. |
| `app/core/dashboard/providers.py` | `workflow_pending_approvals`: tenant callers count `tenant_id = :tenant`, tenant-less callers count `IS NULL`. It was `tenant OR NULL`. This is now identical to `WorkflowEngine.get_pending_approvals` (finding F-2). |

**Decisions taken inside the brief:**
- **D-1, `start()` requires a tenant.**
  - Not named explicitly in the brief. It is the creation side of requirement 3 and "fail closed before any write".
  - After WB-2 a tenant-less start would create an instance **no one can ever read, advance, cancel or decide**.
  - No production caller starts without a tenant (§2.2); the HTTP start route already returned 403.
  - Side effect: `_load_definition`'s unfiltered `tenant_id is None` branch is now unreachable from `start`. The lookup itself is **not modified** (hard constraint).
  - Reviewers may revert this single line independently; the M4 mutation shows only the unit tier pins it.
- **F-2, dashboard count.**
  - The widget's comment claimed to follow "the WorkflowEngine convention", but it admitted NULL approvals the engine's own list does not.
  - After WB-2 those approvals are undecidable by every tenant, so counting them misreports work.
  - It is a read and was in the audited caller set (§2.1).
- **HTTP status codes are unchanged.**
  - Detail stays 404.
  - Decide stays 400 "Approval … not found", the established mapping of `WorkflowError` on that route.
  - Contract-routed get stays 404; advance and cancel stay 400.
  - Within each route, a foreign or NULL id is byte-identical to a nonexistent id (§4).

**Deliberately not done:**
- no new ownership helper;
- no explicit "system context" bypass in the engine (no caller needs one);
- no change to `_load_definition`, `get_by_name_tenant_or_global`, the Registry, the Foundation resolver, RLS, schema, migrations, grants or permissions;
- `list_instances` and `get_pending_approvals` were left as they are (R-4).

**Boundaries:**
- `engine.py` gains one import, `app.core.multi_tenancy.ownership`. It is module-agnostic, already imported by `api/v1/workflow_registry.py` and the Studio gateway, and depends only on SQLAlchemy.
- Integration Runtime and Foundation Runtime code is unchanged. A `TenantRequiredError` raised inside `LegacyRuntimeStrategy` is normalised to `LegacyRuntimeError` (`integration/exceptions.py:166`). The adapter turns it into `None` or a failed `WorkflowTransitionResult`, which is the existing not-found path.
- `test_integration_foundation_wiring_architecture.py`, the N5 security-context architecture test and the S1 AST guards pass within the unit run.

---

## 4. Ownership Guarantees and Failure Behaviour

| Case | Result | Evidence |
|---|---|---|
| Owner start / get / detail / pending / decide / advance / cancel | all work; decide completes the instance; cancel closes the open approval | PG `test_owner_starts_reads_decides_and_cancels_its_own_instance`; unit `test_owner_reads_decides_and_cancels_its_own_instance` |
| Tenant B on A's instance / approval (get, detail, advance, cancel, decide) | the response set is **identical** to a random-UUID set: 404 / 404 / 400 / 400 / 400 "not found". Instance, approval and history rows are unchanged | PG `test_another_tenant_gets_the_nonexistent_response_and_nothing_changes`; unit |
| Any tenant (including the original starter) on a NULL-tenant instance / approval | identical to a nonexistent id; excluded from `/approvals/pending` and `/instances`; rows unchanged | PG `test_no_tenant_can_read_advance_cancel_or_decide_a_tenantless_instance`; unit `test_a_tenantless_instance_and_approval_are_owned_by_no_tenant` |
| Owned approval on a NULL instance / NULL approval on an owned instance | "Approval … not found" before any write | PG `test_an_owned_approval_whose_instance_is_tenantless_is_not_decidable`; unit (both directions) |
| Missing, malformed or platform-scoped token (get, detail, advance, cancel, decide, start), on owned and on NULL ids | **403** for every route; instance count and rows unchanged | PG `test_missing_platform_and_malformed_tenant_contexts_fail_before_any_write` |
| Engine called with `None` / `""` / `"not-a-uuid"` / omitted | `TenantRequiredError` with **zero** session calls (execute / get / flush / commit counted) | unit `test_missing_or_malformed_tenant_fails_before_any_statement` (×3), `test_omitted_tenant_is_refused_by_default` |
| Error text and type for missing vs foreign vs NULL id | one class, one normalised message | unit `test_missing_foreign_and_tenantless_ids_are_indistinguishable` |
| **Concurrency:** owner racing two foreign decides, 5 rounds, separate PG connections | owner 200 every round; foreign calls always 400 "not found"; each approval decided once | PG `test_concurrent_owner_and_foreign_decisions_cannot_bypass_ownership` |
| **Concurrency:** 4 decides + 2 cancels from A and B on a NULL approval | all refused; rows unchanged | PG `test_concurrent_decisions_on_a_tenantless_approval_all_fail` |
| **Concurrency:** two owner decides | exactly one 200, one "already decided" (the lock is still effective inside `load_owned`) | PG `test_concurrent_owner_decisions_still_serialize_to_one_winner`; existing `test_postgres_concurrent_decide_same_approval_exactly_one_wins` |
| Dashboard count | NULL approvals assigned to the user are no longer counted | PG `test_dashboard_pending_count_excludes_tenantless_approvals` |
| Static guards | `_load_instance` / `decide_approval` call `load_owned`, with no direct `with_for_update` and no `session.get`; get / advance / cancel go through `_load_instance`; no G idiom remains in `engine.py`; the S1 out-of-scope pin list shrinks to `FoundationRuntimeStrategy.query` | unit `test_n2b_wb2_*` static tests; `test_n2b_s1_ownership_architecture.py` |

**Why concurrency cannot bypass the check:**
- `tenant_id` is immutable on these rows.
- The predicate is part of the same SQL statement as the lock.
- A foreign caller never takes a lock on another tenant's approval. Previously it briefly did, because `FOR UPDATE` ran before the tenant test.

---

## 5. Tests

### 5.1 Commands and results

All commands were run from `backend/`.

| Suite | Command | Result |
|---|---|---|
| Unit (full) | `.venv/bin/pytest tests/unit --ignore=tests/unit/test_engine_execution.py -q -p no:cacheprovider` | **3,914 passed, 0 failed** (WB-1: 3,900; +14 new). The first run after the engine change had 22 failures; all were tests calling the engine without a tenant (§5.3) |
| New unit | `tests/unit/test_n2b_wb2_legacy_instance_ownership.py` | 14 passed |
| SQLite workflow | `.venv/bin/pytest tests/integration/workflow -q -p no:cacheprovider` | **172 passed, 5 skipped** (= WB-1); no change needed |
| Top-level integration | `.venv/bin/pytest tests/integration/test_*.py -q -p no:cacheprovider` | 21 passed |
| PostgreSQL | each of the 40 `tests/integration/workflow_postgres/test_*.py` in its **own** invocation: `for f in …; do .venv/bin/pytest "$f" -q -p no:cacheprovider; done` | **374 passed, 1 xfailed** (pre-existing N-2 strict xfail), **0 failed**. The first loop had 3 failures in the two module-provisioning files (§5.3); after the fix both were re-run alone: 11/11 and 4/4 |
| New PG | `test_n2b_wb2_legacy_instance_ownership.py` | 9 passed |
| Sales / Accounting PG | `test_sales_*`, `test_accounting_*`, `test_f7_multi_module_runtime_path`, `test_c2_*`, `test_n2b_s1_strict_mutation_ownership` (139) | all passed within the run above |
| Module-provisioned PG | `test_workflow_definition_provisioning` (11), `test_sales_accounting_workflow_definition_provisioning` (4) | passed after the test update |
| Lint | `.venv/bin/ruff check` on changed engine, provider and new test files | clean. `api/v1/workflow.py` has 3 **pre-existing** unused imports (`Any`, `Dict`, `WfInstance`), left untouched |

**PG count note:**
- WB-1 recorded 377 passed over 39 files.
- This run's same 39 files sum to 365 (374 − 9 new), and no file reported a skip, deselect or error.
- WB-1 did not record per-file counts, so I can't attribute the 12-test difference. It is disclosed here rather than reconciled.
- The two provisioning files touched by this phase account for 15 of the 374, all passing.

### 5.2 Mutation check (8/8 caught)

**Method:**
- Each mutation was applied, both WB-2 files were run, and the file was restored from a backup.
- The SHA-1 of all three source files was verified identical to the WB-2 version after the loop.

| # | Mutation | Unit failures | PG failures |
|---|---|---|---|
| M0 | all three files reverted to pre-WB-2 | 13 | 5 |
| M1 | `_load_instance` back to the G idiom | 9 | 2 |
| M2 | approval loaded by `session.get` (no tenant predicate, no lock) | 2 | 1 (the owner-race test: the lock vanished too) |
| M3 | `decide_approval` skips the instance ownership check | 2 | 1 |
| M4 | `start()` accepts no tenant | 4 | 0 (unreachable from HTTP: `_workflow_execution_context` refuses first) |
| M5 | decide route without the 403 edge | 0 | 1 (500 instead of 403) |
| M6 | dashboard `tenant OR NULL` | 0 | 1 |
| M7 | detail route without the 403 edge | 0 | 1 |

### 5.3 Tests updated

Each test below pinned the removed tenant-less behaviour. No assertion was weakened and nothing was xfailed.

- `tests/unit/test_workflow_engine.py` (13 tests): engine calls run as a module-level `TENANT` against the unchanged global definitions.
- `tests/unit/test_workflow_cutover_functional_parity.py` (7 tests): facade calls pass `tenant_id=TENANT`, on both backends alike so parity is still compared like for like.
- `tests/unit/test_runtime_hardening_routing.py` (1) and `test_workflow_contract_foundation_routing.py` (1): start/query with a tenant, or inside `async_tenant_context`.
- `tests/unit/test_n2b_s1_ownership_architecture.py`: `_KNOWN_OUT_OF_SCOPE` loses the two engine entries, as the S2.3 plan prescribed.
- `tests/integration/workflow_postgres/test_workflow_definition_provisioning.py::test_existing_workflow_instance_stays_pinned_after_reconciliation` and `test_sales_accounting_workflow_definition_provisioning.py::test_idempotent_reconciliation_and_running_instance_safety[sales|accounting]`:
  - they started instances with no tenant under `admin_session()` / `system_context()`;
  - they now run as a tenant starting the **global** module-provisioned definition, which is the production shape;
  - version-pinning assertions are unchanged.
- **Finding F-3 (second file):** its throwaway-DB `async_sessionmaker` lacked `sync_session_class=FilteredSyncSession`.
  - So `system_context()`'s RLS bypass never reached the DB session, although the test's comment relies on it.
  - It only passed because RLS admits NULL-tenant inserts.
  - Fixed to match the real `DatabaseFactory` and the PG conftest.

### 5.4 Not run

- `tests/unit/test_engine_execution.py` (standing rule).
- Vitest: no frontend file changed.

### 5.5 Playwright

**Services:**
- `uvicorn app.main:app --port 8000` with `RATE_LIMIT_REQUESTS=5000`, on the Homebrew test DB from `.env`;
- `npm run dev` on :5173.

**Run:** `npx playwright test e2e/tests/sales-order-approval-actions.spec.ts e2e/tests/accounting-journal-entry-actions.spec.ts e2e/tests/studio-execute.spec.ts` (17 tests).
- **2 passed**: S4 and S6, request-only and with no browser, against the real backend with WB-2.
- **15 failed, every one with `browserType.launch: Executable doesn't exist … chromium_headless_shell-1234`.**
  - `~/Library/Caches/ms-playwright` does not exist on this machine (Playwright 1.62.1). WB-1's 138/138 ran with an installed browser.
  - Installing browsers is an external download this phase did not authorise, so these are **not run (environment)**, not regressions.
- **Not attempted:** the `declarative-flow-*` specs, which need the dormant `leave_management` module. Activating it is forbidden in this phase.
- Both services were stopped, and ports 8000 and 5173 were verified free. Playwright's untracked `test-results/` output was removed.
- Whether the PG run left `accounting` inactive (WB-1 R-8) was **not checked**: the browser specs could not run, and no module was activated or deactivated.

---

## 6. Architecture Boundary Verification

- The engine imports only `app.core.multi_tenancy.ownership`. This is pinned by the new static test reading `engine.py`'s AST, and the S1 static guards still pass.
- No file under `integration/`, `engine_execution/`, `engine_foundation/`, `runtime_hardening/`, `registry/` or `persistence/` changed.
- The Foundation resolver (`FoundationRuntimeStrategy.query`, WB-3) is untouched and still pinned as the only remaining G-idiom site under `app/core/workflow`.

---

## 7. Existing Global Workflow Data

- **Not migrated, reassigned, deleted, backfilled or reclassified:**
  - existing NULL-tenant `wf_instances` and `wf_approvals` (117 / 117 at S2.3);
  - `wf_definitions` (765 NULL);
  - Registry sentinel definitions and Foundation global definitions;
  - Studio history;
  - the 269 Form Builder versions.
- **After WB-2 they are inert for tenants:** they can't be read through the by-id routes and can't be mutated by anyone. They are still visible only to a **tenant-less** caller of `/workflow/instances` and `/approvals/pending` (R-4).
- **Rows this phase created** (test residue, not cleaned, per the programme rule):
  - the new PG file's instances and approvals, some of them NULL-tenant by design;
  - the probe's 8 instances;
  - the mutation runs' rows (8 × 9 PG tests);
  - the provisioning tests' rows.
- I issued no direct SQL outside test fixtures. A read-only `psql` count for this report was **not** run: the environment's permission policy refused it, so counts are not refreshed here.
- Only the local test DB (`erp_platform` on Homebrew PG 14) was used. No non-test database was accessed.

---

## 8. Remaining Risks

| # | Risk | Severity | Owner / stage |
|---|---|---|---|
| R-1 | **WB-1 version-number squatting** (WB-1 R-3): `POST /workflow-studio/versions` takes any `definition_id`. Another tenant can occupy A's next `(definition_id, version_number)` slot, so A's next history record hits `VersionConflictError` and its publish is rolled back. Untouched here | MEDIUM | follow-up (version router ownership) |
| R-2 | **Archive vs Foundation execution** (WB-1 R-4): Studio archive deprecates only the Registry version. The promoted Foundation version stays active and startable, and rollback does not re-promote | MEDIUM (consistency) | Workflow Engine phase |
| R-3 | **WB-3:** `FoundationRuntimeStrategy.query(tenant_id=None)` still admits every instance (latent; `/workflow` routes refuse tenant-less callers first) | MEDIUM (latent) | WB-3 |
| R-4 | `list_instances` / `get_pending_approvals` with **no** tenant still return NULL-tenant rows (`IS NULL`); a tenant caller sees only its own. Reachable by tenant-less or platform tokens on `/workflow/instances` and `/workflow/approvals/pending`, which use `get_current_user` only. Left because global-row **reads** are the S4 question (S2.3 §4.2) | LOW–MEDIUM (read; NULL rows only) | S4 / WB-5 |
| R-5 | Existing global definitions (WB-1 R-1) and the 765 NULL `wf_definitions` remain startable by every tenant through `_load_definition`'s tenant-or-global lookup (not modified, hard constraint). New instances from them are now tenant-owned | as WB-1 R-1 | D-2 / S4 |
| R-6 | `/workflow` router still has no `reject_platform_principal` (WB-5). Platform tokens are refused here only because they carry no tenant | LOW | WB-5 |
| R-7 | Status codes for foreign or missing ids are not uniform across routes: 404 for get/detail, 400 for advance/cancel/decide. They are non-disclosing within each route (pre-existing mapping, preserved) | LOW | follow-up if a uniform 404 is wanted |
| R-8 | `start()` tenant requirement (D-1) is a judgement call beyond the literal brief; any out-of-repo integration starting Legacy workflows without a tenant now fails. None exists in the repository | LOW | reviewer decision |
| R-9 | Browser-level Playwright evidence is missing for this phase (§5.5) | evidence gap | re-run after `npx playwright install chromium` |

---

## 9. Verdict: **CONDITIONAL GO**

- **Not GO:**
  - browser Playwright evidence could not be produced in this environment (R-9);
  - R-4 leaves a tenant-less read of NULL rows;
  - R-1, R-2 and R-3 remain open on the wider boundary.
- **Not NO-GO:**
  - the defect is reproduced and fixed at its only two choke points with the established S1 helper;
  - it is proven through the real HTTP chain on real PostgreSQL, including concurrent connections;
  - the change is mutation-tested 8/8;
  - Sales, Accounting and module-provisioned behaviour pass;
  - no data, schema or unrelated behaviour changed.
- **Conditions:**
  1. Re-run the affected Playwright specs (`sales-order-approval-actions`, `accounting-journal-entry-actions`, `studio-execute`, and the full suite) once a browser is installed.
  2. Reviewer accepts or reverts D-1 (`start()` requires a tenant).
  3. Decide R-4 within S4 / WB-5.
  4. WB-3, and the WB-1 follow-ups (R-1, R-2), as planned.

**WB-3 and S3 were not started.**
- No schema, migration, RLS, grant or permission change.
- No dormant module was activated.
- No non-test database was accessed, and no data cleanup was done.
- No commit or push.

## Files Changed

- **Application:**
  - `backend/app/core/workflow/engine.py`
  - `backend/app/api/v1/workflow.py`
  - `backend/app/core/dashboard/providers.py`
- **New tests:**
  - `backend/tests/unit/test_n2b_wb2_legacy_instance_ownership.py`
  - `backend/tests/integration/workflow_postgres/test_n2b_wb2_legacy_instance_ownership.py`
- **Updated tests:**
  - `backend/tests/unit/{test_workflow_engine,test_workflow_cutover_functional_parity,test_runtime_hardening_routing,test_workflow_contract_foundation_routing,test_n2b_s1_ownership_architecture}.py`
  - `backend/tests/integration/workflow_postgres/{test_workflow_definition_provisioning,test_sales_accounting_workflow_definition_provisioning}.py`
- **Report:** this file.
