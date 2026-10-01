CREATE and UPDATE are both **READY-WITH-RISKS** for a future controlled real-backend test, and neither was run. The request side matches the legacy runtime capture exactly, but the real backend's success codes, response bodies, error shapes and the test account's write permission are all unverified. Only documentation changed, and nothing was sent to the backend.

## 1. Baseline (before the audit)

```text
$ git status --short     → 261 entries (existing uncommitted A5.0–A6 work; docs/ = one untracked "?? docs/")
$ git diff --stat        → 82 files changed, 900 insertions(+), 1902 deletions(-)
```

## 2. A6 readiness summary

```text
A6 READ    = SUBSTANTIALLY VERIFIED
A6 CREATE  = READY-WITH-RISKS
A6 UPDATE  = READY-WITH-RISKS   (only after CREATE produces a dedicated test record)
```

A6 as a whole stays **BLOCKED** (not complete). A5.5R stays **GO-WITH-RISKS**.

## 3. Legacy CREATE contract

**VERIFIED**, from the legacy code plus the A6 capture of what the legacy app sent:
- `POST /api/v1/cms/contents`, JSON, `Authorization: Bearer`, no API key, no query string.
- Body is exactly `{code, name, is_active, value}`:
  - `is_active` is a boolean (`'true'` → `true`, anything else → `false`);
  - an empty `value` is sent as `null`.
- `code` and `name` are required; if missing, the request never reaches the gateway. There are no length or format rules.
- Success only when the envelope `code == 201`. A `code 200` reply was treated as failure.
- Every error collapses into one generic flash message. The error body is never parsed.
- `store` doesn't call `checkAuth` (the other actions do); only the logged-in route group protects it.

**UNKNOWN:**
- the returned object, id and server-generated fields (legacy never reads them);
- the real backend's success code and error bodies.

## 4. Legacy UPDATE contract

**VERIFIED:**
- `PUT /api/v1/cms/contents/{id}`, JSON, Bearer, always the full 4-field body.
- `code` and `name` are required.
- Success when the envelope `code == 200`.
- The edit form never pre-selects `is_active` (a legacy defect).
- Failures use the flash key `Warning`, which no view shows, so they are silent.

**INFERRED:** an empty `value` becomes `null`, through the same normalisation as create.

**UNKNOWN:**
- whether the backend treats `null` or omitted fields as "clear" or "leave unchanged";
- the returned object;
- error bodies.

## 5. Contract comparison

| Contract | Legacy | Current Next.js | Status |
|---|---|---|---|
| CREATE method / endpoint | POST `/api/v1/cms/contents` | same | COMPATIBLE |
| CREATE body | 4 keys, boolean, `''` → `null` | `toContentBody` identical (test compares with the capture) | COMPATIBLE |
| CREATE headers | Bearer | Bearer + `Api-Key` + `X-Request-Id` | INTENTIONAL MIGRATION CHANGE (whether the key is required: UNKNOWN) |
| CREATE validation | required only, no message shown, input lost | zod: trim, required, length limits; checked in the browser and on the server; messages shown, input kept | INTENTIONAL MIGRATION CHANGE (length limits are my own safety bounds) |
| CREATE success | envelope 201 | success code 201; other 2xx → `Contract` | COMPATIBLE with legacy; real code UNKNOWN |
| CREATE error shape | never parsed | typed by status; 400 + `{errors}` → Validation | INTENTIONAL MIGRATION CHANGE; field errors are a POTENTIAL DEFECT (§6) |
| UPDATE method / endpoint | PUT `/{id}` | same, id checked by `isContentId` | COMPATIBLE |
| UPDATE body / semantics | full body | full body | COMPATIBLE; backend `null` semantics UNKNOWN |
| UPDATE `is_active` | never pre-selected | pre-filled from the detail response (presence confirmed on the real backend) | INTENTIONAL MIGRATION CHANGE (defect fix) |
| UPDATE success | envelope 200 | success code 200 | COMPATIBLE; real code UNKNOWN |
| UPDATE error shape | silent | typed and shown | INTENTIONAL MIGRATION CHANGE; real shape UNKNOWN |
| UPDATE missing record | any failure → list | 404 → `notFound()`, 403 → AccessDenied; the real unknown ID returned **403** | POTENTIAL DEFECT (UX) |

