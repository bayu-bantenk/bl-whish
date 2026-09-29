```text
A5.3 STATUS: GO-WITH-RISKS
```

All A5.3 exit criteria pass in tests, in rule checks that I confirmed by planting violations, and in a real-browser run against the mock gateway. It's WITH-RISKS because the real backend contract is still unverified (OD-02/03/04/36), the reference feature is a test fixture rather than a production feature, and the A5.1 risks (including the multi-instance refresh race) carry over. None of this blocks A5.4. Nothing is committed yet.

**Your dev server:** I stopped a `next-server` listening on port 4000 because it held `.next` open, and I deleted `.next`. It was very likely your own `npm run dev`. Please restart it when you need it.

**DAL**
- `src/shared/infrastructure/dal/` is server-only and is now the only path from pages and Server Actions to use cases. It reads `cookies()` and the request id; feature code never does.
- It hands out only use cases, a token-free request context (request id, session view, authorization) and a logger — no session manager, gateway client, repositories or tokens.
- A test build with a client component importing it fails with "depends on server-only", as intended.
- `resolvePageResult()` gives pages one of five outcomes:

  | Use-case result | Page gets |
  |---|---|
  | success | data (an empty list stays empty) |
  | Forbidden | 403 "Akses ditolak" |
  | NotFound | `notFound()` |
  | Unauthenticated | the A5.1 refresh/expire redirect |
  | anything else | a displayable error |

- `runAction()` turns a use-case result into an action result. An unexpected exception is logged with safe fields and returned as `Unknown` with a reference id.
- The old session DAL moved here; the auth Server Actions no longer import the container.

**Container**
- **Process scope:** config, base logger, session sealer, refresh single-flight registry, access policy (the A5.4 swap point).
- **Request scope:** cookie jar, session manager, exactly one gateway client, repositories, use cases, request context.
- Features are wired explicitly in `composeFeatures()`; nothing is looked up by name.
- A test proves two requests share no session, gateway client or user context.
- New: a per-request correlation id, generated in the proxy and never taken from the client. It appears in every server log line and is sent to the gateway as `X-Request-Id`.

**Repository**
- Repository interfaces contain no HTTP types. Implementations use only the shared gateway client and validate payloads; a malformed payload is a Contract error.
- Architecture tests ban `fetch`, `cookies()`/`headers()`, `process.env`, secrets and Next imports in repositories. They also enforce import direction across all layers and cross-feature imports. The one documented exception is the shell's logout call into the auth actions.
- A reference fixture (`test/fixtures/reference/`, not production scope) runs the full page → DAL → use case → interface → repository → gateway chain for all 8 required outcomes, plus the 401 hand-over, mutation replay-block, 409 and 422.

**Error contract**
- One taxonomy, using A4's names (`Validation`, `Forbidden`, `Timeout`, …) rather than the brief's UPPER_CASE codes.
- Mapping:

  | Condition | Kind |
  |---|---|
  | 400 with field errors / 422 | Validation |
  | 400 with message only | Business (per A4) |
  | 401 | Unauthenticated |
  | 403 | Forbidden |
  | 404 | NotFound |
  | 409 | Conflict |
  | 429 | RateLimited |
  | 5xx | Server |
  | client timeout | Timeout |
  | DNS/refused/reset | Network |
  | malformed success payload | Contract |

- The browser-safe error is built field by field: kind, Indonesian message, retryable, and safe extras (status, retry-after, field errors, reference). A test confirms stack traces and raw bodies never reach it.
- New `ErrorState` and `EmptyState` components keep "error" and "no data" visibly different.

**Security**
- The client bundle check passes. No tokens, secrets or gateway identifiers are in the bundle, the page HTML or browser storage.
- The server log contains no credentials, and every log line carries a request id.
- Every repo-wide search hit is classified in the report.
- Removed `shared/constants/endpoints.ts`: an unused B0 leftover holding gateway paths inside the constants barrel that client code imports.
- No dependencies were added.

**A5.1 regression** — none.
- Browser checks: invalid login, login, cookie flags, storage empty, proactive refresh, 5 concurrent navigations → 1 refresh, a reused refresh token → back to login, forged cookie → login, logout.
- All A5.1 unit and integration suites pass unchanged.

**A5.2 regression** — none.
- One header, one main and one navigator at 1280 and 375 px.
- The mobile Sheet works by keyboard: Escape closes it and focus returns to the trigger.
- `/dashboard` goes to Home; `/dashboard/nope` and `/dashboard/banner` show the 404 inside the shell.
- The static shell-duplication test still passes.

**Tests**

| Check | Result |
|---|---|
| typecheck | exit 0 |
| lint | 0 errors, 27 warnings (existing kinds) |
| `npx vitest run` | 280/280 pass, 22 files (was 218) |
| `npm run quality` | exit 0 |
| `next build` | exit 0 |
| client-imports-DAL build | fails, as intended |
| bundle check | PASS |

- **Performance, measured at runtime:** one render scope and one session decrypt per dashboard request. Home TTFB median is 12 ms locally; I have no baseline, so this is not an improvement claim.

**Risks**
- **RK-A53-01:** the real backend is unverified — envelope, error bodies, the assumed field-error shape, and 400-with-message treated as Business.
- **RK-A53-02:** no production feature exercises the page path yet.
- **RK-A53-03:** a `redirect()` inside `runAction` would be reported as Unknown; this is enforced only by a written rule.
- **RK-A53-04:** per-request dedupe is proven only at runtime (the test React build doesn't memoize).
- **RK-A53-05:** the backend's handling of `X-Request-Id` is unknown.
- **RK-A53-06:** client-safe and server-only auth types share one module (type-only imports).
- **RK-A53-07:** the browser harness still lives in `/tmp`, outside CI.
- A5.1 and A5.2 risks carry over.

**Deferred**
- **A5.4:** real access policy and capability vocabulary (OD-05/06), per-account menus, Forbidden for Server Actions.
- **A5.5:** DataTable on this data layer.
- **A5.6:** Form + Upload (zod needs approval, OD-14).
- **A5.7:** E2E in CI with axe, absorbing the `/tmp` harness.
- **Outside the A5 track:** the real backend contract, the multi-instance session race (OD-25), and log shipping.

**Report:** `docs/architecture/reviews/A5.3_DAL_CONTAINER_ERROR_CONTRACT.md`
