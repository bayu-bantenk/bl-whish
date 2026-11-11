# Phase 5.3g.4.2: test report

> **Ringkasan (ID):**
> - 79 tes baru lulus.
> - Regresi offline: **970 passed, 7 skipped, 0 failed** (exit 0, 977 collected).
> - `tests/browser` (43 tes) **sengaja tidak dijalankan**, karena brief melarang koneksi browser Playwright/CDP.
> - Mutation test tidak dijalankan; statusnya tetap `MUTATION EVIDENCE NOT INDEPENDENTLY VERIFIED`.

## 1. Resources (`evidence/resource_and_flags_before.txt`)

| | Value |
|---|---|
| Disk before / at full run / after | 10.98 GiB / 11.09 GiB / 10.09 GiB (full run allowed at ≥ 10 GiB; a monitor would stop it below 5 GiB, and it was never triggered) |
| Memory | 32 % free (system memory pressure) |
| Swap | 5282 / 6144 MB used |

## 2. Runs (in order, all logged unless stated)

| Run | Result | Log |
|---|---|---|
| Focused: `test_phase5_3g4_2_freshness.py` without the 4 integrity tests (manifest not yet written) | 75 passed | not stored (development run) |
| 5.3g.3, 5.3g.4 and 5.3g.4.1 tests before the manifest | 314 passed, 3 failed. The 3 failures were the expected hash checks for `gates.py` and the 5.3g.3 test | not stored (development run) |
| **Targeted after the manifest**: G.4.2, G.3, G.4, G.4.1, 5.3g, 5.3g.1, 5.3g.2, 5.3f, 5.3f.1, 5.3e | **621 passed** | `evidence/pytest_targeted.log` |
| **Full offline regression** `uv run pytest tests --ignore=tests/browser -p no:cacheprovider -rs` | **970 passed, 7 skipped, 0 failed**, 370.8 s, exit 0, 977 collected | `evidence/pytest_full.log` |
| `ruff check tests/unit/ src/blatifa/` | all checks passed | — |

**Reconciliation of the counts:**
- G.4.1 collected 941. Removing the 43 browser tests leaves 898, and 898 + 79 = 977.
- Per file, from `pytest_full.log`:
  - `test_phase5_3g4_2_freshness.py`: 79;
  - `test_phase5_3g3_credit_contract.py`: 132 (unchanged count);
  - `test_phase5_3g4_1_adapter_trust.py`: 138;
  - `test_phase5_3g4_credit_paths.py`: 47.
- No source or test file was modified after the full run started.

## 3. Skipped and excluded tests (exact reasons)

| Tests | Count | Reason |
|---|---|---|
| `tests/live/test_flow_live.py` | 7 skipped | "live Flow checks are opt-in (BLATIFA_LIVE=1)". `BLATIFA_LIVE` is unset |
| `tests/browser/*` | 43 **not run** (`--ignore`) | The G.4.2 brief §11 forbids any Playwright/CDP browser connection. These tests start a dedicated Chrome through Playwright on local fixture pages (no Flow). One of them, `test_account_and_capture.py`, drives `run_preflight`, and therefore `credit_evidence`, on a fixture page. **That coverage was not exercised in this phase.** |

## 4. Brief §9 required tests (`tests/unit/test_phase5_3g4_2_freshness.py`)

