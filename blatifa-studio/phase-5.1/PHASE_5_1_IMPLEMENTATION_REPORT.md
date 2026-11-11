# Phase 5.1 — Implementation Report (Media Recognition & Runner Compatibility)

> **Ringkasan (ID):**
> - **Pengenal tile baru:** mengenali VIDEO / IMAGE / CHARACTER / UNKNOWN / AMBIGUOUS hanya dari struktur DOM yang teramati live di Phase 5. Status video ditentukan oleh **sinyal bernama** yang masing-masing berlabel tingkat bukti.
> - **Aturan "selesai":** butuh minimal dua sinyal VERIFIED dari dua kelompok yang independen. Saat ini **belum ada satu pun sinyal VERIFIED**, jadi video selesai di UI live terbaca **UNKNOWN**. Ini disengaja, bukan bug.
> - **Adapter** berhenti memakai locator lama yang BROKEN. Runner dan state machine tidak berubah.
> - Semua dikerjakan offline. Tidak ada sesi Flow, klik, atau kredit.

Period: 2026-11-03 15:50–16:30 WIB. Labels: VERIFIED LIVE (only from Phase 5 live files) · VERIFIED OFFLINE · PARTIALLY VERIFIED · SIMULATED · UNVERIFIED · BLOCKED.

## 1. Safety audit results

See the plan §1. In short:
- Baseline was 283 passed, 7 skipped, 0 failed, **before** any change (`evidence/logs/pytest_baseline.log`).
- Temp isolation is intact. A real sentinel `pytest-of-<user>/pytest-sentinel-p51` survived the isolation tests, the baseline run and the final run.
- Mutation methods are BLOCKED, and there is no network instrumentation.
- The macOS restart had already emptied the system temp folder, so the earlier `pytest-46` and the kept failed runs are gone. This was not done by Blatifa.

## 2. Tile recognition (`src/blatifa/flow/media_recognition.py`)

**Type.** The custom tile element **and** its expected content must both be present. Both were observed live in Phase 5.

| Type | Requires | Otherwise |
|---|---|---|
| VIDEO | `flow-video-tile` + `<video>` | container without video → UNKNOWN |
| IMAGE | `flow-image-tile` + img alt "Tile displaying a user's image" | → UNKNOWN |
| CHARACTER | `flow-character-tile` + img alt "Character thumbnail" | → UNKNOWN |
| AMBIGUOUS | two tile kinds, or a tile showing another kind's thumbnail | — |
| UNKNOWN | anything else. This includes a `<video>` outside a video tile, and the old-UI thumbnail alone ("its locator is BROKEN, so it proves nothing") | — |

**Video state signals.**

| Signal | Group | Indicates | Evidence today | Counted for completion? |
|---|---|---|---|---|
| `video_element_with_src` | dom_structure | completed | OBSERVED: seen live on the one finished video, never on an unfinished one, so it does not discriminate | no |
| `media_metadata_loaded` (readyState ≥ 1, finite duration > 0) | media_metadata | completed | NONE: not recorded live | no |
| `media_dimensions` (videoWidth, videoHeight > 0) | media_metadata | completed | NONE | no |
| `duration_text` ("0:08") | tile_text | completed | NONE: absent on the live finished tile | no |
| `progress_text` ("40% …") | tile_text | generating | RECORDED_OLD_UI (E-FLOW-13) | yes, for GENERATING only (flagged low confidence) |

**Rules:**
- VIDEO_COMPLETED needs ≥ 2 counted signals from **different** groups, each VERIFIED.
- A completion-type signal together with progress text is a conflict → VIDEO_UNKNOWN.
- VIDEO_FAILED and VIDEO_PENDING have no signal at any evidence level, so they are never produced. A text like "Something went wrong" stays UNKNOWN.
- Nothing is inferred from time, order or the mere presence of an element.

**Shipped policy.** It equals the evidence table above, so **VIDEO_COMPLETED is unreachable in production**. A test pins this. Test-only policies (all signals VERIFIED) exercise the two-signal logic and are never used in `src`.

**Repeated observation (`StabilityTracker`).**
- History is kept per session-local key (the tile title within one page session; never an identity).
- Stable means the last N observations are identical, with N ≥ 2.
- These cases give VIDEO_UNKNOWN: changing states, a tile missing from a recent snapshot, completed earlier but not now, or two tiles sharing a title.
- Transitions are recorded. The tracker does not sleep; the caller paces observations.
- Design fix during the phase: the first key included the video `src`. A tile's `src` may appear or change with its state, which would break the history, so the key became the title alone, and duplicate titles are treated as ambiguous.

**Read-only probe extension.** `TILE_PROBE_JS` now also reads the video properties `readyState`, `duration` (`null` if not finite), `videoWidth` and `videoHeight`. These are property reads only. They do not trigger loading and send no event.

## 3. Runner compatibility

