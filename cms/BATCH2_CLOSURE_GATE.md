# Batch 2 — Closure Gate

| Field | Value |
|---|---|
| Date | 2026-10-06 |
| Scope | F07 Produk · F08 Kategori Produk · F18 Banner & Iklan · F19 Group Story · F28 Prinsipal |
| Global (unchanged) | A6 = HOLD · D-A6R2-01 = OPEN · FAQ `total_rows` = BACKEND BUG OPEN · F25 live WRITE BLOCKED · F11 W3 not run |
| Live WRITE | NOT AUTHORIZED: no mutation performed |

## 1. Executive summary

```text
BATCH 2 CLOSURE DECISION: CONDITIONAL GO
```

All automated gates are green.

**Live READ against `devb2b-api.gpos.id` (owner run 2026-10-06):**
- every module authenticates and lists, pages, sorts, searches, reads details and loads lookups through the production DAL;
- zero mutations and zero secrets in the evidence;
- one real frontend mapping defect was found by live READ (F18 criteria detail) and fixed, and the re-run passed.

**Remaining conditions, all outside frontend responsibility and documented:**
- the F19 story-group **write** contract cannot be verified from backend source;
- backend defects B2-01 to B2-08.

## 2. Automated validation (canonical commands, `frontend/`)

| Command | Result |
|---|---|
| `npm run quality` (eslint + `tsc --noEmit` + `vitest run`) | exit 0 · eslint **0 errors** (28 pre-existing warnings, none in Batch 2 files) · tsc **0** · vitest **62 files / 961 passed** |
| `npm run e2e:build` + `playwright test` (full suite) | **132 / 132 passed** (final run 4.3 min; see §3) |
| `npm run build` | exit 0 (all Batch 2 routes built) |
| `npm run check:bundle` + wire scan of `.next/static` | PASS · `cms/banners`, `cms/story-groups`, `custom-criterias`, `product-categories`, `products/principals`, `customer-areas`, `image_thumb`, `sort_by`, `restrict_customer`, `banner_ids`, `file_url`, `customer_ids`, `principal_ids` → **0** client files |

**Batch 2 module tests:**

| Module | Unit | E2E |
|---|---|---|
| F07 | 34 | 4 |
| F08 | 40 | 4 |
| F18 | 46 | 8 |
| F19 | 47 | 4 |
| F28 | 41 | 5 |

## 3. E2E investigation

**Previously reported 129 / 130 (`datatable.spec.ts:128`, Content retry-after-500, A5.5):**
- isolated: 10 / 10 and 5 / 5 passed; an earlier isolated run failed 1 / 3;
- full suite: failed in 1 of 4 runs;
- code under test (Content list, ServerDataTable retry, router) is unchanged in Batch 2.

Classification: **non-deterministic timing flake, not a Batch 2 regression.**

Test-quality note (not changed, outside Batch 2): its `retry must reach the gateway` poll reads the cumulative `stats().list.length > 0`, which is already true from the 500 render, so that assertion is vacuous.

**Found and fixed during this gate (real Batch 2 product defect):**
- **Defect:** the banner inline test failed 2 / 10.
- **Root cause, proven with a DOM marker:** TanStack `flexRender` renders `cell` functions as components. The tables rebuilt their column array on every render, so every list refresh remounted each cell:
  - inline Sequence input lost while the list refreshed;
  - delete dialog closing mid-click (F19).
- **Fix:** memoized columns (`useMemo`) in the banner, group-story, product-category and principal tables (F07 was already static).
- **Regression test** (`banner-pages.test.tsx`: re-render keeps the same element and value) fails without the fix.
- **After the fix:** 10 / 10 isolated, and green in the full suite.

**Spec expectations updated only where the product deliberately changed** (legacy parity):
- F07 / F08 default page size 5;
- F19 delete confirm "Lanjutkan".

