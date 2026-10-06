### F04 Order Review

F04 is implemented as a read-only list and detail slice, and every automated check passes. The one thing left is the live READ run, which you need to do from your terminal (command below).

- **Implementation:** PASS.
  - **What it does:** list and detail only, through the existing page → DAL → use case → repository → gateway chain. Create, update and delete were not built, because the backend has no CMS write endpoint for order reviews.
  - **Contract:** checked against order-service source: `handler/order_review.go:31-32`, `dto/order_review.go`, the mapper and the repository.
  - **Where it lives:** route `/dashboard/order-review` and `/dashboard/order-review/detail/[id]`. Capability `order-review.read`; the page denies access without it.
  - **Menu:** under Transaksi, in the legacy position.
- **Tests:** 16/16 for F04 (contract and page tests). Full `npm run quality` passes: 977/977 tests in 64 files, 0 TypeScript errors, 0 lint errors.
- **E2E:** 6/6 for F04, covering list, pagination, sorting by rating, search, detail, unknown id (404), the 500 error state, a 375px layout, the read-only account and accessibility checks. The full suite was 137/138; the single failure is in a Batch 2 banner test (T-01 below), not in F04.
- **TypeScript:** PASS (0 errors).
- **Lint:** PASS (0 errors; the 28 warnings were already there before F04, none are in F04 files).
- **Build:** PASS, and the client-bundle check passes with no backend paths or API field names in browser code.
- **Live READ:** **PENDING**, because the credentials are only in your terminal. Run this from `frontend/` with the `A55R_*` variables set:
  ```bash
  LIVE_MODULE=order-review npx --no-install vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts
  ```
- **Live mutations:** 0. No create, update, delete or upload, no live call from me, and F11 W3 not started.
- **Visual parity:** structure verified against the legacy source (columns and their order, which columns sort, page size 5, detail fields and their order, Kembali button). Exact look and spacing: **NEEDS EVIDENCE**, because there's no legacy screenshot of F04.
- **Known backend issues:**
  - **B3-01 (suspected, to confirm in live R4):** search almost certainly returns nothing for any keyword. The backend filters `customer_name` / `purchase_no` on the `order_reviews` table, but those columns live on `orders`, and the SQL error is ignored. Legacy uses the same endpoint, so it has the same problem. The search box is kept for parity, with no workaround.
  - **B3-02:** the backend pastes `sort_by` straight into ORDER BY. The frontend only ever sends `rating` or `created_at`.
- **Module Gate:** **PASS (automated)**; live READ still pending.

**Batch 2 test finding (T-01), not changed:** the `banner.spec.ts:107` test picks an option in the edit form before the page finishes hydrating, so the choice is sometimes reset. It failed in 1–2 of 3 isolated runs while the machine was busy. F04 doesn't touch any banner code, shared component or banner mock route. Per your instruction not to modify other tests for this module, I only recorded it; the fix would be to wait for hydration in that spec.

**Files changed (frontend):**
- **New F04 code:** `src/packages/order-review/**` (9 files) and `src/app/(dashboard)/dashboard/order-review/**` (3 files).
- **F04 tests:** `src/__tests__/order-review.contract.test.ts`, `order-review-pages.test.tsx`, `e2e/specs/order-review.spec.ts`, `e2e/mock/order-review-backend.mjs`, `test/live/modules/order-review.ts`.
- **Shared wiring:** `capabilities.ts`, `registry.ts`, `navigation/types.ts`, `nav-icon.tsx`, `server-container.ts`, `dal.test.ts` (feature allowlist), `e2e/mock/mock-backend.mjs`, `e2e/support/fixtures.ts`, `playwright.config.ts` (grants), `e2e/specs/authorization.spec.ts` (expected menu), `test/live/modules/index.ts`.
- **Report:** `docs/architecture/reviews/F04_ORDER_REVIEW_REPORT.md`, also copied to `~/Developments/bl-whish/cms/F04_ORDER_REVIEW_REPORT.md` (untracked, not committed).
- `git diff --check` is clean.
- I didn't change backend code, Batch 2 documents or `BATCH3_SCOPE_DISCOVERY.md`.

**Evidence still needed:**
- the live READ output for `order-review`, which also confirms or rules out B3-01;
- a legacy screenshot of `/order-review` and one detail page, if you need exact visual parity.

F10 has not been started.
