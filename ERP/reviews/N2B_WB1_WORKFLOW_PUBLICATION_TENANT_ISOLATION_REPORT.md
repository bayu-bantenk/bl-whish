# N-2B WB-1 — Workflow Publication Tenant Isolation

**Date:** 2026-10-15
**Inputs:** `N2B_S2_3_DECISION_CLOSURE_AND_WORKFLOW_BOUNDARY_PLAN.md` §1 (finding W-1), §4.2 (WB-1).
**Verdict:** **CONDITIONAL GO** (§9).
**S3:** **not started.** WB-2, WB-3, WB-4 and WB-5 were **not implemented**.

---

## Executive Summary

- **W-1 is reproduced and was CRITICAL.** On the local test PostgreSQL, through the real HTTP chain:
  - tenant B's publish of tenant A's `definition_code` became **version 2 of A's definition**;
  - it was activated, and **A's next run executed B's graph**;
  - B, and a tenant C that never published, could **start** the workflow;
  - C could **read A's version history and graph** and **archive the active version**.
- **Fixed by tenant-scoping publication end to end:**
  - the owning tenant comes from the owner-loaded draft, never from the request;
  - the gateway requires a real tenant and refuses the shared sentinel;
  - the bridge refuses to promote any definition that has no real tenant;
  - Studio version history records the publisher's tenant;
  - archive and rollback are owner-only.
- **Two further defects in the same publication path are fixed in this phase:**
  - Studio history was written with a NULL tenant (globally readable);
  - archive and rollback had **no tenant check at all**.
- **Existing sentinel and global rows are untouched.** They remain the main residual risk (§7).
- **Tests:**

| Suite | Result |
|---|---|
| Unit | 3,900 passed |
| SQLite workflow | 172 passed, 5 skipped |
| PostgreSQL | 39 files, 377 passed, 1 xfail (pre-existing) |
| Top-level integration | 21 passed |
| Vitest | 862 passed |
| Playwright | 138/138 |
| Mutations | 8/8 caught |

---

## 1. Initial Verdict and Reproduction (Stage 1)

**Code checked against the S2.3 report: all references hold.**
- `PublishStage.run` passed no tenant.
- `publish_definition` used `tenant_id or _NO_TENANT_SENTINEL`.
- `_translate_tenant` mapped the sentinel to NULL.
- `get_by_name_tenant_or_global` admits NULL rows for every tenant.

**Additionally found:**
- `PublishingService.publish` wrote the Studio history row with `tenant_id=None`.
- `/publish/versions/{id}/archive` and `/rollback` called the Registry with no ownership check.

**Setup.**
- Local test DB only (`erp_platform`, Homebrew PG 14).
- A temporary probe, `tests/integration/workflow_postgres/test_wb1_reproduction_probe.py`, using the real `app.main.app` and signed tenant tokens:
  - three random tenants A, B and C;
  - one Foundation-enrolled code `wb1_probe_ea770929`;
  - each tenant had its own workspace and draft;
  - graphs were START → TASK → END, with task names `A-task` and `B-injected`.
- The probe was deleted after the run; a copy is kept outside the repo.
- A rolled-back single-transaction variant was tried first and abandoned: interleaved sessions broke savepoint ordering.

**Observed (exact values from the run):**

