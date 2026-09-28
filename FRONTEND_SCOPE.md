# A0 — Legacy Frontend Scope Audit (gpos-b2b-cms)

| Item | Value |
|---|---|
| Phase | A0 — Legacy Adonis frontend scope audit |
| Date | 2026-09-28 |
| Repository | `gpos-b2b-cms/` (AdonisJS 4.1, branch HEAD `00bc6ea`) |
| Mode | Read-only static inspection. No code, config, dependency, or data changed. |
| Evidence labels | `[SOURCE]` read in code · `[INFERRED]` concluded from source, not executed · `[UNKNOWN]` not decidable statically |
| Location note | Placed in the existing (empty) `docs/migration/` folder rather than creating a new `docs/architecture/`. |

---

## 1. Executive Summary

- The legacy frontend is **not** in `gpos-b2b-cms/frontend/`. That directory holds only 10 **empty** folders (`src/{api,components/{ui,channels},hooks,pages/personalization,types}`), is untracked by git, and has no files, no package.json and no build. `[SOURCE]`
- The real frontend is a **server-rendered multi-page app**: Edge templates (`resources/views/`, 191 `.edge` files) plus precompiled browser JS/CSS served statically from `public/assets/` (jQuery, Bootstrap 4 / Argon Dashboard, DataTables, select2, and others). `[SOURCE]`
- Frontend behavior also lives in **backend files**:
  - `app/Middleware/Extender.js` builds the sidebar menu per request (3 hardcoded menu sets keyed on user email).
  - `start/hooks.js` defines Edge view globals.
  - 17 Mappers and about 13 Controllers build **HTML fragments** (action buttons, badges) that are returned inside DataTables JSON.
  - `start/routes.js` defines every page URL.

  These are **SHARED / NEEDS FURTHER ANALYSIS**. `[SOURCE]`
- There is **no build step**, bundler, transpiler or client router. The browser loads files directly with `<script>`/`<link>` plus CDN libraries. `[SOURCE]`
- Browser code calls **only same-origin Adonis routes** (relative URLs, CSRF header). Adonis calls the external API Gateway server-side through `app/Helper/ApiService.js`. The browser never receives the gateway URL or the bearer token from source. `[SOURCE]` / completeness `[INFERRED]`
- **Decision: GO** for A1. The boundary is established. Remaining unknowns are runtime-level (A3) and don't change the scope boundary.

---

## 2. Audit Scope

**Included:** repository layout, `frontend/`, `resources/views/`, `public/`, `start/` (routes, kernel, hooks, app), `config/` (app, shield, cors, session, access), `app/Middleware`, `app/Helper/ApiService.js` + `Authorization.js`, HTML-producing Mappers/Controllers (identification only), package manifests, Dockerfile, Jenkinsfiles, README/CLAUDE.md.

**Excluded (by A0 mandate):** full route→screen inventory (A1), API/permission/CRUD behavior (A2), runtime verification (A3). Secret values are not reproduced here; only whether they exist.

---

## 3. Repository Frontend Boundary (A0.1, A0.3)

