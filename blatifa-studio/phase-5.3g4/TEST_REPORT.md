# Phase 5.3g.4 — Test report

> **Ringkasan (ID):**
> - 47 tes baru, semuanya lulus.
> - Regresi penuh: **796 passed, 7 skipped, 0 failed**. 796 = 749 (5.3g.3) + 47.
> - Hanya satu assertion lama yang diubah, dan perubahannya justru lebih ketat. Alasannya ada di
>   `IMPLEMENTATION_REPORT.md` §4.

## Preflight

| Item | Value |
|---|---|
| Git | not a git repository → hashes (`evidence/baseline_hashes.txt`, 289 files: all `src`/`tests` Python files, fixtures, the locator registry and all `docs/phase-5.3*` files) |
| Resources (`evidence/resource_gate.txt`) | before: disk 12 GiB, swap 4412/5120 MB, memory free 40 %. After: 12 GiB, 5034/6144 MB, 42 %. Disk ≥ 10 GiB → full suite allowed, run **once** |

## Results

| Run | Result |
|---|---|
| `tests/unit/test_phase5_3g4_credit_paths.py` (new) | 47 passed |
| Targeted: 5.3g.4, 5.3g.3, 5.3g.2, 5.3g.1, 5.3g, 5.3f, 5.3f.1, 5.3e, `test_production`, `test_core`, `test_phase5_probe`, `tests/browser/test_account_and_capture.py` | 502 passed |
| **Full regression** `pytest tests` (`evidence/pytest_full.log`) | **796 passed, 7 skipped, 0 failed**, 419 s, exit 0 |
| Skipped | 7 × `tests/live/test_flow_live.py` (opt-in `BLATIFA_LIVE=1`, not set) |
| `ruff check src` + new or changed tests | all checks passed |

## Coverage (brief Stage D)

| Requirement | Test |
|---|---|
| legacy `read_credits()` output cannot bypass `credit_evidence()` | `test_legacy_read_credits_output_cannot_pass_credit_evidence` (5 snapshots, including VERIFIED 10 000; even a simulated adapter refuses them) |
| `blatifa preflight` cannot authorize on click-derived evidence | `test_run_preflight_cannot_authorize_from_a_click_derived_balance`, `test_blatifa_preflight_command_blocks_on_click_derived_evidence` (fake engine, page and readers); browser fixture test → `[CREDIT_UNKNOWN]` |
| `blatifa account` diagnostics do not imply authorization | `test_blatifa_account_diagnostics_never_imply_authorization` (output and report JSON `granted: false`, no e-mail in the report) |
| USER_REPORTED / OBSERVED_IN_ALREADY_OPEN_PANEL stay unverified | `test_user_reported_and_observed_panel_stay_unverified_even_for_simulation`; runner case with `user_reported("10000")` |
| missing, stale, future, malformed, ambiguous, wrong types fail closed | `test_everything_but_a_fresh_verified_reading_fails_closed` (21 inputs × `credit_evidence`, `approval_balance`, `approval_gate`, `preflight_gate`) |
| verified evidence follows the existing rules | `test_a_fresh_verified_reading_follows_the_existing_rules`; runner approves with a fresh reading |
| every production path reaches the boundary | `test_call_graph_of_every_credit_decision`, `test_gate_inputs_come_only_from_the_boundary` |
| simulation values cannot enter production | `test_only_simulated_flow_and_out_of_package_doubles_count_as_simulation`, `test_bare_numbers_never_reach_approval_for_a_live_adapter`, `test_runner_refuses_a_bare_number_for_a_live_adapter_and_accepts_fresh_evidence`, `test_simulation_defaults_stay_inside_the_simulate_branch` |
| gate rules unchanged | `test_preflight_and_approval_rules_are_unchanged` (source sha256 = pre-5.3g.3 text) |
| approved-change integrity | `test_integrity_roots_are_pinned_independently`, `test_manifest_cannot_approve_itself_the_helper_or_a_baseline`, `test_tampered_or_conflicting_manifest_is_refused` |
| G.1 / G.2 / G.3 protections | `test_historical_baseline_files_and_experiment_inputs_are_unchanged`, `test_every_protected_file_matches_its_5_3g4_baseline_or_an_approved_change`, `test_flags_and_protections`; all G.1–G.3 suites pass |

## Existing tests

- Changed assertion: one. In `tests/browser/test_account_and_capture.py`, `assert rep.gate.allowed` became
  `assert rep.gate.blocks == [Block.CREDIT_UNKNOWN]`, plus a check that the diagnostic is still visible.
- Changed helper: `tests/unit/protected_hashes.py` (hardened; diff in `evidence/test_changes.diff`). Every caller keeps
  the same `matches(path, digest)` call.
- Everything else is unchanged, including all hash-locked 5.3f / 5.3f.1 tests and all 5.3g … 5.3g.3 test files.

## Protected hashes (after)

| Set | Result |
|---|---|
| 5.3g.4 baseline (289 files) | 283 equal; 5 differ, each exactly as in `evidence/approved_changes.txt` (`cli.py`, `gates.py`, `preflight.py`, `runner.py`, `test_account_and_capture.py`); 1 integrity root (`protected_hashes.py`, pinned in the 5.3g.4 test) |
| 10 historical baseline files + 5.3g.3 manifest | equal (`evidence/historical_baseline_files.txt`; its only other line is the helper's 5.3g.3 hash `bdfb8808…`, superseded as documented) |
| `docs/phase-5.3g1/**`, `5.3g2/**`, `5.3g3/**` | byte-identical |
| `p53g.db`, FINAL_PROMPT, BASE_PROMPT | identical before and after |
| `LIVE_ACTIONS_ACTIVE`, `deny: true` | False, 18 (before = after) |
