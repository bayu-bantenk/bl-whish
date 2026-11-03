# Single Scene Runner — Audit (offline / mock-based)

> **Ringkasan (ID):** Runner satu adegan diuji ulang secara menyeluruh dengan **Flow simulasi**. Database, file, ffmpeg, dan validasi lock memakai yang asli.
>
> **Sapu crash menyeluruh:** proses "dibunuh" di **setiap titik** (setiap panggilan ke Flow dan setiap tulisan ke database), satu kali per titik. Selain itu, crash juga diulang berkali-kali dalam satu skenario, termasuk saat pemulihan berjalan.
>
> **Invarian yang dicek:**
> - Approve paling banyak satu kali.
> - Tidak pernah submit ulang setelah ada percobaan Approve.
> - Tidak pernah submit saat konfirmasi biaya masih terbuka.
> - Kredit tercatat dengan benar.
>
> **Satu bug nyata ditemukan dan diperbaiki.** Jika crash terjadi tepat setelah klik Approve tapi sebelum ledger mencatat "approved", video tetap jadi, tapi 10 kredit tidak tercatat. Sekarang rekonsiliasi mencatatnya.
>
> Semua hasil di dokumen ini **SIMULATED**, bukan uji Flow live.

Date: 2026-11-03. Code: `src/blatifa/production/{runner,scene,reconcile,gates,states}.py`, `persistence/store.py`.

## 1. Coverage against the brief

| Requirement | How it is tested | Kind | Status |
|---|---|---|---|
| Scene initialization | `prepare_scene` from `sample_episode.json`: scene lookup, mode (only IMAGE_TO_VIDEO allowed), ratio/duration from defaults, start frame | unit, real JSON | SIMULATED/VERIFIED (local) |
| Prompt preparation | contract §5 layout; lock text inserted verbatim; same input → same SHA-256; hash stored on the attempt (`prompt_sha256`) | unit | VERIFIED (local) |
| Character Lock validation | hash check (`LOCK_TAMPERED`); unknown lock; DRAFT lock refused in production mode (`LOCK_NOT_APPROVED`, which is true for the sample's Blatifa/style locks, U-06); runner refuses a prompt in which a lock is not verbatim (`LOCK_NOT_IN_PROMPT`) **before touching Flow**; lock-drift QC on the stored prompt | unit + simulation | VERIFIED (local) / SIMULATED |
| Octopus lock unchanged | byte comparison with the brief's text + hash `2af1471e…6f12` | unit | VERIFIED |
| Pre-generation credit gate | preflight blocks (identity, credit unknown/insufficient, disk, UI, confirm policy); pause before any Flow call | unit + simulation | SIMULATED |
| Manual confirmation | asked **exactly once per generation**, with the parsed quote (10 / 1 video / Veo 3.1 - Lite); decline → Reject path (blocked in the real adapter) → manual, no approve; bad quote → never asked | simulation | SIMULATED |
| State persistence / checkpoints | full event sequence after reopen; asset hashes match files; startup scan finds nothing to resume | simulation + real SQLite | SIMULATED |
| Download handling (mock responses) | junk HTML, landscape 2 s clip, truncated MP4 → `INVALID_ASSET` (no regeneration); empty file → 3 retries → `DOWNLOAD_FAILED`; transient failures → retried; no `.part` left behind | simulation + real ffmpeg | SIMULATED |
| Media validation & last frame | real ffprobe / full decode / last-frame on the Phase 0 Flow clip | unit | VERIFIED (local file) |
| Crash recovery | scenarios 1, 2, 3, 7, 10 + crash before/after the Approve click + crash while asking the user | simulation | SIMULATED |
| Duplicate generation prevention | crash sweep invariants (§2) | simulation | SIMULATED |
| Uncertain outcome | ledger `approving` and no result → wait out the grace period → manual, ledger `unknown_after_crash`; unknown tile → wait → manual; unresolvable media id → manual; UI unreadable ×3 → manual | simulation | SIMULATED |
| Scene chaining | S01 → FRAME_READY → S02 starts from S01's recorded last frame; S02 before S01 → `FRAME_NOT_READY` | simulation | SIMULATED |

## 2. Exhaustive crash sweep

Mechanism (`tests/unit/test_scene_and_crash_sweep.py`, `tests/unit/simflow.py`):
- **Crash points:** every simulated Flow call (snapshot, attach, submit, approve-before-click, approve-after-click, observe, stored_prompt, download) and every committed store write (each transition, each ledger entry, each asset record).
- **A crash:** a `BaseException` that the runner cannot catch. The DB is reopened and `startup_scan()` runs, as after a computer restart.
- **Sweep A:** a single crash at each point k = 1…N (N ≈ 35 points in a clean run).
- **Sweep B:** repeated crashes every 2nd, 3rd and 5th point across the whole scenario, including during reconciliation (up to 200 restarts).

Invariants asserted after every scenario:
1. `approve` attempted at most once, and at most one generation landed.
2. **No submit after any approve attempt** (credits may have been spent).
3. **No submit while an earlier cost confirmation is still open.**
4. The final state is `FRAME_READY` or `NEEDS_MANUAL_INTERVENTION`, never a silent loop.
5. If a generation landed, the ledger counts it (confirmed or uncertain). Confirmed spend is never more than 10.
6. On `FRAME_READY`, the video and final-frame records exist and the hash matches the file.
7. A second effective submit happens only when the crash hit **before** the first submit reached Flow (`commit:GENERATING` or the submit call itself).

### Bug found by the sweep (fixed)

| | |
|---|---|
| Scenario | crash **after the Approve click landed**, before `ledger: approved` was written |
| Before the fix | Recovery correctly found the tile and finished the scene (no double spend), but the ledger stayed at `approving`, so `credits_spent()` reported **0 instead of 10**. Later credit estimates would have been too optimistic |
| Fix | `_reconcile` writes `approved` when a result of the attempt is found, and `unknown_after_crash` when it escalates to manual with an `approving` ledger. `credits_spent(include_uncertain=True)` counts uncertain spend for conservative estimates |
| Regression tests | `test_crash_around_approve_never_double_spends` (ledger assertions), crash sweep invariant 5 |

## 3. Design points re-checked

| Rule | Implementation | Evidence |
|---|---|---|
| Recovery never auto-submits when credits may have been spent | `decide()`: ledger approving/approved/unknown or a Flow-side state after the quote → never `READY`; open or unknown confirmation → manual | unit + sweep |
| Every resume passes RECONCILING | `resume()` and `startup_scan()`; illegal transitions rejected by the state table | unit |
| No automatic retry of generation | `FAILED` is terminal for `run()`; retry needs a new user action | simulation |
| Write-ahead ledger | `approving` committed before the click (asserted in tests) | simulation |

## 4. Limits (honest)

- All Flow behaviour here is **simulated** by `FakeFlow`. Real Flow timing, wording, failure screens and the virtualised grid are only partly represented (see `PHASE_2_ADAPTER_PROGRESS.md` §5).
- The sweep covers crashes at *call boundaries*. A crash *inside* a browser click (half-delivered event) is modelled only for Approve (before/after click).
- `prepare_scene` is a Phase-2-sized subset. The full Pydantic episode model (Phase 3) is not built.
