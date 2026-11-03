# Phase 5 — Evidence Register

> **Ringkasan (ID):** Bukti live di fase ini **hanya hasil observasi read-only**, tanpa klik dari Blatifa:
> - 1 probe halaman detail dan 4 observasi grid pada 2026-11-03;
> - saldo kredit 50 → 50, dibaca oleh pengguna.
>
> Bukti lain berasal dari test offline, fixture lokal, dan rekaman. Bukti offline tidak diklaim sebagai bukti live.

Kinds: **LIVE** (real Flow page, read-only, this phase) · **USER** (reported by the user) · **REC** (recorded live evidence, read offline) · **UNIT** · **FIXTURE** (headless Chrome on a local page) · **INNER** (inner pytest runs in an isolated TMPDIR) · **CLI**.

Live files: `docs/phase-5/evidence/live/`, copied unchanged from the redacted, leak-checked reports in `~/BlatifaStudio/inspections/`:
- `20261103T073625Z-live-detail/`;
- `20261103T074352Z-live-probe/`;
- `20261103T074618Z-live-probe/` (with `page.masked.png`);
- `credit_user_reported_{start,end}.txt`;
- `session_close.log`.

Logs: `docs/phase-5/evidence/logs/`.

## 1. pytest temporary-directory safety (J)

| ID | Claim | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P5-01 | The session runs in its own new, token-marked basetemp outside `pytest-of-<user>` | `test_this_session_runs_in_its_own_marked_basetemp` | UNIT | VERIFIED OFFLINE |
| E-P5-02 | Hazard reproduced at small scale: plain pytest with count 1 prunes an older `pytest-1` | `test_hazard_reproduced_without_the_plugin` | INNER | VERIFIED OFFLINE |
| E-P5-03 | Passing run: sentinel, `pytest-1`, `pytest-2` and an old Blatifa run survive; only its own folder is removed | `test_passing_run_keeps_every_pre_existing_folder_and_removes_only_its_own` | INNER | VERIFIED OFFLINE |
| E-P5-04 | Failing run: its folder is kept, nothing else is cleaned | `test_failing_run_keeps_its_folder_and_cleans_nothing_else` | INNER | VERIFIED OFFLINE |
| E-P5-05 | An existing `--basetemp` is refused and left intact | `test_existing_basetemp_is_refused_and_left_intact` | INNER | VERIFIED OFFLINE |
| E-P5-06 | A pre-existing temp folder disappearing during a run fails the session | `test_a_disappearing_pre_existing_folder_fails_the_session` | INNER | VERIFIED OFFLINE |
| E-P5-07 | The real pre-existing `pytest-46` survived every run of this phase | `logs/pytest_isolation.log`, `logs/pytest_full_offline.log`, `logs/pytest_full_final.log` (before/after listings) | CLI | VERIFIED |

## 2. Live browser connection (A)

| ID | Claim | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P5-10 | Dedicated profile `main` started; CDP on 127.0.0.1; page responsive; Chrome 156 | `live-probe.json` → `health`; terminal output in the session | LIVE | VERIFIED LIVE |
| E-P5-11 | Attach selects the existing Flow tab, without navigation or a new tab | code `BrowserEngine.attach` (read); same URL before and after each probe | LIVE + code | VERIFIED |
| E-P5-12 | Project context identified (`/project/<uuid>`); a non-project page is refused | `url_shape` in reports; CLI guard | LIVE | VERIFIED LIVE |
| E-P5-13 | Session closed; profile kept | `live/session_close.log` | CLI | VERIFIED |

## 3. Account and credit (B)

