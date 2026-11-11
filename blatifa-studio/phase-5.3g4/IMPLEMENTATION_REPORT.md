# Phase 5.3g.4 — Implementation report

> **Ringkasan (ID):** F-1 sudah ditutup, offline.
> - Saldo hasil klik `read_credits()` sekarang hanya diagnostik. Saldo itu tidak pernah lagi bisa membuka
>   `preflight_gate`.
> - Saldo untuk `approval_gate` wajib lewat `credit_evidence()`. Angka mentah hanya diterima dari adapter simulasi.
> - Aturan bisnis kedua gate tidak berubah.
> - Satu assertion lama di tes browser harus diubah karena memang menguji perilaku F-1 (detail di §4).
> - Mekanisme approved-change diperkuat: manifest di-pin hash-nya dan tidak bisa menyetujui dirinya sendiri.

## 1. Implemented and tested

| Change | File | Test |
|---|---|---|
| `credit_evidence` accepts any object; legacy `CreditSnapshot` and every non-`BalanceReading` → `(UNKNOWN, None)` | `production/gates.py` | `test_legacy_read_credits_output_cannot_pass_credit_evidence`, `test_everything_but_a_fresh_verified_reading_fails_closed` |
| `approval_balance` (bare int only for a simulated adapter) | `production/gates.py` | `test_bare_numbers_never_reach_approval_for_a_live_adapter` |
| `run_preflight`: gate credit input from `credit_evidence(credits)`; `PreflightReport.credit_authorization` (why) | `production/preflight.py` | `test_run_preflight_cannot_authorize_from_a_click_derived_balance`; browser fixture test |
| `SceneRunner._gate_balance` → `approval_balance`; `is_simulated_adapter` | `production/runner.py` | `test_runner_refuses_a_bare_number_for_a_live_adapter_and_accepts_fresh_evidence`, `test_only_simulated_flow_and_out_of_package_doubles_count_as_simulation` |
| `blatifa account`: "credit authorization: NOT GRANTED (…)" in the output and the report; `preflight` output labels the balance "diagnostic only" and prints the evidence verdict; help texts no longer say "read-only" | `cli.py` | `test_blatifa_account_diagnostics_never_imply_authorization`, `test_blatifa_preflight_command_blocks_on_click_derived_evidence` |
| Approved-change mechanism: pinned manifests, chained transitions, refusal of self-approval / helper / baseline files / conflicting rows | `tests/unit/protected_hashes.py` | `test_manifest_cannot_approve_itself_the_helper_or_a_baseline`, `test_tampered_or_conflicting_manifest_is_refused`, `test_integrity_roots_are_pinned_independently` |

Exact diffs: `evidence/production_changes.diff`, `evidence/test_changes.diff`. The pre-change versions were
reconstructed by reversing the edits, and they match the 5.3g.4 baseline hashes exactly.

## 2. Audited but not changed

- `read_credits` and its clicks (`Account details`, `Close account panel`). `read_identity`'s `scroll_top`, and
  `run_state(agent_settings)` in `run_preflight`. The interaction surface of `account` and `preflight` is the same as
  in 5.3g.3, and neither command was run.
- `preflight_gate` and `approval_gate` rules (source hash = pre-5.3g.3 text).
- `ReadStatus.ESTIMATED` is still accepted by `preflight_gate`. It is produced nowhere, and `credit_evidence` never
  returns it.
- `cmd_account` exit code: it still means "identity and the diagnostic read succeeded". It grants nothing: no gate
  reads it.
- `balance.py`, `reader.py`, `live_probe.py` (5.3g.3), `manual_submission.py`, `nonce_binding.py`, `handoff.py`,
  `store.py`, `authorization.py`, `flow_locators.yaml`.

## 3. Not proven

- **Third-party adapters.** `is_simulated_adapter` treats any class defined *outside* the `blatifa` package as a
  simulation, which is needed for the existing test doubles. A real adapter written outside the package would get
  bare numbers through. Today no such adapter exists; the only live adapter is in-package and blocks
  approve/reject anyway.
- **F-4** (a hidden credit element while the panel is closed) is still open.
- **No external trust anchor.** The project is not a git repository, so the integrity roots are pinned only inside
  the repository (helper + 5.3g.4 test). Changing both in one edit is possible; it is visible in review and in
  `evidence/historical_baseline_files.txt`, but it is not cryptographically prevented.

## 4. Change to an existing assertion (required, documented)

`tests/browser/test_account_and_capture.py::test_preflight_reads_everything_and_clicks_only_phase1_controls` asserted
`rep.gate.allowed`. That is exactly the F-1 behaviour this phase must remove: a preflight that passes on a balance
read by clicking the account panel. Requirement 1 of Stage B and acceptance criterion 2 cannot both hold while that
assertion stays.

It now asserts `rep.gate.blocks == [Block.CREDIT_UNKNOWN]`. This is stricter: all other gates (identity, disk, UI,
confirmation policy) must still pass, and only the credit gate blocks. It also asserts that the diagnostic read is
still `VERIFIED, 40` and is labelled "diagnostic only". The other assertions in that test (Phase 1 clicks only, the
`confirmnever` / wrong-identity case) are unchanged. That file is not locked by any historical baseline.

No other existing assertion was changed. The 5.3g, 5.3g.1, 5.3g.2 and 5.3g.3 hash tests pass through the hardened
helper with the chained manifests.

## 5. Deferred to a later phase (needs a decision)

1. Remove or gate the clicks in `blatifa account` / `blatifa preflight` (for example, preflight without any credit
   read, or with an explicit `--diagnostic-credit-read` flag).
2. A provenance-carrying balance for production, for example the user opens the panel and Blatifa reads it
   (5.3g.2 R-2). Not implemented here, as the brief requires.
3. An explicit production marker on adapters, so that `is_simulated_adapter` no longer relies on the package
   boundary.
4. Remove `ESTIMATED` from `preflight_gate`, or define who may produce it.
5. An external trust anchor for the integrity roots (for example, git with signed tags).
