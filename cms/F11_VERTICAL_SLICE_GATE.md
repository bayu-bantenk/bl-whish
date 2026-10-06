# F11 — Product Restriction: Vertical Slice Completion Gate

| Field | Value |
|---|---|
| Date | 2026-10-05 |
| Phase | Vertical-slice completion audit before live WRITE. **No live mutation performed** |
| Builds on | `F11_MIGRATION_REPORT.md` (contract, implementation, live READ) |
| Global | A6 = HOLD / BLOCKED · D-A6R2-01 = OPEN / CRITICAL (unchanged) |

## A. Scope

```text
F11 — Product Restriction (legacy menu "Pembatasan produk")
Vertical Slice Completion Gate
```

## B. Legacy evidence (`gpos-b2b-cms`, source of truth)

| Area | Evidence |
|---|---|
| Routes | `start/routes.js` l.426-443: index, datatable, delete, multidelete, channel-type + `Route.resource` (create / store / edit / update / destroy; `show` has no action → REMOVE in A4) |
| Screens | `views/product_restrictions/list.edge`: columns Action, Product Name, List Customer Channel; **no checkbox column / no bulk trigger**. `create.edge`: product select2 (`/products/search`) + multi-select channel types (`/product-restrictions/channel-type`). `edit.edge`: product **display only** + hidden `product_id`; channels pre-selected |
| Business rules | `ProductRestrictedController.store / update`: product **and** ≥ 1 channel required ("Product dan Customer Channel wajib diisi."); store redirects to the edit page; update / destroy redirect to the list |
| API usage | `ProductRestrictedRepository`: `GET/POST /api/v1/cms/product-restricted`, `GET/PUT/DELETE /:id`, `DELETE /bulk`; lookups `GET /api/v1/cms/products` (`ProductController.searchProduct`: take 20, name asc, `text = code - name`), `GET /api/v1/cms/customer-channels` (take 1000, name asc, `text = [aam_code] name`) |
| Permissions | `Authorization.checkAuth` (session) only; legacy menu Superadmin (A2 §14). No role / action checks |
| Detail screen | **none** (legacy `show` route has no action), so no detail screen is created |

**Contradiction with the brief:** the brief says "backend stores `customer_channel_ids` as a string". The source shows otherwise:
- model `CustomerChannelIds datatypes.JSON` (a JSON array column);
- wire request / response `[]string`.

Effect on the implementation: none. The canonical DTO holds `channelIds: string[]`, and only `dto.ts` knows the wire name.

## C. Next.js evidence (`frontend/`)

| Layer | Location |
|---|---|
| Package | `src/packages/product-restriction/` |
| Routes | `src/app/(dashboard)/dashboard/product-restriction/{page,loading}.tsx`, `create/page.tsx`, `update/[id]/page.tsx` |
| Domain | `domain/product-restriction.ts` (canonical list item / detail / inputs / lookups, `TableSpec`); `product-restriction.schema.ts` (≥ 1 channel, deduplicated); `product-restriction.port.ts` |
| Use cases | `usecases/product-restriction.usecase.ts`: authorize → zod → **channel ids validated against the real channel list** (unknown → Validation, never dropped or substituted) → port. **Update schema has no `productId`**: the product is immutable at the use-case boundary, not only in the UI |
| Repository | `repository/dto.ts` (wire ⇄ canonical; sort allowlist; fixed lookup sort) + `product-restriction.repository.ts` (shared GatewayClient, `server-only`) |
| Server Actions | `presentation/actions/product-restriction.actions.ts`: create / update / delete (→ `runAction` → redirect with notice) + read-only `searchProductsAction` |
| UI | table (shared ServerDataTable), form (create / update modes), product picker, shared confirm dialog |
| Navigation | registry `product-restriction.{list,create,update}` (group "Produk & Katalog"), breadcrumbs, nav icon `ban` |
| Authorization | `product-restriction.read / create / update / delete` (capability vocabulary in `capabilities.ts`); fail-closed; UI visibility via `authorization.can`, authority in use cases |

**Wire isolation:**
- the UI and the canonical types never contain `customer_channel_ids`, `product_id` or `sort_by`;
- bundle scan: `product-restricted`, `customer-channels`, `/api/v1/cms/products`, `customer_channel_ids`, `sort_by`, `product-restriction.read` → 0 client files.

## D. UI completion matrix

