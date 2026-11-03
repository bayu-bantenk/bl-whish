# Storage Cleanup Plan (itemized, nothing executed)

> **Ringkasan (ID):** Daftar per path: ukuran, pemilik, bisa dibuat ulang atau tidak, risiko, dan tindakan yang disarankan. Semuanya dibagi tiga:
> - **A. Risiko rendah**, sekitar 38 GiB: cache unduhan dan hasil build proyek yang sudah lama tidak aktif.
> - **B. Perlu konfirmasi Anda**, sekitar 75–110 GiB: SDK/emulator/engine yang mungkin masih dipakai, hasil build proyek aktif, dan data aplikasi.
> - **C. Jangan dihapus**: sistem, swap, profil Chrome pribadi, profil Blatifa (discovery dan main), bukti, dan **kode sumber proyek**. Beberapa salinan proyek yang tampak duplikat ternyata punya perubahan yang belum di-commit atau di-push.
>
> **Tidak ada yang saya hapus atau pindahkan.** Tidak semua cache dianggap boleh dibuang: ada yang mahal diunduh ulang, dan ada yang dipakai offline.

Measured 2026-11-03 08:50–09:45 WIB (`du -sk`, GiB). Free space at the end of the session: **18 GiB** (dev server stopped by the user, swap shrinking).

Column key — **Repro**: Yes = recreated automatically or by one command; Partly = needs a manual step or a long download; No = original data. **Cost** = what deleting it costs you later.

## A. Low risk (recommended first)

| # | Exact path | Size | Owner | Repro | Cost if deleted | Risks / dependencies | Recommended action |
|---|---|---|---|---|---|---|---|
| A1 | `~/.npm/_cacache` | 13.73 | npm | Yes | packages re-downloaded on the next `npm install` | `npm ci --offline` stops working until refilled | `npm cache clean --force` |
| A2 | `~/.gradle/caches/8.14.3` | 3.02 | Gradle (older version) | Yes | re-download only if a project still uses Gradle 8.14.3 | stop daemons first: `./gradlew --stop` | delete the folder |
| A3 | `~/.gradle/caches/build-cache-1` | 0.47 | Gradle build cache | Yes | slower first build | — | delete |
| A4 | `~/.dartServer` | 2.08 | Dart analysis server | Yes | IDE re-indexes once | close IDEs first | delete |
| A5 | `~/.cache/uv` | 0.48 | uv | Yes | re-download | Blatifa `.venv` is not affected | `uv cache clean` |
| A6 | `~/Developments/web/node/archives/minipos all/minipos/next/.next` | 1.41 | archived project (last commit 2023-04-17) | Yes | rebuild on next use | — | delete `.next` |
| A7 | `~/Developments/web/node/archives/minipos all/minipos-old2/next/.next` | 0.70 | archived (2023-01) | Yes | rebuild | — | delete `.next` |
| A8 | `~/Developments/web/node/archives/minipos all/minipos-old/next/.next` | 0.50 | archived (2022-09) | Yes | rebuild | — | delete `.next` |
| A9 | `~/Developments/web/node/archives/newpwa/.next` | 0.30 | archived (2023-11 build) | Yes | rebuild | — | delete `.next` |
| A10 | `~/Developments/mobile/flutter/gpos-lite-app/build` + `.dart_tool` | 4.96 + 1.47 | Flutter app (last commit 2025-11-11) | Yes | `flutter pub get` + rebuild (minutes) | — | `flutter clean` in that project |
| A11 | `~/Developments/web/node/gpos-one/.next` | 1.97 | Next app (last commit 2026-03-30) | Yes | rebuild | — | delete `.next` |
| A12 | `~/Developments/web/node/minipos-origin/next/.next` | 1.38 | Next app (2025-09) | Yes | rebuild | — | delete `.next` |
| A13 | `~/Developments/web/node/gpos-patient-loyalty/.next` | 0.67 | Next app (2025-01) | Yes | rebuild | — | delete `.next` |
| A14 | `~/Developments/tech test/*/…/build`, `node_modules` (Firmansyah pocketgue 0.88, Nur Muhammad flutter-pokemon 0.57, Reza Aditya Animaldex 0.55, Nur Muhammad react-global-urban `node_modules` 0.52, Firmansyah mini-catalog `node_modules` 0.50) | 3.02 | candidates' tech tests (2022–2025) | Yes | rebuild / reinstall | keep the sources if you need them for hiring records | `flutter clean` / delete `node_modules` |
| A15 | `~/Developments/mobile/flutter/{notelp,no_phone,ptgua-flutter-main}/build` | 0.69 + 0.62 + 0.54 | old Flutter projects (2022–2024) | Yes | rebuild | — | `flutter clean` |
| A16 | `~/Developments/mobile/flutter/health_tracker_app/.dart_tool` | 0.35 | Flutter (2025-11) | Yes | `pub get` | — | `flutter clean` |
| A17 | Session scratchpad clone `/private/tmp/claude-502/…/scratchpad/leak/web` | small (APFS clone; only the rebuilt `.next` uses real space) | created by this audit | Yes | — | holds compiled bundles that may contain build-time env values | I can remove it on your OK, or macOS clears `/private/tmp` on restart |
| **Σ A** | | **≈ 38 GiB** (caches A1–A5 19.8 + inactive projects A6–A16 18.6) | | | | | |

