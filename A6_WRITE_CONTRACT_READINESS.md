# A6 — Write Contract Readiness Audit (Content CREATE / UPDATE)

| Field | Value |
|---|---|
| Date | 2026-10-01 |
| Type | Audit only. No code, test, harness or config changes. **No request of any kind was sent to the real backend** |
| Inputs | Legacy `gpos-b2b-cms` (`ContentController.js`, `ContentRepository.js`, `Validators/ContentCreateEdit.js`, `views/contents/{create,edit}.edge`, `Helper/ApiService.js`, `start/routes.js`); A6 runtime capture `test/fixtures/api/legacy-content-write/request-captured.json`; `contracts/legacy-api/content-write.md`; A5.5R re-gate evidence (`$TMPDIR/a55r-live/evidence.json`, run 2026-10-01T02:28:22Z); A6-R attempt-3 probes; current `src/packages/content/**`, `src/shared/infrastructure/http/{gateway-envelope,gateway-errors}.ts`, `src/shared/forms/apply-action-error.ts`, `src/shared/infrastructure/dal/run-action.ts` |

## Status

```text
A5.5R      = GO-WITH-RISKS        (unchanged)
A6 READ    = SUBSTANTIALLY VERIFIED (list, detail, pagination, code sort, search — real backend)
A6 CREATE  = READY-WITH-RISKS     (for a future controlled verification; not executed)
A6 UPDATE  = READY-WITH-RISKS     (only after CREATE verification yields a dedicated test record; not executed)
A6         = BLOCKED              (not complete: CREATE / UPDATE unverified on the real backend)
```

**Classification legend:**
- **VERIFIED** = observed at runtime. Either the legacy app's outbound request (local capture) or the real backend (A5.5R); the source is always named.
- **INFERRED** = derived from code, with the reasoning given.
- **UNKNOWN** = no evidence.
- **N/A** = not applicable.

## 1. Legacy CREATE contract

Flow: browser `POST /content` → `ContentController.store` → `ContentRepository.createContent` → `ApiService.getData(…, 'POST')` → gateway.

### Request

| Item | Legacy | Class |
|---|---|---|
| Method / path | `POST /api/v1/cms/contents` | VERIFIED (legacy outbound capture) |
| Path / query parameters | none. The non-GET branch of `ApiService.getData` sets `data` only, no `params` | VERIFIED (code) + capture |
| Content type | `application/json` (axios) | VERIFIED (capture) |
| Auth header | `Authorization: Bearer <access_token>`; no API key | VERIFIED (capture) |
| Body | `{code, name, is_active, value}`: exactly these 4 keys, built explicitly | VERIFIED (code + capture) |
| `is_active` | boolean; `request.is_active == 'true' ? true : false` (anything else → `false`) | VERIFIED |
| `value` | string; an empty textarea arrives as `null` (Adonis `request.post()` normalisation) | VERIFIED (capture) |
| Required | `code`, `name` (`ContentCreateEdit`: `required`); failure → redirect back, **no gateway call** | VERIFIED (code + capture) |
| Optional / nullable | `value` (may be `null`) | VERIFIED (request side) |
| Defaults | `is_active` select shows "Active" first, so it is the default | VERIFIED (view) |
| Length / format rules | none in legacy | VERIFIED (absence in validator) |
| Trimming / normalisation | none besides the `null` for empty fields | VERIFIED (code) |
| Authorization | `store` does **not** call `Authorization.checkAuth` (the other actions do); the route group requires a logged-in session | VERIFIED (code) |

### Response

| Item | Legacy | Class |
|---|---|---|
| Success condition | envelope `result.code == 201`; anything else is failure. A `code 200` reply was treated as failure (A6 capture) | VERIFIED (legacy code / capture). Real backend: **UNKNOWN** |
| HTTP status | not read separately. `ApiService` returns `response.data` on 2xx | VERIFIED (code) |
| Returned object / id / fields | never read | UNKNOWN |
| Server-generated fields / timestamps | never read | UNKNOWN |

