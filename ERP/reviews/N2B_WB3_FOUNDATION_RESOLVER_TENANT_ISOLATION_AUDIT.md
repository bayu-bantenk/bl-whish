# N-2B WB-3 — Foundation Resolver Tenant Isolation Audit

**Date:** 2026-10-28
**Authorisation:** audit and reproduction only. **No implementation.**
**Inputs:**
- `N2B_WB2_LEGACY_INSTANCE_APPROVAL_OWNERSHIP_REPORT.md` (R-3: "WB-3 Foundation query");
- `N2B_WB1_WORKFLOW_PUBLICATION_TENANT_ISOLATION_REPORT.md` (Registry→Foundation bridge tenancy);
- `N2B_S2_3_DECISION_CLOSURE_AND_WORKFLOW_BOUNDARY_PLAN.md` (the "G idiom", D-2 global definitions);
- `N2B_V1_1_WORKFLOW_LIST_TENANT_CONTEXT_ENFORCEMENT_REPORT.md`.

---

## 1. Executive verdict

**NO-GO to close WB-3 as-is. One HIGH finding is reproduced and needs a separately approved remediation phase.**

- **Reproduced (W3-1, HIGH):**
  - A **NULL-tenant Foundation workflow instance** can be **read** and **cancelled** by any tenant through the real HTTP API on PostgreSQL.
  - The tenants that did so had never touched the instance. The read returns `entity_type`, `entity_id`, `status` and **`context_data`**; the cancel writes `RUNNING → cancelled`.
  - This is the Foundation counterpart of the Legacy problem WB-2 closed. `FoundationRuntimeStrategy.query()` still treats a NULL-tenant instance as visible to everyone, and fail-closed RLS admits NULL-tenant rows by design.
- **Bounding conditions, observed:**
  - No current path **creates** a NULL-tenant Foundation instance. HTTP refuses tenant-less callers (403), the Foundation authorize hook denies tenant-less starts, and the bridge refuses tenant-less promotion.
  - Before this audit's probe, the test DB held **0** NULL-tenant Foundation instances.
  - Exploitation also needs the instance's UUIDv7 id: no HTTP route lists Foundation instances.
  - Exposure therefore depends on pre-existing NULL-tenant Foundation rows in a non-test database, which this audit could not inspect.
- **Not reproduced: everything else fails closed.**
  - Tenant A ↔ B private definitions and instances are isolated in both directions.
  - Missing, malformed and platform-principal callers get 403 with no write.
  - Service-level calls with no ambient tenant are denied.
  - A shared definition code resolves to the caller's own definition, then the global one, never another tenant's.
  - A tenant-owned Registry entry cannot resolve to another tenant's Foundation definition.
- **Secondary findings:**
  - W3-2 (MEDIUM, code + observation): the resolver's ownership check is skipped when no tenant is passed; only the authorize hook and RLS stop tenant-less callers.
  - W3-3 (LOW, observed): Foundation instance responses report the **caller's** tenant as `tenant_id`.
  - Three informational items (§7).

---

## 2. Resolver and caller inventory

### 2.1 Entry points that reach Foundation (production)

| Entry | Tenant source | Gate before Foundation |
|---|---|---|
| `POST /api/v1/workflow/instances` (`api/v1/workflow.py:175`) → `WorkflowServiceContractV1.trigger_workflow` | JWT `tid` → `TenantContextMiddleware` → ambient `get_tenant_id()` | `_workflow_execution_context` (403 without a valid tenant), `require_permission("core.workflow.start")` |
| `GET /instances/{id}` (`:249`) → `get_workflow_state` | same | same, with `core.workflow.read` |
| `POST /instances/{id}/advance` (`:320`) → `transition` → `resume` | same | `core.workflow.advance` + tenant |
| `POST /instances/{id}/cancel` (`:356`) → `cancel_workflow` | same | `core.workflow.cancel` + tenant |
| Sales / Accounting `workflow_service` bridges, `application_flow` | ambient tenant set by the calling tenant route | the module routes' own tenant guards |
| Studio publish → `RegistryPublishingGateway` → `registry_foundation_bridge.promote_and_activate` | publisher's tenant; `_require_real_tenant` / `_owning_tenant` (WB-1) | refuses a NULL or sentinel tenant |

