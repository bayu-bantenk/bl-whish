# A4 — Migration Decision Register

| Item | Value |
|---|---|
| Phase | A4 |
| Date | 2026-09-29 |
| Values | `KEEP` (preserve behavior / capability) · `REPLACE` (same capability, different implementation) · `IMPROVE` (capability kept, legacy defect fixed) · `REMOVE` (not carried over) · `DEFER` (decision postponed with a trigger) · `UNKNOWN` (cannot be decided on current evidence) |

Each entry has the fields DECISION / LEGACY EVIDENCE / TARGET DECISION / RATIONALE / MIGRATION IMPACT / TEST REQUIREMENT / DEPENDENCY.

---

### DR-01 Bootstrap
- **DECISION:** REMOVE
- **LEGACY EVIDENCE:** Argon / Bootstrap 4 CSS + JS, grid, utilities (A0 §7–8; A3.2 §1)
- **TARGET DECISION:** Tailwind CSS + shadcn/ui only; no Bootstrap classes, grid, JS or compatibility abstractions
- **RATIONALE:** Binding `TARGET_UI_FOUNDATION.md`
- **MIGRATION IMPACT:** Every screen is rebuilt with atoms, molecules and organisms. Bootstrap markup is evidence only
- **TEST REQUIREMENT:** CI grep / lint gate: no `bootstrap` imports or Bootstrap class names in `frontend/src`
- **DEPENDENCY:** None

### DR-02 jQuery (and jQuery plugins: select2, datepicker, toggle, Choices, loadingModal)
- **DECISION:** REMOVE
- **LEGACY EVIDENCE:** `layouts.edge` script stack; 83 views with inline scripts (A1 §9–10)
- **TARGET DECISION:** React components; interactions via shadcn / molecules
- **RATIONALE:** Binding; no DOM manipulation outside React
- **MIGRATION IMPACT:** Each inline-JS behavior in A1 §9 is re-specified as component behavior
- **TEST REQUIREMENT:** Component tests per behavior; grep gate for `jquery` / `$(`
- **DEPENDENCY:** None

### DR-03 jQuery DataTables
- **DECISION:** REPLACE
- **LEGACY EVIDENCE:** `$.fn.buildtable` in 32 views; server-side DataTables protocol (A2 §9, A3.1 §7)
- **TARGET DECISION:** `organisms/data-table` (TanStack Table under shadcn Table) with the contract in `A4_TARGET_ARCHITECTURE.md` §10
- **RATIONALE:** Binding; the capability is preserved and the implementation is not
- **MIGRATION IMPACT:** Mapper-built HTML cells → feature column definitions; the DataTables request protocol → `TableQuery` in the URL
- **TEST REQUIREMENT:** DataTable state tests (loading / empty / error / success), URL codec, E2E list journeys
- **DEPENDENCY:** None (TanStack Table already a direct dependency)

### DR-04 API topology (BFF)
- **DECISION:** KEEP (legacy BFF boundary); REPLACE the B0 browser-direct pattern
- **LEGACY EVIDENCE:** The browser talks only to Adonis; tokens server-side (A2 §5, A3.1 Q1–Q4). B0: API host and Kong key inlined into the bundle, bearer token in the browser
- **TARGET DECISION:** AD-01 server-side BFF
- **RATIONALE:** Security (no token / key exposure); parity with the proven legacy boundary
- **MIGRATION IMPACT:** B0 usecases / repositories move server-side; `next.config env` inlining removed
- **TEST REQUIREMENT:** Bundle inspection: no gateway host / key strings in client chunks; no `Authorization` from the browser
- **DEPENDENCY:** OD-01 (owner veto only with a backend constraint), OD-02, OD-03

### DR-05 Authentication
- **DECISION:** IMPROVE
- **LEGACY EVIDENCE:** Form login; prefilled credentials; silent invalid-login; the whole form body forwarded (A2 §2, A3.1 §3)
- **TARGET DECISION:** Server Action login with explicit fields, specific errors, no prefill (auth contract AC-08…AC-11)
- **RATIONALE:** Fix defects; preserve the capability
- **MIGRATION IMPACT:** New login screen (`(auth)/login`)
- **TEST REQUIREMENT:** Auth integration + E2E (§3 of the test strategy)
- **DEPENDENCY:** OD-04 (payload fields)

