# F27 — Verifikasi Akun Implementation Report

| Field | Value |
|---|---|
| Date | 2026-10-07 |
| Phase | Batch 4 · Phase 1 · Implementation |
| Authority | `BATCH4_SCOPE_LOCK.md` §C, `F27_CONTRACT_AUDIT.md`, `F27_ARCHITECTURE_READINESS.md` (READY FOR IMPLEMENTATION) |
| Result | **Implementation: PASS** (READ only) · **Live READ: PASS** (12 GET, 0 writes, secret scan 0) · build PASS · bundle PASS · owner full E2E and R8 pending — see §18 |

## 1. Scope

| Implemented | Not implemented (verified absent) |
|---|---|
| list, status filter, search (Cust. ID default / Email), pagination, backend-fixed order, read-only review page, CSV export of the loaded page, navigation, `account-verification.read` authorization, READ-only live adapter | approve, reject, update, register / preregister, phone approval, create, delete, role / permission management, credentials, sorting controls, XLSX, export endpoint, any write capability |

Scope scan (`grep` over the F27 package, routes and live adapter): "approve" / "reject" / "update" occur only in "CONTRACT ONLY" comments and in the `REJECTED` status value; no POST / PUT / PATCH / DELETE request exists in F27 code.

## 2. Implemented Architecture

```text
app/(dashboard)/dashboard/account-verification/{page,loading}.tsx, detail/[id]/page.tsx
  → getReadServices() / resolvePageResult()                    (shared DAL)
  → createAccountVerificationUseCases (authorize → validate → port)
  → GatewayAccountVerificationRepository ('server-only', requestEnvelope 200)
  → shared GatewayClient → account-service via gateway
```

Package `frontend/src/packages/account-verification/`:

| Layer | Files |
|---|---|
| domain | `account-verification.ts` (canonical model, TableSpec), `account-verification.schema.ts` (zod list criteria; digits-only ≤ 18 for Cust. ID), `account-verification.port.ts` (list / get only) |
| repository | `dto.ts` (zod wire schemas, wire names only here), `account-verification.repository.ts` |
| usecases | `account-verification.usecase.ts` |
| presentation | `account-verification-table.tsx`, `-detail.tsx`, `-status-badge.tsx`, `-csv.ts`, `-csv-button.tsx`, `-format.ts`, `-query.ts`, `-routes.ts`, `-rows.ts` |

Copy-adapted from the read-only list + `detail/[id]` pattern; **no import from, and no change to, F04 / order-review** (no order-review file is newer than the readiness document).

## 3. Routes

| Route | Registry id | Menu |
|---|---|---|
| `/dashboard/account-verification` | `account-verification.list` | "Verifikasi Akun", group Pengaturan, before Prinsipal, icon `user-plus` (lucide `UserPlus`) |
| `/dashboard/account-verification/detail/[id]` | `account-verification.detail` | hidden, parent = list |

## 4. Authorization

`account-verification.read` (only new capability; `capabilities.ts:89`). Enforced at: registry (`requires.capabilities`) → menu hidden; `guardRoute('account-verification.list' / '.detail')` → AccessDenied; use cases call `authorization.require(...)` **before** validation and before any repository call (fail-closed, 0 calls when denied). No backend role behaviour added or assumed.

## 5. Repository

`GatewayAccountVerificationRepository`: `list` → `GET /api/v1/cms/users/need-approvals` with `page`, `take`, `status` (`ALL` when no filter) and `search_by` + `keyword` only for a non-empty keyword; `get` → `GET /api/v1/cms/users/need-approvals/{id}`. No sort params, no identity headers. zod-validated envelope data; any mismatch → `Contract`. Gateway errors pass through unchanged (404 → `NotFound`).

Mapping: `id ""` → `userId: null`; `status` nullable enum; `aam_customer_id 0` → `null`; Go zero time → `null`; `approved_at` → `decidedAt`; `verified_by` → `decidedBy`. Detail has no `branchName` / `decidedAt`; detail with empty id → `Contract`.

## 6. Use Case

- `list(query)`: authorize → zod (`accountVerificationListQuerySchema`) → repository → **`listNotFoundMeansEmpty`** (named F27-CA-01 rule, list only): `NotFound` → `{items: [], total: 0}`. Every other error returned unchanged (`Server` never becomes empty).
- `get(id)`: authorize → id must match `/^[A-Za-z0-9-]{1,64}$/` else `NotFound` without a call → repository.

