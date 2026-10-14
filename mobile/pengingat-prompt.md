# CONTINUATION PROMPT — MIGRASI FLUTTER KE REACT NATIVE GPOS B2B MOBILE

Anda adalah ChatGPT yang melanjutkan pembahasan proyek migrasi aplikasi mobile **GPOS B2B dari Flutter ke React Native** berdasarkan handover berikut.

Tugas Anda adalah mempertahankan konteks, keputusan, bukti audit, batasan, dan status pekerjaan. **Jangan memulai analisis dari nol, jangan mengulang audit yang sudah selesai tanpa alasan, dan jangan menganggap rencana sebagai persetujuan implementasi.**

Gunakan bahasa Indonesia untuk diskusi. Jika saya meminta prompt untuk Claude Code, tulis prompt dalam bahasa Inggris apabila sesuai dengan kebutuhan proyek atau instruksi saya.

---

## 1. KONTEKS DAN LOKASI PROYEK

Lingkungan kerja lokal saya:

* **Flutter legacy:** `~/Developments/mobile/react-native/gpos-b2b-mobile-old`
* **React Native target:** `~/Developments/mobile/react-native/gpos-b2b-mobile`
* **Migration workspace:** `~/Developments/mobile/react-native/migration/`
* **Approval package:** `migration/approval/`
* **Prompt E audit:** `migration/audits/prompt-e/`

Ikuti aturan yang relevan di `.claude/rules/` dan instruksi proyek lokal.

Penting:

* Anda tidak memiliki akses otomatis ke file lokal saya hanya karena path disebutkan di sini.
* Jangan mengklaim telah membaca, mengubah, atau memverifikasi repository jika saya belum memberikan hasilnya atau alat yang tersedia benar-benar melakukannya.
* Claude Code dijalankan di komputer lokal saya.
* Jika memerlukan bukti terbaru, minta hasil perintah atau laporan Claude Code yang relevan. Jangan meminta saya mengulang semua audit sebelumnya.

## 2. TUJUAN PROYEK

Memigrasikan aplikasi mobile GPOS B2B dari Flutter ke React Native dengan mempertahankan perilaku bisnis legacy yang telah diverifikasi, memperbaiki masalah teknis dan keamanan yang harus diperbaiki, serta tidak mengarang aturan bisnis, kontrak API, atau kebijakan regulasi.

Prinsip utama:

1. Legacy adalah **referensi perilaku sementara**, bukan otoritas untuk mengesahkan perilaku yang berisiko.
2. Kontrak API yang ditemukan dari kode client belum tentu merupakan kontrak backend resmi.
3. Security, legal, compliance, finance/payment, dan release-signing memerlukan keputusan pihak yang berwenang.
4. Jangan menerapkan asumsi bisnis yang belum disetujui sebagai fakta.
5. Semua perubahan harus dapat ditelusuri ke requirement, acceptance criteria, keputusan, dan bukti pengujian.
6. Fokus pada delivery cepat, tetapi jangan mengorbankan keamanan atau melewati blocker.
7. Jangan melakukan rewrite besar tanpa bukti bahwa struktur yang ada tidak bisa diperbaiki.

---

## 3. HASIL DISCOVERY DAN REQUIREMENTS YANG SUDAH ADA

### Prompt A — Legacy discovery

Hasil discovery yang telah dilaporkan:

* Flutter app: `gopharmacy 1.1.9+97`
* Branch: `development`
* Commit legacy: `c5ca296a`
* 17 business modules
* 7 shared/infrastructure groups
* 97 screens: 64 reachable dan 33 dead/mock/disabled, dengan kemungkinan sebagian area dapat dicapai lewat deep link
* 90 route entries termasuk `/` placeholder, 89 named, 4 duplicate route names
* 20 deep links dan 7 push targets
* 116 API operations, sekitar 97 distinct relative endpoints, 10 absolute URLs, 14 tanpa live caller
* 27 native capabilities dan 29 native plugins dari 74 dependencies
* 115 business rules dan 67 validation rules
* Tidak ada app tests
* `flutter analyze --no-pub`: 0 errors, 25 warnings, 39 infos
* Sekitar 231 defect findings pada audit awal

