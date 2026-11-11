# Phase 5.3g.4.3: test compatibility matrix

> **Ringkasan (ID):**
> - Sumber kebenaran: audit statis G.4.2.1 (43 tes, semuanya UNKNOWN karena jaringan). Temuan B-1 s/d B-7 tetap
>   berlaku sampai dievaluasi ulang dengan bukti.
> - Di guest Linux, **semua 43 tes akan di-skip** kecuali ada keputusan Q-1, karena path Chrome macOS di-hardcode.
> - Tes video butuh codec H.264, jadi **Google Chrome** (bukan Chromium).
> - Tes UI butuh `ffmpeg` di guest.
> - Skip dihitung sebagai **tidak dijalankan**, bukan lulus.
> - Tes dan fixture tidak diubah di fase ini.

## 1. Capability groups

| Group | File | Tests | Browser capability | Local networking | Potential external networking | Fixture dependencies | Safety concerns (G.4.2.1) | VM-specific risks |
|---|---|---|---|---|---|---|---|---|
| ENG | `test_engine_recovery.py` | 5 | own Chrome per test (`fresh_engine`, tmp profile), plus the session `engine` for #19; SIGKILL + `recover()`; reuse of a running Chrome | CDP 127.0.0.1:<random>, `/json/version` | Chrome background (B-1) | `about:blank` | B-1, B-3 | needs the Q-1 path; `chrome_version` must start with `Chrome/` or `HeadlessChrome/`; file modes 0o700 / 0o600 (POSIX, fine on Linux); several Chrome starts in a small VM: memory and time |
| ACC | `test_account_and_capture.py` | 7 | session `engine`; `read_credits()` and `run_preflight()` **click** the fixture DOM | CDP | B-1 | `flow_like.html` (file://) | B-5 (clicks local only); `CreditSnapshot` → UNKNOWN | none beyond Q-1 |
| GRID | `test_adapter_v2_grid.py` | 6 | session `engine`; `FixtureAdapter` read-only methods | CDP | B-1, **B-2**: `<video src="https://flow.example.test/…">` | `flow_grid_v2.html` | B-2 (DNS attempt) | the media load now fails as "no nameserver / no route" instead of NXDOMAIN; the error event differs. Whether the assertions depend on it: **unknown**, observe in Stage 9 |
| UI | `test_control_ui.py` | 1 | session `engine`; fills and submits a local form; `console` / `pageerror` listeners | CDP + ControlServer 127.0.0.1:<random> | B-1 | static UI, tmp SQLite, episode files | B-6 (local writes) | `skipif(not HAVE_FFMPEG)`: `ffmpeg` and `ffprobe` must be in the guest, or the test is silently skipped |
| ADP | `test_flow_adapter.py` | 5 | session `engine`; real `GoogleFlowAgentAdapter` class | CDP | B-1; **B-4**: `_open` → `flow.google.com` exists but is unreachable from the tests | `flow_grid.html` | B-4 | if B-4 were ever reached, the VM has no route, so it fails closed (a backstop, not a substitute for the static guarantee) |
| PROBE | `test_live_probe_fixture.py` | 4 | session `engine`; `ReadOnlyPage` | CDP | B-1, **B-2**: `<video poster="https://media.example.test/…">` | `flow_probe.html` | B-2 | as GRID |
| VAL | `test_validator_and_health.py` | 14 | session `engine`; registry-driven validators; deny / credit-sensitive guards | CDP | B-1 | `flow_like.html` | B-5 | none beyond Q-1 |
| VID | `test_video_properties_fixture.py` | 1 | session `engine`; media metadata (720×1280, 8 s) | CDP | B-1 | `flow_video_props.html` → `../../docs/phase-0/evidence/media/E-FLOW-test_720p.mp4` (**H.264 High + AAC**) | — | needs **Google Chrome** (proprietary codecs); the mp4 must be staged at the same relative path (read-only copy) |

## 2. Per-test index (43)

| # | Test ID | Group |
|---|---|---|
| 1 | `test_identity_verified` | ACC |
| 2 | `test_identity_unknown_when_missing` | ACC |
| 3 | `test_credits_verified_and_panel_closed` | ACC |
| 4 | `test_credits_unavailable_when_balance_not_shown` | ACC |
| 5 | `test_credits_unknown_when_unparseable` | ACC |
| 6 | `test_capture_and_report_contain_no_personal_data` | ACC |
| 7 | `test_preflight_reads_everything_and_clicks_only_phase1_controls` | ACC |
| 8 | `test_dom_recognition_of_the_v2_grid` | GRID |
| 9–11 | `test_new_tiles_are_never_reported_finished[newvideo / newchar / legacy]` | GRID |
| 12 | `test_rendering_tile_keeps_its_progress` | GRID |
| 13 | `test_snapshot_media_lists_every_tile_kind` | GRID |
| 14 | `test_dashboard_scenes_detail_readiness_and_edit_in_the_page` | UI |
| 15 | `test_profile_and_session_are_private` | ENG |
| 16 | `test_start_reuses_running_browser` | ENG |
| 17 | `test_killed_browser_is_detected_and_recovered` | ENG |
| 18 | `test_detach_keeps_chrome_running` | ENG |
| 19 | `test_one_playwright_driver_per_process` | ENG (session `engine`) |
| 20 | `test_snapshot_and_observe_progress` | ADP |
| 21 | `test_unknown_duplicate_and_vanished_tiles` | ADP |
| 22 | `test_confirmation_states` | ADP |
| 23 | `test_reads_never_click_and_blocked_operations_touch_nothing` | ADP |
| 24 | `test_adapter_refuses_wrong_project_and_bad_ids` | ADP |
| 25 | `test_full_probe_reads_everything_without_any_interaction` | PROBE |
| 26 | `test_unexpected_dialog_and_missing_credits_stop` | PROBE |
| 27 | `test_confirmation_readable_and_unknown_cost_and_rendering` | PROBE |
| 28 | `test_guard_blocks_a_click_before_it_reaches_the_page` | PROBE |
| 29 | `test_verified_locator_is_healthy` | VAL |
| 30 | `test_ambiguous_locator_is_broken_not_guessed` | VAL |
| 31 | `test_deliberately_broken_locator_returns_broken_and_clicks_nothing` | VAL |
| 32 | `test_unverified_locator_is_untrusted_and_never_clicked` | VAL |
| 33 | `test_denied_and_credit_sensitive_elements_cannot_be_clicked` | VAL |
| 34–38 | `test_non_credit_states_are_healthy_and_left_clean[project_idle / account_dialog / ingredient_picker / tile_menu_image / agent_settings]` | VAL |
| 39 | `test_state_with_missing_param_is_skipped` | VAL |
| 40 | `test_idle_state_detects_non_empty_prompt` | VAL |
| 41 | `test_absent_rule` | VAL |
| 42 | `test_agent_settings_flags_unsafe_confirm_policy` | VAL |
| 43 | `test_probe_reads_media_properties_without_changing_playback` | VID |

The full test IDs with parameters are in `docs/phase-5.3g4.2.1/BROWSER_TEST_SAFETY_AUDIT.md` §3.

## 3. Cross-cutting topics

| Topic | Design answer | Status |
|---|---|---|
| Temporary Chrome profiles | `tmp_path_factory` / `tmp_path` inside the guest overlay disk | as in code; verify the location in Stage 6 |
| CDP port allocation | `free_port()` on guest 127.0.0.1; no conflict with the host's Blatifa Chrome (port 50568 lives in another kernel) | by design |
| Local fixture servers | ControlServer on guest 127.0.0.1 | by design |
| `file://` fixtures | staged read-only copy keeps the repository layout (`tests/fixtures/`, `docs/phase-0/evidence/media/`) | Stage 6 checks the paths |
| `.example.test` media URLs | fail locally (no resolver, `lo:53` counted) | **unchanged** in this phase; behaviour to be observed |
| Crashpad | guest-only (CHROME_SANDBOX_COMPATIBILITY §5) | verify in Stage 6 |
| Browser process cleanup | `engine.stop()` in fixtures; after the run, the guest is powered off and the overlay deleted, so leftover processes cannot persist | by design |
| Test ordering | keep the G.4.2.2 order: ENG → ACC → the rest. Batch 1 runs first because it starts and kills Chrome | plan |
| Parallel execution | **none** (no `-n`); the session `engine` is shared; 2 vCPU | plan |
| Test isolation | session `engine` shared within one pytest process, as on the host; each batch is a separate pytest process in the same booted overlay, or a fresh overlay per batch (recommended if time allows) | plan |
| Skips | **a skip counts as not executed**. PASS needs 43 executed, 0 skipped | acceptance |

## 4. Future verification steps (per group)

1. **All groups:** Q-1 decided. `DEFAULT_CHROME.exists()` is true in the guest, by the mechanism the user approved.
   `--collect-only` lists exactly 43 IDs that match G.4.2.1 §3.
2. **ENG:** the C1 command-line check repeats for every Chrome start, including after `recover()`.
3. **GRID / PROBE:** the `lo:53` counter rises during these tests and every non-`lo` counter stays 0. Record any
   failure caused by the different DNS error, and do **not** change the fixtures.
4. **UI:** `ffmpeg -version` and `ffprobe -version` are recorded in the guest before the batch.
5. **VID:** `chrome://media-internals` is not needed. The test itself asserts duration and size; H.264 support is
   confirmed by the test passing.
6. **After every batch:** counters, process list (no leftover Chrome), and the crash-data location are recorded.
