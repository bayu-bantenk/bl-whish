# Phase 5.3e — Test report

Run 2026-11-06 (offline). Full log: `evidence/pytest_full.log`.

| Run | Result |
|---|---|
| `tests/unit/test_phase5_3e_handoff.py` | 88 passed |
| `tests/unit/test_phase5_3d_identity.py` (resolver, unchanged) | 9 passed |
| Full suite | **480 passed, 7 skipped** (7 = opt-in live Flow checks, `BLATIFA_LIVE=1`), 431 s; before: 392 passed |
| `ruff check src tests` | all checks passed |
| Protected file hashes (`shasum -c evidence/baseline_hashes.txt`) | 7/7 OK |

No existing test was changed, skipped or weakened.

## Coverage against the brief (§8, §10)

| Requirement | Test(s) |
|---|---|
| Every allowed / rejected transition | `test_transition_table`, `test_store_refuses_every_transition_outside_the_table` (7×7), `test_commands_refused_in_wrong_states` |
| Resolver integration, evidence binding | `test_verified_identity_reconciles_exactly_once`, `test_reopened_page_gives_the_same_route` |
| Another experiment / scene | `test_page_of_another_experiment_and_scene_is_rejected`, `test_other_scene_with_its_own_nonce_cannot_use_this_page`, `test_handoff_cannot_touch_another_attempt` |
| Different project / nonce | `test_other_project_is_rejected`, `test_page_of_another_experiment_and_scene_is_rejected` |
| Identity not verified / stale identity | `test_ready_needs_verified_identity_…` (3 cases), `test_identity_read_too_long_before_the_observation_is_rejected` |
| Not opened by the user | `test_observe_requires_the_users_confirmation` |
| Dialog, page changed, grid page | `test_dialog_during_observation_is_rejected`, `test_page_changing_during_collection_is_rejected`, `test_grid_page_is_not_a_detail_page` |
| Duplicate confirmation / resolver / apply | `test_duplicate_confirmation_is_recorded_once`, `test_verified_identity_reconciles_exactly_once` |
| Stale handoff | `test_attempt_changed_after_the_handoff_is_stale`, `test_old_handoff_is_stale` |
| Browser closure | `test_cli_observe_with_closed_browser_keeps_the_state` |
| Crash and recovery | `test_crash_after_observation_resumes_from_stored_evidence`, `test_crash_between_verification_and_apply_is_finished_once` |
| Repeated observation | `test_rejected_handoff_needs_a_new_identity_read_and_confirmation` |
| Two concurrent handoffs / applies | `test_one_open_handoff_per_attempt_and_concurrent_apply_reconciles_once` |
| Runner pause, no handoff when verified, no binding | `test_runner_pauses_…`, `test_verified_media_id_needs_no_handoff`, `test_without_a_nonce_binding_no_handoff_is_created`, `test_reconcile_path_labels_the_media_id_case` |
| No next scene started | `test_dependent_scene_is_not_started_by_identity_verification`; existing `test_episode_e2e` (dependants blocked) |
| Cancellation | `test_cancel_leaves_the_attempt_unresolved` |
| Append-only audit | `test_audit_tables_are_append_only` |
| Read-only code, authorization invariants | `test_handoff_code_has_no_mutating_browser_calls`, `test_protected_files_and_flags_are_unchanged` |

Limits: "concurrency" is two store connections in one process (SQLite `BEGIN IMMEDIATE`), not separate OS processes.
The browser is simulated (closed page) or replaced by recorded detail pages; nothing ran against live Flow.
