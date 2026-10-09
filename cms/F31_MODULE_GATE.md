# F31 — Manajemen Pengguna Module Gate

| Field | Value |
|---|---|
| Date | 2026-10-09 |
| Inputs | `F31_IMPLEMENTATION_REPORT.md`; coordinator gate logs 2026-10-09; source inspection |
| **Decision** | **CONDITIONAL GO — NON-PRODUCTION ONLY** (2026-10-09, §11). Exception: name / email search unavailable (G-10). Production release **NOT APPROVED**. History: PENDING → HOLD (§10) → CONDITIONAL GO (§11) |

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
- **Shared change outside the touch-point list:** `url-codec.ts` array-filter serialization. Justified; covered at unit level **indirectly** by `user-management.contract.test.ts:154` (via `userManagementSearchParams` → `toTableSearchParams`) and by E2E (`user-management.spec.ts:78`); there is no dedicated case in `url-codec.test.ts`. Recorded in implementation report §2.

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

## 9. Live READ Gate Attempt (2026-10-09 10:13 WIB)

**Result: NOT PERFORMED. The gate remains PENDING.**

| Check | Result |
|---|---|
| F31 application files changed since the automated evidence (09:21 WIB)? | no |
| Credentials in the coordinator shell (`F31_LIVE_ACCESS_TOKEN`, `A55R_*`, `KONG_API_KEY`) | **none available**: they exist only in the owner's terminal. Nothing was guessed or requested |
| Live requests sent | **0** (GET 0 · POST 0 · PUT 0 · PATCH 0 · DELETE 0) |
| Authorization preflight | **BLOCKED**: no identity available. `AUTHZ_INTERIM_GRANTS` is a frontend interim grant only and is not backend authorization (CA-04) |

**Prepared (not executed): Option B GET-only script** at `$TMPDIR/f31-live-read.mjs`, outside the repositories. `node --check` passes.

- **Safety:**
  - GET only; aborts on any other method;
  - only `/api/v1/cms/customers/users` and `/api/v1/cms/customer-areas`;
  - the token comes from `F31_LIVE_ACCESS_TOKEN` and is never printed;
  - no login POST;
  - no malformed filters and no injection payloads (the R9 empty case uses a random UUID string as a search keyword).
- **Cases:**

  | Case | Covers |
  |---|---|
  | R1 | default list (no `filters` keys) |
  | R2 | `customer.name` search, term taken from a sample row (G-10) |
  | R3 | `user.email` search (G-10) |
  | R4 | one branch, using ids taken from the sample's `customer_area_id` |
  | R5 | two branches |
  | R6 | `filters` omitted without a selection |
  | R7 | page sizes 15 / 25 / 50 / 100, page 1 / 2 overlap, page-1 repeat order (G-03), page beyond the last |
  | R8 | `customer-areas` lookup |
  | R9 | empty 200 vs error |
  | R10 | active / inactive counts in a 100-row sample (G-04) |

- **Output:** method, path, sanitized params, status, counts and booleans only. Evidence goes to `$TMPDIR/f31-live/evidence-<ts>.json`, with a secret / PII scan (JWT, bearer, email, phone, UUID). The script fails if the scan finds anything.

**Owner command** (from a terminal with an existing devb2b CMS access token):

```bash
export PATH=$HOME/.local/share/mise/installs/node/24.16.0/bin:$PATH
export F31_LIVE_CONFIRM_NON_PRODUCTION=yes
export F31_LIVE_ALLOWED_HOST=devb2b-api.gpos.id
export F31_LIVE_BASE_URL=https://devb2b-api.gpos.id
read -s "F31_LIVE_ACCESS_TOKEN?Access token (without 'Bearer'): "; export F31_LIVE_ACCESS_TOKEN; echo
node "$TMPDIR/f31-live-read.mjs"
```

**UI check (separate):** add `user-management.read` to `AUTHZ_INTERIM_GRANTS` in `frontend/.env.local` and restart the dev server. This is an owner action; it was not changed automatically.

**Error scenarios** (400 / 401 / 403 / 404 / 500, malformed or inconsistent responses): covered **by mocks only**, in the contract / page / E2E tests. They are not to be reproduced live.

**Decision rule after the owner run:**
- **GO** (non-production, read-only) only if R1 – R10 pass.
- **HOLD** if search, branch filter or pagination fails functionally.
- **PENDING** while there is no run.

Production release stays **not approved** in every case: CA-01 / CA-02 / CA-04 / G-13 are open.

