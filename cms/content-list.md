# Legacy API Contract Evidence — Content list

| Field | Value |
|---|---|
| Evidence status (overall) | **Request: VERIFIED_BY_RUNTIME. Response shape: VERIFIED_BY_LEGACY_CODE. Real-backend behaviour: UNKNOWN** |
| Captured | 2026-09-30 (A5.5), legacy commit `00bc6ea`, Node 24.16.0 |
| Fixtures | `frontend/test/fixtures/api/legacy-content-list/` |
| Target implementation | `frontend/test/fixtures/content-list/` (reference; moves to `src/packages/content/` in the Content feature phase) |

## How the evidence was obtained

- **No real gateway was reachable.** There is no test gateway (OD-36), the corporate network blocks outbound HTTPS, and no real credentials were used. So there is **no VERIFIED_BY_CURL evidence against the real backend.**
- **What was run instead:**
  - the unmodified legacy Adonis app, locally, with `APIGATEWAY_URL` pointed at a local capture server (`/tmp/a55r/capture-gateway.mjs`, outside the repo);
  - login and the DataTables `POST /content/datatable` were driven with `curl`;
  - the capture server recorded the **outbound** request that legacy sends to the gateway, redacting the `Authorization` value at capture time.
- **What this proves:** the request legacy sends (VERIFIED_BY_RUNTIME). It confirms and extends A3.1 §7.
- **What it does not prove:** the response the real backend returns. The response bodies were chosen by the capture server in the shape the legacy code reads.
- **Cleanup:** the 3 session files the run created under `gpos-b2b-cms/tmp/sessions/` were deleted (98 pre-existing files untouched). Both processes were stopped, and legacy `git status` is unchanged.

## Legacy screen and route

