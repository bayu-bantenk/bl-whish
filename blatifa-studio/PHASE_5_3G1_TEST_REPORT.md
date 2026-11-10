# Phase 5.3g.1 — Test report (offline)

`BLATIFA_LIVE` unset throughout. No browser, no Flow.

## Resources (`evidence/resource_gate.txt`)

| Time (UTC) | Free disk | Swap used | Memory free | Decision |
|---|---|---|---|---|
| 01:30 (before targeted) | 9.77 GiB | 1335 / 2048 MB | 31 % | < 10 GiB → full suite deferred, targeted only |
| 01:38 (after targeted) | 13.92 GiB | 2063 / 3072 MB | 32 % | macOS freed purgeable space; nothing was deleted by Blatifa |
| 01:38 (full-run gate) | 13.91 GiB | 2047 / 3072 MB | 35 % | ≥ 10 GiB and memory OK → full suite run **once** |
| 01:49 (after full) | 11.13 GiB | 2775 / 3072 MB | 44 % | the drop of about 2.8 GiB includes macOS purgeable and swap growth; worth watching before a live run |

## Results

| Run | Result |
|---|---|
| Baseline before changes (5.3d–5.3g) | 182 passed (`evidence/pytest_baseline_targeted.log`) |
| New `test_phase5_3g1_manual_submission.py` | 32 passed |
| Targeted: 19 modules importing changed code (`evidence/pytest_targeted.log`) | **449 passed**, 0 failed, 481 s |
| **Full regression** (`evidence/pytest_full.log`) | **597 passed, 7 skipped, 0 failed**, 622 s, exit 0. 597 = 565 (5.3g) + 32. |
| Skipped | 7 × `tests/live/test_flow_live.py` (opt-in `BLATIFA_LIVE=1`) |
| `ruff check src tests docs/phase-5.3g1/tools` | all checks passed |
| Hashes | protected 54/54 OK; post-change 7/7 OK |

No existing test or assertion was changed. Test function counts are unchanged: 5.3e 33, 5.3f 34, 5.3f.1 14, 5.3g 9.

## Coverage (brief §7)

| Requirement | Test(s) |
|---|---|
| Strict preparation success | `test_strict_preparation_success` |
| Missing preparation | `test_missing_preparation_is_rejected`, `test_wrong_or_unprepared_attempt_is_rejected` |
| Missing nonce | `test_wrong_attestation_is_rejected[nonce ""]` |
| Retired nonce | `test_retired_set_covers_every_historical_manifest_nonce`, `test_fresh_nonce_factory_skips_retired_and_bound_nonces`, `test_retired_nonce_cannot_be_prepared_or_back_a_handoff` |
| Prompt hash mismatch | `test_wrong_attestation_is_rejected[sha]`, `test_changed_stored_prompt_invalidates_the_preparation` |
| Exact prompt preservation | `test_exact_prompt_is_preserved_byte_for_byte` (service, CLI stdout bytes, `--out` file) |
| Manual attestation success | `test_manual_attestation_success_is_a_user_report_only` (source, `flow_verified = 0`, immutable) |
| Duplicate / conflicting attestation | `test_duplicate_attestation_is_idempotent`, `test_conflicting_attestation_is_rejected` (2) |
| Wrong attempt / account / project | `test_wrong_attestation_is_rejected` (7), `test_wrong_or_unprepared_attempt_is_rejected` |
| Crash and transaction recovery | `test_crash_during_attestation_rolls_back_completely`, `test_crash_during_preparation_resumes_the_same_attempt` |
| Concurrent attestation | `test_concurrent_attestations_in_separate_processes` (3 OS processes: 2 identical + 1 conflicting) |
| Attestation cannot produce RECONCILED | `test_attestation_alone_never_produces_reconciled`, `test_handoff_needs_the_attestation` |
| Resolver authoritative | `test_resolver_is_the_only_authority` (page without the nonce → rejected), `test_resolver_verified_page_reconciles_once` |
| Legacy handoff cannot enter | `test_legacy_handoff_cannot_enter_the_experiment` |
| DB identity | `test_database_identity_is_checked_before_any_write`, `test_init_refuses_a_database_that_already_holds_attempts` |
| CLI sequence | `test_cli_full_offline_sequence` |
| Invariants | `test_no_browser_or_generation_code_and_protected_hashes` |

The resolver tests use the recorded 5.3d detail page with the test's nonce substituted. They do not use a live page.
