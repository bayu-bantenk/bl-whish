# A4 — Test Strategy

| Item | Value |
|---|---|
| Phase | A4 (architecture only) |
| Date | 2026-09-29 |
| Current state (B0) | Vitest 4 + jsdom + Testing Library (1 test file, likely failing on an expectation mismatch); no E2E, visual or accessibility tooling; pre-commit hook broken (`next lint` removed in Next.js 16); CI (Jenkins) has no test stage |
| Evidence | A3.1 harness (legacy app + local mock gateway; `/tmp/a31`), A3.2 screenshots (56, `screenshots/a3.2/`) |
| Rule | Every test asserts **target behavior**. Legacy defects are never encoded as expected behavior (§6) |

## 1. Layers and tooling

| Layer | Scope | Tooling | Dependency status |
|---|---|---|---|
| Unit | Domain schemas (zod), mappers (DTO ↔ domain), URL codec (`TableQuery`), error mapping (`AppError`), policy evaluation, `returnTo` validation, expiry parsing | Vitest | Present |
| Component | Atoms / molecules / organisms (DataTable states, FilterBar, Upload, ConfirmDialog, forms) | Vitest + Testing Library + jsdom | Present (`@testing-library/dom` and `react`; `user-event` absent, so interactions use `fireEvent` or an approved add, OD-14) |
| Integration | Use case ↔ repository ↔ gateway client against a **local mock gateway** (a Node `http` server like the A3.1 harness; no new dependency). Server Actions invoked directly | Vitest (node environment) | Present |
| API contract | Repository DTO schemas validated against recorded, **sanitized** gateway responses (fixtures) once a test gateway is available | Vitest + fixtures | Present; **runtime dependency** (test gateway, OD-36) |
| Auth / session | Session cookie integrity, expiry fail-closed, single-flight refresh under concurrency, retry-exactly-once, logout, `returnTo` | Vitest integration (mock gateway with controllable 401 / refresh) | Present |
| E2E | Critical user journeys in a real browser | **Playwright** | **ABSENT → NEW DEPENDENCY (OD-14)** |
| Visual regression | Key screens vs approved target baselines (A3.2 as reference for intent only) | Playwright screenshots | **NEW DEPENDENCY (OD-14)** |
| Accessibility | Automated axe checks on key screens + keyboard-path E2E | `axe-core` (present **transitively** 4.11.2; direct declaration and a Playwright integration need approval, OD-14) | Approval needed |
| Responsive | Desktop 1440, tablet 1024, mobile 390 (A3.2 viewports) for shell, list, form | Playwright viewports | NEW DEPENDENCY (OD-14) |

**If OD-14 is not approved:** E2E, visual and responsive checks fall back to a documented manual checklist executed with the A3.2 CDP harness approach (headless Chrome via the DevTools Protocol, no installed framework). This is weaker and non-gating.

## 2. Test data and environments

| Environment | Use |
|---|---|
| Local mock gateway | Unit, integration, auth tests: deterministic, synthetic data, switchable failures (as in A3.1) |
| Test gateway + test accounts (superadmin / payment / marketing equivalents) | Contract tests, E2E, visual baselines with realistic data (runtime dependency, OD-36) |
| Never | Production gateway or production accounts; the legacy prefilled credentials |

## 3. Legacy behavior → target behavior → test (critical paths)

