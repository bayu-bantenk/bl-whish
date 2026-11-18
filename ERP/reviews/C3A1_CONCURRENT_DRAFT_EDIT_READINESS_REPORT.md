# C-3A-1 — Concurrent Draft Edit: Readiness Report

**Implementation date:** 2026-11-12. **Report and E2E audit date:** 2026-11-13.
**Input:** open condition C-3A-1 from `FORM_BUILDER_PHASE_3A_READINESS.md` (draft PATCH has no concurrency token; backend change needed). Re-listed as open in `FORM_BUILDER_PHASE_3B_READINESS.md` and `FORM_BUILDER_PHASE_3C_ARCHITECTURE_GATE.md`.
**Owner decisions (2026-11-12):**
- token = **a new `revision` column** (schema change approved), not `updated_at`;
- token is **required**: a missing token is **428**.

**Scope:**
- **In scope:** the draft edit only (`PATCH /api/v1/form-definitions/{key}/versions/{n}`) and the Form Builder editor that calls it.
- **Not tokenised:** lifecycle transitions (§9).
- **Not done:** no Playwright run (§8, §10). The audit itself (§10) ran under audit-only restrictions: no application code, module, seed or database change. The one later code change on 2026-11-13 is test code: A-1 (owner-approved) changed `frontend/shell/e2e/tests/form-builder-proof.spec.ts` FB3 (§8.2). The report itself was then aligned (see Files changed).

---

## 1. Verdict

**CONDITIONAL GO.** At the backend/API layer, C-3A-1 is closed and proven on real PostgreSQL over real HTTP. Browser E2E is **not** verified.

**Proven:**
- **No blind write.** A draft can no longer be overwritten without saying which revision the edit was based on.
- **Atomic compare-and-set.** The revision check and the write happen as one step under the row lock.
- **Concurrent saves resolve cleanly.** Two concurrent saves based on the same revision always end as exactly one 200 and one 409, in 5 of 5 real concurrent rounds.
- **Mutations caught.** 4/4 mutations are caught, including removing the row lock.
- **No regression:** unit 3,983 passed; SQLite integration 231 passed + 5 skipped; PostgreSQL 44 files, 428 passed + 1 known xfail, 0 failed; Vitest 865/865; `tsc --noEmit` clean.

**Why not GO:**
1. **Browser E2E not re-run.** Neither `form-builder-proof.spec.ts` nor `form-lifecycle-proof.spec.ts` was run after the change (§8).
2. **Finding C3A1-F1: RESOLVED — test code corrected** (A-1, owner-approved, 2026-11-13). The audit found that `form-builder-proof.spec.ts` FB3 would fail against the new contract: its simulated "someone else saved" PATCH sent no token and asserted success. This was a test-code incompatibility introduced by C-3A-1, not a product defect. FB3 now sends `expected_revision` and asserts R+1. The fix is verified statically only (`tsc` + Vitest) and has **not** been run through Playwright, so FB3 is **not** PASS (§8.2).
3. **Transitions still untokened.** Submit, reject, publish and archive accept no token, so a decision taken on a stale view of a version is still possible (§9).

**Why not NO-GO:** the property C-3A-1 asked for (no silent overwrite of a draft) is proven at the authoritative layer. The open items are verification and test debt, not a hole in that property.

---

## 2. Problem statement: the failure before C-3A-1

**Before:**
- `service.update_draft` accepted any PATCH from a caller with `core.forms.design` on a `draft` version. There was no token.
- The only protection was in the browser: `FormBuilderEditor.tsx` re-read the version (`getVersion`), compared it with its baseline, then sent the PATCH.

**The race:** that is check-then-act across two HTTP requests. A second editor's PATCH landing between editor A's GET and A's PATCH was overwritten silently. So was a direct API caller, or any client that skipped the check.

**Pre-existing evidence covered only the sequential case:**
- Phase 3A FB3 (`form-builder-proof.spec.ts:263`) proved that sequence: the other save completes before the browser's freshness GET.
- It could not cover the interleaving.

**Not done:** the race was **not** reproduced on the pre-fix code in this phase. The closest proxy is mutation M1 (§6), which removes the server-side stale check and makes 3 of 4 new tests fail.

---

## 3. Migration `e5f6a7b8c9d0`

File: `backend/alembic/versions/e5f6a7b8c9d0_form_versions_revision.py` (revises `d4e5f6a7b8c9`, H-1).

