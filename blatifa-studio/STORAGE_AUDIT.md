# Storage Audit (read-only)

> **Ringkasan (ID):** Audit ini hanya membaca, tidak ada file yang dihapus, dipindah, atau diubah.
>
> **Temuan utama:** disk hampir penuh, sisa **0,44 GiB** pada 17:05 WIB. Sumbernya bukan file biasa, melainkan **swap macOS yang membengkak menjadi 20 GiB**. Penyebabnya, server dev Next.js (`npm run dev` di `gpos-b2b-web`, berjalan sejak 15:35) membuat **355 proses `postcss.js` yang tidak pernah ditutup**. RAM 8 GiB habis, lalu macOS menulis memori ke disk sebagai swap. Ini juga menjelaskan kenapa ruang kosong naik-turun sepanjang hari (11 → 7,5 → 4,8 → 12 → 0,44 GiB).
>
> Di luar swap, ada sekitar **100 GiB cache dan hasil build** yang bisa dibuat ulang (risiko rendah), ditambah **60–90 GiB** tooling Android/Flutter/iOS lama yang perlu Anda putuskan dulu.

- Date: 2026-11-02, 16:38–17:08 WIB. Machine: macOS (Darwin 25.5.0), 8 GiB RAM, APFS container 494.4 GB.
- Method: `df`, `diskutil apfs list`, `tmutil listlocalsnapshots`, `sysctl vm.swapusage`, `du -xk` (depth 1–2), `find` (build-artifact folders), `ps` (memory), `shasum` (duplicates in Downloads). Raw outputs: `evidence/storage/`.
- Nothing was deleted, moved, renamed or chmod-ed. No process was stopped except Blatifa's own Chrome.
- Units: GiB (du/df binary units). Sizes are allocated size from `du`. Status labels: VERIFIED = measured in this audit; ESTIMATED = derived; UNVERIFIED = not measured.

## 1. Volume state — VERIFIED

| Measurement | 16:38 | 17:05 |
|---|---|---|
| Data volume used / free (`df`) | 415 GiB / **12 GiB** | 416 GiB / **0.44 GiB** |
| APFS container unallocated | 12.6 GB | 0.49 GB |
| Swap (`vm.swapusage`) | 11.0 GiB used | **19.7 GiB used (20 × 1 GiB swapfiles)** |
| VM volume (holds swap) | 9.7 GB | ≈ 20 GB |
| APFS local snapshots (`tmutil`) | none | none |

Re-check on 2026-11-03, after the dev server was stopped by the user (0 `node` processes): **16 GiB free, swap 5.4 GiB used**. This confirms the swap cause (≈ 15 GiB recovered without deleting files).

APFS volumes: System 12.6 GB, Preboot 10.8 GB, Recovery 2.6 GB, VM (swap) ≈ 20 GB, Data ≈ 446 GB. All share one container, so swap growth directly consumes the free space.

## 2. Root cause of the falling free space — VERIFIED

| Evidence | Value |
|---|---|
| Swapfiles in `/System/Volumes/VM` | swapfile0–19, 1 GiB each; swapfile8–19 created 16:30–16:52 |
| `node` processes | **358**; **355 of them are children of `next-server (v16.1.6)`** (pid 25199) |
| Parent | `npm run dev` in `~/Developments/gpos-b2b-repo/gpos-b2b-web`, started 15:35:01 |
| Children | `node …/gpos-b2b-web/.next/dev/build/postcss.js <port>`: 17 started in the 15:00 hour, **338 in the 16:00 hour** |
| Memory | page-outs 469,910; free 4,000 pages; wired 4.1 GiB |

Conclusion: the Next.js dev server leaks PostCSS worker processes. Their memory is paged out to swap, and swap grows by 1 GiB at a time on the same disk. This is the "other process" suspected in Phase 1 (O-P1-01). Blatifa uses < 0.6 GiB on disk (§4).

Freeing it (user action, not performed): stop that dev server (Ctrl+C in its terminal). macOS releases swapfiles as memory pressure drops. A restart resets swap completely. The amount recovered depends on what else is running: ESTIMATED 10–19 GiB.

## 3. Where the 416 GiB is

### 3.1 Top level — VERIFIED (`du -xk`)

| Location | Size | Class |
|---|---|---|
| `~` (home) | **315.9 GiB** | user + app data |
| `/Applications` | 25.6 GiB | applications |
| `/Library` | 25.0 GiB | system-wide app data |
| `/usr/local` | 10.3 GiB | Homebrew (Intel prefix) / tools |
| `/private/var/folders` | 4.6 GiB | per-user temp/cache (system-managed) |
| `/opt` | 4.2 GiB | Homebrew |
| `/private/var/db` | 2.3 GiB | system |
| `/private/var/vm/sleepimage` | 2.0 GiB | hibernation image (system) |