### Errors

| Item | Legacy | Class |
|---|---|---|
| Transport error | `ApiService` returns `{code: <HTTP status>, data: <error body>}`. No response at all → `{code: 404, data: 'Error Request URI'}` | VERIFIED (code) |
| Validation / business / 401 / 403 / 409 / 5xx | all collapse to one generic flash: "Konten tidak berhasil ditambahkan". The error body is **never parsed** | VERIFIED (code) |
| Field-level errors from the backend | never displayed | VERIFIED (code). Backend shape: UNKNOWN |

## 2. Legacy UPDATE contract

Flow: `GET /content/:id/edit` → `edit` (`GET /api/v1/cms/contents/:id`), then `POST /content/:id?_method=PUT` → `update` → `editContent`.

### Request

| Item | Legacy | Class |
|---|---|---|
| Method / path | `PUT /api/v1/cms/contents/{id}`, where `id` is the route param | VERIFIED (capture) |
| Query | none | VERIFIED (code) |
| Content type / auth | JSON / Bearer, no API key | VERIFIED (capture) |
| Body | `{code, name, is_active, value}`: all 4 fields, every time | VERIFIED (code + capture) |
| Partial vs full replacement | the client always sends the full field set (full-replacement *usage*). Whether the backend treats omitted or `null` fields as "unchanged" or "clear" is unknown | client: VERIFIED. Backend semantics: UNKNOWN |
| `is_active` | the edit select is **never pre-selected**, so it submits "Active" unless changed (legacy defect) | VERIFIED (capture) |
| `value` empty | `null` | INFERRED: same `request.post()` normalisation as create |
| Validation | `code`, `name` required; failure → redirect back, no gateway call | VERIFIED (code) |
| Authorization | `checkAuth` (logged in) | VERIFIED (code) |

### Response

| Item | Legacy | Class |
|---|---|---|
| Success | envelope `code == 200` | VERIFIED (legacy code). Real backend: UNKNOWN |
| Returned object | never read | UNKNOWN |

### Errors

| Item | Legacy | Class |
|---|---|---|
| Any failure | flash key `Warning` (capital W), which no view renders, so the failure is silent | VERIFIED (code, A3.2) |
| Not found (edit load) | any non-200 on `GET /:id` → "Konten tidak ditemukan" → list | VERIFIED (code) |
| Validation / 403 / 404 / 409 / 5xx body | never parsed | UNKNOWN |

## 3. Legacy vs current Next.js

| Contract | Legacy | Current Next.js | Status |
|---|---|---|---|
| CREATE method | POST | POST (`GatewayContentRepository.create`) | COMPATIBLE |
| CREATE endpoint | `/api/v1/cms/contents` | `CONTENT_LIST_PATH` = same | COMPATIBLE |
| CREATE body | `{code, name, is_active:boolean, value:string\|null}` | `toContentBody`: same 4 keys, `''` → `null`; test asserts equality with the capture | COMPATIBLE |
| CREATE headers | Bearer, no API key | Bearer (session) **+ `Api-Key`** (configured) + `X-Request-Id` | INTENTIONAL MIGRATION CHANGE (API key requirement still UNKNOWN, S7) |
| CREATE validation | `code`, `name` required; no message shown; input lost | zod: `code` / `name` trimmed, required, ≤ 255; `value` ≤ 100 000; client + server (use case); messages shown, input kept | INTENTIONAL MIGRATION CHANGE (trim + length caps are INFERRED safety bounds, not legacy rules) |
| CREATE success response | envelope `code 201`, body unread | `requestEnvelope(okCode 201)`; `data.id` optional; any other 2xx code → `Contract` | COMPATIBLE with legacy code. Real code UNKNOWN (see R6) |
| CREATE error shape | body never parsed; generic flash | `errorFromStatus`: 400 + `{errors:{…}}` → Validation, else Business (backend `message` shown); 401 / 403 / 404 / 409 / 422 / 429 / 5xx typed | INTENTIONAL MIGRATION CHANGE. Real shape: see §6 (POTENTIAL DEFECT for field errors) |
| UPDATE method | PUT | PUT | COMPATIBLE |
| UPDATE endpoint | `/api/v1/cms/contents/{id}` | same (`pathParams`, id checked by `isContentId`) | COMPATIBLE |
| UPDATE body | full 4-field body | same full 4-field body | COMPATIBLE |
| UPDATE semantics | full set sent; backend semantics unknown | full set sent; `value ''` → `null` | UNKNOWN (backend null / partial semantics) |
| UPDATE `is_active` | never pre-selected (defect) | pre-filled from detail `is_active`, which is VERIFIED present (boolean) on the real backend | INTENTIONAL MIGRATION CHANGE (defect fix) |
| UPDATE validation | as create | as create | INTENTIONAL MIGRATION CHANGE |
| UPDATE success response | envelope `code 200` | `okCode 200` | COMPATIBLE with legacy. Real code UNKNOWN |
| UPDATE error shape | silent (`Warning` key) | typed errors shown | INTENTIONAL MIGRATION CHANGE. Real shape UNKNOWN |
| UPDATE missing record | any non-200 on edit load → list | `content.get` → 404 ⇒ `notFound()`, 403 ⇒ AccessDenied. Real unknown ID returned **403** | POTENTIAL DEFECT (UX: "access denied" instead of "not found"; see R3) |

