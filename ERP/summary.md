PHASE 5.3G: Spesifikasi L-1/L-2, Revision 3 (hanya laporan, tidak ada file)

Untuk revisi ini saya hanya membaca tiga hal secara read-only: requires-python di pyproject.toml, implementasi reject(), dan blok penolakan di runner. Tidak ada eksekusi, tidak ada file yang ditulis.

Label yang dipakai:
- FACT: terbukti dari kode atau dokumen, dengan path:line.
- INFERENCE: kesimpulan, belum diverifikasi.
- PROPOSAL: rancangan.
- UNVERIFIED / OPEN / DEFERRED: belum ada bukti atau keputusan.
- NOT ESTABLISHED — REQUIRES DECISION OR EVIDENCE: tidak cukup informasi.

---

A. Ringkasan Revision 3

Perubahan penting dari Revision 2:

1. Wrapper Frame (R3-1). Diganti dengan TrustedFrameView yang hanya punya lima operasi tetap. Tidak ada evaluate() generik, tidak ada locator(selector) generik, dan objek Frame mentah tidak pernah diekspos. Pembatasan nama method dinyatakan bukan batas keamanan.
2. Identitas page.main_frame (R3-2). Diturunkan menjadi UNVERIFIED (OD-31). Bila identitas tidak bisa dipastikan, hasilnya penolakan. Pemeriksaan ini tidak pernah dipakai sendirian sebagai bukti.
3. Regex project id (R3-3). [0-9a-f-]{36} dinyatakan bukan validasi UUID kanonik. Format kanonik menjadi OPEN (OD-30). Regex yang ada tidak diubah.
4. Cap (R3-4). CHECK (cap > 0) dihapus. Yang sudah diputuskan: cap eksplisit, NOT NULL, tanpa DEFAULT. Tipe, rentang dan validasinya OPEN (OD-27).
5. Timeout (R3-5). Dipisah: timeout sebelum approval (Tx-RESERVE dan Tx-ENTER) berbeda dengan timeout sesudah approval (Tx-COMMIT). Timeout di Tx-COMMIT tidak berarti approval tidak terjadi.
6. Tx-ENTER (R3-6). Klaim atomisitas dibatasi pada reservasi dan ledger. Attempt hanya menjadi precondition di sana. Tiga alternatif untuk OD-19 dijabarkan dan tetap OPEN.
7. Tx-REC-FOUND (R3-7). Precondition dan bukti didefinisikan dari decide() (FACT). Hasil yang ambigu masuk ke MANUAL atau UNKNOWN.
8. Tx-BLOCK (R3-8). Ledger REJECTED mempertahankan semantik yang ada, yaitu reject() dipanggil untuk penolakan apa pun. Penyebabnya dicatat terpisah. Pemetaan outcome ledger yang lebih rinci menjadi OPEN (OD-26).
9. OD-25 (R3-9). CLOSED sebagai FAIL-CLOSED REQUIREMENT.
10. Klasifikasi error SQLite (R3-10). Berbasis kode error, bukan string. Detail perilaku library di runtime OPEN (OD-28).
11. Process lock (R3-11). Cakupan jaminannya dibatasi secara jujur. OD-14 tetap OPEN.
12. Deviasi proses (R3-12). Dicatat di audit trail.
13. Temuan baru dari pemeriksaan ulang:
    - Kegagalan COMMIT di Store._tx tidak di-rollback (FACT). Ditangani di OD-29 / CC-14.
    - Melepas RESERVED saat startup tetap aman walaupun lock gagal, karena CAS Tx-ENTER mensyaratkan RESERVED.

Status: dokumen ini siap direview sebagai dokumen. Dokumen ini tidak siap diimplementasi dan tidak siap dipakai live. Masih ada 21 OD yang OPEN atau DEFERRED, dan tidak satu pun AC sudah lulus.

Catatan deviasi proses (R3-12, audit trail): pada Revision 2 saya sempat mengirim satu perintah Bash yang berisi python3 -c. Menurut laporan sistem yang tersedia, perintah itu ditolak sebelum dieksekusi, jadi Python tidak berjalan. Percobaan itu melanggar larangan brief dan tidak saya ulangi. Catatan ini tetap di audit trail.

---

B. Spesifikasi L-1: Source Authenticity

L1.0 Cakupan dan non-goal

- Cakupan:
  - A1: validasi origin dan main frame secara ketat.
  - A2: identitas navigasi dan dokumen sebelum dan sesudah snapshot.
  - A3: identitas halaman dari beberapa sinyal.
  - A4: SourceEvidence diikat ke entri registry dan ke adapter approval.
  - A5: adapter akuisisi tepercaya dipisahkan dari jalur akuisisi TEST.
  - A4 dan A5 adalah inti desain.
- Non-goal:
  - Membuktikan saldo server.
  - Mencegah manipulasi lokal.
  - Koordinasi antarproses (itu cakupan L-2).
- Pembedaan wajib: R-2 provenance hanya membuktikan bahwa reading berasal dari acquire_balance, tidak dimutasi, segar, dan sekali pakai. R-2 provenance bukan bukti keaslian sumber. L-1 menambah bukti sumber, tetapi L-1 juga tidak membuktikan keaslian terhadap browser yang sudah terkompromi.

L1.1 Baseline (FACT)

┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────┐
│                                                             Fakta                                                             │                               Bukti                               │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┤
│ acquire_balance(page) menerima objek apa pun dengan locator("body").aria_snapshot()                                           │ src/blatifa/account/provenance.py:10, :141-150                    │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┤
│ Tab dipilih lewat substring FLOW_HOST in p.url, dengan fallback                                                               │ src/blatifa/browser/engine.py:162-169                             │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┤
│ PROJECT_URL = ^https://flow.google.com/project/[0-9a-f-]{36}$. Regex ini tidak memaksa bentuk UUID 8-4-4-4-12                 │ src/blatifa/flow/adapter.py:40                                    │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┤
│ _on_project: page.url.split("?")[0].rstrip("/") != project_url                                                                │ src/blatifa/flow/adapter.py:69-71                                 │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┤
│ approve() dan reject() di adapter live melempar BlockedOperationError                                                         │ src/blatifa/flow/adapter.py:156-160                               │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┤
│ ReadOnlyPage hanya membuka url, title, locator, get_by_*, evaluate (script yang sudah diperiksa) dan screenshot. Atribut lain │ src/blatifa/flow/live_probe.py:72-107                             │
│  memicu MutationAttemptError                                                                                                  │                                                                   │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┤
│ ReadOnlyPage.locator(selector) menerima selector bebas                                                                        │ src/blatifa/flow/live_probe.py:84-85                              │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┤
│ Identitas akun dibaca dari DOM yang sama dengan saldo                                                                         │ src/blatifa/flow/live_probe.py:316-325;                           │
│                                                                                                                               │ src/blatifa/account/reader.py:59-61                               │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────┤
│ Python proyek: >=3.12,<3.13                                                                                                   │ pyproject.toml:5                                                  │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────┘

L1.2 Model ancaman dan batasan yang tetap berlaku

┌─────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  #  │                                                        Batasan (dinyatakan eksplisit)                                                         │
├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1   │ Bukti dari DOM, termasuk saldo, fingerprint, judul dan locator, adalah satu sumber. Bukti ini tidak independen bila browser sudah terkompromi │
├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2   │ Manipulasi berbahaya di dalam proses yang sama berada di luar jaminan Option C, termasuk akses ke atribut privat wrapper                      │
├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 3   │ Pihak yang punya akses CDP di 127.0.0.1, ekstensi browser, atau kompromi browser lokal berada di luar jaminan                                 │
├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 4   │ Pemakaian manual akun Google yang sama di luar aplikasi tidak bisa dideteksi maupun dikoordinasi                                              │
├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 5   │ Restart proses tidak membuktikan keaslian sumber maupun keamanan budget                                                                       │
├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 6   │ Tab yang aktif tidak boleh dianggap sebagai project yang benar                                                                                │
├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 7   │ Saldo di UI tidak boleh dianggap selalu segar                                                                                                 │
├─────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 8   │ Spesifikasi ini tidak mengizinkan operasi live apa pun                                                                                        │
└─────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

L1.3 Skema SourceEvidence (PROPOSAL)

Frozen dataclass di provenance.py, disimpan hanya di entri registry, tidak di objek reading.

┌─────────────────────────┬──────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│          Field          │           Tipe           │                                                   Arti                                                    │
├─────────────────────────┼──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ version                 │ int                      │ 1                                                                                                         │
├─────────────────────────┼──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ kind                    │ enum TRUSTED_LIVE | TEST │ Ditentukan oleh fungsi akuisisi, tidak pernah oleh pemanggil                                              │
├─────────────────────────┼──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ project_id              │ str                      │ Id dari adapter.project_url, yang sudah lolos regex yang ada                                              │
├─────────────────────────┼──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ url_digest              │ str                      │ Lihat L1.5                                                                                                │
├─────────────────────────┼──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ main_frame_checked      │ bool                     │ Hasil validasi L1.4 langkah 1–4. Bukan objek Frame                                                        │
├─────────────────────────┼──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ doc_identity_digest     │ str                      │ SHA-256 dari keluaran DOC_IDENTITY_JS (L1.4) sebelum snapshot, yang harus sama dengan keluaran sesudahnya │
├─────────────────────────┼──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ account_fingerprint     │ str                      │ Dari DOM yang sama (batasan 1)                                                                            │
├─────────────────────────┼──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ t_mono_pre, t_mono_post │ float                    │ t_mono milik R-2 tetap t_mono_pre                                                                         │
├─────────────────────────┼──────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ adapter_ref, page_ref   │ weakref tanpa callback   │ Untuk binding A4 dan A5. Tidak diserialisasi                                                              │
└─────────────────────────┴──────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────┘

evidence_digest adalah SHA-256 dari field yang bisa diserialisasi. Dipakai oleh L-2.

Objek Frame mentah tidak disimpan di evidence (R3-1).

L1.4 TrustedFrameView (R3-1, PROPOSAL, OD-23 OPEN)

Lokasi dan visibilitas: dibuat hanya di dalam GoogleFlowAgentAdapter.acquire_trusted_balance(), dan hanya hidup selama satu kali akuisisi. Objek ini tidak dikembalikan, tidak disimpan, dan tidak diberikan ke runner, probe, atau gates.

Operasi yang diizinkan (lengkap, tidak ada yang lain):

┌─────┬──────────────────────┬───────────────────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────────────┐
│  #  │       Operasi        │                                Implementasi konseptual                                │                             Validasi tipe hasil                              │
├─────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ 1   │ is_main()            │ frame.parent_frame is None                                                            │ bool, dari perbandingan identitas                                            │
├─────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ 2   │ is_detached()        │ frame.is_detached()                                                                   │ type(x) is bool. Bila bukan, gagal                                           │
├─────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ 3   │ url()                │ frame.url                                                                             │ type(x) is str. Bila bukan, gagal                                            │
├─────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ 4   │ body_aria_snapshot() │ frame.locator("body").aria_snapshot() dengan selector konstan                         │ type(x) is str                                                               │
├─────┼──────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────────────┤
│ 5   │ document_identity()  │ frame.evaluate(DOC_IDENTITY_JS) dengan konstanta script tetap yang sudah diaudit,     │ Skema persis: dict berkunci {timeOrigin: float, url: str}. Bila ada kunci    │
│     │                      │ tanpa parameter script                                                                │ tambahan atau kurang, gagal                                                  │
└─────┴──────────────────────┴───────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────────────┘

Yang dilarang:
- evaluate(script) generik;
- locator(selector) generik;
- frame, page, child_frames atau properti mentah lain;
- __getattr__ mengembalikan apa pun (selalu raise).

Isi DOC_IDENTITY_JS: hanya membaca performance.timeOrigin dan document.URL. Tidak ada event, tidak ada penulisan. Teks konstantanya ditinjau lewat code review di bawah CC-10.

Penanganan kondisi:

