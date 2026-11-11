# Phase 5.3f — Evidence register

Classifications: VERIFIED · PARTIALLY VERIFIED · PROPOSED · UNVERIFIED · BLOCKED. All rows are offline. No browser,
no Google Flow and no network were used in this phase.

| ID | Claim | Class | Evidence |
|---|---|---|---|
| E-P53F-01 | Each prepared attempt gets one unique, well-formed nonce | VERIFIED (offline) | `test_each_new_attempt_gets_one_unique_…` (20 attempts); e2e episode test (3 attempts) |
| E-P53F-02 | The nonce appears exactly once in the final prompt, and the binding equals it | VERIFIED (offline) | `test_nonce_appears_exactly_once_…`; `Store.prepare_attempt` count check; `verify_preparation` |
| E-P53F-03 | The final prompt's SHA-256 is stored and re-checked before submission | VERIFIED (offline) | `test_prompt_hash_matches_…`; tamper test "does not match its hash" |
| E-P53F-04 | The binding includes attempt, episode, scene, version, attempt no, experiment, project and account | VERIFIED (offline) | `attempt_preparation` + `attempt_binding` rows; scope tests |
| E-P53F-05 | Preparation is idempotent; a retry re-uses the attempt and the nonce | VERIFIED (offline) | idempotence, crash-after-commit and retry-after-crash tests |
| E-P53F-06 | Preparation is atomic (preparation + binding + `READY` in one transaction) | VERIFIED (offline) | failing-statement test (rollback); separate-process kill test |
| E-P53F-07 | Concurrent preparation produces one binding | VERIFIED (offline; same process and 4 OS processes, one machine) | two concurrency tests |
| E-P53F-08 | Missing, mismatched or corrupted bindings fail closed (no submit, no handoff) | VERIFIED (offline) | 10 rejection tests |
| E-P53F-09 | The simulated runner creates a handoff only from a valid binding | VERIFIED (simulated) | runner + handoff tests; e2e handoff → `RECONCILED` |
| E-P53F-10 | Resolver unchanged | VERIFIED | `media_identity.py` hash = baseline; 5.3d tests 9 passed |
| E-P53F-11 | `LIVE_ACTIONS_ACTIVE = False`, 18 × `deny: true`, `authorization.py`, Octopus lock and manifests unchanged | VERIFIED | `evidence/baseline_hashes.txt` 15/15 OK |
| E-P53F-12 | Existing tests intact | VERIFIED | `evidence/tests_baseline_hashes.txt` 32/32 OK |
| E-P53F-13 | No click, navigation or generation call introduced; LIVE episode runs blocked | VERIFIED (static + unit) | `test_no_browser_click_…`, `test_live_episode_runs_stay_blocked_…` |
| E-P53F-14 | Targeted regression | VERIFIED | 375 passed (`evidence/pytest_targeted.log`) |
| E-P53F-15 | Full regression | UNVERIFIED (deferred) | disk 6.9–7.1 GiB < 10 GiB; 12 modules not run (they do not import changed code) |
| E-P53F-16 | Strict handoff by default (`require_preparation=True`) | PROPOSED | needs the 5.3e test helper changed; user approval required |
| E-P53F-17 | Nonce binding on a live Flow submission | BLOCKED | `LIVE_ACTIONS_ACTIVE = False`; no generation authorized |
| E-P53F-18 | Resources during the work | VERIFIED | disk 7.1 → 6.9–7.0 GiB; swap 5.3–5.5/6 GiB; nothing deleted |