Deviation (documented): the URL parser always adds the descriptive default sort and the shared `validateTableQuery` rejects any sort when nothing is sortable, so F27 validates with its own zod schema that accepts only that default sort; it is never sent.

## 7. DAL

`composeFeatures()` gains `accountVerification: {list, get}`; `dal.test.ts` allowlist updated. No Server Actions (no mutations); CSV is built in the browser.

## 8. List

Columns (module scope, none sortable): Aksi · Status (badge) · Customer ID · Nama Relasi · Cabang · Tgl. Permintaan · Email · Nomor Telepon · **Tgl. Persetujuan/Penolakan** · Ditinjau oleh; "-" for empty; dates `Intl` id-ID, Asia/Jakarta. Loading via `loading.tsx`; empty via the shared table empty state; errors via `ErrorState`.

## 9. Search

Search-type select (Cust. ID default / Email) + keyword. Cust. ID must be digits only and ≤ 18 digits ("Customer ID harus berupa angka" / "Customer ID maksimal 18 digit"); invalid input → `Validation` without a backend call. **Accepted implementation constraint:** the message appears in the table alert because the shared toolbar has no per-field error slot. The shared select's "Semua" option falls back to Cust. ID (the table fills `searchBy=customer_id` for display). Backend 500 (F27-CA-02) stays an error; no retry, no client-side filtering (F27-CA-03).

## 10. Status Filter

Shared toolbar select (shadcn `NativeSelect`): Semua / Pending / Approved / Rejected — only the contract's values; no tabs.

## 11. Pagination

Shared `TableSpec` / URL codec: page sizes 5 / 10 / 25 / 50 / 100, default 5; `page` / `per_page` in the URL drive the backend query; no client-side pagination; empty pages and the 404 rule render the empty state.

## 12. Detail

`/dashboard/account-verification/detail/[id]`, keyed by user id; heading "Tinjau Verifikasi Akun"; read-only fields Customer ID, Nama Relasi, Tanggal Permintaan, Email, Nomor Telepon, Status Akun, Masa Berlaku Mulai / Berakhir, Ditinjau oleh. No decision date (not returned — R-09), no rejection reason, no form, only "Kembali". Unknown / malformed id → shared `notFound()`.

## 13. CSV Export

`toAccountVerificationCsv` (pure) + "Unduh Data" button: rows = the items already rendered (no fetch, no Server Action, no extra page); disabled when empty. Columns fixed (legacy 1–9): Status, Customer ID, Nama Relasi, Cabang, Tgl. Permintaan, Email, Nomor Telepon, Tgl. Persetujuan/Penolakan, Ditinjau oleh; absent values = empty fields; UTF-8 BOM; CRLF; RFC 4180 quoting; formula guard `^[=+\-@\t\r]` → leading `'`; filename `verifikasi-akun-<status|semua>-hal-<page>-<YYYYMMDD-HHmm>.csv` (ASCII, Asia/Jakarta). No dependency. Note: phone numbers starting with `+` (e.g. `+62…`) are exported with a leading `'` by the guard — intended.

## 14. Empty-ID Handling

`id ""` → `userId: null`; row kept and rendered; Aksi shows "Tinjauan tidak tersedia" (no link, no request); React key = `userId` or render-only `no-id-<absolute position>` (`presentation/account-verification-rows.ts`), never displayed, exported, navigated or used as identity; table not selectable.

## 15. Error Handling

| Case | Result |
|---|---|
| list 404 | empty state (F27-CA-01 rule, list use case only) |
| detail 404 / malformed id | shared not-found page |
| 401 | existing session hand-over |
| 403 | AccessDenied |
| 500 (incl. customer search) | ErrorState with retry; never empty |
| Contract / Network / Timeout | ErrorState |

## 16. Accessibility

Table and review page covered by axe in E2E. `REJECTED` badge uses solid destructive colours (`bg-destructive text-white`) because the tinted variant failed WCAG AA contrast — kept for accessibility over legacy visual parity. Visual parity overall: NOT VERIFIED (no legacy screenshots).

## 17. Automated Tests

