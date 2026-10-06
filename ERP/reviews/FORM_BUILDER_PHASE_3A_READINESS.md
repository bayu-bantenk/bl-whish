# FORM PLATFORM — PHASE 3A — VISUAL FORM BUILDER FOUNDATION READINESS

**Status:** **GO-WITH-CONDITIONS**
**Date:** 2026-10-06
**Architecture:** `../FORM_BUILDER_PLATFORM.md`
**Prerequisite gate:** `FORM_BUILDER_PREREQUISITES_READINESS.md` (GO)

**Summary verdict:**
- Every Phase 3A Definition-of-Done item is met with real-backend, real-PostgreSQL, real-browser evidence on the real capability `leave_management.leave_request.create:v1`.
- The conditions (§12) are non-blocking. One is a Form Definition API gap that only the backend can close (an atomic concurrency token for draft edits). Two are pre-existing shell issues.
- No foundation contract was modified. Phase 3B must not start without its own brief.

---

## 1. Executive Summary

Phase 3A adds a **frontend-only** Visual Form Builder (`frontend/shell/src/features/form_builder/`). Through the existing APIs only, an authorized designer can:
1. Discover capabilities and pick one exact version.
2. Inspect its input contract.
3. Configure fields, sections, columns and declarative rules.
4. Preview the form through the same renderer the end-user runtime uses.
5. Save a draft.
6. Reload it, losslessly.

A form produced this way runs unchanged in the existing Form Runtime.

**Backend production code changed: none.** One backend *test* was added: the parity reference for the Builder's contract port.

## 2. Problem Statement (inherited)

From `FORM_BUILDER_PREREQUISITES_READINESS.md` §10: GO for Phase 3, provided the builder consumes `/api/v1/capabilities` and the existing definitions API "without adding a second schema or bypassing `validate_against_contract`". Inherited caveat: C-5, one bindable capability.

## 3. Scope: exactly what Phase 3A implemented

| Brief step | Implemented as |
|---|---|
| 1–3 Audits | Frontend conventions (TanStack Query, `apiClient`, `@design`/Sap*, `BrowserRouter` routes, Vitest + Playwright), discovery API, Form Definition API (§4) |
| 4 Editor model | `editor.ts`. The editor state **is** the stored `Presentation` document; pure operations. |
| 5 Capability picker | `CapabilityPicker.tsx`: search, Module › Resource › Action › Version, exact version buttons, details + input contract table + raw JSON Schema |
| 6 Field palette | `FieldPalette.tsx`, from `contractFields(inputSchema)` |
| 7–8 Canvas, sections/layout | `BuilderCanvas.tsx`: sections (create, rename, columns 1–4, reorder, remove), field order, section assignment, remove; keyboard-operable buttons and selects |
| 9 Properties | `PropertiesPanel.tsx`: label, widget (contract-compatible only), options (enum-restricted when the contract has an enum), help, placeholder, readonly, hidden |
| 10 Rules | `RuleEditor.tsx`: closed operators and actions, values typed by the condition field |
| 11 Preview | `BuilderPreview.tsx` → `FormRuntimeBody` (extracted from the runtime view, shared) → unchanged `SchemaForm` |
| 12–13 Persistence, reload | `FormBuilderEditor.tsx`: create definition + v1, PATCH draft, `copy_from` new draft, freshness check, conflict state, save status, `beforeunload` |
| 14 Runtime compatibility | E2E FB1 |
| 15 Architecture tests | `__tests__/architecture.test.ts` (TypeScript-compiler AST) |
| Routes | `/form-builder`, `/form-builder/new`, `/form-builder/:formKey`; sidebar entry gated on `core.forms.design` |

**Not implemented (out of scope by the brief):** publishing/review UI, drag-and-drop, custom or computed fields, expressions, workflow, generation of any kind, capability editing, import/export and the rest of brief §55. Each is absent and unreachable: the API client has no lifecycle-transition call (AST-checked).

## 4. Audit results (steps 1–3)

