# Phase 2 — Implementation Plan (Single Scene Production)

> **Ringkasan (ID):** Fondasi Phase 2 yang **tidak memakai kredit** sudah dibangun dan dites:
> - state machine
> - SQLite write-ahead
> - gerbang kredit (wajib konfirmasi manual per generate)
> - rekonsiliasi setelah crash
> - pengolahan video (ffprobe, decode, frame terakhir)
> - cek *lock drift* Octopus
> - runner satu adegan yang diuji dengan Flow simulasi
>
> Yang **belum** dibangun adalah adapter Google Flow yang sungguhan. Bagian ini butuh uji langsung yang memakai kredit, jadi harus menunggu otorisasi Anda. Rencana di bawah memecahnya menjadi langkah kecil. Setiap langkah punya bukti yang harus didapat dan status izinnya. Langkah yang memakai kredit **tidak** akan dijalankan tanpa izin eksplisit dan anggaran yang Anda setujui.

Status labels: VERIFIED (tested), PARTIALLY VERIFIED (simulation or fixture only), PROPOSED, UNVERIFIED, BLOCKED.

## 1. Scope (from IMPLEMENTATION_ROADMAP.md, Phase 2)

`GoogleFlowAgentAdapter`, plus the following:
- Attach the start image.
- Submit.
- Parse the cost quote.
- Approve or reject.
- Poll.
- Identify the result by set difference.
- Download.

Also in scope:
- `VideoProcessingEngine`.
- Minimal SQLite.
- The state machine core, including `RECONCILING`.
- The spending gate.
- The prompt-fidelity experiment.
- CLI `blatifa run-scene`.

Acceptance:
- 3 consecutive end-to-end runs.
- Crash scenarios 1, 2, 3, 7 and 10 with no duplicate generation.
- Never approve when the quote is missing or above the cap.
- The output file is valid and its frame is extracted.
- Go/No-Go: Octopus lock key phrases survive in ≥ 9 of 10 trials.

## 2. Built in this preparation step (no credits)

| Component | File | Status | Evidence |
|---|---|---|---|
| Scene states + legal transitions | `production/states.py` | VERIFIED (unit) | `test_production.py` (illegal transitions, credit-sensitive reachability) |
| Reconciliation rules | `production/reconcile.py` | VERIFIED (unit) | 7 decision tests |
| Spending gates (preflight + approval, fail-closed, mandatory user confirmation) | `production/gates.py` | VERIFIED (unit); preflight also VERIFIED live, read-only | `test_production.py`, `logs/live_preflight.log` |
| Live preflight collection | `production/preflight.py`, `blatifa preflight` | VERIFIED (fixture + live, read-only) | browser test, live log |
| SQLite store (WAL, `synchronous=FULL`, append-only triggers, mode 600, startup scan) | `persistence/store.py` | VERIFIED (unit) | 4 store tests |
| Video processing (ffprobe, full decode, last frame `-sseof` → frame-select fallback) | `media/video.py`, `blatifa media` | VERIFIED on the real Phase 0 Flow clip | `test_media.py`, `logs/cli_local_smoke.log` |
| Safe paths, atomic `.part` → fsync → replace, no overwrite, no symlinks | `media/files.py` | VERIFIED (unit) | `test_safe_paths_and_atomic_placement` |
| Lock library loader with SHA-256 check; drift check (VERBATIM / KEY_PHRASES_ONLY / LOCK_DRIFT_SUSPECTED) | `qc/locks.py`, `blatifa lock-check` | VERIFIED (unit + CLI) | Octopus lock test, smoke log |
| Single-scene runner over a `FlowAdapter` interface | `production/runner.py` | **PARTIALLY VERIFIED** (simulated Flow only) | `test_runner_simulation.py` (16 tests incl. fault injection) |
| P1-U04 `account.md` enum repr | `cli.py` | fixed | report output |
| Reports parent folder forced to 700 | `inspector/report.py` | VERIFIED (unit) | `test_report_dirs_and_their_parent_are_private` |

### Design refinements against Phase 0 (PROPOSED → implemented)

1. **Any non-terminal state may go to `NEEDS_MANUAL_INTERVENTION`**, not only the states listed in the Phase 0 diagram. Reason: a broken locator or an identity mismatch can surface at any step.
2. **`RECONCILING → DOWNLOADED`** when the downloaded file still exists and matches its recorded hash. Local steps are re-run without touching Flow.
3. **An unanswered cost confirmation found during reconciliation → manual intervention.** Phase 0 said "re-evaluate cost" instead. Reason: someone could still approve the open confirmation, and resubmitting would then double-spend.
4. **The grace period counts from the start of reconciliation**, not from the approve time. This is conservative: the runner waits at least that long.
5. **The approval gate asks the user only when everything else already passes.** Bad quotes are rejected without asking.

