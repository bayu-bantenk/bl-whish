Verdict: the S2.3 plan is a CONDITIONAL GO, and S3 is NO-GO. It isn't a plain GO because several decisions still need an owner, and S3 itself hasn't been authorized. I also found one serious new problem in how Studio publishes workflows.

New finding W-1, high and possibly critical (found by reading the code; not reproduced, because reproducing it would write data, which this phase forbids):
- When a tenant publishes a workflow from Studio, it goes into one shared bucket keyed by the workflow code the user chose, not into that tenant's own space.
- That shared definition then becomes global, so any tenant can start it.
- If tenant B publishes a draft using tenant A's workflow code, B adds and activates a new version of the workflow tenant A actually runs.
- Plan: reproduce it first, then fix it in a dedicated Workflow Boundary phase (stage WB-1).

Decisions closed

┌─────────────────────┬──────────────────────────────────────────────────────────────────────────────────────────┬─────────────────────────────────────────────────────────────────────────────────┐
│        Item         │                                 What the evidence shows                                  │                                    Decision                                     │
├─────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
│ D-4 Permission      │ No route can change permissions over HTTP                                                │ Leave reading as is; any future write path is platform-only                     │
│ catalog             │                                                                                          │                                                                                 │
├─────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
│ D-5 Gateway metrics │ All 40,953 local metric rows have no tenant, and the summary returns raw request paths   │ Platform-only                                                                   │
│                     │ across all tenants                                                                       │                                                                                 │
├─────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
│ D-6 /ws/stats       │ Unauthenticated, shows how many tenants and users are connected, and nothing consumes it │ Platform-only                                                                   │
├─────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
│ C-D1                │ No permission rows lack a module; a missing module silently grants across all modules    │ Make module_name NOT NULL; a deliberate cross-module grant can still be written │
│                     │                                                                                          │  as '*'                                                                         │
├─────────────────────┼──────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────────────────────────────────────────────────────────────────┤
│ C-D3                │ —                                                                                        │ Migration order confirmed: add the new index first, drop the old constraint in  │
│                     │                                                                                          │ a later release                                                                 │
└─────────────────────┴──────────────────────────────────────────────────────────────────────────────────────────┴─────────────────────────────────────────────────────────────────────────────────┘

D-5 and D-6 are settled as policy, but the code changes still need an implementation phase.

Deferred: D-7, the scheduler's tenant context. No scheduler handler is registered anywhere, so nothing can run today.

Still open (need an owner decision)

┌──────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ Item │                                                         Question                                                          │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ D-1  │ Should tenants be able to create global metadata?                                                                         │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ D-2  │ Who owns Studio publications? This is W-1                                                                                 │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ D-3  │ What should a platform user's home dashboard be?                                                                          │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ B-3  │ Studio templates: tenant-owned or platform-owned?                                                                         │
├──────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ C-D2 │ Does the permission scope column have a planned meaning? It is never read, so I recommend dropping it from the unique key │
└──────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

Workflow remediation plan:
- WB-1: give each Studio publication its owning tenant (fixes W-1).
- WB-2: stop any tenant from advancing or deciding global instances and approvals (117 each locally).
- WB-3: stop Foundation's instance lookup from showing everything to a caller with no tenant.
- WB-4: templates, once B-3 is decided.
- WB-5: refuse platform principals on /workflow.

Only WB-4 interacts with S3. WB-1 is recommended before or alongside S3.

S3 readiness: NO-GO. S1 and S2, the technical prerequisites, are in place. The blockers are:
1. S3 hasn't been explicitly authorized.
2. B-3 decides how S3 handles template creation, unless templates are taken out of S3.
3. D-3 matters if S3 covers /dashboard, unless /dashboard is taken out.
4. The S3 scope needs confirming, including whether metadata (D-1) is in or out.

Tests:
- I ran only the unit pins (they use an in-memory database): 137 passed.
- Not run:
  - the full unit suite;
  - the integration tiers;
  - all PostgreSQL tests (they insert rows, which this phase forbids);
  - Playwright (it needs the servers started);
  - Vitest.
- The last full results are from S2.2 and weren't re-checked here.

Report: docs/architecture/reviews/N2B_S2_3_DECISION_CLOSURE_AND_WORKFLOW_BOUNDARY_PLAN.md

Changes made: only that report, plus my memory notes. The local test DB was only read, with SELECT queries.

Not done, as required:
- no change to code, tests, schema, migrations, seeds, configuration or data;
- no service started or stopped;
- no non-test database inspected;
- no cleanup, backfill or module activation;
- no tests weakened or marked as expected failures;
- no S3 work;
- no commit or push.

I've stopped here.
