# A4 — Readiness Report

| Item | Value |
|---|---|
| Phase | A4: Target Architecture & Migration Contract |
| Date | 2026-09-29 |
| Mode | Architecture / readiness only. **No application code, configuration, dependency, rule file, legacy source or backend was modified.** Only new documents under `gpos-b2b-cms/docs/migration/` were written |

## Executive Summary

A4 defines the target architecture for the Next.js 16 frontend and the contract for migrating the legacy AdonisJS CMS:

- **Topology:** a **server-side BFF**. Next.js is the only gateway client; the browser holds only an httpOnly session cookie. This is the proven legacy boundary (A2 / A3.1), and it corrects the B0 target's exposure of the API host, the Kong key and the bearer token.
- **Data flow:** server-first. Server Components go through a `server-only` DAL; table / list state lives in the URL; mutations use Server Actions. No new client-cache dependency.
- **Errors:** a typed error model with ERROR ≠ EMPTY.
- **UI:** Tailwind CSS + shadcn/ui, with **`src/components/ui/**` = ATOMS** (binding, option (a)).
- **Tables:** the DataTable is TanStack Table under the shadcn Table, with a full state contract.
- **Forms:** RHF + zod + shadcn Form; field errors are always shown.
- **Uploads:** signed-URL direct uploads, with policy enforced client-side and in the BFF.
- **Auth:** a contract with single-flight refresh and retry exactly once (backend-dependent).
- **Authorization:** a server-side policy port, strictly separate from menu visibility.
- **Routes:** all **427** legacy route entries have a disposition: 259 MIGRATE, 49 REVIEW, 119 REMOVE, 0 UNKNOWN.

## Documents Created

| Document | Purpose |
|---|---|
| `A4_TARGET_ARCHITECTURE.md` | Layers, dependency rules, directory structure, routing, layouts, server / client boundaries, DAL, query / mutation, loading / error, **DataTable contract (§10)**, upload, config / env, observability, drift |
| `A4_AUTH_SESSION_ARCHITECTURE.md` | Auth contract (AC-01…AC-12), flows, single-flight refresh, Next.js 16 cookie constraint, implementation options A / B / C with spike criteria |
| `A4_API_DATA_ACCESS_ARCHITECTURE.md` | Request / response / error / pagination / filter / sort / mutation / upload models; retry, timeout, cancellation policies |
| `A4_FORM_ARCHITECTURE.md` | Schema / validation / errors / submit / dirty / unsaved changes / upload; **RICH_TEXT_EDITOR_DECISION** |
| `A4_NAVIGATION_AUTHORIZATION.md` | Navigation registry, route metadata, policy port P0 / P1 / P2, unauthorized / not-found / hidden / inaccessible |
| `A4_ROUTE_MIGRATION_MATRIX.md` | 427 route entries with status, target route, feature, auth, permission |
| `A4_COMPONENT_MIGRATION_MATRIX.md` | Legacy UI patterns → target pattern / shadcn primitive / tier / decision / test |
| `A4_PERFORMANCE_STRATEGY.md` | Rendering, streaming, bundle, tables, images, measurement plan |
| `A4_SECURITY_ARCHITECTURE.md` | Frontend vs backend responsibilities; tokens, secrets, XSS, CSRF, open redirect, IDOR, uploads, logging / PII |
| `A4_TEST_STRATEGY.md` | Test layers, legacy → target → test mapping, quality gates |
| `A4_MIGRATION_DECISION_REGISTER.md` | DR-01…DR-28 (KEEP / REPLACE / IMPROVE / REMOVE / DEFER / UNKNOWN) |
| `A4_MIGRATION_CONTRACT.md` | MUST PRESERVE / MAY CHANGE / MUST NOT COPY / EXPLICITLY IMPROVED / DEFERRED / BACKEND / PRODUCT / RUNTIME / UNKNOWN; **legacy defect disposition LD-01…LD-36** |
| `A4_OPEN_DECISIONS.md` | OD-01…OD-37 with owner and blocking level |
| `A4_TRACEABILITY_MATRIX.md` | A0 → A1 → A2 → A3.1 → A3.2 → A4 → implementation → test for 15 topics |
| `A4_READINESS_REPORT.md` | This report |

## Decisions Made

