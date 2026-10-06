# A4 — Migration Contract

| Item | Value |
|---|---|
| Phase | A4: Target Architecture & Migration Contract |
| Date | 2026-09-29 |
| Status | **Normative** for every implementation phase after A4 |
| Binding inputs | `TARGET_UI_FOUNDATION.md`; A4 architecture set (`A4_*.md`) |
| Evidence inputs | A0 `FRONTEND_SCOPE.md`, A1 `ROUTE_SCREEN_MAP.md`, A2 `AUTH_API_PERMISSION_MAP.md`, A3.1 `RUNTIME_BEHAVIOR_AUDIT.md`, A3.2 `VISUAL_BASELINE.md` |

This contract states what the migrated Next.js frontend **must preserve**, what **may change**, what **must not be copied**, what is **explicitly improved**, and what depends on decisions, the backend or runtime evidence. **Legacy defects are never requirements** (§9).

---

## 1. MUST PRESERVE

| # | Item | Evidence |
|---|---|---|
| P-01 | **Capability inventory** of every MIGRATE route (259 of 427 route entries, `A4_ROUTE_MIGRATION_MATRIX.md`) across the 32 legacy feature areas (A1 §23): list / search / filter / sort / paginate, create / edit / detail, delete / bulk delete where working, toggles / inline sequence edits, approve / reject / cancel / finalise / sync / trigger, wizards (draft / publish), uploads, CSV import / template download | A1 §6, §23 |
| P-02 | **Business rules** encoded in legacy validators and manual checks (A1 §17), including cross-field rules (e.g. Referral `points_earned` required when ACTIVE; Sponsored `product_category_id` required when CATEGORY; Notification relation required; Group Story date rules) | A1 §17 |
| P-03 | **Data-state business rules** in the UI: Personalization delete only when not ACTIVE; GPOS Brand edit / cancel / courier actions by order status; Payment "Trigger Receipt" only when bank = BCA and status ≠ PAID; Notification action visibility per status; Gamification field locking per phase; Voucher / Point active toggles | A1 §8, A1 G3–G5 |
| P-04 | **Domain vocabulary and labels** (Indonesian UI terms, status labels: Order Diproses / Selesai / Dikirim / Ditolak / Dikonfirmasi; Payment PAID / PENDING / CANCEL; APPLIED / UNAPPLIED; Draft / Aktif / Selesai / Tidak Aktif …) unless the product changes them (OD-20) | A1 §8, A3.2 |
| P-05 | **Gateway wire contracts** as consumed by the legacy client (paths, methods, field names such as `customer_ids`, `sort_by`, `take`, `total_rows`), kept in repositories until the backend changes them | A2 §6–9 |
| P-06 | **Information hierarchy** of screens: menu groups and labels, list → detail → edit flows, tabs within complex forms, review step before publish in wizards | A1 §13, A3.2 §6–12 |
| P-07 | **Signed-URL direct upload** boundary (file bytes never proxied through the frontend server) | A2 §10, A3.1 §11 |
| P-08 | **Server-held tokens** (the browser never holds gateway tokens) | A2 §18, A3.1 Q1 |
| P-09 | **Account-type menu content** (which features payment / marketing / superadmin accounts see) as **visibility** intent, subject to OD-05 / OD-06 | A3.1 §6, A3.2 §6 |
| P-10 | Login / logout as the only authentication entry and exit (no self-registration or password reset in scope; "Forgot password?" was a dead link) | A1 §15 |

## 2. MAY CHANGE

| # | Item | Constraint |
|---|---|---|
| C-01 | URLs (target `/dashboard/<feature>/…`) | Legacy URL redirects: OD-26 |
| C-02 | Visual design, spacing, colors, typography, icons (Tailwind / shadcn, lucide) | Tokens: OD-12 |
| C-03 | Default page sizes, page-size options, sort UI | Server-side semantics preserved |
| C-04 | Wizard mechanics (legacy POST-rendered summary pages → client multi-step with review) | Steps, draft / publish semantics preserved |
| C-05 | Feedback placement (toast vs inline), loading visuals, empty-state copy | Must satisfy §4 improvements |
| C-06 | Filter presentation (FilterBar vs legacy header-row selects / filter cards) | Only effective filters shown |
| C-07 | Save-button gating replaced by explicit validation errors | Validation rules preserved |
| C-08 | Component implementations (shadcn / TanStack) | Binding UI foundation |
| C-09 | Mobile layout details | No page-level overflow; table scroll container |

