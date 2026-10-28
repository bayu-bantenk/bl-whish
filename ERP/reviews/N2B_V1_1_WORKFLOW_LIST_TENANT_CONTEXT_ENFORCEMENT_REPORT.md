# N-2B V-1.1 — Workflow List Tenant-Context Enforcement

**Date:** 2026-10-28
**Inputs:**
- `N2B_V1_WORKFLOW_DEFINITIONS_TENANTLESS_READ_ISOLATION_REPORT.md` (V-1 not reproduced as a PostgreSQL leak; V-1b malformed → 500);
- `N2B_WB2_1_VERIFICATION_CLOSURE_REPORT.md` §3–§4 (tenant-less list-read policy).

**Scope:** `GET /workflow/definitions`, `GET /workflow/instances`, `GET /workflow/approvals/pending` only.

**Verdict:** **GO** for V-1.1 (§7).

---

## Executive Summary

- **What was wrong:** on each of the three routes, a caller with no valid tenant was answered instead of refused.
  - Missing tenant and platform principal → **200**. Malformed `tid` → **500**.
  - `/definitions` also had **no application-layer tenant filter** for such a caller.
- **Not a reproduced PostgreSQL leak:** as V-1 established, this is **not** a cross-tenant data leak reproduced on PostgreSQL; there, RLS limits such callers to NULL-tenant rows.
- **What the defect is:**
  - incomplete application-level tenant-context enforcement, which on an engine without RLS (the SQLite integration engine) returns **both tenants' private definitions** to a caller with no tenant (§3, observed);
  - plus the malformed-tenant 500.
- **Fix:**
  - The existing `require_tenant_context` dependency (`app/core/auth/dependencies.py:143`) is applied to all three routes. It returns 403 for a missing, empty or non-UUID tenant, whatever the permissions, so a platform principal is refused as well.
  - The definitions tenant predicate is now unconditional.
  - No new abstraction was added. DTOs, pagination, filters, ordering and permission checks are unchanged.
- **Evidence:**
  - **22 new tests**, run on **SQLite (no RLS)** and on **real PostgreSQL (RLS active)**: 22/22 on each.
  - **Before the change:** 12 refusal cases failed on both engines; the 10 isolation, contract and permission tests already passed.
  - **Mutations:** 4/4 detected. One (M4) is detectable **only** without RLS, which is why the no-RLS run matters.
  - **Regressions:**
    - unit 3,914 passed;
    - SQLite workflow 194 passed, 5 skipped;
    - top-level integration 21 passed;
    - PostgreSQL 41 files, 408 passed, 1 xfailed (the known N-2 xfail), **0 failed**.

---

## 1. Root cause per endpoint

| Endpoint | Dependency before | Tenant handling before | Root cause |
|---|---|---|---|
| `GET /workflow/definitions` (`workflow.py:441`) | `require_permission("core.workflow.read")` | `if user.tenant_id:` → `uuid.UUID(...)` + own-or-global predicate; **no `else`** | With no tenant, the statement has **no tenant predicate**. The ORM filter adds none either (`filters.py:133–145`). Only RLS remained. A malformed `tid` hits an unguarded `uuid.UUID(...)` → 500. |
| `GET /workflow/instances` (`:224`) | `require_permission("core.workflow.read")` | `uuid.UUID(t) if t else None` → engine `list_instances` filters `tenant_id IS NULL` when None | A tenant-less or platform caller is answered with NULL-tenant instances. A malformed `tid` → 500. |
| `GET /workflow/approvals/pending` (`:387`) | `get_current_user` **only** | same → engine `get_pending_approvals` filters `IS NULL` when None | A tenant-less or platform caller is answered with NULL-tenant pending approvals assigned to its user id. A malformed `tid` → 500. |

- **Common cause:**
  - None of the three routes used the S2 `require_tenant_context` dependency. It existed ("applied by S3") but was unused.
  - The workflow router has no router-level tenant or platform guard.
  - `get_current_user` copies the JWT `tid` claim without validating it.

---

## 2. Implementation changes

**One file:** `backend/app/api/v1/workflow.py` (+18 / −8 lines; full diff kept at `scratchpad/v1_1/workflow.diff`).

