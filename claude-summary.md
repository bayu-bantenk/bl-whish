A6-R and A6 both stay **BLOCKED**. None of the authenticated checks could run, because the `A55R_*` variables you exported aren't visible to me.

My process started about 12 hours before you exported them, and a process can't see variables exported later in another terminal. They're missing in both a plain and an interactive `zsh -i` shell. So `npm run test:live` wasn't run (it would stop at "A55R_CONFIRM_NON_PRODUCTION=yes not set"), and I didn't touch the safety gate.

What I could do was probe `https://devb2b-api.gpos.id` directly without any credentials: HTTPS, 9 requests. The host is reachable from this machine with no VPN or proxy.

1. **Target:** `https://devb2b-api.gpos.id`. The frontend's `API_HOST` is still `localhost:4001/api/v1`; I didn't change it.
2. **Login: BLOCKED.** An empty request returns 400 `ERR_VALIDATION_ERROR` listing `Email` and `Password` as required, so the endpoint exists and its field names are known.
3. **Content list: BLOCKED.**
   - No token returns 403 `{code:403,status:"FAILED",data:null,message:"Forbidden"}`.
   - An invalid token returns 401 with an empty body.
   - The app only refreshes on 401, and an expired token will get 401, so that path fits.
4. **Detail: BLOCKED.**
5. **Create: BLOCKED.**
6. **Update: BLOCKED.**
7. **Refresh: BLOCKED.** `/api/v1/auth/refresh` exists: an invalid token returns 400 "Invalid token" and an empty body returns a `refresh_token` required error. The old `/refresh-token` path returns 404.
8. **401 → refresh → retry: BLOCKED.** Only the invalid-token → 401 step is confirmed.
9. **Refresh failure: NOT VERIFIED end-to-end.** The backend rejects a bad refresh token with 400, not 401. The app treats any failed refresh as the end of the session; that is only proven with the mock backend so far.
10. **Logout: BLOCKED.** Logout with no token returns 500, a backend robustness issue. The app always sends a token, so users aren't affected.
11. **Authorization: BLOCKED.**
12. **Browser security:** real run BLOCKED. Still passes with the mock backend.
13. **Request ID: PARTIAL.** The gateway doesn't echo `X-Request-Id`. Whether it reaches the backend is unknown.
14. **Changes made:**
    - **Auth profile:** the existing `legacy-v1` profile in `src/packages/auth/repository/dto.ts` now uses `/api/v1/auth/refresh`. It reads `access_token`, `expires_at` and `refresh_token` from the refresh reply, and keeps a `refresh_token` from login if one is returned. Nothing else in the auth or session code changed.
    - **Tests:** I replaced the old "no refresh endpoint" test with 4 new ones. All mock-backend tests pass (511).
    - **Docs:** I updated the A6-R report and created `docs/architecture/reviews/summary.md`, since none existed.
    - **Not changed:** no config.
15. **Remaining blockers:**
    - The account variables aren't visible to me.
    - `API_HOST` still points at `localhost`.
    - The live test harness is read-only, so it can't do the refresh, logout or write checks yet.
    - Permission to write test Content rows.
    - A second account for the access-denied test.
    - Unconfirmed backend details: the success code in the refresh reply, the login response fields, and whether `KONG_API_KEY` is needed. Sending it made no difference on unauthenticated requests.
    - A real mismatch in validation errors: the backend returns `data[{FailedField, Tag, Value}]`, but the Content form's field-error mapping expects `{errors:{field:[…]}}`. I'll fix it once a real Content validation error is seen.
16. **A6-R: BLOCKED.**
17. **A6: BLOCKED.**

The backend's validation errors echo back the value that failed. The app never logs response bodies or passes them to the browser, so a password can't leak through that. Keep it that way. No credentials or tokens were used or printed. The configured API key was sent twice to test whether it's required, and never printed.

**Next steps:**
1. Restart Claude Code from the terminal where the `A55R_*` variables are exported.
2. Approve a gitignored `frontend/.env.local` with `API_HOST=https://devb2b-api.gpos.id` (no `/api/v1`, since the paths already include it) and `GATEWAY_AUTH_CONTRACT=legacy-v1`.
3. I run `npm run test:live`, then extend the harness (with your review) for detail, forced 401, refresh and rotation, logout, and create/update on a test record only.
