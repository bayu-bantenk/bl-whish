Semua evidence sudah terkumpul. Hasilnya: dari 32 feature area, **F30 Konfigurasi Umum** adalah satu-satunya yang lolos semua kriteria tanpa catatan. Usulannya adalah fase readiness **A7.1 — Konfigurasi Umum Contract & Readiness**, belum implementasi.

Audit ini read-only: tidak ada request HTTP/live, tidak ada mutation, dan tidak ada perubahan source, test, config, atau dokumentasi. Status tetap `A6 = HOLD`, `D-A6R2-01 = OPEN / CRITICAL`.

## 1. Legacy module inventory

Sumber kolom:

| Kolom | Sumber |
|---|---|
| Feature | `ROUTE_SCREEN_MAP.md` §23 A1.23 (baris 1821-1857) |
| Routes (MIGRATE/REVIEW) | `A4_ROUTE_MIGRATION_MATRIX.md` §2 (baris 37-71) |
| DataTable | A1 §7 (baris 875-957) |
| Upload | A1 §16 (baris 1309-1336) |
| Menu | A2 §14 (baris 755-797) |
| API | A2 §6.1 (baris 196-243) dan source backend di `~/Developments/BE` |

Semua feature hanya dicek sesi di sisi Adonis. Otorisasi API selalu `UNKNOWN — BACKEND CONTRACT` (A2 §13 #5-10), jadi kolom Authorization di bawah hanya menunjukkan visibilitas menu.

| Feature | Routes M/R | List/DataTable | Create/Edit | Upload | Authorization (menu) | Dependency | API evidence | Audit status |
|---|---|---|---|---|---|---|---|---|
| F01 Login / sesi | 3/0 | N/A | N/A | N/A | public | session | VERIFIED (A5.5R live) | ACTIVE, sudah dimigrasi (A5.1) |
| F02 Beranda | 1/0 | N/A | N/A | N/A | S (P/M hidden) | — | N/A (tidak ada API) | ACTIVE (static) |
| F03 Order/Pesanan | 4/2 | VERIFIED (DataTable) | detail read-only; delete rusak | N/A | S | — | PARTIAL (`/cms/orders`) | ACTIVE |
| F04 Order Review | 3/2 | VERIFIED | detail saja | N/A | S | — | PARTIAL (`/cms/order-reviews`) | ACTIVE |
| F05 Pembayaran | 4/0 | VERIFIED | detail + trigger | N/A | P, S | — | PARTIAL | ACTIVE |
| F06 Inventory | 13/0 | VERIFIED | CRUD + modal stok | N/A | S | Product search | PARTIAL; `InventoryStockRepository` base path tercatat sebagai literal `url` | ACTIVE |
| F07 Produk | 7/0 | VERIFIED | edit | **YA** (4 gambar) | S | — | PARTIAL | ACTIVE |
| F08 Kategori Produk | 9/0 | VERIFIED | CRUD | **YA** (image, required) | S | — | PARTIAL + source BE (product-service) | ACTIVE |
| F09 Produk Gpos B2b | 7/3 | VERIFIED (tab) | config | **YA** | S | GlobalConfiguration, CustomCriteria | PARTIAL | ACTIVE (+3 view hilang) |
| F10 Personalisasi Katalog | 9/17 | VERIFIED | CRUD, inline | N/A | S (sub-screen: none) | OPTIONS routes | PARTIAL | ACTIVE (+6 UNKNOWN) |
| F11 Pembatasan produk | 10/0 | VERIFIED | CRUD | N/A | S | channel types (`/cms/customer-channels`) | PARTIAL + source BE (product-service) | ACTIVE |
| F12 Loyalty Member | 13/0 | custom (pagination.js) | cards, program | **YA** (CSV) | S | Gamification upload-csv | PARTIAL (+header X-Userid/X-RoleName) | ACTIVE |
| F13 Pengaturan Poin | 12/12 | custom cards | wizard, edit, toggle | N/A | S | PoinVoucherHelper | PARTIAL | ACTIVE (+5 mockup) |
| F14 Inject Poin | UNKNOWN (tidak dipisah di A4 §2) | VERIFIED | wizard, cancel | N/A | none | Customer lookup | PARTIAL | UNKNOWN (tanpa navigasi) |
| F15 Mutasi & Redeem | 0/3 | VERIFIED | N/A | N/A | none | UserManagement lookup | PARTIAL | UNKNOWN (tanpa navigasi) |
| F16 Voucher Setting | 0/9 | server cards | wizard, toggle | **YA** | none | VoucherRepository | PARTIAL | UNKNOWN (tanpa navigasi) |
| F17 Push Notification | 11/0 | VERIFIED | CRUD, schedule, cancel/final | **YA** | M, S | — | PARTIAL + source BE (notification-service) | ACTIVE |
| F18 Banner & Iklan | 13/0 | VERIFIED | CRUD, inline edit | **YA** | M, S | OPTIONS routes | PARTIAL + source BE | ACTIVE |
| F19 Group Story | 9/0 | VERIFIED | CRUD | **YA** | S | Banner list | PARTIAL | ACTIVE |
| F20 Produk Sponsor | 8/0 | VERIFIED | CRUD | N/A | S | ProductCategory options | PARTIAL + source BE (product-service) | ACTIVE |
| F21 Gamification | 20/1 | custom cards | create/edit/duplicate/status | **YA** (+CSV) | S | Voucher list, OSS | PARTIAL | ACTIVE (+1 UNKNOWN) |
| F22 Voucher Pengiriman | 5/0 | VERIFIED | create, cancel | N/A | S | — | PARTIAL | ACTIVE |
| F23 GPOS Brand | 6/0 | VERIFIED | processing, cancel | N/A | S | — | PARTIAL | ACTIVE |
| F24 Kode Telesales | 8/0 | VERIFIED (GET) | CRUD + bulk delete | N/A | S | Channel types | PARTIAL (`/cms/loyalties/referral-configurations`); source BE tidak ditemukan | ACTIVE |
| F25 Grup Pelanggan | 10/0 | VERIFIED | CRUD (JSON) | N/A | S | cust-id options, product search | PARTIAL; source BE tidak ditemukan | ACTIVE |
| F26 Konfigurasi Channel | 17/0 | VERIFIED | wizard, produk, preview | N/A | S | banyak OPTIONS, GlobalConfiguration | PARTIAL | ACTIVE |
| F27 Verifikasi Akun | 6/0 | VERIFIED | review, approve/reject, export | N/A | S | — | PARTIAL (+header X-UserId) | ACTIVE |
| F28 Prinsipal | 9/0 | VERIFIED | CRUD | **YA** (multipart, disk lokal) | S | — | PARTIAL | ACTIVE |
| F29 Pendaftaran Folamil | 2/0 | N/A | upload CSV | **YA** | S | Loyalty point types | PARTIAL | ACTIVE |
| **F30 Konfigurasi Umum** | **9/0** | **VERIFIED** | **CRUD + bulk delete** | **N/A** | S | **— (justru jadi dependency F09/F26)** | **PARTIAL + source BE (product-service)** | **ACTIVE** |
| F31 Manajemen Pengguna | 4/0 | VERIFIED | toggle `update-is-active`, export | N/A | S | — | PARTIAL (`PUT /cms/customers/users/:id/status`) | ACTIVE |
| F32 Konten | 8/0 | VERIFIED | CRUD | N/A | S | — | VERIFIED (A5.5R / A6R) | **HOLD (D-A6R2-01)** |
| F32 FAQ | 8/0 | VERIFIED | CRUD | N/A | S | faqs-categories | PARTIAL + source BE (content-service) | ACTIVE |
| F32 Masukan | 6/0 | VERIFIED | edit saja (tidak ada create di CMS) | N/A | S | — | PARTIAL + source BE (account-service) | ACTIVE |

**Kandidat yang diminta dicek khusus:**

| Kandidat | Ada di legacy? | Evidence |
|---|---|---|
| User / Account Management | Ya: F31 Manajemen Pengguna, F27 Verifikasi Akun | A1 §23 |
| Role / Permission | **Tidak ada** | A2 §13 #3-4 (`config/access.js` tidak pernah dipakai), §15 (tidak ada data permission) |
| Settings / Configuration | Ya: F30 Konfigurasi Umum, F26 Konfigurasi Channel | A1 §23 |
| Master Data | Ya: F08, F11, F20, F24, F25, F28 | A1 §23 |
| CMS selain Content | Ya: F32 FAQ, F32 Masukan, F18 Banner, F19 Group Story | A1 §23 |
| Notification | Ya: F17 Push Notification | A1 §23 |
| Menu / Navigation management | **Tidak ada**. Menu di-hardcode di `Extender.js` | A2 §13 #12 |

## 2. Dependency blockers

Definisi "Workflow" yang dipakai di sini: approve/reject/cancel/finalise/sync/trigger/wizard/toggle status, sesuai `A4_MIGRATION_CONTRACT.md` P-01 baris 19.

| Kelompok | Feature | Evidence |
|---|---|---|
| Blocker Content | F32 Konten (HOLD) | A6R closeout; D-A6R2-01 |
| Upload (A5.6 real upload contract masih BLOCKED) | F07, F08, F09, F12, F16, F17, F18, F19, F21, F28, F29 | A1 §16; A5.6 doc (Real Backend Upload Contract = BLOCKED) |
| Workflow sebagai bagian inti | F03 (sync), F05 (trigger), F13 (wizard/toggle), F14 (wizard/cancel), F17 (schedule/cancel/final), F21 (status/duplicate), F22 (cancel), F23 (processing/cancel), F26 (wizard), F27 (approve/reject) | A1 §23 kolom Capabilities |
| Bentuk masalah yang mirip `is_active`, plus mutation ke data user asli | F31: toggle `update-is-active` → `PUT /cms/customers/users/:id/status` mengubah status akun user asli; tidak ada create, jadi tidak ada record uji yang inert | A2 §6.2 (baris UserManagement) |

**INSUFFICIENT EVIDENCE:**
- **F14, F15, F16:** tanpa navigasi, keputusan OD-07 belum ada (A4 §2 REVIEW).
- **F10:** 17 REVIEW dan 6 UNKNOWN.
- **F06:** base path stok tercatat sebagai literal `url`, `url/id` (A2 §6.1).
- **F02:** halaman statis; isinya keputusan produk OD-P4.
- **F04:** read-only, 2 route berstatus REVIEW (OD-09).
- **F32 Masukan:** tidak ada create di CMS (A2 §6.2), sehingga verifikasi write live harus mengubah feedback pelanggan asli. Backend juga memakai `repo.db.Updates(feedback)` (`gpos-b2b-account-service/repository/feedback.go:71`), sehingga mengosongkan `solution` ke `""` kemungkinan besar akan diabaikan. Ini kelas masalah yang sama dengan D-A6R2-01 (INFERRED).

## 3. Eligible candidates

Semua yang di bawah lolos kriteria: tidak tergantung Content, tidak perlu upload, tidak ada Workflow, scope ACTIVE tanpa REVIEW, bisa diuji sebagai vertical slice, dan punya evidence API dari A2.

| Feature | Catatan factual |
|---|---|
| **F30 Konfigurasi Umum** | Source BE ada. DTO hanya `key` dan `value`, keduanya string `required`, sehingga zero-value skip tidak bisa terjadi |
| F11 Pembatasan produk | Source BE ada. Update di-load ulang lalu `Updates(rec)` (`product_restricted.go:247`). Butuh options `customer-channels` |
| F20 Produk Sponsor | Source BE ada. Update memakai `Save` (`sponsored_product.go:88/105`). Butuh options `product-categories` |
| F32 FAQ | Source BE ada (content-service). Update memakai `Where("id").Updates(faq)` (`faq.go:85`) dengan `Sequence int`, sehingga sequence `0` kemungkinan akan diabaikan (kelas D-A6R2-01, INFERRED) |
| F24 Kode Telesales | Hanya evidence A2; source BE tidak ditemukan secara lokal |
| F25 Grup Pelanggan | Hanya evidence A2; source BE tidak ditemukan secara lokal |

Tabel ini tidak disusun sebagai ranking.

## 4. Proposed next module: **F30 Konfigurasi Umum**

Dipilih karena hanya F30 yang memenuhi semua kriteria objektif tanpa catatan: tanpa dependency lain, tanpa upload/Workflow, kontraknya bisa ditelusuri penuh dari legacy sampai source backend, dan model datanya tidak bisa kena masalah zero-value.

**Route legacy dan screen:**
- 9 MIGRATE, 0 REVIEW, 3 REMOVE (A4 §2 baris 67).
- Detail route ada di `A4_ROUTE_MIGRATION_MATRIX.md` baris 150-161.
- Screen:

| Screen | Route |
|---|---|
| S014 list | `GET /global-configuration` |
| S015 create | `/global-configuration/create` |
| S016 edit | `/global-configuration/:id/edit` |

- Sumber screen: `ROUTE_SCREEN_MAP.md` baris 533-535.
- Aksi lain: datatable, store, update, delete, multidelete, dan `updatebyproductgposb2b`. Route terakhir dipanggil dari F09 dan memakai PUT ke endpoint yang sama.

**Pola UI:**
- List memakai DataTable `#dataTable-global-configurations`, sort DESC (A1 §7), dengan bulk delete (A1 §6 baris 844).
- Aksi baris Edit/Delete berasal dari `GlobalConfigurationMapper` (A1 §8 baris 968).
- Form create/edit memakai `c:form_text` (baris 534-535).
- Pola ini sama dengan Content, jadi DataTable dan Form dari A5.5/A5.6 bisa dipakai ulang.

**API evidence:**

| Endpoint | Sumber | Status |
|---|---|---|
| `GET /api/v1/cms/global-configurations` (list) | A2 §6.2 baris 356 | VERIFIED |
| `POST` (create) | A2 §6.2 baris 361 | VERIFIED |
| `GET /:id` (detail) | A2 §6.2 baris 358 | VERIFIED |
| `PUT /:id` (update) | A2 §6.2 baris 362-363 | VERIFIED |
| `DELETE /:id` | A2 §6.2 baris 357 | VERIFIED |
| `DELETE /bulk` | A2 §6.2 baris 360 | VERIFIED |

Detail per lokasi:
- **Legacy request body:** `{key, value}` (`app/Repositories/GlobalConfigurationRepository.js:4-58`).
- **Backend `gpos-b2b-product-service`:**
  - Route di `handler/global_configuration.go:31-37`, termasuk `GET /detail?key=`.
  - DTO di `dto/global_configuration.go:22-41`: `Key` dan `Value` string `required`.
  - Model di `model/global_configuration.go:3-7`, dengan `Key` unique index dan tanpa field bool.
  - Update memakai `Updates(struct)` (`repository/global_configuration.go:122-130`); aman karena kedua field wajib tidak kosong (INFERRED).
  - Swagger tersedia di `docs/`.
  - Repo lokal ada di branch `cms-filter-banner` (`b5ca719`), jadi versi yang ter-deploy masih UNKNOWN.
- **Respons dan kode sukses yang sebenarnya:** UNKNOWN, belum pernah diuji live.

**Ringkasan dependency:**

| Aspek | Status | Evidence |
|---|---|---|
| Authorization | Menu S saja; sesi saja; API UNKNOWN; perlu capability baru (`settings.*`) | A2 §14 baris 794 |
| Dependency ke Content | Tidak ada | VERIFIED (A1 §23) |
| Dependency ke upload | Tidak ada | VERIFIED (A1 §16 tidak memuat S014-S016) |
| Dependency ke Workflow | Tidak ada | VERIFIED (A1 §23: CRUD saja) |

**Risiko yang didukung evidence:**
- Nilai konfigurasi dibaca oleh logic bisnis backend: `MAINTENANCE` dan `BANNER_INTERVAL` (`usecase/banner.go:112,145`), `CUSTOMER_CHANNEL_ID_ONLY_ZOETIS_VETE…` (`banner.go:123`, `sponsored_product.go:129`), `PRODUCT_IDS_ONLY…` (`sponsored_product.go:145`). Juga dibaca oleh F09 dan F26 di legacy (A2 §6.2 baris 440, 516-517).
- **Konsekuensinya:**
  - Verifikasi live hanya boleh memakai key uji baru yang inert.
  - Tidak boleh mengubah key yang sudah ada.
  - Otorisasi untuk modul ini lebih sensitif daripada Content.

## 5. Recommended phase

**A7.1 — Konfigurasi Umum Contract & Readiness**, belum implementasi:

```text
Legacy behavior (S014-S016, validasi, flash/error, bulk delete, updatebyproductgposb2b dari F09)
→ route inventory (9 MIGRATE; mapping ke /dashboard/global-configuration[/create|/update/[id]])
→ API contract (legacy A2 vs Swagger/DTO product-service; respons/kode sukses dan bentuk error = UNKNOWN sampai diverifikasi)
→ domain DTO (key/value; kunci unik; batas panjang dari model varchar(255)/text)
→ authorization (capability baru; sensitivitas key bisnis; keputusan OD-05/06)
→ UI contract (DataTable + Form + bulk delete; pakai ulang pola A6)
→ state/error contract (duplicate key, 403/404 unknown id seperti R3 Content)
→ test strategy (TEST_ADAPTER + contract tests)
→ live verification plan (read-only dulu; write hanya dengan key uji inert A7R-TEST-*, one-shot, read-back, approval residual)
→ GO/NO-GO
```

## 6. Evidence index

| Kesimpulan | Dokumen / section | File / baris |
|---|---|---|
| 32 feature area | A1 §23 | `gpos-b2b-cms/docs/migration/ROUTE_SCREEN_MAP.md:1821-1857` |
| Jumlah route per feature | A4 §2 | `A4_ROUTE_MIGRATION_MATRIX.md:37-71`; F30 di `:150-161` |
| DataTable / list kustom | A1 §7 | `ROUTE_SCREEN_MAP.md:875-957` |
| Upload | A1 §16 | `ROUTE_SCREEN_MAP.md:1309-1336` |
| Workflow / capabilities | A1 §23; A4 P-01 | `ROUTE_SCREEN_MAP.md:1821-1857`; `A4_MIGRATION_CONTRACT.md:19` |
| Model otorisasi / tidak ada RBAC | A2 §13-15 | `AUTH_API_PERMISSION_MAP.md:733-813` (F30 di `:794`) |
| Gateway paths | A2 §6.1 / §6.2 | `AUTH_API_PERMISSION_MAP.md:196-243`; F30 di `:355-363` |
| Legacy request F30 | source | `gpos-b2b-cms/app/Repositories/GlobalConfigurationRepository.js:4-58` |
| Backend F30 | source | `~/Developments/BE/gpos-b2b-product-service/{handler/global_configuration.go:28-38, dto/global_configuration.go:22-41, model/global_configuration.go:3-7, repository/global_configuration.go:122-130}` |
| Pembaca key konfigurasi | source | `gpos-b2b-product-service/usecase/banner.go:112,123,145`; `usecase/sponsored_product.go:129,145` |
| Pola update FAQ / Masukan | source | `gpos-b2b-content-service/repository/faq.go:85`, `model/faq.go:10`; `gpos-b2b-account-service/repository/feedback.go:71` |
| Status Content | A6R closeout | `frontend/docs/architecture/reviews/A6_WRITE_CONTRACT_READINESS.md` |
| Upload BLOCKED | A5.6 | `frontend/docs/architecture/reviews/A5.6_FORM_UPLOAD_FOUNDATION.md` |
