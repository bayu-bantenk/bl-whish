# Phase 5.2 — Audit Akhir

Proyek: **Blatifa Studio** · Tanggal: 2026-11-03 · Fase: 5.2 (Controlled Live Observation — No-Credit Preparation)

## Putusan keseluruhan: **tidak ada PASS keseluruhan**

Observasi read-only berhasil dan menghasilkan temuan penting. Namun kemampuan kritis berikut masih belum terpecahkan:
- membedakan video yang sedang dibuat dari yang sudah selesai;
- media id video yang stabil;
- asosiasi adegan ke video.

## 1. Delapan pertanyaan wajib (brief)

| # | Pertanyaan | Jawaban | Label |
|---|---|---|---|
| 1 | Apakah properti video selesai diverifikasi segar? | **Ya.** readyState 4, networkState 1, durasi 7,918005 detik, 720×1280, `paused`/`ended`/`currentTime`, `muted`, tanpa autoplay; tiga keadaan teramati: diam, saat hover, sesudah hover. Halaman detail tidak punya `<video>` | VERIFIED (LIVE-5.2) |
| 2 | Apakah ada sinyal penyelesaian independen yang terbukti? | **Tidak.** Semua sinyal (thumbnail di tile video, `<video>`+src, metadata media, dimensi) hanya teramati pada **satu video yang sudah selesai**, dan belum pernah dibandingkan dengan video yang belum selesai | UNVERIFIED |
| 3 | Apakah membedakan generating dan completed sekarang mungkin? | **Belum.** Juga terbukti bahwa isi DOM tile video bergantung pada **riwayat hover**, bukan status generate. Ini harus dikendalikan dalam eksperimen | UNVERIFIED |
| 4 | Apakah media id video yang stabil ditemukan? | **Tidak.** Tidak ada `data-media-id`; token `/asb/` buram dan berbeda antara thumbnail dan video; id rute hanya ada di URL. `MEDIA_ID_UNRESOLVED` tetap berlaku | VERIFIED (absence) |
| 5 | Apakah asosiasi adegan ke video terbukti? | **Tidak.** Tidak ada metadata adegan di DOM. Metode yang diusulkan: tepat satu tile baru (selisih himpunan) + nonce unik di prompt yang ditemukan di prompt tersimpan | PROPOSED |
| 6 | Apakah ada kredit Flow yang terpakai? | **Tidak.** Saldo 50 → 50, dibaca sendiri oleh pengguna (14:02:32 dan 14:41:08 UTC) | USER-reported |
| 7 | Apakah ada aksi Flow yang mengubah sesuatu? | **Tidak.** Blatifa tidak mengklik, mengetik, hover, atau menggulir apa pun. Satu-satunya perubahan halaman adalah 4 navigasi URL yang disetujui pengguna (2× ke detail video, 2× kembali) | VERIFIED |
| 8 | Apakah eksperimen generate terkontrol berikutnya siap? | **Spesifikasinya siap; pelaksanaannya belum.** Ada tiga syarat: (a) izin tertulis Anda yang menyebut `max_credits`, prompt, dan nonce; (b) Anda sendiri yang submit dan menjawab konfirmasi biaya di Flow, sementara Blatifa hanya mengamati; (c) disk di atas 10 GiB sebelum mulai | PROPOSED |

## 2. Temuan utama dan koreksi atas Phase 5

- **Video selesai di grid punya tiga keadaan DOM**, semua VERIFIED live:
  1. setelah halaman dimuat: `img "Generated video thumbnail"`;
  2. saat kursor di atasnya: `<video>` yang diputar;
  3. sesudahnya: `<video>` yang berhenti.
- **Koreksi Phase 5.** Kesimpulan bahwa `grid.video_thumbnail` "BROKEN" ternyata berasal dari keadaan sesudah hover, karena pengguna baru saja membuka video itu. Locator itu cocok di keadaan diam. Registry **sengaja tidak diubah**, tetap BROKEN dan fail-closed. Reklasifikasi menjadi "bergantung kondisi" berstatus **PROPOSED** dan menunggu persetujuan Anda.
- **Pengenal tile diperbarui.** `flow-video-tile` + thumbnail sekarang juga dikenali sebagai VIDEO. Ada sinyal baru `thumbnail_in_video_tile` (OBSERVED). Metadata media naik menjadi OBSERVED. Tidak ada sinyal VERIFIED, jadi status "selesai" tetap tidak bisa dicapai.
- **Halaman detail tidak punya `<video>`** dan tidak punya tombol identitas. Navigasi ke halaman detail tidak menambah bukti identitas.
- **URL gambar dari pengguna (`d4b93d87…`)** bukan salah satu `data-media-id` yang terlihat (PARTIALLY VERIFIED). Ini kasus kedua setelah `24f29e76…`.

