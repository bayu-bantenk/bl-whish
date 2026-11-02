# Phase 0 — Audit Akhir

Proyek: **Blatifa Studio** · Tanggal: 2026-11-02 · Fase: 0 (Discovery & Architecture)

## Putusan akhir: **CONDITIONAL PASS** (lulus bersyarat)

Google Flow **berhasil diinspeksi langsung**, dan satu adegan uji berhasil dijalankan dari awal sampai akhir: generate → render → download → validasi → ekstraksi frame terakhir. Semua arsitektur sudah didefinisikan.

Putusan belum bisa "PASS" penuh karena:
1. Ditemukan **risiko kritis**: agen Flow menulis ulang prompt, sehingga lock Octopus belum terbukti bisa dipertahankan.
2. Beberapa jalur penting belum teruji: pesan kredit habis, error generate, sesi kedaluwarsa, upload file lokal sampai selesai, dan text-to-video.
3. Kebutuhan kredit (±360 per episode) jauh di atas saldo harian akun saat ini (±50, perkiraan), sehingga perlu keputusan Anda.

## 1. Tabel gerbang audit

| Area | Hasil yang diminta | Hasil | Status |
|---|---|---|---|
| Environment discovery | Bukti terdokumentasi | `ENVIRONMENT_AUDIT.md`, E-ENV-01…06 | ✅ PASS |
| Flow UI discovery | Inspeksi nyata atau BLOCKED | Inspeksi nyata, 20 bukti (E-FLOW-01…20) | ✅ PASS |
| Workflow mapping | Berbasis bukti | Image-to-video terverifikasi 1× (lewat "+"); jalur menu "Animate" terverifikasi sampai ingredient terpasang; text-to-video & start+end frame UNVERIFIED | ⚠️ PARTIAL |
| Playwright architecture | Didefinisikan | Opsi A (Chrome asli + CDP) terverifikasi | ✅ PASS |
| Browser profile architecture | Didefinisikan | 1 profil per akun, mode 700, FileVault | ✅ PASS |
| Account & credit architecture | Didefinisikan + batasan | Identitas & saldo terbaca dari DOM; kebijakan anti-akal-akalan kuota | ✅ PASS (dengan batasan) |
| Episode JSON contract | Didefinisikan + divalidasi | Lolos validator stdlib; validasi Pydantic belum (paket belum terpasang) | ⚠️ PARTIAL |
| Scene dependency model | Didefinisikan | Graf frame + `depends_on`, deteksi siklus | ✅ PASS |
| State machine | Didefinisikan | 18 state, transisi, write-ahead | ✅ PASS |
| Recovery strategy | Didefinisikan | 12 skenario + aturan crash di sekitar Approve | ✅ PASS (belum diuji nyata) |
| Security model | Didefinisikan | `SYSTEM_ARCHITECTURE.md` §6 | ✅ PASS |
| System architecture | Didefinisikan | Komponen, kontrak, diagram | ✅ PASS |
| Phase roadmap | Didefinisikan | 7 fase + 4 perubahan beralasan | ✅ PASS |
| Implementation scope | Tanpa implementasi prematur | Hanya skrip discovery sekali-pakai di `evidence/tools/` | ✅ PASS |

## 2. Ringkasan eksekutif

- Kotak prompt Google Flow (November 2026) **tidak punya pemilih mode**. **Koreksi dari Anda:** menu **"Animate"** ada di tombol ⋮ pada tile **gambar** (terverifikasi). Menu itu menaruh gambar sebagai *ingredient* di panel agen. Jadi semua generate video tetap lewat **panel agen**: lampirkan gambar (lewat "+" atau menu "Animate") → tulis prompt → agen menyebut biaya → Anda (atau aplikasi) menekan **Approve** → video dirender.
- Langkah konfirmasi biaya ini sangat berguna sebagai **rem pengaman kredit**. Aplikasi akan selalu membaca biayanya dulu dan tidak akan pernah memilih "Always approve".
- Otomasi dengan **Chrome asli + profil terpisah + Playwright via CDP** terbukti berjalan: login Google normal, upload bisa ditangkap, download berhasil, dan FFmpeg berhasil memvalidasi video serta mengambil frame terakhir.
- Saldo kredit dan identitas akun **terbaca langsung dari tampilan**, jadi tidak perlu OCR.

## 3. Temuan terverifikasi (VERIFIED)

1. Alamat Flow: `flow.google.com`. Setiap project dan media punya ID unik (UUID) di URL.
2. Generate video: kolom `"What do you want to create?"` + tombol `"Add ingredients to the prompt box"` + `"Start generation"`. Alternatifnya: tile gambar → ⋮ → **"Animate"**, yang menaruh gambar ke kotak prompt yang sama tanpa memakai kredit.
2a. Hal-hal kecil penting untuk otomasi: mengklik chip ingredient justru **menghapusnya**. Panel akun tidak bisa ditutup dengan Escape. Bar atas hilang saat grid tergulir. Menu tile video punya **"Publish to YouTube"** dan aplikasi **tidak boleh** mengkliknya. Sesi agen tetap tersimpan setelah browser ditutup.
3. Konfirmasi biaya: *"…costing 10 credits?"* dengan pilihan Approve / Always approve / Reject.
4. Progres rendering tampil sebagai **persentase di tile grid** (4% → 32% → selesai, ±60 detik). Teks chat agen **tidak bisa dipercaya** untuk status.
5. Download 720p berhasil: MP4 H.264 720×1280, 24 fps, 7,93 detik, dengan audio. 1080p dan 4K butuh upgrade.
6. Frame terakhir berhasil diekstrak dengan FFmpeg (2 metode).
7. Panel akun: "40 Google Flow credits", "Credits refresh daily at 3:37 PM".
8. **Agen Flow menulis ulang prompt** (risiko utama).
9. Disk tersisa 11 GB (98% penuh). FileVault aktif.

