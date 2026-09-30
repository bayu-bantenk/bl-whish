```text
A5.7 E2E + CI + ACCESSIBILITY HARDENING
========================================

Status: GO-WITH-RISKS
```

The whole A5 foundation now has in-repo, repeatable browser tests. The suite ran green 5 times in a row with no retries. It isn't GO for two reasons. The E2E suite doesn't run in CI yet: I couldn't check what the Jenkins build host supports. And the real backend is still unverified. Nothing is committed yet. Your dev server on :4000 was left untouched.

**Existing infrastructure:**
- Vitest + Testing Library: 474 tests, plus architecture and security rules and the bundle scan.
- No browser E2E in the repo, only throwaway `/tmp` scripts.
- No automated accessibility checks (`axe-core` was only an indirect dependency).
- CI is Jenkins → remote `docker build`. The Dockerfile runs `quality`, the build and the bundle check; there is no E2E stage.

**New infrastructure:**
- **Playwright 1.63 + `@axe-core/playwright` 4.13** as dev dependencies. The npm registry was reachable this time, so I also declared zod, which closes A5.6's RK-A56-02. Tests use the installed Chrome, so no browser download is needed locally.
- **Mock backend** (`e2e/mock/`, marked TEST_ADAPTER, synthetic users and data): login/refresh/logout, the Content list, the signed-URL endpoint, and a separate storage origin.
- **E2E-only routes:** `npm run e2e:build` copies small route files into the app, builds, and removes them again. The production build contains none of them, and a static test fails if any are left in `src/`.
- **Automatic network check in every test:** it fails if the browser contacts anything other than the app or storage, or ever sends an `Authorization` header.
- **Safety:** the app launcher refuses to start unless the backend is on `127.0.0.1`.
- **Commands:** `npm run test:e2e:full` builds and runs everything.

**Results**

| Area | Status | Evidence |
|---|---|---|
| E2E | PASS | 56 tests |
| Accessibility | PASS | axe on WCAG 2.1 A/AA, no rules disabled, 9 page states |
| Security | PASS | browser boundary, no secrets in HTML/RSC/storage/server log, no gateway host or wire names in responses, bundle clean |
| Architecture | PASS | existing rules green, plus guards that the E2E routes stay out of production |
| CI | BLOCKED | see Risks |
| Auth regression | PASS | expired token → 1 refresh; 5 concurrent → 1 refresh; failed refresh → login with no retry storm; forged cookie; logout |
| Authorization regression | PASS | a mutation from a screen that skips the page check is still refused by the server, with 0 gateway calls |
| DataTable regression | PASS | exactly 1 gateway request per interaction |
| Form regression | PASS | every error type distinct |
| Upload regression | PASS | bytes go browser → storage only; expired signed URL gets a new one on retry; unsafe file names produce safe storage keys |

**Bugs the new suite found and I fixed:**
- **Double navigation after login:** the server's redirect and the client's `window.location` raced each other. The login action now redirects once, server-side.
- **Wrong return after session refresh:** the DataTable reference hard-coded where to return, so the user landed on a 404 and lost their page and sort. It now returns to the same page and sort. This matters because features will copy that page.
- **Error text contrast below WCAG AA:** form errors used `red-500` (3.8:1) and the error colour token was 4.49:1. Both now meet 4.5:1. The error red is slightly darker, so a quick visual check is worth doing.

**Flaky tests:** three intermittent failures, each reproduced, diagnosed and fixed rather than retried:
- the double navigation above;
- the page title arriving slightly after the URL changes;
- axe sampling the mobile menu while it was still sliding in.

**Unit tests:** 478 passed, 0 failed, 0 skipped (+4).

**Integration tests:** included in the 478 (Vitest).

**E2E tests:** 56 passed, 0 failed, 0 skipped, 0 flaky. That was 5 consecutive runs (280/280), plus a final `CI=1 npm run test:e2e:full`.

**Accessibility tests:** 7 axe specs covering login, login with an error, dashboard, mobile menu, DataTable with data and its error state, form with errors plus a failed upload, 403 and 404. Keyboard paths are covered in the other specs.

**Typecheck:** 0 errors.

**Lint:** 0 errors, 28 warnings (the same set as before).

**Build:** PASS, with 0 E2E routes in the production build.

**Security scan:** bundle check PASS.

**A5.5R real backend:** BLOCKED

**A5.6 real backend upload:** BLOCKED

**Risks:**
- **RK-A57-01 (High):** E2E doesn't run in CI. I didn't add it to the Jenkinsfile, because I can't check whether the build host has Node 24, Chrome or the free ports, and that pipeline deploys to production. A ready-to-use Jenkins stage is in the report.
- **RK-A57-02 (High, carried):** the real backend and upload contract remain unverified.
- **RK-A57-03 (Medium):** CI will need Chromium installed (`E2E_BROWSER_CHANNEL=chromium`).
- **RK-A57-04 (Medium):** `loginAction` now redirects on success instead of returning `{ok: true}`.
- **RK-A57-05 (Low):** the error colour token changed.
- **RK-A57-06 (Low):** the E2E build writes to `.next`; a normal build restores it.
- **RK-A57-07 (Low):** ports 18190, 18195 and 19190 must be free.

**Open questions:**
- Can the Jenkins build host run Node 24 plus Chromium (`npx playwright install --with-deps chromium`)? If so, the E2E stage can go in.
- Is the slightly darker error red acceptable visually, or does design want a different red that still meets 4.5:1?
- The A5.5R / A5.6 backend questions still stand: which host, which environment, a test account, and the signed-URL contract.

**Documentation:** `docs/architecture/reviews/A5.7_E2E_CI_ACCESSIBILITY_HARDENING.md`

**Files changed:**
- **New:** `playwright.config.ts` and `e2e/**` (mock backend, build script, app launcher, support, 8 specs, route shims).
- **Config:** `package.json`, `package-lock.json`, `vitest.config.js`, `.gitignore`.
- **Fixes from findings:** `auth.actions.ts`, `login.tsx`, `home.tsx` (auth presentation), `ui/form.tsx`, `globals.css`, the content-list fixture page.
- **Tests:** `auth.actions.test.ts`, `content-list-page.test.tsx`, `security-boundary.test.ts`.

**Files intentionally NOT changed:** `Jenkinsfile`, `Dockerfile`, the legacy app, the backend, production routes and navigation, the old B0 components.

**Final Gate:** GO-WITH-RISKS
