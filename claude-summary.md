**A6 = HOLD.** The next module that's eligible on objective evidence is **F30 Konfigurasi Umum**. This matches the previous audit, and is now backed by verified scope counts, a foundation-fit check, and contract-readiness classes.

This was read-only. I sent no HTTP requests or mutations, changed no files, and left A6 untouched.

```text
A6 Content = HOLD / BLOCKED
D-A6R2-01  = OPEN / CRITICAL
```

## 1. Executive finding

```text
A6 = HOLD
Next eligible module = F30 Konfigurasi Umum
```

Why F30:
- **Simple scope:** CRUD plus bulk delete, 3 screens, 9 MIGRATE / 0 REVIEW routes.
- **No dependency on Content, upload or Workflow.**
- **Contract evidence exists on three levels:** legacy request code, the A2 gateway map, and the backend source with its generated Swagger (`gpos-b2b-product-service`).
- **The data model can't hit the D-A6R2-01 bug class:** `key` and `value` are both required strings, with no bool field.
- **The list parameters match Content exactly** (`sort_by/asc_desc/page/take/keyword`), so the A5.5 DataTable contract carries over.

## 2. Legacy feature inventory: scope-count check

| Number | Source | Check | Status |
|---|---|---|---|
| 32 feature areas | A1 §1 l.28, §23 l.1821-1857 | 32 IDs, F01–F32; F32 covers 3 sub-modules | VERIFIED |
| 427 routes / 330 frontend-relevant | A1 §1 l.18 | 427 − 97 resource routes with no action = 330 | VERIFIED |
| 259 MIGRATE | A4 matrix §2 l.30 | 259 + 49 REVIEW + 119 REMOVE = 427 | VERIFIED |
| 330 vs 308 | A1 vs A4 | A4 also REMOVEs 3 missing actions, 18 duplicates and 2 dead helpers: 330 − 23 = **307**, while 259 + 49 = **308**. **Discrepancy of 1**, not resolved | UNKNOWN |
| 107 screens | A1 §1 l.20 | — | VERIFIED |
| 32 DataTable / 9 custom lists | A1 §1 l.31-34, §7 l.900-957 | both tables have exactly 32 and 9 rows | VERIFIED |
| 13 upload capabilities | A1 §16 l.1320-1336 | 13 rows | VERIFIED |
| **40 form groups** | A1 §11 (cited by A4_FORM_ARCHITECTURE l.7) | the §11.1 table has **39** rows | **Discrepancy** (a row may hold 2 forms). UNKNOWN |
| **55 modals** | A1 §12 l.1177 | the table has **39** rows (rows grouped) | **Discrepancy**: the text says 55, rows say 39. UNKNOWN |
| **34 HTML functions** | A1 §1 l.36, §28 E4 l.1981 | the §8 table has **22** rows (grouped) | **Discrepancy**. UNKNOWN |

## 3. Module matrix

Sources for the columns:

| Column | Source |
|---|---|
| Routes (M/R) | A4 §2 |
| Screens | A1 §23 |
| DataTable | A1 §7 |
| CRUD | A1 §23 Capabilities |
| Upload | A1 §16 |
| Auth (menu) | A2 §14 |
| API | A2 §6.1 plus backend source where checked |