### DR-06 Session
- **DECISION:** REPLACE (mechanism) / KEEP (server-held tokens)
- **LEGACY EVIDENCE:** Adonis file session; `expires_at` string compare, fail-open (A3.1 §5)
- **TARGET DECISION:** Server-held session, httpOnly / Secure / SameSite=Lax cookie, fail-closed expiry (AC-01…AC-05). Mechanism: OD-15 / OD-16
- **RATIONALE:** Contract first; mechanism decided by spike criteria
- **MIGRATION IMPACT:** Replace the B0 better-auth integration pattern
- **TEST REQUIREMENT:** Expiry parse matrix; cookie flags; tamper test
- **DEPENDENCY:** OD-04, OD-15, OD-16

### DR-07 Refresh token
- **DECISION:** IMPROVE (new capability)
- **LEGACY EVIDENCE:** Not implemented (A2 §4, A3.1 §5); B0 `refreshToken()` unused
- **TARGET DECISION:** Single-flight refresh, retry exactly once, clear + login on failure (auth §2.4)
- **RATIONALE:** Target requirement (A4 brief §10)
- **MIGRATION IMPACT:** Session layer + transport
- **TEST REQUIREMENT:** Concurrency test (exactly one refresh), retry-once, failure → logout
- **DEPENDENCY:** **OD-04 (backend must provide a refresh endpoint).** Without it: expiry → login

### DR-08 Authorization
- **DECISION:** IMPROVE
- **LEGACY EVIDENCE:** Menu by hardcoded email; all routes reachable by every account (A2 §13, A3.1 §6)
- **TARGET DECISION:** Server-side policy port enforced at route / action / use case; menu visibility separate (navigation document)
- **RATIONALE:** Menu ≠ authorization
- **MIGRATION IMPACT:** Capability metadata per route / action
- **TEST REQUIREMENT:** Direct-URL denial tests separate from menu tests
- **DEPENDENCY:** OD-05 (policy P0 / P1 / P2), OD-06 (account-type identification)

### DR-09 Navigation
- **DECISION:** REPLACE
- **LEGACY EVIDENCE:** `Extender.js` 3 hardcoded menus; exact-match active; `href="null"` mobile links (A3.2 §6)
- **TARGET DECISION:** Typed navigation registry → server-built menu, breadcrumbs, route metadata
- **RATIONALE:** Single source of truth
- **MIGRATION IMPACT:** B0 `dashNav` replaced
- **TEST REQUIREMENT:** Menu per account type; link crawl (no invalid hrefs)
- **DEPENDENCY:** OD-05, OD-06, OD-07

### DR-10 Forms
- **DECISION:** REPLACE
- **LEGACY EVIDENCE:** Edge `form_*` components, POST + flash + `old()` (A1 §11)
- **TARGET DECISION:** RHF + zod + shadcn Form; Server Actions returning `ActionResult`
- **RATIONALE:** Typed, testable, consistent
- **MIGRATION IMPACT:** 40 form groups re-specified per feature
- **TEST REQUIREMENT:** Component + integration per form
- **DEPENDENCY:** OD-14 (declare zod as a direct dependency)

### DR-11 Validation
- **DECISION:** IMPROVE
- **LEGACY EVIDENCE:** 47 validators; 4 inconsistent display patterns; messages hidden; input lost (A3.1 §9)
- **TARGET DECISION:** Legacy rules and messages ported to zod; errors always shown; input preserved; server re-validation
- **RATIONALE:** Fix defects; keep business rules
- **MIGRATION IMPACT:** Per-feature schema work
- **TEST REQUIREMENT:** Schema unit tests from the A1 §17 rules
- **DEPENDENCY:** Backend field-error format (OD-31)

### DR-12 Table (static tables)
- **DECISION:** REPLACE
- **LEGACY EVIDENCE:** Bootstrap tables (order items, stock list)
- **TARGET DECISION:** `ui/table`
- **RATIONALE:** Binding
- **MIGRATION IMPACT:** Minor
- **TEST REQUIREMENT:** Component
- **DEPENDENCY:** None

