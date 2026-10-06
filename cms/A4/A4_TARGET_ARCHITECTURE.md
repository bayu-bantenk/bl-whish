# A4 — Target Architecture

| Item | Value |
|---|---|
| Phase | A4: Target Architecture & Migration Contract (architecture only; nothing implemented) |
| Date | 2026-09-29 |
| Target | `frontend/`: Next.js 16.2.3 (App Router), React 19.2, TypeScript (strict), Tailwind CSS 4, shadcn/ui |
| Backend | Separate. The API Gateway and backend are **not** migrated. Next.js is the frontend/application layer |
| Binding inputs | `TARGET_UI_FOUNDATION.md` (binding); A0 `FRONTEND_SCOPE.md`; A1 `ROUTE_SCREEN_MAP.md`; A2 `AUTH_API_PERMISSION_MAP.md`; A3.1 `RUNTIME_BEHAVIOR_AUDIT.md`; A3.2 `VISUAL_BASELINE.md`; B0 target baseline (chat audit, 2026-09-25) |
| Companion documents | `A4_AUTH_SESSION_ARCHITECTURE.md`, `A4_API_DATA_ACCESS_ARCHITECTURE.md`, `A4_FORM_ARCHITECTURE.md`, `A4_NAVIGATION_AUTHORIZATION.md`, `A4_SECURITY_ARCHITECTURE.md`, `A4_PERFORMANCE_STRATEGY.md`, `A4_TEST_STRATEGY.md` |

Decision IDs (`AD-xx`) are defined here and in the decision register (`A4_MIGRATION_DECISION_REGISTER.md`). Open questions (`OD-xx`) are in `A4_OPEN_DECISIONS.md`.

---

## 1. Architecture decisions summary

| ID | Decision | Evidence | Status |
|---|---|---|---|
| AD-01 | **Server-side BFF topology.** The Next.js server is the only caller of the API Gateway. The browser never receives the gateway URL, access token, refresh token or any API key | Legacy is a BFF (A2 §5; A3.1 Q1–Q3). The B0 target inlines `API_HOST*` / `KONG_API_KEY` into the client bundle and sends the bearer token from browser JS | **DECIDED** (A4). Owner may veto only with a backend constraint that forces browser-direct calls (OD-01) |
| AD-02 | **Server-first data fetching.** Page data is fetched in Server Components through a `server-only` Data Access Layer (DAL). Table and list state lives in the URL (search params) and drives server re-rendering | Next.js 16 `data-security.md` (DAL guidance); B0 client `useEffect` fetching; AD-01 | **DECIDED** |
| AD-03 | **Mutations use Server Actions** (thin `"use server"` → application use case → DAL), followed by `revalidatePath` / `refresh()`. Route Handlers are used **only** for client-driven interactive endpoints (async select options, upload signing, CSV validation) | Next.js 16 `refresh.md`, `updateTag.md`, `data-security.md` | **DECIDED** |
| AD-04 | **Typed error model: ERROR ≠ EMPTY.** Every data call returns a typed result; transport failure, timeout, 401, 403, 404, validation and conflict are distinct | Legacy defects: silent empty table (A3.1 §7, A3.2 §20); timeout shown as 404 (A2-H04) | **DECIDED** |
| AD-05 | **UI foundation per `TARGET_UI_FOUNDATION.md`:** Tailwind CSS + shadcn/ui; `src/components/ui/**` = ATOMS; no Bootstrap / jQuery / DataTables | Binding constraint | **BINDING** |
| AD-06 | **DataTable** = `organisms/data-table` (shadcn `Table` presentation + TanStack Table 8.21.3 engine, already a direct dependency) in manual (server-side) mode, with the contract in §10 | B0: organism and `use-data-table` exist | **DECIDED** |
| AD-07 | **Forms** = react-hook-form 7 + zod + shadcn `Form` / `Field` primitives; server validation mirrored in Server Actions | B0: `@hookform/resolvers`, `react-hook-form` direct; zod transitive only (needs declaration, OD-14) | **DECIDED** (dependency declaration pending approval) |
| AD-08 | **Auth/session:** the server holds tokens in an httpOnly session; there is single-flight refresh with retry exactly once (see the auth document) | A2 §2–4; A3.1 §4–5 | **DECIDED (contract).** Implementation mechanism: OD-15 / OD-16 |
| AD-09 | **Authorization is enforced server-side** (DAL + route guard). The navigation registry only filters visibility. **Menu visibility ≠ authorization** | A2 §13; A3.1 §6 | **DECIDED** (policy content: OD-05) |
| AD-10 | **No experimental Next.js APIs by default:** `authInterrupts` (`forbidden()` / `unauthorized()`), `taint` and Cache Components are not used without explicit approval | Next.js 16 docs mark `forbidden` / `unauthorized` as `version: experimental` | **DECIDED** |
| AD-11 | **No new dependency without approval** (B0 rule). Every dependency need is registered in `A4_OPEN_DECISIONS.md` (OD-11, OD-14) | Project constraint | **BINDING** |
| AD-12 | **Reuse the existing hexagonal package layout** (`src/packages/<feature>/{domain,usecases,repository,presentation}`) and fix its B0 defects (usecases instantiating axios, no ports, `Promise<any>`, swallowed errors) | B0 §B0.3–B0.4 | **DECIDED** |

