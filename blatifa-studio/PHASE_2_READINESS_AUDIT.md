# Phase 2 — Readiness Audit

> **Ringkasan (ID):** Fungsi Phase 1 tetap utuh.
>
> Fondasi Phase 2 yang tidak memakai kredit sudah dibangun dan dites. Isinya: state machine, SQLite, gerbang kredit dengan konfirmasi manual wajib, rekonsiliasi, pengolahan video, dan cek lock Octopus. Runner satu adegan sudah melewati semua skenario crash di Flow **simulasi** tanpa generate ganda. Pemeriksaan **live read-only** di Flow asli berhasil: identitas VERIFIED, kredit VERIFIED 50, UI sehat, dan "Confirm before generating = Always". Gerbang langsung **memblokir** karena disk penuh, sesuai rancangan.
>
> **Rekomendasi: NO-GO untuk uji live yang memakai kredit saat ini.** Ini akan menjadi **CONDITIONAL GO** setelah tiga syarat terpenuhi:
> 1. disk dibereskan;
> 2. Anda memberi izin langkah P2-3…P2-9;
> 3. anggaran kredit disetujui.
>
> Pengembangan yang tidak memakai kredit boleh dilanjutkan (**GO**).

Date: 2026-11-02 (16:30–17:15 WIB), with a re-check on 2026-11-03. Scope: Workstream A of the "Phase 2 Preparation & Storage Audit" brief.

## 1. What was audited

| Area | Source read / inspected | Finding |
|---|---|---|
| Phase 0 docs (12) | roadmap, state machine, data contract, system and credit architecture, UI discovery, audits | The Phase 2 scope is clear (roadmap §Phase 2). The cost text, progress, download and ffprobe facts are VERIFIED once (E-FLOW-12…16). Failure UI is UNVERIFIED |
| Phase 1 docs (3) + code | all source modules, registry, tests | PASS still holds. The full suite was re-run (§3) |
| BrowserEngine | `browser/engine.py`, `chrome.py` | Sound for Phase 2. It has **no download handling yet** (Playwright `expect_download` is needed in the adapter). Memory headroom on an 8 GiB machine is a real risk (see the storage audit) |
| FlowUIInspector / registry | `flow_locators.yaml` | VERIFIED locators exist for `composer.send` (credit_sensitive), `cost_confirmation.approve` (credit_sensitive), `always_approve` (deny), `media_detail.download_button`, `tile_menu.animate`/`download` (deny). **Missing:** a `Reject` radio, the stored-prompt/history text, a grid-tile enumeration usable for set difference, and the progress/thumbnail state of a tile. These need live evidence (P2-2) |
| Account/credit | `account/reader.py` | VERIFIED live again: balance **50** (40 at the end of Phase 1; the daily refresh at 15:37 happened in between). `ESTIMATED` is not produced yet. The ledger now provides `credits_spent()` for it |
| State machine | Phase 0 design → `production/states.py` | Implemented with 5 documented refinements (implementation plan §2) |
| Episode data contract | `EPISODE_DATA_CONTRACT.md`, `sample_episode.json` | Full Pydantic episode models are Phase 3 (not built). The lock library loader with hash verification is built for drift QC |
| Character lock | `sample_episode.json` | **Octopus lock text is byte-identical to the text in the brief**. SHA-256 `2af1471e…6f12` matches, status APPROVED. Locked by test `test_octopus_lock_in_master_data_is_exactly_the_users_text`; any change is refused (`LOCK_TAMPERED`) |

## 2. Evidence register (Phase 2 preparation)

Paths are relative to `docs/phase-2/evidence/`.

