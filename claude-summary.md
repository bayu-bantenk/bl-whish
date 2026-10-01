Status A5.5R sudah **GO-WITH-RISKS** di semua dokumen. Hampir semua isi brief ini sudah masuk lewat reconciliation sebelumnya, jadi kali ini saya hanya menambal tiga hal: baris unknown ID dipecah menjadi "HTTP behavior" dan "alasan semantik = UNKNOWN" plus catatan bahwa harness belum punya assertion; session lifetime dan expiry token sekarang ditulis sebagai dua hal terpisah; dan catatan unknown ID ditambahkan ke status A6-R. Hanya file dokumentasi yang berubah.

## 1. A5.5R final status

```text
GO-WITH-RISKS
```

## 2. Documentation files inspected

Di `frontend/docs/architecture/`:
- `contracts/legacy-api/content-list.md`, `content-write.md`
- semua review A5.0 sampai A5.7, termasuk `A5.5R_REAL_BACKEND_CONTRACT_VERIFICATION.md`
- `A6_FIRST_PRODUCTION_VERTICAL_SLICE.md`, `A6R_REAL_BACKEND_AUTH_RE_GATE.md`, `summary.md`

Di luar repo frontend: `~/Developments/bl-whish/claude-summary.md`.

## 3. Documentation files changed

**Diubah di task ini (dibandingkan snapshot di awal task):**
- `reviews/A5.5R_REAL_BACKEND_CONTRACT_VERIFICATION.md` (+5 / −3): baris unknown ID dipecah dua; session lifetime dan expiry token dipisah; follow-up assertion harness dicatat.
- `reviews/A6R_REAL_BACKEND_AUTH_RE_GATE.md` (+1): catatan unknown ID di bagian "Current status".
- `~/Developments/bl-whish/claude-summary.md`: baris unknown ID dipecah dua dan kalimat soal lifetime diperjelas. Total diff terhadap commit terakhir +46, karena sudah termasuk blok status yang ditambahkan di task sebelumnya.

**Sudah ter-rekonsiliasi di task sebelumnya, tidak diubah lagi:**
- `summary.md`, `A6_FIRST_PRODUCTION_VERTICAL_SLICE.md`
- `content-list.md`, `content-write.md`
- `A5.6_FORM_UPLOAD_FOUNDATION.md`, `A5.7_E2E_CI_ACCESSIBILITY_HARDENING.md`

Riwayat audit tetap utuh. Status BLOCKED lama ditandai historical / superseded, lalu diikuti status terkini.

## 4. Evidence matrix

| Area | Status | Evidence |
|---|---|---|
| Login | VERIFIED | `POST /api/v1/auth/login` → 200; backend mengembalikan `access_token`, `refresh_token`, `expires_at` |
| Backend `expires_at` | VERIFIED | format RFC 3339 dengan nanodetik, `+07:00`, sekitar 30 hari ke depan; diterima apa adanya. Backend adalah source of truth, tanpa batas maksimum dari frontend |
| Content list | VERIFIED | `GET /api/v1/cms/contents` → 200 |
| Content detail | VERIFIED | ID yang ada → 200; field `id, name, code, value, is_active` |
| Pagination | VERIFIED | halaman 1 dan 2 tidak tumpang tindih; page 0 sama dengan page 1; halaman di luar jangkauan → kosong |
| `code` sorting | VERIFIED | asc dan desc; desc persis kebalikan asc |
| Search | VERIFIED | ada hasil → hanya baris yang cocok; tanpa hasil → kosong, bukan error |
| Local authorization denial | VERIFIED | `Forbidden`, 0 request ke gateway |
| 401 → refresh → retry | VERIFIED | 401 → `POST /api/v1/auth/refresh` 200 → retry tepat satu kali → 200; tidak ada loop |
| Refresh rotation | VERIFIED | access token dan refresh token berganti; expiry baru di masa depan |
| Failed refresh cleanup | VERIFIED | 401 → refresh 400 → session lokal dihapus → request berhenti. Tidak ada request logout dari flow ini |
| Logout/revocation | VERIFIED | logout → 200; request Content berikutnya dengan token yang sama → 401 |
| Unknown ID HTTP behavior | VERIFIED as observed 403/Forbidden | Observed backend behavior for the tested unknown ID: 403 Forbidden. Mapping aplikasi 403 → `Forbidden`, 404 → `NotFound`, jadi hasilnya `Forbidden` |
| Unknown ID semantic reason | UNKNOWN | alasan backend mengembalikan 403 belum diketahui. Step harness belum punya assertion, jadi ini hanya observasi HTTP |
| S6 GET body | NOT VERIFIED | probe tidak diaktifkan; implementasi tetap memakai query parameter saja |
| S7 API key requirement | NOT VERIFIED | semua request membawa API key; tidak ada pembanding tanpa API key |
| Content CREATE | NOT VERIFIED | Not tested |
| Content UPDATE | NOT VERIFIED | Not tested |

## 5. Remaining A6 blockers/risks

1. Kontrak Content CREATE di backend asli belum diuji.
2. Kontrak Content UPDATE di backend asli belum diuji.
3. Bentuk validation error belum terverifikasi untuk Content. Endpoint auth asli mengembalikan `ERR_VALIDATION_ERROR` dengan `data[{FailedField, Tag, Value}]`, sedangkan aplikasi mengasumsikan `{errors:{field:[…]}}`.
4. Response asli tidak punya `created_at`, padahal A6 punya kolom "Dibuat" dan default sort `created_at desc`.
5. Alasan di balik 403 untuk unknown ID masih UNKNOWN; A6 mengharapkan `NotFound`.
6. Kompatibilitas GET body (S6) belum diuji.
7. Apakah API key wajib (S7) belum diuji.
8. Risiko lain yang didukung evidence:
   - semua respons 401 berbody kosong;
   - refresh yang ditolak mengembalikan 400, bukan 401;
   - backend tidak mengembalikan `X-Request-Id`;
   - session lifetime aplikasi (7 hari) adalah konsep terpisah dari expiry token backend (sekitar 30 hari);
   - belum ada akun kedua yang dibatasi aksesnya.

**Follow-up yang tidak saya kerjakan sekarang:**
- assertion harness untuk unknown ID, setelah kontrak 403 vs 404 diputuskan;
- penyesuaian mapper validation error;
- keputusan soal kolom dan default sort `created_at`.

## 6. Safety confirmation

- **Kode aplikasi, kode test, dan live test harness tidak berubah.** Checksum semua file di luar `docs/` identik sebelum dan sesudah.
- **Runtime configuration tidak berubah.** Checksum `.env`, `.env.local`, dan `.env.test.local` identik.
- **Tidak ada request ke backend sama sekali di task ini**, jadi juga tidak ada write.
- **Tidak ada secret yang terekspos.** Isi dokumen hanya placeholder dan deskripsi.

```text
$ git status --short     (frontend/)
261 entries, identik dengan baseline. Seluruh docs/ tercatat sebagai satu entri untracked: ?? docs/

$ git diff --stat
 82 files changed, 900 insertions(+), 1902 deletions(-)    (identik dengan baseline)

$ git diff -- docs
(kosong, karena docs/ untracked. Perubahan task ini ada di diff snapshot di atas: 2 file, +5 / −3)

bl-whish$ git status --short
 M claude-summary.md
```

Baseline 261 entri dan 82 file itu adalah pekerjaan A5.0 sampai A6 yang memang belum di-commit; task ini tidak menyentuhnya. Semua file yang berubah adalah dokumentasi, dan belum ada yang di-commit.
