# Batch 2 — Closure Gate

| Field | Value |
|---|---|
| Date | 2026-10-06 |
| Scope | F07 Produk · F08 Kategori Produk · F18 Banner & Iklan · F19 Group Story · F28 Prinsipal |
| Global (unchanged) | A6 = HOLD · D-A6R2-01 = OPEN · FAQ `total_rows` = BACKEND BUG OPEN · F25 live WRITE BLOCKED · F11 W3 not run |
| Live WRITE | NOT AUTHORIZED: no mutation performed |

## 1. Executive summary

```text
BATCH 2 CLOSURE DECISION: HOLD
```

**Implementation and automated gates are green.**

**Two closure inputs are missing:**
1. **Live READ** has not been executed for any Batch 2 module. The `A55R_*` credentials exist only in the owner's terminal, so it is blocked by the environment, not failed.
2. **F19 Group Story backend contract is unavailable.** The story-group service source is not in the workspace, and create / update run on legacy evidence only.

**Expected follow-up:** once Live READ passes (5/5) and the F19 contract is confirmed (or accepted as legacy-evidenced by the owner), the decision is expected to move to CONDITIONAL GO. Backend defects are documented, with no workarounds.

## 2. Automated validation (canonical commands, `frontend/`)

| Command | Result |
|---|---|
| `npm run quality` (eslint + `tsc --noEmit` + `vitest run`) | exit 0 · eslint **0 errors** (28 pre-existing warnings, none in Batch 2 files) · tsc **0** · vitest **62 files / 960 passed** |
| `npm run e2e:build` + `playwright test` (full suite) | **132 / 132 passed** (final run 4.3 min; see §3) |
| `npm run build` | exit 0 (all Batch 2 routes built) |
| `npm run check:bundle` + wire scan of `.next/static` | PASS · `cms/banners`, `cms/story-groups`, `custom-criterias`, `product-categories`, `products/principals`, `customer-areas`, `image_thumb`, `sort_by`, `restrict_customer`, `banner_ids`, `file_url`, `customer_ids`, `principal_ids` → **0** client files |

**Batch 2 module tests:**

| Module | Unit | E2E |
|---|---|---|
| F07 | 34 | 4 |
| F08 | 40 | 4 |
| F18 | 45 | 8 |
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

## 4. Live READ

```text
LIVE READ — BLOCKED BY CREDENTIAL/ENVIRONMENT
```

No live call was made in this gate. Earlier `$TMPDIR/module-live` evidence (Batch 1 / F11) was cleared by the OS; Batch 1 / F11 results remain recorded in their reports.

Run once in the owner terminal (read-only adapters, no `write`; guard allows GET only). Non-secret variables: `A55R_CONFIRM_NON_PRODUCTION=yes`, `A55R_ALLOWED_HOST=devb2b-api.gpos.id`, plus the test-account variables `A55R_EMAIL` / `A55R_PASSWORD` already set in that terminal.

```bash
cd frontend
for m in product product-category banner group-story principal; do
  LIVE_MODULE=$m npx vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts
done
```

| Module | Expected steps | Known expectation |
|---|---|---|
| F07 | R1–R6 | **R5 unknown-id → `Server` (backend 500 instead of 404, BACKEND BUG)** |
| F08 | R1–R6 | none |
| F18 | R1–R6 + 10 lookups (channels, areas, customers, 7 criteria options) + criteria detail | `banner.update` grant is harness-local; GET only |
| F19 | R1–R5 + banner lookup | READ shape is legacy-evidenced; a strict mapping mismatch would show as a `Contract` error |
| F28 | R1–R5 | none |

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
| B2-07 | `/cms/story-groups/*` | source unavailable | contract | F19 write unverified | **A** |

**Classes:**
- **A** blocks Batch 2;
- **B** backend defect that does not block the frontend migration;
- **C** unrelated / deferred.

## 9. Test matrix

| Module | Static | E2E | Live READ | Contract | Visual | Status |
|---|---|---|---|---|---|---|
| F07 | PASS | PASS | BLOCKED | PASS | PASS | HOLD (live READ) |
| F08 | PASS | PASS | BLOCKED | PASS | NEEDS EVIDENCE | HOLD (live READ) |
| F18 | PASS | PASS | BLOCKED | PASS (promo lookup N/A) | NEEDS DECISION (Quill) | HOLD (live READ) |
| F19 | PASS | PASS | BLOCKED | BLOCKED | PASS | HOLD (contract) |
| F28 | PASS | PASS | BLOCKED | PASS | NEEDS EVIDENCE | HOLD (live READ) |

## 10. Final gate decision

```text
HOLD
```

**Blockers:**

| ID | Module | Problem | Evidence | Impact | Required resolution | Owner |
|---|---|---|---|---|---|---|
| G-01 | all 5 | Live READ not executed | no `A55R_*` in agent env; `$TMPDIR/module-live` empty | real mapping unverified | run the §4 command once | Owner (terminal) |
| G-02 | F19 | Story-group contract unavailable | §5 | create / update unverified | content-service story-group handler / DTO (git fetch or author) | Backend team |

## 11. Remaining deferred work

- **F18:** Quill / rich-text decision (DR-21 / OD-11); promo-code lookup (no backend endpoint).
- **F08, F28:** legacy screenshots for visual evidence.
- **Backend fixes B2-01 … B2-06.**
- **Not in Batch 2:** the Batch 1 / F11 / F30 tables build `actionsColumn(...)` per render (same remount class, affects open delete dialogs during a refresh). Recommended as a follow-up fix.
- **Not in Batch 2:** `datatable.spec.ts` vacuous retry assertion.

Batch 3: **NOT STARTED.**