| PATH | TYPE | RESPONSIBILITY | FRONTEND RELEVANCE | USED BY | DEPENDS ON | EVIDENCE | MIGRATION TREATMENT |
|---|---|---|---|---|---|---|---|
| `frontend/` | Empty dir skeleton | None (placeholder: `pages/personalization`, `components/channels`) | None today | Nothing | — | `find frontend -type f` → 0 files; `git ls-files frontend` → empty `[SOURCE]` | OUT OF SCOPE (record only) |
| `resources/views/*.edge` (191) | Edge templates | All HTML pages, forms, modals, inline page JS (83 views contain `<script>`) | **Primary** | Controllers via `view.render` (103 distinct names) | View globals, `authUser`/`menu` shares, route names | `resources/views/**`; `grep view.render app` `[SOURCE]` | MIGRATE (as behavior/UI reference) |
| `resources/views/layouts.edge` | Master layout | Shell: sidebar menu, top nav, global CSS/JS, CSRF meta, axios/jQuery CSRF setup, global delete modal | **Primary** | 110 views `@layout('layouts')` | `menu`, `route()`, `csrfToken`, `title()` | `layouts.edge:9,141-156,246-312` `[SOURCE]` | MIGRATE |
| `resources/views/login.edge` | Standalone page | Login form (classic POST + `csrfField`, flash message) | Primary | `AuthController.getLogin` | `route('AuthController.postLogin')` | `login.edge:45-70` `[SOURCE]` | MIGRATE |
| `resources/views/components/` (22) | Edge components | Form field partials (`form_text`, `form_select2`, `form_date`, `form_image`, `form_texteditor_quill`, …), paginate, mobile app previews, loyalty card | Primary | `@!component(...)` (e.g. `form_select_multiple` ×85, `form_text` ×83) | `old()`, `hasErrorFor`/`getErrorFor` | include counts `[SOURCE]` | MIGRATE (capability reference) |
| `resources/views/includes/script_image_uploader.edge` | Shared partial | Browser image upload flow; reads `env('OSS_BUCKET_URL')` | Primary | 19 `@include` | `FileController.signURL` route, OSS | `script_image_uploader.edge:30` `[SOURCE]` | MIGRATE |
| `public/assets/js/main.js` | App browser JS | `$.fn.buildtable` DataTables wrapper, delete/multidelete handlers, number/IDR helpers, select2 AJAX normalizer, Choices init | Primary | `layouts.edge:267` | jQuery, DataTables, select2, Choices | `main.js:8-160,250,347-460` `[SOURCE]` | MIGRATE (behavior reference) |
| `public/assets/js/cms-toastify.js`, `pagination.js` | App browser JS | Toast helpers; custom jQuery paginator | Primary | layout (toastify); 3 views (pagination) | Toastify CDN, jQuery | refs count `[SOURCE]` | MIGRATE (behavior reference) |
| `public/assets/css/` custom (`theme-color.css`, `gamification.css`, `gpos-brand.css`, `notification.css`, `user-verification.css`) | App CSS | Theme and feature styling | Primary | layout + feature views | argon.css | style refs `[SOURCE]` | REFERENCE ONLY (visual) |
| `public/assets/css/argon.css`, `assets/scss/` (191) | Theme CSS/SCSS source | Argon Dashboard (Bootstrap 4) theme | Visual | argon.css loaded; SCSS not compiled by any repo script | — | no build script `[SOURCE]` | REFERENCE ONLY |
| `public/assets/vendor/` (2051 files) | Third-party browser libs | jQuery, Bootstrap, DataTables, select2, datepicker, gijgo, chart.js, SweetAlert, axios, richtexteditor, loadingmodal, fontawesome, nucleo, … | Runtime dependency | layout + views | — | see §7 `[SOURCE]` | REFERENCE ONLY (tech footprint) |
| `public/assets/img/`, `assets/icon/`, `assets/fonts/` | Images/icons/fonts | Logo, category icons, toast icons, Nortune/Frankfurt/nucleo/gijgo fonts | Used (partially) | views, CSS, `cms-toastify.js` | — | §7 `[SOURCE]` | MIGRATE (used assets only) |
| `public/images/` (134 files, ~19 MB) | Images | Unknown (no source reference) | Unknown | No template/JS/CSS/app reference found | — | grep → 0 local refs `[SOURCE]` | UNKNOWN |
| `public/lib/jquery-validation*` | Browser libs | Duplicate of vendor jquery-validation | None found | No reference | — | grep → 0 `[SOURCE]` | OUT OF SCOPE (unused) |
| `public/{package.json,gulpfile.js,README.md,composer.json,CHANGELOG.md,LICENSE.md,ISSUES_TEMPLATE.md,docs/documentation.html}` | Theme vendor leftovers | Argon Dashboard template tooling/docs | None | Not wired to root `package.json` | gulp 3 (not installed at root) | `public/package.json`, root `package.json` scripts `[SOURCE]` | OUT OF SCOPE |
| `public/{gpos.png,pyramid.png,splash.png,logo.svg,title.svg,style.css}` | Static files | Adonis boilerplate splash assets | None found | No reference | — | grep → 0 `[SOURCE]` | OUT OF SCOPE (unused) |
| `public/downloads/excels/import_excel_example.xlsx`, `public/uploads/productmaster/*` | Static downloads/uploads | Import template; historical uploads | Unknown | No literal reference found | — | grep → 0 `[SOURCE]` | UNKNOWN |
| `start/routes.js` | Adonis routes | All URLs: pages (GET → view), form posts, `*/datatable`, `*/options`, delete endpoints | **Shared** | Browser (navigation + AJAX) | Controllers | 554 lines, 254 `Route.` calls; public: `/`, `/login`, `/logout`; rest in `authSession` group `[SOURCE]` | SHARED FRONTEND DEPENDENCY (A1 input) |
| `start/hooks.js` | View globals | `formatDate`, `formatDateShort`, `formatRupiah`, `formatDecimal`, `jsonify`, `title`, `yearNow`, `monthNow`, `env(str)` | **Shared** | Edge templates | moment, Env | `hooks.js:5-62` `[SOURCE]` | SHARED FRONTEND DEPENDENCY |
| `app/Middleware/Extender.js` | Global middleware | Sets `authUser` getter; builds per-request `menu`; `view.share({authUser, menu})` | **Shared** (menu = UI) | Every request / layout | session `auth` | `Extender.js:13-305` `[SOURCE]` | SHARED / NEEDS FURTHER ANALYSIS (A1/A2) |
| `app/Middleware/AuthSession.js`, `app/Helper/Authorization.js` | Named middleware / helper | Redirect to `/` if no session or `expires_at` passed | Shared (navigation behavior) | `authSession` route group | session | `AuthSession.js:9-23`, `Authorization.js:4-10` `[SOURCE]` | SHARED / NEEDS FURTHER ANALYSIS (A2) |
| `app/Middleware/ExtendResponse.js` | Global middleware | `response.api(code,data,message)` JSON macro | Shared (JSON shape) | Controllers | — | `ExtendResponse.js:18-23` `[SOURCE]` | SHARED / NEEDS FURTHER ANALYSIS (A2) |
| `app/Mapper/*`, `app/Mappers/*` (17 with HTML) + ~13 Controllers | Backend mappers | Request/response shaping **and** HTML strings for DataTables cells | **Shared** (UI markup produced server-side) | `*/datatable` responses → `main.js` buildtable | Gateway response shapes | e.g. `BannerMapper.js:57` `[SOURCE]` | SHARED / NEEDS FURTHER ANALYSIS (A1/A2) |
| `app/Controllers/Http/*` (41) | Controllers | Render views, return JSON, redirects with flash (383 `response.redirect`, 68 `response.send`, 7 `response.json`) | Shared (page data = view props) | Routes | Mappers, Repositories | grep counts `[SOURCE]` | BACKEND ONLY, except view-prop contracts → REFERENCE ONLY |
| `app/Repositories/*`, `app/Helper/ApiService.js` | Gateway client (server) | All external API calls with `Bearer authUser.access_token` | Indirect (defines what data pages get) | Controllers | `APIGATEWAY_URL` | `ApiService.js:33-161` `[SOURCE]` | BACKEND ONLY (A2 reference) |
| `app/Validators/*` | Server validation | Form rules/messages; errors shown via `hasErrorFor`/`getErrorFor` | Shared (validation messages shown in UI) | Controllers | @adonisjs/validator | 59 `hasErrorFor`, 67 `getErrorFor` in views `[SOURCE]` | SHARED / NEEDS FURTHER ANALYSIS (A2) |
| `app/Models`, `database/`, `app/Models/Hooks|Traits` | ORM/migrations | Local `users`/`tokens` tables only | None | Auth provider | MySQL | CLAUDE.md + `database/migrations` `[SOURCE]` | BACKEND ONLY |
| `config/app.js`, `config/shield.js`, `config/session.js`, `config/cors.js` | Framework config | Views cache, static serving, method spoofing, CSRF, CSP (empty directives), XFRAME DENY, file session cookie `gpos-sessions` (7d, httpOnly), CORS origin off | Shared (delivery/security contract) | Adonis runtime | Env | `app.js:44,100-137`, `shield.js:30,98,134-139`, `session.js:19,30,56,68-69`, `cors.js:19` `[SOURCE]` | SHARED FRONTEND DEPENDENCY (A2/A3) |
| `config/access.js` | Config | Permission-group structure (`group_name/childs/handlers`) | None found for UI | Only `start/hooks.js:52-62` (mutated, not exposed to views) | — | grep `Config.get('access')` `[SOURCE]` | REFERENCE ONLY (appears unused) |
| `server.js`, `ace`, `start/app.js`, `start/kernel.js` | Bootstrap | HTTP server, providers (ViewProvider etc.), middleware stack incl. `Adonis/Middleware/Static` | Delivery | Runtime | — | `kernel.js:29-37,70-79` `[SOURCE]` | BUILD/DEPLOY ONLY |
| `Dockerfile`, `Jenkinsfile*`, `Makefile` | Build/deploy | node:16.13.2 image, `node server.js`, port 9000; Jenkins build/push/k8s; Sonar | Delivery | CI | — | files `[SOURCE]` | BUILD/DEPLOY ONLY |
| `tmp/sessions/` | Runtime data | File-driver session store | None | Session provider | — | `session.js:19` `[SOURCE]` | OUT OF SCOPE |
| `.vscode/`, `cherry-pick-logs/`, `.claude/`, `_MoreVerticalIcon_.png` (root) | Misc | Editor config, empty dirs, stray icon | None | — | — | ls `[SOURCE]` | OUT OF SCOPE |