### DR-13 Modal
- **DECISION:** REPLACE (+ REMOVE native dialogs)
- **LEGACY EVIDENCE:** Bootstrap modals (55); native `alert()` / `confirm()` (A3.2 §9)
- **TARGET DECISION:** `ui/alert-dialog` / `ui/dialog` / `ui/sheet`; no native dialogs except `beforeunload`
- **RATIONALE:** Accessibility, consistency
- **MIGRATION IMPACT:** Every confirmation re-specified
- **TEST REQUIREMENT:** Dialog a11y; E2E asserts no native dialog
- **DEPENDENCY:** None

### DR-14 Toast
- **DECISION:** REPLACE
- **LEGACY EVIDENCE:** Toastify + toastr (CDN) (A3.2 §10)
- **TARGET DECISION:** Sonner (`ui/sonner`)
- **RATIONALE:** Binding (shadcn Toast deprecated → Sonner)
- **MIGRATION IMPACT:** Feedback derived from `ActionResult`
- **TEST REQUIREMENT:** Component; E2E feedback assertions
- **DEPENDENCY:** None

### DR-15 Alert (flash)
- **DECISION:** IMPROVE
- **LEGACY EVIDENCE:** Auto-fading flash alerts; wrong / invisible keys; inverted messages (A1-F01 / F02)
- **TARGET DECISION:** `ui/alert` for persistent form / page errors; toasts for transient success. No flash keys
- **RATIONALE:** Fix invisible and inverted feedback
- **MIGRATION IMPACT:** None beyond forms
- **TEST REQUIREMENT:** Bulk-delete feedback test (succeeded / failed counts)
- **DEPENDENCY:** None

### DR-16 Upload
- **DECISION:** KEEP (signed-URL direct upload) + IMPROVE (policy, progress, errors)
- **LEGACY EVIDENCE:** Sign → browser PUT; client-only size check; ratio non-blocking; console-only errors; Principal local disk (A2 §10, A3.1 §11, A3.2 §11)
- **TARGET DECISION:** API document §9 contract
- **RATIONALE:** Keep the efficient boundary; fix validation gaps
- **MIGRATION IMPACT:** Upload molecule + BFF sign handler
- **TEST REQUIREMENT:** Sign-handler policy tests; E2E upload
- **DEPENDENCY:** OD-18 (storage constraints, Principal image), OD-34 (CSV limits)

### DR-17 Loading
- **DECISION:** IMPROVE
- **LEGACY EVIDENCE:** Only the DataTables "Processing…" box; nothing for pages / actions (A3.2 §14)
- **TARGET DECISION:** Skeletons (first load), pending indicators (transitions / actions), spinners on submit
- **RATIONALE:** Consistent states
- **MIGRATION IMPACT:** Templates include loading boundaries
- **TEST REQUIREMENT:** Component states; visual
- **DEPENDENCY:** None

### DR-18 Empty
- **DECISION:** IMPROVE
- **LEGACY EVIDENCE:** "No data available in table", identical to the error state (A3.2 §13)
- **TARGET DECISION:** `ui/empty` with no-data vs no-results variants
- **RATIONALE:** ERROR ≠ EMPTY
- **MIGRATION IMPACT:** DataTable organism
- **TEST REQUIREMENT:** DataTable state tests
- **DEPENDENCY:** None

### DR-19 Error
- **DECISION:** IMPROVE
- **LEGACY EVIDENCE:** Silent empty; stuck processing; timeout = 404; native alerts (A3.1 §7–8, A3.2 §20)
- **TARGET DECISION:** `AppError` taxonomy; inline error + retry; segment error boundaries; AccessDenied; not-found
- **RATIONALE:** Explicit, actionable errors
- **MIGRATION IMPACT:** Transport + organisms + templates
- **TEST REQUIREMENT:** Each `AppError` kind rendered distinctly
- **DEPENDENCY:** None

### DR-20 Responsive
- **DECISION:** IMPROVE / DEFER (mobile table layout)
- **LEGACY EVIDENCE:** Desktop-first; mobile horizontal overflow; the table scrolls inside its card (A3.2 §17)
- **TARGET DECISION:** Desktop-first parity; no page-level overflow; the table scrolls in its container; the sidebar becomes a sheet on mobile. Card view for tables: DEFER (OD-30)
- **RATIONALE:** Preserve intent; fix overflow
- **MIGRATION IMPACT:** Templates
- **TEST REQUIREMENT:** Responsive checks at 1440 / 1024 / 390
- **DEPENDENCY:** OD-14 (Playwright for automated checks)

