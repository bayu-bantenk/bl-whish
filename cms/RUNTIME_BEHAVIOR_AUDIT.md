# A3.1 — Runtime / Behavioral Verification

| Item | Value |
|---|---|
| Phase | A3.1: runtime and behavioral verification (read-only toward the source) |
| Date | 2026-09-28 (WIB) |
| Inputs | `FRONTEND_SCOPE.md` (A0), `ROUTE_SCREEN_MAP.md` (A1), `AUTH_API_PERMISSION_MAP.md` (A2) |
| Evidence labels | `[RUNTIME]`, `[RUNTIME — CONFIRMS SOURCE]`, `[RUNTIME — CONTRADICTS SOURCE]`, `[NOT EXECUTED — SAFETY]`, `[NOT OBSERVABLE]` |
| Secrets | None recorded. All tokens, passwords and identities used were **synthetic**. The real `.env` values were never printed, and the prefilled login values were measured by length only. |

---

## 1. Executive Summary

A3.1 ran the **real legacy Adonis application** (unmodified source, commit `00bc6ea`) on `127.0.0.1`. The API Gateway was replaced by a **local mock gateway**, set through process environment overrides only. Nothing touched the real gateway, the real backend or real object storage. So:

- **Adonis-layer behavior is verified at runtime**: session, CSRF, redirects, DataTables envelope, error mapping, menus, route access, headers sent upstream, and logging.
- **Gateway and backend behavior is `[NOT OBSERVABLE]`**: the real login payload, real token lifetime, backend authorization, and real signed-URL policy. These need a test gateway and test accounts. No test gateway or test accounts were supplied, and the credentials prefilled in the legacy HTML were deliberately **not** used.

**Key runtime results:**
1. **Topology is confirmed.** The browser only talks to Adonis. Adonis sends `Authorization: Bearer <session token>` to the gateway. No token, gateway URL or API key reaches the browser. `[RUNTIME — CONFIRMS SOURCE]`
2. **The session is a verbatim copy of the gateway login `data`.** Adonis stores whatever keys the gateway returns, unchanged. `[RUNTIME — CONFIRMS SOURCE]`
3. **The expiry check fails open.** If `expires_at` is `null` or an unparseable string, the session **never expires**. A zone-less timestamp is read as server-local time (WIB, +07:00), and epoch seconds are treated as milliseconds, so the session expires immediately. `[RUNTIME]`, a new finding.
4. **An expired or missing session gives XHR/DataTables callers `302 → GET /` → `200 text/html` (the login page)**, never a 401. `[RUNTIME — CONFIRMS SOURCE]`
5. **Gateway errors shown to DataTables are silent.** Gateway 400/401/403/500 and a gateway outage all become `200 {draw, recordsTotal:0, recordsFiltered:0, data:[]}` (an empty table). Mapper exceptions become `302`. Notification returns a non-DataTables shape on error. `[RUNTIME]`
6. **Menu visibility ≠ route access.** Payment and marketing accounts see 1-2 menu items, yet they get `200` on every superadmin page tested. `[RUNTIME — CONFIRMS SOURCE]`
7. **CSRF bypass.** `PATCH`, and **`POST …?_method=PATCH` (method spoofing)**, reach resource `update` actions and the gateway **with no CSRF token**. The state-changing GET `…/shipping-voucher/:id/cancel` also executes without a token. `[RUNTIME — CONFIRMS SOURCE]`, with a stronger exploit path than A2 described.
8. **Logging exposure confirmed.** The full `auth` object (including the access token), `Bearer` headers, and the login body **including the password** are written to server logs. `[RUNTIME — CONFIRMS SOURCE]`
9. **Invalid credentials and gateway-down logins show no error message.** The gateway's message is lost in ApiService's error wrapper. `[RUNTIME — CONFIRMS SOURCE]` (A2 inference)

**A3.1 STATUS: GO** (§22). The Adonis-side facts needed for the architecture decisions are established, and the gateway-side gaps are explicitly queued.

## 2. Runtime Environment

| Item | Value |
|---|---|
| Environment | Local, isolated. Legacy app + local mock gateway (non-production) |
| Base URL | `http://127.0.0.1:19000` (legacy app); mock gateway `http://127.0.0.1:18080` |
| Configuration overrides (process env only, no files changed) | `HOST`, `PORT`, `APIGATEWAY_URL` → mock, `OSS_BUCKET_URL` / `CDN_URL` → dummy hosts, `CACHE_VIEWS=false`, `NODE_ENV=development`. All other values came from the existing `.env` (not printed) |
| Client | `curl` (HTTP-level). **No real browser**, so DataTables/JS UI reactions are queued for A3.2 |
| Date/time | 2026-09-28, about 21:40–22:10 WIB |
| Server timezone | WIB (UTC+07:00) [RUNTIME] |
| Runtime | Node **v24.16.0**. The Dockerfile targets Node 16.13.2, which is an environment difference; the app booted and behaved normally |
| Build / commit | `00bc6ea` (unmodified) |
| Test accounts | Synthetic identities issued by the mock: `ACCOUNT_TYPE = SUPERADMIN / PAYMENT / MARKETING`. The payment and marketing identities reuse the email identifiers hardcoded in `Extender.js` (not recorded here) |
| Gateway / backend | Mock only. **Real gateway [NOT OBSERVABLE]** |
| Side effects | Session files created under `tmp/sessions/` (gitignored) during testing were **deleted afterwards** (25 files; the 98 pre-existing files were untouched). `git status` shows only `docs/`. Both processes were stopped |