---

## 4. Frontend Entry Points (A0.2)

There is no JS entry file. Every page is its own server-rendered HTML document.

**Entry 1 — Authenticated pages (110 views)**
```
Browser GET /<resource>            (e.g. /banner)
 ↓ Adonis serverMiddleware: Static (public/) → Cors            [start/kernel.js:70-79]
 ↓ global middleware: BodyParser, Session, Shield(CSRF), AuthInit,
   ConvertEmptyStringsToNull, ExtendResponse, Extender(menu, authUser) [kernel.js:22-30]
 ↓ route group middleware authSession (session 'auth' + expires_at)   [routes.js:23,554]
 ↓ Controller.index → view.render('<resource>.list', props)
 ↓ resources/views/<resource>/list.edge  @layout('layouts')
 ↓ layouts.edge: <link>/<script> tags (public/assets/**, CDNs), CSRF meta,
   axios/$.ajaxSetup X-CSRF-TOKEN, sidebar @each(menu)            [layouts.edge:9-45,141-156,246-312]
 ↓ @!section('script') page-inline JS
 ↓ $('#table').buildtable("{{ route('X.datatable') }}", columns…)  [main.js:8-160, banners/list.edge:141]
 ↓ POST /<resource>/datatable (same origin, CSRF header) → Controller → Mapper(HTML cells) → Repository → ApiService → API Gateway
```
`[SOURCE]` for each hop. That all list pages use this chain is `[INFERRED]` from the reference module plus grep counts.

**Entry 2 — Login (standalone HTML, no layout)**
`GET /` → `AuthController.getLogin` → `login.edge` (own `<head>`, relative `../assets/...` paths, jQuery + Bootstrap + argon.js only) → `POST /login` form (`csrfField`) → redirect. `[SOURCE]` `login.edge`, `routes.js:19-21`

**Entry 3 — Form pages (create/edit)**
Edge form partials (`components/form_*`), classic `POST` (with `_method=PUT` spoofing for updates, `config/app.js:44`), server validation, then redirect with `flashMessage`/`old()`/`getErrorFor`. Some pages also use AJAX (`$.ajax`, axios) against same-origin routes. `[SOURCE]` e.g. `banners/list.edge:167-219`

**Assets entry**
- CSS entry: `layouts.edge` `<head>` (15 local + 3 CDN).
- JS entry: `layouts.edge` bottom (28 local + 4 CDN).
- Per-page additions: `@!section('style')` / `@!section('script')` in 84 views.

**Not present:** webpack/vite/babel/tsconfig, TS files, React/Vue, client-side router, service worker, manifest. `[SOURCE]` (no config files; root `package.json` scripts are only `start`, `dev` and `test`)

---

## 5. Rendering Model (A0.6)

| Aspect | Finding | Evidence |
|---|---|---|
| Rendering model | Traditional **MPA, server-rendered** (Edge) with jQuery progressive enhancement | `view.render` in 36 controllers; 110 views use `@layout` `[SOURCE]` |
| Navigation | Full page loads via `<a href="{{ route(...) }}">` (419 `route(` uses) | views `[SOURCE]` |
| Client hydration / SPA | None | no framework, no client router `[SOURCE]` |
| Lists | Server-rendered shell + DataTables server-side AJAX (`POST */datatable`) returning JSON **with HTML cell markup** | `main.js:52`, `BannerMapper.js:57` `[SOURCE]` |
| Forms | HTML form POST + CSRF + redirect/flash (151 `csrfField`, 272 `flashMessage`, 85 `old(`) plus AJAX in places | views `[SOURCE]` |
| Server data into JS | Triple-stash raw output `{{{ }}}` used 43 times; `route()` interpolated into inline JS | views `[SOURCE]` |
| Dropdowns | select2 AJAX to `*/options` routes (e.g. `/products/options` ×22) | views, `main.js:347-460` `[SOURCE]` |

**Migration implication (recorded, no recommendation):** screen behavior is split across Edge markup, inline page scripts, `main.js`, and server-built HTML in Mappers. A1 has to read all four per screen.

---

## 6. Build System (A0.4)

