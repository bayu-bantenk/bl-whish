Source backend tersedia di `~/Developments/BE/gpos-b2b-content-service` (branch `development`, commit `7897199`, 2025-10-16, working tree bersih). Penyebab D-A6R2-01 bisa ditelusuri dari kode: **kategori D, bug di repository/ORM update**. GORM `Updates(struct)` hanya menyimpan field yang nilainya bukan zero-value, sedangkan `false` adalah zero-value Go untuk `bool`, sehingga `is_active=false` dilewati tanpa error.

Semua ini read-only: tidak ada request HTTP, tidak ada mutation, dan tidak ada file yang diubah (source, test, config, dokumentasi, maupun status gate).

## Jalur `PUT /api/v1/cms/contents/{id}`

| Tahap | File : baris | Temuan | Status |
|---|---|---|---|
| Route | `handler/content.go:31-35` | grup `/cms/` → `cmsGroup.Put("/contents/:id", h.CmsUpdateContent)` | VERIFIED (kode) |
| Handler | `handler/content.go:175-199` | `ValidateParam` (id) → `ValidateBody` ke `dto.CmsUpdateContentRequest` → mapper → use case → respons `200 {message:"Success"}`. Tidak ada logic khusus `is_active` | VERIFIED |
| Decode + validasi | `helper/validator.go:35-45` | `c.BodyParser` (JSON) lalu `ValidateStruct`. Tidak ada aturan validasi untuk `is_active` | VERIFIED |
| Request DTO | `dto/content.go:42-47` (baris 46) | `IsActive bool \`json:"is_active"\``: **bool biasa**, bukan `*bool`, tanpa `omitempty`. JSON `false` dan field yang tidak dikirim sama-sama jadi `false`, tidak bisa dibedakan | VERIFIED |
| Mapper | `mapper/content.go:63-74` (baris 72) | `IsActive: spec.IsActive` disalin apa adanya ke `model.Content` | VERIFIED |
| Use case | `usecase/content.go:68-82` | cek record ada → cek kode unik → `UpdateContent(model)`. Tidak ada aturan bisnis untuk `is_active` | VERIFIED |
| **Repository** | **`repository/content.go:66-74` (baris 67)** | **`repo.db.Updates(content)`**, struct penuh, tanpa `Select(...)`, `map`, atau `Save` | VERIFIED |
| Model DB | `model/content.go:3-9` (baris 8) | `IsActive bool \`gorm:"default:true;not null"\``: bool biasa dengan default `true` | VERIFIED |
| ORM | `go.mod:26` | `gorm.io/gorm v1.31.0` | VERIFIED |
| Hook | — | tidak ada `BeforeUpdate` / `AfterUpdate` untuk `Content` | VERIFIED |
| Endpoint alternatif | seluruh repo (`grep IsActive`) | tidak ada endpoint atau workflow lain untuk mengubah status Content; hanya ada CRUD di atas | VERIFIED (dalam repo ini) |

## Mekanisme

- Pada GORM, memanggil `db.Updates(struct)` hanya meng-update field yang bukan zero-value.
  - `name` dan `value` berisi string tidak kosong, jadi ikut di-update.
  - `is_active=false` adalah zero-value, jadi tidak masuk ke statement `UPDATE`. Kolom tetap `true` dan backend tetap mengembalikan 200.
- Ini persis sama dengan bukti live A6R-2: PUT 200, `name`/`value` tersimpan, `is_active` tetap `true`.
- **Status: INFERRED, keyakinan tinggi.** Kodenya VERIFIED dan perilaku ini adalah perilaku GORM yang terdokumentasi. Yang belum bisa dibuktikan dari sini: bahwa backend yang ter-deploy di `devb2b-api.gpos.id` menjalankan commit `7897199` (UNKNOWN), dan SQL yang benar-benar dieksekusi tidak terekam.

## Klasifikasi