## 3. Remaining Phase 2 work, in order

| Step | Work | Flow actions needed | Credits | Authorization | Status |
|---|---|---|---|---|---|
| P2-1 | Free disk (≥ 30 GiB recommended, ≥ 2 GiB enforced) and stop the leaking dev server | none | 0 | user action | **BLOCKED** (0.4–5 GiB free) |
| P2-2 | Read-only adapter parts: `snapshot_media` (enumerate grid tiles plus image `data-media-id`), `observe` (tile % and thumbnail), `stored_prompt` (history text on `/edit/<uuid>`). New registry entries with live evidence | read DOM; open an existing video's detail page | 0 | same as Phase 1 (read-only) | PROPOSED |
| P2-3 | Download of an **existing** video: `Download media → 720p Original size`, via Playwright `expect_download`, saved as `.part`. This needs a narrow exception in the click guard (`download_button`, `tile_menu.download` are `deny` today) | clicks Download on an existing video | 0 (VERIFIED free in Phase 0, E-FLOW-14) | **needs your OK** (changes a deny rule) | PROPOSED |
| P2-4 | `attach_start_image` from an existing Flow image (tile ⋮ → Animate → ingredient chip), then **clear the composer without sending** | Animate (deny today) | 0 | **needs your OK** | PROPOSED; U-04a open |
| P2-5 | Upload of a local start image | upload (`set_input_files`, forbidden by the static test) | 0 | **needs your OK** (prohibition) | BLOCKED by rule |
| P2-6 | `submit` → read the confirmation → `reject` (proves parsing on live text with no spend; whether Reject costs anything is UNVERIFIED) | Start generation, Reject | 0 expected (UNVERIFIED) | **needs your OK** ("never submit prompts") | BLOCKED by rule |
| P2-7 | `approve` path + `run-scene` CLI with an interactive terminal confirmation ("Approve 10 credits for S01? type YES") | Approve | 10 per run | **needs your OK + budget** | BLOCKED by rule |
| P2-8 | Prompt-fidelity experiment: 10 trials (agent instruction + verbatim wrapper), stored prompt checked with `lock-check` | as P2-7 | ≈ 100 | **needs your OK + budget** | BLOCKED |
| P2-9 | Live crash tests 1, 2, 3, 7, 10 (kill the process at each state; reconcile) | as P2-7 | ≈ 50 | **needs your OK + budget** | BLOCKED; simulation PASSED |
| P2-10 | Capture insufficient-credit and session-expired UI text when it occurs naturally | — | — | — | UNVERIFIED (P1-U05) |

Suggested total test budget: **≤ 160 credits**. With 50 credits now and the daily refresh, that is about 3–4 days. For comparison, the Phase 0 roadmap proposed ≤ 100 credits before the crash tests were counted.

## 4. Safety design for the live adapter (PROPOSED)

- The adapter never decides to spend. Only `SceneRunner._decide_on_quote` calls `approve()`. It does so after `approval_gate` passes **and** the user confirmed that specific quote.
- Planned guard: `approve` and `send` stay `credit_sensitive`. The click guard gets a separate entry point that requires a one-time confirmation token from the runner. All other code paths keep refusing these clicks.
- `Always approve` stays `deny` forever. "Confirm before generating = Always" is checked in every preflight (verified live).
- No automatic retry of a generation: `FAILED → READY` only on explicit user request (`RetryPolicy.require_user_approval_for_retry = True`).
- No account switching: the preflight blocks on any fingerprint mismatch, and an unbound profile also blocks.

## 5. Decisions needed from the user

1. Disk cleanup (P2-1). See `STORAGE_CLEANUP_RECOMMENDATIONS.md`.
2. Authorization for steps P2-3 … P2-9, individually or as a set, and the credit budget.
3. **Octopus key phrases** for drift QC. PROPOSED: every sentence of the lock, i.e. "small rounded protruding circular pout", "ABSOLUTELY PRESERVE THIS OCTOPUS MOUTH", "Do NOT turn the Octopus mouth into a normal smiling mouth", "Do NOT make the mouth wide", "Do NOT flatten the mouth", "Do NOT remove the protruding circular pout". The lock text itself is unchanged and verified (`sha256 2af1471e…6f12`).
4. U-02 (credit strategy), U-06 (Blatifa lock is still DRAFT), and U-04a (whether Animate behaves as a start frame).
5. P1-U02 (delete the old discovery profile?) and P1-U03 (was the pink octopus upload yours?).