## 3. Ringkasan spesifikasi eksperimen (`GENERATION_EXPERIMENT_SPEC.yaml`, status PROPOSED)

1. **P0 sebelum:** saldo (dibaca pengguna), identitas, multiset judul grid, struktur semua tile, `data-media-id`, status hover, disk, dan swap.
2. **P1 konfirmasi:** pengguna submit prompt yang memuat lock Octopus persis dan nonce `[blatifa-exp-<8 hex>]`. Blatifa membaca kutipan biaya secara read-only. Proses **berhenti** kalau biaya tidak terbaca atau ambigu, video ≠ 1, biaya di atas batas, ada dialog tak terduga, atau ada lebih dari satu konfirmasi terbuka. Biaya tidak diasumsikan.
3. **P2 generating:** setelah pengguna sekali Approve, tile baru dicari lewat selisih himpunan dan diamati setiap 10 detik, minimal 3 kali, dengan kursor jauh dari semua tile. Observasi dengan tile yang ter-hover dibuang.
4. **P3 selesai:** 3 observasi identik, lalu pengguna sekali hover (untuk properti media), lalu pengguna membuka detail (id rute + prompt tersimpan).
5. **Aturan sinyal:** sebuah sinyal menjadi VERIFIED hanya kalau ada di semua observasi P3 dan tidak ada di semua observasi P2. Karena n = 1, sinyal itu wajib dikonfirmasi ulang pada pemakaian produksi pertama.
6. **Asosiasi:** tepat satu tile baru, dan prompt tersimpan memuat nonce serta lock persis. Tidak pernah memakai urutan, waktu, judul, atau token.
7. **Batal kalau:** muncul lebih dari satu tile baru, ada tile lama yang hilang, identitas berubah, perubahan saldo ≠ kutipan, muncul dialog tak terduga, disk < 5 GiB, atau ada klik/input dari Blatifa.

## 4. Test

| | Hasil |
|---|---|
| Suite penuh | **353 lulus, 0 gagal, 7 dilewati** (live, opsional); 405 detik |
| Test baru Phase 5.2 | 27 (dari 21 fungsi): observasi/navigasi 13, bukti live + spesifikasi 13, properti video di Chrome headless 1 |
| Test lama yang ekspektasinya diubah | 1 (`test_signal_catalogue_is_evidence_labelled`: tingkat bukti diperbarui sesuai bukti live baru; ditambah asersi "tidak ada sinyal VERIFIED") |
| Lint | bersih |
| Isolasi temp | sentinel `pytest-sentinel-p51` tetap utuh; run gagal dari pengembangan disimpan (27 MB); tidak ada folder yang dihapus |

## 5. Disk dan swap

| Waktu | Free disk | Swap terpakai |
|---|---|---|
| Awal (16:33 WIB) | 13 GiB | 3,3 GiB |
| Sebelum run penuh (21:43 WIB, setelah sesi live) | **7,8 GiB** | 7,1 GiB |
| Sesudah run penuh (21:50 WIB) | **7,9 GiB** | 7,1 GiB |

**Peringatan:** free disk di bawah batas peringatan 10 GiB, tetapi di atas batas berhenti 5 GiB. Penyebabnya hampir seluruhnya swap macOS, yang naik selama sesi Chrome live dan test. Bukti fase ini hanya sekitar 2,4 MB. Tidak ada file yang dihapus. Sebelum eksperimen generate, Mac sebaiknya di-restart agar swap menyusut.

## 6. Hambatan yang tersisa (persis)

1. **Izin eksperimen** dari Anda: satu generate, batas kredit, prompt, dan nonce. Pengguna yang submit dan Approve.
2. **Sinyal penyelesaian VERIFIED** hanya bisa didapat dari eksperimen itu.
3. **Media id video** tetap UNRESOLVED. Id rute hanya bisa didapat saat pengguna membuka detail.
4. **Reklasifikasi `grid.video_thumbnail`** (PROPOSED) butuh persetujuan Anda.
5. **Disk 7,8 GiB** (peringatan).
6. Dari fase sebelumnya: kesetiaan prompt (U-01), lock Blatifa dan style yang masih DRAFT, saldo otomatis tanpa klik.

Phase 5.2 berhenti di sini. Generate yang sebenarnya membutuhkan izin eksplisit terpisah.
