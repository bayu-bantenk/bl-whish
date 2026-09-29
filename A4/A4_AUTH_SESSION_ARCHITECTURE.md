# A4 — Auth / Session Architecture

| Item | Value |
|---|---|
| Phase | A4 (architecture only) |
| Date | 2026-09-29 |
| Evidence | A2 `AUTH_API_PERMISSION_MAP.md` §2–4, §13, §16–18; A3.1 `RUNTIME_BEHAVIOR_AUDIT.md` §3–5, §10, §13; B0 (target auth findings) |
| Related | `A4_TARGET_ARCHITECTURE.md` (AD-01, AD-08, AD-10), `A4_SECURITY_ARCHITECTURE.md`, `A4_NAVIGATION_AUTHORIZATION.md` |

This document separates the **AUTH CONTRACT** (behavior the system must guarantee, independent of library) from the **AUTH IMPLEMENTATION** (mechanism choices, some of them still open).

---

## 1. Evidence baseline

| Fact | Legacy (A2 / A3.1) | Current target (B0) |
|---|---|---|
| Where tokens live | Adonis server session (file store); the browser holds only the `gpos-sessions` httpOnly cookie | The better-auth session cookie cache (JWT) **and** `session.token` exposed to client JS via `authClient.useSession()`; an `access-token` cookie set without explicit flags |
| Who calls the gateway | The Adonis server only | **Browser JS** (usecases run in client components) |
| API key | None | `KONG_API_KEY` inlined into the client bundle |
| Expiry | `expires_at` string comparison, server-local time; **fails open for null / invalid** (A3.1 §5, A3-S02) | better-auth `expiresAt` set to `access_jwt_exp` (number, likely seconds; unverified) |
| Refresh | **Not implemented** | Not implemented (`refreshToken()` unused and buggy) |
| 401 from gateway | Not handled (silent empty table / 400 JSON; the session persists) | Not handled |
| Session integrity | Server-side store | **Unsigned cookie payload decoded** in a `before` hook (`getServerSession` base64-decodes `better-auth.session_data`) (forgeable, B0) |
| Logout | `session.clear()` + gateway logout; GET (no CSRF) | `authClient.signOut()`; no gateway logout |

## 2. AUTH CONTRACT

### 2.1 Invariants (MUST)

| ID | Invariant |
|---|---|
| AC-01 | The **access token and refresh token never reach the browser**: not in JS, HTML, RSC payloads, `localStorage`, non-httpOnly cookies, URLs or logs |
| AC-02 | Only server-side code (`server-only` modules) reads or writes tokens. Only the gateway client attaches `Authorization` |
| AC-03 | The browser holds **one session cookie**: `httpOnly`, `Secure` (in every deployed environment), `SameSite=Lax`, `Path=/`, and integrity-protected (signed and encrypted). Its lifetime is bounded by the refresh-token lifetime (or an absolute max if none) |
| AC-04 | Session validity is decided from a **parsed, validated** expiry. An unparseable or missing expiry = **invalid session** (fail closed; fixes A3-S02) |
| AC-05 | Every authenticated route and every Server Action / Route Handler verifies the session server-side (DAL). `proxy.ts` checks are optimistic only |
| AC-06 | **Refresh is single-flight per session** and the original request is **retried exactly once** after a successful refresh |
| AC-07 | If refresh fails (or refresh is unavailable) → **clear the session** → redirect to login with a validated `returnTo`. For non-navigation requests, return a typed 401 so the client navigates to login. **Never** an HTML login page returned to an XHR (fixes A2-H05) |
| AC-08 | Login and logout are POST-only state changes protected against CSRF (fixes the legacy GET logout, A2-M01) |
| AC-09 | `returnTo` accepts **only same-origin relative paths** (starting with `/`, not `//`, and no scheme), to prevent open redirects |
| AC-10 | Authentication errors are user-visible and specific enough to act on ("Email atau password salah", "Sesi berakhir, silakan masuk kembali") without leaking internals. Fixes the legacy silent invalid-login (A3.1 §3, A3.2 §4) |
| AC-11 | No credentials in HTML: no prefilled values (fixes A2-H02) |
| AC-12 | Nothing auth-related is logged in raw form (tokens, passwords, cookie values, auth request / response bodies). Fixes A2-C01 / C02 |

### 2.2 Session model (logical)

```ts
// domain contract (framework-free) — packages/auth/domain/session.ts
interface AuthSession {
  subject: { id: string; email: string; name: string; roleName?: string }  // from gateway login payload (fields: OD-04)
  accessToken: Secret<string>          // never serialisable to client
  accessTokenExpiresAt: Date           // parsed + validated (AC-04)
  refreshToken?: Secret<string>        // present only if backend issues one (OD-04)
  refreshTokenExpiresAt?: Date
  issuedAt: Date
}
interface ClientSessionView {           // the ONLY session data that may reach the browser
  user: { id: string; name: string; email?: string; roleName?: string }
  expiresAt: string                     // for UX only (e.g. "session ends soon"); not a security control
}
```

