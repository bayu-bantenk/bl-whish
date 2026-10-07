# F09 Produk GPOS B2B — Migration Report (Batch 3, Phase 2)

| Field | Value |
|---|---|
| Date | 2026-10-06 |
| Route | `/dashboard/product-gposb2b`: one screen, 3 tabs (Settings · Criteria · Homepage products); legacy `/product-gposb2b` |
| Capabilities | `product-gposb2b.read / update` (homepage add / sequence / delete and criteria save → `.update`); settings additionally require F30 `global-configuration.read` / `.update` |
| Status | **MODULE GATE: PASS (automated) · LIVE READ: R1–R5 PASS; R6 BLOCKED by backend global-configuration HTTP 500 (B3-13) · CONDITIONAL GO** |

## 1. Scope (A4 route matrix, row by row)

| Rows | Disposition | Built |
|---|---|---|
| #138 index (the legacy controller renders the edit view), #142 edit (3 tabs) | MIGRATE | the screen |
| #148 store, #151 update (sequence), #154 datatable, #155 delete, #156 multidelete (homepage products) | MIGRATE | homepage tab |
| #65 `GlobalConfigurationController.updateByProductGposb2b` | MIGRATE | settings tab, **persisted through F30 use cases** |
| #146, #147, #150 (missing homepage views) | REVIEW | not built (no placeholders) |
| #139–#141, #143 (dead `editProductGposb2b`), #144, #145, #149, #152, #153 | REMOVE | not built |

F04 and the F10 REVIEW routes were not touched.

## 2. Backend contract (gpos-b2b-product-service source)

| Endpoint | Method | Params / body | Response | Code | Source |
|---|---|---|---|---|---|
| `/cms/product-gposb2b-homepages` | GET | `sort_by, asc_desc, page, take, keyword` | Pagination `{id, product_id, product{code, name…}, sequence, created_at}` | 200 | handler/product_gposb2b_homepage.go:28; dto:5-11, 50-56 |
| same | POST | `{product_id (required), sequence}` | `{message}` | **201** | handler:29, 96; dto:17-20 |
| `…/{id}` | GET / PUT `{sequence}` / DELETE | | | 200 | handler:30-33 |
| `…/bulk` | DELETE | `{ids}` | | 200 | handler:32 |
| `/cms/products/options` | GET | `term` | `[{id, code, text}]` | 200 | handler/product.go:49 |
| `/cms/custom-criterias/detail` | GET | `custom_type=PRODUCT_GPOSB2B` (no custom_id) | criteria row | 200 / 404 | repository/custom_criteria.go:179-195; enum/custom_type.go:10 |
| `/cms/custom-criterias/{id}` | PUT | criteria lists + stored `custom_id` + `custom_type` | `{message}` | 200 | handler/custom_criteria.go:30 |
| `/cms/global-configurations` (F30) | GET list / PUT `{key, value}` by id | | | 200 | repository/global_configuration.go:63-64 |

## 3. Global configuration boundary (F30)

- **Keys:** the settings tab edits exactly two keys, `PRODUCT_GPOSB2B_TITLE` and `PRODUCT_GPOSB2B_IMAGE`.
  - Hard-coded in `ProductGposb2bMapper.js:18-26` and matched by name at :39-65.
  - Posted by `tabs/product_gposb2b.edge:5-27` and saved by `GlobalConfigurationController.js:128-160`.
  - The buyer side reads the same keys (`usecase/product_gposb2b.go:83`).
- **Ownership:** the keys belong to F30's store; F09 is a specialised editor for these two keys. Reads and writes go through the **F30 use cases** (cross-feature use-case call, no repository import), so F30 authorization applies (`global-configuration.read` / `.update`).
- **Writes:** record ids are re-read on the server, and every key is attempted with its result reported. Partial failures are shown, which legacy hid.
- **Missing key:** shows a notice. F09 never creates keys.
- **Image:** signed-URL upload, purpose `product-gposb2b.image`, category `images`, JPEG / PNG ≤ 5 MB (legacy accepted `image/*`).