**Second real Batch 2 defect, found under load and fixed: duplicate mutation.**
- **Defect** (F18 and F19 inline Sequence): Enter disables the input while saving, so it blurs, and the blur re-committed the same value from a stale render.
- **App-log evidence:** two `banner.set-sequence` PUTs 130 ms apart; the second got a 400, the value reset and the list did not re-sort.
- **Fix:** a last-sent `useRef` guard in both inputs.
- **Regression tests** (Enter + blur while in flight → exactly one call) in `banner-pages` and `group-story-pages`. They fail on the old logic.

**Load-related failures (not logic)** were observed while the host load average was 9–17 (antivirus scan at about 77 % CPU):
- axe `page.evaluate` timeout;
- table not rendered within 8 s;
- auth refresh counted twice;
- login `beforeEach` timeout.

Each passed when rerun, and the final full suite at lower load passed 132 / 132.

## 4. Live READ (owner terminal, 2026-10-06 07:12–07:19 UTC, READ only)

Login: `superadmin@gpos.id` test account (not recorded in evidence). Every run: POST 0 / PUT 0 / DELETE 0. Secret scan of every evidence file (JWT, bearer, token / password / cookie / authorization / api-key keywords, account email): **0**.

| Module | Login | R1 list | R2 paging | R3 sort | R4 search | R5 detail / unknown | R6 lookups | Result |
|---|---|---|---|---|---|---|---|---|
| F08 | ✓ | 5 / 12 | disjoint ✓ | name, sequence, createdAt ✓ | 4 hits ✓ | ✓ / NotFound ✓ | n/a | **PASS** |
| F07 | ✓ | 5 / 29 987 | disjoint ✓ | code, name, isActive, isDraft ✓ | 1 hit ✓ | ✓ / **Server (500)** | n/a | **PASS except B2-01** |
| F18 | ✓ | ✓ | disjoint ✓ | ✓ | ✓ | ✓ / NotFound ✓ | channels 55, areas 49, customers 20, 7 criteria options (131 / 20 / 9 / 3 / 10 / 10 / 10), criteria detail ✓ | **PASS** (after fix) |
| F19 | ✓ | 5 / 6 | disjoint ✓ (5 + 1) | sequence desc ✓; asc check flags the legacy "expired groups sink to the bottom" rule | 1 hit ✓ | ✓ / NotFound ✓ | story banners 6 | **READ PASS** |
| F28 | ✓ | 5 / 142 | **pages overlap** (B2-08) | code, name, phone, isActive ✓ | 2 hits ✓ | ✓ / NotFound ✓ | n/a | **PASS except B2-08** |

**F18 mapping defect found live and fixed:**
- **What happened:** `GET /cms/custom-criterias/detail` returns the full master-data label lists (e.g. 7 639 product classes), some with blank text. The mapper treated a blank label as a contract violation, so the Katalog Produk tab would have failed for every banner.
- **Fix:** a blank label falls back to the id, while type checks stay strict.
- **Tests:** a live-shape unit test was added.
- **Result:** re-run 07:19 UTC → PASS.

The evidence files are in `$TMPDIR/module-live/<module>/evidence-20261006071*.json`. They are OS-temporary; the results are recorded here.

## 5. F19 Group Story: contract

**Sources searched:**
- every branch and remote of all 13 repos under `~/Developments/BE`, plus swagger / docs: **no story-group code**;
- the local content-service clone was last fetched 2026-06-03, but the gateway routes were added 2026-08-14 (`e3c9512`);
- gateway `endpoints.json:376-387` (content_service): POST, GET, GET / PUT / DELETE `{id}`, DELETE `/bulk`, POST `{id}/banners`, DELETE `{id}/banners/{bannerId}`, PUT `{id}/banners/reorder`.

**Result:** **BACKEND CONTRACT REQUIRED.** Only legacy evidence exists.

| Operation | Implemented as (legacy-evidenced) | Status |
|---|---|---|
| List / detail | `rows` / `total_rows`; detail `banners[{banner_id, sequence}]` | Shape to be confirmed by live READ |
| Create | `banner_ids`, `platforms`, legacy defaults; success 200 / 201 | UNCONFIRMED |
| Update | full replacement `banners[{banner_id, sequence}]`, `platform`; 200 | UNCONFIRMED (incl. zero / false persistence) |
| Delete / bulk | `DELETE /{id}`; `DELETE /bulk {ids}`; 200 | Route confirmed (gateway); code unconfirmed |

