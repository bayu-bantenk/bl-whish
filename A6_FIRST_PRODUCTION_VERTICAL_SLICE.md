# A6 — First Production Vertical Slice (Content)

| Field | Value |
|---|---|
| Phase | A6 |
| Date | 2026-09-30 |
| Repo / branch | `frontend/` · `chore/a5.0-foundation-remediation` (all work since A5.0 is uncommitted; base commit `8c24d71` "initial project from DexanKit template"; 256+ changed paths predate A6 and belong to A5.x) |

## A6 status

**BLOCKED** — external dependency: **real backend contract verification** (A5.5R) is still impossible:
- the target host / environment is not confirmed (OD-02);
- no test account is available;
- the live harness refuses to run.

The implementation itself is **structurally complete and green**:
- architecture;
- server-side authorization;
- DataTable;
- create / edit forms;
- 508 unit / integration tests;
- 65 / 65 E2E (5 consecutive clean runs);
- axe;
- security;
- build and bundle.

Per the A6 rules, a production path whose backend behaviour is unverified is not downgraded to GO-WITH-RISKS. It becomes **GO-WITH-RISKS as soon as the live harness passes** against a confirmed non-production gateway (§13).

## Scope

| Migrated | Legacy | New |
|---|---|---|
| Content list (paging, page size, sort, search, URL state, empty / no-results / out-of-range / error / retry / 403) | `GET /content` + `POST /content/datatable` | `/dashboard/content` |
| Content create | `GET /content/create` + `POST /content` | `/dashboard/content/create` + Server Action |
| Content edit | `GET /content/:id/edit` + `PUT /content/:id` | `/dashboard/content/update/[id]` + Server Action |
| Menu entry "Konten" (group Bantuan Pengguna) + breadcrumbs | `Extender.js` | registry `content.list` / `content.create` / `content.update` |

**Not migrated:**
- delete and bulk delete (LEGACY_CODE only, not captured; the legacy bulk feedback is inverted);
- no upload exists on Content (not applicable);
- no rich text: legacy stores `value` as a plain textarea.

