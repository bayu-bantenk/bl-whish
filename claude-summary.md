F30 Konfigurasi Umum sudah selesai diimplementasi dan dites, tetapi **live smoke belum jalan**. Kredensial `A55R_*` tetap tidak terlihat di proses saya, jadi statusnya **HOLD**: menunggu live smoke, bukan karena ada cacat.

```text
F30 Migration Status: HOLD (implementasi + test selesai; live smoke menunggu terminal Anda)
```

**Contract:**
- Dicek langsung dari source backend (product-service) dan legacy. Tidak ada blocker fundamental.
- **`created_at` ada di kontrak CMS.** DTO CMS memuatnya, jadi canonical `createdAt` dipertahankan (nullable). Klaim audit seleksi A7 bahwa respons hanya `{id, key, value}` keliru: itu DTO endpoint client.
- **Update aman dari pola bug D-A6R2-01** (dibuktikan lewat code path). Primary key ikut terkirim, dan `key`/`value` divalidasi tidak kosong, jadi `Updates(struct)` selalu menulis keduanya.
- **Batas modul:**
  - `updatebyproductgposb2b` adalah perilaku F09 di atas endpoint PUT bersama;
  - `/detail` (body pada GET) milik F09/F26;
  - keduanya tidak dibawa ke F30.

**Implementation:**
- Package `src/packages/global-configuration/` dengan pola A6, plus 3 route `/dashboard/global-configuration[/create|/update/[id]]`.
- Fitur: list, search key/value, sort, pagination, detail, create, edit, delete, dan bulk delete.
- **`sort_by` hanya dari allowlist**, karena backend menyisipkannya langsung ke `ORDER BY`.
- **Cacat legacy tidak ikut dimigrasikan:** value yang terisi key, create yang selalu "sukses", dan kegagalan update yang tidak tampil.
- Otorisasi fail-closed lewat 4 capability baru `global-configuration.*`, tanpa grant default.
- Tidak ada perubahan foundation; yang dipakai hanya titik ekstensi (capability, registry, ikon `settings`, container).

**Tests:**

| Gate | Hasil |
|---|---|
| Unit / integration | **556/556** (+33 F30) |
| E2E (mock) | **74/74** (+9 F30; Content tetap hijau) |
| Lint | 0 error |
| Build | lolos |
| Bundle check | lolos; path gateway, capability, `sort_by`, `total_rows` ada di 0 file client |

**Live READ — belum dijalankan.** Jalankan di terminal yang punya `A55R_*`:

```bash
cd frontend
LIVE_MODULE=global-configuration npx vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts
```

**Live WRITE — belum dijalankan, menunggu konfirmasi eksplisit Anda** (tambahkan `MODULE_LIVE_WRITE_CONFIRM=yes` ke perintah di atas):
- **Alur:** satu key baru `MIGRATION_LIVE_<UTC>`, lalu create → read-back → update → read-back → delete → read-back.
- **Batasan:** satu percobaan per langkah tanpa retry, berhenti di langkah pertama yang tidak terverifikasi, dan tidak pernah menyentuh key yang sudah ada.
- **Sisa data:** delete di backend bersifat soft delete, jadi baris uji tetap tersisa di tabel dan key-nya tidak bisa dipakai ulang.

**Generic harness:**
- File: `test/live/module-smoke.live.test.ts`, dengan adapter per modul di `test/live/modules/`. Probe read-only khusus F30 dari A7 sudah dihapus dan digantikan harness ini.
- **Self-test terhadap mock lokal (bukan backend asli):** R1–R5 dan W0–W3 lolos, dengan tepat 1 POST, 1 PUT, dan 1 DELETE, masing-masing diikuti read-back.
- **Marker one-shot terbukti:** run kedua menghasilkan 0 mutation.
- Untuk modul batch A berikutnya cukup tambah satu file adapter.

**Findings:**
- **Aksesibilitas:** varian tombol `destructive` di shadcn gagal aturan axe color-contrast. F30 memakai gaya solid. Template `organisms/modal/alert-delete.tsx` dan `alert-reject.tsx` masih memakai varian itu, tetapi tidak ada di route aktif.
- **Key duplikat menghasilkan 500**, bukan 400/409 (INFERRED dari unique index).

**Risks:**
- Nilai konfigurasi dibaca logic bisnis backend (`MAINTENANCE`, `BANNER_INTERVAL`, …), jadi grant produksi perlu keputusan Anda (OD-05/06).
- Di backend, `sort_by` disisipkan langsung ke `ORDER BY` tanpa allowlist. Frontend sudah membatasi nilainya, tetapi perbaikan di backend tetap disarankan.
- Backend tidak membatasi `take` (frontend membatasi 50).
- Transaksi delete keluar tanpa rollback saat error.
- Bulk delete dengan ID yang tidak dikenal tetap melaporkan sukses.
- Validation error berbentuk `data[]` belum dipetakan ke field form.
- Status untuk ID tidak dikenal (404 menurut source) dan versi backend yang ter-deploy belum diverifikasi live.

**Report:** `frontend/docs/architecture/reviews/F30_MIGRATION_REPORT.md`

**Next module:** belum dimulai, sesuai instruksi. Kandidat batch A: F11, F20, F24, F25, FAQ.

A6 Content tetap HOLD dan D-A6R2-01 tetap OPEN/CRITICAL; package Content tidak berubah. `.env*` tidak berubah, tidak ada yang di-commit, dan dev server Anda di :4000 tidak saya sentuh.

Langkah berikutnya:
1. Jalankan perintah READ di atas di terminal Anda, lalu bilang "done". Saya baca evidence-nya dan perbarui status F30.
2. Kalau READ sesuai, beri konfirmasi untuk WRITE.
