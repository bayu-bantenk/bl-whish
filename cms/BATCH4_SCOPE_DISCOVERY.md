# Batch 4 — Scope Discovery & Architecture Readiness

| Field | Value |
|---|---|
| Date | 2026-10-07 |
| Type | **Discovery only** — no implementation, no application / backend change, no live call |
| Baseline | Batch 1 CONDITIONAL GO · Batch 2 CONDITIONAL GO · Batch 3 CONDITIONALLY CLOSED (`BATCH3_CLOSURE_GATE.md`) |
| Sources | legacy `gpos-b2b-cms` `00bc6ead` (2026-09-25); frontend working tree; backend clones under `~/Developments/BE` (local refs only, no fetch); gateway `endpoints.json` `fb68a8f` (2026-08-31); A4 matrix, `A4_OPEN_DECISIONS.md`, Batch 1–3 reports |

## A. Executive Summary

This is a discovery-only assessment. Nothing was implemented, no live API was called, and no file outside documentation was touched.

- **Remaining legacy surface:** 16 meaningful features (F02, F03, F05, F12, F13, F14, F15, F16, F17, F21, F22, F23, F26, F27, F29, F31). The legacy app has **no** other hidden capability (no admin roles, audit, reports or profile screen — §D).
- **Every remaining feature carries at least one of:** an open owner decision (OD-07 / 08 / 09 / 10 / 37), a backend unknown (stale clone, missing source, A2-U04), or WRITE side effects on real users, money, ERP or devices. None is a pure read-only menu screen.
- **Recommended Batch 4 (proposal):** **F27 Verifikasi Akun, F31 Manajemen Pengguna, F03 Order / Pesanan** — all MIGRATE, menu-visible, contracts VERIFIED on clones equal to `origin/development`, READ surfaces ready, WRITE surfaces known but **not live-testable** (emails, token revocation, AAM delete, ERP sync).
- **Reserve:** F05 Pembayaran (READ only, after branch parity), F22 Voucher Pengiriman (after merchant-service parity), F29 Folamil (after upload contract), F15 Mutasi & Redeem (only if OD-07 = migrate).
- **Deferred / blocked:** F26 (source absent), F17 (stale clone, missing bulk DELETE, real pushes, OD-37), F23 (CRITICAL write side effects), F12, F13, F14, F16, F21 (large / financial / OD-07 / OD-08), F02 (OD-10).
- Existing Batch 1–3 backend findings are **not** Batch 4 migration work (§M).

## B. Migration Baseline

| Batch | Modules | Gate | Carry-over (not reopened) |
|---|---|---|---|
| Foundation | F01 Login / sesi (A5.x, A6R) | live verified | A6 HOLD, D-A6R2-01 |
| Batch 1 | F20 Produk Sponsor, F24 Kode Telesales, F25 Grup Pelanggan, F32 FAQ, F32 Masukan | CONDITIONAL GO | FAQ `total_rows`; F25 live WRITE blocked (`customer_ids`) |
| Batch 2 | F07 Produk, F08 Kategori Produk, F18 Banner & Iklan, F19 Group Story, F28 Prinsipal, F30 Konfigurasi Umum | CONDITIONAL GO | B2-xx findings; F19 WRITE contract unverified |
| Batch 3 | F04 (SKIP), F10, F09, F06 | CONDITIONALLY CLOSED | B3-04, B3-13, B3-14 – B3-22 |
| Other | F11 Pembatasan Produk | migrated | W1 / W2 PASS earlier; **W3 not started** |
| Other | F32 Konten | migrated, HOLD | A6 / D-A6R2-01 |

## C. Remaining Legacy Feature Inventory

A4 counts = MIGRATE / REVIEW / REMOVE rows (A4 §2). "Menu" = `app/Middleware/Extender.js`. Legacy authorization for **every** feature is `Authorization.checkAuth` = token-expiry check only (`app/Helper/Authorization.js:4-9`); the menu is the only role gate (OD-06), so no legacy per-feature permission exists to inherit. All features are **NOT STARTED** in Next.js except F02 (partial) and F05 (registry `planned`).