## 2. Layer model and dependency direction

```text
            ┌────────────────────────────────────────────────────────┐
  UI        │ app/ (routes, layouts, loading/error/not-found)        │
            │ packages/<f>/presentation (feature UI, columns, forms) │
            │ components/{templates,organisms,molecules,ui}          │
            └───────────────┬────────────────────────────────────────┘
                            ↓ calls (Server Components, Server Actions)
            ┌────────────────────────────────────────────────────────┐
  Feature / │ packages/<f>/usecases  (application use cases:         │
  App       │   queries + commands, authorization checks, mapping)   │
            └───────────────┬────────────────────────────────────────┘
                            ↓ depends on interfaces (ports)
            ┌────────────────────────────────────────────────────────┐
  Domain /  │ packages/<f>/domain    (types, value objects, ports,   │
  Contract  │   validation schemas, error types) — framework-free    │
            └───────────────▲────────────────────────────────────────┘
                            │ implements ports
            ┌────────────────────────────────────────────────────────┐
  Infra /   │ packages/<f>/repository (gateway DTO ↔ domain mapping) │
  API       │ shared/infrastructure/{http,session,logger,config}     │
            │   → API Gateway (server-only)                          │
            └────────────────────────────────────────────────────────┘
```

| Rule | Detail |
|---|---|
| R1 | `domain/` imports nothing from React, Next.js, axios/fetch, cookies, `process.env` or browser APIs (B0 found domain already clean — keep it so) |
| R2 | `usecases/` depend on domain ports only. They never construct HTTP clients (fixes B0: `axios.create()` inside every usecase) |
| R3 | `repository/` implements domain ports and maps **gateway DTOs** (legacy field names such as `total_rows`, `rows`, `customer_ids`) to **domain models**. Legacy endpoint shapes never leak above the repository (A4 brief §11) |
| R4 | `presentation/` and `app/` never import `repository/` or `shared/infrastructure/*` directly |
| R5 | Every module that touches tokens, `process.env` secrets or the gateway is `server-only` (§8) |
| R6 | Composition root: a per-request container in `shared/infrastructure/container` wires repositories (with the session-bound HTTP client) into use cases. Server Components and Server Actions obtain use cases from it |
| R7 | Cross-feature use: a feature may call another feature's **use case** (e.g. Banner uses Customer-Channel options), never another feature's repository |
| R8 | Component tiers follow `TARGET_UI_FOUNDATION.md` §2: `ui` → nothing; molecules → ui; organisms → molecules/ui; templates → organisms/molecules/ui; features → any tier. Feature components live in `packages/<f>/presentation/**` |

## 3. Target directory structure

This structure reuses the B0 layout and adds only what the architecture requires. It is a plan; nothing is created in A4.