| Change | Where |
|---|---|
| Import `require_tenant_context` | `:30` |
| `list_instances`: add `_tenant: UserContext = Depends(require_tenant_context)`; `tenant_id = uuid.UUID(user.tenant_id)` (the `else None` branch removed: unreachable now); docstring | `:224–236` |
| `pending_approvals`: `user: UserContext = Depends(require_tenant_context)`, replacing `get_current_user`; `tenant_id = uuid.UUID(user.tenant_id)`; docstring | `:387–394` |
| `list_definitions`: add `_tenant: UserContext = Depends(require_tenant_context)`; the own-or-global predicate is now **unconditional** (the `if user.tenant_id:` guard removed); docstring | `:441–461` |

- **Parameter style:** `_tenant` follows the router's existing `_ctx: UserContext = Depends(_workflow_execution_context)` style. FastAPI caches `get_current_user` per request, so the token is decoded once.
- **Permission order:** `require_permission(...)` is still declared first. A caller missing `core.workflow.read` still gets its existing permission message (pinned by a test).
- **Not changed:**
  - `WorkflowEngine.list_instances` / `get_pending_approvals`: their `IS NULL` branch remains for the internal `adapter.list_active_workflows` caller, which is outside this phase;
  - every other workflow route;
  - mutation behaviour, and WB-2's `start()` tenant requirement;
  - RLS, schema, migrations, grants, permissions;
  - the Foundation resolver (WB-3).
- **Global definitions:** no global-definition fallback was added. The existing own-plus-global definition policy (WB-1 / S4 / D-2) is preserved unchanged.

---

## 3. Before and after HTTP behaviour

**Matrix probe:** a temporary probe drove the real `app.main.app` through `httpx.ASGITransport(raise_app_exceptions=False)`, so statuses are what a server returns.
- **Fixtures:** the standard fixtures, on each engine.
- **Seed data:**
  - a private definition for each of tenants A and B, plus a global one;
  - an instance with a pending approval for A, and one for B;
  - one instance whose tenant was then cleared (NULL).
- **Owner attribution:** definitions and instances by `tenant_id`. Pending approvals by `instance_id`, because `ApprovalResponse` has no `tenant_id` field.
- The probe was deleted; a copy is at `scratchpad/v1_1/test_v11_before_probe.py`, and its output at `scratchpad/v1_1/before_matrix.txt` and `after.txt`.

### 3.1 Before

| Caller | Route | SQLite (no RLS) | PostgreSQL (RLS) |
|---|---|---|---|
| No tenant | `/definitions` | **200 — owners A, B, NULL** | 200 — NULL only |
| | `/instances` | 200 — NULL | 200 — NULL |
| | `/approvals/pending` | 200 — NULL | 200 — NULL (incl. NULL rows from earlier runs) |
| Malformed `tid` | all three | **500** `internal_server_error` | **500** |
| Platform principal | `/definitions` | **200 — owners A, B, NULL** | 200 — NULL only |
| | `/instances`, `/approvals/pending` | 200 — NULL | 200 — NULL |
| Tenant A | `/definitions` / `/instances` / `/approvals/pending` | 200 — A + NULL / A / A | same |

- The SQLite rows show the application-layer gap directly: with no RLS, a caller with no tenant receives **both tenants' private definitions**.
- On PostgreSQL the same code is masked by RLS, as V-1 reported.
- **This is not claimed as a PostgreSQL leak.**

### 3.2 After

| Caller | All three routes, both engines |
|---|---|
| No tenant | **403** `No tenant context resolved for this operation` |
| Empty `tid` | **403** (same message) |
| Malformed `tid` | **403** `Invalid tenant context for this operation` |
| Platform principal | **403** `No tenant context resolved for this operation` |
| No token | 401 (unchanged) |
| Tenant without `core.workflow.read` (definitions, instances) | 403 permission message (unchanged) |
| Tenant A | 200: definitions A + global; instances A only; pending A only (assigned to caller), identical to before |

### 3.3 Visibility policy (pinned by tests)

