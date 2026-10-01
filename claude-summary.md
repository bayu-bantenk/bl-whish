The harness is ready: typecheck and lint are clean. Without credentials it stops at the gate, so it made no backend request. Nothing has been created yet, because the real run needs the terminal that has your credentials.

**Run this once, in the terminal where the `A55R_*` variables are exported:**

```bash
cd frontend
A6R1_CONFIRM_CREATE=yes npx vitest run --config vitest.live.config.js test/live/content-create.live.test.ts
```

If `npx` complains about mise trust, use `node node_modules/vitest/vitest.mjs run --config vitest.live.config.js test/live/content-create.live.test.ts` with the same `A6R1_CONFIRM_CREATE=yes` prefix.

**What it does, in order:**
1. **Logs in** through the existing auth use case.
2. **Checks the code doesn't exist yet:** a read-only search for `A6R-TEST-<UTC yyyymmdd-HHMMSS>`. If the search fails or finds a record, it stops with **no POST and no marker**.
3. **Writes the one-shot marker** `$TMPDIR/a6r1-live/create-attempted.json`, before the POST.
4. **Sends exactly one POST** through `content.create` (use case → repository → GatewayClient), with `{code, name: "A6R CREATE Contract Verification", is_active: true, value: "A6R controlled real CREATE verification."}`. There's no retry.
5. **Classifies the raw result:**
   - **AMBIGUOUS** if there was no HTTP response (network error, timeout or exception);
   - **SUCCESS_CANDIDATE** if the HTTP status was 2xx;
   - **REJECTED** for any other status.
6. **Reads the record back:**
   - searches by the code again, to count matches and detect duplicates;
   - if it has an ID (from the response, or a single search match), reads it with `GET /:id` and compares code, name, is_active and value as true/false checks.
7. **Logs out** and writes `$TMPDIR/a6r1-live/evidence.json`.

**Safety guards:**
- **It won't run unless the confirmation variable is set:** a plain `npm run test:live` stops at "A6R1_CONFIRM_CREATE=yes not set".
- **It can only run once:** after the marker exists, it refuses to start again.
- **Request guard:** a second Content POST and any PUT, PATCH or DELETE are refused before leaving the process.
- **No secrets recorded:** auth responses keep key names only, and the evidence file isn't written if it contains the password. Field values are kept only for the inert test record.
- **Local authorization comes from the harness's own policy** (`content.read` and `content.create`, as you approved). `AUTHZ_INTERIM_GRANTS`, `.env*` files and `src/` are unchanged.

When it finishes, paste the output or just say "done". I'll read `evidence.json` and then write the A6R-1 report and update `A6_WRITE_CONTRACT_READINESS.md` and `claude-summary.md`. If the result is ambiguous, don't run it again; the marker will refuse anyway.
