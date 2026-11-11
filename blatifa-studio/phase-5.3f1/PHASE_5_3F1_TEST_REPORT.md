# Phase 5.3f.1 — Test report

All runs offline. `BLATIFA_LIVE` unset, so the 7 live Flow checks are skipped by design.

## Resource gate (brief §6), `evidence/resource_gate.txt`

| Measurement | Before full run (2026-11-09T07:06Z) | After |
|---|---|---|
| Free disk | 12.33 GiB (≥ 10 GiB ✔) | 11.77 GiB |
| Swap | 0 / 0 MB used | 309 / 1024 MB used |
| Memory free | 42 % | 42 % |
| Other test/browser automation processes | none. The user's personal Chrome and the Claude Chrome host were running; they are not part of the tests and were not touched. | — |

The conditions were safe, so the full suite was run **once**.

## Results

| Run | Result |
|---|---|
| Baseline before editing (5.3d + 5.3e + 5.3f) | 140 passed (`evidence/pytest_baseline_targeted.log`) |
| Targeted after the change: 5.3f.1 + 5.3f + 5.3e + 5.3d | **173 passed** (33 new + 140). The first run had 1 failure, caused by a bug in the new static test (it also scanned the comment in `handoff.py`). The test was fixed, not the code. |
| **Full regression** `pytest tests` | **556 passed, 7 skipped, 0 failed**, 404 s, exit 0 (`evidence/pytest_full.log`). 556 = 480 (5.3e) + 43 (5.3f) + 33 (5.3f.1). |
| Skipped | 7 × `tests/live/test_flow_live.py`: "live Flow checks are opt-in (BLATIFA_LIVE=1)" |
| `ruff check src tests` | all checks passed |
| Hashes | protected baseline 26/26 OK; test baseline 32/32 OK |

Existing test functions are all present: 5.3e has 33 and 5.3f has 34, the same counts as before. No assertion was
removed or changed. The exact diff is in `evidence/test_helper_changes.diff`.

## Coverage (brief §5)

| Requirement | Test(s) in `test_phase5_3f1_strict_default.py` (unless stated) |
|---|---|
| Default strict | `test_strict_preparation_is_the_default`, `test_omitted_configuration_rejects_a_bare_binding`, `test_valid_preparation_creates_a_handoff_by_default` |
| Missing binding / missing stored prompt | `test_missing_binding_is_rejected`, `test_missing_stored_final_prompt_is_rejected` |
| Prompt hash, nonce, experiment, scene, project, account, attempt mismatch | `test_mismatch_rejects_handoff_creation` (14 cases), `test_nonce_of_another_attempt_is_rejected` |
| Explicit legacy opt-in | `test_explicit_legacy_opt_in_accepts_a_bare_binding_but_still_verifies_preparations` |
| Legacy cannot be enabled accidentally | `test_legacy_mode_cannot_be_enabled_accidentally` (6 combinations) |
| Legacy isolation from production code | `test_legacy_opt_in_is_isolated_from_production_code` (static) |
| Runner strict integration | `test_runner_with_the_default_service` (2) |
| Simulated CLI | `test_simulated_cli_uses_strict_handoff_and_nonce_binding` (in-process `blatifa episode simulate`, simulated results without media id → strict handoff) |
| Crash recovery | `test_strict_handoff_then_identity_and_crash_recovery`; 5.3f crash/kill tests; 5.3e recovery tests (now under the strict default) |
| Concurrent binding | 5.3f `test_concurrent_preparation_same_process_two_connections`, `test_concurrent_preparation_separate_processes` (4 OS processes) |
| Invariants | `test_protected_hashes_and_flags_unchanged` |