### 3.2 Home folder — VERIFIED

| Folder | Size | Main contents |
|---|---|---|
| `~/Library` | 115.9 GiB | Android SDK 61.7 · Application Support 28.1 · Containers 13.4 · CoreSimulator 10.6 |
| `~/Developments` | 93.3 GiB | mobile 47.9 (react-native 24.5, flutter 23.3) · web/node 21.3 · gpos-b2b-repo 6.3 · Seed-VC 6.2 · tech test 4.1 |
| `~/.shorebird` | 18.1 GiB | `bin/cache/flutter` 17.7 (several Flutter engine revisions, 1–2 GiB each) |
| `~/.npm` | 14.1 GiB | `_cacache` 13.7 (download cache) |
| `~/.android` | 13.5 GiB | 6 emulator AVDs (Pixel_8_Pro_2 5.4, Pixel_8_Pro 4.0, Pixel_3_XL 4.0, …) |
| `~/go` | 11.6 GiB | `pkg/mod` 11.3 (module cache) |
| `~/.gradle` | 11.6 GiB | caches 8.14.5 5.2 · 8.14.3 3.0 · modules-2 2.8 · build-cache 0.5 |
| `~/Pictures` | 6.8 GiB | user photos (not inspected) |
| `~/fvm` | 3.9 GiB | Flutter 3.13.5 (2.3), 3.13.2 (1.6) |
| `~/.pub-cache`, `~/.pub-cache-b2b` | 3.6 + 2.9 GiB | Dart package caches |
| `~/.cache` | 3.3 GiB | huggingface 2.8 · uv 0.5 |
| `~/.rustup` | 2.5 GiB | Rust toolchains |
| `~/.dartServer` | 2.1 GiB | Dart analysis cache |
| `~/.local` | 1.8 GiB | claude 1.1 · mise 0.6 |
| `~/Downloads` | 1.3 GiB | 255 files; byte-identical duplicates 0.12 GB (3 copies) |
| others (each < 1.4 GiB) | ≈ 10 GiB | .BurpSuite, .m2, .vscode, .antigravity, .codeium, .cursor, … |

### 3.3 Inside `~/Library` — VERIFIED

