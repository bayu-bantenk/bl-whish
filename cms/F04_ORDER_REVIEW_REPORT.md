# F04 Order Review — Migration Report (Batch 3, Phase 1)

| Field | Value |
|---|---|
| Date | 2026-10-06 |
| Scope | READ-ONLY vertical slice: list + detail. No create / update / delete / bulk delete |
| Route | `/dashboard/order-review`, `/dashboard/order-review/detail/[id]` (legacy `/order-review`, `/order-review/:id/edit`) |
| Capability | `order-review.read` (fail-closed; interim grant via `AUTHZ_INTERIM_GRANTS`) |
| Status | **MODULE GATE: PASS (automated) · LIVE READ: PARTIAL, blocked by missing data (0 order reviews on devb2b)** |

## 1. Contract (verified in backend source)

Source: gpos-b2b-order-service `development` `29a420d` (2026-08-13). Gateway `endpoints.json:318-319`.

| Item | Evidence | Implemented |
|---|---|---|
| Routes | `handler/order_review.go:31-32`: CMS `GET /cms/order-reviews`, `GET /cms/order-reviews/:id`. No CMS PUT / DELETE / bulk | list + detail only |
| List query | `dto/order_review.go` `CmsGetOrderReviewListPageRequest {sort_by, asc_desc, page, take, keyword}`; defaults `created_at desc`, take 10, page 1 (`global/pagination.go:8-24`) | all five sent; default sort `created_at desc`, take 5 (legacy page length) |
| List response | `global.Pagination {limit, page, sort, total_rows, total_pages, rows}`; rows = `OrderReviewResponse` (review fields + embedded `OrderResponse`, filled by `mapper/order_review.go:64-89`: invoice_no, purchase_no, purchase_date, customer_name, customer_phone, final_price) | strict mapping; `invoice_no` (`*string`) → null; Go zero time → null |
| Detail | `GET /:id`; `GetOrderReviewById` maps **any** error to `NotFoundError` (404) | 404 → `notFound()` (legacy: flash "Data tidak ditemukan") |
| Identifier | the review id (top-level `id` shadows the embedded order `id`) | detail links use the review id |
| Sort | `Order(fmt.Sprintf("%s %s", SortBy, AscDesc))`: concatenated, no allowlist | allowlist `rating`, `created_at` only (legacy sortable columns) |

## 2. Legacy parity

| Area | Legacy | New | Verdict |
|---|---|---|---|
| Menu | Transaksi → "Order Review" (`fa-heartbeat`) | Transaksi → "Order Review" (`HeartPulse`), legacy menu position | MATCH |
| List title | "Review Management" | "Order Review" (menu label; same rule as Masukan "Feedback Management") | INTENTIONAL (OD-20) |
| Columns | Action (eye "Detail"), Customer, Purchase No, Rating, Created | Aksi (Detail), Customer, Purchase No, Rating, Dibuat | MATCH (OD-20 copy) |
| Sorting | Customer / Purchase No `no-sort`; Rating, Created sortable; default last column DESC | same | MATCH |
| Search / paging | global search; pageLength 5; [5, 10, 25, 50, All] | search box; default 5; [5, 10, 25, 50] ("All" dropped: unbounded take) | MATCH / INTENTIONAL |
| Date | `YYYY-MM-DD HH:mm` server time | `Intl` id-ID medium / short, Asia/Jakarta | INTENTIONAL (OD-21, as all modules) |
| Detail | "Detail Order Review": Cust. Name, Cust. Phone, Purchase No, Invoice No, Date, Rating, Remark (full width), Back | same fields and order (Date → "Tanggal"), read-only blocks, Kembali | MATCH |
| Delete / multidelete | routes + controller only (no UI trigger, no BE handler) | not migrated | INTENTIONAL (discovery, OD-09) |
| Errors | list errors → empty table; detail miss → flash + redirect `/` | typed error state with retry; 404 page in shell | INTENTIONAL (legacy defect not carried) |
| Auth | no `checkAuth` (session middleware only) | `guardRoute` + use-case `order-review.read` | stricter (fail-closed) |

**Visual parity:** structure, labels and field order are verified from source (`order_reviews/list.edge`, `edit.edge`, `OrderReviewMapper.js`). No A3.2 runtime capture exists for F04, so exact legacy appearance (colours, density) is **VISUAL PARITY — NEEDS EVIDENCE** (screenshot of legacy `/order-review` and a detail page).

## 3. Implementation

- **Package `src/packages/order-review`:**
  - domain (`order-review.ts`, `.port.ts`);
  - `usecases/order-review.usecase.ts` (list, get);
  - `repository/{dto.ts, order-review.repository.ts}`;
  - `presentation/{order-review-table.tsx, order-review-detail.tsx, order-review-format.ts, order-review-query.ts, order-review-routes.ts}`.