### DR-21 Rich text
- **DECISION:** DEFER (NEW DEPENDENCY: approval required)
- **LEGACY EVIDENCE:** Quill HTML editors (Banner, Loyalty) (A1 §11.2)
- **TARGET DECISION:** `RICH_TEXT_EDITOR_DECISION` in the form document §9; no install in A4
- **RATIONALE:** No shadcn equivalent; HTML-compatibility evidence needed
- **MIGRATION IMPACT:** Blocks the Banner and Loyalty content fields only
- **TEST REQUIREMENT:** Round-trip fidelity with stored HTML; sanitization
- **DEPENDENCY:** OD-11

### DR-22 Data fetching / client cache
- **DECISION:** REPLACE (client `useEffect` → server-first); DEFER (client cache library)
- **LEGACY EVIDENCE:** B0 client fetching; the legacy server-rendered shell + AJAX
- **TARGET DECISION:** AD-02 / AD-03
- **RATIONALE:** Fewer waterfalls, no token exposure, no new dependency
- **MIGRATION IMPACT:** Feature page structure
- **TEST REQUIREMENT:** Integration tests of use cases; E2E
- **DEPENDENCY:** OD-27

### DR-23 Logging / observability
- **DECISION:** IMPROVE
- **LEGACY EVIDENCE:** Tokens, sessions and passwords logged (A2-C01 / C02, A3.1 §13)
- **TARGET DECISION:** Redacting structured logger (security document §9)
- **RATIONALE:** Critical legacy finding
- **MIGRATION IMPACT:** Infrastructure module
- **TEST REQUIREMENT:** Unit: the redaction of known sensitive keys
- **DEPENDENCY:** OD-24 (service)

### DR-24 CSRF / method override
- **DECISION:** IMPROVE
- **LEGACY EVIDENCE:** PATCH and `?_method=PATCH` bypass; state-changing GETs (A3.1 §10)
- **TARGET DECISION:** Server Actions (built-in) + Route Handler checks; no method override; no mutating GET
- **RATIONALE:** A3-S01
- **MIGRATION IMPACT:** Route Handler conventions
- **TEST REQUIREMENT:** Security integration tests
- **DEPENDENCY:** None

### DR-25 Headless UI library consolidation
- **DECISION:** DEFER
- **LEGACY EVIDENCE:** n/a (target: `radix-ui` in 33 atoms, `@base-ui` only in `ui/combobox`, `react-aria` only in `datetime-picker`)
- **TARGET DECISION:** New work uses the shadcn default (Radix). Consolidation evaluated when those components are touched
- **RATIONALE:** No evidence of harm yet; avoid churn
- **MIGRATION IMPACT:** None now
- **TEST REQUIREMENT:** a11y tests on combobox / date picker
- **DEPENDENCY:** OD-13

### DR-26 Design tokens
- **DECISION:** KEEP neutral tokens (existing shadcn neutral theme); DEFER brand tokens
- **LEGACY EVIDENCE:** Orange→blue gradient, GPOS logo, Argon palette (A3.2 §1)
- **TARGET DECISION:** `globals.css` CSS variables; the brand mapping is a product / design decision
- **RATIONALE:** Legacy look is evidence, not a requirement
- **MIGRATION IMPACT:** Visual baselines captured after the decision
- **TEST REQUIREMENT:** Visual regression after the decision
- **DEPENDENCY:** OD-12

### DR-27 Dependency approval policy
- **DECISION:** KEEP (no new dependency without approval)
- **LEGACY EVIDENCE:** B0 rule
- **TARGET DECISION:** Every dependency need is registered (OD-11, OD-14, OD-15)
- **RATIONALE:** Supply-chain control
- **MIGRATION IMPACT:** Some capabilities wait for approval
- **TEST REQUIREMENT:** n/a
- **DEPENDENCY:** Owner

### DR-28 B0 template packages (user, role, permission-set, api-key, attribute, audit-log, workflow, dashboard)
- **DECISION:** UNKNOWN
- **LEGACY EVIDENCE:** Not in the GPOS legacy scope (A0 / A1)
- **TARGET DECISION:** Owner decides keep / remove; `/dashboard/user` vs `user-management` overlap
- **RATIONALE:** Out of legacy evidence
- **MIGRATION IMPACT:** Navigation registry, routes
- **TEST REQUIREMENT:** n/a
- **DEPENDENCY:** OD-17