| Item | Size | Notes |
|---|---|---|
| Android `sdk/system-images` | 44.0 GiB | 9 images: android-30, 32 (4.2), 33 (11.2), 34 (4.2), 36 (8.5), 36-ext19 (4.3), 36.1 (4.3), 37.0 (4.3), UpsideDownCakePrivacySandbox (3.1) |
| Android `sdk/ndk` | 12.7 GiB | 5 versions: 25.1, 26.1, 27.0, 27.1, 28.2 (2.1–3.0 each) |
| Android build-tools / platforms / emulator | 1.5 / 1.2 / 0.9 GiB | |
| `Application Support/Claude` | 11.1 GiB | `vm_bundles` 10.1 (Claude desktop app's VM image, app-managed) |
| `Application Support/Google/Chrome` | 6.6 GiB | **the user's personal Chrome profile: do not touch** |
| `Application Support/Code` | 3.5 GiB | VS Code data |
| `Application Support` com.openai.atlas / Postman | 1.6 / 1.5 GiB | |
| `Containers/com.docker.docker` | 8.3 GiB | Docker Desktop VM disk (`Data/vms`) |
| `Containers/com.Ababe.UnzipAnyFile` | 4.2 GiB | unzip utility sandbox (likely extracted archives; not inspected) |
| `Developer/CoreSimulator/Devices` | 10.6 GiB | iOS simulators (largest 2.7, 2.6, 1.7, 1.6, 1.2 GiB) |
| `Group Containers/…WhatsApp` | 1.2 GiB | chat media |
| `~/Library/Caches` | 0.5 GiB | small |

Largest single files (`find -size +500M`, apparent size):
- `Docker.raw` 32 GiB. This is a sparse file: only 8.3 GiB is actually allocated.
- Claude `rootfs.img` 10 GiB.
- Android `system.img` files, 3–8 GiB each.
- Chrome `OptGuideOnDeviceModel/…/weights.bin` 4.0 GiB. This is Chrome's on-device AI model inside the personal Chrome folder. It is removable only through Chrome's own setting, never by hand.
- AVD `userdata-qemu.img.qcow2` files, 3.4–3.6 GiB each.
- Hugging Face `hubert-large-ll60k` blobs, 1.2 GiB × 2.

Files under `~/Library/CloudStorage/GoogleDrive-…` appear with apparent sizes up to 3.4 GiB. They are not part of the allocated `du` totals, which is consistent with online-only placeholders (UNVERIFIED per file).

### 3.4 Build artifacts inside `~/Developments` — VERIFIED (`find` + `du`)

| Type | Folders | Size | Regenerable by |
|---|---|---|---|
| `.next` | 27 | **27.0 GiB** | `next build` / `next dev` |
| `build` (Flutter/Android/RN) | 42 | **25.1 GiB** | `flutter build` / gradle |
| `node_modules` | 41 | 16.8 GiB | `npm install` |
| `.dart_tool` | 94 | 3.8 GiB | `flutter pub get` |
| `.venv` | 6 | 2.2 GiB | `uv sync` / `pip install` |
| `Pods` | 5 | 0.6 GiB | `pod install` |
| `.gradle` (per project) | 20 | 0.4 GiB | gradle |
| **Total** | 235 | **75.8 GiB** | |

Largest single ones: `mobile/react-native/gpos-b2b-mobile/mobile/node_modules` 9.2; `web/node/new-gpos-b2b-cms/frontend/.next` 6.1; `mobile/react-native/new-gpos-b2b-cms/frontend/.next` 6.1; `mobile/flutter/gpos-lite-app/build` 5.0; `mobile/flutter/gpos-apj-relasi/build` 3.9. Some are under `archives/` and `tech test/` (likely inactive; unverified). `gpos-b2b-web/.next` (1.3 GiB) belongs to the **running** dev server.

## 4. Blatifa Studio data — VERIFIED

| Item | Size | Status |
|---|---|---|
| `~/BlatifaStudio` (workspace: profile `main`, logs, inspections) | 160 MiB | keep (contains the login session) |
| `blatifa-studio/.profiles/discovery` (Phase 0 profile) | 233 MiB | keep until the user decides (P1-U02) |
| `blatifa-studio/.venv` | 177 MiB | keep |
| `blatifa-studio/docs` (incl. evidence media) | 30 MiB | keep (evidence) |
| **Total** | ≈ 0.6 GiB | none of it is a cleanup target in this audit |

Side finding (fixed in code, not on disk): `~/BlatifaStudio/inspections` has mode 755. The workspace root is 700, so other users still cannot enter. `new_report_dir` now forces the parent to 700 the next time a report is written (unit test `test_report_dirs_and_their_parent_are_private`).

## 5. Classification

| Class | Size (GiB) | Examples |
|---|---|---|
| macOS system (do not touch) | ≈ 28 + swap | System, Preboot, Recovery, `/private/var/db`, sleepimage, swap (managed by macOS) |
| Applications | 25.6 | `/Applications` |
| Shared app data | 25.0 | `/Library` |
| Developer toolchains & SDKs | ≈ 135 | Android SDK 61.7, AVD 13.5, shorebird 18.1, CoreSimulator 10.6, Docker 8.3, fvm 3.9, rustup 2.5, `/usr/local` + `/opt` 14.5 |
| Package/download caches | ≈ 47 | npm 13.7, gradle 11.5, go 11.3, pub 6.5, dartServer 2.1, uv 0.5, huggingface 2.8 |
| Project build artifacts | 75.8 | `.next`, `build`, `node_modules`, … |
| Project source & other dev data | ≈ 17 | rest of `~/Developments` |
| App data (personal) | ≈ 25 | Claude 11.1, personal Chrome 6.6, VS Code 3.5, WhatsApp 1.2, … |
| User files | ≈ 9 | Pictures 6.8, Downloads 1.3, Movies 0.4 |
| Blatifa Studio | 0.6 | §4 |

Not measured (UNVERIFIED): other user accounts, `/private/var` outside `folders`/`db`/`vm`, contents of Pictures, and whether each project or emulator is still in use.

## 6. Recoverable storage estimate

| Tier | What | Est. GiB | Risk |
|---|---|---|---|
| 0 | Stop the leaking Next.js dev server; swap shrinks (or restart the Mac) | 10–19 (ESTIMATED) | none (no files touched) |
| 1 | Package/download caches (npm, gradle, go mod, pub, dartServer, uv, `~/Library/Caches`) | ≈ 46 | low: re-downloaded on demand |
| 2 | Build artifacts of inactive projects (`.next`, `build`, `.dart_tool`) | up to ≈ 56 | low: rebuild time |
| 2b | `node_modules` / `.venv` of inactive projects | up to ≈ 19 | low–medium: reinstall time, lockfile needed |
| 3 | Unused Android system images / NDKs / AVDs, old shorebird engines, iOS simulators, Docker prune, old fvm versions | ≈ 50–80 (depends on what you still use) | medium: needs your decision |
| — | Downloads duplicates | 0.12 | low |

**Safely recoverable without decisions about which tools you still use (Tiers 1 + 2): ≈ 100 GiB**, plus Tier 0. Details and order: `STORAGE_CLEANUP_RECOMMENDATIONS.md`.
