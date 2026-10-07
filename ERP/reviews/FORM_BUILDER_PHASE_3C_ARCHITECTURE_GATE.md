# Form Builder — Phase 3C Architecture Decision Gate

**Type:** audit only, no implementation · **Date:** 2026-10-07 · **Auditor role:** Principal Architect
**Inputs:** Phase 1, 2, 2.5, 3A and 3B documents and code (§16) · **Decision:** **DEFER** (§15)

> No production code, schema, migration, API, UI, test or dependency was changed by this gate. The only file created is this document.

---

## 1. Executive Summary

The Form Builder architecture is **sound**. The code still follows its boundary:

> Form Definition configures HOW data is entered. Capability defines WHAT business operation is performed. Domain defines WHAT is valid. Persistence stores business state.

A version stores only `(capability_id, capability_version, presentation)`. The presentation is a closed, `extra="forbid"` data document with no expressions, and submission goes through the Phase 1 executor into the owning module's service. No dependency runs from the Form Platform to Workflow, to module internals, or to ORM tables or SQL outside its own two configuration tables (§5).

**No open condition blocks the platform as it stands** (§4, §11). Each one is debt, shared infrastructure or future hardening.

**No Phase 3C candidate justifies implementation now** (§9, §10):

- **Rejected for the Form Platform as low-code drift or wrong owner:**
  - Custom Fields;
  - business-affecting Computed Fields;
  - Capability Composition;
  - Submission Management.
- **Architecturally valid in a narrow form, but no evidence of need:**
  - Multiple Form Actions (one capability per action);
  - presentation-only Advanced Rules.
- **Premature:** Transport/Promotion.

The deciding fact: **the entire system registers exactly one capability**, `leave_management.leave_request.create` v1 (`backend/external_modules/leave_management/capabilities.py:35`). Every candidate that adds expressiveness to the Builder would add configuration surface over a single business operation. The shortage that limits the platform's value is **capabilities**, owned by business modules. Builder features don't address it.

A second fact constrains any new phase: **the repository has no commits** (`git log` → "your current branch 'main' does not have any commits yet"). Phases 1–3B exist only in the working tree.

**Decision: DEFER.** Re-open criteria are in §15.

---

## 2. Current Architecture Baseline

```text
Business module (leave_management)
   │ registers in setup(), owns DTOs + service + domain rules
   ▼
Capability contract / registry / executor        backend/app/core/capabilities/
   ▲  resolve(id, version)        execute_capability(id, payload, caller, version)
   │
Form Platform                                    backend/app/core/form_platform/
   ├─ service.py       definitions, versions, lifecycle (draft→review→published→archived)
   ├─ presentation.py  closed presentation document, contract validation, rules
   ├─ runtime.py       published-version resolution, render model, submit → executor
   └─ models.py        form_platform.form_definitions / form_versions (config only)
   ▲
HTTP   /api/v1/form-definitions · /api/v1/form-runtime · /api/v1/capabilities
   ▲
Frontend   features/form_builder (configures)  ──►  features/form_runtime (renders via SchemaForm)
```

| Fact | Where verified |
|---|---|
| A version stores only binding plus presentation | `models.py` `FormVersion` columns |
| Binding is the exact `(id, version)` and is re-checked at publish against the live registry | `service.py` `_bind`, `publish` |
| Presentation is closed: widgets `text/number/date/select`, rule ops `eq/neq/in/not_in/empty/not_empty`, actions `show/hide/readonly` | `presentation.py` Pydantic models |
| Fields must exist in the capability input contract | `presentation.py` `validate_against_contract` |
| Runtime submit allows only presented fields, then calls the executor | `runtime.py` `execute_form` |
| "Use a form" means "hold the bound capability's permission" | `runtime.py` `_authorized_capability`; executor step 3 |
| Lifecycle permissions: submit = design, reject = review, publish/archive = publish | `service.py`; generated `lifecycle_contract.json` |
| One published version per form | partial unique index `uq_form_platform_form_versions_one_published` |
| Non-draft immutability is enforced by the service **and** the PG trigger `form_versions_guard` | `service.py`; migration `c3d4e5f6a7b8` |

