# Phase 5.3f.1 — Implementation report: strict handoff default

> **Ringkasan (ID):** `HandoffService` kini ketat secara default. Handoff hanya dibuat untuk attempt yang punya
> prompt final tersimpan dan ikatan nonce yang valid. Mode lama (ikatan polos 5.3e) hanya bisa diaktifkan dengan dua
> argumen eksplisit sekaligus, termasuk token khusus tes, dan tidak ada kode produksi yang memakainya.
> Simulasi CLI kini juga membuat handoff lewat layanan ketat. Semua offline.

## 1. Baseline audit (before editing)

| Item | Finding |
|---|---|
| `require_preparation` uses | `handoff.py` (definition, default `False`); `test_phase5_3f_nonce_binding.py` (`_runner`, the e2e episode test) |
| `HandoffService(` in `src` | `cli.cmd_handoff` only (`HandoffService(store)`; it does not call `request`) |
| Runner handoff entry point | `SceneRunner(on_media_unresolved=…)` → `_manual(MEDIA_ID_UNRESOLVED)` → hook. Nothing in `src` set the hook; the CLI simulation had none. |
| Helpers relying on legacy behaviour | `test_phase5_3e_handoff.py`: fixture `env` and helper `_runner_case` (bare `bind_attempt`). `test_phase5_3f_nonce_binding.py`: `_runner(strict=False)` branch (unused) and `lenient` in `test_invalid_binding_prevents_handoff_creation`. |
| Baselines | `evidence/baseline_hashes.txt` (26 protected files: the 15 from 5.3f, `nonce_binding.py`, and every `docs/phase-5.3f` file); `evidence/pre_change_hashes.txt`; `evidence/pytest_baseline_targeted.log` (140 passed) |

## 2. Changes

| File | Change |
|---|---|
| `src/blatifa/production/handoff.py` | `require_preparation=True` by default. New constant `LEGACY_UNPREPARED_BINDINGS_TEST_ONLY` and keyword `legacy_opt_in`. Legacy mode needs **both** `require_preparation=False` and `legacy_opt_in=<exact token>`. Any other combination raises `ValueError`, including the token with the strict flag left on. |
| `src/blatifa/cli.py` | `episode simulate`: `on_media_unresolved=HandoffService(store).request` (strict default), next to the existing `SIMULATED_BINDING` |
| `tests/unit/test_phase5_3e_handoff.py` | helpers only: `LEGACY = {require_preparation: False, legacy_opt_in: TOKEN}` used by `env` and `_runner_case`. Exact diff (6 lines): `evidence/test_helper_changes.diff`. The old file was reconstructed from the diff and hashes to the 5.3f baseline (`91c4a13a…`). No assertion changed. |
| `tests/unit/test_phase5_3f_nonce_binding.py` | `_runner(strict=False)` and `lenient` use the explicit `LEGACY` opt-in. The test-hash check reads the 5.3f.1 test baseline, where only the 5.3e test file has a new hash; the other 31 hashes are unchanged. |
| `tests/unit/test_phase5_3f1_strict_default.py` (new) | 33 tests |

Unchanged: `runner.py`, `store.py`, `nonce_binding.py` (5.3f nonce implementation), resolver, authorization, registry,
Octopus lock, manifests, and all 5.3d/5.3e/5.3f evidence (`evidence/pre_change_hashes.txt` vs
`evidence/post_change_hashes.txt`; `baseline_hashes.txt` 26/26).

## 3. Production-reachable handoff paths (traced)

```
blatifa episode simulate ─► SceneRunner(nonce_binding=SIMULATED_BINDING,
                                        on_media_unresolved=HandoffService(store).request)   strict (default)
   └─ VALIDATING: prepare_attempt → READY: verify + submit stored prompt (SimulatedFlow)
   └─ MEDIA_ID_UNRESOLVED → request → binding_problems: binding + stored prompt + verify_preparation
blatifa handoff status|show|ready|confirm-opened|observe|cancel|recover ─► HandoffService(store)  strict (default)
   (these commands never create a handoff; recover/apply only finish existing ones)
UI (ui/service.py), readiness ─► EpisodeEngine(runner=None): no runner, no handoff
LIVE episode runs ─► EpisodeEngine.run raises LiveRunBlockedError
```

No production path can bypass strict validation. A static test checks every `HandoffService(...)` call in `src` and
confirms the token appears only in `handoff.py`.

## 4. Limitations

- Strict mode governs **creation** (`request`). Handoffs that already exist in a database (for example, created
  under 5.3e legacy) are still completed by `ready` / `observe` / `recover`. The existing resolver and stale checks
  are unchanged.
- The legacy token is a convention plus a static test, not a security boundary. Any code that imports the constant
  could pass it; the static test fails if `src` does.
- The rejection matrix uses simulated corruption: dropped triggers and edited rows.
