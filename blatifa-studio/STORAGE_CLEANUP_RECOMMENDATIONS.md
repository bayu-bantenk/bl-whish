# Storage Cleanup Recommendations

> **Ringkasan (ID):** Ini **rekomendasi**, bukan tindakan. Saya tidak menghapus apa pun. Jalankan langkahnya sendiri (atau minta saya, dengan izin eksplisit per langkah), urut dari atas. Langkah 1 saja kemungkinan sudah mengembalikan 10–19 GiB tanpa menghapus file. Langkah 2–3 (cache dan hasil build) mengembalikan sekitar 100 GiB dengan risiko rendah: yang hilang hanya waktu download/build ulang. Langkah 4 butuh keputusan Anda, yaitu emulator, SDK, dan simulator mana yang masih dipakai.
>
> **Jangan pernah dihapus:** profil Chrome pribadi Anda, `~/BlatifaStudio` (berisi sesi login Blatifa), bukti di `blatifa-studio/docs/`, file sistem macOS, dan swap secara manual.

Source data: `STORAGE_AUDIT.md`. Estimates are ESTIMATED from `du` sizes. The real gain can be smaller, for example because of APFS clones or files still in use.

## Priority 1 — Stop the cause (urgent, no deletion)

| # | Action | Gain | Risk |
|---|---|---|---|
| 1.1 | In the terminal running `npm run dev` for `~/Developments/gpos-b2b-repo/gpos-b2b-web`, press **Ctrl+C**. Check with `ps -axo comm= \| grep -c 'node$'` (should drop from ~358 to a handful) | swap shrinks over minutes: **10–19 GiB** | none |
| 1.2 | If free space does not come back within ~10 min, **restart the Mac** (swap is rebuilt from zero) | up to the full ~20 GiB of swap | none (save your work first) |
| 1.3 | Prevention: when running that dev server again, watch the `postcss.js` count. A growing count indicates a leak in that project's Next 16 dev setup. Consider `next dev --turbo` or upgrading Next/PostCSS, and close unused dev servers. 8 GiB RAM leaves little headroom | prevents a repeat | — |

Do **not** delete swapfiles or `sleepimage` manually.

## Priority 2 — Package caches (low risk, re-downloaded on demand)

| # | Command (run yourself) | Gain | Note |
|---|---|---|---|
| 2.1 | `npm cache clean --force` | ≈ 13.7 GiB | next `npm install` downloads again |
| 2.2 | `go clean -modcache` | ≈ 11.3 GiB | Go modules downloaded again on build |
| 2.3 | Gradle: delete `~/.gradle/caches/8.14.3` (older version) and `~/.gradle/caches/build-cache-1`; optionally the whole `~/.gradle/caches` | 3.5 (≈ 11.5 for all) | stop Android Studio / gradle daemons first (`./gradlew --stop`) |
| 2.4 | `flutter pub cache clean` (and the same for the `.pub-cache-b2b` setup: `PUB_CACHE=~/.pub-cache-b2b flutter pub cache clean`) | ≈ 6.5 GiB | `flutter pub get` downloads again |
| 2.5 | Delete `~/.dartServer` | ≈ 2.1 GiB | recreated by the Dart analyzer |
| 2.6 | `uv cache clean` | ≈ 0.5 GiB | |

Subtotal ≈ 38–46 GiB.

## Priority 3 — Build artifacts of projects you are not actively working on (low risk)

