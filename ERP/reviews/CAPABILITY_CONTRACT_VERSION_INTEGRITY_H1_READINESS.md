# H-1 — Capability Contract Version Integrity: Readiness

**Date:** 2026-10-12
**Closes:** H-1 / S-5 from `CAPABILITY_SECURITY_AND_CONTRACT_INTEGRITY_GATE.md` (§5, §10, §12 "H-1 platform"). The one exception is transport/promotion validation, which has no implementation to validate (§10).
**Inputs:**
- `CND1_SALES_INVENTORY_PRODUCT_REFERENCE_IMPLEMENTATION_READINESS.md`;
- the capability security gate above;
- `CAPABILITY_EXPANSION_HARDENING_RC{1,2,3}_READINESS.md`;
- the current code (taken as authoritative wherever a document disagrees).

**Schema change:** one nullable column, one CHECK constraint and a replaced trigger function (migration `d4e5f6a7b8c9`). The user approved it explicitly in this phase (option "Add fingerprint column"), after the audit showed that H1-B cannot be met without persisting a per-version pin (§3.2). No RLS, foreign-key, index or RBAC change.
**Provenance:** Commit: NONE · Push: NONE

```text
H-1 CAPABILITY CONTRACT VERSION INTEGRITY: GO
  Registry: a registered (id, version) is never replaced. Equivalent re-registration = no-op; anything else = CapabilityConflictError.
  Ownership recorded per entry; platform cleanup removes a module's capabilities on deactivation and on failed activation.
  Published Form versions pin the canonical contract fingerprint. Publish and runtime refuse missing/malformed/drifted pins (409) before the handler.
  Proven on real PostgreSQL + real HTTP + the real ModuleLifecycleManager; 12/12 mutations detected.
```

---

## 1. Repository State

| | Start | End |
|---|---|---|
| Git | `main`, **no commits** (`git rev-parse HEAD` → "unknown revision"). The whole tree is staged/untracked, as in every earlier phase. | Unchanged: **no commit, no push, no remote change** |
| Alembic head (code) | `c3d4e5f6a7b8` | `d4e5f6a7b8c9` |
| Local test DB `erp_platform` (localhost PG 14) | `c3d4e5f6a7b8` | `d4e5f6a7b8c9` (`alembic upgrade head`, run once in this phase) |

The `bl-whish/` sharing repository and `version 1.0/ERP/` were not touched.

## 2. Problem Statement (inherited)

Gate S-5 (2026-10-08, in-memory evidence):
- the registry silently replaces a same-`(id, version)` registration;
- Form Versions pin only `(id, version)`;
- drift becomes a 500 on render;
- the live permission applies to every published form.

The gate deferred the platform fix ("registry refuses same-key re-registration; fingerprint stored on the Form Version; drift → typed 409/422; transport validation") to this phase.

## 3. Audit Findings (before any change)

A baseline probe (scratchpad `h1_probe.py`, process-global registry, test-only `probe_mod`) printed:

```text
A1 permission after conflicting re-register: probe_mod.things.admin handler replaced: True
A2 input schema replaced: ['name', 'extra']
A3 cross-module register: CapabilityRegistrationError
A4 unregister_module('probe_mod') callable by anyone, removed: 1
D1 still resolvable after ModuleCleanup.full_cleanup: probe_mod.thing.create:v1
```

### 3.1 H1-A — Registry replacement

| Question | Finding (pre-H-1) | Evidence |
|---|---|---|
| Same id+version replaced silently? | **Yes.** `register()` overwrote `_entries[key]` and logged "replaced". The existing unit test even pinned this as intended (`test_duplicate_registration_by_owner_replaces_deterministically`). | probe A1/A2; old `registry.py::register` |
| Different contract / permission / tenant scoping / handler? | **All replaced** without comparison. The only exception was tenant scoping, where an unapproved `tenant_scoped=False` is refused by RC-3, so tenant-scoping drift could only *narrow*. | probe A1/A2 |
| Identical vs conflicting registration | **Indistinguishable.** Both replaced the entry. | code |
| Activation / re-activation / discovery overwrite? | Re-activation goes through `unregister` in `on_deactivate` first, so a fresh registration follows. A `setup()` re-run without deactivation (FAILED → retry; §3.4) **would replace silently**. Discovery is read-only. | `lifecycle.py::activate`, `retry` |
| Unregister scoping | `unregister_module(name)` removed by `descriptor.module == name`. There was **no exact `(id, version)` unregister and no recorded owner**. The module name is a caller-asserted string (probe A4). | old `registry.py::unregister_module` |

**Root cause:** the Phase 1 design chose "owner re-registration replaces" as its idempotence rule, with no contract-equivalence notion.
**Severity: HIGH** (integrity). It is not reachable from HTTP, but any in-process code path, or a deploy-time contract change, can swap the permission, schema or handler of a version that published forms run against.

### 3.2 H1-B — Published Form contract integrity

