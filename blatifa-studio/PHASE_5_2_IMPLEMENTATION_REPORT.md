# Phase 5.2 — Implementation Report (Controlled Live Observation, No-Credit Preparation)

> **Ringkasan (ID):** Observasi live read-only atas video yang sudah selesai ("Cat waving to camera") di grid dan di halaman detail. Halaman detail dibuka lewat navigasi URL yang disetujui pengguna, **tanpa klik dari Blatifa**. Saldo 50 → 50, dibaca pengguna.
>
> **Temuan terpenting:** isi DOM tile video selesai bergantung pada **riwayat hover** dalam sesi halaman, bukan pada status generate:
> - setelah halaman dimuat: thumbnail gambar;
> - saat kursor di atasnya: `<video>` yang diputar;
> - sesudahnya: `<video>` yang berhenti.
>
> Ini mengoreksi tafsiran Phase 5 bahwa locator lama "BROKEN". Properti media video selesai sekarang terbaca segar (readyState 4, durasi 7,918 detik, 720×1280), tetapi **belum ada sinyal yang terbukti membedakan** selesai dari belum. Spesifikasi eksperimen satu generate sudah disiapkan, **tidak dijalankan**.

Period: 2026-11-03 16:33–21:50 WIB. Live window 21:02–21:41 WIB (14:02–14:41 UTC); times in §1 are UTC. Labels: VERIFIED · PARTIALLY VERIFIED · PROPOSED · UNVERIFIED · BLOCKED. Kinds: **LIVE-5.2** (fresh, this phase) · **LIVE-5** (historical Phase 5 files) · **FIXTURE** · **UNIT**.

## 1. Session and actions (timeline, UTC)

| Time | Who | What | Note |
|---|---|---|---|
| 09:33 | Blatifa | `browser status` | NOT_RUNNING → blocker reported to the user, no auto-login |
| 09:35 | User | decided: Blatifa starts Chrome; detail page by URL navigation | — |
| before 14:02 (not logged) | Blatifa | `browser start --profile main` | HEALTHY |
| 14:02:32 (recorded) | User | balance read in the account panel: **50**; grid opened | user also sent an image detail URL (`d4b93d87…`) |
| 14:02:55 | Blatifa | grid probe | **stopped**: identity unreadable (account controls not in the accessibility tree). **No navigation** |
| after 14:02:55 (not logged) | Blatifa | one read-only tree query + one masked screenshot | cause: the page was scrolled down; the top bar was out of the tree |
| before 14:09:27 | User | scrolled to the top | — |
| 14:09:27–14:12:00 | Blatifa | run 2: grid ×3 (10 s) → URL to `/edit/6e7ded7f…` (14:11:18) → detail ×3 → URL back (14:11:56) → grid ×1 | landed exactly where intended both times |
| 14:13:11–14:16:49 | Blatifa | run 3: grid ×2 → URL to detail (14:14:07) → detail ×2 → URL back (14:14:26) → grid ×6 (2 s pauses; each probe takes about 28 s) | — |
| 14:36:23–31 | User hovers the tile; Blatifa observes ×5 | `hover_test_on.log` | — |
| 14:38:45–53 | User moves the pointer away; Blatifa observes ×5 | `hover_test_off.log` | — |
| 14:41:08 (recorded) | User | balance read: **50** | — |
| right after 14:41 | Blatifa | `browser stop` | NOT_RUNNING; profile kept |

Blatifa performed **no click, typing, hovering, scrolling, upload, submit, Approve, Reject, download or publish**. Its only page-changing actions were the 4 approved URL navigations listed above.

## 2. Task A — completed video, fresh live findings

### 2.1 Grid tile (LIVE-5.2)

| State | When observed | Structure inside `flow-video-tile` | Video properties |
|---|---|---|---|
| **Rest after page load** | run 3, 8 observations over ~3.5 min; run 2 obs. 4 (4 s after reload) | `img[alt="Generated video thumbnail", draggable, src=/asb/<tok:172>]`, **no** `<video>` | — (no media element) |
| **Hovered** | 5 observations, `matches(':hover') = true` | `<video aria-label controlslist disablepictureinpicture loop src=/asb/<tok:181>>`, **no** thumbnail | readyState 4, networkState 1, duration 7.918005 s, `paused = false`, `currentTime` 2.41 → 4.47 → 6.50 → 0.56 → 2.60 (plays and loops), 720×1280 |
| **After hover** | 5 observations, nothing hovered; and run 2 obs. 1–3 | `<video>` stays, no thumbnail | readyState 4, networkState 1, duration 7.918005 s, `paused = true`, `ended = false`, `currentTime` 0.017 / 0.077, 720×1280, `muted = true`, `autoplay = false` |

Other attributes and properties:
- The video `aria-label` is **not** the tile title (`aria_label_is_title = false`). Its value was not recorded.
- `currentSrc` = `flow.google.com/asb/<tok:181>`, no UUID, with the same fingerprint across observations within the session.
- The tile also contains `flow-video-hotbar` with buttons and `flow-tile-hover-footer`. These are not read or used; no label was recorded.

**Verification of the cause** (VERIFIED, LIVE-5.2):
- the `<video>` appears only after the tile has been hovered by the user;
- it plays while hovered;
- it stays, paused, afterwards;
- a page load brings the thumbnail back.

### 2.2 Detail view (`/edit/6e7ded7f…`, LIVE-5.2, 5 observations)

