```text
A4 STATUS:
GO — every GO criterion in A4_READINESS_REPORT.md is met. What remains open is recorded as
backend or product decisions, not unresolved architecture.

DOCUMENTS CREATED (15, in gpos-b2b-cms/docs/migration/):
A4_TARGET_ARCHITECTURE.md · A4_AUTH_SESSION_ARCHITECTURE.md · A4_API_DATA_ACCESS_ARCHITECTURE.md
A4_FORM_ARCHITECTURE.md · A4_NAVIGATION_AUTHORIZATION.md · A4_ROUTE_MIGRATION_MATRIX.md
A4_COMPONENT_MIGRATION_MATRIX.md · A4_PERFORMANCE_STRATEGY.md · A4_SECURITY_ARCHITECTURE.md
A4_TEST_STRATEGY.md · A4_MIGRATION_DECISION_REGISTER.md · A4_MIGRATION_CONTRACT.md
A4_OPEN_DECISIONS.md · A4_TRACEABILITY_MATRIX.md · A4_READINESS_REPORT.md
Nothing else was changed: no app code, config, dependencies, rule files, legacy source or backend.

KEY ARCHITECTURE DECISIONS:
AD-01  Only the Next.js server talks to the gateway. Tokens, the gateway URL and API keys
       never reach the browser.
AD-02  Page data is fetched in Server Components through a server-only data layer; list state
       lives in the URL.
AD-03  Writes go through Server Actions; Route Handlers only for client-driven calls
       (async select options, upload signing, CSV validation).
AD-04  Typed errors: an error is never shown as an empty list, and a timeout is never
       shown as "not found".
AD-06/07  DataTable and form architecture (see DATATABLE below; forms use react-hook-form + zod
       + shadcn Form).
AD-09  Authorization is checked on the server; hiding a menu item is not authorization.
AD-10/11  No experimental Next.js APIs and no new dependencies without approval.
AD-12  Keep the existing package layout (domain / usecases / repository / presentation) but
       fix its defects: use cases stop creating HTTP clients, and repositories plug in
       behind interfaces.
Routes: all 427 legacy route entries have a status: 259 MIGRATE, 49 REVIEW, 119 REMOVE,
0 UNKNOWN.
Legacy defects: all 36 have an explicit disposition, and none is carried over as a requirement.

UI FOUNDATION:
Tailwind CSS
shadcn/ui
src/components/ui/** = ATOMS
Bootstrap, jQuery and jQuery DataTables are removed. Every new UI piece is built from existing
shadcn components; the only exception is the rich-text editor, which needs a new dependency (OD-11).

DATATABLE:
organisms/data-table: TanStack Table (already installed) under the shadcn Table.
The contract covers server-side paging, sorting, filtering and search; row selection per page;
bulk actions with confirmation and success/failure counts; column visibility; loading, empty,
error and retry states; responsive container; accessibility; and URL sync.
After a change, the list page is revalidated. Feature-specific columns stay in each feature's package.

AUTH:
Tokens are held on the server behind an httpOnly, Secure, SameSite=Lax cookie. A missing or
unreadable expiry counts as an expired session.
Refresh runs once per session even when many requests expire together, and the original request
is retried exactly once. If refresh fails, the session is cleared and the user returns to login
at the page they came from.
Next.js 16 cannot set cookies while a Server Component is rendering, so refresh happens ahead of
time in proxy.ts or through a refresh Route Handler. A server-side session store is the alternative.
How the session is stored (encrypted cookie vs server store; keep or replace better-auth) is
settled by a spike against set acceptance criteria (OD-15, OD-16).
If the backend has no refresh endpoint, an expired token simply sends the user back to login.

OPEN DECISIONS:
37 items (OD-01…OD-37), each with an owner and what it blocks.
The existing better-auth setup exposes tokens to the browser and doesn't verify its cookie; A4
replaces that pattern.

BLOCKERS (nothing blocks A4; these block implementation):
Foundation work:
- Which gateway to use: legacy /api/v1 or the template's API_HOST (OD-02).
- Whether an API key is required (OD-03).
- Login payload, token lifetimes and refresh endpoint (OD-04).
- How the session is stored (OD-15, OD-16).
- Approval to declare zod as a direct dependency (OD-14).
- A test gateway and test accounts (OD-36).
Before starting work:
- Fix the documentation drift DD-01…DD-07.
- Fix the broken husky hook and the failing login test.
- Remove the secret exposure in the current frontend (next.config env, client-side tokens,
  unverified cookie decode).
Individual features:
- Rich-text editor (OD-11).
- Screens with no menu entry (OD-07), mockups (OD-08), Order delete (OD-09).

BACKEND DEPENDENCIES:
OD-02 gateway identity · OD-03 API key · OD-04 auth/refresh/rotation · OD-05 permission data
OD-18 storage limits and Principal image · OD-31 request/field-error formats · OD-32 filters
the legacy app dropped · OD-33 identity headers · OD-34 CSV limits · OD-36 test gateway
OD-37 Notification "final" · OD-22 full export

PRODUCT DECISIONS:
OD-05/06 authorization policy (recommended interim: enforce the account-type menus as real
access rules) and how the payment/marketing accounts are identified
OD-07 screens with no menu entry (most of the 49 REVIEW routes) · OD-08 mockups
OD-09 Order / Order Review delete · OD-10 dashboard content · OD-12 brand tokens
OD-17 leftover template packages in the frontend · OD-20 language/copy · OD-21 timezone
OD-22 export · OD-26/28/29/30/35 UX items

DOCUMENTATION DRIFT (recorded, not changed):
DD-01  The atoms tier is still written as src/components/atoms/** in all four rule mirrors:
       .claude/rules/component-organization.md:9, .cursor/…mdc:12, .github/…:12, .agents/…:12.
DD-02  Malformed paths in the form and presentation rules.
DD-03  Rules put schemas in presentation; A4 puts them in domain so client and server can share them.
DD-04  Naming rules don't match the code (*.schema.ts in rules vs *.scheme.ts / respository.ts in code).
DD-05  No rule for importing another feature's use cases.
DD-06  The README describes layers that don't exist.
DD-07  components.json points to the wrong CSS path.
The fix for each is in A4_READINESS_REPORT.md; each needs an approved change.

URGENT (outside the migration):
OD-19  The running legacy system still logs tokens and passwords.

NEXT PHASE:
A5 — foundation spike and prerequisite fixes (needs approval): the drift and quality-gate fixes,
backend answers OD-02/03/04/36, and the session mechanism spike. After that come the transport,
server data layer, navigation registry, authorization interface, and the DataTable
error/empty/retry states. No feature is implemented until then.
```