| ID | Claim | Status | Evidence |
|---|---|---|---|
| E-P2-01 | Illegal transitions are rejected (skipping the quote, resuming without reconciling, leaving terminal states, reconciling straight into a submit) | VERIFIED (unit) | `logs/pytest_unit.log` → `test_illegal_transitions_are_rejected` |
| E-P2-02 | Reconciliation never resubmits when credits may have been spent. Ambiguity, an open confirmation, an uninspectable page, or a tile error → manual | VERIFIED (unit) | `test_reconcile_*` |
| E-P2-03 | The approval gate fails closed: unparsed, ambiguous or over-cap cost; ≠ 1 video; unknown model; over balance; **no user confirmation** | VERIFIED (unit) | `test_approval_gate_fails_closed`, `test_approval_always_needs_explicit_user_confirmation` |
| E-P2-04 | The quote parser reads the verbatim Phase 0 agent text → cost 10, 1 video, Veo 3.1 - Lite | VERIFIED (unit, on recorded text) | `test_parse_observed_quote` |
| E-P2-05 | SQLite: WAL + `synchronous=FULL`; transitions are atomic and validated; `state_event`/`credit_ledger` are append-only (triggers); DB file is mode 600; the restart scan sends interrupted Flow-side attempts to RECONCILING | VERIFIED (unit) | `test_store_*`, `test_startup_scan_*` |
| E-P2-06 | ffprobe / full decode / last-frame extraction on the real Phase 0 Flow clip (SHA-256 `c9290efb…`, 720×1280, 190 frames). Invalid files are reported, not crashed on | VERIFIED (unit + CLI) | `test_media.py`, `logs/cli_local_smoke.log` |
| E-P2-07 | Lock drift check: verbatim / rewritten-with-key-phrases / smile-instead-of-pout | VERIFIED (unit + CLI) | `test_lock_drift_detection`, smoke log |
| E-P2-08 | Runner, happy path: one approval, a validated MP4 and a last-frame PNG in `episodes/<ep>/<scene>/v1/a1/`, ledger = 10 | PARTIALLY VERIFIED (simulated Flow + real ffmpeg) | `test_happy_path_produces_validated_video_and_last_frame` |
| E-P2-09 | Crash scenarios 1, 2, 3, 7 and 10, plus a crash before or after the Approve click, and a crash while the user is being asked: **approve called at most once** in every case | PARTIALLY VERIFIED (simulation, fault injection) | `test_crash_*`, `test_download_*`, `test_session_expiry_*`, `test_open_confirmation_after_crash_needs_a_person` |
| E-P2-10 | Render timeout, an ambiguous result (an extra tile created by the user) and lock drift → manual intervention, never regeneration | PARTIALLY VERIFIED (simulation) | `test_rendering_timeout_*`, `test_ambiguous_result_*`, `test_lock_drift_in_stored_prompt_*` |
| E-P2-11 | **Live read-only preflight** on real Flow: identity VERIFIED (fingerprint `d6c9f4583fa6`), credits VERIFIED 50, `project_idle` and `agent_settings` HEALTHY → **BLOCKED DISK_LOW** (0.4 GiB). With a wrong expected fingerprint → also IDENTITY_MISMATCH. Exit 2 both times. Chrome stopped afterwards | VERIFIED (live) | `logs/live_preflight.log` |
| E-P2-12 | The preflight only clicks Phase 1 controls (never Start generation / Approve / Upload) | VERIFIED (fixture) | `test_preflight_reads_everything_and_clicks_only_phase1_controls` |
| E-P2-13 | No credits spent by Blatifa: no code path submits on live Flow. The balance change 40 → 50 is the daily refresh | VERIFIED (code + live read) | static test, live log |
| E-P2-14 | The static forbidden-API test still passes for all new modules (no upload, typing, cookies, network interception, coordinate clicks) | VERIFIED | `test_source_never_uses_prohibited_browser_apis` |
| E-P2-15 | Logs and docs contain no e-mail addresses (the masked address in the live log is replaced) | VERIFIED (grep) | this session |

## 3. Test execution (actually run)

| Run | Result | Log |
|---|---|---|
| Unit tests after all changes | **95 passed** | `logs/pytest_unit.log` |
| Full suite (unit + local headless-Chrome browser tests; live opt-in skipped), 2026-11-03 | **120 passed, 7 skipped** | `logs/pytest_full.log` |
| Earlier full run during the memory/disk crisis | 99 passed, 21 setup errors: headless Chrome's debug port did not answer within 20 s (environment, not code). Passed after memory recovered | `logs/pytest_full_under_memory_pressure.log` |
| `ruff check src tests` | all checks passed | `logs/ruff.log` |
| Live, read-only (`blatifa account`, `blatifa preflight` ×2) | as E-P2-11 | `logs/live_preflight.log` |
| Live credit-consuming tests | **not run** (prohibited) | — |

