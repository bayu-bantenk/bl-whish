# A4 — Security Architecture

| Item | Value |
|---|---|
| Phase | A4 (architecture only) |
| Date | 2026-09-29 |
| Evidence | A2 §16–20 (C-01, C-02, H-01…H-06, M-01…M-10); A3.1 §10–14, §21 (A3-S01 CSRF bypass, A3-S02 expiry fail-open); B0 (secrets inlined into the client bundle, bearer token in the browser, forgeable session decode, Sonar token in the Jenkinsfile, `.env` copied into the Docker image) |
| Related | `A4_AUTH_SESSION_ARCHITECTURE.md`, `A4_API_DATA_ACCESS_ARCHITECTURE.md` §7, §9 |

## 1. Responsibility split

| Area | Frontend (Next.js) responsibility | Backend / gateway responsibility |
|---|---|---|
| Authentication | Session cookie integrity, token confinement to the server, refresh orchestration, logout, CSRF on its endpoints | Credential verification, token issuance / lifetime, refresh / rotation, revocation |
| Authorization | Route / action guards (defense in depth), menu visibility, never trusting client input | **Final authorization of every API call** (including IDOR checks per object) |
| Input validation | Zod validation of every Server Action / Route Handler input; upload policy at signing | Authoritative business / data validation |
| Output | Escaping (React), sanitizing rich-text previews, no internal errors to the UI | Not returning excessive data (PII minimisation) |
| Secrets | Server-only env; nothing secret in `NEXT_PUBLIC_*` or `next.config env` | Key management |
| Files | Signing policy (type / size / extension), no arbitrary URL fetch | Signed-URL scope and expiry, bucket ACL, content scanning (if any) |
| Logging | Redacted structured logs | Their own logs |

## 2. Token and secret handling

| Rule | Detail |
|---|---|
| S-01 | Access / refresh tokens stay server-side only (auth AC-01…AC-03) |
| S-02 | Secrets are read only in `shared/infrastructure/config/server.ts` (`server-only`), validated at startup, and never passed to client components |
| S-03 | `next.config.ts env` must not contain secrets or internal hosts (it inlines them into the bundle, Next.js 16 `env.md`). The B0 values `API_HOST*` and `KONG_API_KEY` must be removed during implementation |
| S-04 | `NEXT_PUBLIC_*` variables are reviewed individually. Only non-secret values are allowed |
| S-05 | Build and deploy: no `.env` baked into images; no tokens committed in CI files. The B0 Jenkinsfile contains a hardcoded SonarQube token → rotate and move it to credentials (OD-25; outside migration code, but a prerequisite for the new pipeline) |
| S-06 | The legacy runtime still logs tokens and passwords (A2-C01 / C02). Remediating the running legacy system is **OD-19 (urgent, owner)** and independent of the migration |

## 3. Browser exposure

- The browser receives only the httpOnly session cookie, the `ClientSessionView` (name / email / role label), and page data view models.
- No gateway URL, no token, no API key, no raw gateway responses, no stack traces.
- The legacy `env()` view-global exposure pattern (A2-M06) has no equivalent: the client reads only `shared/config/public.ts`.

## 4. XSS

| Control | Detail |
|---|---|
| Default escaping | React JSX. No `dangerouslySetInnerHTML` except in: (a) the shadcn `ui/chart` style injection (existing, static), (b) the approved rich-text preview renderer **with sanitization** (OD-11) |
| Server data into scripts | No equivalent of the legacy `{{{ toJSON(...) }}}` inline script embedding (A2-M07, A3.1 §14). Data crosses via RSC props (serialized safely) |
| CSP | Adopt a Content-Security-Policy (Next.js 16 `content-security-policy.md`: nonce-based via `proxy.ts`). The legacy CSP had empty directives. Exact policy: implementation task (A5), including allowed image / CDN / storage hosts |
| URL handling | Only `http(s)` URLs are rendered as links / images from data (block `javascript:`) |

## 5. CSRF

| Endpoint type | Control |
|---|---|
| Server Actions | Built-in POST-only + Origin / Host check (Next.js 16 `data-security.md`); `serverActions.allowedOrigins` only when fronted by a proxy with a different host |
| Route Handlers (`/api/bff/*`, auth routes) | Mandatory: method allowlist, `Origin` (or `Sec-Fetch-Site`) verification, JSON content type, **no method override** (`_method` / `X-HTTP-Method-Override` are rejected). Fixes A3-S01 |
| Cookies | Session `SameSite=Lax`, `Secure`, `httpOnly` |
| GET | Never state-changing (legacy GET logout and GET voucher cancel become POST) |

## 6. Open redirect

`returnTo` / `callbackUrl` accept only same-origin relative paths (auth AC-09). The B0 `PublicPage` uses `searchParams.get('callbackUrl')` without validation; replace it.

## 7. Unauthorized access, IDOR and error leakage

| Topic | Rule |
|---|---|
| Unauthorized access | Route guard + action guard + policy (navigation document). Hidden routes are still protected |
| IDOR | Object-level authorization is a **backend responsibility**. The frontend never assumes that possession of an id implies access: every detail / update / delete goes through the gateway with the user's token, and a 403 / 404 is rendered as such |
| Error leakage | The UI shows mapped messages by `AppError.kind`. Gateway `message` text is shown only for `Business` / `Validation` / `Conflict`, after trimming to a safe length and stripping markup. Never show stack traces, SQL, internal hostnames or file paths (project rule) |
| Correlation | Show a correlation id on server errors, for support |

## 8. Upload and file validation

| Rule | Detail |
|---|---|
| U-01 | Per-field upload policy (type / extension / size), enforced **client-side and in the BFF sign handler** (API document §9) |
| U-02 | Signed URLs are never logged, stored or rendered. They are used immediately for the PUT |
| U-03 | No server-side fetch of arbitrary URLs. CSV imports accept only URLs on the configured storage host (fixes A2-M04, legacy `validate-branch-csv`) |
| U-04 | Storage-side constraints (content-length / content-type conditions in the signature, bucket ACL, expiry): backend dependency OD-18 |
| U-05 | The Principal image legacy local-disk storage (`public/images`, publicly served) is not reproduced (OD-18) |

## 9. Logging, PII and sensitive data

| Rule | Detail |
|---|---|
| L-01 | Never log: tokens, `Authorization` / `Cookie` / `Set-Cookie` headers, passwords, signed URLs, request / response bodies of auth, upload-sign and PII-bearing endpoints |
| L-02 | Log metadata only: route, use case, gateway path template, status, duration, correlation id |
| L-03 | PII in data (customer names, emails, phone numbers, AAM customer ids, addresses in orders / payments / verifications) is not logged. IDs are logged only when needed for support, and never together with names or contacts |
| L-04 | Error reports (if a service is adopted, OD-24) are scrubbed of PII and headers before sending |
| L-05 | The legacy `console.log("AUTH", auth)` equivalent is prohibited. A lint / grep gate on `console.log` of session / auth objects applies in CI |

## 10. Threat checklist for implementation reviews

1. No new client component imports from `shared/infrastructure/*` (enforced by `server-only`).
2. Every Server Action: zod parse → auth check → use case; returns `ActionResult`.
3. Every Route Handler: method, Origin, content type, session, zod parse.
4. No `NEXT_PUBLIC_*` secret; no `env` in `next.config.ts`.
5. No `dangerouslySetInnerHTML` outside the approved list.
6. `returnTo` is validated.
7. Uploads follow U-01…U-03.
8. Logs follow L-01…L-05.
