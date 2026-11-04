# Phase 5.2.1 — Implementation Report (Evidence-Based Registry Correction)

> **Ringkasan (ID):** Locator `grid.video_thumbnail` direklasifikasi dari **BROKEN** menjadi **STATE_DEPENDENT**, berdasarkan bukti live Phase 5.2. Locator ini cocok di keadaan diam setelah halaman dimuat, dan tidak ada lagi setelah tile di-hover.
>
> Perubahannya kecil dan kompatibel:
> - satu nilai status baru;
> - satu field opsional `state_condition`.
>
> Riwayat Phase 1 dan Phase 5 tetap tercatat di entri. Dokumen Phase 5 tidak diubah.
>
> Runner, state machine, dan kesiapan produksi **tidak berubah**. Karena free disk 6,6 GiB (< 10 GiB), suite penuh, Chrome, dan test berat **tidak dijalankan**.

Date: 2026-11-04 08:17–08:30 WIB. No live session, no Chrome, no credits.

## 1. Disk safety gate (brief §4)

| Time | Free (`df -h`) | Swap used | Decision |
|---|---|---|---|
| 08:17:39 | **6.6 GiB** (7087 MB `df -H`) | 7.85 of 8.0 GiB | below 10 GiB → no full suite, no Chrome, no memory-intensive tests; **blocker reported** |
| 08:19:44 (before the light tests) | 7.1 GiB | 7.49 GiB | light unit subset only |
| 08:19:52 (after) | 7.1 GiB | 7.48 GiB | unchanged |

Nothing was deleted. The cause is macOS swap (8 swap files); see the Phase 5.2 audit.

## 2. Evidence reviewed

| Source | Content | Role |
|---|---|---|
| Registry entry before this task | BROKEN / low, evidence = Phase 5 probe; notes: "0 matches in 4 observations" | historical |
| `docs/phase-5/evidence/live/20261103T074352Z…`, `…074618Z…` | 4 observations, `<video>` present, no thumbnail (user had just opened the video) | historical, kept |
| `docs/phase-5.2/evidence/live/20261103T141714Z-live-probe` | 8 rest-state observations: thumbnail inside `flow-video-tile`, no `<video>` | basis of the correction |
| `docs/phase-5.2/evidence/live/20261103T141225Z-live-probe` | `<video>` before the reload; thumbnail 4 s after the reload | supporting |
| `hover_test_on.log` / `hover_test_off.log` | hovered: playing `<video>`; afterwards: paused `<video>`, thumbnail not back | basis of the condition |
| Phase 5.2 register E-P52-02…05, E-P52-30; Phase 5.2 audit §2 | the PROPOSED reclassification | carried out here |

## 2a. Schema change (smallest backward-compatible representation)

| Item | Before | After |
|---|---|---|
| `LocatorStatus` | VERIFIED, PARTIALLY_VERIFIED, UNVERIFIED, BROKEN, DEPRECATED | + **STATE_DEPENDENT** |
| `LocatorEntry` | — | + optional `state_condition: str \| None` |
| Validation | VERIFIED needs `verified_at` + `evidence`; HIGH needs VERIFIED | + STATE_DEPENDENT ⇔ `state_condition` present; STATE_DEPENDENT needs `verified_at` + `evidence` (HIGH stays impossible) |

Effect on existing consumers:
- **Click guard and authorization clicks** require VERIFIED + high, so the entry stays unclickable.
- **Validator** treats non-VERIFIED entries as UNTRUSTED unless discovery is explicitly allowed.
- **Adapter:** the legacy "finished" path still requires VERIFIED, so it stays unused.
- **Authorization reads** now report `LOCATOR_STATE_DEPENDENT:<ref>` (previously `LOCATOR_BROKEN`).
- Every other registry entry and YAML file is unaffected.

## 3. Exact registry change (`src/blatifa/inspector/data/flow_locators.yaml`, `grid.video_thumbnail`)

| Field | Before | After |
|---|---|---|
| status | `BROKEN` | `STATE_DEPENDENT` |
| confidence | `low` | `low` (unchanged) |
| verified_at | `2026-11-02T15:24:20+07:00` (Phase 1) | `2026-11-03T21:13:11+07:00` (first Phase 5.2 rest-state observation) |
| evidence | `docs/phase-5/evidence/live/20261103T074618Z-live-probe/live-probe.json` | `docs/phase-5.2/evidence/live/20261103T141714Z-live-probe/live-probe.json` |
| state_condition | — | rest state after a page load inside `flow-video-tile`; absent once hovered (playing `<video>`, then a paused `<video>`), with references to the hover logs |
| notes | Phase 5 BROKEN text | **History kept:** Phase 1 VERIFIED/medium; Phase 5 0 matches → BROKEN (with its evidence path); Phase 5.2 reinterpretation; Phase 5.2.1 reclassification; "never means finished, never an identity, never a completion signal" |
| strategy / role / name / validate | role img "Generated video thumbnail", [present] | unchanged |

## 4. Code and test changes

| File | Change |
|---|---|
| `src/blatifa/inspector/registry.py` | the schema change in §2a |
| `src/blatifa/production/authorization.py` | read reason `LOCATOR_STATE_DEPENDENT` |
| `tests/unit/test_phase5_2_1_registry_correction.py` | **new**, 9 tests (§5) |
| `tests/unit/test_phase5_1_recognition.py` | expectation BROKEN → STATE_DEPENDENT |
| `tests/unit/test_phase5_live_evidence.py` | expectation BROKEN → STATE_DEPENDENT; now also **requires** the Phase 5 history (evidence path and "BROKEN") to stay in the notes |
| `tests/unit/test_phase4_authorization.py` | exact read reasons: `LOCATOR_BROKEN` → `LOCATOR_STATE_DEPENDENT` (still flagged, same count) |

**Not changed:** runner, episode state machine, reconcile, gates, adapter, recogniser (the rest-state recognition already came from Phase 5.2), authorization activation, mutation methods, Phase 5 / 5.2 documents and evidence.

One known naming leftover: the adapter's compat note is still called `LEGACY_VIDEO_LOCATOR_BROKEN`. It means "the old thumbnail is not used as completion", which remains true. Renaming it would change two browser tests that cannot be run under the disk gate, so it is left for a session with ≥ 10 GiB free.

## 5. Tests

**Run (light subset):** 16 unit files, **235 passed, 0 failed**, 7.9 s.
- They include the 9 new tests and the 3 updated files.
- They also cover the runner-compatibility simulations (`test_phase5_1_runner_compat.py`, small), the production and reconcile tests, and the temp-isolation tests.

**Deferred** under the disk gate (134 of 369 collected, including the 7 opt-in live tests): `tests/browser/*`, `test_episode_e2e.py`, `test_scene_and_crash_sweep.py`, `test_runner_simulation.py`, `test_phase4_ui.py`, `test_phase4_readiness.py`. They were last run green in Phase 5.2 (353 passed) **before** this change. The change only touches the status of one read-only locator and one read reason.

**Lint:** `ruff check src tests tools`, clean.

## 6. File inventory

- **New:** `docs/phase-5.2.1/*`, `tests/unit/test_phase5_2_1_registry_correction.py`.
- **Modified:** as listed in §4 and the registry YAML.