┌───────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        Kondisi                        │                                                                   Hasil                                                                   │
├───────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ is_detached() bernilai True, atau is_main() bernilai  │ SourceEvidenceError, tidak ada registrasi                                                                                                 │
│ False                                                 │                                                                                                                                           │
├───────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tipe hasil tidak sesuai                               │ SourceEvidenceError                                                                                                                       │
├───────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Exception dari Playwright                             │ Diteruskan tanpa diubah (konsisten dengan R-2 AMB-1). Tidak ada registrasi dan tidak FAULTED. Ini gagal tertutup karena tidak ada reading │
│                                                       │  yang terdaftar                                                                                                                           │
├───────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Frame berubah antara pre dan post (L1.6 langkah 4)    │ SourceEvidenceError                                                                                                                       │
├───────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Kondisi apa pun yang tidak bisa diverifikasi          │ SourceEvidenceError                                                                                                                       │
└───────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Pernyataan keamanan yang jujur: wrapper ini mempersempit permukaan API dan mencegah salah pakai yang tidak disengaja. Wrapper ini tidak memberi isolasi terhadap kode in-process (batasan 2). Pembatasan nama method bukan batas keamanan.

Status: OPEN. Desain ini belum terbukti. AC yang dibutuhkan: L1-AC-12 sampai L1-AC-14 (static) dan L1-AC-11 (unit dengan double).

L1.5 Kontrak URL dan project (R3-3; PROPOSAL; OD-1, OD-2, OD-30 OPEN)

┌─────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                  Aspek                  │                                                                         Aturan                                                                          │
├─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Input                                   │ TrustedFrameView.url(), berupa string mentah tanpa normalisasi                                                                                          │
├─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Diterima                                │ Hanya bila url == "https://flow.google.com/project/" + project_id                                                                                       │
├─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ project_id                              │ String id dari adapter.project_url. Validasi formatnya hanya regex yang sudah ada (adapter.py:40), yang bukan validasi UUID kanonik. Format kanonik     │
│                                         │ yang dibutuhkan: OPEN (OD-30). Mengubah regex butuh change control                                                                                      │
├─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Scheme dan host                         │ Bagian dari literal: https, flow.google.com. Tidak ada normalisasi huruf kapital atau punycode                                                          │
├─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Port, userinfo, query, fragment, garis  │ Semuanya ditolak, karena perbandingan memakai string persis                                                                                             │
│ miring di akhir                         │                                                                                                                                                         │
├─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Hubungan dengan _on_project             │ Himpunan URL yang diterima L-1 adalah subset ketat dari yang diterima _on_project. Tidak ada perluasan                                                  │
├─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ String kanonik                          │ "https://flow.google.com/project/" + project_id                                                                                                         │
├─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Byte yang di-hash                       │ UTF-8 dari string kanonik                                                                                                                               │
├─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Digest                                  │ SHA-256, 64 karakter heksadesimal huruf kecil, disimpan sebagai url_digest                                                                              │
├─────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Pemeriksaan pre/post                    │ String mentah dalam memori harus sama. Tidak disimpan                                                                                                   │
└─────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Status runtime: kontrak URL ini tidak tervalidasi di runtime. Bentuk URL Flow yang sebenarnya: DEFERRED ke LIVE-OBS-3.

L1.6 Algoritma akuisisi tepercaya (urutan R3/L1-R2, PROPOSAL)

acquire_trusted_balance(adapter):        # only GoogleFlowAgentAdapter (exact type)
  0. if provenance._faulted: raise ProvenanceRegistryError          # R-2 §4 step 0
  1. PRE-CHECK:
       adapter._on_project()                                        # existing, adapter.py:69-71
       view = TrustedFrameView(adapter.page)                        # frame_pre = page.main_frame (internal)
       is_main, not detached, url() matches L1.5,
       doc_pre = document_identity(), fp_pre = fingerprint (vetted, without interaction)
       fp_pre == expected fingerprint (OD-5)           else SourceEvidenceError
     t_mono = _monotonic()                                          # R-2 §4 step 1
  2. SNAPSHOT: text = view.body_aria_snapshot()
  3. PARSE + CLASSIFY: reading = read_from_tree(parse(text))
  4. POST-CHECK: page.main_frame is frame_pre (OD-31, UNVERIFIED), is_main, not detached,
       url() == url_pre, document_identity() == doc_pre, fingerprint == fp_pre
       otherwise SourceEvidenceError (nothing registered)
  5. REGISTER (under _lock, R-2 §4 step 5): FAULTED check, _sweep,
       _register(reading, t_mono, SourceEvidence(kind=TRUSTED_LIVE, ...))
       only for VERIFIED_WITHOUT_INTERACTION (R-2, unchanged)

Invariant: registrasi hanya terjadi setelah langkah 1–4 berhasil.

Identitas frame (R3-2, OD-31):
- page.main_frame is frame_pre adalah UNVERIFIED. Belum terbukti bahwa Playwright Python mengembalikan objek yang sama untuk main frame yang sama.
- Perilaku gagal tertutup: bila pemeriksaan identitas bernilai False, akuisisi ditolak. Bila objek ternyata tidak stabil, sistem selalu menolak. Hasilnya tidak bisa dipakai, tetapi tetap aman.
- Pemeriksaan ini tidak pernah menjadi bukti tunggal. Ia selalu digabung dengan kesamaan URL dan kesamaan identitas dokumen.
- Juga UNVERIFIED: apakah objek main frame tetap sama setelah navigasi lintas dokumen. Kalau ya, identitas objek saja tidak akan mendeteksi navigasi. Itu sebabnya document_identity wajib.
- Bukti yang dibutuhkan untuk menutup OD-31:
  - (a) code review sumber Playwright pada versi yang di-pin;
  - (b) tes dengan browser sungguhan (bukan Flow) di fase terpisah yang diizinkan;
  - (c) untuk perilaku di Flow sendiri, observasi live (DEFERRED).

L1.7 Binding saat authorize (A4 dan A5; PROPOSAL; CC-4 dan CC-6)

Di dalam provenance.authorize(reading, *, adapter, wall_clock_verified, evaluate_gate), setelah langkah R-2 untuk UNREGISTERED dan sebelum MUTATED (langkah 3b):

1. Bila adapter berkelas live (type(adapter) is GoogleFlowAgentAdapter, OD-7): wajib entry.evidence.kind is TRUSTED_LIVE, adapter_ref() is adapter, dan page_ref() is adapter.page.
2. Bila adapter bukan kelas live: TRUSTED_LIVE maupun TEST diterima. Bila adapter_ref ada, ia harus is adapter (OD-6).
3. Validasi ulang URL (OD-8): adapter.page.url harus memenuhi L1.5, dan digest-nya sama dengan url_digest. Error saat membaca URL diteruskan.
4. Bila gagal: finding SOURCE_MISMATCH (OD-9). Reading tidak dikonsumsi, karena urutan R-2 tetap: finding dikembalikan sebelum konsumsi. Callback tidak dijalankan.

L1.8 Mode kegagalan

┌─────────────────────────────────────────────┬───────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬──────────┬──────────┐
│                  Kegagalan                  │  Tempat   │                                                       Hasil                                                       │ FAULTED  │ Approval │
├─────────────────────────────────────────────┼───────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┼──────────┤
│ Pre-check gagal (URL, frame, dokumen,       │ akuisisi  │ SourceEvidenceError, lalu AdapterError("SOURCE_UNVERIFIED") atau "IDENTITY_MISMATCH", lalu manual lewat jalur     │ tidak    │ tidak    │
│ fingerprint)                                │           │ AdapterError yang ada                                                                                             │          │          │
├─────────────────────────────────────────────┼───────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┼──────────┤
│ Exception dari Playwright                   │ akuisisi  │ diteruskan (AMB-1)                                                                                                │ tidak    │ tidak    │
├─────────────────────────────────────────────┼───────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┼──────────┤
│ Post-check gagal                            │ akuisisi  │ SourceEvidenceError, tidak ada registrasi                                                                         │ tidak    │ tidak    │
├─────────────────────────────────────────────┼───────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┼──────────┤
│ Registry FAULTED                            │ akuisisi  │ ProvenanceRegistryError (R-2)                                                                                     │ ya,      │ tidak    │
│                                             │           │                                                                                                                   │ sudah    │          │
├─────────────────────────────────────────────┼───────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────┼──────────┤
│ Binding atau URL gagal saat authorize       │ authorize │ finding SOURCE_MISMATCH, lalu Tx-BLOCK                                                                            │ tidak    │ tidak    │
└─────────────────────────────────────────────┴───────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────┴──────────┘

Catatan untuk jalur AdapterError: FACT, runner mengarahkannya ke manual (src/blatifa/production/runner.py:39-44, :106). Apakah reject() dipanggil di jalur itu: NOT ESTABLISHED — REQUIRES DECISION OR EVIDENCE. Bila tidak dipanggil, dialog tetap terbuka dan reconcile berakhir di MANUAL ("user must Reject it", src/blatifa/production/reconcile.py:99-100). Itu konservatif.

L1.9 Kompatibilitas SimulatedFlow dan FakeFlow

- SimulatedFlow dengan int persis: langkah 0 gates tidak berubah. Tidak ada evidence.
- FakeFlow: jalur TEST lewat acquire_balance(page) yang lama (perilakunya tidak berubah), ditambah binding adapter_ref (OD-6, CC-8). Reading TEST tidak pernah bisa mengotorisasi adapter kelas live.

L1.10 Kode publik

- OD-9: Opsi 1 adalah BALANCE_READING_SOURCE_MISMATCH di prioritas 3 (CC-5, CHANGE CONTROL REQUIRED). Opsi 2 memetakannya ke BALANCE_READING_UNREGISTERED.
- PAUSE_BLOCKS tidak berubah dalam kedua opsi.

---

C. Spesifikasi L-2: Cross-Process Budget Coordination

L2.0 Cakupan

- Cakupan: B1, B2, B3, B4, B5, B7.
- Ditolak: B6 (expiry otomatis) dan B8 (coordinator).
- Di luar cakupan: koordinasi antar-mesin.
- Diputuskan: satu proses aplikasi per workspace; proses kedua menerima WorkspaceLockedError.

L2.1 Baseline (FACT)

┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────┐
│                                                                    Fakta                                                                    │                        Bukti                        │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ _tx: BEGIN IMMEDIATE; rollback hanya bila exception terjadi di dalam body; COMMIT berada di luar blok try, sehingga kegagalan COMMIT tidak  │ src/blatifa/persistence/store.py:284-291            │
│ di-rollback                                                                                                                                 │                                                     │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ ledger_write dan transition masing-masing membuka transaksinya sendiri                                                                      │ store.py:323-343, :350-356                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ credit_ledger.quoted_cost tanpa CHECK; tabel append-only                                                                                    │ store.py:55-62, :197-200                            │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ sqlite3.connect(path, isolation_level=None) tanpa timeout dan tanpa busy_timeout                                                            │ store.py:269                                        │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ SCHEMA_VERSION = 1; foreign_keys=ON                                                                                                         │ store.py:24, :274                                   │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ Path DB untuk simulasi berasal dari _simulation_paths, bukan dari path lock workspace                                                       │ src/blatifa/cli.py:333-335                          │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ Penolakan: reject(), lalu ledger REJECTED, lalu _manual(gate.blocks[0]), untuk semua blok termasuk NOT_CONFIRMED_BY_USER                    │ src/blatifa/production/runner.py:200-204            │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ decide(): READY hanya bila tidak maybe_spent; ledger APPROVING, APPROVED atau UNKNOWN berarti maybe_spent                                   │ src/blatifa/production/reconcile.py:26, :66,        │
│                                                                                                                                             │ :93-102                                             │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ AWAITING_COST_CONFIRMATION termasuk FLOW_SIDE dan CREDIT_SENSITIVE. Tidak ada SceneState untuk "approving"                                  │ src/blatifa/production/states.py:35-38              │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────┤
│ Transisi AWAITING_COST_CONFIRMATION hanya ke RENDERING atau NEEDS_MANUAL_INTERVENTION, ditambah RECONCILING / PAUSED / CANCELLED            │ states.py:46, :66-73                                │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────┘

L2.2 Dua besaran budget

1. Saldo aktual Flow: hanya diketahui dari reading L-1 dan R-2 pada satu titik waktu. L-2 tidak mengklaim mengetahuinya, dan saldo di UI tidak dianggap selalu segar (OD-11).
2. Budget reservasi lokal: cap per grant per account_id. Hanya membatasi pengeluaran lewat Blatifa di DB yang sama.