| Area | Finding | Consequence |
|---|---|---|
| Server state | TanStack Query is established | Builder queries: `['form_builder', …]`; catalogue `staleTime` 5 min |
| HTTP | `apiClient` (axios) with auth interceptors | Only `api.ts` imports it (AST) |
| Design system | `@design` (Sap* controls, `SapTabs`, `SapGroup`, `Dialog`, `DataTable`, `StatusBadge`); no shadcn/ui; no checkbox primitive | Reused throughout. Checkboxes are labelled native inputs. Nothing duplicated. |
| Routing | `BrowserRouter` (not a data router) | No route-level blocking. Dirty guard = `beforeunload` + confirm on Close. |
| DnD | No drag-and-drop library in the dependency graph | None added; button/select reordering (accessible) |
| Discovery API | Grouped by id; versions = `describe()` | Consumed as is |
| Form Definition API | create definition; create version (`capability`+`presentation` or `copy_from`); PATCH draft; GET definition/version; lifecycle transitions | Sufficient for Phase 3A. Gaps: G-1 no concurrency token on PATCH; G-2 no definition update; G-3 definition + version creation is two calls (§12). |
| Draft validation | The server validates **every** draft against the contract and stores `model_dump(exclude_none=True)` | The Builder must always produce a contract-valid, normalized document, hence the parity-tested port (§5) |

## 5. Architecture Evidence

| Interaction | How |
|---|---|
| **Capability** | Read-only discovery (`GET /capabilities`). The binding is created exactly once per version as `{id, version}` and shown pinned. A new draft from an immutable version keeps it (`copy_from`). Never upgraded, never resolved unversioned (E2E FB1/FB3: stored `capability == {id, version: 1}`). |
| **Form Definition** | Only the existing API. The document sent is the server's own normalized shape, so stored == sent (E2E FB1: exact equality of the stored document). |
| **Contract port** | `contract.ts` ports `contract_fields`, `validate_against_contract` (+ normalization) and `render_fields`. **Parity:** `contract_parity_cases.json` (11 cases: valid, every contract violation, every structural violation, and the real leave contract) is *generated* from the reference by `tests/unit/test_form_builder_contract_parity.py`, which also fails if the file is stale. `contract.test.ts` runs the port on it: 24/24 identical (error locations, normalized document, render model). The server still re-validates every save. |
| **SchemaForm** | Unchanged. The preview renders through `FormRuntimeBody` → `SchemaForm`. |
| **Form Runtime** | `FormRuntimeBody` was extracted from `FormRuntimeView` without behaviour change (runtime unit 7/7, genericity 9/9, browser `form-runtime-proof` 4/4 after the change). The Builder preview and the runtime are therefore one renderer. A Builder-made form runs in the unchanged runtime (FB1). |

## 6. Security Evidence

| Concern | Evidence |
|---|---|
| Authentication | The existing session (`apiClient`). E2E personas use real JWTs. |
| Authorization | Server-enforced. Outsider: `GET /capabilities` **403**, `POST /form-definitions` **403**, UI "You cannot design forms", no sidebar entry. An end user who can *use* the form (`phase46_employee_a`) gets **403** on PATCH draft and on new version. (FB2) UI hint tested both ways (`ShellLayoutNavigation`, `flow.test`: known-no-permission makes no API call; unknown user plus server 403 shows the same screen). |
| Tenant isolation | Tenant-B designer: GET definition **404**, new version **404**, absent from list, Builder shows "not available" (FB2). A `tenant_id` in the create body → **422** (FB2). No tenant field, header or selector in any Builder source (AST). |
| No capability execution in preview | AST: `BuilderPreview.tsx` imports no API or query module, and no Builder file references `/form-runtime` or imports the runtime API client. E2E: **zero** API calls while previewing and toggling the rule. Whole-session network log: writes were exactly `POST /form-definitions`, `POST …/versions`, `PATCH …/versions/1`; nothing to `/form-runtime` or `/leave-management`. (FB1) |
| No overwrite | The concurrent server edit survives; the Builder shows Conflict and nothing is sent (FB3, and `flow.test` ×3) |
| Published immutability | v1 stays `published`, pinned to capability v1, document unchanged after v2 work (FB3) |
| Audit | Unchanged: the Form Definition service audits every write the Builder makes |

## 7. Genericity Evidence

`__tests__/architecture.test.ts` parses all 12 production sources (+ the pages file) with the **TypeScript compiler** and asserts, per file:

