# F06 Inventory / Persediaan — Migration Report (Batch 3, Phase 4)

| Field | Value |
|---|---|
| Date | 2026-10-07 |
| Routes | `/dashboard/inventory`, `/create`, `/update/[id]` (legacy `/inventories`, `/inventories/create`, `/inventories/:id/edit`) |
| Capabilities | `inventory.read / create / update / delete` |
| Status | **MODULE GATE: PASS (automated) · LIVE READ: R1–R6 PASS · mutations 0 · secret scan 0 · CONDITIONAL GO (open backend defects B3-14 … B3-22)** |

## 1. Scope

Source: A4 route matrix, F06 rows (13 MIGRATE). Only what the legacy UI exposes is built.

| A4 row | Legacy | Built |
|---|---|---|
| #289, #292 | list + datatable | list page (search, sort, paging, selection) |
| #290 | multidelete | bulk delete on the list |
| #291 | product search (create form) | shared `ProductPicker` + F06 product search |
| #293, #294 | create / store | create page |
| #296, #297 | edit / update (`hna_price` only) | edit page, HNA price form |
| #298 | delete | row delete with confirm |
| #300 | stock multidelete | stock bulk delete (route existed, legacy screen had no trigger; selection added — see §13) |
| #303, #306 | stock store / update (modal on edit page) | stock add / edit in a shadcn Dialog |
| #307 | stock delete | stock row delete with confirm |

Rows marked REVIEW / REMOVE in A4 were not built; no placeholders. F04 (order-review) not touched.

## 2. Legacy evidence (gpos-b2b-cms, read-only)

- Routes `start/routes.js:393-411`; `InventoryController.js` (create view, distributors at :65-68, stock list query :112-119, product search :178-186); `InventoryRepository.js`; `InventoryStockRepository.js:8` (`/api/v1/cms/inventories/:id/inventory-stocks`); views `inventories/list.edge`, `create.edge`, `edit.edge` (stock table + modal embedded).
- Distributors are hard-coded in legacy: `{value: 'aam', label: 'AAM'}`, `{value: 'bintang', label: 'Bintang'}`. No backend lookup exists. Kept as a documented domain constant (`domain/inventory.ts`) for parity — see B3-21.
- Org Id / Warehouse Id are free text in legacy (no lookup in legacy or backend); kept as free text, max 36 characters.
- Validation errors: legacy showed only the first message (`RUNTIME_BEHAVIOR_AUDIT.md:211`).

## 3. Backend contract (gpos-b2b-product-service, branch `cms-filter-banner` `b5ca719`)

Gateway: `endpoints.json:156-168` (all routes present).

| Endpoint | Method | Params / body | Response | Code | Source |
|---|---|---|---|---|---|
| `/cms/inventories` | GET | `sort_by, asc_desc, page, take, keyword` (all `required` except keyword) | `{total_rows, rows[{id, product_id, product_code, product_name, distributor_id, hna_price, created_at}]}` | 200 | dto/inventory.go:5-21; repository/inventory.go:35-58 |
| `/cms/inventories/{id}` | GET | — | same row shape; unknown → 404 | 200 / 404 | handler/inventory.go:33 |
| `/cms/inventories` | POST | `{product_id, distributor_id, hna_price:int}` (all `required`) | `{message}` | **201** | dto/inventory.go:39-43 |
| `/cms/inventories/{id}` | PUT | `{hna_price}` (`required`) | `{message}` | 200 | dto/inventory.go:50-52 |
| `/cms/inventories` / `{id}` | DELETE | `{ids}` / — | `{message}` | 200 | dto/inventory.go:60-62 |
| `…/{id}/inventory-stocks` | GET | `created_at desc, page 1, take 1000` (legacy values) | `{total_rows, rows}` | 200 | InventoryController.js:112-119; handler/inventory_stock.go:28 |
| `…/{id}/inventory-stocks[/{sid}]` | POST / PUT | `{org_id, stock:int, warehouse_id, expired_date YYYY-MM-DD, is_active:bool}`; PUT requires the same fields | `{message}` | POST 201 / PUT 200 | dto/inventory_stock.go:45-65 |
| `…/{id}/inventory-stocks[/{sid}]` | DELETE | `{ids}` / — | `{message}` | 200 | handler/inventory_stock.go:34-35 |
| `/cms/products` | GET | `keyword, page 1, take 20, sort_by name asc` | product page | 200 | InventoryController.js:178-186; handler/product.go:45 |

