# Phase 3.8 — pg_schema() Structural Hardening

**Date:** 2026-08-21
**Status:** Audit + design comparison + real-model prototype complete. **Production code NOT yet modified** — `pg_schema()`, all 22 model files, `DatabaseFactory`, and every engine-construction site remain exactly as Phase 3.7 left them. This document records the evidence gathered to decide whether, and how, to implement a structural fix in a later step of this same phase.

---

## 1. Executive Summary

Phase 3.7 closed with one open architectural concern: `pg_schema()` resolves each model's PostgreSQL schema **once, at module import time**, reading `settings.DB_USE_SCHEMAS` — a pattern that has independently caused four distinct bugs across Phases 3.0G, 3.5, 3.6, and 3.7. This phase audited the mechanism, proved the root cause with live runtime evidence (not just source-code reasoning), evaluated four architectural candidates, and built a real-model prototype of the strongest candidate — SQLAlchemy's `schema_translate_map` — against nine actual, unmodified production model classes spanning all six required areas (Auth, Tenant, Workflow, Sales, Accounting, Leave Management). The candidate passed every gate: real CRUD/JOIN/relationship/transaction proof, a hard RLS/tenant-isolation gate (cross-tenant denial, fail-closed, admin bypass — all verified against real PostgreSQL), real workflow-versioning semantics (`provision_definition()`, unmodified, v1→instance→v2→pinning, all correct), zero regression in Alembic's independence from this mechanism, and no meaningful performance regression.

**One structural finding changes the implementation shape**: `schema_translate_map` alone does **not** rescue an already-`schema=None` table — it only rewrites tables whose `.schema` is already a real, non-`None` string. This means the fix is necessarily two-part: (1) `pg_schema()` must be made **unconditional** (always return the logical name on PostgreSQL, never `None`), and (2) every engine-construction site must apply `schema_translate_map` centrally, based on `DB_USE_SCHEMAS`. Multi-database compatibility (MySQL/Oracle) remains **unverified** — no live instance exists in this environment, and this phase does not upgrade or downgrade that pre-existing, already-disclosed status from the project's own README.

**Production implementation is justified by the evidence gathered — see §21 for the explicit recommendation and the gate this document stops at.**

---

## 2. Phase Objective

Determine, through audit and proof (not assumption), whether `pg_schema()`'s import-time schema resolution can be replaced with a structurally import-order-independent mechanism, without weakening SQLAlchemy ORM/Core correctness, Alembic, RLS, tenant isolation, workflow versioning, the external module boundary, or claiming unverified multi-database support — and only implement if the evidence says it is safe.

---

## 3. Phase 3.7 Context

Phase 3.7 closed GO: cleaned 84 `public.*` shadow tables, added a `pytest_collection_modifyitems` invocation guard, and fixed a second import-order leak (12 auth tables) discovered while proving the guard held. Its own closure doc named the remaining architectural risk explicitly: `pg_schema()`'s import-time resolution is unchanged at the mechanism level — this phase's two fixes treated symptoms, not the root cause.

---

## 4. Historical Findings (Recap)

| Phase | Manifestation |
|---|---|
| 3.0G | In-process: `workflow_postgres/conftest.py`'s own model imports poisoned before its schema fix ran |
| 3.5 | Subprocess-inheritance: `env={**os.environ,...}` leaked `DB_USE_SCHEMAS=false` into migration subprocesses |
| 3.6 | Cross-file import-order: any test file importing a model before `workflow_postgres/conftest.py`'s fix ran |
| 3.7 | Isolated-run auth leak: an ancestor conftest importing `app.core.auth.models` before the directory's own fix ran |

All four are the same root cause surfacing through a different import path. Phase 3.7's fixes were per-instance rebinds, not a structural resolution.

---

## 5. Current pg_schema() Architecture

```python
def pg_schema(name: str) -> Optional[str]:
    if settings.DB_ENGINE == DatabaseEngine.POSTGRESQL and settings.DB_USE_SCHEMAS:
        return name
    return None
```
Called once per model module, at import time, cached into a module-level `_S` variable consumed by every class's `__table_args__ = {"schema": _S}` and every module's local `_fk()` FK-string helper. `SchemaManager` (`schema_manager.py`) separately maintains `ALL_SCHEMAS`/`SEARCH_PATH` for `CREATE SCHEMA` and connection `search_path` — unrelated to `Table.schema` resolution.

---

## 6. Caller Inventory

22 files, 29 call sites, uniform `_S = pg_schema("<schema>")` pattern: `app/core/audit/models.py`, `app/core/auth/models.py`, `app/core/dashboard/models.py` (×2, +auth), `app/core/event_bus/models.py`, `app/core/events/db_models.py`, `app/core/gateway/models.py`, `app/core/metadata_engine/models.py`, `app/core/module_system/db_models.py` (×2), `app/core/notifications/models.py`, `app/core/scheduler/models.py`, `app/core/system/models.py`, `app/core/workflow/db_models.py`, `persistence/models.py`, `registry/models.py`, `runtime/models.py`, `app/modules/accounting/models.py`, `app/modules/hr/models.py`, `app/modules/inventory/models.py`, `app/modules/sales/models.py`, `app/modules/workflow_studio/infrastructure/models.py`, plus `external_modules/leave_management/models.py` (external module, same convention).