The mapping from the gateway login payload is the repository's job. The legacy payload keys `access_token`, `expires_at`, `user_email`, `user_name`, `role_name` and (`user_id` | `id` | `cms_user_id`) are **KNOWN FROM LEGACY CLIENT**. The real key set is still [UNKNOWN — VERIFY A3.1 / backend] (A2-U01, A2-U09 → OD-04).

### 2.3 Flows

**Login**

```text
Browser (login form, client) ──POST (Server Action: login)──▶ Next server
  zod validate {email, password}  ── invalid → field errors (no gateway call)
  gateway POST /api/v1/auth/login {email, password}        (only these fields; not the whole form, fixes A2-H06)
    ├─ 2xx + valid payload → map → AuthSession → write session cookie → redirect(returnTo ?? '/dashboard/home')
    ├─ 401/400 → form error "Email atau password salah" (AC-10)
    ├─ timeout/network → form error "Tidak dapat terhubung ke server" (distinct, AD-04)
    └─ malformed payload (e.g. missing/invalid expiry) → treat as failure; log sanitized; form error
```

**Authenticated request (Server Component / Server Action / Route Handler)**

```text
getSession()  ── none/invalid → (page) redirect /login?returnTo=… | (action/handler) typed 401
  access token valid (with clock-skew margin S, default 60 s) → call gateway
  access token expired/expiring → REFRESH (single-flight, §2.4) → call gateway
gateway 401 on a call made with a fresh-looking token → REFRESH once → retry the ORIGINAL request once
  retry again 401 → session invalid → clear + login (AC-07)
```

**Refresh failure**

```text
refresh endpoint 400/401 / refresh token expired / no refresh token → clear session → login (returnTo)
refresh endpoint timeout/network → do NOT clear the session; surface a retryable error (the user may retry);
  a subsequent refresh failure with 401 clears the session
```

**Logout**

```text
POST (Server Action: logout) → best-effort gateway POST /api/v1/auth/logout (Bearer) → clear the session cookie
  → redirect /login. Gateway failure never blocks the local logout.
```

**Session expiry UX**
- Navigation → login with a message ("Sesi berakhir…").
- In-page action → typed 401 → the client shows a toast and navigates to login with `returnTo`.
- No stale data remains visible and no native `alert()` (fixes A3.2 §15).

### 2.4 Refresh: single-flight and retry-exactly-once

| Aspect | Contract |
|---|---|
| Trigger | (a) **proactive**: the access token expires within skew S at request start; (b) **reactive**: the gateway answers 401 on a request |
| Single-flight | Concurrent requests of the **same session** share one in-flight refresh promise, keyed by session id (per server instance). Waiters use its result |
| Retry | Each original request is retried **at most once** after a successful refresh. The retry carries a flag, and a second 401 is final |
| Rotation | If the backend rotates refresh tokens, the new pair must be persisted **before** any retry response is sent, and a losing concurrent refresh must not overwrite a newer pair (compare `issuedAt`) |
| Multi-instance | The per-instance single-flight does not coordinate across instances. With rotating refresh tokens and "reuse detection" on the backend, parallel refreshes from two instances could revoke the session. **This depends on backend rotation semantics (OD-04) and the deployment topology (OD-25)**. Mitigation options: sticky sessions, a shared lock (server-side store), or a backend grace window |
| Idempotency | Automatic retry after refresh applies to **all** methods only because the original request was rejected with 401 before execution (an auth failure implies no side effect). This assumption is a **backend contract** to confirm (OD-04) |
| Mutations | A Server Action that hits 401 refreshes, retries once, then returns an `ActionResult` (never an HTML redirect to fetch/XHR) |

### 2.5 Where a refreshed token can be persisted (Next.js 16 constraint)

Next.js 16 (`cookies.md`): cookies **cannot be set during Server Component rendering**, only in Server Functions, Route Handlers and Proxy responses. Consequences:

| Context | Can persist a refreshed session? | Contract behavior |
|---|---|---|
| `proxy.ts` (runs before render) | Yes (response `Set-Cookie`) | **Proactive refresh location** when the cookie-based session is used (§3 option A): if the access token is within skew S of expiry, refresh here |
| Server Action / Route Handler | Yes | Reactive refresh + persist + retry once |
| Server Component render | **No** | Must not rotate tokens it cannot persist. On 401 during render → redirect through the refresh endpoint (`/api/auth/refresh?returnTo=…`, a Route Handler) which refreshes, persists and redirects back; failure → login |

With a **server-side session store** (§3 option B), refresh can be persisted from any context, because the cookie only holds a session id. That is simpler semantics, but it adds an infrastructure dependency.

## 3. AUTH IMPLEMENTATION (mechanism options)

A4 fixes the contract. The mechanism is decided in the A5 foundation spike against the acceptance criteria below, **without new dependencies unless approved**.