| Step | Result |
|---|---|
| A publishes X | 200. Registry definition `01a13dbf-c7d1…`, `tenant_id = 00000000-…` (**sentinel**). Foundation definition `tenant_id = NULL`. Studio version `tenant_id = NULL` |
| A starts X | 201, COMPLETED |
| **B publishes X** | 200, **`definition_id` = A's `01a13dbf-c7d1…`**. Registry v1 (A) is **deprecated**, v2 (`created_by=wb1-b`) is **active**. Foundation v2 is promoted from B's version and **active** |
| **A starts X** | 201. The instance runs Foundation version `01a13dbf-cadd…` (from B's Registry version), nodes `Start / B-injected / End` |
| B starts X / **C (never published) starts X** | 201 / **201** |
| C: `GET /workflow-studio/versions/history/{A def}` | 200, **2 entries** |
| C: `GET /workflow-studio/versions/{A's version}` | 200, graph `Start / A-task / End` |
| **C archives the active Registry version** | **200, `deprecated`.** The Foundation version stays active, so A can still start; Registry and Foundation now disagree |
| C archives tenant A's own Registry version (created through `/workflow-registry`) | 500 `"is 'draft', expected 'active'"`. **Not a tenant refusal:** the call reached the Registry state check |

**Cleanup (Stage 1 rule: only recorded rows, ownership verified).**
- Every base table's row count was snapshotted before and after: 200 tables, read-only.
- Each delta was attributed to the probe by its three random tenants, its code, the Registry and Foundation ids derived from them, and the fixture user created during the run (`pg_admin_67333f39`).
- One transaction checked **attributed count = delta** for all 16 tables, aborting on any mismatch, then deleted:

| Table | Rows |
|---|---|
| `audit.audit_logs` | 13 |
| `auth.users` | 1 |
| Registry: definitions / versions / nodes / transitions | 2 / 3 / 6 / 4 |
| Foundation: definitions / versions / nodes / transitions | 1 / 2 / 6 / 4 |
| Foundation: instances / tokens / history | 5 / 5 / 15 |
| Studio: versions / drafts / workspaces | 2 / 2 / 2 |

- **A post-cleanup snapshot is identical to the pre-probe baseline (`diff` empty).**

**Handling.** The brief already authorises fixing after successful reproduction under a stated policy (strict tenant ownership), so I proceeded directly instead of asking for a fix/document decision.

---

## 2. Root Cause and Affected Paths

1. **Identity.**
   - The Registry definition identity is `(name, module_name, tenant_id)`.
   - Studio always supplied the sentinel, so the identity collapsed to `(code, module)` for **every tenant**.
   - This is a Phase 2.0B.5N3 workaround for NULL-distinctness, applied to tenant-owned data.
   - Path: `publishing/stages.py` `PublishStage.run` → `registry_gateway.py` `publish_definition`.
2. **Promotion.**
   - `registry_foundation_bridge.py` `_translate_tenant` turned the sentinel into NULL, creating a **global** Foundation definition.
   - `persistence/repositories.py` `get_by_name_tenant_or_global` (used by `foundation_runtime._handle_start`) lets any tenant start it.
3. **Supersede on publish.**
   - `RegistryPublishingGateway.activate` deprecates whatever version is active and activates the new one.
   - The bridge's `_ensure_active` does the same on the Foundation side.
   - With a shared definition, another tenant's publish therefore **replaces** the executed version.
4. **History.** `publishing/service.py` recorded the Studio version with no tenant. `_enforce_tenant` treats NULL rows as visible to everyone.
5. **Lifecycle.** `ArchiveOperation` / `RollbackOperation` → gateway `deprecate` / `rollback` operate on any version id. `workflow.wf_registry_definitions` has no RLS (Phase 3.0J), so nothing else checks ownership.

**Callers enumerated before changing shared seams** (grep over `app/`, `tests/`, `scripts/`, frontend):

| Seam | Production callers |
|---|---|
| `publish_definition` | `PublishStage` only |
| `promote_and_activate` | gateway `_promote_to_foundation_if_enrolled` only |
| `deprecate` / `rollback` | `ArchiveOperation` / `RollbackOperation` ← `PublishingService` ← `publish_router` only |

- No seed or script promotes Registry definitions.
- Module-provisioned definitions (`provisioning.py`) and Foundation rows created directly do not use the bridge.
- **Test-only callers** that relied on tenant-less promotion:
  - `tests/integration/workflow/test_sales_order_approval_workflow.py::_foundation_order_approval`;
  - `tests/integration/workflow/test_accounting_journal_posting_workflow.py::_foundation_journal_posting_approval`.
- `get_by_name_tenant_or_global` was **not changed**. It is also the Legacy-parity resolver for module-provisioned global definitions; narrowing it is WB-3/S4 territory.

---

## 3. Implementation

| File | Change |
|---|---|
| `publishing/service.py` | `publish`: `owner_tenant = require_tenant(draft.tenant_id)` **before any stage**; missing or malformed → `TenantRequiredError` (403), no write. Passes the tenant in `PublishContext`. Records history with `tenant_id=str(owner_tenant)`. `archive` / `rollback` take a keyword-only `tenant_id` (required). |
| `publishing/context.py` | `tenant_id: Optional[uuid.UUID]` field |
| `publishing/stages.py` | `PublishStage` refuses a context without a tenant and passes `tenant_id` to the gateway |
| `publishing/registry_gateway.py` | `publish_definition(tenant_id=…)` is **required**, and the **sentinel fallback is removed**. `_require_real_tenant` refuses None, a non-UUID and the sentinel. New `_owned_version`: a missing version, another tenant's, NULL and sentinel all raise `PublishedVersionNotFoundError` (404). `deprecate` checks ownership; `rollback` checks **both** versions before any write. |
| `publishing/exceptions.py` | `PublishedVersionNotFoundError(StudioNotFoundError)` |
| `publishing/operations.py`, `api/publish_router.py` | thread `tenant_id=user.tenant_id` (the caller's JWT tenant, never the body) |
| `core/workflow/registry_foundation_bridge.py` | `_translate_tenant` replaced by `_owning_tenant`: NULL or sentinel → **`TenantlessPromotionRefusedError`** before any write; a real tenant is passed through unchanged. Docstrings updated, and the obsolete "global residual race" comment removed. |
| `core/database/rls.py` | comment only (it described `_translate_tenant`) |
| frontend `services/registryApi.ts` | `findDefinitionIdByCode` prefers the caller-owned definition over a legacy shared one with the same code. Otherwise the history panel would open the old shared history for codes published before WB-1, such as `e2e_p30a_execute_demo`. |

**Deliberately not introduced:**
- no platform-publication path;
- no migration, schema, RLS or grant change;
- no new permission;
- no change to `get_by_name_tenant_or_global`, the Registry router, the version router or the Legacy engine.

**Boundaries preserved:**
- Studio still reaches the Registry only through the gateway (the disclosed exception).
- The new import is `app.core.multi_tenancy.ownership`, which `api/errors.py` already uses.
- The bridge gained no import (the AST checks in `test_registry_foundation_bridge_architecture.py` and the module architecture tests pass inside the unit run).

---

## 4. Tenant Ownership Guarantees and Fail-Closed Behaviour

| Case | Result | Evidence |
|---|---|---|
| A and B publish one code | two Registry and two Foundation definitions, each owned by its publisher, each at v1; no sentinel or NULL row | PG `test_two_tenants_publishing_one_code_get_two_isolated_workflows`; unit `test_two_tenants_publishing_one_code_get_two_definitions` |
| B's publish vs A's definition | A's row (versions, active version) is byte-identical before and after | same PG test |
| Start | each tenant runs **its own** graph; a tenant without its own definition → 400 `not found` (the start route's existing mapping); no instance created | same PG test; unit `test_promotion_keeps_the_owning_tenant` (owner resolves, other tenant and tenant-less → None) |
| History | the Studio row has the publisher's tenant; B and C get `[]` for history and list, and 404 for get | same PG test; Playwright `studio-publication-tenancy` |
| Registry read by another tenant | 404 (S2.2, unchanged) | same |
| Archive / rollback of another tenant's version (including using one's own version as "current") | 404; Registry and Foundation state unchanged; A still runs A-v2 | PG `test_another_tenant_cannot_archive_or_roll_back_and_nothing_changes`; unit |
| Archive of a NULL or sentinel version | 404 for every tenant | unit `test_shared_versions_are_not_archivable_by_any_tenant`; PG shared-row test |
| Tenant-less or platform token: publish, archive, rollback | 403 | PG `test_missing_or_malformed_tenant_fails_closed_before_any_write` |
| Draft with tenant None / `""` / malformed | `TenantRequiredError` before any stage; 0 Registry and 0 Foundation rows | same PG test; unit |
| Draft carrying the sentinel UUID | refused at the gateway (failed report, "owning tenant"); 0 rows | same PG test |
| Bridge given a NULL or sentinel Registry definition | `TenantlessPromotionRefusedError`; 0 Foundation rows | unit `test_a_tenantless_registry_definition_is_never_promoted_global` |
| Owner lifecycle: publish → run → republish → archive → rollback → history | all work; the republish versions the same definition; history has 2 entries | PG `test_owner_publish_run_republish_archive_rollback_still_work`; Playwright `studio-execute`, `studio-history-version`, `studio-validate-publish` |

---

## 5. Existing Global and Sentinel Records

**Not migrated, deleted, reassigned or reactivated.**

| Rows | At phase start |
|---|---|
| Sentinel Registry definitions | 89 |
| Global Foundation definitions | 71 |
| NULL-tenant Studio versions | 107 |

**Not adopted:**
- a tenant publishing a code that already has a shared definition gets its own new definition;
- the shared Registry and Foundation rows are unchanged;
- the tenant's own start resolves its own definition;
- shared versions are not archivable through Studio.

(PG `test_existing_shared_definition_is_neither_adopted_nor_modified`; the shared rows there are seeded directly, because no Studio path creates them any more.)

**Counts after this phase's test runs: 101 / 83 / 115.** The increase is test residue, not Studio output:
- **+12 sentinel and +12 global:**
  - 11 executions of the shared-row test, which seeds one of each on purpose (the 1st run, 1 rerun, 8 mutation runs, 1 full run);
  - 1 sentinel from S2.2's `test_shared_no_tenant_rows_are_readable_but_never_mutable`;
  - 1 global from `test_postgres_production_context_activation`.
- **+8 NULL Studio versions:** the **M6 mutation run**, which deliberately restored the NULL history tenant.

**No cleanup was performed** on these. Unlike the Stage 1 probe, they are suite residue that the directory deliberately does not drop (conftest convention), and the programme's standing rule is "do not clean up test data".

---

## 6. Tests

| Suite | Command | Result |
|---|---|---|
| Unit (full) | `.venv/bin/pytest tests/unit --ignore=tests/unit/test_engine_execution.py -q -p no:cacheprovider` | **3,900 passed** (S2.2: 3,881; +19 new). An intermediate run showed 2 failures in `test_workflow_studio_services.py`: a tenant-less draft helper, now given a tenant. |
| New unit | `tests/unit/test_n2b_wb1_publication_tenancy.py` | 19 passed |
| Top-level integration | `.venv/bin/pytest tests/integration/test_*.py` | 21 passed |
| SQLite workflow | `.venv/bin/pytest tests/integration/workflow` | **172 passed, 5 skipped** (= S2.2) |
| PostgreSQL | each of the 39 `tests/integration/workflow_postgres/test_*.py` in its own invocation, Sales and Accounting included | **377 passed, 1 xfailed** (pre-existing N-2 xfail), 0 failed |
| New PG | `test_n2b_wb1_publication_tenant_isolation.py` | 5 passed |
| Vitest | `npx vitest run` | **862 passed** (105 files), including the new `registryApi.test.ts` (4) |
| Playwright (targeted) | `studio-execute`, `studio-history-version`, `studio-validate-publish`, new `studio-publication-tenancy`, `studio-tenant-ownership` | 10/10 |
| Playwright (full) | `npx playwright test` | **138/138** on the final run. A first full run had **23 failures** (all Accounting specs plus 2 in `multi-module-runtime`: `/accounting/account-types` 404). Cause: the PG run's last Accounting-lifecycle test left `system.module_runtime_state.accounting = inactive` (lifecycle audit, 11:31:40). The lifecycle audit shows it was active before this phase. Re-activated as the platform principal, the 28 tests in those files then passed, and so did the full rerun. |

**Tests updated, each because it pinned the removed behaviour (no assertion weakened, nothing xfailed):**
- `tests/unit/test_workflow_studio_publishing.py`: 17 calls gain a real `TENANT`.
- `tests/unit/test_workflow_studio_services.py`: the draft helper gets a tenant.
- `tests/integration/workflow/test_publish_lifecycle.py`:
  - archive or rollback of an unknown version: **500 → 404** (the old test documented 500 as a known gap);
  - the owner's own published version is reachable through the Registry router again: 404 → 422, the pre-S2.2 expectation.
- `tests/integration/workflow/test_registry_foundation_bridge.py`: the Foundation definition is now found under the publishing tenant, and is asserted **absent** under NULL.
- `tests/integration/workflow/test_sales_order_approval_workflow.py` and `test_accounting_journal_posting_workflow.py`:
  - the Foundation fixtures create a **tenant-owned** Registry definition and yield `(code, tenant)`;
  - the two scenarios run as that tenant;
  - before this, a fixture erroring before its `try` leaked its contract swap and broke 4 later scenario-J tests in the same file.

**Mutation check (8/8 caught; each guard reverted, tests run, file restored and verified):**

| # | Mutation | Unit failures | PG failures |
|---|---|---|---|
| M1 | gateway sentinel fallback restored | 3 | 0 (unreachable from HTTP: service and stage refuse first) |
| M2 | stage drops the tenant | 1 | 4 |
| M3 | bridge promotes tenant-less definitions as global | 2 | 0 (no HTTP path creates a tenant-less definition) |
| M4 | archive without owner check | 4 | 2 |
| M5 | rollback target unchecked | 1 | 1 |
| M6 | history written with a NULL tenant | 1 | 1 |
| M7 | service `require_tenant` skipped for a falsy tenant | 2 | 1 |
| M8 | owner check accepts shared versions | 2 | 1 |

**Not run:** `tests/unit/test_engine_execution.py` (excluded by standing rule).

**Services:**
- The backend (uvicorn :8000) and frontend (vite :5173) were started for Playwright and stopped afterwards; both ports were verified free.
- `leave_management` and `external_boundary_probe` were activated for the run and deactivated afterwards.
- `accounting` was re-activated (see above) and left **active**, its pre-phase state.
- PostgreSQL was already running and was not started or stopped.

---

## 7. Remaining Workflow Boundary Risks

| # | Risk | Severity | Owner / stage |
|---|---|---|---|
| R-1 | **Existing 71+ global Foundation definitions and 89+ sentinel Registry definitions remain startable / readable by every tenant.** Any code published before WB-1 (e.g. `e2e_p30a_execute_demo`) is still executable by tenants that have no definition of their own. Nothing can version them any more. | HIGH (pre-existing data) | owner decision D-2: assign each to its publishing tenant (traceable through drafts and `created_by`) or retire it. Plan only; no backfill. |
| R-2 | The 107 pre-WB-1 NULL Studio version rows (plus 8 mutation residue) stay readable by every tenant through `/workflow-studio/versions*` | MEDIUM | same decision / S4 |
| R-3 | `POST /workflow-studio/versions` takes any `definition_id`. Another tenant can create a row under A's definition id: invisible to A, but it occupies a `(definition_id, version_number)` slot, so A's next history record can hit `VersionConflictError`. The repository's `session.rollback()` there would also discard the publish. Not changed: the version router has no Registry access, and this is outside the publication path. | MEDIUM | follow-up (version router ownership) |
| R-4 | Archiving deprecates only the Registry version. The promoted Foundation version stays active, so the workflow is still startable (seen in the reproduction). Rollback activates via the Registry only and does not promote. | MEDIUM (consistency, not cross-tenant) | Workflow Engine phase |
| R-5 | WB-2 (Legacy G idiom on NULL instances and approvals), WB-3 (Foundation `query(tenant_id=None)` admits all), WB-4 (templates), WB-5 (`/workflow` platform refusal) are untouched | as in S2.3 | as planned |
| R-6 | `get_by_name_tenant_or_global` still admits NULL definitions for every tenant (needed for module-provisioned Legacy-parity definitions) | covered by R-1 | WB-3 / S4 |
| R-7 | The publish route still commits the session after a **failed** pipeline report (pre-existing). WB-1's tenant checks run before any write, so they are not affected. | LOW | follow-up |
| R-8 | Running the PG suite can leave `accounting` inactive, which breaks a following Playwright run (environment) | LOW | test-environment note |

---

## 8. Risk Assessment

- **Safer:**
  - a tenant can no longer version, activate, archive, roll back, start, or read the history of another tenant's Studio workflow;
  - new publications never produce shared or global rows;
  - the bridge can no longer mint a global Foundation definition.
- **Unchanged:**
  - existing shared rows (R-1, R-2);
  - Legacy and Foundation runtime semantics;
  - Registry router behaviour (S2.2);
  - module-provisioned definitions.
- **New risk introduced:**
  - a tenant that republishes a pre-WB-1 code now owns a **new** definition, so its old shared history is no longer shown first in the panel. This is intentional (§3, frontend), and the old history stays readable as before;
  - any external caller of `RegistryPublishingGateway` without a tenant now fails. None exists in the repository.

## 9. Verdict: **CONDITIONAL GO**

- **Not GO:**
  - R-1 leaves previously published workflows globally startable until the D-2 owner decision is taken and executed;
  - R-3 is a known adjacent integrity gap.
- **Not NO-GO:**
  - the defect is reproduced, fixed at every layer of the publication path, proven on real PostgreSQL and in the real browser suite, and mutation-tested;
  - no existing data or unrelated behaviour was changed.
- **Conditions:**
  1. An owner decision on the existing sentinel and global definitions (R-1, R-2).
  2. A follow-up for Studio version creation ownership (R-3).
  3. WB-2 / WB-3 as planned.

**S3 was not started.** No schema, migration, RLS, grant or permission change. No commit, no push.

## Files Changed

- **Application:**
  - `backend/app/modules/workflow_studio/publishing/{context,stages,service,operations,registry_gateway,exceptions}.py`
  - `backend/app/modules/workflow_studio/api/publish_router.py`
  - `backend/app/core/workflow/registry_foundation_bridge.py`
  - `backend/app/core/database/rls.py` (comment)
  - `frontend/shell/src/features/workflow_studio/services/registryApi.ts`
- **New tests:**
  - `backend/tests/unit/test_n2b_wb1_publication_tenancy.py`
  - `backend/tests/integration/workflow_postgres/test_n2b_wb1_publication_tenant_isolation.py`
  - `frontend/shell/src/features/workflow_studio/__tests__/registryApi.test.ts`
  - `frontend/shell/e2e/tests/studio-publication-tenancy.spec.ts`
- **Updated tests:**
  - `backend/tests/unit/{test_workflow_studio_publishing,test_workflow_studio_services}.py`
  - `backend/tests/integration/workflow/{test_publish_lifecycle,test_registry_foundation_bridge,test_sales_order_approval_workflow,test_accounting_journal_posting_workflow}.py`
- **Report:** this file.