## 3. MUST NOT COPY

| # | Legacy implementation | Why |
|---|---|---|
| N-01 | **Bootstrap** (CSS, grid, utilities, JS, components) | Binding |
| N-02 | **jQuery** and plugins (select2, datepicker, bootstrap-toggle, Choices, loadingModal, jquery-validation) | Binding |
| N-03 | **jQuery DataTables** and its request protocol (`draw/start/length/columns[]`) | Binding; replaced by `TableQuery` |
| N-04 | **Server-rendered HTML assumptions**: Mapper-built HTML cells, `data-*` embedded records, `{{{ toJSON() }}}` script embedding, Edge flash / `old()` / `getErrorFor` mechanics | A1 §8, A2-M07 |
| N-05 | **Legacy DOM manipulation**: inline scripts, global jQuery handlers re-bound per draw, `eval` of data attributes, duplicate element ids | A1 §9–10 |
| N-06 | **Legacy session assumptions**: `expires_at` string comparison, fail-open expiry, email-based role selection hardcoded in code, sessions without refresh, auth checks only by redirect | A2 §3, A3.1 §5 |
| N-07 | **Legacy alert implementation**: native `alert()` / `confirm()`, auto-fading error alerts, flash keys (`notification` / `warning` / `Warning`), Toastify / toastr | A3.2 §9–10 |
| N-08 | **Error flattening** (timeout → 404; 401 / 403 → 400 or empty) | A2-H04, A3.1 §8 |
| N-09 | **Method override** (`_method`, `?_method=PATCH`) and **state-changing GET** routes | A3.1 §10 |
| N-10 | **Logging of tokens, sessions, passwords, bodies** | A2-C01 / C02 |
| N-11 | **Prefilled credentials** in forms | A2-H02 |
| N-12 | Forwarding raw form bodies to the gateway | A2-H06 |
| N-13 | Server-side fetch of arbitrary browser-supplied URLs | A2-M04 |
| N-14 | B0 anti-patterns: browser → gateway calls, secrets in `next.config env`, bearer token in client session, unsigned cookie decode, usecases constructing HTTP clients | B0 |

## 4. EXPLICITLY IMPROVED

| # | Improvement | Contract reference |
|---|---|---|
| I-01 | **ERROR ≠ EMPTY** everywhere (tables, detail, options) | Architecture §10.3; API §4 |
| I-02 | **Refresh token** single-flight + retry exactly once; clear + login on failure (subject to backend OD-04) | Auth §2.4 |
| I-03 | **Typed API contract** (`Result`, `AppError`, `Page<T>`, `TableQuery`, `ActionResult`) with runtime DTO validation | API §2–6 |
| I-04 | **Accessible UI** (keyboard, labels, `aria-sort`, focus management, live regions) | Architecture §10.3; test §4 |
| I-05 | **Consistent loading / empty / error states** across all screens | Architecture §9–10 |
| I-06 | **Server-side authorization** separate from menu visibility | Navigation §2 |
| I-07 | **Fail-closed session expiry** | Auth AC-04 |
| I-08 | **CSRF-safe mutations**; no method override; no mutating GET | Security §5 |
| I-09 | **Visible, specific feedback** (login errors, validation messages, bulk-action counts) | Form §4; API §6 |
| I-10 | **Upload validation** (client + BFF), progress, visible errors | API §9 |
| I-11 | **Redacted logging** | Security §9 |
| I-12 | **No secrets / tokens in the browser bundle** | Security §2 |

## 5. DEFERRED

| # | Item | Trigger / owner |
|---|---|---|
| D-01 | Rich-text editor (new dependency) | OD-11 approval |
| D-02 | Brand design tokens | OD-12 |
| D-03 | Headless-library consolidation | OD-13 |
| D-04 | Client cache library | OD-27 (only with evidence) |
| D-05 | Cross-page "select all matching" | OD-28 |
| D-06 | Column-visibility persistence | OD-29 |
| D-07 | Mobile card view for tables | OD-30 |
| D-08 | Legacy URL redirects | OD-26 |
| D-09 | Observability service (OpenTelemetry / Sentry) | OD-24 |
| D-10 | Profile screen | OD-35 |

## 6. BACKEND DEPENDENCY