- **Tenant spoofing:** the tenant comes only from `request.state` or the verified JWT `tid` (`multi_tenancy/middleware.py:59–75`). There is no header or query override, so a "mismatched tenant identifier" can only be a valid token for another tenant, i.e. the cross-tenant case.
- **Enrolment:** a definition code reaches Foundation only if it is listed in `settings.WORKFLOW_FOUNDATION_DEFINITION_CODES` (HYBRID; empty by default), read once at contract construction (`contracts/workflow/impl.py:214–219`).

### 2.2 Resolution and execution chain

| Layer | Function | Tenant handling |
|---|---|---|
| Adapter | `IntegrationWorkflowServiceAdapter` (`integration/adapter.py:154, 161, 185–203, 314`) | passes `tenant_id=get_tenant_id()` to the facade |
| Facade | `WorkflowIntegrationFacade` (`integration/facade.py`) | passes `tenant_id` through (Optional) |
| Resolver | `RuntimeResolver.resolve` (`integration/resolver.py:630`) | routing only (`CompatibilityPolicy`); no tenant |
| Strategy | `FoundationRuntimeStrategy.query` (`resolver.py:558–583`) | **`if tenant_id is not None and execution.tenant_id is not None and execution.tenant_id != tenant_id: not found`.** No tenant → no check. NULL instance → never blocked. |
| | `_dispatch` (resume / cancel / suspend / rollback) (`:425–450`) | ownership pre-check **only `if tenant_id is not None`** (`:439`) |
| | `history` (`:585–599`) | same conditional pre-check (`:590`) |
| | `start` (`:452–489`) | passes `tenant_id` into `StartWorkflowCommand` and the execution environment |
| Runtime | `FoundationWorkflowRuntime._handle_start` (`engine_execution/foundation_runtime.py:403–443`) | `get_by_name_tenant_or_global(code, module, tenant)` → **own first, else global; never another tenant**; `tenant=None` → global only (`persistence/repositories.py:53–80`). The new instance's `tenant_id = command.tenant_id`. |
| | `_handle_resume` / `_handle_cancel` / `_handle_suspend` (`:445–473`) | `get_instance` (**no tenant predicate**) → `_authorize(...)` → mutate |
| | `_query_status` / `_query_history` (`:535–548`, `:330–348`) | `get_instance` → `_authorize("query" / "history")` |
| | `_decide_task` (`:481–531`) | `task_repo.get_by_id` (no tenant predicate) → `_authorize("task.decide")` |
| | `list_instances` / `_query_execution` (`:360–368`, `:550–558`) | `tenant_id` Optional → **unfiltered** when None |
| Authorize hook | `_build_foundation_authorize_hook._authorize` (`contracts/workflow/impl.py:141–162`) | **denies when the ambient tenant is None**; otherwise RBAC on the caller's permissions. **It does not compare the subject's tenant.** |
| Persistence service | `WorkflowInstanceService.get_instance` (`persistence/service.py:471`) | by id only |
| Database | RLS `tenant_isolation` on `workflow.workflow_definitions`, `workflow_instances`, `workflow_instance_history`, `workflow_tasks`, `workflow_task_history` (`core/database/rls.py`, Phase 3.0H) | fail-closed: own tenant **+ NULL rows**; no tenant → NULL rows only. `wf_registry_definitions` is deliberately excluded (sentinel). |

- **No production callers (latent):**
  - `FoundationWorkflowRuntime.list_instances`, `get_task`, `list_open_tasks_for_instance`, `get_instance_history`;
  - `CompleteTaskCommand` / `RejectTaskCommand` (SDK only);
  - `adapter.list_active_workflows` reads Legacy, not Foundation.
