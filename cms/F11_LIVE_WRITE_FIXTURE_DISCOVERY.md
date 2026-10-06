# F11 — Live-Write Fixture Discovery

| Field | Value |
|---|---|
| Date | 2026-10-05 |
| Builds on | `F11_VERTICAL_SLICE_GATE.md`, `F11_MIGRATION_REPORT.md` |
| Global | A6 = HOLD / BLOCKED · D-A6R2-01 = OPEN / CRITICAL (unchanged) |

## A. Scope

```text
F11 Product Restriction
Live-Write Fixture Discovery
READ-ONLY
```

## B. Environment

| Item | Value |
|---|---|
| Environment | non-production gateway confirmed by the owner (A5.5R / A6R): `devb2b-api.gpos.id`, https |
| Base API | `API_HOST` from `frontend/.env.test.local` (host only; no path prefix); contract `legacy-v1` |
| Role / profile | the dedicated live-test account used by every F11 live READ (`A55R_EMAIL`, not printed); harness-local policy `product-restriction.read` + `.create` (the latter only to call the product search use case) |
| Authentication | existing auth use case → sealed session → GatewayClient Bearer (same as the F11 live READ). No browser token |
| Execution | **not run by the agent**: the agent process cannot see the `A55R_*` credentials (IDE-launched). Must run once in the owner's terminal |

## C. Product candidates

**PENDING: real-backend run not executed yet.**

Self-test against the local E2E mock (TEST_ADAPTER, **not evidence for the real backend**) showed the discovery logic:

| Product | Restriction | Result |
|---|---|---|
| PRD-001 … PRD-006 (mock) | `EXISTS (1)` | rejected |
| PRD-007 (mock) | `NOT_FOUND` (re-checked) | selected |

Real-backend fact already known (owner run `evidence-20261002100052.json`): `066e6346-19b7-4fa7-ad06-07e514ef9719` has a restriction → **rejected**.

## D. Customer channels

**PENDING.** The real channel list is readable: 55 channels per live READ R6. The discovery picks the first two **distinct** ids of that same list (`name asc`), which is exactly the list the F11 form and use case validate against. The channel DTO has no status / active field (account-service `CmsCustomerChannelResponse`: id, aam_code, name, timestamps), and F11 imposes no active rule, so status is reported as N/A.

## E. Verification method

Script: `frontend/test/live/f11-fixture-discovery.live.test.ts`. It is read-only, has the same safety gate as the live harness, and uses the F11 production use cases.

Guard (throws before a request leaves the process):
- `GET` only on `/api/v1/cms/product-restricted`, `/api/v1/cms/products`, `/api/v1/cms/customer-channels`;
- `POST` only on the auth endpoints;
- no GET body.

Steps:
1. Login (auth use case).
2. `productRestriction.channelOptions()` → `GET /cms/customer-channels` (name asc, take 1000) → two distinct ids.
3. `productRestriction.searchProducts(LIVE_DISCOVERY_TERM | "a")` → `GET /cms/products` (take 20). Each returned product exists and is readable.
4. For each candidate in order:
   - **restriction check:** `productRestriction.list(q = product_id, per_page = 50)` across **all** result pages;
   - backend `pr.product_id LIKE ?` with an exact `productId` match;
   - the first candidate with **0** matches is selected.
5. **Re-check** the selected product's restriction immediately before reporting.
6. Logout.

The evidence (ids, codes, names, request list with statuses, mutation count) is written to `$TMPDIR/module-live/product-restriction/fixture-discovery-<UTC>.json`. Tokens, cookies, the password and the API key are never written.

**Strongest available assertion:** the contract has no restriction-by-product endpoint. `ProductRestriction(product_id) == NOT_FOUND` is established as "the restriction list filtered by the exact product id returns no row, on every page, read twice". The backend's own duplicate check uses the same scope: soft-deleted rows excluded.

Not verifiable through the F11 contract: whether the product is **active / sellable**. The product search returns any non-deleted product. The owner should confirm the selected product is acceptable to hide briefly from the other channel types during the test.

## F. Safety assertions

| Assertion | Status |
|---|---|
| Product exists | PENDING (real run) |
| Restriction absent | PENDING (real run) |
| Channel 1 exists | PENDING (real run) |
| Channel 2 exists | PENDING (real run) |
| Channel IDs distinct | PENDING (real run) |
| Authenticated read | PASS (live READ 2026-10-02: list, detail, channel options, product search) |
| No mutation performed | PASS (this phase made no backend request; the script is GET-only by guard) |

## G. Fixture recommendation

```text
NO SAFE FIXTURE YET: pending the owner-terminal discovery run
```

Run once (READ-ONLY):

```bash
cd frontend
npx vitest run --config vitest.live.config.js test/live/f11-fixture-discovery.live.test.ts
# optional: LIVE_DISCOVERY_TERM=<term> to search a different product name / code
```

## H. Final status

```text
BLOCKED: discovery requires the live credentials (owner terminal); no fixture verified yet
```

**Files changed in this phase:**
- `test/live/f11-fixture-discovery.live.test.ts` (new, read-only);
- this report.

No application, backend, harness or existing test files changed.
