# Batch 3 — Scope Discovery & Sequencing

| Field | Value |
|---|---|
| Date | 2026-10-06 |
| Type | Discovery / audit only. No implementation, no live calls, no mutation |
| Baseline | Batch 1 closed · **Batch 2 — CONDITIONAL GO** (`BATCH2_CLOSURE_GATE.md`) |
| Sources | `summary.md`, `claude-summary.md`, `ROUTE_SCREEN_MAP.md`, `FRONTEND_SCOPE.md`, `RUNTIME_BEHAVIOR_AUDIT.md`, `AUTH_API_PERMISSION_MAP.md`, `A4/` (route matrix, open decisions), `A7_NEXT_MODULE_SELECTION_AUDIT.md`, `BATCH1_MIGRATION_REPORT.md`, `BATCH2_MIGRATION_REPORT.md`, `BATCH2_CLOSURE_GATE.md`; legacy `gpos-b2b-cms/` (routes, controllers, repositories, views); backend source `~/Developments/BE/*` (read-only, incl. branch / ref checks); gateway `endpoints.json`; current `frontend/src` (packages, registry, app routes) |

## 1. Executive summary

**Current position:** 17 feature areas are migrated, and each has a vertical slice (route, use case, gateway repository, tests):
- F01;
- F07, F08, F11, F18, F19, F20, F24, F25, F28, F30;
- F32 FAQ / Masukan;
- F32 Konten, which stays HOLD (A6 / D-A6R2-01).

**Remaining:** 20 modules.
- **Immediately viable:** only a few combine a clear legacy behaviour, a backend contract verified from source, safe live READ and reuse of the existing foundation.
- **Not viable now:** most of the rest are blocked by open product decisions (OD-07 / OD-08 / OD-09), by missing backend source (config_service), or by live writes with real-world effects (payments, points, vouchers, push notifications, account approval).

**Recommended Batch 3: "Produk & Katalog completion + read-only order review" (4 modules).**

| Order | Module | Why |
|---|---|---|
| 1 | **F04 Order Review** | read-only, contract verified, no master data: a low-risk warm-up |
| 2 | **F10 Personalisasi Katalog** (core: catalog CRUD + per-catalog criteria + catalog homepage products; the 17 REVIEW routes excluded) | contract verified in product-service; reuses the F18 custom-criteria repository and the 7 pickers |
| 3 | **F09 Produk Gpos B2b** | same criteria component and homepage-products pattern as F10; signed-URL upload verified |
| 4 | **F06 Inventory / Persediaan** | full CRUD contract verified (inventory + stock); completes the menu group; live WRITE strictly not authorized |

The batch depends on **three product decisions**, listed in §5: OD-09 for F04, OD-07 for the F10 review routes, and the F30 boundary for F09.

## 2. Remaining module inventory

**Legend:**
- *State*: frontend implementation verified in `frontend/src` (packages, registry status, app routes).
- *Contract*:
  - **V** = verified from backend source;
  - **P** = partial (handlers exist, DTOs not fully matched, or the clone is stale);
  - **NE** = needs evidence;
  - **B** = blocked.

### 2.1 Already migrated (not in Batch 3 scope)

| Module | State | Notes |
|---|---|---|
| F01 Login / sesi | migrated (A5.1) | live verified |
| F07, F08, F18, F19, F28 | migrated (Batch 2) | Batch 2 CONDITIONAL GO; F19 WRITE contract unverified (B2-07) |
| F11, F20, F24, F25, F30 | migrated | F11 W1 / W2 live writes done, W3 not started; F25 live WRITE blocked (`customer_ids`) |
| F32 FAQ, Masukan | migrated (Batch 1) | FAQ `total_rows` backend bug open |
| F32 Konten | migrated, **HOLD** | A6 / D-A6R2-01 |

### 2.2 Partially migrated

| Module | State | Notes |
|---|---|---|
| F02 Beranda | `/dashboard/home` welcome page (`packages/dashboard`) | Legacy `HomeController.home` renders static widgets with zeros. There are no backend endpoints for metrics. A4 / A7 reference "OD-P4", which is **not defined**; the defined decision is **OD-10 "Dashboard content"**. Effectively done unless OD-10 asks for real metrics |
| F05 Pembayaran | registry entries `payment.list` / `payment.detail` with status **planned** (404); no package | Not implemented |