| # | Item | OD |
|---|---|---|
| B-01 | Gateway identity: legacy `/api/v1/…` vs the B0 template gateway (`API_HOST`, `/auth/login`) | OD-02 |
| B-02 | API key (Kong `Api-Key`) requirement; CORS irrelevant under BFF | OD-03 |
| B-03 | Login payload fields, `expires_at` format, token lifetimes, **refresh endpoint**, rotation / reuse detection, side-effect-free 401 guarantee | OD-04 |
| B-04 | Permission data / validate-session for these features | OD-05 |
| B-05 | Storage-side upload constraints; Principal image as URL | OD-18 |
| B-06 | Filters dropped by the legacy BFF (Mutasi `mutation_type`, `no_invoice`; Loyalty `search`) supported? | OD-32 |
| B-07 | GET-with-body filters; numeric vs string `take`; field-error format for validation | OD-31 |
| B-08 | Identity headers (`X-Userid` / `X-UserId` / `X-RoleName`) required beyond Loyalty / UserVerification? | OD-33 |
| B-09 | CSV size / format limits; long-running import semantics | OD-34 |
| B-10 | Notification "final" semantics (legacy calls the cancel endpoint) | OD-37 |
| B-11 | Full export endpoint (if export must cover all rows) | OD-22 |

## 7. PRODUCT DECISION

| # | Item | OD |
|---|---|---|
| PD-01 | Authorization policy P0 / P1 / P2 and capability vocabulary | OD-05 |
| PD-02 | Special accounts (payment / marketing): identification and rights | OD-06 |
| PD-03 | Scope of hidden-nav screens (Inject Poin, Mutasi & Redeem, Voucher Setting, CCPH / Custom Criteria standalone, Gamification multi-period) | OD-07 |
| PD-04 | Static mockup screens (Poin Reguler / Payment / Folamil create) | OD-08 |
| PD-05 | Broken / unreachable destructive actions (Order delete / bulk delete / update; Order Review delete) | OD-09 |
| PD-06 | Dashboard content (legacy static placeholders) | OD-10 |
| PD-07 | B0 template packages keep / remove; `/dashboard/user` overlap | OD-17 |
| PD-08 | UI language / copy (Indonesian vs mixed English) | OD-20 |
| PD-09 | Timezone display policy | OD-21 |
| PD-10 | Export semantics (current page vs full) | OD-22 |

## 8. RUNTIME DEPENDENCY

| # | Item | Needs |
|---|---|---|
| R-01 | Real login payload keys and token sizes (session storage choice) | Test gateway + test account (OD-36) |
| R-02 | Real `expires_at` format | Same |
| R-03 | Backend authorization behavior per account type | Same + special test accounts |
| R-04 | Real data shapes for screens not rendered with mocks (FAQ create, edit pages, Gamification, Loyalty, Setting Point) | Same (A3.2 V-U01) |
| R-05 | Signed-URL headers / lifetime, final object URL | Test storage |
| R-06 | Existing rich-text HTML samples (editor fidelity) | Backend data samples |

## 9. UNKNOWN

| # | Item | Why unknown |
|---|---|---|
| U-01 | Whether any backend authorization exists for CMS features | Not observable from the legacy client (A2 §13, A3.1 §6) |
| U-02 | Whether the backend rotates refresh tokens with reuse detection (multi-instance refresh race) | No refresh in legacy |
| U-03 | Whether `public/images` / `uploads` / `downloads` legacy files are referenced by backend data | A2 U-26 |

## 10. Legacy defect disposition

