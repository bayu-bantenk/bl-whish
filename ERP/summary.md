What I built
- New core package backend/app/core/capabilities/ (about 550 lines). It defines the capability contract, the registry (register, resolve, list, describe, unregister), a single executor (execute_capability), and typed errors.
- Capability ids follow <module>.<resource>.<action>, and the first segment must be the module that owns it. So a module can only publish under its own name. That's why the real id is 
  leave_management.leave_request.create, not the brief's employee.leave.create.                              One real capability: leave_management.leave_request.create v1. It's registe
  when it activates and removed when it deactivates. It calls the same LeaveRequestService the HTTP route    uses.                                                                      
- Not published, on purpose:                                                                                 - submit / approve / reject / cancel go through the Workflow caller-identit
    architecture test allows that only in api.py and flow_step.py, and a third file needs your decision.     - update doesn't exist in the module, so I didn't invent it.               
- Existing systems stay in charge. Permission checks use the existing RBAC path. The tenant comes only from  the logged-in caller. A tenant_id sent in the payload is ignored, and the e
  tenant bypass or when the caller's tenant differs from the request's.                                      No changes to the frontend, migrations, dependencies, Workflow, Application
  database code.                                                                                             

Why I didn't extend an existing registry
- ContractRegistry is keyed by Python class types, which would leak implementation names into the id.
- The Application Flow action dict belongs to Flow and has no metadata. Making the Form Platform depend on it would point the dependency the wrong way.
- Having both a Flow action registry and a capability registry is open debt; the audit's plan is for Flow actions to call execute_capability later.

Evidence
- 61 new tests: 52 unit/AST plus 9 against the real Postgres database. The Postgres tests activate the real module, execute the capability by id only, and read the result back through the module's real HTTP GET. Tenant A gets 200 with an identical body; tenant B gets 404.
- RLS proof: raw SQL counts the new row as 1 for its tenant, 0 for another tenant, and 0 with no tenant.
- Mutation check: with the executor's tenant binding removed, Postgres rejected every insert with new row violates row-level security policy and 4 of 9 tests failed. With it restored, all pass.
- No coupling: an AST test proves the consumer test imports nothing from the leave module.
- One change to an existing test: I added app.core.capabilities to the leave module's import allowlist. It follows Phase 4.3's app.core.application_flow entry.

Pre-existing problems I found but didn't fix
- F-2 (high): on FastAPI 0.115.6, ModuleCleanup.unregister_routes fails, so a deactivated module's HTTP routes stay mounted until restart. The unmodified test_leave_management_real_flow.py shows it too. Auth, permission and tenant checks still apply on those routes, so it's not a privilege escalation, and I didn't interrupt you for it.
- F-1 (medium): Application Flow action handlers aren't cleared when a module deactivates.
- test_engine_execution.py, run on its own, gives 27 failures. They're all "no current event loop", the file's known problem. Neither the file nor the code it tests changed. I didn't run it before my change, so there's no direct before/after for it.

Conditions for Phase 2 (Form Definition + Versioning)
- C-1: first assess the legacy app/core/metadata_engine (FormSchema, UiLayout) before creating any new form-definition store.
- C-2: forms bind to an exact capability id and version. Lifecycle actions need a decision on the Workflow security-import allowlist first.
- C-3: any HTTP endpoint added later must go through AuditMiddleware. Today, in-process executions write only a log line, no audit row.
- C-4: schedule a separate fix for F-2.

Files are in docs/architecture/:
- reviews/FORM_CAPABILITY_FOUNDATION_AUDIT.md
- reviews/FORM_CAPABILITY_FOUNDATION_READINESS.md
- CAPABILITY_PLATFORM.md
