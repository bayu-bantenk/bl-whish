# A4 — Performance Strategy

| Item | Value |
|---|---|
| Phase | A4 (architecture only) |
| Date | 2026-09-29 |
| Principle | No premature optimization. Establish sound defaults, measure in A5+, and optimize against evidence |
| Evidence | B0 (client-side `useEffect` fetching, heavy dependency set, `reactStrictMode: false`); A2 §7 (240 s gateway timeout); A3.2 (lists of 5–15 rows per page; no page skeletons) |

## 1. Rendering model

| Topic | Strategy |
|---|---|
| Server Components | Default for pages, layouts, list and detail data. They remove client fetch waterfalls (B0: every view fetched after hydration) and keep gateway code out of the bundle |
| Client Components | Only interactive leaves: DataTable, forms, pickers, dialogs, the upload molecule, toasts. Mark `"use client"` at the smallest boundary |
| Server data fetching | Per page: fetch everything the page needs **in parallel** (`Promise.all` over independent use cases, e.g. list + filter options). No sequential awaits between independent calls |
| Request waterfalls | Avoid layout → page → component chains of dependent fetches. The session is resolved once per request (memoised per request) and passed to the use cases via the container |
| Streaming | `loading.tsx` per list / detail segment; `<Suspense>` around secondary panels (e.g. filter-option loads) so that the page shell streams first |
| Client cache | None by default (AD-02). URL-state + server rendering; revisit only with evidence (OD-27) |
| Caching | Per-user authenticated data is **not cached across users**. No `'use cache'` / Cache Components (AD-10). Only static reference data may be cached later (short TTL, per tenant / user scope) after measurement (OD-27) |
| Revalidation | Mutations: `revalidatePath(listPath)` / `refresh()` from the Server Action (read-your-own-writes). No time-based revalidation for CMS data |
| Prefetch | Next.js `<Link>` default prefetching for menu and list → detail links. Note that `proxy.ts` runs on prefetches, so it must stay cheap (optimistic cookie check only, as in the auth document) |

## 2. Bundle

| Topic | Strategy |
|---|---|
| Dynamic imports | `next/dynamic` for heavy, screen-specific widgets: the rich-text editor (OD-11), charts (recharts), carousel previews, the reactflow-based UI if kept (B0 template) |
| Dependency hygiene | The B0 dependency set includes three headless libraries (`radix-ui`, `@base-ui/react`, `react-aria`), `shadcn` as a runtime dependency, and `axios`. Consolidation is OD-13; moving `shadcn` to devDependencies and dropping axios from client code (AD transport) are implementation tasks with measurement |
| Server-only code | `server-only` markers keep the gateway client, session and config out of client bundles (and fix the B0 barrel that leaked server auth into the client graph) |
| Icons | `lucide-react` per-icon imports (tree-shaken) |
| Budget | Establish a baseline in A5 (`next build` output per route); set per-route JS budgets after the first feature |

## 3. Tables

| Topic | Strategy |
|---|---|
| Server-side paging | Always (legacy page sizes 5–15; allowed sizes ≤ 100 unless a feature needs more) |
| Rendering | TanStack Table in manual mode. There is no virtualization at these page sizes; revisit only if a feature needs large pages |
| Transitions | `useTransition` for URL-state changes. Keep previous rows visible to avoid layout thrash |
| Search | Debounced (≥ 300 ms) + request cancellation |
| Column definitions | Memoized per feature. Cell renderers are light (no per-cell data fetching) |

## 4. Images and uploads

| Topic | Strategy |
|---|---|
| Images from CDN / OSS (banners, products, previews) | `next/image` with `images.remotePatterns` for the approved hosts (configuration, OD-18), with sizes suited to thumbnails. Otherwise a plain `<img>` with explicit dimensions |
| Upload | Direct browser → storage PUT (no bytes through Next.js); progress reporting; parallel uploads limited per form (e.g. 3) |

## 5. Timeouts and resilience

The gateway timeout defaults (15 s read / 30 s mutation, API document §11) replace the legacy 240 s. They are tuned with runtime measurements.

## 6. Measurement plan (A5+)

1. `next build` route size report (baseline).
2. Web Vitals via `useReportWebVitals` (Next.js built-in) to the logger (OD-24).
3. Server timing per use case (logger duration fields).
4. Compare the first list page TTFB / LCP against the legacy baseline on the same test gateway (runtime dependency).
