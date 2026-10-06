# A7 — Next Module Selection Audit

| Field | Value |
|---|---|
| Date | 2026-10-01 |
| Type | READ-ONLY audit. No source, test, config, dependency, route or authorization change. No HTTP request, no API or database mutation |
| Frontend | `frontend/` · `chore/a5.0-foundation-remediation` · HEAD `8c24d71` (uncommitted A5.0–A6 work, unchanged) |
| Legacy | `gpos-b2b-cms` commit `00bc6ea` (source of truth where documents disagree) |
| Backend source (read-only) | `~/Developments/BE/gpos-b2b-product-service` `b5ca719` (branch `cms-filter-banner`, 2026-09-14) · `gpos-b2b-content-service` `7897199` (`development`) · `gpos-b2b-account-service` |

## 1. Executive finding

```text
A6 = HOLD / BLOCKED
D-A6R2-01 = OPEN / CRITICAL   (D — Repository/ORM update bug; not fixed, no frontend workaround)

A7 result:
Selected Next Module = Konfigurasi Umum (F30), selected based on evidence
API readiness        = CONTRACT_PARTIAL
Vertical slice       = SUITABLE
Proposed phase       = A7 — Konfigurasi Umum Contract & Readiness  (readiness only, no implementation)
```

Six modules meet all ten eligibility conditions:
- **F30 Konfigurasi Umum**
- F11 Pembatasan produk
- F20 Produk Sponsor
- F24 Kode Telesales
- F25 Grup Pelanggan
- F32 FAQ

F30 is selected because, across the selection criteria, it is the only eligible module with all of the following:
- **no upstream dependency:** no options or lookups from other features;
- **backend source plus generated Swagger** for every operation it uses;
- **a two-field string model** (`key`, `value`, both required) that cannot hit the D-A6R2-01 bug class;
- **a list contract identical in shape to the one verified for Content** (`sort_by / asc_desc / page / take / keyword`).

## 2. Evidence reviewed

| Group | Documents / sources |
|---|---|
| Legacy audits (`gpos-b2b-cms/docs/migration/`) | `FRONTEND_SCOPE.md` (A0), `ROUTE_SCREEN_MAP.md` (A1), `AUTH_API_PERMISSION_MAP.md` (A2), `RUNTIME_BEHAVIOR_AUDIT.md` (A3.1), `VISUAL_BASELINE.md` (A3.2), `TARGET_UI_FOUNDATION.md`, `A4_*` (12 files: migration contract, route matrix, decision register, open decisions, traceability, target / API / auth / navigation / form / security / performance / test architecture, readiness) |
| Frontend reviews (`frontend/docs/architecture/reviews/`) | A5.0–A5.7, `A5.5R_REAL_BACKEND_CONTRACT_VERIFICATION.md`, `A6_FIRST_PRODUCTION_VERTICAL_SLICE.md`, `A6R_REAL_BACKEND_AUTH_RE_GATE.md`, `A6_WRITE_CONTRACT_READINESS.md` (A6R-1 / A6R-2 closeout), `summary.md`; contracts `contracts/legacy-api/content-{list,write}.md` |
| Status summary | `~/Developments/bl-whish/claude-summary.md` (secondary only) |
| Legacy source | `start/routes.js`, `app/Repositories/*`, `app/Mapper/*`, `app/Controllers/Http/*`, `app/Helper/ApiService.js`, `resources/views/**` |
| Backend source | handlers / DTOs / models / repositories / generated `docs/` (swaggo) of the three services above |
| Frontend source (foundation fit) | `src/components/organisms/data-table/server-data-table.tsx`, `src/shared/hooks/use-data-table.ts`, `src/components/ui/{alert-dialog,checkbox,dialog}.tsx`, `src/shared/authorization/*`, `src/packages/content/**` |

## 3. Legacy inventory verification