**Frontend assumptions not backed by legacy** (to confirm or relax):
- name ≤ 100, thumbnail ≤ 512, banners ≤ 100, sequence ≤ 9999;
- at least 1 banner required;
- strict response typing;
- sort limited to `sequence`.

**Required:** pull or confirm the content-service story-group handler / DTO (owner: backend team, content-service).

## 6. Visual parity

**Accepted project rules (not flagged):**
- DR-26 design tokens (no Argon header gradient);
- OD-20 Indonesian-first copy;
- A4_FORM §41 Save always enabled;
- OD-22 export buttons;
- DR-14 notices / toasts;
- "All" page size dropped.

**Fixed in this gate:**

| Module | Fix |
|---|---|
| F07, F08, F28 | default page size 5 (legacy `main.js` pageLength 5) |
| F08 | Aksi column first (legacy order); 24 px thumbnail |
| F18 | story image required marker `*`; breadcrumbs "Buat Banner & Iklan Baru" / "Edit Banner & Iklan" |
| F19 | list switch shows On / Off; failed toggle shows a toast; delete dialog "Kembali / Lanjutkan"; empty state "Belum ada grup story"; Kembali / Simpan top-right; breadcrumbs "Buat Grup Story Baru" / "Edit Grup Story" |
| F18 | **"Katalog Produk" tab implemented** (edit page; see §7) |

Two shared components gained optional props, with unchanged defaults: `ConfirmDeleteButton` (`cancelLabel` / `confirmLabel`) and `ServerDataTable` (`emptyTitle`).

**Remaining items:**

| Module | Item | Status |
|---|---|---|
| F07 | Legacy showed plain text "Active / Not Active / Draft" and raw field names as labels (`ProductController.js:44-45`, `form_image.edge:2`, A3.2 screenshot). New badges and readable labels | INTENTIONAL (legacy defect not carried) |
| F18 | Deskripsi Konten: legacy Quill rich-text, new plain textarea holding HTML | **NEEDS OWNER DECISION** (DR-21 / OD-11: new dependency) |
| F19 | Legacy page gradient `#2dce89→#2467ec`; drag-and-drop reorder → Naik / Turun buttons | INTENTIONAL (DR-26; keyboard a11y) |
| F08 | Legacy 2-column form grid → single column; upload `image/*` → JPEG / PNG (as all modules) | Minor INTENTIONAL |
| F28 | Legacy dead multi-select "Select upto 5 tags" (never populated, never sent) not ported; edit form note about the backend zero-value limitation | INTENTIONAL (dead legacy code) |
| F08, F28 | No legacy runtime captures exist (A3.2 V-U01: principal edit 500 on mock) | **VISUAL PARITY — NEEDS EVIDENCE** (screenshots of legacy F08 list / edit, F28 list) |

## 7. F18: upload and Katalog Produk

**Upload contract: ESTABLISHED (not blocked).**
- Request: content-service `handler/file.go` + `dto/oss.go`: POST `/api/v1/files/signurl` JSON `{file_name, category, content_type[, file_visibility]}`. It is **not multipart**.
- Response 200 `{url, file_url, file_name}`. The browser PUTs the bytes to `url`, and the entity stores `file_url`.
- Category `images` (legacy).
- Type / size policy: legacy `image/*` ≤ 5 MB (client); implemented as JPEG / PNG ≤ 5 MB. There is no backend type / size validation.
- Upload is separate from entity create / update. There is no file-delete coupling (legacy had none).
- Upload is required for normal operation (image required on create): implemented.