| ID | Claim | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P5-20 | Identity read without interaction on the project page (fingerprint only in reports) | 4 observations, `identity.status = VERIFIED` | LIVE | VERIFIED LIVE |
| E-P5-21 | Identity is not readable on the media detail page (no identity button) → stop | `live-detail.json` (`identity button BROKEN: not found`) | LIVE | VERIFIED LIVE (fail-closed) |
| E-P5-22 | Credit balance is not in the accessibility tree without opening the account panel | `credits.status = UNAVAILABLE_WITHOUT_CLICK` in all 5 probes | LIVE | VERIFIED LIVE |
| E-P5-23 | Balance before 50 / after 50 | `live/credit_user_reported_start.txt`, `…_end.txt` | USER | user-reported, not machine-read |
| E-P5-24 | Credit refresh text | not visible without a click | — | UNVERIFIED |
| E-P5-25 | The old account readers cannot run through the guard (scroll / click refused) | `test_the_old_account_reader_cannot_run_through_the_guard` | UNIT | VERIFIED OFFLINE |

## 4. Media tiles and identifiers (C, D)

| ID | Claim | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P5-30 | 9 tiles: 5 images, 1 video, 3 character tiles; identical across 4 observations | both `live-probe.json`; `test_four_live_observations_were_identical_and_read_only_clean` | LIVE + REC | VERIFIED LIVE |
| E-P5-31 | Image `data-media-id`s equal the Phase 0 values (one day apart) | `test_image_tile_ids_are_the_phase0_ids` | LIVE + REC | VERIFIED LIVE |
| E-P5-32 | On the detail page, image `src` = `flow-content.google/image/<uuid>`, and the UUID equals the grid `data-media-id` (5/5) | `live-detail.json` | LIVE | VERIFIED LIVE |
| E-P5-33 | Video tile: no `data-media-id`; `video src` = opaque `/asb/<tok:181>`; detail-page video thumbnail = different opaque `/asb/<tok:172>`; no UUID | reports; `test_detail_page_never_exposed_the_route_id_in_media_attributes` | LIVE | VERIFIED LIVE (absence) |
| E-P5-34 | The video's route id `6e7ded7f…` is identical to Phase 0, and occurs in no attribute on the grid or the detail page | `live-detail.json` (`route_id_found_in = []`); `route_known = false` everywhere | LIVE | VERIFIED LIVE |
| E-P5-35 | `data-media-id` = `/edit/<uuid>` route id | the recorded image detail `24f29e76…` matches no `data-media-id` | REC | **UNVERIFIED** (contradicted for one recorded case) |
| E-P5-36 | URL fingerprints stable over ~3 min (9/9) | comparison of the two runs (session output; reproducible from the files) | LIVE | PARTIALLY VERIFIED (short window, no reload) |
| E-P5-37 | Lazy loading / virtualisation | 9 tiles, all loaded and in the viewport; page scrollable; no scrolling done | LIVE | **UNVERIFIED** |
| E-P5-38 | Candidates only from attributes; never from title, text or position; ambiguous and invalid refused | `test_identifier_candidates_come_only_from_attributes`, Phase 4 media-id tests | UNIT | VERIFIED OFFLINE |

## 5. Generation status (E) and cost confirmation (F)

| ID | Claim | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P5-40 | The finished video reads UNKNOWN (new structure; completion never inferred) | live reports; `test_live_video_tile_structure_reads_as_unknown` | LIVE + UNIT | VERIFIED LIVE (fail-closed) |
| E-P5-41 | No tile classified COMPLETED live | `test_no_tile_was_classified_completed_and_the_video_has_no_identifier` | REC | VERIFIED |
| E-P5-42 | Thumbnail alone ≠ completed; lazy = unknown; progress = generating; progress + thumbnail = ambiguous; unknown text ≠ failed | `test_phase5_probe` status tests; fixture tests | UNIT + FIXTURE | VERIFIED OFFLINE |
| E-P5-43 | Generating, failed, pending tiles live | none present | — | **UNVERIFIED** |
| E-P5-44 | Confirmation ABSENT read correctly live | 5 probes | LIVE | VERIFIED LIVE |
| E-P5-45 | OPEN + readable cost, OPEN + unknown cost (blocks), two open (ambiguous, blocks), answered | `test_cost_confirmation_states_and_unknown_cost_blocks`, `test_confirmation_readable_and_unknown_cost_and_rendering` | UNIT + FIXTURE | VERIFIED OFFLINE only |