| Item | Finding | Evidence |
|---|---|---|
| Package manager | npm (`package-lock.json`) | root `[SOURCE]` |
| Node constraint | No `engines`; Docker `node:16.13.2-alpine` | `package.json`, `Dockerfile:1` `[SOURCE]` |
| Bundler / transpiler | **None** | no config files; scripts `start`/`dev`/`test` only `[SOURCE]` |
| Dev / prod | `adonis serve --dev` (`make run`) / `node server.js` | `package.json`, `Makefile`, `Dockerfile` `[SOURCE]` |
| Build output | None; `public/` served as-is by `Adonis/Middleware/Static` | `kernel.js:70-72`, `config/app.js:113-137` `[SOURCE]` |
| CSS processing | None at repo level. `public/gulpfile.js` + `public/package.json` (gulp 3, sass) belong to the Argon template and aren't wired or installed | `public/package.json` `[SOURCE]` |
| Env handling | Server-side `Env.get`; browser gets env only through Edge `env()` global (used once: `OSS_BUCKET_URL`) | `hooks.js:58-60`, `script_image_uploader.edge:30` `[SOURCE]` |
| Code splitting / lazy loading | None (per-page `<script>` via sections only) | `[SOURCE]` |
| Source maps | Only a vendored `bootstrap-toggle.min.js.map` | `public/assets/js` `[SOURCE]` |
| Caching | `CACHE_VIEWS` (default true); static etag on; cache-busting only `?v=1.0.0` on argon/theme | `config/app.js:110,137`, layout `[SOURCE]` |
| CI | Jenkins: Docker build → push → k8s (`Jenkinsfile`, `Jenkinsfile-v2` pulls `.env` from a k8s secret); Sonar (`Jenkinsfile-gpos-sonar`). No frontend build, lint or test stage | Jenkinsfiles `[SOURCE]` |

---

## 7. Frontend Assets (A0.5)

| ASSET | LOCATION | TYPE | REFERENCED BY | USED? | MIGRATION TREATMENT |
|---|---|---|---|---|---|
| jQuery, Bootstrap bundle | `assets/vendor/jquery`, `bootstrap` | JS | layout, login | USED | REFERENCE ONLY |
| DataTables 1.10.18 + Buttons/ColReorder/JSZip/pdfmake | `assets/vendor/datatables` | JS/CSS | layout; `main.js` buildtable | USED | REFERENCE ONLY |
| select2 (+bootstrap4 theme) | `assets/vendor/select2` | JS/CSS | layout; 15 files call `select2(` | USED | REFERENCE ONLY |
| bootstrap-datepicker, gijgo (datetimepicker), bootstrap-timepicker | vendor / `assets/js` | JS/CSS | layout, 4 views | USED | REFERENCE ONLY |
| Choices.js, bootstrap-toggle | `assets/js`, `assets/css` | JS/CSS | layout; 20 files toggle, 2 Choices | USED | REFERENCE ONLY |
| jquery-validation | `assets/vendor/jquery-validation` | JS | layout; 26 files `validate(` | USED | REFERENCE ONLY |
| SweetAlert, loadingModal, richtexteditor, chart.js 2.x (+extension), axios | vendor | JS | layout | USED (chart use 2 files) | REFERENCE ONLY |
| Quill 1.3.6, Toastify, toastr, Swiper 11 | **CDN** | JS/CSS | layout; Swiper in 3 files | USED | REFERENCE ONLY |
| Google Fonts (Nunito, Open Sans) | CDN | Font | layout, login | USED | REFERENCE ONLY |
| fontawesome-free, nucleo | vendor + `assets/fonts/nucleo` | Icon font | layout (icons in menu `fa fa-*`) | USED | REFERENCE ONLY |
| Nortune, Frankfurt fonts | `assets/fonts` | Font | CSS (2 files ref `fonts/`) | USED (`nortuneBlack-font` on login) | MIGRATE (brand) |
| `gpos-b2b-logo.png`, `brand/favicon.png`, `img/icons/*` (category icons, empty-box, search, pin, notification preview) | `assets/img` | Image | 11 files | USED | MIGRATE (used set only) |
| `icon-check-green.png`, `icon-cross-red.png`, `edit.svg`, `eye.svg`, `icon-x.svg`, `_MoreVerticalIcon_.*` | `assets/icon` | Icon | `cms-toastify.js` + 4 files | USED / POSSIBLY USED | MIGRATE (used set only) |
| Argon SCSS | `assets/scss` | SCSS | not compiled | POSSIBLY USED (source of argon.css) | REFERENCE ONLY |
| prismjs, anchor-js, onscreen, holderjs, headroom.js, jquery-scroll-lock, jquery.scrollbar, nouislider, datatables-responsive, clipboard (lib) | `assets/vendor/*` | JS | no `<script>` reference; Headroom code in argon.js is commented out | UNUSED (static) | OUT OF SCOPE |
| `argon.min.css`, `argon.min.css.old`, `argon.min.js`, `theme-color.example` | `assets/css`, `assets/js` | CSS/JS | no reference | UNUSED | OUT OF SCOPE |
| `public/images/*` (134) | `public/images` | Image | no source reference | UNKNOWN (may be referenced by API/DB data) | UNKNOWN |
| `public/lib/jquery-validation*` | `public/lib` | JS | none | UNUSED | OUT OF SCOPE |
| Localization / i18n files | — | — | none exist; UI strings hardcoded (mixed Indonesian/English) | — | REFERENCE ONLY (strings live in views) |
| Manifest / service worker / PWA | — | — | none exist | — | — |

"UNUSED" means no static reference was found in views, app JS, CSS or `app/`. Dynamic references are still possible (see §14).

---

## 8. Frontend Dependencies (A0.8)

**Browser libraries (loaded from `public/` or CDN — not from `node_modules`):**

| Group | Libraries |
|---|---|
| UI / Styling | Bootstrap 4 (Argon Dashboard theme), Font Awesome free, Nucleo icons, Google Fonts |
| Frontend framework | None (jQuery 3) |
| Routing | None client-side (Adonis routes + Edge `route()` helper) |
| State management | None (DOM state, hidden inputs, `session`/flash server-side) |
| HTTP/API | jQuery `$.ajax`/`$.get` (27), axios (vendored `axios.min.js`; 49 call sites), `fetch` (4) |
| Forms | HTML forms + Edge `components/form_*`; Choices.js; bootstrap-toggle |
| Validation | jquery-validation (client); server messages via `getErrorFor` |
| Authentication | None in browser (server session cookie `gpos-sessions`); CSRF token meta + header |
| Charts | chart.js 2.x (vendored) |
| Tables | DataTables 1.10.18 (+ Buttons: excel/pdf/print/colVis, ColReorder), custom `pagination.js` |
| Editors | Quill 1.3.6 (CDN), jquery richtexteditor |
| Date/time | bootstrap-datepicker, gijgo datetimepicker, bootstrap-timepicker; server `moment` via view globals |
| Feedback | SweetAlert, Toastify (CDN) + `cms-toastify.js`, toastr (CDN), loadingModal |
| Carousel | Swiper 11 (CDN) |
| i18n | None |
| PWA | None |
| Testing | None (`npm test` → `node ace test`, no `test/` dir) |
| Build tooling | None active (Argon gulp in `public/` is inert) |