| Item | Value | Evidence |
|---|---|---|
| Screen | S039 `contents/list` — "Konten" (menu group Bantuan Pengguna) | VERIFIED_BY_LEGACY_CODE (`resources/views/contents/list.edge`, `Extender.js`) |
| Browser → Adonis | `POST /content/datatable` (DataTables form post: `draw`, `columns[i][name]`, `order[0][column]`, `order[0][dir]`, `start`, `length`, `search[value]`, `_csrf`) | VERIFIED_BY_RUNTIME |
| Controller | `ContentController.datatable` → `ContentRepository.getListContent` → `ApiService.getData('/api/v1/cms/contents', 'GET', …)` | VERIFIED_BY_LEGACY_CODE |
| Target route | `/dashboard/content` (A4 matrix #169, registry `content.list`, capability `content.read`) | A4 |

Why this endpoint:
- it is MIGRATE scope and a real list screen;
- it has server-side paging, sort and search;
- it is the endpoint with the strongest existing runtime evidence (A3.1 §7 + this capture);
- its response mapping has no mapper exceptions and no hidden business logic (unlike Banner / Order);
- it needs no feature-specific identity headers (unlike Loyalty / UserVerification).

It has **no filters**, so none are invented.

## Endpoint (Adonis → gateway)

| Aspect | Value | Evidence |
|---|---|---|
| Method | `GET` | VERIFIED_BY_RUNTIME |
| Path | `/api/v1/cms/contents` (prefixed by `APIGATEWAY_URL`) | VERIFIED_BY_RUNTIME |
| Gateway host | UNKNOWN for the target (`API_HOST`, OD-02) | UNKNOWN |

### Request — query

| Key | Meaning | Values seen | Evidence |
|---|---|---|---|
| `sort_by` | sort column | `created_at` (default), `code`; columns: `code`, `name`, `is_active`, `created_at` | VERIFIED_BY_RUNTIME (values) / VERIFIED_BY_LEGACY_CODE (column list) |
| `asc_desc` | direction | `desc`, `asc` (**lower case**, straight from DataTables) | VERIFIED_BY_RUNTIME |
| `page` | 1-based page | `1`, `3` (= `start / length + 1`) | VERIFIED_BY_RUNTIME |
| `take` | page size | `5` | VERIFIED_BY_RUNTIME |
| `keyword` | search term | `''` (always sent, even when empty), `privasi` | VERIFIED_BY_RUNTIME |

Default initial draw: last column (`created_at`) `desc`, page 1, `take=5` (VERIFIED_BY_LEGACY_CODE: `BuildTable` `order: [[columns.length-1, 'DESC']]`, `pageLength: 5`; plus the runtime capture).

### Request — headers

| Header | Value | Evidence |
|---|---|---|
| `Authorization` | `Bearer <REDACTED>` (the session's access token) | VERIFIED_BY_RUNTIME |
| `Accept` | `application/json, text/plain, */*` | VERIFIED_BY_RUNTIME (axios default) |
| `Content-Type` | `application/json` | VERIFIED_BY_RUNTIME |
| `Api-Key` / Kong key | **not sent by legacy** | VERIFIED_BY_RUNTIME (legacy only; whether the real gateway requires one for the new client: UNKNOWN, OD-03) |
| Account / identity headers | none | VERIFIED_BY_RUNTIME |

### Request — body

Legacy **also sends the same parameters as a JSON body on the GET** (`{"sort_by":"created_at","asc_desc":"desc","page":1,"take":5,"keyword":""}`; numbers in the body, strings in the query). This is VERIFIED_BY_RUNTIME: axios is given `data: params` and `params: params`.

The target sends the **query only**. Whether the backend reads the query, the body or both for this endpoint is **UNKNOWN**; that the query suffices is **INFERRED**, because all five keys are present in it. See OD-31 and RK-A55-02.

### Sanitized cURL (Adonis → gateway, as captured)

```bash
curl 'http://<APIGATEWAY_URL>/api/v1/cms/contents?sort_by=code&asc_desc=asc&page=3&take=5&keyword=privasi' \
  -X GET \
  -H 'Accept: application/json, text/plain, */*' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer <SESSION_TOKEN>' \
  --data-raw '{"sort_by":"code","asc_desc":"asc","page":3,"take":5,"keyword":"privasi"}'
```

## Response

| Aspect | Value | Evidence |
|---|---|---|
| Success status | HTTP 200 **and** envelope `code == 200` (the controller checks `result['code'] == 200`) | VERIFIED_BY_LEGACY_CODE |
| Envelope | `{ code, message, data }` | VERIFIED_BY_LEGACY_CODE (A2 §8.1) |
| List | `data.rows: Row[]`, `data.total_rows: number` | VERIFIED_BY_LEGACY_CODE |
| Row fields read by legacy | `id`, `code`, `name`, `is_active` (truthy → "Active"), `content_date` (formatted with moment) | VERIFIED_BY_LEGACY_CODE |
| Other row fields (e.g. `value`) | UNKNOWN | UNKNOWN |
| Field types | `id` number or string, `is_active` boolean, `content_date` a date string, `total_rows` a non-negative integer | **INFERRED** (legacy only tests truthiness / passes to moment) |
| Pagination semantics | `total_rows` = count of matching records (legacy uses it for both `recordsTotal` and `recordsFiltered`); no page number is read from the response | VERIFIED_BY_LEGACY_CODE; whether `total_rows` counts **after** the keyword filter is UNKNOWN |
| Sorting semantics | server-side, one column | VERIFIED_BY_LEGACY_CODE; the collation / null ordering is UNKNOWN |
| Search semantics | server-side `keyword`; which columns it matches is UNKNOWN | UNKNOWN |
| Filtering | none on this endpoint | VERIFIED_BY_LEGACY_CODE |
| Sort column vs displayed column | the date column **shows `content_date` but sorts by `created_at`** | VERIFIED_BY_LEGACY_CODE (kept as is; product question, OQ-1) |

## Error responses

| Condition | Real backend | Legacy app behaviour | Evidence |
|---|---|---|---|
| 401 | UNKNOWN body | collapsed to an **empty 200 draw** (`recordsTotal: 0, data: []`); the session persists | VERIFIED_BY_RUNTIME (A3.1 + A5.5) |
| 403 | UNKNOWN | empty draw | VERIFIED_BY_RUNTIME |
| 400 / 422 | UNKNOWN which is used and the field-error shape | empty draw | VERIFIED_BY_RUNTIME (legacy side only) |
| 500 | UNKNOWN body | empty draw | VERIFIED_BY_RUNTIME |
| `data.rows` not an array (200) | — | 200 with **rows of `undefined` cells** (silent corruption) | VERIFIED_BY_RUNTIME (A5.5) |
| Connection refused | — | empty draw | VERIFIED_BY_RUNTIME (A3.1) |
| Timeout | — | 240 s axios timeout | VERIFIED_BY_LEGACY_CODE |

The target does **not** reproduce any of these collapses. See the mapping table in the A5.5 report §12.

## Authorization

- **Legacy:**
  - menu visibility: superadmin only (VERIFIED_BY_LEGACY_CODE, `Extender.js`);
  - route access: every authenticated account (VERIFIED_BY_RUNTIME, A3.1 §6);
  - backend authorization: UNKNOWN (A2-U04).
- **Target:** capability `content.read` (A5.4 vocabulary). The interim production policy does **not** grant it, so the page is 403 until the Content phase adds a grant (OD-05 / OD-06).

## Unknowns (to verify on the real gateway, OD-36)

1. Whether the query string alone is honoured (vs the GET body) — OD-31.
2. Real field types (`id`, `is_active`, `content_date` format / timezone, `total_rows` number vs string).
3. Whether `total_rows` is pre- or post-search.
4. Which fields `keyword` searches.
5. Error bodies and statuses (400 vs 422, field-error shape, 401 / 403 bodies).
6. API key requirement (OD-03) and gateway host (OD-02).
7. Maximum `take` accepted (legacy "All" = `length -1` → `take=-1`, not carried).
8. Whether `asc_desc` is case-sensitive (legacy sends lower case; other screens send `ASC` / `DESC`).

## Migration notes

- The wire names (`sort_by`, `asc_desc`, `take`, `keyword`, `rows`, `total_rows`, `is_active`, `content_date`) exist only in `repository/dto.ts`.
- The domain uses `TableQuery` / `Page<ContentListItem>` with `active` / `contentDate`, and the URL uses `?page&per_page&sort=field.asc&q` (A4 §10.3).
- The target mirrors the evidence: it always sends all five keys, with `keyword=''` when empty and a lower-case direction.
