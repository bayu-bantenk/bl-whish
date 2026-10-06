Batch 2 can't be closed yet: the decision is **HOLD**. Everything automated is green, but two required inputs are still missing. Live READ hasn't run against the real backend for any of the five modules, because the live credentials only exist in your terminal. And the F19 Group Story backend contract isn't available anywhere in the workspace.

```text
BATCH 2 CLOSURE GATE

F08 Kategori Produk
- Module Gate: PASS
- Automated Tests: unit 40/40 · E2E 4/4
- Visual Parity: NEEDS EVIDENCE — no legacy screenshots exist for list/edit. Small fixes made: Aksi column moved first, 24px thumbnail, default page size 5
- Live READ: BLOCKED (credentials/environment)
- Live WRITE: NOT RUN
- Issues: sort_by is concatenated into SQL ORDER BY on the backend (BACKEND BUG — OPEN)

F19 Group Story
- Module Gate: PASS — PARTIAL / CONTRACT BLOCKED
- Automated Tests: unit 47/47 · E2E 4/4
- Visual Parity: PASS — fixed: On/Off text, failure toast, Kembali/Lanjutkan dialog,
  "Belum ada grup story" empty state, Kembali/Simpan top-right, breadcrumbs.
  Gradient header and drag-and-drop reorder intentionally not reproduced
- Live READ: BLOCKED (credentials/environment)
- Live WRITE: NOT RUN
- Contract: BACKEND CONTRACT REQUIRED — the story-group source is not in any branch of the 13 backend repos.
  The gateway confirms the routes (content_service); create/update are based on legacy code only

F18 Banner & Iklan
- Module Gate: PASS
- Automated Tests: unit 45/45 · E2E 8/8
- Visual Parity: PASS except Deskripsi Konten (legacy Quill editor vs plain textarea) → NEEDS OWNER DECISION
- Live READ: BLOCKED (credentials/environment)
- Upload Contract: ESTABLISHED — POST /files/signurl with a JSON body (not multipart), response
  {url, file_url}, category "images"; the entity stores file_url (content-service file.go/oss.go)
- Live WRITE: NOT RUN
- Katalog Produk tab: required legacy behaviour → now implemented. The promo-code lookup is
  BLOCKED — legacy has no endpoint for it either

F28 Prinsipal
- Module Gate: PASS
- Automated Tests: unit 41/41 · E2E 5/5
- Visual Parity: NEEDS EVIDENCE (the legacy edit page returned 500 on mock data, so no screenshot exists)
- Live READ: BLOCKED (credentials/environment)
- Live WRITE: NOT RUN

F07 Produk
- Module Gate: PASS
- Automated Tests: unit 34/34 · E2E 4/4
- Visual Parity: PASS — legacy showed plain text and raw field names; badges and readable labels
  are deliberate. Default page size 5 as in legacy
- Live READ: BLOCKED (credentials/environment)
- Live WRITE: NOT RUN

AUTOMATED VALIDATION
- Vitest: 960/960 (npm run quality)
- E2E: 132/132 (full suite). Failures seen while the host was overloaded (load 9–17,
  antivirus ~77% CPU) were timeouts, and each passed when rerun.
  The datatable.spec flake is in a Batch 1 module, not Batch 2
- TypeScript: PASS (0 errors)
- Lint: PASS (0 errors, 28 pre-existing warnings)
- Build: PASS
- Bundle: PASS (no backend paths or wire field names in the client bundle)

LIVE READ
- F08 / F19 / F18 / F28 / F07: BLOCKED — the A55R_* credentials are only in your terminal

BACKEND FINDINGS (BACKEND BUG — OPEN, no frontend workaround)
- F07 GET /cms/products/{unknown id} → 500 instead of 404
- F07 PUT forces is_draft=false and overwrites the whole row
- Updates(struct) silently drops zero values: banner (sequence 0 / empty link / story_image),
  principal (is_active=false, emptied phone/fax/etc.), custom-criteria (price 0)
- sort_by concatenated into SQL on the F07/F08/F18/F28 lists

REMAINING BLOCKERS
- G-01 (all 5): Live READ not run → owner runs the command below
- G-02 (F19): story-group contract → backend team (git fetch content-service, or the source from its author)

BATCH 2 CLOSURE DECISION
- HOLD
- Reason: implementation and every automated gate are green, but live READ evidence (mandatory)
  doesn't exist yet and the F19 write contract can't be verified. If both are resolved
  → expected CONDITIONAL GO (remaining: Quill decision, screenshots for F08/F28, backend bugs).

NEXT ACTION
- Run in your terminal (A55R_CONFIRM_NON_PRODUCTION, A55R_ALLOWED_HOST, A55R_EMAIL, A55R_PASSWORD already set):
    cd frontend
    for m in product product-category banner group-story principal; do
      LIVE_MODULE=$m npx vitest run --config vitest.live.config.js test/live/module-smoke.live.test.ts
    done
  Note: the F07 R5 step (unknown id) is expected to show a Server error because of backend bug B2-01.
- Ask the backend team for the content-service story-group handler/DTO.
- Batch 3: NOT STARTED
```

During this gate I also found and fixed two real Batch 2 defects:
- **Table cells reset on every refresh:** the column list was rebuilt on each render, so every cell was recreated whenever the list refreshed. A half-typed inline value was lost and an open delete dialog closed. Fixed in four tables.
- **Double PUT on inline sequence (F18 and F19):** after pressing Enter, the field lost focus and saved the same value a second time. Fixed with a guard.

Each fix has a regression test that fails without it.

Documents updated:
- `frontend/docs/architecture/reviews/BATCH2_CLOSURE_GATE.md` (new) and `BATCH2_MIGRATION_REPORT.md`.
- Both copied to `~/Developments/bl-whish/cms/`, and `claude-summary.md` there has a new Batch 2 section.