- **S1 guard:** `tests/unit/test_n2b_s1_ownership_architecture.py:275` pins `resolver.py::FoundationRuntimeStrategy.query` as the **only** remaining NULL-admitting ("G idiom") function under `app/core/workflow`.

---

## 3. Ownership and visibility matrix

**Policy sources:**
- WB-1: Registry → Foundation tenancy.
- WB-2: NULL-tenant rows are owned by no one, for **Legacy** instances.
- S2.3 / D-2: global definitions remain startable pending S4.

**"Observed" means seen in this audit's PostgreSQL reproduction (§4).**

| Entity / combination | Policy (source) | Observed |
|---|---|---|
| Tenant-owned Foundation definition, own tenant | resolvable + executable (WB-1) | ✔ A starts `fA` → 201, instance tenant A |
| Tenant-owned Foundation definition, other tenant | not resolvable, not executable (WB-1) | ✔ B → `fA`: 400 "not found", **0 instances created**; A → `fB_only`: same |
| Global (NULL) Foundation definition | startable by any tenant; the instance is owned by the starter (Legacy D-2 / S2.3 convention; S4 pending) | ✔ C starts `fG` → 201, instance tenant **C** |
| Same code: A-, B- and global definitions | own first, then global (`repositories.py:76–80`) | ✔ A → A's, B → B's, C → global |
| Registry entry (tenant T) → Foundation definition | Foundation definition `tenant_id = T`, never another tenant or NULL (WB-1 `_owning_tenant`) | ✔ by WB-1 tests (unit 19 + PG 5, re-run §6). Execution never consults the Registry entry: it resolves by `(code, module, caller tenant)`, so a tenant-owned Registry entry **cannot** resolve to another tenant's Foundation definition. |
| Tenant-owned instance, own tenant | read / cancel | ✔ A GET 200, cancel 200 |
| Tenant-owned instance, other tenant | invisible, immutable; same response as missing | ✔ B: GET 404, detail 404, advance 400, cancel 400, no change |
| **NULL-tenant instance, any tenant** | **should be owned by no one** (WB-2 rule for Legacy; no Foundation-specific decision exists) | **✘ C and B: GET 200 (+ context), cancel 200 → cancelled** (W3-1) |
| Any instance, missing / malformed / platform caller | 403, no write (WB-2) | ✔ 403 on GET, detail, advance, cancel and start; no instance created |
| Any instance, service call with no ambient tenant | denied (5N6 §3/§15) | ✔ tenant-owned: not found (RLS); NULL-owned: `AuthorizationDeniedError`; start: denied |
| Foundation tasks | same as the instance | not reachable from production (no caller); not exercised |

- **Ambiguity flagged, not invented:** no report records an explicit policy for **NULL-tenant Foundation instances**. WB-2 decided "owned by no one" for Legacy only and deferred Foundation to WB-3. This audit treats the Legacy rule as the intended one because S2.3 frames both as the same "G idiom". **That needs reviewer confirmation.**

---

## 4. Reproduction

### 4.1 Method

- **Probe:** a temporary probe, `backend/tests/integration/workflow_postgres/test_wb3_reproduction_probe.py`.
  - It was **deleted** after the runs; a copy is at `scratchpad/wb3/test_wb3_reproduction_probe.py`.
  - The brief forbids test-code changes; the probe was a reproduction harness only and is not part of the tree. The same practice was used and disclosed in WB-2 and V-1.
- **Harness:** the real `app.main.app` over httpx, via the standard `workflow_postgres` fixtures (`client`, `role_token`), on the authorised local test PostgreSQL.
- **Foundation enrolment:** the same pattern as `test_foundation_http_reachability.py`:
  - `monkeypatch` of `WORKFLOW_FOUNDATION_DEFINITION_CODES`;
  - a contract registry swap, restored afterwards.
