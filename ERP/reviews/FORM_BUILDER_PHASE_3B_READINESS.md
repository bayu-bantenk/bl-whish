# FORM PLATFORM — PHASE 3B — FORM BUILDER LIFECYCLE & VERSION MANAGEMENT READINESS

## Status

**GO-WITH-CONDITIONS**

- **Done:** every Phase 3B quality gate passes on a real browser, the real backend, real PostgreSQL, the real Form Definition API and the real capability registry. **No backend production code was changed.**
- **Carried forward unresolved:** the three Phase 3A conditions (C-3A-1, C-3A-2, C-3A-3), all non-blocking.
- **New:** one non-blocking finding (P3B-1, an intermittent stale-view observation, mitigated) and one non-blocking backend gap (G-3B-1, list fields).
- Phase 3C or any later phase must not start without its own brief.

**Date:** 2026-10-06 · **Architecture:** `../FORM_BUILDER_PLATFORM.md` §12 · **Builds on:** `FORM_BUILDER_PHASE_3A_READINESS.md` (GO-WITH-CONDITIONS, accepted as such)

---

## 1. Executive Summary

Phase 3B adds **Form List, Form Detail, Version History, Version Detail, lifecycle actions, Create New Version, permission-aware availability and a collision-free route grammar** to the Builder. Everything is frontend, plus two backend *test/test-infrastructure* additions:
- the lifecycle contract test;
- two E2E personas in the seed script.

**The frontend is not a lifecycle authority.** Its only action table is `lifecycle_contract.json`, which is **generated from the backend router and service code by AST** and fails a backend test if the two disagree. It never computes, sets or sequences a status. It never numbers a version and never archives a previous version. Every action goes to the existing endpoint, and the UI then shows the server's answer.

## 2. Contract audit (brief §3): what actually exists

| Operation | Actual endpoint | Permission (from code) | Used by 3B |
|---|---|---|---|
| Form list | `GET /api/v1/form-definitions` | `core.forms.read` | Form List |
| Form detail (+ all versions) | `GET /form-definitions/{key}` | `core.forms.read` | Form Detail, Version Detail, editor |
| Version list | (part of form detail; server-ordered by version number) | `core.forms.read` | Version History |
| Version detail | `GET /form-definitions/{key}/versions/{n}` | `core.forms.read` | editor freshness check (3A) |
| Create form | `POST /form-definitions` | `core.forms.design` | New form (3A) |
| Create version / `copy_from` | `POST /form-definitions/{key}/versions` | `core.forms.design` | first version, **Create New Version** |
| Update draft | `PATCH /form-definitions/{key}/versions/{n}` (draft only) | `core.forms.design` | editor (3A) |
| Submit review | `POST …/{n}/submit` (draft → review) | **`core.forms.design`** | Submit for review |
| Return to draft | `POST …/{n}/reject` (review → draft, optional `comment`) | `core.forms.review` | Return to draft |
| Publish | `POST …/{n}/publish` (review → published; previous published → archived, server-side) | `core.forms.publish` | Publish |
| Archive | `POST …/{n}/archive` (published → archived) | `core.forms.publish` | Archive |
| Preview / runtime | `GET/POST /form-runtime/{key}` (capability permission) | n/a | **Not used by the Builder.** The preview stays local (3A). |
| Capability binding | `capability {id, version}` on every version view | n/a | shown pinned everywhere |
| Revision / ETag / precondition | **None.** `form_versions.updated_at` exists in the table but is neither returned nor checked. | n/a | C-3A-1 unchanged |

**Deviations of the actual contract from the brief's conceptual mapping (§9), followed as-is:**
- *Submit for review* requires `core.forms.design`, not `review`.
- *Create New Version* is accepted from any status.

There is **no missing lifecycle operation**. The only gap is informational (G-3B-1, §10).

## 3. Scope implemented

| Brief item | Implementation |
|---|---|
| Form List | `FormBuilderList.tsx`: only the list endpoint's fields; loading, empty, error, 403; row → detail; New form shown unless design is *known* missing |
| Form Detail | `FormDetail.tsx`: identity, owner module, current published version + binding, version history, per-version actions, first-version recovery (3A) |
| Version History | server order; status; exact `capability_id:vN`; created / submitted / reviewed / published / archived (by + at) as reported; review comment |
| Version Detail | `VersionDetail.tsx`: status, pinned binding, history, read-only presentation summary, shared preview, capability contract, actions |
| Lifecycle actions | `LifecycleActions`: confirmation dialog per action (comment for return-to-draft); calls the existing endpoint; shows the server response; re-reads; 403/409 shown as returned |
| Create New Version | `POST …/versions {copy_from}`; navigates to the server-numbered draft's editor |
| Permission-aware availability | `offeredActions(serverStatus, permissionHint)`; hidden only when the permission is *known* missing |
| Read-only modes | only a draft enters the editor; the editor route refuses other statuses |
| Routing | `/form-builder`, `/new`, `/forms/:key`, `/forms/:key/versions/:n`, `…/edit`; 3A address redirects |
| Conflict-aware editing | Phase 3A freshness + 409 behaviour, unchanged (no concurrency token exists) |