| Metric | Claimed | Evidence | Status |
|---|---:|---|---|
| Feature areas | 32 | A1 §1 l.28; §23 l.1821-1857 lists F01–F32 (F32 = Masukan / Konten / FAQ) | VERIFIED |
| Route entries | 427 | A1 §1 l.18 (247 calls → 427 entries); A4 matrix §3 has 427 numbered rows | VERIFIED |
| Frontend-relevant routes | 330 | 427 − 97 resource routes without an action (A1 §1, §3.3) | VERIFIED |
| MIGRATE routes | 259 | A4 §2 l.30; matrix rows with `\| MIGRATE \|` = 259 (REVIEW 49, REMOVE 119) | VERIFIED |
| REMOVE composition | 97 + 3 + 18 + 2 (= 120) | A4 §1 l.18 text vs matrix rows: 97 resource + 16 duplicate + 4 missing-action + 2 other = **119** | **CONTRADICTED** (A4 text vs A4 rows; totals 427 / 119 consistent) |
| Screen routes | 107 | A1 §1 l.20 (82 active, 22 unknown, 3 missing-view) | VERIFIED (document) |
| Form groups | 40 | A1 §11 cited by `A4_FORM_ARCHITECTURE.md` l.7; the A1 §11.1 table has **39** rows | PARTIALLY VERIFIED (a row may group 2 forms; not resolved) |
| DataTables | 32 | A1 §1 l.31; §7 table = 32 rows | VERIFIED |
| Custom lists | 9 | A1 §1 l.33; §7 table = 9 rows | VERIFIED |
| Dialogs | 55 | A1 §12 l.1177 "55 distinct modal dialogs"; table = **39** rows (grouped) | PARTIALLY VERIFIED |
| Upload / file capabilities | 13 | A1 §16 table = 13 rows | VERIFIED |
| Backend HTML UI functions | 34 | A1 §1 l.36, §28 E4 l.1981; §8 table = **22** rows (grouped) | PARTIALLY VERIFIED |

## 4. Full module inventory

### Column sources

| Column | Source |
|---|---|
| Routes (M/R = MIGRATE / REVIEW) | A4 §2 |
| Screens, capabilities, dependencies | A1 §23 |
| DataTable | A1 §7 |
| Upload | A1 §16 |
| Authorization (menu visibility only) | A2 §14 |

### Applies to every module

