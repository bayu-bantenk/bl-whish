**PHASE:** A5.0 Foundation Remediation & Quality Gate

**STATUS: CONDITIONAL GO.** No critical security or architecture gate fails. Two gates are BLOCKED, one by a missing dependency (prettier) and one by the network. You also need to rotate a SonarQube token that was committed in the `Jenkinsfile`. It is still in git history.

**DOCUMENTATION (DD-01..07):** all fixed. The four rule-file copies (`.claude`, `.agents`, `.github`, `.cursor`) now have identical bodies, and each keeps its own header.
- **DD-01:** atoms are `src/components/ui/**`. The separate "Shadcn" bullet is gone. Added "don't create `components/atoms`" and a rule for the templates tier.
- **DD-02:** the broken `.schema.ts<package-name>` paths are fixed.
- **DD-03:** schemas go in `domain/<pkg>.schema.ts`. No schema files are left after the deletion, so none needed moving.
- **DD-04:** naming rules updated. The auth files are renamed to `auth.usecase.ts` and `auth.repository.ts`.
- **DD-05:** added R7: other features may use a feature's use case, never its repository. Also fixed the broken presentation bullet in the layer-separation rule.
- **DD-06:** the README now describes the A4 layers. The obsolete `husky-init` line is replaced by `npm run quality`.
- **DD-07:** `components.json` now points at `src/shared/styles/globals.css`, `@/shared/utils` and `@/shared/hooks`. Removed the broken `@/lib` alias from `tsconfig.json`.
- **Dashboard shell:** the rule is documented (the `(dashboard)` layout owns the header and navigator; features render content only). Not implemented.

**QUALITY:**

| Gate | Result |
|---|---|
| Lint | PASS: 0 errors, 28 warnings (was 355 errors). No rules weakened |
| Typecheck | PASS |
| Tests | PASS, 2/2 (was failing) |
| Build | PASS (Next 16.2.3, Turbopack) |
| Husky `commit-msg` | PASS: a valid message is accepted, a bad one rejected |
| Husky `pre-commit` | BLOCKED: `prettier` and its sort-imports plugin aren't declared dependencies, and the registry returns 403 |
| CI | Stage added as `RUN npm run quality` in the `Dockerfile` before the build. Not executed |
| `npm ci` | BLOCKED (registry 403) |

**SECURITY:**
- **Fixed:**
  - `next.config` no longer puts `API_HOST` or `KONG_API_KEY` into the browser bundle. A scan of the built bundle finds 0 hits for these, the Api-Key header, the token field names and `APP_KEY`.
  - The browser no longer calls the gateway: the auth screens now use Server Actions.
  - The sign-in response no longer returns tokens or the raw gateway payload, and the extra `access-token` cookie is gone.
  - `session.token` is removed from the session data sent to the client.
  - `APP_KEY` is removed from the shared config.
  - Every module that touches the gateway, tokens or secrets is marked `server-only`.
  - The SonarQube token is now read from Jenkins credentials.
  - Added `no-console: error` to the lint config. There are 0 `console.*` calls in `src`.
- **Open:**
  - The `Dockerfile` copies `.env` into the image.
  - `getServerSession` decodes the session cookie without checking its signature, so it can be forged. The cookie also carries the gateway token (httpOnly and signed, but not encrypted). Both move to A5.1.

**ARCHITECTURE:**
- The dependency direction checks pass, and shadcn/Tailwind are set up correctly.
- **Open for A5.1:**
  - Use cases still create their own HTTP client.
  - Feature pages still render `Header`/`SidebarInset` themselves, against the shell rule.
  - Client components still import `authClient`.

**CHANGES:**
- **OD-17 = RESOLVED: DexanKit template feature packages are removed because they are outside the GPOS legacy scope.**
- **Deleted:** the 7 template packages, their routes, the profile route and a dead dashboard gateway client.
- **Traceability:** 7 of the 8 checks passed. Check 7 did not: the auth screens also called the gateway from the browser, so I fixed those minimally rather than keeping any package. No package was needed by a MIGRATE capability or shared code.
- **Dependencies:** removed `reactflow` and `shell-quote`, which are now unused. Nothing added.
- **Other cleanup:** removed the duplicate `lint-staged.config.js` and the dead ESLint configs (`.eslintrc.json`, `.eslintignore`, `package.json` `eslintConfig`).
- Nothing is committed yet; everything is in the working tree on branch `chore/a5.0-foundation-remediation`.

**BLOCKERS:**
1. Rotate the SonarQube token and create the Jenkins credential `sonarqube-frontend-token`.
2. Approve adding `prettier` and `@trivago/prettier-plugin-sort-imports`, or agree to drop prettier from the pre-commit hook.
3. Run `npm ci` and the Jenkins pipeline on a network that can reach the npm registry.
4. Approve declaring `zod` as a direct dependency (OD-14). The code imports it, but it's only installed through another package.
5. The A5.1 items above.

**EVIDENCE:** `npm run quality` exits 0 and `next build` exits 0. The report lists every command and its result, including the bundle scans, the Husky/commitlint checks, `npm ls zod` and the `prettier` 403. `.env` was never read, and no secret values are recorded.

**REPORT:** `frontend/docs/architecture/reviews/A5.0_FOUNDATION_REMEDIATION.md`