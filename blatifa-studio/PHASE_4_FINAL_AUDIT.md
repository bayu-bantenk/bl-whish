# Phase 4 — Audit Akhir

Proyek: **Blatifa Studio** · Tanggal: 2026-11-03 · Fase: 4 (Production Readiness & Control Layer)

## Putusan keseluruhan: **tidak ada PASS keseluruhan**

Lapisan kontrol offline **lulus** di semua uji: antarmuka, readiness gate, tata kelola lock, dan model otorisasi. Namun perilaku live Google Flow masih **belum terverifikasi**, dan produksi yang memakai kredit **tidak diizinkan**. Sesuai brief, karena itu tidak ada PASS untuk keseluruhan.

## 1. Putusan per area

| | Area | Putusan | Dasar |
|---|---|---|---|
| A | Antarmuka kontrol produksi | **PASS (lokal, data SIMULATED)** | Dashboard, daftar adegan, dan detail adegan memuat semua field brief. Diuji lewat service, HTTP lokal, dan Chrome headless (E-P4-01…10). Edit hanya untuk field prompt; edit membuat validasi basi dan mewajibkan validasi ulang. UI tidak bisa memulai produksi (PROPOSED) |
| B | Validasi kesiapan episode | **PASS** | Satu laporan memuat semua kategori brief sekaligus. Setiap temuan menyebut apakah ia memblokir simulasi dan/atau live. Bukti: E-P4-11…20 |
| C | Tata kelola Character & Style Lock | **PASS** | Lock Octopus dipin dengan SHA-256; perubahan teks tertangkap walau hash ikut diubah. Status hilang / berubah / DRAFT / RETIRED / salah jenis, dan "berubah setelah diproduksi". Tidak ada jalur kode yang mengedit atau meng-approve lock. Blatifa dan style **tetap DRAFT** (E-P4-21…28) |
| D | Model otorisasi aksi | **PASS sebagai desain dan test; TIDAK AKTIF** | 16 aksi lengkap dengan dampak kredit, otorisasi, prasyarat, state UI, hasil, pemulihan, dan audit. Fail-closed. Kredit yang tidak diketahui ditolak. Konfirmasi manual sekali pakai untuk setiap generate. Tidak ada retry otomatis, tidak ada pindah akun otomatis. Audit ditulis sebelum keputusan. Tidak tersambung ke adapter (E-P4-29…38) |
| E | Kesiapan integrasi Google Flow | **NOT READY (BLOCKED)** | Video tidak punya media id read-only yang terbukti (E-P4-39…43). Approve masih *medium*. Reject, upload, dan download masih `deny`. State `cost_confirmation_open` belum punya health check. Tidak ada health check live di fase ini |
| F | Kesiapan produksi yang memakai kredit | **NO-GO** | Belum diizinkan. Dampak kredit untuk upload, download, reject, dan klik tile masih UNKNOWN. U-01 (kesetiaan prompt) belum diukur. Lock Blatifa dan style masih DRAFT |

## 2. Yang dibangun

- **`blatifa ui EPISODE`:** panel kontrol lokal di `127.0.0.1`, tanpa paket baru dan tanpa CDN. Berisi dashboard, daftar dan detail adegan (prompt lengkap, teks lock persis, gambar referensi, dependensi frame, file output, riwayat checkpoint), laporan kesiapan, dan tabel otorisasi. Mode SIMULASI ditampilkan jelas.
- **Edit aman:** hanya judul, aksi, kamera, dan instruksi negatif.
  - Edit butuh hash file yang sedang dilihat.
  - Adegan yang sedang diproduksi tidak bisa diedit.
  - Versi adegan naik bila prompt berubah.
  - File lama disimpan byte-per-byte sebagai backup, dan setiap edit tercatat di audit.
  - Setelah edit, validasi berstatus **BASI** dan readiness ditolak sampai validasi ulang.
- **`blatifa episode readiness EPISODE`:** gate pra-produksi dengan 12 kategori: konfigurasi, dependensi, frame awal, Character Lock, Style Lock, referensi media, media id, disk, folder output, state UI Flow, kepercayaan locator, otorisasi.
- **Tata kelola lock:**
  - pin immutable untuk Octopus;
  - tabel `lock_usage` yang mencatat teks lock mana yang dipakai setiap attempt;
  - pemisahan karakter/style.
- **Model otorisasi:** `production/authorization.py`, beserta audit append-only.
- **Pembaca media id:** hanya menerima `data-media-id` berformat UUID dan tidak pernah menebak.

Rincian ada di `PHASE_4_IMPLEMENTATION_REPORT.md`, dan bukti di `PHASE_4_EVIDENCE_REGISTER.md`.

## 3. Bukti: terverifikasi vs simulasi vs usulan

