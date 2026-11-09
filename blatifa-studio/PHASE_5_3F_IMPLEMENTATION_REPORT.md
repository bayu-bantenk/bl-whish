# Phase 5.3f — Implementation report

> **Ringkasan (ID):** Setiap attempt yang disiapkan kini mendapat satu nonce unik. Nonce itu ditempel tepat sekali
> di prompt final dan diikat ke attempt, eksperimen, scene, proyek dan akun dalam satu transaksi SQLite. Runner
> hanya mengirim prompt final yang tersimpan dan sudah diverifikasi ulang. Handoff hanya dibuat dari ikatan yang
> valid. Semua offline; pengiriman ke Flow tetap tidak mungkin.

## 1. Files

| File | Change |
|---|---|
| `src/blatifa/production/nonce_binding.py` (new) | `BindingContext`, `prepare_attempt` (idempotent), `verify_preparation`, `prepared`, `NonceBindingError`. Uses `new_nonce`, `append_nonce` and `NONCE_RE` from `media_identity`; no own nonce logic. |
| `src/blatifa/persistence/store.py` | table `attempt_preparation` (append-only triggers, `nonce UNIQUE`); `prepare_attempt` (one transaction), `preparation`, `binding_by_nonce`; `BindingConflictError`, `NonceCollisionError`. Existing tables untouched. |
| `src/blatifa/production/runner.py` | optional `nonce_binding: BindingContext`. `VALIDATING` prepares and binds; `READY` re-verifies and submits the stored final prompt (`_prompt_to_submit`). Without a context the behaviour is unchanged, except that a prepared attempt is never submitted without one. |
| `src/blatifa/production/handoff.py` | `request` refuses an invalid binding; `binding_problems`; `require_preparation` flag (default `False` = 5.3e behaviour for bare bindings). |
| `src/blatifa/cli.py` | `episode simulate` runs with `SIMULATED_BINDING` (`experiment = project = account = "SIMULATED"`). |
| `tests/unit/test_phase5_3f_nonce_binding.py` (new) | 43 tests |

Not changed (hash-checked): `media_identity.py`, `flow_locators.yaml`, `authorization.py`, `sample_episode.json`
(Octopus lock), the 5.3/5.3b/5.3d manifests, `PROMPT.txt`, all `docs/phase-5.3e` files, the 32 existing test files.
Hashes: `evidence/baseline_hashes.txt`, `evidence/tests_baseline_hashes.txt`. Before and after hashes of the edited
files: `evidence/pre_change_hashes.txt`, `evidence/post_change_hashes.txt`.

## 2. Nonce lifecycle (exact)

| Step | Where | Persisted? |
|---|---|---|
| 1. attempt created (`PENDING`), → `VALIDATING` | `EpisodeEngine.run` → `Store.create_attempt`; runner | yes (unchanged) |
| 2. locks verbatim, start image present | runner `VALIDATING` | — |
| 3. existing preparation? → verify, return it | `nonce_binding.prepare_attempt` | read only |
| 4. base prompt with a nonce → refuse | `prepare_attempt` | nothing written |
| 5. **nonce generated**: `media_identity.new_nonce()` | `prepare_attempt` | memory only |
| 6. **appended**: `append_nonce(base, nonce)`, checked `NONCE_RE.findall(final) == [nonce]` | `prepare_attempt` | memory only |
| 7. **one transaction** (`BEGIN IMMEDIATE`): re-check preparation; attempt `VALIDATING`; no bare binding; nonce unused; insert `attempt_preparation` (final prompt, its SHA-256, base SHA-256, episode/scene/version/attempt no, experiment, project, account, nonce); insert `attempt_binding`; attempt → `READY` with `prompt_sha256 = sha256(base)`; state event "prepared, not submitted" | `Store.prepare_attempt` | all or nothing |
| 8. read back and verify against base prompt, context and scene | `verify_preparation` | read only |
| 9. `READY`: verify again against the job and context; submit `attempt_preparation.final_prompt` | runner `_prompt_to_submit` | — |

A nonce collision (the `UNIQUE` index, or the check in the transaction) writes nothing; up to 3 fresh nonces are tried,
then `NONCE_COLLISION` (fail closed).

## 3. Verification rules (`verify_preparation`)

Refused when: no preparation or no binding; bound nonce not a Blatifa nonce; preparation and binding disagree (nonce,
experiment, project, account); nonce owned by another attempt; preparation of another scene attempt; stored final
prompt ≠ its hash; final prompt does not carry exactly the bound nonce once; attempt `prompt_sha256` ≠ base hash;
caller's prompt changed; final ≠ base + nonce line; another experiment, project or account than the caller's; another
episode, scene or scene version than the caller's job.

## 4. Runner and handoff behaviour

- Preparation failure in `VALIDATING` → `NEEDS_MANUAL_INTERVENTION` with the error code. Verification failure in
  `READY` → `NEEDS_MANUAL_INTERVENTION / NONCE_BINDING_INVALID`. In both cases nothing reaches the adapter: no
  snapshot and no submit.
- A crash after the commit resumes in `READY` with the same nonce. A resume through `RECONCILING → READY` also
  re-uses the stored prompt. A new nonce only comes with a new attempt.
- `MEDIA_ID_UNRESOLVED` → hook → `HandoffService.request` → handoff only if `binding_problems` is empty.
- Identity reconciliation (5.3e) is unchanged and does not start another scene.

## 5. Deviations and limitations

- `prompt_sha256` on `scene_attempt` keeps its meaning (the scene prompt). The submitted prompt's hash is
  `attempt_preparation.final_prompt_sha256`. This keeps `EpisodeEngine`'s "episode changed during production" check.
- "Prepared, not submitted" is the existing `READY` state plus a preparation row. No new attempt state was added.
- A changed prompt cannot "invalidate" the append-only binding. It is **refused**: the attempt goes to manual
  intervention, and a new attempt gets a new nonce.
- `HandoffService(require_preparation=False)` stays the default so the 5.3e tests run unchanged. With the default, a
  bare 5.3e `bind_attempt` (no prepared prompt) is still accepted. A preparation that exists is always verified.
  Proposed: switch the default to `True` once the user approves changing the 5.3e test helper.
- No code path calls `bind_attempt` directly any more. It is kept for 5.3e compatibility.
- Nonce uniqueness is global (the DB index), which is stricter than "per experiment".
- The CLI simulation uses the placeholder project `SIMULATED`. No live context exists, because LIVE runs are blocked.
- Nothing was verified live.
