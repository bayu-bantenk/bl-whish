# Phase 5.3g.2 — Test report

> **Ringkasan (ID):** 20 tes baru: 18 lulus, 2 `xfail` yang sengaja mendokumentasikan temuan F-2. Regresi penuh:
> 615 passed, 7 skipped, 2 xfailed, 0 gagal. Kode produksi tidak berubah.

## Preflight

| Item | Value |
|---|---|
| Git status | not a git repository (no `.git`), so uncommitted changes cannot be listed. All 5.3g.1 baseline and post-change hashes were checked instead: **all OK** before starting. That includes `test_phase5_3f_nonce_binding.py`, which matches its recorded 5.3f.1 post-change hash (`a70ca8d7…`). |
| Protected baseline | `evidence/baseline_hashes.txt`, 80 files: the 5.3g.1 baseline (54), all `docs/phase-5.3g1` files, `cli.py`, `handoff.py`, `manual_submission.py`, `live_probe.py`, `account/reader.py`, `browser/engine.py`, `inspector/validator.py` |
| Resources (`evidence/resource_gate.txt`) | before: disk 14.58 GiB, swap 2079/3072 MB, memory free 34 %. After: 14.51 GiB, 2636/3072 MB, 40 %. Disk ≥ 10 GiB → full suite allowed, run **once**. |

## Results

| Run | Result |
|---|---|
| `tests/unit/test_phase5_3g2_credit_discovery.py` (new) | 18 passed, 2 xfailed (strict) |
| **Full regression** `pytest tests` (`evidence/pytest_full.log`) | **615 passed, 7 skipped, 2 xfailed, 0 failed**, 414 s, exit 0. 615 = 597 (5.3g.1) + 18. |
| Skipped | 7 × `tests/live/test_flow_live.py` (opt-in `BLATIFA_LIVE=1`) |
| `ruff check` (new test + tool) | all checks passed |
| Protected hashes after the run | 80/80 unchanged |

No existing test was changed. No test drives a browser: all fixtures are parsed ARIA text, and the guard test uses
a fake page.

## Coverage (brief §6)

| Requirement | Test |
|---|---|
| Missing balance stays unavailable | `test_closed_account_panel_gives_no_balance` |
| Malformed balance stays unavailable | `test_unrelated_or_malformed_text_is_never_a_balance` (10 cases pass). **Exception:** `test_malformed_digit_grouping_should_be_unavailable` (2 cases) is `xfail(strict=True)` and documents F-2. It will turn into a failure once the parser is fixed, so the mark must then be removed. |
| Unrelated numeric text is never a balance | same parametrized test ("50 credits", "Costing 10 credits", "12 tiles", "50", …) |
| A user-reported balance is never verified | `test_user_reported_balance_has_no_entry_point` |
| No previous balance reused | `test_no_previous_balance_is_reused` |
| No fallback guess | `test_two_different_balances_are_ambiguous_not_guessed` |
| No browser interaction | `test_read_only_page_refuses_the_account_panel_click`, `test_discovery_tool_uses_only_read_operations` |
| Identity verification unchanged | baseline hashes (`live_probe.py`, `account/reader.py`, `validator.py`) in `test_stop_reason_and_identity_reader_unchanged` |
| Stop reason unchanged | same test (source of `cmd_live_probe`) |
| An open panel's balance is never usable from `probe()` | `test_balance_appears_only_inside_the_open_account_dialog_and_that_dialog_stops_the_probe` |

## Changed files

New only:
- `docs/phase-5.3g2/` (5 reports, `tools/credit_dom_discovery.py`, `evidence/`);
- `tests/unit/test_phase5_3g2_credit_discovery.py`.

Hashes of the new files: `evidence/new_files_hashes.txt`. Production code: none changed.
