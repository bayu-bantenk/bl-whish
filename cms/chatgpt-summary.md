Kita melanjutkan project **Migrasi CMS** dari conversation sebelumnya. Anggap seluruh informasi di bawah sebagai **canonical working context** dan gunakan sebagai dasar melanjutkan pekerjaan. Jangan mengulang analisis dari nol kecuali ada bukti baru yang bertentangan.

## 1. PROJECT

Saya sedang memigrasikan **frontend CMS lama berbasis AdonisJS v4.1** ke **Next.js 16.x**.

Repository target:

* GitHub: `bayu-bantenk/bl-whish`
* Legacy CMS: `workspace/gpos-b2b-cms/`
* Next.js target: `workspace/frontend/`

Backend **TIDAK dimigrasikan**. Backend/API tetap berada di server terpisah.

Legacy CMS menjadi source of truth untuk:

* WHAT
* business behavior
* routes/screens
* validation
* domain vocabulary
* backend API usage

Next.js menjadi source of truth untuk:

* HOW
* architecture
* implementation
* UI implementation
* testing
* performance

UI menggunakan:

* Tailwind
* shadcn/ui
* TanStack Table
* React Hook Form + Zod jika sesuai

Jangan membawa Bootstrap/jQuery/legacy UI components ke Next.js.

Tidak boleh membuat folder:

* `legacy`
* `migration`
* `adonis`

di bawah `frontend/src`.

---

# 2. TARGET ARCHITECTURE

Canonical architecture:

```text
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   ├── forgot/
│   │   ├── register/
│   │   └── reset/
│   ├── (dashboard)/
│   │   ├── layout.tsx
│   │   ├── not-found.tsx
│   │   ├── error.tsx
│   │   └── dashboard/
│   ├── api/
│   ├── global-error.tsx
│   └── layout.tsx
├── proxy.ts
├── packages/<feature>/
│   ├── domain/
│   ├── usecases/
│   ├── repository/
│   └── presentation/
│       ├── components/
│       ├── table/
│       ├── forms/
│       └── actions/
├── components/
│   ├── ui/           # shadcn/ui = ATOMS tier
│   ├── molecules/
│   ├── organisms/
│   └── templates/
└── shared/
    ├── infrastructure/
    │   ├── http/
    │   ├── session/
    │   ├── container/
    │   ├── logger/
    │   └── config/
    ├── config/
    ├── navigation/
    ├── authorization/
    ├── errors/
    ├── table/
    ├── upload/
    ├── hooks/
    ├── utils/
    └── constants/
```

Principles:

* Hexagonal architecture.
* Server-first.
* API/contract-first.
* Canonical DTO isolated from legacy wire DTO.
* DAL → Use Case → Repository → Gateway → Backend.
* Browser MUST NOT directly call backend.
* Browser MUST NOT receive bearer token/API key.
* Tokens stay server-side.
* httpOnly encrypted session cookie.
* Single server-only gateway client.
* Single composition root.
* Repositories must not read cookies.
* Repositories must not refresh tokens.
* Repositories must not construct HTTP clients.
* Server Actions for mutations.
* Route Handlers only where actually needed.
* Authorization fail-closed.
* Menu visibility is NOT authorization.
* Error != Empty.
* Typed error taxonomy.
* URL-driven DataTable state.
* TanStack Table under shadcn Table.
* No jQuery DataTables.
* No Bootstrap.
* No client-side backend calls.
* Signed URL upload boundary where applicable.
* File bytes must not pass through Next.js.

---

# 3. A4 MIGRATION CONTRACT

A4 was GO.

Preserve:

* 259 MIGRATE routes
* 32 feature areas
* business rules
* validators
* data-state rules
* domain vocabulary
* gateway wire contracts
* screen hierarchy
* signed URL upload boundary
* server-held tokens
* account-type menu visibility intent
* login/logout behavior

May change:

* URLs
* visual design
* page sizes
* wizard mechanics
* feedback placement
* filters
* save gating
* implementation
* mobile layout

Must NOT copy:

* Bootstrap
* jQuery
* jQuery plugins
* jQuery DataTables
* legacy DOM manipulation
* server-rendered HTML assumptions
* legacy session assumptions
* native alert/confirm
* legacy flash/toast
* error flattening
* state-changing GET
* method override
* logging tokens/passwords/bodies
* prefilled credentials
* raw form forwarding
* arbitrary browser URLs to server

---

# 4. FOUNDATION STATUS

