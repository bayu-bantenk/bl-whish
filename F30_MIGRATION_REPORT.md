# F30 — Konfigurasi Umum: Migration Report (lightweight loop)

| Field | Value |
|---|---|
| Date | 2026-10-02 |
| Loop | Contract Check → Implement → Test → Live Smoke → Report |
| Backend | `gpos-b2b-product-service` (local source `b5ca719`, branch `cms-filter-banner`); live target `devb2b-api.gpos.id` |
| Global | **A6 Content = HOLD / BLOCKED · D-A6R2-01 = OPEN / CRITICAL**, unchanged; no Content mutation |
| **Status** | **HOLD**: implementation and tests are complete. Live READ / WRITE smoke not yet run, because credentials are only available in the owner's terminal. Not a defect blocker |

## 1. Scope

- **Migrated:** list (search key or value, sort, pagination), detail, create, edit, delete, bulk delete. That is legacy S014–S016 plus the delete / multidelete actions (A4 MIGRATE #63–#73).
- **Not migrated:**
  - `updatebyproductgposb2b`: F09 behaviour on the shared PUT endpoint;
  - `/cms/global-configurations/detail`: F09 / F26, GET body;
  - the client `/global-configurations*` endpoints;
  - the dead legacy `getGlobalConfigurationOptions` (no route, no backend endpoint).

## 2. Contract summary

| Operation | Contract | Class |
|---|---|---|
| List | `GET /api/v1/cms/global-configurations?sort_by&asc_desc&page&take&keyword` → `{limit, page, sort, total_rows, total_pages, rows[{id, key, value, created_at}]}`; defaults `created_at desc`, take 10; keyword = key OR value | DOCUMENTED (source + Swagger) |
| Detail | `GET /:id` → `{id, key, value, created_at}`; unknown → 404 | DOCUMENTED |
| Create | `POST {key, value}` (both `required`) → **201** `{message}` (no id); duplicate key → DB unique index → 500 | DOCUMENTED / 500 INFERRED |
| Update | `PUT /:id {key, value}` → 200. `Updates(struct)` with the PK set; both fields validated non-empty, so both are always written. **Not exposed to the D-A6R2-01 zero-value class** | VERIFIED (code path) |
| Delete | `DELETE /:id` → 200 (soft delete; unknown → 404) | DOCUMENTED |
| Bulk delete | `DELETE /bulk {ids}` → 200 (no existence check) | DOCUMENTED |
| Validation error | 400 `{message:"Validation Error", data:[{FailedField, Tag, Value}]}`, no `error_code` | DOCUMENTED |
| Authorization | backend: only `X-UserId` present (403 otherwise), no RBAC; gateway UNKNOWN | DOCUMENTED / UNKNOWN |
| `created_at` | **SUPPORTED** by the CMS DTO. The canonical `createdAt` is nullable and kept. The A7 selection-audit claim "`{id, key, value}`" was CONTRADICTED (it described the client DTO) | DOCUMENTED, live pending |

Details: `A7_KONFIGURASI_UMUM_CONTRACT_READINESS.md` §5–§13.

## 3. Legacy behavior

| Behaviour | Classification | New behaviour |
|---|---|---|
| Columns Key / Value / Created, default `created_at DESC`, search box, server paging | MUST PRESERVE | same; page sizes 5 / 10 / 25 / 50 (default 10) |
| Required key / value | MUST PRESERVE | client + server zod; whitespace-only rejected; key trimmed, value verbatim |
| Delete with confirm modal; multidelete with checkboxes | MUST PRESERVE | alert dialog; selection + "Hapus terpilih (n)" |
| Redirect to the list with a flash | MAY CHANGE | server redirect `?saved=created\|updated\|deleted` + status notice |
| Edit form pre-fills **Value with the key** (`edit.edge:41`) | LEGACY ONLY (defect) | Value pre-filled with the stored value |
| Create shows success on any result (`if (!result)`) | LEGACY ONLY (defect) | only envelope 201 is success; failures shown |
| Update failure on the invisible `Warning` flash | LEGACY ONLY (defect) | typed form-level error |
| DataTables protocol, jQuery, server-built HTML buttons | LEGACY ONLY | shared ServerDataTable (A5.5), React cells |

## 4. Implementation summary

**Package `src/packages/global-configuration/`** (A6 pattern):

| Layer | Files |
|---|---|
| domain | entity, `TableSpec`, zod schema, port |
| use case | authorize → validate → port; bulk ≤ 50 valid ids, otherwise Validation with no call |
| repository | `dto.ts` (sort-column **allowlist**, wire ⇄ canonical, `created_at` validation) + `GatewayGlobalConfigurationRepository` (shared GatewayClient; create okCode 201, others 200) |
| presentation | table (ServerDataTable, `selectable`, `toolbarActions`), form (RHF + zod + shadcn), feature-local `ConfirmDeleteButton`, Server Actions (create / update / delete / bulk → `runAction` → redirect) |

**Routes:**
- `/dashboard/global-configuration` (+ `loading.tsx`);
- `/dashboard/global-configuration/create`;
- `/dashboard/global-configuration/update/[id]`.

Each route uses `guardRoute`, DAL, `resolvePageResult`.

**Extension points used** (no foundation change):
- capabilities: `global-configuration.read|create|update|delete`, fail-closed, no default grant;
- registry: 3 routes in group "Pengaturan & Konfigurasi";
- nav icon key `settings`;
- `composeFeatures().globalConfiguration`.

**Security:**
- no browser-to-backend call;
- the bundle scan finds the gateway path, capability names, `sort_by` and `total_rows` in 0 client files;
- mutations are not replayed after a 401.

## 5. Tests

| Suite | Result |
|---|---|
| `npm run quality` (eslint 0 errors, tsc, vitest) | **38 files, 556 passed** (+33 F30: contract 20, pages 8, form 5) |
| `CI=1 npm run test:e2e:full` (TEST_ADAPTER) | **74 / 74 passed** (+9 F30: menu / list / axe, search / no-match / sort / paging, create + validation, duplicate → server error, edit pre-fill, delete + cancel, bulk delete, list 500, reader 403 with 0 writes) |
| `next build` / `check:bundle` | pass / pass (38 files) |
| Generic harness self-test (local E2E mock, **not real backend**) | R1–R5, W0–W3 pass (1 POST, 1 PUT, 1 DELETE, read-back each); a re-run with the marker present → 0 mutations |

Existing tests updated:
- `dal.test.ts`: DAL surface includes `globalConfiguration`;
- `e2e/specs/authorization.spec.ts`: the reader menu now includes "Konfigurasi Umum";
- E2E mock and app grants extended.

## 6. Live READ

**NOT RUN** (pending). The agent process cannot see the `A55R_*` credentials.

Command, in the owner's terminal:

```bash
cd frontend
LIVE_MODULE=global-configuration npx vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts
```

It verifies:
- R1 default list (envelope, `created_at` presence via sort / format);
- R2 paging;
- R3 sort `key` / `createdAt`;
- R4 search + no-match;
- R5 detail existing / unknown (expected 404 per source; Content showed 403).

## 7. Live WRITE

**NOT RUN**: waiting for explicit confirmation (`MODULE_LIVE_WRITE_CONFIRM=yes`).

The plan, run by the generic harness:

```text
pre-check → CREATE one MIGRATION_LIVE_<UTC> → read-back → UPDATE → read-back → DELETE → read-back
```

Constraints:
- one attempt each, no retry; stop on any unverified step;
- one-shot marker;
- never touches existing keys.

Because the backend soft-deletes, the deleted test key stays in the table (soft-deleted) and is never re-used.

## 8. Findings

1. `created_at` is part of the CMS contract (corrects the A7 selection audit).
2. Three legacy defects were not ported: value pre-fill, false create success, invisible update failure.
3. **Accessibility:** the shared shadcn `destructive` button variant (tinted text on a `/10` background) fails axe `color-contrast` (E2E). F30 uses a solid destructive style. The template organisms `organisms/modal/alert-delete.tsx` / `alert-reject.tsx` still use the variant (not on any active route).
4. Boundary: `updatebyproductgposb2b` → F09; `/detail` (GET body) → F09 / F26.

## 9. Risks

| ID | Risk | Mitigation / status |
|---|---|---|
| R-F30-01 | Config keys drive backend behaviour (`MAINTENANCE`, `BANNER_INTERVAL`, …) | warning copy in the form and delete dialog; live writes only on a new test key; production grants need an owner decision (OD-05 / 06) |
| R-F30-02 | Backend `ORDER BY` built from `sort_by` / `asc_desc` without an allowlist | frontend sends allowlisted values only (unit-tested); backend fix recommended |
| R-F30-03 | Duplicate key → 500 (not 400 / 409); soft-deleted keys can't be re-used | shown as a server error with input kept; copy cannot say "duplicate" (not provable) |
| R-F30-04 | No backend max `take` | frontend caps at 50 |
| R-F30-05 | Delete / bulk transactions return without rollback on error | backend issue; reported |
| R-F30-06 | Bulk delete of unknown ids returns success | frontend only sends ids from the current page |
| R-F30-07 | Backend validation `data[]` is not mapped to fields (same as Content R1) | client + server zod catch required / length first |
| R-F30-08 | Unknown-id status at runtime (404 by source) | live R5 |
| R-F30-09 | Deployed backend version unknown | live smoke |
| Carried | S6 GET body, S7 API key, no restricted account | — |

## 10. Status

```text
F30 = HOLD (live verification pending, no defect blocker)
→ DONE / DONE-WITH-RISKS after live READ passes and the confirmed WRITE smoke verifies
  create / update / delete by read-back.
```