- 17 media elements, all `img`, **no `<video>`**, the same as Phase 5.
- The video's own thumbnail on that page is `img[alt="Generated video thumbnail"]` with `src=/asb/<tok:172>`, which equals the grid thumbnail's token length.
- No identity button (Phase 5 finding confirmed). The route id is not found in any attribute.
- **Grid vs detail:** the grid has `<video>` after hover, the detail page has none; both show the thumbnail img (172-char token).

### 2.3 Identity and the user's image URL

- **Video:** no stable identifier exists in the DOM. The route id `6e7ded7f…` is reachable only from the URL. The `/asb/` tokens are opaque and differ between the thumbnail and the video. `MEDIA_ID_UNRESOLVED` stands (VERIFIED absence, LIVE-5.2).
- **User image route `d4b93d87…`:** it matches none of the 5 `data-media-id`s on the grid and none of the 6 image UUIDs on the detail page. Its title is not known, so it may simply be an image that is not in the observed DOM. This is the second recorded image route id that is not a visible `data-media-id` (after `24f29e76…`). Status: PARTIALLY VERIFIED; the correspondence remains UNVERIFIED.
- **Image `data-media-id`s:** unchanged since Phase 0 (5 values).

## 3. Task B — comparison with Phase 5 / 5.1 (reinterpretation explained)

| Earlier statement | Earlier evidence | Phase 5.2 evidence | Revised reading |
|---|---|---|---|
| Phase 5: "finished video tile is now `<video>`; `grid.video_thumbnail` BROKEN" | 4 observations, all with `<video>`; the user had just opened that video and gone Back (the tile had been hovered) | thumbnail img in the rest state (9 observations); `<video>` only after a hover | The locator is **not dead**. It matches in the rest state. Phase 5 saw the after-hover state. **Status in the registry left at BROKEN** (fail-closed); reclassification to state-dependent is **PROPOSED** (needs your approval, and changes 3 existing test expectations) |
| Phase 5.1: VIDEO tile = `flow-video-tile` + `<video>` | Phase 5 files | the rest state has the thumbnail instead | Recogniser now also accepts `flow-video-tile` + thumbnail as VIDEO (state still UNKNOWN). New signal `thumbnail_in_video_tile` (group dom_structure, OBSERVED) |
| Phase 5.1: media metadata / dimensions evidence NONE | not recorded | readyState 4, duration 7.918, 720×1280 on the finished video | raised to **OBSERVED** (seen, never contrasted with an unfinished video). **Still not counted** |
| `MEDIA_ID_UNRESOLVED` | Phase 5 | confirmed | unchanged |
| Two-signal rule | Phase 5.1 | — | unchanged; no signal is VERIFIED; completion unreachable |

## 4. Code changes

| File | Change |
|---|---|
| `src/blatifa/flow/live_probe.py` | Video properties in both scripts (readyState, networkState, duration, currentTime, paused, ended, dimensions, autoplay, muted, currentSrc). `video_properties()` with a redacted source. `HOVER_STATE_JS` (`matches(':hover')` query). `ProbeResult.hovered_tiles`. `probe_detail(identity_required=False)` for the detail page |
| `src/blatifa/flow/navigation.py` (new) | `GuardedNavigator`: only `/edit/<uuid>` of the same project and back; refusal before touching the browser; landing check; timestamped log. Kept out of `live_probe`, whose no-navigation guarantee (Phase 5 test) holds |
| `src/blatifa/cli.py` | `live-probe --detail-route`, `--after-return`, `--after-interval` |
| `src/blatifa/flow/media_recognition.py` | VIDEO also from `flow-video-tile` + thumbnail; new OBSERVED signal; evidence levels updated; docstring records the hover finding |
| `tests/unit/test_phase5_1_recognition.py` | **One expectation updated:** the evidence levels of 2 signals NONE → OBSERVED, and a third signal added. A new assertion pins "no VERIFIED signal" |

Runner, state machine, reconcile, gates, authorization, adapter write methods and registry are **unchanged**.

## 5. Task C — experiment specification

See `GENERATION_EXPERIMENT_SPEC.yaml` (machine-checked) and the final audit §3. Key decisions:
- **One generation, performed by the user in Flow.** Blatifa activates no mutation code.
- The cost is not assumed. The user sets a maximum; Approve only if the quote is parsed, shows one video, and is within that maximum.
- The pointer stays away from all tiles, and any observation with a hovered tile is discarded.
- Observations P0 (before), P1 (confirmation), P2 (generating, every 10 s, at least 3), P3 (completed, 3 identical), then the user hovers once (media properties) and the user opens the detail (route id + stored prompt).
- A signal becomes VERIFIED only if it is present in every P3 observation and absent in every P2 observation. With n = 1 it must be re-confirmed later.
- Association uses exactly one new tile (set difference) **and** a unique nonce in the prompt found in the stored prompt, never order, time, title or token.

## 6. File inventory

- **New:** `src/blatifa/flow/navigation.py`, `tests/unit/test_phase5_2_observation.py`, `tests/unit/test_phase5_2_live_evidence.py`, `tests/browser/test_video_properties_fixture.py`, `tests/fixtures/flow_video_props.html`, `docs/phase-5.2/*` (including `GENERATION_EXPERIMENT_SPEC.yaml` and `evidence/live/*`).
- **Modified:** §4.

The original redacted reports are in `~/BlatifaStudio/inspections/2026110…T14*Z-live-probe`.