**Root `package.json` entries that look like frontend but aren't loaded by the browser:**
- `bootstrap-timepicker`, `bootstrap-toggle`: no `require`; the browser uses the copies in `public/assets/js`. `[SOURCE]`
- `chart.js ^3.7.0`: required server-side in `app/Mapper/BannerMapper.js`, while the browser loads vendored 2.x. `[SOURCE]`

Server-only: `@adonisjs/*`, `axios` (ApiService), `moment` (21 files, not declared in `package.json`, transitive), `lodash`, `nanoid`, `shelljs`, `mysql`, `sqlite3`, `node-xlsx`, `receiptline`, `node-gyp`.

---

## 9. Frontend/Backend Coupling (A0.9)

| # | LEGACY FRONTEND | ↓ ADONIS DEPENDENCY | ↓ TYPE | ↓ EVIDENCE | ↓ MIGRATION RELEVANCE |
|---|---|---|---|---|---|
| C1 | All links/forms/AJAX URLs | Adonis route names via Edge `route('Controller.action')` | Route-name coupling (419 uses) | views `[SOURCE]` | A1 must resolve names → URLs via `start/routes.js` |
| C2 | Sidebar menu | `Extender.js` hardcoded menu sets selected by `authUser.user_email` (payment / marketing / superadmin); `@if(c.visibility)` | Server-generated navigation / role-by-email | `Extender.js:19-296`, `layouts.edge:141-156` `[SOURCE]` | A1 menu source; A2 permission meaning |
| C3 | Page data | `view.render(name, props)` variables | Server-rendered variables | controllers `[SOURCE]` | A1 per-screen props |
| C4 | Table cells (actions, badges, links) | Mapper-built HTML strings in datatable JSON (e.g. relative `./banner/{id}/edit`) | Backend-generated markup/URLs | 17 Mappers + ~13 Controllers `[SOURCE]` | UI behavior hidden in backend — A1 must read Mappers |
| C5 | DataTables protocol | `POST */datatable` request/response (DataTables server-side params) + `DatatableBuilder.js` | Request/response format | `main.js:8-160`, `app/Helper/DatatableBuilder.js` `[SOURCE]` | A2 contract |
| C6 | Forms | CSRF (`csrfField`, meta `csrf_token`, `X-CSRF-TOKEN` header), `_method=PUT` spoofing, flash/`old()`/`getErrorFor` redirect-back cycle | Adonis Shield / Session / Validator | `shield.js:134-139`, `app.js:44`, layout `:287-298` `[SOURCE]` | A2 (validation + error display) |
| C7 | Formatting in templates | View globals `formatRupiah`, `formatDate*`, `formatDecimal`, `jsonify`, `title` (moment-based) | Edge helpers | `start/hooks.js` `[SOURCE]` | A1 display rules |
| C8 | Image upload | Edge `env('OSS_BUCKET_URL')` in browser JS + `FileController.signURL` | Server env exposed to browser + backend signing | `script_image_uploader.edge:30` `[SOURCE]` | A2 upload flow |
| C9 | Session/auth | Server session `auth` (gateway login payload); `authSession` redirect to `/`; `authUser` shared to all views | Session structure | `AuthSession.js`, `Extender.js:14-17,298-301` `[SOURCE]` | A2 auth |
| C10 | Dropdown options | `*/options`, `*/search`, `*/list-options` JSON routes consumed by select2 | Backend endpoints for UI widgets | views, `main.js:347-460` `[SOURCE]` | A2 contracts |
| C11 | JSON envelope | `response.api(code, data, message)` macro and ad-hoc `response.send` | Response format | `ExtendResponse.js` `[SOURCE]` | A2 |

---

## 10. Scope Matrix (A0.13)

| PATH | IN SCOPE? | TYPE | USED BY | RESPONSIBILITY | EVIDENCE | MIGRATION TREATMENT |
|---|---|---|---|---|---|---|
| `resources/views/**` (excluding orphans) | YES | Edge templates | Controllers | Screens, forms, inline JS | §3, §4 | MIGRATE |
| `resources/views/layouts.edge` | YES | Layout | 110 views | Shell, menu render, global scripts | `layouts.edge` | MIGRATE |
| `resources/views/login.edge` | YES | Page | AuthController | Login | `login.edge` | MIGRATE |
| `resources/views/components/**`, `includes/**` | YES | Partials | views | Field widgets, upload | include counts | MIGRATE (capability reference) |
| Orphan views (§14 list, 21 files) | UNKNOWN | Edge templates | no static render/include | Possibly dead | set difference render/include vs files | UNKNOWN (A1 confirm) |
| `public/assets/js/{main,cms-toastify,pagination}.js` | YES | App JS | layout/views | Table, delete, select2, toast, paginate behavior | §4 | MIGRATE (behavior reference) |
| `public/assets/css` custom files | PARTIAL | CSS | views | Theme/feature styling | style refs | REFERENCE ONLY |
| `public/assets/img`, `icon`, `fonts` (used set) | PARTIAL | Assets | views/CSS/JS | Branding, icons | §7 | MIGRATE (used only) |
| `public/assets/vendor` (loaded libs) | PARTIAL | 3rd-party JS/CSS | layout | Widgets | §7 | REFERENCE ONLY |
| `public/assets/vendor` (unloaded libs), `public/lib`, template leftovers | NO | 3rd-party / leftovers | none | — | §7 | OUT OF SCOPE |
| `public/images/**`, `public/downloads/**`, `public/uploads/**` | UNKNOWN | Static | no source ref | — | §7 | UNKNOWN |
| `start/routes.js` | PARTIAL | Routes | browser | URL map for pages + AJAX | §3 | SHARED FRONTEND DEPENDENCY |
| `start/hooks.js` | PARTIAL | View globals | templates | Formatting helpers, `env()` | §9 C7/C8 | SHARED FRONTEND DEPENDENCY |
| `app/Middleware/Extender.js` | PARTIAL | Middleware | layout | Menu + authUser | §9 C2 | SHARED / NEEDS FURTHER ANALYSIS |
| `app/Middleware/AuthSession.js`, `Helper/Authorization.js` | PARTIAL | Middleware | route group | Session gate | §9 C9 | SHARED / NEEDS FURTHER ANALYSIS |
| `app/Mapper/**`, `app/Mappers/**` | PARTIAL | Mappers | controllers | Payload shaping + HTML cells | §9 C4 | SHARED / NEEDS FURTHER ANALYSIS |
| `app/Controllers/Http/**` | PARTIAL | Controllers | routes | View props, redirects, JSON | §9 C3/C6 | REFERENCE ONLY (contracts) |
| `app/Validators/**` | PARTIAL | Validation | controllers | Rules/messages displayed in UI | §9 C6 | SHARED / NEEDS FURTHER ANALYSIS |
| `app/Helper/DatatableBuilder.js` | PARTIAL | Helper | datatable actions | DataTables response building | §9 C5 | SHARED / NEEDS FURTHER ANALYSIS |
| `app/Repositories/**`, `app/Helper/ApiService.js` | NO (reference) | Gateway client | controllers | External API calls | §3 | BACKEND ONLY (A2 reference) |
| `app/Models/**`, `database/**` | NO | ORM/DB | auth provider | Local tables | §3 | BACKEND ONLY |
| `config/{app,shield,session,cors}.js` | PARTIAL | Config | runtime | CSRF, CSP, session cookie, static | §3 | SHARED FRONTEND DEPENDENCY |
| `config/access.js` | NO | Config | hooks only | Unused permission map | §3 | REFERENCE ONLY |
| `frontend/` | NO | Empty skeleton | nothing | — | §1 | OUT OF SCOPE |
| `server.js`, `ace`, `start/{app,kernel}.js` | NO | Bootstrap | runtime | Boot/middleware | §4 | BUILD/DEPLOY ONLY |
| `Dockerfile`, `Jenkinsfile*`, `Makefile` | NO | CI/CD | Jenkins | Deploy | §6 | BUILD/DEPLOY ONLY |
| `tmp/`, `.vscode/`, `cherry-pick-logs/`, `.claude/` | NO | Misc/runtime | — | — | §3 | OUT OF SCOPE |