| Area | Status | Evidence |
|---|---|---|
| List | PASS | E2E menu → list (6 rows, channel badges, axe); unit page tests |
| Search | PASS | E2E search by code + no-match empty state (`main [role=alert]` = 0); live R4 |
| Pagination | PASS | E2E `per_page=5` → 5 rows, page 2 → 1 row, query `take=5, page=2` (**new**); live R2 |
| Sorting | PASS | E2E sort productName asc; unit sort mapping + allowlist; live R3 |
| Create | PASS | E2E full create → notice → row count 7; body `{product_id, customer_channel_ids}` |
| Product lookup | PASS | E2E search (Enter does not submit) → radio pick; unit search action; live R6 product search |
| Channel selection | PASS | checkboxes `[aam_code] name`; unknown ids rejected (unit); live R6 (55 channels) |
| Validation | PASS | product + ≥ 1 channel required (E2E, unit); uncheck-all on edit → message, no action call (**new**); input kept on a server error (E2E) |
| Edit | PASS | product fixed (no picker; `fixed-product`); tampered `productId` never reaches the backend (**new** unit); PUT body `{customer_channel_ids}` only |
| Authorization | PASS | reader / none: Forbidden with **0 gateway calls** (unit); reader instance 403 on create / update with 0 writes / 0 detail / 0 channel calls (E2E) |
| Error handling | PASS | list 500 → typed error state; duplicate product → Business alert (`Product already restricted`); 404 → `notFound()`; network / Contract via the existing taxonomy |
| Success feedback | PASS | `?saved=created / updated / deleted` notices (E2E) |
| Navigation | PASS | menu entry, active state, breadcrumbs on list / create / edit (**new** create / edit assertions) |
| Responsive behavior | PASS | 375 px and 320 px: list, create, edit visible with no horizontal overflow (**new** E2E) |
| Duplicate submit | PASS | second submit while saving ignored (**new** unit) |
| Legacy leakage | PASS | no `alert(` / `confirm(` / jQuery / Bootstrap / `fetch(` in F11 code; no browser → backend call |

**No functional gap was found.** Every addition in this phase is a test for behaviour that already existed; no application source changed.

## E. Test evidence (this run, 2026-10-05)

| Command | Result |
|---|---|
| `npm run quality` (eslint + `tsc` + `vitest run`) | exit 0; eslint **0 errors** (28 pre-existing warnings); **40 files, 584 passed** |
| `CI=1 npm run test:e2e:full` | exit 0; **85 passed** (F11: 11, including the 3 new) |
| `next build` | exit 0 (F11 routes built) |
| `npm run check:bundle` | PASS |
| Harness self-test (local E2E mock, **not real backend**) | placeholder channel → W0 preflight fails, 0 mutations, no marker; unknown channel → same; valid fixture → 1 POST / 1 PUT / 1 DELETE with semantic read-back; F30 regression pass |

## F. Live READ evidence

**Not re-executed in this phase:** the agent process cannot see the live credentials. The latest owner runs apply to the current code; F11 source was last modified 2026-10-02 14:12, before both runs.

| Run | Result |
|---|---|
| `evidence-20261002082508.json` (READ only) | R1–R6 pass: list 2 rows, paging, sort `productName` / `productCode`, search 1 / 1 + no-match 0, detail 200 / unknown 404, channel options 55, product search 20; 0 mutations, 0 secrets |
| `evidence-20261002100052.json` (write requested) | R1–R6 pass; **W0 stopped**: the target product already has a restriction; **0 mutations** |

## G. Known risks

| Class | Risk |
|---|---|
| VERIFIED | Backend accepts an empty channel list (would lift the restriction): the frontend requires ≥ 1 |
| VERIFIED | Backend stores any channel id: the use case validates against the channel list |
| VERIFIED | Lookup endpoints build ORDER BY from `sort_by` unsanitized: fixed values sent |
| VERIFIED | Delete transaction returns without rollback on error (backend) |
| VERIFIED | Product `066e6346-19b7-4fa7-ad06-07e514ef9719` already has a restriction (pre-existing data): not a usable CREATE fixture |
| INFERRED | `DELETE /bulk` is shadowed by `DELETE /:id` (Fiber registration order): bulk not migrated |
| INFERRED | A live CREATE hides the fixture product from the other channel types until DELETE |
| UNKNOWN | Product existence cannot be checked through F11's contract (no product-by-id lookup); the backend does not validate it on create, so the fixture product must be owner-asserted |
| UNKNOWN | Behaviour for customers without a channel type; detail of a restriction whose product was deleted (404 / 500) |

## H. Live WRITE readiness

```text
BLOCKED: missing valid fixture (code and harness are ready)
```

**Ready:**
- the generic harness now has a **read-only fixture preflight in W0**. For F11 it checks:
  - product id well-formed;
  - two distinct channel ids;
  - both ids exist in the real channel list.
  It runs before any mutation, so a fixture that would only fail at UPDATE can no longer leave a CREATE behind;
- one-shot marker, guard, no retry, semantic read-back.

**Missing:**
1. a product with **no existing restriction**: the approved `066e6346…` is already restricted;
2. a **second real channel id**: the earlier run passed the literal `ID_CHANNEL_KEDUA`.

## I. Final gate

```text
Contract              ✅
Domain                ✅
Use Case              ✅
Repository            ✅
UI                    ✅
Navigation            ✅
Authorization         ✅
Unit/Integration      ✅  (584/584)
E2E                   ✅  (85/85)
Live READ             ✅  (owner run 2026-10-02, applies to current code)
Live WRITE            NOT RUN
Final Status          BLOCKED: valid live-WRITE fixture missing; vertical slice complete
```

**Files changed in this phase** (test / harness only):
- `src/__tests__/product-restriction.contract.test.ts`
- `src/__tests__/product-restriction-pages.test.tsx`
- `e2e/specs/product-restriction.spec.ts`
- `test/live/modules/types.ts`
- `test/live/modules/product-restriction.ts`
- `test/live/module-smoke.live.test.ts`
- this report

No application source, backend, legacy, mock or env files were changed.