**Zero values:** `hna_price` and `stock` are Go `int` with `validate:"required"`, so 0 is rejected (400). The forms require ≥ 1 and say so; no workaround. Stock `is_active` is `*bool` in the model (`model/inventory_stock.go:13`), so `false` persists on create and update.

**List count:** `Count` runs after the keyword `Where` (`repository/inventory.go:48-49`), so `total_rows` follows the search (the F10 B3-04 class does not apply; confirmed live, §8).

## 4. Implemented capability

- List: search (product name / code), sort by Product Code, Product Name, Distributor, HNA Price (legacy columns), page sizes per legacy, selection + bulk delete, row edit / delete.
- Create: product (search picker), distributor (AAM / Bintang), HNA price.
- Edit: HNA price; stock table (Org Id, Warehouse Id, Stock, Expired Date, Is Active) with add / edit dialog, delete, bulk delete.
- Every field error shown at once with input kept; typed error states for list, detail and stock load failures.

**Legacy bugs fixed:** first-error-only validation; failed delete shown as info; stock add failure reported as "Gagal membuat inventory baru"; stock load failure shown as an empty table; list failure redirected; non-numeric HNA price sent as `NaN`.

## 5. Architecture

Page / Server Action → DAL (`getReadServices`, `runAction`, `resolvePageResult`) → use case (`inventory.usecase.ts`, `stock-inventory.usecase.ts`; authorize first, zod schema shared with forms) → port → repository (`requestEnvelope` over the shared GatewayClient, `'server-only'`) → backend.

- Package `src/packages/inventory/**`: domain (`inventory.ts`, `.schema.ts`, `.port.ts`), `repository/{dto.ts, inventory.repository.ts}`, two use cases, presentation (table, create form, price form, stock table, stock dialog, actions, routes, query, form values).
- Routes `src/app/(dashboard)/dashboard/inventory/{page,loading}.tsx`, `create/page.tsx`, `update/[id]/page.tsx`.
- Wire names only in `repository/dto.ts`; unexpected shapes → `Contract`; ids `/^[A-Za-z0-9-]{1,64}$/` else NotFound without a call; `sort_by` allowlist only (`product.code`, `product.name`, `distributor_id`, `hna_price`); `take=-1` never sent; table columns at module scope.
- Shared edits (minimal wiring only): `capabilities.ts`, `navigation/registry.ts` (Transaksi, after Order Review, legacy order), `navigation/types.ts` + `nav-icon.tsx` (`network`, legacy `fa-sitemap`), `server-container.ts` (`inventory`), `dal.test.ts` allowlist, `playwright.config.ts` grants, `authorization.spec.ts` expected menu, `e2e/mock/mock-backend.mjs`, `e2e/support/fixtures.ts` (`inv` stats), `test/live/modules/index.ts`. No new HTTP client, DAL, auth, table or form framework.

## 6. Authorization

| Capability | Covers | Evidence |
|---|---|---|
| `inventory.read` | list, edit-page data, stock list, product search | legacy uses the product search as a plain lookup |
| `inventory.create` | create page + save | legacy create / store |
| `inventory.update` | edit page, HNA price, stock add / edit (incl. Is Active) | legacy edit page owns the stock modal |
| `inventory.delete` | inventory delete / bulk, stock delete / bulk | legacy delete routes |

Fail-closed; interim grants via `AUTHZ_INTERIM_GRANTS` only. Every page calls `guardRoute()`; use cases re-check before any gateway call.

## 7. Automated tests