| Path | Legacy behavior (evidence) | Target behavior | Tests |
|---|---|---|---|
| Login success | POST `/login` → session → `/home` (A3.1 §3) | Server Action → session cookie → redirect to `returnTo` or home | Integration (action + mock gateway); E2E |
| Login failure | Invalid credentials / gateway down → **no message** (A3.1 §3) | Specific messages (invalid credentials vs connection problem) | Integration: 401 → message; timeout → message; E2E |
| Login validation | "Email is required" alert (A3.2 §4) | Field errors under the inputs | Component |
| Prefilled credentials | Present (A2-H02) | Absent | E2E / DOM assertion: inputs empty on load |
| Refresh token | Not implemented | Expired access token → single-flight refresh → retry once. Refresh fail → clear session + login | Auth integration: N concurrent requests trigger **exactly one** refresh call; each original request retried ≤ 1; second 401 → logout. Rotation persisted (if applicable) |
| Session expiry | Page → login; XHR → 302 → HTML → native alert + stale rows (A3.2 §15) | Page → login with a message; action / XHR → typed 401 → navigate to login; no stale data, no native dialogs | Integration (Route Handler returns 401 JSON, never HTML); E2E (expire → action → login page, no dialog) |
| Expiry parsing | `null` / garbage `expires_at` → never expires (A3-S02) | Invalid expiry → invalid session | Unit (parse matrix: ISO+Z, local string, epoch s, epoch ms, null, garbage) |
| Logout | GET, no CSRF (A2-M01) | POST action; gateway logout best-effort; cookie cleared | Integration; E2E; security (GET logout → 405) |
| Permission | Menu by email; all routes reachable (A3.1 §6) | Menu from registry + policy; direct URL denied per policy (P1 / P2); actions guarded | Component (menu per account type); Integration (action Forbidden); E2E (direct URL → AccessDenied), **asserted separately from menu visibility** |
| Navigation | Exact-match active state; `href="null"` on mobile (A3.2 §6) | Prefix-match active; no invalid hrefs | Component; E2E link crawl (no `null` / `#` hrefs) |
| CRUD | Form POST → redirect + flash (A1 §18) | Server Action → `ActionResult` → toast + navigation | Integration per feature; E2E per feature (create / edit / delete happy path) |
| Search | DataTables search box → `keyword` (A3.1 §7) | Debounced `?q=` → server query | Unit (codec); Integration (repository mapping); E2E |
| Filter | Column search / ajaxData (A3.1 §7) | FilterBar → URL → query; ineffective filters not shown | Integration: each declared filter reaches the gateway param |
| Sort | `order[0]` → `sort_by` / `asc_desc` | Header sort → `?sort=` | Unit + Integration |
| Pagination | `start/length` → `page/take` (A3.1 §7) | `?page` / `per_page` → `page` / `take` | Unit (off-by-one) + Integration |
| Bulk action | Inverted feedback (A3.2 §20) | Confirm → action → succeeded / failed counts; selection handling | Component + Integration (partial failure) + E2E |
| Upload | Sign → PUT; errors console-only; ratio non-blocking; no server type check (A3.1 §11, A3.2 §11) | Policy enforced client + server; progress; retry / remove; errors visible | Component; Integration (sign handler rejects bad type / size); E2E with a test file |
| Validation | 4 inconsistent patterns; input lost (A3.1 §9) | Field + form-level errors always shown; input preserved | Component per form; Integration (server validation → fieldErrors) |
| Error handling | Gateway error = empty table; stuck "Processing…"; timeout = 404 (A3.1 §7–8, A3.2 §20) | ERROR ≠ EMPTY; retry; timeout distinct | Component (DataTable renders error vs empty); Integration (each `AppError` kind); E2E (gateway 500 → error panel + retry) |
| CSRF | PATCH / `?_method=PATCH` bypass; state-changing GET (A3.1 §10) | Route Handlers enforce method / Origin / JSON; no method override | Security integration tests: cross-origin POST rejected; `_method` ignored; GET mutation → 405 |

## 4. Accessibility and responsive criteria

- **Automated:** axe rules at "serious / critical" with zero violations on the shell, list, form, dialog and login screens.
- **Keyboard paths:**
  - login;
  - menu navigation;
  - table sort / paginate / select / bulk action;
  - form fill + submit + error focus;
  - dialogs (focus trap and return).
- **Responsive:** no page-level horizontal overflow at 390 px (legacy defect); the table scrolls inside its container; the sidebar becomes a sheet.

## 5. Visual regression policy

- A3.2 screenshots are **reference for intent** (information hierarchy, states present). They are not pixel baselines, because the target uses Tailwind / shadcn and does not reproduce Bootstrap.
- Target baselines are captured after design approval of each template (OD-12 tokens) and stored per viewport.
- **Never** baseline a legacy defect (e.g. an error state that looks empty).

## 6. Legacy defect guard

Each defect in `A4_MIGRATION_CONTRACT.md` §"Legacy defect disposition" marked REMOVE / IMPROVE has at least one test asserting the **improved** behavior (for example: "gateway 500 on a list renders an error panel with Retry and never 'No data'").

## 7. Quality gates (prerequisites before feature implementation)

1. Fix the husky pre-commit hook: replace `npm run validate` (`next lint` + `prettier --write src`) with a non-mutating lint / type / test check.
2. Fix or replace the failing login test.
3. Add a CI stage running `tsc --noEmit`, `eslint`, `vitest run` (the Jenkins pipeline currently has none; OD-25).
4. E2E / a11y gate after OD-14 approval.
