S2.2 is finished: three reports, one per workstream.
- Workstream A (route classification): CONDITIONAL GO. I found and fixed three critical security holes, but seven design decisions are still open for you.
- Workstream B (auth contract fix): GO.
- Workstream C (permission migration): GO for the plan only. Nothing was migrated.

Workstream A — route classification

I raised all three critical findings with you before fixing them:
1. Workflow Registry (/workflow-registry). A tenant user with only the normal workflow permissions could read, update and delete another tenant's workflow definitions, and create one inside another tenant. The table has no RLS (row-level security), so nothing else stopped it. Reproduced on PostgreSQL.
   - Now: tenants can change only their own definitions, new definitions always go into the caller's tenant, and platform principals are refused.
2. Audit logs (/audit). A tenant user with core.audit.read could read every tenant's audit trail, including the old and new values of business records. Reproduced on PostgreSQL.
   - Now: tenant users see only their own tenant. The cross-tenant view is kept for the signed platform principal only.
3. Scheduler (/scheduler). A job's handler_path came from the caller and was loaded by dynamic import. Any tenant superuser could therefore make the server run arbitrary code. I identified this from the code and deliberately did not demonstrate it.
   - Now: only explicitly registered handlers can run, and the whole scheduler is platform-only.

Other fixes:
- Metadata: platform principals are refused, and a create that names another tenant is rejected.
- Now platform-only: /system/status, /system/services, the detailed /health/ report and widget-type registration.
- Still public: /health/live and /health/ready, which is what Kubernetes, Docker and nginx use.

Visible behaviour changes:
- Tenants can no longer modify Studio-published workflows through /workflow-registry. Studio's own publish and archive routes still work.
- Tests that read other tenants' audit rows now do so as the platform principal.
- Several test fixtures used MagicMock users that passed every permission check by accident. They now use real users.

Seven decisions are left open (D-1 to D-7 in the report). The most important is D-2: Studio publishes every tenant's workflows into one shared bucket keyed by workflow code. Two tenants using the same code end up sharing one definition. That is a design problem, tied to the Workflow-engine risk, and I did not change it.

Workstream B — auth contract fix

- Fix: the shared user lookup, permission loading and platform-scope rule now live in one place, app/core/auth/issuance.py. HTTP login, HTTP refresh and the contract all use it.
- HTTP login and refresh are unchanged: the tokens carry the same claims as before.
- Contract behaviour:
  - unknown, inactive or deleted users are rejected;
  - refresh re-reads the account from the database and copies nothing from the presented token;
  - the optional tenant argument only narrows the check; it never selects a tenant;
  - the tokens pass the normal validation.
- Bug fixed along the way: the old contract lookup could not see tenant users under RLS.
- Pins moved: the S2 rule that platform scope is minted in exactly one function now points at the new module. The S2.1 tests that pinned the old crash were updated.

Workstream C — permission migration plan

- The problem: the database treats a permission as (resource, action, scope) and ignores the module. A second module's permission with the same name can't be stored at all. A permission with no module acts as a wildcard across every module.
- The plan:
  - pre-flight checks that block the migration on any problem row (all pass locally);
  - safe ordering: the new constraint goes in before the old one is dropped;
  - existing grants preserved;
  - no automatic deletes, because deleting a permission row automatically deletes the grants linked to it;
  - rollback limits documented.
- Your decisions before implementation: whether module_name becomes NOT NULL; whether scope stays in the key; and splitting the release so the old constraint is dropped later.

Test results

┌───────────────────────────────────────────────┬───────────────────────────────────────────────────────────────────────────────────────┐
│                     Suite                     │                                        Result                                         │
├───────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ Unit (excluding test_engine_execution.py)     │ 3,881 passed                                                                          │
├───────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ Top-level integration                         │ 21 passed                                                                             │
├───────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ SQLite workflow tier                          │ 172 passed, 5 skipped (pre-existing)                                                  │
├───────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ PostgreSQL, 30 files in one run               │ 334 passed, 1 expected failure (the deferred database-level case from N-2, not a fix) │
├───────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ PostgreSQL Sales/Accounting, one file per run │ 38 passed                                                                             │
├───────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ Playwright                                    │ 137 passed                                                                            │
├───────────────────────────────────────────────┼───────────────────────────────────────────────────────────────────────────────────────┤
│ Mutation checks                               │ 17 of 17 caught                                                                       │
└───────────────────────────────────────────────┴───────────────────────────────────────────────────────────────────────────────────────┘

- Playwright, first run: 1 timeout in a Form Builder test while the unit suite was running at the same time. It passed when re-run alone, and a full idle re-run passed 137/137.
- Changed after the Playwright runs: widget-type registration. No spec or frontend code calls it, so I didn't re-run Playwright for it; the final unit run covers it.
- Not run: test_engine_execution.py, the whole PostgreSQL directory in one run, Vitest, any non-test database, and a demonstration of the scheduler issue.

S1 ownership enforcement and S2 principal separation still pass all their tests.

Environment

- I worked only on the local test DB.
- Leave and the probe module were activated for the run and restored to inactive.
- Global Studio rows are unchanged at 596 / 592 / 0.
- The runs left tenant-owned test rows behind; nothing was cleaned up.

Reports

- docs/architecture/reviews/N2B_S2_2_ROUTE_CLASSIFICATION_AND_PRINCIPAL_BOUNDARIES.md
- docs/architecture/reviews/N2B_AUTH_CONTRACT_TOKEN_MINTING_FIX_REPORT.md
- docs/architecture/reviews/N2B_PERMISSION_IDENTITY_MIGRATION_PLAN.md

S3 was not started and the migration was not executed.
