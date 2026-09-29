# A4 — API / Data Access Architecture

| Item | Value |
|---|---|
| Phase | A4 (architecture only) |
| Date | 2026-09-29 |
| Evidence | A2 §5–12 (243 gateway calls / 220 endpoints; envelope; error flattening); A3.1 §7–8 (runtime envelopes and error mapping); B0 §B0.6 (target `RestAPI`) |
| Related | `A4_TARGET_ARCHITECTURE.md` §2, §8–11; `A4_AUTH_SESSION_ARCHITECTURE.md` |

## 1. Layering

```text
UI (Server Component / Client Component)
  ↓  (server) calls use case             (client) calls Server Action or /api/bff Route Handler
Application: Query / Command use cases     packages/<f>/usecases  → Result<T, AppError>
  ↓  depends on port interfaces
Typed API Contract: domain ports + models  packages/<f>/domain     (framework-free)
  ↑  implemented by
Repository (DTO ↔ domain mapping)          packages/<f>/repository (server-only)
  ↓
HTTP Transport: gateway client             shared/infrastructure/http (server-only)
  ↓
API Gateway → Backend                      (not migrated; KNOWN FROM LEGACY CLIENT)
```

**Legacy endpoint names may be mapped, but they never become the domain model.** For example, the gateway DTO `{rows, total_rows}` maps to `Page<T>`, and `customer_ids` maps to `customerIds` inside the domain only. The repository keeps the original wire names in its `dto.ts` files, so the audit trail to A2 stays intact.

## 2. Request model

```ts
// shared/infrastructure/http/types.ts (server-only)
interface GatewayRequest<TBody = unknown> {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string                         // path template, e.g. '/api/v1/cms/banners/{id}'
  pathParams?: Record<string, string>  // encoded by the client (encodeURIComponent)
  query?: Record<string, string | number | boolean | string[] | undefined>
  body?: TBody                         // JSON; only explicit fields (never forward raw form bodies, A2-H06)
  auth: 'session' | 'none'             // 'none' only for login
  timeoutMs?: number                   // default per policy (§11)
  signal?: AbortSignal                 // request cancellation
  idempotent?: boolean                 // default: GET/PUT/DELETE true, POST/PATCH false
}
```

**Legacy conformance notes** (to keep in the repositories):
- GET with a body: legacy sends `filters` in the **GET body** (A3.1 §7, Product datatable). The target transport must support this per endpoint until the backend confirms query-string support (OD-31).
- Bulk delete: legacy uses `DELETE <base>/bulk` with body `{ ids }`.
- Legacy page / size: `page` (1-based), `take` (sometimes a string). The repository sends numbers unless the backend requires strings (OD-31).

## 3. Response model

```ts
// Gateway envelope (KNOWN FROM LEGACY CLIENT, A2 §8.1)
interface GatewayEnvelope<T> { code: number; message?: string; data?: T }
interface GatewayList<T> { rows: T[]; total_rows: number; total_page?: number; data_per_page?: number; page?: number }

// Domain-level
type Result<T, E = AppError> = { ok: true; value: T } | { ok: false; error: E }
```

The client parses the envelope and then **validates `data` with zod at the repository boundary** (runtime schema per DTO). A shape mismatch becomes `AppError.Contract`, never a crash in rendering (fixes the legacy mapper TypeErrors → 302 redirects, A3.1 §7).

## 4. Error model (AD-04)

```ts
// shared/errors/app-error.ts (framework-free)
type AppError =
  | { kind: 'Validation'; fieldErrors: Record<string, string[]>; message?: string }  // 400/422 with field info, or local zod
  | { kind: 'Unauthenticated' }                  // 401 after refresh-once → session layer handles
  | { kind: 'Forbidden'; message?: string }      // 403
  | { kind: 'NotFound'; resource?: string }      // 404 (real 404 only)
  | { kind: 'Conflict'; message?: string; details?: unknown } // e.g. personalization relation conflict, overlapping voucher period
  | { kind: 'Business'; message: string; code?: string }     // 400 with message, no field info
  | { kind: 'RateLimited'; retryAfterSec?: number }          // 429
  | { kind: 'Server'; status: number }            // 5xx
  | { kind: 'Timeout' }                           // client-side timeout (≠ NotFound, fixes A2-H04)
  | { kind: 'Network' }                           // DNS/refused/reset
  | { kind: 'Contract'; detail: string }          // envelope/schema mismatch
  | { kind: 'Unknown' }
```

