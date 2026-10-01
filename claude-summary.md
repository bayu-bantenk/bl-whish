# Current status — 2026-10-01: A6R-1 / A6R-2 closeout

Evidence: `$TMPDIR/a6r1-live/evidence.json`, `$TMPDIR/a6r2-live/evidence.json`. Both runs were real, against `devb2b-api.gpos.id` (non-production), through request scope → use case → repository → GatewayClient. Secret-pattern hits in the evidence: 0.

```text
A5.5R      = GO-WITH-RISKS
A6 READ    = SUBSTANTIALLY VERIFIED
A6 CREATE  = VERIFIED              POST /api/v1/cms/contents → 201 {code:201,status:"OK",data:{message}} (no id); read-back ok
A6 UPDATE  = VERIFIED-WITH-RISKS   PUT /api/v1/cms/contents/{id} → 200 {code:200,status:"OK",data:{message}};
                                   name + value persisted, is_active=false NOT persisted (D-A6R2-01, critical)
A6 DELETE  = NOT VERIFIED / OUT OF CURRENT SCOPE
A6 overall = BLOCKED
```

- **A6R-1 (CREATE): VERIFIED.**
  - 1 POST → 201; pre-check found 0 matches.
  - Read-back: 1 match by code, and the detail matches every submitted field.
  - Record `68b42bae-dfd3-4da0-b3d5-dbe0733d0aa2` / `A6R-TEST-20261001-062932`, retained by approval.
- **A6R-2 (UPDATE): VERIFIED-WITH-RISKS.**
  - 1 PUT → 200.
  - Read-back by ID and by code: id, code, name and value as intended; **`is_active` remained `true`** (intended `false`).
  - That the app sends `is_active:false` is **INFERRED** from code and unit tests; request bodies weren't recorded. Cause UNKNOWN; no further mutation was made.
- **Safety:** CREATE 1 · UPDATE 1 · DELETE 0 · PATCH 0 · retries 0 · second mutation 0 · secrets 0.
- **Closed:** CREATE success code (201) and UPDATE success code (200) match the app; the test account's backend write permission is verified.
- **Still open:**
  - D-A6R2-01 (critical): deactivation is lost while the UI says "saved";
  - `is_active:false` on CREATE not verified;
  - duplicate-code behaviour;
  - `value:null` semantics;
  - Content validation error shape;
  - no `created_at`;
  - unknown ID → 403;
  - S6 GET body / S7 API key;
  - DELETE contract;
  - production grant model (OD-05/06) and no restricted account;
  - multi-instance refresh race (OD-25);
  - 7-day session vs ~30-day token.

Details: `frontend/docs/architecture/reviews/A6_WRITE_CONTRACT_READINESS.md` → "A6R-1 / A6R-2 closeout".

---

# Previous content (origin/main 69bdf65, kept unchanged)

**CREATE BLOCKED**, with nothing sent to the backend. All four preconditions are exactly as they were in the last two attempts, so this prompt gives the same result. Since there's no new evidence, I didn't change any documentation.

```text
A6R-1 CONTROLLED REAL CREATE VERIFICATION

Baseline
- branch: chore/a5.0-foundation-remediation
- commit: 8c24d71bdc2444b1bc5e91c9928670703658b35e
- working tree: 261 entries (A5.0–A6 work not yet committed), unchanged

Environment
- backend: devb2b-api.gpos.id (confirmed non-production), contract legacy-v1
- test code: none generated

Safety
- CREATE attempts: 0
- UPDATE attempts: 0
- DELETE attempts: 0
- retries: 0
- bulk operations: 0
- production business records modified: 0
- secrets exposed: 0

Authorization
- local content.create: DENIED — AUTHZ_INTERIM_GRANTS is empty → BLOCKED_BY_LOCAL_AUTHZ (not changed, not bypassed)
- backend write permission: UNKNOWN

Pre-create
- test code absent: NOT RUN (the test-account variables aren't in this process, so it can't log in)

CREATE
- endpoint: POST /api/v1/cms/contents (not called)
- HTTP status: n/a
- response code: n/a
- response envelope: n/a
- response data shape: n/a
- returned ID: n/a

READ-BACK
- record found: n/a
- code / name / is_active / value: n/a

Contract findings
- VERIFIED: the create path in the code (authorization runs before any request, validation runs
  before the gateway, the body has exactly 4 fields, '' becomes null, is_active is a boolean, the
  token stays on the server, a mutation is not replayed after 401, there is one HTTP client and no
  other write path); the request shape matches what the legacy app sent
- INFERRED: none new
- UNKNOWN: real success code, response body / ID, persisted representation, duplicate behavior
- NOT VERIFIED: CREATE on the real backend; Content validation error shape
- POTENTIAL DEFECTS (unchanged): a create that succeeds with a code other than 201 shows as a failure,
  and a retry would create a duplicate; the backend's field-error format would show as one form-level alert

Cleanup
- DELETE: not run (out of scope)
- residual test record: none created; leaving one hasn't been approved → BLOCKED_PENDING_OWNER_APPROVAL

Documentation changed
- NONE (no new evidence; A6_WRITE_CONTRACT_READINESS.md and claude-summary.md already say BLOCKED)

Source changes
- NONE

Result
CREATE = CREATE BLOCKED
```

```text
$ git diff --stat        → 82 files changed, 900 insertions(+), 1902 deletions(-)   (identical to baseline)
$ git status --short     → 261 entries, identical to baseline
```

**What I checked just now:**
1. **Credentials:** `A55R_CONFIRM_NON_PRODUCTION`, `A55R_ALLOWED_HOST`, `A55R_EMAIL` and `A55R_PASSWORD` are all missing. This is still the same process (PID 69151, running 24 h 16 min).
2. **Local authorization:** with the test env config, `AUTHZ_INTERIM_GRANTS` is `<empty>`, so `require('content.create')` refuses before anything is sent.
3. **No write harness:** `test/live/` only has the read-only `content-list.live.test.ts`, and its guard refuses `POST /api/v1/cms/contents`.
4. **No cleanup approval:** neither the docs nor your prompts approve leaving a test record on the backend. Without DELETE, it would stay.

Sending the same prompt again won't change any of these; each needs an action from you:
1. **Credentials:** start Claude Code from the terminal where the `A55R_*` variables are exported, not from the IDE.
2. **Local authorization:** say explicitly which you allow. Either `AUTHZ_INTERIM_GRANTS=content.read,content.create` in the gitignored `.env.test.local` for this test only, or a write harness with its own test policy.
3. **Write harness:** allow me to add a new, narrowly scoped test file. It would do exactly one POST with an `A6R-TEST-*` code, a read-only check before and a read-back after, no retry, and refuse PUT and DELETE.
4. **Cleanup:** state that one inert test record may remain on `devb2b-api.gpos.id`.

With all four in place, I'll run A6R-1 in one pass. Stopped here; no UPDATE, no DELETE.
