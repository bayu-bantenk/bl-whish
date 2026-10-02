Status A7 Konfigurasi Umum sementara **HOLD**, menunggu live READ. Audit kontrak statisnya sudah selesai, tetapi live READ **belum jalan**. Kredensial `A55R_*` hanya ada di terminal Anda, jadi probe read-only perlu Anda jalankan dari sana.

### 1. Status akhir A7

```text
A6 = HOLD / BLOCKED                    (tidak berubah)
D-A6R2-01 = OPEN / CRITICAL            (tidak berubah)

A7 Konfigurasi Umum readiness = HOLD   (hanya menunggu live READ)
Static contract audit         = COMPLETE
Live READ                     = PENDING (probe siap)
Live WRITE                    = NOT RUN → WRITE_REQUIRES_SAFE_TEST_KEY
```

### 2. Live READ

Belum ada evidence live; saya tidak mengarang hasilnya. Probe-nya `test/live/global-configuration-read.live.test.ts`:
- **Hanya GET** ke `/api/v1/cms/global-configurations` dan `/{id}`, plus login/logout. Method dan path lain ditolak sebelum keluar dari proses.
- **Tidak menyimpan** key/value konfigurasi, token, atau password. Yang dicatat hanya tipe, jumlah, true/false, dan format timestamp yang di-mask.
- **Tanpa kredensial berhenti di gate**: "A7R BLOCKED by safety gate: A55R_CONFIRM_NON_PRODUCTION=yes not set".

Yang akan diamati:
- default list, untuk melihat envelope, bentuk pagination, dan apakah `created_at` ada;
- page 1 vs page 2, halaman di luar jangkauan, dan `take=100`;
- sort `key` dan `created_at`;
- search dan no-match;
- detail untuk ID yang ada dan ID yang tidak dikenal.

Jalankan di terminal Anda:

```bash
cd frontend
npx vitest run --config vitest.live.config.js test/live/global-configuration-read.live.test.ts
```

Lalu bilang "done". Saya baca `$TMPDIR/a7r-live/evidence.json` dan lakukan re-gate.

### 3. Temuan kontrak dan gap (dari source)

**Koreksi atas audit A7 sebelumnya:**
- **`created_at` didukung (DOCUMENTED).** List dan detail CMS memakai `dto.GlobalConfiguration {id, key, value, created_at}`.
- **Klaim "respons `{id, key, value}`" di audit seleksi A7 bertentangan dengan source (CONTRADICTED).** Itu sebenarnya DTO endpoint *client*, bukan CMS.

**F30 aman dari kelas bug D-A6R2-01 (VERIFIED lewat code path):**
- Validator `required` menolak `""`, jadi `key` dan `value` tidak pernah zero-value.
- Karena itu `Updates(struct)` selalu menulis keduanya.
- Mapper ikut mengirim primary key, sehingga update hanya mengenai baris tersebut.

**`/cms/global-configurations/detail` tidak dibutuhkan F30:**
- Endpoint ini membaca **body dari request GET**. Kalau body kosong, ia mengembalikan **semua** baris.
- Hanya F09 dan F26 yang memakainya, jadi frontend F30 tidak perlu wrapper untuknya.

**Batas F30 dan F09:**
- `updatebyproductgposb2b` adalah perilaku **F09** yang memakai endpoint PUT bersama (SHARED CONTRACT).
- F30 hanya mengekspos CRUD generik.

**Cacat legacy yang tidak boleh ikut dimigrasikan:**
- Form edit mengisi field Value dengan **key** (`edit.edge:41`). Menyimpan tanpa mengetik ulang akan menimpa value.
- Create menampilkan "berhasil" meskipun backend gagal (`if (!result)`).
- Kegagalan update tidak terlihat, karena flash memakai key `Warning`.

**Risiko di backend:**
- `sort_by` disisipkan langsung ke `ORDER BY` tanpa allowlist, jadi frontend wajib mengirim nilai dari allowlist saja.
- Key duplikat kemungkinan menghasilkan 500, bukan 400/409 (INFERRED). Key yang sudah di-soft-delete juga tidak bisa dipakai lagi.
- Tidak ada batas maksimum `take`.
- Transaksi delete/bulk delete keluar tanpa rollback saat error.
- Bulk delete dengan ID yang tidak dikenal tetap melaporkan sukses (INFERRED).

**Gap yang tersisa:**
- Envelope, pagination, dan `created_at` belum diamati langsung di backend.
- Status untuk ID yang tidak dikenal belum diketahui: source mengembalikan 404, padahal Content di live memberi 403.
- Validation error berbentuk `data[{FailedField, Tag, Value}]` tanpa `error_code`, dan frontend belum punya pemetaan per-field untuk bentuk ini.
- Versi backend yang ter-deploy belum diketahui (repo lokal ada di branch `cms-filter-banner`).
- Model grant otorisasi masih OD-05/06. Nama capability yang diusulkan (`global-configuration.read` dan seterusnya) belum final, tanpa grant default.

### 4. Keputusan

```text
HOLD  (sementara, hanya menunggu live READ)
```

Implementasi tidak dimulai hanya berdasarkan source, karena A6 sudah membuktikan source dan runtime bisa berbeda. Kalau live READ cocok dengan kontrak di laporan §6, §7, dan §12, statusnya naik ke **GO-WITH-RISKS**. Write tetap menunggu persetujuan terpisah sesuai laporan §21: satu key uji inert `A7R_TEST_<UTC>`, tanpa menyentuh key yang sudah ada.

### 5. Lokasi

- Laporan: `frontend/docs/architecture/reviews/A7_KONFIGURASI_UMUM_CONTRACT_READINESS.md` (24 bagian, 413 baris)
- Probe: `frontend/test/live/global-configuration-read.live.test.ts`

Selain dua file itu tidak ada yang berubah: checksum semua file lain dan file `.env*` identik dengan sebelumnya. Tidak ada request ke backend dan belum ada yang di-commit.