---

## 3. Phase 1–3B Evidence Matrix

These results were re-run for this gate on 2026-10-07 unless marked *recorded*:

- **Backend unit** (9 form/capability files): **109 passed**.
- **Real PostgreSQL** (4 files): **22 passed**.
- **Vitest** (`form_builder`, `form_runtime`, shell navigation; 12 files): **223 passed**.
- **`tsc --noEmit`:** exit 0.

| Phase | Scope | Evidence (actually found) | Status |
|---|---|---|---|
| 1 | Capability Foundation | `core/capabilities/*`; `test_capability_{architecture,registry,executor,discovery}.py`; PG `test_capability_leave_management.py` (9); docs `CAPABILITY_PLATFORM.md`, `reviews/FORM_CAPABILITY_FOUNDATION_{AUDIT,READINESS}.md` | GO-WITH-CONDITIONS |
| 2 | Form Definition + Versioning | `core/form_platform/*`; migration `c3d4e5f6a7b8`; `test_form_presentation.py`, `test_form_platform_architecture.py`; PG `test_form_platform.py` (10: forced RLS, trigger, pinning, withdrawal fail-closed, permissions, tenant isolation, audit) plus fresh-DB migration; docs `FORM_DEFINITION_PLATFORM.md`, `reviews/FORM_DEFINITION_{METADATA_AUDIT,FOUNDATION_READINESS}.md` | GO-WITH-CONDITIONS |
| 2.5 | Discovery + Runtime | `api/v1/capabilities.py`; `features/form_runtime/*`; `test_form_rule_parity.py`; Vitest `rules`, `genericity`, `FormRuntimeView`; E2E `form-runtime-proof.spec.ts` (4, *recorded*) | GO |
| 3A | Visual Builder | `features/form_builder/*`; `test_form_builder_contract_parity.py` (generates the parity fixture); Vitest `architecture` (AST guards), `contract`, `editor`, `components`, `flow`; E2E `form-builder-proof.spec.ts` (3, *recorded*) | GO-WITH-CONDITIONS |
| 3B | Lifecycle + Versioning | `lifecycle.ts`, `FormDetail.tsx`, `VersionDetail.tsx`; `test_form_lifecycle_contract.py` (generates `lifecycle_contract.json`); Vitest `lifecycle`, `lifecycle_flow`; E2E `form-lifecycle-proof.spec.ts` (3, *recorded*) | GO-WITH-CONDITIONS |

**Not re-run for this gate:**

- **Playwright E2E:** the last recorded result is 25/25 on 2026-10-06 (3B report). Running it needs the seeded personas and an activated `leave_management`, which mutate dev data.
- **Full backend suite:** last recorded 8 / 3,624 / 179+5 skipped / 148 on 2026-10-06.
- **Builder Vitest intermittent:** one unidentified failure in 1 of 11 runs was recorded at the 3B checkpoint (3B report §15.1). Today's run was green; the failure is still unidentified.

---

## 4. Open Conditions Audit

### C-3A-1: draft edit concurrency

**Verified in code:**

- `update_draft` takes a row lock (`load_version(..., for_update=True)`), so two PATCHes serialise rather than interleave.
- It has **no revision check**, so the second writer silently overwrites the first.
- The client-side check in `FormBuilderEditor.tsx:143-144` (re-read, compare status and presentation, then PATCH) narrows the window but cannot close it.
- The effect is a **lost update of draft configuration**. A version cannot become corrupt or mixed: drafts are not executable and are re-validated on submit and publish.