| File | Tests |
|---|---|
| `src/__tests__/account-verification.contract.test.ts` | 16 |
| `src/__tests__/account-verification-pages.test.tsx` | 10 |
| `src/__tests__/account-verification-csv.test.ts` | 6 |
| `e2e/specs/account-verification.spec.ts` (+ `e2e/mock/account-verification-backend.mjs`) | 11 |
| live adapter `test/live/modules/account-verification.ts` | READ only, no `write` |

Shared test touches: `dal.test.ts` (allowlist), `e2e/specs/authorization.spec.ts` (expected menu: "Verifikasi Akun" before "Prinsipal"), `playwright.config.ts` (editor gets the capability; reader instance does not), `e2e/mock/mock-backend.mjs`, `e2e/support/fixtures.ts` (`av` stats). No existing test weakened.

## 18. Gate Results

| Gate | Result | Evidence |
|---|---|---|
| `npm run quality` | **PASS** | coordinator run 2026-10-07 23:05: 73 files, **1099 / 1099** tests, 0 TypeScript errors, 0 ESLint errors, 28 pre-existing warnings (none in F27 files) |
| `e2e:build` | **PASS** | coordinator run 23:05 (exit 0) |
| Full E2E | **171 / 172** (provisional) | coordinator run, 12.7 min, load avg ≈ 30, concurrent vitest. Sole failure `banner.spec.ts:36` (Batch 2 inline toggle; expected row order not reached in 8 s) — classified as unrelated to F27 on current evidence; not suppressed, not modified, not rerun to manufacture a green result. **Owner full E2E: PENDING OWNER RESULT** (replaces this row when supplied) |
| F27 E2E | **11 / 11 PASS** | same run |
| `npm run build` | **PASS** | owner run 2026-10-08 00:33: compiled successfully, TypeScript finished, 39/39 static pages; both F27 routes built (`/dashboard/account-verification`, `/dashboard/account-verification/detail/[id]`). Warnings only (inferred workspace root / multiple lockfiles, stale browserslist data) — pre-existing, not F27 |
| `check:bundle` | **PASS** | coordinator, on the owner's build (BUILD_ID 00:33): 75 files scanned, no server-only markers or values; F27 wire scan of `.next/static` (`need-approvals`, `total_rows`, `aam_customer_id`, `approval_request_date`, `search_by`) → 0 files |
| Live READ | **PASS** | owner terminal, 2026-10-07 16:49 UTC, GET-only script (§21); 12 GET, POST 0, PUT 0, PATCH 0, DELETE 0; secret scan 0; evidence `$TMPDIR/f27-live/evidence-20261007164914.json` |
| R8 CSV (browser) | **PENDING MANUAL BROWSER CHECK** | — |

## 19. Known Backend Findings

| Finding | Status |
|---|---|
| F27-CA-01 | OPEN — frontend compatibility rule verified |
| F27-CA-02 | LIVE CONFIRMED |
| F27-CA-03 | OPEN — not reproduced |
| F27-CA-08 | OPEN — backend/gateway role enforcement unproven |
| F27-CA-04 | OPEN — empty-ID not observed |
| R-09 | LIVE CONFIRMED |
| R-10 | OPEN — ordering not independently verifiable |
| R-11 | CLOSED |

None is fixed or worked around in the frontend.

## 20. Scope Integrity

approve / reject / update / create / delete implemented: **NO**. XLSX or new dependency: **NO** (`package.json` / `package-lock.json` last modified 2026-09-30). Backend modified: **NO**. F04 modified: **NO**. F11 W3: **NOT STARTED**. Batch 1–3 reopened: **NO**. Live calls: **12 GET** (owner live READ only); live writes: **0**.

## 21. Live READ Result and Next Step

**Live READ: PASS** — executed by the owner (2026-10-07 16:49 UTC) with the GET/HEAD-only script from `F27_MODULE_GATE.md` §13; the existing access token was supplied through `F27_LIVE_ACCESS_TOKEN` (value not recorded). 12 GET · POST 0 · PUT 0 · PATCH 0 · DELETE 0 · secret scan 0. Per-case results: `F27_MODULE_GATE.md` §12.

Remaining before the final gate: owner full E2E result; R8 manual browser check. (`npm run build` and `check:bundle`: PASS, §18.)
