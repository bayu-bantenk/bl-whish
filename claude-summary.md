A7 selesai. Modul berikutnya yang dipilih berdasarkan evidence adalah **Konfigurasi Umum (F30)**. Laporannya ada di `frontend/docs/architecture/reviews/A7_NEXT_MODULE_SELECTION_AUDIT.md` (321 baris, satu-satunya file yang berubah). Tidak ada kode yang ditulis dan tidak ada request ke backend.

```text
A6 = HOLD / BLOCKED
D-A6R2-01 = OPEN / CRITICAL

Selected Next Module = Konfigurasi Umum (F30)
API Readiness        = CONTRACT_PARTIAL
Vertical Slice       = SUITABLE
Proposed phase       = A7 — Konfigurasi Umum Contract & Readiness  (readiness saja, belum implementasi)
```

**Hasil kelayakan:**

| Kelompok | Modul |
|---|---|
| ELIGIBLE (lolos 10 syarat, tanpa ranking) | F11 Pembatasan produk, F20 Produk Sponsor, F24 Kode Telesales, F25 Grup Pelanggan, F30 Konfigurasi Umum, F32 FAQ |
| BLOCKED karena A6 | F32 Konten |
| BLOCKED karena upload | 11 modul (F07, F08, F09, F12, F16, F17, F18, F19, F21, F28, F29) |
| BLOCKED karena workflow / toggle status | 10 modul (F03, F05, F13, F14, F17, F21, F22, F23, F26, F27) dan F31 Manajemen Pengguna (toggle `update-is-active` pada akun user asli, tanpa record uji) |
| INSUFFICIENT EVIDENCE | F02, F04, F06, F10, F14, F15, F32 Masukan |

Beberapa modul (F14, F16, F17, F21) masuk ke lebih dari satu kelompok. Rinciannya per modul ada di laporan.

**Alasan memilih F30:** dari enam kandidat, hanya F30 yang memenuhi semua poin berikut.
- **Tidak ada dependency hulu:** tidak butuh options atau lookup dari fitur lain.
- **Evidence kontraknya paling lengkap:** kode legacy, peta gateway A2, dan source backend beserta Swagger untuk setiap operasinya.
- **Modelnya aman dari kelas bug D-A6R2-01:** hanya dua field, `key` dan `value`, keduanya string `required`.
- **Bentuk list-nya sama dengan list Content** yang sudah diverifikasi live (`sort_by/asc_desc/page/take/keyword`), jadi pola A6 bisa diuji ulang di service dan domain lain.

**Verifikasi angka scope:**
- **VERIFIED:** 32 feature, 427/330 route, 259 MIGRATE (dihitung langsung dari baris matrix: 259/49/119), 107 screen, 32 DataTable, 9 custom list, 13 upload.
- **PARTIALLY VERIFIED:** 40 form (tabel hanya 39 baris), 55 dialog (39 baris), dan 34 fungsi HTML (22 baris). Selisih ini kemungkinan karena satu baris tabel mewakili beberapa item.
- **CONTRADICTED:** rincian REMOVE di teks A4 §1 menjumlah 120, sedangkan baris matrix menjumlah 119. Total 427 dan 119 sendiri tetap konsisten.

**Risiko yang terkonfirmasi untuk F30:**
- **Nilai konfigurasi dipakai logic bisnis backend:** `MAINTENANCE`, `BANNER_INTERVAL`, `CUSTOMER_CHANNEL_ID_ONLY_…`, dan `PRODUCT_IDS_ONLY…`. Akibatnya verifikasi live hanya boleh memakai key uji baru yang inert.
- **Kolom "Created" dan sort default `created_at DESC` di legacy tidak punya field di respons backend** (`{id, key, value}`). Ini kelas risiko yang sama dengan R2 di Content.
- **`updatebyproductgposb2b` terdaftar di route F30 tetapi dipanggil dari F09**, jadi batas scope-nya harus diputuskan di fase readiness.

Self-check:

```text
[x] A6 tetap HOLD/BLOCKED
[x] D-A6R2-01 tetap OPEN/CRITICAL
[x] Tidak ada source code berubah (checksum identik)
[x] Tidak ada test berubah
[x] Tidak ada config/.env berubah (checksum identik)
[x] Tidak ada API mutation / DB mutation (tidak ada HTTP request sama sekali)
[x] Tidak ada A6 workaround
[x] Seluruh module inventory diperiksa (34 baris; F32 dipecah 3)
[x] Selection berdasarkan evidence, tanpa ranking/score
[x] Unknown tetap UNKNOWN
[x] Tidak ada invented API contract
[x] Report A7 dibuat
```

`git diff --stat` dan `git status --short` tetap sama seperti baseline (82 file / 261 entri). Folder `docs/` masih untracked, dan belum ada yang di-commit.
