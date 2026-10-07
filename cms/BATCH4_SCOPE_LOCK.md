# Batch 4 — Scope Lock

| Field | Value |
|---|---|
| Date | 2026-10-07 |
| Type | Scope governance + architecture contract. **No implementation authorized by this document.** |
| Inputs | `BATCH4_SCOPE_DISCOVERY.md` (canonical discovery), `BATCH3_CLOSURE_GATE.md`, `BATCH3_SCOPE_DISCOVERY.md` (historical), `summary.md`, `claude-summary.md`; additional source checks listed in §C–§E |
| Status | **BATCH 4 SCOPE LOCKED — IMPLEMENTATION NOT STARTED** |

## A. Scope Decision

**BATCH 4 SCOPE LOCKED.**

Batch 4 contains exactly three features: **F27 Verifikasi Akun, F31 Manajemen Pengguna, F03 Order / Pesanan.** Every other feature is out. This lock is a boundary, not a start signal: each feature still needs its own go-ahead and passes its own gates (§K).

## B. Locked Features

| Feature | Scope | Status |
|---|---|---|
| F27 | Verifikasi Akun | IN |
| F31 | Manajemen Pengguna | IN |
| F03 | Order / Pesanan | IN / CONSTRAINED |

## C. F27 Scope Boundary — Verifikasi Akun

Backend: account-service `3001bc0` (= `origin/development`, 2026-09-11). Gateway `endpoints.json:67-71`.

| | Item | Contract evidence |
|---|---|---|
| **IN (READ)** | List of accounts needing approval | GET `/api/v1/cms/users/need-approvals` (`handler/cms_user.go:27`) |
| IN | Pagination | `page`, `take` (`dto/cms_user.go`) |
| IN | Status filter | ALL / PENDING / APPROVED / REJECTED (legacy `UserVerificationMapper.js:54-97`) |
| IN | Search | `search_by` email \| customer_id + keyword; email = LIKE; non-numeric customer_id → **500** (`usecase/cms_user.go:358-361`) — frontend must validate before calling |
| IN | Sorting | **none** — backend sort is fixed `updated_at DESC` (`repository/user.go:337-351`); no sort controls |
| IN | Detail / review (TINJAU) | GET `/api/v1/cms/users/need-approvals/:id` (`handler/cms_user.go:28`) |
| IN | Status / account information display | fields from the verified DTOs only |
| IN | Empty result | backend answers **404** for an empty list (`usecase/cms_user.go:405-407`) — must render as an empty state, not an error (no data fabrication) |
| **IN (contract level only)** | Approve | POST `…/need-approvals/:id/approve` `{active_start_at, active_end_at}` — sends an activation email |
| IN (contract level only) | Reject | POST `…/need-approvals/:id/reject` — renames the email to `REJECTED-<ts>-…` and queues a rejection email; **irreversible** (`usecase/cms_user.go:600-633`) |
| IN (contract level only) | Update | PUT `…/need-approvals/:id` `{id, active_end_at}` |
| **OUT** | Live WRITE of any kind (approve, reject, update, status mutation) | — |
| OUT | Destructive operations; unrelated account management (registration `POST /cms/users/register`, phone approvals `…/phone-approvals`) | not part of the legacy F27 screen |
| OUT | Client-side Excel export | NEEDS OWNER DECISION before it can enter scope (legacy DataTables button, `list.edge:238`) |

**F27 WRITE policy: DEFERRED / AUTHORIZATION REQUIRED.** Approve / reject / update are documented at contract level only. Implementing their UI and actions requires a separate WRITE gate approval (verified request contract, authorization, response semantics, test strategy, explicit authorization). Until then the F27 slice is READ-only.

## D. F31 Scope Boundary — Manajemen Pengguna

Backend: account-service `3001bc0`. Gateway `endpoints.json:42-44`.