---

## 11. Out-of-Scope Boundary (A0.14)

Not migrated (evidence that the frontend has no direct dependency beyond HTTP/route contracts):

| Area | Why out of scope | Frontend dependency check |
|---|---|---|
| `app/Repositories/**`, `app/Helper/ApiService.js` | Server-to-gateway calls; browser never calls the gateway | Browser URLs are all relative/same-origin (sampled grep of `axios`/`$.ajax`/`fetch`/`url:`) `[SOURCE]`/`[INFERRED]` |
| `app/Models/**`, `database/migrations`, `database/seeds` | Local `users`/`tokens` only | No view references; login goes through the gateway (CLAUDE.md) `[SOURCE]` |
| `@adonisjs/lucid`, `mysql`, `sqlite3` | DB drivers | none in browser `[SOURCE]` |
| Server-only libs (`node-xlsx`, `receiptline`, `shelljs`, `nanoid`, `lodash`) | Server processing | not loaded by `<script>` `[SOURCE]` |
| `server.js`, `ace`, kernel/providers | Runtime bootstrap | delivery only `[SOURCE]` |
| CI/CD, Docker | Deploy of the Adonis app | no frontend build `[SOURCE]` |
| `frontend/` (legacy repo) | Empty | 0 files `[SOURCE]` |
| Unused vendor libs / template leftovers | No reference | §7 `[SOURCE]` |

Controllers, Mappers, Validators, `routes.js` and middleware are **not** fully out of scope. They carry frontend-visible behavior (C1–C11) and stay in the SHARED bucket.

---

## 12. Migration Boundary (A0.15)

```text
LEGACY FRONTEND
        │
        ├── MUST MIGRATE (behavior + UI, re-expressed in target)
        │     resources/views/layouts.edge, login.edge
        │     resources/views/<resource>/** (rendered/included views)
        │     resources/views/components/**, includes/script_image_uploader.edge
        │     public/assets/js/main.js, cms-toastify.js, pagination.js (behavior)
        │     used brand assets: assets/img (logo, icons), assets/icon, Nortune/Frankfurt fonts
        │
        ├── FRONTEND REFERENCE ONLY
        │     argon.css + custom CSS (visual reference), assets/scss
        │     loaded vendor libs (widget capability footprint: DataTables, select2, pickers, Quill…)
        │     Controller view-props / redirect+flash contracts
        │     config/access.js (unused)
        │
        ├── SHARED / NEEDS FURTHER ANALYSIS (A1 / A2)
        │     start/routes.js (URL + route-name map)
        │     start/hooks.js (view globals, env() exposure)
        │     app/Middleware/Extender.js (menu sets, authUser share)
        │     app/Middleware/AuthSession.js + Helper/Authorization.js (session gate)
        │     app/Middleware/ExtendResponse.js (JSON envelope)
        │     app/Mapper/**, app/Mappers/** (HTML cells, payload shapes)
        │     app/Helper/DatatableBuilder.js (datatable protocol)
        │     app/Validators/** (messages shown in UI)
        │     config/shield.js, session.js, app.js (CSRF/CSP/session/static)
        │     orphan views (21), public/images, public/downloads, public/uploads
        │
        └── BACKEND / OUT OF SCOPE
              app/Repositories/**, app/Helper/ApiService.js, app/Models/**, database/**
              server.js, ace, start/app.js, start/kernel.js
              Dockerfile, Jenkinsfile*, Makefile, tmp/, .vscode/
              frontend/ (empty), public template leftovers, unloaded vendor libs, public/lib
```

---

## 13. Findings (A0.16)