L2.3 Skema konseptual (PROPOSAL, CC-11)

CREATE TABLE budget_grant (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  cap <TYPE: OD-27> NOT NULL,          -- DECIDED: explicit, NOT NULL, no DEFAULT.
                                       -- OPEN (OD-27): data type, representation, range CHECK.
  expected_fingerprint TEXT NOT NULL,  -- OD-5
  granted_by TEXT NOT NULL CHECK (granted_by = 'user'),
  opened_at TEXT NOT NULL, closed_at TEXT,
  UNIQUE (id, account_id)
);
CREATE UNIQUE INDEX budget_grant_one_open ON budget_grant(account_id) WHERE closed_at IS NULL;
CREATE UNIQUE INDEX scene_attempt_id_account ON scene_attempt(id, account_id);

CREATE TABLE budget_reservation (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE,   -- attempt_id ':' preparation nonce
  attempt_id TEXT NOT NULL UNIQUE,        -- one reservation per attempt for its lifetime (OD-16)
  grant_id TEXT NOT NULL,
  account_id TEXT NOT NULL,
  quoted_cost INTEGER NOT NULL,           -- range CHECK: OD-27 (not decided here)
  observed_balance INTEGER NOT NULL,      -- range CHECK: OD-27
  evidence_digest TEXT NOT NULL,
  owner_token TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('RESERVED','APPROVING','UNKNOWN','COMMITTED','RELEASED','RELEASED_BY_USER')),
  block_code TEXT,                        -- cause when RELEASED (R3-8)
  created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  FOREIGN KEY (grant_id, account_id)   REFERENCES budget_grant(id, account_id),
  FOREIGN KEY (attempt_id, account_id) REFERENCES scene_attempt(id, account_id)
);
CREATE UNIQUE INDEX budget_one_active_per_account ON budget_reservation(account_id)
  WHERE state IN ('RESERVED','APPROVING','UNKNOWN');
CREATE TABLE reservation_event (id INTEGER PRIMARY KEY AUTOINCREMENT, reservation_id TEXT NOT NULL,
  from_state TEXT, to_state TEXT NOT NULL, reason TEXT NOT NULL, at TEXT NOT NULL);
-- triggers: no DELETE on budget_reservation; UPDATE only along L2.4; reservation_event append-only

Migrasi v1 ke v2: satu transaksi, aditif saja (tabel baru, indeks unik baru di scene_attempt, trigger, schema_info dinaikkan). Tidak ada backfill. Ledger lama berada di luar semua grant.

Cap (R3-4):
- Sudah diputuskan:
  - cap harus diberikan eksplisit dan bisa dikonfigurasi;
  - kolomnya NOT NULL tanpa DEFAULT;
  - API pembuatan grant tidak punya nilai default;
  - grant hanya dibuat oleh perintah pengguna.
- OPEN (OD-27): tipe, representasi, validasi dan rentang. Tidak ada minimum, maksimum, maupun default.
- Konsekuensi teknis bila tidak ada CHECK rentang (sekadar penjelasan, bukan kebijakan):
  - Cap 0: dengan aturan used + cost ≤ cap, setiap reservasi dengan cost positif tertolak, jadi grant efektif tidak bisa dipakai.
  - Cap negatif: semua reservasi tertolak, dan nilainya tidak bermakna secara semantik.
  - Cost 0 atau negatif bisa membuat perhitungan used menyesatkan.
  - Mengizinkan atau menolak nilai-nilai ini adalah keputusan pengguna (OD-27).

L2.4 Mesin state reservasi

mermaid
stateDiagram-v2
  [*] --> RESERVED: Tx-RESERVE
  RESERVED --> APPROVING: Tx-ENTER
  RESERVED --> RELEASED: Tx-BLOCK / Startup
  APPROVING --> COMMITTED: Tx-COMMIT / Tx-REC-FOUND
  APPROVING --> UNKNOWN: Tx-REC-UNKNOWN
  UNKNOWN --> COMMITTED: Tx-REC-FOUND
  UNKNOWN --> RELEASED_BY_USER: manual only (OD-20)

- Aktif: RESERVED, APPROVING, UNKNOWN.
- Dihitung sebagai terpakai: state aktif ditambah COMMITTED.
- Tidak ada expiry berbasis waktu.
- FACT: reconcile tidak pernah bisa membuktikan "tidak terpakai" bila ledger APPROVING. Karena itu tidak ada pelepasan otomatis dari APPROVING maupun UNKNOWN.

L2.5 Busy timeout dan klasifikasi error

Timeout (OD-12 CLOSED, OD-25 CLOSED):
- Nilainya sqlite3.connect(path, timeout=5.0, isolation_level=None) ditambah PRAGMA busy_timeout=5000 untuk setiap koneksi Store.
- Nilai itu dibaca ulang segera setelah koneksi dibuka. Bila tidak sama dengan 5000: koneksi ditutup dan tidak dipakai; BudgetConfigError(BUSY_TIMEOUT_MISMATCH) dilaporkan; tidak ada fallback dan tidak ada retry. Ini FAIL-CLOSED REQUIREMENT, belum diimplementasikan dan belum diuji.

Klasifikasi error (R3-10, OD-28 OPEN):

┌────────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────┐
│                                  Kondisi                                   │                              Klasifikasi                               │
├────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ sqlite3.OperationalError dengan sqlite_errorcode & 0xFF == SQLITE_BUSY (5) │ BudgetUnavailableError(DB_LOCK_TIMEOUT)                                │
├────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ Primary code SQLITE_LOCKED (6)                                             │ BudgetUnavailableError(DB_LOCKED), kode terpisah                       │
├────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ Atribut sqlite_errorcode tidak ada atau bukan int                          │ Tidak diklasifikasikan. Error diteruskan tanpa diubah                  │
├────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ Kode lain apa pun                                                          │ Diteruskan tanpa diubah. Tidak pernah dijadikan BudgetUnavailableError │
├────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ DatabaseError lain, KeyboardInterrupt, SystemExit                          │ Diteruskan                                                             │
└────────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────┘

Pencocokan string dilarang sebagai dasar klasifikasi.

Semua error yang diteruskan bersifat gagal tertutup sebelum approval, karena approve() tidak tercapai. Sesudah approval, aturannya ada di Tx-COMMIT.

UNVERIFIED (OD-28):
- (a) bahwa sqlite_errorcode tersedia di Python 3.12. INFERENCE dari dokumentasi, tidak diverifikasi dengan eksekusi;
- (b) kode mana yang dilaporkan untuk busy pada BEGIN IMMEDIATE, COMMIT, dan checkpoint WAL.

Pembedaan dengan konflik aplikasi: DB_LOCK_TIMEOUT dan DB_LOCKED dihasilkan lapisan SQLite. BudgetBusyError, BudgetConflictError, BudgetCapError dan BudgetNoGrantError dihasilkan lapisan aplikasi dan diperiksa di dalam transaksi yang berhasil didapat.

L2.6 Process lock (OD-22 CLOSED; batasan R3-11; OD-14 OPEN)

Desain: fcntl.flock(fd, LOCK_EX | LOCK_NB) pada <workspace>/.blatifa.lock, dipegang selama proses hidup. Gagal mendapat lock berarti WorkspaceLockedError dan proses berhenti. owner_token acak dibuat per proses.

Cakupan jaminan yang jujur: satu proses per workspace hanya dijamin bila semua syarat berikut terpenuhi, dan semuanya masih OPEN:

┌────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│           Risiko           │                                                                              Penjelasan                                                                              │
├────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Lock bersifat advisory     │ Hanya proses yang ikut memanggil flock yang terhalang. Alat eksternal (CLI sqlite3, backup, editor) tidak                                                            │
├────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Path alias dan symlink     │ INFERENCE: flock bekerja di level file yang dibuka. Alias yang menunjuk file yang sama tetap konflik dengan benar. Tetapi BLATIFA_WORKSPACE yang berbeda, atau       │
│                            │ salinan workspace, menghasilkan file lock lain sehingga tidak terkoordinasi                                                                                          │
├────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Dua path ke workspace yang │ APFS yang tidak peka huruf kapital dan firmlink membuat beberapa string path menunjuk direktori yang sama. Itu aman untuk lock, tetapi kanonikalisasi path sebagai   │
│  sama                      │ string tidak bisa dipakai sebagai identitas                                                                                                                          │
├────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ DB dan lock bisa berpisah  │ FACT: path DB simulasi berasal dari _simulation_paths (src/blatifa/cli.py:333-335). Lock di workspace A tidak melindungi DB di path B                                │
├────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Fork                       │ INFERENCE: lock pada open file description ikut diwarisi child. Child yang masih hidup tetap memegang lock setelah parent mati                                       │
├────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Network FS dan folder      │ Semantik flock di NFS, SMB, iCloud atau Dropbox UNVERIFIED. Bisa saja lokal-only atau diemulasi. Sinkronisasi bisa menyalin DB ke mesin lain (di luar cakupan)       │
│ sinkron                    │                                                                                                                                                                      │
├────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Lock bukan bukti identitas │ Lock hanya membuktikan "tidak ada pemegang lain untuk file lock ini". Lock tidak membuktikan bahwa DB yang dibuka adalah DB kanonik untuk akun itu                   │
│  workspace                 │                                                                                                                                                                      │
└────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

PROPOSAL untuk OD-14 (OPEN):
- Lock file dan DB berada di direktori yang sama.
- DB menyimpan (st_dev, st_ino) direktori workspace. Saat dibuka, nilainya dicocokkan dengan direktori lock; bila tidak cocok, proses ditolak.
- Path di bawah folder sinkron atau FS non-lokal ditolak. Cara deteksinya UNVERIFIED (U-5).

Sifat keamanan yang tidak bergantung pada lock:
- Melepas RESERVED saat startup tetap aman walaupun lock gagal. Tx-ENTER mensyaratkan state='RESERVED', jadi pemilik yang ternyata masih hidup akan gagal di CAS dan tidak melakukan approval.
- Atomisitas reservasi di DB (L2.8 B) juga tidak bergantung pada lock.

L2.7 Spesifikasi transaksi

Semua transaksi memakai satu BEGIN IMMEDIATE. "Atomik" hanya berlaku untuk record yang benar-benar dimutasi oleh transaksi itu.

Catatan umum untuk kegagalan COMMIT (OD-29 OPEN): FACT, _tx tidak me-rollback bila COMMIT gagal. PROPOSAL (CC-14):
- bila COMMIT gagal, coba ROLLBACK sekali, lalu tandai koneksi sebagai tidak dipakai lagi;
- hasil transaksi dianggap INDETERMINATE;
- langkah berikutnya tidak dijalankan.

Tx-RESERVE

┌──────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│        Aspek         │                                                                                    Isi                                                                                     │
├──────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tujuan               │ Memesan budget untuk satu attempt                                                                                                                                          │
├──────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                      │ Proses memegang lock dan owner_token aktif; reading sudah allowed dan sudah CONSUMED oleh R-2; attempt di AWAITING_COST_CONFIRMATION; attempt.account_id sama dengan akun; │
│ Precondition         │  grant terbuka (cap eksplisit); tidak ada reservasi aktif untuk akun ini; ledger_last(attempt) ∉ SPENT_OR_MAYBE; used + cost ≤ cap; cost ≤ observed_balance −              │
│                      │ policy.reserve; aturan kesegaran OD-11                                                                                                                                     │
├──────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ State sebelum        │ Tidak ada reservasi untuk attempt ini                                                                                                                                      │
├──────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Operasi DB           │ SELECT untuk semua precondition; INSERT reservasi RESERVED; INSERT reservation_event                                                                                       │
├──────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ State sesudah        │ RESERVED                                                                                                                                                                   │
├──────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Efek ledger          │ Tidak ada                                                                                                                                                                  │
├──────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Efek attempt         │ Tidak ada. Attempt hanya precondition                                                                                                                                      │
├──────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Bila gagal           │ Precondition gagal: Budget*Error dan rollback, lalu jalur Tx-BLOCK. Busy: DB_LOCK_TIMEOUT dan rollback, tanpa approval. COMMIT INDETERMINATE: tanpa approval, error        │
│                      │ diteruskan                                                                                                                                                                 │
├──────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Idempotency          │ Key sama, parameter identik, owner sama, dan state RESERVED: baris yang ada dikembalikan, tidak ada baris baru. Selain itu: BudgetConflictError. attempt_id UNIQUE         │
│                      │ mencegah reservasi kedua                                                                                                                                                   │
├──────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Approval mungkin     │ Tidak                                                                                                                                                                      │
│ sudah terjadi?       │                                                                                                                                                                            │
├──────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Kebutuhan reconcile  │ Reservasi RESERVED yatim dilepas saat startup                                                                                                                              │
└──────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Tx-ENTER