## 6. Locators (G) and UI change detection (H)

| ID | Claim | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P5-50 | 7 high locators re-confirmed live without interaction (HEALTHY ×4) | `locator_proposals` in both reports | LIVE | VERIFIED LIVE |
| E-P5-51 | `grid.tile` (9) and `grid.image_thumbnail` (5) HEALTHY ×4: HIGH candidates, not applied | same | LIVE | VERIFIED LIVE; promotion PROPOSED |
| E-P5-52 | `grid.video_thumbnail` BROKEN ×4 → registry BROKEN/low | same; `test_registry_reflects_the_live_finding` | LIVE | VERIFIED LIVE |
| E-P5-53 | Approve / Reject / Always approve / permission group / progress text not present → stay medium/low, UNVERIFIED live | same | LIVE | UNVERIFIED |
| E-P5-54 | Real UI change detected: video tile structure, new character tile type | §4.1 of the report | LIVE | VERIFIED LIVE |
| E-P5-55 | Missing, multiple, invisible, disabled (validator rules); unexpected dialog; structure / state / identifier changes; added / removed tiles | `test_change_detection_between_observations`, `test_any_dialog_is_unexpected…`, fixture dialog test, Phase 1 validator tests | UNIT + FIXTURE | VERIFIED OFFLINE |
| E-P5-56 | No change between observations live | `changes_between_probes = [[]]` in both runs | LIVE | VERIFIED LIVE |

## 7. Privacy (I) and mutation safety (L)

| ID | Claim | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P5-60 | Reports passed the leak check; no e-mail, query value, cookie or token in the evidence | `test_recorded_evidence_contains_no_secrets`; grep at copy time | REC | VERIFIED |
| E-P5-61 | The screenshot masks the account avatar and shows no e-mail or name (checked by eye) | `live/20261103T074618Z-live-probe/page.masked.png` | LIVE | VERIFIED |
| E-P5-62 | Network requests not observed (a first draft did; removed after the Phase 1 source scan failed) | `test_source_never_uses_prohibited_browser_apis` | UNIT | VERIFIED OFFLINE |
| E-P5-63 | Read-only guard refuses every interaction (fake page; real headless Chrome: click refused before it reaches the page, 0 clicks, DOM unchanged) | `test_read_only_page_refuses_every_interaction`, `test_guard_blocks_a_click_before_it_reaches_the_page`, `test_full_probe_reads_everything_without_any_interaction` | UNIT + FIXTURE | VERIFIED OFFLINE |
| E-P5-64 | No Blatifa click in the live session | only the guarded probe and `browser start/status/stop` ran; credits 50 → 50 (user) | LIVE + USER | VERIFIED (by construction + balance) |
| E-P5-65 | Authorization model still inactive; adapter writes BLOCKED | Phase 4 tests re-run; `test_probe_code_contains_no_interaction_calls_and_the_credit_gate_stays_inactive` | UNIT | VERIFIED OFFLINE |

## 8. Actions NOT performed by Blatifa in Phase 5

No click of any kind, including opening the account panel, opening a tile, hovering, or scrolling. Also none of the following: typing, upload, attaching an image or ingredient, Animate, submit, generate, Approve, Reject, Always approve, download, publish, delete, settings change, account switch, navigation (back, URL or reload), network interception, or reading cookies, storage or tokens.

The user did, themselves: sign-in, opening the project, opening the video detail page, going back to the grid, and opening and closing the account panel twice to read the balance.

## 9. Test runs

| Run | Result | Log |
|---|---|---|
| Isolation tests (first run of the phase) | 7 passed; `pytest-46` survived | `logs/pytest_isolation.log` |
| Full offline suite before live | 275 passed, 1 failed (`test_source_never_uses_prohibited_browser_apis`: my request listener), 7 skipped → fixed | `logs/pytest_full_offline.log` |
| Final full suite + lint | **283 passed, 7 skipped, 0 failed**; lint clean; `pytest-46` intact | `logs/pytest_full_final.log` |
