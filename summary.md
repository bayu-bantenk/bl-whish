```text
A5.6 FORM + UPLOAD FOUNDATION
=============================
Status: GO-WITH-RISKS
Real Backend Upload Contract: BLOCKED
```

Seluruh fondasi form dan upload berfungsi dan terbukti lewat test serta browser run. Yang belum terverifikasi adalah kontrak backend yang sebenarnya, karena alasannya sama dengan A5.5R: host gateway belum dipastikan dan belum ada akun test. Belum ada yang di-commit.

**Implemented**
- **Form:** React Hook Form + Zod + shadcn `Form`. Satu schema dipakai di browser (untuk UX) dan divalidasi ulang di server (sebagai otoritas). `applyActionError` memetakan error server ke field yang dikenal (lalu fokus ke field itu); error lain menjadi satu alert tingkat form yang tetap menjaga jenis error-nya.
- **Upload:** package `src/packages/files`. Intent diminta lewat Server Action yang hanya menerima metadata. Use case-nya berurutan: cek purpose → `require(capability)` → cek kebijakan file di server → repository → gateway client.
  - Kontrak diambil dari legacy: `POST /api/v1/files/signurl` dengan `{file_name, category, content_type}` → `{url, file_url}`.
  - Browser PUT file langsung ke storage (`XMLHttpRequest`, dengan progress). File tidak pernah lewat Next.js.
- **State machine upload:** `idle → requesting → uploading → success | error`, dengan retry (selalu meminta signed URL baru) dan remove (lokal saja).
- **Submit gating:** submit diblokir selama upload berjalan atau gagal. Aturannya ditegakkan di handler submit, tidak hanya di tombol, dan alasannya ditampilkan.
- **Komponen:** `UploadField` (molecule), `FormErrorAlert` dan `FormSubmit` (organism).
- **Reference fixture:** Content Form di `test/fixtures/content-form/`. Repository create-nya fake (FIXTURE_ONLY), karena tidak ada kontrak backend untuk title/slug/description/attachment.

**Keputusan yang menyimpang dari baseline A4**
- **Intent via Server Action, bukan Route Handler:** A4 §9 merencanakan Route Handler `/api/bff/uploads/sign`. Saya pakai Server Action sesuai brief §25. Pemeriksaannya sama; yang berbeda hanya transport.
- **Zod tetap transitive (4.3.6):** brief ini saya anggap sebagai persetujuan OD-14, tapi instalasi offline gagal (`notarget`) dan saya tidak mengedit lockfile manual. Perbaikannya satu perintah, `npm install zod@^4.3.6`, begitu registry bisa diakses.
- **Capability baru `content.create`:** dasarnya A4 route matrix #170. Interim policy tidak memberikannya, jadi di production tetap 403 sampai ada grant.
- **Atom `ui/progress` diubah:** sekarang meneruskan `value` ke root Radix supaya `aria-valuenow` muncul. Versi upstream shadcn tidak melakukannya.

**Checklist**

| Area | Status |
|---|---|
| Architecture | PASS |
| Validation | PASS |
| Server Actions | PASS |
| Authorization | PASS |
| Upload | PASS |
| Security | PASS |
| Accessibility | PASS |

- **Architecture:** empat rule baru, semuanya dicek dengan menanam pelanggaran dan semuanya tertangkap. File tidak boleh sampai ke Server Action, Route Handler, DAL atau repository; `XMLHttpRequest` hanya ada di uploader storage dan hanya boleh diimpor kode client; modul upload tidak boleh logging.
- **Validation:** field error, error bisnis, dan payload yang melewati browser tetap ditolak di server.
- **Server Actions:** valid, validation, business, 403, 401, network, contract, timeout, dan unexpected (jadi `Unknown` + reference) semuanya bertipe.
- **Authorization:** permintaan tanpa capability, purpose yang tidak terdaftar, atau tanpa sesi menghasilkan 0 panggilan ke gateway dan 0 penulisan ke repository.
- **Upload:**
  - intent berhasil dan gagal (500, 403, envelope, url hilang, url `javascript:`, network);
  - PUT berhasil dan gagal;
  - retry memakai intent baru;
  - storage menolak berarti intent baru;
  - file terlalu besar atau tipe salah tidak memicu intent;
  - upload pending atau gagal memblokir submit, upload sukses mengizinkan submit.
