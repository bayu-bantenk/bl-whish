```text
A5.2 STATUS: GO-WITH-RISKS
```

Every exit criterion passes. It's WITH-RISKS because:
- The access policy is still "every signed-in user may see everything" (OD-05/06 undecided).
- Only the Home page exists, so hidden-but-routable pages and the 403 page are proven with test fixtures, not a real feature route.
- An automated accessibility scanner (axe) would need a new dependency, which needs your approval.

None of these blocks the next phase. Nothing is committed yet.

**Changed**
- **Layout:** `app/(dashboard)/layout.tsx` now owns the whole shell. It reads the session once and builds the navigation view on the server. It renders `DashboardShell` (skip link, Navigator, Header, one `<main>`) exactly once.
- **Navigator:** new `components/organisms/navigator/`, built on the shadcn `Sidebar`. On desktop it's a sidebar; below 768 px it's a Sheet.
- **Header:** rebuilt as a server component with three small client pieces: the menu trigger (`aria-expanded`, returns focus on close), the breadcrumb, and the user menu (logout via the A5.1 Server Action).
- **Navigation core:** in `src/shared/navigation/` — types, the single registry, path matching, breadcrumb/active-state logic, and the server-built navigation view.
- **Authorization:** `src/shared/authorization/` holds the policy interface, with "legacy parity" active. Every page is guarded server-side through `app/(dashboard)/_shell/route-guard.tsx`:
  - not signed in → `/login`
  - not registered or not built → 404
  - not permitted → 403 "Akses ditolak"
- **New pages:** a dashboard `not-found` and `error` page, `/dashboard` → Home, and a catch-all that returns the 404 inside the shell.
- **Home page:** content only; it no longer renders its own Header or sidebar wrapper.
- **shadcn atom:** `SidebarInset` now renders a `<div>` instead of `<main>`, so the page has a proper header landmark and a single `<main>`.
- **Removed:** the old template, `organisms/navigation/*` and `shared/utils/menus.ts`. They held a duplicate menu, a second user menu and placeholder links.

**Architecture**
- **One registry** (`shared/navigation/registry.ts`) feeds the menu, breadcrumbs, active state, the page guard and the static checks. Groups come from the legacy menu. The representative entries are:

  | Entry | Status |
  |---|---|
  | Home | built |
  | Payment (+ detail) | planned |
  | Banner (+ create/update) | planned |
  | Content | planned |

  Planned entries are never shown and return 404 until their page exists.
- **Active-state matching:**
  - Query strings and trailing slashes are ignored.
  - Matching is whole-segment, so `/foo` never matches `/foobar`.
  - A fixed part of the path wins over a variable one, and the longest match wins.
  - A child page highlights its parent menu item.
- **Breadcrumbs** follow the parent chain in the registry. Ancestors on dynamic routes keep working links. An unknown path ends in "Halaman tidak ditemukan".
- **Access is checked per page, not in the layout.** Layouts don't re-render when moving between sibling pages, so a layout check would go stale. A static test fails if any dashboard page skips the guard.
- **Browser data:** only a filtered view of permitted routes reaches the browser — ids, paths, titles, parents. Capabilities and denied routes stay on the server.

**Tests**

| Check | Result |
|---|---|
| typecheck | exit 0 |
| `npx eslint .` | 0 errors, 27 warnings (existing kinds) |
| `npx vitest run` | 218/218 pass, 16 files (was 150) |
| `npm run quality` | exit 0 |
| `next build` | exit 0 |
| client bundle check | PASS |

The new suites cover matching, breadcrumbs, registry integrity, the navigation view, route access, the page guard, the shell (rendered once, redirect to login, mobile/tablet/desktop, keyboard) and the static shell/boundary rules.

In a real browser (headless Chrome against `next start`):
- At 1280, 1024, 768, 375 and 320 px there is one header, one main and one menu, with no horizontal overflow.
- The mobile Sheet opens with Enter, keeps focus inside, closes with Escape, and returns focus to the trigger.
- Every Tab stop shows a focus indicator.
- `/dashboard/nope` and `/dashboard/banner` show the 404 inside the shell.

**Fixes found by the browser run**
- The skip link had no visible focus ring.
- A hidden tooltip on menu links swallowed the first Escape inside the mobile Sheet. Tooltips are removed; they only matter in icon-collapse mode, which this shell doesn't use.
- Focus dropped to the page body when the Sheet closed.
- The header separator was misaligned.

The three accessibility bugs now have regression tests.

**Security**
- `authClient`, localStorage and sessionStorage: 0 uses in `src`. The only `document.cookie` is the sidebar's open/closed preference cookie, which has nothing to do with auth.
- In the browser, storage is empty and no cookie is visible to JavaScript. The only cookie is the httpOnly session cookie.
- The page HTML and RSC payload contain no tokens, API key or gateway URL, and the server log has no credentials.
- No new dependencies; no Bootstrap, jQuery, TanStack Query or SWR.

**Shell duplication audit**
- **Canonical:** the dashboard layout, `templates/dashboard-shell.tsx`, `organisms/navigator/navigator.tsx`.
- **Feature content:** `dashboard/presentation/home.tsx`, whose duplicate shell is removed.
- **Duplicates removed:** the old template, `organisms/navigation/*` and `menus.ts`.
- **Remaining duplicates or exceptions:** none.

**Risks**
- **RK-A52-01:** everyone currently gets the same menu; the legacy payment/marketing menus need OD-05/06.
- **RK-A52-02:** 403 and hidden-route behaviour are proven only with fixtures.
- **RK-A52-03:** the Sheet's accessible name and description come from shadcn in English ("Sidebar").
- **RK-A52-04/05:** there is no axe scan, and the browser harness lives in `/tmp`, outside CI.
- **RK-A52-06:** access depends on each page calling `guardRoute`; the static test enforces it.
- **RK-A52-07:** breadcrumb labels for dynamic pages are generic ("Ubah Banner").
- **RK-A52-08:** the Navigator comes before the Header in Tab order.
- **RK-A52-09:** `SidebarInset` now differs from upstream shadcn and must be re-applied after a shadcn update.
- The A5.1 risks carry over unchanged.

**Deferred**
- **A5.3+:** DataTable, Form and Upload foundations; the real access policy and a Forbidden result for Server Actions; an E2E runner with axe; breadcrumb labels from page data; theme toggle.
- **Feature phases:** register each of the 259 MIGRATE routes and mark it built when its page exists; keep the 49 REVIEW routes unregistered until OD-07/08/09; replace the placeholder Home content with the legacy widgets.
- **Backend:** as in A5.1 (OD-02/03/04/25/36), plus backend-driven permissions if a permission API exists.

**Report:** `docs/architecture/reviews/A5.2_DASHBOARD_SHELL_NAVIGATION.md`. Screenshots are in `docs/architecture/reviews/a5.2/`.