| # | Guard |
|---|---|
| 1 | Import allowlist only (React, router, Query, `@design`, SchemaForm, common, `apiClient`, AuthStore, runtime body/rules/adapters/types, relative). **No business feature, no backend path.** |
| 2 | No string literal naming a business module/entity/field (leave, sales, accounting, customer, employee, journal, invoice, hr, start_date, end_date, leave_type, employee_id, reason), DB/ORM object or backend path (sqlalchemy, form_definitions, form_versions, form_platform., metadata_engine, external_modules, app.core, .py), workflow/approval, tenant id, or `/form-runtime` |
| 3 | No `===`/`!==` or `switch` comparing `name`/`field`/`key`/`formKey`/`id`/`module`/`capability` to a literal |
| 4 | No `eval`, `Function`, string timers, `dangerouslySetInnerHTML`, `innerHTML` |
| 5 | No competing schema type (`BuilderFormSchema`, `VisualFormSchema`, `FormBuilderSchema`, `DesignerSchema`) |
| 6 | Only `api.ts` imports `apiClient`; no `fetch`/`axios`/XHR; exactly 4 GET, 2 POST, 1 PATCH, all to `/capabilities` or `/form-definitions`; no submit/reject/publish/archive path |
| 7 | Preview imports nothing that can call the network |

**Mutation-checked:** appending a business-module import, `if (f.name === 'start_date') eval('1')` to `editor.ts` failed guards 1, 2, 3 and 4. Restoring the file passed all 68.

All component and unit tests use a **domain-free** synthetic contract (`title_text`, `amount`, `kind`, `lit`, …). Only the parity file's real-capability case and the E2E use the leave contract, and those use it as data.

## 8. Test Evidence (2026-10-06)

| Command | Result |
|---|---|
| `backend$ .venv/bin/pytest tests/architecture` | **8 passed** |
| `backend$ .venv/bin/pytest tests/unit --ignore=tests/unit/test_engine_execution.py` | **3,621 passed** (+14: contract parity) |
| `backend$ .venv/bin/pytest tests/integration --ignore=tests/integration/workflow_postgres` | **179 passed, 5 skipped** |
| `backend$ .venv/bin/pytest tests/integration/workflow_postgres` | **148 passed** |
| `shell$ npx vitest run` | **809 passed / 102 files** (Phase 2.5: 664) |
| `shell$ npx tsc --noEmit` | clean |
| `shell$ npm run build` | built |
| `shell$ npm run lint` | **not runnable**: no `eslint.config.js` and no TypeScript ESLint parser installed (pre-existing, P25-3). Not counted as a pass. |

Builder Vitest breakdown:

| File | Tier | Tests |
|---|---|---|
| `editor.test.ts` | unit: schema→fields, add/remove/reorder field, sections, assignment, properties, rules, rule validation, (de)serialization, dirty/save status | 19 |
| `contract.test.ts` | unit: parity with the server reference | 24 |
| `components.test.tsx` | component: picker, details/schema, palette, canvas, properties, rule editor, preview | 14 |
| `flow.test.tsx` | integration: discovery → exact version → schema → Builder → definition/version/draft payloads; save status; freshness/lifecycle/409 conflicts; 422 placement; network; 403/404; immutable latest → `copy_from`; no-version; unavailable capability | 18 |
| `architecture.test.ts` | static (TS AST) | 68 |
| `ShellLayoutNavigation.test.tsx` | component: sidebar gating | +1 |

Flake note: one pre-existing `StudioEditorPage` test failed once while the backend suites ran in parallel. It passed 3/3 in isolation and in the clean full run above (809/809).

## 9. E2E Evidence: real capability, real Form Definition, runtime compatibility

`frontend/shell/e2e/tests/form-builder-proof.spec.ts` ran against the real backend (`MODULES_PATH=app/modules,external_modules`), Homebrew PG14 and Chromium. It passed **3/3**. The regression run in the same session (`form-runtime-proof` 4, `schema-to-form-proof` 3, `leave-request-management` 12) also passed: **22/22** in total.

