Batch 2 is now **CONDITIONAL GO**. Live READ passed for all five modules, and the remaining conditions are on the backend side.

During the run, live READ caught one real frontend bug. The "Katalog Produk" tab on Banner & Iklan would have failed for every banner, because the backend sends some master-data entries with a blank name and the frontend rejected them. Blank names are now shown as the id, and the rerun passed.

```text
BATCH 2 CLOSURE GATE

F08 Kategori Produk
- Module Gate: PASS
- Automated Tests: unit 40/40 · E2E 4/4
- Visual Parity: NEEDS EVIDENCE (no legacy screenshots for list/edit)
- Live READ: PASS (12 categories; some have a blank name in devb2b data)
- Live WRITE: NOT RUN
- Issues: none blocking

F19 Group Story
- Module Gate: PASS (CONDITIONAL)
- Automated Tests: unit 47/47 · E2E 4/4
- Visual Parity: PASS
- Live READ: PASS — list/detail/search/banner lookup match; the response shape (worked out from legacy) is now confirmed live
- Live WRITE: NOT RUN
- Contract: READ verified live · WRITE (create/update) still unconfirmed — the story-group backend source isn't in the workspace

F18 Banner & Iklan
- Module Gate: PASS
- Automated Tests: unit 46/46 · E2E 8/8
- Visual Parity: PASS except the description editor (legacy rich-text Quill vs plain textarea) → NEEDS DECISION
- Live READ: PASS (rerun after the fix; 11 lookups + criteria detail)
- Upload Contract: ESTABLISHED (signurl JSON → upload directly to storage → file_url)
- Live WRITE: NOT RUN

F28 Prinsipal
- Module Gate: PASS
- Automated Tests: unit 41/41 · E2E 5/5
- Visual Parity: NEEDS EVIDENCE
- Live READ: PASS except pages 1 and 2 overlap → backend bug B2-08
- Live WRITE: NOT RUN

F07 Produk
- Module Gate: PASS
- Automated Tests: unit 34/34 · E2E 4/4
- Visual Parity: PASS
- Live READ: PASS (29,987 products) except "unknown id" → 500, backend bug B2-01
- Live WRITE: NOT RUN

AUTOMATED VALIDATION
- Vitest: 961/961 · E2E: 132/132 · TypeScript: 0 · Lint: 0 errors · Build: PASS · Bundle: PASS

LIVE READ (devb2b-api.gpos.id, 2026-10-06)
- F08 PASS · F19 READ PASS · F18 PASS · F28 PASS (B2-08) · F07 PASS (B2-01)
- Mutations: 0 on every run · Secret scan of evidence: 0 on every run

BACKEND FINDINGS (BACKEND BUG — OPEN, no frontend workaround)
- B2-01 F07: unknown id returns 500 instead of 404
- B2-02 F07: update forces is_draft=false and overwrites the whole row
- B2-03/04/05: Updates(struct) silently drops zero/empty values (banner, principal, custom-criteria)
- B2-06: sort_by is pasted into SQL ORDER BY unsanitised (F07/F08/F18/F28)
- B2-08 (new, live): default sort on a non-unique column (F28 is_active, F07 is_draft) with no tiebreaker →
  rows repeat or go missing between pages; same in legacy; backend needs a second sort key such as id

REMAINING BLOCKERS
- F19: the backend team needs to confirm the create/update contract (content-service story-group handler/DTO)

BATCH 2 CLOSURE DECISION
- CONDITIONAL GO
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
