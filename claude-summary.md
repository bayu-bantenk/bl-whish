F11 Pembatasan produk sudah diimplementasi dan semua test lolos, tetapi statusnya **HOLD**. Alasannya: live READ belum jalan, karena kredensial hanya ada di terminal Anda, bukan di proses saya. Live WRITE juga belum dijalankan. Tidak ada cacat yang memblokir.

Sebelum mulai, evidence WRITE F30 sudah saya cek ulang: 1 POST (201), 1 PUT (200), dan 1 DELETE (200), masing-masing dengan read-back yang cocok.

```text
F11 Migration Status: HOLD (live verification pending; no defect blocker)
```

**Contract: PARTIAL, tetapi aman diimplementasi.** Source legacy dan backend (product-service, account-service) lengkap dan konsisten; perilaku runtime menunggu live READ.
- **Makna "Pembatasan produk"** (VERIFIED dari kode): satu record per **produk** berisi **whitelist tipe channel customer**. Produk disembunyikan dari customer di channel lain lewat cache Redis. Tidak ada status, tanggal, maupun prioritas.
- **Edit hanya mengubah channel;** produknya tetap, baik di legacy maupun backend.
- **Perilaku backend:**
  - sort sudah di-allowlist di backend;
  - produk yang sudah dibatasi menghasilkan 400 "Product already restricted";
  - ID tidak dikenal menghasilkan 404;
  - update tidak terkena kelas bug D-A6R2-01.

**Implementation:**
- Package `src/packages/product-restriction/` dengan pola A6/F30, dan route `/dashboard/product-restriction[/create|/update/[id]]` di grup menu "Produk & Katalog".
- **Pemilih produk** memakai pencarian lewat Server Action; browser tidak pernah memanggil backend.
- **Tipe channel** dipilih lewat checkbox, dan ID-nya dicek terhadap daftar channel asli sebelum create/update. Backend sendiri menyimpan string apa pun.
- **Minimal 1 channel wajib dipilih** (aturan legacy). Backend menerima daftar kosong, yang diam-diam akan menghapus pembatasan.
- **Bulk delete tidak dibuat.**
- `ConfirmDeleteButton` dipindah ke shared karena sekarang punya konsumen kedua; F30 hanya berubah import-nya.
- Otorisasi fail-closed dengan 4 capability `product-restriction.*`.

**Tests:**

| Gate | Hasil |
|---|---|
| Unit / integration | **581/581** (+25 F11) |
| E2E (mock) | **82/82** (+8 F11, termasuk axe; reader 403 dengan 0 write) |
| Lint | 0 error |
| Build | lolos |
| Bundle check | lolos |

**Live READ — PENDING, belum dijalankan.** Jalankan di terminal Anda:

```bash
cd frontend
LIVE_MODULE=product-restriction npx vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts
```

**Live WRITE — PENDING, belum dijalankan.** Selain `MODULE_LIVE_WRITE_CONFIRM=yes`, Anda perlu menunjuk data uji:
- `LIVE_TEST_PRODUCT_ID`: produk non-produksi yang belum dibatasi;
- `LIVE_TEST_CHANNEL_IDS=<id1>,<id2>`: dua tipe channel.

Tidak ada produk yang benar-benar netral: **selama record uji ada, produk itu tersembunyi dari customer tipe channel lain** di devb2b. Tanpa variabel itu, harness tidak punya jalur write sama sekali.

**Generic harness:**
- Self-test mock-nya sendiri sempat **gagal**: guard menolak `GET /customer-channels` yang dibaca use case create sebelum POST. Tidak ada POST yang terkirim.
- Perbaikannya generik dan tetap ketat: modul mendeklarasikan `readPaths` lookup (hanya GET), dan langkah baru **R6** memverifikasi lookup tersebut. Ini juga akan dipakai F20, F24, dan F25.
- Setelah perbaikan, self-test terhadap mock lokal (bukan backend asli) lolos untuk F11 READ, F11 WRITE (1/1/1 dengan read-back), dan regresi F30.

**Findings:**
- **Bulk delete tidak bisa dipakai di backend:** `DELETE /:id` didaftarkan sebelum `/bulk`, sehingga `/bulk` dianggap sebagai id "bulk" dan menghasilkan 404 (INFERRED). Legacy juga tidak punya tombol untuk bulk delete.
- **Backend menerima daftar channel kosong** dan tidak memvalidasi keberadaan ID channel.
- **Endpoint lookup** `/cms/products` dan `/cms/customer-channels` menyusun ORDER BY dari `sort_by` tanpa allowlist; frontend hanya mengirim nilai tetap.
- **Transaksi delete** keluar tanpa rollback saat error.

**Risks:**
- Live WRITE mengubah visibilitas produk yang nyata.
- Perilaku untuk customer tanpa tipe channel belum diketahui.
- Detail untuk produk yang sudah dihapus mungkin menghasilkan 404 atau 500.
- Daftar channel bisa mencapai 1000 opsi.
- Validation error berbentuk `data[]` belum dipetakan ke field form.
- Grant produksi masih menunggu keputusan (OD-05/06).

**Open Questions:**
1. Produk dan channel non-produksi mana yang boleh dipakai untuk live WRITE?
2. Apakah bulk delete memang dibutuhkan? Ini butuh keputusan produk dan perbaikan backend.
3. Bagaimana seharusnya perilaku untuk customer tanpa tipe channel?

**Report:** `frontend/docs/architecture/reviews/F11_MIGRATION_REPORT.md`

**Next Step:**
1. Jalankan live READ F11 di terminal Anda, lalu bilang "done".
2. Tunjuk produk dan channel uji, lalu beri konfirmasi WRITE.

Belum lanjut ke F20, F24, F25, atau FAQ. A6 tetap HOLD dan D-A6R2-01 tetap OPEN; package Content, `.env*`, dan dev server Anda tidak berubah, dan belum ada yang di-commit.

**Satu catatan F30:** evidence READ-nya masih menunjukkan sort `key` menghasilkan 500 (reserved word MySQL `key` di ORDER BY). Jadi status F30 yang lebih tepat adalah **DONE-WITH-RISKS**, bukan DONE, sampai keputusan perbaikannya diambil.