A0–A6 foundation is already substantially complete.

## A5.1 Auth / Session Foundation

Status: GO-WITH-RISKS before live verification.

Implementation:

* custom small Node built-in session module
* `better-auth`
* `next-base64`
* axios removed
* AES-256-GCM encrypted/authenticated cookie
* HKDF from `SESSION_SECRET`
* tampered/foreign/malformed cookies fail closed
* one server-only gateway client
* one composition root
* proactive refresh <=60 sec
* single-flight refresh per session
* 10s grace
* new token pair persisted before retry
* exactly one retry on 401
* second 401 is final
* mutations are NOT automatically replayed
* browser has no tokens in localStorage/sessionStorage/document.cookie/HTML/RSC

Cookie:

* `__Host-gpos-session` in secure environments
* `gpos-session` local HTTP
* httpOnly
* SameSite=Lax
* Path=/
* Max-Age based on 7-day app session
* 3900-byte guard

Important:
**Backend-provided `expires_at` is the sole source of truth for token expiry.**

Do NOT impose a frontend maximum token lifetime.

Previous incorrect:
`MAX_TOKEN_LIFETIME_MS = 30 days`

was removed.

Real backend token can expire at 30 days and this must be accepted.

`SESSION_MAX_AGE_SEC=7 days` is the application session lifetime, NOT a token lifetime restriction.

Real backend auth endpoints:

```text
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

Login response includes:

* access_token
* expires_at
* refresh_token
* identity fields

Refresh body:

```json
{
  "refresh_token": "..."
}
```

Logout uses Bearer access token.

Known risks:

* multi-instance session race
* token size
* mutation replay
* render retry
* secret rotation
* real backend contract differences

---

# 5. A5.2 Dashboard Shell

GO-WITH-RISKS.

Includes:

* dashboard layout
* session guard
* SessionViewProvider
* Navigator
* Header
* breadcrumbs
* shadcn Sidebar/Sheet
* navigation registry
* longest-prefix active route
* 404 vs 403
* mobile Sheet

No duplicate shell.

---

# 6. A5.3 DAL / CONTAINER / ERROR CONTRACT

Report:
`A5.3_DAL_CONTAINER_ERROR_CONTRACT.md`

Status: GO-WITH-RISKS.

DAL:

* server-only
* pages/Server Actions reach use cases through DAL
* resolves cookies/headers/request ID
* token-free RequestContext
* logger
* process/request scopes
* composition root

Error taxonomy:

* Validation
* Business
* Unauthenticated
* Forbidden
* NotFound
* Conflict
* RateLimited
* Server
* Timeout
* Network
* Contract
* Unknown

Action result:

```ts
type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: SerializableAppError }
```

`resolvePageResult`
`runAction`

Error != Empty.

`x-request-id` generated by proxy and propagated.

---

# 7. A5.4 AUTHORIZATION

Report:
`A5.4_AUTHORIZATION_POLICY_FOUNDATION.md`

Status: GO-WITH-RISKS.

Rules:

* fail-closed
* allow-all P0 removed
* Server Actions protected
* unauthorized mutation = 0 gateway calls
* hidden menu != authorization
* capability vocabulary such as:

  * `content.read`
  * `content.create`
  * `content.update`
* interim restrictive policy

Risk:
Production grants/account identity mapping still need confirmation.

---

# 8. A5.5 DATATABLE

Shared DataTable architecture exists.

Canonical app URL style:

```text
?page=1&per_page=20&sort=field.asc&q=keyword
```

Legacy wire names remain isolated in repository DTO.

TanStack Table:

* manual mode
* server-driven
* shadcn Table

Do NOT add GET body merely because legacy sent JSON body on GET.

---

# 9. A5.5R LIVE BACKEND EVIDENCE

Real backend:

```text
https://devb2b-api.gpos.id
```

Verified:

* login 200
* content list 200
* content detail existing 200
* unknown Content ID returned 403
* pagination 200
* sorting 200 for tested cases
* search 200
* local authorization denial produces no gateway call
* forced 401
* refresh 200
* refresh rotation
* retry after 401
* refresh rejection 400
* failed refresh clears local session
* logout 200
* subsequent request 401

Important forensic findings:

### GET body

NOT VERIFIED.

Probe was not enabled.

Never claim backend accepts GET body.

### API key optionality

NOT VERIFIED.

Live requests used configured API key.

Never claim API key is optional.

### Unknown Content ID

Real backend returned:

```text
403 Forbidden
```

for tested unknown ID.

Do not convert this to 404 without new evidence.

### Content response

Observed fields:

```text
id
name
code
value
is_active
```

No `created_at` observed in live response.

Do not invent unsupported fields.

### Validation errors

Potential backend shape:

```text
data: [
  {
    FailedField,
    Tag,
    Value
  }
]
```

Frontend currently expects a different field-error structure in some places.

Do not change until real validation error is observed.

---

# 10. A6 FIRST PRODUCTION VERTICAL SLICE — CONTENT

Routes:

```text
/dashboard/content
/dashboard/content/create
/dashboard/content/update/[id]
```

Implemented:

* paging
* page size
* sort
* search
* URL state
* error vs empty
* retry
* 403
* create
* edit
* server validation
* field errors preserve input
* duplicate-submit protection
* saved notice
* menu
* breadcrumbs

Architecture:

```text
Page / Server Action
    ↓