| Requirement | Implementation | Evidence |
|---|---|---|
| The broken old locator is explicitly recorded and never silently used | The adapter treats the old thumbnail as "finished" only while `grid.video_thumbnail` is VERIFIED. It is BROKEN, so a new tile with it becomes `state_known=False`, and `compat_notes` records `LEGACY_VIDEO_LOCATOR_BROKEN:<title>` | `test_flow_adapter.py` (changed assertion, §5), `test_adapter_v2_grid.py` |
| The new reader is used only when evidence-backed | New tiles go through `recognize` + `StabilityTracker` + `runner_tile`. Only a *stable* VIDEO_COMPLETED gives `complete=True`, which cannot happen with the shipped policy | unit + fixture tests |
| Unknown state blocks dependent scenes | Runner unchanged: unknown → polling → `RENDER_TIMEOUT` → NEEDS_MANUAL_INTERVENTION. The dependent stays BLOCKED_BY_DEPENDENCY and is never submitted | `test_unrecognised_result_never_completes_and_blocks_dependents` (live video structure and character tile) |
| Missing media identity blocks association | complete without an id → `MEDIA_ID_UNRESOLVED` → manual; no frame; dependent blocked | `test_completed_without_identity_blocks_association` |
| No wrong-scene assignment | More than one new tile → `AMBIGUOUS_RESULT`. Each scene's pre-submit snapshot excludes earlier results, so each scene gets only its own new tile | `test_two_new_results_are_never_split_between_scenes`, `test_each_scene_gets_only_its_own_new_result` |
| No automatic retry / Approve / Reject added | 1 approval per scene, 0 downloads on unknown | same tests |
| Checkpoint and crash recovery intact | Reconcile unchanged: unknown → observe again within the grace period, then manual; complete without an id → manual. Every Phase 2/3 crash sweep re-ran in the full suite | `test_crash_recovery_with_an_unrecognised_tile_goes_to_a_person`; `test_scene_and_crash_sweep.py`, `test_episode_e2e.py` |
| Old locator failure ≠ generation failure | Unknown ends in NEEDS_MANUAL_INTERVENTION (`RENDER_TIMEOUT`), never FAILED | same test |

The Phase 3 state machine, runner, reconcile and store are **unchanged**.

## 4. Registry: locator matrix before / after

| Locator | Before (end of Phase 5) | After (Phase 5.1) | Basis |
|---|---|---|---|
| grid.video_thumbnail | BROKEN / low | **BROKEN / low** (unchanged) | no new evidence |
| grid.video_tile `flow-video-tile` | — | **new**: PARTIALLY_VERIFIED / low | 4 live observations (DOM) |
| grid.video_element `flow-video-tile video` | — | **new**: PARTIALLY_VERIFIED / low | same |
| grid.image_tile `flow-image-tile` | — | **new**: PARTIALLY_VERIFIED / low | same |
| grid.character_tile `flow-character-tile` | — | **new**: PARTIALLY_VERIFIED / low | same |
| grid.character_thumbnail img "Character thumbnail" | — | **new**: PARTIALLY_VERIFIED / low | same |
| grid.tile, grid.image_thumbnail | VERIFIED / medium (HIGH candidates) | unchanged | promotion still needs your approval |
| grid.progress_text | PARTIALLY_VERIFIED / low | unchanged | not observed in the new UI |
| cost_confirmation.* (Approve, Reject, …) | VERIFIED / medium, UNVERIFIED live | unchanged; not clickable | — |

The new entries are low confidence, so they can never be clicked (the click guard requires VERIFIED + high).

## 5. Changes to existing code and tests

| File | Change | Why |
|---|---|---|
| `src/blatifa/flow/adapter.py` | `observe`: old thumbnail counts only while its locator is VERIFIED. New tiles are recognised through the read-only DOM script, the tracker and `runner_tile`. Duplicate titles → unknown. `compat_notes` | brief §8 |
| `src/blatifa/flow/live_probe.py` | `TILE_PROBE_JS` reads 3 more video properties | signals for future live evidence |
| registry YAML | 5 new PARTIALLY_VERIFIED / low entries | §4 |
| `tests/browser/test_flow_adapter.py` | **One assertion changed**, from `done.complete` to `not done.complete and not done.state_known` plus the compat note. The old assertion required completion from the BROKEN locator, which the brief requires to stop. The new one is stricter | brief §8 |

No other existing test was changed, removed or skipped. Runner, state machine, reconcile, store, locks, authorization and mutation methods were not changed.

## 6. Media identity limitations (unchanged, by design)

- **Video:** `MEDIA_ID_UNRESOLVED` stays. `runner_tile` never sets a media id, so neither `src` tokens nor UUIDs are ever used (tested over all live tiles).
- **Image:** `data-media-id` handling is unchanged (tested over the live tiles). It still does not prove equality with the `/edit/` route id.
- **Character tiles:** never an identity and never an output (`media_id_from_elements` → UNRESOLVED; runner tile → unknown).

## 7. File inventory (no git)

- **New:** `src/blatifa/flow/media_recognition.py`, `tests/unit/test_phase5_1_recognition.py`, `tests/unit/test_phase5_1_runner_compat.py`, `tests/browser/test_adapter_v2_grid.py`, `tests/fixtures/flow_grid_v2.html`, `docs/phase-5.1/*`.
- **Modified:** §5.

Outside the project: the sentinel folder `<TMPDIR>/pytest-of-<user>/pytest-sentinel-p51`, created for the isolation check and left in place.