| F | Legacy name / route | Menu | A4 M/R/X | Primary backend | CRUD / actions | Search / filter / sort / paging | Bulk / upload / export | Next.js status | Contract | READ | WRITE | Priority |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| F02 | Beranda `/` (`HomeController.js:4-6`) | `:78` | 1/0/0 | none (static zeros) | static | — | — | PARTIAL (`/dashboard/home` welcome) | n/a | done | n/a | OD-10 |
| F03 | Order / Pesanan `/order` (routes.js:41-45) | `:89` | 4/2/4 | order-service `handler/order.go:41-44` | list, detail (read-only), **sync-status**; update / delete / bulk have **no BE handler** | keyword + field (purchase / invoice / customer name / id), customer, dates, sort, paging | no export | NOT STARTED | VERIFIED | ready | sync PARTIAL; update / delete BLOCKED (OD-09) | **Batch 4** |
| F05 | Pembayaran `/payment` (routes.js:454-458) | `:101`, payment menu `:34` | 4/0/0 | payment-service `handler/cms.go:25-29` | list, detail, "Trigger Receipt" = **BCA manual settlement** | date range, AAM customer ids, sort, paging; no text search | no export | PARTIAL (`planned`, 404; `payment.read` defined) | PARTIALLY VERIFIED (feature-branch clone) | after parity | NOT READY | Reserve |
| F12 | Loyalty Member (routes.js:504-524) | `:153` | 13/0/6 | patient-loyalty `cms_handler/loyalty_card.go:489-506` | cards, programs CRUD, CSV template / validate (no BE call) | page / limit only | CSV, image upload | NOT STARTED | PARTIALLY VERIFIED | partial | NOT READY | Deferred |
| F13 | Pengaturan Poin (routes.js:236-292) | `:159` | 12/12/5 | loyalty `handler/cms.go:46-53` | program wizard, status, **backdated** point credit; 5 mock-ups (OD-08) | dates, status | — | NOT STARTED | PARTIALLY VERIFIED | partial | NOT READY | Deferred |
| F14 | Inject Poin (routes.js:295-319) | **hidden** (commented block `poin_voucher/list.edge:30-66`) | (7 REVIEW inside F13) | loyalty `handler/cms.go:67-70` | wizard create, delete (reversal), bulk | search | bulk | NOT STARTED | VERIFIED | ready-ish | BLOCKED | Deferred (OD-07) |
| F15 | Mutasi & Redeem (routes.js:321-333) | **hidden** | 0/3/1 | loyalty `GET /cms/loyalties/point-histories` | read-only | customer / branch, dates, DO / PO / invoice, mutation type, point types, sort, paging | export commented out | NOT STARTED | PARTIALLY VERIFIED (flags) | ready with caveats | n/a | Reserve (only if OD-07 = migrate) |
| F16 | Voucher Setting (routes.js:338-372) | **hidden** | 0/9/0 | loyalty `handler/cms.go:56-62` | wizard create / edit, active toggle | `voucher_type` only, no paging | — | NOT STARTED | PARTIALLY VERIFIED | partial | BLOCKED | Deferred (OD-07) |
| F17 | Push Notification `/notifications` (routes.js:47-55) | `:166`, marketing `:58` | 11/0/3 | notification-service `handler/push_notification.go:28-34` | CRUD, cancel, final (bug: calls cancel), bulk delete, upload; edit doubles as view | status tabs, keyword, dates, sort, paging | bulk DELETE **not in BE / gateway** | NOT STARTED | PARTIALLY VERIFIED (clone 2025-04-17) | ready (stale) | BLOCKED | Deferred |
| F21 | Gamification (routes.js:466-487) | `:190` | 20/1/1 | gamification `cms_program.go:30-50` | CRUD, duplicate, status, CSV / progress upload, history | search, period / status filter, paging | upload / download | NOT STARTED | PARTIALLY VERIFIED (gateway `vouchers` path) | partial | NOT READY | Deferred |
| F22 | Voucher Pengiriman (routes.js:491-495) | `:196` | 5/0/0 | merchant-service `handler/discount.go:28-33` | list, create, cancel (legacy uses a state-changing GET) | keyword, sort fixed `status`, paging (take ≤ 50) | — | NOT STARTED | VERIFIED on a **2024-11 clone** | ready after parity | PARTIAL (global effect) | Reserve |
| F23 | GPOS Brand `/gpos-brand` (routes.js:497-502) | `:202` | 6/0/6 | merchant-service `handler/sales_order.go:43-47` | list, detail, shipment fee, shipment detail, cancel | keyword, status, sort, paging | — | NOT STARTED | VERIFIED on a 2024-11 clone | ready after parity (count suspect) | BLOCKED | Deferred |
| F26 | Konfigurasi Channel (routes.js:535-552) | `:225` | 17/0/0 | `config_service` — **source absent**; gateway `endpoints.json:575-590` | channel CRUD, products, customer validate, export | status filter | bulk, export | NOT STARTED | **BLOCKED** | NEEDS EVIDENCE | BLOCKED | Deferred |
| F27 | Verifikasi Akun (routes.js:526-532) | `:231` | 6/0/0 | account-service `handler/cms_user.go:27-31` | list, detail (TINJAU), approve, reject, update | status tabs, search by email / customer id, paging (fixed sort `updated_at desc`) | client-side Excel export | NOT STARTED | VERIFIED | ready | NOT READY (emails) | **Batch 4** |
| F29 | Pendaftaran Folamil (routes.js:461-462) | `:243` | 2/0/0 | loyalty `handler/cms.go:43` | CSV upload → candidates | — | upload | NOT STARTED | VERIFIED | n/a | PARTIAL (upload contract) | Reserve |
| F31 | Manajemen Pengguna (routes.js:449-452) | `:255` | 4/0/6 | account-service `handler/cms_customer.go:27,31-32` | list, active toggle, delete (create / edit commented out in legacy) | search type (customer name / email), branch filter, sort, paging | client-side Excel export | NOT STARTED | VERIFIED | ready | NOT READY (token revocation, AAM delete) | **Batch 4** |