┌──────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│            Aspek             │                                                                                Isi                                                                                 │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tujuan                       │ Write-ahead sebelum klik                                                                                                                                           │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Precondition                 │ Reservasi RESERVED dengan owner_token aktif; attempt di AWAITING_COST_CONFIRMATION; ledger_last ∉ SPENT_OR_MAYBE                                                   │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Operasi DB                   │ UPDATE … SET state='APPROVING' WHERE id=? AND state='RESERVED' AND owner_token=? dengan rowcount = 1; INSERT event; INSERT credit_ledger APPROVING                 │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ State sesudah                │ Reservasi APPROVING, ledger APPROVING                                                                                                                              │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Efek attempt                 │ Bergantung pada OD-19, yang OPEN. Di Alt-A (baseline spesifikasi ini) attempt tidak dimutasi dan hanya menjadi precondition. Atomisitas di Alt-A hanya mencakup    │
│                              │ reservasi dan ledger                                                                                                                                               │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Bila gagal                   │ Rowcount ≠ 1: BudgetConflictError dan rollback, lalu Tx-BLOCK. Busy: rollback, tanpa approval, tanpa retry. COMMIT INDETERMINATE: tanpa approval                   │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Idempotency                  │ CAS hanya berhasil satu kali                                                                                                                                       │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Approval mungkin sudah       │ Tidak. approve() hanya dipanggil setelah Tx-ENTER kembali dengan sukses                                                                                            │
│ terjadi?                     │                                                                                                                                                                    │
├──────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Kebutuhan reconcile          │ Bila crash setelah Tx-ENTER: ledger APPROVING berarti maybe_spent, sehingga reconcile tidak pernah menghasilkan READY                                              │
└──────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Alternatif OD-19 (semuanya OPEN, tidak ada yang dipilih):

┌─────┬────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────┐
│ Alt │           Tx-ENTER mengubah attempt?           │                           Crash di antara Tx-ENTER dan approve()                           │                    Dampak                     │
├─────┼────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
│     │                                                │ Attempt tetap AWAITING_COST_CONFIRMATION (FLOW_SIDE), lalu startup memindahkannya ke       │ Tidak ada perubahan states.py. Penanda        │
│ A   │ Tidak (hanya precondition)                     │ RECONCILING. Ledger APPROVING membuat maybe_spent bernilai True, lalu MANUAL /             │ durable-nya adalah ledger dan reservasi,      │
│     │                                                │ Tx-REC-UNKNOWN atau Tx-REC-FOUND                                                           │ bukan attempt                                 │
├─────┼────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
│     │ Ya: SceneState baru APPROVING (AWAITING →      │ Attempt APPROVING (harus termasuk FLOW_SIDE dan CREDIT_SENSITIVE), lalu RECONCILING dengan │ Butuh CC-13: perubahan pada states.py dan     │
│ B   │ APPROVING, plus state_event)                   │  resume_to=APPROVING. decide() harus memperlakukan APPROVING sebagai maybe_spent           │ reconcile.py:66. Atomisitas mencakup ketiga   │
│     │                                                │                                                                                            │ record                                        │
├─────┼────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────┤
│ C   │ Ya: kolom attempt baru (misalnya               │ Sama dengan A, ditambah penanda yang eksplisit                                             │ Perubahan skema scene_attempt dan _FIELDS.    │
│     │ approving_reservation_id), state tidak berubah │                                                                                            │ Atomisitas mencakup ketiga record             │
└─────┴────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────┴───────────────────────────────────────────────┘

Tx-COMMIT

┌────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│         Aspek          │                                                                                   Isi                                                                                    │
├────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tujuan                 │ Mencatat approval yang berhasil                                                                                                                                          │
├────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Precondition           │ approve() kembali normal; reservasi APPROVING dengan owner aktif; ledger terakhir APPROVING; attempt AWAITING_COST_CONFIRMATION (Alt-A)                                  │
├────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Operasi DB             │ Reservasi APPROVING menjadi COMMITTED (CAS); event; ledger APPROVED; attempt menjadi RENDERING lewat assert_transition plus state_event                                  │
├────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ State sesudah          │ COMMITTED, ledger APPROVED, attempt RENDERING. Ketiga record benar-benar dimutasi secara atomik                                                                          │
├────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Bila gagal             │ Lihat R3-5. Approval mungkin sudah berhasil. Tidak ada retry approve(), tidak ada retry Tx-COMMIT otomatis, dan tidak dianggap commit berhasil. Rollback atau            │
│                        │ INDETERMINATE membuat record tetap di (AWAITING, ledger APPROVING, reservasi APPROVING). Error diteruskan ke atas, lalu reconcile                                        │
├────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Idempotency            │ CAS dari APPROVING                                                                                                                                                       │
├────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Approval mungkin sudah │ Ya                                                                                                                                                                       │
│  terjadi?              │                                                                                                                                                                          │
├────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Kebutuhan reconcile    │ Wajib bila gagal                                                                                                                                                         │
└────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Tx-BLOCK (R3-8)

┌───────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│         Aspek         │                                                                                    Isi                                                                                    │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tujuan                │ Mencatat penolakan sebelum approval, setelah adapter.reject() kembali normal (urutan sesuai runner.py:201-204)                                                            │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Precondition          │ Tidak ada APPROVING untuk attempt ini; ledger_last ∉ SPENT_OR_MAYBE; reservasi tidak ada atau RESERVED dengan owner aktif                                                 │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Operasi DB            │ Ledger REJECTED; reservasi RESERVED menjadi RELEASED (bila ada) dengan block_code; attempt menjadi NEEDS_MANUAL_INTERVENTION dengan error_code = block_code dan resume_to │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Semantik REJECTED     │ Dipertahankan seperti sekarang (FACT): artinya "reject() dipanggil untuk penolakan apa pun". Ini bukan berarti pengguna menolak                                           │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Penyebab              │ Dicatat terpisah di block_code, reservation_event.reason dan attempt.error_code: NOT_CONFIRMED_BY_USER (pengguna menolak), kode BALANCE_READING_* dan SOURCE_MISMATCH     │
│                       │ (provenance), blok gate lain (safety), BUDGET_CAP, BUDGET_NO_GRANT, RESERVATION_ACTIVE, RESERVATION_CONFLICT, DB_LOCK_TIMEOUT, DB_LOCKED                                  │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Outcome ledger yang   │ OPEN (OD-26)                                                                                                                                                              │
│ lebih rinci           │                                                                                                                                                                           │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Bila gagal            │ Busy atau INDETERMINATE: reject() sudah dipanggil, record tetap di (AWAITING, tanpa ledger, RESERVED atau tanpa reservasi), error diteruskan. Startup melepas reservasi   │
│                       │ yatim, lalu RECONCILING. Bila reject() sendiri melempar error (adapter live: BlockedOperationError), Tx-BLOCK tidak dijalankan dan state tetap sah                        │
├───────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Approval mungkin      │ Tidak                                                                                                                                                                     │
│ sudah terjadi?        │                                                                                                                                                                           │
└───────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Tx-REC-UNKNOWN

┌────────────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│           Aspek            │                                                                                 Isi                                                                                  │
├────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Precondition               │ Attempt RECONCILING; decide() menghasilkan NEEDS_MANUAL_INTERVENTION; ledger terakhir APPROVING                                                                      │
├────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Operasi DB                 │ Ledger UNKNOWN_AFTER_CRASH; reservasi APPROVING menjadi UNKNOWN (bila ada; baris lama mungkin tidak punya reservasi); attempt menjadi NEEDS_MANUAL_INTERVENTION      │
│                            │ (RECONCILE_UNRESOLVED atau MEDIA_ID_UNRESOLVED)                                                                                                                      │
├────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Variasi                    │ Ledger sudah UNKNOWN_AFTER_CRASH (reconcile berulang): hanya attempt yang menjadi MANUAL; tidak ada baris ledger baru (konsisten dengan runner.py:330); reservasi    │
│                            │ tetap UNKNOWN                                                                                                                                                        │
├────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Bila gagal                 │ Rollback. Attempt tetap RECONCILING dan reconcile diulang nanti                                                                                                      │
├────────────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Approval mungkin sudah     │ Mungkin. Tidak pernah diulang                                                                                                                                        │
│ terjadi?                   │                                                                                                                                                                      │
└────────────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Tx-REC-FOUND (R3-7)

┌─────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                        Aspek                        │                                                                     Isi                                                                     │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ State awal yang diizinkan                           │ Attempt RECONCILING; ledger terakhir ∈ {APPROVING, UNKNOWN_AFTER_CRASH}; reservasi ∈ {APPROVING, UNKNOWN}, atau tidak ada untuk baris lama  │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Bukti yang wajib ada (FACT, reconcile.py:61-91)     │ obs.inspected_ok; tepat satu tile baru dibanding pre_submit_media; maybe_spent bernilai True; tile.failed False; tile.state_known True      │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tujuan RENDERING                                    │ Tile belum complete (reconcile.py:91)                                                                                                       │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tujuan COMPLETED                                    │ tile.complete dan media_id tidak kosong (reconcile.py:88-90)                                                                                │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Operasi DB                                          │ Ledger APPROVED (semantik yang ada, runner.py:334-335: "approval mendarat"); reservasi menjadi COMMITTED; attempt menjadi RENDERING atau    │
│                                                     │ COMPLETED (plus flow_media_id)                                                                                                              │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Batas makna                                         │ RENDERING tidak berarti render pasti selesai. Atribusi tile ke approval ini juga INFERENCE: tile dari pemakaian manual tidak bisa dibedakan │
│                                                     │  (batasan 4)                                                                                                                                │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Ambigu atau tidak lengkap (MANUAL, lewat            │ Lebih dari satu tile; tile gagal (apakah kredit terpakai: NOT ESTABLISHED, jadi reservasi tetap UNKNOWN); state tile tidak dikenali setelah │
│ Tx-REC-UNKNOWN bila ledger APPROVING)               │  grace; complete tanpa media_id; inspected_ok False; tile baru padahal tidak ada yang di-approve                                            │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Bukti bertentangan                                  │ decide() menghasilkan DOWNLOADED (file lokal ada) atau COMPLETED lewat flow_media_id yang sudah ada, padahal reservasi belum COMMITTED.     │
│                                                     │ PROPOSAL: dianggap tidak konsisten, lalu MANUAL tanpa mutasi reservasi. OPEN (OD-26)                                                        │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Bukti saldo                                         │ Tidak dipakai sebagai bukti sukses                                                                                                          │
└─────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Startup recovery

┌──────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│    Aspek     │                                                                                        Isi                                                                                         │
├──────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Urutan       │ (1) Dapatkan lock; gagal berarti WorkspaceLockedError. (2) Buka DB dan cek ulang timeout (OD-25). (3) Satu transaksi per reservasi: RESERVED milik token lain menjadi RELEASED     │
│              │ (owner_not_current). (4) startup_scan yang ada (store.py:695-702)                                                                                                                  │
├──────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tidak        │ APPROVING dan UNKNOWN                                                                                                                                                              │
│ disentuh     │                                                                                                                                                                                    │
├──────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Keamanan     │ Langkah (3) aman walaupun lock gagal (L2.6)                                                                                                                                        │
├──────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Bila gagal   │ Error diteruskan. Tidak ada operasi Flow sebelum recovery selesai                                                                                                                  │
└──────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

L2.8 Jaminan konkurensi (R3/L2-R1)