| # | Action | Gain |
|---|---|---|
| 3.1 | Delete `.next` folders except in the project currently running (27 folders, 27.0 GiB; biggest: `web/node/new-gpos-b2b-cms/frontend/.next` 6.1, `mobile/react-native/new-gpos-b2b-cms/frontend/.next` 6.1, `gpos-b2b-repo/gpos-b2b-cms/.next` 2.9, `web/node/gpos-one/.next` 2.0) | up to ≈ 25 GiB |
| 3.2 | `flutter clean` in Flutter projects you are not building now (`gpos-lite-app` 5.0 + 1.5 `.dart_tool`, `gpos-apj-relasi` 3.9, `gpos-b2b-mobile` 3.4, `video-to-image` 2.5, `bl-log` 1.9, …) | up to ≈ 25 GiB |
| 3.3 | Projects under `web/node/archives/` and `tech test/`: delete `node_modules`, `.next`, `build` (or archive the project) | ≈ 5–6 GiB |
| 3.4 | `node_modules` of inactive projects (largest: `gpos-b2b-mobile/mobile/node_modules` 9.2 GiB) | up to ≈ 17 GiB (medium effort to reinstall) |

Subtotal (3.1–3.3) ≈ 55 GiB; with 3.4 ≈ 70 GiB.

## Priority 4 — Toolchains: needs your decision about what you still use

| # | Item | Now | Suggestion | Possible gain |
|---|---|---|---|---|
| 4.1 | Android system images | 9 images, 44.0 GiB | keep only the API levels your emulators/projects target (Android Studio → SDK Manager) | 25–35 GiB |
| 4.2 | Android NDK | 5 versions, 12.7 GiB | keep the version(s) in your `ndkVersion` settings | ≈ 7–10 GiB |
| 4.3 | Emulators (AVD) | 6 AVDs, 13.5 GiB | delete unused ones in Device Manager, or "Wipe data" | 4–10 GiB |
| 4.4 | Shorebird Flutter engines | 17.7 GiB | `shorebird cache clean` (re-downloaded for the version you use) | ≈ 12–16 GiB |
| 4.5 | iOS simulators | 10.6 GiB | `xcrun simctl delete unavailable`; remove old runtimes in Xcode | 3–10 GiB |
| 4.6 | Docker Desktop | 8.3 GiB VM disk | `docker system prune` (images/containers you don't need), or lower the disk limit in Docker settings | 2–6 GiB |
| 4.7 | fvm Flutter versions | 3.13.2 + 3.13.5, 3.9 GiB | `fvm remove 3.13.2` if no project pins it | 1.6 GiB |
| 4.8 | Hugging Face models | 2.8 GiB | `huggingface-cli delete-cache` for models you no longer use (large to re-download) | 0–2.8 GiB |
| 4.9 | `UnzipAnyFile` container | 4.2 GiB | open the app / container and remove extracted leftovers | 0–4 GiB |

Subtotal ≈ 50–80 GiB.

## Priority 5 — Personal files (review only)

- `~/Downloads`: 3 byte-identical duplicate copies (0.12 GB). Larger items: `commandlinetools-mac…zip` 137 MB, `IMG_5136.MOV` 125 MB, two `Krisbow Sync …` files 108 MB each, MobSF zip 96 MB. Several `.env (n)` copies are also there. These may hold secrets, so consider moving them out of Downloads.
- `~/Pictures` 6.8 GiB: not inspected.
- Claude desktop `vm_bundles` (10.1 GiB): managed by the Claude app. Do not delete by hand. If you don't use its VM features, check the app's own settings.

## Blatifa Studio items

| Item | Recommendation |
|---|---|
| `blatifa-studio/.profiles/discovery` (233 MiB, contains a Google login session) | Delete **only with your explicit OK** (P1-U02). Profile `main` replaces it. Deleting it is a security improvement, not a space gain |
| `~/BlatifaStudio`, `docs/**/evidence` | keep |
| Future Phase 2+ downloads | one clip ≈ 3 MB (720p, 8 s). A 36-scene episode with retries is < 0.5 GiB. Space is needed mainly for headroom, not for Blatifa itself |

## Target before Phase 2 live testing

- Preflight gate minimum: **2 GiB free** (enforced in code: `DISK_LOW`).
- Recommended working margin on this 8 GiB-RAM Mac, given swap can grow by 10+ GiB: **≥ 30 GiB free** (roadmap requirement, Phase 4). Priorities 1–2 alone should reach it.
