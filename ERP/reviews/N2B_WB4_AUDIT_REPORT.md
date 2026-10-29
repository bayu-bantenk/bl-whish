# N-2B WB-4 — Studio Template Ownership Audit

**Date:** 2026-10-29
**Authorisation:** audit only. Read-only inspection and re-running existing tests. **No implementation, no test changes, no data changes.**
**Source tree:** `~/Developments/My ERP/version 1.0` (backend `backend/app`, frontend `frontend/shell/src`). The evidence repository `~/Developments/bl-whish/ERP/reviews/` mirrors the N-2B reports; its copy of the S2.3 plan has the same WB-4 text.

---

## 1. WB-4 scope

**Authoritative source:** `N2B_S2_3_DECISION_CLOSURE_AND_WORKFLOW_BOUNDARY_PLAN.md`.

| Location | Text |
|---|---|
| §4, `:210` | "**WB-4 — Studio templates (B-3). Owner decision first; touches S3.**" |
| §4, `:211–214` | **Option T1 (tenant templates):** `create_template` takes the caller's tenant; `is_builtin` honoured **only** for a platform publish path; list/get admit own + platform-builtin rows; update/delete stay owner-only. |
| §4, `:215` | **Option T2 (platform templates):** template writes become platform-only; tenants read only. |
| §4, `:216` | **Tests:** PG create/update/delete by the owner; another tenant 404; `is_builtin` from a tenant body refused or ignored; Playwright Studio specs. |
| §2.1, `:51` | Current state: `create_template` sets no tenant → **always global**; `is_builtin` comes from the request body; update/delete use `_load_owned_or_raise`. |
| §3, `:173`; §7, `:307` | B-3 **OPEN**, MEDIUM; owner decision T1/T2; **blocks S3's Studio-template create**. |
| §8, `:378` | "S3 can't define the template-create behaviour until T1/T2 is decided. Alternatively, exclude templates from S3 explicitly." |

**Exact objective:** make Studio template ownership consistent with the owner's B-3 choice (T1 or T2). The prerequisite is that owner decision.

**Status of the prerequisite:** **not recorded.**
- Every N-2B report after S2.3 was searched: WB-1, WB-2, WB-2.1, V-1, V-1.1, WB-3, WB-3.1 and the `bl-whish/ERP` mirror.
- None records a T1/T2 decision. B-3 appears only as OPEN.
- The scope is therefore **known**, so this is not *BLOCKED — SCOPE UNKNOWN*. This audit establishes current behaviour against both options; it cannot pick one.

---

## 2. Verdict

**NO-GO for WB-4 closure.**

| Meaning in this audit | |
|---|---|
| What NO-GO means here | The WB-4 objective is **not met** by the current code. Template ownership matches **neither** T1 nor T2, and the defects below are confirmed from source and pinned by an existing passing test. |
| What it does **not** mean | It is not a claim that a live cross-tenant leak was reproduced on PostgreSQL. That needs template rows, which this audit was not allowed to create (§7). The test DB holds **0** template rows. |
| What is needed to move forward | (1) the owner's T1/T2 decision; (2) a separately authorised implementation phase. Neither WB-5 nor S3 is unblocked by this report. |

---

## 3. Prerequisite verification

| Workstream | Relevance to WB-4 | Current state (verified in source) |
|---|---|---|
| S1 strict mutations | introduced `_load_owned_or_raise` used by template update/delete | present (`infrastructure/repositories.py:110–120`); S1 guard 31/31 pass |
| S2 platform principal | `reject_platform_principal` on the Studio router | present: `studio_router = APIRouter(dependencies=[Depends(reject_platform_principal)])` (`workflow_studio/api/__init__.py:26`) |
| WB-1 publication tenancy | same module; separate concern (published definitions, not templates) | closed for publications; does not touch templates |
| WB-2 / V-1.1 / WB-3.1 | Legacy instances, list routes, Foundation resolver | closed; **no overlap** with templates. Nothing below duplicates them. |
| S2.3 B-3 owner decision | **required before WB-4 implementation** | **not recorded** |

---

## 4. Scope and methodology

**Code paths traced** (`backend/app/modules/workflow_studio/`):

