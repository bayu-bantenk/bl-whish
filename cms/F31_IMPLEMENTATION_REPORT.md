# F31 — Manajemen Pengguna Implementation Report

| Field | Value |
|---|---|
| Date | 2026-10-09 |
| Phase | Batch 4 · Phase 2 · Frontend implementation (READ-only) |
| Authority | `F31_PRAGMATIC_MIGRATION_READINESS.md` (READY WITH DOCUMENTED GAPS), `F31_ARCHITECTURE_READINESS.md` §5–§14 (design), `F31_BACKEND_COMPATIBILITY_GAPS.md` |
| Re-confirmed | 2026-10-09 10:04 WIB: no application file changed since the gate runs (09:18–09:21); the results below remain current |
| Result | **Implementation: PASS (READ-only)**: quality, build, client bundle PASS; F31 E2E 10 / 10 (isolated run). **Live READ: NOT PERFORMED.** Module gate: see `F31_MODULE_GATE.md` |
| Backend | `origin/development` `c712ba6`. The SQL-injection remediation is **not merged**; backend findings F31-CA-01 / CA-02 / CA-04 remain **open** |

## 1. Scope

| Implemented | Not implemented |
|---|---|
| user list; search (Nama Relasi = `customer.name` default, Email = `user.email`); multi-select branch filter; pagination 15 / 25 / 50 / 100 (default 15); fixed sort `aam_customer_id desc`; active / inactive badge from `user_activation`; loading, empty, error + retry states; completeness note | detail page / dialog; status filter; sort controls; export; create / edit / delete / toggle / bulk; any write capability; legacy "All" branch option and "All" page size |

## 2. Files

**New** (`frontend/`):
- `src/packages/user-management/`:
  - `domain/`: `user-management.ts`, `user-management.schema.ts`, `user-management.port.ts` (list + branch options only).
  - `repository/`: `dto.ts` (zod, wire names only here), `user-management.repository.ts` (`'server-only'`).
  - `usecases/user-management.usecase.ts`.
  - `presentation/`: `-table.tsx`, `-branch-filter.tsx`, `-status-badge.tsx`, `-branches.ts`, `-format.ts`, `-query.ts`, `-routes.ts`, `-rows.ts`.
- Route: `src/app/(dashboard)/dashboard/user-management/page.tsx`, `loading.tsx`.
- Tests: `src/__tests__/user-management.contract.test.ts` (18), `src/__tests__/user-management-pages.test.tsx` (10).
- E2E: `e2e/mock/user-management-backend.mjs`, `e2e/specs/user-management.spec.ts` (10).
- Live adapter: `test/live/modules/user-management.ts` (READ-only, no `write`).

**Shared touch points (on the approved list):**
- `capabilities.ts`: `user-management.read`.
- `navigation/registry.ts`: `user-management.list`, group Pengaturan, after Konfigurasi Umum.
- `navigation/types.ts`, `nav-icon.tsx`: key `user` → lucide `User`.
- `server-container.ts`, `dal.test.ts`: `userManagement`.
- `playwright.config.ts`: editor instance granted; reader instance not.
- `e2e/specs/authorization.spec.ts`: expected menu.
- `e2e/mock/mock-backend.mjs`, `e2e/support/fixtures.ts`: `um` stats.
- `test/live/modules/index.ts`.

**Shared touch point NOT on the approved list (deviation, kept):**
- **File:** `src/shared/table/url-codec.ts` `toTableSearchParams`.
- **Change:** array filters are now written as repeated params (2 lines). Without it, any page, page-size or search change dropped the branch selection.
- **Other modules unaffected:** every other module only produces string filters, so their URLs are unchanged.
- **Evidence:** F31 E2E (`user-management.spec.ts:78`, lines 92-95) shows both branches persist across a page change.
- **Test coverage:** covered at unit level **indirectly** by `user-management.contract.test.ts:154` (via `userManagementSearchParams` → `toTableSearchParams`) and by E2E (`user-management.spec.ts:78`); there is no dedicated case in `url-codec.test.ts` (correction of an earlier "no unit test" statement).

`package.json` and `package-lock.json` are unchanged (last modified 2026-09-30). No backend file was touched.