## 10. Live READ Result (owner run, 2026-10-09 10:16 WIB; devb2b-api.gpos.id)

**Run summary:**
- **Script and token:** `$TMPDIR/f31-live-read.mjs` (GET only), run with the owner's token via `F31_LIVE_ACCESS_TOKEN`; the token is not recorded.
- **Evidence:** `$TMPDIR/f31-live/evidence-20261009031655.json` (16 observations).
- **Requests:** GET 16 · POST 0 · PUT 0 · PATCH 0 · DELETE 0.
- **Secret / PII scan:** 0 (script), re-checked by the coordinator: 0.

| Case | Live result | Verdict |
|---|---|---|
| R1 default list (no `filters`) | 200; 15 rows; `total_rows` 588; raw keys match the source contract (the frontend DTO drops `address`, `org_id`, `customer_id`, `customer_area_id`, `customer_channel_id`, `user_last_order`) | **PASS** |
| R2 search `customer.name` + keyword | **500 "Internal Server Error"** | **FAIL (backend)** |
| R3 search `user.email` + keyword | **500** | **FAIL (backend)** |
| R4 one branch (`filters[0]` `customer_area_id IN "…"`) | 200; 45 / 45; every row in the branch; total ≤ default | **PASS** |
| R5 two branches | 200; 50 / 50; every row in the two branches; total ≥ R4 | **PASS** |
| R6 `filters` omitted without a selection | R1 / R7 sent no `filters` keys and returned 200 | **PASS** |
| R7 page sizes 15 / 25 / 50 / 100 | all 200; rows = size; `total_rows` 588 consistent | **PASS** |
| R7 page 1 vs page 2 (take 15) | 0 overlap; page-1 repeat in the same order; page 41 → 200, 0 rows | **PASS** (single run) |
| R8 `customer-areas` | 200; 49 / 49; all ids UUID | **PASS** |
| R9 empty successful result (random keyword) | **500**: not testable, because any non-empty keyword fails (R2 / R3) | **NOT VERIFIED (blocked by the search defect)** |
| R10 status | 100-row sample: 69 active, **31 inactive**, 0 other | **PASS**: inactive users are returned on devb2b |

**Root cause of R2 / R3 / R9** (source plus live):
- **Mismatch:** `CmsGetPreloadBuyerList` joins with GORM aliases `Customer` / `User`; its own filter is `User.is_active = ?`. The search clause is built as `customer.name LIKE ?` / `user.email LIKE ?`, lower-case.
- **Effect:** MySQL on Linux treats table aliases case-sensitively, so every non-empty keyword produces an unknown-column error, returned as 500.
- **Legacy:** legacy sends the same `search_by` values, so search is **equally broken in the legacy CMS** on devb2b.
- **Frontend:** the frontend shows the typed error state with retry. It does not fabricate results and does not change `search_by`, which is a backend contract.
- **Remediation branch:** `fix/f31-cms-customer-sql-injection` keeps `customer.name` / `user.email` verbatim, so it would **not** fix this. The backend should map them to `Customer.name` / `User.email` (follow-up recorded).

**Decision:**

```text
F31 MODULE GATE: HOLD (functional — search)
List, branch filter, pagination, branch options, status display: PASS live
Search (Nama Relasi / Email): FAIL live — backend 500 on every non-empty keyword (G-10 confirmed; same in legacy)
Live WRITE: 0 · Production release: NOT APPROVED (CA-01 / CA-02 / CA-04 / G-13 open)
```

- **Why HOLD:** §9 states that search failing functionally means HOLD. Search is part of the locked F31 scope.
- **Path to CONDITIONAL GO:** the owner may explicitly accept "search unavailable until the backend fixes the alias case" as a documented **non-security** limitation, with the backend team as owner. That acceptance is the owner's decision and is not recorded here.
- **Path to GO:** the backend alias fix, then a rerun of R2 / R3 / R9.


## 11. Decision Record: CONDITIONAL GO — NON-PRODUCTION ONLY (2026-10-09)

### Precondition check

| Precondition | Result |
|---|---|
| Does the gate explicitly permit CONDITIONAL GO for a temporarily unavailable required feature? | **Yes.** §10 "Path to CONDITIONAL GO": the owner may explicitly accept "search unavailable until the backend fixes the alias case" as a documented **non-security** limitation, with the backend team as owner. The §9 rule (search failure → HOLD) is the default; §10 defines this owner-accepted exception |
| Is there written owner acceptance? | **Yes.** Project owner instruction "F31 — CONDITIONAL GO DECISION RECORD (NON-PRODUCTION ONLY)", 2026-10-09 |
| Is the limitation non-security? | **Yes.** Search is functionally unavailable (HTTP 500). No security finding is part of this acceptance |