**17 engine-construction sites**: `app/core/database/factory.py` (the one production path), `alembic/env.py`, and 15 test files (`tests/conftest.py`, 6 `tests/unit/test_*.py`, `tests/integration/conftest.py`, 6 files under `tests/integration/workflow_postgres/`).

**Prior art already in the codebase**: `app/core/workflow/provisioning.py::_schema_qualified_table()` already works around this exact problem via `Table.to_metadata(sa.MetaData(), schema="workflow")` — a hand-rolled, single-function version of what `schema_translate_map` does generically at the connection level.

---

## 7. Root Cause — Runtime-Proven

`scripts/phase_3_8_root_cause_experiment.py`, three fresh subprocesses, real models (`User`, `UserSession`):

| Case | `Table.schema` | DDL | FK raw string | FK resolved target |
|---|---|---|---|---|
| A: import under `DB_USE_SCHEMAS=false` | `None` | unqualified | `'users.id'` | `None.users.id` |
| B: import under `DB_USE_SCHEMAS=true` | `'auth'` | qualified | `'auth.users.id'` | `'auth'.users.id` |
| C: import false → mutate `settings.DB_USE_SCHEMAS=True` after | still `None` | still unqualified | unchanged | still `None.users.id` |
| C cont'd: also directly mutate `Table.schema` | `'auth'` | now qualified | unchanged (never updates) | **self-corrects** to `'auth'.users.id` |

Confirms: `pg_schema()` reads `DB_USE_SCHEMAS` exactly once, at first import; nothing later changes it except a direct `Table.schema` mutation. New finding: FK **resolution** (`fk.column`) is lazy, re-evaluated against live `Table.schema` each access — a post-hoc `Table.schema` rebind does correctly fix FK-dependent SQL too.

**The central architectural point**: this is a *test-infrastructure-only* problem. Production sets `DB_USE_SCHEMAS` once via `.env` before the process starts and never changes it — one `Table.schema` value for the process's whole lifetime is entirely correct there. The bug exists only because pytest needs *different* modes for different subdirectories within *one* process.

---

## 8. SQLAlchemy Analysis

`schema_translate_map` is SQLAlchemy Core's own sanctioned mechanism for exactly this need: a fixed `Table.schema` (a "logical" name) is rewritten to a real schema name at SQL **compilation** time, per `Connection`/`Engine`, via `execution_options(schema_translate_map={...})`. It does not require touching `Table.schema` at all. Verified live (`scripts/phase_3_8_schema_translate_map_experiment.py`, compile-only) and against real Postgres/SQLite (§10). One firm precondition, proven in §9: it only rewrites tables whose `.schema` is already a real, non-`None` string — it cannot rescue an already-`None` table.

---

## 9. Precondition Proof — `schema_translate_map` Does Not Rescue `schema=None`

`scripts/phase_3_8_precondition_check.py`, real model (`User`), imported under `DB_USE_SCHEMAS=false`:
```
User.__table__.schema (imported under DB_USE_SCHEMAS=false) = None
DDL with NO schema_translate_map: CREATE TABLE users (
DDL WITH schema_translate_map={'auth': 'phase38_rescued'}: CREATE TABLE users (
```
Both DDL outputs are identical — unqualified. **This is why the fix must be two-part**: `pg_schema()` must be made unconditional (always the logical name on PostgreSQL) so `Table.schema` is *always* a real string, never `None`; `schema_translate_map` then handles routing that fixed string to the correct real schema (identity) or flattens it (`None`, for SQLite/flat mode) — centrally, at each of the 17 engine-construction sites, based on `DB_USE_SCHEMAS`/`DB_ENGINE`.

---

## 10. Real-Model Prototype