- **Routes:** `src/app/(dashboard)/dashboard/order-review/{page,loading}.tsx`, `detail/[id]/page.tsx`.
- **Shared wiring:**
  - capability `order-review.read`;
  - registry entries `order-review.list` / `order-review.detail`;
  - nav icon `heart-pulse`;
  - `composeFeatures` `orderReview`;
  - DAL feature allowlist;
  - Playwright grants;
  - expected menu in `authorization.spec.ts`.
- **Columns:** defined at module scope (stable; no cell remount).

## 4. Tests

| Suite | Result |
|---|---|
| `order-review.contract.test.ts` + `order-review-pages.test.tsx` | **16 / 16** (query mapping, sort allowlist / hostile input, null invoice / zero time, Contract on bad shapes, 500, detail 404 / malformed id with no call, fail-closed authorization, read-only surface; pages: columns, sortable headers, empty / error state, 403, detail fields, notFound) |
| E2E `order-review.spec.ts` | **6 / 6** (menu → list + default query + axe, pagination / rating sort / search / empty, detail + breadcrumb + axe + Kembali + unknown id 404, list 500 error state, 375 px no overflow, reader instance with 0 writes) |
| `npm run quality` | exit 0: eslint 0 errors (28 pre-existing warnings), tsc 0, **vitest 64 files / 977 passed** |
| Full E2E | **137 / 138**. Single failure: Batch 2 `banner.spec.ts:107` (see §6), unrelated to F04 |
| `npm run build` / `check:bundle` | PASS; client wire scan (`cms/order-reviews`, `customer_phone`, `purchase_no`, `order_id`, `sort_by`) → 0 |

## 5. Live READ (owner terminal, 2026-10-06 09:27 UTC, devb2b-api.gpos.id, READ only)

Command:

```bash
LIVE_MODULE=order-review npx --no-install vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts
```

**Run summary:**
- **Evidence:** `$TMPDIR/module-live/order-review/evidence-20261006092751.json` (13 observations).
- **Mutations:** POST 0 / PUT 0 / DELETE 0.
- **Secret scan:** 0 hits.
- **Harness result:** 6 passed, 1 failed (R5), 5 skipped (W0–W3).

| Step | Result | Meaning |
|---|---|---|
| Login / logout | PASS (200 / 200, session cleared) | |
| R1 default list | PASS: 200, `total_rows: 0`, `rows: []` | The live envelope keys match the mapper exactly (`limit, page, sort, total_rows, total_pages, rows`) |
| R2 pagination | PASS (empty; out of range = empty page) | |
| R3 sort `rating` / `created_at` asc / desc | PASS (200; no SQL error) | Allowlisted columns are accepted |
| R4 search | **NOT RUN**: no row to derive a term | **B3-01 not yet confirmed** |
| R5 existing detail | **NOT RUN**: no row (the harness assertion fails, by design) | Row / detail mapping not verified live |
| R5 unknown well-formed id | PASS: 404 → `NotFound` | Correct (unlike F07 B2-01) |

**Classification:** environment / data. The development backend has **no order reviews**. This is neither a frontend defect nor a backend defect.

```text
LIVE READ — PARTIAL (BLOCKED BY MISSING DATA)
```

No review was created to fill the gap: that would be a live WRITE, which is not authorized.

**Required to complete:**
1. At least one order review on devb2b, created through the normal customer flow (app `POST /api/v1/order-reviews` by a customer with a completed order) by the backend / QA team. Alternatively, a non-production environment that already has reviews.
2. Then re-run the command above. It verifies the row / detail mapping (R5) and search (R4, which confirms or refutes B3-01).

## 6. Findings

| ID | Type | Finding | Action |
|---|---|---|---|
| B3-01 | Backend defect (suspected; live R4 **not runnable**: 0 reviews on devb2b) | `repository/order_review.go` filters `customer_name LIKE ? OR purchase_no LIKE ?` on `order_reviews`, but those columns live on `orders` (model `OrderReview` has no such fields; `Order` is preloaded separately). `Find` / `Count` errors are not checked, so any keyword likely returns an empty page. Legacy uses the same endpoint | search UI kept (legacy parity); **no workaround** |
| B3-02 | Backend defect | `sort_by` / `asc_desc` concatenated into ORDER BY (same class as B2-06) | frontend sends the allowlist only |
| T-01 | Test flake (Batch 2, not F04) | `banner.spec.ts:107` "manual customer ids": `selectOption('manual')` can run before hydration of the edit form (the test waits for the SSR "Judul" value), so the selection is reset; failed 1–2 / 3 in isolation under host load. F04 changes no banner code, shared component or banner mock route | recorded; not changed in this phase (follow-up: wait for hydration in that spec) |

## 7. Safety

- No live CREATE, UPDATE, DELETE or upload.
- No live call was made by the agent.
- F11 W3 not started.
- No backend change.
