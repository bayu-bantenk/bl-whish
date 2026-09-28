# A2 — Auth / API / Permission Analysis

| Item | Value |
|---|---|
| Phase | A2: legacy auth, API contract and permission audit (static, read-only) |
| Date | 2026-09-28 |
| Repository | `gpos-b2b-cms/` (AdonisJS 4.1). Target baseline: `frontend/` (B0) |
| Inputs | `FRONTEND_SCOPE.md` (A0 GO), `ROUTE_SCREEN_MAP.md` (A1 GO) |
| Evidence labels | `[SOURCE]` · `[INFERRED]` · `[UNKNOWN — VERIFY A3.1]` · `[UNKNOWN — OWNER DECISION]` · `[UNKNOWN — BACKEND CONTRACT]` |
| Contract boundary | Anything past the API Gateway is **KNOWN FROM LEGACY CLIENT**. The backend implementation is not in this repository. |
| Method | Read the middleware, helpers, controllers and config. Scripted extraction of every `ApiService.getData` call in `app/Repositories/**` (243 calls) and a join to the routes through controller/mapper imports (310 non-missing routes). |
| Secrets | None reproduced. Values from `.env` / `env.txt` were not read, and the prefilled login values are not repeated. |

---

## 1. Executive Summary

**Topology.** Adonis is a server-side BFF. The browser only talks to same-origin Adonis routes, with the session cookie and CSRF. Adonis calls the API Gateway server-side, sending `Authorization: Bearer <access_token>` from the session.
- The browser never receives the gateway URL, the access token or any API key. `[SOURCE]`
- There is **no API key** in the legacy client at all. There is no Kong/`Api-Key` header anywhere. `[SOURCE]`

**Authentication.**
- The login form is POSTed to Adonis. `AuthRepository.login` forwards the **whole form body** (including `_csrf`) to `POST /api/v1/auth/login`.
- The gateway's `data` object is stored whole in the Adonis session under `auth` (file driver, cookie `gpos-sessions`).
- Expiry is decided only by comparing `auth.expires_at` with the server clock. `[SOURCE]`

**Refresh.** `REFRESH NOT IMPLEMENTED` `[SOURCE]`.
- No refresh endpoint, call or scheduler exists.
- Gateway 401 responses are not handled globally.
- When the token expires, the user is redirected to `/`.

**Authorization.**
- Adonis enforces **only session presence and expiry**.
- It has **no role, entity or access checks**, on routes or on actions.
- The menu is three hardcoded sets selected by `authUser.user_email`. It controls **visibility only**: every authenticated user can reach every route by URL. `[SOURCE]`
- Mapper/controller-built Edit/Delete buttons have no permission condition.
- Any real authorization happens past the gateway `[UNKNOWN — BACKEND CONTRACT]`. The only authorization context sent is the bearer token; the Loyalty and UserVerification endpoints also get `X-Userid` / `X-RoleName` / `X-UserId` headers.
- There is **no session-validation endpoint** in the legacy client. The target's `/auth/validate-session` (B0) has no legacy counterpart here.

**Contracts** (KNOWN FROM LEGACY CLIENT).
- The gateway body envelope is `{ code, message, data }`. Lists come as `data: { rows, total_rows }`.
- `ApiService` flattens transport errors to `{ code: <HTTP status>, data: <error body> }`. Timeouts and network errors become `{ code: 404, data: 'Error Request URI' }`.
- DataTables endpoints return `{ draw, recordsTotal, recordsFiltered, data: [[html cells…]] }`, with `recordsTotal = recordsFiltered = total_rows`.

**Critical security findings.**
- The bearer token and the full session are written to server logs on every request (`Extender.js` `console.log("AUTH: ", auth)`, `LoyaltyMemberRepository` `console.log("myAuth: ", access_token)`).
- `ApiService.httpLog` logs request headers (including `Authorization`) and bodies, so the **login password** is logged.
- The login page ships prefilled credentials (A0-F04).

**Decision:** **A2 STATUS: GO** (§25).

---

## 2. Authentication Flow

| Step | Component | Input | Output | Storage | Evidence |
|---|---|---|---|---|---|
| 1 | `GET /` → `AuthController.getLogin` | Session `auth` (optional) | If `authUser` exists and `checkAuth` passes, 302 to `/home`. Otherwise render `login` | — | `AuthController.js:9-16` [SOURCE] |
| 2 | `login.edge` (standalone) | — | HTML form `POST route('AuthController.postLogin')` = `/login` with `csrfField()`. Fields `email` (plain input, no `type=email`) and `password`. **Both have prefilled `value` attributes (legacy behavior; values not reproduced)** | CSRF cookie + hidden `_csrf` | `login.edge:45-70` [SOURCE] |
| 3 | Shield CSRF | POST body `_csrf` | Rejects if the token is invalid | `config/shield.js:134-145` | [SOURCE] |
| 4 | `postLogin` validation | `request.post()` | `Validators/Login`: `email` required ("Email is required"), `password` required ("Password is required"). On failure: flash `notification` with the first message, redirect back | Flash | `AuthController.js:19-24` [SOURCE] |
| 5 | `AuthRepository.login(req)` | **Whole `request.post()`** (`_csrf`, `email`, `password`) | `ApiService.getData('/api/v1/auth/login','post', null, req)` → `POST {APIGATEWAY_URL}/api/v1/auth/login`. Headers: `Authorization: 'Bearer '` (empty, because `authUser` is null). JSON body. Timeout 240 s | — | `AuthRepository.js:6-8`, `ApiService.js:100-123` [SOURCE] |
| 6 | Gateway response | — | On 2xx, `response.data` (the gateway body) is returned. The controller requires `login.code === 200` (strict), so the body must contain `code: 200` | — | `AuthController.js:27` [SOURCE]; body shape KNOWN FROM LEGACY CLIENT |
| 7 | Failure | `login.code !== 200` or null | Flash `notification` = `login.message` or `'Server Error'`, then redirect back. For transport errors, `login.message` is undefined, because ApiService returns `{code,data}` | Flash | `AuthController.js:27-30` [SOURCE]; message behavior [INFERRED] |
| 8 | Success | `login.data` | `session.put('auth', login.data)` → 302 to `/home` | **Adonis session (file store `tmp/sessions`)**, key `auth` | `AuthController.js:32-33`, `config/session.js:19,30` [SOURCE] |
| 9 | Every later request | Session cookie `gpos-sessions` | The global `Extender` reads `session.get('auth')` and exposes it through the `HttpContext.getter('authUser')` and `view.share({authUser, menu})` | Request memory | `Extender.js:13-17,298-301` [SOURCE] |
| 10 | Route guard | `auth` | `AuthSession`: if there is no `auth`, or `checkAuth` fails, 302 to `/` | — | `AuthSession.js:9-23` [SOURCE] |
| 11 | Action guard | `authUser` | Most actions call `Authorization.checkAuth(authUser)` again. On failure they render `login` in place, or a JSON 401 in Personalization/Loyalty | — | ctrl.json; `PersonalizationChannelController.js:213…`, `LoyaltyMemberController.js:276,426` [SOURCE] |
| 12 | Gateway call | `authUser.access_token` | `Authorization: Bearer <access_token>`; Loyalty and UserVerification send extra headers (§7.2) | — | `ApiService.js:51-55,111-115` [SOURCE] |
| 13 | Logout `GET /logout` | Session | `session.clear()`, then `AuthRepository.logout(authUser)` → `POST /api/v1/auth/logout` with Bearer and an empty body. The result is ignored. Then 302 to `/` | Session cleared | `AuthController.js:36-40` [SOURCE] |

**Identity fields read from the session** (the consumers of `login.data`) [SOURCE grep `authUser.*`, `auth.*`]:

| Field | Consumer |
|---|---|
| `access_token` | ApiService, Loyalty, UserVerification |
| `expires_at` | Authorization.checkAuth |
| `user_email` | Extender menu selection, Banner author, Loyalty `X-Userid`/`X-Useremail`, UserVerification fallback id |
| `user_name` | Banner author, Loyalty `X-Username` |
| `role_name` | Loyalty `X-RoleName` only |
| `user_id` / `id` / `cms_user_id` | UserVerification `X-UserId` (defensive fallback chain, so the real field name is uncertain) |
| `user.user_type`, `user.user_role` | `OtherService.isSellerAccount`, which is **never called** |

`fullname` is used in `layouts.edge` but is never shared, so it renders empty. The full payload shape is `[UNKNOWN — VERIFY A3.1]`.

## 3. Session Lifecycle

| Aspect | Finding | Evidence |
|---|---|---|
| Driver | `file` (hardcoded, `SESSION_DRIVER` env is ignored) → `tmp/sessions/` | `config/session.js:18-19,82-84` [SOURCE] |
| Cookie | `gpos-sessions`; `httpOnly: true`; `sameSite: false`; `path: '/'`; **no `secure` flag configured** | `config/session.js:30,67-71` [SOURCE] |
| Session age | `age: '7d'`, `clearWithBrowser: false` | `config/session.js:41,56` [SOURCE] |
| Stored data | **Only** key `auth` = the gateway login `data` object (token, expiry, identity, whatever else the gateway returns). No separate role or permission store. Flash messages are the only other session data | `session.put` only in `AuthController.js:32` [SOURCE] |
| Access token stored? | YES, inside `auth` (`access_token`) | [SOURCE] |
| Refresh token stored? | Never read. It would only be present if the gateway returns one inside `data` | [INFERRED]; payload [UNKNOWN — VERIFY A3.1] |
| Expiry stored? | YES, `auth.expires_at` (gateway-provided) | `Authorization.js:6` [SOURCE] |
| Expiry check | `moment().format('YYYY-MM-DD HH:mm:ss') <= moment(auth.expires_at).format(…)`, a **string comparison in server-local time**. Exceptions return `false` | `Authorization.js:4-10` [SOURCE]; timezone correctness [UNKNOWN — VERIFY A3.1] |
| Where expiry is checked | Before the controller, on every `authSession` route (`AuthSession`), and again inside most controller actions. **Never after API responses** | [SOURCE] |
| Gateway 401 | No global handling. Controllers treat any `code != 200/201` as a generic failure (flash warning / empty table / JSON error). The session stays valid until `expires_at` | [SOURCE] |
| Gateway 403 | Only `PersonalizationChannelController.js:82` special-cases it, and only with a console log | [SOURCE] |
| Expired session UX | Page routes redirect to `/`. AJAX/DataTables calls also get a 302 to `/`, i.e. HTML (login page) for a JSON caller | [INFERRED] |
| Session vs token | The cookie lives 7 days while token validity comes from `expires_at`, so an expired token keeps a session file until logout or the cookie expires. Such a session is rejected by `checkAuth` | [INFERRED] |
| Logout | `session.clear()` plus a best-effort gateway logout | [SOURCE] |

## 4. Token Lifecycle

**Search performed.** `refresh`, `refresh_token`, `refreshToken`, `refresh-token`, `token`, `expires`, `expires_in`, `401`, `unauthorized` across `app/`, `start/`, `config/`, `resources/views/` and `public/assets/js/main.js`. The only hits are:
- A comment in `app/Models/User.js` mentioning Adonis `refreshTokens` (the boilerplate `tokens` table, not used for gateway auth).
- UI "refresh halaman" text.
- `location.reload()` calls.
- The status-code maps in `ExtendResponse`/`OtherService`.

**Conclusion: `REFRESH NOT IMPLEMENTED`** `[SOURCE]`.

| Token | Exists | Issued by | Stored where | Sent to | Expiry | Refresh | Evidence |
|---|---|---|---|---|---|---|---|
| Gateway access token (`access_token`) | YES | API Gateway `POST /api/v1/auth/login` | Adonis session file (`auth.access_token`), server-side only | Gateway, as `Authorization: Bearer` on every repository call | `auth.expires_at` (gateway-provided), checked by Adonis | **None** | `ApiService.js`, `Authorization.js` [SOURCE] |
| Refresh token | NOT OBSERVED | [UNKNOWN — BACKEND CONTRACT] | Maybe inside `auth` if the gateway returns it; never read | Never | — | **Not implemented** | grep [SOURCE] |
| Adonis session cookie `gpos-sessions` | YES | Adonis Session provider | Browser cookie (httpOnly) + server file | Adonis only | 7 days | Rolling session (Adonis default) [INFERRED] | `config/session.js` [SOURCE] |
| CSRF token | YES | Adonis Shield | Cookie (`httpOnly: false`, `sameSite: true`, `maxAge 7200`) + meta `csrf_token` + `csrfField()` | Adonis only (also forwarded in the login body and signurl body to the gateway, see §16) | 7200 s cookie | Re-issued per request [INFERRED] | `config/shield.js:134-145`, `layouts.edge:9,287-298` [SOURCE] |
| API key (Kong / `Api-Key`) | **NOT OBSERVED** in the legacy client | — | — | — | — | — | grep `Api-Key\|KONG\|x-api-key` → none [SOURCE] |

## 5. API Topology

```text
Browser (jQuery / axios / DataTables / forms)
  │  same-origin HTTP; cookie gpos-sessions (httpOnly); CSRF (_csrf field or X-CSRF-TOKEN header)
  ▼
Adonis serverMiddleware: Static(public/) → Cors(origin:false)
  ▼
Global middleware: BodyParser → Session → Shield(CSRF, CSP empty, XFRAME DENY, nosniff) → AuthInit
                   → ConvertEmptyStringsToNull → ExtendResponse → Extender(authUser, menu)
  ▼
Route group middleware authSession (session + expires_at)
  ▼
Controller (checkAuth again) → Mapper (request shaping) → Repository
  ▼
ApiService.getData(url, method, authUser, params, options)       [server-side axios, 240 s timeout]
  │  url = APIGATEWAY_URL + path ; headers = { Authorization: Bearer <access_token> } or options.headers
  │  GET: params sent as query AND as body
  ▼
API Gateway  (APIGATEWAY_URL, env, server-only)
  ▼
Backend services  [UNKNOWN — BACKEND CONTRACT]
```

**Variations:**

| Variant | Flow | Evidence |
|---|---|---|
| V1 Page render | Browser GET → controller → repositories → Edge HTML | [SOURCE] |
| V2 DataTables | Browser POST `*/datatable` (form-encoded DataTables params + `_csrf`) → Mapper `To*ListRequest` → gateway GET list → Mapper builds HTML cells → JSON | §9 |
| V3 AJAX JSON actions | Browser axios / `$.ajax` → controller → gateway → JSON (or `redirect('back')`) | A1 §9 |
| V4 Signed-URL upload | Browser → `POST /files/signurl` → gateway `POST /api/v1/files/signurl` → `{url, file_url}` → **browser PUTs the file directly to object storage** (bypasses Adonis and the gateway) → hidden field → form submit | §10 |
| V5 Server-side storage I/O | Gamification duplicate: Adonis downloads the CSV from a URL, rewrites it, gets a signurl, and PUTs to storage. Loyalty `validate-branch-csv`: Adonis `axios.get(fileUrl)` on a **browser-supplied URL** | `GamificationController.js:165-180`, `LoyaltyMemberController.js:302` [SOURCE] |
| V6 Local upload | Principal image: browser multipart → Adonis → `public/images` (no gateway) | `PrincipalController.store` [SOURCE] |
| V7 External static | Folamil / loyalty CSV templates: browser opens a hardcoded OSS URL, or a URL from env returned by Adonis | A1 §20 [SOURCE] |