| | Item | Contract evidence |
|---|---|---|
| **IN (READ)** | User list (one row per user) | GET `/api/v1/cms/customers/users` (`handler/cms_customer.go:27`); row = `CmsCustomerUserResponse` (`dto/cms_customer.go:25-46`, mapper `mapper/cms_customer.go:113-133`) |
| IN | Pagination | `page`, `take`; response `{total_rows, rows}` (`dto/cms_customer.go:58-61`) |
| IN | Search / filter | search type customer name / user email; branch (area) filter (legacy `UserManagementMapper.js:5-28`) — values concatenated into SQL → **allowlist** columns |
| IN | Sorting | where legacy exposes it; `sort_by` concatenated → **allowlist** only |
| IN | Active / inactive state display | `user_activation` |
| **NEEDS EVIDENCE** | User detail | **no detail endpoint exists** (`handler/cms_customer.go` has list, DELETE and PUT status only) and the legacy screen has none. A "detail" may only show fields already in the verified list row; no new endpoint may be assumed |
| **NOT SUPPORTED** | Role / permission display | the verified response has **no role or permission field**; not displayed |
| Known data gap | `user_last_order` | always `null` (`mapper/cms_customer.go:131`) — show as empty, no fabrication |
| **IN (contract level only)** | Active toggle | PUT `/api/v1/cms/customers/users/:id/status {is_active}` (`handler/cms_customer.go:32`) — deactivation **revokes all live tokens** (`usecase/cms_customer.go:139-170`) |
| IN (contract level only) | Delete | DELETE `/api/v1/cms/customers/users/:id` (`:31`) — removes the user in **AAM**, with restore on failure (`usecase/cms_customer.go:99-136`) |
| **OUT** | Live activation / deactivation / deletion | — |
| OUT | Role mutation, permission mutation, password reset, credential mutation | no such legacy F31 capability |
| OUT | Create / edit user, multidelete | commented out in legacy (`UserManagementController.js:52-147`; A4 REMOVE rows) |
| OUT | Unrelated authentication administration | — |
| OUT | Client-side Excel export | NEEDS OWNER DECISION (legacy `list.edge:160`) |

**F31 WRITE policy: NO LIVE WRITE.** Toggle and delete are contract / design level. Implementing them requires: verified API contract (done at source level), authorization evidence, automated test coverage and **explicit WRITE authorization** through a separate gate.

Runtime note: feature flags change the base set (active-only, `approval_status IS NULL`) (`repository/buyer.go:185-207`) — live READ must record which rows appear; flag values are NEEDS EVIDENCE.

## E. F03 Scope Boundary — Order / Pesanan

Backend: order-service `29a420d` (= `origin/development`, 2026-08-13). Gateway `endpoints.json:311-313`.

| | Item | Contract evidence |
|---|---|---|
| **IN (READ)** | Order list | GET `/api/v1/cms/orders` (`handler/order.go:41`); params `sort_by, asc_desc, page, take, keyword, filter, customer_ids`, dates (`dto/order.go:509-519`); `global.Pagination` envelope |
| IN | Search | keyword with field `purchase_no` / `invoice_no` / `customer_name`; with no field the keyword matches `id = ?` (`repository/order.go:220-231`) |
| IN | Filter | customer (only the **first** id is applied — `:234`), purchase-date range (`:239-244`) |
| IN | Sort | concatenated (`:247`) → **allowlist** of legacy columns only |
| IN | Pagination | `page`, `take` (legacy page sizes; never unbounded) |
| IN | Order detail (read-only) | GET `/api/v1/cms/orders/:id` (`handler/order.go:42`); any error → 404 (`repository/order.go:112-120`) |
| IN | Loading / empty / error / success states | — |
| **Known backend behaviour (documented, no workaround)** | results silently limited to the last year (`:246`); Find / Count errors ignored (bad query → empty 200); `total_rows` correctness — **NEEDS EVIDENCE** (count runs on the same chain after Find, `:247-248`); `Filter` has no `query:` tag (`dto/order.go:518`) — binding NEEDS EVIDENCE | |
| **CONSTRAINED** | `sync-status` | PUT `/api/v1/cms/orders/:id/sync-status` (`handler/order.go:43`) → AAM `/internal/aam/sync-order-status` → reads the ERP, **bulk-creates invoices in payment-service** and **updates order status**. Classified as a **MUTATION / INTEGRATION ACTION**, not a READ. Mock / contract-level implementation is acceptable for deterministic tests; **live execution is NOT authorized** and needs a dedicated authorization gate |
| **OUT OF BATCH 4 SCOPE** | Order update, delete, bulk delete | legacy repository calls them (`OrderRepository.js:16-36`) but **no backend handler exists**; OD-09 |
| OUT OF BATCH 4 SCOPE | Order cancellation, order creation, invoice / payment mutation, AAM mutation, external fulfillment mutation | — |
| OUT OF BATCH 4 SCOPE | `POST /cms/orders/gamifications/process` (`handler/order.go:44`) | not a legacy F03 screen action |
| OUT OF BATCH 4 SCOPE | Any unverified or undocumented order action; any new business workflow | — |

