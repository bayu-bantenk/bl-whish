# N-2B WB-4.1 — Studio Template Tenant Ownership Fix

**Date:** 2026-10-29
**Decision implemented:** B-3 = **T1, tenant-owned templates** (owner-approved for this phase).
**Input:** `N2B_WB4_AUDIT_REPORT.md` (findings W4-1 to W4-8).
**Scope:** Studio templates only. WB-5 and S3 not started; S3 does not re-enable or change template creation.

## 1. Verdict

**GO.**

- **Ownership on create:** a template belongs to its creator's authenticated tenant. A body-supplied tenant is ignored.
- **Cross-tenant isolation:** another tenant gets exactly a nonexistent id's response on every template route, and never sees the template in a listing. A NULL-tenant (legacy global) row is visible to and mutable by no one.
- **Tenant context:** missing, empty, malformed and platform-principal contexts get 403 before any write.
- **`is_builtin`:** refused on create and ignored on update and import, so a tenant can never make a built-in template.
- **Evidence:**
  - 10 new HTTP tests pass on **PostgreSQL (RLS active)** and **SQLite (no RLS)**; 8 of them fail on the pre-fix code on each engine.
  - 12/12 mutations are caught.
  - No regression: unit 3,982 passed; SQLite workflow 210 passed, 5 skipped; top-level integration 21 passed; PostgreSQL 43 files, 424 passed + 1 known xfail, 0 failed; frontend Studio tests 394 passed, typecheck clean.
- **Not blocking:** W4-6 (version history) is a disclosed functional limitation, not a security gap (§4).

---

## 2. T1 policy and resulting behaviour

**Policy:**
- Every template is owned by exactly one tenant: the **caller's validated tenant context**, never a value carried by the request or the template.
- Only that tenant can list, get, export, read history for, update or delete it.
- No trusted platform mechanism for built-in templates exists in the code (WB-4 §4: no seeding or platform publish path), so none was kept or added. Every SQL-stored template is tenant-owned and **never** built-in.
- **No new platform template API.**

| Caller | create / import | list | get / export / versions | update / delete |
|---|---|---|---|---|
| Owner tenant A | 201, `tenant_id = A`, `is_builtin = false` | own templates only | 200 | 200 / 204 |
| Other tenant B | (its own templates) | A's never listed | **404**, same body as a nonexistent id | **404**, row unchanged |
| Any tenant, NULL-tenant legacy row | — | never listed | **404** | **404** |
| No / empty / malformed `tid`, platform principal | **403**, no row | **403** | **403** | **403** |
| Tenant with `is_builtin: true` | create **403** ("Built-in templates cannot be created by a tenant"); import ignores the field | — | — | update ignores the field (stays `false`) |