DAL
    ↓
Use Case
    ↓
Repository
    ↓
Gateway
    ↓
Backend
```

Authorization:

* `content.read`
* `content.create`
* `content.update`

Important:
A6 real CREATE is verified.

---

# 11. A6R-1 REAL CREATE

Verified:

```text
POST /api/v1/cms/contents
```

Status:

```text
201
```

Created record:

```text
ID:
68b42bae-dfd3-4da0-b3d5-dbe0733d0aa2

code:
A6R-TEST-20261001-062932

name:
A6R CREATE Contract Verification

is_active:
true
```

Read-back succeeded.

Exactly one CREATE attempt.

---

# 12. A6R-2 REAL UPDATE — BLOCKED

Target:
`68b42bae-dfd3-4da0-b3d5-dbe0733d0aa2`

Intended:

```json
{
  "code": "A6R-TEST-20261001-062932",
  "name": "A6R UPDATE Contract Verification",
  "is_active": false,
  "value": "A6R-2 controlled real UPDATE verification."
}
```

PUT returned 200.

Persisted:

* id/code: yes
* name: yes
* value: yes
* `is_active=false`: NO

Read-back remained:

```text
is_active=true
```

Therefore:

```text
D-A6R2-01
Classification: D
Severity: CRITICAL
Status: OPEN
```

Backend root cause identified:

```text
PUT /contents/:id
↓
DTO
↓
IsActive bool
↓
UseCase
↓
Mapper
↓
Repository
↓
db.Updates(content)
↓
GORM Updates(struct)
↓
false = zero value
↓
is_active omitted from UPDATE SQL
↓
database remains true
```

Relevant source mentioned:

* `repository/content.go:67`
* `model/content.go:8`
* `dto/content.go:46`
* GORM update callback around `callbacks/update.go:289`

Backend commit mentioned:
`7897199`

Do NOT claim this exact commit is deployed unless separately verified.

A6 is therefore:

```text
BLOCKED
```

User decided to HOLD Content and move to another module.

Do not perform additional live Content mutations unless explicitly requested.

---

# 13. NEW STRATEGY AFTER A6

We initially considered a lightweight sequence:

```text
Contract audit
→ Implementation
→ Live smoke
→ Report
```

But the latest decision changed this.

## IMPORTANT CURRENT DECISION

We should use **VERTICAL-SLICE MIGRATION PER MODULE**.

Do NOT separate all backend work from all UI work.

Do NOT wait for live WRITE verification before building the UI.

Each module should be developed as one complete slice:

```text
Contract Audit
+
Domain
+
Use Cases
+
Repository
+
UI
+
Navigation
+
Automated Tests
+
Live READ
+
Live WRITE if applicable
+
Module Report
```

The reason:
A0–A6 already established the foundation.

Repeating:

```text
audit
→ live backend
→ only then UI
```

for all 32 feature areas would be unnecessarily serial and slow.

Instead:

```text
Foundation A0–A6
        ↓
Module
        ↓
Contract audit
        ↓
Implement entire vertical slice INCLUDING UI
        ↓
Automated tests
        ↓
Live READ
        ↓
Live WRITE (controlled)
        ↓
