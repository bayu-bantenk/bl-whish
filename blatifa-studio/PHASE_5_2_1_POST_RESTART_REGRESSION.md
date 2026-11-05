# Phase 5.2.1 — Post-Restart Full Regression

Status: **regresi penuh LULUS** (percobaan ke-2, 2026-11-05) · Percobaan ke-1 (2026-11-04) diblokir dan tetap dicatat di bawah sebagai riwayat.

## Percobaan 1 — 2026-11-04 16:24 WIB (BLOCKED, riwayat)

Mac belum di-restart: boot terakhir Nov 3 15:38. Swap 7716→7762 dari 8192 MB, disk 18 GiB, load average 16,9. Hasilnya: berhenti di STEP 1. Tidak ada test, rename, atau perubahan kode.

Bukti: bagian pertama `evidence/preflight_post_restart.log`.

## Percobaan 2 — 2026-11-05

### STEP 1 — Preflight (15:50 WIB)

| Item | Nilai | Gerbang |
|---|---|---|
| Boot / uptime | Nov 5 15:25:12 / 25 menit | restart terkonfirmasi |
| Free disk | 13 GiB | PASS |
| Swap | 0 MB | PASS |
| Memori | `memory_pressure` 36 % bebas; load average 2,2 | aman |
| Git | bukan repositori git | — |
| Test / konfigurasi | 369 test; `-ra --strict-markers`, retention `failed` / 1000000, basetemp per run | tidak berubah |
| Folder temp lama | `blatifa-pytest-runs/` dan `pytest-sentinel-p51` hilang dari `$TMPDIR`, **dibersihkan macOS saat restart** (perilaku yang sudah diketahui sejak Phase 5), bukan dihapus oleh tugas ini | — |

Bukti: bagian kedua `evidence/preflight_post_restart.log`.

### STEP 2 — Regresi penuh (15:50:27–15:57:05)

Perintah: `env -u BLATIFA_LIVE uv run pytest -p no:cacheprovider -rA`. Basetemp per run dari `tests/pytest_safety.py`.

| | Hasil |
|---|---|
| Total | **362 passed, 0 failed, 7 skipped** (396 s) |
| Skipped | 7 test live opt-in (`BLATIFA_LIVE` tidak diset), sesuai brief tidak dijalankan |
| 134 test yang dulu ditunda | **127 passed, 0 failed, 7 skipped (live)** |

Rincian 134 test yang ditunda:

| File | Hasil |
|---|---|
| `tests/browser/` (8 file) | 43 passed |
| `test_episode_e2e.py` | 20 passed |
| `test_scene_and_crash_sweep.py` | 21 passed |
| `test_runner_simulation.py` | 17 passed |
| `test_phase4_ui.py` | 15 passed |
| `test_phase4_readiness.py` | 11 passed |
| `tests/live/test_flow_live.py` | 7 skipped |

Semua test Phase 5.2.1 (9), adapter browser, simulasi episode, crash/reconcile, UI/readiness, keamanan, dan otorisasi lulus. Tidak ada ekspektasi test yang diubah untuk regresi ini.

Bukti: `evidence/pytest_full_post_restart.log`.

### STEP 3 — Nama `LEGACY_VIDEO_LOCATOR_BROKEN`

**Temuan:** nama itu sekarang menyesatkan. Catatan dibuat ketika `grid.video_thumbnail` **tidak VERIFIED** (`legacy_ok = status is VERIFIED`). Statusnya kini STATE_DEPENDENT, bukan BROKEN. Hanya adapter yang membuat catatan ini; tidak ada kode `src` yang membacanya, hanya dua test browser.

**Koreksi:** catatan diganti nama menjadi `LEGACY_VIDEO_LOCATOR_NOT_VERIFIED`, sesuai syarat yang sebenarnya.

| File | Perubahan |
|---|---|
| `src/blatifa/flow/adapter.py` (baris 111–113) | string catatan diganti nama; komentar menyebut nama lama dan alasannya. Syarat `legacy_ok`, cabang, dan `Tile` yang dihasilkan **tidak berubah** |
| `tests/browser/test_flow_adapter.py:49` | nama baru; tetap kesetaraan persis |
| `tests/browser/test_adapter_v2_grid.py:55` | nama baru; tetap kesetaraan persis (×3 untuk varian legacy, kosong untuk lainnya) |

Riwayat dipertahankan:
- Dokumen Phase 5.1 dan Phase 5.2.1 yang memakai nama lama **tidak diubah**.
- Bukti dan putusan BROKEN Phase 5 tetap tercatat di `notes` registry.
- `LOCATOR_BROKEN` di `authorization.py` tidak tersentuh. Itu alasan generik untuk entri yang benar-benar BROKEN, bukan catatan ini.

**Rerun** test terdampak: `tests/browser` + `test_phase5_2_1_registry_correction` + `test_phase5_1_runner_compat` + `test_phase5_1_recognition` → **89 passed, 0 failed**. Lint `ruff check src tests tools`: **bersih**.

Bukti: `evidence/pytest_rename_rerun.log`.

### STEP 4 — Bukti akhir

| Item | Nilai |
|---|---|
| Disk sebelum → sesudah suite | 13 → 11 GiB. Selisihnya karena macOS membuat file swap 2 GiB (swap total 0 → 2048 MB, terpakai 852 MB); folder temp test yang lulus tidak disimpan (`retention_policy = failed`) |
| Disk / swap setelah rerun | 11 GiB / 844 MB |
| Kegagalan test | tidak ada |
| File yang diubah | `src/blatifa/flow/adapter.py`, `tests/browser/test_flow_adapter.py`, `tests/browser/test_adapter_v2_grid.py`, dokumen ini, `PHASE_5_2_1_EVIDENCE_REGISTER.md` (baris baru), `evidence/preflight_post_restart.log`, `evidence/pytest_full_post_restart.log`, `evidence/pytest_rename_rerun.log` |
| Runner, state machine, otorisasi produksi | **tidak berubah**. Tidak ada file di `production/` yang disentuh; perubahan adapter hanya pada string diagnostik |
| Aksi live | tidak ada Chrome live, Flow, kredit, upload, Approve, Reject, atau Publish |

### STEP 5 — Putusan

| # | Kemampuan | Putusan |
|---|---|---|
| 1 | Kompatibilitas skema registry | **VERIFIED** (suite penuh) |
| 2 | Perilaku locator STATE_DEPENDENT | **VERIFIED OFFLINE** (suite penuh; bukti live dari satu tile dan satu sesi) |
| 3 | Regresi penuh | **PASS**: 362 passed, 0 failed, 7 live skipped |
| 4 | Kompatibilitas adapter browser | **VERIFIED** dengan fixture lokal (43 test browser) |
| 5 | Kesiapan runner produksi | **NOT READY** untuk live (tidak berubah) |
| 6 | Deteksi generating vs completed | **NOT READY** |
| 7 | Identitas media video | **UNRESOLVED** |
| 8 | Asosiasi adegan ke video | **NOT READY** |

**Tidak ada PASS keseluruhan.** Kemampuan 5–8 masih butuh eksperimen generate terkontrol (Phase 5.2), dengan izin terpisah.