## 4. Current write path (traced)

```text
ContentForm (client: RHF + zodResolver(contentSchema), pending guard)
  → createContentAction(input) | updateContentAction.bind(null, id)(input)     ('use server')
  → runAction('content.create' | 'content.update')  → getMutationServices()    (DAL, one scope)
  → content.create(input) | content.update(id, input)                          (use case)
       authorization.require('content.create' | 'content.update')   ← before any I/O
       update: isContentId(id) else NotFound (0 calls)
       contentSchema.safeParse(input) → Validation(fieldErrors) (0 calls)
  → GatewayContentRepository.create | update
       toContentBody → POST /api/v1/cms/contents (okCode 201) | PUT …/{id} (okCode 200)
       errors → toFormErrors (wire field names → form names via CONTENT_FIELD_MAP)
  → GatewayClient (Bearer from session, Api-Key, X-Request-Id; mutation timeout; 401 → refresh,
       mutation NOT replayed)
  ← ok → redirect('/dashboard/content?saved=created|updated')
  ← fail → ActionResult → applyActionError → field errors / form-level alert
```

| Point | CREATE | UPDATE |
|---|---|---|
| Form fields | Kode, Nama, Status (select → boolean), Isi | same, pre-filled from `GET /:id` |
| `id` | not sent | path parameter only (not in body); bound server-side via `.bind(null, view.data.id)`; re-validated by `isContentId` |
| `is_active` | boolean from the select; default `true` | from detail; required in detail (`toContent` → Contract if missing) |
| Empty strings | `code` / `name` trimmed → empty rejected; `value ''` → `null` on the wire | same |
| Field omission | never: all 4 keys always sent | never |
| Unchanged fields | n/a | re-sent as-is (full body) |
| Response mapping | `toCreatedId(data)` optional; success = redirect | success = redirect |
| Authorization | route guard (`content.create`) + use case `require` + Server Action through the DAL | route guard (`content.update`) + use case `require`; the page also needs `content.read` for `GET /:id` |

## 5. Validation error contract

