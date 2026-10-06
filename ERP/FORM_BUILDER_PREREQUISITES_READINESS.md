# FORM PLATFORM — PHASE 2.5 — BUILDER PREREQUISITES READINESS

**Status:** **GO** for Phase 3 (Visual Form Builder). The Phase 2 foundation conditions C-1 to C-5 stay open and tracked (§9). None of them blocks a builder.
**Closes:** B-1 and B-2 of `FORM_DEFINITION_FOUNDATION_READINESS.md` §16
**Is the Form Definition foundation safe enough to begin building the Visual Form Builder?** **Yes.** A builder can now (1) discover what it may bind to, over HTTP, gated by the existing authorization, and (2) target a runtime view that has been proven in a real browser against real PostgreSQL, rendering through the unchanged `SchemaForm`. Phase 3 still must not start automatically: it needs its own brief.
**Date:** 2026-10-06
**Architecture:** `../FORM_DEFINITION_PLATFORM.md` §5.1 (discovery), §7 (runtime view)

---

## 1. Executive Summary

Phase 2 closed GO-WITH-CONDITIONS for the foundation but **not GO** for a builder, because of two blockers:
- **B-1:** a builder could not list bindable capabilities (Phase 1 discovery was in-process only).
- **B-2:** the render-model → SchemaForm contract had never run in a browser.

Phase 2.5 closes both, and adds nothing else:
- **B-1:** `GET /api/v1/capabilities[/{id}]`. It is a read-only view over the Phase 1 registry, gated by `core.forms.design`. Each version entry is exactly `CapabilityDescriptor.describe()`.
- **B-2:** one generic runtime view at `/forms/:formKey`. It renders any published Form Version through the **unchanged** `SchemaForm`, with sections, columns and declarative rules, and submits through `POST /form-runtime/{key}` → pinned capability → module → PostgreSQL. A Playwright suite proves this on a real backend and real PostgreSQL (4/4).

Backend production code changed by Phase 2.5: **one new 70-line read-only router**, plus its mount. `form_platform`, Phase 1 capabilities, `SchemaForm`, Workflow and Flow are untouched.

## 2. Problem Statement (inherited)

From `FORM_DEFINITION_FOUNDATION_READINESS.md` §16:

> **B-1: HTTP capability discovery.** A builder must list bindable capabilities and their input schemas. […] Needed: a read-only, **permission-filtered** `GET` over `capability_registry.list_capabilities` / `describe`.
>
> **B-2: a generic runtime view proven in a browser.** One field-name-free view that renders `/form-runtime/{key}` through the unchanged `SchemaForm` (sections + rules) and submits it, with a Playwright E2E on real PG.

**Provenance note:** a previous session (2026-10-05, after the Phase 2 report) left uncommitted, undocumented B-1 work and the start of B-2:
- B-1: the router and both of its test files.
- B-2: `form_runtime/{api,rules,types}.ts`. `rules.ts` referred to parity tests that did not exist.

This phase reviewed that work, kept it, and finished it. It is all disclosed in §11, Files Changed.

## 3. B-1: Capability discovery

### 3.1 Mechanism

`backend/app/api/v1/capabilities.py`, mounted at `/api/v1/capabilities` (`api/v1/__init__.py:8,32`).

| Property | Implementation |
|---|---|
| Source of truth | `capability_registry.list_capabilities()`. No copy, no cache, no second schema. |
| Payload | Grouped by id. Each version is `describe()` minus the four identity keys repeated at group level. |
| Authentication | `get_current_user` (inside `require_permission`) |
| Authorization | `require_permission("core.forms.design")` → `UserContext.has_permission` → `RBACEngine`. **No new mechanism.** |
| Status handling | `disabled` not listed (not bindable). `deprecated` listed with status (the service already refuses to publish against it). |
| Module lifecycle | Inactive module → its capabilities are absent (Phase 1 deactivation unregisters them) |
| Tenant | None needed: capability metadata is module code, not tenant data |

### 3.2 Decision D-1: endpoint-gated, not filtered per capability

The Phase 2 report asked for "permission-filtered". This is implemented as an **endpoint gate on the form-design permission**, *not* as filtering each capability by whether the caller holds that capability's business permission.

- **Why:** a form designer configures forms but typically holds no business permission. The seeded `phase25_form_designer_a` holds only `core.forms.*`. Per-capability filtering would show a designer an empty catalogue, which defeats the purpose.
- **Why it is safe:**
  - Discovery reveals only `describe()` metadata, which is implementation-free (proven below).
  - *Using* the resulting form still requires the capability's own permission. Proven over real HTTP: the designer who published the form gets **403** rendering it (E2E FR3).