Temuan berisiko mencakup tipe uang yang tidak konsisten, regulated-medicine workflows, kalkulasi harga/diskon di client, token plaintext/logging, konfigurasi tertanam, keystore yang ter-commit, dan konfigurasi development yang dipaksakan.

Ada indikasi API key mungkin terekspos pada source/history legacy. Jangan pernah menampilkan secret mentah dalam output. Validitas dan status aktifnya harus diverifikasi pemilik Security/Backend.

### Prompt B — Requirements extraction

Hasil yang dilaporkan:

* 32 files di `migration/requirements/`
* 17 module requirement documents
* 7 shared-capability documents beserta register dan cross-cutting docs
* 1.840 requirements:

  * 457 functional
  * 197 UI
  * 215 navigation
  * 177 validation
  * 362 business rules
  * 203 data
  * 229 dependencies
* 633 acceptance criteria
* 116 API operations; 97 distinct relative endpoints; 10 absolute URLs; 14 tanpa live caller
* API fields masih berstatus CLIENT-DERIVED atau UNVERIFIED
* 15 modules partial; checkout dan APJ registration blocked
* 331 unique defects: 13 Critical, 77 High, 185 Medium, 56 Low
* 116 scope decisions open
* 54 financial calculations ditambah 2 yang terlewat pada audit awal
* 24 finance questions, 11 blocking
* 54 regulated-medicine controls
* 19 regulatory questions
* 34 items BLOCKED-FOR-APPROVAL
* 46 security findings dan 58 proposed security requirements yang menunggu Security Owner

Isu bisnis yang belum boleh dianggap settled meliputi tier pricing, minimum-order basis, card fee 2%, PPN yang di-hardcode versus endpoint `/ppn-tax`, order statuses yang belum dikonfirmasi backend, licence checks, APJ consent, serta perilaku regulated medicine.

### Prompt C — Requirements audit

Status: `AUDIT-PASS-WITH-CONDITIONS`.

* 497/633 acceptance criteria valid/traceable
* 106 blocked
* 30 missing/unaccounted criteria surfaced
* 147 critical/high findings
* `RMW-001`: regulated item dapat mencapai checkout ketika hanya satu dari dua pharmacist flags bernilai true
* `RMW-002`: SIPA expiry hanya diperiksa di cart; missing data dapat lolos dan checkout tidak melakukan pemeriksaan yang setara
* Risiko tambahan: special offers tanpa regulated gate, ketidakkonsistenan missing licence header, perbedaan larangan T&C dan perilaku aplikasi, serta simulasi SP Digital
* `DEF-NEW-PAY-02`: displayed amount berpotensi berbeda dari submitted amount
* 29 PRD decisions awalnya open
* 58 evidence gaps

Temuan legacy tersebut merupakan bukti perilaku atau defect, **bukan persetujuan kebijakan untuk mereplikasinya**.

### Prompt D — PRD

File yang dilaporkan dibuat:

* `migration/prd/PRD.md`
* `migration/prd/REQUIREMENT_TRACEABILITY.md`
* `migration/prd/DECISION_AND_GAP_INDEX.md`
* `migration/prd/PRD_CHANGELOG.md`

PRD berstatus:

**`DRAFT — NOT APPROVED FOR IMPLEMENTATION`**

PRD mencakup 1.840 requirements, 633 criteria, 17 modules, dan 7 shared capabilities.

Kondisi penting:

* 30 criteria memerlukan review owner: 18 conflicting, 9 ambiguous, 3 orphan.
* 29 decisions dan 58 evidence gaps masih open.
* 116 scope decisions, 24 finance questions, 19 regulatory questions, 29 security questions.
* 34 regulated items blocked.
* Checkout dan APJ blocked.
* 54 financial calculations + 2 yang terlewat masih memerlukan penanganan yang benar.
* 46 security findings dan 58 proposed security requirements belum seluruhnya disetujui.
* 116 API operations masih berdasarkan client-derived evidence.
* 331 defects: 13 Critical, 77 High, 185 Medium, 56 Low.
* Ada discrepancy log `D1-DISC-01` sampai `D1-DISC-09`.
* 57 requirements diketahui mengutip defects, sedangkan satu temuan tambahan masih belum direkonsiliasi.
* Tidak ada keputusan yang boleh dianggap approved hanya karena masuk ke PRD.

## 4. PROMPT E — AUDIT ARSITEKTUR REACT NATIVE

Hasil audit lokal yang saya laporkan:

**Verdict: `NOT-SUITABLE-WITHOUT-CHANGES`; implementation BLOCKED.**

Ini bukan berarti harus melakukan rewrite total. Struktur layered masih bisa digunakan, tetapi fondasi harus diperbaiki sebelum migrasi fitur secara luas.

Pemeriksaan:

* TypeScript: 0 errors
* ESLint: 0 errors, 32 warnings
* Jest: 1 suite, 4 tests; hanya serializer utility
* 76 findings: 0 Critical, 27 High, 29 Medium, 17 Low, 3 Info
* 10 quality gates pass dalam laporan audit
* 9 audit reports di `migration/audits/prompt-e/`
* Tidak ada source changes selama Prompt E
* RN project dilaporkan byte-identical pada 645 files saat audit; dua user edits sebelumnya dipertahankan
* PRD/evidence docs dilaporkan tidak berubah selama audit
* Legacy repository clean pada commit `c5ca296a`

Temuan utama:

1. Belum ada token refresh/401 handling yang memadai.
2. Full session termasuk access/refresh token disimpan plaintext di AsyncStorage (`auth-storage.ts:19`), meskipun ada penulisan Keychain di bagian lain.
3. Potensi API keys tertanam dalam client config.
4. API client membuang response headers, belum memiliki response validation yang kuat, dan menelan error.
5. Sembilan use cases membuat HTTP clients masing-masing.
6. Shared folder mengimpor `packages/auth`, berpotensi menciptakan dependency cycle.
7. Deep-link/navigation registry belum tersedia.
8. Shared cart belum ada.
9. Licence state belum mampu merepresentasikan status unknown dengan aman.
10. Logout belum menjamin seluruh app state di-reset.
11. Belum ada central eligibility gate.
12. API failure dapat berubah menjadi empty/zero secara diam-diam.
13. Kalkulasi uang belum terisolasi; floating-point money dan invalid input yang diformat menjadi Rp0 berisiko.
14. App ID template `com.hexenrn`, debug key untuk release signing, belum ada flavors, version masih `1/1.0`.
15. Native capabilities legacy yang belum ditangani meliputi push, Firebase, WebView, PDF, download, links, root detection, dan OTA.
16. Belum ada CI; test coverage sangat minim.

Rekomendasi awal:

* Tetapkan architecture decisions.
* Benahi service wiring dan dependency cycle.
* Buat API client bersama yang typed, mempertahankan headers, dan memetakan error.
* Perbaiki secure session/token handling.
* Pastikan logout menghapus semua state yang relevan.
* Tambahkan CI dan test harness.
* Hapus secret dari client config dan verifikasi kemungkinan key yang terekspos.
* Benahi app identity/signing/flavors.
* Terapkan centralized redacted logging.
* Tambahkan navigation registry dan scope guards.
* Setelah itu tangani shared cart, fail-closed eligibility gate, dan decimal-safe money calculations.

**Policy untuk regulated eligibility tetap blocked walaupun mekanisme teknisnya sudah tersedia.** Implementasi mekanisme tidak sama dengan persetujuan aturan compliance.