| Layer | Component | Responsibility | Security boundary |
|---|---|---|---|
| Browser | Edge HTML + jQuery / axios / DataTables | UI, same-origin requests | Holds only the session cookie and CSRF token. No gateway URL, no token, no API key [SOURCE] |
| Edge | Adonis static + CORS | Assets; CORS `origin:false` (no cross-origin) | Serves all of `public/` (A0-F09) |
| Adonis HTTP | Shield, Session, Extender, AuthSession | CSRF, session, expiry gate, menu | **Trust boundary 1**: session → identity |
| Adonis app | Controllers / Mappers / Validators | Validation, request shaping, HTML cell generation, redirects/flash | No role checks |
| Adonis outbound | `ApiService` (axios) | Adds Bearer, calls the gateway, flattens errors, **logs headers and bodies** | **Trust boundary 2**: token → gateway |
| Gateway / backend | `APIGATEWAY_URL` | Authentication, any authorization, business logic | [UNKNOWN — BACKEND CONTRACT] |
| Object storage | OSS (signed URLs) | File bytes | The browser writes directly with a signed URL; no credentials in the browser [SOURCE] |

**Direct answers:**

| Question | Answer |
|---|---|
| Does the browser call the gateway directly? | **NO** [SOURCE: all browser URLs are relative (A1 §9); gateway URL only in `ApiService.js:35`] |
| Does the browser see the gateway URL? | **NO** [SOURCE] |
| Is the bearer token exposed to the browser? | **NO**. No view prints `authUser`/`access_token` (grep) [SOURCE] |
| Is an API key exposed? | **No API key exists** [SOURCE] |
| Does CSRF protect browser→Adonis? | YES for POST/PUT/DELETE. Not for PATCH, GET (§16) [SOURCE] |
| Is Adonis a BFF/proxy? | YES [SOURCE] |
| Do uploads bypass Adonis? | YES for file bytes (signed-URL PUT); NO for Principal [SOURCE] |
| Who generates signed URLs? | The gateway (`/api/v1/files/signurl`) [SOURCE; KNOWN FROM LEGACY CLIENT] |

## 6. API Endpoint Inventory

**Scale.**
- 243 `ApiService.getData` calls in 43 repositories: 105 GET, 42 POST, 45 PUT, 51 DELETE.
- 220 distinct gateway method/path combinations are reached from routes.
- 21 repository functions are not reached by any route (dead or commented callers).

**Path notation.** Paths are shown as written, with variables in place (e.g. `…/request.id`, `…/:id`, `…/id`).

**Default auth.** `Authorization: Bearer <session access_token>`, except:
- `POST /api/v1/auth/login` uses `Bearer ` (empty).
- LoyaltyMember sends custom headers.
- UserVerification sends custom headers.

### 6.1 Gateway base paths per repository

| Repository | Gateway base path(s) | Calls |
|---|---|---|
| AuthRepository | `/api/v1/auth/login`, `/api/v1/auth/logout` | 2 |
| BannerRepository | `/api/v1/cms/banners` | 6 |
| CatalogRepository | `/api/v1/cms/products` | 1 |
| ContentRepository | `/api/v1/cms/contents` | 6 |
| CustomCatalogProductHomepageRepository | `/api/v1/cms/custom-catalog-product-homepages` | 7 |
| CustomCatalogRepository | `/api/v1/cms/custom-catalogs` | 7 |
| CustomCriteriaRepository | `/api/v1/cms/custom-criterias` | 7 |
| CustomerGroupRepository | `/api/v1/cms/customer-groups` | 6 |
| CustomerRepository | `/api/v1/cms/customers`, `/api/v1/cms/customer-channels`, `/api/v1/cms/customer-areas` | 4 |
| CustomersListOptionsRepository | `/api/v1/cms/custom-personalizations` | 2 |
| FAQRepository | `/api/v1/cms/faqs-categories`, `/api/v1/cms/faqs` | 7 |
| FeedbackRepository | `/api/v1/cms/feedbacks` | 5 |
| FileRepository | `/api/v1/files/signurl` | 1 |
| GamificationRepository | `/api/v1/cms/gamifications` | 12 |
| GlobalConfigurationRepository | `/api/v1/cms/global-configurations` | 8 |
| GposBrandRepository | `/api/v1/cms/merchants` | 5 |
| GposBrandShipppingVoucherRepository | `/api/v1/cms/merchants` | 3 |
| GroupStoryRepository | `/api/v1/cms/story-groups` | 6 |
| InjectPoinRepository | `/api/v1/cms/loyalties` | 3 |
| InventoryRepository | `/api/v1/cms/inventories` | 6 |
| InventoryStockRepository | `url`, `url/id` | 6 |
| LoyaltyMemberRepository | `/api/v1/cms/patient-loyalty` | 7 |
| LoyaltyRepository | `/api/v1/cms/loyalties` | 3 |
| MobilePreviewRepocitory | `/api/v1/cms/mobile-preview` | 1 |
| MutasiRedeemPoinRepository | `/api/v1/cms/loyalties` | 8 |
| NotificationRepository | `/api/v1/cms/notifications` | 7 |
| OrderRepository | `/api/v1/cms/orders` | 6 |
| OrderReviewRepository | `/api/v1/cms/order-reviews` | 5 |
| PaymentRepository | `/api/v1/cms/payments` | 3 |
| PersonalizationChannelRepository | `/api/v1/cms/custom-personalizations`, `/api/v1/cms/custom-personalizationsProduct` | 15 |
| PoinVoucherRepository | `/api/v1/cms/loyalties` | 5 |
| PrincipalRepository | `/api/v1/cms/products` | 7 |
| ProductCategoryRepository | `/api/v1/cms/product-categories` | 7 |
| ProductClassRepository | `/api/v1/cms/product-class` | 1 |
| ProductGposb2bHomepageRepository | `/api/v1/cms/product-gposb2b-homepages` | 7 |
| ProductRepository | `/api/v1/cms/products` | 10 |
| ProductRestrictedRepository | `/api/v1/cms/product-restricted` | 6 |
| ReferralCodeRepository | `/api/v1/cms/loyalties` | 6 |
| SponsoredProductRepository | `/api/v1/cms/sponsored-products` | 6 |
| TcRepository | `/api/v1/cms/tc` | 2 |
| UserManagementRepository | `/api/v1/cms/customers` | 8 |
| UserVerificationRepository | `/api/v1/cms/users` | 5 |
| VoucherRepository | `/api/v1/cms/loyalties` | 8 |

### 6.2 Route → gateway inventory (all non-missing routes)

`— (no gateway call)` marks routes that are purely local:
- Static option lists (Banner platform, Gamification option lists).
- The env-template CSV (`generate-csv`).
- The local CSV parse (`validate-branch-csv`).
- `ProductGposb2bController.update`, whose mapper method is missing.
- `GamificationController.postUpdate` (flash only).

Page routes that call nothing only render a shell.