| Suite | Result |
|---|---|
| `inventory.contract.test.ts` | **24 / 24** (list params, sort allowlist / hostile sort, paging, search, Contract on bad shapes, detail 404 / malformed id with 0 calls, create / update bodies + codes, stock list / create / update / delete bodies + codes, product lookup, reader / none → Forbidden with 0 calls, per-capability write denial) |
| `inventory-pages.test.tsx` | **11 / 11** (list, create, edit, stock dialog, field messages, actions, 403, empty / error states) |
| E2E `inventory.spec.ts` | **7 / 7** (menu → list, search / sort / paging, empty + error, create + validation, edit HNA price, stock add / edit / delete, reopen persisted, reader read-only + 403 with 0 writes, axe) |
| `npm run quality` | exit 0: eslint 0 errors, tsc 0, **vitest 70 files / 1067 passed** |
| Full E2E | **156 / 161** in the full run; the 5 failures (`product.spec.ts:36`, `sponsored-product.spec.ts:14,25,45`, `telesales-code.spec.ts:73`) were 45 s timeouts — two in the `login` `beforeEach` — at load average 33–38. Isolated rerun of those specs + inventory: **21 / 21**. The inventory mock only handles `/cms/inventories*`; `/cms/products` falls through to the existing mock (`mock-backend.mjs:206`) |
| `npm run build` / `check:bundle` | PASS; client wire scan (`cms/inventories`, `inventory-stocks`, `hna_price`, `distributor_id`, `warehouse_id`, `org_id`, `expired_date`, `sort_by`) → 0 |

The first `npm run quality` run had 3 timeouts in `banner-pages` / `group-story-pages` (5 s, load ≈ 19); both files pass in isolation (32 / 32) and the full rerun passed. No test was modified or weakened.

## 8. Live READ (owner terminal, 2026-10-07 03:41 UTC, devb2b-api.gpos.id, READ only)

```bash
LIVE_MODULE=inventory npx --no-install vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts
```

Evidence `$TMPDIR/module-live/inventory/evidence-20261007034159.json` (23 observations). Harness: 7 passed, 5 skipped (W0–W3 and the safety-gate refusal test).

| Step | Result |
|---|---|
| Login / logout | PASS (200 / 200) |
| R1 default list | PASS: 5 rows of **29 988**, live keys match the DTO exactly |
| R2 pagination | PASS (page 1 / 2 disjoint; out of range empty) |
| R3 sort Product Code / Product Name / Distributor / HNA Price asc + desc | PASS (all sorted). Product Code / Name windows contain rows with an **empty** code or name (`valuesPresent: false`) — see B3-22 |
| R4 search | PASS: hit 18 rows / **total 18**, all rows match; no-match 0 / total 0 → `total_rows` matches the filtered result |
| R5 detail existing / unknown id | PASS / 404 → `NotFound` |
| R6 stock list of first inventory | PASS (200, 0 rows for that inventory) |
| R6 product search | PASS (200, 20) |

## 9. Backend findings (no frontend workaround)

