The live test still couldn't run with the real test account: the `A55R_*` variables are still empty in this session, so no real login or Content check could happen. A6-R and A6 both stay **BLOCKED**.

**Why the restart didn't help:** this session runs in the same `claude` process as before (PID 69151, up 12 h 31 m). It was started by an IDE / DexanKit host in `stream-json` mode, not from your terminal. So restarting Claude in your terminal didn't reach this session. All four variables are empty (the password I checked for presence only, never printed), including in interactive and login shells.

**The quickest fix:** in your terminal, where the variables are exported, run

```bash
cd frontend && npm run test:live
```

It writes a sanitized evidence file to `$TMPDIR/a55r-live/evidence.json`: statuses, field names, counts and true/false results, with no tokens or values. I can read it and finish the report. The alternative is to run `claude` directly in that terminal as a plain CLI session.

| Check | Result |
|---|---|
| Live target | `https://devb2b-api.gpos.id`, contract `legacy-v1` (set in `.env.local`) |
| `npm run test:live` | refused: "A5.5R BLOCKED by safety gate: A55R_CONFIRM_NON_PRODUCTION=yes not set" (1 passed, 12 skipped) |
| Login | BLOCKED |
| Content list | BLOCKED |
| Detail | BLOCKED |
| Create | NOT VERIFIED — the test account's write permission isn't established |
| Update | NOT VERIFIED — same reason |
| Refresh | BLOCKED. Last round's probes only confirmed the endpoint exists and rejects an invalid token with 400 |
| 401 → refresh → retry | BLOCKED. Only "invalid token returns 401" is confirmed on the real backend |
| Refresh failure | BLOCKED |
| Logout | BLOCKED |
| Authorization | BLOCKED |
| Security (browser token boundary) | BLOCKED on the real backend. Mock-backend checks still pass: 511 unit tests, tsc 0 errors, eslint clean |

**What I changed this round:**
- **Created `frontend/.env.local`**, gitignored, with only `API_HOST=https://devb2b-api.gpos.id` and `GATEWAY_AUTH_CONTRACT=legacy-v1`. The effective config now resolves to that host with the `legacy-v1` contract. `.env` is unchanged.
- **Extended the live harness**, still read-only, safety gate unchanged:
  - Content detail for an existing id and an unknown id;
  - whether the refresh token is actually rotated (recorded as true/false only);
  - refresh failure, run on a copy of the session so the real one isn't touched;
  - logout: whether the local session is cleared and whether the old access token still works.
- **No create/update step.** That waits until the account is shown to have write permission.

**Heads-up:** your `next dev` on :4000 (PID 8638) also reads `.env.local`. It will now talk to `devb2b-api.gpos.id` with the `legacy-v1` contract. Delete `.env.local` to go back to the previous behaviour.

**Remaining blockers:**
- The `A55R_*` variables aren't visible to this session.
- Write permission and a restricted second account still need to be established.
- After the first real run: confirm the success response codes, and align the Content field-error mapping with the backend's `data[{FailedField,Tag,Value}]` shape.

**Status:**
- **A6-R: BLOCKED**
- **A6: BLOCKED**

**Files changed:**
- `frontend/.env.local` (new, gitignored)
- `test/live/content-list.live.test.ts`
- `test/live/README.md`
- `docs/architecture/reviews/A6R_REAL_BACKEND_AUTH_RE_GATE.md` (attempt 4)
- `docs/architecture/reviews/summary.md`
