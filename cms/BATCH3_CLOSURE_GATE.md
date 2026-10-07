# Batch 3 Closure Gate

| Field | Value |
|---|---|
| Date | 2026-10-07 |
| Migration | AdonisJS v4.1 CMS (`gpos-b2b-cms/`) → Next.js 16 (`frontend/`); backend unchanged |
| Flow | Page / Server Action → DAL → Use Case → Repository → shared Gateway → Backend |
| Final gate | **CONDITIONAL GO — Batch 3 is CONDITIONALLY CLOSED** |
| Sources | `F04_ORDER_REVIEW_REPORT.md`, `F10_PERSONALISASI_KATALOG_REPORT.md`, `F09_PRODUK_GPOS_B2B_REPORT.md`, `F06_INVENTORY_REPORT.md`, live evidence files named below, owner decisions |

## A. Executive Summary

**Batch 3 is CONDITIONALLY CLOSED.**

- All intended Batch 3 migration work is complete: F10, F09 and F06 are implemented within their A4 MIGRATE scope and pass the automated gates and live READ gates that apply to them.
- **F04 is SKIP / inactive** by owner decision.
- The gate is conditional because backend dependencies (B3-04, B3-13) and F06 write-path risks (B3-14 – B3-22) remain open. They do not block the evidenced READ surfaces, so the batch is not BLOCKED; they are not resolved, so the batch is not GO.
- No live business mutation was performed in Batch 3. F11 W3 was not started.

## B. Scope

| Feature | Scope decision |
|---|---|
| F04 Order Review | **SKIP / inactive.** Owner confirmed it is not used; this supersedes the ordering recommended in `BATCH3_SCOPE_DISCOVERY.md` (historical, unchanged) |
| F10 Personalisasi Katalog | Migrated: catalog list / create / edit with tabs (catalog, homepage products, criteria) |
| F09 Produk GPOS B2B | Migrated: one screen `/dashboard/product-gposb2b`, tabs Settings · Criteria · Homepage products; A4 MIGRATE rows only, REVIEW / REMOVE rows not built |
| F06 Inventory | Migrated: `/dashboard/inventory`, `/create`, `/update/[id]` (legacy `/inventories`, `/inventories/create`, `/inventories/:id/edit`); 13 / 13 A4 MIGRATE rows |

**F04 state of the code (for accuracy):** an F04 read-only slice was built before the SKIP decision (`src/packages/order-review/**`, `/dashboard/order-review/**`, capability `order-review.read`, live READ PARTIAL with 0 reviews on devb2b). Per the owner decision that code is **left untouched**: not deleted, refactored, extended or further migrated; no placeholder added. The capability is fail-closed and **no grant for it is authorized**, so the route is not exposed to users. Whether to remove that code later is a separate owner decision (not part of this closure).

## C. Module Gate Table