## D. Route / Screen Reconciliation

| # | Discrepancy | Evidence | Classification |
|---|---|---|---|
| D1 | `/register`, `/forgot`, `/reset` template pages exist with no legacy equivalent and sit outside the proxy matcher (`proxy.ts:70` = `/dashboard/:path*`), so they are reachable without login. On the real gateway contract (`legacy-v1`) their commands are `null` (`packages/auth/repository/dto.ts:162`) — no backend call | `app/(auth)/{register,forgot,reset}` | Template leftover, **LOW**; report only |
| D2 | `app/page.tsx` carries template metadata | `app/page.tsx:11-19` | Cosmetic leftover |
| D3 | F05 `payment.list` / `payment.detail` registered as `planned` (404), capability `payment.read` defined, no package | `registry.ts:54-71` | Partial |
| D4 | F02 `/dashboard/home` = welcome page; legacy renders static zeros | `HomeController.js:4-6` | Partial (OD-10) |
| D5 | No Next.js route for F03, F12 – F17, F21 – F23, F26, F27, F29, F31 | registry | Not migrated |
| D6 | Legacy Transaksi order Order → Order Review → Pembayaran → Inventory kept, but F03 Order missing | `Extender.js:89-110` vs `registry.ts` | Gap (F03) |
| D7 | F04 order-review routes exist in code (built before SKIP); fail-closed, no grant authorized | `F04_ORDER_REVIEW_REPORT.md` | SKIP — untouched |
| D8 | No duplicate target routes; the 18 shadowed legacy duplicates are REMOVE in A4 | A4 §1 | None |
| D9 | Legacy "My profile" link points to a non-existent `UserController.getMyProfile`; Settings / Activity / Support commented out | `layouts.edge:86-100` | Dead template links — not a capability |
| D10 | A4 notes cite OD-P1 / OD-P2 / OD-P4, which are **not defined** (map to OD-07 / OD-08 / OD-10) | A4 rows #4, #220, #234 | Documentation hygiene |

