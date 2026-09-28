1. **File:** `gpos-b2b-cms/docs/migration/RUNTIME_BEHAVIOR_AUDIT.md`

2. **Summary**
   - **Setup:** I ran the unmodified legacy app (commit `00bc6ea`) on 127.0.0.1 against a local mock gateway. Configuration was overridden through the environment only; no real gateway or storage was contacted.
   - **Why a mock:** no test gateway or test accounts were available. I did not use the credentials prefilled in the legacy HTML.
   - **Coverage:** everything at the Adonis layer was verified at runtime. What the real gateway or backend does is marked `[NOT OBSERVABLE]`.
   - **Clean-up:** the test session files were deleted, both processes were stopped, and `git status` shows only `docs/`. No secrets are recorded; every value used was synthetic.
   - **Browser behavior not seen:** tests ran through `curl`, not a browser, so how pages react in the UI (e.g. DataTables dialogs) is queued for A3.2.
   - **Node version:** the app ran on Node 24; the Dockerfile targets Node 16.

3. **A3.1 STATUS: GO**

4. **Confirmed findings**
   - **Topology:** the browser only talks to Adonis. The bearer token is added server-side, and no token, gateway URL or API key reaches the browser.
   - **Session:** it stores the gateway's login `data` exactly as received.
   - **Refresh:** none happens in any scenario.
   - **Expired session:** every request, including AJAX and DataTables, gets `302 → /` and then the login page as `200 text/html`, never a 401.
   - **Access control:** the menu differs by account email, but payment and marketing accounts get 200 on every superadmin page tested.
   - **DataTables:**
     - Responses are `{draw, recordsTotal, recordsFiltered, data}` with HTML cells, and `recordsTotal === recordsFiltered` always.
     - Gateway errors 400/401/403/500, or a gateway outage, give a silent empty table (200).
     - Mapper errors give a 302.
     - Notification returns a different shape on error.
   - **Other error paths:**
     - Gateway 401/403/500 on AJAX actions come back as 400.
     - A refused connection takes the "not found" (404) path.
     - Invalid credentials, a gateway 400, or the gateway being down all show no login error.
   - **CSRF:**
     - POST, PUT and DELETE without a token are rejected (403).
     - PATCH, **and a POST with `?_method=PATCH`**, go through without a token and run resource updates. The GET voucher-cancel route also runs without a token.
   - **Upload:** signurl accepts any file type, and returns an empty 500 when the gateway fails. Adonis and the gateway never see file bytes.
   - **Identity headers:** Loyalty sends `X-Userid` = email; UserVerification sends `X-UserId` = `user_id` first.
   - **Logging:** the logs contain the full `auth` object, the token, the `Authorization` header and the login password (A2-C01 and A2-C02 confirmed).
   - **Raw data in scripts:** `toJSON` output is inserted straight into inline scripts.
   - **Messages:** the Content bulk-delete messages are swapped, and validation messages are hidden (Content and Global Config show nothing).
   - **New HIGH findings:**
     - **A3-S02:** the expiry check fails open. A `null` or unparseable `expires_at` never expires. A timestamp without a timezone is read as server time (WIB), and epoch seconds count as expired.
     - **A3-S01:** I propose raising the CSRF finding from A2-M01 (medium) to HIGH, because the `?_method=PATCH` bypass works from a plain HTML form. This needs your approval.

5. **Contradicted findings**
   - **Content create:** it does **not** keep the entered values on a validation failure (A1 said it did). No form tested keeps old input.
   - **JSON 401 for AJAX:** the Personalization and Loyalty `fail(401)` branches never run for an expired session, because `AuthSession` redirects first.
   - **Forwarding `_csrf` to the gateway (A2-H06):** it happens on login, but signurl only forwards `_csrf` when it is sent in the body; the real uploader sends it in a header.
   - **Global config create:** it shows no red border and no message. A1 expected one.

6. **Remaining unknowns**
   - **Real gateway and backend** (need a test gateway and test accounts):
     - The real login payload keys (U01/U05) and the real `expires_at` format (U02).
     - The gateway's 401 body, and whether it has a refresh endpoint (U03).
     - Whether the backend enforces authorization for payment and marketing tokens (U04).
     - Which user id field the real payload carries (U09).
   - **Backend or owner decisions:**
     - `Api-Key` and CORS requirements, and whether this gateway is the same service as the target's `API_HOST` (U05/U06).
     - Whether an entity/access permission endpoint exists (U07).
     - Which accounts are the payment and marketing users (U13).
   - **Storage and deployment:** signed-URL lifetime, required PUT headers and storage policy (U08), and the `Secure` cookie flag behind TLS (U12).
   - **Not executed:** the real 240 s timeout (RT-U01), and the axios setup-error branch (U11), which can't be triggered without changing code.
   - **Mock data too thin:** successful renders of Banner, FAQ and the edit pages (RT-U02).

7. **A3.2 readiness:** ready. The queue has 11 items (§20). It will need a browser (playwright-cli is available), and ideally a test gateway with realistic data and masked test accounts, to settle RT-U02 and the unknowns that depend on the real gateway.