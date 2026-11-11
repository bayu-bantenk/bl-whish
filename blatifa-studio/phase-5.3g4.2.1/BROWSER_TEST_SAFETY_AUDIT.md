# Phase 5.3g.4.2.1: browser fixture test safety audit (static)

> **Ringkasan (ID):** Audit statis atas 43 tes di `tests/browser/` beserta dependency-nya.
> - **0 UNSAFE**, **0 SAFE**, **43 UNKNOWN**.
> - Tidak ada jalur ke Google Flow, profil pengguna, credential, live action, atau DB eksperimen yang ditemukan.
> - Alasan semua tes UNKNOWN hanya satu kriteria: **jaringan eksternal**. Chrome diluncurkan tanpa flag yang
>   mematikan *background networking*, dan 10 tes memuat URL ke host `.test` (cadangan, tidak bisa di-resolve).
> - **Belum ada tes browser yang dijalankan.**

## 1. Method

Static only:
- read every test file, `tests/browser/conftest.py` and the fixtures `tests/fixtures/*.html`;
- read the dependencies: `browser/engine.py`, `browser/chrome.py`, `config.py`, `flow/adapter.py`,
  `flow/live_probe.py`, `inspector/actions.py`, `account/reader.py`, `production/preflight.py`, `ui/server.py`,
  `ui/static/*`, `tests/unit/p4_helpers.py`, `simflow.py`, and the registry states via `load_registry()`;
- count the 43 tests from the AST, without pytest.

No pytest, no browser, no network request.

## 2. Browser isolation (applies to all 43 tests)

| Check | Evidence | Result |
|---|---|---|
| Browser | `conftest.engine`: `BrowserEngine(Settings(workspace=tmp_path_factory.mktemp("ws")), "test", headless=True)`; `test_engine_recovery.fresh_engine`: same with `tmp_path` | the local Google Chrome at `DEFAULT_CHROME` (or `BLATIFA_CHROME`, see §4), **headless** (`--headless=new`) |
| Profile | `profile_dir = <tmp>/profiles/<id>/chrome` (`config.Settings.profile_dir`); `launch()` calls `assert_profile_allowed`, which refuses `~/Library/Application Support/Google/Chrome` | **fresh, empty temporary profile**: no cookies, no sign-in, no storage of the user or of the dedicated Blatifa profile (`~/BlatifaStudio/profiles/...` is never used, because the workspace is explicit) |
| CDP | `free_port()` binds `127.0.0.1:0`, Chrome listens on `--remote-debugging-address=127.0.0.1`; `attach()` uses `connect_over_cdp("http://127.0.0.1:<port>")` with the port from the **tmp** session file `<tmp>/run/<id>.json` | attaches only to the Chrome this fixture launched; a fresh tmp workspace has no old session file, so a running dedicated Chrome cannot be reused |
| `launch_persistent_context`, `storage_state`, `route`, `expect_request`, API request context | not used anywhere in `tests/browser` or the engine | none |
| Event listeners | `test_control_ui` listens to `console`/`pageerror` only | no network listener |
| Downloads | no download call; `adapter.download` raises `BlockedOperationError` | none |
| Navigation | tests: `page.goto("about:blank")`, `page.goto(<fixture>.as_uri())`, `page.goto(ui.url)` (127.0.0.1). Code paths that can reach Flow: `GoogleFlowAgentAdapter._open` (only from `stored_prompt`) and `inspector.actions.perform` step `goto_param` (only the registry state `media_detail_video`) | **not reached**: the only `stored_prompt` call uses `"../../etc"`, which the UUID check refuses before `_open`; no browser test uses `media_detail_video` or `goto_param` |
| Live / write operations | `attach_start_image`, `submit`, `approve`, `reject` and `download` of `GoogleFlowAgentAdapter` raise `BlockedOperationError` before touching the page; `perform()` refuses `deny` / credit-sensitive targets (`assert_click_allowed`) | none reachable |
| `blatifa account` / `preflight` CLI, `cli` module | no browser test imports `blatifa.cli` (checked, together with `p4_helpers`, `simflow`, `episode_factory`) | not invoked |
| Experiment DB / workspace | `EXPERIMENT_DB` is referenced only in `cli.py`; `Settings()` without a workspace is constructed only in `cli.py`. Tested writers (`capture`, `write_report`, UI `Store`, episodes) write to `tmp_path` | no access to `p53g.db` or `~/BlatifaStudio` |