## 4. Compliance with the restrictions

| Restriction | Complied | How |
|---|---|---|
| No upload / submit / Start generation / Approve / credits / YouTube | ✅ | No live adapter exists. The guard and the static test are unchanged. Live actions were limited to the Phase 1 read-only states |
| No automatic account switching | ✅ | No switching code. Mismatch → block |
| No automatic retry of a generation | ✅ | `FAILED → READY` is not taken automatically; timeouts → manual |
| Manual confirmation for every generation | ✅ (design + tests) | `approval_gate(..., user_confirmed)`; no auto-approve setting exists |
| No CAPTCHA/MFA bypass | ✅ | unchanged |
| Storage: nothing deleted, moved or modified; no snapshots touched; no profiles cleared | ✅ | read-only commands only. The 755 → 700 fix was made in code, not applied to disk |
| Octopus lock unchanged | ✅ | test-locked |
| Reference GitHub repo / git | ✅ | not touched |

## 5. Open items

| ID | Item | Severity |
|---|---|---|
| P2-U01 | Disk fell to 0.4 GiB free (swap 20 GiB) because of the leaking Next.js dev server. On 2026-11-03 the dev server was stopped (0 `node` processes): **16 GiB free, swap 5.4 GiB**. Still below the recommended 30 GiB | **Blocking** until ≥ 30 GiB (2 GiB hard minimum now met) |
| P2-U02 | Real `GoogleFlowAgentAdapter` not implemented. Needs locators for Reject, stored prompt, tile state, and download (P2-2/3) | Blocking for live |
| P2-U03 | Prompt-fidelity (U-01) still unknown; the Go/No-Go experiment needs ≈ 100 credits | Blocking for Phase 3 |
| P2-U04 | Octopus key-phrase list for drift QC awaits your approval | Medium |
| P2-U05 | Credit refresh semantics (top-up to a cap vs + N per day) UNVERIFIED (40 → 50 observed once) | Low |
| P2-U06 | No user-facing "accept drift" path yet (manual review only) | Low (Phase 3 QC) |
| carried | U-02, U-04a, U-06, P1-U02, P1-U03, P1-U05 | as before |

## 6. Recommendation

| Activity | Verdict |
|---|---|
| Further non-credit development (P2-2 read-only adapter parts, using the same read-only rules as Phase 1) | **GO** |
| Controlled live testing that spends credits (P2-6 … P2-9) | **NO-GO now**. It becomes **CONDITIONAL GO** when (1) free disk is ≥ 30 GiB (at minimum the enforced 2 GiB) and the leak is stopped, (2) you authorize the specific steps and a credit budget (proposed ≤ 160), (3) the Octopus key phrases are approved |

---

## 7. Update — 2026-11-03 (Phase 2 continuation, no-credit only)

> **Ringkasan (ID):**
> - Adapter Flow (baca saja) selesai, dengan kategori hasil dan tingkat keyakinan locator. Semua aksi yang mengubah sesuatu **BLOCKED**.
> - Runner diuji dengan sapu crash menyeluruh. **Satu bug pencatatan kredit ditemukan dan diperbaiki.**
> - Kebocoran postcss dianalisis: bukan proses yatim, siklus start/stop bersih, tapi pemicunya belum bisa direproduksi.
> - Rencana pembersihan disk per path sudah dibuat. Disk kini **18 GiB** kosong.
> - Putusan **tidak berubah**: GO untuk pengembangan tanpa kredit, NO-GO untuk uji live yang memakai kredit.

Deliverables: `PHASE_2_ADAPTER_PROGRESS.md`, `SINGLE_SCENE_RUNNER_AUDIT.md`, `POSTCSS_PROCESS_LEAK_ANALYSIS.md`, `STORAGE_CLEANUP_PLAN.md`.

