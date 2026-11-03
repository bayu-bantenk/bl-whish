# Phase 5.2 — Evidence Register

> **Ringkasan (ID):** Bukti **live segar** fase ini diambil 2026-11-03 pukul 14:02–14:41 UTC, read-only, tanpa klik dari Blatifa. Satu-satunya aksi yang mengubah halaman adalah 4 navigasi URL yang disetujui pengguna. Bukti Phase 5 tetap disebut sebagai bukti historis, dan hasil fixture tidak pernah diklaim sebagai bukti live.

Kinds: **LIVE-5.2** (fresh) · **LIVE-5** (historical) · **USER** (reported by the user) · **UNIT** · **FIXTURE** (headless Chrome, local page).

Files in `docs/phase-5.2/evidence/live/`, copied unchanged from the redacted, leak-checked reports:
- `20261103T140330Z-live-probe/` (the stopped run);
- `20261103T141225Z-live-probe/` (run 2);
- `20261103T141714Z-live-probe/` (run 3);
- `hover_test_on.log`, `hover_test_off.log`;
- `identity_diagnosis.masked.png`;
- `credit_user_reported_{start,end}.txt`;
- `session.log`, `run{1,2,3}_console.log`.

## 1. Completed video: fresh properties (Task A)

| ID | Finding | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P52-01 | After hover: readyState 4, networkState 1, duration 7.918005 s, 720×1280, paused, not ended, muted, no autoplay; identical in 3 observations | run 2 probes 1–3; `test_completed_video_properties_were_read_live_and_stable` | LIVE-5.2 | VERIFIED |
| E-P52-02 | While hovered: `<video>` plays (`paused = false`, currentTime advances and loops at 7.918 s) | `hover_test_on.log`; `test_hover_drives_the_video_element` | LIVE-5.2 | VERIFIED |
| E-P52-03 | After the pointer leaves: `<video>` stays, paused near 0 s; the thumbnail does not come back | `hover_test_off.log` | LIVE-5.2 | VERIFIED |
| E-P52-04 | Rest state after a page load: `img "Generated video thumbnail"` inside `flow-video-tile`, no `<video>`; 9 observations over about 3.5 min | run 3 (8), run 2 probe 4; `test_rest_state_after_load_is_the_thumbnail_and_reads_as_video_unknown` | LIVE-5.2 | VERIFIED |
| E-P52-05 | Cause of the structure change: the user's hover (`matches(':hover')` recorded) | hover logs | LIVE-5.2 | VERIFIED (one tile, one session) |
| E-P52-06 | The structure change after the reload was detected by `detect_changes` | run 2 `changes_between_probes`; `test_the_page_reload_changed_the_structure_and_was_detected` | LIVE-5.2 | VERIFIED |
| E-P52-07 | Video `aria-label` ≠ tile title (value not recorded) | `aria_label_is_title = false` | LIVE-5.2 | VERIFIED |
| E-P52-08 | Source: `flow.google.com/asb/<tok:181>` (video) and `/asb/<tok:172>` (thumbnail, also on the detail page); no UUID; fingerprints stable within a session | reports | LIVE-5.2 | VERIFIED |
| E-P52-09 | Detail view: 17 `img`, **no `<video>`**, no identity button, route id in no attribute (5 observations) | run 2 / run 3 `detail_probes`; `test_detail_page_has_no_video_and_no_identity` | LIVE-5.2 | VERIFIED |
| E-P52-10 | Surrounding scene metadata: none in the DOM besides the tile title (no scene, prompt or episode attribute observed) | tile signatures; redacted texts | LIVE-5.2 | PARTIALLY VERIFIED (texts are only lengths) |

## 2. Identity (Tasks A/B)

| ID | Finding | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P52-20 | No stable video media id in grid or detail DOM; `MEDIA_ID_UNRESOLVED` stands | E-P52-08/09 | LIVE-5.2 | VERIFIED (absence) |
| E-P52-21 | Route id `6e7ded7f…` unchanged since Phase 0; reachable only as a URL | navigation log | LIVE-5.2 + REC | VERIFIED |
| E-P52-22 | User image route `d4b93d87…` is not among the 5 grid `data-media-id`s nor the 6 detail-page image UUIDs | `test_user_image_route_is_not_a_data_media_id_in_the_observed_dom` | LIVE-5.2 + USER | PARTIALLY VERIFIED (the image may not be in the observed DOM) |
| E-P52-23 | Image `data-media-id`s unchanged (5) | reports | LIVE-5.2 | VERIFIED |