**Katalog Produk tab: required F18 functionality.**
- **Why it belongs to F18:**
  - it is on the legacy edit screen (`banners/edit.edge:39-60`);
  - the backend supports it;
  - nothing else covers it (A4 #165 lists the endpoint under F10).
- **What was implemented:**
  - `GET /cms/custom-criterias/detail?custom_id=`;
  - `PUT /cms/custom-criterias/{id}` (`custom_type=BANNER`, 7 id lists, promo codes, price from / to);
  - 7 option lookups, all verified in product-service source;
  - the legacy LINK-goal message.
- **Blocked item:** `BLOCKED — BACKEND CONTRACT REQUIRED: promo-code lookup`. Legacy had none either: stored codes are shown and removable, adding is not offered.

## 8. Backend findings (BACKEND BUG — OPEN, no frontend workaround)

| ID | Endpoint | Observed (source) | Expected | Impact | Class |
|---|---|---|---|---|---|
| B2-01 | GET `/cms/products/{id}` unknown id | 500 (nil dereference in use case) | 404 | Error page instead of "not found" | B |
| B2-02 | PUT `/cms/products/{id}` | forces `is_draft=false`; `Save` overwrites the whole row | partial update | can undo a concurrent ERP sync | B |
| B2-03 | PUT `/cms/banners/{id}` | `Updates(struct)` drops `sequence=0`, empty link / content / image, `story_image=null` | persist zero values | cannot clear these fields | B |
| B2-04 | PUT `/cms/products/principals/{id}` | `Updates(struct)` drops `is_active=false` and cleared phone / fax / website / address | persist | cannot deactivate a principal (UI note) | B |
| B2-05 | PUT `/cms/custom-criterias/{id}` | `Updates(struct)` drops price 0 | persist | cannot clear a price | B |
| B2-06 | list endpoints F07 / F08 / F18 / F28 | `sort_by` concatenated into ORDER BY | allowlist | SQL injection (frontend sends allowlist only) | B |
| B2-07 | `/cms/story-groups/*` | source unavailable (READ shape verified live) | contract | F19 write unverified | **A → condition** |
| B2-08 | list endpoints with a non-unique default sort (F28 `is_active`, F07 `is_draft`) | no tiebreaker in ORDER BY → live F28 page 1 and page 2 overlap | add a unique secondary key (e.g. `id`) | rows duplicated / skipped across pages (same in legacy) | B |

**Classes:**
- **A** blocks Batch 2;
- **B** backend defect that does not block the frontend migration;
- **C** unrelated / deferred.

## 9. Test matrix

| Module | Static | E2E | Live READ | Contract | Visual | Status |
|---|---|---|---|---|---|---|
| F07 | PASS | PASS | PASS (R5 = backend B2-01) | PASS | PASS | CONDITIONAL GO (backend bugs) |
| F08 | PASS | PASS | PASS | PASS | NEEDS EVIDENCE (no legacy captures) | GO |
| F18 | PASS | PASS | PASS | PASS (promo lookup n/a) | NEEDS DECISION (Quill) | CONDITIONAL GO |
| F19 | PASS | PASS | PASS (READ) | WRITE BLOCKED | PASS | CONDITIONAL GO (write contract) |
| F28 | PASS | PASS | PASS (R2 = backend B2-08) | PASS | NEEDS EVIDENCE | CONDITIONAL GO (backend bugs) |

## 10. Final gate decision

```text
CONDITIONAL GO
```

**Why it is not GO:**
- **F19:** create / update follow legacy evidence only. The READ shape inferred the same way is now proven live, but the story-group backend source is unavailable. Action: the backend team confirms the content-service handler / DTO.
- **Backend defects B2-01 … B2-08:** documented, with no frontend workaround.

**Why it is not HOLD:**
- no broken frontend functionality;
- authorization / navigation verified;
- live READ passes for all modules;
- the only frontend defect found live has been fixed and re-verified.

Earlier blockers G-01 (live READ) and G-02 are reduced to the F19 write-contract condition.

## 11. Remaining deferred work

- **F18:** Quill / rich-text decision (DR-21 / OD-11); promo-code lookup (no backend endpoint).
- **F08, F28:** legacy screenshots for visual evidence.
- **Backend fixes B2-01 … B2-06.**
- **Not in Batch 2:** the Batch 1 / F11 / F30 tables build `actionsColumn(...)` per render (same remount class, affects open delete dialogs during a refresh). Recommended as a follow-up fix.
- **Not in Batch 2:** `datatable.spec.ts` vacuous retry assertion.

Batch 3: **NOT STARTED.**