```text
frontend/src/
├── app/
│   ├── (auth)/
│   │   └── login/                 page.tsx (Server Component shell) + login form (client)
│   ├── (dashboard)/
│   │   ├── layout.tsx             session guard + shell template (sidebar/header)
│   │   ├── not-found.tsx          (segment 404)
│   │   ├── error.tsx              (segment error boundary, "use client", reset/retry)
│   │   └── dashboard/
│   │       ├── home/
│   │       └── <feature>/         page.tsx (list), create/, update/[id]/, detail/[id]/
│   │           ├── loading.tsx
│   │           └── error.tsx      (optional per feature)
│   ├── api/
│   │   ├── auth/[...]             only if the chosen session implementation needs it (OD-16)
│   │   └── bff/<feature>/<op>/    Route Handlers for client-driven endpoints only (AD-03)
│   ├── global-error.tsx
│   └── layout.tsx
├── proxy.ts                       optimistic session-cookie check + redirect (no gateway calls)
├── packages/<feature>/
│   ├── domain/                    <feature>.ts (types), <feature>.port.ts, <feature>.schema.ts, errors
│   ├── usecases/                  <feature>.queries.ts, <feature>.commands.ts
│   ├── repository/                <feature>.repository.ts (gateway DTO mapping), dto.ts
│   └── presentation/
│       ├── components/            feature-specific components (PaymentStatusBadge, …)
│       ├── table/                 <feature>.table-columns.tsx, <feature>.table.tsx
│       ├── forms/                 <feature>.form.tsx
│       └── actions/               <feature>.actions.ts ("use server", thin)
├── components/                    ui (ATOMS) / molecules / organisms / templates
└── shared/
    ├── infrastructure/            server-only
    │   ├── http/                  gateway client, error normalisation, timeout, retry policy
    │   ├── session/               session read/write, refresh single-flight
    │   ├── container/             per-request composition root
    │   ├── logger/                redacting structured logger
    │   └── config/                server env schema (validated at startup)
    ├── config/public.ts           the only browser-safe config (NEXT_PUBLIC_*, non-secret)
    ├── navigation/                navigation registry + route metadata
    ├── authorization/             policy port + evaluator (server) + visibility helper
    ├── errors/                    AppError taxonomy (framework-free)
    ├── table/                     TableQuery / Page<T> contracts + URL codec
    ├── upload/                    upload contract + client uploader hook
    ├── hooks/, utils/, constants/, styles/
```

**Naming.** Feature package names use kebab-case English-ish target names. A legacy→target name mapping is in `A4_ROUTE_MIGRATION_MATRIX.md`, for example `Kode Telesales` → `referral-code` and `Konfigurasi Channel` → `channel-configuration`. File naming follows the project rules, **after** the drift fixes in §17 (`*.schema.ts`, not `*.scheme.ts`).

## 4. Routing

| Aspect | Decision |
|---|---|
| Route groups | `(auth)` for public auth screens; `(dashboard)` for authenticated screens under the `/dashboard/...` prefix (B0 convention) |
| URL scheme | `/dashboard/<feature>` (list), `/create`, `/update/[id]`, `/detail/[id]`. Legacy URLs are **not** preserved (no parity requirement, A1 §21). Legacy-URL redirects: DEFERRED (OD-26) |
| Params | Next.js 16 `params` / `searchParams` are Promises and must be awaited (already used in B0 pages) |
| Dynamic rendering | Authenticated pages read cookies, so they are dynamic. No static generation of per-user data |
| `proxy.ts` | **Optimistic check only**: session cookie present → continue; absent → redirect to `/login?returnTo=<same-origin path>`. It never calls the gateway (Next.js 16 `authentication.md`: Proxy runs on prefetches too) |
| Hidden routes | Every route is registered in the navigation registry with `visibleInMenu` and `requires` metadata (see the navigation document). Hidden ≠ unprotected |
| 404 | `not-found.tsx` per group; `notFound()` from use cases when the gateway returns 404 for a detail id |
| 401 / 403 | No experimental `unauthorized()` / `forbidden()` (AD-10). 401 → redirect to login (session layer); 403 → render the `AccessDenied` template (typed `AppError.Forbidden`) |

## 5. Layouts and templates

| Layout | Composition |
|---|---|
| Root `app/layout.tsx` | fonts, `<html>`, global providers (Tooltip, Sonner `Toaster`), no session reads |
| `(auth)/layout.tsx` | the `AuthLayout` template (centered card) |
| `(dashboard)/layout.tsx` | Server Component: validates the session (DAL), builds the menu from the navigation registry + policy, renders the `DashboardShell` template (shadcn `Sidebar` + header + breadcrumb slot) |
| Feature pages | Use the templates `ListPage`, `FormPage`, `DetailPage` (`components/templates/*`) |