| Layer | File / function | Tenant handling |
|---|---|---|
| Router guard | `api/__init__.py:26` | rejects platform principals; **no** `require_tenant_context` |
| Create | `api/template_router.py:34–54` `create_template` → `templates/service.py:70–100` → `SqlAlchemyTemplateRepository.create` (`infrastructure/repositories.py:235`) → `template_from_domain` (`infrastructure/mappers.py:198–201`, `tenant_id=dto.tenant_id`) | the router passes no tenant; `StudioTemplate` is built without `tenant_id` → **NULL** |
| `is_builtin` | `api/schemas.py:142` (request body) → `service.py:94` → `TemplateRegistry.register_builtin` (`templates/registry.py:19–25`) | **taken from the caller**; no platform check |
| Import | `template_router.py:136–153` → `service.py:146–158` → `import_export.py:47–82` | no tenant; `is_builtin` not read from the bundle; `workspace_id` only flows into an event, no lookup |
| Get | `repositories.py:241–246` `_enforce_tenant` (`:91–107`) | admits `tenant_id IS NULL` for every caller |
| List | `repositories.py:248–272` | `tenant_id IS NULL` (no tenant) or own + NULL |
| Update / delete | `repositories.py:274–283` `_load_owned_or_raise` → `load_owned` | strict: NULL row → not found for **everyone**; no tenant → 403 |
| Export | `template_router.py:156–169` (`GET`) | read rule (same as get) |
| Version history | `template_router.py:172–181` → `service.version_history` (in-memory `TemplateVersionHistory`, `service.py:49`) | the service is rebuilt per request (`api/dependencies.py:171–195`) |
| Database | `workflow_studio.workflow_studio_templates`, RLS `tenant_isolation` (text variant) | policy admits `tenant_id IS NULL` for everyone (§4.1) |
| Frontend | `frontend/shell/src/features/workflow_studio/services/studioApi.ts:166–200`; `ui/template_panel/StudioTemplatePanel.tsx`; `ui/StudioEditor.tsx:182–192` `handleUseTemplate` | lists all visible templates; shows "· built-in" for `is_builtin`; **Use** merges the template's nodes and transitions into the open draft |

### 4.1 Read-only database inspection

- **Engine:** local Homebrew PostgreSQL 14.20 test database (`localhost:5432/erp_platform`, user `erp_user`, from `backend/.env`).
- **Transaction:** `BEGIN READ ONLY`, with RLS bypass set transaction-locally for the count, then `ROLLBACK`. No row was written.

| Query | Result |
|---|---|
| `workflow_studio_templates`: total / NULL-tenant / builtin / distinct tenants | **0 / 0 / 0 / 0** |
| `pg_policy` on the table | `tenant_isolation`, all commands: `tenant_id IS NULL OR bypass OR (current tenant set AND tenant_id = current tenant)` |
| `relrowsecurity` / `relforcerowsecurity` | `t` / `t` |

**Excluded:**
- any write to the test DB, including template creation on PostgreSQL;
- non-test databases;
- Playwright: no spec exercises templates. `studio-tenant-ownership.spec.ts:14–17` excludes them deliberately, because a created template would be an undeletable global row.

---

## 5. Findings

**Reproduction status vocabulary:**
- **Test-verified:** asserted by an existing test that was run here.
- **Code-confirmed:** follows directly from the cited source, not executed.
- **Unverified:** depends on data or configuration this audit could not inspect.

