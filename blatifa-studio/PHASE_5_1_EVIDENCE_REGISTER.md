# Phase 5.1 — Evidence Register

> **Ringkasan (ID):** Fase ini **tidak punya bukti live baru**, karena tidak ada sesi Flow. Bukti terdiri dari:
> - test offline;
> - fixture lokal di Chrome headless;
> - rekonstruksi tile dari tanda tangan DOM live Phase 5 yang terekam.
>
> Tidak ada hasil fixture yang diklaim sebagai bukti live.

Kinds: **REC** (recorded Phase 5 live evidence, read offline) · **UNIT** · **SIM** (simulated Flow; real SQLite/files/ffmpeg) · **FIXTURE** (headless Chrome, local page, invented values) · **CLI**.

Files:
- `evidence/recognition_over_phase5_live.json`: the recogniser over all 4 recorded live observations;
- `evidence/logs/{baseline,pytest_isolation,pytest_baseline,pytest_final}.log`.

## 1. Old locator (A)

| ID | Claim | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P51-01 | `grid.video_thumbnail` stays BROKEN; no new evidence | `test_registry_matches_the_recogniser_and_keeps_the_old_locator_broken` | UNIT | VERIFIED OFFLINE |
| E-P51-02 | The adapter no longer treats the old thumbnail as finished; its use is recorded | `test_flow_adapter.py::test_snapshot_and_observe_progress` (changed assertion), `test_adapter_v2_grid.py[legacy]` | FIXTURE | VERIFIED OFFLINE |
| E-P51-03 | Old locator failure ends in manual intervention, never FAILED | `test_unrecognised_result_never_completes_and_blocks_dependents` | SIM | VERIFIED OFFLINE |

## 2. Video recognition, two signals, stability (B, C, D)

| ID | Claim | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P51-10 | The 4 live observations classify as 3 CHARACTER, 5 IMAGE, 1 VIDEO | `test_live_tiles_classify_as_recorded`; `recognition_over_phase5_live.json` | REC | VERIFIED (on recorded live structure) |
| E-P51-11 | The live finished video → VIDEO_UNKNOWN (1 signal present, OBSERVED, not counted) | `test_the_live_finished_video_is_unknown_with_the_shipped_policy` | REC | VERIFIED |
| E-P51-12 | Type needs container + content; `<video>` outside a video tile, old thumbnail alone, mixed kinds → UNKNOWN / AMBIGUOUS | `test_type_needs_container_and_content` (7 cases) | UNIT | VERIFIED OFFLINE |
| E-P51-13 | `<video>` presence alone is not completion, even if VERIFIED | `test_video_presence_alone_is_not_completion_even_if_verified` | UNIT | VERIFIED OFFLINE |
| E-P51-14 | One signal, or two from the same group, is insufficient | `test_one_signal_or_two_from_the_same_group_is_insufficient` | UNIT | VERIFIED OFFLINE |
| E-P51-15 | Two VERIFIED independent signals → completed (logic) | `test_two_verified_independent_signals_complete` (test-only policy) | UNIT | VERIFIED OFFLINE (logic only) |
| E-P51-16 | The shipped policy can never complete, whatever the DOM shows | `test_shipped_policy_can_never_complete_whatever_the_dom_shows` | UNIT | VERIFIED OFFLINE |
| E-P51-17 | NaN / ∞ / 0 duration, readyState 0 are not signals | `test_invalid_media_metadata_is_not_a_signal` | UNIT | VERIFIED OFFLINE |
| E-P51-18 | Conflicting signals → UNKNOWN | `test_conflicting_signals_give_unknown` | UNIT | VERIFIED OFFLINE |
| E-P51-19 | GENERATING from progress text (low confidence); failure/queued-like texts never FAILED/PENDING | `test_generating_failed_pending` | UNIT | VERIFIED OFFLINE |
| E-P51-20 | Every signal carries its evidence level | `test_signal_catalogue_is_evidence_labelled` | UNIT | VERIFIED OFFLINE |
| E-P51-21 | Stable needs repeated identical observations; transitions recorded; changing / regressing / missing / duplicate → UNKNOWN | `test_stable_completion_needs_repeated_identical_observations`, `test_transient_loading_then_completion_is_tracked`, `test_changing_regressing_missing_and_duplicate_tiles_are_unknown` | UNIT | VERIFIED OFFLINE |
| E-P51-22 | Live observations: stable over 4 snapshots, no transition, state stays UNKNOWN | `test_live_observations_are_stable_but_stay_unknown` | REC | VERIFIED |
| E-P51-23 | Probe reads readyState / duration / dimensions without triggering anything | `test_dom_recognition_of_the_v2_grid` (0 clicks, DOM unchanged in sibling tests) | FIXTURE | VERIFIED OFFLINE; **live values: NOT RECORDED** |
| E-P51-24 | A live completion signal at VERIFIED level | — | — | **UNVERIFIED** (needs a live read-only capture, and an unfinished video for contrast) |

