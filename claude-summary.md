Kelima modul Batch 1 sudah diimplementasi dan lulus semua test. Live READ di backend asli belum jalan, karena credential live hanya ada di terminal kamu.

| Modul | Route | Fitur | Test |
|---|---|---|---|
| F20 Produk Sponsor | `/dashboard/sponsored-product` | list, tambah, ubah, hapus, hapus massal | 30 |
| F24 Kode Telesales | `/dashboard/telesales-code` | sama, form lengkap (status, tanggal, produk, channel) | 33 |
| F25 Grup Pelanggan | `/dashboard/customer-group` | sama, ada pencarian pelanggan | 34 |
| F32 FAQ | `/dashboard/faq` | sama | 37 |
| F32 Masukan | `/dashboard/feedback` | list, tanggapi (isi Solusi), hapus, hapus massal | 31 |

**Hasil gate:**
- `tsc`: 0 error.
- eslint: 0 error (28 warning yang sudah ada sebelumnya).
- vitest: 752/752 pass.
- `next build`: sukses, 14 route baru ter-build.
- Bundle check: tidak ada path backend atau nama field wire yang bocor ke browser.

**Bug legacy yang dibetulkan, bukan disalin:**
- F20: form edit tidak memilih ulang produk, jadi save selalu gagal.
- F24: draft tanpa poin dan tanggal mulai = selesai sama-sama ditolak backend.
- FAQ: setiap create yang sebenarnya berhasil malah menampilkan "Gagal membuat faq".
- Masukan: pesan error tidak pernah tampil, dan sort default memakai kolom yang tidak ada.
- Semua modul: pilihan "All" di tabel mengirim `take=-1` ke backend.

Rinciannya ada di `docs/architecture/reviews/BATCH1_MIGRATION_REPORT.md`.

**Yang perlu kamu putuskan atau jalankan:**
1. **F25, jangan live write dulu.** Source backend Grup Pelanggan tidak ada di workspace, jadi kontraknya disimpulkan dari kode legacy. Arti `customer_ids` juga belum jelas: frontend sekarang mengirim id internal pelanggan, padahal legacy kadang mengirim AAM id. Ini perlu dikonfirmasi tim backend.
2. **Backend F20, FAQ dan Masukan rentan SQL injection.** Ketiganya memasukkan `sort_by` mentah ke ORDER BY. Frontend hanya mengirim kolom yang diizinkan, tapi celahnya tetap ada di backend dan sebaiknya dilaporkan.
3. **Halaman baru masih 403 untuk akun kamu.** Capability baru belum ada di `AUTHZ_INTERIM_GRANTS`, sama seperti waktu F11 dan F30. Tambahkan `sponsored-product.*`, `telesales-code.*`, `customer-group.*`, `faq.*`, `feedback.read/update/delete` di env kamu.
4. **Live READ batch** (read-only, tanpa mutasi), jalankan sekali dari terminal kamu:
   ```bash
   cd frontend
   for m in sponsored-product telesales-code customer-group faq feedback; do
     LIVE_MODULE=$m npx vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts
   done
   ```
   Run ini sekaligus mengecek dua hal yang belum terkonfirmasi: `total_rows` FAQ setelah halaman 1, dan sort F20 pada query yang memakai JOIN.

Setelah live READ jalan, saya cek evidence-nya dan update report. Batch 2 (CRUD + upload) bisa lanjut setelah itu.