### 7.1 Tests executed (`evidence/logs/pytest_full_continuation.log`, `ruff_continuation.log`)

**178 passed, 7 skipped (live, opt-in), 0 failed**; ruff clean (src, tests, tools).

| Group | Files | Passed | Kind |
|---|---|---|---|
| Unit (core, production, media, readers, harness) | `test_core`, `test_production`, `test_media`, `test_flow_readers`, `test_devserver_tool` | 39 + 36 + 5 + 29 + 2 | unit; readers run on **recorded live snapshots offline** |
| Mock-adapter integration + crash recovery | `test_runner_simulation`, `test_scene_and_crash_sweep` | 17 + 21 | **SIMULATED** Flow, real SQLite/ffmpeg/files |
| Browser (local fixtures, headless Chrome) | `test_flow_adapter`, `test_account_and_capture`, `test_validator_and_health`, `test_engine_recovery` | 5 + 7 + 14 + 4 | **SIMULATED** UI (fixture pages), incl. Phase 1 regression |
| Security / privacy | forbidden-API static scan over all new code, redaction, leak check, profile isolation, click guard (now also requires `confidence: high`) | included above | unit / fixture |
| Live Flow | `test_flow_live` | 0 (7 skipped) | **not run**: no Flow session was opened in this round |

Phase 1 tests changed in this round (both caused by the new confidence rule, intent unchanged):
- `test_core._entry` now declares `confidence: high` for a clickable entry.
- `test_unverified_locator_is_untrusted_and_never_clicked` downgrades to `UNVERIFIED` **and** `confidence: low`, because the schema no longer allows high without VERIFIED.

### 7.2 Status summary

| Item | Status |
|---|---|
| Read methods of the Flow adapter (grid, confirmation, stored prompt) | PARTIALLY VERIFIED (recorded live evidence, parsed offline) + SIMULATED (fixture) |
| Write/credit methods of the adapter (attach, upload, submit, approve, reject, download) | **BLOCKED** (raise before touching the page) |
| Media-id resolution of a finished tile | PROPOSED |
| Locator confidence + outcome classes | VERIFIED (unit) |
| Single-scene runner incl. crash sweep, uncertain outcomes, manual confirmation | SIMULATED |
| Ledger accounting after a crash past the Approve click | bug found and fixed; SIMULATED regression |
| Octopus lock unchanged | VERIFIED |
| PostCSS leak: mechanism (Turbopack pool, not orphans), clean lifecycle | VERIFIED (live observation + clone) |
| PostCSS leak: trigger | **UNVERIFIED** (not reproduced in 6 scenarios) |
| Storage cleanup plan | PROPOSED (nothing deleted) |

### 7.3 Updated verdict

| Activity | Verdict |
|---|---|
| Non-credit development | **GO** |
| Read-only live validation of the new medium-confidence locators (no clicks; open project + an existing video page) | **CONDITIONAL GO**: needs your explicit OK, because this round's brief said not to use real Flow for the adapter |
| Live credit-consuming testing | **NO-GO** (unchanged) |

### 7.4 Exact remaining blockers before credit-consuming testing

1. **Authorization** for each state-changing step (attach/Animate or upload, submit, Approve, Reject, download) and a **credit budget** (proposed ≤ 160).
2. **Live read-only validation** of `grid.*`, `media_detail.history_*`, `reuse_prompt`, `expand_prompt` (A1). Approve and Reject must reach `confidence: high` through a live health check of an *open* confirmation before they can ever be clicked (A2).
3. **Media-id resolution** for a finished tile (A3, PROPOSED; requires a click).
4. **Disk**: 18 GiB free now, target ≥ 30 GiB. `STORAGE_CLEANUP_PLAN.md` category A alone gives about 38 GiB.
5. **Decisions**: Octopus key phrases for drift QC; U-02 (credit strategy); U-06 (Blatifa/style locks are DRAFT, so `prepare_scene` refuses S01 in production mode); U-04a (Animate as start frame); P1-U02/U03.
6. **U-01 prompt fidelity**: still unknown; needs the credit-consuming experiment.