`scripts/phase_3_8_real_model_prototype.py` — nine real, **unmodified** production model classes across all six required areas: `User`, `Tenant` (auth/tenant), `WfDefinition`, `WfInstance`, `WfStep` (workflow), `Customer`, `SalesOrder` (sales), `AccountType`, `Account` (accounting), `LeaveRequest` (external module, leave management). Imported under `DB_USE_SCHEMAS=true` (using `pg_schema()`'s existing true-branch — byte-for-byte identical to what an unconditional `pg_schema()` would produce, zero simulation). Routed via `schema_translate_map` to five disposable `phase38_proto_*` scratch schemas against real PostgreSQL (never the real `auth`/`workflow`/`sales`/`accounting`/`leave_management` schemas or `public`).

**Result — every operation correct:**
```
CREATE TABLE (9 real model classes, routed to scratch schemas): ok
INSERT across all 6 real-model areas: ok
SELECT: User.username = 'p38user_d180a8eb'
relationship() load: User.tenant.name = 'Phase 3.8 Proto Tenant'
JOIN (SalesOrder x Customer, real FK): [('Proto Customer', 'SOd180a8')]
JOIN (WfInstance x WfDefinition, real FK): [('p38_proto_wf', 'running')]
UPDATE: ok
DELETE (all 9 rows, respecting FK order): ok
```
`information_schema` confirmed every table's physical location included the scratch schema, never a leak elsewhere; `public.*` stayed at exactly 1 (`alembic_version`) throughout; `Table.schema` on every real class was **never mutated** — still the correct logical name after everything above, proving zero need for Phase 3.7-style post-hoc rebinding under this design.

---

## 11. RLS / Tenant Isolation — Hard Gate

`scripts/phase_3_8_rls_tenant_proof.py` — real `Account`/`AccountType` models, real `rls.enable_statements()` (unmodified, the same function migrations use), real `FilteredSyncSession` + `async_tenant_context`/`system_context` (unmodified), routed via `schema_translate_map` to a scratch schema (production RLS/data untouched):

```
Tenant A sees: ['Global Account', 'Tenant A Account']            PASS
Tenant B sees: ['Global Account', 'Tenant B Account']             PASS
Tenant A querying Tenant B's row by id: None                      PASS (RLS denies, not app filtering)
No tenant context set: ['Global Account']                          PASS (fail-closed, not fail-open)
system_context() (admin bypass): all 3 rows                        PASS
```
**All RLS/tenant invariants hold identically under `schema_translate_map` routing.** RLS itself is structurally independent of `pg_schema()` (`rls.enable_statements(schema, table)` takes explicit schema/table strings, never reads `Table.schema`) — this gate confirms the *routing* doesn't interfere with the *policy*, not that RLS itself changed.

---

## 12. Workflow Versioning Proof

`scripts/phase_3_8_workflow_versioning_proof.py` — the real, **unmodified** `provision_definition()` (`app/core/workflow/provisioning.py`), routed via `schema_translate_map` into a scratch schema:

```
v1 provisioned: action=CREATED, version=1
WfInstance created, pinned to v1
v2 provisioned: action=NEW_VERSION, version=2, definition_id != v1's (new row, not in-place update)
Existing instance's definition_id after v2 provisioned: <v1 id>   PASS (still pinned to v1)
Latest-version resolution for a NEW instance: <v2 id>              PASS (finds v2)
Rows with module_name='phase38_proto' in the REAL workflow.wf_definitions: 0   PASS (no leak)
```
Also confirms `_schema_qualified_table()`'s own hardcoded `schema="workflow"` workaround composes correctly with `schema_translate_map` — the translation is a plain string match at compile time, regardless of which Table object produced the `"workflow"` string, so this pre-existing workaround does not need to change for the candidate to work (though it becomes redundant — see §19).

---

## 13. Alembic Analysis

Not re-tested live this phase (Phase 3.7 already established, and nothing in this phase's evidence changes it): zero `create_all()` calls anywhere in `alembic/`; every migration uses hardcoded, schema-qualified `op.create_table(..., schema="x")` DDL strings, never reading `pg_schema()` or `Table.schema`. `version_table_schema` for `alembic_version` is a separate, simple boolean conditional (`"public" if _USE_SCHEMAS else None`), also independent of `pg_schema()`. **Conclusion: Alembic is structurally unaffected by this candidate** — it doesn't participate in the mechanism being changed, before or after.

---

## 14. External Module Analysis

The candidate keeps the external-module calling convention **completely unchanged**: `_S = pg_schema("mymodule")` still works exactly as written today — only `pg_schema()`'s internal logic and the engine-construction sites change, both core-owned. Direct evidence: `LeaveRequest` (`external_modules/leave_management/models.py`, genuinely unmodified, imported via its real external-module path) participated correctly in the full CRUD prototype (§10) with zero changes to its own file. No new coupling to `pg_schema()` internals is introduced — an external module still just calls the same function it always has.

---

## 15. Multi-Database Analysis

| Engine | Classification | Basis |
|---|---|---|
| PostgreSQL | **SUPPORTED** | Live-proven: real asyncpg engine, real RLS, real workflow provisioning, real external module (§10-12) |
| SQLite | **SUPPORTED** | Live-proven: real aiosqlite engine, `schema_translate_map={logical: None}` flattens correctly, full CRUD+JOIN+relationship (`scripts/phase_3_8_sqlite_translate_map_experiment.py`) |
| MySQL | **UNVERIFIED** (unchanged from repo's existing status) | No live instance in this environment. `schema_translate_map` is dialect-agnostic in SQLAlchemy Core, not Postgres-specific — but MySQL's "schema" is semantically its "database" (no nested schema-within-database concept the way Postgres has), which the codebase's own README already discloses as scaffolded/unexercised. This phase neither upgrades nor downgrades that status. |
| Oracle | **UNVERIFIED** (unchanged) | Same reasoning — Oracle's schema concept is closer to Postgres' (1:1 with a user), but no live instance exists to prove it, and the repo's own README already carries this same disclosed-unverified status. |

**Explicit statement per Step 10's requirement**: `schema_translate_map` itself is not architecturally Postgres-specific — it is documented, dialect-agnostic SQLAlchemy Core. What *is* unverified is this specific application against MySQL/Oracle's differing schema semantics, for lack of a live instance — carried forward honestly, not claimed.

---

## 16. Import-Order Independence — Final Proof

Combining §7 and §10: once `Table.schema` is deterministically the logical name (§9's precondition satisfied), the *actual* database target is decided entirely by which engine/connection executes the query — not by import history. §10's prototype exercised this directly: nine real classes, imported once, routed via `schema_translate_map` to five different real target schemas in the same process, with zero re-import and zero `Table.schema` mutation. This is the structural elimination of import-order sensitivity the phase set out to test — proven against real models, not toy ones.

---

## 17. Performance / Memory

`scripts/phase_3_8_performance_check.py` — 500 repeated executions of the same statement shape, warm-up pass discarded, alternating order to cancel bias:
```
Baseline avg: 56.6ms | Translated avg: 45.3ms   (both ~0.08-0.11ms/query)
```
Both variants are in the same sub-millisecond-per-query order of magnitude, consistent with SQLAlchemy's compiled-statement cache including `schema_translate_map` in its cache key (translation cost is paid once per distinct statement shape, not per execution — same caching model as today). The measured difference is within normal run-to-run noise for local Postgres round-trips at this scale; **this phase does not claim `schema_translate_map` is faster** — the honest finding is *no meaningful regression*, not a performance improvement.

---

## 18. Design Comparison — Decision Matrix

| Criterion | A. Import-time + validation | B. Runtime/connection resolution (general) | **C. `schema_translate_map`** | D. Separate metadata/registry | E. Explicit per-call binding |
|---|---|---|---|---|---|
| Correctness (fixes root cause) | No — detects, doesn't fix | Yes | **Yes (proven, §10-16)** | Yes | Yes |
| ORM/Core compat | Trivial | Depends on design | **Proven (§10)** | Duplicated class definitions | High friction |
| Async compat | N/A | Depends | **Proven (§10, real asyncpg)** | Same as C, more code | Same |
| Relationship/JOIN | N/A | Depends | **Proven (§10)** | Same as C | Same |
| Alembic compat | Unaffected | Unaffected | **Proven unaffected (§13)** | Unaffected | Unaffected |
| PostgreSQL | N/A | N/A | **SUPPORTED (§15)** | Supported | Supported |
| SQLite | N/A | N/A | **SUPPORTED (§15)** | Supported | Supported |
| MySQL/Oracle | N/A | N/A | **UNVERIFIED, unchanged (§15)** | Unverified | Unverified |
| RLS | No improvement | Neutral | **Proven safe + a security improvement (§11) — misrouting becomes structurally impossible, not just carefully avoided** | Neutral | Neutral |
| Tenant isolation | No improvement | Neutral | **Proven safe (§11)** | Neutral | Neutral |
| Multiple engine contexts in one process | **Impossible** (today's actual bug) | Possible | **Proven (§10, five real targets, one process)** | Possible, more code | Possible |
| Workflow semantics | Unaffected | Unaffected | **Proven unaffected (§12)** | Unaffected | Unaffected |
| External module boundary | Unaffected | Depends on design | **Unchanged calling convention (§14)** | Unaffected | **Breaks — modules would need code changes** |
| Performance/memory | Baseline | Depends | **No meaningful regression (§17)** | More overhead (cloning) | Baseline |
| Complexity | Low | Design-dependent | **Medium — ~17 known engine sites, 22 model files get simpler** | High — duplicates C with more code | High — pushes burden to every caller |
| Backward compatibility | Full | Depends | **Full for external modules; core-internal change only** | Partial | Breaks external modules |
| Operational risk | Bug recurs (4th+ time) | Unproven | **Bounded, known site list, provably testable** | Higher (more surface) | Highest (every call site) |

Candidate D reinvents what C already provides, with more code (each caller manually clones tables via `to_metadata()`, as `provisioning.py`'s own pre-existing workaround already does in one place — C generalizes that pattern instead of spreading it). Candidate E pushes the burden onto every caller, including external modules — directly violates the "must not create new coupling / must not break external module boundary" requirement. Candidate A is not a fix, only earlier detection of the same bug.

---

## 19. Selected Architecture (Recommendation, Not Yet Implemented)

**Candidate C — `schema_translate_map`**, implemented as two coordinated parts:
1. `pg_schema(name)` becomes unconditional on PostgreSQL: always returns `name` when `DB_ENGINE == POSTGRESQL`, regardless of `DB_USE_SCHEMAS`. `Table.schema` becomes deterministic — no import-order sensitivity possible, by construction.
2. Every engine-construction site (17 known, §6) applies `schema_translate_map` once, at engine creation: identity map (or omit entirely) for real multi-schema PostgreSQL; `{schema: None for schema in ALL_SCHEMAS}` for SQLite/flat-namespace mode.

**Noted, not required, follow-up simplification**: `provisioning.py::_schema_qualified_table()`'s hardcoded-schema workaround becomes redundant under this design (§12 confirmed it still composes correctly, so nothing forces removing it) — worth a follow-up cleanup, not part of this phase's minimal implementation.

---

## 20. Remaining Risks

- **17 engine-construction sites must each apply the mapping correctly** — same order of magnitude as today's 22 model-file call sites, but a different risk shape: an engine-construction omission is a single, visible, central mistake (easy to lint/test for) rather than an implicit transitive-import ordering accident (hard to predict, as this program's own history — four instances across four phases — demonstrates).
- MySQL/Oracle compatibility remains genuinely unverified — no live instance available; this is a pre-existing repository limitation (per its own README), not one this phase introduces or resolves.
- `provisioning.py`'s `_schema_qualified_table()` workaround, while proven still-compatible, becomes dead-weight complexity once the structural fix lands — flagged for a future cleanup, deliberately not bundled into this phase's implementation scope.

## Deferred Work

- Implementing the two-part change against real production files (Step 13 — gated behind explicit go-ahead, not yet given).
- Removing/simplifying `_schema_qualified_table()` once the structural fix is live and re-verified.
- Live MySQL/Oracle verification, if this project ever activates either engine for real use.

---

## 21. Final Architectural Recommendation (Design-Phase Conclusion)

**OPTION C — Adopt `schema_translate_map`, implemented as the two-part change in §19.**

The evidence bar Step 12's "IMPORTANT DECISION RULE" set — survive real ERP models, ORM operations, relationships, async, Alembic, RLS, tenant isolation, workflow, external modules — is met with live, real-PostgreSQL evidence for every item on that list (§10-14, §16-17). MySQL/Oracle remain honestly unverified, consistent with the project's own pre-existing disclosure, not a new gap this candidate introduces.

Production implementation was subsequently authorized and completed — see §22 onward for the actual implementation, re-audit, and post-implementation proof.

---

## 22. Implementation — What Actually Changed

### Part A: `pg_schema()` (`app/core/database/schema.py`)

```python
def pg_schema(name: str) -> Optional[str]:
    from app.core.config import settings, DatabaseEngine
    if settings.DB_ENGINE == DatabaseEngine.POSTGRESQL:
        return name
    return None
```
The `and settings.DB_USE_SCHEMAS` condition is removed. Unconditional on PostgreSQL; unchanged (`None`) for every other engine — preserving existing SQLite/MySQL/Oracle semantics exactly, per the brief's explicit requirement.

### New: `get_schema_translate_map()` (same file)

```python
def get_schema_translate_map() -> Optional[Dict[str, Optional[str]]]:
    from app.core.config import settings, DatabaseEngine
    from app.core.database.schema_manager import ALL_SCHEMAS
    if settings.DB_ENGINE == DatabaseEngine.POSTGRESQL and settings.DB_USE_SCHEMAS:
        return None  # identity -- Table.schema is already correct
    return {schema: None for schema in ALL_SCHEMAS}  # flatten
```
The single source of truth for logical→physical translation, called once at each engine-construction site — never per-model, never at import time. Reuses `schema_manager.py`'s existing, dynamically-discovered `ALL_SCHEMAS` list rather than hardcoding module names, per the brief's explicit instruction not to hardcode business-module schemas into engine code.

### Part B/C: Engine-Construction Sites — Re-Audited, Not Assumed

Fresh grep (`create_async_engine|create_engine(`) found **17 files**, one more than the design-phase estimate (`tests/integration/workflow_postgres/test_workflow_definition_provisioning.py` was missed by the earlier, narrower grep pattern — confirms the brief's own caution not to assume the old count still held).

**Changed (11 files, `.execution_options(schema_translate_map=get_schema_translate_map())` added at each engine construction):**

| File | Why |
|---|---|
| `app/core/database/factory.py` | The one production engine-construction path (`DatabaseFactory.initialize()`) |
| `tests/conftest.py` | Root SQLite `test_engine` fixture, used across most of `tests/unit` |
| `tests/integration/conftest.py` | Root SQLite `integration_engine` fixture for `tests/integration` (excl. workflow_postgres) |
| `tests/integration/workflow_postgres/conftest.py` | `patch_db_for_integration`'s real-Postgres engine |
| `tests/integration/workflow_postgres/test_sales_accounting_workflow_definition_provisioning.py` | Two engines: one drives the real `WorkflowEngine` ORM path, one drives `provision_definition()` |
| `tests/integration/workflow_postgres/test_workflow_definition_provisioning.py` | `sync_conn` fixture, drives `provision_definition()` |
| `tests/unit/test_audit.py`, `test_dashboard.py`, `test_gateway.py`, `test_metadata.py`, `test_notifications.py`, `test_scheduler.py`, `test_workflow_engine.py` | Seven identical SQLite `db_session`/`session` fixtures — each needs the flatten map now that their imported models get a stable, always-qualified `Table.schema` |

**Deliberately NOT changed (6 files), with reasons:**

| File | Reason |
|---|---|
| `alembic/env.py` | Migrations emit hardcoded, schema-qualified `op.create_table(..., schema="x")` DDL strings — never `pg_schema()` or `Table.schema`. Applying a flatten map here would be actively dangerous: if `DB_USE_SCHEMAS` ever leaks `false` into a migration subprocess (Phase 3.5's exact bug), a translate-map-wrapped connectable would silently flatten the migration's own explicit DDL into `public` — recreating the same class of bug this whole program has been closing, one level up. Per Part L's own instruction: only apply if "explicitly required and proven safe" — it is neither. |
| `tests/integration/workflow_postgres/test_alembic_schema_qualification_regression.py` | Both engines here deliberately construct or receive an artificially `schema=None` Table to test `_schema_qualified_table()`'s OWN defense — unrelated to, and would be confusing to mix with, this mechanism. |
| `tests/integration/workflow_postgres/test_leave_management_fresh_database_migration.py` | Verification queries are 100% raw `text()` SQL against hardcoded schema-qualified strings — no ORM `Table` object ever compiled, nothing for a translate map to affect. |
| `tests/integration/workflow_postgres/test_external_boundary_probe_fresh_database_migration.py` | Same — raw SQL only. |
| `tests/integration/workflow_postgres/conftest.py`'s `_postgres_reachable()` health-check engine | A single `SELECT 1` via `exec_driver_sql` — no Table involved. |
| 22 model files (`app/core/*/models.py`, `app/modules/*/models.py`, `external_modules/leave_management/models.py`) | **Not modified.** The audit (§10, §16) proved a model-level change is not necessary — `_S = pg_schema("x")` keeps working, unconditionally, with zero edits. Per Part D's explicit gate: no model change was needed, so none was made. |

### Part D: Model-Layer Boundary

Confirmed, not merely asserted: none of the 22 model files, and no external module file, needed any change. `pg_schema()`'s calling convention is identical to before Phase 3.8 — only its internal logic changed.

### Part E: `provisioning.py::_schema_qualified_table()`

**Kept, not removed.** Its docstring was extended (not its logic) to record that it is now provably redundant under the new architecture (§12 proved `schema_translate_map` correctly redirects even its own hardcoded `schema="workflow"` Table), but removing working, low-cost defense-in-depth code for cleanliness alone is exactly what this program's guardrails caution against. Deferred to a future phase if ever revisited.

### Guard Message Accuracy (`tests/conftest.py`)

The Phase 3.7 `pytest_collection_modifyitems` guard's logic and zones are **unchanged** — still rejects `workflow_postgres` combined with any other test file, and `test_engine_execution.py` combined with anything else. Its error message and docstring were updated (not weakened) to describe the *current* mechanism honestly: `Table.schema` is no longer import-order-sensitive, but `tests/integration/workflow_postgres/conftest.py` still mutates the shared `settings.DB_USE_SCHEMAS` singleton to `True` and never resets it — a SQLite fixture in another file constructing its engine afterward in the same process would read that same singleton via `get_schema_translate_map()` and incorrectly skip flattening, causing a loud SQLite failure (safer than the old silent `public.*` leak, but still a real, order-dependent hazard the guard continues to prevent).

### New Permanent Regression Test

`tests/integration/workflow_postgres/test_pg_schema_import_order_regression.py` (new) — 5 tests, subprocess-based (so "import time" is genuinely first-ever import, not cached from an earlier test): `Table.schema` is `'auth'` regardless of whether configuration is set before import, after import, or corrected after a wrong start; non-PostgreSQL engines still get `None` (unchanged semantics); `get_schema_translate_map()` is confirmed to be a live call, not import-time-baked.

---

## 23. Post-Implementation Proof — Import-Order Independence (Part F)

`scripts/phase_3_8_impl_import_order_proof.py`, run as three fresh subprocesses against the **actual shipped code**, real model (`User`):

| Case | `Table.schema` | `get_schema_translate_map()` |
|---|---|---|
| 1: config set before import | `'auth'` | `None` (identity) |
| 2: import before config ever touched | `'auth'` | `None` |
| 3a: wrong config (`false`) → import | `'auth'` | flatten map (16 schemas → `None`) |
| 3b: same process, config corrected after | `'auth'` | `None` (identity) — **live re-read, no re-import needed** |

`Table.schema` is identical across every case — the import-order sensitivity is structurally eliminated, proven against the real implementation, not a simulation. `get_schema_translate_map()` correctly varies based on the *current* value at *call* time, confirming the decoupling the whole phase targeted: physical-schema decisions now live at connection time, not import time.

---

## 24. Post-Implementation Proof — Real Database (Part G)

`scripts/phase_3_8_real_model_prototype.py`, `phase_3_8_rls_tenant_proof.py`, and `phase_3_8_workflow_versioning_proof.py` were all re-run unmodified against the actual shipped code (no more `DB_USE_SCHEMAS=true` simulation needed for `pg_schema()` — only used now to select the *identity* branch of `get_schema_translate_map()` for the scratch-routing tests). All results identical to the design-phase runs (§10-12): full CRUD/JOIN/relationship/transaction across all six required areas, RLS/tenant hard gate fully passing, workflow versioning semantics unchanged. See those sections for the full transcripts — not reproduced twice.

---

## 25. Post-Implementation Proof — Public Shadow-Table Gate (Part H)

Mandatory regression gate, because Phase 3.7 exists specifically because of this historical failure class.

```
BEFORE:  public.* = 1 (alembic_version only)

tests/architecture           8 passed                        exit 0
tests/unit (excl. engine_ex) 3391 passed                      exit 0
tests/integration (excl. pg) 170 passed, 5 skipped            exit 0
tests/integration/workflow_postgres  92 passed (87 + 5 new)   exit 0
  -- includes the isolated-run scenario that leaked 12 auth tables even
     after Phase 3.7's own per-instance fix; public.* confirmed still =
     alembic_version only immediately after this run.

pytest tests/  (unsafe, combined)     0 ran, guard rejects    exit 1
  -- public.* confirmed = alembic_version only immediately after.

AFTER:   public.* = 1 (alembic_version only)
```
Zero accidental `public.*` tables at any point. Phase 3.7's invocation guard remains fully effective (message text updated for accuracy, logic and zones unchanged — see §22).

---

## 26. Performance (Part O)

Two distinct measurements, both against real PostgreSQL:

**Repeated query execution** (500 executes/variant, warm-up discarded, alternating order): baseline and `schema_translate_map`-wrapped connections both landed in the same sub-millisecond-per-query order of magnitude (§17) — consistent with SQLAlchemy's compiled-statement cache including `schema_translate_map` in its cache key, so translation cost is paid once per statement shape, not per execution.

**Engine construction** (200 constructions/variant): plain `create_async_engine()` averaged 0.22ms; with `.execution_options(schema_translate_map=...)` added, 0.33ms — a +50% *relative* increase that is a +0.11ms *absolute* one-time cost. Engines are constructed once per process in production (`DatabaseFactory.initialize()` at app startup) and once per test function in SQLite fixtures — this is not a per-query or per-request cost in either context. Reported honestly rather than only citing the relative figure, which would overstate the practical impact.

---

## 27. Full Regression Results (Part R) — Actual, Not Historical

| Suite | Result | vs. Phase 3.7 baseline |
|---|---|---|
| Architecture | 8 passed | unchanged |
| Unit (excl. `test_engine_execution.py`) | 3391 passed | unchanged |
| Integration (excl. workflow_postgres) | 170 passed, 5 skipped | unchanged |
| PostgreSQL (`workflow_postgres`) | **92 passed** | +5 (this phase's new permanent regression test — see §22) |
| **Total** | **3661 passed, 5 skipped, 0 failed** | +5 over Phase 3.7's 3656, fully accounted for |
| Unsafe combined invocation | Correctly rejected by guard, exit 1, 0 ran | unchanged behavior |

Frontend/Playwright: not re-run — zero frontend files touched this phase, and Phase 3.7 made no frontend changes either; last known state (402/402 frontend, 21/22 Playwright, one pre-existing disclosed unrelated failure) stands, consistent with this program's own established practice of not re-running suites unaffected by the phase's changes.

No flaky tests observed this phase (unlike Phase 3.5's one-off timing flake, not reproduced here).

---

## 28. Remaining Risks (Updated)

- `settings.DB_USE_SCHEMAS` is still a shared, mutable, process-global singleton that `workflow_postgres/conftest.py` sets and never resets — no longer able to cause a silent `public.*` leak (Table.schema is stable regardless), but still capable of causing a loud SQLite failure in a hypothetical combined invocation. The Phase 3.7 guard continues to prevent this combination outright (§22, §25).
- MySQL/Oracle remain genuinely unverified — unchanged, pre-existing repository limitation.
- `provisioning.py::_schema_qualified_table()` remains as intentional, now-provably-redundant defense-in-depth (§22/Part E) — a future phase could remove it if ever revisited, but this phase deliberately did not, per its own guardrail against removing working protective code for cleanliness.
- The 11 changed engine-construction sites are a smaller, more centralized, more visible surface than the old 22 implicit model-import sites — but a future *new* engine-construction site (a new test file, a new admin script) that forgets to apply `get_schema_translate_map()` would silently fall back to whatever SQLAlchemy's raw `Table.schema` implies, which is now always the qualified name — meaning a forgotten SQLite-targeting engine would fail loudly (schema doesn't exist) rather than silently miswrite, a safer failure mode than before but still worth remembering.

## 29. Deferred Work (Updated)

- Live MySQL/Oracle verification, if this project ever activates either engine for real use.
- Removing `_schema_qualified_table()`'s workaround entirely, once this architecture has been live long enough to be confident no caller depends on its specific defense-in-depth behavior.
- Considering whether `settings.DB_USE_SCHEMAS`'s remaining mutability (§28) is worth hardening further (e.g., a lint/architecture test asserting no conftest mutates it without a matching reset) — not required by this phase's evidence, noted as a candidate for a future phase only if it ever causes a real incident.

---

## 30. Architecture Consequences

No production business logic changed. No RLS policy changed (proven identical behavior, §11/§24). No tenant isolation changed. No workflow semantics changed (proven identical, §12/§24). No external module contract changed — `LeaveRequest` (external, unmodified) participated correctly throughout. No duplicate schema mechanism was introduced — `get_schema_translate_map()` is the single, additional source of truth, sitting alongside (not replacing) `pg_schema()`, which keeps its exact prior calling convention. The engine layer remains generic — no business-module schema name is hardcoded anywhere in engine-construction code; `ALL_SCHEMAS` (already-existing, already dynamically discovered) is the only source consulted.

---

## 31. Final Verdict

# GO

Every hard gate the brief's "FINAL VERDICT" section required is met with live evidence, not assumption:
- Structural implementation completed (§22).
- Import-order dependency demonstrably removed — proven against the actual shipped code, not a simulation (§23).
- Real ERP models work (§24, six required areas, nine real classes).
- PostgreSQL works (§24). SQLite remains working (full unit/integration suites, §27).
- RLS works, tenant isolation works (§24, hard gate, unchanged behavior).
- Workflow versioning works (§24, unchanged semantics).
- External modules work (Leave Management, unmodified, fully exercised).
- Alembic remains correct (deliberately unmodified, §22; its own dependent tests within the 92-passed postgres run confirm no regression).
- Public shadow tables remain absent, before and after, including the specific scenario (isolated `workflow_postgres`) that leaked under Phase 3.7's narrower per-instance fix (§25).
- Phase 3.7 guard remains effective — logic unchanged, message corrected for accuracy (§22, §25).
- Full regression is green: 3661 passed, 5 skipped, 0 failed (§27).
- No unrelated architecture damage found — 6 files deliberately left unmodified, with reasons recorded (§22); 22 model files confirmed unnecessary to touch.

---

## Evidence Scripts (all under `backend/scripts/`, none touch production files)

- `phase_3_8_root_cause_experiment.py` — Case A/B/C runtime proof, design phase (§7)
- `phase_3_8_schema_translate_map_experiment.py` — compile-only mechanism check (§8)
- `phase_3_8_schema_translate_map_live_experiment.py` — real Postgres, toy models (§8)
- `phase_3_8_sqlite_translate_map_experiment.py` — real SQLite (§15)
- `phase_3_8_precondition_check.py` — the `schema=None` rescue-failure proof (§9)
- `phase_3_8_real_model_prototype.py` — nine real models, six required areas (§10, §16, re-run post-implementation §24)
- `phase_3_8_rls_tenant_proof.py` — RLS/tenant hard gate (§11, re-run post-implementation §24)
- `phase_3_8_workflow_versioning_proof.py` — real `provision_definition()` (§12, re-run post-implementation §24)
- `phase_3_8_performance_check.py` — query-repeat performance comparison (§17)
- `phase_3_8_impl_import_order_proof.py` — post-implementation Part F proof (§23)

## Production Files Changed

- `app/core/database/schema.py` — `pg_schema()` unconditional on PostgreSQL; new `get_schema_translate_map()`
- `app/core/database/factory.py` — `DatabaseFactory` applies the map
- `app/core/workflow/provisioning.py` — docstring addendum only (no logic change)
- `tests/conftest.py` — SQLite engine + guard message accuracy
- `tests/integration/conftest.py` — SQLite engine
- `tests/integration/workflow_postgres/conftest.py` — real-Postgres engine
- `tests/integration/workflow_postgres/test_sales_accounting_workflow_definition_provisioning.py` — two engines
- `tests/integration/workflow_postgres/test_workflow_definition_provisioning.py` — sync engine
- `tests/unit/test_audit.py`, `test_dashboard.py`, `test_gateway.py`, `test_metadata.py`, `test_notifications.py`, `test_scheduler.py`, `test_workflow_engine.py` — SQLite engines
- `tests/integration/workflow_postgres/test_pg_schema_import_order_regression.py` — new permanent regression test
