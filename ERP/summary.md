Phase 2.5 is finished: both blockers are closed, and the report now says GO for Phase 3 (the Visual Form 
Builder). I haven't started Phase 3; it needs its own brief.
                                                                                                         
B-1: listing what a form can bind to (GET /api/v1/capabilities). The previous session's uncommitted code was sound, so I kept it with no changes. One design decision to note: access is all-or-nothing behind 
core.forms.design. The list is not trimmed to the capabilities the caller has business permissions for. Form designers usually have no business permissions, so trimming would show them an empty list. A desig
can't use a form they publish; the browser test confirms they get 403.                                                                                                                                         
B-2: a generic runtime view at /forms/:formKey.                                                              - It renders any published form version: sections, columns, show/hide/readonly rules, typed submis
  placed under the right field, and a 409 if the version was replaced after the page loaded.                 - SchemaForm is unchanged. To make a single field readonly, the view gives each field its own Sche
  because SchemaForm's only readonly switch (disabled) applies to all its fields at once.                    - The browser rule logic and the server's reference logic run against one shared test-case file in
  and Vitest, so if either changes the other's tests fail.                                                   - A test fails if the view's code names any business module, field or form key, or calls anything 
  /form-runtime. I planted a field name to confirm the test catches it.                                      - The view is not in the sidebar and cannot create or edit forms, so it is not a builder.         
                                                                                                             
Playwright on the real backend and real Postgres: 4/4 pass.
- FR1: submitting through the form creates a real leave request, checked through the Leave module's own read API. The only POST the browser made was to /form-runtime.
- FR2: invalid dates are rejected by the business capability, not the form, and nothing is saved.
- FR3: a user without permission and a user from another tenant are both refused.
- FR4: publishing v2 makes an open v1 page get a 409; a reload shows v2, and v1 is kept archived unchanged.

The existing Schema-to-Form and leave-management specs still pass: 19/19 in the same run.

┌──────────────────────┬─────────────────┬─────────────────┐
│        Suite         │     Before      │       Now       │
├──────────────────────┼─────────────────┼─────────────────┤
│ Architecture         │ 8               │ 8               │
├──────────────────────┼─────────────────┼─────────────────┤
│ Unit                 │ 3,597           │ 3,607           │
├──────────────────────┼─────────────────┼─────────────────┤
│ Integration          │ 179 + 5 skipped │ 179 + 5 skipped │
├──────────────────────┼─────────────────┼─────────────────┤
│ Real Postgres        │ 146             │ 148             │
├──────────────────────┼─────────────────┼─────────────────┤
│ Vitest               │ —               │ 664             │
├──────────────────────┼─────────────────┼─────────────────┤
│ Type-check and build │ —               │ pass            │
└──────────────────────┴─────────────────┴─────────────────┘

Docs
- New closure doc: docs/architecture/reviews/FORM_BUILDER_PREREQUISITES_READINESS.md.
- FORM_DEFINITION_FOUNDATION_READINESS.md has a re-issue note at the top.
- FORM_DEFINITION_PLATFORM.md has new sections on discovery (§5.1) and the runtime view (§7).

Things you should know
- Seed script change: seed_worklist_e2e.py now adds the core.forms.* permissions and two designer users, phase25_form_designer_a and phase25_form_designer_b. I ran it on the local dev database.
- Machine and database state: I installed Playwright's Chromium (it was missing). I activated leave_management for the test run and deactivated it afterwards, so the module states are back to how they were. The test runs left some uniquely named test forms and leave requests in the dev database.
- Findings I noted but didn't fix, all out of scope:
  - A global handler replaces every 404 message with {"error":"not_found"}, so the view shows a generic "not available" message.
  - The seed script looks up existing permissions without checking the module name. Nothing collides today.
  - npm run lint can't run because the repo has no ESLint config.
- Still open from Phase 2, none blocking: conditions C-1 to C-5. The one that matters most for planning Phase 3 is C-5: there is still only one capability a form can bind to (create leave request).
- Nothing has been committed.