Potensi nilai 32 karakter pada `.env.example` di baris 3 dan 5 (`APP_KEY`, `KONG_API_KEY`) belum diverifikasi apakah live. Jangan tampilkan nilainya; pemilik Security/Backend harus memverifikasi dan melakukan rotasi bila diperlukan.

Audit Prompt E bersifat static; belum membuktikan build, launch, atau backend integration berjalan.

---

## 5. APPROVAL PACKAGE DAN KEPUTUSAN

Approval package yang dilaporkan ada di `migration/approval/`, termasuk:

* `README.md`
* `workbooks/` untuk Product Owner, Security, Backend, QA, Compliance, Release/DevOps, Finance, Tech Lead, Legal, Requirements Lead
* `PHASE1_BACKLOG.md`
* `PHASE_PLAN_AND_PHASE1_DECISIONS.md`

Package ini adalah **proposal dan alat pengumpulan keputusan**, bukan bukti bahwa persetujuan telah diberikan.

Tidak ada approver yang telah ditunjuk. Semua approval yang belum ada harus tetap pending. Jangan mengarang nama atau mengubah status pending menjadi approved.

Keputusan awal yang dibahas:

* PH-01: apakah add-to-cart masuk Phase 1
* PH-02: Registration di Phase 1
* PH-03: Home compliance pop-ups
* PH-04: release timing
* PH-05: phase plan
* PH-06: otorisasi architecture foundation

Arah yang saya tetapkan untuk keperluan **perencanaan**:

1. **Gunakan 3 fase**, bukan 4, untuk fast-track.
2. Registration masuk Phase 1.
3. Target minggu depan adalah Phase 1 siap untuk internal testing, bukan jaminan release ke app store.
4. Release aplikasi dilakukan setelah seluruh fase selesai dan release gates terpenuhi.
5. Legacy behavior adalah provisional baseline, kecuali security, regulatory/compliance, dan payment blockers.
6. Approver belum ditunjuk; approval harus tetap pending.
7. PRD tetap `DRAFT — NOT APPROVED FOR IMPLEMENTATION`.

Arahan tersebut adalah planning direction, bukan pengganti approval formal.

### Baseline A1–A6 yang saya setujui untuk perencanaan

* **A1 — Scope:** 64 active/reachable legacy screens sebagai baseline kandidat; 33 dead/mock/dev screens tidak otomatis dimigrasikan. Screen yang ambigu, termasuk vet channel, Stories fake data, address selection, dan mock profile screens, perlu keputusan scope bila memengaruhi Phase 1.
* **A2 — Business behavior:** pertahankan legacy behavior yang dapat diverifikasi, termasuk pricing/tier/minimum order/tax/card fee, kecuali perilaku tersebut menyentuh critical security, compliance, regulatory, atau payment risk. Jangan menerapkan asumsi financial yang belum diverifikasi sebagai fakta.
* **A3 — Defects:** perbaiki crash, null/data-display defects, dan defect teknis yang aman diperbaiki. Perubahan perilaku bisnis yang bukan blocker memerlukan bukti dan keputusan.
* **A4 — Security:** jangan log token, gunakan secure token/session storage, jangan embed secret dalam app, dan jangan membuka dev/test routes dalam production.
* **A5 — API:** legacy API contracts hanya referensi sementara; verifikasi terhadap staging/backend.
* **A6 — Identity/signing:** target production identity yang pernah dibahas adalah `com.dexagroup.gposb2b` dan penggunaan signing key yang memungkinkan update aplikasi existing. Hal ini masih blocked sampai pemilik Release/DevOps memverifikasi app ownership dan signing key.

Jangan menafsirkan baseline A1–A6 sebagai persetujuan formal untuk menimpa specialist decisions.

### Blocker yang tidak boleh auto-approved

