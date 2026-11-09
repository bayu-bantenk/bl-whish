# Phase 5.3f — Final audit

> **Ringkasan (ID):** Pengikatan nonce sudah diimplementasikan dan dibuktikan offline (375 tes terarah lulus).
> Regresi penuh ditunda karena disk < 10 GiB. Pengiriman ke Flow tetap nonaktif, dan tidak ada verifikasi live.

## Acceptance criteria (§10)

| # | Criterion | Result |
|---|---|---|
| 1 | Every prepared attempt receives one unique nonce | PASS |
| 2 | The exact nonce is embedded in the final prompt | PASS |
| 3 | The exact nonce is persisted against the correct attempt | PASS |
| 4 | The binding includes experiment, scene, project and account | PASS (scene via `attempt_preparation`) |
| 5 | Preparation is idempotent | PASS |
| 6 | Persistence is atomic or safely recoverable | PASS (one transaction; process-kill test) |
| 7 | Missing or mismatched bindings fail closed | PASS |
| 8 | The simulated runner creates a handoff only from a valid binding | PASS (with `require_preparation=True`; the default accepts a bare 5.3e binding, see the limitation) |
| 9 | Resolver logic unchanged | PASS (hash) |
| 10 | No actual Flow submission possible | PASS |
| 11 | `LIVE_ACTIONS_ACTIVE = False` | PASS |
| 12 | 18 `deny: true` rules unchanged | PASS |
| 13 | Existing tests intact | PASS (32/32 hashes) |
| 14 | Full regression when resources permit | DEFERRED (disk 6.9–7.1 GiB < 10 GiB); 375 targeted tests passed |

## Answers (§11)

1. **Where is the nonce first generated?** In `nonce_binding.prepare_attempt`, by `media_identity.new_nonce()`. The
   runner calls it in the `VALIDATING` step, only when no preparation exists for the attempt.
2. **When is it appended?** Immediately after it is generated, still in `VALIDATING`, by
   `media_identity.append_nonce(base, nonce)`. This is before the single transaction that moves the attempt to `READY`.
   The prompt is never changed after that.
3. **How is the final prompt hash verified?** `attempt_preparation` stores `final_prompt` and its SHA-256.
   `verify_preparation` recomputes the hash and checks five things: exactly the bound nonce, exactly once; final =
   base + nonce line; base hash = `scene_attempt.prompt_sha256`; base hash = the caller's prompt. It runs after
   preparation, again in `READY` before submission, and in `HandoffService.request`.
4. **How is the nonce bound?** By `Store.prepare_attempt`, in one `BEGIN IMMEDIATE` transaction:
   `attempt_preparation` + `attempt_binding` (nonce `UNIQUE`, both append-only) + attempt `VALIDATING → READY`.
5. **Can duplicate preparation append duplicate nonces?** No. An existing preparation is verified and returned.
   `append_nonce` refuses a prompt that already carries a nonce, and the transaction re-checks.
6. **Can a different scene reuse the binding?** No. The nonce is `UNIQUE` across attempts, rows cannot be updated
   (triggers), and verification compares episode, scene, version and attempt no.
7. **Can recovery resume without duplicating the nonce?** Yes. A crash before the commit leaves nothing (the nonce
   existed only in memory). A crash after the commit resumes in `READY` with the stored prompt. Both are tested,
   including a killed OS process.
8. **Can the simulated runner create a handoff?** Yes, from a valid binding only. Tested end to end up to
   `RECONCILED`, on a recorded page.
9. **Is actual Flow submission still impossible?** Yes. `LIVE_ACTIONS_ACTIVE = False`, the registry is unchanged,
   `EpisodeEngine` refuses LIVE, and the runner's only submit call goes to the injected adapter (simulated in all runs).
10. **What tests were deferred?** The full suite. Twelve modules were not run (listed in the test report). None of
    them imports a changed module.

Offline proof covers SQLite, the simulated adapter and a recorded detail page. Nothing was verified live: no live
submission, and no live `handoff ready` / `observe`.

## Verdict

**NONCE BINDING IMPLEMENTED — OFFLINE VERIFIED — LIVE SUBMISSION DISABLED**

Caveats: full regression deferred (disk), and the strict handoff default is still a proposal. Phase 5.3g and any
live test were not started.