## 3. Comparison with Phase 5 / 5.1 (Task B)

| ID | Finding | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P52-30 | Phase 5 "`grid.video_thumbnail` BROKEN" was the after-hover state; the locator matches in the rest state | E-P52-04/05 vs Phase 5 files | LIVE-5.2 vs LIVE-5 | VERIFIED; registry change **PROPOSED** (not applied) |
| E-P52-31 | Recogniser: `flow-video-tile` + thumbnail → VIDEO (state UNKNOWN); new signal `thumbnail_in_video_tile` (dom_structure, OBSERVED) | `test_rest_state_after_load…`; recogniser tests | UNIT + LIVE-5.2 | VERIFIED OFFLINE |
| E-P52-32 | Media metadata / dimensions: NONE → OBSERVED; still not counted; no signal VERIFIED | `test_signal_catalogue_is_evidence_labelled` | UNIT | VERIFIED |
| E-P52-33 | A completion signal that discriminates finished from unfinished | no unfinished video observed | — | **UNVERIFIED** |

## 4. Safety and method

| ID | Finding | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P52-40 | Session unavailable at the start → blocker reported, no auto-login | `logs/baseline.log` | CLI | VERIFIED |
| E-P52-41 | Identity unreadable → stop before any navigation | run `140330Z` (`navigation = []`); `test_identity_stop_happened_before_any_navigation` | LIVE-5.2 | VERIFIED |
| E-P52-42 | Only the approved navigations: 2 × (detail by URL, back by URL), landed as intended | `navigation` in run 2 and run 3; `test_navigation_was_only_the_approved_detail_url_and_back` | LIVE-5.2 | VERIFIED |
| E-P52-43 | Navigator refuses other URLs, non-UUID routes and unexpected landings before touching the page | `test_phase5_2_observation.py` | UNIT | VERIFIED OFFLINE |
| E-P52-44 | Probe reads media properties without play, seek or click | `test_probe_reads_media_properties_without_changing_playback` | FIXTURE | VERIFIED OFFLINE |
| E-P52-45 | Scripts read-only (no element assignment, no play/pause/load/focus/scroll/events); hover query only | `test_new_scripts_stay_read_only`, `test_hover_query_is_read_only` | UNIT | VERIFIED OFFLINE |
| E-P52-46 | `live_probe` still contains no navigation call (Phase 5 guarantee kept by moving the navigator out) | `test_probe_code_contains_no_interaction_calls_and_the_credit_gate_stays_inactive` | UNIT | VERIFIED OFFLINE |
| E-P52-47 | Balance 50 → 50 | credit files | USER | user-reported |
| E-P52-48 | Evidence contains no e-mail, signature or access id | `test_phase_5_2_evidence_contains_no_secrets`; masked screenshot reviewed by eye | UNIT | VERIFIED |
| E-P52-49 | No network instrumentation | Phase 1 / 5.1 source scans in the suite | UNIT | VERIFIED OFFLINE |

## 5. Experiment specification (Task C)

| ID | Finding | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P52-50 | One generation at most, performed by the user; Blatifa performs no Flow action; not authorized yet | `GENERATION_EXPERIMENT_SPEC.yaml`; `test_experiment_is_one_generation_by_the_user_and_not_authorized_yet` | UNIT | PROPOSED (spec machine-checked) |
| E-P52-51 | Before / during / after captures, ≥ 3 observations per phase, 3 identical for stability, hover control | `test_experiment_captures_before_during_and_after_with_stability_and_hover_control` | UNIT | PROPOSED |
| E-P52-52 | Discrimination rule, n = 1 caveat, association by set difference + prompt nonce, never order/time/title/token, abort conditions | `test_signals_need_discrimination_and_association_never_uses_order` | UNIT | PROPOSED |

## 6. Actions not performed

By Blatifa: no click of any kind, no typing, hovering or scrolling, no account panel, no tile opened by click, no upload, Animate, submit, generate, Approve, Reject, download or publish, no settings change, no account switch, no network instrumentation, no lock change, no file deletion.

By the user (own actions, all non-mutating): sign-in state, reading the balance twice in the account panel, opening the project, scrolling to the top, hovering the video tile and moving the pointer away.
