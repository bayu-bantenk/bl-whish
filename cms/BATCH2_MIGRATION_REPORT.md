# Batch 2 — Module Migration Report

| Field | Value |
|---|---|
| Date | 2026-10-06 |
| Modules | F07 Produk · F08 Kategori Produk · F18 Banner & Iklan · F19 Group Story · F28 Prinsipal |
| Global | A6 = HOLD · D-A6R2-01 = OPEN · FAQ `total_rows` = BACKEND BUG OPEN · F25 live WRITE blocked · F11 W3 not run |

## Modules

| Module | Route | Backend (verified in source) | Operations | Unit | E2E |
|---|---|---|---|---|---|
| F07 Produk | `/dashboard/product` | product-service `/cms/products` | list (Status / Draft filters), edit (description, T&C, active, 4 images) | 34 | 4 |
| F08 Kategori Produk | `/dashboard/product-category` | product-service `/cms/product-categories` | list, create, edit, delete, bulk delete; image required | 40 | 4 |
| F18 Banner & Iklan | `/dashboard/banner` | product-service `/cms/banners` + account-service lookups | list (status / type filters), create, edit, inline Active and Sequence, delete, bulk delete; 2 images | 32 | 6 |
| F19 Group Story | `/dashboard/group-story` | `/cms/story-groups`: **source not in the workspace** (gateway → content_service); legacy-evidenced | list, create, edit (Informasi / Konten Banner tabs), inline toggle, delete, bulk delete; thumbnail | 46 | 4 |
| F28 Prinsipal | `/dashboard/principal` | product-service `/cms/products/principals` | list, create, edit, delete, bulk delete; logo | 41 | 5 |

**Upload:** the existing signed-URL foundation is reused (no new upload code). The contract is verified in content-service `handler/file.go` + `dto/oss.go`:
- request: POST `/api/v1/files/signurl` `{file_name, category, content_type}`;
- response: 200 `{url, file_url, file_name}`;
- categories come from `enum/file_category.go`;
- purposes are registered per module in `UPLOAD_PURPOSES` (create / update capability).

**F28** previously saved logos to the Adonis server's disk. That file could not be loaded and the backend accepts any URL in `image`, so the logo now uses the signed URL with category `principal`.

## Shared changes

- Registry reordered to the **legacy menu order** (Extender.js).
- New routes; banner flipped from `planned` to `active`.
- Capabilities: `product.read/update`, `product-category.*`, `group-story.*`, `principal.*`, `banner.delete`.
- Nav icons.
- E2E:
  - per-module mocks (`e2e/mock/<module>-backend.mjs`);
  - grants;
  - the network guard allows **GET of public storage files** (image previews read the stored `file_url`);
  - `expectAccessible` waits for the streamed `<title>` (fixes an axe `document-title` flake under load).
- `route-access.test` / `shell.spec` use `payment` as the remaining *planned* example (banner is active now).
- DAL feature allowlist updated.

## Backend issues (reported, not worked around)

| Module | Issue |
|---|---|
| F07 | `GET /cms/products/{unknown id}` → **500** (nil dereference), not 404. Live R5 "unknown id" will show `Server` |
| F07 | Update forces `is_draft=false` and `Save` overwrites the whole row (can undo a concurrent ERP sync); image columns `varchar(256)` |
| F18 | `UpdateBanner` uses `Updates(struct)` (D-A6R2-01 class): `sequence=0`, empty link / content / image and `story_image=null` are silently not saved (`is_active` / `open_new_tab` are `*bool`: OK) |
| F28 | `Updates(struct)`: setting **inactive**, or clearing phone / fax / website / address, is not saved (form shows a note) |
| F19 | **BLOCKED — BACKEND CONTRACT REQUIRED:** story-group create / update DTOs (legacy uses `banner_ids` / `platforms` on create vs `banners` / `platform` on update), success codes, list / detail shapes, field limits (100 / 512 are unconfirmed safety bounds), and whether update keeps `is_active=false` / `shuffle_enabled=false` / `rotation_pool_size=0` |
| F08, F18, F28, F07 | `sort_by` concatenated into ORDER BY (SQL injection); the frontend sends allowlisted columns only |

## Deferred / needs decision

- **F18 "Katalog Produk" tab** (edit page): a separate custom-criteria feature (`CustomCriteriaController.updateByCustomType('BANNER')`, about 7 more lookups). Not built.
- **F18 Deskripsi Konten:** legacy used the Quill rich-text editor. Now a plain textarea holding HTML. A rich-text editor needs a new dependency: **VISUAL PARITY — NEEDS SCREENSHOT / decision**.
- **VISUAL PARITY — NEEDS SCREENSHOT:**
  - F07 exact labels / badge colours (legacy showed raw field names);
  - F19 toggle / header gradient colours.
- **F19 ordering:** legacy drag-and-drop ordering is replaced by keyboard-accessible Naik / Turun buttons.

## Legacy bugs fixed (selection)

- **F07:**
  - sorting by Image broke the list (SQL error);
  - errors were hidden as an empty table;
  - SVG was accepted.
- **F08:** the create button said "Create New Sponsored Product"; a failed delete was shown as success.
- **F18:**
  - update blanked `page_location`;
  - customer ids beyond the first 1000 were dropped on save;
  - the image-required check was skipped;
  - an empty type filter failed the backend validation.
- **F19:**
  - the banner picker sent no take / sort (always empty);
  - members missing from the picker were silently removed on save;
  - the update notice said "dibuat".
- **F28:**
  - create ignored the Active select;
  - delete redirected to `/custom-catalog`;
  - edit dropped a new image;
  - no length checks (500).

## Quality gate

| Check | Result |
|---|---|
| tsc | 0 errors |
| eslint `src test e2e` | 0 errors (28 pre-existing warnings, none in batch-2 files) |
| vitest | **62 files, 946 passed** |
| E2E (full) | **129 / 130 passed**. Remaining failure: `datatable.spec.ts:128` (A5.5 Content retry-after-500), a pre-existing intermittent flake (also seen 1 / 3 in isolation; no shared table code changed in this batch) |
| `next build` | exit 0 |
| `check:bundle` | PASS; wire scan (`cms/banners`, `cms/story-groups`, `product-categories`, `products/principals`, `customer-areas`, `image_thumb`, `sort_by`, `restrict_customer`) → 0 |

## Live READ

PENDING (owner terminal; read-only adapters, no `write`):

```bash
cd frontend
for m in product product-category banner group-story principal; do
  LIVE_MODULE=$m npx vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts
done
```

## Closure gate (2026-10-06)

```text
Batch 2 Status: HOLD
```

Details: `BATCH2_CLOSURE_GATE.md`.

**Gate results:**
- static and E2E green: vitest 960, E2E 132 / 132, tsc 0, eslint 0 errors, build PASS, bundle PASS;
- **blocked:** Live READ (credentials only in the owner terminal) and the F19 story-group backend contract (source unavailable).

**Fixed during the gate:**
- remounting table cells (memoized columns);
- duplicate inline sequence PUT (F18, F19);
- F18 "Katalog Produk" tab implemented;
- visual parity fixes for F07, F08, F18, F19.
