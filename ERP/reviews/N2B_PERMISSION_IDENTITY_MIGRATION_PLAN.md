# N-2B S2.2 Workstream C — Permission Identity Migration Plan (design only)

**Date:** 2026-10-14
**Status:** **plan only.** No migration was written or executed, and no schema, RLS, grant or data change was made.
**Inputs:** `N2B_S2_1_PLATFORM_AUTHORIZATION_HARDENING_REPORT.md` §4.B.
**Verdict (Workstream C):** **GO for the plan**, as a basis for an approved implementation phase (§9).

---

## 1. Current State (inspected 2026-10-14; local test DB, read-only)

**Authorization identity.** A permission's identity is `module_name.resource.action`:
- login, refresh and the contract all build the code as `f"{module_name or '*'}.{resource}.{action}"` (`app/core/auth/issuance.py::load_role_names_and_permissions`);
- `RBACEngine` matches those strings segment by segment, with `*` as a wildcard;
- the runtime `PermissionRegistry` keys by the same code.

**DB identity** (`auth.permissions`):

| Item | Value |
|---|---|
| Columns | `id` uuid PK; `resource`, `action`, `scope` NOT NULL; **`module_name` NULLABLE**; `description`, `is_active`, timestamps, `version` |
| Unique | `uq_permission_resource_action_scope UNIQUE (resource, action, scope)`; **`module_name` is not part of it** |
| Referenced by | only `auth.role_permissions.permission_id`, **`ON DELETE CASCADE`**; `role_permissions` PK is `(role_id, permission_id)` |
| RLS | none (global catalog) |
| Data (local) | 34 rows; 0 with NULL `module_name`; 34 distinct by both keys; 0 duplicate codes; 0 duplicate grants; all 34 codes are referenced in code |
| Server versions | local test PG **14.20**; `docker-compose.yml` PG **16**. `UNIQUE NULLS NOT DISTINCT` (PG ≥ 15) is **not** usable everywhere. |

**Lookup paths:**

| Path | Lookup | Identity used |
|---|---|---|
| `scripts/seed_worklist_e2e.py::_get_or_create_permission` (only writer) | by `(resource, action, scope)` | refuses a row whose `module_name` differs (`PermissionIdentityConflict`, S2.1) |
| `app/core/auth/issuance.py` (login, refresh, contract) | via `role_permissions` join | builds the code from the row's `module_name` |
| `app/core/module_system/cleanup.py` | in-memory `PermissionRegistry.unregister_module` | code; no DB access |
| `CoreAuthServiceImpl.check_permission` | none (empty lists) | n/a (pre-existing stub) |

**The two problems:**
1. **Unrepresentable identities.** Once module A has `items.read`, module B's `items.read` **cannot be stored**. Any writer keyed on `(resource, action)` would silently reuse A's row and grant A's permission. This is proven on PostgreSQL by `test_current_schema_cannot_store_two_modules_with_the_same_resource_action`.
2. **NULL `module_name` is a cross-module wildcard.** A NULL row becomes `*.resource.action`, which matches **every** module's `resource.action` (proven by `tests/unit/test_n2b_permission_identity.py::test_a_null_module_row_becomes_a_cross_module_wildcard_grant`). Today there are 0 such rows, but nothing prevents one.

---

## 2. Target

- **Uniqueness on the authorization identity:**
  `UNIQUE INDEX uq_permission_identity ON auth.permissions (module_name, resource, action, scope)`, with `module_name NOT NULL`.
- **Fallback if NOT NULL is rejected (§8, decision C-D1):**
  `UNIQUE INDEX … ON auth.permissions (COALESCE(module_name, '*'), resource, action, scope)`. This works on PG 14 and 16.
- **Old constraint:** `uq_permission_resource_action_scope` is dropped **after** the new index exists.
- **Unchanged:** permission codes, the RBAC matching rules, role grants, and every existing row's id. The migration changes **which rows may exist**, not what any existing grant means.

---

## 3. Migration Ordering

Each step is its own transaction; the order is chosen so that **no window exists without a uniqueness guarantee**.

1. **Pre-flight (read-only; abort on any row):** run P1–P4 (§5).
2. **Create the new unique index first:**
   - `CREATE UNIQUE INDEX CONCURRENTLY uq_permission_identity …` (outside a transaction block; Alembic needs `autocommit_block()`);
   - then check `pg_index.indisvalid`, because a failed `CONCURRENTLY` build leaves an invalid index that must be dropped and retried.
   - Both constraints now hold; the new one is strictly weaker, so it cannot fail where the old one passed.
3. **`module_name` NOT NULL** (if C-D1 = NOT NULL):
   - `ALTER TABLE … ADD CONSTRAINT permissions_module_name_nn CHECK (module_name IS NOT NULL) NOT VALID`;
   - then `VALIDATE CONSTRAINT`, which avoids a long ACCESS EXCLUSIVE lock;
   - then optionally `SET NOT NULL` (PG ≥ 12 uses the validated check to skip the table scan).
4. **Model change in the same release:**
   - `Permission.__table_args__` gains the new `UniqueConstraint("module_name", "resource", "action", "scope")`;
   - `module_name` becomes `nullable=False`.
5. **Drop `uq_permission_resource_action_scope`.** Only after the application release that no longer relies on it (§6) is deployed everywhere.
6. **Seed:** `_get_or_create_permission` looks up by the full identity `(module_name, resource, action, scope)`; the conflict refusal stays as defence in depth.
7. **Post-checks:** V1–V3 (§5).

---

## 4. Preserving Role-Permission Associations