| Feature (controller) | Legacy route | Type | Gateway call(s) (method path) | Gateway auth | Response to browser |
|---|---|---|---|---|---|
| Auth | GET `/` → getLogin | PUBLIC_PAGE | — (no gateway call) | — | HTML |
| Auth | GET `/logout` → getLogout | REDIRECT | `POST /api/v1/auth/logout` | Bearer | 302 |
| Auth | POST `/login` → postLogin | FORM_SUBMISSION | `POST /api/v1/auth/login` | none | 302 redirect + flash |
| Banner | GET `/banner/create` → create | AUTHENTICATED_PAGE | `GET /api/v1/cms/customer-channels`<br>`GET /api/v1/cms/customer-areas` | Bearer | HTML (Edge view) |
| Banner | POST `/banner/datatable` → datatable | DATATABLE | `GET /api/v1/cms/banners` | Bearer | JSON DataTables |
| Banner | POST `/banner/delete` → delete | DELETE | `DELETE /api/v1/cms/banners/request.id` | Bearer | 302 redirect + flash (or JSON) |
| Banner | GET `/banner/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/banners/request.id`<br>`GET /api/v1/cms/custom-criterias/detail`<br>`GET /api/v1/cms/customers`<br>`GET /api/v1/cms/customer-channels`<br>`GET /api/v1/cms/customer-areas` | Bearer | HTML (Edge view) |
| Banner | GET `/banner/aam-cust-id` → getBannerAamCustIdOptions | OPTIONS | `GET /api/v1/cms/customers` | Bearer | JSON select2 {results} |
| Banner | GET `/banner/branch` → getBannerBranchOptions | OPTIONS | `GET /api/v1/cms/customer-areas` | Bearer | JSON select2 {results} |
| Banner | GET `/banner/channel-type` → getBannerChannelTypeOptions | OPTIONS | `GET /api/v1/cms/customer-channels` | Bearer | JSON select2 {results} |
| Banner | GET `/banner/cust-id` → getBannerCustIdOptions | OPTIONS | `GET /api/v1/cms/customers` | Bearer | JSON select2 {results} |
| Banner | GET `/banner/platform-options` → getBannerPlatformOptions | OPTIONS | — (no gateway call) | — | JSON select2 {results} |
| Banner | GET `/banner` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Banner | POST `/banner/multidelete` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/banners/bulk` | Bearer | 302 redirect + flash |
| Banner | POST `/banner` → store | AJAX_ACTION | `POST /api/v1/cms/banners`<br>`POST /api/v1/cms/customers/id-list` | Bearer | JSON / raw gateway body / redirect |
| Banner | PUT|PATCH `/banner/:id` → update | AJAX_ACTION | `PUT /api/v1/cms/banners/request.id`<br>`POST /api/v1/cms/customers/id-list` | Bearer | JSON / raw gateway body / redirect |
| Catalog | GET `/catalog/options` → getCatalogOptions | OPTIONS | `GET /api/v1/cms/products/catalogs/options` | Bearer | JSON select2 {results} |
| Content | GET `/content/create` → create | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Content | POST `/content/datatable` → datatable | DATATABLE | `GET /api/v1/cms/contents` | Bearer | JSON DataTables |
| Content | POST `/content/delete` → delete | DELETE | `DELETE /api/v1/cms/contents/request.id` | Bearer | 302 redirect + flash (or JSON) |
| Content | GET `/content/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/contents/request.id` | Bearer | HTML (Edge view) |
| Content | GET `/content` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Content | POST `/content/multidelete` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/contents/bulk` | Bearer | 302 redirect + flash |
| Content | POST `/content` → store | FORM_SUBMISSION | `POST /api/v1/cms/contents` | Bearer | 302 redirect + flash |
| Content | PUT|PATCH `/content/:id` → update | FORM_SUBMISSION | `PUT /api/v1/cms/contents/request.id` | Bearer | 302 redirect + flash |
| CustomCatalog | GET `/custom-catalog/create` → create | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| CustomCatalog | POST `/custom-catalog/datatable` → datatable | DATATABLE | `GET /api/v1/cms/custom-catalogs` | Bearer | JSON DataTables |
| CustomCatalog | POST `/custom-catalog/delete` → delete | DELETE | `DELETE /api/v1/cms/custom-catalogs/request.id` | Bearer | 302 redirect + flash (or JSON) |
| CustomCatalog | GET `/custom-catalog/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/custom-catalogs/request.id`<br>`GET /api/v1/cms/custom-criterias/detail` | Bearer | HTML (Edge view) |
| CustomCatalog | GET `/custom-catalogs/options` → getCustomCatalogOptions | OPTIONS | `GET /api/v1/cms/custom-catalogs/options` | Bearer | JSON select2 {results} |
| CustomCatalog | GET `/custom-catalog` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| CustomCatalog | POST `/custom-catalog/multidelete` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/custom-catalogs/bulk` | Bearer | 302 redirect + flash |
| CustomCatalog | POST `/custom-catalog` → store | FORM_SUBMISSION | `POST /api/v1/cms/custom-catalogs` | Bearer | 302 redirect + flash |
| CustomCatalog | PUT|PATCH `/custom-catalog/:id` → update | FORM_SUBMISSION | `PUT /api/v1/cms/custom-catalogs/request.id` | Bearer | 302 redirect + flash |
| CustomCatalogProductHomepage | GET `/custom-catalog-product-homepage/create` → create | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| CustomCatalogProductHomepage | POST `/custom-catalog-product-homepage/datatable` → datatable | DATATABLE | `GET /api/v1/cms/custom-catalog-product-homepages` | Bearer | JSON DataTables |
| CustomCatalogProductHomepage | POST `/custom-catalog-product-homepage/datatable_customcatalog/:id` → datatableByCustomCatalogId | DATATABLE | `GET /api/v1/cms/custom-catalog-product-homepages` | Bearer | JSON DataTables |
| CustomCatalogProductHomepage | POST `/custom-catalog-product-homepage/delete` → delete | DELETE | `DELETE /api/v1/cms/custom-catalog-product-homepages/request.id` | Bearer | 302 redirect + flash (or JSON) |
| CustomCatalogProductHomepage | GET `/custom-catalog-product-homepage/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/custom-catalog-product-homepages/request.id` | Bearer | HTML (Edge view) |
| CustomCatalogProductHomepage | GET `/custom-catalog-product-homepage` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| CustomCatalogProductHomepage | POST `/custom-catalog-product-homepage/multidelete` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/custom-catalog-product-homepages/bulk` | Bearer | 302 redirect + flash |
| CustomCatalogProductHomepage | POST `/custom-catalog-product-homepage` → store | FORM_SUBMISSION | `POST /api/v1/cms/custom-catalog-product-homepages` | Bearer | 302 redirect + flash |
| CustomCatalogProductHomepage | PUT|PATCH `/custom-catalog-product-homepage/:id` → update | FORM_SUBMISSION | `PUT /api/v1/cms/custom-catalog-product-homepages/request.id` | Bearer | 302 redirect + flash |
| CustomCriteria | GET `/custom-criteria/create` → create | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| CustomCriteria | POST `/custom-criteria/datatable` → datatable | DATATABLE | `GET /api/v1/cms/custom-criterias` | Bearer | JSON DataTables |
| CustomCriteria | POST `/custom-criteria/delete` → delete | DELETE | `DELETE /api/v1/cms/custom-criterias/request.id` | Bearer | 302 redirect + flash (or JSON) |
| CustomCriteria | GET `/custom-criteria/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/custom-criterias/request.id` | Bearer | HTML (Edge view) |
| CustomCriteria | GET `/custom-criteria` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| CustomCriteria | POST `/custom-criteria/multidelete` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/custom-criterias/bulk` | Bearer | 302 redirect + flash |
| CustomCriteria | POST `/custom-criteria` → store | FORM_SUBMISSION | `POST /api/v1/cms/custom-criterias` | Bearer | 302 redirect + flash |
| CustomCriteria | POST `/custom-criteria/update_by_custom_type/:type` → updateByCustomType | FORM_SUBMISSION | `PUT /api/v1/cms/custom-criterias/request.id` | Bearer | 302 redirect + flash |
| CustomerGroup | GET `/customer-groups/create` → create | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| CustomerGroup | POST `/customer-groups/datatable` → datatable | DATATABLE | `GET /api/v1/cms/customer-groups` | Bearer | JSON DataTables |
| CustomerGroup | DELETE `/customer-groups/:id` → destroy | DELETE | `DELETE /api/v1/cms/customer-groups/bulk` | Bearer | 302 redirect + flash (or JSON) |
| CustomerGroup | GET `/customer-groups/options` → getOptions | OPTIONS | `GET /api/v1/cms/customer-groups` | Bearer | JSON select2 {results} |
| CustomerGroup | GET `/customer-groups` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| CustomerGroup | DELETE `/customer-groups` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/customer-groups/bulk` | Bearer | 302 redirect + flash |
| CustomerGroup | GET `/customer-groups/search-product` → searchProduct | SEARCH | `GET /api/v1/cms/products` | Bearer | JSON select2 {results} |
| CustomerGroup | GET `/customer-groups/:id` → show | AUTHENTICATED_PAGE | `GET /api/v1/cms/customer-groups/id` | Bearer | HTML (Edge view) |
| CustomerGroup | POST `/customer-groups` → store | AJAX_ACTION | `POST /api/v1/cms/customer-groups` | Bearer | JSON / raw gateway body / redirect |
| CustomerGroup | PUT|PATCH `/customer-groups/:id` → update | AJAX_ACTION | `PUT /api/v1/cms/customer-groups/id` | Bearer | JSON / raw gateway body / redirect |
| FAQ | GET `/faqs/create` → create | AUTHENTICATED_PAGE | `GET /api/v1/cms/faqs-categories` | Bearer | HTML (Edge view) |
| FAQ | POST `/faqs/datatable` → datatable | DATATABLE | `GET /api/v1/cms/faqs` | Bearer | JSON DataTables |
| FAQ | DELETE `/faqs/:id` → destroy | DELETE | `DELETE /api/v1/cms/faqs/id` | Bearer | 302 redirect + flash (or JSON) |
| FAQ | GET `/faqs/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/faqs/id`<br>`GET /api/v1/cms/faqs-categories` | Bearer | HTML (Edge view) |
| FAQ | GET `/faqs` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| FAQ | DELETE `/faqs` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/faqs` | Bearer | 302 redirect + flash |
| FAQ | POST `/faqs` → store | FORM_SUBMISSION | `POST /api/v1/cms/faqs` | Bearer | 302 redirect + flash |
| FAQ | PUT|PATCH `/faqs/:id` → update | FORM_SUBMISSION | `PUT /api/v1/cms/faqs/id` | Bearer | 302 redirect + flash |
| Feedback | POST `/feedback/datatable` → datatable | DATATABLE | `GET /api/v1/cms/feedbacks` | Bearer | JSON DataTables |
| Feedback | POST `/feedback/delete` → delete | DELETE | `DELETE /api/v1/cms/feedbacks/request.id` | Bearer | 302 redirect + flash (or JSON) |
| Feedback | GET `/feedback/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/feedbacks/request.id` | Bearer | HTML (Edge view) |
| Feedback | GET `/feedback` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Feedback | POST `/feedback/multidelete` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/feedbacks/bulk` | Bearer | 302 redirect + flash |
| Feedback | PUT|PATCH `/feedback/:id` → update | FORM_SUBMISSION | `PUT /api/v1/cms/feedbacks/request.id` | Bearer | 302 redirect + flash |
| File | POST `/files/signurl` → signURL | UPLOAD | `POST /api/v1/files/signurl` | Bearer | JSON {url,file_url} / 400 / 500 |
| Gamification | GET `/gamification/create/multi` → createMulti | AUTHENTICATED_PAGE | `GET /api/v1/cms/gamifications/programs/vouchers`<br>`GET /api/v1/cms/products/options` | Bearer | HTML (Edge view) |
| Gamification | GET `/gamification/create/single` → createSingle | AUTHENTICATED_PAGE | `GET /api/v1/cms/gamifications/programs/vouchers` | Bearer | HTML (Edge view) |
| Gamification | GET `/gamification/create/type` → createType | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Gamification | POST `/gamification/delete` → delete | DELETE | `DELETE /api/v1/cms/gamifications/programs/request.id` | Bearer | 302 redirect + flash (or JSON) |
| Gamification | GET `/gamification/:id/generate-csv` → downloadGenerateCsv | DOWNLOAD | `GET /api/v1/cms/gamifications/programs/request.id/csv/generates` | Bearer | JSON/text URL |
| Gamification | GET `/gamification/:id/generate-csv-progress` → downloadGenerateCsvProgress | DOWNLOAD | `GET /api/v1/cms/gamifications/programs/request.id/csv/progress` | Bearer | JSON/text URL |
| Gamification | GET `/gamification/:id/duplicate` → duplicate | AUTHENTICATED_PAGE | `GET /api/v1/cms/gamifications/programs/vouchers`<br>`GET /api/v1/cms/gamifications/programs/request.id` | Bearer | HTML (Edge view) |
| Gamification | GET `/gamification/:id` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/gamifications/programs/vouchers`<br>`GET /api/v1/cms/gamifications/programs/request.id` | Bearer | HTML (Edge view) |
| Gamification | GET `/gamification/options/channel-order` → getChannelOrderOptions | OPTIONS | — (no gateway call) | — | JSON select2 {results} |
| Gamification | GET `/gamification/options/mission-type` → getMissionTypeOptions | OPTIONS | — (no gateway call) | — | JSON select2 {results} |
| Gamification | GET `/gamification/options/price-type` → getPriceTypeOptions | OPTIONS | — (no gateway call) | — | JSON select2 {results} |
| Gamification | GET `/gamification/options/principal` → getPrincipalOptions | OPTIONS | `GET /api/v1/cms/products/principals` | Bearer | JSON select2 {results} |
| Gamification | GET `/gamification/options/reward-type` → getRewardTypeOptions | OPTIONS | — (no gateway call) | — | JSON select2 {results} |
| Gamification | GET `/gamification/upload-csv-history/:id` → getUploadCsvHistory | UPLOAD | `GET /api/v1/cms/gamifications/programs/id/csv/history` | Bearer | JSON {url,file_url} / 400 / 500 |
| Gamification | GET `/gamification` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Gamification | GET `/gamification/list` → list | OTHER | `GET /api/v1/cms/gamifications/programs` | Bearer | JSON |
| Gamification | POST `/gamification/:id/post-update` → postUpdate | FORM_SUBMISSION | — (no gateway call) | — | 302 redirect + flash |
| Gamification | POST `/gamification` → store | AJAX_ACTION | `POST /api/v1/cms/gamifications/programs/`<br>`PUT /api/v1/cms/gamifications/programs/request.id/csv/uploads`<br>`POST /api/v1/cms/products/id-list`<br>`POST /api/v1/files/signurl` | Bearer | JSON / raw gateway body / redirect |
| Gamification | PUT `/gamification/:id` → update | AJAX_ACTION | `PUT /api/v1/cms/gamifications/programs/request.id`<br>`POST /api/v1/cms/products/list-by-product-codes`<br>`POST /api/v1/cms/products/list-by-product-ids` | Bearer | JSON / raw gateway body / redirect |
| Gamification | PUT `/gamification/:id/update-status` → updateStatus | AJAX_ACTION | `PUT /api/v1/cms/gamifications/programs/request.id/status` | Bearer | JSON / raw gateway body / redirect |
| Gamification | POST `/gamification/upload-csv` → uploadCsv | UPLOAD | `PUT /api/v1/cms/gamifications/programs/request.id/csv/uploads` | Bearer | JSON {url,file_url} / 400 / 500 |
| Gamification | POST `/gamification/upload-csv-progress` → uploadCsvProgress | UPLOAD | `PUT /api/v1/cms/gamifications/programs/request.id/csv/progress` | Bearer | JSON {url,file_url} / 400 / 500 |
| GlobalConfiguration | GET `/global-configuration/create` → create | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| GlobalConfiguration | POST `/global-configuration/datatable` → datatable | DATATABLE | `GET /api/v1/cms/global-configurations` | Bearer | JSON DataTables |
| GlobalConfiguration | POST `/global-configuration/delete` → delete | DELETE | `DELETE /api/v1/cms/global-configurations/request.id` | Bearer | 302 redirect + flash (or JSON) |
| GlobalConfiguration | GET `/global-configuration/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/global-configurations/request.id` | Bearer | HTML (Edge view) |
| GlobalConfiguration | GET `/global-configuration` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| GlobalConfiguration | POST `/global-configuration/multidelete` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/global-configurations/bulk` | Bearer | 302 redirect + flash |
| GlobalConfiguration | POST `/global-configuration` → store | FORM_SUBMISSION | `POST /api/v1/cms/global-configurations` | Bearer | 302 redirect + flash |
| GlobalConfiguration | PUT|PATCH `/global-configuration/:id` → update | FORM_SUBMISSION | `PUT /api/v1/cms/global-configurations/request.id` | Bearer | 302 redirect + flash |
| GlobalConfiguration | POST `/global-configuration/updatebyproductgposb2b` → updateByProductGposb2b | FORM_SUBMISSION | `PUT /api/v1/cms/global-configurations/request.id` | Bearer | 302 redirect + flash |
| GposBrand | POST `/gpos-brand/datatable` → datatable | DATATABLE | `GET /api/v1/cms/merchants/sales-orders` | Bearer | JSON DataTables |
| GposBrand | GET `/gpos-brand/detail-pesanan/:id` → detailPesanan | AUTHENTICATED_PAGE | `GET /api/v1/cms/merchants/sales-orders/id` | Bearer | HTML (Edge view) |
| GposBrand | GET `/gpos-brand` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| GposBrand | POST `/gpos-brand/:id/update-shipment-detail` → updateShipmentDetail | FORM_SUBMISSION | `PUT /api/v1/cms/merchants/sales-orders/id/shipment-detail` | Bearer | 302 redirect + flash |
| GposBrand | POST `/gpos-brand/:id/update-shipment-fee` → updateShipmentFee | FORM_SUBMISSION | `PUT /api/v1/cms/merchants/sales-orders/id/shipment-fee` | Bearer | 302 redirect + flash |
| GposBrand | POST `/gpos-brand/:id/update-status-to-canceled` → updateStatusToCanceled | FORM_SUBMISSION | `PUT /api/v1/cms/merchants/sales-orders/id/update-status-to-canceled` | Bearer | 302 redirect + flash |
| GposBrandShippingVoucher | GET `/gpos-brand/shipping-voucher/:id/cancel` → cancelVoucher | REDIRECT | `PUT /api/v1/cms/merchants/discounts/id/cancel` | Bearer | 302 |
| GposBrandShippingVoucher | GET `/gpos-brand/shipping-voucher/create` → create | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| GposBrandShippingVoucher | POST `/gpos-brand/shipping-voucher/datatable` → datatable | DATATABLE | `GET /api/v1/cms/merchants/discounts/listpage` | Bearer | JSON DataTables |
| GposBrandShippingVoucher | GET `/gpos-brand/shipping-voucher` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| GposBrandShippingVoucher | POST `/gpos-brand/shipping-voucher/submit` → submitVoucher | FORM_SUBMISSION | `POST /api/v1/cms/merchants/discounts` | Bearer | 302 redirect + flash |
| GroupStory | GET `/group-story/create` → create | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| GroupStory | POST `/group-story/datatable` → datatable | DATATABLE | `GET /api/v1/cms/story-groups` | Bearer | JSON DataTables |
| GroupStory | DELETE `/group-story/:id` → destroy | DELETE | `DELETE /api/v1/cms/story-groups/id` | Bearer | 302 redirect + flash (or JSON) |
| GroupStory | GET `/group-story/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/story-groups/id`<br>`GET /api/v1/cms/banners` | Bearer | HTML (Edge view) |
| GroupStory | GET `/group-story/available-banners` → getAvailableBanners | OTHER | `GET /api/v1/cms/banners` | Bearer | JSON |
| GroupStory | GET `/group-story` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| GroupStory | DELETE `/group-story` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/story-groups/bulk` | Bearer | 302 redirect + flash |
| GroupStory | POST `/group-story` → store | AJAX_ACTION | `POST /api/v1/cms/story-groups` | Bearer | JSON / raw gateway body / redirect |
| GroupStory | PUT|PATCH `/group-story/:id` → update | AJAX_ACTION | `GET /api/v1/cms/story-groups/id`<br>`PUT /api/v1/cms/story-groups/id` | Bearer | JSON / raw gateway body / redirect |
| Home | GET `/home` → home | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Inventory | GET `/inventories/create` → create | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Inventory | POST `/inventories/datatable` → datatable | DATATABLE | `GET /api/v1/cms/inventories` | Bearer | JSON DataTables |
| Inventory | DELETE `/inventories/:id` → destroy | DELETE | `DELETE /api/v1/cms/inventories/id` | Bearer | 302 redirect + flash (or JSON) |
| Inventory | GET `/inventories/:id/edit` → edit | AUTHENTICATED_PAGE | `GET url`<br>`GET /api/v1/cms/inventories/id` | Bearer | HTML (Edge view) |
| Inventory | GET `/inventories` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Inventory | DELETE `/inventories` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/inventories` | Bearer | 302 redirect + flash |
| Inventory | GET `/inventories/search-product` → searchProduct | SEARCH | `GET /api/v1/cms/products` | Bearer | JSON select2 {results} |
| Inventory | POST `/inventories` → store | FORM_SUBMISSION | `POST /api/v1/cms/inventories` | Bearer | 302 redirect + flash |
| Inventory | PUT|PATCH `/inventories/:id` → update | FORM_SUBMISSION | `PUT /api/v1/cms/inventories/id` | Bearer | 302 redirect + flash |
| InventoryStock | DELETE `/inventories/:inventoryId/inventory-stocks/:id` → destroy | DELETE | `DELETE url/id` | Bearer | 302 redirect + flash (or JSON) |
| InventoryStock | DELETE `/inventories/:inventoryId/inventory-stocks` → multidelete | MULTI_DELETE | `DELETE url` | Bearer | 302 redirect + flash |
| InventoryStock | POST `/inventories/:inventoryId/inventory-stocks` → store | FORM_SUBMISSION | `POST url` | Bearer | 302 redirect + flash |
| InventoryStock | PUT|PATCH `/inventories/:inventoryId/inventory-stocks/:id` → update | FORM_SUBMISSION | `PUT url/id` | Bearer | 302 redirect + flash |
| LoyaltyMember | GET `/loyalty-member/:id/voucher` → createProgramDetailByPrincipal | AUTHENTICATED_PAGE | `GET /api/v1/cms/patient-loyalty/cards` | Bearer + X-Userid/X-Useremail/X-Username/X-RoleName | HTML (Edge view) |
| LoyaltyMember | GET `/loyalty-member/:id/point` → createProgramDetailByPrincipal | AUTHENTICATED_PAGE | `GET /api/v1/cms/patient-loyalty/cards` | Bearer + X-Userid/X-Useremail/X-Username/X-RoleName | HTML (Edge view) |
| LoyaltyMember | POST `/loyalty-member/generate-csv` → generateCardCsv | DOWNLOAD | — (no gateway call) | — | JSON/text URL |
| LoyaltyMember | GET `/loyalty-member` → index | AUTHENTICATED_PAGE | `GET /api/v1/cms/patient-loyalty/cards` | Bearer + X-Userid/X-Useremail/X-Username/X-RoleName | HTML (Edge view) |
| LoyaltyMember | GET `/loyalty-member/:id/list` → programByPrincipalDataTable | DATATABLE | `GET /api/v1/cms/patient-loyalty/cards/id/programs` | Bearer + X-Userid/X-Useremail/X-Username/X-RoleName | JSON DataTables |
| LoyaltyMember | GET `/loyalty-member/:id` → programByPrincipalList | AUTHENTICATED_PAGE | `GET /api/v1/cms/patient-loyalty/cards` | Bearer + X-Userid/X-Useremail/X-Username/X-RoleName | HTML (Edge view) |
| LoyaltyMember | GET `/loyalty-member/:id/:program/:type` → programDetailByPrincipal | AUTHENTICATED_PAGE | `GET /api/v1/cms/patient-loyalty/cards/programs/id` | Bearer + X-Userid/X-Useremail/X-Username/X-RoleName | HTML (Edge view) |
| LoyaltyMember | POST `/loyalty-member/card/:id` → putCard | FORM_SUBMISSION | `PUT /api/v1/cms/patient-loyalty/cards/id` | Bearer + X-Userid/X-Useremail/X-Username/X-RoleName | 302 redirect + flash |
| LoyaltyMember | POST `/loyalty-member/:id/update` → putProgramDetailByPrincipal | FORM_SUBMISSION | `PUT /api/v1/cms/patient-loyalty/cards/programs/program_id` | Bearer + X-Userid/X-Useremail/X-Username/X-RoleName | 302 redirect + flash |
| LoyaltyMember | POST `/loyalty-member/card` → storeCard | FORM_SUBMISSION | `POST /api/v1/cms/patient-loyalty/cards` | Bearer + X-Userid/X-Useremail/X-Username/X-RoleName | 302 redirect + flash |
| LoyaltyMember | POST `/loyalty-member/:id/voucher` → storeProgramDetailByPrincipal | FORM_SUBMISSION | `POST /api/v1/cms/patient-loyalty/cards/programs` | Bearer + X-Userid/X-Useremail/X-Username/X-RoleName | 302 redirect + flash |
| LoyaltyMember | POST `/loyalty-member/:id/point` → storeProgramDetailByPrincipal | FORM_SUBMISSION | `POST /api/v1/cms/patient-loyalty/cards/programs` | Bearer + X-Userid/X-Useremail/X-Username/X-RoleName | 302 redirect + flash |
| LoyaltyMember | POST `/loyalty-member/validate-branch-csv` → validateBranchCsv | DOWNLOAD | — (no gateway call) | — | JSON/text URL |
| MutasiRedeemPoin | POST `/poin-voucher/redeem/reguler/datatable` → datatable | DATATABLE | `GET /api/v1/cms/customers/users`<br>`GET /api/v1/cms/loyalties/point-histories` | Bearer | JSON DataTables |
| MutasiRedeemPoin | GET `/poin-voucher/redeem/point-types` → getPointTypes | OPTIONS | `GET /api/v1/cms/loyalties/point-types` | Bearer | JSON select2 {results} |
| MutasiRedeemPoin | GET `/poin-voucher/redeem` → redeemPoint | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Notification | POST `/notification/cancel` → cancel | FORM_SUBMISSION | `PUT /api/v1/cms/notifications/push-notifications/request.id/cancels` | Bearer | 302 redirect + flash |
| Notification | GET `/notification/create` → create | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Notification | POST `/notification/datatable` → datatable | DATATABLE | `GET /api/v1/cms/notifications/push-notifications` | Bearer | JSON DataTables |
| Notification | POST `/notification/delete` → delete | DELETE | `DELETE /api/v1/cms/notifications/push-notifications/request.id` | Bearer | 302 redirect + flash (or JSON) |
| Notification | GET `/notification/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/notifications/push-notifications/request.id`<br>`GET /api/v1/cms/customers`<br>`GET /api/v1/cms/customer-channels`<br>`GET /api/v1/cms/customer-areas`<br>`GET /api/v1/cms/products/options`<br>`POST /api/v1/cms/products/options/by-ids` | Bearer | HTML (Edge view) |
| Notification | POST `/notification/final` → final | FORM_SUBMISSION | `PUT /api/v1/cms/notifications/push-notifications/request.id/cancels` | Bearer | 302 redirect + flash |
| Notification | GET `/notification` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Notification | DELETE `/notification` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/notifications/push-notifications/bulk` | Bearer | 302 redirect + flash |
| Notification | POST `/notification/save` → save | AJAX_ACTION | `POST /api/v1/cms/notifications/push-notifications` | Bearer | JSON / raw gateway body / redirect |
| Notification | POST `/notification` → store | FORM_SUBMISSION | `POST /api/v1/cms/notifications/push-notifications` | Bearer | 302 redirect + flash |
| Notification | PUT|PATCH `/notification/:id` → update | AJAX_ACTION | `PUT /api/v1/cms/notifications/push-notifications/request.id` | Bearer | JSON / raw gateway body / redirect |
| Order | POST `/order/datatable` → datatable | DATATABLE | `GET /api/v1/cms/orders` | Bearer | JSON DataTables |
| Order | GET `/order/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/orders/request.id` | Bearer | HTML (Edge view) |
| Order | GET `/order` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Order | DELETE `/order` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/orders/bulk` | Bearer | 302 redirect + flash |
| Order | PUT `/order/:id/sync-status` → syncStatus | AJAX_ACTION | `PUT /api/v1/cms/orders/request.id/sync-status` | Bearer | JSON / raw gateway body / redirect |
| Order | PUT|PATCH `/order/:id` → update | FORM_SUBMISSION | `PUT /api/v1/cms/orders/request.id` | Bearer | 302 redirect + flash |
| OrderReview | POST `/order-review/datatable` → datatable | DATATABLE | `GET /api/v1/cms/order-reviews` | Bearer | JSON DataTables |
| OrderReview | POST `/order-review/delete` → delete | DELETE | `DELETE /api/v1/cms/order-reviews/request.id` | Bearer | 302 redirect + flash (or JSON) |
| OrderReview | GET `/order-review/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/order-reviews/request.id` | Bearer | HTML (Edge view) |
| OrderReview | GET `/order-review` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| OrderReview | POST `/order-review/multidelete` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/order-reviews/bulk` | Bearer | 302 redirect + flash |
| Payment | POST `/payment/datatable` → datatable | DATATABLE | `GET /api/v1/cms/payments` | Bearer | JSON DataTables |
| Payment | GET `/payment/:id` → detail | AUTHENTICATED_PAGE | `GET /api/v1/cms/payments/id` | Bearer | HTML (Edge view) |
| Payment | GET `/payment` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Payment | POST `/payment/:id` → postTriggerReceipt | FORM_SUBMISSION | `POST /api/v1/cms/payments/bca-manual-settlements` | Bearer | 302 redirect + flash |
| PersonalizationChannel | GET `/personalization/channels/:id` → createPage | AUTHENTICATED_PAGE | `GET /api/v1/cms/global-configurations/detail`<br>`GET /api/v1/cms/custom-personalizations/id` | Bearer | HTML (Edge view) |
| PersonalizationChannel | POST `/personalization/channels/create` → createPersonalizationChannel | FORM_SUBMISSION | `POST /api/v1/cms/custom-personalizations` | Bearer | 302 redirect + flash |
| PersonalizationChannel | GET `/personalization/channels/customers/list-options` → CustomersListOptionsController | OPTIONS | `GET /api/v1/cms/custom-personalizations/customers/list-options/?keyword=encodeURIComponent(request.keyword \|\| )` | Bearer | JSON select2 {results} |
| PersonalizationChannel | POST `/personalization/channels/customers-validate` → CustomersValidateController | FORM_SUBMISSION | `POST /api/v1/cms/custom-personalizations/customers/validate-usage` | Bearer | 302 redirect + flash |
| PersonalizationChannel | POST `/personalization/channels/datatable` → datatable | DATATABLE | `GET /api/v1/cms/custom-personalizations` | Bearer | JSON DataTables |
| PersonalizationChannel | POST `/personalization/channels/:id/products/datatable` → datatableProduct | DATATABLE | `GET /api/v1/cms/custom-personalizations/id/products` | Bearer | JSON DataTables |
| PersonalizationChannel | DELETE `/personalization/channels/:id` → deleteChannelController | DELETE | `DELETE /api/v1/cms/custom-personalizations/id` | Bearer | 302 redirect + flash (or JSON) |
| PersonalizationChannel | DELETE `/personalization/channels/products/:id` → deleteProduct | DELETE | `DELETE /api/v1/cms/custom-personalizationsProduct/id` | Bearer | 302 redirect + flash (or JSON) |
| PersonalizationChannel | DELETE `/personalization/channels/products/bulk` → deleteProductBulk | MULTI_DELETE | `DELETE /api/v1/cms/custom-personalizationsProduct/bulk` | Bearer | 302 redirect + flash |
| PersonalizationChannel | GET `/personalization/channels/products/:id` → getProductDetail | REDIRECT | `GET /api/v1/cms/custom-personalizationsProduct/id` | Bearer | 302 |
| PersonalizationChannel | GET `/personalization/channels/products/list-options` → getProductListOptionsController | OPTIONS | `GET /api/v1/cms/products/options` | Bearer | JSON select2 {results} |
| PersonalizationChannel | GET `/personalization/channels` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| PersonalizationChannel | GET `/personalization/channels/list-options` → listOptions | OPTIONS | `GET /api/v1/cms/custom-personalizations/channels/list-options/?keyword=request.keyword` | Bearer | JSON select2 {results} |
| PersonalizationChannel | GET `/personalization/channels/:id/principals/list-options` → PrincipalListOptionsController | OPTIONS | `GET /api/v1/cms/custom-personalizations/id/principals/options/?keyword=encodeURIComponent(request.terms \|\| )&product_category_id=encodeURIComponent(request.productCategoryId \|\| )` | Bearer | JSON select2 {results} |
| PersonalizationChannel | GET `/personalization/channels/:id/product-categories/list-options` → ProductCategoriesListOptionsController | OPTIONS | `GET /api/v1/cms/custom-personalizations/id/product-categories/options/?keyword=encodeURIComponent(request.keyword \|\| )` | Bearer | JSON select2 {results} |
| PersonalizationChannel | POST `/personalization/channels/:id/products/save` → saveProduct | FORM_SUBMISSION | `PUT /api/v1/cms/custom-personalizationsProduct/id`<br>`POST /api/v1/cms/custom-personalizations/id/products` | Bearer | 302 redirect + flash |
| PersonalizationChannel | POST `/personalization/channels/:id` → update | AJAX_ACTION | `PUT /api/v1/cms/custom-personalizations/id` | Bearer | JSON / raw gateway body / redirect |
| PoinVoucher | GET `/poin-voucher/setting-point/create-point/bonus-point-program` → createBonusPointProgram | AUTHENTICATED_PAGE | `GET /api/v1/cms/customer-channels`<br>`GET /api/v1/cms/customer-areas` | Bearer | HTML (Edge view) |
| PoinVoucher | POST `/poin-voucher/setting-point/create-point/bonus-point-program/summary` → createBonusPointProgramSummary | AUTHENTICATED_PAGE(POST-rendered) | `GET /api/v1/cms/products/id` | Bearer | HTML (summary view) |
| PoinVoucher | GET `/poin-voucher/inject-point/create` → createInjectPoint | AUTHENTICATED_PAGE | `GET /api/v1/cms/loyalties/point-types` | Bearer | HTML (Edge view) |
| PoinVoucher | POST `/poin-voucher/inject-point/create/summary` → createInjectPointSummary | AUTHENTICATED_PAGE(POST-rendered) | `GET /api/v1/cms/loyalties/point-types`<br>`GET /api/v1/cms/customers` | Bearer | HTML (summary view) |
| PoinVoucher | GET `/poin-voucher/setting-point/create-point` → createPoint | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| PoinVoucher | GET `/poin-voucher/setting-point/create-point/folamil` → createPointFolamil | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| PoinVoucher | GET `/poin-voucher/setting-point/create-point/folamil/summary` → createPointFolamilSummary | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| PoinVoucher | GET `/poin-voucher/setting-point/create-point/payment` → createPointPayment | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| PoinVoucher | GET `/poin-voucher/setting-point/create-point/payment/summary` → createPointPaymentSummmary | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| PoinVoucher | GET `/poin-voucher/setting-point/create-point/reguler` → createPointReguler | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| PoinVoucher | DELETE `/poin-voucher/inject-point` → deleteInjectPoint | DELETE | `DELETE /api/v1/cms/loyalties/inject-points` | Bearer | 302 redirect + flash (or JSON) |
| PoinVoucher | GET `/poin-voucher/setting-point/edit-point/bonus-point-program/:id` → editBonusPointProgram | AUTHENTICATED_PAGE | `GET /api/v1/cms/loyalties/programs/request.id`<br>`GET /api/v1/cms/customer-channels`<br>`GET /api/v1/cms/customer-areas` | Bearer | HTML (Edge view) |
| PoinVoucher | POST `/poin-voucher/setting-point/edit-point/bonus-point-program/:id/summary` → editBonusPointProgramSummary | AUTHENTICATED_PAGE(POST-rendered) | `GET /api/v1/cms/products/id` | Bearer | HTML (summary view) |
| PoinVoucher | GET `/poin-voucher` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| PoinVoucher | POST `/poin-voucher/inject-point/datatable` → injectPoinDatatable | DATATABLE | `GET /api/v1/cms/loyalties/point-types`<br>`GET /api/v1/cms/loyalties/inject-points` | Bearer | JSON DataTables |
| PoinVoucher | GET `/poin-voucher/inject-point` → injectPoint | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| PoinVoucher | GET `/poin-voucher/list` → list | OTHER | `GET /api/v1/cms/loyalties/programs` | Bearer | JSON |
| PoinVoucher | POST `/poin-voucher/inject-point` → multideleteInjectPoint | MULTI_DELETE | `DELETE /api/v1/cms/loyalties/inject-points` | Bearer | 302 redirect + flash |
| PoinVoucher | GET `/poin-voucher/setting-point` → settingPoint | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| PoinVoucher | POST `/poin-voucher` → store | FORM_SUBMISSION | `POST /api/v1/cms/loyalties/inject-points` | Bearer | 302 redirect + flash |
| PoinVoucher | POST `/poin-voucher/setting-point/create-point/bonus-point-program/summary/store` → storeBonusPointProgramSummary | FORM_SUBMISSION | `POST /api/v1/cms/loyalties/programs` | Bearer | 302 redirect + flash |
| PoinVoucher | POST `/poin-voucher/inject-point/create/summary/store` → storeInjectPointSummary | FORM_SUBMISSION | `POST /api/v1/cms/loyalties/inject-points` | Bearer | 302 redirect + flash |
| PoinVoucher | POST `/poin-voucher/setting-point/edit-point/bonus-point-program/:id/summary/store` → updateBonusPointProgramSummary | FORM_SUBMISSION | `PUT /api/v1/cms/loyalties/programs/:id` | Bearer | 302 redirect + flash |
| PoinVoucher | POST `/poin-voucher/setting-point/update-status` → updateStatus | FORM_SUBMISSION | `PUT /api/v1/cms/loyalties/programs/:request.id/status` | Bearer | 302 redirect + flash |
| PoinVoucherSettingVoucher | GET `/voucher-setting/:code/create-voucher` → createVoucher | AUTHENTICATED_PAGE | `GET /api/v1/cms/loyalties/vouchers/categories`<br>`GET /api/v1/cms/loyalties/vouchers/point-redeem-categories` | Bearer | HTML (Edge view) |
| PoinVoucherSettingVoucher | POST `/voucher-setting/:code/create-voucher/summary` → createVoucherSummary | AUTHENTICATED_PAGE(POST-rendered) | `GET /api/v1/cms/loyalties/vouchers/point-redeem-categories` | Bearer | HTML (summary view) |
| PoinVoucherSettingVoucher | GET `/voucher-setting/:code/update-voucher/:id` → editVoucher | AUTHENTICATED_PAGE | `GET /api/v1/cms/loyalties/vouchers/categories`<br>`GET /api/v1/cms/loyalties/vouchers/`<br>`GET /api/v1/cms/loyalties/vouchers/point-redeem-categories` | Bearer | HTML (Edge view) |
| PoinVoucherSettingVoucher | POST `/voucher-setting/:code/update-voucher/:id/summary` → editVoucherSummary | AUTHENTICATED_PAGE(POST-rendered) | `GET /api/v1/cms/loyalties/vouchers/point-redeem-categories` | Bearer | HTML (summary view) |
| PoinVoucherSettingVoucher | GET `/voucher-setting/:code` → getByVoucherType | AUTHENTICATED_PAGE | `GET /api/v1/cms/loyalties/vouchers/categories`<br>`GET /api/v1/cms/loyalties/vouchers/` | Bearer | HTML (Edge view) |
| PoinVoucherSettingVoucher | GET `/voucher-setting` → index | AUTHENTICATED_PAGE | `GET /api/v1/cms/loyalties/vouchers/categories` | Bearer | HTML (Edge view) |
| PoinVoucherSettingVoucher | POST `/voucher-setting/:code/create-voucher/summary/store` → storeVoucher | FORM_SUBMISSION | `POST /api/v1/cms/loyalties/vouchers` | Bearer | 302 redirect + flash |
| PoinVoucherSettingVoucher | POST `/voucher-setting/:code/update-voucher/:id/summary/update` → updateVoucher | FORM_SUBMISSION | `PUT /api/v1/cms/loyalties/vouchers/id`<br>`PUT /api/v1/cms/loyalties/vouchers/:id` | Bearer | 302 redirect + flash |
| PoinVoucherSettingVoucher | PUT `/voucher-setting/:code/update-is-active/:id` → updateVoucherIsActive | AJAX_ACTION | `PUT /api/v1/cms/loyalties/vouchers/:id/status` | Bearer | JSON / raw gateway body / redirect |
| Principal | GET `/principal/create` → create | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Principal | POST `/principal/datatable` → datatable | DATATABLE | `GET /api/v1/cms/products/principals` | Bearer | JSON DataTables |
| Principal | POST `/principal/delete` → delete | DELETE | `DELETE /api/v1/cms/products/principals/request.id` | Bearer | 302 redirect + flash (or JSON) |
| Principal | GET `/principal/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/products/principals/request.id` | Bearer | HTML (Edge view) |
| Principal | GET `/principal/options` → getPrincipalOptions | OPTIONS | `GET /api/v1/cms/products/principals/options` | Bearer | JSON select2 {results} |
| Principal | GET `/principal` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Principal | POST `/principal/multidelete` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/products/principals/bulk` | Bearer | 302 redirect + flash |
| Principal | POST `/principal` → store | FORM_SUBMISSION | `POST /api/v1/cms/products/principals` | Bearer | 302 redirect + flash |
| Principal | PUT|PATCH `/principal/:id` → update | FORM_SUBMISSION | `PUT /api/v1/cms/products/principals/request.id` | Bearer | 302 redirect + flash |
| ProductCategory | GET `/product-category/create` → create | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| ProductCategory | POST `/product-category/datatable` → datatable | DATATABLE | `GET /api/v1/cms/product-categories` | Bearer | JSON DataTables |
| ProductCategory | DELETE `/product-category/:id` → destroy | DELETE | `DELETE /api/v1/cms/product-categories/id` | Bearer | 302 redirect + flash (or JSON) |
| ProductCategory | GET `/product-category/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/product-categories/id` | Bearer | HTML (Edge view) |
| ProductCategory | GET `/product-category/options` → getProductCategoryOptions | OPTIONS | `GET /api/v1/cms/product-categories/options` | Bearer | JSON select2 {results} |
| ProductCategory | GET `/product-category` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| ProductCategory | DELETE `/product-category` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/product-categories` | Bearer | 302 redirect + flash |
| ProductCategory | POST `/product-category` → store | FORM_SUBMISSION | `POST /api/v1/cms/product-categories` | Bearer | 302 redirect + flash |
| ProductCategory | PUT|PATCH `/product-category/:id` → update | FORM_SUBMISSION | `PUT /api/v1/cms/product-categories/id` | Bearer | 302 redirect + flash |
| ProductClass | GET `/product-class/options` → getProductClassOptions | OPTIONS | `GET /api/v1/cms/product-class/options` | Bearer | JSON select2 {results} |
| Product | POST `/products/datatable` → datatable | DATATABLE | `GET /api/v1/cms/products` | Bearer | JSON DataTables |
| Product | GET `/products/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/products/id` | Bearer | HTML (Edge view) |
| Product | GET `/products/lini-options` → getProductLiniOptions | OPTIONS | `GET /api/v1/cms/products/lini-desc-options` | Bearer | JSON select2 {results} |
| Product | GET `/products/options` → getProductOptions | OPTIONS | `GET /api/v1/cms/products/options` | Bearer | JSON select2 {results} |
| Product | GET `/products/sublini-options` → getProductSubliniOptions | OPTIONS | `GET /api/v1/cms/products/sublini-options` | Bearer | JSON select2 {results} |
| Product | GET `/products` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| Product | PUT|PATCH `/products/:id` → update | FORM_SUBMISSION | `PUT /api/v1/cms/products/id` | Bearer | 302 redirect + flash |
| ProductGposb2b | GET `/product-gposb2b/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/global-configurations/detail`<br>`GET /api/v1/cms/custom-criterias/detail` | Bearer | HTML (Edge view) |
| ProductGposb2b | GET `/product-gposb2b` → index | OTHER | `GET /api/v1/cms/global-configurations/detail`<br>`GET /api/v1/cms/custom-criterias/detail` | Bearer | JSON |
| ProductGposb2b | PUT|PATCH `/product-gposb2b/:id` → update | FORM_SUBMISSION | — (no gateway call) | — | 302 redirect + flash |
| ProductGposb2bHomepage | GET `/product-gposb2b-homepage/create` → create | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| ProductGposb2bHomepage | POST `/product-gposb2b-homepage/datatable` → datatable | DATATABLE | `GET /api/v1/cms/product-gposb2b-homepages` | Bearer | JSON DataTables |
| ProductGposb2bHomepage | POST `/product-gposb2b-homepage/delete` → delete | DELETE | `DELETE /api/v1/cms/product-gposb2b-homepages/request.id` | Bearer | 302 redirect + flash (or JSON) |
| ProductGposb2bHomepage | GET `/product-gposb2b-homepage/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/product-gposb2b-homepages/request.id`<br>`GET /api/v1/cms/custom-criterias/detail` | Bearer | HTML (Edge view) |
| ProductGposb2bHomepage | GET `/product-gposb2b-homepage` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| ProductGposb2bHomepage | POST `/product-gposb2b-homepage/multidelete` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/product-gposb2b-homepages/bulk` | Bearer | 302 redirect + flash |
| ProductGposb2bHomepage | POST `/product-gposb2b-homepage` → store | FORM_SUBMISSION | `POST /api/v1/cms/product-gposb2b-homepages` | Bearer | 302 redirect + flash |
| ProductGposb2bHomepage | PUT|PATCH `/product-gposb2b-homepage/:id` → update | FORM_SUBMISSION | `PUT /api/v1/cms/product-gposb2b-homepages/request.id` | Bearer | 302 redirect + flash |
| ProductRestricted | GET `/product-restrictions/channel-type` → channelTypeOptions | OPTIONS | `GET /api/v1/cms/customer-channels` | Bearer | JSON select2 {results} |
| ProductRestricted | GET `/product-restrictions/create` → create | AUTHENTICATED_PAGE | `GET /api/v1/cms/customer-channels` | Bearer | HTML (Edge view) |
| ProductRestricted | POST `/product-restrictions/datatable` → datatable | DATATABLE | `GET /api/v1/cms/product-restricted` | Bearer | JSON DataTables |
| ProductRestricted | POST `/product-restrictions/delete` → delete | DELETE | `DELETE /api/v1/cms/product-restricted/id` | Bearer | 302 redirect + flash (or JSON) |
| ProductRestricted | DELETE `/product-restrictions/:id` → destroy | DELETE | `DELETE /api/v1/cms/product-restricted/id` | Bearer | 302 redirect + flash (or JSON) |
| ProductRestricted | GET `/product-restrictions/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/customer-channels`<br>`GET /api/v1/cms/product-restricted/id` | Bearer | HTML (Edge view) |
| ProductRestricted | GET `/product-restrictions` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| ProductRestricted | POST `/product-restrictions/multidelete` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/product-restricted/bulk` | Bearer | 302 redirect + flash |
| ProductRestricted | POST `/product-restrictions` → store | FORM_SUBMISSION | `POST /api/v1/cms/product-restricted` | Bearer | 302 redirect + flash |
| ProductRestricted | PUT|PATCH `/product-restrictions/:id` → update | FORM_SUBMISSION | `PUT /api/v1/cms/product-restricted/id` | Bearer | 302 redirect + flash |
| ReferralCode | GET `/referral-code/create` → create | AUTHENTICATED_PAGE | `GET /api/v1/cms/customer-channels` | Bearer | HTML (Edge view) |
| ReferralCode | GET `/referral-code/datatable` → datatable | DATATABLE | `GET /api/v1/cms/loyalties/referral-configurations` | Bearer | JSON DataTables |
| ReferralCode | DELETE `/referral-code/:id` → delete | DELETE | `DELETE /api/v1/cms/loyalties/referral-configurations/:id` | Bearer | 302 redirect + flash (or JSON) |
| ReferralCode | DELETE `/referral-code` → deleteBulk | MULTI_DELETE | `DELETE /api/v1/cms/loyalties/referral-configurations` | Bearer | 302 redirect + flash |
| ReferralCode | GET `/referral-code/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/customer-channels`<br>`GET /api/v1/cms/loyalties/referral-configurations/:id` | Bearer | HTML (Edge view) |
| ReferralCode | GET `/referral-code` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| ReferralCode | POST `/referral-code` → store | FORM_SUBMISSION | `POST /api/v1/cms/loyalties/referral-configurations` | Bearer | 302 redirect + flash |
| ReferralCode | PUT|PATCH `/referral-code/:id` → update | FORM_SUBMISSION | `PUT /api/v1/cms/loyalties/referral-configurations/:id` | Bearer | 302 redirect + flash |
| RegisterFolamil | GET `/register-folamil` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| RegisterFolamil | POST `/register-folamil` → store | FORM_SUBMISSION | `GET /api/v1/cms/loyalties/point-types`<br>`POST /api/v1/cms/loyalties/user-point-candidates` | Bearer | 302 redirect + flash |
| SponsoredProduct | GET `/sponsored-products/create` → create | AUTHENTICATED_PAGE | `GET /api/v1/cms/product-categories` | Bearer | HTML (Edge view) |
| SponsoredProduct | POST `/sponsored-products/datatable` → datatable | DATATABLE | `GET /api/v1/cms/sponsored-products` | Bearer | JSON DataTables |
| SponsoredProduct | DELETE `/sponsored-products/:id` → destroy | DELETE | `DELETE /api/v1/cms/sponsored-products/id` | Bearer | 302 redirect + flash (or JSON) |
| SponsoredProduct | GET `/sponsored-products/:id/edit` → edit | AUTHENTICATED_PAGE | `GET /api/v1/cms/product-categories`<br>`GET /api/v1/cms/sponsored-products/id` | Bearer | HTML (Edge view) |
| SponsoredProduct | GET `/sponsored-products` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| SponsoredProduct | DELETE `/sponsored-products` → multidelete | MULTI_DELETE | `DELETE /api/v1/cms/sponsored-products` | Bearer | 302 redirect + flash |
| SponsoredProduct | POST `/sponsored-products` → store | FORM_SUBMISSION | `POST /api/v1/cms/sponsored-products` | Bearer | 302 redirect + flash |
| SponsoredProduct | PUT|PATCH `/sponsored-products/:id` → update | FORM_SUBMISSION | `PUT /api/v1/cms/sponsored-products/id` | Bearer | 302 redirect + flash |
| Tc | GET `/tc/sub/options` → getSubTcOptions | OPTIONS | `GET /api/v1/cms/tc/sub/options` | Bearer | JSON select2 {results} |
| Tc | GET `/tc/options` → getTcOptions | OPTIONS | `GET /api/v1/cms/tc/options` | Bearer | JSON select2 {results} |
| UserManagement | POST `/user-management/datatable` → datatable | DATATABLE | `GET /api/v1/cms/customers/users` | Bearer | JSON DataTables |
| UserManagement | POST `/user-management/delete` → delete | DELETE | `DELETE /api/v1/cms/customers/users/request.id` | Bearer | 302 redirect + flash (or JSON) |
| UserManagement | GET `/user-management` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| UserManagement | POST `/user-management/:id/update-is-active` → updateIsActive | AJAX_ACTION | `PUT /api/v1/cms/customers/users/request.id/status` | Bearer | JSON / raw gateway body / redirect |
| UserVerification | POST `/user-verification/:id/approve` → approve | AJAX_ACTION | `POST /api/v1/cms/users/need-approvals/:id/approve` | Bearer + Accept + X-UserId | JSON / raw gateway body / redirect |
| UserVerification | POST `/user-verification/datatable` → datatable | DATATABLE | `GET /api/v1/cms/users/need-approvals` | Bearer + Accept + X-UserId | JSON DataTables |
| UserVerification | GET `/user-verification/:id/detail` → detail | OTHER | `GET /api/v1/cms/users/need-approvals/:id` | Bearer + Accept + X-UserId | JSON |
| UserVerification | GET `/user-verification` → index | AUTHENTICATED_PAGE | — (no gateway call) | — | HTML (Edge view) |
| UserVerification | POST `/user-verification/:id/reject` → reject | AJAX_ACTION | `POST /api/v1/cms/users/need-approvals/:id/reject` | Bearer + Accept + X-UserId | JSON / raw gateway body / redirect |
| UserVerification | POST `/user-verification/:id/update` → update | AJAX_ACTION | `PUT /api/v1/cms/users/need-approvals/:id` | Bearer + Accept + X-UserId | JSON / raw gateway body / redirect |

## 7. API Request Contracts

### 7.1 Transport (all calls) [SOURCE `ApiService.js`]

| Item | Contract |
|---|---|
| Base URL | `Env.get('APIGATEWAY_URL')` + path, unless the path already starts with `http` |
| Method | Repository-supplied. Only the literal string `'GET'` takes the GET branch; `'post'` (login) takes the non-GET branch |
| GET | `params` sent as the axios `params` (query string) **and** as `data` (body) |
| Non-GET | `params` sent as the JSON body (`data`) |
| Headers | `{ Authorization: 'Bearer ' + (authUser ? authUser.access_token : '') }`, or `options.headers` when options are passed (which replaces the default) |
| Content type | JSON (axios default). No multipart to the gateway |
| Timeout | 240000 ms |
| Logging | `Logger.info` of url, params, method, **headers**, body, payload and response for every call |

### 7.2 Custom header sets

| Repository | Headers |
|---|---|
| LoyaltyMemberRepository | `Authorization: Bearer`, `X-Userid: user_email`, `X-Useremail: user_email`, `X-Username: user_name`, `X-RoleName: role_name` |
| UserVerificationRepository | `Authorization: Bearer`, `Accept: application/json`, `X-UserId: user_id → id → cms_user_id → user_email` |

### 7.3 Common query/body conventions (built by Mappers; original names kept)

| Concern | Fields |
|---|---|
| Pagination | `page` (1-based = `start/length+1`), `take` (= `length`; sometimes the raw string); `limit` (Loyalty); `showPerPage` (browser→Adonis for pagination.js lists) |
| Sort | `sort_by` (column name, or fixed values such as `created_at`, `status`, `aam_customer_id`), `asc_desc` (`ASC`/`DESC` or lower case) |
| Search | `keyword`, `search_by` (e.g. `name`, `title`, `aam_customer_id`, `customer.name`, `user.email`, `customer_id`, `email`) |
| Filters | `filters: [{ column, opr: '=' \| 'EQ' \| 'IN', value }]` (Product, Notification, UserVerification, UserManagement, MutasiRedeem); flat fields such as `status`, `type`, `is_multi_period`, `sales_order_status[]` |
| Date ranges | `start_date` / `end_date` as `YYYY-MM-DDT00:00:00.000+07:00` (Payment) or `…T00:00:00+07:00` (Loyalty); `start_date_transaction` / `end_date_transaction` (Mutasi) |
| Relations / IDs | `customer_ids`, `aam_customer_ids`, `customer_area_ids`, `customer_channel_ids`, `customer_group_ids`, `principal_ids`, `product_ids`, `category_ids`, `catalog_ids`, `product_class_ids`, `therapeutic_class_ids`, `sub_therapeutic_class_ids`, `point_type_ids`, `branch_id`, `type_channel_id(s)` |
| Bulk delete | `{ ids: [...] }` to `DELETE <base>/bulk` or to the base path (FAQ); inject point `{ ids: [id] }` |
| Single operations | `GET/PUT/DELETE <base>/<id>`; status sub-resources: `PUT …/{id}/status`, `PUT /notifications/{id}/cancels` |
| Upload sign | `POST /api/v1/files/signurl` body = the whole browser request (`file_name`, `category:'images'`, `content_type`, plus `_csrf`) |

Screen-level field lists are in A1 §11 and §19. Their gateway request fields are the Mapper outputs cited there.

## 8. API Response Contracts

### 8.1 Gateway → Adonis (KNOWN FROM LEGACY CLIENT)

| Case | What Adonis receives | Evidence |
|---|---|---|
| 2xx | The raw gateway body. Controllers read `result.code` (compared with `200` 140 times, `201` 32 times, `400` 18 times), `result.message`, `result.data` | grep [SOURCE]; the gateway envelope `{code, message, data}` is [INFERRED] from this usage |
| List payload | `result.data.rows` (44 uses), `result.data.total_rows` (40 uses); a few use `total_page`, `data_per_page`, `page`, `total` | Mappers [SOURCE] |
| HTTP error | `{ code: error.response.status, data: error.response.data }`, where the gateway error body sits in `data`. Controllers read `result.data.message` (40 uses) | `ApiService.js:80-85` [SOURCE] |
| No response (timeout, DNS, refused) | `{ code: 404, data: 'Error Request URI' }`, so a **timeout looks like a 404** | `ApiService.js:86-91` [SOURCE] |
| Axios setup error | `error.response.status` on an undefined value throws inside the catch → the promise rejects → the controller's try/catch, or an unhandled error | `ApiService.js:92-97` [INFERRED] |
| Validation error from the gateway | 400 plus a message in `data.message`; some controllers map it to fields (Referral attaches it to `referral_code`; Notification uses `code 300` field errors) | A1 G4/G5 [SOURCE] |

### 8.2 Adonis → Browser (legacy client contract)

| Kind | Shape | Notes |
|---|---|---|
| Page | HTML | Errors surface as flash on the next page |
| Form submit | 302 + flash (`notification` / `warning` / `Warning` / `error` / `success` …) | **API CONTRACT**: redirect + flash. **LEGACY UI DISPLAY BUG**: `Warning`, and on list pages `warning`, are not rendered |
| DataTables | `{draw, recordsTotal, recordsFiltered, data}` | §9 |
| select2 options | `{ results: [{ id, text }] }` (normalised on the client by `normalizeSelect2Data`, which also accepts value/code/name/label) | `main.js:347-426` |
| JSON actions | Varies: `{code, message}`, `{success, message}`, the raw gateway body (`syncStatus`, `update-is-active`), or `response.api` `{message, data}` | A1 §9, §18 |
| JSON failure via redirect | `redirect('back')` from JSON endpoints (Personalization delete/save/validate, datatable catch blocks) → the AJAX caller gets 302 → HTML 200 | **API CONTRACT** of the legacy BFF (not a display bug) |
| Unauthenticated | 302 to `/` (HTML) for any request, JSON 401 only in Personalization/Loyalty endpoints | [SOURCE] |
| Upload sign | 200 `{url, file_url}`; 400 = validator messages array; 500 = `result.error` (undefined, so the body is probably empty) | `FileController.js` [SOURCE/INFERRED] |

## 9. DataTable Contracts

**Browser → Adonis (request)** [SOURCE `main.js:8-160`]:

| Item | Value |
|---|---|
| Method / encoding | POST `*/datatable`, form-encoded (jQuery). Referral uses GET |
| DataTables fields | `draw`, `start`, `length`, `search[value]`, `search[regex]`, `order[i][column]`, `order[i][dir]`, `columns[i][data]`, `columns[i][name]`, `columns[i][searchable]`, `columns[i][orderable]`, `columns[i][search][value]` |
| CSRF | `_csrf`, unless the view passes `ajaxData` (then only the `X-CSRF-TOKEN` header) |
| Custom parameters | Added through `ajaxData`: Payment (`aam_customer_ids`, `start_date`, `end_date`), Mutasi (all filters), UserVerification (`filters[0]`), UserManagement (`filters[0]`, `branch_id`) |
| Structured search | JSON placed inside `search.value`: Order `{custId, filter, keyword}`, UserManagement / UserVerification `{keyword, type}` |
| Column filters | `columns[i].search.value`: Banner status/type, Product is_active/is_draft, Notification status, Channel status |

**Adonis mapping (per screen)** [SOURCE: Mappers or controller `datatable` actions]:
- `sort_by = columns[order[0].column].name`. Exceptions: CustomCatalog uses `column-2`; GPOS Brand / Shipping voucher use a fixed `status`; UserManagement uses a fixed `aam_customer_id`.
- `asc_desc = order[0].dir`, fixed on some screens.
- `page = start/length + 1`, `take = length` (−1 becomes 10000 on UserVerification).
- `keyword = search.value`, plus the screen filters. The gateway call is a list GET on the feature base path.

**Adonis → Browser (response)** [SOURCE: 30 files, 41+18 builders]:

```text
{ draw: formData.draw,
  recordsTotal:    result.data.total_rows,
  recordsFiltered: result.data.total_rows,
  data: [ [ "<html cell>", "<html cell>", … ], … ] }     // array-of-arrays, cells are HTML/text strings