## 4. Criteria (shared `src/packages/custom-criteria`)

- **custom_type:** `PRODUCT_GPOSB2B`. A single row exists (seeded with a random custom_id, seed.sql:1127).
- **How legacy used it:** legacy read it by type only (`ProductGposb2bController.js:37`, no id). It saved `custom_id: ""`, which the backend `Updates(struct)` skips.
- **Shared package change:** the package was extended **generically** (`typeCriteria` / `updateTypeCriteria`: look up by type, keep the stored custom_id on save; omit an empty custom_id in the detail query). F10 (`CUSTOM_CATALOG`) and F18 (`BANNER`) behaviour is unchanged, and their tests are green.

## 5. Legacy bugs fixed

- Partial settings-save failure was hidden; it is now reported per key.
- Config record ids came from hidden form fields; they are now re-read on the server.
- A missing key or criteria row produced `PUT …/undefined`; it now shows a notice.
- The dead update route and the criteria tab's "Back" link to a non-existent route are dropped.

## 6. Tests

| Suite | Result |
|---|---|
| `product-gposb2b.contract.test.ts` + `-pages.test.tsx` | **27 / 27** (homepage list / create / sequence / delete / bulk bodies + codes, sort allowlist, Contract on bad shapes, 404 / malformed ids, criteria by type, settings via F30 incl. per-key failure, authorization: reader / none → Forbidden with 0 calls, missing F30 capability → Forbidden on save; pages: tabs, forms, validation, actions, 403) |
| Regression | F10, F18 and F30 unit + E2E green (no test modified to pass) |
| `npm run quality` | exit 0: eslint 0 errors (28 pre-existing warnings), tsc 0, **vitest 68 files / 1032 passed** |
| Full E2E | **154 / 154 passed** (F09 spec 8 tests; the earlier T-01 / T-02 flakes did not recur) |
| `npm run build` / `check:bundle` | PASS; client wire scan (`product-gposb2b-homepages`, `custom-criterias`, `global-configurations`, `PRODUCT_GPOSB2B_TITLE`, `custom_type`, `sort_by`, `product_id`) → 0 |

## 7. Live READ (owner terminal, 2026-10-06 15:58 UTC, devb2b-api.gpos.id, READ only)

**Command:**

```bash
LIVE_MODULE=product-gposb2b npx --no-install vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts
```

**Run summary:**
- **Evidence:** `$TMPDIR/module-live/product-gposb2b/evidence-20261006155848.json`.
- **Mutations:** POST 0 / PUT 0 / DELETE 0.
- **Secret scan:** 0.
- W0–W3 skipped (write not authorized).

| Step | Result |
|---|---|
| Login / logout | PASS (session cleared) |
| R1 default list (homepage products) | PASS: 5 rows of 16 |
| R2 pagination | PASS (disjoint; out of range empty) |
| R3 sort `sequence` / `createdAt` asc / desc | PASS |
| R4 search | PASS: hit 1 / total 1; no-match 0 / total 0 (**B3-04 does not apply here**) |
| R5 detail existing / unknown id | PASS / 404 → `NotFound` |
| R6 `custom-criterias/detail` (PRODUCT_GPOSB2B) | PASS (200) |
| R6 `products/options` | PASS (200, 20) |
| R6 settings keys → **`GET /api/v1/cms/global-configurations`** | **FAIL: HTTP 500** (`{code: 500, status: "FAILED", message: "Internal Server Error"}`, `data: null`) → `Server` |

**The R6 failure is the only failing request in the run.** It is backend finding **B3-13** (§8).

**Functional impact:**
- **F09:** the Settings tab cannot load `PRODUCT_GPOSB2B_TITLE` / `PRODUCT_GPOSB2B_IMAGE` on devb2b and shows its error state (typed `Server` error, no partial data). The Criteria and Homepage tabs are unaffected.
- **No frontend workaround** was added; application code is unchanged.