### Decision

```text
F31 MODULE GATE: CONDITIONAL GO — NON-PRODUCTION ONLY
Exception (accepted): name / email search unavailable on the current devb2b backend (G-10)
Production release: NOT APPROVED
```

### Accepted functional limitation (G-10)

- **Observed live:**
  - `search_by=customer.name` with a non-empty keyword → HTTP 500;
  - `search_by=user.email` with a non-empty keyword → HTTP 500;
  - a random keyword → 500 as well (R2, R3, R9).
- **Cause:** a **source-supported diagnosis, pending backend regression verification.**
  - `repository/buyer.go` `CmsGetPreloadBuyerList` joins with GORM aliases `Customer` / `User` and itself filters `User.is_active`.
  - The search clause in `mapper/cms_customer.go` uses lower-case `customer.name` / `user.email`.
  - Table aliases are case-sensitive on MySQL / Linux.
  - The live 500 body is generic ("Internal Server Error"), so the database error text was not observed. The diagnosis is consistent with the evidence but not regression-proven.
- **Frontend behaviour (unchanged, required):**
  - the typed error state with "Coba lagi" retry;
  - no fabricated results;
  - no silently disabled error handling;
  - no contract change;
  - no undocumented workaround. The search controls remain, and the error is shown.
- **Owner:** the backend team responsible for the account-service customer-user list query (`GET /api/v1/cms/customers/users`).
- **Required remediation and evidence (G-10 stays OPEN until all pass):**
  1. Correct the search-field → SQL-alias mapping (`customer.name` → `Customer.name`, `user.email` → `User.email`, or equivalent).
  2. Keep parameterized keyword binding and the approved input validation. The fix should be combined with or follow the reviewed SQL remediation branch, which currently keeps the lower-case values and therefore **does not** fix G-10.
  3. Add backend regression tests for customer-name and user-email search.
  4. Show that no keyword, an empty result and an ordinary match all return 200 (never 500).
  5. After the fix is deployed to the test environment, rerun **R2, R3 and R9** as controlled GET-only live READ checks.

### Live READ evidence (unchanged, §10)

Owner run 2026-10-09 10:16 WIB, `$TMPDIR/f31-live/evidence-20261009031655.json`. 16 GET, 0 writes, scan 0.

| Case | Result |
|---|---|
| R1 | PASS |
| R2 / R3 | 500 (accepted limitation) |
| R4 / R5 | PASS (45 / 45, 50 / 50) |
| R6 | PASS |
| R7 | PASS |
| R8 | PASS (49) |
| R9 | NOT VERIFIED |
| R10 | 69 active / 31 inactive |

### Open items carried forward (not resolved by this decision)

| Item | Status |
|---|---|
| G-03 ordering | **OPEN**: one run with no overlap and the same repeat order does not prove deterministic ordering (no tiebreaker) |
| G-04 inactive visibility | **VERIFIED for the tested devb2b sample only**; other environments unknown |
| G-05 empty-result live behaviour | **NOT VERIFIED live** (blocked by G-10); mock-verified only |
| G-02 pagination | **VERIFIED live** (`total_rows` 588 consistent; page beyond the last → 200 with empty rows) |
| G-14 runtime evidence | **PARTIALLY RESOLVED** (search cases outstanding) |
| Backend authorization grants (F31-CA-04) | **NOT VERIFIED**: the token was accepted, but no role-grant export exists |

### Security exclusions (NOT accepted, waived, downgraded or resolved)

| Finding | Status |
|---|---|
| **F31-CA-01** | CRITICAL; SQL-injection remediation not merged or verified |
| **F31-CA-02** | HIGH; dynamic search / sort handling not remediated or verified |
| **F31-CA-04** | HIGH; backend role grants not evidenced |
| **G-13** | `cms_customer_channel.go` SQL concatenation; separate ticket |

**This CONDITIONAL GO covers none of them.**

### Scope of this decision

- Non-production (devb2b) use of the read-only F31 module.
- **Production release: NOT APPROVED.** It still requires the merged and verified backend SQL fix, CA-04 role-grant evidence and the G-10 fix, or a separate written security-owner decision.