| Item | Value |
|---|---|
| DDL (PostgreSQL) | `ALTER TABLE form_platform.form_versions ADD COLUMN revision INTEGER NOT NULL DEFAULT 1` |
| DDL (SQLite) | same, on the flat table `form_versions` |
| Downgrade | `DROP COLUMN revision` |
| Backfill | none. Existing rows start at 1, and any client view from before the migration has no revision, so it must reload anyway. |
| Trigger / RLS / FK / index | unchanged. `form_versions_guard` does not inspect `revision`, so a non-draft row's revision may still be bumped by its status transitions. |

**Fresh-database proof** (`test_form_platform_fresh_database_migration.py::test_fresh_database_upgrade_downgrade_upgrade`, real PG, throw-away DB), extended in this phase:

| Step | Result |
|---|---|
| upgrade to head | head `e5f6a7b8c9d0`; `revision` is `NOT NULL`, default `1` |
| downgrade to `d4e5f6a7b8c9` | `revision` gone; H-1 pin column and guard untouched |
| downgrade to `c3d4e5f6a7b8` → `b2c3d4e5f6a7` → upgrade head | head `e5f6a7b8c9d0`, column present |

---

## 4. Revision contract and HTTP behaviour

**Model** (`backend/app/core/form_platform/models.py:126-128`):
- `revision` is mapped as SQLAlchemy `version_id_col`.
- It is 1 on INSERT and +1 on every ORM UPDATE of the row: edit, submit, reject, publish, archive, and supersede-on-publish.
- Every ORM UPDATE carries `WHERE revision = <loaded value>`.

**Mechanism reused:** a revision counter was deliberately **not** hand-rolled in the service. The ORM's existing mechanism is used, so no write path can forget to bump it.

**Request contract:**
- `UpdateDraftRequest.expected_revision: Optional[StrictInt]` (`backend/app/api/v1/form_platform.py:99`).
- It is `Optional` at the schema level on purpose, so that a missing token becomes the service's 428 rather than a body-shape 422.
- `StrictInt` rejects `"1"`, `true` and `1.0` with 422.

**Response contract:** `version_view` now includes `revision` (`service.py:192`) on every version response: GET, create, PATCH and transitions.

**Check order in `service.update_draft`** (`service.py:333-372`). It is deliberate and pinned by tests:

| # | Check | Result | Test |
|---|---|---|---|
| 1 | permission (`require_permission` router dependency, then `require`) | 403 | existing FB2/LF2 API assertions; PG `test_form_platform.py` |
| 2 | tenant: definition/version not owned by the caller's tenant | **404**, with or without a token | `test_foreign_tenant_still_404_without_token` |
| 3 | `status != 'draft'` | **409** "immutable", with or without a token | `test_lifecycle_transitions_bump_revision` |
| 4 | `expected_revision` missing | **428** `FormPreconditionRequiredError`, row untouched | `test_token_required_stale_refused_current_accepted` |
| 5 | `expected_revision` not an int (service guard; HTTP already 422) | 422 | same test (`"1"`, `True`, `1.0`) |
| 6 | `expected_revision != v.revision` | **409** "was changed by someone else since you loaded it (your revision X, current Y)", row untouched | same test, and the race test |
| 7 | presentation/binding validation | 422 | existing |
| 8 | write | **200**, `revision` = previous + 1 | same test (1 → 2 → 3) |

**Why 404/409 come before 428:**
- Answering "send a token" to a request that could never succeed would be misleading.
- It keeps every existing negative test that PATCHes without a token meaningful (§8.2).
- It discloses nothing: a foreign row is still 404 before any token logic runs.

**New error:** `FormPreconditionRequiredError` (`errors.py:25`) is mapped to `HTTP_428_PRECONDITION_REQUIRED` (`form_platform.py:119`). It is added to `_HANDLED`, so it can never escape as a 500. No other new abstraction was introduced: the stale case reuses `FormConflictError` (409).

**Frontend** (`frontend/shell/src/features/form_builder/`):
- `types.ts:88`: `FormVersionView.revision: number`.
- `api.ts:56-62`: `updateDraft` body requires `expected_revision`.
- `FormBuilderEditor.tsx:127,148,151,155`:
  - the editor keeps the revision of the version it loaded;
  - the existing freshness pre-check now also compares the revision;
  - the PATCH sends it, and the revision returned by a successful save becomes the next token;
  - "Reload from server" remounts the editor (`key=ref#nonce`), so the token resets to the server's.
- The client pre-check is only an earlier, friendlier answer. The server's compare-and-set is authoritative.

---

## 5. Row locking and atomicity