### 3.3 Evidence

| Scenario | Result | Test |
|---|---|---|
| No token | 401 | `test_discovery_authentication_authorization_and_versions` (real HTTP, real PG, real module activation) |
| Authenticated, has `core.forms.read` + the capability's own permission, but not `core.forms.design` | 403, body lists nothing | same |
| Detail endpoint without permission | 403 | same |
| Exact versions in order; `disabled` v4 hidden, `deprecated` v3 shown with status | ✅ | same |
| Input schema = the real `LeaveRequestCreate` schema | ✅ | same |
| Detail = list entry; `?module=` filter; unknown module → `[]`; unknown id → 404 | ✅ | same |
| No implementation detail (`LeaveRequestService`, handler, table, route, module path, `qualname`) | ✅ | same, plus `test_no_implementation_detail_in_discovery_output` (unit) |
| Two tenants' designers see the identical catalogue | ✅ | same |
| Deactivated module → absent from list, detail 404 | ✅ | `test_inactive_module_capabilities_are_not_discoverable` (real PG) |
| Grouping keeps exact versions and keys; each version equals `describe()` | ✅ | `tests/unit/test_capability_discovery.py` (3) |

## 4. B-2: Generic runtime view

### 4.1 Mechanism

| File | Role |
|---|---|
| `src/pages/FormRuntimePage.tsx` | Route wrapper for `/forms/:formKey[?version=n]` (`App.tsx`, inside the protected shell; not in the sidebar) |
| `src/features/form_runtime/FormRuntimeView.tsx` | Loads the render model, holds form state, applies rules, renders sections, submits, and shows the result or errors |
| `runtimeForm.ts` | Pure adapters: render model → `FieldSpec`, defaults, value typing, payload, section layout |
| `rules.ts` | Browser port of `presentation.evaluate_rules` |
| `api.ts` | The only two calls: `GET` and `POST /form-runtime/{key}` |

**SchemaForm is unchanged** (its last modification predates the Form Platform: 2026-10-01). Two adaptations were made in the view instead of in SchemaForm:
1. **Per-field readonly.** SchemaForm's only "not editable" control is the list-wide `disabled` prop. The view therefore renders each visible field through its own `<SchemaForm specs={[spec]} disabled={readonly}>`. This was chosen deliberately over adding a per-field `readonly` to `FieldSpec`, which would have changed a shared component used by two existing production forms.
2. **Typed values.** SchemaForm holds strings. The view types values before rule evaluation and submission:
   - number fields → `Number`
   - select → the option's original scalar
   - empty → omitted

   This is what the parity cases assume.

**Deliberately not created:** no new `@design` primitive, no form state library, no client-side expression language, and no definition editing of any kind.

### 4.2 Rule-semantics parity (new, cross-stack)

One case file, `src/features/form_runtime/__tests__/rule_parity_cases.json`, holds 5 fields, 7 rules and 6 cases. It covers every operator (`eq`, `neq`, `in`, `not_in`, `empty`, `not_empty`), every action (`show`, `hide`, `readonly`), rule order, typed number equality, null/empty-string emptiness and case sensitivity. Two suites run it:
- `backend/tests/unit/test_form_rule_parity.py`: against the reference `presentation.evaluate_rules` (7 passed).
- `src/features/form_runtime/__tests__/rules.test.ts`: against the browser port (7 passed).

A semantic change on either side now fails that side's suite.

### 4.3 Browser evidence: real backend, real PostgreSQL, real Chromium

`frontend/shell/e2e/tests/form-runtime-proof.spec.ts`:
- **Setup:** the designer persona creates a uniquely keyed form over the real definitions API (create → version → submit → publish).
- **Form shape:** bound to `leave_management.leave_request.create:v1`, with two titled sections (1 and 2 columns) and `reason` hidden unless `leave_type == "unpaid"`.