| ID | Severity | Finding | Location | Status and evidence |
|---|---|---|---|---|
| **W4-1** | **MEDIUM** | **Every template is global.** A template created by tenant A is stored with `tenant_id NULL`. Every tenant with `studio.template.read` can then list and get it, payload included, and export it. Cross-tenant **confidentiality** loss for template content. | `service.py:82–91` (no tenant), `mappers.py:201`; read rule `repositories.py:91–107, 259–265`; RLS admits NULL | **NULL storage and readability: test-verified** on SQLite. `test_workflow_studio_api.py::TestTemplateAPI::test_create_get_update_template` creates as a caller in a real tenant and asserts `tenant_id is None` and GET 200. **Visibility to a second tenant: code-confirmed**, not executed: no existing test creates as A and reads as B. |
| **W4-2** | **MEDIUM** | **Cross-tenant content injection.** Because of W4-1, any tenant holding `studio.template.write` can publish workflow-graph content that appears in **every** tenant's Studio template panel. A user there can merge it into their own draft with one click. | `StudioTemplatePanel.tsx:118–123` → `StudioEditor.tsx:182–192` (`handleUseTemplate` appends nodes and edges, marks dirty) | **Code-confirmed.** User action is required, and the merged graph still goes through the victim's own validation and publish. **Who holds `studio.template.write` in real environments: unverified.** No seed grants it explicitly; `*.*.*` holders have it (`core/auth/rbac.py:92`). |
| **W4-3** | **MEDIUM** (combined with W4-2) | **`is_builtin` is caller-controlled.** Any template writer can set `is_builtin: true`. The UI then labels the template "· built-in" for all tenants, impersonating platform-provided content. T1 and T2 both require refusing or ignoring this. | `api/schemas.py:142`, `template_router.py:52`, `service.py:94`, `registry.py:19–25`; UI `StudioTemplatePanel.tsx:97` | **Code-confirmed.** No existing test sends `is_builtin` from a tenant. The import path does **not** read `is_builtin` (bundle fields `import_export.py:59–70`). |
| **W4-4** | **LOW–MEDIUM** (integrity / availability) | **Templates are immutable and undeletable, even by their creator.** Update and delete use strict ownership, which rejects NULL rows. A mistaken or malicious template (W4-2/3) can be removed only by direct database work. | `repositories.py:274–283` | **Test-verified:** the same test asserts the creator's `PUT` → **404** and the name unchanged. Delete uses the identical helper (code-confirmed). |
| **W4-5** | **LOW** | **Tenant-less writes are not refused at the edge.** The Studio router rejects platform principals but not a tenant-scope token without `tid`, and template create/import never consult the tenant. Such a caller can create a global template (RLS `WITH CHECK` admits NULL rows). In practice the result is the same as W4-1. | `api/__init__.py:26`; `template_router.py:34–54, 136–153` | **Code-confirmed;** not executed (would write). Update/delete are already refused (403) by `load_owned`. |
| W4-6 | INFO | Template version history is always empty over HTTP: `TemplateVersionHistory` is in-memory on a service rebuilt per request. Functional, not tenancy. | `service.py:49, 97, 166`; `api/dependencies.py:171–195` | Code-confirmed |
| W4-7 | INFO | Frontend export calls `POST …/templates/{id}/export`; the backend route is `GET`. Export from the UI fails (likely 405). Functional. | `studioApi.ts:198–199` vs `template_router.py:156` | Code-confirmed; not executed |
| W4-8 | INFO (test gap) | No test covers templates on PostgreSQL, cross-tenant template reads, `is_builtin` from a tenant body, or tenant-less template writes. | §6 | — |

- **On W4-1 / W4-2 severity:** S2.3 rated B-3 MEDIUM, and this audit keeps that rating.
- **Why not higher:**
  - no template rows exist in the test DB, and real data is unknown;
  - exploitation requires `studio.template.write`;
  - injection needs a victim to choose **Use**.
- **Why not CRITICAL under the critical-finding rule:** it is not live-reproduced. Raise the rating if real environments grant template write broadly to tenant users.

**Not findings (verified):**
- **Platform principal:** refused on all template routes (router guard).
- **Update/delete of another tenant's owned template:** not found (`load_owned`).
- **RLS:** enabled and forced on the table.

---

## 6. Regression status

Each file was run separately from `backend/` with `.venv/bin/pytest <file> -q -p no:cacheprovider`. Disk was checked first (13 GiB free).

| File | Engine | Result |
|---|---|---|
| `tests/unit/test_workflow_studio_api.py` | SQLite in-memory | **36 passed** |
| `tests/unit/test_workflow_studio_templates.py` | none (domain / service) | **42 passed** |
| `tests/unit/test_workflow_studio_infrastructure.py` | SQLite in-memory | **40 passed** |
| `tests/unit/test_n2b_s1_ownership_architecture.py` | AST | **31 passed** |
| `tests/integration/workflow/test_security_enforcement.py` | SQLite integration | **8 passed, 2 skipped** (pre-existing skips) |

- **Targeted re-run:** `TestTemplateAPI` (3 tests) + `test_template_create_without_permission_returns_403_and_not_listed`: **4 passed**.
- **Totals:** 157 passed, 2 skipped, 0 failed, 0 xfailed.

**What these tests do and do not prove:**
- **They prove:** templates are created NULL-tenant; creator updates are refused; template write needs `studio.template.write`.
- **They do not prove:** cross-tenant isolation, `is_builtin` handling, or tenant-less behaviour. The passing suite is **not** evidence of any tenant-isolation property for templates.
- **One test pins the defect as current behaviour:** `test_create_get_update_template` asserts `tenant_id is None` and update → 404, with a comment deferring to B-3. Any T1/T2 implementation must change that assertion deliberately.