| Requirement | Test(s) |
|---|---|
| Age 0, 299.999, 300 (exact), 300.001, −5 (exact), −5.001 | `test_freshness_boundaries` (15 cases, pure helper, deterministic) |
| NaN, +∞, −∞ | `test_non_finite_age_is_refused` (6 cases) |
| Non-numeric ages (None, str, bytes, bool, list, object, complex) | `test_non_numeric_age_is_refused_without_raising` (9 cases) |
| Pure helper, no clock, no module-level policy | `test_verdict_is_pure_and_takes_no_policy`, `test_rebinding_the_documented_constants_changes_nothing` |
| Real-clock behaviour (≥ 1 s from every boundary) | `test_credit_evidence_uses_the_real_clock` (8 cases) |
| No `now` / `max_age_s` in either signature; passing them raises `TypeError` | `test_signatures_have_no_freshness_overrides` |
| No production call site supplies them; no `**kwargs` forwarding | `test_no_production_call_supplies_a_freshness_override` |
| No alternative public override introduced | `test_no_public_function_in_gates_accepts_a_time_or_age` |
| Unevaluable time → UNKNOWN, `CREDIT_UNKNOWN`, approval `None`, never VERIFIED | `test_unevaluable_time_fails_closed` (9 bad `read_at` values) |
| `TypeError` / `ValueError` do not escape; other errors do | `test_time_errors_do_not_escape_the_boundary` (2 cases), `test_unrelated_errors_are_not_swallowed` |
| Type and status are checked before time | `test_type_and_status_are_checked_before_time`, `test_invalid_type_or_status_stays_unknown` (8 cases) |
| Stale reading through preflight / approval gate / runner | `test_stale_reading_through_preflight_gate`, `test_stale_reading_through_approval_gate`, `test_runner_refuses_a_stale_reading` |
| Exact `SimulatedFlow`, subclass, fake name, spoofed attribute, external adapter | `test_adapter_trust_is_unchanged` (plus the unchanged 138 G.4.1 tests) |
| Gate business rules | `test_gate_business_rules_are_unchanged` (`181d780a…`) |
| `read_at` provenance stays OPEN (R-2) | `test_read_at_provenance_is_still_open_r2` (documents the risk; does not fix it) |
| Integrity, history, flags, no browser | 7 tests (SAFETY_AUDIT §2) |

## 5. Historical tests changed (user-approved)

| Test | Before | After |
|---|---|---|
| 5.3g.3 `test_user_reported_is_never_verified` | `credit_evidence(r, now=NOW)` | `credit_evidence(r)`; same expectation (UNKNOWN) |
| 5.3g.3 `test_fresh_verified_balance_goes_through_the_existing_rules` | `credit_evidence(verified(40), now=NOW)`, `credit_evidence(verified(5), now=NOW)` | `verified(…, live(-10))`: a read_at 10 s before the real clock; same expectations (VERIFIED 40 allowed / INSUFFICIENT_CREDIT) |
| 5.3g.3 `test_everything_but_verified_is_credit_unknown` | `credit_evidence(make(), now=NOW)` | `credit_evidence(make())`; same expectations |
| 5.3g.3 `test_historical_or_future_balance_is_not_current` | deltas −10, −300, −301, −86400, +4, +60 via `now=NOW` | the same 6 deltas and outcomes on `_freshness_verdict(-delta)` (deterministic), **plus** end to end against the real clock for every delta except −300 (exact boundary) |
| 5.3g.4.1 `test_no_caller_supplied_trust_anywhere` | `params == ["value", "adapter", "now"]` | `params == ["value", "adapter"]`; the other assertions are unchanged |
| 5.3g.4.1 `test_every_change_since_the_5_3g4_1_baseline_is_approved_or_a_pinned_root` | exact G.4.1 rows only | chain-aware (SAFETY_AUDIT §3) |
| 5.3g.4 / 5.3g.4.1 `INTEGRITY_ROOTS` | 3 / 5 pins | new helper sha, new G.4 test sha (in G.4.1), plus the G.4.2 manifest |

**About "two G.4.1 signature assertions".** The brief speaks of two signature assertions in G.4.1, but G.4.1
contains exactly **one** signature assertion (`approval_balance`). No test anywhere asserted the signature of
`credit_evidence`. The audit's "2 G.4.1 assertions" were that signature assertion and the non-chain-aware integrity
test; both were changed.

No test was removed, skipped or marked xfail. Full diffs: `evidence/test_changes.diff`.

## 6. Mutation evidence

Not run in this phase (not authorized). The G.4.1 status is unchanged: `MUTATION EVIDENCE NOT INDEPENDENTLY VERIFIED`.