B0 defects to fix: `GlobalProvider` nested three times; `AppProvider` mounted inside every view; a client-side `PrivatePage` redirect. Target: providers once in the root layout; the session guard runs server-side in the `(dashboard)` layout plus the DAL; no client-side auth redirects.

## 6. Server / Client Component boundaries

| Concern | Server Component | Client Component |
|---|---|---|
| Page data (lists, details, options preloaded for forms) | ✅ via use cases / DAL | ❌ |
| Session, tokens, gateway, env secrets | ✅ only | ❌ never (enforced by `server-only`) |
| Table interactivity (sorting clicks, pagination, column visibility, selection) | Receives data + total | ✅ `DataTable` organism (`"use client"`), updates URL state |
| Forms | Initial values, option lists | ✅ RHF form; submits a Server Action |
| Async select search (legacy select2 `data-url`) | — | ✅ calls a same-origin Route Handler (`/api/bff/...`) |
| Upload | Signing via Route Handler | ✅ file picker, direct PUT to storage |
| Toasts | — | ✅ Sonner |

**Serialisation rule.** Only plain, filtered view models cross the server→client boundary. Never pass the session object, tokens, raw gateway responses or error stacks (Next.js 16 `data-security.md` §"Passing data from server to client").

## 7. Feature boundaries

- One package per legacy feature area (32 feature areas, A1 §23 → `A4_ROUTE_MIGRATION_MATRIX.md`).
- Shared cross-feature lookups (legacy OPTIONS endpoints such as `/banner/cust-id`, `/principal/options`, `/tc/options`, `/catalog/options`, `/product-class/options`) become **use cases of the owning feature**, exposed to other features through their use-case API. The purely technical ones (catalog, tc, product-class) become a `reference-data` package.
- The B0 template packages (`user`, `role`, `permission-set`, `api-key`, `attribute`, `audit-log`, `workflow`, `dashboard`) are **not** part of the GPOS legacy scope. Keep / remove is OD-17.

## 8. API client (Data Access Layer)

Details are in `A4_API_DATA_ACCESS_ARCHITECTURE.md`. Summary:
- `shared/infrastructure/http/gateway-client.ts` (`server-only`): the base URL comes from the validated server env. Timeout, cancellation (`AbortSignal`), error normalisation (AD-04), redacting logs, and the bearer token from the session. Any API-key header is added here and only here (OD-03).
- It replaces B0 `RestAPI` (axios defaults mutation, `Api-Key` from inlined env, `error.response` crashes on network errors).
- Transport choice: native `fetch` (Next.js server) or the existing axios. No new dependency either way. **Recommended: native `fetch`**, because it has AbortSignal support and removes axios from the client bundle.

## 9. Query, mutation, loading and error handling

| Concern | Mechanism |
|---|---|
| Queries | Server Components call `useCases.<feature>.list(query)` / `.get(id)`, which return `Result<T, AppError>`. The page maps `Err` to error UI (typed) or `notFound()` |
| Mutations | Server Action → Zod parse → use-case command → `Result`. On success: `revalidatePath(<list path>)` or `refresh()` + a toast. On failure: a field-error map or a form-level error |
| Client cache | **None by default** (no TanStack Query / SWR installed; AD-11). URL state + server rendering covers the list, detail and form flows. Adding a client cache: OD-27 (only if A5 evidence shows a need) |
| Loading | `loading.tsx` / `<Suspense>` skeletons for the first render. `useTransition` pending indicators for URL-state transitions (previous rows stay visible, dimmed, with an aria-busy state) |
| Errors | Segment `error.tsx` (client, `reset()`) for unexpected errors; typed inline error states for expected errors (DataTable error + retry, form errors); `global-error.tsx` as the last resort; **never native `alert()`** (legacy defect, A3.2 §20) |
| Session expiry | Handled centrally in the session layer (refresh → retry once → else clear + redirect to login with `returnTo`). No stale data remains on screen (legacy defect: stale DataTable after expiry) |

## 10. Table abstraction and DataTable contract

### 10.1 Placement