## F. Exclusions

Outside Batch 4 (not authorized for implementation):

| Feature | Reason |
|---|---|
| F02 Beranda | OD-10 |
| F04 Order Review | **SKIP / INACTIVE** — not reopened, no placeholder, no `order-review.read` grant, not refactored, not a dependency; existing code untouched |
| F05 Pembayaran | reserve; branch parity; financial settlement write |
| F11 Pembatasan Produk | existing migration surface; W1 / W2 PASS earlier; **W3 not started and not authorized** by this lock |
| F12, F13, F14, F15, F16, F21 | loyalty / points / gamification; OD-07 / OD-08; financial |
| F17 Push Notification | stale clone, missing bulk DELETE, real pushes, OD-37 |
| F22, F23 | merchant-service clone stale; F23 CRITICAL writes |
| F26 Konfigurasi Channel | backend source absent |
| F29 Pendaftaran Folamil | upload contract |
| Batch 1 (F20, F24, F25, F32), Batch 2 (F07, F08, F18, F19, F28, F30), Batch 3 (F06, F09, F10) | already migrated; not reopened |
| Batch 3 backend findings B3-04, B3-13, B3-14 – B3-22 and Batch 1 / 2 findings | deferred backend work, not Batch 4 migration work |

## G. Dependency Boundary

| Feature | Dependency | Readiness | Unresolved finding | Blocking? |
|---|---|---|---|---|
| F27 | auth / session, DAL, authorization foundation | READY | — | no |
| F27 | new capabilities (READ vs approve / reject / update) | to define in implementation | — | no |
| F27 | gateway role enforcement (A2-U04) | UNKNOWN | A2-U04 (cross-cutting) | no for READ; relevant to any future WRITE gate |
| F31 | branch / area picker (F25 pattern) | READY | — | no |
| F31 | account-service feature flags (base set) | CONDITIONAL | runtime flags NEEDS EVIDENCE | no |
| F31 | A2-U04 | UNKNOWN | cross-cutting | no for READ |
| F03 | customer picker (F18 / F25 pattern) | READY | — | no |
| F03 | AAM service, payment-service (sync side effects) | CONDITIONAL (AAM clone on a feature branch) | — | blocking for **live** sync only |
| F03 | `total_rows` behaviour | NEEDS EVIDENCE | to be shown by live READ | no (document if wrong) |
| all | Batch 3 findings (B3-04, B3-13, B3-14 – B3-22) | — | **no Batch 4 feature calls the endpoints they concern** | no |
| all | gateway identity-header stripping (`auth-plugin.go:72` vs `:138-147`) | NEEDS BACKEND CONFIRMATION | cross-cutting | no; frontend never sends identity headers |

## H. WRITE Authorization Boundary

**Batch 4 scope lock does NOT authorize live WRITE.**

