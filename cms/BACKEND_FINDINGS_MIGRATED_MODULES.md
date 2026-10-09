# Backend Findings — Migrated Modules Only

| Field | Value |
|---|---|
| Date | 2026-10-09 |
| Purpose | One consolidated list, for the modules already migrated to the new frontend, of (A) backend **SQL-injection risks** and (B) backend behaviour that **does not match legacy / the expected contract** |
| Modules included | Foundation: F32 Konten (HOLD), F30 Konfigurasi Umum, F11 Pembatasan Produk · Batch 1: F20, F24, F25, F32 FAQ, F32 Masukan · Batch 2: F07, F08, F18, F19, F28 · Batch 3: F10, F09, F06 · Batch 4: F27, F31 |
| Excluded | F04 Order Review (SKIP / inactive; its findings B3-01 / B3-02 stay in `F04_ORDER_REVIEW_REPORT.md`) |
| Sources | module reports in `cms/` and `frontend/docs/architecture/reviews/` (Batch 1–4, F11, F30, Konten / A6); backend source re-checked 2026-10-09 for Konten and F24 |
| Rule | Findings are copied from the evidence; no status was upgraded. **"Frontend mitigation" never means the backend is fixed** |

## A. SQL-Injection Risks (backend builds SQL from request input)

All of these are backend defects. The migrated frontend only ever sends fixed / allowlisted values, so it does not add exposure. **Any caller with an accepted token can still exploit them directly.**

| # | Module | Endpoint (service) | Unsafe input | Evidence | Frontend mitigation | Status |
|---|---|---|---|---|---|---|
| 1 | **F31** Manajemen Pengguna | `GET /cms/customers/users` (account) | **`filters[].value` inside `IN (…)`** (raw value), filter column / operator, `search_by`, `sort_by`, `asc_desc` | F31-CA-01 (**CRITICAL**), CA-02; `mapper/cms_customer.go:21, 28-32, 38` @ `c712ba6` | constants + UUID-validated quoted ids | **OPEN**: fix exists only as uncommitted branch `fix/f31-cms-customer-sql-injection` (review CONDITIONAL PASS, not merged) |
| 2 | F31 / F18 (branch options) | `GET /cms/customer-areas` (account) | `sort_by`, `asc_desc`, filter column / operator | F31-CA-02; `mapper/cms_customer_area.go:19, 26` | constants (`name asc`), no filters | OPEN (same branch fix, not merged) |
| 3 | F18 Banner, F25 Grup Pelanggan (customer lookup) | `GET /cms/customers` (account) | `search_by`, `sort_by`, `asc_desc`, filters | same mapper as #1 (`ToCustomerDatatableFromSpec`) | constants (`aam_customer_id`, `name asc`) | OPEN (same branch fix, not merged) |
| 4 | F18 Banner, F11 Pembatasan Produk (channel lookup) | `GET /cms/customer-channels` (account) | `sort_by`, `asc_desc`, filter column / operator | G-13; `mapper/cms_customer_channel.go:19, 26`; F11 report F5 | constants (`name asc`) | **OPEN**: not covered by the F31 fix; separate ticket needed |
| 5 | F11, F07 (product lookup / list) | `GET /cms/products` (product) | `sort_by`, `asc_desc` | F11 report F5; B2-06 | allowlist / constants | OPEN |
| 6 | F07 Produk, F08 Kategori Produk, F18 Banner, F28 Prinsipal | list endpoints (product / content) | `sort_by` (ORDER BY) | **B2-06** (`BATCH2_CLOSURE_GATE.md` §8) | allowlist | OPEN |
| 7 | F20 Produk Sponsor | `GET /cms/sponsored-products` (product) | `sort_by` (ORDER BY) | Batch 1 report (VERIFIED backend) | allowlist | OPEN |
| 8 | F32 FAQ | `GET /cms/faqs` (content) | `sort_by`, `asc_desc` | Batch 1 report; `mapper/faq.go:117` (`OrderBy: spec.SortBy + " " + spec.AscDesc`) | allowlist | OPEN |
| 9 | F32 Masukan | `GET /cms/feedbacks` (account) | `sort_by` (ORDER BY) | Batch 1 report (VERIFIED backend) | allowlist | OPEN |
| 10 | **F32 Konten** (HOLD) | `GET /cms/contents` (content) | `sort_by`, `asc_desc` | **newly recorded here:** `repository/content.go:50` `Order(fmt.Sprintf("%s %s", spec.SortBy, spec.AscDesc))` (content-service clone `7897199`, 2025-10-16, may be stale) | allowlist (`code`, `name`, `is_active`, `created_at`) | OPEN; to be re-verified on the current branch |
| 11 | F30 Konfigurasi Umum, F09 settings | `GET /cms/global-configurations` (product) | `sort_by`, `asc_desc` | R-F30-02; **B3-13**: `repository/global_configuration.go:69`, unquoted `ORDER BY key` → HTTP 500 (confirmed live) | allowlist | OPEN |
| 12 | F10 Personalisasi Katalog | `GET /cms/custom-catalogs` (+ homepage products) (product) | `sort_by` (ORDER BY) | **B3-06** | allowlist | OPEN |
| 13 | F09 Produk GPOS B2B | `GET /cms/product-gposb2b-homepages` (product) | `sort_by` (ORDER BY) | **B3-09** (`repository:38`) | allowlist | OPEN |
| 14 | F06 Inventory | `GET /cms/inventories` (+ stock list) (product) | `sort_by`, `asc_desc` | **B3-14** (`repository/inventory.go:50`) | allowlist | OPEN |