```

- **Empty / failure:** `recordsTotal: 0`, `recordsFiltered: 0`, `data: []` (e.g. `BannerMapper.js:85-88`).
  - `NotificationMapper.ToNotificationListEmptyResponse` returns `{total_rows, rows}` instead, which is not a DataTables shape [SOURCE A1].
  - Many catch blocks flash and `redirect('back')`, so DataTables gets HTML [INFERRED error dialog / empty draw; VERIFY A3.1].
- **Server-side:** paging, search, filters and sort are all delegated to the gateway.
- **Browser-side only:**
  - Export buttons (current page only).
  - Column visibility, colReorder / rowReorder.
  - Checkbox selection state (`item[]` enabled on check).
  - Row grouping (UserManagement drawCallback).
- **Row HTML:** built server-side by 34 functions (A1 §8). The cells contain action links, `data-*` attributes carrying full records (Banner), toggles, inline inputs and badges. **The HTML is part of the legacy contract; the gateway contract is `rows[]` of domain objects.**
- **`DatatableBuilder.js`** is a vendored SQL query builder (node-datatable) that **no code references** [SOURCE grep]. It is not part of the contract.

**Custom list mechanisms** (A1 §7): `/poin-voucher/list`, `/gamification/list` and `/loyalty-member/:id/list`. Each returns JSON built from gateway `rows` / `total_rows` (mapper-shaped) and is paginated by `pagination.js` with `page` + `showPerPage` / `limit`.

## 10. Upload / Signed URL Contracts

| Flow | Steps | Validation | Method / storage | Credentials exposed? | Evidence |
|---|---|---|---|---|---|
| Image / CSV via `form_image` + `script_image_uploader` (Banner, Group Story, Notification, Gamification images and CSV, Product, Product Category, Produk Gpos B2b, Voucher category, Loyalty CSVs, Folamil CSV) | 1. File selected. 2. Client checks size ≤ 5 MB and optional ratio (asynchronous, **does not block**). 3. Sanitised name. 4. `POST /files/signurl {file_name, category:'images', content_type}` (Adonis validates `file_name` required) → gateway `POST /api/v1/files/signurl` → `{url, file_url}`. 5. **Browser `PUT url` with the raw file**. 6. Hidden field = `file_url` (fallback `OSS_BUCKET_URL/<name>`). 7. The form or AJAX submit sends the URL string | Client: size, ratio, `accept` attribute. Server: `file_name` only. **No server-side MIME, size or extension validation** | Direct browser PUT to object storage | Only the signed URL (time-limited; **lifetime not visible** [UNKNOWN — BACKEND CONTRACT]) and the `OSS_BUCKET_URL` value in page JS | `script_image_uploader.edge`, `FileController.js`, `FileRepository.js` [SOURCE] |
| CSV imports after upload | The URL is posted to `/gamification/upload-csv*` (gateway), `/register-folamil` (gateway `postUserPointCandidates`), or `/loyalty-member/validate-branch-csv` (**Adonis fetches the URL itself**, `axios.get(fileUrl)`, any URL) | Branch CSV: headers `NO`, `NAMA CABANG` | Gateway / Adonis | — | A1 G3/G5 [SOURCE] |
| Gamification duplicate | Adonis downloads the old CSV, rewrites the `Id` column, then calls signurl and does a **server-side PUT** to storage | — | Server-to-storage | — | `GamificationController.js:165-214` [SOURCE] |
| Principal image | Browser multipart `uplimages[]` → `POST /principal` → `request.file(types:['image'], size:'2mb')` → moved to `public/images/<name> - <random>.<ext>`. The filename is sent to the gateway as `image`. Update ignores the image | Server: image type and 2 MB | Local disk (public, statically served) | — | `PrincipalController.js:87-109` [SOURCE] |
| GPOS brand | No upload found in GposBrand screens | — | — | — | A1 G5 [SOURCE] |
| Templates | Folamil: hardcoded OSS URL. Loyalty: env `DEFAULT_LOYALTY_*_TEMPLATE` URL returned by `POST /loyalty-member/generate-csv` | — | Static external | — | [SOURCE] |

## 11. Validation Contracts

```text
form (HTML, client gating / jquery-validation in 26 files)
 → Adonis Validator (47 files; validate = first error, validateAll = all) — manual call in controller
 → failure: session.withErrors(messages) [± flashAll] + redirect('back')   | or flash warning = first message
            JSON endpoints: 400 {message|messages} / code 300 field map (Notification)
 → success: Mapper → gateway → gateway 400 message → flash warning / field error (Referral) / toast
 → render: hasErrorFor (red border), getErrorFor (message) only when component showError / explicit
