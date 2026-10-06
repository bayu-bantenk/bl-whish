Kelima modul Batch 2 sudah diimplementasi dan lulus gate otomatis. Live READ belum jalan karena credential live hanya ada di terminal kamu, dan live WRITE memang tidak dijalankan.

Semua modul memakai upload signed-URL yang sudah ada. Kontraknya saya cek langsung di source backend (`content-service/handler/file.go`).

```text
F07 Produk
- Implementation: PASS (list + edit; legacy memang tidak punya create/delete)
- Tests: 34/34 unit, 4 E2E
- TypeScript: PASS | Lint: PASS | Build: PASS
- Live READ: BLOCKED — command di bawah perlu dijalankan dari terminal kamu
- Live WRITE: NOT RUN
- Backend issue: GET /{id} yang tidak ada → 500, bukan 404 (step R5 live akan menampilkan Server error);
  update memaksa is_draft=false dan menimpa seluruh baris
- Visual: NEEDS SCREENSHOT (label/warna badge)

F08 Kategori Produk
- Implementation: PASS (CRUD + bulk delete + gambar wajib)
- Tests: 40/40 unit, 4 E2E
- TypeScript: PASS | Lint: PASS | Build: PASS
- Live READ: BLOCKED — command di bawah perlu dijalankan dari terminal kamu
- Live WRITE: NOT RUN
- Backend issue: sort_by mentah ke ORDER BY (frontend hanya kirim allowlist)

F19 Group Story
- Implementation: PASS — PARTIAL / CONTRACT BLOCKED
- Tests: 46/46 unit, 4 E2E
- TypeScript: PASS | Lint: PASS | Build: PASS
- Live READ: BLOCKED — command di bawah perlu dijalankan dari terminal kamu
- Live WRITE: NOT RUN
- Contract gap: BLOCKED — BACKEND CONTRACT REQUIRED. Source service story-group tidak ada di workspace.
  DTO create/update (create kirim banner_ids/platforms, update kirim banners/platform), kode sukses,
  bentuk response dan batas panjang field hanya disimpulkan dari kode legacy.
  Belum diketahui apakah update menyimpan is_active=false.

F18 Banner & Iklan
- Implementation: PASS — PARTIAL (upload TIDAK blocked; tab "Katalog Produk" ditunda)
- Tests: 32/32 unit, 6 E2E
- TypeScript: PASS | Lint: PASS | Build: PASS
- Live READ: BLOCKED — command di bawah perlu dijalankan dari terminal kamu
- Live WRITE: NOT RUN
- Backend issue: UpdateBanner memakai Updates(struct) (kelas bug D-A6R2-01): sequence=0,
  link/konten kosong dan story_image=null tidak tersimpan
- Visual: deskripsi konten di legacy pakai editor Quill, sekarang textarea biasa (perlu keputusan);
  page size dikembalikan ke legacy 15/20/50/100

F28 Prinsipal
- Implementation: PASS (CRUD + bulk delete + logo)
- Tests: 41/41 unit, 5 E2E
- TypeScript: PASS | Lint: PASS | Build: PASS
- Live READ: BLOCKED — command di bawah perlu dijalankan dari terminal kamu
- Live WRITE: NOT RUN
- Backend issue: Updates(struct) — set nonaktif dan mengosongkan telepon/fax/website/alamat tidak tersimpan
- Catatan: legacy menyimpan logo di disk server Adonis (tidak bisa dibuka); sekarang memakai upload
  signed-URL dengan kategori 'principal'
```

```text
BATCH 2 SUMMARY

Module Gate:
F08: MODULE_GATE_PASS
F19: MODULE_GATE_PASS — PARTIAL / CONTRACT BLOCKED (kontrak write story-group)
F18: MODULE_GATE_PASS — PARTIAL (tab Katalog Produk ditunda; Quill perlu keputusan)
F28: MODULE_GATE_PASS
F07: MODULE_GATE_PASS

Gate keseluruhan: vitest 946/946 · E2E 129/130 · tsc 0 · lint 0 error · build OK · bundle PASS
Satu E2E yang gagal adalah datatable.spec Content (retry setelah 500). Test ini kadang gagal
juga saat dijalankan sendirian, dan batch ini tidak mengubah kode tabel bersama.

Live READ:
Belum jalan. Jalankan dari terminal kamu:
  cd frontend
  for m in product product-category banner group-story principal; do
    LIVE_MODULE=$m npx vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts
  done

Backend issues:
- Updates(struct) zero-value: F18 Banner, F28 Prinsipal (dan F19 kemungkinan)
- F07 detail id yang tidak ada → 500
- sort_by SQL injection: F07, F08, F18, F28
- FAQ total_rows (OPEN), F25 customer_ids (OPEN) — tidak diubah

Required input from user:
1. Jalankan live READ di atas
2. Kontrak story-group (F19) dari tim backend
3. Keputusan: bangun tab Katalog Produk F18? Editor Quill atau textarea?
4. Screenshot legacy untuk F07 dan F19 kalau visual parity harus persis
5. Tambahkan capability baru ke AUTHZ_INTERIM_GRANTS supaya menu tampil

Recommended next batch:
Batch 3 (workflow): F31 Manajemen Pengguna, F27 Verifikasi Akun, F22 Voucher Pengiriman,
F23 GPOS Brand, F17 Push Notification.
```

Perubahan bersama di batch ini:
- **Menu:** urutannya sekarang mengikuti urutan legacy.
- **Test E2E:** network guard mengizinkan GET ke file publik di storage, karena preview gambar memang membaca `file_url` dari sana. Helper aksesibilitas menunggu `<title>` dimuat sebelum mengecek, untuk menghilangkan flake saat suite berjalan penuh.

Laporan lengkap: `docs/architecture/reviews/BATCH2_MIGRATION_REPORT.md`.
---

## Batch 2 — Closure Gate (2026-10-06)

```text
Batch 2 Status: CONDITIONAL GO
```

| Module | Static | E2E | Live READ | Contract | Visual | Status |
|---|---|---|---|---|---|---|
| F07 Produk | PASS | PASS | PASS (R5 = backend 500, B2-01) | PASS | PASS | CONDITIONAL GO |
| F08 Kategori Produk | PASS | PASS | PASS | PASS | NEEDS EVIDENCE | GO |
| F18 Banner & Iklan | PASS | PASS | PASS (criteria defect fixed) | PASS | NEEDS DECISION (Quill) | CONDITIONAL GO |
| F19 Group Story | PASS | PASS | PASS (READ) | WRITE BLOCKED | PASS | CONDITIONAL GO |
| F28 Prinsipal | PASS | PASS | PASS (R2 overlap = backend, B2-08) | PASS | NEEDS EVIDENCE | CONDITIONAL GO |

**Automated:** vitest 961 / 961 · E2E 132 / 132 · tsc 0 · eslint 0 errors · build PASS · bundle PASS.

**Live READ:** 5 / 5 modules, mutations 0, secrets 0.

**Conditions:**
- the F19 story-group write contract has to be confirmed by the backend team;
- backend bugs B2-01 … B2-08 stay open.

Details: `BATCH2_CLOSURE_GATE.md`. Batch 3: NOT STARTED.