- **Test data:** all seeded under module **`wb3_probe`**, with fresh random tenants A, B and C per run:
  - Foundation definitions `fA`, `fB`, `fB_only` and `fA_wait` (START→WAIT→END);
  - a global `fG`;
  - a same-code trio `fS_{A,B,G}`.
  - Seeding used `admin_session()`, the mechanism the existing seed helpers use.
- **NULL-tenant instances:** set up by A starting `fA_wait`, then clearing `tenant_id` with `admin_session()`. Two shapes:
  - **(i)** instance row only, with history still A's;
  - **(ii)** "FULL-NULL": instance + history + tokens, the shape a tenant-less start would have produced.
- **Requests:** never made with RLS bypassed.
- **Command (from `backend/`):**
  ```
  .venv/bin/pytest tests/integration/workflow_postgres/test_wb3_reproduction_probe.py -q -s -p no:cacheprovider
  ```
- **Runs:** four.
  - Run 1 aborted when PostgreSQL hit disk-full (host volume); its first results match the later runs.
  - Runs 2–4 completed. The final run is shown below; run logs are in `scratchpad/wb3/run{1..4}.log`.

### 4.2 Observed results (run 4)

| # | Caller | Action | HTTP | DB effect |
|---|---|---|---|---|
| 1 | A | start own `fA` | 201 | instance, tenant A, definition `fA` |
| 2 | B | start A's `fA` | **400** `Workflow definition '…' not found` | none (count unchanged) |
| 3 | A | start B's `fB_only` | **400** not found | none |
| 4 | C | start global `fG` | 201 | instance, tenant **C**, definition `fG` |
| 5 | A / B / C | start the same code `wb3_s_*` | 201 / 201 / 201 | resolved to `fS_A` / `fS_B` / `fS_G` respectively |
| 6 | B | GET / detail / advance / cancel on A's running instance | 404 / 404 / 400 / 400 | unchanged (`running`, tenant A) |
| 7 | A (owner, control) | GET / cancel own instance | 200 / 200 | `running → cancelled` |
| 8 | A (owner, control) | advance own WAIT instance | 400 `status is 'running', expected 'suspended'` | none: advance is not applicable to a running WAIT instance (functional, not tenancy) |
| 9 | C | GET a NULL instance (shape i) | **200**, body includes `context_data`; `tenant_id` shown as **C** | — |
| 10 | C, B | cancel a NULL instance (shape i) | 400 `Could not cancel instance …` | none. **Cause:** `UniqueViolation uq_wflow_hist_inst_seq`; the authorisation checks **passed** (see §4.3) |
| 11 | **C** | GET / cancel a **FULL-NULL** instance (shape ii) | **200 / 200** | **`running → cancelled`** (tenant stays NULL) |
| 12 | **B** | GET / cancel another FULL-NULL instance | **200 / 200** | **`running → cancelled`** |
| 13 | A (original starter) | cancel a NULL instance (shape i) | 200 | `running → cancelled` |
| 14 | missing `tid` / malformed `tid` / platform principal | GET, detail, advance, cancel on A's instance; start `fG` | **403** for every call (`No tenant context…` / `Invalid tenant context…`) | none; `fG` count unchanged |
| 15 | service call, no ambient tenant | `get_workflow_state` / `cancel_workflow` / `transition` on A's instance | `None` / `False` / `success=False` | none (RLS hides the row → not found) |
| 16 | service call, no ambient tenant | same on a NULL instance | `None` / `False` / `False` | none (`AuthorizationDeniedError` … `core.workflow.read` / `cancel`) |
| 17 | service call, no ambient tenant | `trigger_workflow` on `fG` | raised `RuntimeUnavailableError: Authorization denied … core.workflow.start` | none |

**Blast radius in the test DB (read-only, `admin_session()`):**