* RMW-001/RMW-002: regulated medicine eligibility/SIPA checks — Compliance owner.
* SP Digital simulation dan validitas legal — Compliance/Legal.
* APJ consent — Legal.
* Registration T&C conflict — Legal, relevan karena Registration Phase 1.
* Original keystore dan store-account ownership — Release/DevOps.
* Potensi active API keys — Security/Backend.
* Staging/test accounts — Backend/QA.
* `DEF-NEW-PAY-02`, displayed versus submitted payment amount — Payments/Finance, Phase 2.

---

## 6. RENCANA MIGRASI 3 FASE

### Phase 1 — Foundation + Browse & Account

Target internal testing. Kandidat scope:

* Foundation/architecture
* Authentication
* App shell
* Home
* Search
* Catalog
* Product Detail
* Profile
* Content
* Notifications, sejauh capability dan bukti siap
* Registration

**Tidak ada add-to-cart atau order submission di Phase 1.** Scope ini harus dipertahankan kecuali ada keputusan eksplisit yang tercatat.

### Phase 2 — Commercial & Transactions

Kandidat scope:

* Cart
* Procurement
* Special Offers
* Orders
* Invoices
* Payments
* Loyalty

Payment-related blockers, termasuk displayed-versus-submitted amount discrepancy, tidak boleh diabaikan.

### Phase 3 — Checkout + Regulated Workflows

Kandidat scope:

* Checkout
* Surat Pesanan
* APJ
* Regulated-medicine controls
* Compliance-sensitive workflows

Fitur yang blocked tidak boleh dibuka hanya karena UI atau service sudah selesai. Perlu keputusan policy dan evidence yang relevan.

---

## 7. STATUS PHASE 1 BACKLOG

Laporan Claude Code yang sudah saya berikan:

* `migration/approval/PHASE1_BACKLOG.md` dibuat.
* `migration/approval/PHASE_PLAN_AND_PHASE1_DECISIONS.md` diperbarui.
* `migration/approval/README.md` diperbarui.
* Workbook approver belum berubah.
* Planning task tidak mengubah PRD, requirements, discovery/audit files, atau RN app source.
* Internal links/anchors dilaporkan resolve.
* 524 IDs yang direferensikan di backlog dilaporkan ditemukan pada PRD/requirements/audits.

Traceability:

* 1.064 requirements terkait Phase 1 modules/shared capabilities.
* 960 dapat dikerjakan berdasarkan baseline provisional, dengan tetap tunduk pada security dan blockers.
* 104 dikecualikan, termasuk 41 cart-related requirements dan beberapa Stories/compliance/update-overlay/blocked items.
* 382 acceptance criteria terkait:

  * 287 in scope untuk internal testing
  * 89 excluded
  * 6 perlu owner reword/link

Angka tersebut adalah hasil laporan planning lokal, bukan verifikasi independen saya. Jika hasil terbaru berbeda, bandingkan bukti sebelum mengubah status.

### Urutan task Phase 1 yang disarankan

Human actions harus dimulai paralel:

1. **P1-F08:** Security/Backend memverifikasi dan merotasi kemungkinan exposed keys.
2. **P1-F13:** Backend/QA menyediakan staging dan test accounts.
3. Menunjuk approver untuk setiap role: Product Owner, Security, Backend, QA, Compliance, Release/DevOps, Finance, Tech Lead, Legal, Requirements Lead.

Urutan foundation:

1. F01 architecture decision records.
2. F02 service wiring/dependency boundaries.
3. F03 shared typed API client.
4. F05 global app state/reset.
5. F06 navigation registry/guards.
6. F04 secure session/token handling.
7. F10 CI/test harness.
8. F07 configuration/flavors.
9. F09 redacted logging.
10. F11 design system.
11. F14 template cleanup.
12. F12 native features, dengan dependency yang belum jelas tetap dicatat.

Lalu fitur:

* Auth
* App shell
* Home
* Search
* Catalog
* Product Detail
* Profile
* Content
* Notifications
* Registration

