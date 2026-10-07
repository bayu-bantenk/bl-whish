# CURRENT MIGRATION SNAPSHOT (2026-10-07)

| Batch | State | Canonical record |
|---|---|---|
| Batch 1 | completed (CONDITIONAL GO) | `BATCH1_MIGRATION_REPORT.md` |
| Batch 2 | conditionally closed (CONDITIONAL GO) | `BATCH2_CLOSURE_GATE.md` |
| Batch 3 | conditionally closed (CONDITIONAL GO; F04 SKIP) | `BATCH3_CLOSURE_GATE.md` |
| Batch 4 | scope discovery completed; **scope locked** (F27, F31, F03); **implementation NOT STARTED** | `BATCH4_SCOPE_DISCOVERY.md`, `BATCH4_SCOPE_LOCK.md` |

Live WRITE: not authorized. F11 W3: not started.

---

## Historical — Batch 2 closure summary (2026-10-06)

> Kept as written at the time; the "Batch 3: NOT STARTED" line below is historical. See the snapshot above for the current state.

Batch 2 is now **CONDITIONAL GO** (final documentation closure, 2026-10-06). All five modules have LIVE READ evidence; the remaining conditions are backend defects and the unverified F19 write contract. LIVE WRITE was **not authorized**: no Batch 2 CREATE / UPDATE / DELETE / upload was performed, and F11 W3 is not started.

During the run, live READ caught one real frontend bug. The "Katalog Produk" tab on Banner & Iklan would have failed for every banner, because the backend sends some master-data entries with a blank name and the frontend rejected them. Blank names are now shown as the id, and the rerun passed.

```text
BATCH 2 CLOSURE GATE

F08 Kategori Produk — FINAL: GO
- Module Gate: PASS
- Automated Tests: unit 40/40 · E2E 4/4
- Visual Parity: NEEDS EVIDENCE (no legacy screenshots for list/edit)
- Live READ: PASS (12 categories; some have an empty name in dev backend data — backend data quality, no workaround)
- Live WRITE: NOT RUN
- Issues: none blocking

F19 Group Story — FINAL: CONDITIONAL GO — LIVE READ PASS; WRITE CONTRACT UNVERIFIED
- Module Gate: PASS (CONDITIONAL)
- Automated Tests: unit 47/47 · E2E 4/4
- Visual Parity: PASS
- Live READ: PASS — list/detail/search/banner lookup match; the response shape (worked out from legacy) is now confirmed live;
  R3 asc flag = legacy-compatible "expired groups sink to the bottom", not a defect
- Live WRITE: NOT RUN
- Contract: READ verified live · WRITE (create/update) still unconfirmed — the story-group backend source isn't in the workspace

F18 Banner & Iklan — FINAL: GO — LIVE READ PASS (POST-FIX CONFIRMED)
- Module Gate: PASS
- Automated Tests: unit 46/46 · E2E 8/8
- Visual Parity: PASS; description editor (legacy rich-text Quill vs plain textarea) = deferred owner decision, non-blocking
- Live READ: PASS, post-fix confirmed 2026-10-06 08:23 UTC
  `LIVE_MODULE=banner npx --no-install vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts`
  → 7 passed / 5 skipped (W0–W3); R1–R6 PASS; login 200, logout 200; criteria options
  (principals, products, product-categories, catalogs, product-class, tc, tc/sub) + criteria detail all HTTP 200;
  mutations 0; evidence banner/evidence-20261006082314.json (32 observations)
- Frontend defect (criteria detail mapping, found live): FIXED — not open
- Upload Contract: ESTABLISHED (signurl JSON → upload directly to storage → file_url)
- Live WRITE: NOT RUN

F28 Prinsipal — FINAL: CONDITIONAL GO — LIVE READ OTHERWISE PASS; BACKEND PAGINATION ORDERING DEFECT B2-08
- Module Gate: PASS
- Automated Tests: unit 41/41 · E2E 5/5
- Visual Parity: NEEDS EVIDENCE
- Live READ: PASS except pages 1 and 2 overlap → backend bug B2-08
- Live WRITE: NOT RUN

F07 Produk — FINAL: CONDITIONAL GO (B2-01)
- Module Gate: PASS
- Automated Tests: unit 34/34 · E2E 4/4
- Visual Parity: PASS
- Live READ: R1–R4 PASS (29,987 products); R5 expected failure: "unknown id" → HTTP 500, backend bug B2-01 (no workaround)
- Live WRITE: NOT RUN

AUTOMATED VALIDATION
- Vitest: 960/960 at the closure-gate run (961/961 on the latest run after the F18 regression test) · E2E: 132/132 · TypeScript: 0 · Lint: 0 errors · Build: PASS · Bundle: PASS

LIVE READ (devb2b-api.gpos.id, 2026-10-06)
- F08 PASS · F19 READ PASS · F18 PASS (post-fix 08:23) · F28 PASS except R2 (B2-08) · F07 R1–R4 PASS, R5 = B2-01
- Mutations: 0 on every run · Secret scan of evidence: 0 on every run

BACKEND FINDINGS (BACKEND BUG — OPEN, no frontend workaround)
- B2-01 F07: unknown id returns 500 instead of 404
- B2-02 F07: update forces is_draft=false and overwrites the whole row
- B2-03/04/05: Updates(struct) silently drops zero/empty values (banner, principal, custom-criteria)
- B2-06: sort_by is pasted into SQL ORDER BY unsanitised (F07/F08/F18/F28)
- B2-08 (new, live): non-deterministic pagination — ORDER BY lacks a unique secondary tie-breaker
  (F28 default is_active DESC: 142 principals, 2 values; also F07 is_draft) → rows repeat or go missing
  between pages; same in legacy; backend accepts one sort_by, so the frontend cannot fix it reliably

REMAINING BLOCKERS
- F19: the backend team needs to confirm the create/update contract (content-service story-group handler/DTO)

BATCH 2 CLOSURE DECISION
- CONDITIONAL GO
- Final: F08 GO · F07 CONDITIONAL GO · F18 GO · F19 CONDITIONAL GO · F28 CONDITIONAL GO
- LIVE WRITE: NOT AUTHORIZED — CRUD write behaviour is not proven live for Batch 2
- Reason: all automated gates and all live READ checks pass; the one frontend bug live READ found is fixed
  and re-verified; what's left is outside the frontend (F19 write contract, backend bugs) and is documented

NEXT ACTION
- Ask the backend team for the content-service story-group contract and the fixes for B2-01…B2-08
- Decide on Quill vs textarea for the F18 description; legacy screenshots for F08/F28 if strict visual parity is required
- Batch 3: NOT STARTED (waiting for your decision)
```

Documents updated:
- `frontend/docs/architecture/reviews/BATCH2_CLOSURE_GATE.md` and `BATCH2_MIGRATION_REPORT.md`, both also copied to `~/Developments/bl-whish/cms/`.
- `claude-summary.md` there: I added a closure section at the end without changing its existing content.