## 3. Architecture

```text
page.tsx (guardRoute 'user-management.list')
  → getReadServices()                                  shared DAL
  → userManagement.list(query) / branchOptions()       use case: authorization.require('user-management.read') → zod → port
  → GatewayUserManagementRepository ('server-only')    requestEnvelope(gateway, req, 200)
  → shared GatewayClient → GET /api/v1/cms/customers/users, GET /api/v1/cms/customer-areas
```

No new HTTP client, gateway, DAL, auth, pagination or table framework. The branch control reuses `components/molecules/multiple-selector` in `ServerDataTable` `toolbarActions`.

## 4. API Parameters (as sent)

**`GET /api/v1/cms/customers/users`** (`repository/dto.ts` `toListParams`):

| Param | Value |
|---|---|
| `search_by` | `customer.name` \| `user.email` (constant map from the UI value `name` \| `email`) |
| `keyword` | trimmed search |
| `sort_by` / `asc_desc` | constants `aam_customer_id` / `desc` |
| `page` / `take` | string integers; `take` ∈ {15, 25, 50, 100} |
| `filters[0][column]` / `[opr]` / `[value]` | **only when ≥ 1 valid UUID is selected**: constants `customer_area_id` / `IN`; value = `"id1","id2"` (double-quoted, comma-joined) |

Branch ids:
- The URL parser and the schema both drop non-UUID ids, so values such as `ALL` or `") OR 1=1 --` are never sent.
- More than 50 valid ids → `Validation` error ("Maksimal 50 cabang dapat dipilih") with 0 calls; the UI caps the selection at 50.

**`GET /api/v1/cms/customer-areas`:** constants `keyword=''`, `sort_by=name`, `asc_desc=asc`, `page=1`, `take=1000`.

## 5. DTO

`UserManagementRow`:

| Field | Source | Note |
|---|---|---|
| `userId` | `user_id`, nullable | row key; null → render-only position key |
| `isActive` | `user_activation` | required bool |
| `aamCustomerId` | `aam_customer_id` | — |
| `customerName` | `name` | — |
| `branch` | `{code, name, description} \| null` | — |
| `channel` | `{code, name} \| null` | — |
| `email`, `userName`, `phone` | — | nullable |
| `userLastUpdatedAt`, `lastLoginAt` | — | ISO \| null; Go zero time → null; unparsable → `Contract` |

**Strict envelope:**
- `total_rows` (int ≥ 0) and `rows` (array) are required, otherwise `Contract`.
- `total_rows < rows.length` → `Contract`.
- `rows.length > pageSize` → `Contract`.

**Never mapped:** `customer_id`, `org_id`, `address`, `customer_area_id`, `customer_channel_id`, `user_last_order`.

**Branch options:** `{id (UUID), aamCode, name, description}`, strict; a bad shape → `Contract`.

## 6. UI

- **Columns** (none sortable, no actions or links): Status (Aktif / Nonaktif), Cust. ID, Nama Relasi, Nama Cabang, Sales Channel, Email Pengguna, Nama Pengguna, Nomor Telepon, **Terakhir Diperbarui**, Tgl. Masuk Terakhir.
- **Toolbar:**
  - search box;
  - search-type select (shadcn `NativeSelect`, shared filter);
  - branch multi-select (labelled chips; its own error / disabled state when the options lookup fails, while the list still works).
- **Completeness note:** "Daftar mengikuti data dari server; pengguna nonaktif mungkin tidak ditampilkan."
- **Page reset:** branch, search-type and page-size changes reset to page 1.

**Accessibility adaptations kept inside F31:**
- The multi-select's unlabelled remove buttons are hidden and replaced by labelled chips.
- The real `aria-expanded` state is set on the input (axe).
- Table cells wrap so the ten columns fit without a scroll container (axe keyboard rule).

## 7. Error Handling

| Case | Result |
|---|---|
| 200 with rows | table |
| 200 empty (`total_rows: 0`, `rows: []`) | empty state |
| 404 from the list | **ErrorState** (no 404 → empty rule; readiness §12); the page does not turn it into a 404 page |
| 500 / network | ErrorState with retry; never empty |
| 403 / no capability | AccessDenied; 0 backend calls |
| 401 | shared session hand-over |
| Malformed / inconsistent response | `Contract` → ErrorState |