## E. A4 Classification (feature level)

| Class | Features | Basis |
|---|---|---|
| **MIGRATE** | F03 (core rows), F05, F12, F13 (non-mock-up rows), F17, F21, F22, F23, F26, F27, F29, F31 | menu-visible, A4 MIGRATE rows |
| **REVIEW** | F14, F15, F16 (hidden nav, OD-07); F13 mock-ups (OD-08); F03 update / delete / bulk (OD-09, no BE handler) | OWNER DECISION pending |
| **OWNER DECISION** | F02 content (OD-10) | static legacy view |
| **REMOVE** | A4 REMOVE rows only (duplicates, dead routes, e.g. F15 `search`, F31 commented create / edit / multidelete) | A4 matrix |
| **SKIP** | F04 Order Review | owner decision (Batch 3) |

No feature is proposed for REMOVE as a whole: none has evidence of being obsolete.

## F. Backend Contract Matrix (serious candidates)

| | F27 Verifikasi Akun | F31 Manajemen Pengguna | F03 Order / Pesanan | F05 Pembayaran |
|---|---|---|---|---|
| Clone | account-service `3001bc0` (2026-09-11) = `origin/development` | same | order-service `29a420d` (2026-08-13) = `origin/development` | payment-service `68d5d73` (2026-08-27), **feature branch** `MPGGPO-S-23-…` |
| List | GET `/cms/users/need-approvals` (`handler/cms_user.go:27`) — page, take, status, search_by email / customer_id, keyword; response `{total_rows, rows}`; sort fixed `updated_at DESC`; count filtered (`repository/user.go:337-351`) | GET `/cms/customers/users` — sort_by, asc_desc, search type, filters (concatenated, capitalised columns), paging; count filtered; feature flags change base set (`repository/buyer.go:185-207`) | GET `/cms/orders` — sort_by, asc_desc, page, take, keyword, filter, customer_ids, dates; `global.Pagination` envelope (`dto/order.go:509-519`) | GET `/cms/payments` — start / end date, aam_customer_ids, sort_by, asc_desc, page, take (`dto/cms.go:32-40`); count filtered |
| Detail | GET `/cms/users/need-approvals/:id` (TINJAU modal) | none (legacy list only) | GET `/cms/orders/:id`; any error → 404 (`repository/order.go:112-120`) | GET `/cms/payments/:id`; any DB error → 404 |
| Writes | POST `…/need-approvals/:id/approve` `{active_start_at, active_end_at}`, POST `…/:id/reject`, PUT `…/:id` `{id, active_end_at}` (`handler/cms_user.go:29-31`; `dto/cms_user.go:37-120`) | `PUT /cms/customers/users/:id/status {is_active}`, `DELETE /cms/customers/users/:id` (`handler/cms_customer.go:31-32`) | `PUT /cms/orders/:id/sync-status` | `POST /cms/payments/bca-manual-settlements {id, date}` |
| Search semantics | email LIKE; non-numeric customer_id → **500**; **empty result → 404** (`usecase/cms_user.go:405-407`) — VERIFIED | concatenated filter / sort → allowlist required | keyword → `id = ?` when no field; **only first customer id used** (`repository/order.go:234`); **silent 1-year cap** (`:246`); Find / Count errors ignored; count after Limit / Offset on the same chain — total correctness NEEDS EVIDENCE | no text search |
| Sort | fixed | concatenated → allowlist | concatenated (`repository/order.go:247`) → allowlist | concatenated (`repository/payment.go:91`) → allowlist |
| Auth | `X-UserId` header presence; no role check (A2-U04) | same | same (`helper/auth.go:17-23`) | same (`helper/auth.go:13-18`) |
| Lookups | none | branch / area picker (F25 pattern) | customer picker (F18 / F25 `cust-id`) | AAM customer id picker (`/banner/aam-cust-id`) |
| Gateway | `endpoints.json:67-71` | `:42-44` | `:311-313` | `:414-416` |
| Write side effects | approve → activation email; reject renames email `REJECTED-<ts>-…` + rejection email (`usecase/cms_user.go:~570, 600-633`) | deactivate **revokes all tokens** (`usecase/cms_customer.go:139-170`); delete removes user in **AAM** with restore on failure (`:99-136`) | AAM `/internal/aam/sync-order-status` → ERP read, **bulk-creates invoices in payment-service**, updates order status | sets payment **PAID**, AAM settlement, loyalty + settlement messages, email (`usecase/cms.go:90-121`, `notification.go:256, 323, 337, 357`); nil `Bank` panics; legacy shows success without checking (`PaymentController.js:57-61`) |
| Live READ | **NOT YET VERIFIED** | NOT YET VERIFIED | NOT YET VERIFIED | NOT YET VERIFIED |

