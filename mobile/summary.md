Phase 1 readiness gate: no implementation task may begin today

No written implementation authorization exists and no approver has been named. The PRD is still DRAFT — NOT APPROVED FOR IMPLEMENTATION with all six gates not passed. The plan was consistent except for two problems, which I corrected in PHASE1_BACKLOG.md. The full assessment is in its new §10.

What may begin now (preparation only, no application changes):
- Draft architecture decision records, kept outside the app repo until accepted (P1-F01).
- The test strategy and the mapping from acceptance criteria to tests (P1-F10).
- The environment-config design: names only, no values (P1-F07).
- A list of every route marked ON or OFF for Phase 1, which navigation work (P1-F06) needs first.
- The legacy design-token mapping table (P1-F11).
- Sending the owner requests listed below.

What needs a limited written authorization first:
- The engineering foundation: service wiring (F02), API client (F03), app state (F05), navigation (F06), CI and tests (F10) and template clean-up (F14).
- Then session handling with interim secure storage (F04), config structure for an internal variant only (F07), log redaction (F09) and the design system (F11).
- The authorization has to be written by the authorizer, not by me, and stored as decisions/AUTH-P1-FOUNDATION.md. It should state the authorizer's name and role, the tasks and branch covered, and the exclusions: no business features, no production identity or config, no secrets in the repo, no cart, payment or regulated code. It should also say it approves no PRD decision.

Blockers by owner role

┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬────────────────────────────────────┐
│                                                    Blocker                                                     │             Owner role             │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────┤
│ Possibly exposed API keys (P1-F08)                                                                             │ Security + Backend                 │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────┤
│ Staging, test accounts, internal distribution (P1-F13)                                                         │ Backend + QA + Release/DevOps      │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────┤
│ Internal app identity and internal signing                                                                     │ Release/DevOps                     │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────┤
│ Push and deep-link registrations; web-viewer policy (PRD-D17)                                                  │ Release/DevOps; Security + Product │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────┤
│ Home compliance pop-ups (P1-H03, PH-03)                                                                        │ Compliance                         │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────┤
│ All feature tasks: need Phase 1 PRD approval or a feature-level authorization, plus the foundation and staging │ Product owner + Tech lead          │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────────────────────────────────┤
│ Registration beyond internal testing (T&C, PRD-D24)                                                            │ Legal                              │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴────────────────────────────────────┘

The two corrections
1. In-scope acceptance criteria: 287 → 248. 39 criteria expected things Phase 1 must not have, which contradicted the exit criteria that keep cart and blocked screens off:

| Reason                                      | Count |
|---------------------------------------------|-------|
| Cart or transaction behavior                | 9     |
| Links that open Orders, Invoices or Loyalty | 10    |
| APJ/SIPA badges and regulated behavior      | 12    |
| Update overlays                             | 5     |
| Four tabs including Pesanan and Pembayaran  | 2     |
| Home loading the cart                       | 1     |
   They are reclassified, not deleted, and exit criterion E5 now says 248.
2. "Proceed now?" column renamed to "Eligible once authorized?" The old name read like permission to start.

The six acceptance criteria needing owner action (backlog §10.3)

┌──────────────┬───────────────────────────────────────────────────────────────────────────────────┬───────────────────────────────────┐
│      AC      │                                   Action needed                                   │            Owner role             │
├──────────────┼───────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────┤
│ AC-HOME-039  │ Rewrite as an observable result, or move it to Phase 2/3                          │ Requirements lead + Compliance    │
├──────────────┼───────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────┤
│ AC-SHAPI-001 │ Define the expected error per module                                              │ Requirements lead + Product owner │
├──────────────┼───────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────┤
│ AC-SHAPI-002 │ Define the generic error and retry behavior                                       │ Requirements lead + Product owner │
├──────────────┼───────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────┤
│ AC-SHOBS-001 │ Decide which analytics events to keep (DEC-025), then split it per event          │ Product owner + Requirements lead │
├──────────────┼───────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────┤
│ AC-SHVER-004 │ Reword after the OTA-update decision (PRD-D29); not needed for Phase 1            │ Tech lead + Release/DevOps        │
├──────────────┼───────────────────────────────────────────────────────────────────────────────────┼───────────────────────────────────┤
│ AC-SHVER-006 │ Add the missing requirement link and decide the effect of a version-check failure │ Product owner                     │
└──────────────┴───────────────────────────────────────────────────────────────────────────────────┴───────────────────────────────────┘

Cart, checkout and screen check. The plan defers 41 cart requirements, keeps the 33 inactive screens, Stories and Phase 2/3 routes switched off, and contains no checkout, payment or cart-write calls. Two conflicts remain open:
- Home loads the cart on startup (FR-HOME-007).
- Deep links and push messages point to Phase 2/3 screens, so a "not available" fallback would be new behavior.

App identity. No confusion found. The production ID com.dexagroup.gposb2b (with the legacy key) must not be used for internal builds, because it would collide with the live app on testers' phones. The RN app still uses the template ID, and the internal ID is undecided. Deep-link files for an internal app should go only on devb2b.gpos.id, never on b2b.gpos.id.

Conflicts with the PRD, recorded but not resolved (C1–C7):
- C1: the original "Proceed now" wording. Fixed.
- C2: hiding two of the four tabs.
- C3: Home's cart read.
- C4: Phase 2/3 link targets.
- C5: APJ/SIPA badges on Profile.
- C6: update overlays left out of the internal test.
- C7: Registration in Phase 1 while the T&C decision is open.

Proposed sequence (all dates uncommitted).
- Wed 14 Oct: preparation and owner requests.
- Thu 15: decision records accepted, service wiring, template clean-up (needs the authorization and a named Tech lead).
- Fri 16: API client and app state.
- Mon 19: navigation and CI (needs the route list and a CI host).
- Tue 20: session handling and config (needs the refresh contract or staging).
- Wed 21: design tokens; Auth only with a feature authorization and staging access.
- Thu 22: shell, Home and Search (needs the tab and cart-read decisions).
- Fri 23: Catalog, product detail, and a first internal build candidate (needs internal identity, signing, distribution, and the keys resolved).
- From Mon 26 Oct: Profile, Content, Notifications, Registration, then running the 248 criteria.

Realistically, next week can deliver the foundation plus Auth and read-only Home, Search, Catalog and product detail. Full Phase 1 internal-test readiness is unlikely by the 23rd, and any late dependency pushes every later day back.

Evidence needed for the first internal test build:
- The keys question resolved by its owner.
- Internal app ID, signing and distribution channel set up.
- Staging and test accounts available, with no production endpoints in the build.
- CI green and the foundation tests passing.
- Log redaction verified.
- Every route's ON/OFF flag confirmed against the agreed list.
- A feature-level authorization for whatever the build contains.
- If push or deep links will be tested: internal push/analytics registrations and deep-link files on the dev domain.

Files changed: only migration/approval/PHASE1_BACKLOG.md (two corrections plus the new §10). No other approval file, decision record, PRD, evidence or application file was touched.

Validation:
- All links resolve.
- All 525 IDs cited in the backlog exist in the PRD, requirements or audit documents.
- The corrected in-scope list contains exactly 248 criteria.
- No protected document was modified today.
- The React Native project shows only your 2 earlier edits, and the legacy repo is clean.
- No decisions/ folder exists, so no approval or approver identity was invented.

I haven't started any implementation.