| Source condition | Legacy behavior (evidence) | Target `AppError` |
|---|---|---|
| Timeout | `{code:404, data:'Error Request URI'}` → "not found" (A2 §8.1, A3.1 §8) | `Timeout` |
| Connection refused | Same as above | `Network` |
| 401 | Collapsed to 400 / empty table; the session persists (A3.1 §8) | `Unauthenticated`, after the refresh flow |
| 403 | Collapsed / generic | `Forbidden` |
| 404 | "not found" redirect | `NotFound` |
| 400 + message | Flash `warning` (often not displayed) | `Business` or `Validation` |
| 5xx | Empty table / generic flash | `Server` |
| Malformed body | Mapper exception → 302 (A3.1 §7) | `Contract` |

**User-facing messages** are mapped from `kind` in the presentation layer, in Indonesian UI copy (OD-20). Gateway `message` text may be shown for `Business` / `Validation` / `Conflict` only after sanitization (security document §7).

## 5. Pagination, filter and sort models

- `TableQuery` / `Page<T>` are defined in `A4_TARGET_ARCHITECTURE.md` §10.2.
- Each repository maps `TableQuery` → gateway params:

| Domain | Gateway (legacy wire names, A2 §7.3) |
|---|---|
| `page` | `page` (1-based) |
| `pageSize` | `take` (legacy also `limit` for Loyalty) |
| `sort[0]` | `sort_by` + `asc_desc` (single-column sort only; multi-sort not supported by legacy endpoints) |
| `search` (+ `searchField`) | `keyword` (+ `search_by`) |
| `filters` | Feature-specific: flat (`status`, `type`, `is_multi_period`) or `filters: [{column, opr, value}]` (Product, Notification, UserVerification, UserManagement, MutasiRedeem) |
| Date range | `start_date` / `end_date` as `YYYY-MM-DDT00:00:00.000+07:00` (Payment) etc. **Timezone policy: OD-21** |

**Filters dropped by the legacy BFF** (Mutasi `mutation_type`, `no_invoice`; Loyalty `search`; A1-F11) are implemented in the target **only if the backend supports them** (OD-32). The target must not show filters that have no effect.

## 6. Mutation result

```ts
// shared/errors/action-result.ts
type ActionResult<T = void> =
  | { ok: true; data?: T; message?: string }        // message → success toast
  | { ok: false; error: AppError; fieldErrors?: Record<string, string[]> }
```

- Server Actions return `ActionResult`. **They never redirect for errors**, and they redirect for success only when the flow requires navigation, via `redirect()` after a successful result.
- Bulk mutations return `{ ok, data: { succeeded: string[], failed: { id, error }[] } }`.
- The legacy inverted bulk-delete flash (A1-F02, A3.2 §20) is impossible here, because the feedback is derived from `succeeded` / `failed`.

## 7. Authentication contract (transport-level)

- `auth: 'session'` → the transport obtains the access token from the session layer and attaches `Authorization: Bearer <token>`.
- On a 401, the transport runs the session layer's refresh (single-flight) and retries **once** (auth document §2.4).
- The feature-specific identity headers seen in legacy (Loyalty: `X-Userid` = email, `X-Useremail`, `X-Username`, `X-RoleName`; UserVerification: `X-UserId` = user id, A3.1 §12) are added by **those repositories only**, derived from the session subject. Whether other endpoints need them: OD-33.
- API key: added centrally by the transport only if OD-03 confirms it. Never in the browser.

