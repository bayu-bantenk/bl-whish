1. **File:** `gpos-b2b-cms/docs/migration/AUTH_API_PERMISSION_MAP.md`

2. **Summary**
   - **Topology:** Adonis is the only thing the browser talks to (a server-side proxy). The browser holds just the httpOnly session cookie and a CSRF token.
     - Adonis calls the API Gateway itself, adding `Authorization: Bearer <access_token>` from the session.
     - The browser never sees the gateway URL or the token. The legacy app uses no API key at all.
   - **Login:** Adonis forwards the whole login form to `POST /api/v1/auth/login` and stores the gateway's `data` in the session as `auth` (file sessions, 7-day cookie). Expiry is only a check of `auth.expires_at` against the server clock.
   - **Token refresh is not implemented.** A 401 from the gateway isn't handled anywhere.
   - **Authorization in Adonis only checks that the session exists and hasn't expired.**
     - The three hardcoded menus, chosen by user email, only control what's visible. Every logged-in user can open every route by URL.
     - Action buttons have no permission checks. `config/access.js` is never used, and the legacy app has no session-validation or permission endpoint.
     - Any real authorization happens behind the gateway, which this repo can't show.
   - **Contracts, as seen from the legacy code:**
     - Gateway responses look like `{code, message, data}`; lists come as `data: {rows, total_rows}`.
     - Timeouts and network errors show up as `code 404`.
     - DataTables endpoints return `{draw, recordsTotal, recordsFiltered, data: [[html cells]]}`.
     - Uploads: Adonis gets a signed URL from the gateway, then the browser PUTs the file straight to storage. Principal images are the exception: they go to local disk.
   - **Coverage:** 243 gateway calls (220 distinct endpoints) are mapped to routes. The error taxonomy, the validation flow, a permission matrix for all 32 features, and the environment exposure (compared with B0) are all documented.
   - **Nothing modified:** no source files were changed and no secrets appear in the document.

3. **A2 STATUS: GO**

4. **Critical / High findings**
   - **CRITICAL A2-C01:** the bearer token and the full session are written to the server log on every request (`Extender.js`, `LoyaltyMemberRepository`).
   - **CRITICAL A2-C02:** `ApiService.httpLog` logs the Authorization header and request bodies, so the login password ends up in the log.
   - **HIGH A2-H01:** Adonis has no authorization. Roles are separated only by which menu is shown.
   - **HIGH A2-H02:** the login page still ships with a filled-in email and password.
   - **HIGH A2-H03:** no token refresh and no handling of a 401 from the gateway.
   - **HIGH A2-H04:** timeouts are reported as 404.
   - **HIGH A2-H05:** an AJAX request with an expired session gets a redirect to the HTML login page instead of an error.
   - **HIGH A2-H06:** form bodies are forwarded to the gateway unfiltered, including `_csrf`.

5. **Remaining A2 unknowns** (A2-U01…U13)
   - **Need a runtime check (A3.1):**
     - The full login payload, including whether a refresh token comes back.
     - The format and timezone of `expires_at`.
     - Which field holds the user id sent as `X-UserId`.
     - How DataTables behaves when it gets a redirect back.
     - The axios error branch that can crash.
     - Whether cookies get the `secure` flag behind TLS.
   - **Depend on the backend:**
     - Gateway behavior on an expired token.
     - Per-role authorization at the gateway or backend.
     - `Api-Key` and CORS requirements.
     - Whether `validate-session` or entity/access permissions exist.
     - Signed-URL lifetime and storage policy.
   - **Need an owner decision:**
     - Whether the legacy gateway and the target's `API_HOST` are the same service.
     - Which accounts are the payment and marketing users.
   - **A1 unknowns carried over:**
     - U28 is resolved: `DateComparison` is never registered, so it isn't used.
     - U14 is resolved on the legacy side: cancel and final both call `…/cancels`.
     - U04, U05, U06, U12 and U26 are partly resolved or classified.

6. **A3.1 readiness:** ready. A verification queue of 10 items is in §22, and the queue for A3.2 is in §23. Eight owner decisions (OD-1…OD-8) are listed for later. OD-8, removing tokens and passwords from the running system's logs, is urgent regardless of the migration.