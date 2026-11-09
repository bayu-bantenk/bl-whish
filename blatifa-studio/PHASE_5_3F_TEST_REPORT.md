# Phase 5.3f — Test report

Run 2026-11-06, offline. Log: `evidence/pytest_targeted.log`.

## Resource gate (brief §7)

Free disk 6.9–7.1 GiB (below 10 GiB). Swap 5.3–5.5 of 6 GiB used; about 30 % of memory free. Nothing was deleted.
Following the brief, **the full suite was not run**. Only targeted modules and static checks ran.

| Run | Result |
|---|---|
| `test_phase5_3f_nonce_binding.py` (new) | **43 passed** |
| 12 modules that import the changed code: `test_phase5_3e_handoff`, `test_phase5_3d_identity`, `test_runner_simulation`, `test_production`, `test_scene_and_crash_sweep`, `test_phase5_1_runner_compat`, `test_phase4_authorization`, `test_core`, `test_phase5_2_1_registry_correction`, `test_phase5_1_recognition`, `test_phase5_2_live_evidence`, `test_phase5_3_recognition` (together with the 5.3f tests) | 329 passed |
| `test_episode_e2e`, `test_phase4_ui`, `test_phase4_readiness` (includes `episode simulate` through the CLI, now with nonce binding) | 46 passed |
| **Total executed** | **375 passed, 0 failed, 0 skipped** |
| `ruff check src tests` | all checks passed |
| Protected and test-file hashes (`shasum -c`) | 47/47 OK |

**Deferred (not run):** `test_devserver_tool`, `test_flow_readers`, `test_media`, `test_phase4_locks`,
`test_phase4_media_ids`, `test_phase5_2_observation`, `test_phase5_3_aspect`, `test_phase5_3_markers`,
`test_phase5_3_reference`, `test_phase5_live_evidence`, `test_phase5_probe`, `test_pytest_isolation`. None of them
imports a changed module (grep for `cli`, `runner`, `persistence.store`, `handoff`). Full regression is **not
claimed**.

No existing test was changed, skipped or weakened (32 test-file hashes unchanged).

## Coverage against the brief (§6)

| Requirement | Test(s) |
|---|---|
| One unique nonce per attempt; prepared, not submitted | `test_each_new_attempt_gets_one_unique_nonce_and_is_prepared_not_submitted` (20 attempts) |
| Nonce exactly once; binding = prompt | `test_nonce_appears_exactly_once_and_binding_matches_the_final_prompt` |
| Prompt hash = persisted prompt | `test_prompt_hash_matches_the_persisted_prompt` |
| Idempotent preparation | `test_duplicate_preparation_is_idempotent` |
| Nonce not appended twice | `test_existing_nonce_is_never_appended_twice`, `test_runner_preparation_failure_needs_a_person_and_submits_nothing` |
| Malformed / missing nonce | `test_malformed_nonce_is_rejected` (4 cases), `test_missing_nonce_is_rejected`, `test_empty_binding_context_is_rejected` |
| Other experiment / project / account | `test_other_experiment_project_or_account_is_rejected` (3), `test_other_context_or_no_context_never_submits_a_prepared_attempt` |
| Other scene / version | `test_other_scene_or_scene_version_is_rejected`, `test_changed_job_or_context_stops_a_prepared_attempt_before_submission` (3) |
| Other attempt id; duplicate binding; no transfer | `test_other_attempt_cannot_use_or_take_over_the_binding`, `test_nonce_collision_takes_a_fresh_nonce_and_never_reuses` |
| Changed prompt | `test_changed_prompt_invalidates_the_binding` |
| Stale binding | `test_stale_binding_is_rejected` |
| Atomic preparation / persistence failure | `test_preparation_is_atomic_when_persistence_fails` |
| Crash after nonce creation / prompt preparation | `test_crash_after_nonce_creation_leaves_no_trace`, `test_crash_after_prompt_preparation_leaves_no_trace` |
| Crash during binding (**separate OS process, `os._exit`**) | `test_process_killed_during_binding_leaves_no_partial_preparation` |
| Recovery without a duplicate nonce | `test_crash_after_commit_resumes_without_a_new_nonce`, `test_retry_after_a_crash_reuses_the_attempt_and_its_nonce` |
| Concurrency, same process (2 connections) | `test_concurrent_preparation_same_process_two_connections` |
| Concurrency, **separate processes** (4 OS processes, start barrier) | `test_concurrent_preparation_separate_processes` |
| Valid binding → handoff; reconciliation does not start the next scene | `test_runner_submits_the_bound_prompt_and_a_valid_binding_creates_a_handoff`, `test_end_to_end_simulated_handoff_reconciles_once_and_starts_nothing` |
| Missing / invalid binding → no handoff | `test_missing_binding_prevents_handoff_creation`, `test_invalid_binding_prevents_handoff_creation`, `test_invalid_binding_stops_the_runner_before_submission` (3) |
| `MEDIA_ID_UNRESOLVED` stays fail-closed; dependants blocked | the first runner test (re-run does not resubmit); `test_episode_dependants_stay_blocked_and_every_attempt_has_its_own_nonce` |
| Authorization invariants; no click or generation call | `test_protected_files_and_existing_tests_are_unchanged`, `test_no_browser_click_or_generation_call_was_introduced`, `test_live_episode_runs_stay_blocked_and_cli_simulation_binds_a_fake_project` |

## Limits

- The "invalid binding" cases are simulated corruption: the test drops an append-only trigger and then edits a row.
- The identity end-to-end test uses the recorded 5.3d detail page with the test's nonce substituted. It does not use
  a live page.
- The concurrency proof is SQLite on one machine (WAL, `BEGIN IMMEDIATE`).