| Question | Answer |
|---|---|
| Blocker for 3C? | No, under the current single-author draft model. |
| Would a candidate make it worse? | **Yes:** anything that lengthens editing sessions or invites several editors on one draft (collaboration, large rule sets, multiple actions per version). For those candidates it becomes a **prerequisite**. |
| Recommendation | Stay deferred. Future backend hardening: `PATCH` with `expected_revision` → atomic compare-and-update → 409. |

### C-3A-2: AuthStore loses the user after reload

- **Verified:** `frontend/shell/src/core/auth/AuthStore.ts` holds `user` in memory only. It is initialised to `null` and set solely by login or `setUser`, with no persistence or rehydration of `user`.
- **Owner:** shared shell/auth. The Form Builder already treats client permissions as hints (`'yes' | 'no' | 'unknown'`), and the server's 403 decides.
- **Not a Form Builder defect, not a 3C blocker.** Classification: **out-of-scope shared infrastructure.**

### C-3A-3: ESLint

- **Verified:**
  - `package.json` defines `"lint": "eslint src …"` and the `eslint` 9 binary is installed;
  - there is **no ESLint configuration file** in `frontend/shell` (ESLint 9 requires `eslint.config.*`), so `npm run lint` cannot run meaningfully.
- **Compensating evidence:**
  - `tsc --noEmit` exit 0;
  - AST architecture guards in Vitest;
  - 223 focused Vitest tests.
- **Ownership:** repo-wide tooling, not Form Builder scope. **Not a blocker.**

### P3B-1: archive UI stale-state observation

- **Verified:**
  - the only mitigation in code is `queryClient.setQueryData(...)` with the server's response, followed by invalidation (`FormDetail.tsx:144`);
  - no test reproduces the original observation;
  - the server state was correct in the recorded run;
  - no root cause is documented.
- **Status: MITIGATED / NON-BLOCKING, root cause not established.** It is **not fixed**, because nothing proves it fixed.

### G-3B-1: form list DTO

- **Verified:** `definition_view` (`service.py`) returns key, name, description, owner_module, created_by and timestamps. It has no `published_version`, `latest_version` or `latest_status`, and `FormBuilderList.tsx` makes one call (`listForms`), so there is **no N+1 today**.
- **Blocks future functionality?** Only list-level status display or filtering. It is an **API enhancement**, and any feature that needs per-form status in the list must add it on the server rather than fan out client calls.
- **Before 3C?** Only if the chosen candidate needs list-level version status. None approved here does.

### New observations (recorded, not fixed)

| Id | Observation (from code reading) | Classification |
|---|---|---|
| O-1 | `get_runtime_form` → `_authorized_capability` resolves the pinned version but does not check `descriptor.executable`. A form pinned to a **disabled** capability version therefore **renders**, while submit is refused by the executor (`CapabilityNotExecutableError` → 409). Fail-closed on execution; misleading UX only. | Future hardening |
| H-1 *(hypothesis, not executed)* | Capability version immutability is a **convention**: registration with the same `(id, version)` replaces the entry, and no schema fingerprint is pinned. If a module changed a DTO without bumping the version and dropped a presented field, `render_fields` would hit `facts[f.name]` → `KeyError` → HTTP 500 instead of a typed error. Proving this needs a code change in a module, which this gate prohibits. | Future hardening (capability platform); prerequisite for Transport (§9 G) |

---

## 5. Dependency Direction Audit

| Required direction | Result |
|---|---|
| Form Platform → Capability (registry/executor) | ✅ imports `app.core.capabilities` only |
| Capability ↛ Form Platform | ✅ no `form_platform` reference in `core/capabilities/*` |
| Form Platform ↛ Workflow / Application Flow | ✅ only docstring mentions (`models.py:6`, comparisons in `capabilities/*`); no imports |
| Form Platform ↛ business-module internals | ✅ the only cross-module path is `capability_registry.resolve` / `execute_capability`; nothing imports `external_modules` |
| Who imports `app.core.form_platform` | Only `app/api/v1/form_platform.py` |
| Form Platform → ORM/SQL | Only its own two configuration tables; no table per form, no column per field, no SQL from configuration |
| Frontend Builder → backend internals | ✅ only `@core/api/ApiClient`, `@design`, `@components/form/SchemaForm` types and `@features/form_runtime`. Python file names appear **only in comments** that cite parity sources. No `leave_management`/`leave_request` reference in non-test Builder or runtime code. |
| Configuration naming implementation details | ✅ a version can name only a capability id and version; class, method, route and table names cannot be expressed in the presentation schema (`extra="forbid"`) |