| # | Proves |
|---|---|
| **FB1** | Designer: Builder → New form → search → select `leave_management.leave_request.create:v1` → the contract table equals the discovery API's input properties (contract-driven), and no implementation detail appears. Create → pinned `…:v1`. Configure `leave_type` (label, select widget, 3 options), `reason` (label, help, hidden). Rename section 1, add section "Period" with 2 columns, move both dates into it. Rule `leave_type eq unpaid → show reason`. Preview: sections render, rule hides/shows, **0 API calls**. Save → Saved. **Reload** → section titles, columns, rule count, field properties intact. The stored document **exactly equals** the expected normalized document, and the capability is `{id, version: 1}`. Network: only discovery + definitions API. Then submit+publish over the existing API (no publishing UI in 3A), and the **unchanged Form Runtime** as an employee renders both sections, applies the rule and submits. The leave request is read back from the Leave module: `unpaid`, dates, reason, `draft`. |
| **FB2** | Authorization (outsider, end user) and tenant isolation (tenant-B designer; `tenant_id` injection 422), as in §6 |
| **FB3** | Published v1 → Builder offers a new draft → v2 keeps capability v1. A concurrent server PATCH to v2 → the Builder's save is a **Conflict**, the server copy is not overwritten, and reload shows the server version. v1 is unchanged. |

Environment hygiene: `leave_management` was activated for the run and deactivated afterwards. Module states were restored (sales active, the others inactive). The run left uniquely keyed test forms and leave requests in the dev DB.

## 10. Architecture Boundary Verification (DoD §54)

| DoD item | Status |
|---|---|
| Capability discovery works; exact version selectable; input schema visible; no leak | ✅ FB1, components, AST |
| Fields, sections, columns, ordering, properties, safe rules | ✅ editor/components/flow, FB1 |
| Preview uses existing SchemaForm, reflects state, executes nothing | ✅ shared `FormRuntimeBody`; FB1 zero calls; AST |
| Draft saved, reloaded, lossless, version pinned | ✅ FB1 exact equality; editor round trip; parity normalization |
| Saved form works with the existing runtime, no special behaviour | ✅ FB1 |
| Existing auth; `core.forms.design` respected; tenant isolation; no tenant selector | ✅ FB2; AST |
| No business logic, workflow, DB generation, custom/computed fields, legacy metadata engine, second schema, business branching | ✅ AST guards (mutation-checked); no backend change |
| Tests pass | ✅ §8 (lint not runnable, pre-existing) |
| Documentation | ✅ `FORM_BUILDER_PLATFORM.md`, this document |

**Foundation contracts untouched:** capability contract/registry/executor, Form Definition model, lifecycle, Form Runtime API, SchemaForm API, domain/services/repositories, RLS, tenant, audit, Workflow, `metadata_engine`. The only change in a previous phase's code is the behaviour-preserving extraction of `FormRuntimeBody` from the Phase 2.5 runtime view.

## 11. Findings (disclosed)

| ID | Finding | Effect / handling |
|---|---|---|
| **P3A-1** | **The shell's `AuthStore` does not restore `user` after a page reload** (`user: null` initially; only `login()` sets it, even though `erp_user` is in `sessionStorage`). After any reload, `hasPermission()` is false for everyone and the sidebar shows "User". Pre-existing; nothing used `hasPermission` before. | The Builder treats client permissions as a hint (`'yes' / 'no' / 'unknown'`). When unknown, the server's 403 decides. Consequence: after a reload, the **sidebar entry is hidden even for designers** until the next login, though direct URLs work. Fix (restore `user` from `sessionStorage`) is a shared-auth change, not made here. |
| **P3A-2** (G-1) | The draft PATCH has no concurrency token | The Builder's re-read freshness check plus 409 handling prevents every *detectable* overwrite (FB3). Two saves of the same draft landing in the same instant can still both succeed. → C-3A-1 |
| P3A-3 (G-2) | No definition-update endpoint | Name and description are set at creation only. Documented non-goal. |
| P3A-4 (G-3) | Creating a form is two calls (definition, then v1) and not atomic | If v1 creation fails, the definition remains with no versions. The editor handles this state ("no version yet" → bind + create v1, tested). |
| P3A-5 | The static route `/form-builder/new` shadows a form whose key is exactly `new` | Such a form cannot be opened in the Builder. Cosmetic; documented in `App.tsx`. |
| P3A-6 | Python `==` vs JS `===` differ for bool/number mixing (`True == 1`) in the enum-subset check | Unreachable for current contracts (string enums). Option labels use Python `str()` semantics (`pyStr`). |
| P3A-7 | `npm run lint` not runnable (no config, no TS parser) | Pre-existing (P25-3). `tsc` + Vitest + AST guards are the static gates. |