| ID | SEV | TITLE | LOCATION | EVIDENCE | CURRENT BEHAVIOR | MIGRATION IMPACT | RECOMMENDATION (scope only) |
|---|---|---|---|---|---|---|---|
| A0-F01 | HIGH | Named `frontend/` folder is empty | `gpos-b2b-cms/frontend/` | 0 files, untracked `[SOURCE]` | Placeholder dirs only | Any plan scoped to `frontend/` would miss 100% of the UI | Treat `resources/views` + `public/assets` + shared backend UI code as the frontend for A1 |
| A0-F02 | HIGH | UI markup generated in backend Mappers/Controllers | `app/Mapper/**` (17), `app/Mappers/ReferralCodeMapper.js`, ~13 Controllers | e.g. `BannerMapper.js:57` `[SOURCE]` | Table action buttons/links/badges built as HTML strings | Screen behavior invisible from templates alone | A1 must include Mappers per screen |
| A0-F03 | HIGH | Menu/role visibility decided by hardcoded user emails | `app/Middleware/Extender.js:19-296` | `[SOURCE]` | 3 menu sets (payment, marketing, superadmin default) | Navigation scope differs per account; no permission model in UI | Carry into A1 (menu inventory) and A2 (authorization meaning) |
| A0-F04 | HIGH | Login view ships prefilled account credentials | `resources/views/login.edge:56,64` | `value="…"` on email and password inputs `[SOURCE]` (values not reproduced) | Credentials rendered in HTML to anyone who opens `/` | Must not be carried into the target | Record as legacy behavior to **exclude**; flag to security owner |
| A0-F05 | MEDIUM | Views rendered but missing | `ProductGposb2bHomepageController.js:20,53,139` → `product_gposb2b_homepages/*` | no such view dir; route group exists (`routes.js:163-170`) `[SOURCE]` | Rendering likely fails at runtime `[INFERRED]` | Unclear whether the feature is live | A1/A3 confirm; mark screen status UNKNOWN |
| A0-F06 | MEDIUM | 21 orphan views | see §14 | not rendered/included statically `[SOURCE]` | Possibly dead (`edit copy.edge`, `gamification/tmp.edge`, voucher_* lists, user_management create/edit) | Risk of migrating dead screens | A1 confirms per file |
| A0-F07 | MEDIUM | Layout references route handlers that don't exist | `layouts.edge:86,103,190` (`UserController.getMyProfile`, `UserController.getLogout`, `HomeController.getDashboard`) | no `UserController` in `app/Controllers/Http`; not in routes `[SOURCE]` | Mobile profile/logout links resolve to unknown URL `[UNKNOWN]` | Menu/header behavior ambiguous | A3 runtime check |
| A0-F08 | MEDIUM | Server env exposed to browser via Edge `env()` global | `start/hooks.js:58-60`, `script_image_uploader.edge:30` | `[SOURCE]` | Any template can print any env var; only `OSS_BUCKET_URL` is used today | Defines browser-visible config set | Record `OSS_BUCKET_URL` as the only browser config (§14 table) |
| A0-F09 | MEDIUM | Static server exposes whole `public/` incl. template leftovers and uploads | `kernel.js:70-72`, `public/{package.json,gulpfile.js,README.md,composer.json,uploads/**}` | `[SOURCE]` | Non-UI files downloadable | Scope noise; possible data files | Keep out of migration scope; list for owner review |
| A0-F10 | MEDIUM | Large unreferenced image set | `public/images/` (134 files, ~19 MB) | 0 source references `[SOURCE]` | Unknown consumer (possibly API/DB-referenced URLs) | Asset scope uncertain | A3/A2: check whether API data points to `/images/…` |
| A0-F11 | LOW | Duplicate/unused browser libs | unloaded vendor dirs, `public/lib`, `argon.min.*` | §7 `[SOURCE]` | Shipped but unused | None | Exclude from scope |
| A0-F12 | LOW | Root `package.json` frontend-looking deps unused by browser; `chart.js` version split (3.x server, 2.x browser) | `package.json`, `BannerMapper.js`, `layouts.edge:269` | `[SOURCE]` | — | Tech-footprint accuracy | Use §8, not `package.json`, as the browser footprint |
| A0-F13 | LOW | CDN runtime dependencies incl. unpinned `toastr …/latest` | `layouts.edge:42-44,281-285` | `[SOURCE]` | Behavior depends on external CDNs | Visual/behavior reference may drift | Record versions as observed in A3 |
| A0-F14 | INFO | Documentation mismatch | `README.md` (Adonis boilerplate text), `public/README.md` (Argon template), `CLAUDE.md` | see §15 | — | — | Use CLAUDE.md + source; ignore both READMEs |
| A0-F15 | INFO | `env.txt` is tracked in git | repo root | `git ls-files env.txt` `[SOURCE]`; same keys as `.env.example` (values not inspected here) | — | Not frontend | Owner review (outside A0) |

---

## 14. Unknown / Unverified (A0.17)

| Item | Why unknown | Phase |
|---|---|---|
| Whether all list pages use `buildtable` + `*/datatable` | Only reference module + counts checked | A1 |
| Orphan views actually unused (dynamic `view.render` names not found, but runtime composition not executed): `components/form_time`, `components/list_paginate`, `components/paginate`, `custom_catalogs/tabs/custom_catalog_product_homepage_edit`, `custom_catalogs/tabs/custom_criteria_edit`, `gamification/tmp`, `personalization/channels/edit`, `personalization/channels/edit copy`, `poin_voucher/voucher_setting/voucher_{digital,e-wallet,folamil,listrik}/list`, `poin_voucher/voucher_setting/voucher_pulsa/{create,create_summary,list}`, `user_management/{create,edit}`, `user_management/tabs/{custom_catalog_create,custom_catalog_edit,custom_catalog_product_homepage,custom_criteria}` | Static analysis only | A1 |
| `product_gposb2b_homepages` pages at runtime | Views missing | A3 |
| Output of `route()` for non-existent handlers in layout | Framework runtime behavior | A3 |
| Real menu per account | Depends on session `user_email` values | A2/A3 |
| Whether routes are protected per menu role (vs only hidden) | Menu hides links only; route checks not audited | A2 |
| `public/images`, `public/downloads`, `public/uploads` consumers | May be referenced by API data or external links | A2/A3 |
| CDN library versions actually served (`toastr latest`) | Network-dependent | A3 |
| Session expiry UX (redirect to `/` on `expires_at`) and absence of refresh | Needs runtime | A2/A3 |
| Content of HTML cells per Mapper | Not enumerated in A0 | A1 |
| Browser config exposure beyond `OSS_BUCKET_URL` (e.g. via `{{{ }}}` of controller props) | 43 raw outputs not individually traced | A1/A2 |

