# Phase 3 — Evidence Register

> **Ringkasan (ID):** Daftar bukti Phase 3. Semua bukti generate di sini **SIMULATED** (Flow tiruan di dalam proses). Yang **asli** hanya: SQLite, file, ffmpeg/ffprobe, teks lock dari master data, dan output CLI. **Tidak ada bukti live Google Flow baru** di fase ini.

Kinds: **UNIT** (pure logic), **SIM** (simulated Flow, real SQLite/files/ffmpeg), **FIXTURE** (headless Chrome on local HTML), **CLI** (real command run), **REC** (recorded live evidence from earlier phases, parsed offline). Logs: `docs/phase-3/evidence/logs/`.

## 1. Brief §7 acceptance list

| ID | Requirement | Test(s) (`tests/unit/test_episode_e2e.py` unless noted) | Kind | Result |
|---|---|---|---|---|
| E-P3-01 | Episode with multiple scenes; variable size (1, 7, 36, 120) | `test_variable_sizes_and_order` | UNIT | PASS |
| E-P3-02 | Sequential dependencies | `test_full_36_scene_episode_completes_with_exact_locks` (S02 attached S01's last frame) | SIM | PASS |
| E-P3-03 | Independent scenes / chains continue after a failure elsewhere | `test_render_failure_blocks_only_dependents` | SIM | PASS |
| E-P3-04 | Missing start frame | `test_missing_start_image_fails_before_flow` (warning at validation, `INVALID_INPUT` before any Flow call) | SIM | PASS |
| E-P3-05 | Invalid prompt | `test_validation_report_lists_every_problem` (`INVALID_PROMPT`) | UNIT | PASS |
| E-P3-06 | Missing character lock | same (`UNKNOWN_LOCK`, lock row MISSING) | UNIT | PASS |
| E-P3-07 | Changed lock text | same (`LOCK_TAMPERED`, `hash_ok=False`) | UNIT | PASS |
| E-P3-08 | DRAFT lock rejection (production) and DRAFT left untouched | `test_draft_locks_rejected_in_production_and_left_draft`; CLI log | UNIT + SIM + CLI | PASS |
| E-P3-09 | Exact lock preservation | 36 submitted prompts all contain the user's Octopus text; `test_octopus_lock_text_and_hash_unchanged`; Phase 2 `test_octopus_lock_in_master_data_is_exactly_the_users_text` | SIM + UNIT | PASS |
| E-P3-10 | Simulated generation success | 36-scene run: 36/36 FRAME_READY, 1 approval per scene, 360 simulated credits in the ledger | SIM | PASS |
| E-P3-11 | Simulated generation failure | `RENDER_FAILED`, no automatic retry, dependents blocked | SIM | PASS |
| E-P3-12 | Invalid video file | `test_invalid_video_and_extraction_failure` (`INVALID_ASSET`); Phase 2 junk / landscape / truncated payloads | SIM + real ffmpeg | PASS |
| E-P3-13 | FFmpeg extraction failure | same test (`FRAME_EXTRACTION_FAILED`, injected) | SIM | PASS |
| E-P3-14 | Successful last-frame extraction | 36-scene run: last frame 720×1280 probed | real ffmpeg | PASS |
| E-P3-15 | Restart during each major transition | `test_episode_restart_at_every_point`: 72 crash points over a 3-scene episode, each followed by a "machine restart" (new DB connection, startup scan, new engine) | SIM | PASS |
| E-P3-16 | Repeated crash recovery | `test_episode_repeated_crashes[3,7]` (crash every 3rd / 7th point, 2 chains, 4 scenes); Phase 2 single-scene sweeps | SIM | PASS |
| E-P3-17 | Resume without duplicate generation | invariants in every sweep: ≤ 1 approve per scene, no resubmit of an approved scene, no submit while a confirmation is open; `test_partial_completion_then_resume_without_duplicates` | SIM | PASS |
| E-P3-18 | Missing or ambiguous media id | `test_missing_or_ambiguous_media_id_is_never_guessed` (`MEDIA_ID_UNRESOLVED`, `AMBIGUOUS_RESULT`) | SIM | PASS |
| E-P3-19 | Partial episode completion | `max_scenes=2` → 2/6 (33.3 %), S03 NOT_STARTED, S04 WAITING; CLI 4/6 then 6/6 | SIM + CLI | PASS |
| E-P3-20 | Full episode completion | 36/36 (test); 6/6 (CLI) | SIM + CLI | PASS |

## 2. Additional evidence

| ID | Claim | Test / log | Kind | Result |
|---|---|---|---|---|
| E-P3-21 | The validator lists every problem at once (several codes in one report) | `test_validation_report_lists_every_problem` | UNIT | PASS |
| E-P3-22 | Storage: stop below 5 GiB before any Flow step; warn below 10 GiB; thresholds configurable | `test_storage_thresholds` | UNIT/SIM | PASS |
| E-P3-23 | Recovery sweeps only Blatifa temp files; a user file survives | `test_recovery_sweeps_only_blatifa_temp_files` | UNIT | PASS |
| E-P3-24 | LIVE runs blocked; SIMULATED/LIVE never mixed in one DB | `test_live_runs_are_blocked_and_modes_never_mix` | UNIT | PASS |
| E-P3-25 | Episode edited during production → manual, no second approval | `test_scene_without_final_frame_and_episode_change_during_production` | SIM | PASS |
| E-P3-26 | `extract_final_frame: false` honoured | same | SIM | PASS |
| E-P3-27 | Lock drift in the stored prompt stops the scene and its dependents | `test_lock_drift_in_stored_prompt_stops_the_scene` | SIM | PASS |
| E-P3-28 | APFS clone used for simulated media | `test_simulated_media_is_cloned_not_duplicated` | UNIT | PASS (block sharing not measured) |
| E-P3-29 | CLI validate / simulate (partial + resume) / status show every field of brief §9 | `test_cli_validate_simulate_and_status`; `logs/cli_simulated_demo.log` | CLI | PASS |

## 3. Regression tests for every previously discovered bug

| Bug (phase) | Regression test | Status |
|---|---|---|
| ARIA name parser and YAML-quoted names (P1) | `test_name_from_yaml_quoted_snapshot`, `test_parser_handles_quoted_names_attributes_and_values` | existing |
| Two sync Playwright drivers in one thread (P1 defect 2) | `tests/browser/test_engine_recovery.py::test_one_playwright_driver_per_process` | **added in P3** |
| `(?i)` regex silently never matched (P1) | `test_registry_rejects_invalid_definitions` (inline-flag case) | existing |
| PAGE_UNRESPONSIVE while loading (P1 defect 4) | `test_loading_page_counts_as_responsive` | **added in P3** (constant-level) |
| Workspace root created 755 (P1) | `test_profile_and_session_are_private` | existing |
| Masked e-mail / full hash in reports (P1) | `test_identity_public_view_hides_email`, `test_mask_email`, `test_capture_and_report_contain_no_personal_data` | existing |
| Account panel not closed by Escape (P1) | `test_credits_verified_and_panel_closed` | existing |
| `inspections/` created 755 (P2) | `test_report_dirs_and_their_parent_are_private` | existing |
| Spend lost after a crash past the Approve click (P2) | `test_crash_around_approve_never_double_spends`, sweep invariant | existing |
| Rendering text inline on the group (P2) | `test_rendering_tile_from_logged_text` (both forms) | existing |
| Leak harness left its server running when never ready (P2) | `test_server_that_never_answers_is_cleaned_up` | **added in P3** |
| Phase 2 runner ignored `filename_stem` / `extract_final_frame` (found in P3 audit) | E2E (`S01_v1.mp4` names; E-P3-26) | **added in P3** |

## 4. Test runs (executed)

| Run | Result | Log |
|---|---|---|
| Full suite: unit + simulated E2E + crash sweeps + fixture browser + Phase 1/2 regression | **201 passed, 7 skipped (live, opt-in), 0 failed** in 370 s | `logs/pytest_full.log` |
| Lint (`ruff check src tests tools`) | All checks passed | `logs/ruff.log` |
| CLI demo (SIMULATED, scratchpad workspace) | sample rejected in production (2 DRAFT locks); 36-scene episode valid; 6-scene run 4/6 → status → 6/6 | `logs/cli_simulated_demo.log` |
| Live Flow | **not run** (not authorized; 7 live tests skipped) | — |