| Question | Finding (pre-H-1) | Evidence |
|---|---|---|
| What is pinned? | `capability_id` and `capability_version` only (NOT NULL columns) | `models.py` (`FormVersion`) |
| Immutable snapshot / fingerprint? | **None.** | schema, migration `c3d4e5f6a7b8` |
| Runtime comparison before invoking? | **No.** `_authorized_capability` resolves the *live* descriptor and uses its permission. `execute_capability` validates against the *live* DTO. | `runtime.py::_authorized_capability`, `execute_form` |
| Missing capability | `CapabilityNotFoundError` → 404, before execution (already correct) | PG `test_published_form_fails_closed_when_its_capability_is_withdrawn` |
| Contract changed | Executes against the new contract. A presented field that disappears raises a `KeyError` → **HTTP 500** (gate §5.3 D). | gate §5.3; reproduced as the `input-field-removed` case in §5 (now 409) |
| Malformed snapshot | n/a: nothing was stored | — |
| Draft edits alter a published version? | **No.** The service refuses (`FormLifecycleError` → 409) and the `form_versions_guard` trigger refuses (`check_violation`) | PG `test_lifecycle_and_published_version_immutability` |

**Root cause:** pinning by identifier without pinning content.
**Severity: HIGH** (integrity), combined with H1-A. Nothing per-row could detect drift, so the brief's §4.2 requirement ("Publication pins … canonical contract or a stable fingerprint") needs a persisted value. The `presentation` JSONB was rejected as a home for it:
- it is a closed, `extra="forbid"`, presentation-only document;
- the frontend Builder exchanges it, so it is a frontend contract.

That made a new column a direct H-1 blocker, and the column was approved before implementation.

### 3.3 H1-C — Snapshot and CI enforcement

| Question | Finding | Evidence |
|---|---|---|
| Leave and Sales Customer snapshots run by normal commands? | **Yes.** `tests/unit/test_leave_management_capability_contract.py` and `tests/unit/test_sales_customer_capability.py` compare the full `describe()` with the committed fixtures in `tests/unit/capability_contracts/`. Both are collected by `pytest tests/unit` (verified with `--collect-only`). | §8 |
| Could drift go undetected? | **There is no CI**: no `.github/`, no pre-commit config, no `pytest.ini`/`pyproject` test config in the repository. Enforcement is "whoever runs the unit suite". The full-equality comparison itself is strict: every `describe()` key, including permission, `tenant`, version and status. | `ls .github`, `ls .pre-commit-config.yaml` → absent |
| Strict enough? | Yes for the fixture's content. **But** a fixture and descriptor edited together passed silently, and nothing tied the fixture to what published forms ran against. | — |
| Smallest reliable commands | §9 | — |

**Severity: MEDIUM.** The tests were strict, but they were not connected to the runtime, and CI does not exist.

### 3.4 H1-D — Ownership and lifecycle

| Question | Finding (pre-H-1) | Evidence |
|---|---|---|
| Can another module replace? | **No.** `register()` requires `descriptor.module == module_name`, and the id namespace is the owner. | probe A3; unit `test_registration_into_another_modules_namespace_is_rejected` |
| Can another module unregister? | **Yes, by passing the other module's name.** `unregister_module` took any string (probe A4). In-process module identity is a trusted string; the platform has no module token. | probe A4 |
| Cleanup enforced by code? | **No, by convention only.** `ModuleCleanup.full_cleanup()` did not touch the capability registry (probe D1). Only each module's own `on_deactivate()` called `unregister_capabilities()`. | probe D1; old `cleanup.py` |
| Failed activation leaves a stale registration? | **Yes.** `setup()` registers capabilities, and a later failure (subscriber scan, transition, persistence) sets FAILED and calls `full_cleanup()`, which **left them registered and resolvable**. | §4.3, mutation M4 |
| Repeated cycles deterministic? | With the module hook, yes. Without it, re-activation would replace silently. | — |

**Root cause:** capability cleanup was added to modules (Phase 1, E-2) rather than to the platform's cleanup.
**Severity: MEDIUM.** A FAILED module's capability stays resolvable. Its handler then fails on the unregistered service (no business write), but the result is an uncontrolled error path.

**ServiceRegistry `is_registered` quirk** (found in CND-1): it does **not** affect capability ownership. Capability handlers resolve services with `resolve()`, which raises correctly after cleanup. **Not changed.**

## 4. Design and Changes

### 4.1 Contract fingerprint (`contract.py:171`)

`CapabilityDescriptor.contract_fingerprint` is `"sha256:" + sha256(json.dumps(describe() minus "status", sort_keys=True, separators=(",", ":"), ensure_ascii=True))`.
- **Content-based:** independently constructed, equal descriptors agree (unit `test_equivalent_registration_is_a_no_op_that_keeps_the_original_entry`).
- **Covers:** id, version, key, module/resource/action, display name, description, input and output JSON Schema (fields, requiredness, types, defaults, constraints), permission and `tenant`.
- **Excludes `status`, deliberately.** Status is lifecycle metadata that is already gated (executor refuses `disabled`; publish requires `active`). Deprecating a version must not break forms pinned to it.
- **Sorted keys:** JSON property order is not part of the fingerprint. The full-equality snapshot tests still pin order.
- The fingerprint is not added to `describe()`, so both committed fixtures are **unchanged**.
- `CONTRACT_FINGERPRINT_PATTERN = ^sha256:[0-9a-f]{64}$` (`contract.py:44`).