## 4. Masalah yang belum selesai & tindakan yang dibutuhkan

| ID | Masalah | Tingkat | Tindakan tepat |
|---|---|---|---|
| U-01 | Agen Flow menulis ulang prompt, sehingga lock Octopus bisa hilang atau berubah | **Kritis** | Phase 2: uji "Agent instructions" + format prompt "gunakan persis" (±10 percobaan, butuh kredit). Lulus jika frasa kunci lock tetap ada di ≥9/10 percobaan. |
| U-02 | Kebutuhan ±360 kredit/episode vs saldo harian ±50 | **Tinggi** (keputusan bisnis) | Anda memilih: produksi bertahap per hari, upgrade langganan Google AI, dan/atau memakai akun lain milik Anda sendiri yang sah. Sistem **tidak** akan memutar akun otomatis. |
| U-03 | Disk hanya 11 GB | **Tinggi** | Kosongkan 30–50 GB atau siapkan disk eksternal sebelum Phase 4. |
| U-04 | Belum teruji: upload file lokal sampai selesai, text-to-video, frame awal + akhir, pesan kredit habis, error generate, sesi kedaluwarsa, daftar model video | Sedang | Checklist di `FLOW_UI_DISCOVERY.md` §6 (Phase 1 tanpa kredit; Phase 2 dengan kredit). |
| U-05 | Validasi Pydantic belum dijalankan | Rendah | Pasang Pydantic di Phase 1, lalu validasi ulang `sample_episode.json`. |
| U-06 | Lock karakter Blatifa & lock gaya masih DRAFT (saya susun dari gambar yang ada) | Sedang | Anda meninjau dan menyetujui atau memperbaiki teksnya. |
| U-07 | Sisa uji di project Flow "Blatifa": video "Cat waving to camera" dan 1 scene kosong di Trash | Rendah | Hapus jika tidak diperlukan. |
| U-08 | Profil Chrome discovery (`blatifa-studio/.profiles/discovery`) berisi sesi login Anda | Sedang (keamanan) | Simpan untuk dipakai di Phase 1, atau hapus foldernya. Jangan pernah dibagikan atau di-commit. |
| U-09 | Folder proyek belum menjadi repositori git | Rendah | Phase 1: `git init` + `.gitignore` (`.venv/`, `.profiles/`, workspace media). |

## 5. Keputusan arsitektur utama

1. **Chrome asli + profil terpisah per akun + Playwright via CDP** (bukan Chromium bawaan, bukan headless).
2. **Flow Adapter** adalah satu-satunya bagian yang mengenal Flow dan bisa diganti. Proses `submit` (sampai kutipan biaya) dipisah dari `approve`.
3. **Locator registry** berbasis role + nama aksesibilitas, dicek sebelum setiap langkah. Kalau ragu, sistem berhenti; tidak pernah menebak atau klik berdasarkan koordinat.
4. **SQLite dengan prinsip write-ahead.** State `RECONCILING` wajib dilalui sebelum mengulang apa pun yang memakai kredit.
5. **Lock karakter disimpan dengan hash SHA-256** dan dimasukkan ke prompt kata demi kata. Prompt yang tersimpan di Flow diperiksa ulang untuk mendeteksi *lock drift*.
6. **Tanpa rotasi akun otomatis.** Pergantian akun selalu atas pilihan Anda.
7. OpenCV dan OCR **ditunda** karena belum dibutuhkan.

## 6. Langkah berikutnya yang direkomendasikan

1. Tinjau dan setujui dokumen Phase 0 ini.
2. Putuskan U-02 (strategi kredit) dan U-06 (teks lock Blatifa).
3. Izinkan pemasangan dependensi Phase 1: Python 3.12 via uv, `playwright`, `pydantic`, `pytest`, `ruff`, `pyyaml`.
4. Mulai Phase 1 (fondasi browser + inspector + baca identitas/kredit, **tanpa memakai kredit**).

## 7. Kesiapan Phase 1

**Status: SIAP, dengan 2 syarat:** (a) persetujuan Anda atas audit ini, dan (b) izin memasang dependensi.

- Phase 1 **tidak memakai kredit** dan tidak bergantung pada U-01/U-02, sehingga bisa dimulai sebelum masalah itu selesai.
- Disk 11 GB **cukup untuk Phase 1–2**, tetapi tidak untuk Phase 4.
- Phase 2 (yang memakai kredit) baru dimulai setelah ada anggaran kredit uji yang Anda setujui (usulan ≤100 kredit).

## 8. Daftar dokumen

`ENVIRONMENT_AUDIT.md` · `FLOW_UI_DISCOVERY.md` · `FLOW_INSPECTOR_ARCHITECTURE.md` · `BROWSER_AUTOMATION_ARCHITECTURE.md` · `ACCOUNT_CREDIT_ARCHITECTURE.md` · `EPISODE_DATA_CONTRACT.md` · `examples/sample_episode.json` · `PRODUCTION_STATE_MACHINE.md` · `SYSTEM_ARCHITECTURE.md` · `IMPLEMENTATION_ROADMAP.md` · `PHASE_0_EVIDENCE_REGISTER.md` · `PHASE_0_FINAL_AUDIT.md` · bukti di `evidence/`.

Kredit yang terpakai selama Phase 0: **10 kredit** (1 video uji, atas izin Anda).