Module Gate
```

This is the current preferred strategy.

---

# 14. MODULE GATE

Each module should end with a status table like:

```text
Contract              ✅
Domain                ✅
Use Case              ✅
Repository            ✅
UI                    ✅
Navigation            ✅
Unit/Integration      ✅
E2E                   ✅
Live READ             ✅
Live WRITE            ✅ / HOLD
Final Status          DONE / DONE-WITH-RISKS / HOLD
```

Do not call a module DONE merely because HTTP requests return 2xx.

Semantic read-back is mandatory for live mutations.

---

# 15. COPY-ADAPT STRATEGY

Use:

> Copy-adapt first, abstract after repeated evidence.

F30 and F11 are templates for different patterns.

Do NOT prematurely create giant generic abstractions.

If 3–5 modules repeatedly demonstrate the same pattern, then consider promoting the pattern into shared infrastructure/components.

UI patterns should also follow copy-adapt:

```text
F30 DataTable
   ↓
F11 DataTable
   ↓
F20 DataTable
   ↓
shared abstraction if repetition proves it
```

Same principle for forms/dialogs/actions.

---

# 16. F30 — GLOBAL CONFIGURATION

F30 is already implemented as a vertical slice.

Feature:
**Global Configuration**

Architecture:

```text
src/packages/global-configuration/
```

Routes include:

```text
/dashboard/global-configuration
/dashboard/global-configuration/create
/dashboard/global-configuration/update/[id]
```

Includes:

* list
* search
* sort
* pagination
* detail
* create
* edit
* delete
* bulk delete
* authorization
* DataTable
* forms
* Server Actions
* DAL
* repository
* E2E
* live smoke

Automated:

* 556/556 unit/integration at one stage
* 74/74 E2E

Live READ/WRITE was later successfully performed.

Live mutation sequence:

* CREATE 201
* UPDATE 200
* DELETE 200
* read-back successful
* post-delete detail 404
* exactly one attempt per mutation
* no retry

F30 soft-delete behavior exists DB-side while API presents deleted item as unavailable/404.

Important risk:
`key` sorting caused backend HTTP 500 because `key` is a MySQL reserved word in the generated order clause.

Therefore F30 should be treated as:

```text
DONE-WITH-RISKS
```

not clean DONE.

Other known F30 backend risks:

* sort_by/order-by allowlist
* possible duplicate-key behavior
* no backend max `take`
* validation error mapping
* etc.

Do not let stale summary files override actual terminal/live evidence.

---

# 17. F11 — PRODUCT RESTRICTION

F11 feature:
**Pembatasan Produk / Product Restriction**

Domain:
One restriction record per product containing allowed/restricted customer channel types.

Legacy behavior:

* Product is selected.
* Product itself is not changed during edit.
* Edit changes customer channels.
* Legacy requires at least one channel.
* Backend may accept empty array.
* Backend stores `customer_channel_ids` as string.
* Backend does not fully validate IDs.
* Frontend/use case validates channel IDs against actual customer-channel options.

F11 is NOT affected by the A6 `bool=false` GORM issue because its update data is channel data, not a boolean zero-value field.

Automated:

* 581/581 unit/integration passed
* 82/82 E2E passed
* lint/TS/build/bundle/security passed

Bulk delete:
NOT implemented because legacy has no bulk trigger and backend `/bulk` is shadowed by `/:id`.

---

# 18. F11 LIVE READ — VERIFIED

Command used:

```bash
LIVE_MODULE=product-restriction \
npx vitest run \
  --config vitest.live.config.js \
  test/live/module-smoke.live.test.ts