**Route mapping (A4 matrix #169 / #170 / #173):**

| Legacy | New |
|---|---|
| `/content` | `/dashboard/content` |
| `/content/create` | `/dashboard/content/create` |
| `/content/:id/edit` | `/dashboard/content/update/[id]` |

There are no aliases (no compatibility requirement).

## Legacy evidence

| Kind | Sources |
|---|---|
| Legacy source | `start/routes.js` L200–204; `ContentController.js` (index / datatable / create / store / edit / update / delete / multidelete); `ContentRepository.js`; `Validators/ContentCreateEdit.js`; `views/contents/{list,create,edit}.edge`; `public/assets/js/main.js` `BuildTable`; `Helper/ApiService.js` |
| Runtime | A5.5 list capture (`content-list.md`) and A6 write capture (`content-write.md`), both local capture gateways |
| Prior audits | A3.1 §7, A3.2 (Visual baseline rows 79–110, 173, 361, 365), A4 route matrix |

## Contract matrix

| Contract | Evidence | Status |
|---|---|---|
| List endpoint `GET /api/v1/cms/contents?sort_by&asc_desc&page&take&keyword` | A5.5 capture | request **VERIFIED_RUNTIME** (legacy side); backend UNKNOWN |
| List response `{code, data:{rows[], total_rows}}` | controller code | **LEGACY_CODE** |
| GET body duplicate | A5.5 capture | legacy sends it; the target sends the query only (OD-31) — UNKNOWN whether required |
| Detail endpoint `GET …/:id` | A6 capture | request VERIFIED_RUNTIME |
| Detail response `data {id, code, name, value, is_active?}` | `edit()` code | LEGACY_CODE; `is_active` presence **UNKNOWN** |
| Create endpoint / payload `POST {code, name, is_active: bool, value: string\|null}` | A6 capture | request **VERIFIED_RUNTIME** |
| Create success = envelope `code 201` | `store()` + capture (200 treated as failure) | LEGACY_CODE |
| Update endpoint / payload `PUT …/:id` (same body) | A6 capture | request VERIFIED_RUNTIME; success `code 200` LEGACY_CODE |
| Delete / bulk | repository code | LEGACY_CODE — deferred |
| Upload | none | N/A |
| Auth | Bearer (legacy); session + refresh = A5.1 | legacy VERIFIED_RUNTIME; backend UNKNOWN (b0 vs legacy-v1 login, OD-02) |
| API key | legacy sends none; target sends `Api-Key` if `KONG_API_KEY` is set | UNKNOWN (OD-03) |
| Authorization | legacy: every account can reach Content (A3.1 §6); backend UNKNOWN | target: capabilities (below); backend UNKNOWN |
| Errors (400 / 409 / 422 / 500 bodies, field-error format) | — | **UNKNOWN**: generic A5.3 mapping; 422 `{errors:{field:[…]}}` is UNVERIFIED |
| **Real backend** | live harness refuses (no confirmation / account) | **BLOCKED** |

## Architecture trace

```text
/dashboard/content (Server Component)
  guardRoute('content.list') → getReadServices() (DAL, one scope per request)
  → content.list(query)  [use case: require('content.read') → validateTableQuery]
  → GatewayContentRepository.list → requestEnvelope → GatewayClient (A5.1: Bearer, refresh, retry once)
  → backend → DTO → toContentPage → Page<ContentListItem> → resolvePageResult → TableState
  → ContentTable (client leaf: TanStack columns) → ServerDataTable (A5.5)

/dashboard/content/create | update/[id]
  guardRoute('content.create' | 'content.update') → (update: content.get(id) → notFound / Contract)
  → ContentForm (client: RHF + zodResolver + shadcn Form)
  → createContentAction | updateContentAction ('use server') → runAction → DAL
  → content.create / update [require(capability) → contentSchema.safeParse → isContentId]
  → GatewayContentRepository.create (okCode 201) / update (okCode 200), field errors wire→form
  → success: redirect('/dashboard/content?saved=created|updated') (server-side, one navigation)
```

- **Package:** `src/packages/content/{domain,usecases,repository,presentation}`.
- **Composition:** added to `composeFeatures()`.
- **The A5.5 fixture was moved here and deleted.** The A5.5 contract tests now run against the production package.
- Architecture rules: routes import presentation only (a route importing the domain was caught and fixed); no TanStack / HTTP / Next in the domain, use cases or repository (A5.5 / A5.6 rules, all green).

## Authorization matrix

| Capability | Route / action | Expected | Evidence |
|---|---|---|---|
| `content.read` | `/dashboard/content`, menu "Konten", `GET /:id` in edit | allowed → table; missing → 403 before any gateway call | unit `content-pages` (no grant → 0 calls); E2E reader / editor |
| `content.create` | `/dashboard/content/create`, `createContentAction`, "Tambah Konten" button | missing → page 403, action Forbidden, **0 gateway calls**; the button is hidden (visibility only) | unit `content-write.contract`; E2E reader instance |
| `content.update` (new, A4 #173) | `/dashboard/content/update/[id]` (+ `content.read`), `updateContentAction`, row "Ubah" links | missing → 403 **before** loading the item (0 detail calls), action Forbidden | unit; E2E reader instance (`details` unchanged) |
| `content.delete` | — | **not added** (no migrated route) | — |

**Grant source (new, DECISION):** `AUTHZ_INTERIM_GRANTS`.
- It is server config, validated against the vocabulary, fail-closed at startup; the default is empty (A4 OD-06 option (b), "server config mapping").
- It grants the listed capabilities to **every authenticated user** of the deployment. That equals legacy route access for Content (A3.1 §6).
- **Owner decision required** before setting it in any environment.
- **Production default: nothing granted**, so the Content routes are 403 for everyone.
- E2E runs two instances:
  - editor: `content.read,content.create,content.update`;
  - reader: `content.read`.

## Legacy behaviour → new behaviour

| Behaviour | Legacy | New | Reason |
|---|---|---|---|
| List paging / sort / search | DataTables → `sort_by/asc_desc/page/take/keyword` | URL `?page&per_page&sort&q` → same wire params | preserved (A5.5) |
| Page sizes | 5 / 10 / 25 / 50 / All | 5 / 10 / 25 / 50 | "All" is unbounded (performance) |
| List errors | silently empty | typed error state + Retry | A4 ERROR ≠ EMPTY |
| Required fields | code, name (no message, input lost) | code, name with messages; input kept; server re-validates | A4 form §3 (legacy defect) |
| Status select on edit | never pre-selected (saving could re-activate) | pre-selected from `is_active`; missing `is_active` → Contract error | legacy defect; never guess data |
| Default status on create | "Active" first | `active: true` | preserved |
| Empty value | sent as `null` | sent as `null` | preserved (runtime evidence) |
| Create success rule | envelope code 201 only | the same (code 200 → Contract) | preserved |
| After save | redirect to `/content` + auto-fading flash | server redirect to `/dashboard/content?saved=…` + persistent `role=status` notice | A4 form §6; no `Warning`-key silent failures |
| Update failure | invisible `Warning` flash | typed form-level alert / field errors | legacy defect |
| Permissions | any authenticated account | capabilities (server) + `AUTHZ_INTERIM_GRANTS` | A5.4 |
| Label typo "Ative" | yes | "Status" | copy fix |
| Value editor | plain textarea (HTML stored) | textarea (text / HTML stored as is) | preserved; rich text out of scope |

## Test evidence

| Command | Result |
|---|---|
| `npx eslint .` | 327 files, **0 errors**, 28 warnings (unchanged set) |
| `npm run quality` (lint + `tsc` + `vitest run`) | exit 0; **35 files, 508 passed, 0 failed, 0 skipped** (A5.7: 478) |
| `next build` (production) | exit 0; routes `/dashboard/content`, `/create`, `/update/[id]`; **no** e2e routes |
| `npm run check:bundle` | PASS (34 files) |
| `CI=1 npm run test:e2e:full` | **65 passed**, 0 failed / flaky / skipped |
| Stability | 5 consecutive full runs × 65 = 325 / 325 (after the fixes below) |
| `npm run test:live` | refuses: "A5.5R BLOCKED by safety gate …" (no real backend) |

**New and moved tests:**

| Suite | Tests | Covers |
|---|---|---|
| `content-write.contract.test.ts` | 16 | POST / PUT / GET bodies equal the captured legacy requests; `value: null`; create `code 200` → Contract; detail without `is_active` → Contract; null value → `''`; 404; 422 (wire → form field names), 400 Business, 409 Conflict, 403, 500, network; **401 on POST → 1 refresh, no replay**; reader create / update → Forbidden, 0 calls; browser-bypass validation, 0 calls; path-injection ids → NotFound, 0 calls |
| `content-pages.test.tsx` | 11 | production list (editor / reader visibility, saved notice, empty / error / malformed, 403, 401 hand-over with query, no grant → 0 calls); create (form, default Active, reader 403); update (prefill incl. inactive, 404, Contract → error state, reader 403 with 0 calls) |
| `content-form.production.test.tsx` | 9 | required messages; boolean status; server field error keeps input; 5 form-level kinds; **no duplicate submit while pending**; edit defaults |
| `server-config.test.ts` | 3 | grants parsing; unknown capability fails startup |
| `content-list.contract.test.ts` | 24 (moved) | A5.5 contract now against `src/packages/content` |
| container (+1) | — | configured grants only add to the base grant |

**E2E** (`e2e/specs/content.spec.ts`, 9 new, against the **production** routes):
- menu → list (active item, breadcrumb, axe);
- create: validation → success → notice → new row findable, exactly one POST with a boolean `is_active` / `null` value;
- edit: prefill incl. inactive → PUT → notice;
- 422 field / 400 / 409 / 500 distinct, input kept;
- network failure;
- **double submit → 1 POST**;
- **401 on save → 1 refresh, POST not replayed, resubmit once**;
- unknown id → 404; malformed id → 404 with 0 detail calls;
- reader instance: list readable, no create / edit controls, direct URLs → 403 with 0 detail / 0 writes (axe on 403).

The DataTable, security, accessibility and authorization specs now target `/dashboard/content`. The A5.5 list shim was removed; the A5.6 form / upload shims remain.

**Defects found and fixed during A6:**
- **Retry progressive enhancement:** "Coba lagi" was a JS-only button. It is now a link to the current URL (React drops `href=""`, so the URL is built from the pathname + search params) that is soft-refreshed once hydrated.
- **Row-link prefetch cost:** see Performance.
- **A route importing the domain** (rule violation): replaced by `presentation/content-query.ts`.
- **E2E test defects:** a column-index assumption; waiting on the URL rather than the rows after `goForward`.

**Retry flake:** seen 2 times in ~10 full runs before the prefetch change and not since (5 × 65 clean). A 12 + 15-run probe of the exact sequence never reproduced it (always hydrated, always 1 gateway call). **The root cause is not proven.** The spec now asserts that the retry reaches the gateway exactly once, so a recurrence will say which half failed (RK-A6-07).

## Security evidence

| Check | Result |
|---|---|
| Browser network boundary (every E2E test) | only the app hosts (`:19190`, `:19191`) and storage; no `Authorization` header from the browser: pass in all 65 |
| HTML / RSC / storage | no tokens / `Bearer` / session secret on home, list, create, update, 404; storage empty |
| App responses (HTML, RSC, JS, JSON) | no gateway host, `/api/v1/cms`, `sort_by`, `total_rows`, tokens |
| Bundle | `check:bundle` PASS. Fixed-string scan: `'content.read'`, `content.update`, `AUTHZ_INTERIM_GRANTS`, `is_active`, `cms/contents`, `sort_by` → 0 files. (A regex scan first flagged `content.update`: `.` matched the URL `/content/update/`, a false positive) |
| Server logs (both instances) | 0 hits for tokens, passwords, session secret, `Bearer `, signed-URL signature |
| Mutations | server-validated; unauthorized → 0 gateway calls; not replayed on 401 |

## Accessibility evidence

- **axe** (WCAG 2.1 A / AA, no rules disabled) passes on:
  - the production list;
  - the create form with errors;
  - the edit form;
  - the reader 403;
  - all A5.7 pages (login, dashboard, mobile sheet, DataTable error, form / upload errors, 404).
- **Keyboard:** sort headers, pager, search, form fields and submit (A5.7 specs, now on the production list).
- **Semantics:**
  - `aria-sort` on sortable headers;
  - table `aria-label`;
  - polite live region ("Menampilkan …", "Memuat data…");
  - field errors linked via `aria-describedby`;
  - the saved notice is `role=status`.

## Performance evidence (measured, E2E build, local, TEST_ADAPTER backend)

| Metric | Before (row links prefetched) | After (`prefetch={false}` on per-row links) |
|---|---|---|
| RSC requests per list view | **15** (home, content, create, `update/19…23` ×2) | **5** (home, content, create) |
| Gateway calls per list view | 1 list, 0 detail | 1 list, 0 detail |
| TTFB | 27 ms | 18 ms |
| Table visible | 457 ms | 457 ms |
| JS transferred | 232 KB | 232 KB |

- The prefetch never caused backend calls; it caused Next renders (layout + session + authz).
- Server-side guard (security spec): **1 gateway list call and exactly 1 render scope** per list request; one session decrypt per scope.
- No client fetching, no TanStack Query (not needed: URL → Server Component → DAL).

## Risks

| ID | Severity | Risk |
|---|---|---|
| RK-A6-01 | **Critical (blocking)** | Real backend never reached: the list / detail / create / update contracts, success codes, `is_active` in the detail, error bodies and auth contract are unverified (A5.5R BLOCKED) |
| RK-A6-02 | High | Gateway host and auth contract ambiguity (OD-02: `API_HOST` ≠ legacy `APIGATEWAY_URL`; default `b0` vs legacy `/api/v1` login) |
| RK-A6-03 | High | `AUTHZ_INTERIM_GRANTS` gives capabilities to every authenticated user (legacy-parity for Content); per-account policy is OD-05 / OD-06 |
| RK-A6-04 | Medium | If the detail response lacks `is_active`, editing shows a Contract error (fail-visible by design) |
| RK-A6-05 | Medium | Field-error mapping assumes `{errors:{field:[…]}}` (UNVERIFIED); unknown shapes degrade to a form-level Business / Validation message |
| RK-A6-06 | Medium | Query-only list request (legacy also sends a GET body, OD-31) |
| RK-A6-07 | Low | The retry E2E flake root cause is unproven (instrumented; 0 recurrences in 5 × 65) |
| RK-A6-08 | Low | Input length caps (255 / 255 / 100 000) are safety bounds, not legacy rules (INFERRED) |
| RK-A6-09 | Low | E2E CI still BLOCKED (A5.7 RK-A57-01) |
| Carried | — | A5.x risks (multi-instance refresh race OD-25, token size, `.env` in the Docker image, CSP) |

## Deferred

| Item | Why |
|---|---|
| Delete / bulk delete (`content.delete`) | no runtime capture; legacy bulk feedback inverted; needs a ConfirmDialog pattern |
| Real-backend verification | run `npm run test:live` with `A55R_CONFIRM_NON_PRODUCTION=yes`, `A55R_ALLOWED_HOST`, a test account and the right `GATEWAY_AUTH_CONTRACT`; then extend the harness to detail (read-only). Mutations only against a disposable test environment |
| Per-account authorization | OD-05 / OD-06 |
| Rich text for `value` | not in legacy (textarea) |
| Committing | nothing is committed; the whole A5.0–A6 change set sits on one uncommitted branch — split into reviewable commits before merge |

## Files changed (A6)

| Area | Files |
|---|---|
| New | `src/packages/content/**` (domain, schema, port, use case, DTO, repository, presentation: table / form / query / routes / actions); `src/app/(dashboard)/dashboard/content/{page,loading}.tsx`, `create/page.tsx`, `update/[id]/page.tsx`; `docs/architecture/contracts/legacy-api/content-write.md`; `test/fixtures/api/legacy-content-write/request-captured.json`; tests (`content-write.contract`, `content-pages`, `content-form.production`, `server-config`); `e2e/specs/content.spec.ts` |
| Changed | `shared/authorization/{capabilities,interim-policy}.ts`; `shared/infrastructure/config/server-config.ts` (`AUTHZ_INTERIM_GRANTS`); `shared/infrastructure/container/server-container.ts` (content feature, `policyFor`); `shared/navigation/registry.ts` (Content active + create / update); `components/molecules/feedback/retry-button.tsx`; `.env.example`; E2E (`mock-backend`, `start-app`, `playwright.config`, `fixtures`, datatable / security / accessibility / authorization specs); tests (container, dal, `content-list.contract`, `server-data-table`, `reference-boundary`, `authorization-boundary`, architecture scan list); `test/helpers/server.ts`; `test/live/content-list.live.test.ts` |
| Removed | `test/fixtures/content-list/**` (moved to production); `src/__tests__/content-list-page.test.tsx` (superseded); `e2e/app-routes/content/page.tsx` (the list shim) |

**Not changed:** legacy app, backend, dashboard shell, session / gateway / DAL code, Jenkinsfile / Dockerfile, other features.
