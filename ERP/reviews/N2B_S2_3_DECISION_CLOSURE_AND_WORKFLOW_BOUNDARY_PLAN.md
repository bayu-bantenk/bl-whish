# N-2B S2.3 — Decision Closure and Workflow Boundary Plan

**Date:** 2026-10-15
**Type:** audit and planning only. No application code, test, schema, migration, seed, configuration or data change. No service started or stopped.
**Sources:**
- `N2B_S2_2_ROUTE_CLASSIFICATION_AND_PRINCIPAL_BOUNDARIES.md`, `N2B_AUTH_CONTRACT_TOKEN_MINTING_FIX_REPORT.md`, `N2B_PERMISSION_IDENTITY_MIGRATION_PLAN.md`;
- the N-2B plan and the S1/S2/S2.1 reports;
- the code and the **local test database** (`erp_platform` on localhost, read-only `SELECT`s).

**Evidence labels:** **[V]** verified in code or by a read-only query in this phase; **[R]** recommendation; **[A]** assumption.

---

## 1. Executive Decision

- **Overall verdict: CONDITIONAL GO for the plan; S3 is NO-GO** (§9).
- **Decisions D-1 to D-7:**
  - **3 can be closed from evidence** and the user-agreed S2.2 default rules: D-4, D-5, D-6;
  - **1 is deferred** with no S3 impact: D-7;
  - **3 stay OPEN** for a product or domain owner: D-1, D-2, D-3.
- **Migration decisions:**
  - **C-D1 and C-D3 can be closed** from evidence;
  - **C-D2 is OPEN** with a firm recommendation.
- **New finding W-1, priority HIGH (candidate CRITICAL), verified by code reading, not reproduced** (reproducing it would write data, which this phase forbids):
  - Studio publishes every tenant's workflows into one shared Registry bucket keyed by the user-chosen `definition_code`.
  - The Registry→Foundation bridge turns that bucket into **global** (NULL-tenant) Foundation definitions, which **any tenant can start**.
  - A tenant that names its own draft with another tenant's `definition_code` and publishes it adds and activates a **new version of the other tenant's executed workflow**.
  - This is a cross-tenant integrity defect. It must be reproduced and fixed in a dedicated Workflow Boundary phase (§4, stage WB-1). It is the most severe open item in N-2B.
- **Current state checked:**
  - S2.2's changes are present in the tree (registry, audit, scheduler, metadata, system, health, dashboard and issuance markers checked by grep).
  - The repository has **no commits**, so there is no history to diff against.
  - Unit pins run in this phase: **137 passed** (§7).

---

## 2. Evidence and Code References

### 2.1 Workflow paths (all [V])

