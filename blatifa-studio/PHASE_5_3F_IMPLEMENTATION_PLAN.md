# Phase 5.3f — Implementation plan: submission nonce binding

> **Ringkasan (ID):** Rencana ini menutup celah 5.3e. Setiap attempt yang disiapkan mendapat satu nonce unik. Nonce
> itu ditempel ke prompt final dan diikat ke attempt, eksperimen, scene, proyek dan akun, semuanya dalam **satu
> transaksi**. Hasilnya: attempt READY = "disiapkan, belum dikirim". Semua offline; tidak ada pengiriman ke Flow.

Written before any code change (brief §2). Preflight 2026-11-06: disk 7.1 GiB free (below 10 GiB → full suite
deferred, brief §7), swap 5.46/6 GiB used, memory free 30 %. Baselines: `evidence/baseline_hashes.txt` (protected,
15 files), `evidence/tests_baseline_hashes.txt` (32 existing test files), `evidence/pre_change_hashes.txt` (the four
source files this phase edits).

## 1. Current call graph (audit)

```
cli episode simulate ─► SceneRunner(store, SimulatedFlow, …) ─► EpisodeEngine.run
EpisodeEngine.run ─► build_job(ep, scene)            # scene.assemble_prompt → job.prompt (no nonce)
                  ─► store.create_attempt(...)        # PENDING
                  ─► runner.run(attempt, job)
SceneRunner._step
   PENDING    ─► VALIDATING
   VALIDATING ─► lock text verbatim? start image? ─► READY (prompt_sha256 = sha256(job.prompt))
   READY      ─► preflight ─► snapshot ─► UPLOADING ─► GENERATING ─► adapter.submit(job.prompt)   ◄── first Flow contact
   …RENDERING ─► complete tile, no media id ─► _manual(MEDIA_ID_UNRESOLVED) ─► on_media_unresolved hook
HandoffService.request ─► store.binding(attempt) ─► None → no handoff (5.3e fail-closed)
```

| Utility | Location | Used by production code today |
|---|---|---|
| `new_nonce()`, `append_nonce()`, `NONCE_RE` | `flow/media_identity.py` (protected) | no |
| `Store.bind_attempt()` | `persistence/store.py` (5.3e) | no (tests only) |
| `HandoffService.request()` | `production/handoff.py` | runner hook (tests only) |

**Missing integration:** nothing between `build_job` and `adapter.submit` creates a nonce, appends it or binds it.
`job.prompt` is submitted as is.

## 2. Earliest safe point

The runner's `VALIDATING → READY` step. At that point the prompt is final (locks checked verbatim), the attempt row
exists, and nothing has touched Flow (`READY` is the last state before `UPLOADING`). Binding earlier (in
`build_job`) is unsafe: a job is rebuilt on every engine loop and on retry, so a nonce there would be regenerated.

## 3. Lifecycle

1. `EpisodeEngine` creates the attempt (unchanged), state `PENDING → VALIDATING`.
2. `nonce_binding.prepare_attempt(store, attempt, base_prompt, ctx)`:
   1. an existing preparation → verify it and return it (idempotent; no new nonce);
   2. refuse a base prompt that already carries a Blatifa nonce;
   3. `nonce = new_nonce()`; `final = append_nonce(base, nonce)`; check `NONCE_RE.findall(final) == [nonce]`;
   4. `Store.prepare_attempt(...)` in **one** `BEGIN IMMEDIATE` transaction: re-check (preparation exists → return
      it; attempt must be `VALIDATING`; no earlier binding; nonce unused), insert `attempt_preparation` (final prompt,
      both hashes, scene scope, context), insert `attempt_binding`, move the attempt `VALIDATING → READY` with
      `prompt_sha256 = sha256(base)` and a state event "prepared, not submitted";
   5. verify the persisted record against the base prompt and context.
3. `READY` step: before preflight, re-verify the preparation against `job` and the context; submit the **stored**
   final prompt. Any problem → `NEEDS_MANUAL_INTERVENTION / NONCE_BINDING_INVALID`, nothing submitted.
4. `HandoffService.request`: when a preparation exists it must verify; with `require_preparation=True` a missing
   preparation also refuses the handoff.

`prompt_sha256` keeps its existing meaning (hash of the scene prompt, used by `EpisodeEngine` to detect an edited
episode); the submitted prompt's hash is `attempt_preparation.final_prompt_sha256`.

## 4. Persistence

New table `attempt_preparation` (append-only by triggers; `nonce UNIQUE`). `attempt_binding` (5.3e) is reused
unchanged. Both rows and the state change are one transaction, so a READY attempt without binding, a binding without
a prepared prompt, or a half-written preparation cannot exist. A crash before the commit leaves no trace (the nonce
existed only in memory); a crash after it is resumed by the idempotent path.

## 5. Fail-closed rules

Changed prompt, scene, scene version, experiment, project, account fingerprint, a nonce bound to another attempt, a
stored prompt that does not match its hash, a nonce missing or present twice → refuse (no submit, no handoff).
Bindings are never edited or moved (triggers); a new attempt always gets a new nonce.

## 6. Out of scope

Any Flow submission, the LIVE episode mode, `LIVE_ACTIONS_ACTIVE`, the registry, the resolver
(`media_identity.py`), changing 5.3e tests, the UI.
