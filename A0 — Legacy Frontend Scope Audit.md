```text
PHASE: A5.1
STATUS: GO-WITH-RISKS
```

The auth/session/gateway boundary works in the real Next.js 16 runtime. Browser → Next server → gateway, with refresh when needed and exactly one retry, and no credentials reach the browser. The proof ran against a local mock gateway because no real test gateway exists yet (OD-36). The backend contract and deployment questions are still open, which is why this is GO-WITH-RISKS rather than GO. Nothing is committed yet.

One finding from the audit: the old code exported a Server Action, `getServerSession`, that any browser could call. It returned the decoded session cookie, gateway token included. That file and the rest of the better-auth setup are gone.

**AUTH**
- **login:**
  - The login Server Action takes only `email`, `password` and `loginBy`; extra form fields are dropped.
  - The gateway response is validated, and a malformed response is a Contract error that creates no session.
  - Wrong credentials show "Email atau password salah."
- **session:**
  - One encrypted, httpOnly, SameSite=Lax cookie (AES-256-GCM using Node's built-in crypto).
  - A tampered, forged or unreadable cookie is treated as invalid.
  - The dashboard layout checks the session on the server; the old client-side guards are removed.
- **logout:** a Server Action. The gateway call is best effort (5 s timeout), and the local session is always cleared, even when the gateway returns 502.

**GATEWAY**
- **server-only:** one gateway client in `src/shared/infrastructure/http/`, wired in one place (`src/shared/infrastructure/container/`). A test build that imported it from a client component failed as intended ("depends on server-only").
- **gateway target:** chosen by config (`API_HOST` plus `GATEWAY_AUTH_CONTRACT = b0 | legacy-v1`). No endpoint was guessed; this is OD-02.
- **API key:** `Api-Key` is sent only when `KONG_API_KEY` is set, and only from the server.
- **timeout:** reads 15 s, mutations 30 s, logout 5 s. A timeout is reported as Timeout, never as empty data.
- **error mapping:** the full A4 model (Unauthenticated, Forbidden, NotFound, Validation, Business, Conflict, RateLimited, Server, Timeout, Network, Contract, Unknown). Indonesian messages are added only at the presentation layer.

**REFRESH**
- **expiry detection:** a token with 60 s or less left is refreshed first; the server clock decides.
- **refresh:** the new token pair is saved before any retry. Where each context refreshes:
  - navigation: the proxy refreshes proactively;
  - Server Actions and Route Handlers: refresh in-process;
  - Server Components can't write cookies, so they redirect to `/api/auth/refresh`.
- **single-flight:** one refresh per session, keyed by session id plus refresh token. At runtime, 5 concurrent requests on an expiring session made 1 refresh call.
- **rotation:** a completed refresh is reused for 10 s, so a request still carrying the old cookie never replays the rotated refresh token. The race across multiple instances is documented, not solved (OD-25).
- **retry-once:** after a 401, GET/HEAD are retried exactly once, and a second 401 logs the user out. POST/PUT/PATCH/DELETE are not replayed by default, because the backend hasn't confirmed a 401 means no side effect (OD-04); the user resubmits.

**SECURITY**
- **browser gateway access:** none. The gateway client is the only `fetch` caller in `src` (a static test enforces this).
- **access token exposure:** none — not in localStorage, sessionStorage, `document.cookie`, the HTML or the RSC payload (checked in the browser).
- **refresh token exposure:** none (same checks).
- **API key exposure:** none. The bundle check script passes (0 hits for the variable names, the gateway paths or the configured values).
- **credential logging:** 0 hits for tokens, password, session secret or `Bearer` in the server log after the full run.

**NEXT.JS**
- **cookie-write behavior:** confirmed at runtime.
  - Server Components can't set cookies.
  - A cookie refreshed in the proxy reaches the same render.
  - A Route Handler's `cookies().set()` followed by `redirect()` persists.
  - A Server Action that changes cookies re-renders the current route.
- **proxy behavior:** decrypts the cookie locally on each dashboard navigation and calls the gateway only when the token is about to expire. No full authorization logic there.

**TESTS** (150 pass, up from 2)

| Area | Result |
|---|---|
| login | PASS |
| session | PASS |
| refresh (full failure matrix) | PASS |
| 401 retry | PASS |
| single-flight | PASS |
| logout | PASS |
| security | PASS (static boundary test, bundle check, browser storage check) |

11 browser scenarios (R1–R11) also passed. The first browser run found a real bug: after one render-time 401, a later unrelated 401 skipped its refresh. The fix limits that one-retry flag to render mode and a 10 s window, with 2 new tests. Separately, the reruns I made while debugging this hit a stale server because `pkill` didn't stop the old Next process; the final numbers come from a clean restart.

**DEPENDENCIES**
- removed: `better-auth` (its role is taken by the new module; OD-16), `next-base64`, `axios`
- added: none

**OPEN DECISIONS**

| OD | Status | Notes |
|---|---|---|
| OD-02 | BLOCKED / PENDING BACKEND CONFIRMATION | gateway target |
| OD-03 | BLOCKED / PENDING BACKEND CONFIRMATION | API key |
| OD-04 | BLOCKED / RETRY SAFETY UNKNOWN | expiry format, refresh endpoint, rotation, whether a 401 is side-effect free |
| OD-15 | RESOLVED (provisional) | encrypted cookie. Reopen if real tokens exceed about 1.3 KB each, or the backend strictly rejects reused refresh tokens |
| OD-16 | RESOLVED | better-auth replaced |
| OD-25 | BLOCKED | replica count and sticky sessions unknown |
| OD-36 | BLOCKED | no test gateway; proven against a local mock only |

**DASHBOARD SHELL** (recorded in the report, not implemented)
- **layout responsibility:** `(dashboard)/layout.tsx` owns the session guard and passes a token-free session view down (both done in A5.1).
- **navigator:** the sidebar no longer uses `authClient`.
- **header:** should move from feature views into the layout.
- **feature responsibility:** content only. Known deviation: `dashboard/presentation/home.tsx` still renders `Header`/`SidebarInset` itself.

**BLOCKERS**
1. Confirm OD-02/03/04 with the backend, then rerun R1–R11 on a real test gateway (OD-36).
2. Decide the deployment topology (OD-25).
3. Measure the real token size against the cookie limit.
4. Provision `SESSION_SECRET` as a deployment secret (no longer optional).
5. Carried from A5.0: `.env` is still copied into the Docker image; prettier isn't installed (it needs approval), so the Husky pre-commit hook is still blocked.
6. New decision needed: register/forgot/reset/activation are template screens that don't exist on the legacy gateway — keep or remove them?

**EVIDENCE**
- typecheck: exit 0
- lint: 0 errors, 27 warnings (existing kinds)
- `npx vitest run`: 150/150
- `npm run quality`: exit 0
- `next build`: exit 0
- server-only test build: exit 1, as intended
- `check:bundle`: PASS
- no cookie → 307 to `/login?returnTo=…`
- cross-site `/api/auth/refresh` → 403
- browser run R1–R11: all as specified
- The temporary spike route used for the runtime proof has been removed. `.env` was never read and no secrets were printed.

**REPORT:** `frontend/docs/architecture/reviews/A5.1_AUTH_SESSION_GATEWAY_SPIKE.md`