```

Verified:

* login 200
* list 200
* pagination
* sorting
* search/no-match
* detail existing 200
* unknown detail 404
* customer channel lookup 200
* product lookup 200
* logout 200

Evidence:
18 observations.

Mutation tests were skipped.

Thus:

```text
F11
Contract           ✅
Implementation     ✅
Automated tests    ✅
E2E                ✅
Live READ          ✅
Live WRITE         ⏳
```

---

# 19. F11 LIVE WRITE SAFETY

F11 WRITE has real business impact.

A product restriction can affect customer visibility through business/Redis logic.

Therefore NEVER allow Claude to randomly choose:

* product
* channel

The user explicitly supplied this approved live-test fixture:

```bash
LIVE_TEST_PRODUCT_ID="066e6346-19b7-4fa7-ad06-07e514ef9719"
LIVE_TEST_CHANNEL_IDS="78bd978f-2c69-11ee-a134-7cd30ae46a0c"
```

Use ONLY these IDs.

Do not discover another product automatically.

Do not discover another channel automatically.

Do not mutate unrelated records.

Exactly one attempt per mutation.

No retry.

Pre-check must first verify:

* product exists
* channel exists
* target product has no existing restriction

If an existing restriction is found:
STOP.

---

# 20. F11 UPDATE FIXTURE LIMITATION

Only ONE approved channel ID is currently available.

Therefore:

* CREATE can be safely tested using that channel.
* UPDATE must NOT invent another channel.
* If semantic UPDATE requires changing to a different channel set and no second approved channel exists, STOP rather than selecting another channel.

This is intentional safety behavior.

---

# 21. LIVE MUTATION RULE

For every module:

```text
Pre-check
↓
one mutation
↓
read-back
↓
next mutation
↓
read-back
```

No automatic retries.

No mutation if preconditions are unsafe.

No source-code changes during live verification.

No direct database manipulation.

No guessing.

HTTP 2xx alone is not enough.

---

# 22. IMPORTANT F11 NEXT STEP

The next task was originally going to be F11 LIVE WRITE, but after our latest architecture discussion we recognized that the workflow should be **vertical slice per module**, including UI.

Therefore before deciding the exact next command, inspect the current F11 implementation/report and determine whether its UI vertical slice is already complete.

If UI is incomplete:

* finish F11 UI first using the existing architecture and patterns
* do not wait for live WRITE
* then run automated tests
* then perform controlled live WRITE

If UI is already complete:

* continue with controlled F11 live WRITE using the exact fixture above

Do not invent new architecture unless current evidence requires it.

---

# 23. CLAUDE-SUMMARY STATUS

GitHub file:

`claude-summary.md`

The summary in GitHub may be stale relative to later terminal/live evidence.

Do NOT blindly trust stale statements such as:

* F30 live smoke not run
* F30 still HOLD
* F11 not started

Later evidence supersedes those statements.

If status matters, prefer:

1. latest terminal output
2. latest live evidence
3. latest module report
4. then claude-summary.md

The repository summary should eventually be synchronized with actual evidence.

---

# 24. MODULE GROUPS

Original planned grouping:

### Batch A — Simple CRUD

* F30
* F11
* F20
* F24
* F25
* FAQ

### Batch B — Upload

* F07
* F08
* F18
* F19
* F28
* ...

### Batch C — Workflow / Status

* F17
* F21
* F27
* F13
* ...

### Batch D — Decision Needed

* F10
* F14–F16
* F04

Do not assume this grouping is final if contract evidence says otherwise.

---

# 25. ONE-TIME SYSTEMIC BACKEND SCAN

We also agreed that the backend source at:

```text
~/Developments/BE
```

is available for static contract inspection.

A one-time systemic scan should eventually check for patterns such as:

```text
GORM Updates(struct)
+
bool/int zero-value fields
```

and:

```text
ORDER BY / sort_by
```

without safe allowlisting.

Other recurring risks:

* GET body
* 403/404 semantics
* duplicate key
* error envelopes
* soft delete
* transaction behavior
* raw query construction

Do this as a systemic scan where useful rather than rediscovering the same issue independently in every module.

---

# 26. WORKING STYLE

I prefer:

* Indonesian explanations
* direct step-by-step reasoning
* evidence/audit style
* explicit GO / GO-WITH-RISKS / HOLD / BLOCKED
* no fake GO
* no assumptions presented as facts
* clear separation of VERIFIED / INFERRED / UNKNOWN
* Claude Code prompts in English
* prompts that tell Claude exactly where to inspect, what to test, what not to change, and when to STOP

When giving Claude prompts:

* make them copy-paste ready
* include safety gates
* include exact acceptance criteria
* prohibit guessing
* prohibit automatic retries for live mutations
* require evidence/report output
* stop after the requested phase/module

---

# 27. CURRENT PRINCIPAL DECISION

The most recent architectural decision is:

> **After A0–A6, migrate each feature as a complete vertical slice, including UI, rather than separating backend verification and UI implementation into different stages.**

So the preferred module lifecycle is:

```text
1. Contract audit
2. Domain/use case/repository
3. UI
4. Navigation
5. Automated tests
6. Live READ
7. Controlled live WRITE
8. Module report/gate
```

Not:

```text
all backend
→ all live tests
→ all UI
```

and not:

```text
audit
→ live WRITE
→ only then UI
```

---

## INSTRUCTION FOR THIS NEW CONVERSATION

Please acknowledge that you have loaded this context.

Then continue from the **current state**, not from the beginning.

Before proposing the next implementation step, verify whether F11's UI vertical slice is already complete and inspect the latest repository evidence if necessary.

Do not ask me to repeat the information above.