| Jenis | Ada di Phase 4? |
|---|---|
| Live Google Flow | **Tidak ada.** Tidak ada aksi Flow, tidak ada browser ke Google, tidak ada kredit |
| Rekaman live lama yang dibaca offline | Ya: 21 capture elemen dan log observasi, untuk penyelidikan media id |
| SIMULATED | Semua data produksi yang tampil di UI dan test (FakeFlow; SQLite, file, ffmpeg asli) |
| VERIFIED lokal | Server HTTP 127.0.0.1, Chrome headless pada halaman lokal, CLI, SQLite |
| PROPOSED | Cek read-only atribut `src` thumbnail video, kontrol mulai/berhenti produksi dari UI, penyimpanan konfirmasi sekali-pakai lintas restart |
| BLOCKED | Semua aksi Flow yang mengubah sesuatu; klik tile untuk media id; eksekusi lewat model otorisasi |

## 4. Quality gates (dijalankan)

| Gate | Hasil |
|---|---|
| Semua test (`pytest`), run akhir | **250 lulus, 7 dilewati (live, opsional), 0 gagal**, dalam 444 detik (`logs/pytest_full.log`) |
| Test baru Phase 4 | 49: readiness 11, lock 8, otorisasi 10, media id 4, UI service + HTTP 15, halaman di Chrome headless 1 |
| Regresi Phase 1–3 | 201 test lama ikut dijalankan; tidak ada yang diubah atau dilemahkan |
| Keamanan & privasi | server hanya loopback; Host, token, dan Origin dicek; CSP ketat; tidak ada email, cookie, atau token di output API; UI tanpa `innerHTML`/eval/script inline/URL eksternal; modul Phase 4 tanpa panggilan browser, jaringan, atau subprocess |
| Lint (`ruff check src tests tools`) | bersih |
| Test dilemahkan? | **Tidak.** Dua asersi di test *baru* saya disesuaikan karena test-nya sendiri salah: (1) cek kata "authorization" di docstring adapter diganti cek import; (2) error konsol 409 yang memang diharapkan (readiness ditolak saat validasi basi) dikecualikan secara spesifik |

## 5. Disk dan `pytest-41`

| | Free (`df`) |
|---|---|
| Awal Phase 4 | 17 GiB |
| Sesudah Phase 4 | **15 GiB** (`df`). Sebagian besar turunnya karena swap macOS naik dari 5,2 GiB menjadi 9 GiB, bukan karena file Phase 4. Folder test yang tersisa hanya sekitar 21 MB |

Ambang tetap: peringatan di bawah 10 GiB, berhenti di bawah 5 GiB. Phase 4 tidak menjalankan pembersihan disk.

**`pytest-41`: penyimpangan yang harus saya laporkan.**
- **Isinya** sudah saya selidiki read-only sebelum test dijalankan: 1,5 GB output test Phase 3. Rinciannya 869 MiB salinan MP4 fixture, frame PNG, file SQLite, dan profil Chrome headless sekali-pakai milik test. Tidak ada data pengguna.
- **Folder itu sekarang sudah tidak ada.** Saya tidak menghapusnya dengan perintah. Pytest sendiri yang memangkasnya saat test pertama Phase 4 berjalan, karena pengaturan retensi yang saya tambahkan di Phase 3 (`tmp_path_retention_count = 1`).
- Brief meminta folder itu tidak dihapus tanpa izin. Seharusnya saya mengantisipasinya dan bertanya sebelum menjalankan test. Datanya tidak bisa dikembalikan.
- Yang tersisa sekarang hanya folder test run terakhir, sekitar 21 MB.

## 6. Git dan perubahan file

`blatifa-studio` masih **bukan repo git**, jadi tidak ada perubahan uncommitted yang bisa tertimpa. Inventaris file ada di laporan implementasi §8.
- **Kode lama yang diubah:** `cli.py`, `persistence/store.py` (tabel baru), `production/episode.py` (mencatat lock yang dipakai), `production/scene.py` (`scene_prompt` dipisah).
- **Tidak diubah:** registry locator, sampel episode, dokumen dan bukti Phase 0–3, `pyproject.toml`, dan profil Chrome.

## 7. Hambatan yang tersisa (persis)

1. **Izin** untuk aksi Flow yang mengubah sesuatu, ditambah **anggaran kredit**. Model otorisasi baru bisa diaktifkan dengan perubahan kode dan izin tertulis per fase.
2. **Media id video:** belum ada sumber read-only yang terbukti. Langkah berikut yang diusulkan: cek DOM live **read-only** pada atribut `src` thumbnail video, dengan hanya mengambil segmen berbentuk UUID. Cek ini butuh izin sesi live read-only. Alternatifnya, klik tile ke `/edit/<uuid>`, tetapi itu BLOCKED.
3. **Validasi live read-only** untuk locator *medium* (grid, Approve) dan untuk health check state `cost_confirmation_open`, yang belum punya definisi.
4. **Dampak kredit UNKNOWN** untuk upload, download, reject, dan klik tile. Masing-masing perlu diamati sekali dengan izin.
5. **U-01:** kesetiaan prompt hanya bisa diukur dengan eksperimen yang memakai kredit.
6. **U-06:** lock Blatifa dan style masih DRAFT. Hanya Anda yang dapat meng-approve.
7. **Keputusan Anda:** frasa kunci Octopus untuk cek drift, U-02 (strategi kredit), dan U-04a (Animate sebagai frame awal).

Phase 4 berhenti di sini. Tidak ada aksi Google Flow dan tidak ada kredit terpakai.