**Mock gateway behavior** (harness, outside the repo in `/tmp/a31/`):
- It answers `POST /api/v1/auth/login` with a synthetic `{code:200, data:{access_token, expires_at, user_email, user_name, role_name, user_id, id, cms_user_id}}`.
- It answers list GETs with `{code:200, data:{rows:[2 rows], total_rows:7}}` and other methods with `{code:200, data:{id:1}}`.
- Its error mode is switchable (400/401/403/500/down).
- It logs only method, path, query-key names, header names/sanitised values and body key names.

## 3. Login Verification

| Test | Result | Label |
|---|---|---|
| A1 `GET /` | `200 text/html`. Form `POST /login`; inputs `_csrf` (hidden, 36 chars), `email`, `password` | [RUNTIME — CONFIRMS SOURCE] |
| A1 prefilled values | **Prefilled credential fields observed: YES** (email value length 18, password value length 13). Actual values: [NOT RECORDED] | [RUNTIME — CONFIRMS SOURCE] |
| A1 cookies | `gpos-sessions`: `HttpOnly`, `Path=/`, `Expires` +7 days, **no `Secure`, no `SameSite`**. `XSRF-TOKEN`: `Max-Age=7200`, `SameSite=Strict`, not HttpOnly | [RUNTIME — CONFIRMS SOURCE] |
| A2 successful login | `POST /login` → mock gateway `POST /api/v1/auth/login` (headers: `Authorization: Bearer <empty>`, JSON; **body keys `_csrf, email, password`**) → `302 Location: /home` → `GET /home 200` | [RUNTIME — CONFIRMS SOURCE] (A2-H06: `_csrf` forwarded) |
| A3 no CSRF token | `403 application/json` (body key `error`) | [RUNTIME — CONFIRMS SOURCE] |
| A3 missing email | `302 → /`; alert-danger "Email is required" | [RUNTIME — CONFIRMS SOURCE] |
| A3 missing password | `302 → /`; alert-danger "Password is required" | [RUNTIME — CONFIRMS SOURCE] |
| A3 invalid credentials (gateway 401 with a message) | `302 → /`; **no alert rendered**. `ApiService` returns `{code:401, data:{message}}`, the controller flashes `login.message` (undefined), and nothing is shown | [RUNTIME — CONFIRMS SOURCE] (A2 inference) |
| A3 gateway 400 | Same: `302 → /`, **no alert** | [RUNTIME] |
| A3 gateway down (connection refused) | `302 → /`, **no alert** | [RUNTIME] |
| Logout `GET /logout` | `302 → /`; subsequent `/home` → `302 → /` (session cleared) | [RUNTIME — CONFIRMS SOURCE] |

## 4. Session Payload Verification

**Stored structure** (session file `tmp/sessions/<id>`, keys and types only) [RUNTIME]:

```text
csrf-secret: { d: string, t: string }
auth:        { t: "Object", d: <object> }
  auth.d (as returned by the mock gateway, stored verbatim):
    access_token : string [REDACTED — synthetic]
    expires_at   : string
    user_email   : string
    user_name    : string
    role_name    : string
    user_id      : string
    id           : string
    cms_user_id  : string
```

| Question | Result |
|---|---|
| Does Adonis filter or transform the gateway `data` before storing it? | **NO.** Every key the mock returned was stored unchanged [RUNTIME — CONFIRMS SOURCE] |
| Does the **real** payload contain `refresh_token`, `expires_in`, roles, permissions, entity/access data, or a user ID? | **[NOT OBSERVABLE]**. Needs the real gateway (A2-U01, U05 remain open for the real payload) |
| Is anything other than `auth` and the CSRF secret stored? | NO (plus transient flash) [RUNTIME — CONFIRMS SOURCE] |

## 5. Token / Expiry Verification

**`expires_at` format behavior.** Server TZ is WIB (+07). Each test logs in with the given `expires_at` and then requests `GET /home` [RUNTIME]:

| `expires_at` supplied | Meaning | `/home` result | Interpretation |
|---|---|---|---|
| `"2026-09-28T16:42:00Z"` (ISO, UTC +2h) | valid | 200 | Correct |
| ISO UTC −1h | expired | 302 → `/` | Correct |
| `"YYYY-MM-DD HH:mm:ss"` WIB +30m | valid | 200 | Correct only because the server runs in WIB |
| `"YYYY-MM-DD HH:mm:ss"` = UTC +2h (no zone) | valid in UTC | **302 (expired)** | Zone-less values are read as **server-local**; a UTC-intended value is off by 7 h |
| epoch **seconds** +2h (number) | valid | **302 (expired)** | moment treats a number as milliseconds (1970) |
| epoch **milliseconds** +2h | valid | 200 | Correct |
| `null` | — | **200** | **Fail-open: the session never expires** |
| `"not-a-date"` | — | **200** | **Fail-open**: `"…" <= "Invalid date"` is a string comparison, so it is always true |