## 3. Identity (E, F) and character tiles (G)

| ID | Claim | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P51-30 | `runner_tile` never carries a media id; tokens and UUIDs are never used | `test_runner_tile_mapping_never_carries_an_identity` | UNIT + REC | VERIFIED OFFLINE |
| E-P51-31 | The session key is the title only, never an identity, not order-based; duplicate titles → ambiguous | `test_session_key_is_not_an_identity_and_not_order_based` | UNIT | VERIFIED OFFLINE |
| E-P51-32 | Image `data-media-id` resolves exactly as before; video and character tiles → UNRESOLVED | `test_image_identity_unchanged_and_never_generalised_to_videos_or_characters`; Phase 4/5 media-id tests | REC + UNIT | VERIFIED |
| E-P51-33 | Character tiles have no video state and never become output | `test_character_and_image_tiles_never_get_a_video_state`; runner test `[character-tile]` | REC + SIM | VERIFIED OFFLINE |
| E-P51-34 | A video identity mechanism | none | — | **NOT AVAILABLE** (MEDIA_ID_UNRESOLVED) |

## 4. Runner, dependencies, crash recovery (H, I, J)

| ID | Claim | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P51-40 | Unknown result → manual; dependent never submitted; 1 approval; 0 downloads | `test_unrecognised_result_never_completes_and_blocks_dependents[live-video-structure, character-tile]` | SIM | VERIFIED OFFLINE |
| E-P51-41 | Complete without id → MEDIA_ID_UNRESOLVED, dependent blocked | `test_completed_without_identity_blocks_association` | SIM | VERIFIED OFFLINE |
| E-P51-42 | Two new results → AMBIGUOUS_RESULT; each scene gets only its own result | `test_two_new_results_are_never_split_between_scenes`, `test_each_scene_gets_only_its_own_new_result` | SIM | VERIFIED OFFLINE |
| E-P51-43 | Reconcile after a crash with an unknown tile → observe again, then manual; never completes | `test_crash_recovery_with_an_unrecognised_tile_goes_to_a_person[approved, unknown_after_crash]` | UNIT | VERIFIED OFFLINE |
| E-P51-44 | Every existing crash sweep (single-scene, 72-point episode, repeated) still passes | full suite (`logs/pytest_final.log`) | SIM | VERIFIED OFFLINE |
| E-P51-45 | Adapter on the v2 grid: new video / character / legacy tile never finished over 3 observations; rendering keeps its progress | `test_adapter_v2_grid.py` | FIXTURE | VERIFIED OFFLINE |

## 5. No mutation, no network, temp safety (K, L)

| ID | Claim | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P51-50 | Adapter reads click nothing and leave the DOM unchanged | `test_new_tiles_are_never_reported_finished` (`clicks == []`, DOM equal) | FIXTURE | VERIFIED OFFLINE |
| E-P51-51 | The recognition module touches no page; no network listener, route, HAR or CDP Network anywhere in `src` | `test_recognition_modules_touch_no_page_and_no_network`; Phase 1 `test_source_never_uses_prohibited_browser_apis` | UNIT | VERIFIED OFFLINE |
| E-P51-52 | Mutation methods BLOCKED; authorization inactive | Phase 4/5 tests in the full suite | UNIT | VERIFIED OFFLINE |
| E-P51-53 | Temp isolation: 7 isolation tests; the real sentinel survived the isolation run, the baseline and the final run | `logs/pytest_isolation.log`, `logs/pytest_baseline.log`, `logs/pytest_final.log` | UNIT + CLI | VERIFIED |
| E-P51-54 | Failed development runs kept, not removed (one 4 KB folder from a failing recognition test run) | temp listings in the logs | CLI | VERIFIED |

## 6. Forbidden actions NOT performed

No live Flow session was started. Chrome profile `main` stayed NOT_RUNNING throughout. There was no click of any kind, no account panel, no media detail page, no upload, Animate, submit, generate, Approve, Reject, download or publish, no settings change and no credit use. No request interception, request counter, network listener or other network instrumentation was added. No lock text or lock status was touched, no DRAFT lock was approved, and the Octopus lock is unchanged (Phase 4 lock tests re-ran). No file was deleted to free space.
