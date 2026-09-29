```text
A5.4 Authorization Policy Foundation
Status: GO-WITH-RISKS
```

The A5.3 "every signed-in user may do everything" policy is gone. Authorization now works as one deny-by-default system, proven by tests and a real-browser run against the mock gateway. It's WITH-RISKS because the production capability mapping (OD-05) and account identification (OD-06) are still unknown, so this proves the architecture, not production authorization. Nothing is committed yet.

**Implemented**
- `src/shared/authorization/` holds the capability vocabulary, the identity/account types, the policy evaluator, the request-scoped `AuthorizationContext`, and a server-only interim production policy. I evolved the A5.3 files rather than adding a second system.
- The container now builds each request's principal (identity from the session, account from a resolver) and logs denials server-side.
- A deterministic test fixture: `user-a` can read and write, `user-b` can only read, `user-x` has an unknown account type.

**Authorization**
- Every check denies unless a grant explicitly allows it. Deny cases: malformed principal, no identity, no account, unknown capability, unknown account type, not granted, and a route that declares no capability.
- `require()` returns the A5.3 `Result`: Unauthenticated when there's no identity, Forbidden otherwise.
- **Production interim policy:** every signed-in user is classified `unclassified` and granted only `dashboard.read`, the one page that exists.
  - This is stricter than legacy, where every account could open everything.
  - `roleName` is deliberately ignored because its mapping is unverified.
  - No emails are hardcoded.
  - Consequence: when a feature is migrated, its pages return 403 for everyone until someone adds an explicit grant.
- **Vocabulary:** the six keys the registry already used (`dashboard.read`, `payment.read`, `banner.read/create/update`, `content.read`), marked as proposed.
  - A grant naming an unknown key fails at startup.
  - A static test checks every capability literal in `src/`.

**Route Access**
- The page guard goes through the policy. It still returns allowed, 403 AccessDenied, 404 for unknown or not-yet-built routes, or a redirect to login when there's no session.
- Direct URLs to routes hidden from the menu are still checked.
- Tests cover forbidden-but-authenticated, missing account, and unknown account type.

**Navigation**
- The registry stays the single source. The menu shows only built routes the user is granted.
- Hidden ≠ authorized: in the fixture, a hidden route is never in the menu, yet `user-a` may reach it and `user-b` may not.
- Active-route matching and breadcrumbs are unchanged.
- In the browser, the menu is exactly "Beranda" at 1280 px, and the page contains no policy data.

**Server Actions / Use Cases**
- Enforcement stays in one place: the use case calls `require()`.
- **Forbidden:** the fixture Server Action for `user-b` returns an action result of kind Forbidden, with zero gateway calls — even when the use case is called with no UI at all.
- **Allowed:** `user-a` reaches the repository with one `PATCH`.
- **No session:** the result is Unauthenticated, not Forbidden.
- Use cases remain free of Next.js and React (architecture rule).

**Security**
- The client bundle check passes. None of the policy strings (`unclassified`, the grant table, the deny reasons) appear in the bundle.
- The interim policy and the route guard are server-only and cannot be imported from client code.
- Authorization code imports no React, Next, cookies, headers, gateway client or browser APIs, and has no module-level mutable state.
- Every rule was checked by planting a violation. The mutable-state rule initially missed `export let`; I fixed its regex and re-verified.
- Denial log entries carry only request id, capability, target, reason, user id and account type — no tokens, passwords or cookies.

**Tests**

| Check | Result |
|---|---|
| typecheck | exit 0 |
| lint | 0 errors, 27 warnings (existing kinds) |
| `npx vitest run` | 318 passed, 0 failed, 0 skipped (24 files; was 280) |
| `npm run quality` | exit 0 |
| `next build` | exit 0 |
| bundle check | PASS |

- **+38 tests:** policy matrix +22, end-to-end authorization +10, architecture +3, container +2, security +1, navigation +1. Route-access lost one net: two of its tests moved into the policy suite and it gained one.
- **Your dev server:** it was running on :4000. I didn't delete `.next` or touch that process, and it stayed up the whole time.

**Regression** — none.
- **A5.1:** in the browser, invalid login, login, cookie flags, empty storage, proactive refresh, 5 concurrent navigations → 1 refresh, reused refresh token → login, forged cookie → login, logout.
- **A5.2:** one header, one main and one navigator; the mobile Sheet works by keyboard, including focus return; `/dashboard` → Home; unknown and planned routes show the 404 inside the shell.
- **A5.3:** DAL and error-contract suites pass, planted violations are still caught, per-request scope counts are unchanged, and Home TTFB median is still 12 ms.

**Backend Dependencies** (all UNKNOWN)
- OD-05: the policy and backend permission names.
- OD-06: how payment, marketing and superadmin accounts are identified.
- Also unknown: where an account type would come from, the permission payload shape, and how permissions refresh or are revoked mid-session.

**Risks**
- **RK-A54-01 (High):** production authorization and account mapping are unverified.
- **RK-A54-02 (Medium):** a migrated feature is 403 for everyone until its grant is added. This is intended, but the step must go on the feature checklist.
- **RK-A54-03 (Medium):** per-account legacy menus are not reproduced.
- **RK-A54-04 (Low):** no permission refresh or revocation semantics.
- **RK-A54-05 (Low):** use-case capability literals are checked by a static test, not the type system.
- **RK-A54-06 (Low):** denial logs include user id; no retention policy.
- **RK-A54-07 (Low):** the browser harness is outside CI. One check first ran at the 756 px default (mobile) width and needed a rerun at 1280 px.
- A5.1–A5.3 risks carry over.

**Deferred**
- **Product/backend:** OD-05, OD-06, and a per-account or backend-permission policy.
- **Feature phases:** capabilities, grants and routes for each feature; hiding row actions via `can()`.
- **A5.5:** DataTable, including list authorization.
- **A5.6:** Form + Upload, including mutation and upload authorization.
- **A5.7:** E2E in CI with axe.
- **Observability:** shipping and retention for denial logs.

**Report:** `docs/architecture/reviews/A5.4_AUTHORIZATION_POLICY_FOUNDATION.md`
