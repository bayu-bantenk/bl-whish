# Phase 5.3g.4.1: test report

> **Ringkasan (ID):**
> - 138 tes baru, semuanya lulus.
> - Regresi penuh: **934 passed, 7 skipped, 0 failed** (exit 0). 934 = 796 (5.3g.4) + 138.
> - Tujuh tes yang di-skip adalah tes live opt-in.
> - Empat mutan aturan trust semuanya tertangkap.

## 1. Resources (`evidence/resource_gate.txt`)

| | Value |
|---|---|
| Disk before the full run | 10.35 GiB free (≥ 10 GiB, so the full suite was allowed; a monitor stopped it below 5 GiB, and it was never triggered) |
| Disk after | 9.57 GiB |
| Memory | 45 % free (system memory pressure) |
| Swap | 6454 / 7168 MB used (high; the run was not affected) |

## 2. Runs (in order)

| Run | Result |
|---|---|
| Exact trust only, `simflow` reverted (`evidence/conflict_run_exact_trust_before_test_fixes.txt`) | 66 failed, 730 passed. 5 failures are expected hash checks; 61 are functional (60 via `simflow.make`, 1 via `NamelessFlow`). This is the evidence for the user decision |
| `tests/unit` + `tests/browser` after the approved test changes, before the manifest | 6 failed (hash checks only), 790 passed |
| Integrity and historical tests after the manifest (5.3e, 5.3f, 5.3f.1, 5.3g … 5.3g.4) | 404 passed |
| `tests/unit/test_phase5_3g4_1_adapter_trust.py` | **138 passed**, 0 skipped (ffmpeg present, so the runner tests ran) |
| **Full regression** `pytest tests` (`evidence/pytest_full.log`) | **934 passed, 7 skipped, 0 failed**, 455.9 s, exit 0 |
| An accidental second full run (meant only to list skips) | same skip list. Its summary was not saved and it is not counted |
| `ruff check` (changed and new files, `src/blatifa`) | all checks passed |

Logs: only the full regression (`evidence/pytest_full.log`) and the conflict run
(`evidence/conflict_run_exact_trust_before_test_fixes.txt`) are stored. The targeted runs (790/6, 404, 138, 261)
and the mutation runs have **no stored log**; their numbers are reported, not independently verifiable. The count
of 138 for the new module is independently confirmed by `pytest_full.log`.

Skipped: 7 × `tests/live/test_flow_live.py` ("live Flow checks are opt-in (BLATIFA_LIVE=1)"), the same as in
5.3g.4.

## 3. Mutation check of the trust rule

`gates.is_simulated_adapter` was temporarily replaced by a weaker rule, the new module was run, and the file was
then restored. The restored sha `0a2fa5d0…` equals the manifest row.

**Evidence status (2026-11-11): NOT INDEPENDENTLY VERIFIED.**
- No log of the four runs is stored in `evidence/`.
- The command printed only the last summary line of each run (`tail -1`). No per-test output was ever captured.
- That summary output still exists only in the local session transcript of the assistant, outside the repository.
  It is not repository evidence, it holds no test names, and it was not copied or reconstructed into `evidence/`.
- The numbers below are therefore a report, not verified evidence.
- What *is* verified independently: the final `gates.py` sha equals the manifest row, and `pytest_full.log` shows
  all 138 tests of the new module passing against it.

| Mutant | New tests failing |
|---|---|
| `isinstance(adapter, SimulatedFlow)` | 22 |
| `type(adapter).__qualname__ == "SimulatedFlow"` | 12 |
| the 5.3g.4 package-boundary rule | 89 |
| `… or getattr(adapter, "is_simulated", False) is True` | 22 |

**Recommendation (needs user approval; not done).** Re-run the four mutation checks offline and keep the full
pytest output of each run in `evidence/`. Each run would:
1. change `gates.py` in a scratch copy or with a restore step;
2. run only `tests/unit/test_phase5_3g4_1_adapter_trust.py` with `-rf`;
3. restore the file and verify `gates.py` sha `0a2fa5d0…`.

