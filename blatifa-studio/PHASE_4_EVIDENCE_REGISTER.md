# Phase 4 — Evidence Register

> **Ringkasan (ID):** Daftar bukti Phase 4. Semua bukti berasal dari pengujian lokal dan offline. Episode dijalankan secara **SIMULATED**: Flow tiruan, sedangkan SQLite, file, ffmpeg, server HTTP lokal, dan Chrome headless pada halaman 127.0.0.1 adalah asli. Bukti media id hanya dari rekaman live lama yang dibaca offline. **Tidak ada bukti live Google Flow baru, tidak ada aksi Flow, tidak ada kredit.**

Kinds: **UNIT** (pure logic), **SIM** (simulated Flow; real SQLite/files/ffmpeg), **HTTP** (real local server on 127.0.0.1), **PAGE** (headless Chrome on the local UI page, no Google page), **CLI** (real command run), **REC** (recorded live evidence from Phase 0/1, read offline).

Labels: VERIFIED · SIMULATED · PARTIALLY VERIFIED · PROPOSED · BLOCKED. Logs: `docs/phase-4/evidence/logs/`.

## 1. Production control interface (A)

| ID | Claim | Test / log | Kind | Label |
|---|---|---|---|---|
| E-P4-01 | Dashboard shows name and metadata, total, completed, failed, blocked, pending, progress; buckets add up | `test_phase4_ui::test_dashboard_counts_add_up_and_show_simulated_mode` (6 = 2 + 1 + 1 + 2, 33.3 %) | SIM | VERIFIED (SIMULATED data) |
| E-P4-02 | Scene list carries every brief field (ID, name, dependencies, prompt, characters, Character/Style Lock status, start-frame source, last frame, status, validation errors) | `test_scene_rows_carry_every_field_of_the_brief` | SIM | VERIFIED |
| E-P4-03 | Scene detail: assembled prompt identical to the submitted one (hash), exact lock text, frame dependency, output files with sha256, checkpoint history with times, credit ledger | `test_scene_detail_shows_exact_prompt_lock_files_and_history` | SIM | VERIFIED |
| E-P4-04 | Reference images listed | `test_reference_images_are_listed` | UNIT | VERIFIED |
| E-P4-05 | Edit bumps the version, keeps an exact backup, leaves locks untouched, is audited, marks validation STALE; readiness refused until revalidation | `test_edit_bumps_version_invalidates_validation_and_requires_revalidation`, `test_edit_over_http_then_revalidate` | SIM + HTTP | VERIFIED |
| E-P4-06 | Locks, lock status, characters, start frame, output, version cannot be edited | `test_locks_status_and_structure_cannot_be_edited` | UNIT | VERIFIED |
| E-P4-07 | Edit conflict, no-op, invalid value, unknown scene, scene in production refused | `test_edit_refusals` | UNIT | VERIFIED |
| E-P4-08 | Outside change of the file invalidates validation | `test_a_change_of_the_file_by_someone_else_also_invalidates` | UNIT | VERIFIED |
| E-P4-09 | Whole flow in a real browser: counts, scene table, exact lock text rendered, history, readiness verdicts, authorization table, edit → STALE → refused → revalidate → CURRENT, no script/CSP errors | `tests/browser/test_control_ui.py` | PAGE | VERIFIED |
| E-P4-10 | CLI `blatifa ui` serves the Phase 3 demo episode (6/6, CURRENT), refuses token-less POST and a foreign Host | `logs/cli_control_demo.log` | CLI + HTTP | VERIFIED |

## 2. Episode readiness validation (B)