| Part | Location |
|---|---|
| Generic engine + presentation | `components/organisms/data-table/` (existing: `data-table.tsx`, `data-table-toolbar.tsx`, `data-table-pagination.tsx`, `data-table-column-header.tsx`, `data-table-view-options.tsx`, `data-table-floating-bar.tsx`, `data-table-skeleton.tsx`, `advanced/*`) on shadcn `ui/table` + TanStack Table |
| State hook | `shared/hooks/use-data-table.ts` (existing; already syncs page / per_page / sort / filters to the URL) |
| Contracts | `shared/table/` (`TableQuery`, `Page<T>`, URL codec), framework-free types |
| Feature columns | `packages/<f>/presentation/table/<f>.table-columns.tsx`, plus `<f>.table.tsx` wiring |

The generic DataTable contains **no** business-specific columns, statuses or endpoints (binding brief §7).

### 10.2 Contract (types; framework-free)

```ts
// shared/table/contracts.ts
export type SortDirection = 'asc' | 'desc'
export interface TableSort { field: string; direction: SortDirection }
export type FilterValue = string | string[] | { from?: string; to?: string }  // text, multi, date range
export interface TableQuery {
  page: number            // 1-based
  pageSize: number        // one of the allowed page sizes
  sort: TableSort[]       // server-side; empty = feature default
  search?: string         // global search term
  filters: Record<string, FilterValue>  // feature-declared filter keys only
}
export interface Page<T> { items: T[]; total: number; page: number; pageSize: number }

export type TableViewState<T> =
  | { status: 'loading' }                                        // first load (skeleton)
  | { status: 'success'; page: Page<T>; pending: boolean }        // pending = URL transition in flight
  | { status: 'empty'; query: TableQuery; hasActiveCriteria: boolean } // no rows; different copy when filters/search active
  | { status: 'error'; error: AppError; retryable: boolean }      // never rendered as empty
```

### 10.3 Capability contract

| Capability | Contract |
|---|---|
| Server-side pagination | `page`, `pageSize` in the URL (`?page=2&per_page=25`). Allowed page sizes are declared per feature (legacy defaults 5 / 15 are evidence, not requirement). Total comes from the gateway `total_rows` → `Page.total` (the repository maps it) |
| Server-side sorting | `sort=field.asc,field2.desc` in the URL. Only columns declared `sortable` in the feature column definitions. The repository maps domain fields to gateway `sort_by` / `asc_desc` (single sort today, since legacy gateways accept one) |
| Server-side filtering | Feature-declared filter keys (`?status=ACTIVE&type=CAROUSEL&from=…&to=…`). Unknown keys are ignored and invalid values fall back to defaults (URL codec validates with zod). Filters shown as a `FilterBar` organism (select / multi / date-range / chips) |
| Search | `?q=` with a debounce (existing `useDebounce`). Structured search (legacy `{type, keyword}`, Order `{custId, filter, keyword}`) → explicit `searchField` + `q` params, never JSON in the URL |
| Row selection | Scoped to the **current page**. Selection is cleared on page / sort / filter / search change and after a bulk action. Cross-page "select all matching": DEFERRED (OD-28) |
| Bulk action | Declared by the feature (`{id, label, variant, confirm, action}`). Always confirmed with `AlertDialog`. Executed via a Server Action with an id list. The result toast reports success / failure counts. Partial failure keeps the failed ids selected. **Legacy inverted feedback is not carried** |
| Column visibility | `data-table-view-options` (existing). Default visibility is declared per feature (mobile-priority columns). Persistence: session-only (no storage) unless OD-29 decides otherwise |
| Loading | First render: `DataTableSkeleton` (existing) via Suspense / `loading.tsx`. Transition: rows stay visible, dimmed, with `aria-busy="true"` and a spinner in the toolbar. Never a blank table during a transition |
| Empty | shadcn `ui/empty` with a context message: "no data yet" (optional create CTA if permitted) vs "no results for current search/filters" (with a "clear filters" action) |
| Error | Inline error panel **in place of the rows**: message from the `AppError` kind (network / timeout / forbidden / server), a **Retry** button (re-runs the query via `router.refresh()` / `reset()`), and a correlation id when available. `ERROR ≠ EMPTY` is a hard rule |
| Retry | Manual retry always available for retryable errors. No automatic retry of list queries beyond the transport policy (idempotent GET: 1 retry on network error, see the API document) |
| Session expiry | The DataTable never handles it. The session layer refreshes and retries once, or else redirects (auth document). **No native alert, no stale rows** |
| Refresh / invalidation | After a mutation: the Server Action calls `revalidatePath(listPath)` (or `refresh()`). Selection is cleared and the scroll position kept. Explicit "Refresh" toolbar button optional per feature |
| Responsive | Desktop-first parity with the legacy intent: the table sits in a horizontally scrollable container (`overflow-x-auto`) with **no page-level horizontal overflow** (a legacy defect). Toolbar wraps. The mobile default hides low-priority columns via column visibility. Card/list rendering on mobile: DEFERRED (OD-30) |
| Accessibility | Semantic `<table>` (shadcn `Table`) with an accessible name (`aria-label` / caption). Sortable headers are buttons with `aria-sort`. Selection checkboxes are labelled ("Select row <id>", "Select all on page"). Pager controls are labelled. Loading / result changes are announced through a polite live region. Everything is keyboard operable; focus stays visible. Dialogs are Radix-based with focus trap and return |
| URL/query-state sync | Default for list screens (shareable, back/forward-safe). Default values are omitted from the URL. Exceptions (e.g. embedded tables inside a form tab such as Produk Gpos B2b homepage products) use local state (the `urlState: false` option) |
| Export | Legacy browser-side "current page" export (A1-F08) is **not** assumed. Export semantics (current page vs full server export) are OD-22 |

