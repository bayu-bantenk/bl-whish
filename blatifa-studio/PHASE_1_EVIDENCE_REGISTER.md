# Phase 1 Evidence Register

> **Ringkasan (ID):** Daftar bukti Phase 1. Setiap klaim VERIFIED punya bukti nyata: output test, log uji langsung, atau laporan yang dihasilkan aplikasi. Semua file bukti ada di `docs/phase-1/evidence/` dan sudah dipindai: tidak ada email, nama akun, token, maupun cookie.

Paths are relative to `docs/phase-1/evidence/`. Live = real Google Flow, dedicated profile `main`, the user's own account. Times are WIB (UTC+7).

## 1. Acceptance gate evidence

| ID | Gate | Claim | Status | Evidence |
|---|---|---|---|---|
| E-P1-01 | 1, 2 | Chrome 156 launched by `blatifa browser start` with the new, empty profile `~/BlatifaStudio/profiles/main/chrome` (mode 700). The user signed in manually and reported no warning | VERIFIED (live) | conversation log 15:20–15:23. `browser status` showed `url=https://accounts.google.com/v3/signin/identifier` before login and the project URL after login |
| E-P1-02 | 3 | Playwright attaches through CDP (127.0.0.1, random port 58082); browser HEALTHY | VERIFIED (live) | `logs/live_gate6_gate7.log`, `reports/*-health/health.md` header |
| E-P1-03 | 5 | Live inspection: top-bar `Settings` lives in `flow-tile-view-header`, composer `Settings` in `flow-creative-agent-prompt-box`. This was the basis for upgrading `composer.agent_settings` to VERIFIED | VERIFIED (live) | `inspections/project-idle.elements.json` (custom_ancestors) |
| E-P1-04 | 4 | Identity VERIFIED (fingerprint `d6c9f4583fa6`). Credits VERIFIED: balance 40, "Credits refresh daily at 3:37 PM" | VERIFIED (live, 4 reads) | `reports/20261102T083003Z-account/`, `reports/20261102T083059Z-account/`, `logs/pytest_live.log` |
| E-P1-05 | 5 | All 6 non-credit states HEALTHY: project_idle, account_dialog, ingredient_picker, agent_settings, tile_menu_image, media_detail_video. agent_settings confirms "Confirm before generating = Always" is checked | VERIFIED (live; CLI and pytest -m live) | `reports/20261102T083017Z-health/health.md`, `logs/pytest_live.log` (7 passed) |
| E-P1-06 | 6 | A deliberately broken locator (`"Account detailz"`) returns BROKEN (`unique not found`) at validation, exit 2. The account dialog was not opened (0 dialogs), so nothing was clicked | VERIFIED (live and fixture) | `logs/live_gate6_gate7.log` §Gate 6, `reports/20261102T083046Z-health/health.md`, test `test_deliberately_broken_locator_returns_broken_and_clicks_nothing` (asserts zero recorded clicks) |
| E-P1-07 | 7 | `kill -9` of Chrome → `PROCESS_DEAD` detected → `browser recover` → HEALTHY on the same project URL. Login persisted (identity + credits VERIFIED right after). Performed twice (restarts=1, then 2) | VERIFIED (live and fixture) | `logs/live_gate6_gate7.log` §Gate 7, test `test_killed_browser_is_detected_and_recovered` |
| E-P1-08 | 8 | No credits spent: balance 40 at the first read (15:24) and the last read (15:31). No generation, upload or approval action was performed. The code cannot perform them (guard + static test) | VERIFIED | `reports/*-account/account.md`, `logs/credits_after_phase1.log`, `logs/pytest_full.log` |
| E-P1-09 | 9 | Every report, snapshot and log in the evidence folder and workspace was scanned for e-mail, `%40`, account name, OAuth/Bearer tokens and Google cookie names: 0 matches. The screenshot masks the avatar/account area (checked visually). Reports carry only a 12-hex fingerprint | VERIFIED | scan output in this session; `reports/20261102T083018Z-inspect/project-idle-final.png`; tests `test_capture_and_report_contain_no_personal_data`, redaction unit tests |
| E-P1-10 | 10 | Full suite: **62 passed, 7 skipped** (the 7 live tests are opt-in). Live suite: **7 passed**. `ruff check`: all checks passed | VERIFIED | `logs/pytest_full.log`, `logs/pytest_live.log`, `logs/ruff.log` |

## 2. Supporting evidence

| ID | Claim | Status | Evidence |
|---|---|---|---|
| E-P1-11 | The personal Chrome data dir (and anything inside it) is refused | VERIFIED (unit) | `test_personal_chrome_profile_is_refused` |
| E-P1-12 | Chrome args bind CDP to 127.0.0.1 and contain no automation flags | VERIFIED (unit) | `test_chrome_args_bind_localhost_and_no_automation_flags` |
| E-P1-13 | Source contains no cookie/storage/upload/network-interception/typing/coordinate APIs | VERIFIED (static) | `test_source_never_uses_prohibited_browser_apis` |
| E-P1-14 | Registry schema rejects: missing fields, unknown fields, dangling refs, VERIFIED without evidence, undeclared params, Angular hash selectors, inline regex flags | VERIFIED (unit) | `test_registry_rejects_invalid_definitions` |
| E-P1-15 | Ambiguous locator (two "Account details") → BROKEN "ambiguous: 2 matches"; no guessing | VERIFIED (fixture) | `test_ambiguous_locator_is_broken_not_guessed` |
| E-P1-16 | Unsafe agent setting ("Never") is detected as BROKEN | VERIFIED (fixture) | `test_agent_settings_flags_unsafe_confirm_policy` |
| E-P1-17 | Credit read statuses: VERIFIED / UNKNOWN (unparseable) / UNAVAILABLE (no balance), with the panel closed afterwards | VERIFIED (fixture). Live: VERIFIED only | `tests/browser/test_account_and_capture.py` |
| E-P1-18 | UI change detection: live baseline vs current = 0 removed, 0 added | VERIFIED (live) | `reports/20261102T083018Z-inspect/report.md` |
| E-P1-19 | Profile dir 700, session file 600, workspace root 700 | VERIFIED (test and `ls -ld`) | `test_profile_and_session_are_private` |
| E-P1-20 | `detach()` keeps Chrome running and allows re-attach | VERIFIED (fixture) | `test_detach_keeps_chrome_running` |

## 3. Observations (not caused by Blatifa)

| ID | Observation | Notes |
|---|---|---|
| O-P1-01 | Free disk fell 11 GiB → 7.5 GiB → 4.8 GiB during the day | Blatifa's footprint is < 0.6 GiB. Another process is consuming space |
| O-P1-02 | The Flow project now contains a pink octopus media item and an "Uploads" nav entry that were not present in Phase 0 | Not created by Blatifa: the code cannot upload, and the balance was unchanged. Presumably added by the user |

## 4. Not verified in Phase 1

| Item | Status | Reason |
|---|---|---|
| Insufficient-credit / session-expired DOM | UNVERIFIED | Not reachable without spending credits or signing out |
| Minimised-window behaviour | UNVERIFIED | Not required in Phase 1 |
| Health of credit-sensitive states (cost confirmation) | NOT IN SCOPE | Needs a generation (Phase 2) |
| Right-click tile menu, tile Download submenu | UNVERIFIED | Not needed in Phase 1 |