**Not implemented (forbidden scope, §25):** none of the listed items. No workflow, no concurrency redesign, no AuthStore change, no lint configuration.

## 4. Files changed

| | Files |
|---|---|
| **New, frontend** | `features/form_builder/{lifecycle.ts, lifecycle_contract.json (generated), shared.tsx, FormDetail.tsx, VersionDetail.tsx}`, `__tests__/{lifecycle.test.ts, lifecycle_flow.test.tsx}`, `e2e/tests/form-lifecycle-proof.spec.ts` |
| **Modified, frontend** | `features/form_builder/{api.ts (+performTransition), types.ts (+server version fields), FormBuilderEditor.tsx (versioned route, read-only guard; shared hooks moved out), FormBuilderList.tsx (list = read screen, server-numbered navigation)}`, `pages/form_builder/FormBuilderPages.tsx` (route grammar), `App.tsx` (routes), `components/layout/ShellLayout.tsx` (entry gated on `core.forms.read`), `__tests__/{architecture.test.ts, flow.test.tsx}`, `src/__tests__/ShellLayoutNavigation.test.tsx`, `e2e/tests/form-builder-proof.spec.ts` (3B routes) |
| **New, backend test** | `tests/unit/test_form_lifecycle_contract.py` (derives + pins the lifecycle contract) |
| **Modified, backend test infrastructure** | `scripts/seed_worklist_e2e.py`: additive. Roles `phase3b_form_author` (read, design) and `phase3b_form_reader` (read); users `phase3b_form_author_a`, `phase3b_form_reader_a`. |
| **Docs** | `FORM_BUILDER_PLATFORM.md` (§12 added, §2/§8/§11 updated), this report |
| **Backend production** | **None.** `app/core/form_platform/service.py` was temporarily mutated for a mutation check (§9) and restored. SHA-1 `3e3baf2f…a39f` was identical before and after; only its mtime changed. |

## 5. API endpoints actually used by the Builder

`GET /capabilities`; `GET /form-definitions`; `POST /form-definitions`; `GET /form-definitions/{key}`; `GET /form-definitions/{key}/versions/{n}`; `POST /form-definitions/{key}/versions`; `PATCH /form-definitions/{key}/versions/{n}`; `POST /form-definitions/{key}/versions/{n}/{submit|reject|publish|archive}`. That's all. The AST guard pins exactly 4 GET, 3 POST and 1 PATCH call sites, transition URLs built only from the contract, and no `/form-runtime`.

## 6. Lifecycle matrix (real backend, real PostgreSQL: `form-lifecycle-proof.spec.ts`)

| Transition / action | Expected | Result | Where |
|---|---|---|---|
| draft → save | draft | ✅ API `status == draft` after UI save | LF1 |
| draft → review | review | ✅ UI + API | LF1 |
| review → edit | rejected | ✅ PATCH **409**; no Edit button; editor route refuses | LF1 |
| review → draft (comment) | draft | ✅ UI + API `review_comment` | LF1 |
| review → published | published | ✅ UI + API; published-version link | LF1 |
| published → edit | rejected | ✅ PATCH **409**; editor route read-only | LF1 |
| published v1 → create v2 | v2 draft | ✅ server-numbered v2 (`POST …/versions`), editor `/versions/2/edit` | LF1 |
| edit v2 | v1 unchanged | ✅ v1 API document deep-equal before/after; browser PATCHed only v1 (pre-publish) and v2 | LF1 |
| publish v2 | v1 archived **by the server** | ✅ v1 Archived, v2 Published; the browser sent no archive request | LF1 |
| published → archive | archived | ✅ UI + API; runtime then 404 | LF1 |
| archived → edit | rejected | ✅ PATCH v1 and v2 **409** | LF1 |
| archived → publish | rejected | ✅ publish v1 and v2 **409** | LF1 |
| archived v1 | exactly as published | ✅ status `archived`, binding and document equal to the published snapshot | LF1 |

## 7. Evidence by property

