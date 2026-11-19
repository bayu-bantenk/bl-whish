PHASE 5.3G: Spesifikasi L-1/L-2, Revision 4 (hanya laporan, tidak ada file)

Ditampilkan ulang sesuai permintaan Anda. Isinya identik dengan respons Revision 4 sebelumnya, tanpa perubahan apa pun. Tidak ada file yang dibuat, tidak ada perintah yang dijalankan.

Untuk revisi ini saya hanya membaca, dengan grep dan sed -n:
- docs/phase-5.3g4.4/R2_DESIGN_SPEC.md §6.2–6.6 dan §8;
- tests/unit/test_phase5_3g4_4_r2_provenance.py baris 300–318, 474–490 dan 540–550;
- daftar fungsi di src/blatifa/account/provenance.py;
- pencarian acquire_balance dan .blatifa.lock.

Tidak ada eksekusi kode dan tidak ada file yang ditulis.

Label: FACT (path:line), INFERENCE, PROPOSAL, OPEN / DEFERRED / UNVERIFIED, dan NOT ESTABLISHED — REQUIRES DECISION OR EVIDENCE.

---

A. Ringkasan

Temuan baru yang paling penting (FACT, dari tes R-2 yang beku):

┌───────────────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────┐
│                           Pin yang beku                           │                         Bukti                         │                                Akibat                                 │
├───────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
│ provenance.FINDINGS persis lima kode                              │ tests/unit/test_phase5_3g4_4_r2_provenance.py:306-307 │ Finding internal SOURCE_MISMATCH di provenance (desain Revision 3)    │
│                                                                   │                                                       │ melanggar tes beku                                                    │
├───────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Pemetaan total dan satu-satu (lima kode); semua Block berawalan   │ :310-314                                              │ BALANCE_READING_SOURCE_MISMATCH (Opsi 1 di Revision 3) melanggar tes  │
│ BALANCE_READING_ harus persis lima kode R-2                       │                                                       │ beku                                                                  │
├───────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Nama publik provenance berupa himpunan persis                     │ :474-478                                              │ Menambah SourceEvidence atau fungsi publik di provenance melanggar    │
│                                                                   │                                                       │ tes beku                                                              │
├───────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Signature authorize persis ["reading", "wall_clock_verified",     │ :485                                                  │ authorize(…, adapter) (CC-4 di Revision 3) melanggar tes beku         │
│ "evaluate_gate"]                                                  │                                                       │                                                                       │
├───────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
│ _calls("acquire_balance") == [] di src ("nothing live is wired")  │ :546-547                                              │ Setiap penyambungan akuisisi live di kode produksi butuh change       │
│                                                                   │                                                       │ control atas tes beku ini, apa pun desainnya                          │
├───────────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────┤
│ authorize_approval hanya dipanggil dari runner._decide_on_quote;  │ :546, :548                                            │ Pemeriksaan L-1 tidak boleh memanggil authorize                       │
│ provenance.authorize( hanya di gates.py                           │                                                       │                                                                       │
└───────────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────┘

Akibatnya, Revision 4:

1. R4-1. Pemeriksaan sumber L-1 dipindah ke luar R-2, menjadi Source Gate (SG) yang dijalankan sebelum authorize_approval, lewat registry L-1 terpisah (opsi L1-X, direkomendasikan). Dengan opsi ini, prioritas R-2, FINDINGS, pemetaan, signature, provenance.py dan gates.py tidak berubah. Desain Revision 3 (L1-Y) tetap tercatat sebagai alternatif yang CHANGE CONTROL REQUIRED. Pilihannya ada di OD-32 (OPEN).
2. Change control R-2 yang tidak terhindarkan untuk L1-X:
   - pin tes beku _calls("acquire_balance") == [] (CC-18);
   - alur runner R-2 §8 (CC-7).
3. R4-2. Ringkasan Revision 3 menulis "21 OD OPEN/DEFERRED". Hitungan register yang benar waktu itu 27 (24 OPEN dan 3 DEFERRED). Itu salah hitung; tidak ada OD yang duplikat. Revision 4 menambah OD-32 sampai OD-36.
4. R4-3 dan R4-6. Matriks kegagalan Tx-BLOCK lengkap dibuat. reject() tidak dianggap idempotent. Tidak ada retry reject() maupun approval. Mengubah urutan, misalnya menulis intent sebelum reject, adalah OD-33 (OPEN).
5. R4-4. /.blatifa.lock di Revision 3 adalah salah tampil, bukan desain. Placeholder <workspace> kemungkinan besar terbaca sebagai tag HTML. Path yang dimaksud adalah {WORKSPACE}/.blatifa.lock, dan kontraknya dirinci.
6. R4-5. reservation_event sekarang punya FK komposit dan trigger. Bentuk akhirnya menunggu persetujuan (OD-35, OD-36). Batas jaminan append-only dinyatakan dengan jujur.

Jumlah OD (dipakai konsisten di seluruh dokumen ini):

┌───────┬────────┬──────┬──────────┬──────────┐
│ Total │ CLOSED │ OPEN │ DEFERRED │ REJECTED │
├───────┼────────┼──────┼──────────┼──────────┤
│ 35    │ 3      │ 29   │ 3        │ 0        │
└───────┴────────┴──────┴──────────┴──────────┘

OD-21 berstatus RETIRED: tidak pernah dipakai dan tidak dihitung.

Verdict: READY FOR FINAL SPECIFICATION REVIEW (bagian K). Ini bukan implementation-ready dan bukan live-ready.

Audit trail (dipertahankan dari Revision 3, R3-12): di Revision 2, satu perintah yang berisi python3 -c ditolak sistem sebelum dieksekusi. Python tidak berjalan dan perintah itu tidak diulang.

---

B. Spesifikasi L-1: Source Authenticity

L1.0 Cakupan

- A1–A5 tetap menjadi cakupan; A4 dan A5 adalah inti desain.
- Keaslian sumber belum terbukti. R-2 provenance bukan keaslian sumber.
- Keaslian main frame harus gagal tertutup.

L1.1 Baseline (FACT)

┌───────────────────────────────────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────┐
│                                                 Fakta                                                 │                   Bukti                    │
├───────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ acquire_balance(page) hanya memanggil page.locator("body").aria_snapshot() dan menerima objek apa pun │ src/blatifa/account/provenance.py:10, :150 │
├───────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ Tab dipilih lewat substring, dengan fallback                                                          │ src/blatifa/browser/engine.py:162-169      │
├───────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ PROJECT_URL memakai [0-9a-f-]{36}. Ini bukan validasi UUID kanonik                                    │ src/blatifa/flow/adapter.py:40             │
├───────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ _on_project membuang query dan garis miring di akhir. URL dengan fragment gagal                       │ src/blatifa/flow/adapter.py:69-71          │
├───────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ approve() dan reject() di adapter live di-raise BlockedOperationError                                 │ src/blatifa/flow/adapter.py:156-160        │
├───────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ ReadOnlyPage tidak mengekspos main_frame; locator(selector) menerima selector bebas                   │ src/blatifa/flow/live_probe.py:72-107      │
├───────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ Pin R-2 yang beku                                                                                     │ Tabel di bagian A                          │
├───────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ _manual(a, code: str, detail) menerima kode string                                                    │ src/blatifa/production/runner.py:341-345   │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────┘

L1.2 Batasan (dinyatakan eksplisit)

1. Bukti dari DOM adalah satu sumber, dan tidak independen bila browser sudah terkompromi.
2. Manipulasi berbahaya di dalam proses yang sama berada di luar jaminan Option C.
3. Akses CDP, ekstensi browser, atau kompromi browser lokal berada di luar jaminan.
4. Pemakaian manual akun Google yang sama di luar aplikasi tidak bisa dideteksi maupun dikoordinasi.
5. Restart proses tidak membuktikan keaslian sumber maupun keamanan budget.
6. Tab yang aktif tidak boleh dianggap project yang benar. L-1 tidak bergantung pada engine.attach (OD-13).
7. Saldo di UI tidak boleh dianggap selalu segar (OD-11).
8. Spesifikasi ini tidak mengizinkan operasi live apa pun.

L1.3 Pilihan arsitektur (OD-32, OPEN)

┌──────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────┐
│         Opsi         │                                               Inti                                               │                       Kontrak R-2 yang tersentuh                        │
├──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
│ L1-X                 │ Registry evidence L-1 terpisah di modul baru (misalnya account/source_evidence.py). Akuisisi     │ §8 runner (CC-7) dan pin _calls("acquire_balance") == [] (CC-18). Tidak │
│ (direkomendasikan)   │ tepercaya memanggil acquire_balance(view) milik R-2 tanpa perubahan. Source Gate dijalankan di   │  menyentuh provenance.py, gates.py, prioritas, FINDINGS, pemetaan,      │
│                      │ runner sebelum authorize_approval                                                                │ maupun signature                                                        │
├──────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────┤
│ L1-Y (desain         │ Evidence di entri R-2; authorize(…, adapter); finding SOURCE_MISMATCH                            │ CHANGE CONTROL REQUIRED: §4, §6.2, §6.3, §6.6, AC-5, §10, dan pin       │
│ Revision 3)          │                                                                                                  │ :306-314, :474-485                                                      │
└──────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────┘

Bagian selanjutnya menspesifikasikan L1-X. L1-Y hanya tercatat di CC-1 sampai CC-6, sebagai kondisional.

L1.4 SourceEvidence dan registry L-1 (L1-X, PROPOSAL)

SourceEvidence berupa frozen dataclass di modul L-1:

┌─────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────┐
│          Field          │                                         Isi                                         │
├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ version                 │ 1                                                                                   │
├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ kind                    │ TRUSTED_LIVE. Jalur TEST tidak mendaftarkan evidence; opsi binding TEST ada di OD-6 │
├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ project_id              │ Dari adapter.project_url. Validasinya hanya regex yang ada; formatnya OD-30         │
├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ url_digest              │ Lihat L1.6                                                                          │
├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ main_frame_checked      │ bool: hasil validasi L1.5, bukan objek Frame                                        │
├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ doc_identity_digest     │ SHA-256 dari keluaran DOC_IDENTITY_JS; pre dan post harus sama                      │
├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ account_fingerprint     │ Dari DOM yang sama (batasan 1)                                                      │
├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ t_mono_pre, t_mono_post │ Waktu monotonic                                                                     │
├─────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────┤
│ adapter_ref, page_ref   │ weakref tanpa callback                                                              │
└─────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────┘

Registry L-1:
- Kunci berupa identitas objek: id(reading) ditambah pemeriksaan ref() is reading. Ini mencerminkan aturan identitas R-2 §5.3 dan tidak memakai WeakKeyDictionary.
- Punya threading.Lock sendiri yang non-reentrant.
- Tidak pernah memegang lock-nya sambil memanggil fungsi R-2, dan sebaliknya. Tidak ada lock bertingkat.
- Kegagalan internal registry L-1 menjadi SourceEvidenceError, yang gagal tertutup. Registry ini tidak pernah menyentuh FAULTED milik R-2.
- Registry L-1 tidak punya mekanisme reset, clear, maupun pemulihan FAULTED.

L1.5 TrustedFrameView (OD-23 OPEN; OD-31 UNVERIFIED)

- Umur dan visibilitas: hanya hidup di dalam satu pemanggilan acquire_trusted_balance(). Tidak pernah dikembalikan, disimpan, atau diberikan ke runner, probe, atau gates.
- Operasi (lengkap, tidak ada yang lain):

┌─────┬─────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  #  │       Operasi       │                                                                                Batasan                                                                                 │
├─────┼─────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1   │ is_main()           │ frame.parent_frame is None                                                                                                                                             │
├─────┼─────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2   │ is_detached()       │ Hasil harus type(x) is bool                                                                                                                                            │
├─────┼─────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 3   │ url()               │ Hasil harus type(x) is str                                                                                                                                             │
├─────┼─────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 4   │ locator("body")     │ Hanya argumen literal "body". Argumen lain langsung raise. Mengembalikan objek yang hanya punya aria_snapshot(), yang mengembalikan str. Bentuk ini dibutuhkan agar    │
│     │                     │ acquire_balance(view) milik R-2 bisa dipakai tanpa perubahan (provenance.py:150)                                                                                       │
├─────┼─────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 5   │ document_identity() │ Satu konstanta DOC_IDENTITY_JS yang sudah diaudit, tanpa parameter script. Hasilnya harus dict persis {timeOrigin: float, url: str}                                    │
└─────┴─────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

- Dilarang: evaluate generik, locator generik, akses ke objek Frame atau Page mentah, dan __getattr__ yang mengembalikan sesuatu (selalu raise).
- Penanganan:
  - Frame detached, bukan main frame, tipe hasil salah, atau frame berubah: SourceEvidenceError.
  - Exception dari Playwright: diteruskan. Tidak ada evidence L-1 dan tidak FAULTED.
  - Kondisi yang tidak bisa diverifikasi: ditolak.
- Pernyataan keamanan: wrapper ini mempersempit API dan mencegah salah pakai yang tidak disengaja. Wrapper ini bukan batas keamanan terhadap kode in-process. Pembatasan nama method tidak membuktikan keamanan.
- Identitas frame (OD-31): page.main_frame is frame_pre UNVERIFIED.
  - Bila bernilai False, akuisisi ditolak.
  - Pemeriksaan ini tidak pernah menjadi bukti tunggal; selalu digabung dengan kesamaan URL dan identitas dokumen.
  - Bukti yang dibutuhkan: code review sumber Playwright pada versi yang di-pin, tes browser non-Flow di fase yang diizinkan, dan LIVE-OBS-5.

L1.6 Kontrak URL dan project (OD-1, OD-2 dan OD-30 OPEN)

┌──────────────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                              Aspek                               │                                                       Aturan (PROPOSAL)                                                        │
├──────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Diterima                                                         │ Hanya bila url == "https://flow.google.com/project/" + project_id, dibandingkan persis tanpa normalisasi                       │
├──────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Scheme dan host                                                  │ Bagian dari literal                                                                                                            │
├──────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Port, userinfo, query, fragment, garis miring di akhir, huruf    │ Semuanya ditolak                                                                                                               │
│ kapital, xn--, titik di akhir                                    │                                                                                                                                │
├──────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ project_id                                                       │ String id dari adapter.project_url. Validasi yang ditemukan: regex adapter.py:40, bukan UUID kanonik. Validasi yang            │
│                                                                  │ dibutuhkan: OD-30. Regex tidak diubah tanpa change control                                                                     │
├──────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Kanonik                                                          │ String di atas, di-encode UTF-8, lalu SHA-256, ditulis sebagai 64 karakter heksadesimal huruf kecil (url_digest)               │
├──────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Pemeriksaan pre/post                                             │ String mentah dalam memori harus sama                                                                                          │
├──────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Hubungan dengan _on_project                                      │ Subset ketat. Tidak ada perluasan                                                                                              │
├──────────────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Status runtime                                                   │ Tidak tervalidasi (LIVE-OBS-3, DEFERRED)                                                                                       │
└──────────────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

L1.7 Algoritma akuisisi tepercaya (L1-X)

GoogleFlowAgentAdapter.acquire_trusted_balance():        # exact type only (OD-7)
  1. PRE-CHECK: _on_project(); view = TrustedFrameView(page); is_main, not detached,
     url() per L1.6, doc_pre = document_identity(), fp_pre == expected fingerprint (OD-5)
     → SourceEvidenceError
  2+3. reading = provenance.acquire_balance(view)
       # R-2 unchanged: FAULTED step 0, t_mono, snapshot via view.locator("body"), parse, classify,
       # R-2 registration (R-2 internal; does not make the reading trusted for L-1)
  4. POST-CHECK: page.main_frame is frame_pre (OD-31), is_main, not detached, url() == url_pre,
     document_identity() == doc_pre, fingerprint == fp_pre    → SourceEvidenceError, reading dropped
  5. L-1 REGISTER: register (reading, SourceEvidence) in the L-1 registry   # only after 1–4 succeeded
  return reading

Penting dan jujur: di L1-X, registrasi R-2 terjadi di dalam acquire_balance, yaitu sebelum post-check. Ini tidak terhindarkan tanpa mengubah R-2. Yang dijamin adalah bahwa registrasi L-1 (yang membuat reading tepercaya) baru terjadi setelah post-check berhasil.

Reading yang post-check-nya gagal tidak dikembalikan. Entri R-2-nya menjadi yatim lalu tersapu. INFERENCE: bila reading itu bocor, ia tetap tanpa evidence L-1, sehingga SG menolaknya untuk adapter live. Bila Anda menghendaki registrasi R-2 juga baru terjadi setelah post-check, pilihannya L1-Y (CHANGE CONTROL REQUIRED).

L1.8 Source Gate (SG) dan posisinya terhadap R-2

Urutan di _decide_on_quote:
1. akuisisi;
2. gate pendahuluan;
3. confirm;
4. SG;
5. authorize_approval (R-2, tanpa perubahan);
6. L-2.

SG berupa fungsi L-1 source_gate(reading, adapter). SG tidak mengonsumsi reading, tidak memanggil fungsi R-2, dan tidak mengubah GateResult.

┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬────────────────────────────────────────────┐
│                                                                       Kondisi                                                                        │                  Hasil SG                  │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ Adapter berupa simulasi bawaan dan reading berupa int (R-2 step 0)                                                                                   │ PASS (tidak berlaku)                       │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ Adapter bukan live (misalnya FakeFlow)                                                                                                               │ PASS. Binding TEST opsional (OD-6)         │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ Adapter live, dan reading punya evidence TRUSTED_LIVE dengan adapter_ref() is adapter, page_ref() is adapter.page, dan URL revalidasi (OD-8) cocok   │ PASS                                       │
│ dengan url_digest                                                                                                                                    │                                            │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ Adapter live, dalam kondisi lain mana pun (tanpa evidence, adapter atau page berbeda, URL berubah, reading bukan BalanceReading)                     │ SOURCE_MISMATCH                            │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────────────┤
│ Membaca page.url melempar error                                                                                                                      │ Diteruskan, tanpa authorize dan tanpa      │
│                                                                                                                                                      │ approval                                   │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴────────────────────────────────────────────┘

L1.9 Klasifikasi SOURCE_MISMATCH (R4-1)

Statusnya:
- Outcome khusus L-1, bukan finding R-2. Tidak masuk FINDINGS.
- Bukan Block berawalan BALANCE_READING_.
- Bentuk publiknya OD-9. Rekomendasi: kode string SOURCE_MISMATCH lewat _manual(code: str) dan block_code di Tx-BLOCK, tanpa member Block baru dan tanpa perubahan gates.py.
- Lima prioritas R-2 tidak berubah.

Kombinasi kegagalan:

┌────────────────────────────────────────────────┬──────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┬───────────────────────────┐
│              Kombinasi kegagalan               │                       Outcome yang diharapkan                        │            Kontrak R-2 tersentuh?            │          Status           │
├────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┼───────────────────────────┤
│ Hanya SG yang gagal                            │ SOURCE_MISMATCH; R-2 tidak dipanggil; tidak ada konsumsi; Tx-BLOCK   │ Tidak                                        │ PROPOSAL                  │
├────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┼───────────────────────────┤
│                                                │ SOURCE_MISMATCH, karena SG dievaluasi lebih dulu. FAULTED tetap      │ Tidak. Latch tidak berubah. SG tidak bisa    │ PROPOSAL. Diagnosisnya    │
│ SG gagal dan registry R-2 FAULTED              │ terkunci; akuisisi berikutnya raise ProvenanceRegistryError          │ membaca _faulted tanpa melanggar pin         │ kalah spesifik            │
│                                                │                                                                      │ :474-478                                     │                           │
├────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┼───────────────────────────┤
│ SG gagal dan R-2 akan menghasilkan             │ SOURCE_MISMATCH                                                      │ Tidak                                        │ PROPOSAL                  │
│ UNREGISTERED, MUTATED, CONSUMED atau STALE     │                                                                      │                                              │                           │
├────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┼───────────────────────────┤
│ SG lolos dan ada finding R-2 (satu atau lebih) │ Finding R-2 dengan prioritas tertinggi, sesuai §6.2 dan §6.3 U-2     │ Tidak                                        │ FACT tentang R-2;         │
│                                                │                                                                      │                                              │ PROPOSAL tentang urutan   │
├────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┼───────────────────────────┤
│ SG lolos dan R-2 mengizinkan                   │ CONSUMED, lalu L-2                                                   │ Tidak                                        │ PROPOSAL                  │
├────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┼───────────────────────────┤
│ Adapter live dan reading int                   │ SOURCE_MISMATCH (R-2 seharusnya UNREGISTERED, §6.3)                  │ Tidak                                        │ PROPOSAL                  │
├────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┼───────────────────────────┤
│ SG lolos, R-2 mengizinkan, lalu revalidasi URL │ Reading tetap CONSUMED (§8 langkah 5); SOURCE_MISMATCH; Tx-BLOCK     │ Tidak                                        │ OPEN (OD-8)               │
│  kedua sesudah authorize gagal (opsi OD-8)     │                                                                      │                                              │                           │
├────────────────────────────────────────────────┼──────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┼───────────────────────────┤
│ Pemeriksaan sumber di dalam authorize (L1-Y)   │ Prioritas berubah                                                    │ CHANGE CONTROL REQUIRED                      │ Kondisional (OD-32)       │
└────────────────────────────────────────────────┴──────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┴───────────────────────────┘

Aturan deterministik: outcome SG mendahului R-2 hanya karena SG dievaluasi lebih dulu. Prioritas di dalam R-2 tidak berubah.

L1.10 Mode kegagalan

┌───────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────┬─────────┬──────────┐
│         Kegagalan         │                                                 Hasil                                                  │ FAULTED │ Approval │
├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┼──────────┤
│ Pre-check atau post-check │ SourceEvidenceError, lalu AdapterError("SOURCE_UNVERIFIED"), lalu manual (jalur runner.py:39-44, :106) │ tidak   │ tidak    │
├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┼──────────┤
│ Playwright atau parse     │ Diteruskan (AMB-1)                                                                                     │ tidak   │ tidak    │
├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┼──────────┤
│ R-2 FAULTED saat akuisisi │ ProvenanceRegistryError                                                                                │ sudah   │ tidak    │
├───────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────┼──────────┤
│ SG                        │ SOURCE_MISMATCH, lalu Tx-BLOCK                                                                         │ tidak   │ tidak    │
└───────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────┴─────────┴──────────┘

Apakah reject() dipanggil di jalur AdapterError: NOT ESTABLISHED — REQUIRES DECISION OR EVIDENCE. Bila tidak dipanggil, dialog tetap terbuka dan reconcile berakhir MANUAL (reconcile.py:99-100).

L1.11 Kompatibilitas SimulatedFlow dan FakeFlow

- SimulatedFlow dan FakeFlow tidak berubah perilakunya.
- simflow.fresh_balance tetap memanggil acquire_balance(_FixturePage(…)) (pin tests/unit/test_phase5_3g4_1_adapter_trust.py:173-174).
- Binding TEST: OD-6, CC-8.

---

C. Spesifikasi L-2: Cross-Process Budget Coordination

L2.0 Cakupan

- Cakupan: B1, B2, B3, B4, B5, B7.
- Ditolak: B6 (expiry otomatis) dan B8 (coordinator).
- Di luar cakupan: koordinasi antar-mesin.
- Diputuskan: satu proses per workspace, dan proses kedua menerima WorkspaceLockedError.
- PAUSE_BLOCKS tidak berubah.

L2.1 Baseline (FACT)

┌───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────┐
│                                                             Fakta                                                             │                        Bukti                         │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ _tx: COMMIT berada di luar try, sehingga kegagalan COMMIT tidak di-rollback                                                   │ src/blatifa/persistence/store.py:284-291             │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ ledger_write dan transition masing-masing membuka transaksi sendiri                                                           │ store.py:323-343, :350-356                           │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ Trigger append-only untuk credit_ledger sudah ada (preseden)                                                                  │ store.py:197-200                                     │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ connect tanpa timeout; foreign_keys=ON diset per koneksi Store                                                                │ store.py:269, :274                                   │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ Skema dibuat dengan executescript(SCHEMA) setiap kali dibuka; versi hanya diisi bila tabel kosong; tidak ada kerangka migrasi │ store.py:275-278, :24                                │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ Jalur penolakan: reject(), lalu REJECTED, lalu _manual(blocks[0]), untuk semua blok                                           │ src/blatifa/production/runner.py:200-204             │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ SimulatedFlow.reject() hanya mengeset open_confirmation = False; idempotent di simulasi saja                                  │ src/blatifa/simulation.py:46-47                      │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ Reconcile hanya memakai observe dan pending_confirmation; tidak pernah memanggil reject atau approve                          │ src/blatifa/production/runner.py:312-339             │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ decide(): READY hanya bila tidak maybe_spent dan pending_confirmation is False                                                │ src/blatifa/production/reconcile.py:66, :93-102      │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ Tidak ada implementasi lock maupun .blatifa.lock di src                                                                       │ Hasil grep kosong                                    │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ Workspace default ~/BlatifaStudio (bisa diganti BLATIFA_WORKSPACE); path DB simulasi berasal dari _simulation_paths           │ src/blatifa/config.py:23; src/blatifa/cli.py:333-335 │
├───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────────────┤
│ Python >=3.12,<3.13                                                                                                           │ pyproject.toml:5                                     │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────┘

L2.2 Dua besaran

1. Saldo aktual Flow: hanya bukti L-1 dan R-2 pada satu titik waktu. Tidak dianggap segar.
2. Budget reservasi lokal: cap per grant per akun, dan hanya untuk satu file DB.

L2.3 Skema konseptual v2 (PROPOSAL; CC-11; OD-27, OD-35 dan OD-36 OPEN)

CREATE TABLE budget_grant (
  id TEXT PRIMARY KEY, account_id TEXT NOT NULL,
  cap <TYPE: OD-27> NOT NULL,              -- DECIDED: explicit, NOT NULL, no DEFAULT; range/type: OD-27
  expected_fingerprint TEXT NOT NULL,      -- OD-5
  granted_by TEXT NOT NULL CHECK (granted_by = 'user'),
  opened_at TEXT NOT NULL, closed_at TEXT,
  UNIQUE (id, account_id));
CREATE UNIQUE INDEX budget_grant_one_open ON budget_grant(account_id) WHERE closed_at IS NULL;
CREATE UNIQUE INDEX scene_attempt_id_account ON scene_attempt(id, account_id);

CREATE TABLE budget_reservation (
  id TEXT PRIMARY KEY,
  idempotency_key TEXT NOT NULL UNIQUE, attempt_id TEXT NOT NULL UNIQUE,
  grant_id TEXT NOT NULL, account_id TEXT NOT NULL,
  quoted_cost INTEGER NOT NULL, observed_balance INTEGER NOT NULL,   -- range CHECK: OD-27
  evidence_digest TEXT NOT NULL, owner_token TEXT NOT NULL,
  state TEXT NOT NULL CHECK (state IN ('RESERVED','APPROVING','UNKNOWN','COMMITTED','RELEASED','RELEASED_BY_USER')),
  block_code TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (id, account_id),
  FOREIGN KEY (grant_id, account_id)   REFERENCES budget_grant(id, account_id),
  FOREIGN KEY (attempt_id, account_id) REFERENCES scene_attempt(id, account_id));
CREATE UNIQUE INDEX budget_one_active_per_account ON budget_reservation(account_id)
  WHERE state IN ('RESERVED','APPROVING','UNKNOWN');

CREATE TABLE reservation_event (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reservation_id TEXT NOT NULL, account_id TEXT NOT NULL,
  from_state TEXT, to_state TEXT NOT NULL, reason TEXT NOT NULL, at TEXT NOT NULL,
  FOREIGN KEY (reservation_id, account_id) REFERENCES budget_reservation(id, account_id));
-- Triggers (proposal, OD-35/OD-36):
--  T1 BEFORE UPDATE / BEFORE DELETE ON reservation_event        → RAISE(ABORT)
--  T2 BEFORE DELETE ON budget_reservation                       → RAISE(ABORT)
--  T3 BEFORE UPDATE ON budget_reservation: immutable columns changed (all except state, block_code, updated_at) → ABORT
--  T4 BEFORE UPDATE OF state: (OLD.state, NEW.state) not in L2.4 → ABORT
--  T5 (option OD-35) AFTER UPDATE OF state → INSERT reservation_event automatically
--  T6 (OD-36) budget_grant: no DELETE; UPDATE only closed_at from NULL

Integritas referensial reservation_event (R4-5):

┌───────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│        Pertanyaan         │                                                              Jawaban (PROPOSAL bila tidak disebut lain)                                                               │
├───────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Apakah event harus        │                                                                                                                                                                       │
│ merujuk reservasi yang    │ Ya. reservation_id berupa NOT NULL dengan FK                                                                                                                          │
│ valid?                    │                                                                                                                                                                       │
├───────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Perlu FK komposit?        │ Ya. (reservation_id, account_id) ke (id, account_id) mencegah event dicatat atas nama akun lain. Ini butuh UNIQUE (id, account_id) di reservasi. Persetujuan bentuk   │
│                           │ akhirnya: OD-35                                                                                                                                                       │
├───────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Bisakah event tetap ada   │ Tidak boleh terjadi. Parent tidak bisa dihapus (T2), FK memakai default NO ACTION, dan tidak ada ON DELETE CASCADE (yang justru akan menghapus event)                 │
│ setelah parent dihapus?   │                                                                                                                                                                       │
├───────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Kebijakan update dan      │ Event: tidak ada UPDATE maupun DELETE (T1). Reservasi: tidak ada DELETE; UPDATE hanya pada kolom yang boleh berubah dan sepanjang transisi yang sah (T3, T4)          │
│ delete                    │                                                                                                                                                                       │
├───────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Append-only di tingkat DB │ Trigger berlaku untuk DML dari koneksi mana pun (INFERENCE dari dokumentasi SQLite, UNVERIFIED di runtime). Trigger tidak melindungi dari DDL (DROP TRIGGER),         │
│  atau hanya di tingkat    │ writable_schema, pengeditan file, atau penghapusan file DB. FK hanya ditegakkan pada koneksi yang mengaktifkan PRAGMA foreign_keys=ON (FACT: Store mengaktifkannya;   │
│ API?                      │ alat eksternal belum tentu). Jadi DB menegakkan append-only terhadap DML biasa, bukan terhadap upaya manipulasi                                                       │
├───────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Rollback                  │ Event ditulis di transaksi yang sama dengan perubahan reservasi, setelah baris parent ada (FK langsung). Rollback menghapus keduanya bersamaan, jadi tidak ada event  │
│                           │ yatim                                                                                                                                                                 │
├───────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Hubungan dengan grant,    │ Grant dan akun lewat FK komposit di reservasi. Attempt dan akun lewat scene_attempt_id_account. Event mewarisi akun lewat FK komposit                                 │
│ akun dan attempt          │                                                                                                                                                                       │
└───────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Migrasi v1 ke v2:
- FACT: kerangka migrasi belum ada.
- PROPOSAL (CC-11): satu transaksi aditif berisi tabel baru, indeks, trigger dan nilai schema_info yang dinaikkan. Tidak ada backfill.
- DB yang ada (termasuk ~/BlatifaStudio/experiments/phase-5.3g/p53g.db) tidak disentuh dalam fase ini.

Cap:
- Sudah diputuskan: eksplisit saat grant dibuat, bisa dikonfigurasi, NOT NULL, tanpa DEFAULT, dan dibuat hanya lewat perintah pengguna.
- OPEN (OD-10 untuk nilai; OD-27 untuk tipe, rentang dan validasi): tidak ada minimum, maksimum, maupun default.
- Konsekuensi teknis bila tidak ada CHECK rentang: cap 0 atau negatif membuat semua reservasi dengan cost positif tertolak. Kebijakan atas hal ini ada di tangan Anda.

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
- Dihitung terpakai: state aktif ditambah COMMITTED.
- Tidak ada expiry otomatis.

L2.5 Busy timeout dan klasifikasi error

- Timeout: timeout=5.0 ditambah PRAGMA busy_timeout=5000 untuk setiap koneksi Store.
- OD-25: CLOSED — FAIL-CLOSED REQUIREMENT. Bila readback bukan tepat 5000: koneksi tidak dipakai untuk jalur approval, operasi dihentikan, tidak ada fallback, tidak ada retry, dan kondisinya dilaporkan (BUSY_TIMEOUT_MISMATCH). Belum diimplementasi dan belum diuji.
- Klasifikasi (OD-28 OPEN):

┌─────────────────────────────────────────────────────────────┬───────────────────────────────────────────────────────┐
│                           Kondisi                           │                      Klasifikasi                      │
├─────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
│ OperationalError dengan sqlite_errorcode & 0xFF == 5 (BUSY) │ DB_LOCK_TIMEOUT                                       │
├─────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
│ Primary code 6 (LOCKED)                                     │ DB_LOCKED                                             │
├─────────────────────────────────────────────────────────────┼───────────────────────────────────────────────────────┤
│ Kode tidak tersedia, kode lain, atau jenis error lain       │ Diteruskan tanpa diubah. Bukan BudgetUnavailableError │
└─────────────────────────────────────────────────────────────┴───────────────────────────────────────────────────────┘

  Pencocokan string dilarang. Ketersediaan atribut di Python 3.12 adalah INFERENCE dari dokumentasi dan UNVERIFIED.
- Pembedaan dengan konflik aplikasi: DB_LOCK_TIMEOUT dan DB_LOCKED berasal dari SQLite. RESERVATION_ACTIVE, RESERVATION_CONFLICT, BUDGET_CAP dan BUDGET_NO_GRANT berasal dari aplikasi.

L2.6 Process lock (OD-22 CLOSED; R4-4; OD-14 OPEN)

Koreksi representasi: Revision 3 tertampil sebagai /.blatifa.lock. Itu salah tampil dari placeholder <workspace>; root filesystem tidak pernah dimaksudkan. FACT: belum ada implementasi lock maupun path lock di src.

Kontrak path (PROPOSAL):

┌─────┬────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│  #  │         Topik          │                                                                             Ketentuan                                                                              │
├─────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1   │ Relatif terhadap       │ Lock file = {WORKSPACE}/.blatifa.lock, dengan {WORKSPACE} adalah direktori workspace hasil resolusi. Bukan root filesystem dan bukan CWD                           │
│     │ workspace              │                                                                                                                                                                    │
├─────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 2   │ Path absolut           │ {WORKSPACE} = expanduser lalu harus absolut. Nilai BLATIFA_WORKSPACE yang relatif ditolak (OD-14). realpath dicatat untuk audit, tetapi bukan identitas            │
├─────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 3   │ Symlink                │ Diizinkan atau ditolak: OD-14. INFERENCE: flock mengunci file yang sudah di-resolve, jadi symlink ke direktori yang sama tetap konflik dengan benar                │
├─────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 4   │ Alias path             │ APFS yang tidak peka huruf kapital dan firmlink membuat string path berbeda menunjuk direktori yang sama. Karena itu identitas yang diusulkan adalah (st_dev,      │
│     │                        │ st_ino) direktori, yang dicatat di DB dan dicocokkan saat dibuka (CC-15)                                                                                           │
├─────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 5   │ Dua path ke workspace  │ Bila menunjuk direktori fisik yang sama, lock bekerja. Salinan workspace atau BLATIFA_WORKSPACE yang berbeda menghasilkan lock dan DB berbeda, sehingga tidak      │
│     │ yang sama              │ terkoordinasi                                                                                                                                                      │
├─────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 6   │ FS lokal               │ Satu-satunya cakupan jaminan yang diusulkan                                                                                                                        │
├─────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 7   │ Network FS dan folder  │ Semantik flock NOT ESTABLISHED. Usulan: ditolak (deteksinya U-5, OD-14)                                                                                            │
│     │ sinkron                │                                                                                                                                                                    │
├─────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 8   │ Batas fcntl.flock      │ Advisory: alat lain tidak terhalang. Diwarisi child saat fork, jadi child yang hidup tetap memegang lock. Per open file description: dua fd di proses yang sama    │
│     │                        │ juga konflik (INFERENCE). Tidak bekerja lintas mesin                                                                                                               │
├─────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 9   │ Lock basi dan matinya  │ Kernel melepas lock saat proses mati, termasuk SIGKILL (INFERENCE). Keberadaan file tidak pernah dibaca sebagai "terkunci". File lock tidak pernah di-unlink,      │
│     │ proses                 │ karena unlink lalu buat ulang menghasilkan inode baru, sehingga dua proses bisa sama-sama merasa memegang lock                                                     │
├─────┼────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 10  │ Lock dan reservasi DB  │ Lock menjamin eksklusivitas aplikasi (lapisan A). Reservasi menjamin atomisitas budget per file DB (lapisan B). Keamanan reservasi tidak bergantung pada lock      │
│     │                        │ (L2.8)                                                                                                                                                             │
└─────┴────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Lock tidak membuktikan identitas workspace kanonik. FACT: path DB simulasi bisa berbeda dari workspace (src/blatifa/cli.py:333-335). Mengikat lock ke DB adalah bagian dari CC-15 dan OD-14.

Cakupan jaminan: satu proses per workspace hanya dijamin di FS lokal, untuk proses yang memanggil flock pada file lock yang sama. Jaminan ini tidak berlaku untuk semua jenis FS.

L2.7 Semantik dan urutan reject() (R4-6)

┌─────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                     Pertanyaan                      │                                                                   Jawaban                                                                   │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Apakah reject merupakan aksi eksternal yang tak     │ Untuk Flow: NOT ESTABLISHED. INFERENCE: menutup dialog biaya, dan tidak bisa dibatalkan dari sisi aplikasi                                  │
│ bisa dibatalkan?                                    │                                                                                                                                             │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Apakah reject idempotent?                           │ Hanya terbukti di SimulatedFlow (FACT). Untuk adapter live: diblokir (FACT). Untuk Flow: NOT ESTABLISHED. Tidak dianggap idempotent         │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Bisakah adapter mengonfirmasi hasil reject?         │ Tidak secara langsung. Hanya tidak langsung lewat pending_confirmation() (FACT), yang tidak membedakan dialog tertutup karena reject dari   │
│                                                     │ dialog tertutup karena approve. Tile baru (decide) membantu sebagian                                                                        │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Membedakan reject berhasil dari tidak diketahui     │ reject() kembali normal dianggap "reject dilaporkan berhasil". reject() melempar error dianggap "hasil tidak diketahui". Keduanya tidak     │
│                                                     │ dicatat di DB sebelum Tx-BLOCK                                                                                                              │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Mencegah reject berulang                            │ Tidak ada pemanggilan reject() otomatis di jalur pemulihan mana pun (FACT: reconcile tidak memanggilnya). Reject ulang hanya bisa lewat     │
│                                                     │ tindakan pengguna                                                                                                                           │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Startup                                             │ Lihat matriks G.3                                                                                                                           │
├─────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ State reservasi paling aman bila reject berhasil    │ RESERVED (bila sempat dibuat). Dilepas saat startup. Aman karena approval hanya mungkin setelah Tx-ENTER                                    │
│ tetapi DB tidak mencatat                            │                                                                                                                                             │
└─────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Urutan yang ada dipertahankan: reject() lalu Tx-BLOCK (runner.py:201-204).

Alternatif OD-33 (OPEN, tidak diasumsikan): tulis intent blok secara durable terlebih dahulu, lalu reject(), lalu Tx-BLOCK. Bila intent tidak bisa ditulis (DB tidak tersedia), jangan reject. Dialog tetap terbuka dan reconcile berakhir MANUAL (pengguna yang me-reject). Ini mencegah aksi eksternal yang tidak tercatat, tetapi mengubah urutan semantik reject(), sehingga butuh CC-19.

L2.8 Jaminan konkurensi

┌──────────────────────────┬────────────────────────────────────────────────────────┬───────────┬─────────────────────────────────────────────────────────────────────────────────────────────────┐
│         Lapisan          │                        Jaminan                         │   Batas   │                                               AC                                                │
├──────────────────────────┼────────────────────────────────────────────────────────┼───────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ A. Eksklusivitas         │ Satu proses per workspace; proses kedua menerima       │ L2.6      │ L2-AC-9a, L2-AC-9b, L2-AC-27                                                                    │
│ aplikasi                 │ WorkspaceLockedError                                   │           │                                                                                                 │
├──────────────────────────┼────────────────────────────────────────────────────────┼───────────┼─────────────────────────────────────────────────────────────────────────────────────────────────┤
│ B. Atomisitas reservasi  │ BEGIN IMMEDIATE, CAS, indeks unik parsial, idempotency │ Satu file │ L2-AC-1, -2, -3, -7. Diuji dengan subprocess yang memanggil lapisan reservasi langsung,         │
│ di DB                    │                                                        │  DB       │ melewati lock khusus untuk tes ini (OD-24)                                                      │
└──────────────────────────┴────────────────────────────────────────────────────────┴───────────┴─────────────────────────────────────────────────────────────────────────────────────────────────┘

Spesifikasi ini tidak mengklaim dukungan banyak instance maupun keamanan multi-mesin.

Melepas RESERVED saat startup tetap aman walaupun lapisan A gagal: Tx-ENTER mensyaratkan RESERVED, jadi pemilik lama akan gagal di CAS.

L2.9 Intervensi manual

Intervensi manual wajib untuk:
- UNKNOWN (OD-20);
- kegagalan Tx-COMMIT;
- konflik idempotency;
- cap tercapai atau belum ada grant;
- saldo belum diperbarui (OD-11);
- BUSY_TIMEOUT_MISMATCH;
- workspace tidak kanonik;
- dialog yang masih terbuka atau statusnya tidak diketahui.

---

G. Matriks transaksi dan pemulihan crash

G.1 Urutan

1. Akuisisi.
2. Gate pendahuluan.
3. confirm.
4. SG.
5. authorize_approval (CONSUMED).
6. Tx-RESERVE.
7. Tx-ENTER.
8. approve().
9. Tx-COMMIT.

Tidak ada approval bila langkah 1, 4, 5, 6 atau 7 gagal. Tidak ada retry approval maupun reject secara otomatis.

Atomisitas hanya berlaku untuk record yang benar-benar dimutasi. COMMIT yang gagal dianggap INDETERMINATE (OD-29, CC-14): satu kali ROLLBACK, koneksi tidak dipakai lagi, dan langkah berikutnya tidak dijalankan.

G.2 Spesifikasi per transaksi

Tx: Tx-RESERVE
Tujuan: Memesan budget
Precondition: Lock dan owner_token aktif; reading CONSUMED; attempt AWAITING_COST_CONFIRMATION; akun cocok; grant terbuka; tidak ada reservasi aktif; ledger_last ∉ SPENT_OR_MAYBE; used + cost ≤ cap;
  cost ≤ observed − reserve; OD-11
State sebelum: Tidak ada reservasi
Operasi DB: SELECT; INSERT reservasi; INSERT event
State sesudah: RESERVED
Ledger: —
Attempt: Precondition saja
Aksi eksternal: Belum ada approval
Bila gagal: Precondition gagal: Budget*Error, rollback, Tx-BLOCK. Busy: DB_LOCK_TIMEOUT, rollback, Tx-BLOCK. INDETERMINATE: berhenti tanpa approve maupun reject
Idempotency: Key dan parameter sama, owner sama, RESERVED: baris yang ada dikembalikan. Selain itu konflik. attempt_id UNIQUE
Reconcile: RESERVED yatim dilepas saat startup
────────────────────────────────────────
Tx: Tx-ENTER
Tujuan: Write-ahead sebelum klik
Precondition: RESERVED dengan owner aktif; attempt AWAITING_COST_CONFIRMATION; ledger_last ∉ SPENT_OR_MAYBE
State sebelum: RESERVED
Operasi DB: CAS ke APPROVING (rowcount = 1); event; ledger APPROVING
State sesudah: APPROVING
Ledger: APPROVING
Attempt: Alt-A: hanya precondition, tidak dimutasi. Alt-B dan Alt-C (OD-19) memutasi attempt
Aksi eksternal: Belum ada approval
Bila gagal: Rowcount ≠ 1: rollback, Tx-BLOCK. Busy: rollback, Tx-BLOCK, tanpa retry. INDETERMINATE: tanpa approve dan tanpa reject; error diteruskan
Idempotency: CAS hanya berhasil sekali
Reconcile: Bila committed: maybe_spent, tidak pernah READY
────────────────────────────────────────
Tx: Tx-COMMIT
Tujuan: Mencatat approval
Precondition: approve() kembali normal; APPROVING dengan owner aktif; ledger APPROVING; attempt AWAITING_COST_CONFIRMATION
State sebelum: APPROVING
Operasi DB: CAS ke COMMITTED; event; ledger APPROVED; attempt ke RENDERING dengan state_event
State sesudah: COMMITTED, RENDERING
Ledger: APPROVED
Attempt: Dimutasi (atomik dengan dua record lain)
Aksi eksternal: Approval mungkin sudah terjadi
Bila gagal: Busy atau INDETERMINATE: tidak dianggap berhasil, tidak ada retry approve() maupun Tx-COMMIT, record tetap (AWAITING, APPROVING, APPROVING), error diteruskan
Idempotency: CAS
Reconcile: Wajib bila gagal
────────────────────────────────────────
Tx: Tx-BLOCK
Tujuan: Mencatat penolakan setelah reject() kembali normal
Precondition: Tidak ada APPROVING; ledger_last ∉ SPENT_OR_MAYBE; reservasi tidak ada atau RESERVED dengan owner aktif
State sebelum: Reservasi tidak ada atau RESERVED
Operasi DB: Ledger REJECTED; bila ada reservasi, RESERVED ke RELEASED dengan block_code; attempt ke NEEDS_MANUAL_INTERVENTION dengan error_code = block_code
State sesudah: RELEASED atau tidak ada; MANUAL
Ledger: REJECTED dengan semantik yang ada: "reject() dipanggil", bukan "pengguna menolak". Penyebabnya di block_code (OD-26)
Attempt: Dimutasi
Aksi eksternal: reject() sudah dipanggil
Bila gagal: Lihat G.3
Idempotency: Precondition mencegah pencatatan ganda
Reconcile: Lihat G.3
────────────────────────────────────────
Tx: Tx-REC-UNKNOWN
Tujuan: Hasil yang tidak pasti
Precondition: Attempt RECONCILING; decide() menghasilkan MANUAL; ledger terakhir APPROVING
State sebelum: APPROVING atau tidak ada (baris lama)
Operasi DB: Ledger UNKNOWN_AFTER_CRASH; reservasi ke UNKNOWN; attempt ke MANUAL
State sesudah: UNKNOWN; MANUAL
Ledger: UNKNOWN_AFTER_CRASH
Attempt: Dimutasi
Aksi eksternal: Approval mungkin sudah terjadi
Bila gagal: Rollback; tetap RECONCILING lalu diulang
Idempotency: Bila ledger sudah UNKNOWN, hanya attempt yang menjadi MANUAL (runner.py:330)
Reconcile: —
────────────────────────────────────────
Tx: Tx-REC-FOUND
Tujuan: Hasil terbukti ada
Precondition: Attempt RECONCILING; ledger ∈ {APPROVING, UNKNOWN}; reservasi ∈ {APPROVING, UNKNOWN} atau tidak ada; inspected_ok; tepat satu tile baru; maybe_spent; tidak failed; state_known. RENDERING
  bila belum complete; COMPLETED bila complete dan ada media_id (reconcile.py:61-91)
State sebelum: Seperti precondition
Operasi DB: Ledger APPROVED; reservasi ke COMMITTED; attempt ke RENDERING atau COMPLETED
State sesudah: COMMITTED
Ledger: APPROVED
Attempt: Dimutasi
Aksi eksternal: Approval dianggap mendarat. Atribusi tile adalah INFERENCE (batasan 4)
Bila gagal: Ambigu (lebih dari satu tile, gagal, tidak dikenal setelah grace, complete tanpa id, tidak bisa diinspeksi): MANUAL atau Tx-REC-UNKNOWN. Bertentangan (DOWNLOADED atau COMPLETED lewat
  flow_media_id tanpa COMMITTED): MANUAL tanpa mutasi reservasi (OD-26). Bukti saldo tidak dipakai
Idempotency: CAS
Reconcile: —
────────────────────────────────────────
Tx: Startup
Tujuan: Pemulihan
Precondition: —
State sebelum: —
Operasi DB: (1) lock, kalau gagal WorkspaceLockedError; (2) buka DB dan readback 5000; (3) per reservasi, RESERVED dengan token lain ke RELEASED; (4) startup_scan
State sesudah: —
Ledger: —
Attempt: FLOW_SIDE ke RECONCILING
Aksi eksternal: Tidak ada
Bila gagal: Error diteruskan; tidak ada operasi Flow sebelum selesai
Idempotency: —
Reconcile: APPROVING dan UNKNOWN tidak disentuh

Sebelum dan sesudah approval:
- Sebelum (timeout di Tx-RESERVE atau Tx-ENTER): gagal tertutup, tanpa approval, tanpa retry, tanpa reservasi kedua, dan bisa direkonsiliasi.
- Sesudah approval mungkin terjadi (timeout Tx-COMMIT, kegagalan DB sesudah approval, atau approve() melempar error dan hasilnya ambigu): approval tidak dianggap tidak terjadi, tidak ada pengulangan, dan record tetap APPROVING untuk reconcile.
- Approval kedua untuk attempt yang sama secara struktural mustahil:
  - Tx-RESERVE menolak karena ledger termasuk SPENT_OR_MAYBE dan attempt_id UNIQUE;
  - Tx-ENTER mensyaratkan RESERVED;
  - B3 memblokir attempt lain di akun ini;
  - decide() tidak pernah menghasilkan READY bila maybe_spent.

G.3 Matriks kegagalan Tx-BLOCK (R4-3)

Titik kegagalan: Safety block (gate pendahuluan); reject() berhasil; Tx-BLOCK busy atau timeout
Aksi eksternal mungkin sudah terjadi?: Reject: ya (dilaporkan). Approval: tidak
State DB diketahui?: Ya setelah dibuka ulang: tidak ada perubahan (rollback). Blok tidak tercatat
State aman: (AWAITING, tanpa ledger keputusan, tanpa reservasi)
Pemulihan: Error diteruskan. Startup ke RECONCILING. pending_confirmation False berarti READY (perilaku decide yang ada); True atau None berarti MANUAL. Kondisi safety dievaluasi ulang pada keputusan
  berikutnya
Retry?: Reject: tidak. Approval: tidak
────────────────────────────────────────
Titik kegagalan: Cap terlampaui (Tx-RESERVE rollback bersih); reject() berhasil; Tx-BLOCK gagal
Aksi eksternal mungkin sudah terjadi?: Sama
State DB diketahui?: Sama
State aman: Sama
Pemulihan: Sama. Cap akan menolak lagi karena berasal dari DB
Retry?: Tidak
────────────────────────────────────────
Titik kegagalan: DB busy di Tx-RESERVE; reject(); Tx-BLOCK juga busy
Aksi eksternal mungkin sudah terjadi?: Sama
State DB diketahui?: Sama
State aman: Sama
Pemulihan: Sama
Retry?: Tidak
────────────────────────────────────────
Titik kegagalan: Busy timeout di Tx-BLOCK sendiri
Aksi eksternal mungkin sudah terjadi?: Sama
State DB diketahui?: Sama
State aman: Sama atau RESERVED
Pemulihan: Sama. RESERVED dilepas saat startup
Retry?: Tidak
────────────────────────────────────────
Titik kegagalan: Konflik reservasi (CAS Tx-ENTER gagal); reject(); Tx-BLOCK
Aksi eksternal mungkin sudah terjadi?: Reject: ya. Approval: tidak
State DB diketahui?: Ya
State aman: Reservasi tidak dilepas bila bukan RESERVED milik owner ini. Bila ledger termasuk SPENT_OR_MAYBE, Tx-BLOCK menolak dan state dibiarkan
Pemulihan: Precondition gagal berarti BudgetConflictError diteruskan, lalu reconcile. Bila maybe_spent, tidak pernah READY
Retry?: Tidak
────────────────────────────────────────
Titik kegagalan: Kegagalan provenance atau SG (tidak ada konsumsi, atau CONSUMED untuk opsi OD-8); reject(); Tx-BLOCK gagal
Aksi eksternal mungkin sudah terjadi?: Reject: ya
State DB diketahui?: Ya
State aman: (AWAITING, –, –)
Pemulihan: Seperti baris 1. Reading dibuang
Retry?: Tidak
────────────────────────────────────────
Titik kegagalan: Penolakan pengguna (NOT_CONFIRMED_BY_USER); reject(); Tx-BLOCK gagal
Aksi eksternal mungkin sudah terjadi?: Reject: ya
State DB diketahui?: Ya
State aman: Sama
Pemulihan: Seperti baris 1. Penolakan pengguna tidak tercatat, sehingga pengguna bisa ditanya lagi setelah READY. Untuk mempertahankannya dibutuhkan marker durable (OD-33). Penolakan pengguna tidak
  pernah dicatat sebagai safety block, dan sebaliknya
Retry?: Tidak
────────────────────────────────────────
Titik kegagalan: reject() melempar error (adapter live: BlockedOperationError, atau error lain)
Aksi eksternal mungkin sudah terjadi?: Hasil reject tidak diketahui
State DB diketahui?: Ya: Tx-BLOCK tidak dijalankan
State aman: (AWAITING, –, RESERVED atau tidak ada)
Pemulihan: Error diteruskan. Reconcile: dialog terbuka atau tidak diketahui berarti MANUAL (pengguna yang me-reject)
Retry?: Reject otomatis: tidak (OD-34)
────────────────────────────────────────
Titik kegagalan: reject() berhasil, Tx-BLOCK INDETERMINATE
Aksi eksternal mungkin sudah terjadi?: Reject: ya
State DB diketahui?: Tidak, sampai DB dibuka ulang
State aman: Kedua kemungkinan aman (MANUAL tercatat, atau seperti baris 1)
Pemulihan: Baca ulang saat startup, lalu reconcile
Retry?: Tidak
────────────────────────────────────────
Titik kegagalan: Tx-ENTER INDETERMINATE
Aksi eksternal mungkin sudah terjadi?: Tidak ada approve maupun reject
State DB diketahui?: Tidak
State aman: Bila committed: maybe_spent, lalu MANUAL atau UNKNOWN (budget dihitung terpakai). Bila tidak committed: dialog terbuka, lalu MANUAL
Pemulihan: Reconcile; pelepasan lewat OD-20
Retry?: Tidak

Pertahankan UNKNOWN atau MANUAL bila:
- ledger pernah APPROVING;
- dialog terbuka atau statusnya tidak diketahui;
- tile ambigu;
- bukti bertentangan;
- hasil DB INDETERMINATE.

Reservasi yang tidak pasti: jalur Tx-BLOCK tidak pernah menyentuh APPROVING. Satu-satunya state yang tidak pasti adalah RESERVED yang belum dilepas, dan itu aman.

G.4 Jendela crash

┌─────┬──────────────────────────────────────┬──────────────────────────────────────┬────────────────────────────────────────────────────────┬─────────────────┐
│  #  │                Titik                 │            State durable             │                       Pemulihan                        │ Approval kedua? │
├─────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────────────────────────┼─────────────────┤
│ 1   │ Sebelum Tx-RESERVE                   │ (AWAITING, –, –)                     │ RECONCILING; READY hanya bila dialog terbukti tertutup │ Tidak           │
├─────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────────────────────────┼─────────────────┤
│ 2   │ Setelah Tx-RESERVE                   │ (AWAITING, –, RESERVED)              │ RELEASED, lalu seperti #1                              │ Tidak           │
├─────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────────────────────────┼─────────────────┤
│ 3   │ Setelah Tx-ENTER                     │ (AWAITING, APPROVING, APPROVING)     │ RECONCILING, lalu Tx-REC-*                             │ Tidak (G.2)     │
├─────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────────────────────────┼─────────────────┤
│ 4   │ Tepat sebelum approve()              │ Sama dengan #3                       │ Sama                                                   │ Tidak           │
├─────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────────────────────────┼─────────────────┤
│ 5   │ Selama approve()                     │ Sama dengan #3                       │ Sama                                                   │ Tidak           │
├─────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────────────────────────┼─────────────────┤
│ 6   │ Setelah approve(), sebelum Tx-COMMIT │ Sama dengan #3                       │ Sama                                                   │ Tidak           │
├─────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────────────────────────┼─────────────────┤
│ 7   │ Tx-COMMIT timeout atau INDETERMINATE │ Sama dengan #3, atau sudah committed │ Error diteruskan; startup; reconcile                   │ Tidak           │
├─────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────────────────────────┼─────────────────┤
│ 8   │ Selama reconcile                     │ RECONCILING                          │ Diulang; Tx-REC-* atomik; observasi read-only          │ Tidak           │
├─────┼──────────────────────────────────────┼──────────────────────────────────────┼────────────────────────────────────────────────────────┼─────────────────┤
│ 9   │ Di antara reject() dan Tx-BLOCK      │ Seperti baris 1 di G.3               │ Seperti G.3                                            │ Tidak           │
└─────┴──────────────────────────────────────┴──────────────────────────────────────┴────────────────────────────────────────────────────────┴─────────────────┘

---

D. Register keputusan terbuka (35 OD: 3 CLOSED, 29 OPEN, 3 DEFERRED, 0 REJECTED)

Kolom terakhir menunjukkan otoritas penutup: U = keputusan pengguna, DR = document review, CR = code review, T = tes, L = observasi live.

┌─────────┬──────────────────────────────┬──────────────────┬─────────────────────────────┬───────────────────────────────────────┬──────────────┬─────────────────────┬───────────────┬──────────┐
│   OD    │            Topik             │      Status      │     Keputusan yang ada      │          Pertanyaan terbuka           │  Dependensi  │       Risiko        │     Bukti     │ Otoritas │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-1    │ Normalisasi host             │ OPEN             │ —                           │ Literal persis?                       │ L1.6         │ Salah tolak atau    │ LIVE-OBS-3    │ U, L     │
│         │                              │                  │                             │                                       │              │ salah terima        │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-2    │ Query, fragment, garis       │ OPEN             │ —                           │ Tolak semua?                          │ L1.6         │ Salah tolak         │ LIVE-OBS-3    │ U, L     │
│         │ miring                       │                  │                             │                                       │              │                     │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-3    │ Identitas dokumen            │ DEFERRED         │ —                           │ timeOrigin + URL cukup?               │ U-2          │ Navigasi SPA tidak  │ LIVE-OBS-2    │ L, U     │
│         │                              │                  │                             │                                       │              │ terdeteksi          │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-4    │ Pembatasan snapshot ke main  │ DEFERRED         │ —                           │ Iframe ikut masuk?                    │ U-1          │ Teks iframe terbaca │ LIVE-OBS-1    │ L, U     │
│         │ frame                        │                  │                             │                                       │              │                     │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-5    │ Fingerprint yang diharapkan  │ OPEN             │ —                           │ Sumbernya                             │ Grant        │ Akun salah          │ —             │ U        │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-6    │ Binding TEST                 │ OPEN             │ —                           │ Daftarkan evidence TEST?              │ CC-8         │ Tes lemah           │ —             │ U, T     │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-7    │ Kelas adapter live           │ OPEN             │ —                           │ Tipe persis?                          │ SG           │ Adapter baru lolos  │ Static        │ U, CR    │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-8    │ Revalidasi URL (di SG; opsi  │ OPEN             │ —                           │ Satu atau dua kali?                   │ L1.8         │ Navigasi tidak      │ —             │ U        │
│         │ kedua sesudah authorize)     │                  │                             │                                       │              │ terdeteksi          │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│         │ Bentuk publik                │                  │ BALANCE_READING_* tidak     │ Kode string atau Block baru           │              │                     │               │          │
│ OD-9    │ SOURCE_MISMATCH              │ OPEN             │ boleh (pin :314)            │ (non-BALANCE_READING_), atau pakai    │ OD-32        │ Diagnosis kabur     │ CR            │ U, CR    │
│         │                              │                  │                             │ ulang IDENTITY_MISMATCH               │              │                     │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-10   │ Nilai cap                    │ OPEN             │ Eksplisit, tanpa default    │ Nilainya                              │ Grant        │ Tidak bisa dipakai  │ —             │ U        │
│         │                              │                  │                             │                                       │              │ (aman)              │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-11   │ Saldo belum diperbarui       │ OPEN             │ —                           │ Aturan kesegaran                      │ U-3          │ Saldo basi          │ Tidak bisa    │ U        │
│         │                              │                  │                             │                                       │              │                     │ tanpa kredit  │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-12   │ Busy timeout                 │ CLOSED           │ 5000 ms                     │ —                                     │ —            │ —                   │ —             │ —        │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-13   │ Tab di engine.py             │ OPEN             │ —                           │ Masuk cakupan?                        │ —            │ Tab salah (SG tetap │ —             │ U        │
│         │                              │                  │                             │                                       │              │  menolak)           │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-14   │ Workspace kanonik dan FS     │ OPEN             │ —                           │ Identitas (dev, ino), symlink,        │ L2.6, CC-15  │ Lock tidak efektif  │ CR, T         │ U, CR, T │
│         │                              │                  │                             │ relatif, FS                           │              │                     │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-15   │ Pemakaian manual             │ OPEN             │ Di luar jaminan             │ Kebijakan operasional                 │ —            │ Tertukar            │ —             │ U        │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-16   │ Satu reservasi per attempt   │ OPEN             │ —                           │ Konfirmasi                            │ Skema        │ —                   │ —             │ U        │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-17   │ reject() di jalur blok       │ OPEN             │ Semantik yang ada           │ Konfirmasi                            │ G.3          │ —                   │ —             │ U        │
│         │                              │                  │ dipertahankan (FACT)        │                                       │              │                     │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-18   │ Observasi live               │ DEFERRED         │ Tidak diizinkan             │ Izin dan cakupan                      │ OD-3, 4, 31  │ U-1 dan U-2 tetap   │ —             │ U        │
│         │                              │                  │                             │                                       │              │ terbuka             │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-19   │ Penanda durable approval     │ OPEN             │ —                           │ Alt-A, B atau C                       │ CC-13        │ Atomisitas Tx-ENTER │ CR            │ U, CR    │
│         │                              │                  │                             │                                       │              │  terbatas           │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-20   │ Pelepasan manual UNKNOWN     │ OPEN             │ Tidak otomatis              │ Siapa, bukti apa, audit apa           │ L2.4         │ Budget terkunci     │ —             │ U        │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-21   │ —                            │ RETIRED (tidak   │ Tidak pernah dipakai        │ —                                     │ —            │ —                   │ —             │ —        │
│         │                              │ dihitung)        │                             │                                       │              │                     │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-22   │ Process lock                 │ CLOSED           │ Satu proses per workspace;  │ Cakupan (OD-14)                       │ —            │ —                   │ —             │ —        │
│         │                              │                  │ WorkspaceLockedError        │                                       │              │                     │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-23   │ TrustedFrameView             │ OPEN             │ Lima operasi (PROPOSAL)     │ Persetujuan; teks DOC_IDENTITY_JS     │ CC-10, OD-31 │ Permukaan API       │ CR, T         │ U, CR, T │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-24   │ Bypass lock di harness       │ OPEN             │ Hanya di tests/             │ Mekanismenya                          │ L2-AC-1–3    │ Bocor ke produksi   │ CR, static    │ U, CR    │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│         │                              │ CLOSED:          │ Tidak dipakai, dihentikan,  │                                       │              │                     │ L2-AC-14      │          │
│ OD-25   │ Readback timeout             │ FAIL-CLOSED      │ tanpa fallback, tanpa retry │ — (belum diimplementasi)              │ —            │ —                   │ nanti         │ —        │
│         │                              │ REQUIREMENT      │                             │                                       │              │                     │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-26   │ Outcome ledger untuk blok    │ OPEN             │ REJECTED tetap              │ Outcome terpisah?                     │ G.2, G.3     │ Audit kabur         │ —             │ U        │
│         │ dan bukti bertentangan       │                  │                             │                                       │              │                     │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-27   │ Tipe dan rentang cap, cost,  │ OPEN             │ NOT NULL tanpa DEFAULT      │ CHECK, tipe                           │ OD-10        │ Minimum yang        │ —             │ U        │
│         │ saldo                        │                  │                             │                                       │              │ dikarang            │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-28   │ sqlite_errorcode di runtime  │ OPEN             │ Berbasis kode               │ Ketersediaan dan nilai                │ L2.5         │ Salah klasifikasi   │ CR stdlib, T  │ CR, T    │
│         │                              │                  │                             │                                       │              │ (gagal tertutup)    │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-29   │ Kegagalan COMMIT di _tx      │ OPEN             │ FACT: tidak di-rollback     │ Penanganan INDETERMINATE              │ CC-14        │ Transaksi           │ CR, T         │ U, CR, T │
│         │                              │                  │                             │                                       │              │ tertinggal terbuka  │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-30   │ Format project id            │ OPEN             │ Regex bukan UUID kanonik    │ Format; perlu CC?                     │ L1.6         │ Id aneh diterima    │ LIVE-OBS-3    │ U, L     │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│         │                              │ OPEN             │                             │                                       │              │ Tidak bisa dipakai, │ CR            │          │
│ OD-31   │ Identitas page.main_frame    │ (UNVERIFIED)     │ Bila gagal, ditolak         │ Stabil? Tetap sama melewati navigasi? │ L1.5         │  atau navigasi      │ Playwright,   │ CR, T, L │
│         │                              │                  │                             │                                       │              │ tidak terdeteksi    │ T, L          │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-32   │ Arsitektur L-1: L1-X atau    │ OPEN             │ —                           │ Pilihannya                            │ CC-1–6,      │ L1-Y mengubah       │ DR            │ U, DR    │
│ (baru)  │ L1-Y                         │                  │                             │                                       │ CC-17, CC-18 │ banyak kontrak R-2  │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-33   │ Marker intent sebelum        │                  │ Urutan yang ada             │ Tulis intent dulu? Tidak reject bila  │              │ Penolakan pengguna  │               │          │
│ (baru)  │ reject()                     │ OPEN             │ dipertahankan               │ DB mati?                              │ CC-19        │ atau blok hilang    │ DR            │ U        │
│         │                              │                  │                             │                                       │              │ dari catatan        │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-34   │ Kontrak idempotency dan      │                  │                             │                                       │              │ Reject ganda bila   │               │          │
│ (baru)  │ konfirmasi reject()          │ OPEN             │ Tidak dianggap idempotent   │ Bukti dari Flow                       │ OD-18        │ kelak dibuat        │ L             │ U, L     │
│         │                              │                  │                             │                                       │              │ otomatis            │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│         │ Bentuk final RI              │                  │                             │                                       │              │                     │               │          │
│ OD-35   │ reservation_event (FK        │ OPEN             │ FK dan trigger diusulkan    │ T5 otomatis atau lewat API?           │ CC-11        │ Event tidak lengkap │ CR, T         │ U, CR    │
│ (baru)  │ komposit; event lewat        │                  │                             │                                       │              │                     │               │          │
│         │ trigger)                     │                  │                             │                                       │              │                     │               │          │
├─────────┼──────────────────────────────┼──────────────────┼─────────────────────────────┼───────────────────────────────────────┼──────────────┼─────────────────────┼───────────────┼──────────┤
│ OD-36   │ Kebijakan update grant dan   │ OPEN             │ —                           │ Cap immutable? Hanya closed_at?       │ CC-11        │ Cap diubah          │ —             │ U        │
│ (baru)  │ kolom immutable              │                  │                             │                                       │              │ diam-diam           │               │          │
└─────────┴──────────────────────────────┴──────────────────┴─────────────────────────────┴───────────────────────────────────────┴──────────────┴─────────────────────┴───────────────┴──────────┘

Rekonsiliasi hitungan:
- Revision 3 punya 30 ID aktif (3 CLOSED, 24 OPEN, 3 DEFERRED). Angka "21" di ringkasan Revision 3 salah hitung.
- Revision 4 menambah 5 OD OPEN (OD-32 sampai OD-36), sehingga totalnya 35 = 3 CLOSED + 29 OPEN + 3 DEFERRED + 0 REJECTED.
- Tidak ada ID yang diganti nomornya, dan tidak ada duplikat.

---

E. Register acceptance criteria

Semua AC berstatus NOT RUN, hanya spesifikasi. Tidak ada yang lulus. Kolom "Live?" menandai AC yang butuh observasi live.

L-1

┌──────────────┬────────────────────────────────────────────────────────┬────────────────────────────────────┬────────────────────────────┬───────────────┬──────────┬────────────┬─────────────┐
│      ID      │                      Requirement                       │           Perilaku aman            │    Perilaku saat gagal     │     Bukti     │   Tipe   │ Dependensi │    Live?    │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-1      │ URL kanonik diterima                                   │ Evidence L-1 terdaftar             │ —                          │ Double        │ UNIT     │ OD-1, 2    │ Tidak       │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-2      │ URL atau dokumen berubah antara pre dan post           │ Tidak ada evidence L-1             │ SourceEvidenceError, tidak │ Double        │ UNIT     │ OD-3       │ Tidak       │
│              │                                                        │                                    │  FAULTED                   │               │          │            │             │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-3      │ Bukan main frame, detached, atau fingerprint beda      │ Tidak ada evidence                 │ Sama                       │ Double        │ UNIT     │ OD-5       │ Tidak       │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-4      │ Reading tanpa evidence dipakai untuk adapter live      │ SOURCE_MISMATCH; R-2 tidak         │ Tidak ada konsumsi         │ Spy           │ UNIT     │ OD-32      │ Tidak       │
│              │                                                        │ dipanggil                          │                            │               │          │            │             │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-5      │ Adapter atau page berbeda                              │ Sama                               │ Sama                       │ Double        │ UNIT     │ —          │ Tidak       │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-6      │ URL berubah setelah akuisisi                           │ Sama                               │ Sama                       │ Double        │ UNIT     │ OD-8       │ Tidak       │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-7      │ Evidence tidak bisa diubah lewat reading               │ Tetap                              │ —                          │ Double        │ UNIT     │ —          │ Tidak       │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-8      │ Akuisisi tepercaya hanya dari GoogleFlowAgentAdapter;  │ —                                  │ Tes gagal                  │ AST           │ STATIC   │ OD-7       │ Tidak       │
│              │ tidak ada API terlarang                                │                                    │                            │               │          │            │             │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-9      │ Registrasi L-1 setelah post-check                      │ Urutan sesuai L1.7                 │ —                          │ Spy           │ UNIT     │ —          │ Tidak       │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-10     │ Matriks URL non-kanonik                                │ Semua ditolak                      │ SourceEvidenceError        │ Tabel         │ UNIT     │ OD-1, 2,   │ Tidak       │
│              │                                                        │                                    │                            │               │          │ 30         │             │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-11     │ Tipe hasil view salah                                  │ Ditolak                            │ Sama                       │ Double        │ UNIT     │ OD-23      │ Tidak       │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-12     │ View hanya punya lima operasi                          │ —                                  │ Tes gagal                  │ AST           │ STATIC   │ OD-23      │ Tidak       │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-13     │ DOC_IDENTITY_JS konstan dan read-only                  │ —                                  │ Tes gagal                  │ Review dan    │ STATIC,  │ OD-23      │ Tidak       │
│              │                                                        │                                    │                            │ pin           │ CR       │            │             │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-14     │ View tidak keluar dari akuisisi                        │ —                                  │ Tes gagal                  │ AST           │ STATIC   │ —          │ Tidak       │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-15     │ Objek frame berbeda saat post-check                    │ Ditolak                            │ Sama                       │ Double        │ UNIT     │ OD-31      │ Tidak       │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-16     │ Regex adapter.py:40 tidak berubah tanpa CC             │ —                                  │ Pin                        │ Integrity     │ STATIC   │ OD-30      │ Tidak       │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-17     │ Tabel kombinasi L1.9                                   │ Outcome persis seperti tabel       │ —                          │ Matriks       │ UNIT     │ OD-32, 9   │ Tidak       │
│ (baru)       │                                                        │                                    │                            │               │          │            │             │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-18     │ Registry L-1 tidak pernah memasang atau membaca        │ —                                  │ Tes gagal                  │ AST dan       │ STATIC,  │ —          │ Tidak       │
│ (baru)       │ FAULTED R-2; tidak ada lock bertingkat                 │                                    │                            │ subprocess    │ SUB      │            │             │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-19     │ view.locator hanya menerima "body"                     │ Argumen lain raise                 │ —                          │ Double        │ UNIT     │ OD-23      │ Tidak       │
│ (baru)       │                                                        │                                    │                            │               │          │            │             │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ L1-AC-20     │ provenance.py, gates.py dan pin R-2 :306-314, :474-485 │ —                                  │ Pin                        │ Integrity     │ STATIC   │ OD-32      │ Tidak       │
│ (baru)       │  tidak berubah (L1-X)                                  │                                    │                            │               │          │            │             │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ LIVE-OBS-1   │ U-1 (iframe)                                           │ —                                  │ —                          │ Observasi     │ LIVE     │ OD-18      │ Ya          │
│              │                                                        │                                    │                            │               │          │            │ (DEFERRED)  │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ LIVE-OBS-2   │ U-2 (navigasi SPA)                                     │ —                                  │ —                          │ Observasi     │ LIVE     │ OD-18      │ Ya          │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ LIVE-OBS-3   │ Bentuk URL dan id                                      │ —                                  │ —                          │ Observasi     │ LIVE     │ OD-18      │ Ya          │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ LIVE-OBS-4   │ U-3 dan U-4                                            │ Tidak bisa dijawab tanpa kredit;   │ —                          │ —             │ —        │ —          │ Tidak       │
│              │                                                        │ ditangani konservatif              │                            │               │          │            │ berlaku     │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ LIVE-OBS-5   │ OD-31 di Flow                                          │ —                                  │ —                          │ Observasi     │ LIVE     │ OD-18      │ Ya          │
├──────────────┼────────────────────────────────────────────────────────┼────────────────────────────────────┼────────────────────────────┼───────────────┼──────────┼────────────┼─────────────┤
│ SPEC-AC-L1   │ Konsistensi dokumen L-1                                │ —                                  │ —                          │ Review        │ SPEC     │ —          │ Tidak       │
└──────────────┴────────────────────────────────────────────────────────┴────────────────────────────────────┴────────────────────────────┴───────────────┴──────────┴────────────┴─────────────┘

L-2

┌──────────────┬─────────────────────────────────────────────────────┬─────────────────────────────────────────────┬───────────────────────┬─────────────────────┬───────────┬────────────┬───────┐
│      ID      │                     Requirement                     │                Perilaku aman                │  Perilaku saat gagal  │        Bukti        │   Tipe    │ Dependensi │ Live? │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-1      │ Lapisan B: N subprocess, akun sama, melewati lock   │ Tepat 1 berhasil                            │ RESERVATION_ACTIVE    │ Baris               │ SUB, DBI  │ OD-24      │ Tidak │
│              │ (khusus tes)                                        │                                             │                       │                     │           │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-2      │ Cap tidak pernah terlampaui                         │ Jumlah ≤ cap                                │ BUDGET_CAP            │ Jumlah              │ SUB, DBI  │ OD-10, 27  │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-3      │ Idempotency key sama                                │ Satu baris, satu CAS                        │ Konflik               │ Baris dan           │ SUB, DBI  │ —          │ Tidak │
│              │                                                     │                                             │                       │ penghitung          │           │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-4      │ Crash di G.4 #1–#9                                  │ State sesuai tabel                          │ —                     │ os._exit            │ SUB       │ OD-19      │ Tidak │
│              │                                                     │                                             │                       │ disuntikkan         │           │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-5      │ Tidak ada pelepasan otomatis APPROVING dan UNKNOWN  │ Tetap                                       │ —                     │ Clock palsu         │ UNIT, DBI │ —          │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-6      │ RESERVED dengan token lain dilepas saat startup;    │ Tidak ada approval                          │ Konflik               │ Subprocess          │ SUB       │ —          │ Tidak │
│              │ CAS pemilik lama gagal                              │                                             │                       │                     │           │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-7      │ Busy lebih dari 5000 ms di Tx-RESERVE atau Tx-ENTER │ Tidak ada approval, tidak ada baris baru    │ DB_LOCK_TIMEOUT       │ Penahan             │ SUB, DBI  │ OD-28      │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-8      │ Trigger T1–T4                                       │ Ditolak                                     │ ABORT                 │ SQLite              │ DBI       │ OD-35      │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-9a     │ Proses aplikasi kedua                               │ Ditolak                                     │ WorkspaceLockedError  │ Subprocess          │ SUB       │ OD-14      │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-9b     │ Lock lepas setelah proses dibunuh                   │ Proses baru berhasil                        │ —                     │ Subprocess          │ SUB       │ —          │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-10     │ FK komposit grant, akun dan attempt                 │ Ditolak                                     │ IntegrityError        │ SQLite              │ DBI       │ —          │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-11     │ Crash di antara pernyataan dalam Tx                 │ Rollback penuh                              │ —                     │ Injeksi             │ DBI, SUB  │ —          │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-12     │ Ulang setelah timeout                               │ Tidak ada baris kedua                       │ —                     │ Baris               │ DBI       │ —          │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-13     │ Grant tanpa cap                                     │ Ditolak                                     │ Error                 │ API dan DB          │ UNIT, DBI │ OD-27      │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-14     │ Readback bukan 5000                                 │ Koneksi tidak dipakai                       │ BUSY_TIMEOUT_MISMATCH │ Double              │ UNIT      │ —          │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-15     │ Klasifikasi kode error                              │ Hanya BUSY dan LOCKED yang dipetakan        │ Lainnya diteruskan    │ Exception buatan    │ UNIT, DBI │ OD-28      │ Tidak │
│              │                                                     │                                             │                       │ dan DB nyata        │           │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-16     │ Tx-COMMIT timeout setelah approve                   │ Penghitung approve = 1; record APPROVING    │ Error diteruskan      │ FakeFlow            │ SUB       │ —          │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-17     │ Tx-REC-FOUND hanya dengan bukti lengkap             │ Tabel G.2                                   │ MANUAL                │ FakeFlow            │ UNIT      │ OD-26      │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-18     │ block_code per penyebab; REJECTED bukan penolakan   │ —                                           │ —                     │ Matriks             │ UNIT, DBI │ OD-26      │ Tidak │
│              │ pengguna                                            │                                             │                       │                     │           │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-19     │ COMMIT INDETERMINATE                                │ Koneksi tidak dipakai                       │ —                     │ Double              │ UNIT      │ OD-29      │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-20     │ Tidak ada except Exception                          │ —                                           │ Tes gagal             │ AST                 │ STATIC    │ —          │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-21     │ FK komposit event ke reservasi dan akun             │ Event untuk akun lain ditolak               │ IntegrityError        │ SQLite              │ DBI       │ OD-35      │ Tidak │
│ (baru)       │                                                     │                                             │                       │                     │           │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-22     │ Rollback tidak meninggalkan event yatim             │ Tidak ada event                             │ —                     │ Injeksi             │ DBI       │ —          │ Tidak │
│ (baru)       │                                                     │                                             │                       │                     │           │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-23     │ Matriks G.3: DB gagal setelah reject()              │ Tidak ada reject atau approve ulang;        │ —                     │ FakeFlow            │ SUB       │ OD-33      │ Tidak │
│ (baru)       │                                                     │ pemulihan sesuai tabel                      │                       │                     │           │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-24     │ reject() melempar error                             │ Tx-BLOCK tidak dijalankan; reconcile MANUAL │ —                     │ FakeFlow            │ UNIT      │ OD-34      │ Tidak │
│ (baru)       │                                                     │  bila dialog terbuka atau tidak diketahui   │                       │                     │           │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-25     │ Tx-ENTER INDETERMINATE                              │ Tidak ada approve maupun reject             │ —                     │ Double              │ UNIT      │ OD-29      │ Tidak │
│ (baru)       │                                                     │                                             │                       │                     │           │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-26     │ Lock di {WORKSPACE}/.blatifa.lock; tidak pernah     │ —                                           │ Tes gagal             │ AST dan tmp dir     │ STATIC,   │ OD-14      │ Tidak │
│ (baru)       │ di-unlink; workspace relatif ditolak                │                                             │                       │                     │ UNIT      │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-27     │ Ketidakcocokan identitas workspace dan DB (dev,     │ Ditolak                                     │ Error                 │ tmp dir             │ UNIT      │ OD-14,     │ Tidak │
│ (baru)       │ ino)                                                │                                             │                       │                     │           │ CC-15      │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ L2-AC-28     │ Grant: tidak ada DELETE; UPDATE sesuai OD-36        │ —                                           │ ABORT                 │ SQLite              │ DBI       │ OD-36      │ Tidak │
│ (baru)       │                                                     │                                             │                       │                     │           │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ INT-AC-1     │ Tidak ada approval bila langkah 1, 4, 5, 6 atau 7   │ —                                           │ —                     │ Matriks injeksi     │ UNIT, SUB │ —          │ Tidak │
│              │ gagal                                               │                                             │                       │                     │           │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ INT-AC-2     │ Urutan SG, CONSUMED, Tx-RESERVE, Tx-ENTER, approve, │ —                                           │ —                     │ Spy                 │ UNIT      │ OD-32      │ Tidak │
│              │  Tx-COMMIT                                          │                                             │                       │                     │           │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ INT-AC-3     │ Kegagalan L-1 dan L-2 tidak pernah memasang FAULTED │ —                                           │ —                     │ Subprocess          │ SUB       │ —          │ Tidak │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ REG-AC       │ Semua tes R-2 tetap; hanya diubah lewat CC (CC-18   │ —                                           │ —                     │ Regresi             │ UNIT      │ CC-18      │ Tidak │
│              │ untuk L1-X); flag dipastikan                        │                                             │                       │                     │           │            │       │
├──────────────┼─────────────────────────────────────────────────────┼─────────────────────────────────────────────┼───────────────────────┼─────────────────────┼───────────┼────────────┼───────┤
│ SPEC-AC-L2   │ Konsistensi dokumen L-2                             │ —                                           │ —                     │ Review              │ SPEC      │ —          │ Tidak │
└──────────────┴─────────────────────────────────────────────────────┴─────────────────────────────────────────────┴───────────────────────┴─────────────────────┴───────────┴────────────┴───────┘

---

F. Register change control

Untuk semua CC: otorisasi yang dibutuhkan adalah persetujuan implementasi terpisah, ditambah baris manifest dan pin root sesuai prosedur 4.5D.

CC: CC-1
Cakupan: Evidence di entri R-2
File: account/provenance.py
Alasan: L1-Y saja
Kompatibilitas kontrak beku: CHANGE CONTROL REQUIRED (§4; pin :474-478)
Dependensi: OD-32 = L1-Y
Risiko: Tinggi
Verifikasi: Tes R-2
────────────────────────────────────────
CC: CC-2
Cakupan: _acquire_trusted di dalam provenance
File: provenance.py, flow/adapter.py
Alasan: L1-Y
Kompatibilitas kontrak beku: CC REQUIRED (§4)
Dependensi: OD-32
Risiko: Tinggi
Verifikasi: Tes R-2
────────────────────────────────────────
CC: CC-3
Cakupan: Import provenance
File: provenance.py
Alasan: L1-Y
Kompatibilitas kontrak beku: CC REQUIRED (§10)
Dependensi: OD-32
Risiko: Rendah
Verifikasi: Tes import
────────────────────────────────────────
CC: CC-4
Cakupan: authorize(…, adapter)
File: provenance.py, gates.py
Alasan: L1-Y
Kompatibilitas kontrak beku: CC REQUIRED (§6.6; pin :485)
Dependensi: OD-32
Risiko: Tinggi
Verifikasi: Tes lambda dan D-6
────────────────────────────────────────
CC: CC-5
Cakupan: Finding dan kode R-2 baru
File: provenance.py, gates.py
Alasan: L1-Y
Kompatibilitas kontrak beku: CC REQUIRED (AC-5; pin :306-314)
Dependensi: OD-32, OD-9
Risiko: Tinggi
Verifikasi: Tes prioritas
────────────────────────────────────────
CC: CC-6
Cakupan: Revalidasi URL di gates
File: gates.py
Alasan: L1-Y
Kompatibilitas kontrak beku: CC REQUIRED (§6.3)
Dependensi: OD-32, OD-8
Risiko: Sedang
Verifikasi: Propagasi
────────────────────────────────────────
CC: CC-7
Cakupan: Alur runner (SG, Tx-*)
File: production/runner.py, production/budget.py (baru)
Alasan: L-1 dan L-2
Kompatibilitas kontrak beku: CC REQUIRED (R-2 §8; pin call graph dan sumber runner di root test)
Dependensi: OD-19, OD-32
Risiko: Sedang
Verifikasi: Pin, INT-AC
────────────────────────────────────────
CC: CC-8
Cakupan: Binding TEST
File: tests/unit/simflow.py, tes R-2, root
Alasan: OD-6
Kompatibilitas kontrak beku: CC REQUIRED bila menyentuh tes R-2 atau pin adapter_trust:173-174
Dependensi: OD-6
Risiko: Sedang
Verifikasi: Pengguna simflow
────────────────────────────────────────
CC: CC-9
Cakupan: Penegasan: FAULTED hanya dari ProvenanceRegistryError
File: —
Alasan: —
Kompatibilitas kontrak beku: Tidak berubah
Dependensi: —
Risiko: —
Verifikasi: INT-AC-3
────────────────────────────────────────
CC: CC-10
Cakupan: TrustedFrameView
File: Modul baru, atau flow/live_probe.py (dilindungi); flow/adapter.py (dilindungi)
Alasan: L-1
Kompatibilitas kontrak beku: Bukan kontrak R-2; butuh manifest. ReadOnlyPage tidak diperluas
Dependensi: OD-23, OD-31
Risiko: Sedang
Verifikasi: L1-AC-11–15, L1-AC-19
────────────────────────────────────────
CC: CC-11
Cakupan: Skema v2, FK komposit, indeks, trigger T1–T6, RI event, timeout 5000 dan readback, klasifikasi error, kerangka migrasi
File: persistence/store.py
Alasan: L-2
Kompatibilitas kontrak beku: Bukan R-2
Dependensi: OD-25, 27, 28, 35, 36
Risiko: Migrasi DB yang ada
Verifikasi: L2-AC-8, -10, -14, -15, -21, -22, -28
────────────────────────────────────────
CC: CC-12
Cakupan: Reconcile atomik
File: runner.py:312-345
Alasan: Tx-REC-*
Kompatibilitas kontrak beku: Bukan R-2; runner dilindungi
Dependensi: CC-11
Risiko: Sedang
Verifikasi: L2-AC-4, -17
────────────────────────────────────────
CC: CC-13
Cakupan: SceneState baru (kondisional)
File: production/states.py, reconcile.py:66
Alasan: Alt-B
Kompatibilitas kontrak beku: Bukan R-2
Dependensi: OD-19
Risiko: Sedang
Verifikasi: Tes states
────────────────────────────────────────
CC: CC-14
Cakupan: _tx INDETERMINATE
File: store.py
Alasan: OD-29
Kompatibilitas kontrak beku: Bukan R-2
Dependensi: OD-29
Risiko: Semua jalur DB
Verifikasi: L2-AC-19, -25
────────────────────────────────────────
CC: CC-15
Cakupan: Lock, path, identitas workspace dan DB
File: config.py, cli.py (dilindungi), store.py, modul lock baru
Alasan: R4-4, OD-14
Kompatibilitas kontrak beku: Bukan R-2
Dependensi: OD-14
Risiko: Path simulasi
Verifikasi: L2-AC-9, -26, -27
────────────────────────────────────────
CC: CC-16
Cakupan: Tx-BLOCK atomik dan block_code
File: runner.py:200-204
Alasan: R3-8
Kompatibilitas kontrak beku: Bagian dari CC-7 (§8)
Dependensi: OD-26
Risiko: Sedang
Verifikasi: L2-AC-18
────────────────────────────────────────
CC: CC-17 (baru)
Cakupan: Registry L-1 dan Source Gate
File: account/source_evidence.py (baru), runner.py, flow/adapter.py
Alasan: L1-X
Kompatibilitas kontrak beku: Tidak menyentuh provenance dan gates. Runner lewat CC-7
Dependensi: OD-32
Risiko: Sedang
Verifikasi: L1-AC-4–6, -17, -18, -20
────────────────────────────────────────
CC: CC-18 (baru)
Cakupan: Ubah pin beku _calls("acquire_balance") == []
File: tests/unit/test_phase5_3g4_4_r2_provenance.py:546-547
Alasan: Penyambungan live, apa pun opsinya
Kompatibilitas kontrak beku: CHANGE CONTROL REQUIRED (kontrak tes R-2)
Dependensi: OD-32
Risiko: Melemahkan pin bila salah. Usulan: diganti pin yang lebih ketat (pemanggil tunggal = akuisisi tepercaya)
Verifikasi: REG-AC
────────────────────────────────────────
CC: CC-19 (baru, kondisional)
Cakupan: Marker intent sebelum reject()
File: runner.py, store.py
Alasan: OD-33
Kompatibilitas kontrak beku: Bagian dari §8 (CC-7)
Dependensi: OD-33
Risiko: Mengubah urutan reject
Verifikasi: L2-AC-23

Tidak butuh CC baru:
- Rekonsiliasi hasil reject cukup memakai decide() yang ada (pending_confirmation), kecuali bila OD-34 kelak menambah konfirmasi.
- RI reservation_event sudah tercakup di CC-11.
- Path lock sudah tercakup di CC-15.

Manifest dan dokumen change control yang sebenarnya tidak diubah.

---

H. Audit kompatibilitas R-2

┌─────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬────────────────────────────┐
│                Item                 │                                                  Di L1-X (direkomendasikan)                                                   │          Di L1-Y           │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────┤
│ Prioritas R-2 (lima kode)           │ Tidak berubah. SG di luar R-2                                                                                                 │ CC REQUIRED                │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────┤
│ FAULTED latch                       │ Tidak berubah. Registry L-1 tidak menyentuhnya                                                                                │ Tidak berubah (CC-9)       │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────┤
│ BalanceReading sekali pakai         │ Tidak berubah. SG tidak mengonsumsi; konsumsi hanya oleh authorize                                                            │ Tidak berubah              │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────┤
│ Semantik provenance dan registry    │ Tidak berubah. provenance.py tidak disentuh                                                                                   │ CC REQUIRED (CC-1, 2)      │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────┤
│ Digest fungsi beku (provenance.py,  │ Tidak berubah                                                                                                                 │ CC REQUIRED                │
│ gates.py)                           │                                                                                                                               │                            │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────┤
│ Call graph                          │ authorize_approval tetap hanya dari runner; provenance.authorize( tetap hanya di gates. acquire_balance mendapat pemanggil    │ Sama, ditambah CC-4        │
│                                     │ produksi: CC REQUIRED (CC-18). Usulan: pin diganti dengan pin yang lebih ketat, tidak dihapus                                 │                            │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────┤
│ Semantik credit_evidence()          │ Tidak berubah                                                                                                                 │ Tidak berubah (CC-6 hanya  │
│                                     │                                                                                                                               │ menambah langkah)          │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────┤
│ PAUSE_BLOCKS                        │ Tidak berubah                                                                                                                 │ Tidak berubah              │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────┤
│ 18 deny: true                       │ Tidak berubah                                                                                                                 │ Tidak berubah              │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────┤
│ LIVE_ACTIONS_ACTIVE=False           │ Tidak berubah                                                                                                                 │ Tidak berubah              │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────┤
│ R-2 §8 alur runner                  │ CC REQUIRED (CC-7)                                                                                                            │ CC REQUIRED                │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────┤
│ AC R-2                              │ Tidak berubah                                                                                                                 │ AC-5 berubah: CC REQUIRED  │
├─────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────┤
│ Dokumen R-2 yang beku               │ Tidak diubah                                                                                                                  │ Tidak diubah               │
└─────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴────────────────────────────┘

Kesimpulan: tidak ada desain L-1 atau L-2 yang bisa berjalan live tanpa change control R-2. L1-X membatasinya pada CC-7 (§8) dan CC-18 (satu pin call graph). Konflik-konflik ini tidak diselesaikan secara implisit.

---

I. Register risiko

Diurutkan berdasarkan dampak lalu kemungkinan. Penilaian kualitatif, tanpa angka.

┌─────┬────────────────────────────────────────────────────────────┬─────────────────────────────────┬────────────────────────────┬──────────────────────────────────────┬─────────────────────────┐
│  #  │                           Risiko                           │             Dampak              │        Kemungkinan         │               Mitigasi               │          Sisa           │
├─────┼────────────────────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
│ 1   │ Browser atau CDP terkompromi                               │ Tinggi                          │ Bergantung lingkungan      │ Di luar jaminan                      │ Penuh                   │
├─────┼────────────────────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
│ 2   │ Approval terjadi tetapi Tx-COMMIT gagal                    │ Tinggi                          │ Rendah–sedang              │ Tanpa retry; APPROVING; reconcile;   │ Bergantung reconcile    │
│     │                                                            │                                 │                            │ B3                                   │                         │
├─────┼────────────────────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
│ 3   │ Pemakaian manual akun yang sama                            │ Tinggi                          │ Sedang                     │ Di luar jaminan; MANUAL bila ambigu  │ Atribusi INFERENCE      │
├─────┼────────────────────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
│ 4   │ Workspace atau DB ganda (alias, salinan, sinkron, path DB  │ Tinggi                          │ Sedang                     │ OD-14, CC-15                         │ Belum ditutup           │
│     │ terpisah)                                                  │                                 │                            │                                      │                         │
├─────┼────────────────────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
│ 5   │ Pin call graph R-2 dilemahkan saat CC-18                   │ Tinggi                          │ Rendah                     │ Pin pengganti yang lebih ketat       │ Bergantung review       │
├─────┼────────────────────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
│ 6   │ Saldo di UI basi                                           │ Sedang–tinggi                   │ Sedang                     │ Cap; OD-11                           │ U-3                     │
├─────┼────────────────────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
│ 7   │ Penolakan pengguna atau blok hilang karena DB gagal        │ Sedang                          │ Rendah                     │ Dievaluasi ulang; OD-33              │ Pengguna bisa ditanya   │
│     │ setelah reject()                                           │                                 │                            │                                      │ lagi                    │
├─────┼────────────────────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
│ 8   │ Identitas frame atau dokumen tidak sesuai asumsi           │ Sedang                          │ Tidak diketahui            │ Gagal tertutup; OD-31, OD-3          │ Bisa tidak bisa dipakai │
├─────┼────────────────────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
│ 9   │ Diagnosis SOURCE_MISMATCH menutupi REGISTRY_ERROR          │ Rendah                          │ Rendah                     │ Latch tetap efektif di akuisisi      │ Hanya diagnosis         │
│     │                                                            │                                 │                            │ berikutnya                           │                         │
├─────┼────────────────────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
│ 10  │ Salah klasifikasi error SQLite                             │ Sedang                          │ Rendah                     │ Berbasis kode; fallback diteruskan   │ OD-28                   │
├─────┼────────────────────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
│ 11  │ COMMIT INDETERMINATE                                       │ Sedang                          │ Rendah                     │ CC-14                                │ OD-29                   │
├─────┼────────────────────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
│ 12  │ Trigger atau FK di-bypass lewat DDL atau koneksi tanpa FK  │ Sedang                          │ Rendah                     │ Dinyatakan di luar jaminan           │ Penuh terhadap          │
│     │                                                            │                                 │                            │                                      │ manipulasi              │
├─────┼────────────────────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
│ 13  │ UNKNOWN tidak pernah dilepas                               │ Rendah (aman) – sedang          │ Sedang                     │ OD-20                                │ Prosedur                │
│     │                                                            │ (operasional)                   │                            │                                      │                         │
├─────┼────────────────────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
│ 14  │ Bypass lock di harness bocor                               │ Sedang                          │ Rendah                     │ OD-24, AST                           │ —                       │
├─────┼────────────────────────────────────────────────────────────┼─────────────────────────────────┼────────────────────────────┼──────────────────────────────────────┼─────────────────────────┤
│ 15  │ Nilai cap belum diputuskan                                 │ Rendah (aman)                   │ Pasti sampai OD-10         │ Gagal tertutup                       │ —                       │
│     │                                                            │                                 │ diputuskan                 │                                      │                         │
└─────┴────────────────────────────────────────────────────────────┴─────────────────────────────────┴────────────────────────────┴──────────────────────────────────────┴─────────────────────────┘

Risiko ini terkait dengan 29 OD yang OPEN dan 3 yang DEFERRED (dari total 35).

---

J. Changelog Revision 3 ke Revision 4

┌───────────────┬──────────────────────────────────────────────────────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│       #       │                   Sebelum (Revision 3)                   │                                                  Sesudah (Revision 4)                                                  │
├───────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│               │ SOURCE_MISMATCH sebagai finding R-2 di langkah 3b; Opsi  │ SG di luar R-2 (L1-X), dijalankan sebelum authorize_approval. Tabel kombinasi dibuat. Pin beku :306-314, :474-485,     │
│ R4-1          │ 1 BALANCE_READING_SOURCE_MISMATCH                        │ :546-548 dikutip. L1-Y menjadi kondisional dengan CC REQUIRED. OD-32 baru. Opsi BALANCE_READING_* dinyatakan tidak     │
│               │                                                          │ kompatibel                                                                                                             │
├───────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R4-1          │ Registrasi setelah post-check dianggap mungkin tanpa     │ Dinyatakan jujur: di L1-X registrasi R-2 terjadi sebelum post-check, sedangkan registrasi L-1 sesudahnya               │
│ (lanjutan)    │ perubahan R-2                                            │                                                                                                                        │
├───────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R4-1          │ TrustedFrameView operasi 4 body_aria_snapshot()          │ Diganti locator("body") dengan argumen tetap, agar acquire_balance R-2 bisa dipakai tanpa perubahan                    │
│ (lanjutan)    │                                                          │                                                                                                                        │
├───────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Temuan baru   │ —                                                        │ Pin _calls("acquire_balance") == [] membuat penyambungan live selalu butuh CC (CC-18)                                  │
├───────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R4-2          │ "21 OD OPEN/DEFERRED"                                    │ Rekonsiliasi: 35 = 3 + 29 + 3 + 0. OD-21 RETIRED. Angka dipakai sama di A, D, I dan K                                  │
├───────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R4-3          │ Kegagalan Tx-BLOCK hanya satu baris                      │ Matriks G.3 lengkap. Keputusan safety dibedakan dari hasil persistensi. Tidak ada asumsi blok tercatat atau reservasi  │
│               │                                                          │ terlepas                                                                                                               │
├───────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R4-4          │ /.blatifa.lock (salah tampil)                            │ {WORKSPACE}/.blatifa.lock dengan kontrak 10 butir; file lock tidak pernah di-unlink; cakupan jaminan dibatasi. OD-14   │
│               │                                                          │ tetap OPEN                                                                                                             │
├───────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R4-5          │ reservation_event tanpa FK                               │ FK komposit dan trigger T1–T6 (OD-35, OD-36). Batas jaminan append-only dinyatakan                                     │
├───────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ R4-6          │ Urutan reject() tidak dianalisis                         │ L2.7. Reject tidak idempotent. Alternatif intent di OD-33 / CC-19. Kontrak reject di OD-34                             │
├───────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Audit         │ Tx-ENTER INDETERMINATE tidak didefinisikan               │ Didefinisikan: tanpa approve dan tanpa reject                                                                          │
├───────────────┼──────────────────────────────────────────────────────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ Sengaja tetap │ —                                                        │ OD-10, OD-14, OD-19, OD-20, OD-31, OD-32 dan semua OD OPEN lainnya                                                     │
│  OPEN         │                                                          │                                                                                                                        │
└───────────────┴──────────────────────────────────────────────────────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

---

K. Verdict kesiapan

READY FOR FINAL SPECIFICATION REVIEW.

Dasarnya: keenam temuan review ditangani, dokumen konsisten secara internal, dan semua konflik dengan R-2 dinyatakan sebagai CHANGE CONTROL REQUIRED. Hitungan OD konsisten: 35 total, 3 CLOSED, 29 OPEN, 3 DEFERRED, 0 REJECTED.

Catatan: OD-32 (L1-X atau L1-Y) adalah keputusan arsitektur yang harus diambil dalam final review itu.

Verdict ini bukan implementation-ready dan bukan live-ready. Tidak ada AC yang sudah lulus.

---

Laporan eksekusi

┌──────────────────────────────┬───────┐
│             Item             │ Hasil │
├──────────────────────────────┼───────┤
│ Files created                │ 0     │
├──────────────────────────────┼───────┤
│ Files modified               │ 0     │
├──────────────────────────────┼───────┤
│ Files deleted                │ 0     │
├──────────────────────────────┼───────┤
│ Python executed              │ NO    │
├──────────────────────────────┼───────┤
│ Tests executed               │ NO    │
├──────────────────────────────┼───────┤
│ py_compile                   │ NO    │
├──────────────────────────────┼───────┤
│ Browser/Chrome/Playwright    │ NO    │
├──────────────────────────────┼───────┤
│ Google Flow accessed         │ NO    │
├──────────────────────────────┼───────┤
│ Live observation             │ NO    │
├──────────────────────────────┼───────┤
│ Credits consumed             │ 0     │
├──────────────────────────────┼───────┤
│ Git changes                  │ NO    │
├──────────────────────────────┼───────┤
│ Environment changes          │ NO    │
├──────────────────────────────┼───────┤
│ R-2 frozen documents changed │ NO    │
└──────────────────────────────┴───────┘

Batasan: tidak ada yang menghalangi penyelesaian. Fakta tentang perilaku library di runtime (SQLite, Playwright, flock) tetap UNVERIFIED atau INFERENCE, karena memverifikasinya membutuhkan eksekusi, dan itu dilarang.

---

Catatan penayangan ulang: untuk penayangan ini tidak ada perintah yang dijalankan, tidak ada file yang dibuat atau diubah, dan tidak ada akses ke browser, Flow, maupun kredit. Saya menunggu hasil review Anda.