### 2.3 Not yet migrated

| Module | Legacy route | Current state | Risk | Contract | Live READ | Recommendation |
|---|---|---|---|---|---|---|
| F03 Order / Pesanan | `/orders` (routes.js:41-45) | none | MEDIUM-HIGH | V (list, detail, sync); delete / update have no BE handler | ready | **Later** (OD-09; Sync calls the AAM ERP) |
| **F04 Order Review** | `/order-reviews` (routes.js:57-62) | none | **LOW** | **V** (order-service `order_review.go:31-32`, `dto/order_review.go:32`) | ready | **Batch 3 #1** |
| F05 Pembayaran | `/payments` (routes.js:454-458) | planned (404) | HIGH | V (payment-service `cms.go:26-28`), but the clone is on a feature branch | ready | **Later** (BCA settlement is financial; A2-U04 unknown) |
| **F06 Inventory / Persediaan** | `/inventories` (routes.js:393-411) | none | MEDIUM | **V** (product-service inventory + `inventory_stock.go:28`; DTOs `inventory.go:39-66`, `inventory_stock.go:45-66`) | ready | **Batch 3 #4** (no live WRITE) |
| **F09 Produk Gpos B2b** | `/product-gposb2bs` (routes.js:71, 3 tabs) | none | MEDIUM | **V / P** (homepage CRUD `product_gposb2b_homepage.go:28-33` V; criteria PUT V via F18; settings = F30 global-configuration PUT loop) | ready | **Batch 3 #3** (after the F30 boundary decision) |
| **F10 Personalisasi Katalog** | `/custom-catalogs` (routes.js:119-196) | none | MEDIUM | **V** (`custom_catalog.go:34-40`, `custom_catalog_product_homepage.go:28-33`; criteria PUT only) | ready | **Batch 3 #2** (core only) |
| F12 Loyalty Member | routes.js:504-524 | none | HIGH | P (patient-loyalty handlers exist; route `/:code` vs gateway `/cards/{id}` NE; header injection NE) | ready | **Later** |
| F13 Pengaturan Poin | routes.js:236-292 | none | HIGH | P (loyalty-service clone stale: local 2026-08-31 vs origin 2026-09-23) | ready | **Later** (wizard; OD-08 mock-ups) |
| F14 Inject Poin | routes.js:295-319 | none | HIGH | V DTO (`cms_inject_point.go:9-18`); fix GOPH-4102 **not merged** | ready | **Blocked** (OD-07; financial point credit / reversal) |
| F15 Mutasi & Redeem | routes.js:321-333 | none | MEDIUM | P (query spec NE; re-verify on `origin/development`) | ready | **Candidate only if OD-07 = migrate** (read-only) |
| F16 Voucher Setting | routes.js:338-372 | none | HIGH | P | ready | **Blocked** (OD-07) |
| F17 Push Notification | `/notifications` (routes.js:47-55) | none | HIGH | V (`push_notification.go:28-34`, DTO `:56-74`); **bulk DELETE missing**; clone stale (2025-04-17) | ready | **Later** (reaches real users; OD-37) |
| F21 Gamification | routes.js:466-487 | none | HIGH | P (gateway path mismatch `programs/vouchers` NE) | ready | **Later** |
| F22 Voucher Pengiriman | routes.js:491-495 | none | MEDIUM | P (merchant-service, last commit 2024-11) | ready | **Later** (cancel affects real discounts) |
| F23 GPOS Brand | `/gpos-brand` (routes.js:497-502) | none | HIGH | V (merchant `sales_order.go:43-47`) | ready | **Later** (cancel restores quotas, pushes to merchants) |
| F26 Konfigurasi Channel | routes.js:535-552 | none | **BLOCKED** | **B**: config_service source not in `~/Developments/BE` | NE | **Blocked** |
| F27 Verifikasi Akun | routes.js:526-532 | none | HIGH | V (account-service `cms_user.go:27-31`) | ready | **Blocked** (approve / reject email real users; no test-account plan) |
| F29 Pendaftaran Folamil | routes.js:461-462 | none | MEDIUM-HIGH | V (`cms.go:43`) | ready | **Later** (CSV registers point candidates) |
| F31 Manajemen Pengguna | routes.js:451 and others | none | HIGH | V (account-service `cms_customer.go:27,31-32`) | ready | **Blocked** (toggle revokes tokens; delete removes the user in AAM; no test-account plan) |