- **Lock taken:** `update_draft` loads the version with `load_version(..., for_update=True)` (`service.py:350`; the lock itself is `service.py:224`, `SELECT … FOR UPDATE`).
- **Atomic:** the revision comparison (step 6) and the UPDATE run in the same transaction while that row lock is held. A concurrent `update_draft` on the same row blocks at its own `FOR UPDATE` until the first commits, then reads the bumped revision and gets 409.
- **Second, independent layer:** `version_id_col` makes the UPDATE itself conditional (`WHERE revision = <loaded>`). If a future code path wrote a version without the lock, the second writer's UPDATE would match 0 rows (`StaleDataError`) instead of overwriting.
- **Not proven:** this layer is **not** independently proven. With the lock removed (M3), the race test failed, but the losing request's exact status (500 from `StaleDataError` vs a second 200) was not retained.

**Evidence (real PostgreSQL, real HTTP through `httpx.AsyncClient` + `ASGITransport`, separate DB connections per request):**

| Scenario | Result | Test |
|---|---|---|
| two PATCHes, same `expected_revision`, sent concurrently (`asyncio.gather`), 5 rounds | every round exactly `[200, 409]`; winner's revision = base + 1; stored label = winner's | `test_c3a1_form_draft_concurrency.py::test_concurrent_saves_from_the_same_revision_exactly_one_wins` |
| same test with `for_update=False` (M3) | **fails** | §6 |

---

## 6. Mutation evidence

Each mutation was applied to the source, the C-3A-1 PG test file was run, and the source was restored. Restoration was verified with `git diff --no-index` against a pre-mutation copy, and the `version_id_col` grep count was checked.

| # | Mutation | Result |
|---|---|---|
| M1 | stale check `if v.revision != expected_revision` → `if False` | **caught**: 3 failed, 1 passed |
| M2 | missing-token check `if expected_revision is None` → `if False` | **caught**: 1 failed, 3 passed |
| M3 | row lock removed (`load_version(..., for_update=False)` in `update_draft`) | **caught**: 1 failed (race test), 3 passed |
| M4 | `__mapper_args__ = {"version_id_col": revision}` removed | **caught**: 3 failed, 1 passed |

4/4 caught. M3 is the important one: it shows the race test genuinely exercises the interleaving rather than passing by sequential luck.

---

## 7. Tenant isolation and draft-state compatibility

**Tenant isolation:**
- No ownership logic changed. Loaders are still `FormVersion.tenant_id == tenant` plus forced RLS.
- A foreign tenant's PATCH is 404 both without and with a (correct-looking) token, and the owner's row is unchanged (`test_foreign_tenant_still_404_without_token`).
- The token is checked only after ownership, so a foreign caller cannot learn a row's revision from the 409 text.

**Draft-state compatibility:**
- Non-draft PATCH stays 409 "immutable" regardless of token.
- Every transition bumps the revision. A draft that goes `draft → review → draft` (submit + reject) is at revision 3, so an editor tab opened at revision 1 is refused with 409 although the version is a draft again (`test_lifecycle_transitions_bump_revision`). This is intended: the content may have been reviewed and returned in between.

**Existing tests touched:** the PG tests whose PATCHes were expected to succeed now send the revision from the preceding response. No assertion was weakened.
- `test_form_platform.py`: 3 calls.
- `test_h1_contract_version_integrity.py`: 1 call.
- The alembic-head pin was moved from `d4e5f6a7b8c9` to `e5f6a7b8c9d0` in `test_h1_contract_version_integrity.py::test_migration_added_the_pin_column_check_and_guard` and in the fresh-DB migration test.

---

## 8. Test results and the E2E verification gap

### 8.1 Suites (run 2026-11-12, post-change)