| ID | Claim | Test / log | Kind | Label |
|---|---|---|---|---|
| E-P4-11 | One report lists every brief category at once (22 expected codes, all 12 categories) | `test_phase4_readiness::test_every_problem_is_reported_together` | UNIT | VERIFIED |
| E-P4-12 | A clean episode is simulation-ready and never live-ready; Approve reported as medium | `test_clean_episode_is_ready_for_simulation_but_never_for_live` | UNIT | VERIFIED |
| E-P4-13 | DRAFT blocks production and live; warning only for simulation in non-production mode | `test_draft_locks_block_production_and_live_but_only_warn_in_non_production` | UNIT | VERIFIED |
| E-P4-14 | Disk: warn < 10 GiB, stop < 5 GiB, remaining-episode estimate | `test_storage_thresholds_and_episode_estimate` | UNIT | VERIFIED |
| E-P4-15 | Output folder missing / not a folder / not writable / not private | `test_output_directory_checks` | UNIT | VERIFIED |
| E-P4-16 | Start image: sha mismatch, not an image, symlink out of the workspace | `test_start_image_content_checks` | UNIT | VERIFIED |
| E-P4-17 | Unresolved media id from production reported per scene | `test_unresolved_media_id_from_production_is_reported` | SIM | VERIFIED |
| E-P4-18 | Finished scenes flagged stale after an upstream edit (transitive) | `test_finished_scenes_become_stale_after_an_upstream_edit` | SIM | VERIFIED |
| E-P4-19 | Unreadable file still gets storage and live findings | `test_unreadable_episode_still_reports_storage_and_live_findings` | UNIT | VERIFIED |
| E-P4-20 | CLI readiness: sample rejected (DRAFT ×2, missing start image), exit 2; Phase 3 demo simulation-ready, not live-ready | `test_cli_readiness_reports_and_exits_non_zero_for_the_sample`; `logs/cli_control_demo.log` | CLI | VERIFIED |

## 3. Character and Style Lock governance (C)

| ID | Claim | Test | Kind | Label |
|---|---|---|---|---|
| E-P4-21 | The Octopus lock text is the user's text, APPROVED, pinned by sha256 `2af1471e…6f12` | `test_phase4_locks::test_the_users_octopus_lock_is_pinned_and_unchanged` | UNIT | VERIFIED |
| E-P4-22 | Phase 4 code leaves the sample file byte-identical; Blatifa and style stay DRAFT | `test_sample_master_data_is_not_modified_by_phase_4_code`; E-P4-11 (file still DRAFT after the gate) | UNIT | VERIFIED |
| E-P4-23 | An Octopus text change is caught even if the hash is updated too (shortened, punctuation, whitespace, case); the file validator alone would accept it | `test_octopus_text_change_is_caught_even_when_the_hash_is_updated_too` | UNIT | VERIFIED |
| E-P4-24 | Character locks: missing, changed, DRAFT, RETIRED | `test_character_lock_states_missing_changed_draft_retired` | UNIT | VERIFIED |
| E-P4-25 | Style locks: DRAFT, changed, missing, wrong kind, none | `test_style_lock_states_missing_changed_draft_none_and_wrong_kind` | UNIT | VERIFIED |
| E-P4-26 | Lock text changed after scenes were produced (lock and hash both edited, so the file is self-consistent) | `test_lock_changed_since_production_compares_with_recorded_usage`; `test_phase4_readiness::test_lock_text_changed_after_scenes_were_produced` | UNIT + SIM | VERIFIED |
| E-P4-27 | `lock_usage`, `authorization_audit`, `edit_audit` are append-only | `test_lock_usage_and_audit_tables_are_append_only` | UNIT | VERIFIED |
| E-P4-28 | Lock text is never normalised (double spaces, tab, newline, unicode) | `test_lock_text_is_never_normalised_in_any_read_model`; E-P4-09 (rendered text equal) | UNIT + PAGE | VERIFIED |

## 4. Action authorization model (D)

| ID | Claim | Test | Kind | Label |
|---|---|---|---|---|
| E-P4-29 | `LIVE_ACTIONS_ACTIVE` is `False`, not read from any setting, assigned nowhere else | `test_phase4_authorization::test_live_actions_are_hard_wired_inactive` | UNIT | VERIFIED |
| E-P4-30 | Every action fully described; every named locator exists; NEVER for retry / always approve / account switch / settings / publish | `test_catalogue_describes_every_action_completely` | UNIT | VERIFIED |
| E-P4-31 | Every state-changing action is denied in Phase 4 even with a full grant, all preconditions and a valid confirmation; each decision audited | `test_every_state_changing_action_is_denied_in_phase_4` | UNIT | VERIFIED |
| E-P4-32 | Unknown action and unknown credit cost fail closed | `test_unknown_action_and_unknown_credit_cost_fail_closed` | UNIT | VERIFIED (rule tested with the flag patched in-test only) |
| E-P4-33 | Generation needs a manual confirmation bound to attempt and cost, single use; missing quote / precondition / UI state each reported | `test_generation_needs_a_fresh_single_use_manual_confirmation` | UNIT | VERIFIED (flag patched in-test, test registry with high Approve) |
| E-P4-34 | With the real registry, Approve stays medium, Reject stays deny, and the Phase 1 click guard still refuses Approve / Reject / Start generation | `test_real_registry_keeps_approve_and_reject_non_clickable` | UNIT | VERIFIED |
| E-P4-35 | No automatic retry; no account switch by automation or by request | `test_no_automatic_retry_and_no_automatic_account_switch` | UNIT | VERIFIED |
| E-P4-36 | No decision is returned when the audit cannot be written | `test_decision_is_not_returned_when_the_audit_cannot_be_written` | UNIT | VERIFIED |
| E-P4-37 | Real adapter writes still raise BLOCKED; nothing constructs an `Authorizer` | `test_real_adapter_writes_stay_blocked_and_unwired` | UNIT | VERIFIED |
| E-P4-38 | Live execution of any action through the model | — | — | **BLOCKED** (not authorized) |