- **The migration never deletes or rewrites a `permissions` row.** Ids are kept, so every `role_permissions` row is preserved by construction.
- **If P1 ever finds duplicates** (two rows with the same identity), they are **not** fixed inside the migration, because `ON DELETE CASCADE` would silently revoke grants. A separate, reviewed data step must:
  1. pick the surviving id per identity (the oldest `created_at`);
  2. insert the union of grants onto the survivor: `INSERT INTO auth.role_permissions (role_id, permission_id, conditions, granted_by, granted_at) SELECT … ON CONFLICT (role_id, permission_id) DO NOTHING`;
  3. compare grant counts before and after per role, and confirm that the set of effective codes per role is identical;
  4. only then delete the losing rows.
- **If P2 finds NULL `module_name` rows,** each is a deliberate cross-module wildcard grant **or** a bug. They need a per-row owner decision (assign a module, or replace with explicit per-module rows). There is **no automatic backfill**: a guess would change who holds which permission.

---

## 5. Validation Queries

**Pre-flight** (verbatim in `tests/integration/workflow_postgres/test_n2b_permission_identity_preflight.py::PREFLIGHT`; each must return **zero rows**):

```sql
-- P1 duplicate authorization identity
SELECT COALESCE(module_name, '*') AS module_key, resource, action, scope, COUNT(*) AS n
FROM auth.permissions GROUP BY 1, 2, 3, 4 HAVING COUNT(*) > 1;

-- P2 NULL module_name (grants '*.resource.action' across every module)
SELECT id, resource, action, scope FROM auth.permissions WHERE module_name IS NULL;

-- P3 dangling role_permissions
SELECT rp.role_id, rp.permission_id FROM auth.role_permissions rp
LEFT JOIN auth.permissions p ON p.id = rp.permission_id WHERE p.id IS NULL;
```

**P4 (application-side, not SQL):** every stored code `module_name.resource.action` must be declared somewhere in code (`require_permission(...)`, manifests, Foundation per-node permissions).
- `module_name` is a permission **namespace** (for example `studio`, while the module directory is `workflow_studio`), not a row of `core.modules`. That table is empty in this database, so a SQL check against it is invalid; this was found when a first SQL draft of the check returned 25 false positives.
- **Local result:** 34 / 34 codes declared.

**Results on the local test DB (2026-10-14):** P1 0, P2 0, P3 0, P4 0 undeclared.

**Post-checks:**
- **V1:** `uq_permission_identity` exists and `indisvalid`; `uq_permission_resource_action_scope` is gone (after step 5).
- **V2:** the row count and the `(role_id, permission_id)` grant set are identical to the pre-flight snapshot.
- **V3:** for a sample of users per tenant, the codes derived by `load_role_names_and_permissions` before and after are identical.

---

## 6. Rollback and Its Limits

- **Steps 2–3 are reversible:** drop the new index; drop the check / `DROP NOT NULL`.
- **Step 5 is reversible only while no second-module duplicate exists.** Once module B's `items.read` is stored next to module A's, re-creating `UNIQUE (resource, action, scope)` **fails**. Rolling back then requires removing or renaming rows, which revokes grants via CASCADE.
- **Therefore:**
  - keep the release that drops the old constraint separate;
  - document that rolling back past it may need a data decision;
  - never write a downgrade that deletes permission rows automatically.
- **Application compatibility:** the code changes (model, seed) work against **both** schemas, so the application can be deployed before step 5 and rolled back independently.

---

## 7. Tests

**Present now:**

| Test | Tier | Proves |
|---|---|---|
| `test_current_schema_cannot_store_two_modules_with_the_same_resource_action` | PostgreSQL, **rolled-back** transaction | today's DB refuses module B's same-named row (no silent conflation at the DB; the seed must refuse too) |
| `test_preflight_queries_are_valid_and_read_only` | PostgreSQL, `SET TRANSACTION READ ONLY`, rolled back | P1–P3 parse and run against the real schema; 0 rows locally |
| `tests/unit/test_n2b_permission_identity.py` (2) | unit | two modules' `items.read` derive two distinct codes, and one does not authorize the other; a NULL module derives a cross-module wildcard |
| `TestSeedPermissionIdentity` (S2.1, 5) | unit | the seed reuses the same module's row and refuses another module's |

**Required in the implementation phase** (not written; there is no migration to test):
- a fresh-database migration test (the `alembic upgrade head` pattern of `test_form_platform_fresh_database_migration.py`):
  - module A and B `items.read` coexist;
  - an identical identity is rejected;
  - a NULL `module_name` is rejected (if C-D1 = NOT NULL);
- an upgrade-on-populated-DB test: grants and derived codes are identical before and after (V2/V3);
- downgrade with and without a second-module duplicate: the latter must fail loudly, not delete rows.

**Results:** preflight PG 2 passed; unit 2 passed (inside the 3,881).

---

## 8. Decisions Required Before Implementation

| # | Decision | Options |
|---|---|---|
| C-D1 | NULL `module_name` | (a) NOT NULL (recommended: removes the implicit cross-module wildcard); (b) allow it, with a COALESCE unique index (keeps wildcard rows possible) |
| C-D2 | `scope` column | Kept in the key unchanged (always `*` today). Confirm it has no planned meaning that would make two rows with different scopes the same grant. |
| C-D3 | Release split | Confirm the old constraint is dropped in a later release than the new index is created (§6). |

## 9. Verdict: **GO (plan)**

- The plan aligns DB identity with `module.resource.action`.
- It blocks silent conflation without touching any existing grant.
- Pre-flight checks are executable and pass locally; ordering, rollback limits and the tests still to write are defined.
- Implementation needs explicit approval of C-D1–C-D3 and of a schema change.

**Files:**
- New: `tests/integration/workflow_postgres/test_n2b_permission_identity_preflight.py`, `tests/unit/test_n2b_permission_identity.py`, and this plan.
- No production code changed for Workstream C.

**No migration executed. No commit and no push.**