| Suite | Command | Result | C-3A-1-specific evidence in it |
|---|---|---|---|
| Backend unit | `.venv/bin/pytest tests/unit --ignore=tests/unit/test_engine_execution.py` | **3,983 passed** | none new. `test_form_lifecycle_contract.py` still matches: route, permission and source status of `edit` unchanged, so `lifecycle_contract.json` was not regenerated. |
| Architecture | `.venv/bin/pytest tests/architecture` | **8 passed** | none |
| SQLite integration | `.venv/bin/pytest tests/integration --ignore=tests/integration/workflow_postgres` | **231 passed, 5 skipped** | **none.** No C-3A-1 test runs on SQLite; this is regression evidence only. |
| PostgreSQL integration | `.venv/bin/pytest tests/integration/workflow_postgres` | **44 files, 428 passed + 1 xfail, 0 failed** (was 43 files, 424 + 1 xfail) | +4 = `test_c3a1_form_draft_concurrency.py`, the only real-concurrency evidence |
| Form-related PG files individually | per file | c3a1 4/4, form_platform 10/10, h1 11/11 (after head-pin update), sales customer 12/12, fresh-DB migration 1/1 | |
| Vitest (full) | `npx vitest run` | **105 files, 865 passed** | `flow.test.tsx`: save sends `expected_revision` 1; next save sends the returned revision 2; same content but newer server revision → freshness conflict, no write; server 409 stale → Conflict state, not retried. `lifecycle_flow.test.tsx` fake backend now enforces the token and bumps the revision. **Mocked API, not proof of server behaviour.** |
| TypeScript | `npx tsc --noEmit -p .` | **clean** | |
| Playwright | — | **NOT RUN** | — |

### 8.2 E2E gap, and finding C3A1-F1

**C3A1-F1: RESOLVED — test code corrected (A-1, owner-approved, 2026-11-13).** Test-code incompatibility; not a product defect.

**Original finding:**
- `frontend/shell/e2e/tests/form-builder-proof.spec.ts` FB3 (pre-A-1 lines 277-278) simulated a concurrent editor with `request.patch(.../versions/2, { data: { presentation: concurrent } })`.
- That call sent **no `expected_revision`** and asserted `other.ok()`.
- Under the C-3A-1 contract it would get **428**, so FB3 would fail before reaching the browser conflict it is meant to prove.

**Fix applied (test code only, FB3 block, +10/-4 lines):** the simulated "other editor" now behaves as a correct C-3A-1 client.

| Line (now) | Change |
|---|---|
| 278-279 | `GET .../versions/2` first; assert it is still `draft`; take `base.revision`. This is the revision the browser loaded, since the browser has only edited locally and not saved. |
| 280-282 | the PATCH sends `expected_revision: base.revision` |
| 283 | `expect(other.ok(), await other.text())`: on failure the server's reason is printed |
| 284 | **new assertion:** `(await other.json()).revision === base.revision + 1` (R+1) |

**Why the R+1 assertion matters:**
- It proves the concurrent save really happened and that the browser's copy is now exactly one revision behind.
- If the simulated save were a no-op, or were not applied, FB3 fails at line 284 instead of silently testing a no-conflict path.

**What the conflict proof still checks, unchanged:**
- Line 286: Save. Line 287: `save-status` shows `Conflict`. Line 288: the conflict assertion, i.e. the `Conflict` alert contains "changed on the server since you opened it". The editor's freshness pre-check (`FormBuilderEditor.tsx:148`) sees the newer server revision and content.
- Line 290: v2 still holds `['Edited elsewhere', 'Period']`, so it was not overwritten.
- Then Reload shows the server version.
- If the client pre-check were bypassed, the browser's PATCH still carries the old revision R, and the server answers 409 (`service.py:359`), which the editor also shows as Conflict.

**Verification (static / isolated; no database, no browser):**
- `tsc --noEmit` on the spec through a scratchpad tsconfig extending `frontend/shell/tsconfig.json`: **exit 0**. `--listFilesOnly` confirms the spec was in the program. This was needed because the repo tsconfig includes only `src`.
- Vitest `src/features/form_builder`: **195/195**, including all five editor CONFLICT branches FB3 relies on. The API is mocked there, so this is not server evidence.
- **Scope:** reconstructed-baseline diff shows only the FB3 block changed. The other raw PATCH (line 241, FB2, expects 403) is deliberately unchanged.

**Status: FB3 has NOT been run. It must not be reported as PASS** until Playwright runs it on the real backend (blocked on A-2 to A-5, §10.8).

**Static compatibility of the other raw PATCH calls** (every one is answered before the token check; derived from reading the code, not from a run):

| Spec:line | Caller / target state | Expected | Why still valid |
|---|---|---|---|
| builder:241 (FB2) | employee, no `core.forms.design` | 403 | router permission dependency |
| lifecycle:134 | designer, v1 in review | 409 | non-draft (step 3) |
| lifecycle:153 | designer, v1 published | 409 | non-draft |
| lifecycle:210 | designer, v1/v2 archived | 409 | non-draft |
| lifecycle:240 (LF2) | reader | 403 | permission |
| lifecycle:270 (LF3) | tenant B, A's draft | 404 | ownership (step 2) |