Other features: contracts summarised in §C; not detailed here because they are not proposed for Batch 4.

## G. READ / WRITE Readiness Matrix

WRITE READY requires: request contract, authorization, mutation semantics, success response, readback, fixture strategy and cleanup / revert strategy all known.

| F | READ | WRITE | Missing for WRITE READY |
|---|---|---|---|
| F27 | READY (contract VERIFIED; live NOT YET VERIFIED) | NOT READY | fixture (a pending test account), cleanup (reject is irreversible: email renamed), email side effect, A2-U04 |
| F31 | READY (live NOT YET VERIFIED) | NOT READY | fixture account, cleanup (delete in AAM, token revocation), A2-U04 |
| F03 | READY (total correctness NEEDS EVIDENCE) | NOT READY (sync); update / delete BLOCKED (no BE handler, OD-09) | fixture order with `orig_sys`, invoice side effects in payment-service, no revert |
| F05 | READY after branch parity (NEEDS EVIDENCE) | NOT READY | financial settlement, AAM post, no revert, OD-06 |
| F22 | READY after merchant-service parity | NOT READY | single global active voucher affects all buyers; cleanup only by cancel |
| F23 | READY after parity (count after Limit — NEEDS EVIDENCE) | NOT READY | buyer WhatsApp, merchant push, auto-cancel, quota restore, no status guard |
| F15 | READY with caveats (OD-07) | n/a | — |
| F29 | n/a | NOT READY | upload contract (A5.6) |
| F17 | READY on stale clone | NOT READY | bulk DELETE missing, real device pushes, OD-37 |
| F26 | NEEDS EVIDENCE | BLOCKED | backend source |
| F12, F13, F14, F16, F21 | PARTIAL | NOT READY / BLOCKED | OD-07 / OD-08, financial semantics, gateway path ambiguity |

## H. Dependency Matrix