| Path | Code | Tenant behaviour |
|---|---|---|
| Studio publish → Registry | `app/modules/workflow_studio/publishing/stages.py:182` (PublishStage calls `publish_definition` **without** `tenant_id`) → `publishing/registry_gateway.py:144` (`effective_tenant_id = tenant_id or _NO_TENANT_SENTINEL`) → `get_definition_by_name(code, module, sentinel)` | every publication goes into the **zero-UUID sentinel** bucket, looked up by `(definition_code, module)`; an existing definition is **reused** and a new version is added |
| Registry → Foundation | `app/core/workflow/registry_foundation_bridge.py:114` `_translate_tenant` (sentinel → **NULL**) → `persistence/service.py:177` (`get_by_registry_id`, create with `dto.tenant_id`) | Studio publications become **NULL-tenant (global)** Foundation definitions |
| Foundation start | `engine_execution/foundation_runtime.py:402` `_handle_start` → `persistence/repositories.py:53` `get_by_name_tenant_or_global` | resolves `tenant OR NULL`, preferring the exact tenant; any tenant can start a global definition; the instance gets `tenant_id = command.tenant_id` |
| Foundation query | `integration/resolver.py` `FoundationRuntimeStrategy.query` (≈ line 558 in the file) | blocks cross-tenant only when **both** sides are non-None. A caller with `tenant_id=None` sees **every** instance (latent; the `/workflow` routes that reach it are gated by `_workflow_execution_context`, `api/v1/workflow.py:79`, which returns 403 without a tenant) |
| Legacy start | `engine.py:713` `_load_definition` | `tenant OR NULL`; module-provisioned definitions are NULL by declaration (`core/workflow/provisioning.py:94,104`) |
| Legacy instance load | `engine.py:767` `_load_instance` (line 797) | `instance.tenant_id is not None and != tenant`: **NULL-tenant instances are reachable and mutable by any tenant** (the "G idiom", pinned by `test_n2b_s1_ownership_architecture.py:274-276`) |
| Legacy approval decision | `engine.py:361` `decide_approval` | same G idiom; NULL-tenant approvals can be decided by any tenant |
| `/workflow` routes | `api/v1/workflow.py` | start / get / advance / cancel go through `_workflow_execution_context` (403 without a tenant); list / detail / pending / decide / definitions pass `tenant_id=None` for a tenant-less caller (fail-closed for tenant rows, global rows visible). The router has **no** `reject_platform_principal` |
| Registry HTTP | `api/v1/workflow_registry.py` (S2.2) | owner-only mutations; reads admit NULL + sentinel; create forced to the caller's tenant |
| Studio templates | `templates/service.py:70` `create_template` sets no tenant → `infrastructure/repositories.py:235` → `mappers.py:201` `tenant_id=dto.tenant_id` (None) | **always global**. `is_builtin` comes from the request body (`api/schemas.py:142`). Update/delete use `_load_owned_or_raise` (S1) → **404 for everyone**. List/get admit NULL rows |
| Worklist / flows | `core/application_flow/worklist.py:198,222` (SQL `tenant_id == tenant_uuid`); `:252` S1 `load_owned` for actions | strict for tenants; for a tenant-less caller `== None` compiles to `IS NULL` (plan F-5; read path) |

### 2.2 Data distribution, local test DB only (all [V]; these are test artefacts, not production evidence)

| Table | Rows | `tenant_id IS NULL` |
|---|---|---|
| `workflow.wf_definitions` (Legacy) | 2,210 | 765 |
| `workflow.workflow_definitions` (Foundation) | 140 | 71 (= Studio publications via the bridge, plus tests) |
| `workflow.wf_registry_definitions` with the sentinel tenant | 89 | n/a |
| `workflow.wf_instances` / `wf_approvals` | 3,735 / 3,661 | 117 / 117 |
| `workflow.workflow_instances` (Foundation) | 148 | 0 |
| `workflow_studio.workflow_studio_templates` | **0** | 0 |
| `gateway.gateway_metrics` | 40,953 | **40,953** |
| `auth.permissions` | 34 | `module_name` NULL: 0; `scope='*'`: 34 |

Real (production or shared) databases were **not** inspected; there is no authorization for that (N-2A O-1 still open).

### 2.3 Other route facts (all [V])

- **Gateway metrics:** the middleware records `endpoint, method, status_code, response_time_ms, user_id, ip_address`, and **never a tenant** (`core/gateway/middleware.py:76-84`). The summary (`core/gateway/service.py:240`) returns totals, status counts, **top endpoints (raw paths, which can contain record ids)**, average latency and error rate.
- **`/ws/stats`** (`api/v1/ws.py:140`, unauthenticated) returns `total_connections`, `unique_users`, `unique_tenants`, `active_topics` (`core/realtime/connection_manager.py:192`). Its only consumer is `tests/unit/test_realtime.py:353`; it is not referenced by Kubernetes, Docker, compose or nginx.
- **Permissions:** there is **no HTTP route that creates or changes permissions**; the only writer is `scripts/seed_worklist_e2e.py`. `GET /system/permissions` reads the in-memory registry.
- **Scheduler:**
  - the runner starts at engine init (`core/runtime/engine.py:331,442`);
  - **no handler is registered anywhere in the app** (the only `register_handler` call is a docstring example), so since S2.2 every job fails closed;
  - the router is platform-only.