- **Security:**
  - bundle check PASS;
  - signed URL tidak pernah di-log, dirender, atau disimpan;
  - browser run: browser hanya menghubungi host app dan host storage;
  - storage menerima PUT dari Chrome dengan byte sama dengan ukuran file;
  - body signurl hanya 72 byte.
- **Accessibility:** label terhubung, `aria-invalid` dan `aria-describedby` ada, error diumumkan, progressbar punya `aria-valuenow`, upload hanya satu tab stop dengan focus ring yang terlihat, status tidak hanya lewat warna, tidak ada overflow di 375 dan 320 px.

**Quality gates**

| Gate | Hasil |
|---|---|
| Tests | 474 passed, 0 failed, 0 skipped (32 file; sebelumnya 388) |
| Typecheck | 0 error |
| Lint | 0 error, 28 warning (set yang sama seperti sebelumnya; tidak ada warning baru dari A5.6) |
| `npm run quality` | exit 0 |
| Build | PASS (route spike sementara sudah dihapus) |
| Bundle check | PASS |

Penambahan 86 test: upload 21, forms 20, actions 24, content-form 18, architecture +2, security +1.

**Bug yang ditemukan lewat test dan browser run, lalu diperbaiki**
- Nama file `../../etc/passwd` diproses lintas pemisah path. Sekarang hanya segmen terakhir yang dipakai.
- Progressbar tidak punya `aria-valuenow`.
- File input tersembunyi menjadi tab stop tanpa focus yang terlihat.

**Regression**

| Area | Status | Cakupan |
|---|---|---|
| A5.1 | PASS | login, refresh, 5 concurrent → 1 refresh, forged cookie, logout |
| A5.2 | PASS | shell, mobile sheet via keyboard, halaman 404 |
| A5.3 | PASS | DAL, error contract, TTFB median 12 ms |
| A5.4 | PASS | menu hanya "Beranda", route planned → 404 |
| A5.5 | PASS | suite DataTable, contract dan page tetap hijau |

**Risks**
- **RK-A56-01 (High):** kontrak upload dan create belum terverifikasi di backend asli.
- **RK-A56-02 (Medium):** zod dipakai tapi belum dideklarasikan di `package.json`.
- **RK-A56-03 (Medium):** objek di storage bisa yatim, karena belum ada kontrak delete.
- **RK-A56-04 (Medium):** umur signed URL tidak diketahui, jadi setiap retry meminta intent baru.
- **RK-A56-05 (Low):** pesan error berbahasa Indonesia ada di dalam schema domain.
- **RK-A56-06 (Low):** belum ada CSP. Nanti `connect-src` harus mengizinkan host storage.
- **RK-A56-07 (Low):** atom `ui/progress` berbeda dari upstream shadcn.
- **RK-A56-08 (Low):** loader action di fixture tidak boleh ditiru fitur asli.
- **RK-A56-09 (Low):** cek rasio gambar dan alur CSV belum masuk.

**Open Questions**
1. Apakah signurl tersedia di gateway CMS baru?
2. Berapa lama signed URL berlaku?
3. Header apa yang wajib saat PUT, dan apakah storage membatasi ukuran atau tipe file?
4. Kategori selain `images`, dan batasnya masing-masing?
5. Apakah `file_url` bisa diakses publik?
6. Apakah ada endpoint delete atau cleanup untuk objek yang tidak jadi dipakai?
7. Seperti apa format field error dari backend?
8. Kontrak create Content yang sebenarnya? Di legacy: `POST /api/v1/cms/contents` `{code, name, is_active, value}`, sukses 201.

**Documentation:** `docs/architecture/reviews/A5.6_FORM_UPLOAD_FOUNDATION.md`

**Files changed**
- **Baru:**
  - `src/shared/upload/*`, `src/shared/forms/*`, `src/shared/hooks/use-upload.ts`;
  - `src/components/molecules/upload/upload-field.tsx`, `src/components/organisms/forms/{form-error-alert,form-submit}.tsx`;
  - `src/packages/files/**`;
  - `test/fixtures/content-form/**`;
  - 4 suite test baru.
- **Diubah:**
  - `capabilities.ts` (tambah `content.create`), `server-container.ts` (tambah `files`), `ui/progress.tsx`;
  - `architecture.test.ts`, `security-boundary.test.ts`, `dal.test.ts`.

**Files intentionally NOT changed:** `package.json`/lockfile, molecule dropzone B0, DataTable B0, auth/session/gateway/proxy/DAL, route production, navigation registry, dokumen A4.