## 8. Endpoint mapping

- The full legacy route → gateway inventory is `AUTH_API_PERMISSION_MAP.md` §6.2 (310 routes → 220 endpoints).
- Each target feature repository owns the gateway paths of its legacy repository.
- Base-path families: `/api/v1/auth/*`, `/api/v1/cms/*` (feature bases), `/api/v1/cms/patient-loyalty/*`, `/api/v1/cms/users/need-approvals*`, `/api/v1/files/signurl`.
- Whether the target uses these paths or the B0 template's gateway (`API_HOST`, `/auth/login`, `/roles`, …) is **OD-02 (blocking integration)**.

## 9. Upload contract

```text
Client (Upload molecule) ── POST /api/bff/uploads/sign {fieldKey, fileName, contentType, size} ──▶ Route Handler
  session check (AC-05) + CSRF checks (Origin + JSON)
  policy(fieldKey) → {allowedTypes, maxBytes, allowedExtensions}  → reject 400 Validation if violated
  gateway POST /api/v1/files/signurl {file_name, category, content_type}   (only these fields)
  ◀── {uploadUrl, fileUrl, headers?: {Content-Type}, expiresAt?}
Client ── PUT uploadUrl (file bytes, Content-Type as returned) ──▶ Object storage  (direct; Next.js never proxies bytes)
  progress events → Progress atom; failure → retry/remove
Form value ← fileUrl  (the URL string is submitted with the form, as in legacy)
```

| Aspect | Rule |
|---|---|
| Policy per field | Declared by the feature (images: `image/png`, `image/jpeg`, `image/webp`, ≤ 5 MB as in legacy; CSV: `text/csv`, extension `.csv`, size per backend limit, OD-34) |
| Client validation | Same policy (fast feedback: size, type, image ratio). **The ratio check blocks the upload** (it didn't in legacy, A2 §10) |
| Server validation | The BFF sign handler enforces type, size and extension (improves on A2-M05). Storage-side enforcement (content-length conditions in the signed URL): backend dependency OD-18 |
| Signed URL secrecy | Never logged; never persisted; never rendered in the UI (A3.1 §11 practice) |
| CSV imports | After upload, the feature calls its import use case with the `fileUrl` (e.g. gamification upload-csv). The legacy **server-side fetch of an arbitrary browser-supplied URL** (Loyalty `validate-branch-csv`, A2-M04) is restricted to URLs on the configured storage host |
| Principal image | Legacy multipart to Adonis local disk (`public/images`). Target: signed-URL flow **if** the backend accepts an image URL for principals (OD-18). Otherwise DEFER |

## 10. Retry policy

| Case | Policy |
|---|---|
| Idempotent requests (GET, PUT, DELETE) with `Network` error | 1 automatic retry, 300 ms jitter |
| `Timeout` | No automatic retry (the operation may still be running); surface a retryable error |
| 401 | Refresh single-flight, then retry once (auth contract) |
| 429 | No automatic retry; surface `RateLimited` (honour `Retry-After` in the UI copy) |
| 5xx | No automatic retry for mutations. GET: user-initiated retry via the UI |
| Non-idempotent POST / PATCH | Never auto-retried, except the post-refresh retry (auth §2.4) |

## 11. Timeout policy

| Class | Default |
|---|---|
| Reads (GET) | 15 s |
| Mutations | 30 s |
| Uploads (signing) | 15 s |
| CSV import / long-running | 120 s, or backend-specific (OD-34) |

Legacy used 240 s for everything (A2 §7.1). These defaults are **starting values**, to be tuned against runtime measurements in A5 (performance document).

## 12. Cancellation policy

- Server: each request gets an `AbortSignal` tied to the incoming request lifetime (request-scoped). Aborted navigations do not continue calling the gateway beyond in-flight requests.
- Client: async-select searches cancel the previous request (AbortController) on each keystroke (debounced). Uploads can be cancelled by the user.
- Mutations are not cancelled after dispatch (the UI disables re-submission while pending).