- Batch 4 starts with **LIVE WRITE = DISABLED**.
- Every mutation (F27 approve / reject / update, F31 toggle / delete, F03 sync-status) requires its own authorization gate with: explicit authorization; exact fixture; exact endpoint; expected mutation count; readback verification; cleanup / revert strategy; secret scan; evidence report.
- No implicit WRITE permission exists. Login / logout are not business mutations.
- F03 special safety: sync, invoice, payment, AAM and fulfillment are treated as side-effecting unless proven otherwise; no request is assumed harmless because of its HTTP method. If side effects cannot be ruled out: **do not execute live**.

## I. Test Boundary

Each feature must eventually have:

- contract tests (wire mapping, allowlisted sort, malformed ids without calls, Contract errors on bad shapes);
- use-case tests (authorization first, validation);
- page / component tests where appropriate;
- E2E tests against the mock backend;
- regression coverage (full `npm run quality` and E2E suite; no existing test weakened);
- live READ evidence (run by the owner; mutations 0; secret scan 0).

WRITE tests are separated from READ tests (separate describe blocks / capabilities; live write adapters absent unless a WRITE gate authorizes them).

## J. Architecture Boundary

```text
Page / Server Action
        ↓
DAL
        ↓
Use Case
        ↓
Repository Port
        ↓
Repository
        ↓
Shared Gateway
        ↓
Backend API
```

- Do not bypass DAL, use-case layer, repository port or shared gateway.
- No feature-specific HTTP client; no second gateway, DAL, auth / session handling, authorization framework or generic CRUD framework.
- Backend wire DTOs live only in `repository/dto.ts`; UI and domain never see wire names.
- Stack: Next.js 16.x, TypeScript, hexagonal architecture, atomic design, Tailwind CSS, shadcn/ui, TanStack Table where appropriate.
- Forbidden: Bootstrap, jQuery, Adonis UI components, copied legacy components, `legacy/`, `migration/` or `adonis/` folders under `frontend/src`, any new framework.
- **Contract-first:** verify backend contract → canonical DTO → domain / use-case boundary → repository port → wire mapping inside the repository → authorization → tests → UI. If a contract is ambiguous: **STOP THAT SLICE** and record **NEEDS EVIDENCE**.
- **Copy-adapt-first:** copy-adapt → verify repetition → abstract. No generic CRUD engine for F27 / F31 / F03.

## K. Implementation Order and Gates

| Phase | Feature | Reason |
|---|---|---|
| 1 | **F27 Verifikasi Akun** | contained domain; establishes status / review surface patterns; no lookup dependency |
| 2 | **F31 Manajemen Pengguna** | same identity / admin domain and service; reuses F27 patterns plus the branch picker |
| 3 | **F03 Order / Pesanan** | broader dependency surface; stricter READ / side-effect boundary; benefits from proven Batch 4 patterns |

This order is an execution recommendation, not permission to implement all three immediately.

Each feature independently passes:

```text
Contract Audit → Architecture Readiness → Domain / Use Case → Repository / Gateway
→ Authorization → UI → Automated Tests → Live READ → Module Gate
```

One feature passing does not complete Batch 4.

## L. Batch 4 Closure Condition

Batch 4 closes only after: F27, F31 and F03 module gates pass; automated tests pass; live READ evidence exists for applicable surfaces; no unauthorized live mutation occurred; open backend findings are documented; architecture checks pass; a final Batch 4 closure gate is produced. CONDITIONAL GO remains acceptable where backend dependencies remain.

## M. Changes vs Discovery

The lock narrows the discovery proposal; it does not override verified findings.

| Topic | Discovery | Lock |
|---|---|---|
| F27 / F31 writes | "mock-tested only" | stricter: contract / design level only; implementation needs a WRITE gate |
| F31 detail | not listed | NEEDS EVIDENCE — no detail endpoint |
| F31 role / permission display | not listed | NOT SUPPORTED by the verified contract |
| F03 sync-status | mock-tested only | unchanged: constrained mutation / integration action, mock-level allowed, no live |
| Exports (F27 / F31) | client-side, part of the feature | NEEDS OWNER DECISION |
