Fixture belum ditemukan, dan statusnya **BLOCKED**. Kredensial live tidak ada di proses saya, jadi discovery ke backend asli belum bisa saya jalankan. Script discovery read-only sudah siap dan tinggal dijalankan sekali dari terminal Anda.

1. **Environment:** gateway non-produksi `devb2b-api.gpos.id` (https, kontrak `legacy-v1`), dengan akun live-test yang sama seperti live READ F11. Tidak ada secret yang dicetak.
2. **Produk terpilih:** belum ada.
3. **Status pembatasan produk:** produk `066e6346-19b7-4fa7-ad06-07e514ef9719` sudah diketahui punya pembatasan (dari run Anda 2026-10-02), jadi ditolak.
4. **Channel 1:** belum dipilih. Daftar channel di backend asli bisa dibaca (55 channel pada live READ R6).
5. **Channel 2:** belum dipilih.
6. **Cara verifikasi** (`test/live/f11-fixture-discovery.live.test.ts`, lewat use case F11 produksi dengan guard yang hanya mengizinkan GET):
   1. Ambil daftar channel, sama dengan daftar yang dipakai validasi form dan use case F11, lalu pilih dua ID berbeda. DTO channel tidak punya field status, dan F11 juga tidak mensyaratkannya.
   2. Cari produk (default kata kunci `"a"`, maksimal 20). Produk yang muncul berarti ada dan bisa dibaca.
   3. Untuk setiap kandidat, baca list pembatasan dengan `keyword = product_id` di semua halaman, lalu filter yang `productId`-nya persis sama. Kandidat pertama dengan 0 hasil dipilih dan dicek ulang. Ini setara terkuat untuk `ProductRestriction(product_id) == NOT_FOUND`, karena kontrak tidak punya endpoint pembatasan per produk.
   4. Logout. Evidence ditulis ke `$TMPDIR/module-live/product-restriction/fixture-discovery-<UTC>.json`, berisi ID, kode, nama, dan daftar request. Tidak ada token, cookie, maupun password.

   Script ini sudah diuji terhadap mock lokal: 6 produk yang sudah dibatasi ditolak, produk ketujuh dipilih setelah dicek ulang, dan 0 mutation.

7. **Tidak ada mutation:** fase ini tidak mengirim request apa pun ke backend asli. Yang berubah hanya file script baru tersebut dan laporan. Source aplikasi, harness, test lain, backend, dan `.env*` tidak tersentuh, dan belum ada yang di-commit.
8. **Laporan:** `frontend/docs/architecture/reviews/F11_LIVE_WRITE_FIXTURE_DISCOVERY.md`
9. **Status akhir:**

```text
BLOCKED: discovery needs the live credentials (owner terminal); no fixture verified yet
```

**Langkah berikutnya: jalankan sekali di terminal Anda (read-only):**

```bash
cd frontend
npx vitest run --config vitest.live.config.js test/live/f11-fixture-discovery.live.test.ts
```

Di akhir output, script mencetak fixture kandidat (produk dan dua channel) beserta lokasi file evidence-nya. Kalau 20 produk pertama ternyata sudah dibatasi semua, tambahkan `LIVE_DISCOVERY_TERM=<kata lain>`. Setelah itu bilang "done", dan saya verifikasi evidence-nya lalu melengkapi laporan menjadi **READY-FOR-LIVE-WRITE** atau **NO_SAFE_FIXTURE_FOUND**.

Satu hal tetap harus Anda pastikan sendiri. Kontrak F11 tidak bisa membuktikan apakah produk terpilih **aktif/dijual**, padahal selama test produk itu sempat tersembunyi dari tipe channel lain. Jadi konfirmasikan produk hasil discovery memang boleh dipakai sebelum fase WRITE.