**Verified safe or not applicable:**

| Module | Endpoint | Why |
|---|---|---|
| F24 Kode Telesales | `GET /cms/loyalties/referral-configurations` (loyalty) | `sort_by` mapped through a `switch` allowlist; direction forced to `ASC` / `DESC` (`mapper/referral_configuration.go:76-90`) |
| F27 Verifikasi Akun | `GET /cms/users/need-approvals` (account) | no sort parameter (fixed `updated_at DESC`); `search_by` validated `oneof=email customer_id`; keyword bound |

**Not verifiable (backend source not available):**

| Module | Endpoint | Status |
|---|---|---|
| F25 Grup Pelanggan | `/cms/customer-groups` (config-service) | NEEDS EVIDENCE |
| F19 Group Story | `/cms/story-groups` | NEEDS EVIDENCE |

**Highest priority:**
1. #1 (value-level injection on `customers/users`, CRITICAL): merge the reviewed fix.
2. #2 – #4 (account-service lookups used by several modules): #2 and #3 are covered by the same fix; #4 needs a separate ticket.
3. All ORDER BY concatenations (#5 – #14): allowlist server-side.

## B. Backend Behaviour Not Matching Legacy / Expected Contract

These are not SQL injection, but each is a backend behaviour that differs from what legacy or the documented contract expects, or that silently loses data. "Handling" states what the migrated frontend does: it never fakes data.

### Foundation

| Module | ID | Finding | Handling | Status |
|---|---|---|---|---|
| F32 Konten (HOLD) | D-A6R2-01 | `Updates(struct)` drops `is_active=false`; model default `true` makes `false` on create become `true` | no workaround; module on HOLD | OPEN / CRITICAL |
| F30 | R-F30-03 | duplicate key → 500 (not 400 / 409); soft-deleted keys cannot be re-used | shown as server error, input kept | OPEN |
| F30 | R-F30-04 | no backend max `take` | frontend caps at 50 | OPEN |
| F30 | R-F30-05 | delete / bulk transactions return without rollback on error | reported | OPEN |
| F30 | R-F30-06 | bulk delete of unknown ids returns success | sends only ids from the current page | OPEN |
| F30 | R-F30-07 | backend validation `data[]` not mapped to fields | client / server zod first | OPEN |
| F30 / F09 | B3-11 | `/global-configurations/detail` reads keys from a GET body | F09 uses the list instead | OPEN |
| F11 | F2 | `DELETE /product-restricted/:id` registered before `/bulk` → bulk unreachable (404) | bulk not migrated (no legacy trigger) | OPEN |
| F11 | F3 | empty channel list accepted (would lift the restriction, keep the record) | frontend requires ≥ 1 (legacy rule) | OPEN |
| F11 | F4 | any channel id string stored | frontend validates against the channel list | OPEN |
| F11 | F6 | delete transaction without rollback | reported | OPEN |

### Batch 1

| Module | Finding | Handling | Status |
|---|---|---|---|
| F32 FAQ | `total_rows` = 0 on every page after the first (`Count` after `Offset/Limit`) | **confirmed live**; no workaround | OPEN |
| F32 FAQ | create returns **201**; legacy checked 200 → every successful create showed "Gagal" | 201 accepted | legacy bug fixed |
| F32 Masukan | list SQL errors swallowed (empty list); `updated_by` never set; bulk delete of unknown ids succeeds | errors shown when returned | OPEN |
| F32 Masukan | legacy default sort `customer_email` is not a column | allowlist `feedback_type` / `feedback_date` / `created_at` | legacy bug fixed |
| F20 | no uniqueness / existence checks; detail `product_category_name` never written | UI resolves the name from options | OPEN |
| F20 | legacy edit did not preselect the product → save failed "product_id is required" | product pre-filled | legacy bug fixed |
| F24 | draft without points → 400; start = end → 400 (legacy allowed both) | validation matches backend | legacy mismatch fixed |
| F24 | legacy sent sort `period` (ignored by backend); rule fallback `'AND'` invalid enum; literal `"ALL"` channel does not round-trip | sends `referral_config_start_at`; explicit choice; "ALL" dropped | legacy mismatch fixed |
| F24 | no DB unique index on `referral_code`; `customer_channel_ids` stored but not enforced; period string built in the DB timezone | reported | OPEN |
| F25 | `customer_ids` semantics unknown (legacy select mode = internal ids, manual mode = AAM ids); detail member key inferred; source unavailable | **live WRITE blocked** | OPEN / NEEDS EVIDENCE |

### Batch 2

| Module | ID | Finding | Status |
|---|---|---|---|
| F07 | B2-01 | `GET /cms/products/{id}` unknown id → **500** (should be 404) | OPEN |
| F07 | B2-02 | `PUT /cms/products/{id}` forces `is_draft=false`; `Save` overwrites the whole row (can undo an ERP sync) | OPEN |
| F18 | B2-03 | banner `Updates(struct)` drops `sequence=0`, empty link / content / image, `story_image=null` | OPEN |
| F28 | B2-04 | principal `Updates(struct)` drops `is_active=false` and cleared phone / fax / website / address (cannot deactivate) | OPEN |
| F18 / F10 / F09 | B2-05 | criteria `Updates(struct)` drops price 0 | OPEN |
| F19 | B2-07 | story-group source unavailable; WRITE contract unverified | OPEN / NEEDS EVIDENCE |
| F28 / F07 | B2-08 | ORDER BY without a tiebreaker → page 1 / 2 overlap (confirmed live on F28; same in legacy) | OPEN |

### Batch 3

| Module | ID | Finding | Status |
|---|---|---|---|
| F10 | B3-03 | `Updates(struct)` drops zero values (deactivate catalog, sequence 0, clear price) | OPEN |
| F10 | B3-04 | catalog search: `total_rows` ignores the keyword (**confirmed live**: hit 2 / total 6) | OPEN |
| F10 | B3-05 | deleting a catalog leaves homepage rows and criteria (no cascade) | OPEN |
| F09 | B3-07 | `PRODUCT_GPOSB2B` criteria may have no buyer-side effect (no caller) | NEEDS EVIDENCE |
| F09 | B3-08 | homepage search matches `product_id` only; list DB errors ignored | OPEN |
| F09 | B3-10 | zero values not persisted (sequence 0, price 0) | OPEN |
| F09 | B3-12 | legacy `homepages/options` has no handler / gateway route | OPEN |
| F09 / F30 | B3-13 | `sort_by=key` → HTTP 500 (Settings tab cannot load on devb2b; **confirmed live**) | OPEN |
| F06 | B3-15 | HNA update calls Elastic with empty `product_id` / `distributor_id` before the DB write | NEEDS EVIDENCE (write path) |
| F06 | B3-16 | CMS stock create / update / delete never update Elastic → stale buyer stock | OPEN |
| F06 | B3-17 | stock update / delete do not check the stock belongs to the URL inventory | OPEN |
| F06 | B3-18 | invalid expiry date persisted as year 1 | OPEN |
| F06 | B3-19 | `created_at` always zero time | OPEN |
| F06 | B3-20 | deleting an inventory leaves its stock rows | OPEN |
| F06 | B3-21 | CMS stores distributor `aam` / `bintang`; cart compares a UUID | NEEDS EVIDENCE |
| F06 | B3-22 | some rows have empty product code / name | NEEDS EVIDENCE |

### Batch 4

| Module | ID | Finding | Status |
|---|---|---|---|
| F27 | F27-CA-01 | empty list returns **404** (not 200 / `[]`) | OPEN (frontend rule: 404 → empty, list only) |
| F27 | F27-CA-02 | customer-id search: non-numeric / unknown id → **500** | **LIVE CONFIRMED** |
| F27 | F27-CA-03 | customer without buyers → filter dropped → **all users** returned | OPEN (not reproduced) |
| F27 | F27-CA-04 | buyer-less users appear as rows with empty id and zero values | OPEN (not observed) |
| F27 | R-09 | detail returns no decision date (list does) | **LIVE CONFIRMED** |
| F27 | R-10 | order (`updated_at DESC`) not verifiable; field not returned | OPEN |
| F31 | F31-CA-13 | empty `filters[].column` → panic → 500 | OPEN (fix on branch only) |
| F31 | G-04 | base set depends on runtime feature flags (inactive users may be hidden) | NOT VERIFIED |
| F31 | G-03 | ORDER BY `aam_customer_id` has no tiebreaker | OPEN |
| F31 | G-08 | legacy column "Pembaruan No. Telepon" actually shows the user record update time; `user_last_order` always null | handled (relabelled) |
| F31 | G-09 | legacy "All" branch option sends `IN ("ALL")` → 0 rows | not migrated |
| F31 | G-10 | `search_by` aliases (`customer.name`, `user.email`) vs GORM join aliases `Customer` / `User`: **every non-empty search → 500** (same in legacy; not fixed by the SQL remediation branch) | **LIVE CONFIRMED** (2026-10-09); OPEN. Accepted only as a non-production limitation in the F31 CONDITIONAL GO |

### Cross-cutting (authorization)

| Finding | Status |
|---|---|
| CMS services (account, product, content) check only that `X-UserId` is present. The real authorization boundary is the gateway → `/auth/verify` → `CanAccess` role / method / path allowlist (source-verified) | mechanism verified |
| Target-environment role grants are not evidenced (F27-CA-08, F31-CA-04) | OPEN |

## C. Summary

| Category | Count (migrated modules) | Open |
|---|---|---|
| SQL injection (A, numbered rows) | 14 | 14 (#1 – #3 have a reviewed but unmerged fix) |
| SQL-safe verified | 2 (F24, F27) | — |
| Not verifiable (no source) | 2 (F25, F19) | — |
| Legacy / contract mismatches and data-loss defects (B) | Foundation 11, Batch 1 10, Batch 2 7, Batch 3 16, Batch 4 12 | most OPEN; legacy-only bugs were fixed in the frontend |

**Recommended backend order:**
1. Merge the F31 / account-service SQL fix (#1 – #3).
2. Fix `cms_customer_channel.go` (#4).
3. Server-side allowlists for every ORDER BY (#5 – #14), starting with B3-13 (live 500).
4. Zero-value `Updates(struct)` defects (D-A6R2-01, B2-03 / 04 / 05, B3-03 / B3-10).
5. Wrong totals / pagination (FAQ, B3-04, B2-08).
6. Role-grant evidence for CMS endpoints.
