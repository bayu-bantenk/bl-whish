# Migration phase summary

TEST_ADAPTER = mock backend / unit / E2E evidence. REAL_BACKEND = actual gateway evidence. They are never combined.

| Phase | Scope | Gate | Note |
|---|---|---|---|
| A5.0 | Foundation remediation | done | — |
| A5.1 | Auth / session / gateway | GO-WITH-RISKS | — |
| A5.2 | Dashboard shell / navigation | GO-WITH-RISKS | — |
| A5.3 | DAL / container / error contract | GO-WITH-RISKS | — |
| A5.4 | Authorization policy | GO-WITH-RISKS | — |
| A5.5 | DataTable + legacy API evidence | GO-WITH-RISKS | — |
| A5.5R | Real backend contract verification | BLOCKED | superseded by A6-R |
| A5.6 | Form + upload | GO-WITH-RISKS | real upload contract BLOCKED |
| A5.7 | E2E / CI / accessibility | GO-WITH-RISKS | CI E2E BLOCKED |
| A6 | First production vertical slice (Content) | **BLOCKED** | TEST_ADAPTER green (511 unit, 65 E2E); waiting on A6-R |
| A6-R | Real backend & auth re-gate | **BLOCKED** | gateway `devb2b-api.gpos.id` reachable; unauthenticated probes done; `legacy-v1` refresh path fixed; `.env.local` target set; harness extended (detail, rotation, refresh failure, logout). Authenticated run BLOCKED: `A55R_*` not in the agent process (IDE-launched). Next: run `npm run test:live` in the owner terminal |

Latest: 2026-09-30 — see `A6R_REAL_BACKEND_AUTH_RE_GATE.md` (attempt 4).