**Browser-exposed configuration (A0.7)**

| CONFIG | SOURCE | CONSUMER | BROWSER EXPOSED? | EVIDENCE | TREATMENT |
|---|---|---|---|---|---|
| `OSS_BUCKET_URL` | `.env` (exists) | `script_image_uploader.edge` | YES | `:30` | A2 (upload flow) |
| CSRF token | Shield | layout meta + headers | YES (by design) | `layouts.edge:9,287-298` | A2 |
| `title` (`Env.get('title')`) | env (key not in `.env.example`) | `title()` in `<meta description>` | YES (if set) | `hooks.js:55-57` | REFERENCE ONLY |
| `APIGATEWAY_URL` | `.env` (exists) | `ApiService` | NO (server-only) | `ApiService.js:35` | BACKEND ONLY |
| Bearer `access_token` | session `auth` | `ApiService` | NO from source; `authUser` object is shared to all views, and whether any view prints it is unverified | `Extender.js:298-301` | A2 |
| `CDN_URL` | env (key not in `.env.example`) | `OtherService.js` (server builds image URLs sent to views) | Indirect (URLs in rendered data) | `OtherService.js:55-57` | A2 |
| `DEFAULT_LOYALTY_*_TEMPLATE` | env | `LoyaltyMemberRepository` → response data | Indirect | `:56-58` | A2 |
| `APP_KEY`, `DB_*`, `SESSION_DRIVER`, `HASH_DRIVER`, `TAX` | `.env` (exist) | server | NO | `config/*` | BACKEND ONLY |
| Feature flags / tenant config | none found | — | — | grep | — |

---

## 15. Evidence Index

| Ref | File | Lines / command |
|---|---|---|
| E1 | `frontend/` | `find frontend -type f` → none; `git ls-files frontend` → none |
| E2 | `package.json` | scripts `start`, `dev`, `test`; deps list |
| E3 | `start/kernel.js` | 22-30 (global), 49-54 (named), 70-79 (server: Static, Cors) |
| E4 | `start/routes.js` | 19-21 public routes; 23 group; 554 `.middleware('authSession')`; 163-170 ProductGposb2bHomepage |
| E5 | `start/hooks.js` | 5-62 view globals incl. `env` |
| E6 | `app/Middleware/Extender.js` | 13-17 authUser; 19-280 menus; 286-301 selection + `view.share` |
| E7 | `app/Middleware/AuthSession.js` | 9-23 |
| E8 | `app/Helper/Authorization.js` | 4-10 |
| E9 | `app/Helper/ApiService.js` | 33-161 |
| E10 | `app/Middleware/ExtendResponse.js` | 18-23 |
| E11 | `resources/views/layouts.edge` | 9, 15-45, 86, 103, 141-156, 190, 219, 246-312 |
| E12 | `resources/views/login.edge` | 45-70, 94-99 |
| E13 | `resources/views/banners/list.edge` | 13, 23, 103, 141, 167-219 |
| E14 | `resources/views/includes/script_image_uploader.edge` | 30 |
| E15 | `public/assets/js/main.js` | 8-160 (buildtable), 250, 347-460 |
| E16 | `public/assets/js/cms-toastify.js`, `pagination.js` | whole file / 1-40 |
| E17 | `app/Mapper/BannerMapper.js` | 57 (HTML cell) |
| E18 | `config/app.js` | 44, 100-137 |
| E19 | `config/shield.js` | 30 (CSP directives empty), 98 (xframe), 134-139 (csrf) |
| E20 | `config/session.js` | 19, 30, 56, 68-69 |
| E21 | `config/cors.js` | 19, 32, 50, 76 |
| E22 | `config/access.js` + `start/hooks.js:52-62` | only consumer |
| E23 | `app/Controllers/Http/ProductGposb2bHomepageController.js` | 20, 53, 139 |
| E24 | `public/package.json`, `public/gulpfile.js`, `public/README.md` | Argon template tooling |
| E25 | `Dockerfile`, `Jenkinsfile`, `Jenkinsfile-v2`, `Jenkinsfile-gpos-sonar` | build/deploy |
| E26 | grep counts | `view.render` (36 controllers, 103 names); `@layout` 110; `route(` 419; `csrfField` 151; `flashMessage` 272; `old(` 85; `{{{` 43; browser HTTP: `$.ajax` 25, `$.get` 2, axios 49, `fetch` 4 |
| E27 | set difference | rendered/included names vs `resources/views/**/*.edge` → 3 missing, 21 orphan |

**Documentation vs actual code (A0.12)**

| DOCUMENTATION | vs ACTUAL CODE | Status |
|---|---|---|
| `README.md`: generic "Adonis fullstack boilerplate … `adonis new yardstick`" | Customized GPOS CMS; no project documentation | DISCREPANCY (README stale) |
| `public/README.md` / `docs/documentation.html`: Argon Dashboard product docs | Only the theme CSS/JS is used; gulp pipeline inert | DISCREPANCY (vendor docs) |
| `CLAUDE.md`: server-rendered Edge + jQuery, BFF to gateway, menu by email, `config/access.js` possibly unused, list pages via `*/datatable` | Confirmed by source (E3–E17, E22) | CONSISTENT |
| `CLAUDE.md`: "There is no build step" | Confirmed (E2, E24) | CONSISTENT |
| `CLAUDE.md` omits: empty `frontend/` skeleton, HTML in Mappers, orphan/missing views | Found in source (E1, E17, E27) | GAP (undocumented) |

---

## 16. GO / NO-GO Decision

**GO.**

- The frontend boundary is established from source: Edge views + `public/assets` app JS/CSS/assets + the listed SHARED backend UI producers (`routes.js`, `hooks.js`, `Extender.js`, Mappers, Validators, DatatableBuilder, shield/session config).
- There is only one delivery model (server-rendered MPA). No hidden SPA, bundle or second entry point exists.
- Open items (§14) are per-screen or runtime questions for A1–A3. None of them moves the scope boundary.

**Input to A1:** start from `start/routes.js` GET routes that `view.render`, joined with `Extender.js` menus and `resources/views/**`. For each screen, include its inline scripts, the `main.js` helpers, and the Mapper HTML for its datatable.
