# N-2B WB-5 — `/workflow` Router Principal Guard Audit

**Date:** 2026-10-29
**Authorisation:** audit only. Read-only code inspection and re-running existing unit-tier tests (no database). **No implementation, no test changes, no data changes.**
**Source tree:** `~/Developments/My ERP/version 1.0` (backend `backend/app`). The evidence repository `~/Developments/bl-whish/ERP/reviews/` mirrors the N-2B reports; its copy of the S2.3 plan has the same WB-5 text (`:218`, `:310`, `:343`).

---

## 1. WB-5 scope

**Authoritative source:** `N2B_S2_3_DECISION_CLOSURE_AND_WORKFLOW_BOUNDARY_PLAN.md`.

| Location | Text |
|---|---|
| §4.2, `:218` | "**WB-5 — `/workflow` router principal guard. Small; can ride with S3.** Add `reject_platform_principal` to `api/v1/workflow.py`'s router; extend the S2 PG sweep to it." |
| §6, `:310` | WB-5 `/workflow` platform guard — **LOW**; owner decision **—**; phase "with S3"; blocks S3 **no**; tests "PG sweep"; **OPEN (planned)** |
| §7, `:343` | "WB-1 to WB-5: the tests listed per stage in §4.2." |
| §9, `:380` | the S3 scope must state WB-5 explicitly in or out |

**Exact objective:**
1. the `/workflow` router (`backend/app/api/v1/workflow.py`) carries `Depends(reject_platform_principal)` like every other tenant business router;
2. the S2 PostgreSQL sweep (`tests/integration/workflow_postgres/test_n2b_s2_platform_principal_http.py`) covers it.

**No owner decision is a prerequisite** (`:310`, "—"). The scope is known, so this is not *BLOCKED — SCOPE UNKNOWN*.

**Not WB-5 scope.** Other reports name "WB-5" loosely as a home for:
- R-4 (`N2B_WB2_LEGACY_INSTANCE_APPROVAL_OWNERSHIP_REPORT.md:317`, list reads by tenant-less callers);
- the list-read policy (`N2B_WB2_1_VERIFICATION_CLOSURE_REPORT.md:303`, `:321`);
- R1b (`N2B_WB3_1_…_FIX_REPORT.md:181`, "WB-5 candidate": no owned-by predicate inside `FoundationWorkflowRuntime`);
- NULL-row disposition (`N2B_WB3_…_AUDIT.md:240`).

None of these is in the authoritative plan's WB-5 text. R-4 and the list-read policy were closed by V-1.1 (§3). R1b and NULL-row disposition are **not audited here**. They stay with their own reports, and adding them would be a scope substitution the brief forbids.

---

## 2. Verdict

**CONDITIONAL GO (audit).**

| Meaning in this audit | |
|---|---|
| What it means | The WB-5 audit is complete. **No material security failure** exists in scope. A platform principal reaches no `/workflow` operation today: every one of the 9 routes refuses it with 403 before any lookup or write. Existing passing HTTP tests already pin this per route on PostgreSQL and SQLite (§6). |
| Why not GO | WB-5's own deliverable is **not in place** (W5-1). The refusal currently rests on two things: per-route tenant checks, and the invariant that a platform token never carries a `tid`, instead of the router-level principal guard the plan requires. The S2 sweep does not cover `/workflow` (W5-2). Also, the PostgreSQL evidence comes from the WB-4.1 run earlier today; it was not re-run in this phase (§7). |
| Why not NO-GO | No path was found, by code inspection or existing test, where a platform principal performs a `/workflow` operation. W5-1 is a defence-in-depth gap, not a reachable bypass. |
| What this does **not** authorise | Implementation of W5-1/W5-2, or S3. Both need separate authorisation (§9). |

---

## 3. Prerequisite and dependency verification

