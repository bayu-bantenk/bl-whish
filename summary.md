```text
==================================================
A6-R — REAL BACKEND & AUTHENTICATION VERIFICATION
==================================================

A6-R STATUS:
BLOCKED — REAL BACKEND INACCESSIBLE (target not confirmed) + REAL TEST ACCOUNT UNAVAILABLE

A6 FINAL STATUS:
BLOCKED (unchanged)

REAL BACKEND:               BLOCKED
REAL LOGIN:                 BLOCKED
REAL REFRESH:               BLOCKED (if the host uses the legacy-v1 contract there is no refresh endpoint, so this becomes NOT APPLICABLE)
REAL LOGOUT:                BLOCKED
REAL AUTHENTICATED REQUEST: BLOCKED
REAL CONTENT LIST:          BLOCKED
REAL CONTENT CREATE:        BLOCKED
REAL CONTENT UPDATE:        BLOCKED
REAL AUTHORIZATION:         BLOCKED
REAL UPLOAD:                NOT APPLICABLE (Content has no upload)

BROWSER TOKEN EXPOSURE:
PASS (TEST_ADAPTER only; not possible under REAL_BACKEND without a real login)

REQUEST ID:
UNKNOWN (sent by GatewayClient; whether the gateway accepts or keeps it is unverified)

TEST_ADAPTER:
- npm run quality: 35 files, 508 passed
- E2E: 65/65 (A6 run; the only change since is .env.example)

REAL_BACKEND:
- npm run test:live: refused — "A5.5R BLOCKED by safety gate: A55R_CONFIRM_NON_PRODUCTION=yes not set"
- 0 requests sent to any real host

BUILD:  PASS (next build exit 0; three Content routes present)
BUNDLE: PASS (34 files; the example key value is in 0 static files)

CRITICAL FINDINGS:
SF-A6R-01: frontend/.env.example contained a real-looking 32-character KONG_API_KEY value.
- Committed since template commit 8c24d71.
- Replaced with an empty placeholder in the working tree; git history still contains it.
- Unknown whether the key is live.

OPEN RISKS:
- A6 risks RK-A6-01…09 carried over.
- Auth contract unknown (b0 vs legacy-v1; refresh may not exist).
- API key requirement unknown (OD-03).
- GET body question unresolved (OD-31).
- Detail response may lack is_active.

BLOCKERS:
- BL-1: OD-02 — which host is authoritative, with written non-production confirmation.
- BL-2: network access (VPN / corporate CA). API_HOST is plain http on a private address.
- BL-3: test account(s), ideally one with write access and one without.
- BL-4: which auth contract the host uses.
- BL-5: permission to create/update test Content rows (the harness is read-only).
- BL-6: whether KONG_API_KEY is required, and whether the committed value is real.

DOCUMENT:
docs/architecture/reviews/A6R_REAL_BACKEND_AUTH_RE_GATE.md
```

Nothing is set up for a real run yet:
- No test account or confirmation variables exist anywhere.
- Neither `.env` has changed since A5.5R.
- It's still undecided which host is the real one.

So I contacted no host and left the safety gate as it is. The document lists what each variable means and the exact order the gate checks things.

**Needs your decision:**
1. **The example API key (SF-A6R-01).** Treat it as exposed and rotate it if it's real. Removing it from git history is destructive, so I haven't done it; say if you want it.
2. **To unblock A6-R.**
   - Confirm the non-production host and auth contract. Put them in `frontend/.env.local`, which git ignores.
   - Run `A55R_CONFIRM_NON_PRODUCTION=yes A55R_ALLOWED_HOST=<host> A55R_EMAIL=… A55R_PASSWORD=… npm run test:live` from your own shell. It needs VPN if the host requires it.
   - Share the cleaned evidence file it writes outside the repo.
   - Then I continue with the browser, refresh, logout and write checks.

Nothing is committed. Your dev server on :4000 (pid 8638) is still running.