| Layer | Shape | Class |
|---|---|---|
| Legacy client | backend error body never parsed; Adonis's own validator messages for `code` / `name` (never rendered, A3.2) | VERIFIED (code) |
| Real backend: auth endpoints | HTTP 400, `{code:400, status:"FAILED", error_code:"ERR_VALIDATION_ERROR", message:"Validation Error", data:[{FailedField:"<Struct>.<Field>", Tag:"<rule>", Value:<input>}]}` | VERIFIED (A6-R attempt 3: login / refresh probes) |
| Real backend: Content create / update | **not observed** | NOT VERIFIED |
| Current mapping (`errorFromStatus`) | 400 with `{errors:{field:[…]}}` → `Validation(fieldErrors)`; 400 without `errors` → `Business(message)`; 422 → Validation (maybe empty) | code |
| What the observed auth-style shape would become | 400, no `errors` key → **`Business` with message "Validation Error"** → one form-level alert; **no field-level errors**. `FailedField` names (`<Struct>.<Field>`) are not in `CONTENT_FIELD_MAP` | INFERRED (code path applied to the observed auth shape) |
| Use case / Server Action / form | `Business` → `ActionResult` failure → `applyActionError` → form banner; input kept | code |
| Final status | **NOT VERIFIED** for Content. Safe (fails visible, input kept, no secrets logged), but degraded: no per-field messages if Content uses the auth-style shape. Client and server zod validation catches `code` / `name` before any request, so only backend-only rules (e.g. a uniqueness check, if any) would reach this path | NOT VERIFIED |

Security note: the observed shape echoes `Value` (the submitted input). The application never logs gateway bodies and shows only `message` for Business errors, so `Value` is neither logged nor displayed.

## 6. `created_at` risk

| Check | Current A6 | Observed real data |
|---|---|---|
| Expects `created_at` in rows | no (only an optional `content_date`) | neither `created_at` nor `content_date` present |
| Displays a created-date column | **yes**: column `createdAt`, label "Tanggal Konten", value `contentDate`, shows "—" when absent | will always show "—" |
| Sorts by `created_at` | **yes**: `CONTENT_TABLE_SPEC.defaultSort = createdAt desc` → `sort_by=created_at` | accepted (200); ordering NOT VERIFIED |
| In DTO / detail | detail does not use it | — |

Classification: **OPEN CONTRACT RISK**. It has no effect on write safety. After a successful create, the redirect lands on the list sorted by `created_at desc`; whether the new row appears first is NOT VERIFIED.

## 7. Unknown-ID 403 risk

- The real backend returned `GET /api/v1/cms/contents/{unknown-id}` → **403** (one observation; the reason is UNKNOWN). The application maps 403 → `Forbidden` and 404 → `NotFound`.
- **The update page depends on 404 for "missing resource":** `resolvePageResult` → `notFound()` only for `NotFound`. With the observed 403 it renders **AccessDenied**.
- `updateContentAction` on an ID that disappeared would map a 403 to `Forbidden` the same way. Not tested; no write against a nonexistent ID was sent.
- Classification: OPEN CONTRACT RISK / POTENTIAL UX DEFECT. The mapping is unchanged.

## 8. Authorization

| Check | Finding |
|---|---|
| Capabilities | `content.read`, `content.create`, `content.update` in the closed vocabulary |
| Enforcement | (1) `guardRoute(routeId)` per page; (2) use case `authorization.require(...)` before validation and I/O; (3) Server Actions run only through `runAction` → DAL → use case, so a direct action call is still checked |
| Before gateway access | yes. TEST_ADAPTER: unit + E2E "reader instance → 0 writes / 0 details". REAL_BACKEND: S8 local denial → 0 gateway calls |
| Visibility vs authority | "Tambah Konten" / "Ubah" visibility uses `authorization.can(...)` (UI only); authority is the use case `require` |
| Grant source | `AUTHZ_INTERIM_GRANTS` (default empty → everyone 403); grants apply to every authenticated user; production grants are an **owner decision (OD-05/06), UNKNOWN** |
| Backend write permission of the test account | **UNKNOWN.** Login returns `role_id` / `role_name` but no permission list. Read is VERIFIED |
| Backend denial (restricted account) | NOT VERIFIED (no second account) |

## 9. Real write readiness

**CREATE: READY-WITH-RISKS**

Not READY, because these are unverified on the real backend:
- the success envelope code (legacy expects 201);
- the response body;
- the error / validation shape;
- the test account's write permission;
- whether the API key is required.