Across every module, Adonis authorization is session-only and API authorization is `UNKNOWN — BACKEND CONTRACT` (A2 §13 #5-10).

| Module | Routes | Screens | DataTable | CRUD | Upload | Auth | Workflow | API | Dependency | Status |
|---|---:|---:|---|---|---|---|---|---|---|---|
| F01 Login/sesi | 3/0 | 1 | N/A | N/A | N/A | public | N/A | VERIFIED (live) | session | migrated (A5.1) |
| F02 Beranda | 1/0 | 1 | N/A | N/A | N/A | S | N/A | N/A | — | static (OD-P4) |
| F03 Order/Pesanan | 4/2 | 2 | VERIFIED | detail; delete broken | N/A | S | sync | PARTIAL | — | BLOCKED |
| F04 Order Review | 3/2 | 2 | VERIFIED | detail only | N/A | S | — | PARTIAL | — | INSUFFICIENT |
| F05 Pembayaran | 4/0 | 2 | VERIFIED | detail | N/A | P,S | trigger | PARTIAL | — | BLOCKED |
| F06 Inventory | 13/0 | 3 | VERIFIED | CRUD + stock | N/A | S | — | PARTIAL (stock path is the literal `url`) | product search | INSUFFICIENT |
| F07 Produk | 7/0 | 2 | VERIFIED | edit | **YES** | S | — | PARTIAL | — | BLOCKED |
| F08 Kategori Produk | 9/0 | 3 | VERIFIED | CRUD | **YES** | S | — | PARTIAL + BE source | — | BLOCKED |
| F09 Produk Gpos B2b | 7/3 | 4 | VERIFIED | config | **YES** | S | — | PARTIAL | F30, CustomCriteria | BLOCKED |
| F10 Personalisasi Katalog | 9/17 | 9 | VERIFIED | CRUD, inline | N/A | S | — | PARTIAL | OPTIONS | INSUFFICIENT |
| F11 Pembatasan produk | 10/0 | 3 | VERIFIED | CRUD | N/A | S | — | PARTIAL + BE source | customer-channels | ELIGIBLE |
| F12 Loyalty Member | 13/0 | 5 | custom | cards, CSV | **YES** | S | — | PARTIAL (+hdr) | gamification CSV | BLOCKED |
| F13 Pengaturan Poin | 12/12 | 12 | custom | wizard, toggle | N/A | S | wizard/toggle | PARTIAL | helper | BLOCKED |
| F14 Inject Poin | UNKNOWN (not split out in A4 §2) | 3 | VERIFIED | wizard, cancel | N/A | none | cancel | PARTIAL | customer lookup | INSUFFICIENT (OD-07) |
| F15 Mutasi & Redeem | 0/3 | 1 | VERIFIED | N/A | N/A | none | — | PARTIAL | user lookup | INSUFFICIENT (OD-07) |
| F16 Voucher Setting | 0/9 | 6 | cards | wizard, toggle | **YES** | none | wizard | PARTIAL | — | BLOCKED |
| F17 Push Notification | 11/0 | 3 | VERIFIED | CRUD | **YES** | M,S | schedule/cancel/final | PARTIAL + BE source | — | BLOCKED |
| F18 Banner & Iklan | 13/0 | 3 | VERIFIED | CRUD, inline | **YES** | M,S | — | PARTIAL + BE source | OPTIONS | BLOCKED |
| F19 Group Story | 9/0 | 3 | VERIFIED | CRUD | **YES** | S | — | PARTIAL | banner list | BLOCKED |
| F20 Produk Sponsor | 8/0 | 3 | VERIFIED | CRUD | N/A | S | — | PARTIAL + BE source | product-categories | ELIGIBLE |
| F21 Gamification | 20/1 | 6 | custom | create/edit/dup | **YES** | S | status/dup | PARTIAL | voucher, OSS | BLOCKED |
| F22 Voucher Pengiriman | 5/0 | 2 | VERIFIED | create | N/A | S | cancel | PARTIAL | — | BLOCKED |
| F23 GPOS Brand | 6/0 | 2 | VERIFIED | — | N/A | S | processing/cancel | PARTIAL | — | BLOCKED |
| F24 Kode Telesales | 8/0 | 3 | VERIFIED | CRUD + bulk | N/A | S | — | PARTIAL (no BE source locally) | customer-channels | ELIGIBLE |
| F25 Grup Pelanggan | 10/0 | 3 | VERIFIED | CRUD | N/A | S | — | PARTIAL (no BE source locally) | cust-id options, product search | ELIGIBLE |
| F26 Konfigurasi Channel | 17/0 | 2 | VERIFIED | wizard | N/A | S | wizard | PARTIAL | many OPTIONS, F30 | BLOCKED |
| F27 Verifikasi Akun | 6/0 | 1 | VERIFIED | review | N/A | S | approve/reject | PARTIAL (+hdr) | — | BLOCKED |
| F28 Prinsipal | 9/0 | 3 | VERIFIED | CRUD | **YES** (multipart, local disk) | S | — | PARTIAL | — | BLOCKED |
| F29 Pendaftaran Folamil | 2/0 | 1 | N/A | CSV | **YES** | S | — | PARTIAL | point types | BLOCKED |
| **F30 Konfigurasi Umum** | **9/0** | **3** | **VERIFIED** | **CRUD + bulk** | **N/A** | **S** | **—** | **PARTIAL + BE source + Swagger** | **—** | **ELIGIBLE** |
| F31 Manajemen Pengguna | 4/0 | 1 | VERIFIED | toggle, export | N/A | S | status toggle | PARTIAL | — | BLOCKED |
| F32 Konten | 8/0 | 3 | VERIFIED | CRUD | N/A | S | — | VERIFIED (A5.5R/A6R) | — | **HOLD (D-A6R2-01)** |
| F32 FAQ | 8/0 | 3 | VERIFIED | CRUD | N/A | S | — | PARTIAL + BE source | faqs-categories | ELIGIBLE (with risk) |
| F32 Masukan | 6/0 | 2 | VERIFIED | edit only | N/A | S | — | PARTIAL + BE source | — | INSUFFICIENT |

A6 dependency: only F32 Konten is BLOCKED_BY_A6. Every other module is INDEPENDENT_OF_A6, because none of them lists Content as a dependency in A1 §23.

## 4. Blocked modules

| Module | Blocked because | Evidence |
|---|---|---|
| F32 Konten | D-A6R2-01 is still open | A6R closeout; backend `repository/content.go:67` |
| F07, F08, F09, F12, F16, F17, F18, F19, F21, F28, F29 | Need upload; the real upload contract from A5.6 is still BLOCKED | A1 §16 l.1320-1336; A5.6 doc (Real Backend Upload Contract = BLOCKED) |
| F03, F05, F13, F17, F21, F22, F23, F26, F27 | Workflow (sync, trigger, wizard, schedule/cancel/final, approve/reject, status) is a core capability | A1 §23 Capabilities column; A4_MIGRATION_CONTRACT P-01 l.19 |
| F31 | Its main action is a status toggle (`POST /user-management/:id/update-is-active` → `PUT /cms/customers/users/:id/status`) on real user accounts. There's no create, so there's no inert test record | A2 §6.2 (UserManagement rows) |

## 5. Insufficient evidence

| Module | Missing evidence | Why it matters |
|---|---|---|
| F14, F15 | No navigation; OD-07 undecided. F14 has no separate route count in A4 §2 | Scope and access are unclear |
| F10 | 17 REVIEW routes, 6 UNKNOWN screens | A readiness gate can't be built yet |
| F06 | Stock base path recorded as the literal `url` / `url/id` (A2 §6.1) | The stock endpoint is unknown |
| F04 | 2 REVIEW routes (OD-09); read-only | It wouldn't produce write evidence |
| F02 | Static content (OD-P4) | No API |
| F32 Masukan | No create in the CMS; backend uses `Updates(feedback)` (`account-service/repository/feedback.go:71`) | Live write verification would have to edit real customer feedback, and clearing a field to `""` would likely be ignored (INFERRED) |

## 6. Eligible candidates

| Module | Legacy evidence | API evidence | Authorization | Dependencies | Vertical slice |
|---|---|---|---|---|---|
| **F30 Konfigurasi Umum** | S014-S016; DataTable; form key/value; validator `GlobalConfigurationCreateEdit` | **CONTRACT_PARTIAL+**: A2 + backend source + Swagger; runtime UNKNOWN | menu S; new capability needed | none upstream | SUITABLE |
| F11 Pembatasan produk | S081-S083 | CONTRACT_PARTIAL (+BE source; update reloads then `Updates(rec)`, `product_restricted.go:247`) | menu S | customer-channels options, product search | SUITABLE |
| F20 Produk Sponsor | S078-S080 | CONTRACT_PARTIAL (+BE source; update uses `Save`) | menu S | product-categories options | SUITABLE |
| F32 FAQ | S039-S041 | CONTRACT_PARTIAL (+BE source; `Where(id).Updates(faq)` with `Sequence int`, `faq.go:85`, `model/faq.go:10`) | menu S | faqs-categories | PARTIAL: sequence `0` is likely ignored, same bug class as D-A6R2-01 (INFERRED) |
| F24 Kode Telesales | S023-S025 | CONTRACT_PARTIAL (A2 only) | menu S | customer-channels | SUITABLE |
| F25 Grup Pelanggan | S072-S074 | CONTRACT_PARTIAL (A2 only) | menu S | cust-id options, product search | SUITABLE |

**Foundation fit for the candidates (A5.5 / A5.6 / A6):**
- **DataTable:** the A5.5 contract is enough. `server-data-table.tsx` and `use-data-table.ts` already support row selection for bulk delete.
- **Forms:** the RHF/Zod/shadcn form foundation is enough for plain text fields.
- **Delete:** the `alert-dialog` primitive exists, but there's no confirm-dialog component yet (A6 deferred delete). This is a small gap, not a prerequisite: delete could be split out the same way A6 did.

## 7. Selected next module

```text
Module:          F30
Exact legacy name: Konfigurasi Umum (A1 §23, l.1854)
```

**Legacy routes:** 9 MIGRATE, 0 REVIEW, 3 REMOVE (A4 l.67, l.150-161).

| Kind | Routes |
|---|---|
| Pages | `GET /global-configuration`, `/create`, `/:id/edit` |
| Actions | `POST /datatable`, `POST` store, `PUT /:id`, `POST /delete`, `POST /multidelete`, `POST /updatebyproductgposb2b` (called from F09) |

**Screens** (A1 l.533-535):

| Screen | Content |
|---|---|
| S014 list | DataTable `#dataTable-global-configurations`; columns Key, Value, Created; default sort `created_at DESC` |
| S015 create | `form_text` fields `key`, `value` |
| S016 edit | `form_text` fields `key`, `value` |

**API evidence:**

| Source | Detail | Status |
|---|---|---|
| Legacy request | `{key, value}` (`GlobalConfigurationRepository.js:4-58`); list params `sort_by, asc_desc, take, keyword` (`GlobalConfigurationMapper.js:8-12`) | Intent only |
| A2 gateway map | `GET/POST /api/v1/cms/global-configurations`, `GET/PUT/DELETE /:id`, `DELETE /bulk` (l.356-363) | Intent only |
| Backend product-service: routes | `handler/global_configuration.go:31-37`, plus `GET /detail?key=` | VERIFIED (code) |
| Backend product-service: DTO | `dto/global_configuration.go:16-41`: response `{id, key, value}`; `key` and `value` both `required` | VERIFIED (code) |
| Backend product-service: list DTO | `:64-70`, same `sort_by/asc_desc/page/take/keyword` as Content | VERIFIED (code) |
| Backend product-service: model | `model/global_configuration.go:3-7`, unique key, no bool | VERIFIED (code) |
| Runtime and deployed version | Local branch is `cms-filter-banner` `b5ca719`; deployed version unknown | UNKNOWN |

**Authorization:** menu S only, session only, API UNKNOWN (A2 §14 l.794). It needs a new capability; the grant model is still OD-05/06.

**Dependencies:**
- Upstream: none.
- Downstream: F09 and F26 read F30 (A2 l.440, l.516-517).

**Why eligible:**
- Passes all 8 eligibility criteria.
- The list contract is the same shape as Content, so the A6 architecture pattern can be re-tested on a different domain, service and data model.
- Doesn't touch A6 or the foundation.

**Proposed phase:** `A7 — Konfigurasi Umum Contract & Readiness`. This covers legacy behavior → route inventory → API contract → canonical DTO → authorization → UI contract → data/state contract → error contract → test strategy → live verification plan → GO / GO-WITH-RISKS / HOLD.

## 8. Risks (found in evidence)

1. **Config values drive backend logic:** `MAINTENANCE`, `BANNER_INTERVAL` (`usecase/banner.go:112,145`), `CUSTOMER_CHANNEL_ID_ONLY_…` (`banner.go:123`, `sponsored_product.go:129`), and `PRODUCT_IDS_ONLY…` (`sponsored_product.go:145`). So live verification may only use a new inert key; existing keys must never be edited. Authorization is also more sensitive than for Content.
2. **No "Created" field:** the legacy list has a Created column and default sort `created_at DESC`, but the backend response only has `{id, key, value}`. This is the same class as risk R2 in Content.
3. **Update uses `Updates(struct)`** (`repository/global_configuration.go:123`). It's safe only because both fields are required and non-empty (INFERRED). An empty `value` is rejected by the validator first.
4. **Cross-feature route:** `updatebyproductgposb2b` belongs to F30 but is called from F09. Its scope has to be decided in A7.
5. **Unknown runtime behavior:** deployed version, response envelope, success codes, error shape and unknown-id handling are all unverified.
6. **Shared risks still open:** the A5.5R API-key requirement (S7) and GET-body behavior (S6) are unverified, and there's no restricted account for denial tests.

## 9. Evidence references

| Conclusion | File / section | Lines | Status |
|---|---|---|---|
| 32 features, capabilities, dependencies | `gpos-b2b-cms/docs/migration/ROUTE_SCREEN_MAP.md` §23 | 1821-1857 | VERIFIED |
| Scope counts | same, §1 / §7 / §11 / §12 / §16 / §8 | 16-57, 875-957, 1068-1115, 1175-1222, 1309-1336, 958-988 | VERIFIED; discrepancies noted |
| Route dispositions | `A4_ROUTE_MIGRATION_MATRIX.md` §2, §3 | 26-71, 150-161 | VERIFIED |
| Authorization model | `AUTH_API_PERMISSION_MAP.md` §13-15 | 733-813 (F30: 794) | VERIFIED |
| Gateway map | same, §6.1 / §6.2 | 196-243, 355-363 | VERIFIED (intent) |
| Workflow definition | `A4_MIGRATION_CONTRACT.md` P-01 | 19 | VERIFIED |
| F30 legacy | `app/Repositories/GlobalConfigurationRepository.js`; `app/Mapper/GlobalConfigurationMapper.js`; `resources/views/global_configurations/{list,create}.edge` | 4-58; 8-12; list 29-31, 79-86; create 28-39 | VERIFIED |
| F30 backend | `~/Developments/BE/gpos-b2b-product-service/{handler,dto,model,repository}/global_configuration.go` | 31-37; 16-41, 64-70; 3-7; 122-130 | VERIFIED (code); runtime UNKNOWN |
| Config consumers | `usecase/banner.go`, `usecase/sponsored_product.go` | 112, 123, 145; 129, 145 | VERIFIED (code) |
| FAQ / Masukan update pattern | `content-service/repository/faq.go`, `model/faq.go`; `account-service/repository/feedback.go` | 85, 10; 71 | VERIFIED (code); effect INFERRED |
| Frontend selection / dialog | `frontend/src/components/organisms/data-table/server-data-table.tsx`, `src/shared/hooks/use-data-table.ts`, `src/components/ui/alert-dialog.tsx` | — | VERIFIED (present) |
| Upload blocked | `frontend/docs/architecture/reviews/A5.6_FORM_UPLOAD_FOUNDATION.md` | — | VERIFIED |

Nothing in the repository changed.

```text
A6 Content = HOLD / BLOCKED
D-A6R2-01  = OPEN / CRITICAL
```