No browser, no Flow, no full regression suite. Writing the logs would change the evidence folder, so it needs that
approval as well.

## 4. Brief §5 required tests

| # | Requirement | Test |
|---|---|---|
| 1 | exact `SimulatedFlow` keeps simulation behaviour | `test_exact_simulated_flow_keeps_its_simulation_behavior`, `test_runner_with_the_exact_simulated_flow_accepts_a_bare_number` |
| 2 | external-module adapter, raw int: rejected | `test_untrusted_adapter_cannot_pass_a_raw_balance[external module-40 / 0 / 10000]` |
| 3 | external-module adapter, raw string: rejected | same, `'40'`, `'10000'`, `'40 Google Flow credits'` |
| 4 | `is_simulated = True`: rejected | `[is_simulated = True-*]`, `[FakeFlow subclass claiming simulation-*]` |
| 5 | class name containing `Simulated`: rejected | `[class name contains Simulated-*]`, `[name and module of SimulatedFlow-*]` |
| 6 | subclass of `SimulatedFlow`: rejected | `[subclass of SimulatedFlow-*]`, `test_runner_with_a_simulated_flow_subclass_refuses_a_bare_number` |
| 7 | unknown adapter with `BalanceReading` follows `credit_evidence()` | `test_untrusted_adapter_with_evidence_follows_credit_evidence` (spy), `test_runner_with_an_untrusted_adapter_accepts_fresh_evidence` |
| 8 | stale / future-dated rejected | same (301 s, −60 s) |
| 9 | `USER_REPORTED` rejected | same |
| 10 | `OBSERVED_IN_ALREADY_OPEN_PANEL` rejected | same |
| 11 | `None` stays `CREDIT_UNKNOWN` | `test_none_stays_credit_unknown` |
| 12 | no raw number from an unknown adapter reaches `approval_gate` | `test_runner_never_passes_a_raw_balance_from_an_untrusted_adapter` (spy on `approval_gate`: every balance is None; Approve never clicked; Reject once) |

Also covered:
- the trust rule is pinned by AST;
- the call graph;
- the gate rules hash;
- the documentation wording;
- the integrity roots, manifest scope, fail-closed chains and history;
- the flags;
- the absence of browser calls.

## 5. Assertions changed in existing tests

| Test | Before | After | Reason |
|---|---|---|---|
| 5.3g.4 `test_only_simulated_flow_and_out_of_package_doubles_count_as_simulation` (renamed `test_only_the_exact_simulated_flow_counts_as_simulation`) | `assert is_simulated_adapter(FakeFlow())` | `assert not is_simulated_adapter(FakeFlow())` | this is exactly the weakness the phase removes; the new assertion is stricter |
| 5.3g.4 `test_gate_inputs_come_only_from_the_boundary` | expected `…simulated_adapter=is_simulated_adapter(self.adapter))` | expected `…adapter=self.adapter)` | API change; the other assertions are unchanged |
| 5.3g.4, 12 calls | `simulated_adapter=False/True` | `adapter=LIVE/SIM` (real `GoogleFlowAgentAdapter` / `SimulatedFlow` instances) | API change; same expected values |
| 5.3g.4 `INTEGRITY_ROOTS` | helper `2dfb696e…`, 2 manifests | helper `9683cfc2…`, 3 manifests | new manifest |
| 5.3f `test_protected_files_and_existing_tests_are_unchanged` | exact digest | `ph.matches` (exact digest or pinned approved chain) | user-approved; proven fail-closed |
| 5.3f.1 `test_simulated_cli_uses_strict_handoff_and_nonce_binding` | `NamelessFlow` subclass | exact `SimulatedFlow` with `observe` patched locally; **two assertions added** | user-approved; original assertions unchanged |

No test was removed, skipped or marked xfail. Full diffs: `evidence/test_changes.diff`.