**Before → after (from the audit and this phase's pre-fix runs):**
- every template was NULL-tenant and readable by all, including its payload;
- nobody, not even the creator, could update or delete one;
- `is_builtin` was taken from the request body;
- tenant-less tenant principals could create global templates.

---

## 3. Files changed

**Backend application:**

| File | Change | Why |
|---|---|---|
| `backend/app/modules/workflow_studio/infrastructure/repositories.py` `SqlAlchemyTemplateRepository` | **create:** `owner = require_tenant(get_tenant_id())`; refuse `is_builtin`; `orm.tenant_id = str(owner)`, overriding the DTO. **get:** `_load_owned_or_raise` (was `session.get` + `_enforce_tenant`, which admitted NULL). **list:** `where(owned_by(TemplateORM, require_tenant(get_tenant_id())))` (was own + NULL, or NULL-only without a tenant, or everything under bypass). **update:** refuse `is_builtin`; `_copy_fields(..., skip=("id", "tenant_id"))` so the owner cannot be rewritten. **delete:** unchanged (already strict). Class docstring records the T1 rule. | persistence-layer enforcement, independent of any route (W4-1, W4-3, W4-4, W4-5) |
| `backend/app/modules/workflow_studio/api/template_router.py` | `router = APIRouter(dependencies=[Depends(require_tenant_context)])`; `create_template` refuses `body.is_builtin` (`StudioPermissionError` → 403) and passes `is_builtin=False`; `get_template_versions` checks ownership (`get_template`) before answering | edge enforcement (W4-3, W4-5); history no longer answers for foreign ids |

- **Reused, nothing new added:** helpers `require_tenant_context`, `require_tenant`, `owned_by`, `_load_owned_or_raise`; errors `StudioPermissionError`, `TemplateNotFoundError`.
- **Unchanged:** schema, migrations, RLS, grants and permissions.
- **Unchanged:** the domain model, mappers, `TemplateService`, response DTOs, ordering, query filters, and permission checks (`studio.template.read` / `write`).
- **Diff size:** router 22 diff lines, repository 32. Pre-fix copies are in `scratchpad/wb4_1/*.pre`.

**Frontend:**

| File | Change |
|---|---|
| `frontend/shell/src/features/workflow_studio/services/studioApi.ts` `exportTemplate` | `apiClient.post` → `apiClient.get` (W4-7). The backend contract is `GET` (`template_router.py`, read-only, `response_model`), and POST returned 405. |
| `frontend/shell/src/features/workflow_studio/__tests__/studioApi.test.ts` | the export test now expects GET (it pinned the bug) |

**Tests:**

| File | Change |
|---|---|
| `backend/tests/unit/test_workflow_studio_api.py::TestTemplateAPI::test_create_get_update_template` | **updated as instructed:** it asserted `tenant_id is None` and creator `PUT` → 404 (the B-3 placeholder); it now asserts `tenant_id == tenant` and creator `PUT` → 200 with the rename persisted |
| `backend/tests/unit/test_workflow_studio_infrastructure.py::TestTemplateRepository::test_update` | **contract change, disclosed:** it asserted that a repository update can set `is_builtin=True` (the W4-3 behaviour). It now asserts a version update works, `is_builtin` stays `False`, and an update to built-in raises `StudioPermissionError`. Plus one import. |
| `backend/tests/integration/workflow/test_n2b_wb4_1_studio_template_ownership.py` | **new**, 10 HTTP tests (SQLite) |
| `backend/tests/integration/workflow_postgres/test_n2b_wb4_1_studio_template_ownership.py` | **new**, re-collects the 10 on PostgreSQL |
| `backend/tests/unit/test_n2b_wb4_1_template_ownership_layers.py` | **new**, 6 tests pinning repository and router layers individually (§6) |

No other existing assertion was changed or weakened.

---

## 4. Findings W4-1 to W4-8

| ID | Status | Evidence |
|---|---|---|
| W4-1 every template global, readable by all | **Resolved** | owner-stamped create; strict get/list/export; HTTP `test_other_tenants_cannot_list_read_export_update_or_delete` and `test_a_null_tenant_template_is_visible_to_and_mutable_by_no_one` (both engines) |
| W4-2 cross-tenant content injection via **Use** | **Resolved** | **Use** (`StudioEditor.tsx:182–192`) merges only the payload of a template the panel **listed**. There is no separate server "use" endpoint, so the list and get endpoints are the only server sources of template content, and both are now owner-only. The B/C test asserts A's id is absent from B's listing **and** A's payload marker (`"a-only"`) never appears in B's list response; get/export of A's id is 404. The control is server-side, not frontend filtering. |
| W4-3 `is_builtin` caller-controlled | **Resolved** | router refusal + repository invariant; `test_a_tenant_cannot_create_or_turn_a_template_built_in`, `test_import_is_owned_by_the_importing_tenant`, unit layer tests |
| W4-4 nobody can update or delete | **Resolved** | owner update 200 / delete 204: `test_creator_tenant_owns_the_template_and_keeps_every_operation`; the updated `test_create_get_update_template` |
| W4-5 tenant-less writes not refused | **Resolved** | router `require_tenant_context` + repository `require_tenant`; `test_callers_without_a_valid_tenant_are_refused_before_any_write[missing\|empty\|malformed\|platform]` |
| W4-6 version history empty over HTTP | **Not changed: documented limitation.** The history is in-memory on a per-request `TemplateService`. No persistence subsystem was introduced, and no history is fabricated. The route now **checks ownership first** (foreign → 404); for the owner it still returns `[]`, asserted as the documented behaviour. | owner test (`versions == []`); foreign 404 in the B/C test |
| W4-7 export POST vs GET | **Resolved** (frontend → GET) | owner test: GET 200, POST 405; frontend `studioApi.test.ts` |
| W4-8 test gaps | **Resolved** for templates (PG + SQLite HTTP, layer unit tests) | §5 |

---

## 5. PostgreSQL and SQLite evidence

All commands were run from `backend/` with `-q -p no:cacheprovider`, one PostgreSQL file per invocation. Disk was checked before running (13–14 GiB free).

### 5.1 New HTTP tests: before vs after the fix

Pre-fix state: router and repository temporarily restored, then the fix restored (SHA verified).

| File | Pre-fix | Post-fix |
|---|---|---|
| SQLite `workflow/test_n2b_wb4_1_studio_template_ownership.py` | **8 failed**, 2 passed | **10 passed** |
| PG `workflow_postgres/test_n2b_wb4_1_studio_template_ownership.py` | **8 failed**, 2 passed | **10 passed** |
| `test_workflow_studio_api.py` (updated) | 1 failed (`test_create_get_update_template`) | 36 passed |
| `test_workflow_studio_infrastructure.py` (updated) | 1 failed (`test_update`) | 40 passed |

- **What already passed pre-fix:** the platform-principal case (already refused by the Studio router's S2 guard) and the unchanged permission test.
- **What failed pre-fix:** every ownership, tenant-context and `is_builtin` case.
- **Cross-tenant behaviour was exercised, not inferred:** tenant B and C tokens against A's template, on both engines.

### 5.2 Suites (post-fix)

| Suite | Result |
|---|---|
| Unit (full): `.venv/bin/pytest tests/unit --ignore=tests/unit/test_engine_execution.py` | **3,982 passed, 0 failed** (3,976 + 6 new) |
| SQLite workflow: `tests/integration/workflow` | **210 passed, 5 skipped** (pre-existing skips; 200 + 10 new), 0 failed |
| Top-level integration: `tests/integration/test_*.py` | **21 passed** |
| PostgreSQL: 43 files, each separately | **424 passed, 1 xfailed** (pre-existing N-2 strict xfail), **0 failed, 0 skipped, 0 errors** (414 + 10 new) |
| Existing Studio template files | `test_workflow_studio_api.py` 36, `test_workflow_studio_templates.py` 42, `test_workflow_studio_infrastructure.py` 40, `test_n2b_s1_ownership_architecture.py` 31, `test_security_enforcement.py` 8 passed + 2 skipped |
| Frontend: `npx vitest run src/features/workflow_studio` | **53 files, 394 passed** (incl. `studioApi.test.ts` 51, `StudioTemplatePanel.test.tsx` 6, `StudioEditorPageMore.test.tsx` 3 for the Use flow) |
| Frontend typecheck: `npx tsc --noEmit -p .` | clean (exit 0) |

- **Playwright:** not run. No browser spec exercises templates (`studio-tenant-ownership.spec.ts:14–17` excludes them), and adding one is outside the authorised scope. The template panel and Use flow are covered by the frontend unit tests above.

---

## 6. Mutation evidence

- **Method:** each mutant was applied to the fixed router and/or repository, then run against:
  - the unit tests (layer tests, infrastructure and API);
  - the SQLite HTTP file;
  - the PostgreSQL HTTP file.
- **Restore:** the fix was restored afterwards (SHA verified).
- **First round:** run before the layer unit file existed. M4 and M6a then survived at every level (masked at HTTP, see below). That led to adding `test_n2b_wb4_1_template_ownership_layers.py` and one stricter HTTP assertion (`versions` must be 404 for a foreign id).
- **Table:** the final round.

| ID | Mutation | Unit | SQLite HTTP | PG HTTP | Result |
|---|---|---|---|---|---|
| M1 | tenant filter removed from list | 3 failed | 2 failed | 3 failed | **caught** |
| M2 | NULL/global visibility restored on list | 1 failed | 1 failed | 3 failed | **caught** |
| M3 | pre-fix read rule (own + NULL) restored on get | 2 failed | 1 failed | 1 failed | **caught** |
| M4 | repository update loads without ownership (foreign update) | 3 failed | 0 | 0 | **caught (unit)** |
| M5 | repository delete loads without ownership (foreign delete) | 4 failed | 2 failed | 2 failed | **caught** |
| M6a | router trusts body `is_builtin` (repository invariant kept) | 1 failed | 0 | 0 | **caught (unit)** |
| M6b | repository accepts `is_builtin` (router refusal kept) | 2 failed | 0 | 0 | **caught (unit)** |
| M6c | both layers trust `is_builtin` | 3 failed | 1 failed | 1 failed | **caught** |
| M7a | router tenant requirement removed (repository kept) | 0 | 3 failed | 3 failed | **caught (HTTP)** |
| M7b | create does not stamp the caller's tenant | 4 failed | 3 failed | 3 failed | **caught** |
| M7c | create skips tenant enforcement entirely (router + repository) | 5 failed | 6 failed | 6 failed | **caught** |
| M8 | versions route skips ownership | 0 | 1 failed | 1 failed | **caught (HTTP)** |

- **Total:** 12/12 caught.
- **Why M4, M6a and M6b are invisible over HTTP:** in each case a second layer still refuses, so the HTTP contract holds.
  - **M4:** `TemplateService.update_template` always does a strict `get` first, so a foreign id is already a 404.
  - **M6a, M6b:** the router and repository each refuse `is_builtin`.
  - These are defence-in-depth mutants: each removes one of two barriers, and the layer tests pin each barrier individually.
- **The five targeted classes are all caught:**

| Targeted class | Mutants |
|---|---|
| read filter removed | M1 |
| NULL/global visibility restored | M2, M3 |
| foreign update/delete | M4, M5 |
| trusting `is_builtin` | M6a–c |
| creation without tenant enforcement | M7a–c |

---

## 7. Compatibility impact and remaining risks

**Compatibility:**
- **Response shape:** unchanged (asserted: response keys == `StudioTemplate.model_fields`).
- **Permissions:** unchanged.
- **Behaviour changes, all intended by T1:**
  - other tenants no longer see a template;
  - the creator can now update and delete it;
  - tenant-less callers get 403 on **reads** too (previously they got NULL-tenant rows), consistent with V-1.1;
  - `is_builtin: true` on create now gets 403 instead of creating a built-in.
- **Frontend:** export now works (GET). The panel and Use flow are unchanged; they simply receive only the caller's templates.

**Existing NULL-tenant templates:**
- They are now **invisible and immutable for every tenant**.
- They are not migrated or deleted (schema/data change not authorised).
- In real environments, existing global templates would disappear from every tenant's panel. Whether any exist there is **unknown** (non-test inventory not authorised).
- If intended platform templates exist there, a platform template mechanism is a separate decision (T1 provides none).

**Remaining risks:**

| ID | Risk | Status |
|---|---|---|
| R-1 | W4-6 version history remains empty over HTTP (in-memory, per request) | documented limitation; a persistence design would be a separate phase |
| R-2 | No platform built-in template mechanism exists. If one is wanted, it needs a trusted platform write path (the T2-like part), which is out of scope. | by decision |
| R-3 | Real-environment NULL-tenant templates become hidden (above) | needs an authorised read-only inventory before deployment |
| R-4 | `TemplateRegistry._builtin_ids` / `InMemoryTemplateRepository` still allow built-ins **in memory** (unit tests, builders). Not reachable through the SQL repository or HTTP. | unchanged, not exposed |
| R-5 | Template "Use" has no Playwright coverage | frontend unit tests only |

---

## 8. Confirmations

- **Database:** only the local Homebrew PostgreSQL 14 **test** database (`localhost:5432/erp_platform`, via test fixtures plus two `BEGIN READ ONLY … ROLLBACK` counts) and the in-memory SQLite engines were used. No non-test database was accessed or counted.
- **Test data created in the local test DB:** all named `wb41_*`, left in place per programme practice.
  - 179 tenant-owned rows;
  - 60 NULL-tenant rows, written by the deliberate **pre-fix** run and by mutants, which is exactly the old behaviour. They are invisible to every tenant under the fix.
  - 2 tenant-owned built-in rows written by the M6c mutant, visible only to their random test tenants.
  - The NULL row created by `test_a_null_tenant_template_is_visible_to_and_mutable_by_no_one` is deleted by that test itself.
- **No earlier probe data was cleaned up or modified** (WB-3 `wb3_probe`, WB-3.1 `wb31_fnd`).
- **No changes to:** schema, migrations, RLS, grants, global permissions, or module state. Nothing was installed or downloaded.
- **Out of scope, untouched:** workflow publication, the Foundation resolver and the Legacy engine. WB-5 and S3 not started.
- **No Git commit, push or publish.**

## Files changed

- **Application:**
  - `backend/app/modules/workflow_studio/infrastructure/repositories.py`;
  - `backend/app/modules/workflow_studio/api/template_router.py`;
  - `frontend/shell/src/features/workflow_studio/services/studioApi.ts`.
- **Tests, added:**
  - `backend/tests/integration/workflow/test_n2b_wb4_1_studio_template_ownership.py`;
  - `backend/tests/integration/workflow_postgres/test_n2b_wb4_1_studio_template_ownership.py`;
  - `backend/tests/unit/test_n2b_wb4_1_template_ownership_layers.py`.
- **Tests, updated:**
  - `backend/tests/unit/test_workflow_studio_api.py`;
  - `backend/tests/unit/test_workflow_studio_infrastructure.py`;
  - `frontend/shell/src/features/workflow_studio/__tests__/studioApi.test.ts`.
- **Docs:**
  - this report;
  - one pointer line in `N2B_WB4_AUDIT_REPORT.md`.