## 5. Google Flow integration (E)

| ID | Claim | Test / source | Kind | Label |
|---|---|---|---|---|
| E-P4-39 | Recorded image tiles resolve from `data-media-id` (46 occurrences in 13 of the 21 captures, all image `img`) | `test_phase4_media_ids::test_recorded_image_tiles_resolve_from_their_data_media_id` | REC | VERIFIED |
| E-P4-40 | Recorded video thumbnail has no media id (and no recorded `src`) and is not guessed | `test_recorded_video_thumbnail_has_no_media_id_and_is_not_guessed`, `test_no_recorded_video_element_carries_a_media_id` | REC | VERIFIED |
| E-P4-41 | Ambiguous / invalid ids and id-looking titles or links are refused | `test_ambiguous_and_invalid_ids_are_refused` | UNIT | VERIFIED |
| E-P4-42 | Video thumbnail `src` as a read-only id source | needs a live read-only DOM check | — | **PROPOSED** (not authorized in this brief) |
| E-P4-43 | Click a tile to read `/edit/<uuid>` | — | — | **BLOCKED** (click) |
| E-P4-44 | Locator confidence policy unchanged; Approve/Reject non-clickable | registry untouched; E-P4-12, E-P4-34 | UNIT | VERIFIED |

## 6. Security, privacy, storage

| ID | Claim | Test / log | Kind | Label |
|---|---|---|---|---|
| E-P4-45 | Server binds 127.0.0.1; CSP, X-Frame-Options, no CORS, no-store; token substituted | `test_server_binds_loopback_only_and_serves_the_page` | HTTP | VERIFIED |
| E-P4-46 | Foreign Host (DNS rebinding), missing/wrong token, foreign Origin, wrong content type, PUT/DELETE, traversal, media outside the workspace: refused | `test_server_refuses_foreign_hosts_tokens_origins_and_methods`, `test_media_preview_is_limited_to_images_in_the_workspace` | HTTP + UNIT | VERIFIED |
| E-P4-47 | API output has no e-mail, cookie, login data or token | `test_api_output_contains_no_personal_data` | HTTP | VERIFIED |
| E-P4-48 | Static UI loads nothing external; no `innerHTML` / `eval` / `document.write` / inline script | `test_static_files_load_nothing_external_and_never_inject_html` | UNIT | VERIFIED |
| E-P4-49 | No browser, network or subprocess call in the Phase 4 modules | grep in implementation session (only matches: the word "requests" in comments) | static scan | VERIFIED |
| E-P4-50 | `pytest-41` investigated read-only before any test ran (size, entries, types, origin) | Implementation report §6 | inspection | VERIFIED |
| E-P4-51 | `pytest-41` was then pruned by pytest's Phase 3 retention setting during the first Phase 4 test run, not by a delete command and not with the user's authorization | Implementation report §6; folder listing after the run (`pytest-46` only) | inspection | **deviation, reported** |

## 7. Test runs (executed)

| Run | Result | Log |
|---|---|---|
| Full suite: Phase 1–3 regression + Phase 4 unit, SIM, HTTP, PAGE | **250 passed, 7 skipped (live, opt-in), 0 failed** in 444 s | `logs/pytest_full.log` |
| Re-run of the two test files touched by lint fixes | 11 passed | `logs/pytest_rerun_after_lint.log` |
| Lint (`ruff check src tests tools`) | All checks passed | `logs/ruff.log` |
| CLI demo (`episode readiness`, `ui`) | as E-P4-10, E-P4-20 | `logs/cli_control_demo.log` |
| Live Flow | **not run** (not authorized; 7 live tests skipped) | — |