## B. Requires your confirmation

| # | Exact path | Size | Owner | Repro | Cost if deleted | Risks / dependencies | Recommended action |
|---|---|---|---|---|---|---|---|
| B1 | `~/go/pkg/mod` | 11.32 | Go module cache | Yes | all modules re-downloaded (network; private modules need credentials) | offline Go builds break | `go clean -modcache` if you rarely build Go offline |
| B2 | `~/.gradle/caches/8.14.5` + `modules-2` | 5.19 + 2.79 | Gradle (current version) | Yes | long first Android build, large download | used by active Android/RN builds | keep while Android work is active |
| B3 | `~/.pub-cache` / `~/.pub-cache-b2b` | 3.64 / 2.95 | Dart packages (two caches: the second is a separate `PUB_CACHE` setup) | Yes | `flutter pub get` re-downloads | the b2b cache may be pinned by a script or env var | `flutter pub cache clean` per cache, if you accept the downloads |
| B4 | `~/Library/Android/sdk/system-images/android-33` | 11.17 | Android emulator images (2023) | Partly (SDK Manager download) | re-download 3–11 GB if an AVD needs it | AVDs referencing it stop booting | check AVD targets first; likely removable |
| B5 | `…/system-images/android-32`, `android-34`, `UpsideDownCakePrivacySandbox` | 4.20 + 4.16 + 3.13 | same (2023–2024) | Partly | same | same | remove if no AVD uses them |
| B6 | `…/system-images/android-36`, `36.1`, `36-ext19`, `37.0` | 8.51 + 4.26 + 4.26 + 4.31 | same (2025–2026) | Partly | same | your recent AVDs probably use one or two of these | keep the one(s) your AVDs use |
| B7 | `~/Library/Android/sdk/ndk/{25.1, 26.1, 27.0, 28.2}` | 2.10 + 2.96 + 2.41 + 2.78 | Android NDK | Partly (SDK Manager) | re-download if a project pins it (`ndkVersion`) | RN/Flutter native builds fail if their version is gone | keep 27.1 (newest, used 2026-10-16) plus any pinned version |
| B8 | `~/.android/avd/Pixel_8_Pro_2.avd` | 5.36 | emulator (last used 2026-10-16) | Partly (recreate, data lost) | emulator user data | apps/test data inside the emulator | delete or "Wipe data" if not needed |
| B9 | `~/.android/avd/Pixel_8_Pro.avd`, `Pixel_3_XL.avd` | 3.97 + 3.96 | emulators (used 2026-10-28 / 10-23) | Partly | same | actively used | keep, or wipe data |
| B10 | `~/.shorebird/bin/cache/flutter` (≥ 12 engine revisions, Aug 2024 – Nov 2025) | 16.88 | Shorebird | Yes (on demand) | the current revision is re-downloaded on the next `shorebird` command | patches for old releases need their exact engine | `shorebird cache clean`, or delete revisions older than your oldest live release |
| B11 | `~/Library/Developer/CoreSimulator/Devices` | 10.62 | iOS simulators | Partly | simulator data lost | — | `xcrun simctl delete unavailable` first (safe), then remove unused devices in Xcode |
| B12 | `~/Library/Containers/com.docker.docker` | 8.32 | Docker Desktop VM (32 GiB sparse) | Partly | images/volumes re-pulled; **volume data (e.g. Postgres on :5432) is lost** | containers are running (5432, 6379, 8000) | `docker system prune` (keeps volumes); never delete the folder |
| B13 | `~/fvm/versions/3.13.2` / `3.13.5` | 1.62 / 2.27 | fvm Flutter SDKs | Yes | re-download | projects with `.fvmrc` pinning them | `fvm remove <ver>` if unpinned |
| B14 | `~/.cache/huggingface` | 2.77 | ML models (hubert-large, Seed-VC) | Yes, large download | 2.4 GB download | Seed-VC needs them | keep if Seed-VC is used |
| B15 | `~/Library/Containers/com.Ababe.UnzipAnyFile` | 4.18 | unzip utility sandbox | Unknown | may hold extracted files you want | not inspected | open the app and review |
| B16 | Build artifacts of **active** projects: `react-native/gpos-b2b-mobile/mobile/node_modules` 9.17 (+ `android/app/build` 2.13); `web/node/new-gpos-b2b-cms/frontend/.next` 6.14; `mobile/react-native/new-gpos-b2b-cms/frontend/.next` 6.14; `flutter/gpos-apj-relasi/build` 3.87; `flutter/gpos-b2b-mobile/build` 3.43; `gpos-b2b-repo/gpos-b2b-cms/.next` 2.87; `react-native/gpos-b2b-mobile-old/build` 2.67; `flutter/video-to-image/build` 2.53; `flutter/bl-log/build` 1.89; `gpos-b2b-repo/gpos-b2b-web/.next` 1.35; `web/node/gpos-b2b-web/.next` 1.18; `react-native/gpos-b2b-cms/.next` 1.00; four CMS `node_modules` ≈ 0.95 each | ≈ 50 | your active projects (commits Sep–Oct 2026) | Yes | rebuild/reinstall time; `.next` of a running dev server must not be deleted while it runs | close dev servers first | clean only projects you will not open this week |
| B17 | `~/Developments/Seed-VC/.venv` | 1.50 | Python env | Yes | `pip/uv` reinstall | — | keep if used |
| B18 | `~/Downloads`: byte-identical duplicate copies (0.12 GB); `.env (1)…(5)` copies | 0.12 | you | No (originals) | — | `.env` files may hold secrets: better moved to a safe place than left in Downloads | review |
| B19 | Chrome on-device AI model (`…/Google/Chrome/OptGuideOnDeviceModel/…/weights.bin`) | 4.0 apparent | Chrome | Yes | Chrome re-downloads it if the feature is on | — | only via Chrome settings (turn off on-device AI); never delete by hand |
| **Σ B** | | **≈ 75–110 GiB depending on choices** | | | | | |

