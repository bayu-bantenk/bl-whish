A5.5R is now marked **GO-WITH-RISKS** across the docs. Only documentation changed; checksums confirm no code, test, harness or env file was touched.

The old text (A5.5R "BLOCKED", "no real gateway", the A6-R attempt logs) is kept and labelled as historical, superseded by the 2026-10-01 live run. No real write request was sent.

### 1. Files inspected

**`frontend/docs/architecture/`:**
- `contracts/legacy-api/content-list.md`, `content-write.md`
- `reviews/A5.0` through `A5.7` reports, including `A5.5R_REAL_BACKEND_CONTRACT_VERIFICATION.md`
- `reviews/A6_FIRST_PRODUCTION_VERTICAL_SLICE.md`
- `reviews/A6R_REAL_BACKEND_AUTH_RE_GATE.md`
- `reviews/summary.md`

**Elsewhere:**
- `~/Developments/bl-whish/claude-summary.md` (your local clone of the GitHub file; working tree was clean)
- the evidence file `$TMPDIR/a55r-live/evidence.json` (unchanged: run 2026-10-01T02:28:22Z, 20 observations)

### 2. Files changed (documentation only)

| File | Change |
|---|---|
| `reviews/A5.5R_REAL_BACKEND_CONTRACT_VERIFICATION.md` | New section "Re-gate 2026-10-01 — current status": historical status → superseded → current status, evidence matrix, security evidence, open risks. The old "Final status: BLOCKED" line is labelled historical |
| `reviews/A6R_REAL_BACKEND_AUTH_RE_GATE.md` | New section "Current status — 2026-10-01". Attempts 1–5 marked historical. Correction recorded: the failed-refresh path does **not** call logout |
| `reviews/A6_FIRST_PRODUCTION_VERTICAL_SLICE.md` | Status note: A6 stays BLOCKED; RK-A6-01 now covers create/update only; new risks (403 unknown ID, no `created_at`, validation error shape) |
| `reviews/summary.md` | A5.5R row → GO-WITH-RISKS; A6 and A6-R rows reconciled; "Latest" line updated |
| `contracts/legacy-api/content-list.md` | Row "Real backend (2026-10-01)": observed fields, no `created_at`, GET body NOT VERIFIED |
| `contracts/legacy-api/content-write.md` | Row "Real backend (2026-10-01)": detail VERIFIED, unknown ID → 403, create/update NOT VERIFIED |
| `reviews/A5.7_E2E_CI_ACCESSIBILITY_HARDENING.md` | One line: "A5.5R BLOCKED" superseded; upload still BLOCKED |
| `reviews/A5.6_FORM_UPLOAD_FOUNDATION.md` | One line: A5.5R is GO-WITH-RISKS; upload and create still not verified |
| `~/Developments/bl-whish/claude-summary.md` | New "Current status — 2026-10-01" block at the top; old body kept under "Historical". Separate repo, not committed |

These needed no change:
- A5.0–A5.4 and A5.5 (no statements contradicted by the evidence);
- `test/live/README.md` (counts as harness, so left alone).

### 3. A5.5R final gate

```text
GO-WITH-RISKS
```

### 4. Evidence matrix

| Area | Status | Evidence |
|---|---|---|
| Login | VERIFIED | `POST /api/v1/auth/login` → 200; `access_token`, `refresh_token`, `expires_at` returned |
| Backend `expires_at` | VERIFIED | RFC 3339 with nanoseconds, `+07:00`, about 30 days ahead; accepted. Backend value is the source of truth, no frontend maximum |
| Content list | VERIFIED | `GET /api/v1/cms/contents` → 200 |
| Content detail | VERIFIED | existing ID → 200; `id, name, code, value, is_active` |
| Pagination | VERIFIED | pages 1 and 2 don't overlap; page 0 returns page 1; out-of-range page → empty |
| Sorting | VERIFIED | `code` asc and desc. `created_at desc` is NOT VERIFIED |
| Search | VERIFIED | a hit returns matching rows; no match → empty, not an error |
| Local authorization denial | VERIFIED | `Forbidden` with 0 backend calls |
| 401 → refresh → retry | VERIFIED | 401 → `POST /api/v1/auth/refresh` 200 → one retry → 200; no loop |
| Refresh rotation | VERIFIED | access and refresh tokens rotated, new expiry in the future |
| Failed refresh cleanup | VERIFIED | 401 → refresh 400 → local session cleared → request stops; no logout call |
| Logout | VERIFIED | logout → 200; the same token then gets 401 |
| Unknown ID behavior | VERIFIED as observed 403/Forbidden | the tested unknown ID returned `403 Forbidden`; the app maps 403 → `Forbidden`. One observation only |
| S6 GET body | NOT VERIFIED | probe not enabled |
| S7 API key behavior | NOT VERIFIED | no comparison without the key was run |
| Content create | NOT VERIFIED | Not tested |
| Content update | NOT VERIFIED | Not tested |

### 5. Remaining risks before the A6 re-gate

1. Real Content create contract: not verified.
2. Real Content update contract: not verified.
3. Field validation error shape: the real auth endpoints return `ERR_VALIDATION_ERROR` with `data[{FailedField, Tag, Value}]`. The app's field-error mapping assumes `{errors:{field:[…]}}`. Content validation errors have not been observed yet.
4. No `created_at` in the real Content fields, so the "Dibuat" column and the default `created_at desc` sort aren't supported by what the backend returns.
5. Unknown-ID 403: the app shows `Forbidden` where A6 expected `NotFound`. What the 403 means is not established.
6. S6 GET-body compatibility: not verified.
7. S7 API-key requirement: not verified.
8. Other risks backed by the evidence:
   - all 401 responses have an empty body (the app relies on the status code);
   - a rejected refresh returns 400, not 401;
   - the backend doesn't echo `X-Request-Id`;
   - tokens last about 30 days but the session lasts 7 days;
   - the unknown-ID harness step has no assertion;
   - no restricted second account, so backend-side denial is untested.

### 6. Safety confirmation

- **No application code changed.** Checksum of every non-`docs/` file in `frontend/` is identical before and after.
- **No test or harness code changed** (covered by the same checksum).
- **No runtime configuration changed.** `.env`, `.env.local` and `.env.test.local` checksums are identical.
- **No real write operation was executed.** This task made no backend requests at all.
- **No secret was exposed.** A scan of the changed docs found only placeholder or prose matches (`Bearer <REDACTED>`, `Bearer token`, etc.).

```text
$ git status --short          (frontend/, 261 entries, identical to the pre-task baseline)
...
?? docs/                      ← the whole docs/ tree is untracked, so doc edits don't change this list
...
?? test/
?? vitest.live.config.js

$ git diff --stat
 82 files changed, 900 insertions(+), 1902 deletions(-)   ← identical to the pre-task baseline

bl-whish$ git status --short
 M claude-summary.md
```

The 261 entries and the 82-file diff are the existing uncommitted A5.0–A6 work. This task didn't touch them, as both checksum comparisons show. Every file changed in this task is documentation. Nothing is committed.