- **Real gateway format:** `[NOT OBSERVABLE]` (A2-U02 is partly resolved: the behavior is now known for every format; the real format is still open).
- **Refresh:** no refresh request was issued at any point in any test. The mock log has no refresh calls. `REFRESH NOT IMPLEMENTED` [RUNTIME — CONFIRMS SOURCE].

**Expired session** (logged in with `expires_at` = −1h) [RUNTIME — CONFIRMS SOURCE]:

| Request | Response | Notes |
|---|---|---|
| `GET /content` (page) | `302 Location: /` | Login page |
| `POST /content/datatable` (XHR) | `302 Location: /` (empty body) | A browser XHR follows the 302 as GET → **`200 text/html` "Login - GPOS B2B Admin Panel"** (reproduced with a POST→GET follow) |
| `POST /banner/1?_method=PUT` (XHR action) | `302 Location: /` | Same |
| `DELETE /personalization/channels/1` (XHR, JSON endpoint) | `302 Location: /` | `AuthSession` redirects **before** the controller's JSON 401 branch can run, so that branch is unreachable for expired sessions |
| No session at all, `POST /content/datatable` (XHR) | `302 Location: /` | Same |

**Token rejected by the gateway while the Adonis session is valid** (gateway 401) [RUNTIME]:
- DataTables: `200` empty table (§7).
- JSON actions: `400` with the gateway message (§8).
- The session stays valid. There is no logout, no redirect and no refresh (A2-U03: **Adonis side resolved**; the real gateway's 401 body is `[NOT OBSERVABLE]`).

## 6. Authorization Verification

| Account type | D1 menu (rendered groups → links) | D2 direct GET `/products` | `/payment` | `/user-management` | `/banner` | `/gamification` |
|---|---|---|---|---|---|---|
| SUPERADMIN | Transaksi, Produk & Katalog, Interaksi Pelanggan, Pengaturan & Konfigurasi, Bantuan Pengguna (30 feature links, incl. `/home`) | 200 | 200 | 200 | 200 | 200 |
| PAYMENT | "Menu" → `/payment` only (no Dashboard link) | **200** | 200 | **200** | **200** | **200** |
| MARKETING | "Menu" → `/banner`, `/notification` only (no Dashboard link) | **200** | **200** | **200** | 200 | **200** |

Three layers, kept separate:

| Layer | Finding |
|---|---|
| **MENU VISIBILITY** | Differs by account email [RUNTIME — CONFIRMS SOURCE] |
| **ROUTE ACCESS** (Adonis) | **Identical for all accounts.** Every tested URL renders and calls the gateway with the account's bearer token [RUNTIME — CONFIRMS SOURCE] (A2-H01) |
| **BACKEND AUTHORIZATION** | **[NOT OBSERVABLE].** The mock accepts everything. Whether the real gateway rejects payment/marketing tokens on other features is unknown (A2-U04 remains a backend unknown) |

A2-U13 (which accounts are the special users in each environment) stays an OWNER DECISION. Only the source-hardcoded identifiers were exercised, and only against the mock.

## 7. DataTable Verification

**Request, browser → Adonis** (DataTables form-encoded POST) and **Adonis → gateway** [RUNTIME]:

| Screen | Adonis → gateway | Query keys sent | Notes |
|---|---|---|---|
| Content (standard) | `GET /api/v1/cms/contents` | `sort_by, asc_desc, page, take, keyword` | `start=10, length=5` gives `page=3, take="5"` (string); `order[0][column]=2` gives `sort_by=code` [RUNTIME — CONFIRMS SOURCE] |
| Product (column filters) | `GET /api/v1/cms/products` | `sort_by, asc_desc, page, take, keyword` | **`filters` is sent only in the GET request body, not the query string** [RUNTIME] (the gateway must read GET bodies) |
| FAQ (search) | `GET /api/v1/cms/faqs` | as above | — |
| Banner (status/type filters, Mapper HTML) | `GET /api/v1/cms/banners` | `…, status, type` | Mock rows lacked real type values, so the mapper threw (`reading 'label'`) → **302** (catch → flash + redirect back). This demonstrates the exception path [RUNTIME]; a successful banner render is [NOT OBSERVABLE] with mock data |
| Order (structured search JSON in `search[value]`) | `GET /api/v1/cms/orders` | `…, filter, customer_ids` | Valid JSON works. **Malformed JSON → `SyntaxError` → 302** [RUNTIME — CONFIRMS SOURCE] |

**Response envelope** [RUNTIME — CONFIRMS SOURCE]:
- `200 application/json`: `{draw, recordsTotal, recordsFiltered, data}`.
- `draw` is echoed as a string ("3").
- `recordsTotal === recordsFiltered === total_rows` (7, while 2 rows were returned). The equality holds on every successful response.
- `data` is an array of arrays, one entry per column (6 for Content, 11 for Order). Checkbox/action cells contain HTML (2 HTML cells per row on Content/FAQ/Product/Order).

**Error behavior** [RUNTIME]:

| Gateway condition | Adonis → browser | Browser consequence |
|---|---|---|
| 200 | 200 JSON envelope | Table rendered |
| 400 / 401 / 403 / 500 (Content, FAQ) | **200 `{recordsTotal:0, recordsFiltered:0, data:[]}`** | **Silent empty table**; no error surfaced |
| 500 (Notification) | 200 **`{total_rows:0, total_page:0, data_per_page:0, rows:[]}`**, not a DataTables shape | [INFERRED] DataTables error or empty draw → A3.2 |
| Gateway down (refused) | 200 empty envelope | Silent empty table |
| Mapper/controller exception | **302 → back** (empty body) | XHR follows → HTML → DataTables "Invalid JSON" [INFERRED] → A3.2 |
| Expired/no session | 302 → `/` → 200 login HTML | Same → A3.2 |
| Timeout (240 s) | [NOT EXECUTED — SAFETY/DURATION] | — |

Resolutions:
- **A2-U06**: envelope confirmed.
- **A2-U10**: Adonis side confirmed (302/HTML); the browser dialog goes to A3.2.
- **A2-U11** (axios setup-error branch): **not triggered** by refused connections, which take the `error.request` branch [RUNTIME]. The branch stays [NOT OBSERVABLE].

## 8. AJAX / Error Verification

Each row was tested with an **isolated mock gateway**. Mutations hit the mock only [RUNTIME].

| Scenario | Endpoint | HTTP | Response type | Browser behavior (expected from JS) | Toast / flash | Redirect |
|---|---|---:|---|---|---|---|
| Gateway 400 | `POST /customer-groups` (JSON) | 400 | JSON `{success:false, message}` | Error branch | Error text from the gateway message | No |
| Gateway 401 | same | **400** | JSON `{success:false, message}` | Error branch; the 401 is **collapsed to 400** | Message | No |
| Gateway 403 | same | **400** | JSON | same | Message | No |
| Gateway 500 | same | **400** | JSON | same | Message | No |
| Gateway 400/401/403/500 | `POST /banner/:id?_method=PUT` (XHR toggle) | **400** | JSON `{message}` | Revert toggle + toast (per source) | Gateway message | No |
| Gateway 400/401/403/500 | `DELETE /personalization/channels/:id` (axios) | **302** | Empty → follows to HTML | **Looks like success** to axios (A1-U16) | none | back → `/` (no Referer) |
| Gateway 400/401/403/500 | `POST /files/signurl` | 200* | JSON | *The mock's signurl route ignored error modes, so this is a test artifact; see the gateway-down row | — | — |
| Gateway down | `POST /files/signurl` | **500** | **Empty body** (`result.error` undefined) | Upload error → console only | none | No |
| Gateway down | `GET /faqs/1/edit` (page) | 302 | — | Redirected to `/faqs` as "not found" | warning flash | `/faqs` |
| Gateway down | login | 302 | — | Back to login | **none shown** | `/` |
| Session expired | any XHR | **302** | → login HTML 200 | — | — | `/` |
| Adonis 401 JSON | Personalization/Loyalty `fail(401)` | — | — | **Unreachable** for expired sessions (AuthSession redirects first) | — | — |

- **`{code:404, data:'Error Request URI'}`:** reproduced for refused connections [RUNTIME — CONFIRMS SOURCE]. The page path treats it as "not found" (`/faqs/1/edit` → `/faqs`). The literal string was not logged, but the behavior matches the 404 branch.
- **Timeout:** [NOT EXECUTED — DURATION] (240 s timeout). Same code path as refused connections per source.
- **AJAX receives `302 → login HTML` instead of `401 JSON`:** **YES** [RUNTIME — CONFIRMS SOURCE] (A2-H05).

## 9. Validation Verification

Test forms were submitted with required fields empty, followed by one GET of the form page [RUNTIME]:

| Form | Source claim (A1) | Runtime result | Label |
|---|---|---|---|
| Content create (`code` empty) | Errors for code/name not displayed; redirected back with old input | `302 → /content/create`. **No alert, no inline message, no red border**, and **old input NOT restored** | [RUNTIME — CONFIRMS SOURCE] (display) / **[RUNTIME — CONTRADICTS SOURCE]** (A1-G6 said old input is kept; runtime shows it is lost) |
| Inventory create (`product_id` empty) | First message flashed as `warning`; no field errors | `302`; alert-danger **"product_id is required"**; no red border; old input lost | [RUNTIME — CONFIRMS SOURCE] |
| Principal create (`code` empty) | `withErrors` without `flashAll` | `302`; **inline "Kode prinsipal wajib diisi."** shown; old input lost | [RUNTIME — CONFIRMS SOURCE] |
| Global configuration create (`key` empty) | `withErrors`; red border expected via `hasErrorFor` | `302`; **nothing rendered** (no alert, no border, no message); old input lost | [RUNTIME] (weaker than A1 implied) |
| Content create valid, gateway 400 | `warning` "Konten tidak berhasil ditambahkan" | alert-danger with that text | [RUNTIME — CONFIRMS SOURCE] |
| Content bulk delete, gateway OK | Inverted flash: success flashes `warning` | **No message shown** | [RUNTIME — CONFIRMS SOURCE] |
| Content bulk delete, gateway 400 | Inverted: failure shows "Berhasil…" | **alert-info "Berhasil menghapus Konten"** | [RUNTIME — CONFIRMS SOURCE] |
| Update forms with the `Warning` key (Principal / Global config edit + gateway 400) | Not rendered | [NOT OBSERVABLE]: the edit pages returned 500 on mock detail data, so no CSRF token could be obtained. Source finding preserved | — |
| FAQ create | — | Page returned 500 on mock category data. [NOT OBSERVABLE] with the mock | — |

**Classification:** the lack of displayed errors is **mainly presentation-level**, with one **contract-level** part: old input and per-field data are not flashed. Confirmed at runtime.

## 10. CSRF Verification

Each request was sent with a valid session and **no CSRF token**. Mutations reached **the mock gateway only** [RUNTIME]:

| Request | Result | Gateway reached? | Label |
|---|---|---|---|
| `POST /faqs?_method=delete` | **403** | No | [RUNTIME — CONFIRMS SOURCE] |
| `PUT /global-configuration/1` | **403** | No | [RUNTIME — CONFIRMS SOURCE] |
| `DELETE /product-category/1` | **403** | No | [RUNTIME — CONFIRMS SOURCE] |
| **`PATCH /global-configuration/1`** | **302 → `/global-configuration` (update executed)** | **YES** (`PUT /api/v1/cms/global-configurations/1`) | [RUNTIME — CONFIRMS SOURCE] |
| **`POST /global-configuration/1?_method=PATCH`** | **302 (update executed)** | **YES** | [RUNTIME]: **plain HTML form POSTs can bypass CSRF** by spoofing PATCH, on **every `Route.resource` update** |
| `GET /gpos-brand/shipping-voucher/1/cancel` | **302 (cancel executed)** | **YES** (`PUT /api/v1/cms/merchants/discounts/1/cancel`, on the mock) | [RUNTIME — CONFIRMS SOURCE] |
| `GET /logout` | 302 → `/`; session cleared | Gateway logout | [RUNTIME — CONFIRMS SOURCE] |
| CSRF rejection body | `403 application/json`, key `error` | — | [RUNTIME] |

A2-M01 is resolved and **strengthened**: the exploit needs no PATCH-capable client. A cross-site HTML form can POST with `?_method=PATCH`. The session cookie has no `SameSite` attribute, so a top-level cross-site form POST would carry it [INFERRED; browser-dependent → A3.2].

## 11. Signed URL Verification

| Step | Result | Label |
|---|---|---|
| Browser → `POST /files/signurl` (form/JSON, **no file bytes**) | Adonis validates `file_name` only | [RUNTIME — CONFIRMS SOURCE] |
| Adonis → gateway `POST /api/v1/files/signurl` | Bearer present; body keys `file_name, category, content_type` (in the header-CSRF flow, `_csrf` is not in the body) | [RUNTIME] (A2-H06 applies to signurl only when `_csrf` is sent in the body) |
| Response to browser | `200 {url, file_url}`; `url` carries a query string (signature) → `https://storage/...?[REDACTED]` | [RUNTIME — CONFIRMS SOURCE] (mock-issued) |
| Missing `file_name` | `400 [{message:"file_name is required", field:"file_name", validation:"required"}]` | [RUNTIME — CONFIRMS SOURCE] |
| Wrong type / oversize (`evil.exe`, `application/x-msdownload`) | **Adonis accepts (200)**; no server-side MIME/size/extension check | [RUNTIME — CONFIRMS SOURCE] (A2-M05) |
| Gateway down | **500, empty body** | [RUNTIME] |
| Browser `PUT` to storage, required headers, content-type behavior, final object URL | [NOT OBSERVABLE]: needs a browser and real/test storage | — |
| Does Adonis see file bytes? | **NO** (only JSON metadata) | [RUNTIME — CONFIRMS SOURCE] |
| Does the gateway see file bytes? | **NO** (only metadata) | [RUNTIME — CONFIRMS SOURCE] |
| Signed URL lifetime / storage ACL / allowed types (A2-U08) | [NOT OBSERVABLE] | — |

## 12. Identity Header Verification

The mock login payload contained distinct synthetic markers in `user_id`, `id` and `cms_user_id`, so the precedence could be observed [RUNTIME]:

| Feature | Headers sent to the gateway (names) | Sanitised value source |
|---|---|---|
| Loyalty (`GET /loyalty-member` → `/api/v1/cms/patient-loyalty/cards`) | `authorization`, `x-userid`, `x-useremail`, `x-username`, `x-rolename` | `x-userid` = **`user_email`**; `x-useremail` = `user_email`; `x-username` = `user_name`; `x-rolename` = `role_name` |
| UserVerification (`POST /user-verification/datatable` → `/api/v1/cms/users/need-approvals`) | `authorization`, `accept: application/json`, `x-userid` | `x-userid` = **`user_id`** (the first in the fallback chain `user_id → id → cms_user_id → user_email`) |
| All other features | `authorization` only | — |

A2-U09: the precedence is confirmed. Which of these fields the **real** payload contains is [NOT OBSERVABLE]. The two features also send **different values under the same header name** (`X-Userid` = email vs `X-UserId` = user id) [RUNTIME].

## 13. Logging Verification

Captured from the app's stdout during the run. Only synthetic values were present, and they are redacted here [RUNTIME — CONFIRMS SOURCE]:

| Item | Observed | Evidence |
|---|---|---|
| Full `auth` object logged (`Extender` `console.log("AUTH: ", auth)`) | **YES**, on every request (218 lines in the session) | `AUTH: {…access_token: [REDACTED]…}` |
| Access token logged | **YES** (the synthetic token string appears 260 times; `myAuth` token log appears on loyalty calls) | [REDACTED] |
| Authorization header logged | **YES** (`headers: {"Authorization":"Bearer [REDACTED]"}`, 84 bearer occurrences) | ApiService.httpLog |
| Login body / password logged | **YES** (`Body: {"_csrf":…, "email":…, "password":"[REDACTED]"}`) | ApiService.httpLog on `POST /api/v1/auth/login` |
| CSRF token values logged | YES (44 occurrences) | — |
| Axios error dumps with request config (`data` incl. body) | YES (on gateway 4xx/5xx) | — |

A2-C01 and A2-C02 are **confirmed** at runtime. Severity is unchanged: CRITICAL.

## 14. Raw Script Data Verification

| Screen | Observation | Label |
|---|---|---|
| `GET /customer-groups/1` | `var existingGroup = {…}` rendered from `{{{ toJSON(group) }}}`: server data is inserted **directly into an inline `<script>`**, unescaped, from gateway-provided values | [RUNTIME — CONFIRMS SOURCE] |

No exploitation was attempted, and no payload was crafted.

## 15. Source vs Runtime Reconciliation

| Finding | Static A2 | Runtime | Result |
|---|---|---|---|
| Session payload | The whole gateway `data` stored under `auth` | Verbatim storage of every key | **CONFIRMED** (real key set NOT OBSERVABLE) |
| Refresh absent | `REFRESH NOT IMPLEMENTED` | No refresh calls in any scenario | **CONFIRMED** |
| Expiry behavior | String comparison, server-local; TZ sensitivity inferred | Correct for zoned ISO / local strings; **fail-open for null/invalid**; wrong for zone-less UTC and epoch seconds | **PARTIALLY CONFIRMED** (plus new fail-open finding) |
| BFF topology | Browser → Adonis only; Bearer server-side | Bearer present only on Adonis→gateway calls; nothing in the HTML | **CONFIRMED** |
| Menu behavior | Three email-selected sets | Superadmin 5 groups; payment `/payment`; marketing `/banner`, `/notification`; Dashboard hidden for payment/marketing | **CONFIRMED** |
| Route access | Session-only gate | All accounts 200 on all tested pages | **CONFIRMED** |
| Backend authorization | Unknown | Mock cannot show it | **NOT OBSERVABLE** |
| DataTable envelope | `{draw, recordsTotal, recordsFiltered, data}`; rT = rF = `total_rows` | Exactly that; errors → empty 200; exceptions → 302; Notification non-standard | **CONFIRMED** (+ silent-error detail) |
| Redirect-as-error | JSON/DataTables endpoints may 302 | Personalization DELETE on any gateway error → 302; mapper exceptions → 302; expired session → 302 | **CONFIRMED** |
| CSRF | PATCH & GET unprotected | PATCH and **POST `?_method=PATCH`** bypass; GET cancel executes | **CONFIRMED** (exploit path broader) |
| Upload flow | Browser → signurl → direct PUT; no server type checks | signurl JSON only; accepts any type; 500 empty on failure | **PARTIALLY CONFIRMED** (PUT to storage NOT OBSERVABLE) |
| Logging | Token, session, password logged | All observed | **CONFIRMED** |
| Login failure message | Probably undefined | No alert on invalid creds / gateway 400 / gateway down | **CONFIRMED** |
| Old input on validation failure (A1 Content claim) | A1: old input kept | Old input lost on all tested forms | **CONTRADICTED** (A1 statement) |
| Gateway 401 → Adonis response | Generic failure | DataTables 200 empty; JSON actions **400** | **CONFIRMED** (401 collapsed) |
| Adonis JSON 401 branches (Personalization/Loyalty) | Exist in source | Unreachable for expired sessions | **CONTRADICTED** in effect (code exists but never runs for expiry) |

## 16. Architecture-Relevant Runtime Facts

These are facts only; no target design.

| # | Question | Answer (evidence) |
|---|---|---|
| Q1 | Does the legacy browser require access-token knowledge? | **NO.** The token never reaches the browser; all gateway calls are made by Adonis [RUNTIME] |
| Q2 | Does the legacy browser require gateway URL knowledge? | **NO** [RUNTIME] |
| Q3 | Does the legacy browser require an API key? | **NO.** No API key exists anywhere in the flow [RUNTIME] |
| Q4 | Is server-side session state essential to the legacy topology? | **YES.** The token, expiry and identity live only in the Adonis session file; the browser holds an opaque cookie [RUNTIME] |
| Q5 | Does legacy authentication refresh tokens? | **NO** [RUNTIME] |
| Q6 | What happens when the token expires? | If Adonis `expires_at` has passed: every request → `302 /`, XHR included (→ login HTML 200). If the gateway rejects the token earlier: silent empty tables and 400 JSON errors; the session persists. If `expires_at` is null/invalid: the session never expires [RUNTIME] |
| Q7 | Is route authorization stronger than menu visibility? | **NO.** Route access is identical for all accounts; the menu is the only difference [RUNTIME] |
| Q8 | Is backend authorization observable from the legacy client? | **NOT with this harness.** The legacy client has no permission data and sends only Bearer (+ identity headers for 2 features); any enforcement is gateway-side [NOT OBSERVABLE] |
| Q9 | Are DataTables dependent on server-generated HTML cells? | **YES** in the legacy BFF response (action/checkbox cells are HTML strings). The gateway itself returns plain `rows[]` objects [RUNTIME — gateway shape per mock/legacy client] |
| Q10 | Does signed upload require a browser → object-storage direct PUT? | **YES** per source; runtime confirms Adonis and the gateway never receive bytes. The PUT itself was [NOT OBSERVABLE] |
| Q11 | Are API errors consistently JSON? | **NO.** A mix of 200-empty JSON (DataTables), 400 JSON (actions, including collapsed 401/403/500), 500 empty body (signurl), 302 → HTML (expired session, exceptions, Personalization), and 403 JSON (CSRF) [RUNTIME] |
| Q12 | Does CSRF cover all state-changing legacy routes? | **NO.** PATCH (and spoofed PATCH via POST) and state-changing GETs are unprotected [RUNTIME] |

## 17. Confirmed Findings

- Browser-to-Adonis-only topology; Bearer added server-side (A2 §5).
- Session = verbatim gateway `data`; no refresh (A2 §3-4).
- Expired session → 302 to login HTML for pages and XHR (A2-H05).
- Menu-only role separation; all routes reachable by every account (A2-H01).
- DataTables envelope `{draw, recordsTotal, recordsFiltered, data}` with `recordsTotal === recordsFiltered === total_rows`; HTML cells (A2 §9).
- Timeout/refused → the 404 path (A2-H04).
- Login failure messages not rendered.
- CSRF: PATCH and state-changing GET unprotected (A2-M01).
- No server-side upload type/size validation (A2-M05); signurl failure → empty 500.
- Identity headers (Loyalty `X-Userid` = email; UserVerification `X-UserId` = `user_id` first).
- Server logs contain the session, token, Authorization header and login password (A2-C01, A2-C02).
- Raw `toJSON` output embedded in inline scripts.
- Inverted Content bulk-delete flash (A1-F02); hidden validation messages (A1-F09).
- Login forwards `_csrf` in the body to the gateway (A2-H06, login case).

## 18. Contradicted Findings

| Item | Source/earlier claim | Runtime | Explanation |
|---|---|---|---|
| Content create keeps old input (A1 G6: "redirected back with old input") | Old input kept | **Lost** | The controller doesn't `flashAll`; the A1 statement was wrong |
| Adonis JSON 401 responses for XHR (Personalization/Loyalty `fail(401)`) | Present as the behavior for unauthenticated XHR | **Never reached** for expired or missing sessions (`AuthSession` redirects first) | Route middleware order |
| A2-H06 for signurl (`_csrf` forwarded) | `request.all()` forwarded, including `_csrf` | Holds for login; in the header-CSRF signurl flow the body has no `_csrf` | The source statement is true only when `_csrf` is sent in the body |
| Global config create shows a red border / field error | `withErrors` + `hasErrorFor` expected | Nothing rendered | Presentation; see A3.2 |

No contradiction affects the A2 security findings.

## 19. Remaining Unknowns

| ID | Unknown | Needed |
|---|---|---|
| A2-U01 / U05 | Real gateway login payload keys (refresh_token? roles? permissions?) | Test gateway + test account |
| A2-U02 | Real `expires_at` format (the behavior for every format is now known) | Test gateway |
| A2-U03 | Real gateway 401 body / refresh endpoint existence | Test gateway / backend team |
| A2-U04 | Backend authorization for payment/marketing tokens | Test gateway + special test accounts |
| A2-U05 / U06 | `Api-Key` / CORS requirements; same service as the target `API_HOST`? | Owner / backend |
| A2-U07 | Entity/access permission endpoint for these features | Backend |
| A2-U08 | Signed URL lifetime, headers required for the PUT, storage ACL, final object URL | Test storage + browser |
| A2-U09 | Which id field the real payload carries | Test gateway |
| A2-U11 | axios setup-error branch | Not reproducible without code changes (NOT EXECUTED) |
| A2-U12 | `Secure` cookie at the TLS terminator | Deployed test environment |
| A2-U13 | Special accounts per environment | Owner |
| New RT-U01 | Behavior under a real 240 s gateway timeout | Test gateway (NOT EXECUTED — duration) |
| New RT-U02 | Successful Banner/FAQ/edit-page renders (mock data shapes insufficient) | Test gateway with realistic data (A3.2 baseline) |

## 20. A3.2 Visual Verification Queue

1. DataTables UI when the endpoint returns 302 → login HTML (expired session): alert dialog vs silent (A2-U10).
2. DataTables UI for the silent empty table on gateway errors (no user feedback).
3. Notification list with the non-DataTables error shape.
4. Login page: prefilled fields (screenshot with values masked); no error on invalid credentials.
5. Menu rendering for the three account types (with masked identities).
6. Validation display on Content, Inventory, Principal and Global Configuration forms (the four runtime patterns in §9).
7. Inverted bulk-delete flash on Content.
8. Upload widget: size/ratio alerts, console-only errors, preview.
9. Personalization delete "success" after a gateway error (axios follows 302).
10. Cross-site form POST with `?_method=PATCH` carrying the session cookie (browser SameSite default behavior); evidence only, no exploitation.
11. Real Banner/FAQ/edit screens with realistic data (RT-U02).

## 21. Security Findings

Preserved from A2 with their runtime status. Severity is unchanged unless runtime changed the evidence.

| ID | Sev | Title | Runtime status |
|---|---|---|---|
| A2-C01 | CRITICAL | Token and full session logged every request | **CONFIRMED** |
| A2-C02 | CRITICAL | Authorization header and login password logged | **CONFIRMED** |
| A2-H01 | HIGH | No authorization in Adonis; menu-only separation | **CONFIRMED** (all accounts reach all tested pages) |
| A2-H02 | HIGH | Prefilled credentials in login HTML | **CONFIRMED** (values not recorded) |
| A2-H03 | HIGH | No refresh; no gateway-401 handling | **CONFIRMED** (gateway 401 → empty table / 400 JSON; session persists) |
| A2-H04 | HIGH | Timeout/network → 404 path | **CONFIRMED** for refused connections; real timeout NOT EXECUTED |
| A2-H05 | HIGH | Unauthenticated AJAX → 302 → login HTML | **CONFIRMED** |
| A2-H06 | HIGH | Unfiltered bodies forwarded to the gateway | **CONFIRMED** for login (`_csrf`, `email`, `password`); signurl only when `_csrf` is in the body |
| A2-M01 → **A3-S01** | **HIGH** (escalation proposed, based on the new evidence) | CSRF bypass: `POST …?_method=PATCH` (and PATCH) executes resource updates without a token; state-changing GET cancel | **CONFIRMED, broader than A2**: a plain HTML form suffices. The escalation reflects the new exploit path, not the ease of reproduction; owner to ratify |
| **A3-S02** | **HIGH** (new) | Expiry check fails open: `expires_at` null/invalid → the session never expires | **RUNTIME**; exposure depends on the real gateway format (A2-U02) |
| A3-S03 | MEDIUM (new) | Gateway 401/403 collapsed to 400 / empty 200; authorization failures indistinguishable from other errors | RUNTIME |
| A2-M02 | MEDIUM | Session cookie without `Secure`/`SameSite` | **CONFIRMED** (headers observed) |
| A2-M05 | MEDIUM | No server-side upload validation | **CONFIRMED** |
| A2-M07 | MEDIUM | Raw `toJSON` in scripts | **CONFIRMED** (behavior exists) |

## 22. A3.1 GO / NO-GO

- Every Adonis-layer behavior that affects the Next.js architecture decisions was verified at runtime: topology, session contract, expiry semantics, refresh absence, redirect-vs-JSON, DataTables envelope and error mapping, CSRF coverage, upload boundary, identity headers and logging.
- Two earlier claims were contradicted, and both are documented.
- The gateway/backend facts that remain open are explicitly queued. They need a test gateway and test accounts, not a different interpretation of the legacy code.
- There is no environment problem or contradiction that prevents the visual baseline.
- No source code was modified, no secrets were recorded, and test artifacts in the repo (session files) were removed.

A3.1 STATUS: GO