┌──────────────────────────┬───────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────┐
│         Lapisan          │                                  Jaminan                                  │                                           Batas                                            │
├──────────────────────────┼───────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────┤
│ A. Eksklusivitas         │ Satu proses aplikasi per workspace; proses kedua menerima                 │ Hanya dalam cakupan L2.6. Tidak berlaku lintas salinan workspace, lintas mesin, atau di FS │
│ aplikasi                 │ WorkspaceLockedError                                                      │  yang semantiknya tidak sesuai                                                             │
├──────────────────────────┼───────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────┤
│ B. Atomisitas reservasi  │ Compare-and-reserve dan CAS serial di bawah BEGIN IMMEDIATE; indeks unik  │ Hanya untuk koneksi ke file DB yang sama                                                   │
│ di DB                    │ parsial; idempotency                                                      │                                                                                            │
└──────────────────────────┴───────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────┘

Spesifikasi ini tidak mengklaim aplikasi mendukung banyak instance sekaligus, dan tidak mengklaim keamanan multi-mesin.

L2.9 Jendela crash

┌─────┬───────────────────────┬─────────────────────────────────────┬───────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────┐
│  #  │      Titik crash      │            State durable            │                           Pemulihan                           │                       Approval kedua?                        │
├─────┼───────────────────────┼─────────────────────────────────────┼───────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│     │                       │                                     │ Startup: RECONCILING. Ledger tidak termasuk maybe_spent, jadi │                                                              │
│ 1   │ Sebelum Tx-RESERVE    │ (AWAITING, –, –); reading hilang    │  decide bergantung pada pending_confirmation (MANUAL bila     │ Tidak                                                        │
│     │                       │                                     │ masih terbuka)                                                │                                                              │
├─────┼───────────────────────┼─────────────────────────────────────┼───────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 2   │ Setelah Tx-RESERVE    │ (AWAITING, –, RESERVED)             │ Startup: RELEASED, lalu seperti #1                            │ Tidak                                                        │
├─────┼───────────────────────┼─────────────────────────────────────┼───────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│     │                       │                                     │                                                               │ Tidak: Tx-RESERVE menolak (SPENT_OR_MAYBE, attempt_id        │
│ 3   │ Setelah Tx-ENTER      │ (AWAITING, APPROVING, APPROVING)    │ RECONCILING; maybe_spent; Tx-REC-UNKNOWN atau Tx-REC-FOUND    │ UNIQUE); Tx-ENTER mensyaratkan RESERVED; B3 memblokir        │
│     │                       │                                     │                                                               │ attempt lain untuk akun ini                                  │
├─────┼───────────────────────┼─────────────────────────────────────┼───────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 4   │ Tepat sebelum         │ Sama dengan #3                      │ Sama                                                          │ Sama                                                         │
│     │ approve()             │                                     │                                                               │                                                              │
├─────┼───────────────────────┼─────────────────────────────────────┼───────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 5   │ Saat approve()        │ Sama dengan #3                      │ Sama                                                          │ Sama                                                         │
│     │ berlangsung           │                                     │                                                               │                                                              │
├─────┼───────────────────────┼─────────────────────────────────────┼───────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 6   │ Setelah approve(),    │ Sama dengan #3                      │ Sama                                                          │ Sama                                                         │
│     │ sebelum Tx-COMMIT     │                                     │                                                               │                                                              │
├─────┼───────────────────────┼─────────────────────────────────────┼───────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│     │ Tx-COMMIT timeout     │ Sama dengan #3 (atau sudah          │                                                               │ Sama. Dalam proses yang sama pun jalur approval mensyaratkan │
│ 7   │ atau INDETERMINATE    │ committed bila INDETERMINATE        │ Error diteruskan; tidak ada retry; startup lalu reconcile     │  Tx-RESERVE baru, yang pasti ditolak                         │
│     │                       │ ternyata berhasil)                  │                                                               │                                                              │
├─────┼───────────────────────┼─────────────────────────────────────┼───────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────┤
│ 8   │ Saat reconcile        │ Attempt RECONCILING (bukan          │ Reconcile diulang. Tx-REC-* atomik. Observasi bersifat        │ Tidak. Reconcile tidak pernah memanggil approve()            │
│     │ berlangsung           │ FLOW_SIDE, jadi tetap di sana)      │ read-only                                                     │                                                              │
└─────┴───────────────────────┴─────────────────────────────────────┴───────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────┘

Urutan operasi:
1. Akuisisi tepercaya.
2. Gate pendahuluan.
3. confirm.
4. authorize_approval.
5. Tx-RESERVE.
6. Tx-ENTER.
7. approve().
8. Tx-COMMIT.

Tidak ada approval bila langkah 1, 4, 5 atau 6 gagal. Tidak ada retry approval otomatis.

L2.10 Intervensi manual

Intervensi manual wajib untuk:
- UNKNOWN (OD-20);
- kegagalan Tx-COMMIT;
- konflik idempotency;
- cap tercapai;
- belum ada grant;
- saldo belum diperbarui (OD-11);
- BUSY_TIMEOUT_MISMATCH;
- workspace tidak kanonik (OD-14).

---

D. Open Decision Register

Kolom terakhir menunjukkan siapa atau apa yang menutup keputusan: U = keputusan pengguna, CR = code review, T = tes offline, L = observasi live.

OD: OD-1
Topik: Normalisasi host
Status: OPEN
Keputusan yang ada: —
Yang belum diputuskan: Usulan literal persis (L1.5)
Dependensi: A1
Risiko bila terbuka: Bisa salah tolak atau salah terima
Bukti untuk menutup: Persetujuan; LIVE-OBS-3
Penutup: U, L
────────────────────────────────────────
OD: OD-2
Topik: Path, query, fragment, garis miring
Status: OPEN
Keputusan yang ada: —
Yang belum diputuskan: Usulan: semuanya ditolak
Dependensi: A1, LIVE-OBS-3
Risiko bila terbuka: Salah tolak bila Flow memakai query
Bukti untuk menutup: LIVE-OBS-3
Penutup: U, L
────────────────────────────────────────
OD: OD-3
Topik: Identitas dokumen
Status: DEFERRED
Keputusan yang ada: —
Yang belum diputuskan: timeOrigin + URL cukup atau tidak
Dependensi: U-2
Risiko bila terbuka: Navigasi SPA tidak terdeteksi
Bukti untuk menutup: LIVE-OBS-2
Penutup: L, U
────────────────────────────────────────
OD: OD-4
Topik: Pembatasan snapshot ke main frame
Status: DEFERRED
Keputusan yang ada: —
Yang belum diputuskan: Apakah iframe masuk snapshot
Dependensi: U-1
Risiko bila terbuka: Teks iframe ikut terbaca
Bukti untuk menutup: LIVE-OBS-1
Penutup: L, U
────────────────────────────────────────
OD: OD-5
Topik: Fingerprint yang diharapkan
Status: OPEN
Keputusan yang ada: —
Yang belum diputuskan: Sumber dan cara penetapan
Dependensi: Skema grant
Risiko bila terbuka: Akun salah
Bukti untuk menutup: Keputusan
Penutup: U
────────────────────────────────────────
OD: OD-6
Topik: adapter_ref untuk TEST
Status: OPEN
Keputusan yang ada: —
Yang belum diputuskan: Wajib atau opsional
Dependensi: CC-8
Risiko bila terbuka: Tes tidak membuktikan binding
Bukti untuk menutup: Keputusan; tes
Penutup: U, T
────────────────────────────────────────
OD: OD-7
Topik: Kelas adapter live
Status: OPEN
Keputusan yang ada: —
Yang belum diputuskan: Daftarnya
Dependensi: CC-4
Risiko bila terbuka: Adapter baru lolos tanpa terdeteksi
Bukti untuk menutup: Keputusan; static
Penutup: U, CR
────────────────────────────────────────
OD: OD-8
Topik: Validasi ulang URL saat authorize
Status: OPEN
Keputusan yang ada: —
Yang belum diputuskan: Ya atau tidak
Dependensi: CC-6
Risiko bila terbuka: Navigasi setelah akuisisi tidak terdeteksi
Bukti untuk menutup: Keputusan
Penutup: U
────────────────────────────────────────
OD: OD-9
Topik: Kode publik L-1
Status: OPEN
Keputusan yang ada: —
Yang belum diputuskan: Opsi 1 atau 2
Dependensi: CC-5
Risiko bila terbuka: Diagnosis kabur
Bukti untuk menutup: Keputusan
Penutup: U
────────────────────────────────────────
OD: OD-10
Topik: Nilai cap
Status: OPEN
Keputusan yang ada: Cap eksplisit, bisa dikonfigurasi, tanpa default
Yang belum diputuskan: Nilainya
Dependensi: Grant
Risiko bila terbuka: Tanpa nilai tidak ada grant, jadi tidak ada approval (gagal tertutup)
Bukti untuk menutup: Keputusan
Penutup: U
────────────────────────────────────────
OD: OD-11
Topik: Saldo di UI belum diperbarui
Status: OPEN
Keputusan yang ada: —
Yang belum diputuskan: Aturan kesegaran
Dependensi: U-3
Risiko bila terbuka: Reservasi memakai saldo basi
Bukti untuk menutup: Keputusan. U-3 tidak bisa dijawab tanpa kredit
Penutup: U
────────────────────────────────────────
OD: OD-12
Topik: Busy timeout
Status: CLOSED
Keputusan yang ada: 5000 ms
Yang belum diputuskan: —
Dependensi: L2.5
Risiko bila terbuka: —
Bukti untuk menutup: —
Penutup: —
────────────────────────────────────────
OD: OD-13
Topik: Pemilihan tab di engine.py
Status: OPEN
Keputusan yang ada: —
Yang belum diputuskan: Masuk cakupan atau tidak
Dependensi: —
Risiko bila terbuka: Tab salah (L-1 tetap menolak)
Bukti untuk menutup: Keputusan
Penutup: U
────────────────────────────────────────
OD: OD-14
Topik: Workspace kanonik dan FS
Status: OPEN
Keputusan yang ada: —
Yang belum diputuskan: Kontrak identitas dan cakupan FS
Dependensi: L2.6, U-5
Risiko bila terbuka: Lock tidak efektif
Bukti untuk menutup: Keputusan; CR; T
Penutup: U, CR, T
────────────────────────────────────────
OD: OD-15
Topik: Pemakaian manual di browser
Status: OPEN
Keputusan yang ada: Dinyatakan di luar jaminan (batasan 4)
Yang belum diputuskan: Kebijakan operasional
Dependensi: —
Risiko bila terbuka: Tile dan saldo tertukar
Bukti untuk menutup: Keputusan
Penutup: U
────────────────────────────────────────
OD: OD-16
Topik: Satu reservasi per attempt
Status: OPEN
Keputusan yang ada: —
Yang belum diputuskan: Konfirmasi
Dependensi: Skema
Risiko bila terbuka: —
Bukti untuk menutup: Keputusan
Penutup: U
────────────────────────────────────────
OD: OD-17
Topik: reject() di jalur blokir
Status: OPEN
Keputusan yang ada: Semantik yang ada dipertahankan (FACT)
Yang belum diputuskan: Konfirmasi
Dependensi: Tx-BLOCK
Risiko bila terbuka: —
Bukti untuk menutup: Keputusan
Penutup: U
────────────────────────────────────────
OD: OD-18
Topik: Observasi live read-only
Status: DEFERRED
Keputusan yang ada: Tidak diizinkan
Yang belum diputuskan: Izin, cakupan, akun
Dependensi: OD-1–4, OD-31
Risiko bila terbuka: U-1 dan U-2 tetap terbuka
Bukti untuk menutup: Persetujuan terpisah
Penutup: U
────────────────────────────────────────
OD: OD-19
Topik: Penanda durable attempt
Status: OPEN
Keputusan yang ada: —
Yang belum diputuskan: Alt-A, Alt-B atau Alt-C
Dependensi: CC-13
Risiko bila terbuka: Atomisitas di Tx-ENTER hanya untuk reservasi dan ledger
Bukti untuk menutup: Keputusan; CR
Penutup: U, CR
────────────────────────────────────────
OD: OD-20
Topik: Pelepasan manual UNKNOWN
Status: OPEN
Keputusan yang ada: Tidak otomatis
Yang belum diputuskan: Siapa, bukti apa, audit apa
Dependensi: L2.4
Risiko bila terbuka: Budget terkunci tanpa batas waktu (aman, tetapi tidak bisa dipakai)
Bukti untuk menutup: Keputusan
Penutup: U
────────────────────────────────────────
OD: OD-21
Topik: (Tidak dipakai.) Di Revision 2 topik garis miring dan bentuk uuid digabung ke OD-2. Di Revision 3 bentuk uuid dipisah ke OD-30. Nomor ini tidak diberikan ke topik lain
Status: —
Keputusan yang ada: —
Yang belum diputuskan: —
Dependensi: —
Risiko bila terbuka: —
Bukti untuk menutup: —
Penutup: —
────────────────────────────────────────
OD: OD-22
Topik: Process lock
Status: CLOSED
Keputusan yang ada: Satu proses per workspace; WorkspaceLockedError
Yang belum diputuskan: Cakupan jaminan (OD-14)
Dependensi: L2.6
Risiko bila terbuka: —
Bukti untuk menutup: —
Penutup: —
────────────────────────────────────────
OD: OD-23
Topik: TrustedFrameView
Status: OPEN
Keputusan yang ada: Lima operasi tetap (PROPOSAL)
Yang belum diputuskan: Persetujuan desain; teks DOC_IDENTITY_JS
Dependensi: CC-10, OD-31
Risiko bila terbuka: Permukaan API terlalu lebar
Bukti untuk menutup: CR; L1-AC-11–14
Penutup: U, CR, T
────────────────────────────────────────
OD: OD-24
Topik: Bypass lock khusus harness tes
Status: OPEN
Keputusan yang ada: Hanya di tests/
Yang belum diputuskan: Mekanisme; tes AST bahwa src tidak punya bypass
Dependensi: L2-AC-1–3
Risiko bila terbuka: Bypass bocor ke produksi
Bukti untuk menutup: CR; static
Penutup: U, CR
────────────────────────────────────────
OD: OD-25
Topik: Readback busy_timeout tidak sama
Status: CLOSED: FAIL-CLOSED REQUIREMENT
Keputusan yang ada: Koneksi tidak dipakai, operasi dihentikan, tanpa fallback, tanpa retry, dilaporkan
Yang belum diputuskan: — (belum diimplementasi dan belum diuji)
Dependensi: L2.5
Risiko bila terbuka: —
Bukti untuk menutup: L2-AC-14 nanti
Penutup: —
────────────────────────────────────────
OD: OD-26 (baru)
Topik: Pemetaan outcome ledger untuk blok dan bukti yang bertentangan
Status: OPEN
Keputusan yang ada: REJECTED tetap dengan semantik yang ada
Yang belum diputuskan: Apakah perlu outcome terpisah (safety, budget, DB)
Dependensi: Tx-BLOCK, Tx-REC-FOUND; reconcile.py:19-26
Risiko bila terbuka: Audit kabur, walau tidak membahayakan
Bukti untuk menutup: Keputusan
Penutup: U
────────────────────────────────────────
OD: OD-27 (baru)
Topik: Tipe, rentang dan validasi cap, cost, saldo
Status: OPEN
Keputusan yang ada: cap NOT NULL tanpa DEFAULT
Yang belum diputuskan: Tipe; CHECK; perlakuan nol dan negatif
Dependensi: OD-10
Risiko bila terbuka: Nilai tidak bermakna diterima, atau minimum yang dikarang
Bukti untuk menutup: Keputusan
Penutup: U
────────────────────────────────────────
OD: OD-28 (baru)
Topik: Perilaku sqlite_errorcode di runtime
Status: OPEN
Keputusan yang ada: Klasifikasi berbasis kode; fallback diteruskan
Yang belum diputuskan: Ketersediaan dan nilai kode per operasi
Dependensi: L2.5
Risiko bila terbuka: Salah klasifikasi (tetap gagal tertutup)
Bukti untuk menutup: CR stdlib; T
Penutup: CR, T
────────────────────────────────────────
OD: OD-29 (baru)
Topik: Kegagalan COMMIT di _tx
Status: OPEN
Keputusan yang ada: FACT: tidak di-rollback
Yang belum diputuskan: Penanganan INDETERMINATE (CC-14)
Dependensi: Semua Tx
Risiko bila terbuka: Koneksi tertinggal dalam transaksi
Bukti untuk menutup: CR; T
Penutup: U, CR, T
────────────────────────────────────────
OD: OD-30 (baru)
Topik: Format kanonik project id
Status: OPEN
Keputusan yang ada: Regex yang ada bukan validasi UUID kanonik
Yang belum diputuskan: Format yang dibutuhkan; perlu CC atau tidak
Dependensi: L1.5; adapter.py:40
Risiko bila terbuka: Id tidak kanonik diterima di adapter
Bukti untuk menutup: Keputusan; LIVE-OBS-3
Penutup: U, L
────────────────────────────────────────
OD: OD-31 (baru)
Topik: Stabilitas identitas page.main_frame
Status: OPEN (UNVERIFIED)
Keputusan yang ada: Bila gagal, ditolak
Yang belum diputuskan: Apakah stabil, dan apakah tetap sama melewati navigasi
Dependensi: L1.6
Risiko bila terbuka: Selalu menolak (aman tetapi tidak bisa dipakai), atau navigasi tidak terdeteksi bila hanya identitas yang dipakai
Bukti untuk menutup: CR Playwright; tes browser non-Flow; LIVE
Penutup: CR, T, L