| | Total | NULL-tenant |
|---|---:|---:|
| Foundation definitions | 273 | 97 (mostly earlier test seeds + this probe's `fG` / `fS_G`) |
| Foundation instances | 275 | 12 (**all created by this probe**: run 2 showed 2, both the probe's) |

### 4.3 Why rows 10 and 11 differ

- In shape (i), the instance is NULL but its history rows still belong to A.
- RLS on `workflow_instance_history` hides A's rows from C, so the cancel's next `sequence_number` collides with A's existing row. That makes the failure an **incidental unique-constraint error**, not authorisation.
- With history also NULL (shape ii), every check passes and the cancel commits.
- Code confirms the whole path admits it:
  - the route tenant gate passes (C has a tenant);
  - `FoundationRuntimeStrategy._dispatch` → `query(tenant=C)` skips the comparison because `execution.tenant_id is None`;
  - the authorize hook sees a tenant and `*.*.*`;
  - `get_instance` has no tenant predicate;
  - RLS admits NULL rows.
- **Advance / resume** uses the same `_dispatch` path, so it is exposed by the same mechanism (code inference). It could not be exercised over HTTP, because resume requires a `suspended` instance and suspend has no HTTP route.

### 4.4 Summary

| Question | Answer |
|---|---|
| Cross-tenant access to another tenant's **owned** definition or instance | **Not reproduced**: refused in both directions, no write |
| Tenant-less or platform access | **Not reproduced**: 403 over HTTP, denied at service level |
| Unsafe execution of a definition the tenant should not access | **Not reproduced**: foreign private definitions are "not found"; global ones are startable per policy |
| Access to **NULL-tenant** Foundation instances | **Reproduced**: read (with context) and cancel by unrelated tenants |

---

## 5. Existing test coverage (re-run individually, from `backend/`)

| File | Level | Result | Tenant cases asserted |
|---|---|---|---|
| `tests/unit/test_workflow_contract_tenant_security.py` | unit, real persistence (SQLite) | **12 passed** | cross-tenant read / transition / cancel / resume / history / definition lookup denied; missing ambient context does not bypass a real tenant |
| `tests/unit/test_integration_foundation_wiring.py` | unit | **7 passed** | wiring only |
| `tests/unit/test_workflow_foundation_authorization_binding.py` | unit | **4 passed** | action → permission binding |
| `tests/unit/test_n2b_s1_ownership_architecture.py` | AST guard | **31 passed** | pins `FoundationRuntimeStrategy.query` as the only remaining NULL-admitting function |
| `tests/unit/test_n2b_wb1_publication_tenancy.py` | unit | **19 passed** | bridge `_owning_tenant`; tenant-or-global resolution |
| `tests/integration/workflow/test_foundation_http_reachability.py` | real HTTP, SQLite | **2 passed** | cross-tenant GET → 404 on a Foundation instance |
| `tests/integration/workflow/test_registry_foundation_bridge.py` | service, SQLite | **9 passed** | promotion under the publisher's tenant |
| `tests/integration/workflow_postgres/test_n2b_wb1_publication_tenant_isolation.py` | real HTTP, PostgreSQL | **5 passed** | two tenants publishing one code stay separate |

- **Total:** 89 passed, 0 failed, 0 skipped.
- **Command per file:** `.venv/bin/pytest <file> -q -p no:cacheprovider`.
- **Playwright:** `studio-execute.spec.ts` runs Foundation execution (owner path only; 1/1 in WB-2.1 §2.5). There are no cross-tenant or NULL-tenant browser cases. Playwright was not re-run here.

**Gaps:**
1. **No test covers a NULL-tenant Foundation instance in either direction.** No test pins the current pass-through as intended either, so a fix changes no asserted contract.
2. **No PostgreSQL HTTP test** of Foundation cross-tenant instance operations exists. `test_foundation_http_reachability` is SQLite-only and covers GET only.
3. **No test** asserts the `tenant_id` field of a Foundation-routed instance response (W3-3).
4. **No test** covers the resolver with `tenant_id=None` when the authorize hook is absent. The hook is the only stop (W3-2).
5. **Not reachable from production:** Foundation task decisions and provider list methods have no production caller, so they have no HTTP coverage.

---

## 6. Findings

| ID | Severity | Finding | Evidence |
|---|---|---|---|
| **W3-1** | **HIGH** (write + read of another party's data; exploitability bounded) | Any tenant can **read** (incl. `context_data`) and **cancel** a NULL-tenant Foundation instance by id. Resume / advance uses the same path (inferred). | §4.2 rows 9, 11, 12; root cause `resolver.py:575–579` + `:439` + `foundation_runtime.py:446, 460` (no tenant predicate) + RLS admitting NULL. **Bounded:** no current path creates such rows (rows 14–17; bridge WB-1); 0 pre-existing in the test DB; ids are not listable over HTTP. Non-test data unknown. |
| **W3-2** | MEDIUM (defence in depth) | The resolver's `query` / `_dispatch` / `history` skip ownership when `tenant_id is None`. Isolation for tenant-less callers rests on the authorize hook (tenant presence) and RLS alone. A wiring without the hook (`authorize=None` → no-op, `foundation_runtime.py:796`) would admit them. | code; §4.2 rows 15–17 (currently denied) |
| **W3-3** | LOW (integrity of the response) | `GET /instances/{id}` and `POST /instances` for Foundation-routed instances set `tenant_id` from the **caller** (`workflow.py:122–148`, `_instance_response_from_state(..., tenant_id=user.tenant_id)`), not the owner. A NULL-owned instance is reported as owned by C, then by B. | §4.2 row 9 (`body tenant_id=C`), run 4 FULL-NULL rows (`=C`, `=B`) |
| W3-4 | INFO | The Foundation authorize hook checks tenant presence and RBAC, not subject ownership. This is by design: ownership is the resolver's job. W3-1 and W3-2 are where that split fails. | `impl.py:141–162` |
| W3-5 | INFO (policy) | Global (NULL) Foundation definitions remain startable by every tenant for enrolled codes; the instance becomes the starter's. This matches the Legacy D-2 convention and is not a defect. 97 such rows exist in the test DB (test seeds). The S4 / D-2 decision is still pending. | §4.2 rows 4–5 |
| W3-6 | INFO (latent) | Foundation provider methods (`list_instances` tenant Optional → unfiltered; `get_task`; `list_open_tasks_for_instance`; `_decide_task` without an ownership check) have **no production caller**. RLS is the backstop. They become relevant if they are ever exposed. | §2.2 |

- **On the critical-finding rule:** W3-1 was found inside a brief that already asks to reproduce and report. It is not live-reachable for creation, and the precondition (existing NULL rows) is unconfirmed outside the test DB. It is therefore reported here rather than escalated mid-run.

---

## 7. Remediation options (not implemented)

| Option | Change | Closes | Compatibility |
|---|---|---|---|
| **R1 (recommended, minimal)** | Make `FoundationRuntimeStrategy.query` strict, mirroring WB-2's Legacy fix: `owner = require_tenant(tenant_id)`; not found unless `execution.tenant_id == owner` (NULL is never owned). Make the pre-check in `_dispatch` and `history` **unconditional**. Drop the entry from S1's `_KNOWN_OUT_OF_SCOPE` (the guard then asserts **zero** NULL-admitting functions). | W3-1, W3-2 | HTTP callers always carry a tenant (WB-2 gate), so owners are unaffected. Tenant-less internal callers are already denied by the hook, so no legitimate caller breaks. Unit tests calling the strategy with `tenant_id=None` (e.g. `test_workflow_integration.py:192, 521, 536, 556, 667, 686, 703`) would need a tenant, as WB-2 did for Legacy. `start` keeps working: it re-queries the new instance, so it must pass the starter's tenant into `query`. |
| R1b | Also add an owned-by predicate in `FoundationWorkflowRuntime._handle_resume` / `_cancel` / `_suspend` / `_query_*` (the S1 `load_owned` pattern) | W3-1 at the runtime layer, independent of the resolver | Touches the Foundation engine; wider test impact; needs the tenant in the command (`StartWorkflowCommand` has it; resume / cancel commands do not, an SDK contract change). Larger than R1. |
| R2 | Return the owner's tenant (from `CanonicalWorkflowExecution.tenant_id`) in the Foundation instance response, or `None` if unknown, never the caller's | W3-3 | Response field value changes for Foundation-routed instances only. The frozen `WorkflowState` DTO has no tenant, so this needs the adapter or route to read it from the canonical execution. |
| R3 | Before any fix, a **read-only inventory** of NULL-tenant Foundation instances in each real environment | sizes W3-1's actual exposure | Needs separate authorisation for non-test DB access. No data change. |
| — | **Not recommended:** migrating, backfilling or deleting NULL-tenant Foundation rows | — | Forbidden by the programme's data constraints; a decision for S4 / WB-5. |

---

## 8. Scope and database confirmation

- **Application code:** none changed. `backend/app/api/v1/workflow.py` is byte-identical to its V-1.1 state (SHA `04072a6c…`).
- **Test code:** no test file in the tree was changed. The temporary probe was created and deleted (§4.1).
- **Database:** only the local Homebrew PostgreSQL 14 **test** database (`localhost:5432/erp_platform`) was used, via the test fixtures. No non-test database was accessed.
- **No changes to:** schema, migrations, RLS, grants, permissions, the token contract, or module state.
- **Test data left in place (no cleanup):** module `wb3_probe`, with random tenants per run, from 4 probe runs:
  - about 32 Foundation definitions with versions, nodes and transitions;
  - their instances, including 12 NULL-tenant instances (4 non-terminal), and history and token rows.
- **Unchanged:** V-1.1 and WB-2 behaviour.
- **Not started:** WB-4, WB-5 and S3.
- **No Git commit or push.**
- **Environment note:** the host volume filled during run 1 and the user freed space. No data was lost from the test DB apart from run 1's aborted inserts.

---

## 9. Proposed next phase (requires separate approval)

**WB-3.1 — Foundation instance strict ownership.**

1. **R1:** a strict `FoundationRuntimeStrategy.query`, plus unconditional ownership pre-checks in `_dispatch` and `history`, reusing `require_tenant`. Update the S1 guard to expect **no** NULL-admitting functions.
2. **R2 (optional, same phase or separate):** a correct `tenant_id` in Foundation instance responses.
3. **Tests:**
   - **PostgreSQL HTTP:** owner works; cross-tenant 404/400; a FULL-NULL instance gives GET 404 and cancel 400 with **no write**, for an unrelated tenant **and** for the original starter, matching WB-2's Legacy contract. Add a concurrency case for owner vs foreign cancel.
   - **Unit:** the strict strategy with `tenant_id=None` raises before any runtime call.
   - **SQLite (no RLS):** the same HTTP contract, so the application layer is proven on its own (the V-1.1 approach).
   - **Mutation tests:** revert each of the three checks individually.
4. **Separately (needs authorisation):** R3 read-only inventory of NULL-tenant Foundation instances in real environments.
5. **Out of scope, unchanged:** global-definition policy (S4 / D-2), R1b runtime-layer predicates (WB-5 candidate), Foundation task paths (no production caller).

## Files changed

- **Added:** `docs/architecture/reviews/N2B_WB3_FOUNDATION_RESOLVER_TENANT_ISOLATION_AUDIT.md`.
- **Created and deleted:** `backend/tests/integration/workflow_postgres/test_wb3_reproduction_probe.py` (temporary probe; copy in the session scratchpad).