| # | Scenario | Asserted | Result |
|---|---|---|---|
| FR1 | Employee renders and submits | Heading, pinned refs `key:v1 · capability:v1`, sections as ARIA groups, contract default `annual`, date input type, hidden field absent. Rule shows, hides and re-shows `Justification` with its help text. Submit → result id. **The only API POST the browser made was `/api/v1/form-runtime/{key}`.** Independent read-back via the Leave module's own `GET /leave-management/requests/{id}`: `unpaid`, `2026-12-01`→`2026-12-03`, reason, `draft`. | ✅ |
| FR2 | Business validation stays in the capability | The form has no date-order UX rule, so end < start reaches the server → **422**. The capability's message is the "Last day" input's accessible description (placed per field). No success state. The employee's request count is unchanged. | ✅ |
| FR3 | Permission and tenant | Outsider (tenant A, no permissions) → refused, with the message naming `leave_management.requests.write`, and no Submit button. **The designer gets 403 on render** (D-1 safety). Tenant-B employee → "Form unavailable" in the browser, and a direct `POST` → **404**. | ✅ |
| FR4 | Supersede and reproducibility | v1 page open → designer publishes v2 (one label changed) → submitting from the open v1 page → **409** banner "not published". Reload renders `key:v2 · capability:v1` with the new label. Definitions API: v1 is `archived`, still bound to `capability:v1`, and its presentation matches what was published. | ✅ |

**Regression in the same run:** `schema-to-form-proof.spec.ts` (3) and `leave-request-management.spec.ts` (12) both pass, 19/19 in total. The two existing SchemaForm consumers and the Leave UI are unaffected.

### 4.4 Component-level evidence (jsdom, mocked API: weaker than §4.3, listed for coverage)

| Test file | Tests | Covers |
|---|---|---|
| `FormRuntimeView.test.tsx` | 7 | Sections and default; show/readonly rules; UX validation blocks the call; typed payload excludes a field hidden after being typed into; result panel and reset; per-field 422 placement and banner; 409 not retried; 403 load |
| `runtimeForm.test.ts` | 5 | Adapters |
| `rules.test.ts` | 7 | Parity (6) plus an unknown rule target |
| `genericity.test.ts` | 8 | Source guard (§5) |

## 5. Architecture Boundary Verification

| Rule | Enforcement |
|---|---|
| Runtime view names no business module, entity, field or form key, and executes nothing (`eval`, `new Function`, `dangerouslySetInnerHTML`) | `genericity.test.ts`: regex over every production source in `features/form_runtime` plus `FormRuntimePage.tsx`. **Mutation-checked:** appending `f.name === 'start_date'` to `runtimeForm.ts` failed the guard, and restoring the file passed it. |
| Runtime view calls only `/form-runtime/*` | `genericity.test.ts` extracts every `apiClient.*` path from `api.ts` (exactly 2, both `/form-runtime/`) and FR1 asserts the browser's actual POSTs |
| SchemaForm does not know the Form Platform | Unchanged file; the Phase 2 source test still passes |
| Backend form platform stays generic, imports no module/Workflow/Flow | Phase 2 AST tests (`test_form_platform_architecture.py`), unchanged, pass |
| Discovery leaks no implementation | Unit and real-HTTP leak scans (§3.3) |
| No Form Builder | No route, page or component can create or edit a definition. The view has no sidebar entry. The only write it performs is `POST /form-runtime/{key}` (a business submission). |

## 6. Test Results (2026-10-06, real PostgreSQL = Homebrew PG14 on localhost, migrated to `c3d4e5f6a7b8`)

| Suite | Phase 2 baseline | Now | Delta |
|---|---|---|---|
| `pytest tests/architecture` | 8 | **8 passed** | 0 |
| `pytest tests/unit --ignore=…test_engine_execution.py` | 3,597 | **3,607 passed** | +10 (3 discovery, 7 parity) |
| `pytest tests/integration --ignore=…workflow_postgres` | 179 + 5 skip | **179 passed, 5 skipped** | 0 |
| `pytest tests/integration/workflow_postgres` | 146 | **148 passed** | +2 (discovery) |
| `vitest run` (whole shell) | — | **664 passed / 97 files** | +27 in `form_runtime` |
| `tsc --noEmit` / `vite build` | — | clean / built | |
| Playwright `form-runtime-proof` + `schema-to-form-proof` + `leave-request-management` | — | **19 passed** | +4 new |

E2E environment: `MODULES_PATH=app/modules,external_modules RATE_LIMIT_REQUESTS=5000` uvicorn, `seed_worklist_e2e.py`, `leave_management` activated for the run and **deactivated afterwards**. Module states were restored to their pre-run values (sales active, the others inactive).

## 7. Findings (disclosed, not fixed: out of scope)

| ID | Finding | Effect |
|---|---|---|
| **P25-1** | The global 404 handler replaces every `HTTPException(404, detail=…)` body with `{"error":"not_found","path":…}`. The Form Platform's 404 messages never reach a client. | UX only. The runtime view falls back to "This form is not available." It is also the right outcome for cross-tenant (no existence oracle). FR3 asserts the actual behaviour. |
| P25-2 | `seed_worklist_e2e.py` looks up existing permissions by `(resource, action, scope)` and ignores `module_name`, despite its own comment claiming the full triple. | Latent: a future permission sharing `resource` and `action` across modules would silently reuse the wrong row. No collision today: `forms` is unique. |
| P25-3 | `npm run lint` cannot run: the shell has ESLint 9 but no `eslint.config.js`. | Pre-existing. `tsc` and Vitest are the effective static gates. |
| P25-4 | Playwright's Chromium was not installed on this machine (version drift since the last E2E pass). | Installed to the user cache (`npx playwright install chromium`). No repo change. |