**"Live READ ready"** means safe GET endpoints exist in source and gateway. No live call was made in this discovery.

## 3. Dependency analysis

```text
F18 Banner (migrated) ── custom-criteria repo + 7 option pickers ──► F10 (per-catalog criteria)
                                                                    └► F09 (criteria tab, custom_type PRODUCT_GPOSB2B)
F10 catalog-homepage-products pattern ─────────────────────────────► F09 homepage products (same CRUD + sequence shape)
F30 Konfigurasi Umum (migrated) ── global-configuration PUT ───────► F09 settings tab (image + title loop)
packages/files signed-URL upload (verified, Batch 2) ──────────────► F09 image; later F17, F21, F29, F12
F07 / F11 product search ──────────────────────────────────────────► F06 product picker
F18 / F25 customer / channel / area pickers ───────────────────────► F03 filter; later F17 relations, F14 / F15 lookups
config_service (missing source) ───────────────────────────────────► F26 (blocked); F25 customer_ids question
```

- **Batch 3 modules:** none depends on an unfinished module. F09's only external dependency is the F30 boundary decision; F30 itself is migrated.

## 4. Backend contract readiness

| Level | Modules | Evidence |
|---|---|---|
| **Verified** (handler + DTO in source, gateway route present) | F04, F06, F10 (core), F09 (homepage + criteria), F03 (read + sync), F05, F17, F23, F27, F31, F14 (DTO) | order-service, product-service, payment-service, notification-service, merchant-service, account-service handlers / DTOs cited in §2 |
| **Partially verified** | F09 settings tab (F30 PUT loop semantics); F12; F13 (stale clone); F15 (query spec); F16; F21 (gateway path); F22 (DTO not matched) | see §2 |
| **Needs evidence** | F15 point-history query parameters on `origin/development`; F12 `/:code` vs `/cards/{id}` and the identity headers; F21 `programs/vouchers` routing; F17 `Select("*").Updates` blanking; F03 sync side effects; whether the gateway authorizes non-superadmin tokens (A2-U04) | |
| **Blocked** | F26 (config_service source absent) | |

**Corrections to older documents (evidence-based):**
1. The signed-URL upload contract is **verified**: content-service `handler/file.go`, `dto/oss.go`, and it is used in production code since Batch 2. A7's "upload BLOCKED" is superseded.
2. The F06 stock path is `/api/v1/cms/inventories/:id/inventory-stocks` (`InventoryStockRepository.js:8` = BE `inventory_stock.go:28`). A7's "CONTRACT_UNKNOWN (stock)" is lifted.
3. "OD-P1" / "OD-P4" are referenced in the A4 matrix and A7 but are **not defined** in `A4_OPEN_DECISIONS.md`. The dashboard decision is **OD-10**.

**Known backend defects affecting candidates (track, no workaround):**
- `Updates(struct)` zero-value class:
  - product-service `product_gposb2b_homepage.go:74`, `custom_criteria.go:125` (F09);
  - `custom_catalog.go:94`, `custom_catalog_product_homepage.go:101` (F10);
  - merchant `sales_order.go:154,168` (F23).
- No `POST /custom-criterias` exists on any branch: criteria can only be updated, as in F18.
- F17 has no bulk-delete handler.
- F14 fix GOPH-4102 is not merged.

## 5. Batch 3 recommendation

**Recommended modules (4):**