| # | Legacy defect | Evidence | Disposition | Target behavior |
|---|---|---|---|---|
| LD-01 | Gateway error renders as an empty table | A3.1 §7; A3.2 `…gateway-error.png` | **IMPROVE** | Error panel + Retry (ERROR ≠ EMPTY) |
| LD-02 | Notification list stuck on "Processing…" after an error | A3.2 `…notification_error.png` | **REMOVE** | Every query settles to success / empty / error |
| LD-03 | Bulk-delete feedback inverted (Content, Order Review) | A1-F02; A3.2 `…inverted_bulk-delete_*` | **REMOVE** | Feedback from succeeded / failed counts |
| LD-04 | Invalid login / gateway down shows no feedback | A3.1 §3; A3.2 §4 | **IMPROVE** | Specific login errors |
| LD-05 | Mobile menu `href="null"` + placeholder items | A3.2 §6 | **REMOVE** | Registry-driven menu only |
| LD-06 | Horizontal page overflow on mobile | A3.2 §17 | **IMPROVE** | No page-level overflow |
| LD-07 | Stale DataTable + native DataTables alert after session expiry | A3.2 §15 | **IMPROVE** | Typed 401 → login; no stale data; no native dialog |
| LD-08 | Personalization delete after a gateway error → native `alert("Not Found")` | A3.2 §20 | **IMPROVE** | Error toast with the mapped message; rows unchanged |
| LD-09 | Validation messages hidden; input lost; four display patterns | A3.1 §9 | **IMPROVE** | Field + form errors always shown; input preserved |
| LD-10 | Flash key `Warning` never rendered; list pages ignore `warning` | A1-F01 | **REMOVE** | No flash keys; ActionResult feedback |
| LD-11 | Principal delete redirects to `/custom-catalog` | A1-F04 | **REMOVE** | Stay on the Principal list |
| LD-12 | Order delete / bulk delete broken | A1-F03 | **UNKNOWN** | Product decides whether the capability exists (OD-09) |
| LD-13 | Prefilled credentials on login | A2-H02 | **REMOVE** | Empty login form |
| LD-14 | Session expiry fail-open (null / invalid `expires_at`) | A3-S02 | **IMPROVE** | Fail-closed |
| LD-15 | Timeout / network reported as 404 | A2-H04 | **IMPROVE** | Distinct Timeout / Network errors |
| LD-16 | CSRF bypass via PATCH / `?_method=PATCH`; state-changing GET | A3-S01 | **REMOVE** | No method override; POST mutations |
| LD-17 | Tokens / session / password logged | A2-C01 / C02 | **REMOVE** | Redacted logging |
| LD-18 | UI filters ignored by the BFF (Mutasi `mutation_type`, `no_invoice`; Loyalty search) | A1-F11 | **UNKNOWN** | Implement only if the backend supports them (OD-32); otherwise do not show |
| LD-19 | Custom Catalog `sort_by` column offset; asc / desc fixed | A1 G2 | **REMOVE** | Correct sort mapping |
| LD-20 | Custom Criteria Edit link → CCPH edit; CCPH Back → Criteria list | A1 G2 | **REMOVE** | Correct navigation (if the screens are in scope, OD-07) |
| LD-21 | Dashboard static zeros / chart never drawn | A1 §14; A3.2 §5 | **UNKNOWN** | Product decides content (OD-10) |
| LD-22 | Browser export covers only the current page | A1-F08 | **UNKNOWN** | Product / backend decide (OD-22) |
| LD-23 | Upload ratio check non-blocking; upload errors console-only; no server-side type check | A2 §10; A3.1 §11 | **IMPROVE** | Blocking validation; visible errors; BFF policy |
| LD-24 | Missing views for the Product Gposb2b Homepage standalone pages | A1 §25 | **REMOVE** (standalone pages) | Capability kept in the Produk Gpos B2b tab |
| LD-25 | Routes to missing controller actions (97 resource + 3 explicit) | A1 §3 | **REMOVE** | Not routable |
| LD-26 | Raw `toJSON` script embedding | A2-M07; A3.1 §14 | **REMOVE** | RSC props |
| LD-27 | Native `alert()` / `confirm()` dialogs | A3.2 §9 | **REMOVE** | shadcn dialogs / toasts |
| LD-28 | Active menu only on exact path | A1 §13 | **IMPROVE** | Prefix match |
| LD-29 | Duplicate element ids (`titleCheckdel`, `hint-image`) | A3.2 §20 | **REMOVE** | Unique ids |
| LD-30 | Save disabled until complete, without a reason | A3.2 §8 | **IMPROVE** | Explicit validation errors |
| LD-31 | `/loyalty-member/create` shadowed by `/:id` | A1 §3 | **REMOVE** | Non-conflicting target routes |
| LD-32 | Notification "final" calls the cancel endpoint | A1 G4; A2 U14 | **UNKNOWN** | Backend confirms semantics (OD-37) |
| LD-33 | Payment list breaks when `receipts` is empty | A1 G1 | **IMPROVE** | Empty receipts render "-" |
| LD-34 | Label typos ("Ative"), mixed-language labels | A3.2 §8 | **IMPROVE** | Copy review (OD-20) |
| LD-35 | Referral "Dan / Atau" radio: both rendered `checked` | A1 G5 | **IMPROVE** | Explicit default, or required selection (product copy) |
| LD-36 | Content create loses input on validation failure (contradicts the A1 claim) | A3.1 §9 | **IMPROVE** | Input preserved |

No defect is marked PRESERVE.