| ID | Decision |
|---|---|
| AD-01 | Server-side BFF; no tokens / keys / gateway URL in the browser |
| AD-02 | Server-first data fetching via a `server-only` DAL; URL-driven table state |
| AD-03 | Mutations via Server Actions; Route Handlers only for client-driven endpoints |
| AD-04 | Typed `AppError` / `Result`; ERROR ≠ EMPTY; timeout ≠ not-found |
| AD-05 | Tailwind + shadcn/ui; `src/components/ui/**` = ATOMS; Bootstrap / jQuery / DataTables excluded |
| AD-06 | DataTable = `organisms/data-table` (TanStack Table under shadcn Table) with the §10 contract |
| AD-07 | Forms = RHF + zod + shadcn Form; server validation mirrored; errors always shown |
| AD-08 | Auth contract (server-held tokens, fail-closed expiry, single-flight refresh, retry exactly once) |
| AD-09 | Server-side authorization policy; menu visibility ≠ authorization |
| AD-10 | No experimental Next.js APIs without approval |
| AD-11 | No new dependency without approval |
| AD-12 | Reuse the hexagonal package layout; fix the B0 defects (ports / DI, typed returns, no swallowed errors) |
| — | Legacy defect dispositions LD-01…LD-36 (none preserved) |

## Decisions Deferred

- Rich-text editor (OD-11)
- Brand tokens (OD-12)
- Headless-library consolidation (OD-13)
- Client cache library (OD-27)
- Cross-page select-all (OD-28)
- Column-visibility persistence (OD-29)
- Mobile card view (OD-30)
- Legacy URL redirects (OD-26)
- Observability service (OD-24)
- Profile screen (OD-35)

## Unknowns

- Real gateway login payload, token sizes, `expires_at` format (OD-04 / OD-36).
- Refresh endpoint and rotation semantics (OD-04).
- Backend authorization for CMS features (U-01).
- Signed-URL constraints (OD-18).
- Legacy static files referenced by backend data (U-03).
- Data shapes for screens not rendered with the mock data (R-04).

## Backend Dependencies

OD-02 (gateway identity), OD-03 (API key), OD-04 (auth / refresh facts), OD-05 (permission data), OD-18 (storage), OD-31 (request / field-error details), OD-32 (dropped filters), OD-33 (identity headers), OD-34 (CSV limits), OD-36 (test gateway / accounts), OD-37 (Notification final), OD-22 (full export endpoint).

## Product Decisions

OD-05 / OD-06 (authorization policy, special accounts), OD-07 (hidden-nav screens: 49 REVIEW routes), OD-08 (mockups), OD-09 (Order / Order Review destructive actions), OD-10 (dashboard), OD-12 (brand), OD-17 (B0 template packages), OD-20 (language / copy), OD-21 (timezone), OD-22 (export), OD-26, OD-28…OD-30, OD-35.

## Security Risks

| Risk | Status |
|---|---|
| Legacy running system logs tokens, sessions and passwords (A2-C01 / C02, confirmed at runtime) | **Open, urgent (OD-19)**; outside migration code |
| Current target (B0) inlines `API_HOST*` / `KONG_API_KEY` into the client bundle; the bearer token is in browser JS; the session cookie decode is forgeable | Addressed by AD-01 / auth contract. **Must be fixed before any feature work** (prerequisites) |
| The B0 Jenkinsfile contains a hardcoded SonarQube token; the frontend Dockerfile copies `.env` into the image | OD-25 |
| Multi-instance refresh race with rotating refresh tokens | Depends on OD-04 / OD-25; mitigations listed (auth §2.4) |
| Authorization strength depends on the backend (IDOR) | Backend responsibility (security §1); U-01 |

## Architecture Risks

| Risk | Mitigation |
|---|---|
| Next.js 16 cannot set cookies during Server Component render, which complicates reactive refresh | Proactive refresh in `proxy.ts` + a refresh Route Handler redirect, or a server-side session store (auth §2.5, OD-15) |
| Session cookie size unknown | Spike measures the token size; option B if too large |
| better-auth fit for the external-token model | Spike criteria (OD-16) |
| GET-with-body filters required by the legacy gateway | The transport supports it per endpoint (OD-31) |
| Two gateways (legacy vs B0 template) | OD-02 before the first integration |

## Migration Risks

| Risk | Mitigation |
|---|---|
| 49 REVIEW routes wait for product decisions (hidden-nav screens, mockups, destructive actions) | Feature-level blocking only; other features proceed |
| Mapper-embedded business logic (status labels, conditional actions) is easy to miss | Contract P-03 / P-04 list them; per-feature specifications must cite A1 §8 |
| Legacy behavior known only from mocks for some screens (R-04) | Test gateway (OD-36) before specifying those features |
| B0 template packages overlap GPOS features | OD-17 |

## Test Risks

| Risk | Mitigation |
|---|---|
| No E2E / visual / a11y tooling installed | OD-14 approvals; manual CDP-harness fallback (test strategy §1) |
| Broken quality gates (husky hook, failing login test, no CI test stage) | Prerequisites below |
| No realistic test data / accounts | OD-36 |

## Documentation Drift

**ARCHITECTURE DOCUMENTATION DRIFT (recorded; not modified):**