---

E. Acceptance Criteria Register

Semua AC berstatus NOT RUN, hanya spesifikasi. Tidak ada yang lulus.

Kode tipe tes: SPEC (review dokumen), STATIC (review kode atau AST), UNIT, DBI (integrasi DB), SUB (subprocess atau konkurensi), LIVE (observasi live).

L-1

┌───────────────┬────────────────────────────────────────────────────────────────────────┬───────────────────┬───────────────────────────────────────────┬────────────────────────┬──────────────┐
│      ID       │                              Requirement                               │   Perilaku aman   │            Perilaku saat gagal            │         Bukti          │     Tipe     │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-1       │ URL kanonik diterima (L1.5)                                            │ Registrasi        │ —                                         │ Page/Frame double      │ UNIT         │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-2       │ URL atau doc_identity berubah antara pre dan post                      │ Tidak ada         │ SourceEvidenceError, tidak FAULTED        │ Double berubah di      │ UNIT         │
│               │                                                                        │ registrasi        │                                           │ dalam snapshot         │              │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-3       │ Frame bukan main, sudah detached, atau fingerprint berbeda             │ Tidak ada         │ SourceEvidenceError                       │ Double                 │ UNIT         │
│               │                                                                        │ registrasi        │                                           │                        │              │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-4       │ Reading TEST dipakai untuk adapter live                                │ Ditolak           │ SOURCE_MISMATCH; callback tidak           │ Double                 │ UNIT         │
│               │                                                                        │                   │ dijalankan; tidak dikonsumsi              │                        │              │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-5       │ Adapter atau page berbeda                                              │ Ditolak           │ Sama dengan L1-AC-4                       │ Double                 │ UNIT         │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-6       │ URL berubah setelah akuisisi (OD-8)                                    │ Ditolak saat      │ Sama                                      │ Double                 │ UNIT         │
│               │                                                                        │ authorize         │                                           │                        │              │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-7       │ Evidence tidak bisa diubah lewat reading; mutasi tetap MUTATED         │ Ditolak           │ —                                         │ Double                 │ UNIT         │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-8       │ _acquire_trusted hanya dipanggil dari GoogleFlowAgentAdapter; tidak    │ —                 │ Tes gagal                                 │ AST                    │ STATIC       │
│               │ ada API terlarang baru                                                 │                   │                                           │                        │              │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-9       │ Register terjadi setelah post-check                                    │ Urutan sesuai     │ —                                         │ Spy berurutan          │ UNIT         │
│               │                                                                        │ L1.6              │                                           │                        │              │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-10      │ Matriks URL non-kanonik (query, fragment, /, huruf kapital, port,      │ Semua ditolak     │ SourceEvidenceError                       │ Tabel kasus            │ UNIT         │
│               │ userinfo, xn--, titik di akhir, id berbeda)                            │                   │                                           │                        │              │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-11      │ Tipe hasil TrustedFrameView salah (bukan bool persis atau bukan str)   │ Ditolak           │ SourceEvidenceError                       │ Double                 │ UNIT         │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-12      │ TrustedFrameView hanya punya lima operasi; tidak ada evaluate/locator  │ —                 │ Tes gagal                                 │ AST dan introspeksi    │ STATIC       │
│ (baru)        │ generik; __getattr__ selalu raise                                      │                   │                                           │                        │              │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-13      │ DOC_IDENTITY_JS berupa konstanta dan hanya membaca                     │ —                 │ Tes gagal                                 │ Review teks, pin hash  │ STATIC, CR   │
│ (baru)        │                                                                        │                   │                                           │                        │              │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-14      │ TrustedFrameView tidak keluar dari acquire_trusted_balance (tidak      │ —                 │ Tes gagal                                 │ AST atau call graph    │ STATIC       │
│ (baru)        │ dikembalikan, tidak disimpan)                                          │                   │                                           │                        │              │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-15      │ page.main_frame mengembalikan objek berbeda saat post-check            │ Ditolak (gagal    │ SourceEvidenceError                       │ Double                 │ UNIT         │
│ (baru)        │                                                                        │ tertutup)         │                                           │                        │              │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ L1-AC-16      │ Regex adapter.py:40 tidak berubah tanpa CC                             │ —                 │ Pin hash                                  │ Integrity chain        │ STATIC       │
│ (baru)        │                                                                        │                   │                                           │                        │              │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ LIVE-OBS-1    │ U-1: iframe di aria_snapshot                                           │ —                 │ —                                         │ Observasi              │ LIVE         │
│               │                                                                        │                   │                                           │                        │ (DEFERRED)   │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ LIVE-OBS-2    │ U-2: timeOrigin dan URL saat navigasi SPA                              │ —                 │ —                                         │ Observasi              │ LIVE         │
│               │                                                                        │                   │                                           │                        │ (DEFERRED)   │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ LIVE-OBS-3    │ Bentuk URL dan id project yang sebenarnya (OD-2, OD-30)                │ —                 │ —                                         │ Observasi              │ LIVE         │
│               │                                                                        │                   │                                           │                        │ (DEFERRED)   │
├───────────────┼────────────────────────────────────────────────────────────────────────┼───────────────────┼───────────────────────────────────────────┼────────────────────────┼──────────────┤
│ LIVE-OBS-5    │ OD-31: stabilitas identitas frame di Flow                              │ —                 │ —                                         │ Observasi              │ LIVE         │
│ (baru)        │                                                                        │                   │                                           │                        │ (DEFERRED)   │
└───────────────┴────────────────────────────────────────────────────────────────────────┴───────────────────┴───────────────────────────────────────────┴────────────────────────┴──────────────┘

LIVE-OBS-4 (U-3 dan U-4) tetap: tidak bisa dijawab tanpa memakai kredit, sehingga ditangani secara konservatif.

L-2