| Feature | Migration Status | Automated Evidence | Live READ | Live WRITE | Open Findings | Final Gate |
|---|---|---|---|---|---|---|
| F04 Order Review | SKIP / inactive (earlier code untouched) | historical only (F04 report) | N/A (historical PARTIAL, no data) | not run | inactive (B3-01 / B3-02 historical) | **SKIP** |
| F10 Personalisasi Katalog | Implemented (A4 #114–#124 + edit tabs) | 28 / 28 module tests; E2E 8 / 8; quality, build, bundle PASS | R1–R6 PASS; R4 rows correct, `total_rows` wrong (backend) | not authorized / not run | B3-04 (+ B3-03, B3-05, B3-06) | **CONDITIONAL GO** |
| F09 Produk GPOS B2B | Implemented (MIGRATE rows only) | 27 / 27 module tests; E2E 8 / 8; quality, tsc, eslint, build, bundle PASS; client wire scan 0 | R1–R5 PASS; **R6 PARTIAL** (`global-configurations` HTTP 500) | not authorized / not run | B3-13 (+ B3-07 – B3-12) | **CONDITIONAL GO** |
| F06 Inventory | Implemented (13 / 13 MIGRATE rows) | contract 24 / 24, pages 11 / 11, E2E 7 / 7; quality 1067 / 1067; tsc, eslint, build, bundle PASS; client wire scan 0 | R1–R6 PASS | not authorized / not run (W0–W3 not run) | B3-14 – B3-22 | **CONDITIONAL GO** |

**Live READ evidence** (`$TMPDIR/module-live/<module>/`, owner terminal, devb2b-api.gpos.id):

| Module | Evidence file | Highlights |
|---|---|---|
| F10 | `custom-catalog/evidence-20261006150937.json` | R4 hit 2 rows / total 6, no-match 0 / total 6 → B3-04 |
| F09 | `product-gposb2b/evidence-20261006155848.json` | R6 `custom-criterias/detail` 200, `products/options` 200, `global-configurations` 500 → B3-13 |
| F06 | `inventory/evidence-20261007034159.json` | R1 29 988 rows; R4 hit 18 / total 18, no-match 0 / 0; R5 unknown id 404 → NotFound; R6 stock list 200 (0 rows), product search 200 |

**Regression evidence (latest, 2026-10-07):** `npm run quality` 70 files / 1067 / 1067; full E2E 156 / 161 — the 5 failures (`product.spec.ts:36`, `sponsored-product.spec.ts:14,25,45`, `telesales-code.spec.ts:73`) were 45 s timeouts (two in the login hook) at load average 33–38, classified as **suite-level / timeout observations**; isolated rerun of those specs plus F06 21 / 21 PASS. Not rerun for this closure (no code changed since).

## D. Live Mutation Safety

- **Batch 3 performed no live business mutations.** Every Batch 3 evidence file records `mutations: {post: 0, put: 0, delete: 0}`; the only POSTs were login / logout, which are not business mutations.
- **F06 WRITE was not authorized**: W0, W1, W2 and W3 were not run; the F06 live adapter has no write adapter. No F06 business mutation is represented as live-tested.
- F09 and F10 live WRITE: not authorized, not run.
- **F11 W3 was not started.** (F11 W1 CREATE and W2 UPDATE passed earlier; this closure is not authorization for W3.)
- **No cleanup / revert was performed. No live test data was created.**
- Secret scan of every Batch 3 evidence file: 0.

## E. Backend Findings

Findings that condition the Batch 3 gate. None is fixed; no frontend workaround exists for any of them.

| ID | Module | Classification | Finding | Evidence |
|---|---|---|---|---|
| B3-04 | F10 | **Backend defect / external dependency** (confirmed live) | Search returns the correct rows but `total_rows` stays the unfiltered total (also for an empty result). Frontend does not fabricate or recompute totals | `product-service repository/custom_catalog.go:71`; F10 live R4 |
| B3-13 | F09 (F30 impact) | **Backend defect / external dependency** (confirmed live) | Settings lookup sends `sort_by=key`; backend builds unquoted `ORDER BY key asc` (`key` is a MySQL reserved word) → HTTP 500. Settings tab cannot reliably load `PRODUCT_GPOSB2B_TITLE` / `PRODUCT_GPOSB2B_IMAGE`; Criteria and Homepage tabs are not blocked by it | `repository/global_configuration.go:69`; F09 live R6 |
| B3-14 | F06 | Backend security / robustness; **frontend mitigation via allowlist** (not a fix) | `sort_by` / `asc_desc` concatenated into ORDER BY | `repository/inventory.go:50` |
| B3-15 | F06 | **NEEDS BACKEND CONFIRMATION / WRITE-PATH RISK** | HNA update calls Elastic with ProductId / DistributorId from an update model that only carries HNA data → empty ids; the Elastic call precedes the DB update and its error aborts the request. **No live write failure has been observed** — exact outcome NOT PROVEN | `repository/inventory.go:122-128`; `usecase/inventory.go:59-62` |
| B3-16 | F06 | **BACKEND INTEGRATION RISK** | CMS stock store / update / delete do not update Elastic; only the sync / bulk path does → buyer-visible stock may become stale | `repository/inventory_stock.go:81-135`; `usecase/inventory_stock.go:115` |
| B3-17 | F06 | **BACKEND VALIDATION / DATA-INTEGRITY RISK** | Stock get / update / delete look up by stock id only; the URL inventory id is not checked against the stock's parent | `repository/inventory_stock.go:63, 90-98, 106` |
| B3-18 | F06 | **BACKEND DATA VALIDATION DEFECT** | `expired_date` parse error ignored → zero time `0001-01-01`; frontend validates YYYY-MM-DD | `mapper/inventory_stock.go:26, 42` |
| B3-19 | F06 | **BACKEND / DTO DATA QUALITY ISSUE** | List / detail `Select` omits `created_at` → zero time; field not displayed | `repository/inventory.go:41-46` |
| B3-20 | F06 | **BACKEND DATA-INTEGRITY / ORPHAN RISK** | Deleting an inventory does not delete its stock rows | `repository/inventory.go` Delete / MultipleDelete |
| B3-21 | F06 | **NEEDS BACKEND CONFIRMATION** | CMS (legacy and new) stores `aam` / `bintang`; buyer code compares with UUID `AamDistributorId` (`423dad8a-…`). Canonical mapping not proven; frontend mapping not changed | `constant/constant.go:72`; `mapper/cart.go:88, 298, 631`; `mapper/product.go:285`; legacy `InventoryController.js:65-68` |
| B3-22 | F06 | **NEEDS BACKEND INVESTIGATION** | Live R3 sort windows include rows with empty `product_code` / `product_name` despite the INNER JOIN; root cause not proven; frontend shows them blank (no invented labels) | F06 live R3 (`valuesPresent: false`) |

Recorded, non-gating findings preserved in the module reports (unchanged):

| ID | Module | Finding |
|---|---|---|
| B3-01, B3-02 | F04 (inactive) | Search columns on the wrong table (suspected); ORDER BY concatenation |
| B3-03, B3-05, B3-06 | F10 | Zero values dropped by `Updates(struct)`; no cascade on catalog delete; ORDER BY concatenation (allowlisted) |
| B3-07 | F09 | Backend criteria-reader evidence gap (`GetCustomCriteriaByCustomType` has no caller) — NEEDS EVIDENCE |
| B3-08 | F09 | Homepage product search matches `product_id` only |
| B3-09 | F09 | Raw ORDER BY; frontend uses allowlist |
| B3-10 | F09 | Zero values not persisted |
| B3-11 | F09 | `/global-configurations/detail` requires a GET body; F09 avoids it — **separate from B3-13** |
| B3-12 | F09 | Legacy `homepages/options` endpoint unavailable |

## F. F06 Stock Bulk Delete Decision

- **Earlier uncertainty:** the F06 implementation report first recorded that the stock multidelete route (A4 #300) existed but that the legacy screen had no trigger.
- **Owner verification (2026-10-07):** the owner manually verified the legacy Inventory UI; **the stock bulk delete button exists.**
- **Decision: KEEP / IN SCOPE.** Stock bulk delete was manually confirmed to exist in the legacy UI and is therefore retained in the F06 migration scope. It is not REVIEW, not REMOVE, not a placeholder and not a backend-only extra.
- The migrated implementation must retain this capability (`inventory.delete`). `F06_INVENTORY_REPORT.md` was corrected accordingly.

## G. Known Non-Blocking / Deferred Issues

1. **Confirmed backend defects** (affect READ surfaces today): B3-04 (F10 search total), B3-13 (F09 Settings tab HTTP 500; F30 Key sort presumably affected).
2. **Needs-evidence findings:** B3-15 exact write outcome; B3-21 distributor id semantics; B3-22 empty product fields root cause; B3-07 criteria buyer-side effect; **F06 live stock row mapping NOT YET PROVEN** (sampled inventory had 0 stock rows; mapping proven by contract, mock and automated tests only).
3. **Integration / data-integrity risks:** B3-16 (Elastic stock staleness), B3-17 (unscoped stock ids), B3-20 (orphan stock rows), B3-14 / B3-09 / B3-06 (ORDER BY concatenation, mitigated by frontend allowlists).
4. **Relevant only to future WRITE validation:** B3-15, B3-16, B3-17, B3-18, B3-20, B3-21 (F06); B3-03, B3-10 (zero values, F10 / F09). B3-19 is a data-quality issue with no current UI impact.

Other deferred items: full E2E suite is load-sensitive on this host (known flakes T-01 `banner.spec.ts:107`, T-02 `faq.spec.ts:44`, plus the 5 timeout observations above); visual parity for F06 / F09 / F10 is NEEDS EVIDENCE (no A3.2 capture).

## H. Production Readiness Boundary

**Conditional GO does not constitute authorization for live WRITE.**

Any future live WRITE (F06, F09, F10, or F11 W3) requires:

- explicit owner authorization for the specific module and operation;
- a dedicated fixture (owner-supplied ids, not existing business data);
- mutation-specific evidence (one attempt per operation, recorded in the evidence file);
- readback verification after each mutation;
- a cleanup / revert strategy where applicable, agreed before the run.

For F06 specifically, B3-15, B3-16, B3-17 and B3-21 should be confirmed by the backend team before CMS inventory writes are relied upon in production.

## I. Next Batch Boundary

Batch 3 closure does **not** authorize Batch 4 implementation. Batch 4 must begin with a new scope-discovery / audit phase.
