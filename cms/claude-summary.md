Rekomendasi Batch 3 adalah empat modul dengan urutan **F04 → F10 → F09 → F06**. Laporannya ada di `cms/BATCH3_SCOPE_DISCOVERY.md`. Tidak ada kode yang diubah dan tidak ada panggilan live.

**1. Modul yang direkomendasikan:**

| # | Modul | Cakupan | Alasan |
|---|---|---|---|
| 1 | **F04 Order Review** | list + detail (read-only) | Kontrak terverifikasi di source order-service, tanpa master data, risiko rendah |
| 2 | **F10 Personalisasi Katalog** (inti) | CRUD katalog, criteria per katalog, produk homepage katalog | Kontrak terverifikasi di product-service; memakai ulang repository criteria dan 7 picker dari F18 |
| 3 | **F09 Produk Gpos B2b** | 3 tab: setting, criteria, produk homepage | Pola sama dengan F10; upload signed-URL sudah terverifikasi |
| 4 | **F06 Inventory/Persediaan** | CRUD inventory + stok | Kontrak penuh terverifikasi; melengkapi menu "Produk & Katalog". Live WRITE tetap tidak diizinkan |

**2. Alasan urutan:** F04 paling kecil dan read-only, jadi aman sebagai pemanasan. F10 dikerjakan sebelum F09 karena F10 membangun komponen criteria dan produk homepage yang dipakai ulang F09. F06 paling akhir karena permukaan write-nya terbesar: stok mengubah katalog yang dilihat pembeli. Kalau kapasitas terbatas, F06 bisa dipindah ke Batch 4 tanpa memengaruhi modul lain.

**3. Blocker utama:**
- **Keputusan produk:**
  - OD-09: drop fitur delete di Order Review, karena tidak ada handler backend-nya.
  - OD-07: 17 route REVIEW di F10 (layar CCPH dan criteria standalone) tetap di luar scope.
  - Batas F30 untuk F09: key global configuration mana yang dimiliki tab setting F09.
- **Bug backend yang memengaruhi kandidat:** kelas bug `Updates(struct)` membuat nilai nol atau kosong tidak tersimpan. Ini ada di repository backend F09 dan F10. Dicatat, tanpa workaround.
- **Di luar Batch 3:**
  - F26 BLOCKED, karena source config_service tidak ada.
  - F14 dan F16 BLOCKED oleh OD-07; F14 juga punya fix GOPH-4102 yang belum di-merge.
  - F27 dan F31 BLOCKED karena belum ada strategi akun test (approve/reject dan revoke menyentuh user asli).
  - F03, F05, F12, F13, F17, F21, F22, F23 dan F29 dijadwalkan nanti, karena write-nya berdampak nyata: ERP, pembayaran, poin, voucher, push notification.

**4. Evidence gap:**
1. Bentuk respons live untuk F04, F06, F09 dan F10. Ini akan didapat lewat live READ saat Batch 3, seperti di Batch 2.
2. Keputusan OD-09, OD-07 dan batas F30.
3. Key `global-configurations` yang dipakai tab setting F09.
4. Source config_service.
5. Kesamaan versi lokal dengan `origin/development` untuk loyalty-service (clone lokal tertinggal 6 commit) dan payment-service.
6. Otorisasi gateway untuk token non-superadmin (A2-U04).
7. Definisi OD-P1 dan OD-P4, yang dirujuk di dokumen tapi tidak didefinisikan di `A4_OPEN_DECISIONS.md`.

Ada tiga dokumen lama yang ternyata keliru, dan sudah saya koreksi di laporan berdasarkan evidence:
- Upload signed-URL sudah terverifikasi sejak Batch 2. Tulisan "upload BLOCKED" di A7 sudah usang.
- Path stok F06 sudah jelas, jadi "CONTRACT_UNKNOWN" di A7 bisa dicabut.
- Keputusan untuk dashboard adalah OD-10, bukan OD-P4.

**5. File yang berubah:**
- Baru: `cms/BATCH3_SCOPE_DISCOVERY.md` (194 baris, belum di-commit).
- `git diff --check` bersih dan tidak ada trailing whitespace.
- Karena file baru masih untracked, `git diff -- cms/BATCH3_SCOPE_DISCOVERY.md` tidak menampilkan apa-apa.

Di `git status`, empat file Batch 2 (`BATCH2_CLOSURE_GATE.md`, `BATCH2_MIGRATION_REPORT.md`, `summary.md`, `claude-summary.md`) masih berstatus modified. Itu sisa tugas closure Batch 2 sebelumnya yang belum kamu commit, bukan perubahan dari discovery ini.

Konfirmasi: tidak ada CREATE, UPDATE, DELETE, upload maupun panggilan API live. F11 W3 tidak dimulai. Kode aplikasi, test dan backend tidak berubah. Implementasi Batch 3 belum dimulai.