### 10.4 Legacy mapping

| Legacy (evidence) | Target |
|---|---|
| `$.fn.buildtable` + DataTables server-side (`draw/start/length/search[value]/order/columns[]`) | URL `TableQuery` → Server Component → use case → repository → gateway (`page/take/keyword/sort_by/asc_desc/filters`) |
| Mapper-built HTML cells with `data-*` records (A1 §8, A3.2 §16) | React cell renderers in feature column definitions. Row actions receive **ids**, and the use cases fetch what they need (no embedded full records) |
| `recordsTotal === recordsFiltered === total_rows` | `Page.total` |
| Gateway error → empty table | `status: 'error'` + retry |
| Notification error → stuck "Processing…" | Impossible by contract: every query settles to success / empty / error |

## 11. Upload abstraction

The contract is in `A4_API_DATA_ACCESS_ARCHITECTURE.md` §9. Summary:
- **KEEP** signed-URL direct upload: the browser PUTs to storage, and Next.js never proxies the file bytes (A3.1 §11).
- The sign request goes to a same-origin Route Handler, which authenticates, **validates content type / size / extension against a per-field allowlist** (an improvement on A2-M05), and calls gateway signurl.
- The client `useUpload` hook and an `Upload` molecule (built on the existing `molecules/dropzone` + shadcn `Progress`) show progress, errors and remove / retry.
- The form stores the resulting file URL.

## 12. Form abstraction

See `A4_FORM_ARCHITECTURE.md`: RHF + zod schema in `domain/`, shadcn `Form` / `Field`, a Server Action returning the `ActionResult` with field errors, an unsaved-changes guard, and the rich-text decision.

## 13. Configuration and environment boundary

| Class | Where | Rule |
|---|---|---|
| Server-only secrets and config (`API_GATEWAY_URL`, API key if any, session secret, OSS signing config if any) | `shared/infrastructure/config/server.ts` (`server-only`); validated with zod at startup; only the DAL / infrastructure read `process.env` | **Never** in `next.config.ts env` (which inlines into the bundle; Next.js 16 `env.md`). Remove the B0 `env: { API_HOST…, KONG_API_KEY }` inlining in implementation |
| Browser-safe config | `shared/config/public.ts` reading `NEXT_PUBLIC_*` | Non-secret only (e.g. app name, public asset host). Reviewed per variable |
| Build / deploy | Dockerfile / CI | `.env` must not be baked into images (B0 finding: the frontend Dockerfile copies `.env`). Deployment hardening: OD-25 |

## 14. Observability boundary

- Structured server logging via `shared/infrastructure/logger` with **mandatory redaction**: never log tokens, `Authorization` headers, cookies, passwords or request / response bodies of auth, upload-sign or PII endpoints. This is the direct lesson of legacy A2-C01 / C02 (confirmed at runtime in A3.1 §13).
- Log fields: timestamp, level, route, use case, gateway path template (no ids with PII), status, duration, correlation id.
- A correlation id is generated per request (or taken from an inbound header) and forwarded to the gateway if the backend supports it (OD-24).
- Client: `error.tsx` / `global-error.tsx` report sanitized errors (no stack to the UI). An error-reporting service (Sentry / OpenTelemetry): DEFERRED (OD-24). `instrumentation.ts` is available in Next.js 16 for later wiring.