| Property | Evidence |
|---|---|
| **Versioning** | Server numbers versions (UI navigates to the response's number). Copy is server-side (`copy_from` asserted in jsdom and in the E2E network log). One-published rule enforced by the server (UI made no archive call). |
| **Capability version** | Every version shows `leave_management.leave_request.create:v1`. v2 inherits it exactly (API equality). The runtime serves `key:v2 · …:v1`. The UI has no control to change it. |
| **Immutability** | 409 on PATCH for review/published/archived, 409 on publish for archived (§6). v1 byte-identical through v2's whole life. |
| **Tenant isolation** | LF3, tenant-B designer with all form permissions: list excludes A's forms; GET form and version **404**; PATCH, new version, submit, reject, publish, archive **404**; deep links to form, version and edit show "not available". Tenant-A state unchanged. |
| **Authorization** | LF2. Author (design only): Publish offered (permissions unknown after load, C-3A-2), server **403** shown under the action, status unchanged; reject/publish/archive **403**. Reader: GET 200, new version/submit/PATCH **403**, version page readable, preview explains it needs design, edit route "cannot design". The authorized reject then succeeds (the 403s were permission, not state). |
| **Deep-link security** | Outsider on `/form-builder`, `/forms/:key`, `/forms/:key/versions/1` → "You cannot view forms" (server 403); API version GET **403**. Tenant B → "not available" (404). Security is not sidebar-based. |
| **Preview** | Version page Preview = shared `FormRuntimeBody`; **0 API calls** while previewing (LF1 network log). AST: the preview imports no API module. |
| **Browser E2E** | `form-lifecycle-proof` **3/3**. Same session: `form-builder-proof` **3/3** (3A, updated to 3B routes), `form-runtime-proof` **4/4**, `schema-to-form-proof` **3/3**, `leave-request-management` **12/12**: **25/25**. After the one failure described in P3B-1, the lifecycle spec passed 5 consecutive runs: 4 before the P3B-1 mitigation was added, and the final combined run after it (one further rerun failed only on a test-data name collision from the previous run, fixed by putting the run stamp in the form names). |
| **PostgreSQL** | E2E against Homebrew PG14 (`localhost:5432`, migrated to `c3d4e5f6a7b8`). Backend real-PG suite: §8. |

## 8. Tests, typecheck, build, lint

| Command | Result |
|---|---|
| `backend$ .venv/bin/pytest tests/architecture` | **8 passed** |
| `backend$ .venv/bin/pytest tests/unit --ignore=tests/unit/test_engine_execution.py` | **3,624 passed** (+3: lifecycle contract; 3A: 3,621) |
| `backend$ .venv/bin/pytest tests/integration --ignore=tests/integration/workflow_postgres` | **179 passed, 5 skipped** |
| `backend$ .venv/bin/pytest tests/integration/workflow_postgres` | **148 passed** |
| `shell$ npx vitest run` | **856 passed / 104 files** (3A: 809 / 102) |
| `shell$ npx tsc --noEmit` | clean |
| `shell$ npm run build` | built |
| `shell$ npm run lint` | **not runnable**: no `eslint.config.js` and no TypeScript ESLint parser (C-3A-3). No configuration was created. |

New and changed Builder tests:

| File | Tier | Tests |
|---|---|---|
| `lifecycle.test.ts` | unit: generated table, UX narrowing ⊆ contract, paths, status × permission → actions, editable mode, published lookup, events | 9 |
| `lifecycle_flow.test.tsx` | component + integration (fake API applying the generated contract): full create→edit→save→submit→reload→return→submit→publish→reload; v1→v2→edit→v1 unchanged→publish v2 archives v1 (server); list (fields, empty, error, 403, reader without New); history (order, status, binding, actions per status); known-missing permission hides; unknown permission + server 403; 409 + re-read; cancel does nothing; first version; unknown form; 3A redirect; key `new`; version detail read-only + preview; reader preview; bad/unknown version; editor refuses archived | 17 |
| `architecture.test.ts` | TS-AST guards (3A guards kept + transitions only via contract paths, contract read only by `lifecycle.ts`, no status set by the UI) | 89 |
| `flow.test.tsx` | 3A integration on the versioned editor route (+ read-only, unknown version) | 18 |
| `test_form_lifecycle_contract.py` | backend: contract derived from code = file; documented lifecycle; statuses = DB CHECK | 3 |

## 9. Architecture / genericity evidence and mutation checks

- **All Phase 3A guards retained:** import allowlist, no business, DB, ORM or backend strings, no name/key/module branching, no code execution, no tenant selector, no competing schema, only `api.ts` talks HTTP.
- **3B additions:**
  - every transition URL comes from the generated contract (`actionPath`), and no transition path literal exists anywhere;
  - `lifecycle_contract.json` is read only by `lifecycle.ts`;
  - no source sets a version status.
- **Mutation checks (each planted, caught, restored):**

| Plant | Caught by |
|---|---|
| Remove the permission filter from `offeredActions` | `lifecycle.test` + `lifecycle_flow` (2 failures) |
| `v.status = 'published'` in `FormDetail.tsx` | AST "never sets a version status" |
| Backend `archive` made to accept `review` (`service.py`) | `test_form_lifecycle_contract::test_case_file_matches_the_code`. Then restored (hash-identical). |

## 10. Backend gaps (non-blocking)

```text
BACKEND GAP G-3B-1
Required operation:   list forms with their published version / latest status
Existing contract:    GET /form-definitions returns definition fields only
Why frontend cannot safely implement it: deriving it needs one detail request per form (N+1) or fabricated data
Recommended future backend change: add `published_version` (and optionally `latest_version`/`latest_status`) to the list view
Handling in 3B:       the list shows what the endpoint returns; status and published version are on the form page
```

C-3A-1 is the other backend-side item (concurrency token, §11).

## 11. Conditions

| ID | Condition | State after 3B |
|---|---|---|
| **C-3A-1** | No atomic draft concurrency token. | **Unresolved, carried forward.** No revision, ETag or precondition exists (`updated_at` is not exposed). Draft edits keep the 3A freshness check + 409. Lifecycle actions rely on the server's own status check: a stale action → 409, shown and re-read (tested). The race window for two simultaneous draft PATCHes remains. |
| **C-3A-2** | AuthStore does not restore the user after reload. | **Unresolved, carried forward.** Not redesigned. Effects in 3B: the sidebar entry (now gated on `core.forms.read`) disappears after a reload until the next login; after a reload permissions are unknown, so actions are offered and the server decides (LF2 proves the 403 path). |
| **C-3A-3** | No runnable ESLint toolchain. | **Unresolved, carried forward.** Not configured. |
| P3B-1 | **Intermittent stale view after an action.** In the first LF1 run (cold Vite), after a successful archive (server response and toast said *archived*, server state verified archived), the table still showed *Published* 5 s later. Not reproduced in 5 further full runs or in a dedicated 12-iteration archive repro (every post-action GET returned the new status, in order). No response caching exists (headers checked), and the service commits before responding (`AuditService.record`). **Root cause not established.** | **Mitigated:** after any successful action the UI first applies the server's own response for that version to the cache, then re-reads. No client-derived state is introduced. Recorded so it is not mistaken for proof of absence. |

## 12. Scope deviations from the brief

1. **Permission mapping** follows the backend, not brief §9: submit = `core.forms.design`.
2. **Create New Version is also offered on archived versions.** The service accepts it and prescribes it as the way to bring an archived form back. Brief §8 lists only View/Preview for archived.
3. **Preview stays local** (Phase 3A preview, zero API calls) rather than using `/form-runtime`, which serves only published versions and needs the business permission. A reader without `core.forms.design` therefore gets an explanation instead of a preview, because the input contract comes from discovery.
4. **"Refresh" in the jsdom integration** is a remount with a fresh query cache. The real browser reloads are in the E2E.
5. **E2E setup creates the forms over the API**, then drives every lifecycle step through the UI. Form creation through the UI is covered by the 3A spec.
6. **The Phase 3A E2E spec was updated** to the 3B route grammar and list permission. It was not weakened: one extra assertion was added.
7. **Brief paths `ERP/…`** correspond to `docs/architecture/…` in this repository.

## 13. Quality gates (brief §28)

| Gate | |
|---|---|
| Actual API contract audited | ✅ §2 (and pinned by a test) |
| Form List / Form Detail / Version History | ✅ |
| Draft / Review / Publish / Archive lifecycle | ✅ §6 |
| Create New Version; v1 immutable; v2 independently editable | ✅ |
| Exact capability version preserved | ✅ |
| Preview shared and non-executing | ✅ |
| Tenant isolation / Authorization / Deep-link security tested | ✅ §7 |
| Real browser E2E passes; real PostgreSQL evidence | ✅ 25/25 |
| Architecture/genericity guards pass | ✅ 89, mutation-checked |
| Typecheck / Build | ✅ |
| Lint status honestly reported | ✅ not runnable |
| No backend production changes | ✅ |
| No Phase 3A condition silently hidden | ✅ §11 |
| Documentation updated; readiness report created | ✅ |

## 14. Final gate decision

**GO-WITH-CONDITIONS.**

- **Not GO-CLOSED:** C-3A-1, C-3A-2 and C-3A-3 remain open by design of this phase (they belong to the backend, the shared shell and the toolchain), and P3B-1's root cause is unknown.
- **Not BLOCKED:** no required lifecycle operation is missing; immutability, single-publication, tenant isolation and authorization are server-enforced and proven on real PostgreSQL through the real browser; the UI holds no lifecycle authority.

Phase 3C must not start without its own brief.