| Workstream | Relevance to WB-5 | Current state (verified in source) |
|---|---|---|
| S2 platform principal | defines `reject_platform_principal` and the PG sweep | guard present, `app/core/auth/dependencies.py:131–140`. Applied to 12 business routers (`application_flow.py:68`, `worklist.py:51`, `form_platform.py:67–68`, `capabilities.py:38`, `metadata.py:79`, `workflow_registry.py:73`, Studio `api/__init__.py:26`, Sales / HR / Accounting / Inventory `api.py`). **Not** on `api/v1/workflow.py:46`. |
| S2 token invariant | why platform callers are refused today | minting refuses platform + tenant (`app/core/auth/jwt.py:59–60`); decoding refuses a platform token carrying `tid` (`dependencies.py:77–79`, 401). So `user.tenant_id is None` for every platform principal. |
| S2.2 Registry boundary | sibling Workflow-domain router | `workflow_registry.py:73` already guarded; pinned by `test_n2b_s2_2_route_boundaries.py:56` |
| WB-2 | instance get/detail/advance/cancel, decide, start: strict tenant | present: `_workflow_execution_context` (`workflow.py:80–119`), inline `require_tenant` in `get_instance_detail` (`:289–292`) and `decide_approval` (`:416–419`) |
| V-1.1 | `/instances`, `/approvals/pending`, `/definitions` | `require_tenant_context` present (`workflow.py:232`, `:389`, `:445`); it refuses platform principals because they carry no tenant |
| WB-3.1 | Foundation-runtime routes via the resolver | strict ownership in the resolver, unchanged since WB-3.1 |
| TenantContextMiddleware | could a platform caller gain a tenant another way? | no. Tenant sources are upstream `request.state.tenant_id` or the verified JWT `tid` (`app/core/multi_tenancy/middleware.py:98–119`); the `X-Tenant-ID` header was removed (`:32–43`). Every `/workflow` route reads the tenant from `user.tenant_id`, not the ambient context. |

`workflow.py` was last modified 2026-10-28 15:43 (V-1.1) and `dependencies.py` 2026-10-13. Neither changed after the PostgreSQL run cited in §6.

---

## 4. Files and code paths inspected

- `backend/app/api/v1/workflow.py`, the router (`:46`) and all 9 routes. Each route was enumerated at import time (no DB):

  | Route | Route-level dependencies (in order) | Tenant / principal refusal |
  |---|---|---|
  | `POST /instances` | `get_db_session`, `require_permission`, `_workflow_execution_context` | 403, no tenant (`:96–108`) |
  | `GET /instances` | `get_db_session`, `require_permission`, `require_tenant_context` | 403, no tenant |
  | `GET /instances/{id}` | `get_db_session`, `require_permission`, `_workflow_execution_context` | 403 |
  | `GET /instances/{id}/detail` | `get_db_session`, `require_permission` | inline `require_tenant` → 403 (`:289–292`) |
  | `POST /instances/{id}/advance` | `get_db_session`, `require_permission`, `_workflow_execution_context` | 403 |
  | `POST /instances/{id}/cancel` | `get_db_session`, `require_permission`, `_workflow_execution_context` | 403 |
  | `GET /approvals/pending` | `get_db_session`, `require_tenant_context` | 403 |
  | `POST /approvals/{id}/decide` | `get_db_session`, `require_permission` | inline `require_tenant` → 403 (`:416–419`) |
  | `GET /definitions` | `get_db_session`, `require_permission`, `require_tenant_context` | 403 |

  Router-level `dependencies`: `[]`. `reject_platform_principal` is on **none** of the 9 routes.
- `backend/app/api/v1/__init__.py:18`, `:44`: the router is mounted once, at `/workflow`; no other router is included under that prefix.
- `backend/app/core/auth/dependencies.py`: `get_current_user` (`:70–88`), `reject_platform_principal` (`:131–140`), `require_tenant_context` (`:143–152`).
- `backend/app/core/auth/jwt.py`: `PrincipalScope`, `create_access_token` (`:23–78`).
- `backend/app/core/multi_tenancy/middleware.py`: `_resolve_tenant` (`:98–119`).
- Tests:
  - `tests/unit/test_n2b_s2_platform_principal.py:221–269`, the `_BUSINESS_ROUTERS` static pin and the recorded S2 boundary;
  - `tests/integration/workflow_postgres/test_n2b_s2_platform_principal_http.py`, the S2 PG sweep;
  - the platform-caller loops in `test_n2b_wb2_legacy_instance_ownership.py` (PG), `test_n2b_wb3_1_foundation_instance_ownership.py` and `test_n2b_v1_1_workflow_list_tenant_context.py` (SQLite, each re-collected on PG);
  - `tests/integration/test_n2b_s2_login_principal_scope.py:45–60`.