## 6. Validation error contract

- **Legacy:** the backend body is never parsed.
- **Real backend, auth endpoints only:** 400 with `error_code: "ERR_VALIDATION_ERROR"` and `data: [{FailedField: "<Struct>.<Field>", Tag, Value}]`.
- **Real backend, Content:** never observed.
- **Current mapping:** 400 with `{errors: {field: [...]}}` → Validation; otherwise → Business. So the auth-style shape would show up as **one "Validation Error" alert at the top of the form, with no per-field messages**. That fails visibly, keeps the user's input, and logs nothing; it's degraded, not unsafe.
- **Final status:** **NOT VERIFIED**.

## 7. Known contract risks

| # | Risk | Status |
|---|---|---|
| 1 | Validation error shape mismatch (above) | NOT VERIFIED / POTENTIAL DEFECT |
| 2 | **No `created_at` or `content_date` in real rows.** The "Tanggal Konten" column will always show "—". The default sort is `created_at desc`, and that ordering is unverified | OPEN CONTRACT RISK |
| 3 | **Unknown ID returns 403**, so the update page shows AccessDenied where it relies on 404 for `notFound()`. The reason for the 403 is UNKNOWN | OPEN CONTRACT RISK |
| 4 | S6 GET body: the app doesn't need it; whether the backend accepts one is unknown | NOT VERIFIED |
| 5 | S7 API key: always sent; whether it's required is unknown | NOT VERIFIED |
| 6 | **CREATE false failure → duplicate.** If the real backend answers with a code other than 201 (e.g. 200), or a timeout hits after the backend saved the record, the app reports failure even though the record exists. A user retry would then create a duplicate. Also unknown: whether duplicate `code` values are rejected (409) | UNKNOWN |
| 7 | UPDATE: success code 200 unverified; `value: null` semantics unknown | UNKNOWN |
| 8 | Authorization: production grants (`AUTHZ_INTERIM_GRANTS`, OD-05/06) are your decision and still open; the test account's backend write permission is unknown (login returns only `role_id` and `role_name`); no restricted account for a denial test | UNKNOWN |
| 9 | Cleanup: no migrated delete; the legacy DELETE endpoint was never captured | NOT VERIFIED / out of captured contract |

Authorization itself is checked three ways on the current side:
- the route guard on each page;
- the use case's `require` call, before validation and before any backend request;
- Server Actions run only through `runAction` → data-access layer → use case.

Menu and button visibility is UI only. Mock-backend tests show a read-only user produces 0 write requests, and the real backend run (S8) shows a locally denied request makes 0 backend calls.

**Preconditions for a future controlled CREATE/UPDATE test:**
- your approval for writes on the non-production gateway, and a test-record naming convention (e.g. `A6R-TEST-<timestamp>`);
- a cleanup decision: either accept a leftover test record, or separately approve and verify DELETE;
- exactly one attempt with no retry, followed by reading the record back;
- a harness extension that allows writes only to the test record;
- UPDATE only on the record CREATE produced.

## 8. Real backend safety

```text
Real CREATE executed: NO
Real UPDATE executed: NO
Real DELETE executed: NO
Real state-changing request: NO   (no request of any kind was sent to the backend)
```

## 9. Files changed (documentation only)

- `docs/architecture/reviews/A6_WRITE_CONTRACT_READINESS.md` (new, +243)
- `docs/architecture/reviews/summary.md` (A6 row and "Latest" line, +2 / −2)

No source, test, harness or config files changed. Checksums of every non-`docs/` file and of `.env`, `.env.local` and `.env.test.local` are identical before and after. `bl-whish/claude-summary.md` is unchanged.

## 10. Final diff

```text
$ git status --short     → 261 entries, identical to the baseline ("?? docs/" covers both doc files)
$ git diff --stat        → 82 files changed, 900 insertions(+), 1902 deletions(-)   (identical to the baseline)
$ git diff -- docs       → (empty: docs/ is untracked)
Doc changes vs the start-of-task snapshot:
  A6_WRITE_CONTRACT_READINESS.md | 243 +++
  summary.md                     |   4 +-
```

Every change is documentation or status. Nothing is committed.