### 4.2 Registry (`registry.py`)

**Documented deterministic rule.** For an already-registered `(id, version)`:

| Second registration | Result |
|---|---|
| Same owner **and** same fingerprint **and** same status **and** same input/output contract **classes** **and** same handler object | **No-op.** The original entry (descriptor object and handler) is kept, so in-flight resolutions stay valid with `_handler_for`'s identity check (`registry.py:70`, `equivalent_to`). |
| Anything else (contract, metadata, status, contract class, handler) | `CapabilityConflictError` (subclass of `CapabilityRegistrationError`). The original is untouched (`registry.py:129`). |
| Different owner | Refused by the namespace rule first (`CapabilityRegistrationError`). `CapabilityOwnershipError` is the defence in depth (`registry.py:122`). |

Why contract classes are compared by identity *in addition to* the fingerprint: module validators (Leave's `leave_type` set, `end_date >= start_date`) are behaviour the JSON Schema does not show (`CAPABILITY_PLATFORM.md` "Known schema gaps"). A different class with an identical schema is not provably the same contract, so it fails closed. Object identity is **not** the sole rule for descriptors: equal content passes.

**Ownership:**
- `_Registration` records `owner` and `fingerprint`.
- New `unregister(id, version, *, module_name)` (`registry.py:138`) removes exactly one entry. It returns False when the entry is absent and raises `CapabilityOwnershipError` for another owner.
- `unregister_module(name)` now filters on the recorded owner (`registry.py:153`).
- `owner_of()` was added for inspection.

The only in-process way to change a registered version is for its owner to unregister it first, which is what deactivation does.

### 4.3 Platform-enforced lifecycle cleanup

- `ModuleCleanup.unregister_capabilities(name)` (`cleanup.py:300`) is a new step 5a in `full_cleanup()` (`cleanup.py:467`). It runs on deactivation, on failed activation (`lifecycle.py` activate `except` branch) and on install rollback.
- In `_deactivate_inner`'s failure branch, a module that failed to deactivate also loses its capabilities (`lifecycle.py:530`).
- The modules' own `on_deactivate()` calls are unchanged; they now become a no-op duplicate.
- **Not created:** a module identity token. The lifecycle manager is the trusted authority that names the module it is tearing down. Production call sites are pinned by an AST test (§5.1 `test_modules_mutate_only_their_own_capability_registrations`).

### 4.4 Published Form contract pinning

**Storage:** `form_platform.form_versions.capability_contract_fingerprint VARCHAR(71) NULL` (`models.py:107`, migration `d4e5f6a7b8c9`):
- CHECK `IS NULL OR ~ '^sha256:[0-9a-f]{64}$'`;
- `form_versions_guard` replaced (CREATE OR REPLACE, same trigger) to add two rules. The pin is **immutable once the version leaves `draft`**, and a version **cannot leave `draft` without a pin**;
- downgrade restores the previous function verbatim and drops the column and the CHECK.

**Lifecycle (`service.py`):**

| Step | Pin behaviour |
|---|---|
| `create_version` / `update_draft` | Set from the live descriptor (`:318`, `:347`) |
| `submit_for_review` | **Refreshed** from the live descriptor (`:368`). The reviewer reviews exactly this contract; it is frozen from here (service + trigger). |
| `reject` | Kept. The next submit refreshes it. |
| `publish` | `verify_pinned_contract` (`:392`): stored pin must equal live, else `FormContractIntegrityError` (409); the version stays in `review` |
| `copy_from` | The new draft pins the **current** contract (it is not copied). This is the re-publish path. |

**Runtime (`runtime.py`):**
- `_authorized_capability` order: resolve (404 if missing) → permission (403) → `verify_pinned_contract` (409, `:73`). It runs on **both** render and execute.
- `execute_form` passes `expected_fingerprint` to `execute_capability` (`:111`). The executor re-checks after authorization and before tenant resolution, input validation, the session and the handler (`executor.py:99`, `CapabilityContractMismatchError`). This closes the gap between the runtime's resolve and the executor's resolve; `_handler_for`'s identity check covers resolve → handler.

**Legacy rows** (left draft before `d4e5f6a7b8c9`, pin NULL):
- they fail closed (409 "no valid pinned capability contract");
- they are **not backfilled**. A backfill from the live registry would re-pin them to whatever is deployed now, the exact silent rewrite the brief forbids;
- recovery is a new version via `copy_from`, then submit and publish.

**API compatibility:**
- `version_view` gains the additive key `capability_contract_fingerprint`;
- the `capability` object (`{id, version}`) is **unchanged** (asserted in PG `test_publication_pins_the_live_contract_fingerprint`);
- audit `new_values` gains the same key;
- `get_runtime_form` output is unchanged;
- no frontend file was changed.

### 4.5 Error mapping (`app/api/v1/form_platform.py`)

| Condition | Error | HTTP |
|---|---|---|
| Capability or version not registered | `CapabilityNotFoundError` (existing) | 404 |
| Caller lacks the capability's permission | `FormPermissionError` / `CapabilityPermissionDeniedError` (existing) | 403, checked **before** integrity, so an unauthorized caller learns nothing about the contract |
| Pin missing/malformed, or live contract ≠ pin (render, execute, publish) | `FormContractIntegrityError` | **409**, a configuration conflict like `CapabilityNotExecutableError` |
| Executor-level pin mismatch | `CapabilityContractMismatchError` | **409** |
| Conflicting registration | `CapabilityConflictError` / `CapabilityOwnershipError` | n/a (in-process, raised at module setup → activation FAILED) |
| Anything unexpected | not mapped | 500 (unchanged; never converted to success) |

No broad `except` was added. `ModuleCleanup` keeps its existing per-step catch-and-log; the new deactivation-failure removal is wrapped in `contextlib.suppress`, which mirrors the existing `full_cleanup` call in the activation `except` branch.

## 5. Evidence Matrices

### 5.1 Unit: `tests/unit/test_capability_version_integrity.py` (49 tests)

| Brief # | Scenario | Result | Test |
|---|---|---|---|
| 1 | Initial registration; owner recorded | ✅ | `test_initial_registration_succeeds_and_records_the_owner` |
| 2 | Independent equal descriptor + same handler → no-op, original kept | ✅ | `test_equivalent_registration_is_a_no_op_that_keeps_the_original_entry` |
| 3 | Conflicting permission / display name / description / output schema / status | ✅ `CapabilityConflictError`, original intact | `test_conflicting_contract_registration_is_rejected[5]` |
| 3 | Wider input schema; same-schema different class | ✅ rejected | `test_conflicting_input_schema_and_contract_class_are_rejected` |
| 4 | Different handler | ✅ rejected, original handler kept | `test_conflicting_handler_registration_is_rejected` |
| 5 | Other module registers same id | ✅ rejected, owner and handler intact | `test_a_different_module_cannot_replace_an_owners_registration` |
| 6 | Other module `unregister` / `unregister_module` | ✅ `CapabilityOwnershipError` / 0 removed | `test_a_different_module_cannot_unregister_an_owners_registration` |
| 7 | Owner exact unregister and module-scoped removal | ✅ | `test_owner_unregister_is_exact_and_module_scoped`, `test_module_cleanup_removes_only_that_modules_capabilities`, `test_after_unregister_the_owner_may_register_a_changed_contract` |
| 8 | Real `ModuleLifecycleManager`: failure after `setup()` → **no** stale entry; `retry()` → exactly one, no conflict | ✅ | `test_failed_activation_after_setup_leaves_no_stale_capability_and_reactivation_registers_once` |
| 8 | 3 activate/deactivate cycles, with and without the module hook | ✅ | `test_repeated_activation_cycles_are_deterministic[2]` |
| 9 | Leave and Sales Customer: `describe()` == fixture, fingerprint == fixture-derived == pinned literal | ✅ | `test_published_capability_snapshot_and_fingerprint_are_exact[2]` |
| 10-13 | Fingerprint changes for permission, tenant scoping, version, input requiredness/type/default/constraint, display name, description | ✅ | `test_every_public_contract_change_changes_the_fingerprint[9]` |
| 10-13 | Mutated fixture (permission, required, field removed, tenant, version) ≠ live, for both capabilities | ✅ | `test_snapshot_comparison_detects_each_drift[5]` |
| — | Status excluded from the fingerprint | ✅ | `test_status_is_lifecycle_metadata_not_part_of_the_fingerprint` |
| — | Pinned set == RC-3 `_PUBLISHED` inventory | ✅ | `test_pinned_fingerprints_cover_exactly_the_published_set` |
| 14-15 | Executor: stale / zero / garbage pin → refused, **no session, no handler**; exact pin runs | ✅ | `test_executor_refuses_a_mismatched_pin_before_any_session_or_handler` |
| — | Unauthorized caller gets 403-class error, not contract detail | ✅ | `test_unauthorized_caller_gets_permission_error_not_contract_detail` |
| 16 | `verify_pinned_contract`: None, "", garbage, bad prefix/case/length, non-str → refused | ✅ | `test_verify_pinned_contract_fails_closed_on_missing_or_malformed_pin[7]` |
| 15 | Drifted pin, version-identity and id mismatch refused; exact match passes | ✅ | `test_verify_pinned_contract_refuses_drift_and_identity_mismatch` |
| H1-D | Every production `capability_registry.register/unregister/unregister_module` names its own `MODULE_NAME` == its package (AST); the only other caller is `cleanup.py` | ✅ | `test_modules_mutate_only_their_own_capability_registrations` |

Pinned fingerprints:
- `leave_management.leave_request.create:v1` = `sha256:2661d9d15c09261d9245d60908824bad71037bc12803eb503493c46413b32199`
- `sales.customer.create:v1` = `sha256:f38f02b7c7815630a77df4b73925f736467748aa444055ded9c00d5d3ec52c58`

### 5.2 Real PostgreSQL + HTTP: `tests/integration/workflow_postgres/test_h1_contract_version_integrity.py` (11 tests)

**Harness:** the same as `test_form_platform.py`:
- real JWT, `TenantContextMiddleware`;
- the real Leave Management module through `ModuleLifecycleManager` with `ModuleStatePersistence`;
- the migrated schema; non-superuser, non-BYPASSRLS role (asserted in `test_form_platform.py`).

**Drift simulation:** the owner unregisters v1, then registers a different contract under the same id/version. It wraps the **real handler** (taken from the registry, not imported) in a spy, so a missing check would write a real leave request.

| Brief # | Scenario | Result | Test |
|---|---|---|---|
| — | Column `varchar(71)` nullable, CHECK, guard mentions the pin 3×, revision `d4e5f6a7b8c9` | ✅ | `test_migration_added_the_pin_column_check_and_guard` |
| 1 | Publication pins the live fingerprint (response + DB column); `capability` shape unchanged; executes 201 | ✅ | `test_publication_pins_the_live_contract_fingerprint` |
| 15, 18 | Drift of **removed presented field** (gate §5.3 D, formerly 500), **permission**, **input schema**, **description**: GET 409, POST 409; spy called **0×**; leave requests **0**; after restore the same form → 201, 1 row | ✅ ×4 | `test_published_form_refuses_a_drifted_contract_before_the_handler[input-field-removed\|permission\|input-schema\|description]` |
| 14, 18 | Capability withdrawn: GET/POST 404, 0 rows | ✅ | `test_missing_capability_fails_before_the_handler_and_writes_nothing` |
| — | Contract changed after review: publish 409 (stays `review`); reject → resubmit re-pins → publish 200; "rollback" of the contract → POST 409 and the pin is **not rewritten**; 0 rows | ✅ | `test_publish_refuses_a_contract_that_changed_since_review` |
| 16, 18 | Pre-H-1 row (pin NULL; trigger disabled for one transaction to emulate it): GET/POST 409, 0 rows; legacy `review` row cannot publish (409); `copy_from` v3 pins and executes 201; legacy row still NULL | ✅ | `test_a_version_without_a_pin_fails_closed_and_is_recovered_only_by_republishing` |
| 16 | DB: malformed pin → CHECK violation (even on a draft); published pin change or NULL → trigger "immutable"; draft → review with NULL pin → trigger "cannot leave draft" | ✅ | `test_the_database_guards_the_pin` |
| 17 | Draft v2 edited; PATCH of published v1 → 409; v1 presentation and pin unchanged; runtime still serves v1 → 201 | ✅ | `test_editing_a_draft_does_not_mutate_the_published_version` |
| — | Upgrade → head `d4e5f6a7b8c9` with pin column/CHECK/guard; downgrade to `c3d4e5f6a7b8` removes them and restores the previous guard; downgrade to `b2c3d4e5f6a7`; upgrade again | ✅ | `test_form_platform_fresh_database_migration.py::test_fresh_database_upgrade_downgrade_upgrade` (updated) |

**Ordering proof (no write on integrity failure):** the handler-spy count (0) and the row count (0) per case, plus the executor unit test (no session opened). The integrity check runs before `DatabaseFactory.get_session()` in the executor, so no business transaction even begins.

### 5.3 Mutation check (12/12 detected)

Script: scratchpad `h1_mutate.py`. Each mutation was applied to the real file and the stated suite run with `-x`; files were restored from the backup, and `shasum -c` against pre-run hashes showed all 7 production files `OK`.

| # | Mutation | Detected by |
|---|---|---|
| M1 | Registry replaces silently (`if existing is not None` → `if False`) | `test_equivalent_registration_is_a_no_op_that_keeps_the_original_entry` |
| M2 | Equivalence ignores the handler | `test_conflicting_handler_registration_is_rejected` |
| M3 | `unregister` without the owner check | `test_a_different_module_cannot_unregister_an_owners_registration` |
| M4 | `full_cleanup` drops the capability step | `test_failed_activation_after_setup_leaves_no_stale_capability_and_reactivation_registers_once` |
| M5 | Runtime pin check removed | PG `…drifted_contract_before_the_handler[description]` (render returned 200) |
| M6 | Executor pin check removed | `test_executor_refuses_a_mismatched_pin_before_any_session_or_handler` |
| M7 | Runtime **and** executor checks removed | PG `…drifted_contract_before_the_handler[description]` |
| M8 | Publish pin check removed | PG `test_publish_refuses_a_contract_that_changed_since_review` |
| M9 | Submit does not re-pin | PG `test_publish_refuses_a_contract_that_changed_since_review` |
| M10 | Fingerprint ignores the input schema | `test_fingerprint_is_well_formed_and_content_based` |
| M11 | Integrity errors not mapped (→ 500) | PG `…drifted_contract_before_the_handler[description]` |
| M12 | Malformed pin accepted (`None` check only) | `test_verify_pinned_contract_fails_closed_on_missing_or_malformed_pin[]` |

Not mutated: the PL/pgSQL guard and the CHECK. They are database objects and are tested directly (`test_the_database_guards_the_pin`).

## 6. Architecture Boundary Verification

| Rule | Status | Evidence |
|---|---|---|
| `app.core.capabilities` imports only its allowlist (stdlib `hashlib`/`json` added) | ✅ | `test_capability_architecture.py` (6 passed) |
| No dynamic dispatch in capabilities / Form Platform | ✅ | same + `test_form_platform_architecture.py::test_no_dynamic_dispatch_in_form_platform_or_its_api` |
| Form Platform imports only approved dependencies and no business module | ✅ | `test_form_platform_architecture.py` (8 passed) |
| Form definitions store no handler or class names: only id, version, fingerprint string | ✅ | `models.py`; fingerprint is a hash of the public contract |
| Lifecycle contract the Builder imports unchanged | ✅ | `test_form_lifecycle_contract.py` (3 passed) |
| Builder ↔ capability contract parity | ✅ | `test_form_builder_contract_parity.py` (15 passed) |
| Production registration call sites name only themselves | ✅ | `test_modules_mutate_only_their_own_capability_registrations` |
| No framework type in capability contracts | ✅ | unchanged `describe()`; fixture files untouched (unmodified since 2026-10-09 / 2026-10-07) |

## 7. Files Changed

**Production:**

| File | Change |
|---|---|
| `backend/app/core/capabilities/contract.py` | `contract_fingerprint`, `CONTRACT_FINGERPRINT_PATTERN` |
| `backend/app/core/capabilities/errors.py` | `CapabilityConflictError`, `CapabilityOwnershipError`, `CapabilityContractMismatchError` |
| `backend/app/core/capabilities/registry.py` | Immutable registration rule, recorded owner, `unregister()`, `owner_of()`, owner-scoped `unregister_module()`; docstring rule replaced |
| `backend/app/core/capabilities/executor.py` | `expected_fingerprint` re-check (step 3a) |
| `backend/app/core/capabilities/__init__.py` | Exports |
| `backend/app/core/module_system/cleanup.py` | `unregister_capabilities()`, step 5a in `full_cleanup()` |
| `backend/app/core/module_system/lifecycle.py` | Failed deactivation drops the module's capabilities |
| `backend/app/core/form_platform/models.py` | `capability_contract_fingerprint` column (+ PG-only CHECK in metadata) |
| `backend/app/core/form_platform/errors.py` | `FormContractIntegrityError` |
| `backend/app/core/form_platform/service.py` | Pin on create/edit/submit, verify on publish, `verify_pinned_contract`, additive view/audit key |
| `backend/app/core/form_platform/runtime.py` | Verify on render and execute, `expected_fingerprint` pass-through |
| `backend/app/api/v1/form_platform.py` | 409 mapping for both integrity errors; docstring |
| `backend/alembic/versions/d4e5f6a7b8c9_form_versions_capability_contract_fingerprint.py` | **New** migration (approved) |

**Tests:**

| File | Change |
|---|---|
| `backend/tests/unit/test_capability_version_integrity.py` | **New**, 49 tests |
| `backend/tests/integration/workflow_postgres/test_h1_contract_version_integrity.py` | **New**, 11 tests |
| `backend/tests/unit/test_capability_registry.py` | `test_duplicate_registration_by_owner_replaces_deterministically` → `test_conflicting_registration_by_owner_is_rejected_and_keeps_the_original`. This is a **superseded rule**, not a weakened test. |
| `backend/tests/unit/test_capability_tenant_scoping.py`, `backend/tests/integration/workflow_postgres/test_capability_tenant_scoping.py` | The RC-3 "registration bypass" simulations build the private `_Registration` directly. They now pass `owner` and `fingerprint`; the assertions are unchanged. |
| `backend/tests/integration/workflow_postgres/test_form_platform_fresh_database_migration.py` | Head `d4e5f6a7b8c9`; asserts the pin column, CHECK and guard; adds a downgrade step to `c3d4e5f6a7b8` |

**Docs:**
- `docs/architecture/CAPABILITY_PLATFORM.md`: the lifecycle/version-integrity bullet supersedes the Phase 1 "replace" rule; a fingerprint row in §4; a pin bullet in §7.
- `docs/architecture/reviews/CAPABILITY_SECURITY_AND_CONTRACT_INTEGRITY_GATE.md`: §15 addendum (S-5 superseded; history preserved).
- This file.

**Not changed:**
- frontend;
- RLS policies, foreign keys, indexes, RBAC, permissions;
- capability IDs, versions, descriptors and fixtures (both JSON fixture files untouched since 2026-10-09 / 2026-10-07);
- Inventory (still dormant), CND-1 semantics, N-2 global-row policy, ServiceRegistry;
- no capability was published.

## 8. Test Commands and Results (2026-10-12, `backend/`, `.venv/bin/pytest -p no:cacheprovider -q`)

| Command | Result |
|---|---|
| `tests/unit/test_capability_version_integrity.py` (new) | **49 passed** |
| `tests/integration/workflow_postgres/test_h1_contract_version_integrity.py` (new) | **11 passed** |
| Unit, per file: `test_capability_registry` 29 · `test_capability_executor` 17 · `test_capability_architecture` 6 · `test_capability_discovery` 3 · `test_capability_tenant_scoping` (RC-3) 21 · `test_capability_reference_inventory` (RC-1) 4 · `test_cnd1_product_reference_contract` 14 · `test_form_platform_architecture` 8 · `test_form_lifecycle_contract` 3 · `test_form_builder_contract_parity` 15 · `test_leave_management_capability_contract` (RC-2) 11 · `test_sales_customer_capability` 14 · `test_module_system` 14 · `test_contract_activation_validator` 48 | all passed, 0 failed |
| Snapshots explicitly: `test_leave_management_capability_contract.py test_sales_customer_capability.py -k "pinned or fixture"` | **7 passed** (18 deselected) |
| Snapshot + H-1 unit together: `test_leave_management_capability_contract.py test_sales_customer_capability.py test_capability_version_integrity.py` | **74 passed** |
| PG, **one invocation**, 19 files: `test_h1_contract_version_integrity`, `test_c2_cross_tenant_reference_remediation`, `test_capability_{discovery,leave_management,sales_customer,tenant_scoping}`, `test_cnd1_product_reference`, `test_external_boundary_probe_{fresh_database_migration,lifecycle}`, `test_f7_multi_module_runtime_path`, `test_form_platform`, `test_form_platform_fresh_database_migration`, `test_hr_inventory_rls_hardening_fresh_database`, `test_leave_management_{fresh_database_migration,lifecycle,real_flow,worklist}`, `test_p30g_rls_activation`, `test_rc1_reference_candidates` | **149 passed**, 0 failed/skipped/xfailed |
| PG Sales/Accounting, **one file per invocation** (known order-dependence): `accounting_application_flow_proof` 7 · `accounting_journal_entry_concurrency` 4 · `accounting_module_production_activation` 2 · `sales_accounting_workflow_definition_provisioning` 4 · `sales_application_flow_proof` 7 · `sales_module_production_activation` 2 · `sales_order_concurrent_confirm` 4 · `sales_order_full_state_machine_concurrency` 8 | **38 passed** |
| PG remaining 4 files, one invocation: `test_alembic_schema_qualification_regression`, `test_pg_schema_import_order_regression`, `test_postgres_production_context_activation`, `test_workflow_definition_provisioning` | **23 passed** |
| `tests/integration/workflow` (SQLite tier) | **172 passed, 5 skipped**: static, pre-existing skip markers from the Workflow phases (`test_concurrency_lite.py` ×3, `test_security_enforcement.py` ×2) |
| `tests/unit --ignore=tests/unit/test_engine_execution.py` | **3,738 passed**, 0 failed (CND-1 baseline 3,689 + 49 new). The exclusion is the known event-loop-poisoning file and is disclosed. |

All 31 `workflow_postgres` files ran and passed (149 + 38 + 23 = 210) across 10 invocations.

**Failures during the phase, all explained:**
1. `test_capability_registry.py::test_duplicate_registration_by_owner_replaces_deterministically`: it pinned the old replace rule and was replaced (§7).
2. Two `test_capability_tenant_scoping.py` cases (unit, parametrized) and one PG case: `_Registration` gained required fields, so the fields were added.
3. `test_form_platform_fresh_database_migration.py`: it asserted the old head; it was updated.
4. My first lifecycle test re-activated a FAILED module with `activate()`. The state machine forbids FAILED → ACTIVATING, so it now uses the platform's own `retry()` path.

**NOT RUN:**
- the full `tests/integration/workflow_postgres` directory **in one invocation** (known order-dependence of the Sales/Accounting files);
- other integration directories;
- `tests/unit/test_engine_execution.py`;
- **Vitest and Playwright.** No frontend file changed; the additive response key is unexercised in the browser.

**Test-DB residue (by design of the existing harness):**
- non-draft form versions cannot be deleted (trigger). `erp_platform` now holds **269 non-draft versions with a NULL pin**: pre-H-1 test residue plus this phase's emulated legacy rows. All of them now fail closed;
- 83 versions carry a pin;
- leave requests are created in random throwaway tenants, as in `test_form_platform.py`;
- the lifecycle unit tests use `persistence=None`, so no module-state rows were written.

## 9. Regression Status

| Guarantee | Status | Evidence |
|---|---|---|
| RC-1 (reference candidates) | ✅ unchanged | PG `test_rc1_reference_candidates` 8; unit `test_capability_reference_inventory` 4 |
| RC-2 (full contract pins) | ✅ unchanged, now **also tied to the runtime pin** | unit Leave 11 / Sales 14; both fixture files untouched (mtimes 2026-10-09 / 2026-10-07) |
| RC-3 (tenant scoping) | ✅ unchanged (bypass simulations updated for the new private fields only) | unit 21; PG 4 |
| CND-1 (product reference) | ✅ unchanged; Inventory dormant | unit 14; PG 10 |
| C-2 | ✅ | PG 17 |
| Published Leave / Sales Customer form behaviour | ✅ compatible for every version published after `d4e5f6a7b8c9`. **Versions published before it fail closed (409) until re-published**: a deliberate, documented correction (§10 R-1). | PG `test_form_platform` 10, `test_capability_sales_customer` 12, `test_capability_leave_management` 9 |

## 10. Remaining Risks and Limitations

1. **R-1, operational: pre-H-1 published forms stop working.** Every form version that left draft before `d4e5f6a7b8c9` has no pin and returns 409 on render, execute and publish.
   - **Before deploying the migration to any non-test database:** inventory them (`SELECT … WHERE capability_contract_fingerprint IS NULL AND status <> 'draft'`) and re-publish each through `copy_from` → submit → publish.
   - There is no automatic backfill, by design.
2. **R-2: any public-contract change, even a compatible one, now requires re-publishing pinned forms.** This includes description, titles and an added optional field. It is stricter than `CAPABILITY_PLATFORM.md`'s "compatible change keeps the version" (now documented there). A compatibility engine that allows additive drift is not built.
3. **R-3: handler behaviour is not fingerprinted.** The fingerprint covers the public contract and the registry compares handler *objects* in-process. A deploy that changes a handler's business semantics behind an unchanged contract is not detectable mechanically. It stays policy, as before.
4. **R-4: module identity in-process is a trusted string.** The registry enforces owner-scoped operations; the lifecycle and an AST test pin the call sites. Arbitrary in-process Python could still reach `_entries`. No module token exists, and creating one is out of scope.
5. **R-5: no CI.** Enforcement is the commands in §11. No CI infrastructure was invented.
6. **R-6:**
   - a module whose `on_deactivate` raises is now stripped of capabilities, but its routes and services remain (existing lifecycle behaviour);
   - FastAPI route removal remains limited (gate §12, carried).
7. **R-7: transport/promotion validation** (gate §12) is **not applicable**. No form transport exists. When one is built, it must carry and verify the pin, not recompute it.
8. Not run: §8.

## 11. Minimum Enforcement Commands (no CI in the repository)

The smallest reliable set, from `backend/`:

```bash
# registry, fingerprint, snapshots (Leave + Sales Customer), executor, ownership, lifecycle
.venv/bin/pytest -p no:cacheprovider -q tests/unit/test_capability_version_integrity.py \
  tests/unit/test_leave_management_capability_contract.py tests/unit/test_sales_customer_capability.py \
  tests/unit/test_capability_registry.py tests/unit/test_capability_tenant_scoping.py
# published-form pin, drift → 409, DB guards (real PostgreSQL; separate invocation — conftest guard)
.venv/bin/pytest -p no:cacheprovider -q tests/integration/workflow_postgres/test_h1_contract_version_integrity.py \
  tests/integration/workflow_postgres/test_form_platform.py \
  tests/integration/workflow_postgres/test_form_platform_fresh_database_migration.py
```

The broader `tests/unit --ignore=tests/unit/test_engine_execution.py` run already collects all the unit files above (verified with `--collect-only`).

## 12. Conditions Before Another Capability Can Be Published

Carried, still mandatory:
- RC-1 / RC-2 / RC-3 (gate §11);
- N-2 for any global-row semantics;
- CND-1 semantics for product references.

New from H-1:
1. The new descriptor's `contract_fingerprint` is added to `_PINNED_FINGERPRINTS` (`test_capability_version_integrity.py`) next to its full `describe()` fixture. `test_pinned_fingerprints_cover_exactly_the_published_set` fails until both this and the RC-3 `_PUBLISHED` inventory include it.
2. Its module registers through a `capabilities.py` whose `MODULE_NAME` equals its package. The AST test lists the allowed call sites and must be extended deliberately.
3. A real-PostgreSQL test proves its published form pins the fingerprint and refuses drift (the pattern of `test_h1_contract_version_integrity.py`).
4. Before `d4e5f6a7b8c9` reaches any shared or production database: R-1's inventory and re-publish plan is executed.

## 13. Final Decision

```text
GO
```

**Why GO:** each §9 criterion of the brief is evidenced.
- Conflicting same-version registration raises and keeps the original (unit, M1/M2).
- Ownership is enforced per entry and by the platform cleanup (unit, real lifecycle, M3/M4).
- Published execution checks the exact pin before the handler (PG + executor unit, M5-M7).
- Drift, missing registration and missing/malformed pins fail closed with 409/404 and no business write (PG, M11/M12).
- Published versions stay immutable: service + trigger, now including the pin (PG).
- Both snapshots are exact, bound to pinned fingerprints, and in the normal unit run.
- RC-1/2/3, CND-1 and C-2 pass.
- The schema change is the one approved; RLS, tenant isolation and RBAC are untouched.

**Why not GO-WITH-CONDITIONS:**
- the remaining items (R-1 to R-7) do not leave any currently published capability or post-H-1 form unsafe;
- R-1 makes legacy forms *unavailable*, not *unsafe*: the fail-closed direction the brief requires;
- R-3 and R-4 are inherent limits of in-process Python, stated rather than hidden.

The §12 conditions bind future publication. They do not qualify this phase's guarantees.

**Why not NO-GO:**
- no path was found or left in which a published form executes against a conflicting or unpinned contract;
- no path bypasses ownership through the public registry API;
- no path lets an integrity failure reach a handler.

---

**Confirmation:** no commit, no push, no Git remote change was made. Inventory was not activated, no capability was published, and N-2 was not started.