- **Not run:**
  - PostgreSQL suites: no PG test touches templates, and the WB-3.1 baseline (42 files, 414 passed + 1 xfail) is unaffected because no code changed.
  - Playwright: no template spec exists.

---

## 7. Unverified risks

| Risk | Why unverified | What would verify it |
|---|---|---|
| Cross-tenant template read and injection on **PostgreSQL** over real HTTP | requires creating template rows; forbidden in this phase, and such rows are undeletable through the API (W4-4) | an authorised PG test that creates under tenant A, reads as B, then deletes via `admin_session()` (or a disposable DB) |
| Existing template rows in real environments | non-test database access forbidden | authorised read-only inventory per environment: count by `tenant_id IS NULL`, `is_builtin` |
| Who holds `studio.template.write` in real environments | role and permission data in real environments not inspected | authorised read-only role/permission inventory |
| W4-7 export method mismatch | not executed in a browser | a browser or HTTP check in a later functional pass |

---

## 8. Remediation proposal (recommendations only)

**Common to T1 and T2:**
1. Ignore or refuse `is_builtin` from tenant callers (W4-3). Only a platform seeding or publish path may set it.
2. Add `require_tenant_context` to template **write** routes, or to the template router (W4-5).
3. Replace the pinned assertion in `test_create_get_update_template` with the chosen contract.
4. Add PG + SQLite HTTP tests:
   - owner create/update/delete;
   - another tenant gets 404 on get, update and delete;
   - tenant-less callers get 403;
   - `is_builtin` from a tenant body is refused or ignored;
   - **a NULL legacy row** behaves per the decision.
   Add mutation checks, following the V-1.1 / WB-3.1 practice.

**Option-specific:**

| | T1 — tenant templates | T2 — platform templates |
|---|---|---|
| Create / import | stamp the caller's tenant (`template_router.py` → service → domain `tenant_id`) | platform principal only; tenants get 403 |
| List / get / export | own + **platform builtin** rows (filter NULL rows to `is_builtin = true`, or a dedicated platform marker) | everyone reads platform rows |
| Update / delete | owner-only (already strict; works once rows have a tenant) | platform principal only, which needs a platform write path, since today `load_owned` refuses tenant-less callers and the router rejects platform principals |
| Existing NULL rows | 0 in the test DB; real environments unknown. Decide: treat as platform-builtin (read-only) or hide. | treated as platform templates |
| Compatibility | Studio UI unchanged for owners; other tenants stop seeing non-builtin templates | tenant users lose create, import, update and delete in the template panel; the UI must hide those actions |
| Effort | smaller: mostly create path + read filter | larger: a new platform write path plus UI changes |

**Separately (functional, not blocking WB-4):** fix W4-6 (version history persistence) and W4-7 (export method).

**S3 coupling:** per S2.3 §8, either decide T1/T2 before S3, or explicitly exclude template create from S3.

---

## 9. Required authorisation

| Item | Needed for |
|---|---|
| **Owner decision B-3: T1 or T2** | any WB-4 implementation; S3 scope for Studio-template create |
| Implementation phase (e.g. "WB-4.1") | §8 changes, including updating the pinned test |
| PG reproduction with template writes (test DB, with cleanup through `admin_session()`, or a disposable DB) | turning W4-1/W4-2 from code-confirmed into reproduced on PostgreSQL |
| Read-only real-environment inventory (templates; holders of `studio.template.write`) | sizing W4-1–W4-3 exposure; handling existing NULL rows |

---

## 10. Explicit non-actions

- **Code, tests, configuration:** no application code, test, migration, schema, RLS policy, grant, permission, runtime configuration or module state was changed. `git status` shows no modification attributable to this phase. The repository has no commits, so every file shows as added.
- **Database writes:** none. The only database access was one `BEGIN READ ONLY … ROLLBACK` session on the local **test** PostgreSQL (§4.1).
- **No probe records were created.** No existing data was cleaned up; the WB-3 `wb3_probe` and WB-3.1 `wb31_fnd` rows are untouched.
- **No non-test database was accessed** and no real-environment count was run.
- **Not started:** WB-5, S3 or any fix.
- **No Git commit, push or publish.**

## Files changed

- **Added:** `docs/architecture/reviews/N2B_WB4_AUDIT_REPORT.md`.
- **Not added:** no cross-reference in the S2.3 plan; it remains the historical source of WB-4.