## C. Do not delete

| # | Path | Size | Why |
|---|---|---|---|
| C1 | macOS system: System / Preboot / Recovery volumes, `/private/var/db`, `/private/var/vm/sleepimage`, `/System/Volumes/VM` swapfiles | ≈ 28 + swap | managed by macOS; swap shrinks by itself once memory pressure is gone |
| C2 | `~/Library/Application Support/Google/Chrome` (personal profile) | 6.40 | your personal browser data and sessions |
| C3 | `~/BlatifaStudio` (profile `main` with your login, run, logs, inspections) | 0.16 | needed by Blatifa; contains a login session |
| C4 | `~/Developments/My Project/blatifa-studio/.profiles/discovery` | 0.23 | kept by instruction (P1-U02 decision is yours) |
| C5 | `blatifa-studio/docs/**/evidence`, `.venv`, source | ≈ 0.2 | evidence and the app |
| C6 | `~/Library/Application Support/Claude/vm_bundles` | 10.10 | managed by the Claude app; manage via the app only |
| C7 | **Project source clones**, including apparent duplicates: `gpos-b2b-repo/gpos-b2b-cms` (395 uncommitted changes, 1 unpushed commit), `mobile/react-native/gpos-b2b-cms` (391 / 1), `gpos-b2b-repo/gpos-b2b-web` (14 / 34 commits not on any remote), `web/node/gpos-b2b-web` (0 / 33), `react-native/gpos-b2b-mobile-old` (11 / 3), `flutter/gpos-b2b-mobile` (0 / 3); `new-gpos-b2b-cms` ×2 (7.3 / 7.4 GiB, not git at the top level) | — | contain work that exists nowhere else. Consolidate duplicates only after commit + push and a manual comparison. Their *build artifacts* are covered in B16 |
| C8 | `~/Pictures`, `~/Movies`, WhatsApp media, Google Drive (`~/Library/CloudStorage`, online placeholders) | ≈ 8 | personal data (not inspected) |
| C9 | Docker volumes (inside C12/B12) | — | database data for running containers |

## Suggested order

1. A1–A5 (caches): ≈ 20 GiB in a few minutes. Reaches about **38 GiB free**, above the 30 GiB target.
2. A6–A16 (inactive projects): about +18.6 GiB.
3. From B, only what you decide: the biggest single wins are B4 (11 GiB), B10 (≈ 12–16 GiB) and B16 (per project).

Before each step: close the relevant IDE, emulator, dev server or Docker. After it: check `df -h /`.