| Endpoint | Visible to a valid tenant T | NULL-tenant rows | Other tenants' rows |
|---|---|---|---|
| `/definitions` | T's definitions **plus global** (NULL) definitions: the existing shared-definition policy, unchanged | visible (global definitions) | never |
| `/instances` | T's instances | **never** | never |
| `/approvals/pending` | T's pending approvals assigned to the caller | **never** | never |

---

## 4. Regression tests and exact results

### 4.1 New tests

- **SQLite:** `backend/tests/integration/workflow/test_n2b_v1_1_workflow_list_tenant_context.py`, 22 tests, real HTTP, SQLite integration engine, **no RLS**.
- **PostgreSQL:** `backend/tests/integration/workflow_postgres/test_n2b_v1_1_workflow_list_tenant_context.py` re-collects the same 22 tests against real PostgreSQL.
  - RLS stays active, and **no request is made with RLS bypassed**.
  - Setup only (seeding definitions, clearing an instance's tenant) uses `admin_session()`, the same established mechanism `seed_legacy_definition` already uses for every PG seed. No shared DB security configuration is changed.

| Test | Covers |
|---|---|
| `test_list_routes_refuse_callers_without_a_valid_tenant[missing\|malformed\|empty\|platform × 3 routes]` (12) | 403 plus a tenant message for missing, malformed, empty and platform callers, on every route |
| `test_list_routes_keep_401_without_a_token[3]` | existing authn unchanged |
| `test_permission_check_is_unchanged[/definitions, /instances]` | existing authz unchanged |
| `test_definitions_isolate_tenants_and_keep_global_definitions` | A sees A + global; B sees B + global; C sees global only; ordering; `WfDefinitionResponse` keys |
| `test_definitions_unfiltered_listing_never_contains_a_foreign_tenant` | unfiltered listing contains only own or NULL tenants (against ~1,000 existing rows on PG) |
| `test_instances_isolate_tenants_and_hide_null_tenant_rows` | A only A; B only B; a NULL-tenant instance seen by nobody; `InstanceResponse` keys |
| `test_instances_pagination_filters_and_ordering_unchanged` | `limit` / `offset` partition the result; `status` filter; `limit=0` → 422 |
| `test_pending_approvals_isolate_tenants_and_hide_null_tenant_rows` | A only A; B only B; NULL approval seen by nobody; assignee-only; `ApprovalResponse` keys |

### 4.2 Results

| Run | Command (from `backend/`) | Result |
|---|---|---|
| New, SQLite, **before** the change | `.venv/bin/pytest tests/integration/workflow/test_n2b_v1_1_workflow_list_tenant_context.py -q -p no:cacheprovider` | 12 failed (all refusal cases), 10 passed |
| New, PG, **before** | same, `workflow_postgres/…` | 12 failed, 10 passed |
| New, SQLite, after | same | **22 passed** |
| New, PG, after | same | **22 passed** |
| Unit | `.venv/bin/pytest tests/unit --ignore=tests/unit/test_engine_execution.py -q -p no:cacheprovider` | **3,914 passed**, 0 failed (unchanged from WB-2; no unit test added) |
| SQLite workflow | `.venv/bin/pytest tests/integration/workflow -q -p no:cacheprovider` | **194 passed, 5 skipped** (pre-existing skips; 172 + 22 new), 0 failed |
| Top-level integration | `.venv/bin/pytest tests/integration/test_*.py -q -p no:cacheprovider` | **21 passed** |
| PostgreSQL | each of the 41 `tests/integration/workflow_postgres/test_*.py` in its own invocation | **408 passed, 1 xfailed** (pre-existing N-2), **0 failed, 0 skipped, 0 errors** (= WB-2.1 baseline 386 + 22 new) |
| Playwright | — | **not run** (§4.4) |

### 4.3 Mutations

Each mutation was applied to the fixed `workflow.py` and both new files were run. The file was then restored, with its SHA verified (`04072a6c…`).

| Mutation | SQLite | PG |
|---|---|---|
| M1: drop the dependency on `/definitions` | 4 failed | 4 failed |
| M2: drop the dependency on `/instances` | 4 failed | 4 failed |
| M3: `/approvals/pending` back to `get_current_user` | 4 failed | 4 failed |
| M4: keep the dependency, delete the definitions tenant predicate | **2 failed** | **0 failed** (masked by RLS + ORM filter) |

- **M4** is the case the brief warns about: application-level enforcement cannot be proven on RLS-backed PostgreSQL alone. The SQLite run detects it.

### 4.4 Not run

- **Playwright:** no frontend or e2e code calls these three GET routes (repository-wide search of `frontend/shell/src` and `e2e`), so no browser spec exercises the change.
- **SQLite limitation:** SQLite has no RLS and is only used for the integration suite. It is the vehicle for application-layer proof, not a deployment claim.

---

## 5. Limitations and unresolved risks

| ID | Item | Status |
|---|---|---|
| L-1 | `WorkflowEngine.list_instances` / `get_pending_approvals` still accept `tenant_id=None` (→ `IS NULL`). Reachable only internally (`integration/adapter.py:240` `list_active_workflows`, ambient tenant). Not an HTTP route; outside scope | open (WB-2.1 §4.3 engine-level step) |
| L-2 | The workflow router still has no router-level guard. The other workflow routes rely on per-route `_workflow_execution_context` / `require_tenant` (WB-2) or their own permission checks. Not re-audited here | unchanged |
| L-3 | Global (NULL-tenant) definitions stay visible to every tenant through `/definitions`. This is the existing shared-definition policy (WB-1 R-1, S4 / D-2), deliberately preserved | open by design |
| L-4 | `get_current_user` still does not validate the `tid` format. Routes not using `require_tenant_context` / `require_tenant` would still 500 on a malformed `tid` if they parse it unguarded | not audited outside the three routes |
| L-5 | Test residue: setup rows (`v11_*` modules, instances, approvals, 2 probe runs per engine on PG) remain in the test DB, plus the 9 V-1 probe definitions. Not cleaned up, per the programme rule | by design |

---

## 6. Constraint confirmation

- **Database:** only the local Homebrew PostgreSQL 14 test database (`localhost:5432/erp_platform`) and the in-memory SQLite integration engine were used. No production or other database was accessed.
- **Security configuration untouched:**
  - **RLS** policies are unchanged. No request ran with RLS bypassed.
  - **Schema / migrations / grants / permission model:** unchanged.
- **Modules:** none activated or deactivated.
- **Test data:** not cleaned up. The 9 V-1 probe definitions and all earlier residue were kept.
- **Dependencies:** nothing installed or downloaded.
- **Endpoints:** only the three listed endpoints changed. WB-2's `start()` tenant requirement is unchanged.
- **Not started:** WB-3 and S3.
- **No Git commit or push.**

---

## 7. Verdict

**GO.**

- **The defect is closed on both engines:**
  - all three routes fail closed with 403 for missing, empty, malformed and platform tenant contexts;
  - malformed tenant no longer returns 500;
  - `/definitions` now filters at the application layer whether or not RLS is present.
- **Valid-tenant behaviour is unchanged:** the 10 isolation, contract and permission tests passed before and after, and the matrix is identical.
- **The tests detect regressions,** including the one RLS would hide (M4).
- **No regression across the suites:** unit, SQLite, top-level, and 41 PostgreSQL files.
- **Why not CONDITIONAL GO:** every brief requirement has direct evidence. The remaining items (§5) are outside the three-route scope and are pre-existing, not introduced here.

## Files changed

- **Modified:** `backend/app/api/v1/workflow.py`.
- **Added:**
  - `backend/tests/integration/workflow/test_n2b_v1_1_workflow_list_tenant_context.py`;
  - `backend/tests/integration/workflow_postgres/test_n2b_v1_1_workflow_list_tenant_context.py`;
  - `docs/architecture/reviews/N2B_V1_1_WORKFLOW_LIST_TENANT_CONTEXT_ENFORCEMENT_REPORT.md`.
- **Updated:** `docs/architecture/reviews/N2B_WB2_1_VERIFICATION_CLOSURE_REPORT.md`: one pointer line.
- **Created and deleted:** `test_v11_before_probe.py` in both test directories (temporary probe).