The request side is fully known and matches the legacy runtime capture exactly; a test enforces that. Nothing found makes a *controlled* verification unsafe, provided the future task defines:

1. **Owner approval** for writes on the non-production gateway, plus a test-record convention (e.g. `code = A6R-TEST-<timestamp>`, inert `value`).
2. **Cleanup strategy.** Delete is not migrated and the legacy `DELETE /api/v1/cms/contents/{id}` is LEGACY_CODE only (not captured). Either approve a residual test record, or separately approve and verify DELETE.
3. **False-failure / duplicate risk (R6).** If the real create answers with an envelope code other than 201 (e.g. 200), the app reports `Contract` although the record was created, and a user retry would create a duplicate. The same applies to a mutation timeout after the backend committed. The controlled test must be **one attempt, no retry**, followed by a read-back via list / search on the test code.
4. A **harness extension** limited to `POST` / `PUT` on the test record. The live harness is read-only today; the safety gate stays unchanged.

**UPDATE: READY-WITH-RISKS**

Same request-side certainty. The full-body PUT matches the legacy capture, and the pre-fill `is_active` is VERIFIED in the real detail. It must target only the record created by the CREATE verification (or an owner-designated test record), so it is sequenced **after** CREATE.

Additional risks:
- backend `null` / partial semantics for `value` (R7);
- the 403-vs-404 handling of a missing record (R3);
- success code 200 unverified.

Verification needs a real read-back (`GET /:id`) after the PUT.

## 10. Known contract risks

| ID | Risk | Status |
|---|---|---|
| R1 | Validation error shape for Content: auth endpoints use `data[{FailedField, Tag, Value}]`; the mapper expects `{errors:{…}}`, so backend field errors would appear as one form-level "Validation Error" alert | NOT VERIFIED (Content); POTENTIAL DEFECT (degraded UX, not unsafe) |
| R2 | No `created_at` / `content_date` in real rows: the "Tanggal Konten" column is always "—"; the default `created_at desc` ordering is unverified | OPEN CONTRACT RISK |
| R3 | Unknown ID → 403: the update page shows AccessDenied instead of `notFound()`; the semantics are UNKNOWN | OPEN CONTRACT RISK |
| R4 | S6 GET body: not needed by the app (query-only verified); backend acceptance unknown | NOT VERIFIED |
| R5 | S7 API key: always sent; whether it is required is unknown | NOT VERIFIED |
| R6 | CREATE: success code 201 (legacy) unverified; response body unknown; false-failure → duplicate risk on retry or timeout; duplicate-`code` (uniqueness / 409) behaviour unknown | UNKNOWN |
| R7 | UPDATE: success code 200 unverified; `value: null` semantics (clear vs ignore) unknown; full vs partial replacement unknown (mitigated: the full body is always sent) | UNKNOWN |
| R8 | Authorization: production grant model (OD-05/06) and the test account's backend write permission unknown; no restricted account for a denial test | UNKNOWN |
| R9 | Cleanup: no migrated DELETE; the legacy DELETE / bulk DELETE contract is uncaptured | NOT VERIFIED / out of captured contract |
| R10 | Mutation 401: refresh happens, but the mutation is not replayed (by design), so the user must resubmit | VERIFIED design (TEST_ADAPTER); real POST 401 path not exercised |

## 11. Follow-up recommendations (not done in this audit)

- **A6R Controlled Real CREATE Verification**, with: owner approval, test-record convention, one attempt / no retry, read-back, a cleanup decision, and a harness write allowlist scoped to the created ID.
- **A6R Controlled Real UPDATE Verification**, after CREATE, on the created record only, with read-back.
- After a real Content validation response is observed (only if it occurs naturally, e.g. a duplicate code in the controlled test), align `errorFromStatus` / `CONTENT_FIELD_MAP` (R1).
- Decide R2: drop or replace the date column and the default sort, or ask the backend for the field.
- Decide R3: accept 403 as the contract (and map the update page accordingly), or ask the backend for 404.
- Add an assertion to the unknown-ID harness step once R3 is decided.
