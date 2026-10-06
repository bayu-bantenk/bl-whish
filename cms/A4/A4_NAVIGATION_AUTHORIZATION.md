# A4 — Navigation & Authorization

| Item | Value |
|---|---|
| Phase | A4 (architecture only) |
| Date | 2026-09-29 |
| Evidence | A1 §13 (menus, layout nav), A2 §13–15 (authorization model, permission matrix), A3.1 §6 (runtime route access), A3.2 §6 (menu visibility, `href="null"`); B0 (static `dashNav`, `validateSession` entity/access) |
| Related | `A4_TARGET_ARCHITECTURE.md` AD-09; `A4_AUTH_SESSION_ARCHITECTURE.md`; `A4_ROUTE_MIGRATION_MATRIX.md` |

## 0. Governing rule

```text
MENU VISIBILITY  ≠  AUTHORIZATION
```

- Hiding a menu item is a UX choice. It is **never** a security boundary.
- Every protected route, Server Action and Route Handler performs its own server-side authorization check.
- The **backend remains the final authority** (defense in depth).

Legacy evidence:
- Menus were chosen by hardcoded account email (3 sets).
- Every authenticated account could open every route (A3.1 §6).
- No row action was permission-controlled (A2 §13 #11).

The target must not repeat that ambiguity.

## 1. Navigation registry

A single typed registry (`src/shared/navigation/registry.ts`) is the source of menu, breadcrumb, route metadata and required capability. It replaces:
- the B0 static `dashNav` / `dashMobileNav` duplicates;
- the legacy `Extender.js` menu arrays;
- the scattered route constants.

```ts
// src/shared/navigation/types.ts (framework-free)
type Capability = string                      // e.g. 'banner.read', 'banner.write' (vocabulary: OD-05)
interface RouteMeta {
  id: string                                  // stable key, e.g. 'banner.list'
  path: string                                // '/dashboard/banner' (template for dynamic: '/dashboard/banner/update/[id]')
  title: string                               // Indonesian UI label (legacy label kept as evidence)
  group?: NavGroupId                          // 'transaksi' | 'produk-katalog' | 'interaksi-pelanggan' | 'pengaturan' | 'bantuan'
  icon?: IconKey                              // lucide icon key (no FontAwesome)
  parentId?: string                           // for breadcrumbs / nested routes
  visibleInMenu: boolean                      // menu visibility only
  requires: { authenticated: true; capabilities?: Capability[] }  // authorization requirement
  status: 'active' | 'review' | 'hidden'      // from A4_ROUTE_MIGRATION_MATRIX (REVIEW routes not exposed until decided)
}
interface NavGroup { id: NavGroupId; title: string; order: number }
```

| Concern | Rule |
|---|---|
| Menu | Built **server-side** in the `(dashboard)` layout: `registry.filter(r => r.visibleInMenu && policy.canAll(subject, r.requires))`, grouped by `group`. It is a flat, grouped structure (legacy had no nesting) |
| Groups (legacy evidence) | Beranda; TRANSAKSI (4); PRODUK & KATALOG (5); INTERAKSI PELANGGAN (9); PENGATURAN & KONFIGURASI (8); BANTUAN PENGGUNA (3) (A3.2 §6). Labels and grouping are kept unless the product decides otherwise |
| Active state | Longest-prefix match of the current path against the registry paths. Sub-pages (`/update/[id]`) highlight their parent (improves on the legacy exact-match only) |
| Nested routes | `parentId` chain (list → update / detail). Not rendered as submenus |
| Breadcrumb | Derived from the `parentId` chain + the current title (the detail title comes from the page data), rendered with `ui/breadcrumb` via the `PageHeader` organism |
| Mobile | The shadcn `Sidebar` offcanvas / sheet variant. **No placeholder items and no `href="null"`** (legacy defect, A3.2 §6) |
| Profile / account | The user menu shows name, role label and Logout (POST). The legacy "My profile" pointed to a non-existent handler: **no profile screen exists in scope** (A1 §15). Adding one is a product decision (OD-35) |
| Hidden route | `visibleInMenu: false` but still registered with `requires`. Reachable by URL only if authorized |
| Inaccessible route | `policy` denies → the menu omits it, and a direct URL renders the **AccessDenied** template (HTTP 403 semantics). It is not a 404 and not a silent redirect |
| Not found | Unknown path → `not-found.tsx`. Unknown detail id (gateway 404) → `notFound()` |
| REVIEW routes | Not registered as `active` until OD-07 / OD-08 / OD-09 are decided (not in the menu, not routable) |

## 2. Authorization architecture

```text
Subject (from session: user id, email, roleName, permissions? )
   ↓
AuthorizationPolicy (port, domain)      can(subject, capability) : boolean
   ↓ implemented by (one active, selected by config)
 P0 LegacyParityPolicy       – every authenticated subject allowed everything; menu by account type (legacy behavior)
 P1 AccountTypePolicy        – capabilities granted per account type (payment / marketing / superadmin) ⇒ menu sets become authorization
 P2 BackendPermissionPolicy  – capabilities from the gateway (permission list / validate-session), if the backend offers it
   ↓ enforced at
 (a) route guard: (dashboard) layout + page (Server Components) → AccessDenied
 (b) Server Actions / Route Handlers: before calling use cases → ActionResult Forbidden / 403 JSON
 (c) use cases: sensitive commands re-check (defense in depth)
 (d) UI: hide / disable actions the subject cannot perform (visibility only)
   ↓
 Backend / gateway: final authority (any 403 → AppError.Forbidden, never swallowed)
```

| Question | Answer |
|---|---|
| Which policy? | **OD-05 (product + backend decision)**. The architecture supports P0–P2 without changing call sites |
| Safe default for implementation start | **P1 is recommended.** The legacy product intent (payment / marketing see only their screens) becomes enforced, which is **stricter than legacy route access** and removes the A2-H01 exposure without requiring backend work. It must be confirmed by the product (it restricts what payment / marketing accounts can reach compared to legacy URL access) |
| How is account type identified? | Legacy uses two hardcoded emails. The target **must not hardcode account emails in source**. Options: map `roleName` (present in the legacy session payload) → account type, or a server-side configuration mapping. OD-06 |
| Row actions | Declared per feature with a required capability. Hidden when denied. Enforced again in the action (b) |
| Data-state conditions (e.g. Personalization delete only for non-ACTIVE; GPOS Brand edit only for certain statuses) | These are **business rules, not permissions**. They are implemented in the feature and validated by the backend |
| Capability vocabulary | `<feature>.<action>` (`read`, `create`, `update`, `delete`, `export`, plus feature-specific ones: `approve`, `cancel`, `publish`, `sync`). Final list: OD-05 |
| B0 template `validateSession({entity, access})` | No legacy counterpart (A2 §13 #15). Usable for P2 **only if** the backend supports it for these features (OD-05 / A2-U07) |

## 3. Permission metadata in the route matrix

- `A4_ROUTE_MIGRATION_MATRIX.md` records the legacy menu visibility per feature and `UNKNOWN — BACKEND CONTRACT` for backend authorization.
- The target capability per route is assigned when OD-05 is decided.
- Until then, route metadata carries `requires.authenticated = true` + the feature's proposed capability key.

## 4. Unauthorized vs unauthenticated vs not found

| Situation | HTTP semantics | Target UX |
|---|---|---|
| No / invalid session | 401 | Redirect to `/login?returnTo=` (pages); typed 401 → client navigates (actions / XHR) |
| Authenticated, not permitted | 403 | `AccessDenied` template (title, explanation, link to home). Actions return `Forbidden`, shown as a toast |
| Resource missing | 404 | `not-found.tsx` with a link back to the list |
| Route not in scope (REMOVE / REVIEW) | 404 | Same as not found |

Experimental `unauthorized()` / `forbidden()` are not used (AD-10). The equivalent behavior is implemented with templates + `notFound()` / `redirect()`.

## 5. Tests (see the test strategy)

- **Menu visibility per account type** (component + E2E).
- **Direct-URL access per account type**:
  - P1: denied routes render AccessDenied;
  - P0: all allowed.

  Both are asserted **separately** from menu visibility.
- **Server Action authorization:** a denied action returns `Forbidden` even when invoked without the UI.
- **Backend 403 propagation:** a 403 from the gateway surfaces as Forbidden, never as empty data.