| Option | Description | Pros | Cons / dependencies |
|---|---|---|---|
| **A. Encrypted cookie session** (stateless) | Tokens + expiry in one encrypted and signed httpOnly cookie. Encryption via Web Crypto (AES-GCM, built into Node / Edge; no dependency) or `jose` (present transitively via better-auth; a direct declaration needs approval) | No infrastructure; works multi-instance for reads | Cookie limit ~4 KB: the **token sizes are unknown** (OD-04). Revocation relies on token expiry. Refresh persistence only in Proxy / Actions / Handlers (§2.5). Multi-instance refresh race (§2.4) |
| **B. Server-side session store** | The cookie holds an opaque session id; tokens live in a store (Redis or similar) | No size limit; refresh from any context; server-side revocation; a shared lock solves the multi-instance race | **Infrastructure dependency** (store provisioning, ops) — OD-15 |
| **C. Keep better-auth** as the session engine | Reconfigure it to keep gateway tokens server-only (no `token` in the client session, no cookie-cache decode bypass, signed cookies) | Existing dependency | Current integration violates AC-01, AC-03 and AC-04 (B0). Its fit for an external-gateway token model must be proven. Its extra endpoints (`/api/auth/[...all]`) widen the surface — OD-16 |

**Acceptance criteria for the choice (A5 spike):**
1. AC-01…AC-12 are demonstrably met.
2. The token payload size fits the chosen storage.
3. Single-flight refresh with retry-once is proven under concurrent requests (test in `A4_TEST_STRATEGY.md` §5).
4. No new dependency, or an approved one.
5. Behavior is correct across ≥2 server instances, or a documented deployment constraint exists.

**A4 recommendation (non-binding until the spike):** Option A with Web Crypto if the token size is ≤ ~3 KB and the backend does not use strict refresh-token reuse detection. Otherwise Option B. Option C only if it can meet AC-01/03/04 without patches. **Rationale:** it satisfies the contract with the fewest moving parts and no new dependency. It is not chosen for popularity.

## 4. Browser exposure, SSR and client-side requests

| Concern | Rule |
|---|---|
| SSR | Server Components read the session via the DAL (cookie read allowed). They never rotate tokens (§2.5) |
| Client-side requests | Only to **same-origin** Next.js endpoints (Server Actions, `/api/bff/*` Route Handlers). The browser never calls the gateway (AD-01) |
| Client session view | Only `ClientSessionView` (name / email / role label / expiry) may be passed to client components, e.g. for the header avatar |
| Concurrent requests | Handled server-side by single-flight (§2.4). The client does no token handling at all |
| `returnTo` | Validated per AC-09 at both write time (proxy) and read time (after login) |

## 5. XSS, CSRF and open redirect

| Threat | Control |
|---|---|
| XSS → token theft | AC-01 (no tokens in JS-reachable storage). React escaping; no `dangerouslySetInnerHTML` except the vetted rich-text renderer (form document); CSP (security document) |
| CSRF on Server Actions | Next.js built-in: POST-only plus Origin / Host comparison. Configure `serverActions.allowedOrigins` only if behind a proxy with a different host (`data-security.md`). `SameSite=Lax` session cookie |
| CSRF on Route Handlers | **No built-in protection.** Every mutating Route Handler must (a) accept only POST / PUT / PATCH / DELETE, (b) verify `Origin` (or `Sec-Fetch-Site: same-origin`) against the app origin, (c) require `Content-Type: application/json` (non-simple request). This fixes the legacy PATCH / `_method` bypass (A3.1 §10, A3-S01): **no method override is supported** |
| State-changing GET | Forbidden (legacy GET logout, GET voucher cancel → POST) |
| Open redirect | AC-09 |
| Session fixation | Issue a new session cookie on login; clear it on logout |
| Clickjacking | `frame-ancestors 'none'` / `X-Frame-Options: DENY` (legacy had `DENY`; keep) |

## 6. Required changes to the current target (for implementation; not done in A4)

1. Remove client-side gateway calls and `authClient.useSession()`-based token retrieval from all views.
2. Remove `next.config.ts env` inlining of `API_HOST*` and `KONG_API_KEY`.
3. Replace the `getServerSession` cookie decode (unsigned) and the `before` hook short-circuit.
4. Replace the `access-token` cookie (no flags).
5. Move the session guard from the client `PrivatePage` to the server `(dashboard)` layout + DAL. Keep `proxy.ts` as the optimistic check.
6. Map the gateway login payload in the repository with strict expiry parsing (AC-04).

## 7. Backend dependencies (auth)

| ID | Question | Why |
|---|---|---|
| OD-04 | Login payload fields, `expires_at` format, access / refresh token lifetimes, **whether a refresh endpoint exists** (B0 template constants reference `/auth/refresh-token`; the legacy client never calls it), rotation and reuse-detection semantics, and whether 401-rejected requests are guaranteed side-effect-free | Refresh contract, storage choice, retry safety |
| OD-02 | Is the legacy gateway (`/api/v1/auth/login`) the same service as the B0 target (`/auth/login`)? | Endpoint mapping |
| OD-03 | Does the gateway require an API key (Kong `Api-Key`)? If so, it is server-side only | Header policy |

**If the backend provides no refresh endpoint:** the contract degrades to "access token expiry → clear session → login", with a pre-expiry UX warning. AC-06 does not apply. This is recorded as a **backend dependency**, not an assumption.