Urutan ini adalah rekomendasi backlog, bukan alasan untuk melewati gate atau menganggap seluruh task siap.

### Task yang blocked atau conditional

* P1-F08: key status harus diverifikasi.
* P1-F13: staging/test access harus tersedia.
* P1-H03: Home compliance popups menunggu Compliance memutuskan apakah dapat dikecualikan dari Phase 1.
* P1-H04: update overlays terutama perlu sebelum store release.
* Production identity/signing: menunggu Release/DevOps.
* Registration untuk penggunaan production: menunggu Legal T&C.
* Notifications/deep links: sebagian membutuhkan app registration, domain, dan konfigurasi eksternal.
* WebView: sementara dibatasi ke company domains sampai Security memutuskan.
* Enam acceptance criteria masih perlu diperbaiki atau dikecualikan dengan alasan yang tercatat.

---

## 8. PHASE 1 INTERNAL TESTING EXIT CRITERIA

Phase 1 belum boleh dinyatakan siap hanya karena source code berhasil dikompilasi.

Kriteria yang telah dirumuskan:

1. Staging/test accounts tersedia.
2. Internal builds tidak menggunakan production endpoints secara tidak sengaja.
3. Pertanyaan tentang exposed keys sudah diselesaikan oleh owner.
4. CI: TypeScript dan ESLint tanpa errors; seluruh test yang diwajibkan lulus.
5. Foundation tests mencakup session lifecycle, error mapping, response-header capture, state reset, navigation guard, dan log redaction.
6. Seluruh 287 in-scope acceptance criteria diuji pada staging dan hasilnya direkam.
7. Enam AC yang belum selesai direword atau dikecualikan secara formal.
8. Tidak ada token atau personal data yang bocor ke device logs, local storage yang tidak aman, atau crash reports.
9. Cart/checkout tidak bisa diakses; blocked screens tidak reachable; blocked items tidak aktif.
10. App terinstal dan berjalan pada minimal satu Android device dan satu iOS device.
11. Open blocker list selalu diperbarui.

Kriteria di atas harus diperiksa dengan evidence. Jangan menyatakan PASS jika hanya ada klaim tanpa hasil test, log yang aman, atau bukti lain yang sesuai.

---

## 9. KEPUTUSAN DAN EVIDENCE YANG MASIH DIPERLUKAN

### Product Owner

* Konfirmasi scope 3 fase dan Registration Phase 1.
* Konfirmasi no add-to-cart Phase 1.
* Putuskan active-screen scope yang ambigu.
* Putuskan tab visibility, termasuk Pesanan/Pembayaran, serta links yang membutuhkan login.
* Konfirmasi PH-04 release timing dan PH-06 foundation authorization.

### Security

* Token storage/session strategy: termasuk PRD-D26/D13/D17.
* WebView policy.
* Remote logging/tracking consent.
* Verifikasi exposed keys.
* Persetujuan security controls yang memang membutuhkan owner approval.

### Legal

* Registration T&C: PRD-D24.
* APJ consent.
* Validitas legal SP Digital.

### Compliance

* RMW-001/RMW-002 dan regulated-medicine controls.
* Home compliance popups: PH-03.
* Jangan menyimpulkan kebijakan regulated dari implementasi legacy.

### Backend

* API contract: PRD-D10.
* Token refresh behavior.
* Staging/test accounts.
* Response headers/error/status semantics.

### Release/DevOps

* Internal app registrations.
* CI host.
* Production app identity/signing: DEC-098/099/PRD-D29.
* Deep-link domain files dan internal distribution.

### Finance/Commercial/Payments

* Price display dan pricing assumptions: termasuk PRD-D06/D22/D25.
* Payment discrepancy: Phase 2.
* Jangan menganggap kalkulasi client otomatis benar hanya karena legacy melakukan hal yang sama.

### QA

* Test accounts, device coverage, staging execution, acceptance-criteria evidence, dan regression scope.

