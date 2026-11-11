# Phase 5.3f.1 — Final audit

> **Ringkasan (ID):** Mode ketat kini default, mode lama hanya lewat opt-in eksplisit khusus tes, dan regresi penuh
> lulus (556 passed, 7 skipped). Tidak ada interaksi Flow dan tidak ada kredit terpakai.

## Acceptance criteria (§9)

| # | Criterion | Result |
|---|---|---|
| 1 | Strict preparation is the default | PASS |
| 2 | Every production-reachable handoff uses strict validation | PASS (CLI simulate, CLI handoff; UI and readiness have no runner; LIVE blocked) |
| 3 | Legacy behaviour requires explicit opt-in | PASS (flag + exact token) |
| 4 | Normal runner paths cannot accidentally use legacy behaviour | PASS (static test) |
| 5 | All targeted tests pass | PASS (173) |
| 6 | Full regression passes when resources permit | PASS (556 passed, 7 skipped, 0 failed) |
| 7 | Protected security invariants unchanged | PASS (26/26 hashes) |
| 8 | No live Flow interaction | PASS |
| 9 | No credit used | PASS |
| 10 | Production runner inactive | PASS (`LIVE_ACTIONS_ACTIVE = False`, LIVE episode runs raise) |

## Answers (§10)

1. **Previous default:** `require_preparation=False`. A bare 5.3e `bind_attempt` without a stored final prompt was
   accepted. A preparation that existed was already verified.
2. **New default:** `require_preparation=True`. A handoff needs a binding, a stored final prompt, and a clean
   `verify_preparation`.
3. **Production paths enforcing strict mode:**
   - `blatifa episode simulate`: `SceneRunner(nonce_binding=SIMULATED_BINDING, on_media_unresolved=HandoffService(store).request)`;
   - `blatifa handoff …`: `HandoffService(store)`.
   Nothing else in `src` constructs a handoff service or sets the hook.
4. **Can a production path still use legacy mode?** No. Legacy mode needs `require_preparation=False` together with
   `legacy_opt_in=LEGACY_UNPREPARED_BINDINGS_TEST_ONLY`, and a static test fails if any `src` file other than its
   definition uses either. This is a code convention enforced by tests, not a runtime security boundary.
5. **Helpers that required explicit opt-in:**
   - `test_phase5_3e_handoff.py`: fixture `env` and `_runner_case`;
   - `test_phase5_3f_nonce_binding.py`: `_runner(strict=False)` and the "lenient" service in
     `test_invalid_binding_prevents_handoff_creation`.
6. **Targeted tests passed:** 173: 33 new in 5.3f.1, plus 43 (5.3f), 88 (5.3e) and 9 (5.3d).
7. **Full regression executed?** Yes, once: 556 passed, 7 skipped (opt-in live Flow checks), 0 failed, 404 s.
8. **Measurements:**

   | | Free disk | Swap used | Memory free |
   |---|---|---|---|
   | Before the full run | 12.33 GiB | 0 MB | 42 % |
   | After the full run | 11.77 GiB | 309 / 1024 MB | 42 % |

9. **Protected hashes unchanged?** Yes: 26/26, covering the resolver, authorization, registry, Octopus lock, all
   manifests, the 5.3d prompt, all 5.3e and 5.3f docs and evidence, and `nonce_binding.py`. `runner.py` and
   `store.py` are also unchanged. The only changed files are `handoff.py`, `cli.py` and the three test files, all
   documented.
10. **Ready for Phase 5.3g live read-only verification?** Technically yes, offline. The live read-only run of
    `handoff ready` / `observe` still needs its own brief and explicit authorization: the user opens the tile, no
    generation, no credits. Phase 5.3g was not started.

## Verdict

**STRICT HANDOFF DEFAULT VERIFIED — AWAITING REGRESSION / PHASE 5.3G REVIEW**

The full regression has already passed (556/0). What remains is the user's review before Phase 5.3g.