- **Dashboards:** the shell home calls `GET /dashboard/dashboards/default` (`frontend/shell/src/pages/DashboardPage.tsx:260`), which runs `get_or_create_default(user_id, tenant_id)` and creates a per-user row; `user_dashboards` has 3 NULL rows locally.
- **Metadata:** no frontend caller; 0 rows locally in `meta_models` / `form_schemas` / `table_schemas` / `ui_layouts`.

---

## 3. Decision Register D-1 to D-7

**Status values:**
- **CLOSED:** the policy follows from evidence plus the user-agreed S2.2 default rules ("public statistics must not reveal sensitive operational or cross-tenant information"; "platform-only operations require the signed platform principal"; "business data operations require a tenant-scoped principal"). The *policy* is settled; implementation still needs an approved phase.
- **OPEN:** needs a product or domain owner.
- **DEFERRED:** no current impact.

### D-1 Metadata ownership and tenant-less / global creation — **OPEN**

- **Existing [V]:**
  - router `reject_platform_principal`;
  - creates refuse a foreign body `tenant_id` (S2.2);
  - an **omitted** `tenant_id` still creates a NULL row (`metadata_engine/service.py:127,137`);
  - update/delete by id rely on RLS, which admits NULL rows, so any tenant manager can edit or delete global metadata.