**No violation found.**

---

## 6. Versioning Audit

Pinning holds: `FormVersion.capability_id` + `capability_version` are NOT NULL, frozen once out of draft (service + trigger), and runtime and submit pass `version=v.capability_version` explicitly. **No form → latest-capability path exists**, because `resolve(id)` without a version is never called by the Form Platform.

| Scenario | Actual behaviour (code/tests) |
|---|---|
| Capability **deprecated** | Draftable, **not publishable** (`_bind(for_publish=True)`). Already-published forms keep executing, since an explicit version is allowed. |
| Capability **disabled** | Cannot be drafted or bound (422). Published forms render (O-1), but submit gets 409. |
| Capability **removed** (module deactivated) | Runtime gets 404 (fail-closed); PG test `test_published_form_fails_closed_when_its_capability_is_withdrawn`. |
| Form version **archived** | Immutable; runtime refuses an explicitly pinned archived version. `copy_from` creates a new draft (proven 201 at the 3B checkpoint). |
| Capability v1 and v2 coexist | Each form version keeps its own pin. A new version can rebind deliberately in draft; PG test `test_form_versions_stay_pinned_to_their_exact_capability_version`. |
| New form version created | New number under a `FOR UPDATE` lock on the definition; the binding is copied or explicit, never implicit. |

**Candidate impact:**

- **Breaks pinning:** Capability Composition, which needs a pin set instead of a pin.
- **Requires multi-binding:** Multiple Form Actions.
- **Cannot be done safely without a contract fingerprint (H-1):** Transport.
- **Pinning unaffected:** Custom/Computed Fields, which however break the "fields ⊆ contract" rule (§9 A/B).

---

## 7. Tenant / Security Audit