| # | Module | Scope in Batch 3 | Reuse |
|---|---|---|---|
| 1 | **F04 Order Review** | list + detail (read-only). Delete / bulk delete **dropped**: no UI trigger, no BE handler (needs OD-09 = drop) | ServerDataTable, DAL, live READ harness |
| 2 | **F10 Personalisasi Katalog** | catalog list / create / edit / delete / bulk + per-catalog criteria (PUT) + catalog homepage products (CRUD + sequence). **Excluded:** the 17 REVIEW routes (CCPH / standalone criteria without menu: OD-07) and the dead `POST /custom-criterias` | F18 criteria repository + pickers, F07 product options |
| 3 | **F09 Produk Gpos B2b** | 3 tabs: settings (image + title via global configuration), criteria (PUT, `PRODUCT_GPOSB2B`), homepage products | F10 homepage-products pattern, F18 criteria, signed-URL upload, F30 |
| 4 | **F06 Inventory / Persediaan** | inventory CRUD + stock CRUD (modal) + product search; hardcoded distributors as in legacy | product search (F07 / F11 pattern) |

**Why group them:**
- **One menu group:** F06, F09 and F10 complete "Produk & Katalog"; only F07, F08 and F11 are done there today.
- **Shared foundation:** they share the criteria and homepage-products components and the product picker.
- **Verified contracts:** every contract is verified in product-service or order-service source, and live READ is possible with existing data.
- **Warm-up:** F04 is a low-risk, read-only start that also validates the order-service read path for a later F03.

**Ordering rationale:**
- **F04 first:** smallest, read-only.
- **F10 before F09:** F10 establishes the catalog-level criteria and homepage-products components that F09 reuses.
- **F06 last:** largest write surface (stock affects the Elastic catalog), so it benefits from the established patterns.

**Decisions needed before / at the start of implementation:**
- **OD-09** (product + backend): drop Order Review delete / bulk (no BE handler).
- **OD-07** (product): confirm that F10's CCPH / standalone criteria screens stay out of scope.
- **F30 boundary** (A7:276): F09's settings tab writes F30 global-configuration keys. Confirm which keys F09 owns.

**Known risks:**
- `Updates(struct)` zero-value defects in F09 / F10 repositories: clearing a field or setting sequence 0 will not persist. Document, no workaround.
- F06 writes change buyer-visible catalog / stock and HNA price. **Live WRITE must not be run** without a dedicated fixture and explicit authorization.
- F09 settings is a multi-key PUT loop; legacy hides partial failures (`GlobalConfigurationController.js:128+`), and the new UI must surface them.
- F10 / F09 criteria share F18's blank-label master data (handled since the F18 fix).

**Explicit exclusions from Batch 3:**

| Module | Reason |
|---|---|
| F03 | OD-09; Sync triggers an AAM ERP call |
| F05 | financial settlement; feature-branch clone; A2-U04 |
| F12, F13, F21 | high complexity, wizards, identity-header and gateway-path questions |
| F14, F16 | OD-07; F14 financial reversal, GOPH-4102 unmerged |
| F15 | only if OD-07 = migrate; then a good read-only add-on |
| F17, F23 | live effects on real users / merchants; F17 bulk-delete gap; OD-37 |
| F22, F29 | real discount / point effects; F22 state-changing GET |
| F26 | config_service source missing |
| F27, F31 | account approval / revocation with no test-account strategy |
| F02 | effectively done; real metrics need OD-10 and backend endpoints |
| F32 Konten | HOLD (A6) |

**Size:** 4 modules (one read-only + three in one domain). If capacity is limited, F06 can move to Batch 4 without affecting the others.

## 6. Safety / mutation status

- No live CREATE.
- No live UPDATE.
- No live DELETE.
- No upload.
- No live API call of any kind was made in this discovery: source, document and repository inspection only.
- **F11 W3 not started.**
- No application code, tests, backend or shared architecture was modified.

## 7. Evidence gaps (genuinely missing)

1. **Live response row shapes** for the Batch 3 candidates (F04, F06, F09, F10). They will be obtained by live READ during Batch 3, as in Batch 2.
2. **OD-09, OD-07 and F30-boundary decisions** (product owner).
3. **F09 settings:** which `global-configurations` keys and ids the Produk Gpos B2b tab reads and writes on the real backend.
4. **config_service source** (F26, and the F25 `customer_ids` semantics).
5. **loyalty-service `origin/development` parity** for F13 / F15 (the local clone is 6 commits behind).
6. **payment-service `development` branch parity** for F05.
7. **Gateway authorization for non-superadmin tokens** (A2-U04), which affects F05 and the role design.
8. **Definitions of OD-P1 / OD-P4**, referenced but absent from `A4_OPEN_DECISIONS.md`.