- **Implication:** a tenant can create or alter metadata visible to every tenant (cross-tenant influence). Today there are 0 rows and no UI caller.
- **[R] Policy:** tenant metadata is tenant-owned. Create forces the caller's tenant (S2.2 Registry pattern); update/delete are owner-only (S1 `load_owned`). If global metadata is needed it becomes platform-managed through a separate platform-only path.
- **Owner question:** does any product feature need **global** metadata (module-shipped form or table schemas)? Code doesn't answer this; there's no seeding of global metadata in the repo.
- **Implementation:** `api/v1/metadata.py` (4 creates, 16 mutations) plus PG tests (tenant B 404 on mutations; global row immutable by tenants; create carries the caller's tenant).
- **Blocks S3:** no (metadata is not in S3's F-2 list). It **should be added to S3's scope or follow it as S3b** [R].

### D-2 Workflow Registry and Studio publication ownership — **OPEN** (owner decision needed; see W-1)

- **Existing [V]:** §2.1 rows 1–3. All publications share the sentinel bucket by `definition_code`; Foundation definitions are global.
- **Implication:**
  - cross-tenant **integrity** defect (W-1): one tenant can version and activate another tenant's executed workflow;
  - cross-tenant **availability**: every tenant can start every published workflow.
- **[R] Policy:** a Studio publication belongs to the workspace's tenant. The Registry definition and Foundation definition carry that tenant; `definition_code` is unique **per tenant**. A genuinely shared, platform-owned workflow would be published only by a platform path.
- **Owner question:** is any Studio-published workflow meant to be shared across tenants? Existing global rows are **not** evidence of that intent [A: they are test and E2E artefacts].
- **Implementation:** §4 WB-1.
- **Blocks S3:** no; S3 only refuses tenant-less creates. But W-1 is **more severe than anything S3 closes**, so WB-1 is recommended **before or in parallel with** S3 [R].

### D-3 Dashboards for a platform principal — **OPEN**

- **Existing [V]:** the shell home creates a NULL-tenant per-user dashboard for a platform user (§2.3).
- **Implication:** low. The rows are per-user (service-enforced by `user_id`) but are global rows under RLS.
- **Options:**
  - (a) reject platform principals on `/dashboard`, with the shell showing a platform landing page instead (frontend change);
  - (b) allow per-user NULL dashboards for platform users (status quo).
- **[R]:** (b) for now, with explicit acceptance, because (a) needs a UX decision.
- **Blocks S3:** **yes, conditionally.** If S3's "refuse tenant-less creates" is applied to `/dashboard`, platform users' home page breaks. S3 must either exclude `/dashboard` or wait for this decision.

### D-4 Permission catalog visibility and mutation — **CLOSED**

- **Evidence [V]:** no HTTP mutation path exists; `GET /system/permissions` returns codes and names only, with no tenant data.
- **Policy:** visibility stays at `core.system.read` (catalog, non-sensitive); **mutation stays non-existent over HTTP**, and any future write path must be platform-only (`require_platform_permission`).
- **Implementation:** none now. A static pin that no route writes `auth.permissions` is recommended (WB-T, §7).
- **Blocks S3:** no.

### D-5 Gateway metrics isolation — **CLOSED: platform-only**

- **Evidence [V]:**
  - 100 % of `gateway_metrics` rows have NULL `tenant_id` because the middleware never records it;
  - the summary therefore aggregates **all tenants'** traffic, including raw endpoint paths, for any `*.*.*` tenant caller;
  - a tenant-scoped view is **impossible** with the current data.
- **Policy:** `GET /gateway/metrics/summary` becomes `require_platform_permission("core.gateway.admin")`.
- **Optional later:** record `tenant_id` and offer a tenant view (needs a product decision; deferred).
- **Implementation:** one dependency in `api/v1/gateway.py`, plus a unit test (tenant `*.*.*` → 403, platform → 200) and an update of the S2.1 pin `test_no_route_anywhere_authorizes_a_platform_admin_code_by_permission_alone` (expected list becomes empty).
- **Blocks S3:** no.

### D-6 WebSocket statistics exposure — **CLOSED: no cross-tenant counts on a public endpoint**

- **Evidence [V]:** unauthenticated; returns `unique_tenants` and `unique_users`; no infrastructure consumer.
- **Policy:** `/ws/stats` requires the signed platform principal.
- **[R] / owner choice:** if anonymous monitoring needs a liveness signal, `/health/live` already provides it. The policy is decided; the option (platform-only vs. public `total_connections` only) is an implementation detail recommended as platform-only.
- **Implementation:** `api/v1/ws.py:140` adds `Depends(require_platform_admin)`; update `tests/unit/test_realtime.py:353` to use a platform token, and add negative tests.
- **Blocks S3:** no.

### D-7 Scheduler tenant execution context — **DEFERRED**

- **Evidence [V]:** platform-only router; **zero registered handlers**, so no job can execute; jobs run without ambient tenant context.
- **Policy, when the first handler is introduced:**
  - a job with a real `tenant_id` runs inside `TenantContext(tenant)`;
  - a NULL job runs as a system job;
  - the handler declares which kinds it accepts;
  - the body `tenant_id` must name an existing tenant.
- **Implementation:** deferred to the first handler.
- **Blocks S3:** no.

---

## 4. Workflow Ownership and Remediation Plan

### 4.1 Ownership classification (from code and declaration evidence)

| Object | Owner | Evidence | Status |
|---|---|---|---|
| Foundation / Legacy **instances**, approvals, tasks, flow instances | the starting tenant | `tenant_id = command.tenant_id` (`foundation_runtime.py:426`); Legacy start | **tenant-owned** [V] |
| Registry definitions created via HTTP | the caller's tenant | S2.2 forced | **tenant-owned** [V] |
| Studio-published Registry / Foundation definitions | **undetermined.** Stored as sentinel/NULL (shared) | §2.1 | **OPEN (D-2).** Rows are **not** assumed to be shared templates |
| Module-provisioned Legacy definitions (`provisioning.py`, `tenant_id=None` declared by the module's migration) | platform / module | declared in code by the module itself | **platform-provided by declaration** [V]. Only those exact definition names qualify, not every NULL `wf_definitions` row [A: most of the 765 NULL rows are test artefacts] |
| Studio templates | **undetermined.** Always created global; no platform seeding code exists; 0 rows | §2.1 | **OPEN (B-3)** |
| NULL-tenant Legacy instances and approvals (117 / 117 locally) | none (orphans) | the G idiom lets any tenant advance or decide them | to be **closed to every tenant** [R] |

### 4.2 Staged remediation (exact targets; nothing implemented in this phase)

**WB-1 — Studio publication tenancy (fixes W-1 / D-2). Before or in parallel with S3; separate Workflow Boundary phase.**
- **Files and methods:**
  - `publishing/stages.py` `PublishStage.run`: pass `tenant_id = draft/workspace tenant`;
  - `publishing/registry_gateway.py` `publish_definition`: require a real tenant from Studio; keep the sentinel only for an explicit platform publish path, if the owner approves one;
  - `registry_foundation_bridge.py` `_translate_tenant`: unchanged semantics, now fed real tenants;
  - `version_router.py` and the publish/archive routes: tenant-scoped registry lookups.
- **Expected behaviour:**
  - tenants A and B may both use `definition_code="x"` and get two definitions;
  - B's publish never versions A's definition;
  - B cannot start A's definition (`get_by_name_tenant_or_global` finds A's only for A).
- **Existing rows:** the 89 sentinel definitions and 71 global Foundation definitions are **not** migrated automatically. They need an owner decision (assign to the publishing workspace's tenant, which is traceable through Studio `published_version` links, or retire them). This is plan-only; no backfill.
- **Tests:**
  - PG: two tenants publish the same code and get distinct Registry and Foundation definitions; cross-tenant start → not found; cross-tenant version history 404;
  - Playwright `studio-execute`, `studio-history-version`, `studio-validate-publish`.
- **Dependencies:** owner answer to D-2; the frontend `registryApi.findDefinitionIdByCode` keeps working (it lists by module, and the tenant's own rows are visible).

**WB-2 — Legacy G idiom on instances and approvals. Separate Workflow Engine phase; not S3-blocking.**
- **Files and methods:** `engine.py` `_load_instance` (line 797) and `decide_approval` (line 361) become `instance.tenant_id != tenant` with `tenant` required, i.e. the S1 `load_owned` pattern.
- **Expected behaviour:**
  - NULL-tenant instances and approvals are **mutable by no tenant**;
  - reads of global rows are an S4 question;
  - internal tenant-less callers (if any) must pass an explicit system context. They need enumeration first: [A] that none exist beyond the routes is **not verified**.
- **Tests:**
  - PG: tenant A cannot advance, cancel or decide a NULL instance;
  - update the S1 pin list (`test_n2b_s1_ownership_architecture.py:274-276`) to remove those entries;
  - re-run `tests/integration/workflow` (SQLite) and the Sales/Accounting flow PG files one per invocation.

**WB-3 — Foundation query tenant-less admit-all. With WB-2.**
- **File:** `integration/resolver.py` `FoundationRuntimeStrategy.query`, so that a `tenant_id=None` caller sees only NULL-tenant instances (Legacy parity) or is refused.
- **Tests:** unit and PG (`query(tenant_id=None)` on a tenant instance → not found).
- Enumerate every caller of `IRuntimeStrategy.query` / `history` before changing it.

**WB-4 — Studio templates (B-3). Owner decision first; touches S3.**
- **Option T1 (tenant templates):**
  - `create_template` takes the caller's tenant (`template_router.py:37` → service → mapper);
  - `is_builtin` is honoured **only** for a platform publish path;
  - list/get admit own + platform-builtin rows; update/delete stay owner-only.
- **Option T2 (platform templates):** template writes become platform-only; tenants read only.
- **Tests:** PG create/update/delete by the owner; another tenant 404; `is_builtin` from a tenant body refused or ignored; Playwright Studio specs.

**WB-5 — `/workflow` router principal guard. Small; can ride with S3.** Add `reject_platform_principal` to `api/v1/workflow.py`'s router; extend the S2 PG sweep to it.

---

## 5. Permission Identity Migration (Workstream C)

### 5.1 Decisions

- **C-D1 `module_name` NOT NULL: CLOSED (recommend NOT NULL).**
  - **Evidence [V]:** 0 NULL rows; the only writer (the seed) always sets it; a NULL row silently derives `*.resource.action`, a **cross-module wildcard** (`tests/unit/test_n2b_permission_identity.py`).
  - A deliberate cross-module grant remains expressible **explicitly** as `module_name='*'`. That derives the same code, so NOT NULL removes no capability, only the implicit form.
- **C-D2 `scope` in the unique identity: OPEN (recommend excluding it).**
  - **Evidence [V]:** `scope` is **never read** by authorization (codes are `module.resource.action`; RBAC matches codes only); all 34 rows are `'*'`; only the seed writes it.
  - Keeping `scope` in the key would let two rows with the **same authorization code** coexist (differing only in an unused column): an ambiguous duplicate identity.
  - **[R]:** unique `(module_name, resource, action)` plus `CHECK (scope = '*')` until `scope` gains a defined meaning.
  - **Owner question:** does `scope` have a planned semantic (for example a row-level scope)? If yes, keep it in the key and define its derivation first.
- **C-D3 ordering: CLOSED.** As in the S2.2 plan §3:
  1. pre-flight;
  2. create the new unique index `CONCURRENTLY` and check `indisvalid`;
  3. NOT NULL via `CHECK … NOT VALID` → `VALIDATE` → `SET NOT NULL`;
  4. model and seed release that works against both schemas;
  5. drop the old constraint in a **later** release;
  6. post-checks.

  No window exists without a uniqueness guarantee, because the new key is strictly weaker than the old one while both exist.

### 5.2 Pre-flight checks (to run on an **explicitly authorized** database; results here are local-test only)

**Kept from S2.2** (verbatim in `test_n2b_permission_identity_preflight.py::PREFLIGHT`):
- **P1:** duplicate identity under the proposed key;
- **P2:** NULL `module_name`;
- **P3:** dangling `role_permissions`.

**Added in S2.3 (plan only; not added to tests):**

```sql
-- P1' duplicate identity under the C-D2 recommendation (scope excluded)
SELECT module_name, resource, action, COUNT(*) FROM auth.permissions
GROUP BY 1, 2, 3 HAVING COUNT(*) > 1;

-- P5 invalid module_name / resource / action shape (empty, whitespace, upper case, dots)
SELECT id, module_name, resource, action FROM auth.permissions
WHERE module_name !~ '^(\*|[a-z][a-z0-9_]*)$'
   OR resource !~ '^[a-z][a-z0-9_.]*$'      -- resource may contain a dot (e.g. workflow.node)
   OR action   !~ '^[a-z][a-z0-9_]*$';

-- P6 scope values other than '*' (blocks the CHECK in C-D2)
SELECT scope, COUNT(*) FROM auth.permissions WHERE scope <> '*' GROUP BY 1;

-- P7 id / reference snapshot (taken before, compared after; must be identical)
SELECT p.id, p.module_name, p.resource, p.action, p.scope,
       COUNT(rp.role_id) AS grants
FROM auth.permissions p LEFT JOIN auth.role_permissions rp ON rp.permission_id = p.id
GROUP BY p.id ORDER BY p.id;

-- P8 role_permissions preservation fingerprint
SELECT COUNT(*), md5(string_agg(role_id::text || ':' || permission_id::text, ',' ORDER BY role_id, permission_id))
FROM auth.role_permissions;
```

- **P4 (application-side):** every stored code is declared in code. `module_name` is a **namespace** (for example `studio`), not a `core.modules` row.
- **Application compatibility during rollout:**
  - the release before step 5 must look permissions up by the **full identity** and must still work against the old constraint (it never relies on `(resource, action, scope)` uniqueness);
  - login derivation is unchanged;
  - V3 (derived codes per user, before vs. after) is the acceptance check.
- **Rollback:**
  - steps 2–3 are reversible;
  - step 5 is **irreversible once a second module's same-named row exists**, because re-creating the old constraint fails and resolving it would CASCADE-revoke grants;
  - never write a downgrade that deletes rows;
  - keep step 5 in its own release.

---

## 6. Dependency and Readiness Matrix

| Item | Severity | Required evidence | Implementation phase | Blocks S3 | Required verification | Status |
|---|---|---|---|---|---|---|
| A-C1 Registry cross-tenant (S2.2) | CRITICAL | done (PG) | S2.2 | — | PG 5 tests | **CLOSED** |
| A-C2 Audit cross-tenant (S2.2) | CRITICAL | done (PG) | S2.2 | — | PG 3 tests | **CLOSED** |
| A-C3 Scheduler dynamic import (S2.2) | CRITICAL | code reading; not demonstrated | S2.2 | — | unit 65 | **CLOSED** |
| Auth contract minting (S2.2 B) | HIGH (dormant) | done (SQLite + PG) | S2.2 | — | 8 + 1 tests | **CLOSED** |
| **W-1 Studio publication shares definitions across tenants** | **HIGH / candidate CRITICAL** | reproduce in PG (two tenants, same code); owner D-2 | WB-1 (Workflow Boundary phase) | no (recommended before or in parallel) | PG + Playwright Studio | **OPEN** |
| D-1 Metadata global rows | MEDIUM | owner: is global metadata needed? | S3b / with S3 | no | PG owner-only mutation | **OPEN** |
| D-2 Publication ownership | HIGH | owner answer | WB-1 | no | as W-1 | **OPEN** |
| D-3 Platform dashboards | LOW | owner UX decision | S3 (scope) | **yes, if S3 covers `/dashboard`** | Playwright home as a platform user | **OPEN** |
| D-4 Permission catalog | LOW | done | — (pin only) | no | static pin | **CLOSED** |
| D-5 Gateway metrics | MEDIUM | done (100 % NULL rows) | next hardening slice | no | unit 403/200 + S2.1 pin update | **CLOSED (impl. pending)** |
| D-6 `/ws/stats` | LOW–MEDIUM | done | next hardening slice | no | unit + realtime test update | **CLOSED (impl. pending)** |
| D-7 Scheduler tenant context | LOW (inert) | first handler | when handlers exist | no | — | **DEFERRED** |
| B-3 / WB-4 Studio templates | MEDIUM | owner T1/T2 | WB-4 | **yes, for S3's Studio-template create** | PG + Playwright | **OPEN** |
| WB-2 Legacy G idiom (instances/approvals) | MEDIUM | enumerate internal tenant-less callers | Workflow Engine phase | no | PG + SQLite workflow tier | **OPEN (planned)** |
| WB-3 Foundation query admit-all | MEDIUM (latent) | caller enumeration | with WB-2 | no | unit + PG | **OPEN (planned)** |
| WB-5 `/workflow` platform guard | LOW | — | with S3 | no | PG sweep | **OPEN (planned)** |
| C-D1 NOT NULL | — | done | migration phase | no | fresh + populated migration tests | **CLOSED** |
| C-D2 scope in key | — | owner: planned semantics? | migration phase | no | P6 | **OPEN** |
| C-D3 ordering | — | done | migration phase | no | V1–V3 | **CLOSED** |
| Real-DB inventory (N-2A O-1) | — | authorized read-only audit role | before S4 / S5 and before the migration runs | no (S3 doesn't need it, per plan §335) | — | **BLOCKED (authorization)** |
| S1 / S2 / S2.1 / S2.2 gates, RC-1/2/3, C-2, CND-1, H-1 | — | unit pins re-run here (137) | — | — | full suites at the next implementation phase | **intact** (unit pins only in this phase) |
| N-2 DB-layer xfail | — | S5 | S5 | no | — | **DEFERRED** |

---

## 7. Tests and Verification

**Run in this phase** (read-only: unit tier, in-memory SQLite):

```
cd backend && .venv/bin/pytest -q -p no:cacheprovider \
  tests/unit/test_n2b_s1_ownership_architecture.py tests/unit/test_n2b_s2_platform_principal.py \
  tests/unit/test_n2b_s2_1_platform_authorization.py tests/unit/test_n2b_s2_2_route_boundaries.py \
  tests/unit/test_n2b_permission_identity.py
→ 137 passed (31 + 49 + 40 + 15 + 2)
```

**NOT RUN in this phase:**
- the full unit suite;
- the SQLite integration tiers;
- every PostgreSQL integration test (they insert rows, and this phase forbids data changes);
- Playwright (it needs services started);
- Vitest.

The last full results are S2.2's (unit 3,881; PG 334 + 1 xfail and 38; Playwright 137/137), and they are **not re-verified** here.

**Still required (future phases):**
- **W-1 reproduction** (PG, before WB-1 is designed in detail): two tenants publish the same `definition_code`; assert today's shared definition and the cross-tenant start, then invert.
- **WB-1 to WB-5:** the tests listed per stage in §4.2.
- **D-5 / D-6:** unit tests plus an update to the S2.1 pin.
- **D-4:** a static pin that no route writes `auth.permissions`.
- **Migration:** a fresh-database test, a populated-database V2/V3 test, and downgrade tests with and without a second-module duplicate.
- **S3:** the HTTP 403 matrix (tenant-less `*.*.*` and platform tokens) on all F-2 routes; N-2 characterization tests inverted; full Playwright.

---

## 8. Risks, Assumptions and Unresolved Owner Decisions

**Risks:**
- **W-1 is live in any environment where Studio is used by more than one tenant [A: deployment usage unknown].**
- Global legacy instances and approvals are mutable by any tenant (WB-2).
- Gateway metrics leak cross-tenant paths to tenant superusers until D-5 is implemented.

**Assumptions:**
- NULL / sentinel workflow rows in the test DB are test artefacts and **not** evidence of intended shared templates.
- No internal tenant-less caller of the Legacy engine or of Foundation `query` exists beyond the HTTP routes. **Not exhaustively verified**; required before WB-2 / WB-3.

**Owner decisions needed:**
- **D-1:** global metadata, yes or no.
- **D-2:** shared publications, yes or no; and the disposition of the 89 sentinel and 71 global Foundation definitions.
- **D-3:** platform-user home and dashboards.
- **B-3:** templates, T1 or T2.
- **C-D2:** planned semantics of `scope`.
- **S3 scope:** confirm the F-2 list and whether metadata and `/dashboard` are in or out.
- Authorization for a read-only audit of any real database (N-2A O-1).

---

## 9. S3 Authorization Status — **NO-GO**

S3's technical prerequisites (S1 strict ownership, S2 principal separation and fixture migration) are met. S3 is still **not ready to start**, because:

1. **No explicit S3 authorization** has been given (the brief states S3 is not authorized).
2. **B-3 (templates) is OPEN.** S3's "Studio creates" includes template creation, and S3 can't define the template-create behaviour until T1/T2 is decided. Alternatively, exclude templates from S3 explicitly.
3. **D-3 is OPEN** if S3 is meant to cover `/dashboard`. Alternatively, exclude `/dashboard` explicitly.
4. **The S3 scope must be confirmed:** the F-2 list (11 business creates + Studio workspace/draft creates + flow start, and F-5), with metadata (D-1) and WB-5 explicitly in or out.

**Recommended (not blocking) before or alongside S3:**
- the W-1 reproduction and WB-1 (the highest open risk);
- implementing D-5 and D-6.

---

**Changes made in this phase:** this report only. No code, test, schema, migration, seed, configuration or data change. No service was started or stopped. The test DB was queried with `SELECT` only. No non-test database was inspected. No cleanup, backfill, module activation, xfail, S3 work, commit or push.