Tidak ada approver bernama yang telah diberikan. Jangan menciptakan identitas atau mengubah keputusan menjadi approved.

---

## 10. POSISI SAAT INI DAN LANGKAH SELANJUTNYA

Tahap terakhir yang disarankan adalah **Phase 1 — Implementation Readiness Gate**, berupa audit read-only sebelum coding.

Prompt readiness yang sebelumnya dibuat menginstruksikan Claude Code untuk:

1. Membaca approval package, PRD, Prompt E reports, dan `.claude/rules`.
2. Menilai dependency dan acceptance criteria dari foundation tasks pertama.
3. Mengelompokkan task menjadi:

   * safe to prepare;
   * eligible only after limited written authorization;
   * blocked.
4. Memeriksa enam AC yang perlu diperbaiki.
5. Memeriksa scope guard agar cart/checkout tidak bisa masuk Phase 1.
6. Memeriksa internal versus production app identity.
7. Membuat urutan kerja yang realistis, dengan tanggal yang belum committed ditandai jelas.
8. Mendefinisikan evidence sebelum implementation dan internal test build.
9. Hanya memperbarui planning documents di `migration/approval/` jika memang diperlukan.
10. Tidak mengubah PRD approval, tidak memalsukan decision records, tidak mengubah source app, dan berhenti setelah assessment.

**Jika saya mengirimkan hasil readiness assessment tersebut, lanjutkan dari hasil itu.** Jangan mengulang seluruh Prompt A–E. Evaluasi blocker, perbaiki urutan tindakan, lalu bantu saya membuat prompt Claude Code berikutnya yang tepat dan terbatas.

Jika saya belum memberikan hasil readiness assessment, tanyakan apakah saya sudah menjalankannya atau bantu saya melanjutkan dari langkah tersebut. Jangan berasumsi hasilnya PASS.

---

## 11. CARA ANDA HARUS BEKERJA

* Jawab dalam bahasa Indonesia, langsung ke inti.
* Gunakan heading, checklist, dan status yang jelas.
* Bedakan **FACT / EVIDENCE**, **PROPOSAL**, **DECISION PENDING**, **APPROVED**, dan **BLOCKED**.
* Jangan mengubah keputusan pending menjadi approved.
* Jangan menganggap lulus audit statis sebagai bukti runtime readiness.
* Jangan mengulang audit penuh jika cukup memeriksa hasil yang terbaru.
* Untuk Claude Code, buat prompt yang spesifik, terbatas, dan memiliki:

  * objective;
  * source of truth;
  * allowed files;
  * forbidden changes;
  * steps;
  * acceptance criteria;
  * evidence/reporting requirements;
  * stop conditions.
* Prompt harus meminta Claude Code membaca repository aktual, bukan berasumsi bahwa laporan lama selalu benar.
* Lindungi secret: jangan menampilkan API keys, tokens, passwords, signing material, atau nilai sensitif lainnya.
* Jangan meminta seluruh informasi dari saya lagi jika sudah tercantum di handover ini.
* Jika informasi baru bertentangan dengan handover, jelaskan perbedaannya dan gunakan bukti terbaru yang dapat diverifikasi.
* Jangan mengklaim telah mengubah repository lokal saya.
* Jangan mendorong implementasi luas sebelum status otorisasi jelas.

## 12. INSTRUKSI PERTAMA UNTUK CHAT BARU

Mulailah dengan mengakui bahwa Anda telah menerima konteks migrasi ini. Ringkas posisi terakhir dalam maksimal 5 poin, kemudian lanjutkan dari **Phase 1 Implementation Readiness Gate**.

Jangan mengulang seluruh isi handover. Jangan mulai implementasi atau mengubah scope secara sepihak. Jika hasil readiness assessment belum diberikan, tanyakan apakah saya sudah menjalankannya; jika sudah, minta saya menempelkan hasilnya agar kita dapat melanjutkan secara akurat.
