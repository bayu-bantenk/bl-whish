# Phase 5.3g.1 — Evidence register

Classifications: VERIFIED · PARTIALLY VERIFIED · PROPOSED · UNVERIFIED · BLOCKED. Offline only: no browser, no Flow,
no network, no credits.

| ID | Claim | Class | Evidence |
|---|---|---|---|
| E-P53G1-01 | The 5.3g baseline holds | VERIFIED | 41 + 4 hashes OK before changes; 182 tests passed |
| E-P53G1-02 | Experiment DB identity verified before writing (same file as 5.3g, empty) | VERIFIED | `evidence/db_hashes_before.txt` OK; 0 rows; `init_experiment` path and emptiness checks |
| E-P53G1-03 | New strict attempt prepared with a fresh, non-retired nonce | VERIFIED | `evidence/prepare_cli.log`; nonce `[blatifa-exp-1e05d92f]` had 0 prior hits |
| E-P53G1-04 | Exact final prompt stored and exported byte-identically | VERIFIED | sha256 `f45e9887…35c5` in the DB and in `FINAL_PROMPT.txt`; byte test |
| E-P53G1-05 | Base prompt is the user-reviewed 5.3d content without a nonce; locks verbatim and hash-checked | VERIFIED | `evidence/base_prompt.json` (`equals_5_3d_prompt_without_nonce_line: true`) |
| E-P53G1-06 | Attestation is a user report only, immutable, idempotent, conflict-refusing, transaction-safe | VERIFIED (offline) | 12 tests, including 3 OS processes |
| E-P53G1-07 | Attestation never produces RECONCILED; the resolver is the only authority | VERIFIED (recorded page) | 3 tests |
| E-P53G1-08 | Handoff refuses a missing preparation or attestation, an invalid hash or binding, a project or account mismatch, a retired nonce, and legacy entry | VERIFIED (offline) | rejection tests; `handoff.binding_problems` |
| E-P53G1-09 | Historical 5.3d records, nonce retirement and other DBs untouched | VERIFIED | protected hashes; `simulation.db` hash unchanged |
| E-P53G1-10 | Protected invariants (resolver, registry 18 × `deny: true`, `authorization.py`, Octopus lock, manifests, 5.3d–5.3g evidence, `nonce_binding.py`, `store.py`, `runner.py`) | VERIFIED | `evidence/baseline_hashes.txt` 54/54 |
| E-P53G1-11 | Targeted regression | VERIFIED | 449 passed |
| E-P53G1-12 | Full regression | VERIFIED | 597 passed, 7 skipped, 0 failed |
| E-P53G1-13 | The prompt the user will submit is exactly the stored prompt | UNVERIFIED | only possible live: composer check before Send, then the user's attestation |
| E-P53G1-14 | Live generation, attestation and handoff for this attempt | BLOCKED | generation not authorized |
