# Phase 5.2.1 — Post-Restart Full Regression

Tanggal: 2026-11-04 16:24 WIB · Status: **BLOCKED di STEP 1 (preflight)**

## Ringkasan

Preflight gagal di gerbang swap. Mac **belum di-restart**: waktu boot terakhir Tue Nov 3 15:38, sebelum Phase 5.2. Swap juga masih 7,7–7,8 dari 8 GiB, dan naik di antara dua kali baca. Karena itu STEP 2–3 **tidak dijalankan**. Tidak ada test, Chrome, rename, atau penghapusan file.

## STEP 1 — Preflight

| Item | Nilai | Gerbang |
|---|---|---|
| Boot / uptime | Nov 3 15:38:04 / 1 hari 46 menit | **tidak ada restart** |
| Free disk | 18 GiB (`df -h`), 19 GB (`df -H`) | PASS (≥ 10 GiB) |
| Swap | 7716 → 7762 MB dari 8192 MB (~95 %) | **FAIL** (tidak wajar dan naik) |
| Memori | 8 GiB fisik; ~59 MB halaman bebas; `memory_pressure` 27 % bebas; load average 16,9 | berisiko |
| Git | bukan repositori git | — |
| Jumlah test | 369 terkumpul (`--collect-only`) | — |
| Konfigurasi pytest | `-ra --strict-markers`, retention `failed` / 1000000, basetemp per run | tidak berubah |
| Folder temp lama | `blatifa-pytest-runs/` (6 run) dan `pytest-sentinel-p51` ada, tidak disentuh | — |

Bukti: `evidence/preflight_post_restart.log`.

## STEP 2–5 — Tidak dijalankan

| Langkah | Status |
|---|---|
| Regresi penuh (termasuk 134 test yang ditunda) | **NOT RUN** |
| Rename `LEGACY_VIDEO_LOCATOR_BROKEN` | **NOT DONE**: brief mensyaratkan regresi penuh lulus lebih dulu |
| Lint | tidak dijalankan ulang (terakhir bersih, Phase 5.2.1) |
| File yang diubah | hanya dokumen ini, `evidence/preflight_post_restart.log`, dan baris baru di evidence register |

Runner, state machine, dan otorisasi produksi **tidak berubah**, karena tidak ada kode yang disentuh.

## Putusan

| # | Kemampuan | Putusan |
|---|---|---|
| 1 | Kompatibilitas skema registry | **VERIFIED OFFLINE (subset ringan)**; regresi penuh belum |
| 2 | Perilaku locator STATE_DEPENDENT | **VERIFIED OFFLINE (subset ringan)**; regresi penuh belum |
| 3 | Regresi penuh | **NOT RUN (blocked)** |
| 4 | Kompatibilitas adapter browser | **NOT VERIFIED**: test browser belum dijalankan setelah perubahan |
| 5 | Kesiapan runner produksi | **NOT READY** untuk live (tidak berubah) |
| 6 | Deteksi generating vs completed | **NOT READY** |
| 7 | Identitas media video | **UNRESOLVED** |
| 8 | Asosiasi adegan ke video | **NOT READY** |

Tidak ada PASS keseluruhan.

## Agar bisa dilanjutkan

1. Restart Mac sungguhan (Apple menu → Restart), lalu tutup aplikasi berat sebelum menjalankan ulang.
2. Jalankan ulang brief ini. Preflight harus menunjukkan uptime baru dan swap rendah.