## 8. Automated Tests and Quality Checks

All commands use `PATH=$HOME/.local/share/mise/installs/node/24.16.0/bin:$PATH` and run in `frontend/`.

| Command | Result |
|---|---|
| `npm run quality` (coordinator, 2026-10-09) | **PASS**: eslint 0 errors (28 pre-existing warnings, none in F31 files); tsc clean; vitest **75 files / 1127 tests passed** (F31: contract 18, pages 10) |
| `npm run build` | **PASS**: `ƒ /dashboard/user-management` built |
| `npm run check:bundle` | **PASS**: 75 files scanned, no server-only markers or values |
| Client wire scan of `.next/static` (`customers/users`, `customer-areas`, `search_by`, `aam_customer_id`, `customer_area_id`, `user_activation`, `user_last_order`, `org_id`) | **0 files** |
| `git diff --check` | **PASS** |
| `npm run test:e2e:full` (full suite, E2E build, load average 13–16) | **177 / 182**; 5 failures (below) |
| Isolated rerun: `npm run e2e:build && CI=1 node node_modules/@playwright/test/cli.js test e2e/specs/user-management.spec.ts e2e/specs/auth.spec.ts e2e/specs/faq.spec.ts e2e/specs/form.spec.ts --reporter=line` | **31 / 31 PASS** (F31 10 / 10) |

**Full-suite failures and their isolated reruns:**

| Test | Full run | Isolated |
|---|---|---|
| `user-management.spec.ts:105` | 45 s timeout in the `login` `beforeEach` hook | pass |
| `faq.spec.ts:25`, `:44` | timeouts (known T-02 class) | pass |
| `form.spec.ts:80` | login hook timeout | pass |
| `auth.spec.ts:46` | `refresh` count 3 vs expected 2 | pass |

All five passed in the isolated rerun, so they are classified as **suite-level / host-load observations**, not regressions. The `auth.spec.ts:46` count mismatch is noted for watch (F31 touches no auth code).

**What the F31 E2E covers** (10 tests, mock backend):
- menu → list with axe;
- search by name / email;
- branch 1 → 2 → page change → clear (exact `filters[0]` params, persistence, page reset);
- invalid URL branch ids dropped before any request;
- pagination and page sizes;
- empty 200;
- list 500 → error + retry;
- branch options 500 → list still works;
- reader instance: menu hidden, direct URL 403, 0 backend calls;
- the mock records **only GET** requests.

**Mocked tests do not verify live backend behaviour.**

## 9. Known Limitations / Gaps

See `F31_BACKEND_COMPATIBILITY_GAPS.md` (implementation-handling section added). In short:
- **Backend security:**
  - CA-01 (CRITICAL) and CA-02 (HIGH): the backend is still vulnerable; frontend constants and UUID validation are defence in depth only.
  - CA-04 (HIGH): backend role grants are unverified.
- **Runtime unverified:**
  - search-alias behaviour (G-10);
  - inactive-row visibility (G-04);
  - ordering overlap (G-03);
  - the real `filters[0]` behaviour.
- **Test coverage:** `url-codec` array serialization is covered at unit level **indirectly** by `user-management.contract.test.ts:154` (via `userManagementSearchParams` → `toTableSearchParams`) and by E2E (`user-management.spec.ts:78`); there is no dedicated case in `url-codec.test.ts`.
- **Separate follow-up:** G-13, `cms_customer_channel.go` (not called by F31).

## 10. Live READ

**NOT PERFORMED** by this implementation task. The READ-only adapter `LIVE_MODULE=user-management` exists for the owner-run gate. Its `get` looks the id up in list page 1 (100 rows), because there is no detail endpoint, and the sort is fixed (`sortFields: []`).

## 11. Production Release

**Not authorized by this task.** CA-01 / CA-02 (backend fix not merged) and CA-04 (no role-grant evidence) remain open. Release requires the merged and verified backend fix plus grant evidence, or a written security-owner decision.
