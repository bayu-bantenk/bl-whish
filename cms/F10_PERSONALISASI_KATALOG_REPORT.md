# F10 Personalisasi Katalog — Migration Report (Batch 3)

| Field | Value |
|---|---|
| Date | 2026-10-06 |
| Scope | Catalog list / create / edit with the 3 edit-page tabs (Custom Catalog · Custom Product Homepage · Product Criteria) |
| Routes | `/dashboard/custom-catalog`, `/create`, `/update/[id]` (legacy `/custom-catalog`, `/custom-catalog/create`, `/custom-catalog/:id/edit`) |
| Capabilities | `custom-catalog.read / create / update / delete` (homepage-product and criteria changes require `custom-catalog.update`) |
| Status | **MODULE GATE: PASS (automated) · LIVE READ: PASS except R4 total (backend B3-04, confirmed) · CONDITIONAL GO** |

## 1. Scope decision (evidence)

- **In scope (MIGRATE):** A4 route matrix #114–#124 (catalog list / datatable / delete / multidelete / options / create / store / edit / update).
- **Edit screen tabs:** the legacy edit screen `custom_catalogs/edit.edge:28-47` embeds three tabs (`tabs/custom_catalog_edit.edge`, `custom_catalog_product_homepage.edge`, `custom_criteria.edge`), so homepage products and criteria are migrated **as tabs of the edit screen**.
- **Out of scope (OD-07, REVIEW):**
  - the **standalone** screens without a menu entry: `/custom-catalog-product-homepage*` (#126–#136) and `/custom-criteria*` (#157–#168);
  - no pages and no placeholders were created for them.

## 2. Contract (verified in gpos-b2b-product-service source)

| Endpoint | Method | Params / body | Success | Source |
|---|---|---|---|---|
| `/cms/custom-catalogs` | GET | `sort_by, asc_desc, page, take, keyword` → Pagination | 200 | handler/custom_catalog.go:35,94; dto:93 |
| `/cms/custom-catalogs` | POST | `{name, sequence (required, ≥1), is_active}` | **200** | :36,126; dto:24 |
| `/cms/custom-catalogs/{id}` | GET / PUT / DELETE | PUT same 3 fields | 200 | :37-40 |
| `/cms/custom-catalogs/bulk` | DELETE | `{ids}` | 200 | :39 |
| `/cms/custom-catalog-product-homepages` | GET | list params + `custom_catalog_id` | 200 | handler/custom_catalog_product_homepage.go:28 |
| same | POST | `{custom_catalog_id, product_id, sequence}` | **201** | :29 |
| same `/{id}`, `/bulk` | PUT `{sequence}` / DELETE | | 200 | :30-33 |
| `/cms/custom-criterias/detail` | GET | `custom_id`, `custom_type=CUSTOM_CATALOG` | 200 / 404 | handler/custom_criteria.go:29; enum/custom_type.go:8 |
| `/cms/custom-criterias/{id}` | PUT | criteria lists + `custom_type` | 200 | :30 |
| `/cms/products/options` | GET | `term` → `[{id, code, text}]` | 200 | handler/product.go:49 |

**Contract gaps / discrepancies (recorded, not hidden):**
- **No `POST /custom-criterias`** (handler or gateway). A criteria row is created by the backend at catalog create (`mapper/custom_criteria.go:65`). When a row is missing, the tab shows a notice (legacy produced `PUT /custom-criterias/undefined`).
- **Criteria detail query:** legacy sent only `custom_id` (its `custom_type` was undefined). F10 sends `custom_type=CUSTOM_CATALOG` as the backend supports. F18 keeps its legacy-matching query.

## 3. Implementation

- **`src/packages/custom-catalog`:**
  - catalog + homepage-product domain / schema / port;
  - use cases;
  - gateway repository + DTO;
  - presentation: list table with inline Active switch + inline Sequence (double-submit guard), form, homepage-product tab table + add form (shared `ProductPicker`), notices, server-safe form-values.
- **`src/packages/custom-criteria` (new shared package):** the criteria stack previously inside F18 (domain, schema, port, repository, use-case factory per owner, form, picker), now used by **both** F18 Banner (`custom_type=BANNER`, LINK-goal rule kept in the banner wrapper) and F10 (`CUSTOM_CATALOG`).
  - Banner behaviour is unchanged: banner unit tests 46 / 46 and banner E2E pass, with only import paths touched.
- **Routes:** `src/app/(dashboard)/dashboard/custom-catalog/{page,loading}.tsx`, `create/page.tsx`, `update/[id]/page.tsx` (tabs).
- **Wiring:**
  - capabilities;
  - registry (menu "Personalisasi Katalog" in Produk & Katalog, legacy order after Kategori Produk);
  - nav icon `layout-list`;
  - `composeFeatures` `customCatalog`;
  - DAL allowlist;
  - Playwright grants;
  - expected menu.
- **Table:** page sizes 15 / 25 / 50 / 100 (legacy `custom_catalogs/list.edge:110-113`, "All" dropped); homepage tab 5 / 10 / 25 / 50. Column definitions are memoized.

## 4. Legacy bugs fixed

- **List sorting:** it used `columns[order-2]` with a fixed ASC, so header sorts hit "checkbox" / "action". Every sortable column now sorts in the chosen direction; the default is sequence asc, as legacy actually showed.
- **Create button:** labelled "Add Product" on the catalog list; now "Create New Custom Catalog".
- **Missing criteria row:** produced `PUT /custom-criterias/undefined`; now a notice.

## 5. Tests

| Suite | Result |
|---|---|
| `custom-catalog.contract.test.ts` + `custom-catalog-pages.test.tsx` | **28 / 28** (catalog list / sort allowlist / hostile sort / paging / search, create / update / delete / bulk bodies + codes, homepage list-by-catalog / add (201) / sequence PUT / delete, criteria GET with `custom_type` / PUT / missing row, product lookup, Contract on bad shapes, authorization reader / none → Forbidden with 0 calls; pages: list, create, tabs, validation, submit, 403) |
| Banner after the criteria extraction | **46 / 46** unit; banner E2E passes (except the known T-01 flake) |
| E2E `custom-catalog.spec.ts` | **8 / 8** (16 / 16 on a repeated run): list / search / sort / paging, create + validation, edit catalog, homepage add / sequence / delete, criteria select + save, reopen persisted, error state, reader 403 with 0 writes, axe |
| `npm run quality` | exit 0: eslint 0 errors (28 pre-existing warnings), tsc 0, **vitest 66 files / 1005 passed** |
| Full E2E | **144 / 146**. Failures unrelated to F10: T-01 banner hydration race (known), T-02 FAQ edit / delete flow under host load (see §7) |
| `npm run build` / `check:bundle` | PASS; client wire scan (`custom-catalogs`, `custom-catalog-product-homepages`, `custom-criterias`, `custom_catalog_id`, `custom_type`, `sort_by`, `products/options`) → 0 |

**Note:** `tsc` initially reported 2 errors in the stale generated file `.next/dev/types/validator.ts`, left by a dev-server run while the E2E route shims existed. The dev server was not running, so that single generated file was removed; it is regenerated on the next `next dev`.

## 6. Live READ (owner terminal, 2026-10-06 15:09 UTC, devb2b-api.gpos.id, READ only)

**Command:**

```bash
LIVE_MODULE=custom-catalog npx --no-install vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts
```

**Run summary:**
- **Evidence:** `$TMPDIR/module-live/custom-catalog/evidence-20261006150937.json` (25 observations).
- **Mutations:** POST 0 / PUT 0 / DELETE 0.
- **Secret scan:** 0.
- **Harness result:** 6 passed, 1 failed (R4, backend), 5 skipped (W0–W3).

| Step | Result |
|---|---|
| Login / logout | PASS (200 / 200; session cleared) |
| R1 default list | PASS: 6 catalogs, rows mapped |
| R2 pagination | PASS (page 2 empty, disjoint; out of range empty) |
| R3 sort name / sequence / active / updatedAt asc / desc | PASS (all sorted, values present) |
| R4 search | rows PASS (2 hits, all match); **`total_rows` wrong: hit total 6, no-match total 6** → backend **B3-04 confirmed** |
| R5 detail existing / unknown id | PASS / 404 → `NotFound` |
| R6 tab lookups | homepage products by catalog PASS (0 rows for the sample catalog), criteria detail (`CUSTOM_CATALOG`) PASS, product options PASS (20) |

**Earlier attempt (14:43 UTC):** the gateway / nginx answered a **non-JSON 403** to the harness login. An empty-body login probe then returned a normal JSON 400 (KrakenD 2.13.9 behind nginx). After the owner re-entered the credentials, login succeeded (15:09). The 403 is classified as an **environment / credential-input** issue, not a module or backend defect.

**Live WRITE:** not authorized (no catalog, homepage-product or criteria mutation).

## 7. Findings

| ID | Type | Finding |
|---|---|---|
| B3-03 | Backend defect | GORM `Updates(struct)` drops zero values (`repository/custom_catalog.go:94`, `custom_catalog_product_homepage.go:101`, `custom_criteria.go:125`): deactivating a catalog (`is_active=false`), homepage sequence 0, clearing a price → silently not saved. No workaround |
| B3-04 | Backend defect (**confirmed live**) | Catalog list: the second `Count` runs without the keyword filter → `total_rows` ignores the search (`custom_catalog.go:71`); live R4: hit 2 rows / total 6, no-match 0 rows / total 6. UI shows "… dari 6 data" and empty extra pages for a search. **No workaround** (same class as FAQ `total_rows`) |
| B3-05 | Backend behaviour | Deleting a catalog leaves its homepage rows and criteria (no cascade) |
| B3-06 | Backend defect | `sort_by` concatenated into ORDER BY (B2-06 class); allowlist only |
| T-02 | Test flake (Batch 1 spec, not F10) | `faq.spec.ts:44` failed in the full run and 2 / 12 in an isolated run at load average 7–12, then 4 / 4 on rerun. F10 changes no FAQ code, mock or shared component; the custom-catalog mock is path-scoped. Recorded, not changed |

## 8. Visual parity

- **Matches (from source):** tabs and labels (legacy English tab labels kept), list columns + inline switch / sequence, field order, page sizes.
- **NEEDS EVIDENCE** (no A3.2 capture of F10):
  - the create page has no single-tab bar;
  - the homepage "Create New Catalog Product" form is inline, where legacy used a collapse;
  - legacy bootstrap toggle vs shadcn Switch;
  - the redundant "Custom Catalog" column is kept in the homepage tab for parity.

## 9. Module gate

```text
CONDITIONAL GO
```

- **Why conditional:** backend defects B3-03 / B3-04 (confirmed live) / B3-05 are open. Live READ otherwise PASS.
- **Why not BLOCKED:** all automated gates are green and the frontend is complete for the verified scope.
- **No live mutation.** F11 W3 not started; F04, F09 and F06 not started in this phase.