## 12. Known Limitations and Outstanding Conditions

**Conditions (non-blocking for Phase 3A, must be tracked):**
- **C-3A-1: atomic draft concurrency.** Add an optimistic concurrency token (for example a draft revision or `updated_at` precondition) to `PATCH /form-definitions/{key}/versions/{n}`, and have the Builder send it. This is a Form Definition API change, so it is deliberately not made in 3A (brief §6/§50).
- **C-3A-2: restore the user in `AuthStore` after reload (P3A-1).** Needed for reliable permission-aware UI anywhere in the shell, not only the Builder.
- **C-3A-3: lint tooling (P3A-7).**

**Carried forward:**
- Phase 2 C-1 to C-4.
- **C-5:** only one bindable capability exists until lifecycle capabilities land. The Builder is generic (tests use a synthetic multi-capability catalogue), but real-world breadth is unproven beyond one contract.

**Legitimate future work (not defects):** publishing and review UI, rebinding a draft to another capability version, drag-and-drop as an *additional* reordering method, a `FieldSpec.readonly` instead of one `SchemaForm` per field, and the brief §55 list.

## 13. Risk Assessment

- **Safer:**
  - Designers no longer hand-write presentation JSON.
  - Every client-side check is parity-tested against the server reference, and the server still re-validates.
  - Preview and runtime share one renderer.
- **Unchanged:**
  - Rules remain presentation.
  - Business validation stays in the capability.
  - No separation of duties (Phase 2 R-2).
- **New risk:**
  - The contract port is a second implementation of three pure functions. Drift is caught by a generated fixture plus a staleness test, but a **new** reference behaviour needs a new case to be covered.
  - The C-3A-1 race window.

## 14. Final Gate Decision

**GO-WITH-CONDITIONS.**

- **Why not GO:** C-3A-1 means the brief's "must not overwrite a newer server version accidentally" is met for every detectable case but not atomically, and closing it requires a backend contract change this phase may not make. P3A-1 is a real UX defect in the shared shell.
- **Why not BLOCKED:** every DoD item passes with real-backend evidence, no foundation contract was modified, and no condition can corrupt data, leak across tenants or execute anything.

Phase 3B must not start automatically.

## 15. Files Changed

**New (frontend/shell)**
- `src/features/form_builder/`: `types.ts`, `api.ts`, `contract.ts`, `editor.ts`, `CapabilityPicker.tsx`, `FieldPalette.tsx`, `BuilderCanvas.tsx`, `PropertiesPanel.tsx`, `RuleEditor.tsx`, `BuilderPreview.tsx`, `FormBuilderEditor.tsx`, `FormBuilderList.tsx`
- `src/features/form_builder/__tests__/`: `contract_parity_cases.json` (generated), `fixtures.ts`, `contract.test.ts`, `editor.test.ts`, `components.test.tsx`, `flow.test.tsx`, `architecture.test.ts`
- `src/features/form_runtime/FormRuntimeBody.tsx` (extracted, shared)
- `src/pages/form_builder/FormBuilderPages.tsx`
- `e2e/tests/form-builder-proof.spec.ts`

**Modified (frontend/shell)**
- `src/features/form_runtime/FormRuntimeView.tsx`: renders through `FormRuntimeBody` (no behaviour change)
- `src/App.tsx`: +1 import, +3 routes
- `src/components/layout/ShellLayout.tsx`: permission-gated "Form Builder" entry
- `src/__tests__/ShellLayoutNavigation.test.tsx`: the auth mock gains `hasPermission` (the real store has it); +1 gating test

**New (backend, test only)**
- `tests/unit/test_form_builder_contract_parity.py` (14 tests; generates the parity file with `FORM_PARITY_REGEN=1`)

**Docs**
- `docs/architecture/FORM_BUILDER_PLATFORM.md`, this document

**Not changed:** all backend production code, migrations, SchemaForm, `metadata_engine`, Workflow, Application Flow. The brief's `ERP/…` paths correspond to `docs/architecture/…` in this repository.
