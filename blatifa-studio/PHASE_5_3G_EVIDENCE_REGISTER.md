# Phase 5.3g — Evidence register

Classifications: VERIFIED · PARTIALLY VERIFIED · PROPOSED · UNVERIFIED · BLOCKED. Offline only: no browser, no Google
Flow, no network, no credits.

| ID | Claim | Class | Evidence |
|---|---|---|---|
| E-P53G-01 | The 5.3f.1 baseline holds (hashes, strict default, no legacy in `src`) | VERIFIED | 26 + 32 + 7 hashes OK; grep |
| E-P53G-02 | `handoff ready` re-checks the preparation, in the service and in the CLI before any browser read | VERIFIED (offline) | 6 new tests |
| E-P53G-03 | All handoff paths audited (create, ready, confirm, observe, result, failure) | VERIFIED (code trace) | preflight report §2 |
| E-P53G-04 | Isolated experiment DB prepared and empty | VERIFIED | `~/BlatifaStudio/experiments/phase-5.3g/p53g.db`: 0 attempts, bindings, preparations, handoffs |
| E-P53G-05 | Old databases untouched | VERIFIED | `simulation.db` opened only with `immutable=1` |
| E-P53G-06 | 5.3d prompt, manifest and nonce are consistent | VERIFIED | `evidence/candidate_check.json` |
| E-P53G-07 | 5.3d video has strict pre-submission preparation evidence | **BLOCKED** | no `attempt_preparation` / `attempt_binding` for its nonce anywhere; nonce retired |
| E-P53G-08 | No legacy mode used for 5.3g | VERIFIED | no 5.3g code or tool uses it; tests use it only to model handoffs of unknown origin |
| E-P53G-09 | Targeted tests | VERIFIED | 182 passed |
| E-P53G-10 | Full regression | VERIFIED | 565 passed, 7 skipped, 0 failed |
| E-P53G-11 | Protected invariants unchanged | VERIFIED | `evidence/baseline_hashes.txt` 41/41 OK after the run |
| E-P53G-12 | Execution protocol available | VERIFIED (document) | `PHASE_5_3G_EXECUTION_PROTOCOL.md`; not executable until P1 |
| E-P53G-13 | Live `ready` / `confirm-opened` / `observe` on Flow | UNVERIFIED | not run; needs P1 and explicit approval |
| E-P53G-14 | Strict chain on a real video (option A) | PROPOSED | needs a generation authorization and a manual-submission attempt tool |