---

## 5. Findings

| ID | Severity | Code path | Invariant expected | Observed | Status |
|---|---|---|---|---|---|
| **W5-1** | LOW (defence in depth) | `api/v1/workflow.py:46`: `router = APIRouter()` | Like every tenant business router, `/workflow` refuses a platform principal **because it is a platform principal**, at router level, before any route dependency (S2.3 `:218`) | No router-level guard; no route carries `reject_platform_principal`. Platform callers are refused only because they carry no tenant. This holds today because of two independent mechanisms: the token invariant (§3), and a per-route tenant check that each of 9 handlers implements separately (three different styles). A future route added without a tenant check would be reachable by a platform `*.*.*` token. | **Confirmed by code inspection** (route enumeration, §4). Not exploitable today (§6). |
| **W5-2** | LOW (test gap) | `test_n2b_s2_platform_principal_http.py` `_routers()`; `test_n2b_s2_platform_principal.py` `_BUSINESS_ROUTERS` | The S2 sweep enumerates `/workflow` routes at run time and asserts the guard is present plus a 403 "tenant business" refusal (S2.3 `:218`) | Neither the PG sweep nor the static pin lists `api/v1/workflow.py`. `test_platform_and_workflow_routers_are_not_business_guarded_in_s2` (`:261–269`) records `/workflow` as deliberately unguarded in S2 (its docstring; its assertions only cover `/modules`). Per-route platform 403s are pinned elsewhere (§6), but no test would catch a **new** unguarded `/workflow` route. | **Confirmed by code inspection** |
| **W5-3** | INFO (compatibility note for implementation) | 403 detail text | n/a | Today a platform caller on `/workflow` gets "No tenant context resolved for this workflow request" / "No tenant context resolved for this operation" / the `TenantRequiredError` text. With the guard it would get "Platform principals cannot perform tenant business operations; …". No backend test or frontend source asserts the current `/workflow` texts (grep over `backend/tests`, `frontend/shell/src`, `frontend/shell/e2e`); the existing `/workflow` platform assertions check **status only**. Status codes do not change (403 → 403). | Established by code search |
| **W5-4** | INFO | ordering | n/a | A router-level dependency runs before route dependencies. With the guard added, a platform caller would be refused before `require_permission`; today `require_permission` runs first and passes on `*.*.*`. Status is unchanged; tenant callers are unaffected (`reject_platform_principal` only inspects `principal_scope`). | Code inspection |

No finding was **reproduced** as a vulnerability. No CRITICAL, HIGH or MEDIUM finding.

---

## 6. Test evidence

**Run in this phase** (2026-10-29; unit tier, no database; disk free before the run: 1.9 GiB):

```
cd backend && .venv/bin/pytest -q -p no:cacheprovider \
  tests/unit/test_n2b_s1_ownership_architecture.py tests/unit/test_n2b_s2_platform_principal.py \
  tests/unit/test_n2b_s2_1_platform_authorization.py tests/unit/test_n2b_s2_2_route_boundaries.py \
  tests/unit/test_n2b_permission_identity.py tests/unit/test_n2b_wb2_legacy_instance_ownership.py \
  tests/unit/test_n2b_wb3_1_foundation_strict_ownership.py
→ 213 passed, 1 warning  (31 + 49 + 40 + 15 + 2 + 14 + 62); 0 failed, 0 skipped, 0 xfail
```

Route enumeration (import only, no DB) also ran in this phase: 9 routes, router `dependencies=[]`, guard on 0 routes (§4).

**Existing HTTP evidence that platform principals are refused on every `/workflow` route.** This is the WB-4.1 full PostgreSQL run of 2026-10-29 (43 files one per invocation, 424 passed + 1 xfail N-2, 0 failed) and SQLite workflow tier (210 passed, 5 skipped). It was **not re-run in this phase**:

| Route(s) | Test | Engine | Assertion |
|---|---|---|---|
| get, detail, advance, cancel, decide, start | `test_n2b_wb2_legacy_instance_ownership.py::test_missing_platform_and_malformed_tenant_contexts_fail_before_any_write` | PG | platform token → 403 on all 6; instance count and row snapshots unchanged |
| get, detail, advance, cancel (Foundation) | `test_n2b_wb3_1_foundation_instance_ownership.py` (`_bad_callers`, platform included) | SQLite + PG (re-collected) | 403 on all 4 |
| `/instances`, `/approvals/pending`, `/definitions` | `test_n2b_v1_1_workflow_list_tenant_context.py::test_list_routes_refuse_callers_without_a_valid_tenant[*-platform]` | SQLite + PG (re-collected) | 403 |

Together they cover all 9 routes with a real signed platform JWT over real HTTP. They prove **status 403**, not the reason. They do **not** prove the router-level guard WB-5 requires, and per W5-2 they do not cover routes added in future.

**Not run in this phase:**
- PostgreSQL and SQLite integration tests (they create rows, which this brief forbids);
- the S2 PG sweep (it does not cover `/workflow`, so it is not evidence for this scope);
- full unit suite, Playwright, Vitest (unrelated to scope; disk at 100 %).

---

## 7. Unverified risks

| Risk | Why not verified |
|---|---|
| A fresh PostgreSQL confirmation of the §6 table in this phase | The tests insert instance, approval and definition rows; the brief forbids record creation. The cited run was earlier today, against unchanged `workflow.py` and `dependencies.py` (§3). |
| A non-HTTP caller using a platform `UserContext` against the Workflow engine | Out of WB-5 scope (router guard). Internal callers do not pass through the router guard either way. |
| Whether the frontend calls `/workflow` as a platform user (UX effect) | Status is already 403 today, so the guard would change no visible behaviour. Not exercised in a browser here. |

---

## 8. Remediation recommendations (no code changed)

1. **W5-1:**
   - In `api/v1/workflow.py:46`, use `router = APIRouter(dependencies=[Depends(reject_platform_principal)])  # N-2B S2: tenant business router`, matching the 12 existing routers.
   - Keep every per-route tenant check; the guard adds to them and replaces none.
2. **W5-2:**
   - Add `("/api/v1/workflow", workflow_router)` to `_routers()` in the S2 PG sweep.
   - Add `("app/api/v1/workflow.py", "router")` to `_BUSINESS_ROUTERS`.
   - Update the docstring of `test_platform_and_workflow_routers_are_not_business_guarded_in_s2` so it no longer names `workflow`. Its assertions cover only `/modules` and stay as they are.
   - The sweep's `len(checked) > 100` floor stays valid (it only grows, by 9).
3. **Tenant compatibility:**
   - Run the PG `test_tenant_principals_keep_their_business_access` pattern with a tenant `*.*.*` user on `/workflow/instances` and `/workflow/definitions` → 200.
   - Re-run the WB-2, WB-3.1 and V-1.1 PG files and the SQLite workflow tier. Their platform cases should stay 403; only the detail text changes (W5-3).
4. **Mutation check for the implementation phase:** remove the router guard and confirm the sweep's static assertion (`reject_platform_principal in route.dependant.dependencies`) fails. The per-route 403s alone would **not** catch it, because the tenant checks still refuse.
5. Schedule it standalone or "with S3" as S2.3 `:218` allows. It does not block S3 (`:310`).

---

## 9. Separate authorisations required

- **Implementing W5-1 and W5-2:** application code plus test changes. Not authorised by this audit.
- **Running the PG and SQLite integration verification above:** it creates local test rows.
- **S3:** not started and not unblocked by this report. The S3 scope must still state whether WB-5 rides with it (S2.3 §9 `:380`).

---

## 10. Confirmations

- **Changed in this phase:** this report only. No application code, test, configuration, migration, schema, RLS, grant, permission or module-state change.
- **Database:** no database was accessed in this phase; the test run and the route enumeration used no database. No non-test database was accessed. No records were created, updated, deleted or counted.
- **Earlier data:** earlier probe and test data (`wb3_probe`, `wb41_*`) was left untouched.
- **Not done:** no S3 work, no commit, no push.
- **Reports index:** none was updated. `docs/architecture/reviews/` has no index file. Earlier audits (WB-3, WB-4) got their cross-reference only when the follow-up implementation report was written, so the S2.3 plan was left unchanged.
