# A5.5R live verification harness

Runs the **production path** (request scope → use case → repository → GatewayClient)
against a real gateway, read-only, and writes a **sanitized structural** evidence file
outside the repository. It is never part of `npm test` / CI.

```bash
cd frontend
# Values come from your shell only; never commit them. frontend/.env supplies API_HOST,
# KONG_API_KEY, SESSION_SECRET and GATEWAY_AUTH_CONTRACT as for `next dev`.
export A55R_CONFIRM_NON_PRODUCTION=yes          # you confirm the target is NOT production
export A55R_ALLOWED_HOST=<hostname of API_HOST>  # must match API_HOST exactly
export A55R_EMAIL=<test account email>           # a dedicated test account
export A55R_PASSWORD=<test account password>
# optional
export GATEWAY_AUTH_CONTRACT=legacy-v1           # if the target is the legacy /api/v1 gateway
export A55R_SEARCH=<known safe search term>
export A55R_PROBE_GET_BODY=yes                   # Test B: legacy-style GET body
export A55R_PROBE_NO_API_KEY=yes                 # is the API key required?
export A55R_OUT=/tmp/a55r-live/evidence.json     # must be outside the repo (default)
npm run test:live
```

Safety: refuses to run without both confirmations; only `GET` to the content endpoint and
`POST` to the configured auth endpoints (login / refresh / logout) are allowed — anything
else throws before the request leaves. Row values, tokens, cookies and the API key are never
recorded; only field names, types, counts, statuses and booleans.

## A6-R additions (still read-only)

- `S2b` detail: `GET /api/v1/cms/contents/:id` for the first listed row plus an unknown id (records field names only).
- `S10` now also records refresh-token rotation as booleans (changed / present / expiry in future).
- `S11` refresh failure: a *copy* of the session with invalid access + refresh tokens → expect Unauthenticated, session cleared, no loop.
- Logout (afterAll) records whether the local session is cleared and whether the logged-out access token is still accepted (one GET, no refresh).
- Target for the confirmed non-production gateway: `frontend/.env.local` (gitignored, non-secret) sets
  `API_HOST=https://devb2b-api.gpos.id` and `GATEWAY_AUTH_CONTRACT=legacy-v1`. Credentials stay in the shell.