| Feature | Dependency | Readiness | Note |
|---|---|---|---|
| F27 | auth / session, authorization foundation | READY | new capabilities needed (read vs approve / reject / update) |
| F27 | gateway role enforcement (A2-U04) | UNKNOWN | affects every CMS module equally; not F27-specific |
| F31 | branch / area picker | READY | F25 pattern (Batch 1) |
| F31 | account-service flags (base set) | CONDITIONAL | runtime flags NEEDS EVIDENCE |
| F03 | customer picker | READY | F18 / F25 `cust-id` pattern |
| F03 | AAM service (sync) | CONDITIONAL | AAM clone on a feature branch; sync = external ERP |
| F03 | payment-service invoices (sync side effect) | CONDITIONAL | financial |
| F05 | payment-service branch parity | UNKNOWN | clone not on `development` |
| F05 | OD-06 payment account menu | UNKNOWN | owner decision |
| F22, F23 | merchant-service parity | UNKNOWN | clone 2024-11-19 |
| F23 | F22 voucher quota, GPOS Lite, notifications | CONDITIONAL | cross-module side effects |
| F17 | notification-service parity, OD-37, upload | UNKNOWN / CONDITIONAL | clone 2025-04-17 |
| F26 | config_service source | BLOCKED | not in workspace |
| F15 | order-service (invoice / PO / DO filters), account customer list | READY / CONDITIONAL | OD-07 first |
| F29 | signed-URL upload (`packages/files`) | CONDITIONAL | F29 needs its own purpose / category |
| all | Batch 2 / 3 open findings | not a dependency | no Batch 4 candidate reads B3-04 / B3-13 / F06 endpoints |

Cross-cutting backend observation (NEEDS BACKEND CONFIRMATION, not a Batch 4 task): the gateway auth plugin deletes only `X-UserId` before *adding* identity headers (`auth-plugin.go:72` vs `:138-147`), so client-supplied `X-Username` / `X-UserEmail` / `X-RoleName` copies are not stripped. The new frontend never sends them.

## I. Complexity & Risk

| F | Size | READ risk | WRITE risk | Main risk drivers |
|---|---|---|---|---|
| F27 | M | MEDIUM | HIGH | 404-on-empty and 500 on bad customer id; emails to real users; irreversible reject |
| F31 | M | MEDIUM | HIGH | concatenated sort / filter; token revocation; AAM delete |
| F03 | M | MEDIUM | HIGH | concatenated sort; ignored errors; 1-year cap; first-customer-only; ERP / invoice sync |
| F05 | M | MEDIUM | CRITICAL | financial settlement; branch parity |
| F22 | S–M | MEDIUM | HIGH | global shipping discount; stale clone |
| F23 | L | MEDIUM | CRITICAL | buyer WhatsApp, merchant push, no status guard |
| F15 | S–M | MEDIUM | n/a | end-date filter bug, keyword ignored, flags; OD-07 |
| F29 | S | n/a | HIGH | bulk enrolment from CSV |
| F17 | L | MEDIUM | HIGH | real device pushes, stale clone, missing bulk DELETE |
| F12 | L | MEDIUM | HIGH | identity headers, card by code vs id |
| F13 | XL | MEDIUM | CRITICAL | retroactive point credit, wizard, mock-ups |
| F14 | M | LOW | CRITICAL | point credit / reversal, no idempotency, negative deltas |
| F16 | M | MEDIUM | HIGH | e-wallet redemption catalog |
| F21 | XL | MEDIUM | HIGH | gateway path ambiguity, uploads, rewards |
| F26 | XL | HIGH | HIGH | no backend source |
| F02 | S | LOW | n/a | OD-10 |

## J. Recommended Batch 4 Scope

**Proposal (no implementation authorized by this document):**

| # | Feature | Why | Conditions |
|---|---|---|---|
| 1 | **F27 Verifikasi Akun** | MIGRATE 6/0/0, menu-visible; contract VERIFIED on a clone equal to `origin/development`; no lookup dependency; READ quirks known (404-on-empty, 500 on bad id) | approve / reject / update stay mock-tested only; live WRITE needs a test-account plan |
| 2 | **F31 Manajemen Pengguna** | MIGRATE 4/0/6; contract VERIFIED (same service); reuses the F25 branch picker; legacy surface already small (list + toggle + delete) | toggle / delete mock-tested only (token revocation, AAM delete) |
| 3 | **F03 Order / Pesanan** | MIGRATE 4/2/4; completes the Transaksi menu gap (D6); contract VERIFIED on `origin/development`; reuses customer picker | update / delete / bulk excluded (no BE handler; OD-09 to confirm); sync-status mock-tested only (ERP + invoices); total-count behaviour to be proven by live READ |