| Control | Verified |
|---|---|
| Form definitions tenant-scoped | `tenant_id NOT NULL` on both tables (keeps rows out of the shared policy's `IS NULL` global branch) |
| Tenant not client-authoritative | `caller_tenant()` uses only `caller.tenant_id`, must equal the session-bound tenant, and refuses an active bypass. Capability input contracts may not contain `tenant_id` (checked at registration). |
| RLS fail-closed | `rls.enable_statements` → `ENABLE` + **`FORCE ROW LEVEL SECURITY`**; PG test `test_form_platform_tables_have_forced_rls_and_the_immutability_trigger`; layer-1 explicit tenant filter in every loader |
| Execution tenant from caller | Executor `_resolve_tenant`; `async_tenant_context(tenant)` drives RLS `SET LOCAL` |
| Cross-tenant fails closed | PG test `test_tenant_isolation_of_form_definitions` |
| Builder authz server-authoritative | `require(caller, PERM_*)` in every service function; client hints are never trusted |
| Using a form needs the capability permission | `_authorized_capability`, re-checked by the executor |

**New boundaries each candidate would introduce:**

| Candidate | New persistence path | New privilege boundary | New attack surface |
|---|---|---|---|
| Custom Fields | **Yes** (untyped tenant data) | Yes (who may define data) | Yes (unvalidated data at rest, reporting leaks) |
| Computed Fields (expressions) | No / Yes | No | **Yes** (expression evaluation) |
| Capability Composition | Via several modules | **Yes** (union of permissions, partial execution) | Yes |
| Multiple Form Actions | No | Yes (per-action capability permission) | Small |
| Advanced Rules (presentation-only) | No | No | Small (bounded rule evaluation) |
| Submission Management | **Yes** (business-adjacent state in the Form Platform) | Yes | Yes (attachments) |
| Transport | **Yes** (cross-environment import) | **Yes** (import authority, signatures) | **Yes** (crafted import documents) |

---

## 8. Low-Code Drift Assessment

**SAFE pattern:** a consultant configures presentation; the existing capability, application service, domain rules and persistence do the rest. **The current platform matches it exactly.**

| Candidate | Drift |
|---|---|
| A. Custom Fields | **REJECT — LOW-CODE DRIFT.** The consultant would design data, and the Form Platform would own persistence of business data. |
| B. Computed Fields (business-affecting / expression / code) | **REJECT — LOW-CODE DRIFT.** The Form Builder would define business rules or execute code. |
| B. Computed Fields (display-only, closed formats) | Safe in principle; covered by E. |
| C. Capability Composition | **REJECT** for the Form Platform: it becomes a process/transaction engine, which is Workflow's or Application Flow's job. |
| D. Multiple Form Actions | Safe **only** as "each action = one existing capability". Unsafe if actions carry transitions (workflow designer). |
| E. Advanced Rules | Safe only for presentation-only, closed-enum rules; unsafe for validation semantics or expressions. |
| F. Submission Management | **REJECT** for the Form Platform: business or workflow state would move into a configuration layer. |
| G. Transport | No drift, but premature (§9 G). |

---

## 9. Candidate Phase 3C Evaluation

### A. Custom Fields: **REJECT (low-code drift)**

A field outside the capability input contract has no owner who validates or persists it. `presentation.py` explicitly requires every field to be a contract property, because "the capability would never persist them". Supporting it means one of two things:

- **(a)** The Form Platform stores untyped per-tenant business data. That brings EAV or JSON blobs, reporting, search, migrations, audit and retention, and turns the platform into a data model.
- **(b)** Every module accepts an extension bag, so the capability contract stops defining WHAT.

Either violates the principle. **Valid alternative:** the owning module adds the field to its DTO and releases capability v(n+1), and the form rebinds in a new version. This already works today.

### B. Computed Fields: **REJECT categories 3–5; DEFER 1–2 into E**

| Category | Verdict |
|---|---|
| 1. Presentation-only (formatting a value) | Safe. Belongs to E if ever needed. |
| 2. Derived from submitted values, display only | Safe only if it is never submitted and never trusted. Needs a closed operation set, so it is an expression engine in disguise. **DEFER.** |
| 3. Affects business state | **REJECT.** The domain or capability must compute it. |
| 4. Arbitrary expressions | **REJECT.** |
| 5. Executable code | **REJECT.** |

### C. Capability Composition: **REJECT for the Form Platform (belongs to Workflow / Application Flow)**

Composition needs:

- a transaction boundary across modules (each capability call is its own unit of work in the executor, step 6);
- compensation instead of rollback;
- ordering;
- idempotency keys and retry;
- authorization over the union of permissions;
- partial-failure audit.

These are orchestration semantics that the repository already places in Workflow and Application Flow, with Workflow → Capability as the intended direction. Putting them in a form would make **Form → orchestration**, the forbidden direction. If needed, compose **inside a module-owned capability** (one business operation) or in Workflow.

### D. Multiple Form Actions: **DEFER (valid only in a narrow form)**

| Action kind | Correct owner |
|---|---|
| Save / Submit of *business data* | **Different capabilities** of the owning module (e.g. `…create_draft`, `…submit`) |
| Approve / Reject / Cancel of a business document | Workflow actions on the business object, **not** form actions |
| Form-version Submit / Reject / Publish / Archive | Form-definition lifecycle (already done in 3B) |
| Reset / Cancel editing | UI-only |

The only architecturally valid form of D: **a form version binds N existing capabilities, one per button, each pinned, each with its own permission, no ordering between them.** It needs a schema change (multi-binding) and per-action field mapping. With one capability in the system, **there is no second capability to bind**, so there is no evidence of need. Reconsider when a module exposes two or more capabilities over the same input.

### E. Advanced Declarative Rules: **DEFER (valid subset identified)**

| Rule | Presentation-only? | Changes business semantics? | Expression engine? | Verdict |
|---|---|---|---|---|
| Conditional sections (show/hide a whole section) | Yes | No | No (reuses the closed condition) | Valid |
| Conditional *required* (tighten only, client UX; server stays authoritative) | Mostly | Risky: makes a field look mandatory without the domain requiring it | No | Valid **only** as tighten-only UX, never loosening |
| Custom validation messages | Yes | No | No | Valid |
| Conditional defaults | No (pre-fills submitted data) | Can bias business input | Partly | **DEFER / caution** |
| Calculated display values | Yes if never submitted | No | **Yes** | **REJECT** for now (see B2) |
| Server-side validation rules in the form | n/a | **Yes** | Yes | **REJECT** (hidden business logic) |

The valid subset is small and safe, but **no consumer requirement exists**. Every rule extension also costs a backend and frontend parity change (`test_form_rule_parity.py`) and guard updates.

### F. Submission Management: **REJECT for the Form Platform**

- **Submission history and status:** these are business records, owned by the module (the leave request *is* the submission).
- **Drafts of business data:** a module capability (`create_draft`). Approval routing belongs to Workflow.
- **Attachments and comments:** a separate shared platform capability (document service) if ever needed, not the Form Platform.
- The Form Platform stores configuration, never business state (`models.py` docstring). F would break that invariant.

### G. Transport / Promotion: **DEFER (premature)**

There is one environment, one capability, and no commit baseline. Safe transport first needs:

- **(a)** an exportable capability contract fingerprint, to detect H-1-style drift between environments;
- **(b)** import authority and audit;
- **(c)** tenant re-mapping rules;
- **(d)** signature or integrity checking.

None of these exists, and there is no second environment to promote to.

### H. No Phase 3C: **valid outcome; adopted, but as DEFER, not STOP**

The foundation is complete for its purpose: configure, govern and render presentation over existing capabilities. The next value comes from **outside the Form Builder**:

- modules publishing more capabilities;
- capability-contract hardening (H-1, O-1);
- the C-3A-1 backend hardening;
- a committed baseline.

DEFER is chosen over STOP because D and E have identified valid subsets with concrete re-open triggers (§15). Closing the line permanently would ignore that.

---

## 10. Phase 3C Decision Matrix

| Candidate | Architectural Fit | Risk | Dependency | Recommended |
|---|---|---|---|---|
| Custom Fields | ✗ Violates "fields ⊆ capability contract"; the Form Platform would own data | High: data model, reporting, migration | Would need a generic persistence layer | **REJECT** (low-code drift) |
| Computed Fields | ✗ For business/expression categories; ✓ only for display formatting | High (expression engine) | Expression evaluator; parity on two runtimes | **REJECT** (3–5) / **DEFER** (1–2, via E) |
| Capability Composition | ✗ Orchestration belongs to Workflow / Application Flow | High: transactions, compensation, authz union | Workflow → Capability | **REJECT** (wrong owner) |
| Multiple Form Actions | ✓ Only as one pinned capability per action | Medium: multi-binding schema, C-3A-1 exposure | ≥2 capabilities over the same input (none today) | **DEFER** |
| Advanced Rules | ✓ For the presentation-only subset | Low–medium | Rule-parity fixtures; AST guards | **DEFER** |
| Submission Management | ✗ Business/workflow state | High | Module / Workflow / document service | **REJECT** (wrong owner) |
| Transport / Promotion | ✓ In principle | High (import surface) | Contract fingerprint (H-1), environments, commit baseline | **DEFER** (premature) |
| No Phase 3C | ✓ | Low | — | **ADOPTED as DEFER** |

---

## 11. Prerequisite Classification

| Item | Classification | Note |
|---|---|---|
| C-3A-1 draft concurrency | **FUTURE HARDENING**; becomes a **BLOCKER** for any phase adding multi-editor or longer editing (D, collaboration) | Backend `expected_revision` → 409 |
| C-3A-2 AuthStore reload | **OUT-OF-SCOPE SHARED INFRASTRUCTURE** | Shell/auth owner |
| C-3A-3 ESLint config | **OUT-OF-SCOPE SHARED INFRASTRUCTURE** (tooling) | `tsc` + AST guards compensate |
| P3B-1 archive stale UI | **NON-BLOCKING DEBT** | Mitigated; root cause not established |
| G-3B-1 list DTO | **NON-BLOCKING DEBT** (API enhancement) | Must be server-side if ever needed |
| O-1 disabled capability renders | **FUTURE HARDENING** | Fail-closed on submit already |
| H-1 contract drift at the same version → 500 | **FUTURE HARDENING**; **BLOCKER for Transport** | Hypothesis, not executed |
| Docs duplicated under `ERP/` | **DOCUMENTATION DEBT** | §14 |
| No commits in the repository | **Provenance prerequisite** for *any* further phase (not an architecture defect) | Not acted on here: commit is prohibited |

---

## 12. Recommended Phase 3C Scope

**Not applicable.** The evidence does not justify a Phase 3C now (§9, §10). No scope is defined, so that a scope cannot be started by default.

---

## 13. Explicit Non-Goals

Regardless of any future phase, the Form Platform must not:

- define fields outside a capability input contract;
- store business data or submission state;
- evaluate expressions or execute code;
- orchestrate several capabilities, or own transactions across them;
- carry workflow transitions or approval routing;
- resolve a capability without an explicit pinned version;
- accept a tenant from the client;
- generate schema, CRUD, SQL or domain models.

This gate itself did **not** fix C-3A-1/2/3, P3B-1, G-3B-1, O-1 or H-1, and did not install or configure ESLint.

---

## 14. Documentation Root Recommendation

**Current state:**

- **`docs/architecture/`** (canonical): `CAPABILITY_PLATFORM.md`, `FORM_DEFINITION_PLATFORM.md`, `FORM_BUILDER_PLATFORM.md` and `reviews/FORM_*` (8 Form Platform reviews, including this one).
- **`ERP/`** holds only:
  - `summary.md`, an index created at the 3B checkpoint;
  - `reviews/FORM_BUILDER_PHASE_3B_READINESS.md`, a **duplicate** of the canonical 3B report that differs only in header links.
- **Missing paths named in this brief (not created):**
  - `ERP/FORM_DEFINITION_PLATFORM.md`;
  - `ERP/FORM_BUILDER_PLATFORM.md`;
  - `ERP/reviews/FORM_DEFINITION_FOUNDATION_READINESS.md`;
  - `ERP/reviews/FORM_DEFINITION_METADATA_AUDIT.md`;
  - `ERP/reviews/FORM_CAPABILITY_FOUNDATION_{AUDIT,READINESS}.md`.

  Each has a canonical equivalent under `docs/architecture/` with the same file name.
- The 3A, 3B and metadata-audit documents already record that the briefs' `ERP/` paths map to `docs/architecture/`.

**Recommendation:**

- **Canonical root:** `docs/architecture/` (platform docs) and `docs/architecture/reviews/` (audits and readiness).
- **`ERP/summary.md`:** keep as **index only**, pointing at canonical paths.
- **Future documentation-only task** (not part of this gate or any 3C):
  - replace `ERP/reviews/FORM_BUILDER_PHASE_3B_READINESS.md` with a one-line pointer, or remove it, so only one copy is maintained;
  - optionally move `ERP/summary.md` to `docs/architecture/FORM_PLATFORM_SUMMARY.md`;
  - align future briefs to `docs/architecture/` paths.

Nothing was moved, deleted or duplicated by this gate.

---

## 15. Final Decision

The architecture is sound, and no open condition blocks it. No candidate justifies implementation now: four are rejected as drift or wrong owner, and three are deferred because there is no consumer and the prerequisites are missing.

**Re-open criteria** (any one of these warrants a new, single-candidate brief):

1. **For D:** a business module registers two or more capabilities over the same input that a user would invoke from one form. C-3A-1 hardening comes first.
2. **For E:** a concrete consumer requirement for conditional sections, tighten-only required, or custom messages, limited to the presentation-only subset in §9 E.
3. **For G:** a second environment exists, the repository has a committed baseline, and a capability contract fingerprint (H-1) is designed in the Capability Platform.

Recommended work **outside** the Form Builder, each needing its own brief:

- establish a committed baseline;
- more module-owned capabilities;
- Capability Platform hardening (H-1, O-1);
- C-3A-1 backend concurrency token.

```text
PHASE 3C DECISION: DEFER
```

---

## 16. Evidence / Test References

**Code read for this gate:**

- `backend/app/core/form_platform/{service,runtime,models,presentation}.py`;
- `backend/app/core/capabilities/{registry,executor,contract}.py`;
- `backend/app/api/v1/{form_platform,capabilities}.py`;
- `backend/app/core/database/rls.py` (`enable_statements`);
- migration `backend/alembic/versions/c3d4e5f6a7b8_form_platform_definitions.py`;
- `backend/external_modules/leave_management/capabilities.py`;
- `frontend/shell/src/features/form_builder/*`, `features/form_runtime/*`;
- `frontend/shell/src/core/auth/AuthStore.ts`;
- `frontend/shell/package.json`.

**Commands run (2026-10-07):**

```text
backend  pytest tests/unit/test_capability_{architecture,discovery,executor,registry}.py
                tests/unit/test_form_{builder_contract_parity,lifecycle_contract,platform_architecture,presentation,rule_parity}.py
         → 109 passed
backend  pytest tests/integration/workflow_postgres/test_{capability_discovery,capability_leave_management,
                form_platform,form_platform_fresh_database_migration}.py      (real PostgreSQL, localhost:5432)
         → 22 passed
frontend vitest run src/features/form_builder src/features/form_runtime src/__tests__/ShellLayoutNavigation.test.tsx
         → 12 files, 223 passed
frontend tsc --noEmit -p .  → exit 0
frontend eslint config      → none present (eslint 9 binary installed, no eslint.config.*)
git log                     → "your current branch 'main' does not have any commits yet"
```

**Recorded (not re-run):**

- Playwright `form-runtime-proof` (4), `form-builder-proof` (3), `form-lifecycle-proof` (3); full E2E 25/25 on 2026-10-06;
- full backend baseline 8 / 3,624 / 179+5 skipped / 148 on 2026-10-06;
- archived → `copy_from` 201 proof on 2026-10-07 (3B report §12/§15.1).

**Related documents:**

- `docs/architecture/FORM_BUILDER_PLATFORM.md`, `FORM_DEFINITION_PLATFORM.md`, `CAPABILITY_PLATFORM.md`;
- `docs/architecture/reviews/FORM_CAPABILITY_FOUNDATION_{AUDIT,READINESS}.md`;
- `docs/architecture/reviews/FORM_DEFINITION_{METADATA_AUDIT,FOUNDATION_READINESS}.md`;
- `docs/architecture/reviews/FORM_BUILDER_PREREQUISITES_READINESS.md`;
- `docs/architecture/reviews/FORM_BUILDER_PHASE_3{A,B}_READINESS.md`;
- `ERP/summary.md`.

**Provenance:** Commit: NONE · Push: NONE.