- **Browser-originated PATCHes** (FB1 save, LF1 saves of v1 and v2) go through the updated editor, which sends the token. FB1's write-call assertion compares only method + path, so the new body field does not affect it.
- **Not verified:** none of this is run evidence. Browser E2E is **NOT PASS**.

---

## 9. Lifecycle transition concurrency limitation

`submit`, `reject`, `publish` and `archive` accept no `expected_revision`. What is already safe:
- Transitions serialise on `FOR UPDATE` of definition + version.
- Each checks the source status, so two conflicting transitions from the same state (for example reject vs publish of a version in review) resolve as one 200 and one 409.
- Content in `review` is immutable (service + trigger), so a reviewer always publishes exactly what was submitted.

**What is not covered: decisions on a stale view across a round-trip.** Example:
1. The reviewer opens v1 in review (content A).
2. Meanwhile the author's v1 is returned, edited to B and resubmitted.
3. The reviewer, still looking at A, clicks Publish. The status is `review` again, so publish succeeds and content B goes live unseen.

The revision now exists and is bumped by every transition, so tokenising transitions is a small, separable change. It is **not** part of C-3A-1 and would need its own decision: API contract change, Builder lifecycle buttons, and `lifecycle_contract.json` regeneration.

---

## 10. E2E prerequisite assessment (AUDIT ONLY, 2026-11-13)

Method: static reading of both specs, `playwright.config.ts`, `vite.config.ts`, `docker-compose.yml`, `backend/.env`, `scripts/seed_worklist_e2e.py`, `external_modules/leave_management/module.py`, `app/api/v1/modules.py`. Live state was read from the Homebrew DB (`localhost:5432/erp_platform`) only in `READ ONLY` transactions (`SET default_transaction_read_only = on`). Nothing was started, seeded, activated or changed.

### 10.1 Current environment state (observed)

| Item | Observed | Consequence |
|---|---|---|
| Docker daemon | **not running** (`docker.sock` absent) | Docker `erp_postgres` state can't be re-checked today. Last observed 2026-11-12: head `e5f6a7b8c9d0`, 0 `form_versions` rows. |
| :8000 / :5173 | nothing listening | backend and Vite both need starting |
| Homebrew DB head | `e5f6a7b8c9d0` | migration present |
| Tenants `phase46-tenant-a/-b` | present | |
| Spec personas | **only `phase_s2_platform_admin` exists.** `phase25_form_designer_a/b`, `phase3b_form_author_a`, `phase3b_form_reader_a`, `phase46_employee_a`, `phase46_outsider` are **absent** (0 other `phase%` users) | **seed required.** Why they disappeared was not identified: no test in `backend/tests` deletes `auth.users`. Recorded as open question Q-1. |
| `system.module_runtime_state` | `sales` active; `leave_management`, `accounting`, `external_boundary_probe` **inactive** | `leave_management` must be activated. See C3A1-F2 for `accounting`. |
| `form_platform` rows | 0 definitions / 0 versions | |