| ID | Type | Finding |
|---|---|---|
| B3-14 | Backend defect | `sort_by` / `asc_desc` concatenated into ORDER BY (`repository/inventory.go:50`, stock list likewise). Frontend sends the allowlist only |
| B3-15 | Backend defect (source) | HNA price update: `repository/inventory.go:122-128` calls `es.UpdateInventory` with `ProductId` / `DistributorId` taken from the update model, which only carries `hna_price` (`mapper.ToInventoryModelFromUpdateSpec`) → both empty. The Elastic call runs **before** the DB update and its error aborts with 500, so either the price never reaches Elastic or the CMS update fails entirely. **NEEDS EVIDENCE** of which (needs a live write, not authorized) |
| B3-16 | Backend defect (source) | CMS stock store / update / delete (`repository/inventory_stock.go:81-135`) never touch Elastic; only the sync / bulk path does (`usecase/inventory_stock.go:115`). Buyer-visible stock can be stale after CMS edits |
| B3-17 | Backend defect (source) | Stock get / update / delete look up by stock id only (`repository/inventory_stock.go:63, 90-98, 106`); the inventory id in the URL is not checked |
| B3-18 | Backend defect (source) | `time.Parse` error ignored for `expired_date` (`mapper/inventory_stock.go:26, 42`) → a malformed date is saved as `0001-01-01`. Frontend validates YYYY-MM-DD |
| B3-19 | Backend defect (source) | List / detail `Select` omits `created_at` (`repository/inventory.go:41-46`) → always Go zero time; not displayed |
| B3-20 | Backend behaviour (source) | Deleting an inventory leaves its stock rows (no cascade in `Delete` / `MultipleDelete`) |
| B3-21 | Contract / data mismatch, **NEEDS EVIDENCE** | Legacy and the new CMS store `distributor_id` `aam` / `bintang`; buyer-side code compares with the UUID `AamDistributorId = 423dad8a-…` (`constant/constant.go:72`; `mapper/cart.go:88, 298, 631`; `mapper/product.go:285`). CMS-created rows may never be treated as AAM. The evidence records shapes, not values, so which form devb2b rows carry is unknown — backend team to confirm the canonical distributor ids |
| B3-22 | Data quality, **NEEDS EVIDENCE** | Live R3: Product Code / Name sort windows include rows with empty `product_code` / `product_name` despite the INNER JOIN on `product`. Display shows them blank; cause (empty product master values vs preload) unconfirmed |

No earlier id reused: B3-04 (count ignores search) does not apply (R4 total correct), B3-11 / B3-13 (global-configuration) unrelated.

## 10. Mutation safety

- Live: POST 0 / PUT 0 / DELETE 0 business mutations (the 2 POSTs are login / logout); `mutations: {post: 0, put: 0, delete: 0, writeId: null}`; `write: "disabled"`.
- The inventory live adapter has **no write adapter**; W0–W3 cannot run for this module.
- Secret scan of the evidence (JWT, bearer, token keys, password, email domains, cookies): **0**.
- Writes exist only against mocks (unit + E2E). No test record created; no cleanup attempted. F11 W1–W3 not run.

## 11. Regression

F04, F09, F10, F18, F30, Batch 1 and Batch 2 code untouched; their unit tests pass in the 1067 / 1067 run and their E2E specs pass (full run + isolated rerun of the load-timeout specs). No existing test changed except the expected-menu list (`authorization.spec.ts`, new entry) and the DAL allowlist.

## 12. Module gate

```text
CONDITIONAL GO — LIVE READ R1–R6 PASS; WRITE PATH CARRIES OPEN BACKEND DEFECTS (B3-15, B3-16, B3-17, B3-21)
```

- **Why not GO:** the write side is buyer-visible and the backend has open defects on it — HNA price → Elastic (B3-15, may fail the update), CMS stock edits never reach Elastic (B3-16), unscoped stock ids (B3-17), and distributor id mismatch (B3-21, NEEDS EVIDENCE). Live WRITE is not authorized, so none of these can be cleared from the frontend.
- **Why not BLOCKED:** all 13 MIGRATE rows are implemented against source-verified contracts; automated gates are green; live READ R1–R6 pass with 0 mutations and 0 secrets.

## 13. Remaining risks

- B3-15 / B3-16 / B3-21 need backend confirmation before CMS inventory writes are used in production.
- Stock bulk delete (#300) has a UI trigger that the legacy screen did not have (the route existed) — confirm product intent.
- Visual parity NEEDS EVIDENCE (no A3.2 capture): Save / Back sit under the HNA price field with the stock table below (legacy: stock table inside the form before the buttons); HNA price shown as a plain number (as legacy); legacy English labels with Indonesian buttons.
- E2E load sensitivity at load average > 15 (T-01 / T-02 class); not F06-specific.
- Live R6 stock list returned 0 rows for the sampled inventory, so stock row mapping is verified by mocks and contract only.
