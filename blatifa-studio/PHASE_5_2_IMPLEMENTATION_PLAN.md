# Phase 5.2 — Implementation Plan (Controlled Live Observation, No-Credit Preparation)

> **Ringkasan (ID):** Fase ini mengumpulkan bukti **live read-only** tentang video yang sudah selesai, di grid maupun di halaman detail, termasuk properti media video. Fase ini juga menyiapkan spesifikasi eksperimen **satu generate terkontrol**, yang **tidak dijalankan** di sini.
>
> Halaman detail dibuka lewat **navigasi URL** ke id rute yang sudah diketahui, sesuai pilihan pengguna. Tidak ada klik. Tidak ada kredit.

Date: 2026-11-03. Decisions by the user (16:35 WIB):
- Blatifa starts the dedicated Chrome (profile `main`), and the user handles any sign-in;
- the detail page is opened by Blatifa through URL navigation to the known route id, then back by URL.

## 1. Starting point

| Item | State |
|---|---|
| Browser session | NOT_RUNNING at 16:33 WIB (blocker reported; user chose to start it) |
| Disk / swap | 13 GiB free / 3.3 GiB swap used (`evidence/logs/baseline.log`) |
| Phase 5 evidence | Video tile = `flow-video-tile` > `video[aria-label, controlslist, disablepictureinpicture, loop, src]`; `src` opaque `/asb/` token (grid 181 chars, detail thumbnail 172 chars); no `data-media-id`; route id `6e7ded7f…` not in any attribute; detail page: no `<video>` element was recorded (17 elements, all `img`) |
| Phase 5.1 | Two-signal rule; shipped policy has no VERIFIED completion signal; `MEDIA_ID_UNRESOLVED`; `grid.video_thumbnail` BROKEN |
| Not yet recorded live | `readyState`, `networkState`, `duration`, `currentTime`, `videoWidth`/`videoHeight`, `paused`, `ended`, `currentSrc` |

## 2. Work items

| # | Item |
|---|---|
| W1 | Probe scripts read, for every `<video>`: `readyState`, `networkState`, `duration` (null if not finite), `currentTime`, `videoWidth`, `videoHeight`, `paused`, `ended`, `currentSrc` (redacted by `redact_url`), `autoplay` / `muted` properties. Property reads only |
| W2 | Guarded navigation: only `https://flow.google.com/project/<the same project>/edit/<uuid>` and back to exactly the project URL; refused otherwise; each navigation logged with a timestamp. No click |
| W3 | `blatifa live-probe --detail-route <uuid> --repeat N`: grid probe ×N → navigate to detail → detail probe ×N → navigate back → grid probe ×1 |
| W4 | Experiment specification for one controlled generation (not executed) |
| W5 | Tests for W1–W3 and for the machine-checkable parts of W4; relevant suites; lint; disk/swap |

## 3. Stop conditions

An unexpected dialog; a page other than the expected project or detail URL; any need to click; a credit change (balance only readable by the user, as in Phase 5); disk < 5 GiB.