| # | Drift | Files | Recommended remediation |
|---|---|---|---|
| DD-01 | Atoms tier documented as `src/components/atoms/**` (binding: `src/components/ui/**` = ATOMS) | `frontend/.claude/rules/component-organization.md:9`, `frontend/.cursor/rules/component-organization.mdc:12`, `frontend/.github/instructions/component-organization.md:12`, `frontend/.agents/rules/component-organization.md:12` | Replace the atoms path with `src/components/ui/**`, remove the separate "Shadcn" bullet, keep the four mirrors identical. One owner-approved commit in the frontend repo |
| DD-02 | Malformed path `src/packages/<package-name>.schema.ts<package-name>/presentation/table/...` | `form-and-validation.md:30`, `presentation-layer-structure.md:15` (+ mirrors) | Correct to `src/packages/<package-name>/presentation/table/**` |
| DD-03 | Schema location: the rules say `presentation/<pkg>.schema.ts`; A4 places schemas in `domain/` for client + server reuse | `form-and-validation.md`, `presentation-layer-structure.md` | Update the rules to `domain/<pkg>.schema.ts` (or ratify presentation placement and accept duplication) |
| DD-04 | Naming rules (`*.schema.ts`, `*.usecase.ts`, `*.repository.ts`) vs existing code (`*.scheme.ts`, `usecase.ts`, `repository.ts`, `respository.ts`) | `naming-conventions.md` vs `src/packages/**` | New code follows the rules; rename the existing packages if kept (OD-17) |
| DD-05 | Cross-feature use-case imports not addressed | `package-boundaries.md` | Add rule R7 (architecture §2) |
| DD-06 | README documents non-existent `Ports`, `Handler`, `Stories` layers | `frontend/README.md` | Update to the A4 layer model |
| DD-07 | `components.json` `tailwind.css: app/globals.css` (real path `src/shared/styles/globals.css`) | `frontend/components.json` | Fix before any `shadcn add` |

## Implementation Prerequisites

Must be done before the first feature is implemented. Each needs its own approved change.

1. **Rule remediation:** DD-01…DD-07 (documentation / config only).
2. **Quality gates:**
   - Fix the husky pre-commit hook (non-mutating lint / type / test).
   - Fix the failing login test.
   - Add a CI test stage (OD-25).
3. **Dependency approvals:** zod as a direct dependency (OD-14). Confirm `server-only` resolves under the Turbopack build.
4. **Backend answers for integration:** OD-02, OD-03, OD-04; test gateway / accounts OD-36.
5. **Foundation spike (A5)**, against the auth §3 acceptance criteria:
   - session mechanism (OD-15 / OD-16);
   - gateway client (fetch, error normalisation, timeouts, redacting logger);
   - DAL + container;
   - navigation registry + policy port;
   - DataTable error / empty / retry states;
   - removal of the B0 exposures (`next.config env`, client token usage, unsigned cookie decode).
6. **Product decisions for the first feature wave:** OD-05 / OD-06 (policy for the initial release). OD-07 / OD-08 / OD-09 only for the affected features.

## GO / NO-GO

| GO criterion | Met? | Where |
|---|---|---|
| Every route has a disposition | ✅ 427 / 427, 0 UNKNOWN | Route matrix |
| Authentication architecture clear | ✅ | Auth document §2–§6 |
| Refresh-token behavior clear | ✅ (contract defined; backend availability recorded as OD-04, with a defined degradation) | Auth §2.4, §7 |
| API boundary clear | ✅ | Architecture AD-01; API document |
| Authorization boundary clear | ✅ (policy content pending OD-05, non-blocking for architecture) | Navigation §2 |
| Navigation architecture clear | ✅ | Navigation §1 |
| UI architecture clear | ✅ | `TARGET_UI_FOUNDATION.md`; component matrix |
| `src/components/ui/**` explicitly = ATOMS | ✅ | Architecture AD-05, R8; `TARGET_UI_FOUNDATION.md` §2 |
| Tailwind CSS is the styling foundation | ✅ | DR-01 |
| Bootstrap excluded from the target | ✅ | DR-01, contract N-01 |
| DataTable architecture clear | ✅ | Architecture §10 |
| Form architecture clear | ✅ | Form document |
| Upload contract clear | ✅ | API document §9 |
| Error / loading / empty states clear | ✅ | Architecture §9–10; DR-17…DR-19 |
| Testing strategy clear | ✅ (tooling approvals pending OD-14; fallback defined) | Test strategy |
| Security boundary clear | ✅ | Security document |
| Major unknowns recorded | ✅ | Contract §9; open decisions |
| Backend dependencies recorded | ✅ | Contract §6; OD list |
| Product decisions recorded | ✅ | Contract §7; OD list |
| No critical architectural contradiction | ✅ The current B0 code contradicts the architecture (browser-direct calls, exposed secrets); that is **existing code to change** (prerequisite 5), not a contradiction within the architecture. Rule drift is documentation drift (DD-01…DD-07) | — |

A4 STATUS: GO