**Authorization.** Adonis authorization is session-only. API authorization is `UNKNOWN — BACKEND CONTRACT` (A2 §13 #5-10). A new capability can be defined fail-closed using A5.4, as was done for Content.

**Foundation.** Every module can use the A5 foundation (auth / session, DAL, A5.4 authorization). Readiness and Vertical Slice are given per module.

**Workflow.** "Workflow" means sync / trigger / wizard / schedule / cancel / finalise / approve / reject / status-toggle (A4_MIGRATION_CONTRACT P-01 l.19).

**API column legend:**
- **A2:** gateway paths from legacy client code (intent only).
- **BE:** backend source handler found.
- **Swagger:** swaggo-generated `docs/` present.
- **live:** observed against the real backend.

### Matrix

| Module | Routes M/R | Screens | DataTable | Create | Edit | Delete | Upload | Auth (menu) | Workflow | API evidence | Dependencies | Readiness | Vertical slice |
|---|---:|---:|---|---|---|---|---|---|---|---|---|---|---|
| F01 Login / sesi | 3/0 | 1 | N/A | N/A | N/A | N/A | N/A | public | — | live (A5.5R) | session | migrated A5.1 | N/A |
| F02 Beranda | 1/0 | 1 | N/A | N/A | N/A | N/A | N/A | S | — | none (static) | OD-P4 | CONTRACT_UNKNOWN | NOT_SUITABLE |
| F03 Order/Pesanan | 4/2 | 2 | VERIFIED | N/A | read-only detail | broken (OD-09) | N/A | S | sync | A2 | — | CONTRACT_PARTIAL | NOT_SUITABLE |
| F04 Order Review | 3/2 | 2 | VERIFIED | N/A | detail | REVIEW (OD-09) | N/A | S | — | A2 | — | CONTRACT_PARTIAL | PARTIAL |
| F05 Pembayaran | 4/0 | 2 | VERIFIED | N/A | detail | N/A | N/A | P, S | trigger | A2 | — | CONTRACT_PARTIAL | NOT_SUITABLE |
| F06 Inventory/Persediaan | 13/0 | 3 | VERIFIED | VERIFIED | VERIFIED (+stock modal) | VERIFIED | N/A | S | — | A2; stock base path recorded as literal `url` | product search | CONTRACT_UNKNOWN (stock) | PARTIAL |
| F07 Produk | 7/0 | 2 | VERIFIED | N/A | VERIFIED | N/A | YES (4 images) | S | — | A2 | — | CONTRACT_PARTIAL | NOT_SUITABLE |
| F08 Kategori Produk | 9/0 | 3 | VERIFIED | VERIFIED | VERIFIED | VERIFIED | YES (required) | S | — | A2 + BE | — | CONTRACT_PARTIAL | NOT_SUITABLE |
| F09 Produk Gpos B2b | 7/3 | 4 | VERIFIED (tab) | config | config | — | YES | S | — | A2 | F30, CustomCriteria | CONTRACT_PARTIAL | NOT_SUITABLE |
| F10 Personalisasi Katalog | 9/17 | 9 | VERIFIED | VERIFIED | VERIFIED + inline | VERIFIED | N/A | S | — | A2 | many OPTIONS | CONTRACT_PARTIAL | PARTIAL (17 REVIEW) |
| F11 Pembatasan produk | 10/0 | 3 | VERIFIED | VERIFIED | VERIFIED | VERIFIED (+bulk) | N/A | S | — | A2 + BE | `customer-channels` options, product search | CONTRACT_PARTIAL | SUITABLE |
| F12 Loyalty Member | 13/0 | 5 | custom | cards | program | — | YES (CSV) | S | — | A2 (+hdr) | gamification CSV | CONTRACT_PARTIAL | NOT_SUITABLE |
| F13 Pengaturan Poin | 12/12 | 12 | custom | wizard | VERIFIED | — | N/A | S | wizard / toggle | A2 | helper | CONTRACT_PARTIAL | NOT_SUITABLE |
| F14 Inject Poin | UNKNOWN (not separated in A4 §2) | 3 | VERIFIED | wizard | — | cancel | N/A | none | cancel | A2 | customer lookup | CONTRACT_PARTIAL | NOT_SUITABLE (OD-07) |
| F15 Mutasi & Redeem | 0/3 | 1 | VERIFIED | N/A | N/A | N/A | N/A | none | — | A2 | user lookup | CONTRACT_PARTIAL | NOT_SUITABLE (OD-07) |
| F16 Voucher Setting | 0/9 | 6 | cards | wizard | toggle | — | YES | none | wizard | A2 | — | CONTRACT_PARTIAL | NOT_SUITABLE |
| F17 Push Notification | 11/0 | 3 | VERIFIED | VERIFIED | VERIFIED | — | YES | M, S | schedule / cancel / final | A2 + BE | — | CONTRACT_PARTIAL | NOT_SUITABLE |
| F18 Banner & Iklan | 13/0 | 3 | VERIFIED | VERIFIED | VERIFIED + inline | VERIFIED | YES | M, S | — | A2 + BE | OPTIONS | CONTRACT_PARTIAL | NOT_SUITABLE |
| F19 Group Story | 9/0 | 3 | VERIFIED | VERIFIED | VERIFIED | VERIFIED | YES | S | — | A2 | banner list | CONTRACT_PARTIAL | NOT_SUITABLE |
| F20 Produk Sponsor | 8/0 | 3 | VERIFIED | VERIFIED | VERIFIED | VERIFIED (+bulk) | N/A | S | — | A2 + BE | `product-categories` options | CONTRACT_PARTIAL | SUITABLE |
| F21 Gamification | 20/1 | 6 | custom | VERIFIED | VERIFIED | — | YES (+CSV) | S | status / duplicate | A2 | voucher, OSS | CONTRACT_PARTIAL | NOT_SUITABLE |
| F22 Voucher Pengiriman | 5/0 | 2 | VERIFIED | VERIFIED | — | cancel | N/A | S | cancel | A2 | — | CONTRACT_PARTIAL | NOT_SUITABLE |
| F23 GPOS Brand | 6/0 | 2 | VERIFIED | — | — | — | N/A | S | processing / cancel | A2 | — | CONTRACT_PARTIAL | NOT_SUITABLE |
| F24 Kode Telesales | 8/0 | 3 | VERIFIED (GET) | VERIFIED | VERIFIED | VERIFIED (+bulk) | N/A | S | — | A2 (backend not found locally) | `customer-channels` | CONTRACT_PARTIAL | SUITABLE |
| F25 Grup Pelanggan | 10/0 | 3 | VERIFIED | VERIFIED | VERIFIED | VERIFIED (+bulk) | N/A | S | — | A2 (backend not found locally) | cust-id options, product search | CONTRACT_PARTIAL | SUITABLE |
| F26 Konfigurasi Channel | 17/0 | 2 | VERIFIED | wizard | wizard | — | N/A | S | wizard | A2 | many OPTIONS, F30 | CONTRACT_PARTIAL | NOT_SUITABLE |
| F27 Verifikasi Akun | 6/0 | 1 | VERIFIED | N/A | review | N/A | N/A | S | approve / reject | A2 (+hdr) | — | CONTRACT_PARTIAL | NOT_SUITABLE |
| F28 Prinsipal | 9/0 | 3 | VERIFIED | VERIFIED | VERIFIED | VERIFIED | YES (multipart, local disk) | S | — | A2 | — | CONTRACT_PARTIAL | NOT_SUITABLE |
| F29 Pendaftaran Folamil | 2/0 | 1 | N/A | CSV | N/A | N/A | YES | S | — | A2 | point types | CONTRACT_PARTIAL | NOT_SUITABLE |
| **F30 Konfigurasi Umum** | **9/0** | **3** | **VERIFIED** | **VERIFIED** | **VERIFIED** | **VERIFIED (+bulk)** | **N/A** | **S** | **—** | **A2 + BE + Swagger** | **none upstream** | **CONTRACT_PARTIAL** | **SUITABLE** |
| F31 Manajemen Pengguna | 4/0 | 1 | VERIFIED | N/A | status toggle | VERIFIED | N/A | S | status toggle | A2 | — | CONTRACT_PARTIAL | NOT_SUITABLE |
| F32 Konten | 8/0 | 3 | VERIFIED | VERIFIED | VERIFIED | not migrated | N/A | S | — | live (A5.5R / A6R) | — | HOLD | HOLD (D-A6R2-01) |
| F32 FAQ | 8/0 | 3 | VERIFIED | VERIFIED | VERIFIED | VERIFIED (+bulk) | N/A | S | — | A2 + BE + Swagger | `faqs-categories` | CONTRACT_PARTIAL | SUITABLE |
| F32 Masukan | 6/0 | 2 | VERIFIED | N/A (customer-created) | VERIFIED | VERIFIED (+bulk) | N/A | S | — | A2 + BE | — | CONTRACT_PARTIAL | PARTIAL |

### Named features check (exact legacy names)

| Name asked | In legacy? | Exact legacy feature / evidence |
|---|---|---|
| User, User Management | yes | F31 **Manajemen Pengguna**: `/user-management*`, `UserManagementRepository` → `/api/v1/cms/customers/users` |
| Account | yes | F27 **Verifikasi Akun**: `/user-verification*` |
| Role, Permission, Role Management | **no** | `config/access.js` is never consulted; no permission data (A2 §13 #3-4, §15) |
| Menu Management | **no** | menus are hard-coded in `Extender.js` (A2 §13 #12) |
| Settings / Configuration | yes | F30 **Konfigurasi Umum**, F26 **Konfigurasi Channel** |
| Master Data | not a legacy label | data-maintenance CRUD features: F08, F11, F20, F24, F25, F28 |
| Notification | yes | F17 **Push Notification** |

## 5. Dependency analysis

| Dimension | Finding | Evidence |
|---|---|---|
| A6 (D-A6R2-01) | Only F32 Konten depends on it. No other feature lists Content as a dependency → INDEPENDENT_OF_A6 | A1 §23 Dependencies column |
| Upload | F07, F08, F09, F12, F16, F17, F18, F19, F21, F28, F29 need upload. The real signed-URL contract is still BLOCKED (A5.6) | A1 §16 l.1320-1336; A5.6 review |
| Workflow | F03, F05, F13, F14, F16, F17, F21, F22, F23, F26, F27, F31 have workflow / status operations as core capabilities | A1 §23 |
| Auth / session | All modules use the same session and Bearer gateway. A5.1 / A5.5R VERIFIED live (login, refresh, logout) | A5.5R re-gate |
| Authorization | No legacy RBAC, so every module needs new capabilities in the closed A5.4 vocabulary (fail-closed by default). The grant model is still OD-05 / 06 | A2 §13-14; A5.4 |
| DataTable | Modules on `buildtable` map to the A5.5 server DataTable (`sort_by / asc_desc / page / take / keyword` for F30, the same as Content). Row selection for bulk delete exists in `server-data-table.tsx` / `use-data-table.ts` | A1 §7; `GlobalConfigurationMapper.js:8-12`; frontend source |
| Forms | Plain text / select forms fit RHF + Zod + shadcn (A5.6). Uploads, wizards and rich text do not yet | A5.6 |
| Shared foundation | Delete needs a confirm dialog. The `alert-dialog` primitive exists, but no confirm-dialog molecule was built (A6 deferred delete). This is a feature-level addition, not a change to a GO foundation | `src/components/ui/alert-dialog.tsx`; A6 deferred items |

## 6. Blocked modules

| Module | Blocker | Evidence | What must change before it is eligible |
|---|---|---|---|
| F32 Konten | D-A6R2-01 (`is_active=false` not persisted) | `content-service/repository/content.go:67`; A6R-2 evidence | Backend fix + controlled re-verification |
| F07, F08, F09, F12, F16, F17, F18, F19, F21, F28, F29 | Upload prerequisite (real signed-URL / storage contract BLOCKED) | A1 §16; A5.6 | Real upload contract verified (a separate phase) |
| F03, F05, F13, F14, F17, F21, F22, F23, F26, F27 | Workflow / status operations are core | A1 §23 | A workflow contract and pattern verified first |
| F31 Manajemen Pengguna | Core action is `POST /user-management/:id/update-is-active` → `PUT /api/v1/cms/customers/users/:id/status` on real user accounts. No create, so no inert test record. It is also a status-toggle write | A2 §6.2 (UserManagement rows) | Backend contract for the status endpoint, plus a safe test-account strategy |

## 7. Evidence gaps

| Item | State |
|---|---|
| F14 / F15 / F16 navigation and scope | OD-07 undecided; F14 has no separate count in A4 §2 → UNKNOWN |
| F10 scope | 17 REVIEW routes, 6 UNKNOWN screens |
| F06 stock endpoint | literal `url` / `url/id` in A2 §6.1 → CONTRACT_UNKNOWN |
| F04 | read-only; 2 REVIEW routes (OD-09) |
| F32 Masukan | No CMS create, so live write verification would edit real customer feedback. Backend `Updates(feedback)` (`account-service/repository/feedback.go:71`) would likely ignore clearing a field to `""` (INFERRED) |
| F24, F25 | Backend source not found locally → CONTRACT_PARTIAL (legacy intent only) |
| All candidates | Real response envelope, success codes, error / validation shape, unknown-ID behaviour, deployed backend version → NOT VERIFIED (no live call in A7) |
| Inventory counts | Form groups 40 vs 39 rows; dialogs 55 vs 39 rows; HTML functions 34 vs 22 rows; A4 REMOVE composition 120 vs 119 rows |

## 8. Eligible candidates (no ranking)

All of these pass conditions 1–10: independent of A6, no upload or workflow prerequisite, clear scope (ACTIVE, 0 REVIEW), CONTRACT_PARTIAL or better, buildable as a vertical slice, authorization definable, foundation available, no A6 or architecture change.

| Module | Legacy evidence | API evidence | Notes |
|---|---|---|---|
| F11 Pembatasan produk | S081-S083 | A2 + BE (`product-service`, update reloads then `Updates(rec)`, `product_restricted.go:247`) | needs `customer-channels` options and product search |
| F20 Produk Sponsor | S078-S080 | A2 + BE (`dto/sponsored_product.go:45-61`, `sequence` required; update via `Save`) | needs `product-categories` options |
| F24 Kode Telesales | S023-S025 | A2 only (`/cms/loyalties/referral-configurations`) | needs `customer-channels` |
| F25 Grup Pelanggan | S072-S074 | A2 only (`/cms/customer-groups`) | needs cust-id options, product search |
| F30 Konfigurasi Umum | S014-S016 | A2 + BE + Swagger | no upstream dependency |
| F32 FAQ | S039-S041 | A2 + BE + Swagger (`content-service/dto/faq.go:50-66`: title / category / detail required) | needs `faqs-categories`; same backend service as Content |

## 9. Selected next module

```text
Selected Next Module:
Konfigurasi Umum (F30)

API Readiness:
CONTRACT_PARTIAL

Vertical Slice:
SUITABLE
```

**Reason (objective evidence):**
- **Clear scope:** 9 MIGRATE / 0 REVIEW / 3 REMOVE (A4 l.67, l.150-161); 3 screens (S014 list, S015 create, S016 edit).
- **No upstream dependency:** no options, lookups, upload or workflow. It is itself a dependency of F09 and F26.
- **Contract evidence at three levels:**
  - legacy request code;
  - the A2 gateway map;
  - backend handler + DTO + model + generated Swagger for every operation.
- **Data model:** `key` / `value` are both `required` strings with no bool, so the zero-value class of D-A6R2-01 cannot apply (INFERRED from DTO + validator).
- **Same list shape as the live-verified Content list**, so the A5.5 DataTable contract can be re-used and the A6 pattern re-tested on a different backend service and domain.

**Dependencies:**
- Upstream: none.
- Downstream readers:
  - F09 (`GET /global-configurations/detail`, A2 l.516-517);
  - F26 (A2 l.440);
  - backend logic in product-service (§11).

### API contract evidence (F30)

**Classes:** DOCUMENTED = legacy code / A2 / backend source + Swagger; OBSERVED LIVE = none; INFERRED; UNKNOWN.

| Item | Evidence | Class |
|---|---|---|
| List | `GET /api/v1/cms/global-configurations` (A2 l.356; `handler/global_configuration.go:31`) | DOCUMENTED |
| Pagination / sort / search | `sort_by, asc_desc, page, take, keyword` (`GlobalConfigurationMapper.js:8-12`; `dto/global_configuration.go:64-70`) | DOCUMENTED |
| Detail | `GET /:id` (A2 l.358; handler l.35); also `GET /detail?key=` (handler l.32) | DOCUMENTED |
| Create | `POST` `{key, value}` (`GlobalConfigurationRepository.js:12-17`; DTO l.22-25, both required) | DOCUMENTED |
| Update | `PUT /:id` `{key, value}` (repository l.31-37; DTO l.32-35); legacy also `updatebyproductgposb2b` → same PUT (A2 l.363) | DOCUMENTED |
| Delete / bulk delete | `DELETE /:id`, `DELETE /bulk {ids}` (A2 l.357, l.360; handler l.36-37) | DOCUMENTED |
| Response DTO | `{id, key, value}` (DTO l.16-20). **No `created_at`**, although the legacy list shows "Created" and sorts `created_at DESC` (`list.edge:29-31, 79-86`) | DOCUMENTED (conflict noted) |
| Envelope / success codes | not observed | UNKNOWN |
| Validation error | backend `ValidateBody` style 400 `ERR_VALIDATION_ERROR` `data[{FailedField, Tag, Value}]` is the pattern in content-service; product-service not checked | INFERRED |
| Duplicate key | `Key` unique index (`model/global_configuration.go:5`); API behaviour unknown | INFERRED / UNKNOWN |
| Authorization behaviour | menu S only; API authorization UNKNOWN — BACKEND CONTRACT (A2 l.794) | UNKNOWN |

### Vertical slice test (F30)

| Element | Possible with current evidence and foundation? |
|---|---|
| Route / page / navigation | yes (A4 targets `/dashboard/global-configuration[/create\|/update/[id]]`; registry pattern from A5.2) |
| Authorization | yes, new capabilities (fail-closed); grant model OD-05 / 06 open |
| List / DataTable / empty / loading / error | yes (A5.5) |
| Detail | yes (`GET /:id`) |
| Create / Edit / validation | yes (A5.6 forms; 2 text fields) |
| Delete / bulk delete | yes, plus a confirm-dialog molecule (feature-level; or defer as A6 did) |
| Server Actions / DAL / use case / repository / gateway | yes (A5.3, A6 pattern) |
| Tests | yes (TEST_ADAPTER unit / E2E); live: read-only first, then writes only on an inert test key |

## 10. Proposed next phase

```text
A7 — Konfigurasi Umum Contract & Readiness
```

Readiness only, no implementation. It must cover:

```text
Legacy behavior → Route inventory → API contract → Canonical DTO → Authorization → UI contract
→ Data/state contract → Error contract → Test strategy → Live verification plan
→ GO / GO-WITH-RISKS / HOLD
```

## 11. Risks

**Confirmed (from source):**
1. Configuration values drive backend behaviour:
   - `MAINTENANCE` and `BANNER_INTERVAL` (`product-service/usecase/banner.go:112,145`);
   - `CUSTOMER_CHANNEL_ID_ONLY_ZOETIS_VETE…` (`banner.go:123`, `sponsored_product.go:129`);
   - `PRODUCT_IDS_ONLY…` (`sponsored_product.go:145`);
   - read by F09 and F26 in legacy (A2 l.440, 516-517).
   Live writes may only use a new inert key, and authorization is more sensitive than for Content.
2. The legacy list "Created" column and `created_at DESC` default sort have no field in the backend response DTO (`{id, key, value}`), the same class as Content risk R2.
3. `updatebyproductgposb2b` belongs to F30 routes but is triggered from F09, so its scope boundary must be decided in A7 readiness.
4. Backend update uses `repo.db.Updates(struct)` (`repository/global_configuration.go:123`).

**Inferred:**
1. Risk 4 is safe for F30 only because both fields are required and non-empty.
2. Validation and duplicate-key error shapes follow the content-service pattern.

**Unknown:**
- deployed backend version (local branch `cms-filter-banner`);
- response envelope and success codes;
- unknown-ID status (403 vs 404, cf. Content R3);
- API-key requirement (S7) and GET-body behaviour (S6) carried from A5.5R;
- backend authorization for writes.

## 12. Evidence references

| Conclusion | File / path | Section / lines |
|---|---|---|
| 32 features, capabilities, dependencies | `gpos-b2b-cms/docs/migration/ROUTE_SCREEN_MAP.md` | §23, l.1821-1857 |
| Inventory counts | same | §1 l.16-57; §7 l.875-957; §8 l.958-988; §11 l.1068-1115; §12 l.1175-1222; §16 l.1309-1336; §28 l.1981 |
| Route dispositions | `A4_ROUTE_MIGRATION_MATRIX.md` | §1 l.18; §2 l.26-71; §3 rows (F30 l.150-161) |
| Form count citation | `A4_FORM_ARCHITECTURE.md` | l.7 |
| Workflow definition | `A4_MIGRATION_CONTRACT.md` | P-01 l.19 |
| Authorization model / permission matrix | `AUTH_API_PERMISSION_MAP.md` | §13-15 l.733-813 (F30 l.794) |
| Gateway map | same | §6.1 l.196-243; §6.2 F30 l.355-363; UserManagement / ReferralCode / CustomerGroup / FAQ / Feedback / ProductRestricted / SponsoredProduct rows |
| F30 legacy source | `gpos-b2b-cms/app/Repositories/GlobalConfigurationRepository.js` l.4-58; `app/Mapper/GlobalConfigurationMapper.js` l.8-12; `resources/views/global_configurations/list.edge` l.29-31, 79-86; `create.edge` l.28-39; `app/Controllers/Http/GlobalConfigurationController.js` l.61, 107 (validator) | commit `00bc6ea` |
| F30 backend | `~/Developments/BE/gpos-b2b-product-service/handler/global_configuration.go` l.28-38; `dto/global_configuration.go` l.16-41, 64-70; `model/global_configuration.go` l.3-7; `repository/global_configuration.go` l.122-130; `docs/` (swaggo) | commit `b5ca719` |
| Config consumers | `product-service/usecase/banner.go` l.112, 123, 145; `usecase/sponsored_product.go` l.129, 145 | `b5ca719` |
| Other candidates' backend | `product-service/repository/product_restricted.go` l.247; `dto/sponsored_product.go` l.45-61; `content-service/dto/faq.go` l.50-66, `repository/faq.go` l.85; `account-service/repository/feedback.go` l.71 | — |
| A6 blocker | `content-service/repository/content.go` l.67; `model/content.go` l.8; `frontend/docs/architecture/reviews/A6_WRITE_CONTRACT_READINESS.md` (A6R-1 / A6R-2 closeout) | `7897199` |
| Upload blocked | `frontend/docs/architecture/reviews/A5.6_FORM_UPLOAD_FOUNDATION.md` | Real Backend Upload Contract |
| Foundation fit | `frontend/src/components/organisms/data-table/server-data-table.tsx`, `src/shared/hooks/use-data-table.ts`, `src/components/ui/alert-dialog.tsx` | — |

## Self-check

| Check | Result |
|---|---|
| A6 = HOLD / BLOCKED | unchanged |
| D-A6R2-01 = OPEN / CRITICAL | unchanged |
| Source / test / config changed | no (checksums identical before and after) |
| API / DB mutation | none (no HTTP request at all) |
| A6 workaround | none |
| All 32 feature areas examined | yes (34 rows; F32 split) |
| Selection based on evidence; no ranking / score | yes |
| UNKNOWN kept UNKNOWN; no invented API contract | yes |
| Report created | this file (documentation only) |