**Live WRITE:** not authorized.

## 8. Backend findings (no frontend workaround)

| ID | Type | Finding |
|---|---|---|
| B3-07 | Backend behaviour, **NEEDS EVIDENCE** | `GetCustomCriteriaByCustomType` (repository/custom_criteria.go:80) has **no caller** (only a test mock), and the buyer list `GetProductGposb2bProductListPage` (usecase/product_gposb2b.go:236) builds from homepage products only. Saved `PRODUCT_GPOSB2B` criteria may have **no buyer-side effect**. Checked on the local `cms-filter-banner` clone (2026-09-14); `development` must be checked by the backend team |
| B3-08 | Backend defect | Homepage search matches `product_id LIKE` only (the search box is labelled "Cari ID produk" accordingly); list DB errors are ignored (repository:38) |
| B3-09 | Backend defect | `sort_by` concatenated into ORDER BY (repository:38); allowlist only |
| B3-10 | Backend defect | `Updates(struct)` zero values dropped: homepage sequence 0 (repository:74), criteria price 0 (custom_criteria.go:125) |
| B3-11 | Contract gap | `/cms/global-configurations/detail` reads its keys from a **GET body** (`ValidateBody`); F09 uses the F30 list (keyword = key, exact match) instead. **Not the cause of the live R6 500**: that is the list endpoint (B3-13) |
| B3-12 | Contract gap | `/product-gposb2b-homepages/options` (legacy dropdown) has no handler or gateway route (unused) |
| **B3-13** | **Backend defect (confirmed live)** | `GET /api/v1/cms/global-configurations` with `sort_by=key` → **HTTP 500**.<br>**Source:** `repository/global_configuration.go:69` builds `Order(fmt.Sprintf("%s %s", SortBy, AscDesc))` unquoted. `KEY` is a MySQL reserved word, so `ORDER BY key asc` is a SQL syntax error, which is returned as `InternalServerError` (:72-73). The WHERE clause on :64 does quote `` `key` ``.<br>**F09 trigger:** the settings lookup sorts by `key` (`settings-product-gposb2b.usecase.ts:20`). The evidence does not record the query string, so `sort_by=key` is established from source; this was the only failing request.<br>**Cross-module:** the F30 Konfigurasi Umum list offers sorting by Key, so the same request presumably returns 500 there (F30 not changed).<br>**Backend fix:** quote / allowlist the ORDER BY column.<br>**Not a frontend workaround:** a frontend mitigation (looking keys up without `sort_by=key`) is possible but needs explicit approval |

F10's B3-04 (`total_rows` ignoring search) was **not** observed here: live R4 no-match returned total 0.

**NEEDS EVIDENCE:** the legacy "more than 14 products" info box is shown as guidance only, because no backend rule enforces it.

## 9. Visual parity

- **Matches (from source):** tab structure, settings fields (title + image with preview), criteria field set (shared with F10 / F18), homepage table + add / sequence / delete.
- **NEEDS EVIDENCE** (no A3.2 capture):
  - the add-product form is inline, where legacy used a collapse;
  - the product column shows "CODE - Name" (legacy showed the name only);
  - read-only users get a read-only view.

## 10. Module gate

```text
CONDITIONAL GO — LIVE READ R1–R5 PASS; R6 BLOCKED BY BACKEND GLOBAL-CONFIGURATION HTTP 500
```

- **Why conditional:** live READ R1–R5 PASS, but **R6 is blocked by backend B3-13** (global-configuration list 500, so the Settings tab cannot load on devb2b). Backend findings B3-07 … B3-13 are open, with B3-07 needing backend confirmation.
- **Why not BLOCKED:** every MIGRATE row is implemented, and all contracts and key ownership are established from source.
- **Safety:** no live mutation. F11 W3 not started; F04 and F06 not touched.