| Opsi | Kesimpulan | Status |
|---|---|---|
| A. PUT sengaja mengabaikan `is_active` | Tidak didukung bukti. DTO, mapper, dan Swagger (`docs/docs.go`, `dto.CmsUpdateContentRequest`) semuanya menerima dan meneruskan `is_active`. Tidak ada komentar atau aturan yang mengecualikannya | INFERRED: tidak disengaja |
| B. Harus lewat endpoint atau workflow lain | Tidak ada endpoint lain di service ini | VERIFIED (repo ini). Routing gateway ke service lain: UNKNOWN |
| C. Bug DTO atau mapper | Bukan penyebabnya. Nilai `false` dibawa utuh sampai ke model. Desain `bool` non-pointer memang ikut berperan (tidak bisa membedakan `false` dari field kosong), tapi nilainya tidak hilang di tahap ini | VERIFIED |
| **D. Bug repository/ORM update** | **Ya.** `repository/content.go:67` `Updates(struct)` membuang `false` | **INFERRED (keyakinan tinggi)**; kode VERIFIED, versi yang ter-deploy UNKNOWN |
| E. Aturan bisnis | Tidak ada di use case, handler, maupun hook | VERIFIED |
| F. Tidak bisa ditentukan | Tidak berlaku: penyebab teridentifikasi | — |

## Implikasi terkait (inferensi, belum diuji live)

- **CREATE dengan `is_active=false` kemungkinan besar tersimpan sebagai `true`.**
  - Model punya tag `default:true` (`model/content.go:8`), dan GORM `Create` melewati zero-value pada field yang punya default, sehingga database memakai default `true`.
  - Status: INFERRED. A6R-1 hanya menguji `true`.
- **Mengosongkan `value` lewat UPDATE kemungkinan juga diabaikan.**
  - Frontend mengirim `null`; `BodyParser` mengubahnya jadi `""`, lalu `Updates` melewati `""`.
  - Status: INFERRED. Ini terkait R7, semantik `null`.
- **Legacy kemungkinan terdampak dengan cara yang sama**, karena mengirim body PUT yang identik. Status: INFERRED.

Jadi kontrak frontend (`PUT` dengan `is_active` boolean) sesuai OpenAPI. Perbaikannya ada di backend. Pola yang biasa dipakai, misalnya `Select("*")` / `Select(kolom...)`, update dengan `map`, atau `IsActive *bool`, adalah keputusan pemilik backend.

## Temuan sampingan (dari kode yang sama, di luar `is_active`)

- **R1, bentuk validation error untuk Content: VERIFIED dari kode.**
  - Content memakai `helper.ValidateBody` yang sama, jadi errornya 400 `ERR_VALIDATION_ERROR` dengan `data[{FailedField, Tag, Value}]`.
  - `FailedField` berasal dari `err.StructNamespace()`, misalnya `CmsUpdateContentRequest.Code`.
  - Ini **koreksi** atas catatan saya sebelumnya: `Value` adalah `err.Param()` (parameter aturan validasi), **bukan** nilai input yang dikirim user (`helper/validator.go:21-23`).
- **Kode duplikat: VERIFIED dari kode.** Saat CREATE/UPDATE, backend mengembalikan 400 dengan pesan "Content Code %s already used" (`usecase/content.go:57-60`, `74-77`).
  - Artinya ini Business 400, bukan 409.
  - Saat itu use case belum menulis apa pun, jadi request yang sama sampai dua kali tidak membuat duplikat diam-diam.

D-A6R2-01 tetap **OPEN / CRITICAL**, dan A6 tetap **BLOCKED**. Tidak ada status atau dokumen yang saya ubah.

Langkah berikutnya butuh keputusanmu dan/atau pemilik backend:
1. Konfirmasi bahwa `devb2b-api.gpos.id` menjalankan commit `7897199` (atau commit dengan kode yang sama).
2. Perbaikan di backend.
3. Verifikasi ulang yang terkontrol untuk update `is_active=false`. Itu fase terpisah yang memerlukan persetujuan baru.