```

**Required-field and cross-field rules:** see A1 §17 (full validator table plus manual checks).

**Error shape.** Adonis `validation.messages()` is `[{ field, validation, message }]` [SOURCE: framework]. It is flashed as `errors` (withErrors) or as a string `warning`.

**Gateway validation.** A 400 with a message (KNOWN FROM LEGACY CLIENT). Field-level structure is not observed, except that Personalization returns `data.customer_ids | customer_group_ids | customer_channel_ids` conflict arrays.

**Classification of "validation messages not displayed" (A1-F09):**
- **Legacy presentation problem (primary)** [SOURCE]:
  - Components render the message only when `showError` is passed.
  - Content views show errors for the wrong field.
  - The `Warning` key is never rendered.
  - List views don't render `warning`.
- **Partly a contract problem** [SOURCE]:
  - Several controllers flash only the first message, or call `withErrors()` with no arguments (Inventory), so per-field data is never sent.
  - `old()` values are lost where `flashAll` is absent.
  - Some validators can never pass: CustomCriteria needs `custom_type`.
- **Backend:** gateway validation granularity is [UNKNOWN — BACKEND CONTRACT].

## 12. Error Model

| Error | HTTP status (gateway → Adonis) | Legacy response (Adonis → browser) | UI behavior | Migration impact |
|---|---|---|---|---|
| Validation (Adonis) | — | 302 back + `errors` / flash `warning` or `notification`; JSON 400 on AJAX endpoints | Red border; message rarely shown; toast on AJAX screens | Field-error contract must be defined; legacy display is not a spec |
| Validation (gateway) | 400 → `{code:400, data:{message}}` | Flash `warning` = `result.data.message` (or a generic text); Notification `code 300`; Referral field error | Often invisible on list pages | Preserve messages; the display needs a decision |
| Authentication (Adonis session missing or expired) | — | 302 → `/` (login) for pages **and AJAX**; the in-action fallback renders the login view (sometimes a ReferenceError); Personalization/Loyalty return JSON 401 | Login page, or a broken table/toast | Needs an explicit 401 contract for XHR |
| Authentication (gateway token rejected) | 401 → `{code:401, data}` | Generic failure path (flash, empty table, JSON error); **no logout, no refresh** | "Gagal…" messages until `expires_at` | Global 401 handling absent in legacy |
| Authorization | 403 → `{code:403, data}` | Generic failure; Personalization logs only | Generic failure | Semantics are backend-owned |
| Not found | 404 → `{code:404, data}` | Edit pages: flash `warning` "… tidak ditemukan" → list (Order Review → `/`) | Redirect | Same code as timeout (see below) |
| Conflict | 400 with a payload (Personalization relation conflict; shipping voucher period overlap) | JSON 400 → conflict modal / translated message | Modal / toast | Specific contracts to preserve |
| Business error | 400 + message | Flash `warning` or toast | Varies | — |
| Gateway error | 5xx → `{code:5xx, data}` | Generic failure flash / 500 JSON (signurl) | Message or nothing | — |
| Network / timeout | no response → **`{code:404, data:'Error Request URI'}`** | Same as not-found / failure paths | Misleading "not found" or generic | Legacy conflates timeout with 404 |
| Server error (Adonis) | — | Exceptions: Adonis error page; `JSON.parse` of a malformed `search.value` → flash + redirect (Order); undeclared `view` → ReferenceError | Error page / broken table | [UNKNOWN — VERIFY A3.1] |
| Redirect-as-error | — | `redirect('back')` from JSON/DataTables endpoints | AJAX sees HTML with 200; may look like success | Must be recognised as a legacy contract quirk |
| Malformed JSON (from gateway) | — | axios parse; not specifically handled | Unknown | [UNKNOWN — VERIFY A3.1] |
| Unknown | other | `ExtendResponse.api` defaults / `OtherService.setResponse` status map (`status_code` 2000/4001…); both barely used | — | — |

## 13. Authorization Model

| # | Question | Answer | Evidence |
|---|---|---|---|
| 1 | What identifies a user? | The gateway login payload in the session: `user_email` (used by the menu), `user_name`, `access_token`; numeric ids (`user_id` / `id` / `cms_user_id`) used defensively | [SOURCE] |
| 2 | What identifies a role? | `role_name` exists in the session; used **only** as the `X-RoleName` header to the Loyalty API. `user.user_type` / `user.user_role` are referenced only by the unused `isSellerAccount` | [SOURCE] |
| 3 | Entity / resource? | **None in Adonis**. `config/access.js` has `group_name/childs/handlers`; it is processed in `start/hooks.js:52-62` but **never consulted** by any middleware, controller or view | [SOURCE] |
| 4 | Action / access? | **None in Adonis**. No `access_read` / `access_create` or similar | grep [SOURCE] |
| 5 | Where is authorization evaluated? | Adonis: authentication only (session + expiry). Past the gateway: [UNKNOWN — BACKEND CONTRACT] | [SOURCE] |
| 6 | Is it server-side? | Only session validity (server-side) | [SOURCE] |
| 7 | Only menu visibility? | **In Adonis, yes**: the only role-like logic is choosing the menu set by email | `Extender.js:288-294` [SOURCE] |
| 8 | Enforced on route access? | **NO.** `authSession` checks presence and expiry only. Any logged-in user (including the payment/marketing accounts) can open any route by URL | [SOURCE] |
| 9 | Enforced on API calls? | By Adonis, NO. By the gateway: [UNKNOWN — BACKEND CONTRACT] (it gets the bearer token, and for two features identity/role headers) | [SOURCE] |
| 10 | Enforced on individual actions? | **NO** in Adonis | [SOURCE] |
| 11 | Edit/Delete buttons permission-controlled? | **NO.** The 34 HTML builders have no role or email conditions. Conditions are data-driven only (status, `slug`, `is_active`) | A1 §8 [SOURCE] |
| 12 | Menus hardcoded? | YES, three literal arrays in `Extender.js` | [SOURCE] |
| 13 | Email used as authorization logic? | **As menu selection only**: two specific account emails pick the "payment" or "marketing" set; everyone else gets the superadmin set. It is not enforced anywhere else | [SOURCE] (email values are account identifiers; see `Extender.js:288-292`) |
| 14 | Special users? | Two special accounts (payment, marketing) by email. `isSellerAccount` (user_type 6, or 1 with role 15) exists but is unused | [SOURCE] |
| 15 | Session-validation endpoint? | **NOT OBSERVED** (no `validate-session` or permission endpoint). Contrast with the B0 target, which calls `/auth/validate-session` with `{entity, access}` | grep [SOURCE] |

**Relationship, stated explicitly:** hiding a menu item ≠ denying permission. A1 already showed that the Mapper-generated action buttons perform no role or email checks. A2 confirms that neither routes nor controllers do either.

## 14. Permission Matrix

**Column values:**
- **Menu:** visible sets, P = Payment, M = Marketing, S = Superadmin (default); "none" = not in any menu.
- **Route auth:** `SESSION` = the `authSession` expiry gate only; no role check anywhere.
- **Action auth:** NOT OBSERVED for every feature.
- **API auth:** `UNKNOWN — BACKEND CONTRACT` (Bearer sent; `+hdr` = identity/role headers also sent).

| Feature | Screen(s) | Route | Menu | Route auth | Action auth | API auth | Evidence |
|---|---|---|---|---|---|---|---|
| Login | S106 | `/`, `/login`, `/logout` | — | public | — | none (login) / Bearer (logout) | AuthController |
| Beranda | S001 | `/home` | S (P/M: hidden) | SESSION | NOT OBSERVED | none (no API) | Extender |
| Order/Pesanan | S007-S008 | `/order*` | S | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | ctrl/routes |
| Order Review | S012-S013 | `/order-review*` | S | SESSION (no in-action checkAuth) | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G1 |
| Pembayaran | S085-S086 | `/payment*` | P, S | SESSION (no in-action checkAuth) | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G1 |
| Inventory | S075-S077 | `/inventories*` | S | SESSION (no in-action checkAuth) | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G1 |
| Produk | S045-S046 | `/products*` | S | SESSION (no in-action checkAuth) | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G2 |
| Kategori Produk | S047-S049 | `/product-category*` | S | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G2 |
| Produk Gpos B2b | S107 (+S033-S035) | `/product-gposb2b*` | S | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G2 |
| Personalisasi Katalog | S026-S031, S036-S038 | `/custom-catalog*`, `/custom-catalog-product-homepage*`, `/custom-criteria*` | S (sub-screens: none) | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G2 |
| Pembatasan produk | S081-S083 | `/product-restrictions*` | S | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G2 |
| Loyalty Member | S098-S102 | `/loyalty-member*` | S | SESSION (+JSON 401 on some) | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT (+hdr X-Userid/X-RoleName) | LoyaltyMemberRepository |
| Pengaturan Poin | S050-S060, S065 | `/poin-voucher*` | S | SESSION (several actions skip checkAuth) | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G3 |
| Inject Poin | S061-S063 | `/poin-voucher/inject-point*` | none | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G3 |
| Mutasi & Redeem | S064 | `/poin-voucher/redeem*` | none | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G3 |
| Voucher Setting | S066-S071 | `/voucher-setting*` | none | SESSION (most actions skip checkAuth) | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G3 |
| Push Notification | S009-S011 | `/notification*` | M, S | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | Extender |
| Banner & Iklan | S017-S019 | `/banner*` | M, S | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | Extender |
| Group Story | S020-S022 | `/group-story*` | S | SESSION (no in-action checkAuth) | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G4 |
| Produk Sponsor | S078-S080 | `/sponsored-products*` | S | SESSION (no in-action checkAuth) | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G4 |
| Gamification | S088-S093 | `/gamification*` | S | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G4 |
| Voucher Pengiriman | S094-S095 | `/gpos-brand/shipping-voucher*` | S | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G5 |
| GPOS Brand | S096-S097 | `/gpos-brand*` | S | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G5 |
| Kode Telesales | S023-S025 | `/referral-code*` | S | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G5 |
| Grup Pelanggan | S072-S074 | `/customer-groups*` | S | SESSION (no in-action checkAuth) | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G5 |
| Konfigurasi Channel | S104-S105 | `/personalization/channels*` | S | SESSION (+JSON 401) | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G5 |
| Verifikasi Akun | S103 | `/user-verification*` | S | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT (+hdr X-UserId) | UserVerificationRepository |
| Prinsipal | S002-S004 | `/principal*` | S | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G5 |
| Pendaftaran Folamil | S087 | `/register-folamil` | S | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G5 |
| Konfigurasi Umum | S014-S016 | `/global-configuration*` | S | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G5 |
| Manajemen Pengguna | S084 | `/user-management*` | S | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G5 |
| Masukan / Konten / FAQ | S005-S006, S039-S044 | `/feedback*`, `/content*`, `/faqs*` | S | SESSION (FAQ: no in-action checkAuth) | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | A1 G6 |
| Upload sign | all upload screens | `/files/signurl` | — | SESSION | NOT OBSERVED | UNKNOWN — BACKEND CONTRACT | FileController |

## 15. User / Role / Permission Data

| Datum | Received? | Origin | Stored | Used for |
|---|---|---|---|---|
| User ID | YES (probably; the field name is uncertain: `user_id` / `id` / `cms_user_id`) | Gateway login `data` | Session `auth` | `X-UserId` (UserVerification) |
| Username | YES (`user_name`) | Gateway | Session | Banner author, `X-Username` |
| Email | YES (`user_email`) | Gateway | Session | Menu set, author, `X-Userid`/`X-Useremail` |
| Role | YES (`role_name`) | Gateway | Session | `X-RoleName` (Loyalty) only |
| Role ID | NOT OBSERVED (`user.user_role` only in unused code) | — | — | — |
| Permission list / entities / access actions | **NOT OBSERVED** | — | — | — |
| Branch / customer / principal context | NOT OBSERVED in the session (these are request-level filters, not user context) | — | — | — |
| Tenant-like identifier | NOT OBSERVED | — | — | — |
| Expiry | YES (`expires_at`) | Gateway | Session | `checkAuth` |
| Full name | NOT OBSERVED (`fullname` not shared) | — | — | Empty in the mobile nav |

## 16. CSRF / Security Boundary

| Item | Finding | Evidence |
|---|---|---|
| Generation | Adonis Shield. Token available as `csrfToken`, `csrfField()` | `config/shield.js:134` [SOURCE] |
| Injection | `<meta name="csrf_token">` in the layout; `csrfField()` in 151 forms; `_csrf` in AJAX bodies; `X-CSRF-TOKEN` header through `$.ajaxSetup` and `axios.defaults.headers.common` (the `axios.default = {…}` line is a typo'd no-op) | `layouts.edge:9,287-298` [SOURCE] |
| Methods protected | `POST`, `PUT`, `DELETE`. **`PATCH` is not in the list**. GET is never protected | `shield.js:137` [SOURCE] |
| Filtered URIs | `/api/(.*)` (no such routes exist); `apiCsrf: 'none'` | `shield.js:136-138` [SOURCE] |
| State-changing GETs (no CSRF) | `GET /logout`; `GET /gpos-brand/shipping-voucher/:id/cancel` (cancels a voucher) | `routes.js:21,495` [SOURCE] |
| CSRF cookie | `httpOnly: false`, `sameSite: true` (strict), `path /`, `maxAge 7200` | `shield.js:139-144` [SOURCE] |
| Session cookie | `httpOnly: true`, `sameSite: false`, no `secure` | `config/session.js:67-71` [SOURCE] |
| Generic cookies | `httpOnly: true`, `sameSite: false`, `maxAge 7200` | `config/app.js:237-242` [SOURCE] |
| Method spoofing | `allowMethodSpoofing: true` (`?_method=` / `_method` field) | `config/app.js:44` [SOURCE] |
| CORS | `origin: false`, so cross-origin requests to Adonis are rejected | `config/cors.js:19` [SOURCE] |
| Gateway accepts browser origin? | Not applicable to the legacy client (server-to-server). Gateway CORS is [UNKNOWN — BACKEND CONTRACT] | — |
| Other Shield settings | CSP enabled with **empty directives**; `xframe: DENY`; `nosniff`; `noopen`; xss filter enabled | `shield.js:13-123` [SOURCE] |
| CSRF value forwarded upstream | `request.post()` / `request.all()` bodies are forwarded unfiltered to the gateway for login and signurl, so `_csrf` reaches the gateway | `AuthController.js:19,26`, `FileController.js:9,15` [SOURCE] |
| Env exposed to templates | View global `env(name)` exposes **any** env var to templates; only `OSS_BUCKET_URL` is used (image uploader JS) | `start/hooks.js:58-60` [SOURCE] |
| Raw output into JS | `{{{ toJSON(...) }}}` embeds server data in scripts (gamification, group story, customer group, personalization, flash) with no `</script>` escaping | A1 [SOURCE]; XSS exposure [INFERRED] |
| SSRF surface | `validate-branch-csv` fetches any browser-supplied URL server-side | `LoyaltyMemberController.js:302` [SOURCE] |

## 17. Environment / Configuration Boundary

| Variable / config | Purpose | Server only | Browser exposed | Security relevance |
|---|---|---|---|---|
| `APIGATEWAY_URL` | Gateway base URL | YES | NO | Topology; not secret |
| `APP_KEY` | Adonis encryption (sessions, cookies) | YES | NO | **Secret** |
| `HOST`, `PORT`, `NODE_ENV`, `APP_URL`, `APP_NAME` | Server runtime | YES | NO (APP_URL not rendered) | Low |
| `CACHE_VIEWS` | View cache | YES | NO | Low |
| `SESSION_DRIVER` | Declared but **ignored** (driver hardcoded to `file`) | YES | NO | Config drift |
| `HASH_DRIVER`, `DB_*` | Local DB (`users`/`tokens` tables; not used for gateway auth) | YES | NO | **DB credentials secret** |
| `OSS_BUCKET_URL` | Fallback file URL | — | **YES** (printed into uploader JS via `env()`) | Bucket location disclosed; not a credential |
| `CDN_URL` | Image URL prefix (server builds URLs) | YES | Indirect (URLs in HTML) | Low |
| `DEFAULT_LOYALTY_PROGRAM_VOUCHER_TEMPLATE`, `DEFAULT_LOYALTY_CARD_STORE_BRANCH_TEMPLATE` | Template CSV URLs | — | **YES** (returned in JSON) | Low |
| `TAX` | Business constant | YES | Unknown | Low |
| `title` | Meta description | — | YES (`<meta>`) | Low |
| `API_LOG_BEAUTIFY` | Present in `.env` key list; no consumer found | YES | NO | — |
| View global `env()` | Generic accessor | — | Any key a template names | **Latent exposure risk** |
| Hardcoded OSS template URL (Folamil) | Download | — | YES | Low |
| API key / Kong | **None** in the legacy app | — | — | Contrast with B0 (`KONG_API_KEY` inlined into the client bundle) |
| `env.txt` | Tracked file with the same keys as `.env.example` (values not inspected) | — | — | Owner review (A0-F15) |

**Comparison with B0** [SOURCE, both repos]:
- The legacy app exposes **no** gateway URL, token or API key to the browser.
- The target inlines `API_HOST`, `API_HOST_2`, `API_HOST_3` and `KONG_API_KEY` into the client bundle through `next.config.ts env`, and sends the bearer token from browser JS.
- The migration therefore crosses a security boundary the legacy app does not.

## 18. Legacy Browser Security Boundary

Answers to §16 of the brief, evidence only:

| # | Question | Answer | Evidence |
|---|---|---|---|
| A | Does legacy auth fundamentally depend on the Adonis server session? | **YES.** Token, expiry and identity live only in the server-side session (file store); the browser holds only an opaque session cookie | §3 [SOURCE] |
| B | Is the access token ever exposed to the browser? | **NO** (static evidence: no view or JS prints it). It is exposed in **server logs** | §5, §20 [SOURCE] |
| C | Is the refresh token ever exposed to the browser? | **NO.** It is not observed in use at all | §4 [SOURCE] |
| D | Can the current browser directly call the API Gateway? | **Not by design.** Nothing gives it the URL or the token. Whether the gateway would accept browser-origin calls is [UNKNOWN — BACKEND CONTRACT] | §5 |
| E | Where is authorization enforced? | Adonis: session validity only. Gateway/backend: [UNKNOWN — BACKEND CONTRACT]. Menu: visibility only | §13 |
| F | Is menu visibility equivalent to permission? | **NO.** Hidden routes remain reachable by URL for every session | §13 #8 [SOURCE] |
| G | Are action buttons permission-controlled? | **NO** | §13 #11 [SOURCE] |
| H | Are there email-specific rules? | **YES, for menu selection only** (two accounts) | §13 #13 [SOURCE] |
| I | Is there a real refresh-token lifecycle? | **NO** (`REFRESH NOT IMPLEMENTED`) | §4 [SOURCE] |
| J | Can the legacy session contract be safely reproduced in a Next.js BFF architecture? | **UNKNOWN — A2 cannot establish this.** The pieces it would need are present in the evidence: a server-held gateway token, an expiry field, a login/logout gateway contract, and no browser-side token. But the full login payload, the `expires_at` format, gateway 401 semantics, refresh availability, and gateway-side authorization (entity/access) are not visible in this repository | §2-4, §21 |

## 19. Migration-Relevant Findings

### 19.1 Legacy side

| Topic | Evidence-based status |
|---|---|
| Browser does not call the gateway | Confirmed (§5) [SOURCE] |
| Prefilled login credentials | Present in `login.edge:56,64` (legacy behavior; do not carry over) [SOURCE] |
| Hardcoded email-based menus | Confirmed; the only role-like logic; visibility only (§13) [SOURCE] |
| Mapper-generated HTML actions | Confirmed; part of the legacy BFF contract, not of the gateway contract; no permission logic (§9) [SOURCE] |
| Redirects used as error responses | Confirmed on JSON and DataTables endpoints and for auth expiry (§8.2, §12) [SOURCE] |
| DataTable server-side behavior | Contract documented (§9); paging, search and sort are delegated to the gateway (`rows`/`total_rows`) [SOURCE] |
| Missing action handlers | 3 explicit + 97 resource (A1) — no auth relevance, but they return framework errors [UNKNOWN — VERIFY A3.1] |
| Broken delete flows | Contract gaps in the BFF (A1-F03); gateway bulk endpoints exist (`…/bulk`) [SOURCE] |
| Ignored filters | Adonis Mappers drop fields before they reach the gateway (A1-F11); a BFF-layer issue, not a gateway limitation [SOURCE] |
| Validation messages not displayed | Mostly presentation, partly a flash-contract issue (§11) [SOURCE] |
| Timeout masquerading as 404 | New in A2 (`ApiService.js:86-91`) [SOURCE] |
| Secrets in logs | New in A2 (§20 C-01, C-02) [SOURCE] |

### 19.2 Target side (B0), compared with legacy evidence

| B0 issue | Legacy counterpart | Observation |
|---|---|---|
| Direct browser API calls | None: Adonis proxies | Topology change [SOURCE both] |
| Bearer token in browser JS (`session.token`) | The token stays server-side | Exposure increase |
| Kong API key (`KONG_API_KEY` in the client bundle) | **No API key** in the legacy client | Whether the gateway now requires `Api-Key` is [UNKNOWN — BACKEND CONTRACT / OWNER DECISION] |
| No refresh implementation; `refreshToken()` unused | Legacy also has none | Parity, but the target's longer cookie cache (3 days) versus unknown token life is worth verifying |
| API env exposed to the client | Legacy exposes only `OSS_BUCKET_URL` via `env()` | Target exposes more |
| No BFF | Legacy **is** a BFF | Architectural decision pending |
| Usecases instantiate axios/repositories directly; no port/DI | Legacy: singleton repositories + one `ApiService` | Pattern difference, not a contract |
| Target permission check `POST /auth/validate-session {entity, access}` | **No equivalent** in the legacy client | Backend capability [UNKNOWN — BACKEND CONTRACT]; legacy provides no entity/access vocabulary for these screens |
| Target endpoints `/roles`, `/users`, `/auth/login` (B0 template) | Legacy uses `/api/v1/auth/login`, `/api/v1/cms/*` | Same gateway or a different one? [UNKNOWN — OWNER DECISION] |

## 20. Critical / High / Medium Findings

| ID | Sev | Title | Location | Evidence | Impact |
|---|---|---|---|---|---|
| A2-C01 | CRITICAL | Bearer token and full session logged on every request | `app/Middleware/Extender.js` (`console.log("AUTH: ", auth)`); `LoyaltyMemberRepository.getProgramList` (`console.log("myAuth: ", access_token)`) | [SOURCE] | Tokens persist in container/pod logs; anyone with log access can impersonate users until expiry |
| A2-C02 | CRITICAL | Gateway request logging includes the `Authorization` header and bodies, so **the login password is logged** | `ApiService.httpLog` (`Logger.info` headers, body, payload) on every call, including `POST /api/v1/auth/login` | [SOURCE] | Credentials and tokens in logs |
| A2-H01 | HIGH | No authorization in Adonis; menu-only role separation | `AuthSession.js`, `Extender.js` | [SOURCE] | Payment/marketing accounts can reach every screen by URL; real protection depends entirely on the backend [UNKNOWN] |
| A2-H02 | HIGH | Prefilled credentials in the login HTML (A0-F04 / A1-F06) | `login.edge:56,64` | [SOURCE] | Credential disclosure |
| A2-H03 | HIGH | No refresh and no gateway-401 handling | §3-4 | [SOURCE] | Mid-session token expiry at the gateway shows as generic failures |
| A2-H04 | HIGH | Timeout and network failures reported as `code 404` | `ApiService.js:86-91` | [SOURCE] | Misleading "not found" behavior; the error taxonomy must not be copied |
| A2-H05 | HIGH | Unauthenticated AJAX requests receive a 302 to the HTML login page | `AuthSession.js` | [SOURCE/INFERRED] | The XHR error contract is ambiguous |
| A2-H06 | HIGH | Unfiltered request bodies forwarded to the gateway (login, signurl, several stores) | `AuthController.js:19-26`, `FileController.js:9-15` | [SOURCE] | Leaks `_csrf` / extra fields upstream; the gateway contract is implicitly "whatever the form had" |
| A2-M01 | MEDIUM | `PATCH` not CSRF-protected; state-changing GETs (logout, voucher cancel) | `shield.js:137`, `routes.js:21,495` | [SOURCE] | CSRF surface |
| A2-M02 | MEDIUM | Session cookie without `secure`, `sameSite:false`; 7-day file sessions | `config/session.js` | [SOURCE] | Transport depends on TLS termination [UNKNOWN] |
| A2-M03 | MEDIUM | Expiry check is a string comparison in server-local time | `Authorization.js:6` | [SOURCE] | Timezone/format sensitivity [VERIFY A3.1] |
| A2-M04 | MEDIUM | Server-side fetch of a browser-supplied URL | `LoyaltyMemberController.js:302` | [SOURCE] | SSRF surface |
| A2-M05 | MEDIUM | No server-side MIME, size or extension validation on signed uploads | `FileController.js` | [SOURCE] | Relies on client checks and storage policy |
| A2-M06 | MEDIUM | `env()` view global can expose any env var | `start/hooks.js:58-60` | [SOURCE] | Latent secret exposure |
| A2-M07 | MEDIUM | `{{{ toJSON() }}}` raw embedding of server data into scripts | several views | [SOURCE] | XSS if the data contains `</script>` [INFERRED] |
| A2-M08 | MEDIUM | Principal images written to public local disk | `PrincipalController.store` | [SOURCE] | Not horizontally scalable; public |
| A2-M09 | MEDIUM | Identity/role headers sent to only two services, with an uncertain user id field | Loyalty / UserVerification repositories | [SOURCE] | Backend may depend on headers other features don't send |
| A2-M10 | MEDIUM | `config/access.js` permission map is unused | `start/hooks.js:52-62` | [SOURCE] | Do not treat it as the legacy permission model |

## 21. Unknowns

**A1 unknowns cross-checked:**

| A1 ID | Resolution in A2 |
|---|---|
| U04 (menu per account; hidden-screen access) | **Partly resolved** [SOURCE]: the menu is selected by `user_email` (2 special accounts); route access is not restricted for anyone. Remaining: which accounts exist [UNKNOWN — OWNER DECISION], and whether the backend rejects them [UNKNOWN — BACKEND CONTRACT] |
| U05 (session payload) | **Partly resolved** [SOURCE]: the consumed fields are `access_token`, `expires_at`, `user_email`, `user_name`, `role_name`, `user_id`/`id`/`cms_user_id`, `user.*` (unused). Full shape → [UNKNOWN — VERIFY A3.1] |
| U06 (datatable contracts) | **Resolved at envelope level** [SOURCE]: §9. Per-endpoint row fields → Mapper source per feature; runtime nullability → A3.1 |
| U12 (loyalty `required_purchase` vs `required_purchases`) | **Classified** [UNKNOWN — BACKEND CONTRACT]: request uses `required_purchases`, the edit view reads `required_purchase` [SOURCE]; the gateway field name → A3.1 |
| U14 (notification final vs cancel) | **Resolved at client level** [SOURCE]: both `cancel` and `final` call `PUT /api/v1/cms/notifications/:id/cancels`. Intended semantics → [UNKNOWN — BACKEND CONTRACT / OWNER DECISION] |
| U26 (`public/images` etc. referenced by API data) | **Classified** [UNKNOWN — BACKEND CONTRACT]; principal uploads do write to `public/images` [SOURCE] |
| U28 (`DateComparison`) | **Resolved** [SOURCE]: two copies (`app/Validators/`, `app/Helper/`); never registered through `Validator.extend`, so **not used** |

Other A1 unknowns that belong to A2: U16 and U30 (redirect-as-error) → classified as a legacy BFF contract (§8.2), runtime effect → A3.1. U22 (ReferenceError fallbacks) → auth-fallback contract (§2 step 11), runtime → A3.1.

**Remaining A2 unknowns:**

| ID | Unknown | Class |
|---|---|---|
| A2-U01 | Full gateway login `data` payload (does it include `refresh_token`, `expires_in`, roles, permissions?) | VERIFY A3.1 |
| A2-U02 | Format and timezone of `expires_at`; correctness of the string comparison | VERIFY A3.1 |
| A2-U03 | Gateway behavior on an expired or invalid token (401 body; any refresh endpoint) | BACKEND CONTRACT |
| A2-U04 | Gateway/backend authorization per role (can payment/marketing users call other feature APIs?) | BACKEND CONTRACT |
| A2-U05 | Whether the gateway requires or accepts an `Api-Key` (the target sends Kong `Api-Key`) and browser-origin CORS | BACKEND CONTRACT / OWNER DECISION |
| A2-U06 | Whether the legacy gateway (`APIGATEWAY_URL`, `/api/v1/...`) is the same service as the target's `API_HOST` (`/auth/login`, `/roles` …) | OWNER DECISION |
| A2-U07 | Whether `validate-session` / entity-access permissions exist for the legacy CMS features | BACKEND CONTRACT |
| A2-U08 | Signed URL lifetime, storage ACL and allowed content types | BACKEND CONTRACT |
| A2-U09 | Real user-id field for `X-UserId` | VERIFY A3.1 |
| A2-U10 | DataTables behavior when the endpoint answers 302/HTML | VERIFY A3.1 |
| A2-U11 | Behavior of the axios "setup error" branch (`error.response.status` on undefined) | VERIFY A3.1 |
| A2-U12 | Whether the TLS terminator sets `secure` on cookies | VERIFY A3.1 |
| A2-U13 | Which accounts are the "payment" and "marketing" users in each environment | OWNER DECISION |

## 22. A3.1 Verification Queue (behavioral / runtime)

1. Log in with a test account and capture the sanitised shape of the session `auth` payload (keys only, no values) → A2-U01, U05.
2. Check `expires_at` format and expiry behavior near the boundary; compare server TZ → A2-U02.
3. Invalidate the token at the gateway (or wait for expiry) and observe page, DataTables and AJAX behavior → A2-U03, H05, U10.
4. Log in as a payment or marketing account and open superadmin URLs directly; observe gateway responses → A2-U04, H01.
5. Simulate a gateway timeout: confirm `code 404 'Error Request URI'` handling → H04.
6. Signed upload: observe the signurl response, PUT headers and the resulting URL; test oversize and wrong-type files → A2-U08, M05.
7. CSRF: confirm a PATCH without a token passes and that token-less POSTs fail → M01.
8. `X-UserId` value sent by UserVerification → A2-U09.
9. Server logs: confirm tokens, passwords and session dumps appear (in a non-production environment) → C01, C02.
10. A1 carry-overs: U07, U16, U22, U30 (redirect / ReferenceError behaviors).

## 23. A3.2 Verification Queue (visual / UX)

1. The login page renders the prefilled fields (screenshot with values masked).
2. The expired-session experience on list pages (DataTables error dialog vs silent).
3. Menu differences for the three account types.
4. Flash visibility for failure cases (the `Warning` key, `warning` on list pages).
5. Error toasts on AJAX screens after a gateway 400 or 500.

## 24. Owner Decisions Required Later

| # | Decision | Why |
|---|---|---|
| OD-1 | Whether the target keeps a server-side BFF boundary (legacy) or browser→gateway calls (B0) | Legacy never exposes the token, gateway URL or API key; the target does |
| OD-2 | Which gateway, base path and API-key scheme the migrated screens use (`/api/v1/cms/*` vs the B0 template's endpoints; `Api-Key`) | A2-U05, U06 |
| OD-3 | The authorization model for the migrated screens: menu-by-email (legacy), or entity/access permissions (B0 `validate-session`) | The legacy app has no permission vocabulary |
| OD-4 | The special payment/marketing accounts: keep as roles, map to permissions, or drop | A2-U13 |
| OD-5 | Whether token refresh is required | The legacy app has none |
| OD-6 | Whether screens hidden from the menu but reachable remain reachable | A1-F05 + A2-H01 |
| OD-7 | Upload policy (server-side type/size checks; Principal local storage) | A2-M05, M08 |
| OD-8 | Remediation of the logging exposure in the running legacy system (outside migration scope, but urgent) | A2-C01, C02 |

## 25. A2 GO / NO-GO

The contracts are understood well enough to verify at runtime without major architectural assumptions:
- The login flow, session storage, token storage, refresh absence, topology, endpoint inventory (243 calls / 220 distinct endpoints), request/response envelopes, DataTables contract, upload flow, validation flow, error model and authorization model are all established from source.
- Permission semantics are separated from menu visibility.
- The remaining gaps are either runtime-verifiable (A3.1) or backend/owner decisions. None of them contradicts the evidence.
- No secrets were printed, and no source or config was modified.

A2 STATUS: GO
