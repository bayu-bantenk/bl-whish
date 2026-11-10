# Phase 5.3g.3 — Test report

> **Ringkasan (ID):**
> - 132 tes baru, semuanya lulus.
> - Regresi penuh: **749 passed, 7 skipped, 0 failed, 0 xfailed**. 749 = 615 (5.3g.2) + 2 (bekas xfail F-2 yang
>   kini lulus) + 132 baru.
> - Semua tes lama yang relevan lulus. Assertion yang dikunci hash tidak diubah.

## Preflight

| Item | Value |
|---|---|
| Git | not a git repository → hashes instead (`evidence/baseline_hashes.txt`, 97 files, all OK before the change; all earlier phase baselines OK) |
| Resources (`evidence/resource_gate.txt`) | before: disk 13 GiB, swap 3342/4096 MB, memory free 37 %. After: 12 GiB, 4449/5120 MB, 44 %. Disk ≥ 10 GiB → full suite allowed, run **once** |

## Results

| Run | Result |
|---|---|
| `tests/unit/test_phase5_3g3_credit_contract.py` (new) | 132 passed |
| Targeted: 5.3g.3, 5.3g.2, 5.3g.1, 5.3g, 5.3f, 5.3f.1, 5.3e, `test_core`, `test_phase5_probe`, `test_production`, `test_phase5_live_evidence`, `tests/browser/test_live_probe_fixture.py` | 459 passed |
| **Full regression** `pytest tests` (`evidence/pytest_full.log`) | **749 passed, 7 skipped, 0 failed**, 420 s, exit 0 |
| Skipped | 7 × `tests/live/test_flow_live.py` (opt-in `BLATIFA_LIVE=1`, not set) |
| `ruff check src` + new or changed tests | all checks passed |

## Coverage (brief §8)

| Requirement | Test(s) in `test_phase5_3g3_credit_contract.py` |
|---|---|
| valid integer / label | `test_valid_balances` (9 cases, both contexts) |
| empty | `test_empty_is_missing` |
| malformed, repeated separators | `test_malformed_numbers_are_invalid_in_every_context` (21 numbers × 2 contexts × with/without label): `50.5.5`, `5,0,0`, `50..0`, `50,,0`, `1,25`, `050`, `+50`, `1e3`, … |
| negative | `test_negative_is_invalid` (`-`, `−`, `-0`) |
| ambiguous | `test_dot_grouping_is_ambiguous_never_a_number` |
| unrelated text, unknown format, non-ASCII digits | `test_unrelated_or_unknown_text_is_never_a_balance_in_page_text`, `test_proven_source_still_rejects_sentences_and_non_ascii_digits` |
| numeric text from non-balance elements | `test_numeric_text_from_non_balance_elements_is_not_present` |
| no strip-and-join | `test_parser_has_no_strip_and_join_shortcut`; `test_parse_result_cannot_carry_a_value_unless_valid` |
| user-reported never verified | `test_user_reported_is_never_verified`; `test_contract_refuses_mixed_or_unsupported_provenance` |
| open panel ≠ without interaction | `test_already_open_panel_is_observed_never_without_interaction`; `test_dialog_cases_are_unavailable` |
| missing / invalid stays unavailable | `test_missing_invalid_or_multiple_values_stay_unavailable`; `test_unreadable_tree_is_unavailable` |
| historical balance not current | `test_historical_or_future_balance_is_not_current`; `test_no_previous_balance_is_reused_and_no_state_is_kept` |
| no implicit fallback | `test_gate_has_no_default_or_fallback_balance`; `test_everything_but_verified_is_credit_unknown` (including `None`) |
| gate: verified processed by existing rules | `test_fresh_verified_balance_goes_through_the_existing_rules` (allowed; low balance → `INSUFFICIENT_CREDIT`) |
| gate: user-reported / observed / unavailable rejected | `test_everything_but_verified_is_credit_unknown` → `CREDIT_UNKNOWN` |
| approval gate unchanged | `test_approval_gate_unchanged_and_fail_closed_without_balance` |
| live-probe stop rule | `test_live_probe_stop_rule_still_fires_for_every_non_verified_status`; `test_probe_still_stops_on_the_open_account_panel` |
| F-1 untouched, not exercised | `test_read_credits_click_path_is_unchanged_and_not_exercised` |
| purity, flags, protected files | `test_new_contract_code_is_pure`; `test_flags_registry_and_protected_files` |
| nonce binding, manual attestation, strict handoff | their existing suites (5.3f: 43, 5.3f.1: 33, 5.3g.1: 32, 5.3e) pass; source files hash-equal |

## Existing tests

- Unchanged and passing, including all old credit assertions: `test_core.py::test_parse_credits` (`"1,250 …" → 1250`,
  `"40 credits" → None`), `test_phase5_probe.py` (exact legacy dict), `test_phase5_live_evidence.py`,
  `test_production.py`, `tests/browser/test_live_probe_fixture.py`.
- Changed (documented in `IMPLEMENTATION_REPORT.md` §5, diff in `evidence/test_changes.diff`):
  - `test_phase5_3g_preflight.py`, `test_phase5_3g1_manual_submission.py`: hash line only;
  - `test_phase5_3g2_credit_discovery.py`: hash line, F-2 `xfail` removed, and the two open-panel asserts made
    stricter (F-3).

## Protected hashes

| Set | Result |
|---|---|
| 5.3g.3 baseline (97 files) | 91 equal; 6 differ, each exactly as listed in `evidence/approved_changes.txt` |
| 5.3e / 5.3f / 5.3f.1 baselines, 5.3f.1 test baseline | all equal |
| 5.3f test baseline | all equal except `test_phase5_3e_handoff.py`: a pre-existing 5.3f.1 change, already superseded by the 5.3f.1 test baseline (which it matches). Not touched in 5.3g.3. |
| 5.3g / 5.3g.1 baselines | all equal except `live_probe.py` (approved) |
| 5.3g.2 baseline (80) | 78 equal; `live_probe.py`, `reader.py` approved |
| `docs/phase-5.3g1/**`, `docs/phase-5.3g2/**` | all equal |
| `p53g.db` | equal before / after |