## 8. Risk Assessment

- **Safer:**
  - The builder's two missing inputs exist and are proven.
  - Server/browser rule drift is now caught by a shared fixture.
  - Version-pinned submission is proven end to end (FR4), not only at the API.
- **Unchanged:**
  - Rules remain presentation only (R-4). The server does not enforce hide/readonly, and the capability re-validates every submission (FR2 proves this in a browser).
  - No separation of duties (R-2): the E2E designer designs, submits and publishes alone.
- **New risk introduced:**
  - D-1 exposes the full capability catalogue (`describe()` metadata) to every holder of `core.forms.design` in any tenant. This is acceptable because the metadata is implementation-free and global by nature, but it should be revisited if tenant-specific or sensitive capabilities ever appear.
  - Per-field `SchemaForm` instances are an adaptation, not a SchemaForm feature. If many forms need per-field readonly, a `readonly` on `FieldSpec` may be the cleaner long-term step. That would be a deliberate shared-component change.

## 9. Conditions carried forward (non-blocking, unchanged from Phase 2 §16)

- C-1: decide F-5 / F-7 (legacy `metadata_engine` tenancy; deprecate or fix).
- C-2: migrate the Docker container DB (F-8) before any demo against the container.
- C-3: separation-of-duties policy (R-2).
- C-4: custom fields need a module-owned extension contract; computed fields need a safe expression model.
- C-5: lifecycle capabilities (submit/approve/cancel) are still blocked on the Phase 1 C-2 caller-bridge decision. A builder will have **one** bindable capability until then, which is enough to build against but thin for UX validation.

## 10. Final Gate Decision

**GO for Phase 3 (Visual Form Builder).**

- **Why GO and not GO-WITH-CONDITIONS:** both named blockers are closed with real-browser, real-PostgreSQL evidence. Every carried condition (§9) is either policy or a future-scope capability, and none of them changes the contract a builder targets. The builder's contract is: the discovery payload, the definitions API, the presentation schema and the render model. All four are now exercised end to end.
- **Why not stronger:** no stronger verdict exists. The caveat that matters most for Phase 3 planning is C-5 (one capability).
- Phase 3 must not start automatically. It needs its own brief, and it should consume `/api/v1/capabilities` and the existing definitions API without adding a second schema or bypassing `validate_against_contract`.

## 11. Files Changed

**Backend**
- `app/api/v1/capabilities.py` (new, 70 lines; from the earlier session, reviewed and kept), `app/api/v1/__init__.py` (+1 import, +1 mount)
- `tests/unit/test_capability_discovery.py` (new, 3 tests; earlier session), `tests/integration/workflow_postgres/test_capability_discovery.py` (new, 2 tests; earlier session)
- `tests/unit/test_form_rule_parity.py` (new, 7 tests)
- `scripts/seed_worklist_e2e.py`: additive only. 4 `core.forms.*` permissions, a `phase25_form_designer` role per tenant, users `phase25_form_designer_{a,b}`.

**Frontend (`frontend/shell`)**
- `src/features/form_runtime/{api,rules,types}.ts`: from the earlier session. `api.ts` gained the optional pinned `version`.
- `src/features/form_runtime/{FormRuntimeView.tsx,runtimeForm.ts}` (new)
- `src/features/form_runtime/__tests__/{rule_parity_cases.json,rules.test.ts,runtimeForm.test.ts,FormRuntimeView.test.tsx,genericity.test.ts}` (new)
- `src/pages/FormRuntimePage.tsx` (new), `src/App.tsx` (+1 import, +1 route)
- `e2e/tests/form-runtime-proof.spec.ts` (new, 4 tests)

**Docs**
- `docs/architecture/FORM_DEFINITION_PLATFORM.md`: §5.1 discovery; §7 runtime view (replaces "future runtime view")
- `docs/architecture/reviews/FORM_DEFINITION_FOUNDATION_READINESS.md`: re-issue note pointing here
- this document

**Not changed:** `SchemaForm.tsx`, `app/core/form_platform/**`, `app/core/capabilities/**`, migrations, Workflow, Application Flow, `metadata_engine`.
