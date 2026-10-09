# F31 — Manajemen Pengguna Module Gate

| Field | Value |
|---|---|
| Date | 2026-10-09 |
| Inputs | `F31_IMPLEMENTATION_REPORT.md`; coordinator gate logs 2026-10-09; source inspection |
| **Decision** | **PENDING**: implementation verified; **not GO**. Waiting for the owner's GET-only live READ and the release / security decision |

## 1. Gate Decision

```text
F31 MODULE GATE: PENDING (NOT GO)
Implementation: VERIFIED (READ-only) · Quality PASS · Build PASS · Bundle PASS · F31 E2E 10/10
Full E2E: 177/182 under load; all 5 failures pass in isolated rerun (31/31)
Live READ: NOT PERFORMED · Live WRITE: 0
Backend security: CA-01 CRITICAL / CA-02 HIGH open (fix not merged) · CA-04 HIGH open (grants unverified)
Production release: NOT AUTHORIZED
```

Automated tests alone cannot make this GO.

**Next decision point after the owner's live READ:**
- **CONDITIONAL GO:** if the live READ passes and the backend findings remain only documented dependencies, then release still depends on §8.
- **HOLD:** if the live READ fails on an F31 operation.

## 2. Scope Verification

| Item | Result | Evidence |
|---|---|---|
| List, search (name / email), branch multi-select, pagination 15–100, fixed sort, status badge, loading / empty / error / retry | implemented | implementation report §1, §6 |
| Detail, status filter, sort controls, export, create / edit / delete / toggle / bulk | **absent** | scan of the package and route: no non-GET method, no `/status`, no detail route, no export |
| Write capability | none (only `user-management.read`) | `capabilities.ts` |
| Dependencies | unchanged | `package.json` / lock dated 2026-09-30 |
| Backend | untouched | — |

## 3. Architecture and Authorization

- **Request path:** Page → DAL → use case → port → `'server-only'` repository → shared gateway. No new client or framework.
- **`user-management.read` checks** (fail-closed):
  - registry (menu hidden);
  - `guardRoute('user-management.list')`;
  - `authorization.require` first in **both** `list` and `branchOptions` (0 backend calls when denied: unit + E2E).
- **Frontend gating is not backend authorization:** CA-04 is open.
- **Shared change outside the touch-point list:** `url-codec.ts` array-filter serialization. Justified, E2E-covered, no unit test. Recorded in implementation report §2.

## 4. Automated Evidence

| Gate | Result |
|---|---|
| `npm run quality` | PASS: 75 files, 1127 / 1127; tsc 0; eslint 0 errors (28 pre-existing warnings) |
| F31 unit tests | 28 / 28 (contract 18, pages 10) |
| `npm run test:e2e:full` | 177 / 182. Failures: `user-management.spec.ts:105` (login-hook timeout), `faq.spec.ts:25` and `:44` (timeouts), `form.spec.ts:80` (login-hook timeout), `auth.spec.ts:46` (refresh count 3 vs 2), at load average 13–16 |
| Isolated rerun (E2E build) of `user-management`, `auth`, `faq` and `form` specs | **31 / 31 PASS** (F31 10 / 10) |
| `npm run build` / `npm run check:bundle` | PASS / PASS |
| Client wire scan | 0 |
| `git diff --check` | PASS |

The `auth.spec.ts:46` mismatch is noted for watch; F31 touches no auth code.

## 5. Security Evidence (frontend)

| Check | Result |
|---|---|
| Only GET requests | static scan plus the E2E mock records GET only |
| Parameters | `search_by` / `sort_by` / `asc_desc` constants; branch column / operator constants; only UUID-validated, quoted ids; no `filters` without a selection |
| Hostile URL values (`ALL`, `") OR 1=1 --`) | dropped before any request (E2E) |
| Personal data | excluded fields never mapped; no logging; no identity headers |
| Secrets in code / tests | none |

**These controls are defence in depth.** They do **not** remediate CA-01 / CA-02.

## 6. Open Findings

See `F31_BACKEND_COMPATIBILITY_GAPS.md`.

| Finding | Status |
|---|---|
| F31-CA-01 | CRITICAL, open (backend fix reviewed CONDITIONAL PASS, **not merged**) |
| F31-CA-02 | HIGH, open |
| F31-CA-04 | HIGH, PARTIALLY VERIFIED |
| F31-CA-13 | MEDIUM, open in the backend; never triggered by the frontend |
| G-03 / G-04 / G-10 / G-14 | runtime NOT VERIFIED |
| G-13 | `cms_customer_channel.go`, separate follow-up |
| Test gap | no `url-codec` array unit test |

## 7. Live READ Plan (owner-run, GET only, not performed)

**Option A: existing harness.** READ-only adapter `test/live/modules/user-management.ts`, no write adapter. It logs in and out via POST (authentication only), so use it only if that is acceptable.

```bash
cd frontend
LIVE_MODULE=user-management npx --no-install vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts
```

**Option B: GET-only, token-based.** Adapt the F27 script (`F27_MODULE_GATE.md` §13) by changing `LIST` to `/api/v1/cms/customers/users`, the allowed paths to that list plus `/api/v1/cms/customer-areas`, and the cases to those below.

| Case | What to check |
|---|---|
| R1 | session accepted |
| R2 | default list (`search_by=customer.name`, `sort_by=aam_customer_id`, `asc_desc=desc`, `page=1`, `take=15`): status, envelope, row shape, `total_rows` |
| R3 | search by `customer.name` and by `user.email`, with a term from a row: 200 and every row matching (G-10) |
| R4 | branch filter with one or two real area ids from `customer-areas`: rows' area matches; `total_rows` consistent |
| R5 | page 1 / 2 overlap check (G-03); page beyond the last → 200 with empty rows |
| R6 | `customer-areas` lookup (200) |
| R7 | count of rows with `user_activation=false` in a sample (G-04) |

Throughout: secret scan 0; mutations 0. **No** hostile or malformed live requests.

## 8. Release / Security Decision (owner)

Production exposure needs one of:
1. The backend fix merged into `development`, with the post-merge gate passing, plus CA-04 role-grant evidence for the four endpoints.
2. A written, authorized security-owner decision recorded in `cms/`.

Neither exists today.