**C3A1-F2 (environment side effect of this phase's own test run):**
- `accounting` and `external_boundary_probe` were deactivated at **2026-11-12 15:56:57**, and `leave_management` at 15:57:40. These timestamps fall inside the full PostgreSQL suite run of 2026-11-12. This matches the known gotcha that a full PG run can leave modules inactive.
- Whether `accounting` was active **before** that run was not recorded, so its "original" state is unknown.
- It does not affect the two Form specs, but it will 404 the Accounting Playwright specs. Not restored, under this phase's restrictions.

### 10.2 Which backend and which database

- The specs call `http://localhost:8000/api/v1` directly and the UI at `http://localhost:5173`, which proxies `/api` to `localhost:8000` (`vite.config.ts:35-39`).
- The specs' documented backend is a **host** `uvicorn` using `backend/.env` (`DB_HOST=localhost`), i.e. the **Homebrew DB**. `seed_worklist_e2e.py` also uses `settings`, so it seeds the same Homebrew DB.
- The Docker `erp_backend` uses `DB_HOST=postgres` (`erp_postgres`, a different DB) and the `.env` value `MODULES_PATH=app/modules`. It **cannot discover `leave_management`**, which lives in `external_modules/`, and it would also hold port 8000.

**Requirement:** run the host backend, and keep the Docker backend stopped while the specs run. Running against Docker would need a separate seed into `erp_postgres` (via `docker exec`) and a `MODULES_PATH` change. **Not recommended.**

### 10.3 Required configuration

| Requirement | Value | Source |
|---|---|---|
| Backend | `cd backend && MODULES_PATH=app/modules,external_modules RATE_LIMIT_REQUESTS=5000 .venv/bin/uvicorn app.main:app --port 8000` | spec headers (builder:16-17, lifecycle:9-10) |
| `MODULES_PATH` | must include `external_modules`, or `leave_management` is undiscoverable and nothing can activate it | `.env:49` is `app/modules` only |
| `RATE_LIMIT_REQUESTS` | 5000. Each spec logs in several personas and makes many calls; the default 100/60 s caused 429s in past runs. | `playwright.config.ts` header |
| `WORKFLOW_FOUNDATION_DEFINITION_CODES` | not needed for these two specs | |
| Frontend | `cd frontend/shell && npm run dev` (5173) | |
| Run | `npx playwright test e2e/tests/form-builder-proof.spec.ts e2e/tests/form-lifecycle-proof.spec.ts` (serial, 1 worker) | |

### 10.4 Seed data

`scripts/seed_worklist_e2e.py` is idempotent and additive. Against the Homebrew DB it would create or ensure:
- **Permissions** (global rows), including `core.forms.{read,design,review,publish}` and `leave_management.requests.*`.
- **Per-tenant roles** `phase25_form_designer`, `phase3b_form_author`, `phase3b_form_reader`, `phase46_leave_employee`, … and their role-permission grants.
- **Users** (password `worklist123`), including the 6 missing personas and 14 other persona users for other specs. Static count of `_USERS` (`seed_worklist_e2e.py:163-184`): 20 tenant users = 6 spec personas + 14 others.
- **The platform principal**, which already exists.

It has **no undo script**. Risk: since N-2B S2.1 Defect B, the seed raises `PermissionIdentityConflict` if an existing permission row clashes on `(resource, action, scope)` across modules. Whether that happens on today's DB was not checked.

### 10.5 Module state: can the specs run without changing it?

**No.**
- FB1 must discover `leave_management.leave_request.create:v1` (`GET /capabilities`) and create a version bound to it. That capability exists only while the module is active (`setup()` registers it; `on_deactivate()` unregisters it).
- FB1 also executes it through `/forms/:key` and reads the row back from `/leave-management/requests/{id}`.
- LF1/LF2/LF3 create versions bound to the same capability (422 otherwise).

So `leave_management` must be **activated**:
- **Call:** `POST /api/v1/modules/leave_management/activate` with a `phase_s2_platform_admin` token. `require_platform_permission("core.modules.admin")` means a tenant admin gets 403.
- **What activation does:** `setup()` mounts `/leave-management`, registers the service, capability and flow definitions. There is no DDL and no seed; the module is already installed, with status `inactive`.

### 10.6 State changes a run would cause

| Change | Where | Reversible? |
|---|---|---|
| Users: **defined** by the seed = 20 tenant users (`_USERS`) + 1 platform admin (`_PLATFORM_USERS`). **Expected to be inserted** = 20 tenant users + 0 platform users: the 1 platform admin `phase_s2_platform_admin` already exists and is skipped by the seed's `username` check (`seed_worklist_e2e.py:324-328,346-350`). The expected-insert figure rests on the 2026-11-13 read-only audit (§10.1: no other `phase%` user present) and was **not re-checked** against the database since. Also roles, role grants and permissions. | `auth.*` (seed) | not by a script; they are inert test fixtures |
| `leave_management` → active (+ `module_lifecycle_audit` row) | `system.*` | yes, via deactivate (§10.7) |
| 3 form definitions (`e2e_builder_<stamp>`, `e2e_lifecycle_<stamp>`, `e2e_lc_review_<stamp>`) with versions, ending **published/archived** | `form_platform.*` | **effectively no.** The `form_versions_guard` trigger forbids deleting non-draft versions, and deleting a definition cascades into that trigger. Removal would need a trigger bypass, which is a separate, destructive decision. Keys are unique per run, so the rows don't collide. |
| 1 leave request (FB1 runtime submit, tenant A) | `leave_management.leave_requests` | deletable, but not by the specs |
| audit rows for every form operation, login/refresh records | `audit.*`, `auth.*` | append-only by design |

### 10.7 Restoring the starting state (if activation is later approved)

1. After the run: `POST /api/v1/modules/leave_management/deactivate` as `phase_s2_platform_admin`.
2. Verify `SELECT status FROM system.module_runtime_state WHERE module_name='leave_management'` = `inactive`.
3. **Restart the host backend** (or stop it). Pre-existing C-4/F-2: `ModuleCleanup.unregister_routes` cannot remove routes on FastAPI 0.115.6, so `/leave-management` stays mounted in that process after deactivation. The capability itself *is* unregistered at once.
4. Optionally restart Docker. With the host backend stopped, `docker compose up -d backend` restores the previous dev setup.

**Not restored by this procedure:** the seed rows, the E2E form rows, the leave request and the audit rows (§10.6).

### 10.8 Recommendation

**Playwright can be run safely in this local environment**, but it is **not authorized yet**:
- **Safe:** the target is the local Homebrew test DB, every write is additive, and the one module change is reversible.
- **Test-code blocker removed:** C3A1-F1 was resolved by A-1 (§8.2), so FB3 is no longer known in advance to fail.
- **Still blocked:** the environment actions A-2 to A-5 are not authorized.

**Actions and their authorization status (2026-11-13):**

| # | Action | Kind | Status |
|---|---|---|---|
| A-1 | Fix C3A1-F1 in `form-builder-proof.spec.ts` FB3: read v2 `revision`, send it as `expected_revision`, assert R+1 | test-code change | **DONE**: approved and applied 2026-11-13 (§8.2) |
| A-2 | Run `scripts/seed_worklist_e2e.py` against the Homebrew DB | **database write** (additive, no undo) | **BLOCKED / NOT AUTHORIZED** |
| A-3 | Stop or keep stopped the Docker backend; start the host backend with `MODULES_PATH=app/modules,external_modules RATE_LIMIT_REQUESTS=5000`, plus `npm run dev` | process/environment change | **BLOCKED / NOT AUTHORIZED** |
| A-4 | Activate `leave_management` as the platform principal; after the run, deactivate it and restart the backend (§10.7) | **module state change** | **BLOCKED / NOT AUTHORIZED** |
| A-5 | Accept permanent E2E residue: undeletable published/archived form rows, one leave request, audit rows (§10.6) | data-retention decision | **BLOCKED / NOT AUTHORIZED** |
| A-6 | (Independent of these specs) decide whether to re-activate `accounting` (C3A1-F2); its pre-run state is unknown | module state change | not requested |

**Expected outcome:** with A-2 to A-5 approved, both specs should be green: FB1-FB3 and LF1-LF3, 6 tests. **This is a prediction, not a result. Browser E2E has not been run.**

---

## 11. Database migration status

| Database | Head | Rows at last check | How it got there | Checked |
|---|---|---|---|---|
| Homebrew PG 14, `localhost:5432/erp_platform` (tests, alembic, host backend) | `e5f6a7b8c9d0` | 0 `form_versions` | `.venv/bin/alembic upgrade head`, 2026-11-12 | re-checked 2026-11-13, read-only |
| Docker `erp_postgres` (container app) | `e5f6a7b8c9d0` | 0 `form_versions` | `erp_backend` startup `alembic upgrade head` after `docker compose restart backend`, 2026-11-12 | 2026-11-12 only; **not re-checkable 2026-11-13 (Docker daemon down)** |

No additional migration was run in this phase.

---

## 12. Risk assessment

**What got safer:**
- No client, malicious or buggy, can overwrite a draft without proving which revision it edited.
- The race between two editors is closed at the server.
- The Builder can no longer lose a colleague's save silently.

**What did not change:**
- Tenant isolation, permissions, the immutability trigger, H-1 contract pinning.
- Transitions (§9).
- C-3A-2 (AuthStore does not rehydrate `user` after reload), C-3A-3 (no ESLint), P3B-1, G-3B-1.

**New risks introduced:**
- **Breaking API change.** Any client that PATCHes a draft without `expected_revision` now gets 428. In-repo callers: the Builder (updated), the PG tests (updated), and Playwright FB3 (updated by A-1 on 2026-11-13, C3A1-F1; not yet run). No other caller was found by grep.
- **Each write is a revision.** A no-op save (identical content) may not emit an UPDATE, so the revision does not move. That's harmless, but a client must not assume every 200 bumps the revision; it must take `revision` from the response.
- **Exposure.** `revision` is visible to every `core.forms.read` caller of their own tenant. This is not sensitive.

---

## 13. Residual risks and open items

| Id | Item | Blocks GO? |
|---|---|---|
| C3A1-F1 | FB3 raw PATCH lacked `expected_revision` (predicted 428). **RESOLVED — test code corrected** (A-1, 2026-11-13): FB3 reads v2's revision, sends `expected_revision`, asserts R+1 (§8.2). Verified statically (`tsc` + Vitest) only. | no longer (fix not yet run) |
| E2E | `form-builder-proof` (incl. corrected FB3) + `form-lifecycle-proof` **not run** after C-3A-1. No PASS may be claimed. Blocked on A-2 to A-5 (not authorized). | **yes** |
| L-1 | lifecycle transitions take no revision token (§9) | no (separate decision) |
| C3A1-F2 | `accounting` / `external_boundary_probe` left inactive by the 2026-11-12 PG run; pre-run state unknown | no (environment) |
| Q-1 | E2E personas absent from the Homebrew DB; cause unidentified | no (seed restores) |
| M3-detail | losing request's status with the lock removed not recorded; the `version_id_col` second layer is not independently proven | no |
| SQLite | no C-3A-1 test on SQLite | no (PG is the target; disclosed) |

---

## 14. Final gate decision

**CONDITIONAL GO.**
- **Not GO:** browser E2E has not been run. FB3 has been corrected for the new contract (C3A1-F1, A-1), but the fix has **not** been verified through Playwright, so FB3 is not PASS.
- **Not NO-GO:** the required property is proven on real PostgreSQL over real HTTP, including real concurrency, and every guard is mutation-proven.

**To reach GO:**
1. ~~Approve and apply A-1.~~ **DONE** (approved and applied 2026-11-13, §8.2; not yet run).
2. Approve A-2 to A-5.
3. Run both specs green on the real backend.
4. Restore module state per §10.7.

---

## Files changed (2026-11-12 implementation; 2026-11-13 A-1 test fix and report alignment)

| File | Change |
|---|---|
| `backend/alembic/versions/e5f6a7b8c9d0_form_versions_revision.py` | **new.** `revision INTEGER NOT NULL DEFAULT 1`, PG + SQLite, with downgrade |
| `backend/app/core/form_platform/models.py` | `revision` column + `__mapper_args__ = {"version_id_col": revision}`; docstring |
| `backend/app/core/form_platform/errors.py` | `FormPreconditionRequiredError` |
| `backend/app/core/form_platform/service.py` | `update_draft(expected_revision=)`: steps 4-6 under the row lock; `version_view` adds `revision`; docstring |
| `backend/app/api/v1/form_platform.py` | `UpdateDraftRequest.expected_revision: Optional[StrictInt]`; 428 mapping; `_HANDLED` |
| `backend/tests/integration/workflow_postgres/test_c3a1_form_draft_concurrency.py` | **new.** 4 PG HTTP tests |
| `backend/tests/integration/workflow_postgres/test_form_platform.py` | 3 successful PATCHes send `expected_revision` |
| `backend/tests/integration/workflow_postgres/test_h1_contract_version_integrity.py` | 1 PATCH sends `expected_revision`; head pin → `e5f6a7b8c9d0` |
| `backend/tests/integration/workflow_postgres/test_form_platform_fresh_database_migration.py` | `revision_column` fact; head → `e5f6a7b8c9d0`; extra downgrade step to `d4e5f6a7b8c9` |
| `frontend/shell/src/features/form_builder/types.ts` | `FormVersionView.revision` |
| `frontend/shell/src/features/form_builder/api.ts` | `updateDraft` body requires `expected_revision` |
| `frontend/shell/src/features/form_builder/FormBuilderEditor.tsx` | track and send revision; freshness check compares it; docstring |
| `frontend/shell/src/features/form_builder/__tests__/flow.test.tsx` | fixture `revision`; token assertions; 3 new tests |
| `frontend/shell/src/features/form_builder/__tests__/lifecycle_flow.test.tsx` | fake backend enforces and bumps revision |
| `frontend/shell/src/features/form_builder/__tests__/lifecycle.test.ts` | fixture `revision` |
| `frontend/shell/e2e/tests/form-builder-proof.spec.ts` | **2026-11-13, A-1 (test code only):** FB3 reads v2's `revision`, sends `expected_revision`, asserts R+1 (§8.2). FB3 NOT RUN / NOT PASS. |
| `docs/architecture/reviews/C3A1_CONCURRENT_DRAFT_EDIT_READINESS_REPORT.md` | **new**, this report. Later aligned after A-1: §8.2, §10.8, §13, §1 scope line, §10.4/§10.6 seed counts, this table. |

Environment side effects of the 2026-11-12 work, not file changes: both DBs migrated (§11); `docker compose restart backend` (twice: `.env` fix, migration); module deactivations during the PG suite run (C3A1-F2).
