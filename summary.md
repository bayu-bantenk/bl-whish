A6 is **BLOCKED**, because the real backend still can't be reached, so none of its behaviour is verified. The Content list, create and edit pages are built and pass every test against the mock backend. Nothing is committed.

```text
A6 STATUS:        BLOCKED. The slice works against the mock backend; the only blocker is that the real backend can't be reached.
FEATURE:          Content (list, create, edit)
PRODUCTION ROUTE: /dashboard/content, /dashboard/content/create, /dashboard/content/update/[id]
IMPLEMENTED:
  - List with paging, page size, sort, search, state kept in the URL, error vs empty states, retry, 403.
  - Create and edit forms: server validation, field errors that keep the typed input, no duplicate submit, redirect with a "saved" notice.
  - Menu entry and breadcrumbs.
NOT IMPLEMENTED:
  - Delete and bulk delete (never captured; the old bulk message is inverted).
  - Rich text editor (the old app used a plain textarea).
  - Upload (Content has none).
REAL BACKEND:     BLOCKED. `npm run test:live` stops at its safety check: "A5.5R BLOCKED by safety gate: A55R_CONFIRM_NON_PRODUCTION=yes not set".
                  No confirmed gateway host or test account (OD-02).
                  What the old app sends to the gateway was recorded for list, detail, create and update, but no real backend replies were seen.
ARCHITECTURE:     page / Server Action → data-access layer → use case → repository → the single server-side gateway client.
                  The old test fixture became the production `src/packages/content` package. Architecture tests pass.
AUTHORIZATION:    content.read for the list; content.create and content.update (new) for the forms and their actions.
                  Access is checked on the server before any backend call: a user without the grant gets 403 and the backend is never called.
                  Grants come from the new `AUTHZ_INTERIM_GRANTS` setting. It is empty by default, so nobody can open Content until an owner sets it.
DATATABLE:        Uses the shared table from A5.5 with the production Content columns. Row "Ubah" links no longer prefetch.
FORM:             Required-field messages, status pre-filled on edit (the old app never did this), 422/400/409/500/network errors shown separately.
                  After a 401 the save is not re-sent automatically.
UPLOAD:           Not applicable.
UNIT:             npm run quality: exit 0, 35 files, 508 passed (478 before A6)
INTEGRATION:      Covered in the unit total:
                  - content-write.contract (16): requests match what the old app sends.
                  - content-list.contract (24).
                  - content-pages (11).
                  - content-form.production (9).
E2E:              CI=1 npm run test:e2e:full: 65/65; 5 consecutive runs clean.
                  9 new Content tests, including a read-only user instance that gets 403.
ACCESSIBILITY:    axe (WCAG 2.1 A/AA, no rules disabled) passes on list, create with errors, edit, and 403. Keyboard and screen-reader semantics checked.
SECURITY:         The browser only talks to the app and storage, never with an Authorization header.
                  No tokens or secrets in HTML, RSC, storage or server logs.
                  The browser bundle contains no gateway paths, API field names or capability names (checked with exact-text search).
BUILD:            next build exit 0; the three Content routes are present and no test-only routes ship.
BUNDLE:           check:bundle PASS (34 files); 232 KB JS on the list page.
OPEN RISKS:
  - RK-A6-01 (critical): the real contract, success codes and error formats are unverified.
  - RK-A6-02: gateway host / login ambiguity (OD-02).
  - RK-A6-03: `AUTHZ_INTERIM_GRANTS` applies to every signed-in user; needs an owner decision (OD-05/06).
  - RK-A6-04: if the detail response has no `is_active`, edit shows an error instead of guessing.
  - RK-A6-05: the field-error format is assumed, not seen.
  - RK-A6-06: the old app also sends a body on the list GET; the new one doesn't (OD-31).
  - RK-A6-07: a retry E2E flake (2 in about 10 runs) has an unproven cause. None in the last 5 runs; the test now checks exactly one backend call.
  - RK-A6-08: input length limits are my own safety bounds, not rules from the old app.
  - RK-A6-09: E2E still doesn't run in CI.
DEFERRED:
  - Delete (would need a content.delete capability and a confirm dialog).
  - Real-backend check: run test:live against a confirmed non-production gateway, then add a read-only detail check.
  - Per-account permissions.
  - Split the uncommitted work into commits.
DOCUMENT:         docs/architecture/reviews/A6_FIRST_PRODUCTION_VERTICAL_SLICE.md
                  docs/architecture/contracts/legacy-api/content-write.md
```

Where the new behaviour differs from the old app, the reason is in the review doc's "Legacy behaviour → new behaviour" table. Examples: edit now pre-selects the status, update failures are visible, validation messages are shown, and the "All" page size is dropped.

A6 becomes GO-WITH-RISKS once `npm run test:live` passes against a confirmed non-production gateway with a test account. That needs from you or the backend owner:
- confirm the target gateway and login type (OD-02);
- provide a test account;
- decide what `AUTHZ_INTERIM_GRANTS` should be in each environment.

The old app's saved session files are intact (98) and its git status is unchanged. Your dev server on :4000 was not touched.