**Coherence:** two account-service modules plus one order-service module, all on fresh clones, all reusing existing pickers and the DAL / table / form foundation; no dependency on Batch 2 / 3 open findings.

**Gate expectation:** at best CONDITIONAL GO per module — every write carries real-world side effects and live WRITE is not authorized.

## K. Reserve Candidates

| Feature | Precondition |
|---|---|
| F05 Pembayaran | payment-service `cms.go` parity on `development` confirmed; OD-06 decided; settlement write treated as financial (no live WRITE) |
| F22 Voucher Pengiriman | merchant-service clone refreshed and contract re-verified |
| F29 Pendaftaran Folamil | upload purpose / category and CSV contract confirmed |
| F15 Mutasi & Redeem | OD-07 = migrate; backend end-date bug and ignored keyword documented |

## L. Deferred / Needs Evidence

| Feature | Reason | Label |
|---|---|---|
| F26 Konfigurasi Channel | `config_service` source absent | BLOCKED |
| F17 Push Notification | clone 2025-04-17; bulk DELETE missing in BE / gateway; real pushes; OD-37 | NEEDS EVIDENCE |
| F23 GPOS Brand | CRITICAL write side effects; stale clone; count after Limit | NEEDS EVIDENCE |
| F13 Pengaturan Poin | XL wizard; backdated credit; OD-08 mock-ups | OWNER DECISION |
| F14 Inject Poin, F16 Voucher Setting | hidden nav; OD-07; financial | OWNER DECISION |
| F12 Loyalty Member | identity headers; card code vs id | PARTIALLY VERIFIED |
| F21 Gamification | gateway `programs/vouchers` routing ambiguity; uploads | PARTIALLY VERIFIED |
| F02 Beranda | real metrics need OD-10 + a metrics API | OWNER DECISION |
| Cross-cutting | A2-U04 gateway role enforcement; gateway identity-header stripping | NEEDS BACKEND CONFIRMATION |

Correction to historical evidence (recorded here, `BATCH3_SCOPE_DISCOVERY.md` unchanged): GOPH-4102 (F14 inject-point customer fix) is effectively merged on loyalty-service `development` (squash `cd34eba`, later `abc442b`; `repository/user_point.go:161-167`). The loyalty clone is 6 commits behind `origin/development`, but CMS handler / DTO / repository files are unchanged in that range.

## M. Explicit Exclusions

- **F04 Order Review — SKIP.** Not migrated further, no placeholder, no grant for `order-review.read`.
- **F11 W3 — not authorized / not started.** F11 is an existing migration surface awaiting future authorized write validation, not Batch 4 work.
- **Batch 3 deferred backend defects** (B3-04, B3-13, B3-14 – B3-22) and Batch 1 / 2 findings — **not reopened as migration work**; they remain backend dependencies.
- **F06 stock bulk delete** — stays in F06 scope (owner-verified); not affected.
- **Live WRITE for any module**, including Batch 4 candidates.
- **F03 update / delete / bulk** (no backend handler), **F17 bulk delete** (no backend handler), **F26** (no source).
- Template leftovers (D1, D2) — reported, not fixed in this discovery.
- Visual parity: **NOT VERIFIED** for every candidate (no screenshots).

## N. Proposed Execution Order (proposal only)

1. **F27 Verifikasi Akun** — no lookup dependency; establishes the account-service read path and the 404-on-empty handling.
2. **F31 Manajemen Pengguna** — same service; adds the branch picker and allowlisted filters.
3. **F03 Order / Pesanan** — cross-service (customer picker, AAM sync); completes the Transaksi menu.

Before implementation starts: owner confirmation of this scope, of OD-09 (F03 update / delete stay out), and of the WRITE policy for F27 / F31 / F03 (mock-tested only, no live WRITE). Live READ for each module is run by the owner, as in Batches 1–3.
