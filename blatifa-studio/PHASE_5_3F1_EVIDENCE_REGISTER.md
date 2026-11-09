# Phase 5.3f.1 — Evidence register

Classifications: VERIFIED · PARTIALLY VERIFIED · PROPOSED · UNVERIFIED · BLOCKED. Offline only: no browser, no
Google Flow, no network, no credits.

| ID | Claim | Class | Evidence |
|---|---|---|---|
| E-P53F1-01 | `HandoffService` is strict by default (`require_preparation=True`) | VERIFIED | `test_strict_preparation_is_the_default`; `handoff.py` |
| E-P53F1-02 | A missing binding, a missing stored prompt, or any hash, nonce, experiment, scene, project, account or attempt mismatch rejects handoff creation | VERIFIED (simulated corruption) | 18 rejection tests |
| E-P53F1-03 | Legacy mode needs both `require_preparation=False` and the exact test-only token | VERIFIED | `test_legacy_mode_cannot_be_enabled_accidentally` (6 combinations) |
| E-P53F1-04 | No production code references the legacy token; every `HandoffService(...)` call in `src` uses the default | VERIFIED (static) | `test_legacy_opt_in_is_isolated_from_production_code` |
| E-P53F1-05 | `episode simulate` uses nonce binding plus a strict handoff | VERIFIED (simulated) | `test_simulated_cli_uses_strict_handoff_and_nonce_binding` |
| E-P53F1-06 | Every production-reachable handoff path is strict | VERIFIED (call-graph trace + static test) | Implementation report §3 |
| E-P53F1-07 | Only the 5.3e test helpers changed (6 lines), with no assertion changed | VERIFIED | `evidence/test_helper_changes.diff`; the reconstructed old file hash equals the 5.3f baseline |
| E-P53F1-08 | Resolver, authorization, registry (18 × `deny: true`), Octopus lock, manifests, 5.3d/5.3e/5.3f evidence and `nonce_binding.py` unchanged; `runner.py` and `store.py` unchanged | VERIFIED | `baseline_hashes.txt` 26/26; pre/post hashes |
| E-P53F1-09 | Targeted tests | VERIFIED | 173 passed |
| E-P53F1-10 | Full regression | VERIFIED | 556 passed, 7 skipped (opt-in live), 0 failed |
| E-P53F1-11 | Resources measured before and after | VERIFIED | `evidence/resource_gate.txt` |
| E-P53F1-12 | Handoffs created earlier under legacy mode are still completed by `ready` / `observe` / `recover` | PARTIALLY VERIFIED | strict mode covers creation only; the existing resolver and stale checks still apply |
| E-P53F1-13 | `handoff ready` / `observe` against live Flow | UNVERIFIED | Phase 5.3g, needs separate authorization |
| E-P53F1-14 | Live submission with nonce binding | BLOCKED | `LIVE_ACTIONS_ACTIVE = False` |