┌─────────────┬───────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────┬──────────────────────────┬─────────────────────┬─────────┐
│     ID      │                              Requirement                              │                 Perilaku aman                  │   Perilaku saat gagal    │        Bukti        │  Tipe   │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-1     │ Lapisan B: N subprocess memanggil lapisan reservasi langsung,         │ Tepat 1 berhasil                               │ N−1 menerima             │ Hitungan baris      │ SUB,    │
│             │ melewati lock khusus untuk tes ini (OD-24), pada akun yang sama       │                                                │ BudgetBusyError          │                     │ DBI     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-2     │ Lapisan B: cap tidak pernah terlampaui di bawah kontensi              │ Jumlah ≤ cap                                   │ BudgetCapError           │ Jumlah              │ SUB,    │
│             │                                                                       │                                                │                          │                     │ DBI     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-3     │ Lapisan B: idempotency key yang sama                                  │ Satu baris, satu CAS                           │ BudgetConflictError      │ Baris dan           │ SUB,    │
│             │                                                                       │                                                │                          │ penghitung FakeFlow │ DBI     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-4     │ Crash di jendela #1–#8                                                │ State sesuai L2.9                              │ —                        │ os._exit            │ SUB     │
│             │                                                                       │                                                │                          │ disuntikkan         │         │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-5     │ APPROVING dan UNKNOWN tidak pernah dilepas otomatis                   │ Tetap                                          │ —                        │ Clock palsu         │ UNIT,   │
│             │                                                                       │                                                │                          │                     │ DBI     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-6     │ RESERVED milik token lain dilepas saat startup; CAS dari pemilik lama │ Tidak ada approval                             │ BudgetConflictError      │ Subprocess          │ SUB     │
│             │  gagal                                                                │                                                │                          │                     │         │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-7     │ DB ditahan transaksi lain lebih dari 5000 ms di Tx-RESERVE atau       │ Tidak ada approval, tidak ada baris baru       │ DB_LOCK_TIMEOUT          │ Subprocess penahan  │ SUB,    │
│             │ Tx-ENTER                                                              │                                                │                          │                     │ DBI     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-8     │ Trigger menolak transisi ilegal, DELETE, dan UPDATE pada tabel event  │ —                                              │ IntegrityError           │ SQLite              │ DBI     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-9a    │ Lapisan A: proses aplikasi kedua di workspace yang sama               │ Ditolak                                        │ WorkspaceLockedError     │ Subprocess          │ SUB     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-9b    │ Lapisan A: lock lepas setelah pemegang dibunuh                        │ Proses baru berhasil                           │ —                        │ Subprocess          │ SUB     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-10    │ FK komposit: grant milik akun lain                                    │ Ditolak                                        │ IntegrityError           │ SQLite              │ DBI     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-11    │ Crash di antara setiap pernyataan di setiap Tx                        │ Rollback penuh; kombinasi record tetap sah     │ —                        │ Injeksi             │ DBI,    │
│             │                                                                       │                                                │                          │                     │ SUB     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-12    │ Setelah timeout, pemanggilan ulang dengan key yang sama               │ Tidak ada baris kedua                          │ —                        │ Baris               │ DBI     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-13    │ Grant tanpa cap eksplisit                                             │ Ditolak di API dan di DB                       │ Error                    │ API dan NOT NULL    │ UNIT,   │
│             │                                                                       │                                                │                          │                     │ DBI     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-14    │ Readback busy_timeout tidak sama dengan 5000                          │ Koneksi tidak dipakai                          │ BUSY_TIMEOUT_MISMATCH    │ Double koneksi      │ UNIT    │
│ (baru)      │                                                                       │                                                │                          │                     │         │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-15    │ Klasifikasi: busy, locked, kode lain, atribut tidak ada               │ Hanya busy dan locked yang dipetakan; sisanya  │ —                        │ Exception buatan    │ UNIT,   │
│ (baru)      │                                                                       │ diteruskan                                     │                          │ dan DB nyata        │ DBI     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-16    │ Tx-COMMIT timeout setelah approve()                                   │ Tidak ada approval kedua; record tetap         │ Error diteruskan         │ Penghitung FakeFlow │ SUB     │
│ (baru)      │                                                                       │ (AWAITING, APPROVING, APPROVING); reconcile    │                          │  = 1                │         │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-17    │ Tx-REC-FOUND hanya terjadi dengan bukti lengkap; kasus ambigu masuk   │ Tabel kasus R3-7                               │ —                        │ FakeFlow            │ UNIT    │
│ (baru)      │ MANUAL                                                                │                                                │                          │                     │         │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-18    │ Tx-BLOCK mencatat block_code yang benar per penyebab; REJECTED tidak  │ —                                              │ —                        │ Matriks penyebab    │ UNIT,   │
│ (baru)      │ berarti pengguna menolak                                              │                                                │                          │                     │ DBI     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-19    │ COMMIT INDETERMINATE: koneksi tidak dipakai lagi, langkah berikutnya  │ —                                              │ —                        │ Double              │ UNIT    │
│ (baru)      │ tidak dijalankan (OD-29)                                              │                                                │                          │                     │         │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ L2-AC-20    │ Tidak ada except Exception di jalur budget                            │ —                                              │ Tes gagal                │ AST                 │ STATIC  │
│ (baru)      │                                                                       │                                                │                          │                     │         │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ INT-AC-1    │ Tidak ada approval bila langkah 1, 4, 5 atau 6 gagal                  │ —                                              │ —                        │ Matriks injeksi     │ UNIT,   │
│             │                                                                       │                                                │                          │                     │ SUB     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ INT-AC-2    │ Urutan CONSUMED, Tx-RESERVE, Tx-ENTER, approve, Tx-COMMIT             │ —                                              │ —                        │ Spy                 │ UNIT    │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ INT-AC-3    │ Kegagalan L-1 dan L-2 tidak pernah memasang FAULTED                   │ —                                              │ —                        │ Subprocess          │ SUB     │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ REG-AC      │ Semua tes R-2 dan call-graph contract tetap ada, atau hanya diubah    │ —                                              │ —                        │ Regresi penuh       │ UNIT    │
│             │ lewat CC; flag dipastikan                                             │                                                │                          │                     │         │
├─────────────┼───────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────┼──────────────────────────┼─────────────────────┼─────────┤
│ SPEC-AC     │ Dokumen konsisten: istilah, nomor OD, urutan L1.6, Tx                 │ —                                              │ —                        │ Review dokumen      │ SPEC    │
│ (baru)      │                                                                       │                                                │                          │                     │         │
└─────────────┴───────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────┴──────────────────────────┴─────────────────────┴─────────┘

---

F. Change Control Register

┌────────────────┬───────────────────────────────────┬──────────────────────────────────────┬────────────────────────────────┬─────────────┬─────────────────┬─────────────────┬──────────────────┐
│       CC       │          File atau modul          │                Alasan                │   Kontrak yang dipertahankan   │ Dependensi  │     Risiko      │     Bukti       │  Menyentuh R-2   │
│                │                                   │                                      │                                │             │                 │   verifikasi    │     frozen?      │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│                │                                   │                                      │ Identitas objek, weakref,      │             │ Entri lebih     │ Tes R-2 dan     │ Ya: CHANGE       │
│ CC-1           │ account/provenance.py             │ Evidence di entri                    │ sweep                          │ —           │ besar           │ evidence        │ CONTROL REQUIRED │
│                │                                   │                                      │                                │             │                 │                 │  (§4 entri)      │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│                │                                   │ _acquire_trusted; urutan L1.6;       │ §4 langkah 0, 1 dan 5;         │ CC-10,      │ Jalur TEST      │ L1-AC-1–4,      │ Ya (§4 langkah   │
│ CC-2           │ provenance.py, flow/adapter.py    │ snapshot lewat TrustedFrameView      │ AMB-1–3; jalur TEST tidak      │ OD-31       │ lolos ke        │ L1-AC-9         │ 2)               │
│                │                                   │                                      │ berubah                        │             │ adapter live    │                 │                  │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ CC-3           │ provenance.py, tes import         │ urllib.parse, hashlib                │ Tanpa import gates             │ —           │ Rendah          │ Tes import      │ Ya (§10)         │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│                │                                   │                                      │ Callback persis, lock,         │             │ Signature       │ Tes lambda dan  │                  │
│ CC-4           │ provenance.py, gates.py           │ authorize(…, adapter), langkah 3b    │ .allowed bool persis, konsumsi │ OD-7        │ berubah         │ D-6             │ Ya (§6.6)        │
│                │                                   │                                      │  sebelum return                │             │                 │                 │                  │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│                │                                   │                                      │ Pemetaan total; PAUSE_BLOCKS   │             │ Urutan          │                 │                  │
│ CC-5           │ provenance.py, gates.py           │ SOURCE_MISMATCH (Opsi 1)             │ tetap                          │ OD-9        │ prioritas       │ Tes prioritas   │ Ya (AC-5)        │
│                │                                   │                                      │                                │             │ berubah         │                 │                  │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ CC-6           │ gates.py                          │ Validasi ulang URL                   │ credit_evidence sebelum lock;  │ OD-8        │ Exception harus │ Tes propagasi   │ Ya (§6.3)        │
│                │                                   │                                      │ AC-7                           │             │  diteruskan     │                 │                  │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│                │ production/runner.py,             │                                      │ Reading lokal, konsumsi        │             │ Pin root        │                 │                  │
│ CC-7           │ persistence/store.py,             │ Urutan Tx L2.9; akuisisi tepercaya   │ sebelum klik, jalur blokir dan │ L-2         │ berubah         │ Pin call graph  │ Ya (§8)          │
│                │ production/budget.py (baru)       │                                      │  reject() tetap                │             │                 │                 │                  │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│                │ tests/unit/simflow.py, tes R-2,   │                                      │                                │             │ Pin             │ Semua pengguna  │                  │
│ CC-8           │ root test                         │ Binding TEST                         │ Jalur live tidak tersambung    │ OD-6        │ adapter_trust   │ simflow         │ Ya (tes R-2)     │
│                │                                   │                                      │                                │             │ berubah         │                 │                  │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ CC-9           │ —                                 │ Ditegaskan: FAULTED hanya dari       │ §5.4                           │ —           │ —               │ INT-AC-3        │ Tidak            │
│                │                                   │ ProvenanceRegistryError              │                                │             │                 │                 │ (penegasan)      │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│                │                                   │                                      │ Kontrak observasi-saja;        │             │                 │                 │ Tidak (bukan     │
│ CC-10          │ flow/live_probe.py (dilindungi)   │ TrustedFrameView versi R3            │ evaluate hanya untuk script    │ OD-23,      │ Permukaan API;  │ L1-AC-11–15     │ R-2), tetapi     │
│                │ atau modul baru; flow/adapter.py  │                                      │ yang diperiksa; ReadOnlyPage   │ OD-31       │ identitas frame │                 │ butuh baris      │
│                │                                   │                                      │ yang ada tidak diperluas       │             │                 │                 │ manifest         │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│                │                                   │ Skema v2, FK komposit, indeks unik   │                                │ OD-27,      │                 │ L2-AC-8,        │                  │
│ CC-11          │ persistence/store.py              │ scene_attempt, trigger, timeout 5000 │ Append-only ledger; transisi   │ OD-28,      │ Migrasi DB yang │ L2-AC-10,       │ Tidak            │
│                │                                   │  ms dan readback, klasifikasi error  │ CAS                            │ OD-25       │  sudah ada      │ L2-AC-14,       │                  │
│                │                                   │                                      │                                │             │                 │ L2-AC-15        │                  │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│                │ production/runner.py (_reconcile, │ Tx-REC-UNKNOWN dan Tx-REC-FOUND      │ Kaidah decide() tidak berubah; │             │                 │ L2-AC-4,        │ Tidak langsung   │
│ CC-12          │  :312-345)                        │ atomik                               │  tidak pernah resubmit         │ CC-11       │ Pin runner      │ L2-AC-17        │ (runner          │
│                │                                   │                                      │                                │             │                 │                 │ dilindungi)      │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ CC-13          │ production/states.py,             │ Hanya bila OD-19 memilih Alt-B       │ FLOW_SIDE dan                  │ OD-19       │ Perubahan mesin │ Tes states dan  │ Tidak            │
│                │ production/reconcile.py:66        │                                      │ CREDIT_SENSITIVE; resume_state │             │  state          │ reconcile       │                  │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ CC-14 (baru)   │ persistence/store.py (_tx)        │ Penanganan COMMIT INDETERMINATE      │ Rollback pada error di body    │ OD-29       │ Semua jalur DB  │ L2-AC-19        │ Tidak            │
│                │                                   │                                      │                                │             │ terdampak       │                 │                  │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│ CC-15 (baru,   │ config.py, cli.py, store.py       │ Identitas workspace dan DB (OD-14)   │ Default workspace              │ OD-14       │ Path simulasi   │ L2-AC-9 dan tes │ Tidak            │
│ kondisional)   │                                   │                                      │                                │             │                 │  baru           │                  │
├────────────────┼───────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────┼─────────────┼─────────────────┼─────────────────┼──────────────────┤
│                │                                   │                                      │                                │             │                 │                 │ Tidak langsung   │
│ CC-16 (baru)   │ runner.py (:200-204)              │ Tx-BLOCK atomik dan block_code       │ Urutan dan semantik reject()   │ OD-26       │ Pin runner      │ L2-AC-18        │ (bagian dari     │
│                │                                   │                                      │                                │             │                 │                 │ CC-7 §8)         │
└────────────────┴───────────────────────────────────┴──────────────────────────────────────┴────────────────────────────────┴─────────────┴─────────────────┴─────────────────┴──────────────────┘

