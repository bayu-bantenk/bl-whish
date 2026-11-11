# Phase 5.3g — Test report (offline)

`BLATIFA_LIVE` was unset throughout. No browser, no Flow.

## Resource gate (`evidence/resource_gate.txt`)

| | Free disk | Swap used | Memory free | Other test/automation processes |
|---|---|---|---|---|
| Before the full run (07:29Z) | 11.73 GiB | 566 / 1024 MB | 37 % | none |
| After (07:36Z) | 11.70 GiB | 704 / 1024 MB | 41 % | — |

Disk was ≥ 10 GiB and memory was safe, so the full suite was run **once**.

## Results

| Run | Result |
|---|---|
| New `tests/unit/test_phase5_3g_preflight.py` | 9 passed |
| Targeted: 5.3g + 5.3f.1 + 5.3f + 5.3e + 5.3d | **182 passed** (9 + 33 + 43 + 88 + 9) |
| **Full regression** | **565 passed, 7 skipped, 0 failed**, 409 s, exit 0 (`evidence/pytest_full.log`). 565 = 556 (5.3f.1) + 9. |
| Skipped | 7 × `tests/live/test_flow_live.py` (opt-in `BLATIFA_LIVE=1`) |
| `ruff check src tests docs/phase-5.3g/tools` | all checks passed |

No existing test or assertion was changed in 5.3g.

## New tests (why)

| Test | Reason |
|---|---|
| `test_ready_accepts_a_valid_preparation` | control case for the new check |
| `test_ready_refuses_a_handoff_of_unknown_origin` | closes the gap: `ready` did not re-check the preparation (brief §5B, §4.3–4) |
| `test_ready_refuses_after_the_binding_became_invalid` | a corrupted binding after creation (simulated) |
| `test_legacy_mode_keeps_its_explicit_behaviour` | explicit opt-in is unchanged (tests only) |
| `test_cli_ready_refuses_before_touching_the_browser` | an ineligible handoff never causes a browser read |
| `test_cli_ready_with_a_valid_binding_goes_on_to_the_read_only_page` | a valid binding reaches the read-only step (no browser running → `EXIT_NO_BROWSER`, state unchanged) |
| `test_candidate_check_reports_blocked_without_a_preparation_and_writes_nothing` | the candidate tool reports BLOCKED and leaves the DB file byte-identical |
| `test_candidate_check_creates_no_binding_nonce_or_attempt` | static: the tool has no write, nonce, Store or browser code |
| `test_protected_hashes_flags_and_no_live_switch` | invariants against the 5.3g baseline |

## Coverage map (brief §6)

| Requirement | Existing / new test |
|---|---|
| Strict accepts a valid preparation | 5.3f.1 `test_valid_preparation_creates_a_handoff_by_default`; 5.3g `test_ready_accepts_a_valid_preparation` |
| Missing binding, missing final prompt, hash, nonce, account, project, scene or experiment mismatch | 5.3f.1 `test_missing_*`, `test_mismatch_rejects_handoff_creation` (14), `test_nonce_of_another_attempt_is_rejected` |
| Legacy not accepted on normal paths | 5.3f.1 `test_legacy_mode_cannot_be_enabled_accidentally`, `test_legacy_opt_in_is_isolated_from_production_code`; 5.3g `test_ready_refuses_a_handoff_of_unknown_origin` |
| Grid page is not a detail page | 5.3e `test_grid_page_is_not_a_detail_page` |
| Detail page not opened manually | 5.3e `test_observe_requires_the_users_confirmation` |
| Page change during observation | 5.3e `test_page_changing_during_collection_is_rejected` |
| Insufficient evidence → UNRESOLVED | 5.3e `test_page_of_another_experiment_and_scene_is_rejected`, `test_dialog_during_observation_is_rejected`, `test_other_project_is_rejected`; 5.3d resolver tests |
| Browser close or crash is not success | 5.3e `test_cli_observe_with_closed_browser_keeps_the_state`, crash/recover tests; 5.3f.1 `test_strict_handoff_then_identity_and_crash_recovery` |
| No click, input, generate or retry | 5.3e `test_handoff_code_has_no_mutating_browser_calls` (covers `cmd_handoff` incl. the new check); 5.3f `test_no_browser_click_or_generation_call_was_introduced`; 5.3g static tool test |
