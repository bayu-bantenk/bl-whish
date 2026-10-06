# F11 Migration Report — Pembatasan produk

| Field | Value |
|---|---|
| Date | 2026-10-02 |
| Loop | Contract audit → Implement → Test → Live smoke → Report (lightweight) |
| Backend | `gpos-b2b-product-service` (`product_restricted`, `/cms/products`); `gpos-b2b-account-service` (`/cms/customer-channels`). Local sources; deployed versions UNKNOWN |
| Global | **A6 = HOLD / BLOCKED · D-A6R2-01 = OPEN / CRITICAL**, unchanged. F30 live CRUD evidence re-checked (`$TMPDIR/module-live/global-configuration/evidence-20261002064239.json`: 1 POST 201 / 1 PUT 200 / 1 DELETE 200, each with semantic read-back) |
| **Status** | **HOLD**: implementation and tests complete. Live READ not yet run (credentials only in the owner's terminal); live WRITE needs explicit approval plus an owner-designated test product. No defect blocker |

## 1. Scope

**Migrated:**
- list (search, sort by product name / code, pagination);
- create (product search + channel selection);
- edit (channels only);
- delete;
- the form lookups: product search and customer-channel options.

**Not migrated:**
- **bulk delete**: the legacy list has no trigger (A1 S081, "no trigger") and the backend endpoint is unreachable (§10 F2);
- the legacy "show" route (REMOVE in A4).

## 2. Contract evidence

| Source | Files |
|---|---|
| Legacy | `start/routes.js` l.426-443; `app/Controllers/Http/ProductRestrictedController.js`; `app/Repositories/ProductRestrictedRepository.js`; `app/Mapper/ProductRestrictionMapper.js`; `resources/views/product_restrictions/{list,create,edit}.edge`; `ProductController.searchProduct`; `CustomerRepository.getChannelTypeOptions`; `Middleware/Extender.js` l.142 |
| Backend (product-service) | `handler/product_restricted.go`; `dto/product_restricted_cms.go`; `usecase/product_restricted.go`; `repository/product_restricted.go`; `mapper/product_restricted.go`; `model/product_restricted.go`; `handler/product.go` l.247-267 + `dto/product.go` l.60-99 + `repository/product.go` l.186-215 (product list); `docs/swagger.yaml` l.5693-5840 |
| Backend (account-service) | `handler/cms_customer_channel.go` l.22-60; `dto/cms_customer_channel.go` l.5-36 |

**CONTRACT_STATUS: PARTIAL.** The source is complete and consistent, and runtime is pending live READ. Implementation is safe on the documented contract.

## 3. Legacy preservation

**Domain (VERIFIED from code):**
- **"Tampilkan produk hanya untuk tipe channel …":** one record per **product**, holding a **whitelist of customer channels**.
- **Who is affected:** customers whose channel type is not listed stop seeing the product. The backend enforces this through a Redis cache read by product listing (`RemoveProductRestrictedByChannel`).
- **No** status, date range or priority.

| Behaviour | Class | New |
|---|---|---|
| List: product + channel names; search; paging; Add / Edit / Delete | MUST PRESERVE | DataTable with code, name, channel badges; search over code / name / product id |
| Create: product (select2 search) + ≥1 channel ("Product dan Customer Channel wajib diisi") | MUST PRESERVE | product search (Server Action) + radio; channel checkboxes `[aam_code] name`; same rule (client + server) |
| Edit: product fixed (display + hidden id), channels editable | MUST PRESERVE | product read-only; channels pre-checked |
| Delete with a confirm modal | MUST PRESERVE | shared confirm dialog with an impact warning |
| Create redirects to the edit page; flash messages | MAY CHANGE | redirect to the list with a `?saved=` notice |
| Default sort on the "customer_channels" column (not sortable in the backend → falls back to `created_at`) | LEGACY ONLY | explicit `created_at desc` default (same result) |
| `multidelete` form without a trigger | LEGACY ONLY | not migrated |

## 4. Backend contract

| Operation | Contract | Class |
|---|---|---|
| List | `GET /api/v1/cms/product-restricted?sort_by&asc_desc&page&take&keyword` → `{limit, page, sort, total_rows, total_pages, rows[{id, product_id, product_code, product_name, customer_channel_names[]}]}`. Sort **allowlisted** server-side (`created_at`, `product_id`, `product_name`, `product_code`); keyword: product name / code / id LIKE, or exact channel id | DOCUMENTED |
| Detail | `GET /:id` → `{id, product_id, product_name, product_code, customer_channel_ids[]}`; unknown → **404** (`ErrRecordNotFound`) | DOCUMENTED |
| Create | `POST {product_id (required), customer_channel_ids (dive,required)}` → **201** `{message}`; product already restricted → **400 "Product already restricted"** (soft-deleted rows excluded) | DOCUMENTED |
| Update | `PUT /:id {customer_channel_ids}` → 200 (the product cannot change). `Updates(rec)` on the loaded record with channels as JSON bytes, never zero-length, so the **D-A6R2-01 class does not apply** | VERIFIED (code path) |
| Delete | `DELETE /:id` → 200 (soft delete + Redis cleanup); unknown → 404 | DOCUMENTED |
| Bulk | `DELETE /bulk {ids}`: unreachable (§10 F2) | INFERRED |
| Product search | `GET /api/v1/cms/products?keyword&sort_by&asc_desc&page&take` (all required) → `{total_rows, rows[{id, code, name, …}]}`; keyword LIKE code / name / description | DOCUMENTED |
| Channel options | `GET /api/v1/cms/customer-channels?keyword&sort_by&asc_desc&page&take` → `{total_rows, rows[{id, aam_code(uint), name}]}` | DOCUMENTED |
| Errors | 400 validation `data[{FailedField, Tag, Value}]`; 400 business `{message}`; 403 (no `X-UserId`); 404; 500 `{message:"Internal Server Error"}` | DOCUMENTED |
| Authorization | backend: `X-UserId` present only, no RBAC; gateway UNKNOWN | DOCUMENTED / UNKNOWN |

## 5. Architecture

**Package `src/packages/product-restriction/`** (A6 / F30 pattern):

| Layer | Content |
|---|---|
| domain | list item / detail / inputs / lookups, `TableSpec`, zod schemas, port |
| use case | authorize → validate → **channel ids checked against the real channel list** (the backend stores any string) → port |
| repository | `dto.ts` + `GatewayProductRestrictionRepository`; lookups send fixed `sort_by=name, asc_desc=asc` (both lookup endpoints build ORDER BY unsanitized) |
| presentation | table, form (create / update modes), product picker, Server Actions |

**Routes:**
- `/dashboard/product-restriction`;
- `/dashboard/product-restriction/create`;
- `/dashboard/product-restriction/update/[id]`.

Plus menu "Pembatasan produk" in "Produk & Katalog", nav icon `ban`.

**Shared change:** `ConfirmDeleteButton` moved from F30 to `components/organisms/forms/` (second consumer); F30 only changed its import.

**Lookups:** they live in F11's repository port for now. They move to their own packages when F07 Produk and the customer module are migrated.

## 6. Authorization

| Capability | Grants |
|---|---|
| `product-restriction.read` | list, detail, channel options |
| `product-restriction.create` | create, product search |
| `product-restriction.update` | update |
| `product-restriction.delete` | delete |

- Fail-closed; no default grant (`AUTHZ_INTERIM_GRANTS` unchanged). Every Server Action goes through `runAction` → use case.
- Tests: unauthorized mutation → Forbidden with **0 gateway calls**; reader 403 on create / update without loading the item or the channels.

## 7. Automated tests (TEST_ADAPTER)

| Suite | Result |
|---|---|
| `npm run quality` | **40 files, 581 passed** (+25 F11: contract 17, pages / form 8); eslint 0 errors; tsc clean |
| `CI=1 npm run test:e2e:full` | **82 / 82** (+8 F11: menu / list / axe, search / sort / no-match, create flow + axe, duplicate product → 400 kept input, edit with fixed product + PUT body, delete, list 500, reader 403 with 0 writes / 0 detail / 0 channel calls) |
| `next build` / `check:bundle` | pass / pass. Backend paths, capability names, `customer_channel_ids`, `sort_by` in 0 client files |
| Harness self-test (local mock, **not real**) | F11 READ-only: R1–R6 pass, W0–W3 skipped (no write adapter). F11 WRITE: 1 POST / 1 PUT / 1 DELETE, each with semantic read-back. F30 regression: pass |

## 8. Live READ evidence

**NOT RUN (pending).** Run in the owner's terminal:

```bash
cd frontend
LIVE_MODULE=product-restriction npx vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts
```

It verifies:
- R1 default list;
- R2 paging;
- R3 sort `productName` / `productCode`;
- R4 search + no-match;
- R5 detail existing / unknown (404 expected);
- **R6 lookups** (channel options, product search).

## 9. Live WRITE evidence

**PENDING, not executed.** Requires:
1. Explicit approval: `MODULE_LIVE_WRITE_CONFIRM=yes`.
2. **An owner-designated test product and two channels:** `LIVE_TEST_PRODUCT_ID`, `LIVE_TEST_CHANNEL_IDS=<id1>,<id2>`. The product must have no restriction.
   - There is no inert product: while the test record exists, the product is **hidden from customers of other channel types** on that environment.
   - Without these variables the adapter has no write path.

Plan:

```text
W0 absent → CREATE {product, [ch1]} → read-back → UPDATE [ch1, ch2] → read-back → DELETE → read-back
```

Each step is one attempt with no retry. Records are identified by product id (one restriction per product).

## 10. Findings

| ID | Finding | Class |
|---|---|---|
| F1 | Domain = per-product channel whitelist enforced through a Redis cache; no status / date / priority | VERIFIED (code) |
| F2 | Backend registers `DELETE /product-restricted/:id` **before** `/bulk`, so `DELETE /bulk` is matched as `:id = "bulk"` → 404. Legacy has no bulk trigger, so bulk is not migrated | INFERRED (Fiber registration-order matching) |
| F3 | Backend accepts an empty channel list (`dive,required` without `min`), which would lift the restriction while keeping the record. Frontend requires ≥ 1 (legacy rule) | DOCUMENTED |
| F4 | Backend stores any channel id string; frontend validates ids against the channel list before mutating | DOCUMENTED |
| F5 | `/cms/products` and `/cms/customer-channels` concatenate `sort_by` / `asc_desc` into ORDER BY; F11 sends fixed values only | DOCUMENTED |
| F6 | Delete transaction returns without rollback on Update / Delete errors (same pattern as F30) | DOCUMENTED |
| F7 | Generic harness extended (generic, GET-only): modules may declare lookup `readPaths` and `lookups`, verified as R6. Needed because F11's create reads channel options first; the strict guard correctly refused it in the self-test | — |

## 11. Risks

| Risk | Mitigation / status |
|---|---|
| Live mutation changes real product visibility on devb2b | owner-designated test product / channels; one-shot; delete restores visibility |
| Runtime contract unverified (envelope, 404, lookups) | live READ |
| Customers without a channel type: the cache check uses `auth.CustomerChannelId`; behaviour for an empty channel is UNKNOWN | backend concern, unchanged by the migration |
| Detail when the product was deleted: `GetProductById` error, status UNKNOWN (404 / 500) | error state shown (ERROR ≠ EMPTY) |
| Channel list size: legacy and new load up to 1000 options; a very long checkbox list | scrollable list; revisit if live R6 shows a large count |
| Validation `data[]` not mapped to fields (same as Content R1 / F30) | client + server zod first |
| Production grants (OD-05 / 06) | fail-closed until decided |

## 12. Open questions

1. Which non-production product and channels may be used for the live WRITE test?
2. Should bulk delete exist? Legacy has no trigger and the backend route is shadowed; this is a product decision plus a backend fix.
3. The intended behaviour for customers without a channel type (backend).

## 13. Status

```text
F11 = HOLD   (live READ pending; live WRITE pending approval + test product)
→ DONE / DONE-WITH-RISKS once live READ (R1–R6) passes and the approved WRITE smoke verifies
  create / update / delete by read-back.
```