## 3. Per-test table

\* *Chrome background networking.* `chrome.build_args` passes no `--disable-background-networking`,
`--disable-component-update`, `--disable-sync`, `--no-pings` or `--host-resolver-rules`. A Chrome process with a
fresh profile normally contacts Google services on its own (component updates, Safe Browsing lists, variations,
optimization hints). This cannot be ruled out statically. It is not caused by the tests, involves no Flow page and
no account, and cannot consume credits. It is still external network traffic, so under the brief's definition no
test can be classified SAFE.

| # | Test ID | Source file | Browser fixture | Page source | Network access | Flow access | Profile access | Live adapter | Database mutation | Verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `test_identity_verified` | `test_account_and_capture.py` | `engine` (session) + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 2 | `test_identity_unknown_when_missing` | `test_account_and_capture.py` | `engine` (session) + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 3 | `test_credits_verified_and_panel_closed` | `test_account_and_capture.py` | `engine` (session) + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 4 | `test_credits_unavailable_when_balance_not_shown` | `test_account_and_capture.py` | `engine` (session) + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 5 | `test_credits_unknown_when_unparseable` | `test_account_and_capture.py` | `engine` (session) + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 6 | `test_capture_and_report_contain_no_personal_data` | `test_account_and_capture.py` | `engine` (session) + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 7 | `test_preflight_reads_everything_and_clicks_only_phase1_controls` | `test_account_and_capture.py` | `engine` (session) + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 8 | `test_dom_recognition_of_the_v2_grid` | `test_adapter_v2_grid.py` | `engine` + `v2` | `flow_grid_v2.html` (file://) | Chrome background* + `<video src>` → `flow.example.test` (reserved .test, DNS attempt) | none | none (tmp profile) | `FixtureAdapter` (subclass of the live adapter); read-only methods only | none (tmp_path files only) | **UNKNOWN** (network) |
| 9 | `test_new_tiles_are_never_reported_finished['newvideo']` | `test_adapter_v2_grid.py` | `engine` + `v2` | `flow_grid_v2.html` (file://) | Chrome background* + `<video src>` → `flow.example.test` (reserved .test, DNS attempt) | none | none (tmp profile) | `FixtureAdapter` (subclass of the live adapter); read-only methods only | none (tmp_path files only) | **UNKNOWN** (network) |
| 10 | `test_new_tiles_are_never_reported_finished['newchar']` | `test_adapter_v2_grid.py` | `engine` + `v2` | `flow_grid_v2.html` (file://) | Chrome background* + `<video src>` → `flow.example.test` (reserved .test, DNS attempt) | none | none (tmp profile) | `FixtureAdapter` (subclass of the live adapter); read-only methods only | none (tmp_path files only) | **UNKNOWN** (network) |
| 11 | `test_new_tiles_are_never_reported_finished['legacy']` | `test_adapter_v2_grid.py` | `engine` + `v2` | `flow_grid_v2.html` (file://) | Chrome background* + `<video src>` → `flow.example.test` (reserved .test, DNS attempt) | none | none (tmp profile) | `FixtureAdapter` (subclass of the live adapter); read-only methods only | none (tmp_path files only) | **UNKNOWN** (network) |
| 12 | `test_rendering_tile_keeps_its_progress` | `test_adapter_v2_grid.py` | `engine` + `v2` | `flow_grid_v2.html` (file://) | Chrome background* + `<video src>` → `flow.example.test` (reserved .test, DNS attempt) | none | none (tmp profile) | `FixtureAdapter` (subclass of the live adapter); read-only methods only | none (tmp_path files only) | **UNKNOWN** (network) |
| 13 | `test_snapshot_media_lists_every_tile_kind` | `test_adapter_v2_grid.py` | `engine` + `v2` | `flow_grid_v2.html` (file://) | Chrome background* + `<video src>` → `flow.example.test` (reserved .test, DNS attempt) | none | none (tmp profile) | `FixtureAdapter` (subclass of the live adapter); read-only methods only | none (tmp_path files only) | **UNKNOWN** (network) |
| 14 | `test_dashboard_scenes_detail_readiness_and_edit_in_the_page` | `test_control_ui.py` | `engine` + `ui` (ControlServer) | `http://127.0.0.1:<port>` (local UI, CSP: no external resource) | local 127.0.0.1 + Chrome background* | none | none (tmp profile) | none | tmp_path only (UI SQLite + episode files) | **UNKNOWN** (network) |
| 15 | `test_profile_and_session_are_private` | `test_engine_recovery.py` | `fresh_engine` (own tmp profile) / `engine` | `about:blank` | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 16 | `test_start_reuses_running_browser` | `test_engine_recovery.py` | `fresh_engine` (own tmp profile) / `engine` | `about:blank` | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 17 | `test_killed_browser_is_detected_and_recovered` | `test_engine_recovery.py` | `fresh_engine` (own tmp profile) / `engine` | `about:blank` | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 18 | `test_detach_keeps_chrome_running` | `test_engine_recovery.py` | `fresh_engine` (own tmp profile) / `engine` | `about:blank` | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 19 | `test_one_playwright_driver_per_process` | `test_engine_recovery.py` | `fresh_engine` (own tmp profile) / `engine` | `about:blank` | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 20 | `test_snapshot_and_observe_progress` | `test_flow_adapter.py` | `engine` + `adapter` | `flow_grid.html` (file://) | Chrome background only* | none | none (tmp profile) | class `GoogleFlowAgentAdapter` used; navigation unreachable, write ops raise `BlockedOperationError` | none (tmp_path files only) | **UNKNOWN** (network) |
| 21 | `test_unknown_duplicate_and_vanished_tiles` | `test_flow_adapter.py` | `engine` + `adapter` | `flow_grid.html` (file://) | Chrome background only* | none | none (tmp profile) | class `GoogleFlowAgentAdapter` used; navigation unreachable, write ops raise `BlockedOperationError` | none (tmp_path files only) | **UNKNOWN** (network) |
| 22 | `test_confirmation_states` | `test_flow_adapter.py` | `engine` + `adapter` | `flow_grid.html` (file://) | Chrome background only* | none | none (tmp profile) | class `GoogleFlowAgentAdapter` used; navigation unreachable, write ops raise `BlockedOperationError` | none (tmp_path files only) | **UNKNOWN** (network) |
| 23 | `test_reads_never_click_and_blocked_operations_touch_nothing` | `test_flow_adapter.py` | `engine` + `adapter` | `flow_grid.html` (file://) | Chrome background only* | none | none (tmp profile) | class `GoogleFlowAgentAdapter` used; navigation unreachable, write ops raise `BlockedOperationError` | none (tmp_path files only) | **UNKNOWN** (network) |
| 24 | `test_adapter_refuses_wrong_project_and_bad_ids` | `test_flow_adapter.py` | `engine` + `adapter` | `flow_grid.html` (file://) | Chrome background only* | none | none (tmp profile) | class `GoogleFlowAgentAdapter` used; navigation unreachable, write ops raise `BlockedOperationError` | none (tmp_path files only) | **UNKNOWN** (network) |
| 25 | `test_full_probe_reads_everything_without_any_interaction` | `test_live_probe_fixture.py` | `engine` + `open_probe` | `flow_probe.html` (file://) | Chrome background* + `<video poster>` → `media.example.test` (reserved .test, DNS attempt) | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 26 | `test_unexpected_dialog_and_missing_credits_stop` | `test_live_probe_fixture.py` | `engine` + `open_probe` | `flow_probe.html` (file://) | Chrome background* + `<video poster>` → `media.example.test` (reserved .test, DNS attempt) | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 27 | `test_confirmation_readable_and_unknown_cost_and_rendering` | `test_live_probe_fixture.py` | `engine` + `open_probe` | `flow_probe.html` (file://) | Chrome background* + `<video poster>` → `media.example.test` (reserved .test, DNS attempt) | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 28 | `test_guard_blocks_a_click_before_it_reaches_the_page` | `test_live_probe_fixture.py` | `engine` + `open_probe` | `flow_probe.html` (file://) | Chrome background* + `<video poster>` → `media.example.test` (reserved .test, DNS attempt) | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 29 | `test_verified_locator_is_healthy` | `test_validator_and_health.py` | `engine` + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 30 | `test_ambiguous_locator_is_broken_not_guessed` | `test_validator_and_health.py` | `engine` + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 31 | `test_deliberately_broken_locator_returns_broken_and_clicks_nothing` | `test_validator_and_health.py` | `engine` + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 32 | `test_unverified_locator_is_untrusted_and_never_clicked` | `test_validator_and_health.py` | `engine` + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 33 | `test_denied_and_credit_sensitive_elements_cannot_be_clicked` | `test_validator_and_health.py` | `engine` + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 34 | `test_non_credit_states_are_healthy_and_left_clean[('project_idle', {}, [])]` | `test_validator_and_health.py` | `engine` + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 35 | `test_non_credit_states_are_healthy_and_left_clean[('account_dialog', {}, ['Account details', 'Close account panel'])]` | `test_validator_and_health.py` | `engine` + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 36 | `test_non_credit_states_are_healthy_and_left_clean[('ingredient_picker', {}, ['Add ingredients to the prompt box'])]` | `test_validator_and_health.py` | `engine` + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 37 | `test_non_credit_states_are_healthy_and_left_clean[('tile_menu_image', {'image_tile': 'Blumaro'}, ['More options'])]` | `test_validator_and_health.py` | `engine` + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 38 | `test_non_credit_states_are_healthy_and_left_clean[('agent_settings', {}, ['Settings', 'Back'])]` | `test_validator_and_health.py` | `engine` + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 39 | `test_state_with_missing_param_is_skipped` | `test_validator_and_health.py` | `engine` + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 40 | `test_idle_state_detects_non_empty_prompt` | `test_validator_and_health.py` | `engine` + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 41 | `test_absent_rule` | `test_validator_and_health.py` | `engine` + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 42 | `test_agent_settings_flags_unsafe_confirm_policy` | `test_validator_and_health.py` | `engine` + `open_fixture` | `flow_like.html` (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |
| 43 | `test_probe_reads_media_properties_without_changing_playback` | `test_video_properties_fixture.py` | `engine` | `flow_video_props.html` + local mp4 (file://) | Chrome background only* | none | none (tmp profile) | none | none (tmp_path files only) | **UNKNOWN** (network) |

Totals: **43** tests (7 + 6 + 1 + 5 + 5 + 4 + 14 + 1), **SAFE 0, UNSAFE 0, UNKNOWN 43**.

## 4. Findings

| # | Finding | Severity | Tests |
|---|---|---|---|
| B-1 | Chrome is launched without background-networking flags, so external traffic by Chrome itself is possible and cannot be excluded statically | blocks SAFE (network) | all 43 |
| B-2 | `<video src="https://flow.example.test/…">` (flow_grid_v2) and `<video poster="https://media.example.test/…">` (flow_probe): the page makes Chrome resolve hosts under the reserved `.test` TLD (RFC 6761, never resolvable), which normally causes a DNS lookup that leaves the machine (unless answered from a cache) | low (no host can answer), but external | 6 (`test_adapter_v2_grid.py`) + 4 (`test_live_probe_fixture.py`) |
| B-3 | `Settings.chrome_path` reads `BLATIFA_CHROME`; if it were set, another binary would be launched. It is **unset** in this session | precondition | all 43 |
| B-4 | `test_flow_adapter.py` instantiates the real `GoogleFlowAgentAdapter`. Navigation to `https://flow.google.com/` exists in `_open`, but no test reaches it (§2); if a future test passed a valid UUID to `stored_prompt`, the fixture Chrome would load the real Flow URL, unauthenticated | attention | 5 |
| B-5 | `read_credits()` and `run_preflight()` run for real and **click** (`Account details`, `Close account panel`, `Settings`, `Back`) — on the local fixture DOM only; clicks are recorded by fixture JS (`window.__clicks`) | attention (local) | `test_account_and_capture.py` (5 of 7), `test_validator_and_health.py` |
| B-6 | `test_control_ui` fills and submits a form — on the local 127.0.0.1 control UI; it writes to the tmp episode and tmp SQLite only | attention (local) | 1 |
| B-7 | No test uses the user's Chrome profile, the dedicated Blatifa profile, cookies, tokens, storage, `connect_over_cdp` to a foreign Chrome, interception, or a Flow URL | — | all 43 |

## 5. What would make the network criterion provable (not done, needs approval)

1. **Run-time isolation, no code change:** run only `tests/browser` inside a macOS `sandbox-exec` profile that denies
   outbound network except loopback, or with networking switched off. CDP, file:// and 127.0.0.1 keep working;
   Chrome's background traffic and the `.test` lookups fail locally. An offline run log plus a recorded network
   policy would be the evidence.
2. **Code change (a later phase):** test-only Chrome arguments, e.g. `--host-resolver-rules="MAP * ~NOTFOUND,
   EXCLUDE 127.0.0.1"`, `--disable-background-networking`, `--disable-component-update`, `--no-pings`; and replace
   the two `.test` URLs with `data:` URIs.