Manifest dan dokumen change control yang sebenarnya tidak diubah.

---

G. Kompatibilitas dengan R-2

┌─────────────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                             Kontrak R-2                             │                                                           Status                                                            │
├─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ FAULTED latch (§5.4)                                                │ Tidak berubah. Error L-1 dan L-2 tidak pernah memasang FAULTED (CC-9)                                                       │
├─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Sekali pakai, konsumsi sebelum return allowed                       │ Tidak berubah. Konsumsi terjadi sebelum Tx-RESERVE. Finding SOURCE_MISMATCH dikembalikan sebelum konsumsi, sesuai urutan    │
│                                                                     │ R-2 untuk finding                                                                                                           │
├─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Semantik registry: identitas objek, sweep, t_mono sebelum snapshot  │ Dipertahankan. Entri diperluas, dan itu CHANGE CONTROL REQUIRED (CC-1)                                                      │
├─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ §4 langkah 2 sumber snapshot (jalur tepercaya)                      │ CHANGE CONTROL REQUIRED (CC-2). Jalur TEST tidak berubah                                                                    │
├─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ §6.6 signature authorize dan AC-5                                   │ CHANGE CONTROL REQUIRED (CC-4, CC-5)                                                                                        │
├─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ §6.3 gates                                                          │ CHANGE CONTROL REQUIRED bila OD-8 disetujui (CC-6)                                                                          │
├─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ §8 alur runner                                                      │ CHANGE CONTROL REQUIRED (CC-7)                                                                                              │
├─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ §10 import                                                          │ CHANGE CONTROL REQUIRED (CC-3)                                                                                              │
├─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Tes R-2 dan call-graph contract                                     │ Tidak dilemahkan. Hanya diubah lewat CC-8 dan integrity chain                                                               │
├─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ PAUSE_BLOCKS, 18 deny: true, LIVE_ACTIONS_ACTIVE=False, konfirmasi  │ Tidak berubah                                                                                                               │
│ manual                                                              │                                                                                                                             │
├─────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Dokumen R-2 yang beku                                               │ Tidak diubah                                                                                                                │
└─────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Kesimpulan: spesifikasi ini tidak bisa diterapkan tanpa mengubah kontrak R-2. Setiap titik konflik dinyatakan sebagai CHANGE CONTROL REQUIRED (CC-1 sampai CC-8) dan tidak ada yang diselesaikan diam-diam.

---

H. Risk register

Urutan berdasarkan dampak lalu kemungkinan, dinilai kualitatif tanpa angka probabilitas.

┌─────┬───────────────────────────────────────────────────────────┬──────────────────────────────┬──────────────────────────┬──────────────────────────────────────┬───────────────────────────────┐
│  #  │                          Risiko                           │            Dampak            │       Kemungkinan        │       Mitigasi di spesifikasi        │          Sisa risiko          │
├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────┼──────────────────────────────────────┼───────────────────────────────┤
│ 1   │ Browser terkompromi atau akses CDP lokal memalsukan DOM   │ Tinggi                       │ Bergantung lingkungan    │ Di luar jaminan (batasan 1–3)        │ Penuh                         │
│     │ dan navigasi                                              │                              │                          │                                      │                               │
├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────┼──────────────────────────────────────┼───────────────────────────────┤
│ 2   │ Approval terjadi tetapi Tx-COMMIT gagal, lalu salah       │ Tinggi                       │ Rendah–sedang            │ Tidak ada retry; record APPROVING;   │ Bergantung kualitas reconcile │
│     │ ditafsirkan                                               │                              │                          │ reconcile; B3                        │                               │
├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────┼──────────────────────────────────────┼───────────────────────────────┤
│ 3   │ Pemakaian manual akun yang sama (tile atau saldo          │ Tinggi                       │ Sedang                   │ Dinyatakan di luar jaminan; MANUAL   │ Atribusi tile tetap INFERENCE │
│     │ tertukar)                                                 │                              │                          │ bila ambigu                          │                               │
├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────┼──────────────────────────────────────┼───────────────────────────────┤
│ 4   │ Workspace atau DB ganda untuk satu akun (alias path,      │ Tinggi                       │ Sedang                   │ OD-14 OPEN; CC-15                    │ Belum ditutup                 │
│     │ salinan, folder sinkron)                                  │                              │                          │                                      │                               │
├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────┼──────────────────────────────────────┼───────────────────────────────┤
│ 5   │ Saldo di UI basi                                          │ Sedang–tinggi                │ Sedang                   │ Cap lokal; OD-11                     │ U-3 tidak bisa dijawab        │
├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────┼──────────────────────────────────────┼───────────────────────────────┤
│ 6   │ Identitas frame atau dokumen tidak berperilaku seperti    │ Sedang                       │ Tidak diketahui          │ Gagal tertutup; OD-31, OD-3          │ Bisa membuat sistem tidak     │
│     │ asumsi                                                    │                              │                          │                                      │ bisa dipakai                  │
├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────┼──────────────────────────────────────┼───────────────────────────────┤
│ 7   │ Error SQLite salah diklasifikasi                          │ Sedang                       │ Rendah                   │ Berbasis kode; fallback diteruskan   │ OD-28                         │
├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────┼──────────────────────────────────────┼───────────────────────────────┤
│ 8   │ COMMIT INDETERMINATE meninggalkan transaksi terbuka       │ Sedang                       │ Rendah                   │ CC-14                                │ OD-29                         │
├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────┼──────────────────────────────────────┼───────────────────────────────┤
│ 9   │ UNKNOWN tidak pernah dilepas sehingga akun terkunci       │ Rendah (aman) – sedang       │ Sedang                   │ Manual (OD-20)                       │ Bergantung prosedur           │
│     │                                                           │ (operasional)                │                          │                                      │                               │
├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────┼──────────────────────────────────────┼───────────────────────────────┤
│ 10  │ Bypass lock di harness tes bocor ke produksi              │ Sedang                       │ Rendah                   │ OD-24, tes AST                       │ —                             │
├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────┼──────────────────────────────────────┼───────────────────────────────┤
│ 11  │ Tidak ada nilai cap sehingga fitur tidak bisa dipakai     │ Rendah (aman)                │ Pasti sampai OD-10       │ Gagal tertutup                       │ —                             │
│     │                                                           │                              │ diputuskan               │                                      │                               │
├─────┼───────────────────────────────────────────────────────────┼──────────────────────────────┼──────────────────────────┼──────────────────────────────────────┼───────────────────────────────┤
│ 12  │ Banyaknya perubahan integrity chain menimbulkan kesalahan │ Sedang                       │ Sedang                   │ Prosedur 4.5D                        │ —                             │
│     │  review                                                   │                              │                          │                                      │                               │
└─────┴───────────────────────────────────────────────────────────┴──────────────────────────────┴──────────────────────────┴──────────────────────────────────────┴───────────────────────────────┘

---

I. Changelog Revision 2 ke Revision 3

┌─────────────────┬─────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│        #        │                  Sebelum (Revision 2)                   │                                                 Sesudah (Revision 3)                                                  │
├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R3-1            │ Wrapper Frame dengan evaluate untuk script yang         │ TrustedFrameView dengan lima operasi tetap, satu konstanta script, tanpa raw Frame, berumur satu akuisisi. Dinyatakan │
│                 │ diperiksa dan locator                                   │  bukan batas keamanan. OD-23 OPEN                                                                                     │
├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R3-2            │ page.main_frame is frame dipakai sebagai bukti          │ UNVERIFIED (OD-31); gagal tertutup; bukan bukti tunggal                                                               │
├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R3-3            │ "Sudah lolos adapter.py:40", tersirat sebagai validasi  │ Regex dinyatakan bukan validasi UUID kanonik; OD-30 OPEN; regex tidak diubah                                          │
│                 │ uuid                                                    │                                                                                                                       │
├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R3-4            │ CHECK (cap > 0)                                         │ Dihapus. NOT NULL tanpa DEFAULT sudah diputuskan; validasi OD-27 OPEN. CHECK pada quoted_cost dan observed_balance    │
│                 │                                                         │ juga dipindah ke OD-27                                                                                                │
├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R3-5            │ "Timeout berarti tidak ada klik"                        │ Dipisah sebelum dan sesudah approval                                                                                  │
├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R3-6            │ Klaim atomisitas tiga record di Tx-ENTER                │ Dibatasi pada reservasi dan ledger (Alt-A); Alt-B dan Alt-C ditampilkan; OD-19 OPEN                                   │
├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R3-7            │ "Hasil ditemukan berarti COMMITTED"                     │ Precondition dan bukti lengkap; kasus ambigu masuk MANUAL; bukti bertentangan masuk MANUAL (OD-26)                    │
├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R3-8            │ Tx-BLOCK dengan REJECTED tanpa pembedaan                │ Semantik yang ada dipertahankan; penyebab di block_code; OD-26 OPEN                                                   │
├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R3-9            │ OD-25 OPEN                                              │ CLOSED sebagai FAIL-CLOSED REQUIREMENT                                                                                │
├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R3-10           │ Pencocokan string                                       │ Kode error; fallback diteruskan; OD-28 OPEN                                                                           │
├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R3-11           │ "Proses baru yang memegang lock bisa yakin tidak ada    │ Cakupan dibatasi; risiko alias, fork, FS, serta DB dan lock yang terpisah. OD-14 OPEN. Pelepasan RESERVED dibuktikan  │
│                 │ proses lain"                                            │ aman tanpa bergantung pada lock                                                                                       │
├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R3-12           │ —                                                       │ Deviasi python3 -c dicatat                                                                                            │
├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Baru            │ —                                                       │ Temuan _tx COMMIT (FACT) memunculkan OD-29 / CC-14. Tx-BLOCK atomik menjadi CC-16. Identitas workspace menjadi CC-15. │
│                 │                                                         │  OD-21 dinyatakan tidak dipakai                                                                                       │
├─────────────────┼─────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Sengaja tetap   │ —                                                       │ OD-10 (cap), OD-14, OD-19, OD-20, OD-23, OD-24, OD-26–OD-31, dan OD-1–OD-18 yang belum diputuskan                     │
│ OPEN            │                                                         │                                                                                                                       │
└─────────────────┴─────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

---

J. Verdict kesiapan

READY FOR DOCUMENT REVIEW.

Dokumen ini konsisten secara internal: urutan akuisisi, transaksi, nomor OD dan istilah. Semua ketidakpastian tercatat sebagai OPEN, DEFERRED atau UNVERIFIED.

Verdict ini bukan implementation-ready dan bukan live-ready. Tidak ada AC yang sudah lulus, dan 21 OD masih OPEN atau DEFERRED.

---

Laporan eksekusi

┌────────────────────────────────┬───────┐
│              Item              │ Nilai │
├────────────────────────────────┼───────┤
│ file changed                   │ 0     │
├────────────────────────────────┼───────┤
│ file created                   │ 0     │
├────────────────────────────────┼───────┤
│ Python executed                │ NO    │
├────────────────────────────────┼───────┤
│ tests executed                 │ NO    │
├────────────────────────────────┼───────┤
│ browser/Chrome/Playwright used │ NO    │
├────────────────────────────────┼───────┤
│ Google Flow accessed           │ NO    │
├────────────────────────────────┼───────┤
│ live observation               │ NO    │
├────────────────────────────────┼───────┤
│ credits consumed               │ 0     │
├────────────────────────────────┼───────┤
│ Git changes                    │ NO    │
├────────────────────────────────┼───────┤
│ R-2 frozen documents changed   │ NO    │
└────────────────────────────────┴───────┘

Perintah yang dijalankan di Revision 3 hanya read-only: grep dan sed -n pada pyproject.toml, src/blatifa/flow/adapter.py, src/blatifa/simulation.py dan src/blatifa/production/runner.py.

Saya berhenti di sini dan menunggu review serta persetujuan eksplisit Anda.

✻ Worked for 6m 6s · done 2:04 PM

※ recap: Tujuannya merevisi spesifikasi L-1/L-2 Blatifa Studio tanpa implementasi; Revision 3 sudah saya tampilkan sebagai teks dengan verdict READY FOR DOCUMENT REVIEW, tanpa file diubah. Berikutnya giliran Anda mereview dan memberi persetujuan, termasuk keputusan OD yang masih terbuka.
