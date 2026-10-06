I couldn't record A6R-2 as VERIFIED. The PUT returned HTTP 200, but read-back shows `is_active` stayed `true` when the update asked for `false`. Name and value did update. I've recorded A6R-2 as **VERIFIED-WITH-RISKS** with a critical finding, and the docs are updated to match.

```text
A6R-1: VERIFIED
A6R-2: VERIFIED-WITH-RISKS

CREATE:
POST /api/v1/cms/contents → 201   (envelope {code:201, status:"OK", data:{message}, message}; no id returned)

UPDATE:
PUT /api/v1/cms/contents/{id} → 200   (envelope {code:200, status:"OK", data:{message}, message})

CREATE attempts: 1
UPDATE attempts: 1
DELETE attempts: 0

Read-back:
CREATE: verified (1 match by code; detail equals all submitted fields)
UPDATE: partially verified
  - id, code unchanged:   ✔
  - name updated:         ✔
  - value updated:        ✔
  - is_active = false:    ✘  persisted value is still true (by ID and by code)

Source changes:
none (src/, test/, config, .env*, package.json checksums identical before and after)

Documentation:
A6_WRITE_CONTRACT_READINESS.md → updated (+86: "A6R-1 / A6R-2 closeout"; earlier sections kept, marked historical)
claude-summary.md → updated (bl-whish, +44 on top of origin/main; not committed)
summary.md → updated (A6 row only, +2/−2)

A6 overall:
BLOCKED — D-A6R2-01: setting "Tidak aktif" shows success, but the record stays active
```

**The critical finding (D-A6R2-01).** In the A6 edit form, choosing "Tidak aktif" shows the success notice while the item stays active. The app reports success for a change that never happened.
- **What the app sends:** our code maps the form's `active: false` to `is_active: false`, and the unit test checks that `false` goes over the wire. The harness didn't record request bodies, though, so the real request containing `false` is inferred from code, not observed.
- **Cause:** unknown. Possibly the backend ignores `false` on update, or status changes go through a different field or endpoint. I didn't investigate with any more requests, as you instructed.
- **Related:** `is_active: false` on CREATE is also unverified; A6R-1 used `true`.

**Closed by the evidence:**
- CREATE returns 201 and UPDATE returns 200, matching what the app expects.
- The CREATE response has no ID; the app handles that (`id: null`, then redirects to the list).
- The test account's backend write permission is confirmed.

**Still open:**
- D-A6R2-01 (critical).
- `is_active: false` on CREATE.
- Duplicate-`code` behaviour.
- Whether `value: null` clears the field.
- Content validation error shape.
- No `created_at` in the response.
- Unknown ID returns 403.
- S6 GET-body support and S7 whether the API key is required.
- DELETE contract.
- Production grant model (OD-05/06), and no restricted account to test denial.
- Multi-instance refresh race (OD-25).
- 7-day session vs ~30-day token.

**Safety:** 1 CREATE and 1 UPDATE, no DELETE, PATCH, bulk operations or retries. Only the test record was changed (`68b42bae-…` / `A6R-TEST-20261001-062932`), and it stays on the backend as approved. Both evidence files scanned clean for secrets.

**`claude-summary.md`:** your local bl-whish clone is 3 commits behind `origin/main` and still had my earlier uncommitted edit. I built the new file on your latest `origin/main` copy (commit 69bdf65) and replaced the working-tree file. A plain `git pull` will refuse while it's modified, so copy the file aside, `git checkout claude-summary.md`, pull, and put it back.

**Diff check:**
- `git status --short` in `frontend/` still shows 261 entries; `docs/` and `test/` are untracked, so doc edits don't appear there.
- `git diff --stat` is unchanged at 82 files, 900 insertions, 1902 deletions.
- `git diff -- docs` is empty for the same reason; against the snapshot, only the two doc files above changed.

Nothing is committed. I've stopped here: no further live requests and no A6R-3.
