**A5.5R status: BLOCKED.** No request reached a real backend. I stopped at the safety gate before sending anything, because the target is ambiguous and I have no approved test account. The mock tests pass, but that isn't backend evidence, so I'm not calling it GO-WITH-RISKS.

**Why it's blocked** (config inspected by a script that printed only presence and a classification, never values):
- **Two different gateways.** Your frontend `API_HOST` is plain `http`, includes a path prefix, and resolves to a private address. The legacy app's gateway (`APIGATEWAY_URL`) is a different, public `https` host. Nothing says which one should serve `/api/v1/cms/contents` (OD-02).
- **Environment unconfirmed.** Both host names only *look* non-production.
- **Auth mismatch.** `GATEWAY_AUTH_CONTRACT` isn't set, so it defaults to `b0` (`/auth/login`). The Content API belongs to the legacy `/api/v1` gateway, whose login is `/api/v1/auth/login`.
- **API key.** `KONG_API_KEY` is set, so the new CMS will send it; legacy never sends one to its gateway.
- **No test account.** I deliberately did not use the credentials that appear prefilled in the legacy login page; they aren't an approved test account.

**What I built instead:** a read-only verification harness, `npm run test:live` (instructions in `frontend/test/live/README.md`).
- It runs the same production path as the app: request scope, use case, repository, gateway client. No shortcut `fetch`.
- It refuses to run unless you explicitly confirm the target is non-production and the host matches `API_HOST`.
- It blocks every request except GET on the Content endpoint and POST on the login/refresh/logout endpoints.
- It records only structure, counts, statuses and booleans — no row values, tokens or keys — and writes the result outside the repo.
- It covers: login; the default list (query only); pagination, including whether pages start at 0 or 1; sort ascending vs descending; search hit and no-match; query-only vs query-plus-GET-body (optional); a request without the API key (optional); local permission denial with zero gateway calls; forged and expired sessions with zero calls; and 401 → refresh → retry once.

**Evidence so far:**
- Run without confirmation, the harness refuses and sends nothing.
- A self-test against the local mock (synthetic account; harness correctness only) passed all 10 steps. It issued only the four allowed request types, the request id reached every call, and no credentials or tokens appear in its output.
- No `src/` file changed. 388/388 tests pass, lint has 0 errors, and the build and bundle check pass.
- I re-ran the A5.1–A5.4 browser regression: no change.
- The Content contract doc has a new "Real Backend Evidence" section that sets out the Legacy / New CMS / Real backend comparison. All real-backend cells are UNKNOWN, and the A5.5 evidence is kept intact.

**To unblock, from you or the backend team:**
1. Decide which host serves the Content API for the new CMS, confirm it's non-production, and put it in `API_HOST`.
2. Set `GATEWAY_AUTH_CONTRACT` to match that host (`legacy-v1` if it's the legacy `/api/v1` gateway).
3. Provide a dedicated test account. Export it only in your own shell (`A55R_EMAIL`, `A55R_PASSWORD`), never in chat or files.
4. From a network that can reach the host, run:
   ```bash
   A55R_CONFIRM_NON_PRODUCTION=yes A55R_ALLOWED_HOST=<host> npm run test:live
   ```
   Optionally add `A55R_PROBE_GET_BODY=yes` and `A55R_PROBE_NO_API_KEY=yes`.
5. Send me the sanitized evidence file (default `/tmp/a55r-live/evidence.json`). I'll mark the verified facts and change the DTO only where the evidence requires it.

Error statuses (400, 404, 422, 429, 500) are recorded as not safe to trigger against a shared backend; the A5.5 fixtures keep covering them.

**Risks:**
- **High:** the real contract is still unverified, the gateway host is ambiguous, and the auth contract may not match that host.
- **Medium:** `API_HOST` is plain HTTP with a path prefix; the API key is sent where legacy sends none; no GET body is sent.
- **Low:**
  - `CLAUDE.md` says `.claude/settings.json` blocks reading secret files, but it doesn't.
  - `BETTER_AUTH_SECRET` is still in `.env` although it's unused since A5.1.
  - The harness imports server internals and sits outside the architecture tests by design; it is never shipped.

Report: `docs/architecture/reviews/A5.5R_REAL_BACKEND_CONTRACT_VERIFICATION.md`