## 15. Existing target assets: reuse vs change

| Asset (B0) | Decision |
|---|---|
| `components/ui/**` (52 shadcn primitives) | REUSE as ATOMS |
| `components/organisms/data-table/*`, `shared/hooks/use-data-table.ts` | REUSE and extend (error / empty / retry / a11y / transition states) |
| `components/molecules/*` (pickers, multiple-selector, dropzone, tag-input, password-input, autocomplete-search) | REUSE; review each against the §10.3 accessibility rules |
| `components/organisms/modal/alert-*` | REUSE (AlertDialog-based) |
| `components/templates/dashboard.tsx`, `organisms/navigation/*`, `organisms/header` | REFACTOR: menu from the navigation registry (server), no client session reads |
| `shared/utils/rest-api/*` | REPLACE by `shared/infrastructure/http` (server-only) |
| `packages/*/usecases` (construct axios per call) | REFACTOR to ports + container |
| `shared/utils/auth/*` (better-auth custom credentials; unsigned cookie decode; token exposed via client session) | REPLACE the current integration (auth document §6; OD-16) |
| `shared/utils/index.ts` barrel exporting server auth to client code | REMOVE the mixed barrel; split into server and client entrypoints |
| `next.config.ts env` inlining secrets | REMOVE (security document) |
| `src/proxy.ts` | KEEP the role (optimistic check); remove the reliance on the forgeable cookie decode |
| Husky pre-commit (`next lint`, removed in Next 16; `prettier --write src`) | FIX before implementation starts (readiness prerequisite) |

## 16. Constraints for implementation phases

1. No page / feature implementation until the prerequisites in `A4_READINESS_REPORT.md` are met.
2. No new dependency without approval (OD-11, OD-14).
3. No experimental Next.js flags without approval (AD-10).
4. No Bootstrap, jQuery or DataTables in `frontend/` (binding).
5. Legacy defects listed in `A4_MIGRATION_CONTRACT.md` §"Legacy defect disposition" must not be reproduced.

## 17. Architecture documentation drift (found in A4; not modified)

| Drift | Location | Binding truth | Remediation (recommended) |
|---|---|---|---|
| Atoms tier named `src/components/atoms/**`, with `components/ui/**` listed separately as "Shadcn" | `frontend/.claude/rules/component-organization.md:9`; `.cursor/rules/component-organization.mdc:12`; `.github/instructions/component-organization.md:12`; `.agents/rules/component-organization.md:12` | `src/components/ui/**` = ATOMS (`TARGET_UI_FOUNDATION.md` §2, option (a)) | Rewrite the atoms entry to `src/components/ui/**`, drop the separate "Shadcn" entry, and keep the four mirrors identical. Owner-approved change, done as one commit in the frontend repo |
| Malformed path `src/packages/<package-name>.schema.ts<package-name>/presentation/table/...` | `.claude/rules/form-and-validation.md:30`, `presentation-layer-structure.md:15` (+ mirrors) | `src/packages/<package-name>/presentation/table/**` | Fix the path text |
| Rules require `*.schema.ts`, `*.usecase.ts`, `*.repository.ts`; code uses `*.scheme.ts`, `usecase.ts`, `repository.ts`, `respository.ts` | `naming-conventions.md`, `form-and-validation.md` vs `src/packages/**` | Rules (A4 adopts rule naming for new code) | New code follows the rules; the existing template packages are renamed only if kept (OD-17) |
| Rules say "Presentation may import other presentation", but not whether cross-feature use-case imports are allowed | `package-boundaries.md` | R7 above | Add R7 to the rules |
| README lists `Ports`, `Handler`, `Stories` layers that don't exist | `frontend/README.md` | §2 / §3 above | Update the README when the rules are fixed |
| `components.json` `css: app/globals.css` (real path `src/shared/styles/globals.css`) | `frontend/components.json` | shadcn CLI must write to the right file | Fix the path before any `shadcn add` |
