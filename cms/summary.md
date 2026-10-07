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

### Remaining Feature Count

16 legacy features are still unmigrated: F02, F03, F05, F12, F13, F14, F15, F16, F17, F21, F22, F23, F26, F27, F29, F31. F02 and F05 are partially present in Next.js; the rest are not started. The legacy app has no other hidden capability: the profile, roles and audit links are dead or commented-out template code. Every one of the 16 is held back by at least one of: an owner decision still open, an unknown on the backend side, or write side effects on real users, money, the ERP or devices.

### Recommended Batch 4

This is a proposal; it needs your approval before any work starts.

1. **F27 Verifikasi Akun.** All 6 A4 rows are MIGRATE and it is in the menu. The contract is verified on an `account-service` clone that matches `origin/development`. It has no lookup dependencies, and its read quirks are known: an empty list returns 404, and a non-numeric `customer_id` returns 500.
2. **F31 Manajemen Pengguna.** Same service, contract verified. It reuses the F25 branch picker. The legacy screen is only list, active toggle and delete; create and edit are commented out.
3. **F03 Order / Pesanan.** It fills the missing Order entry in the Transaksi menu. The `order-service` clone also matches `origin/development`, and it reuses the existing customer picker. Update, delete and bulk delete are left out because the backend has no handler for them (OD-09 still to be confirmed). The sync action would be tested against mocks only.

### Reserve Candidates

- **F05 Pembayaran:** its clone is on a feature branch, and its only write is a real BCA settlement.
- **F22 Voucher Pengiriman:** the `merchant-service` clone is from 2024-11.
- **F29 Pendaftaran Folamil:** the upload contract is not confirmed.
- **F15 Mutasi & Redeem:** only if OD-07 decides to migrate the hidden screens.

### Deferred / Needs Evidence

- **F26 Konfigurasi Channel:** blocked, because the `config_service` source is not in the workspace.
- **F17 Push Notification:** clone from 2025-04, no backend bulk DELETE, sends to real devices, OD-37 open.
- **F23 GPOS Brand:** its writes send buyer WhatsApp messages and merchant pushes, with no status guard.
- **F13 and F14/F16:** waiting on OD-08 and OD-07 respectively, and both involve points or money.
- **F12 and F21:** partially verified only.
- **F02 Beranda:** waiting on OD-10.
- **Across all modules:** backend role enforcement at the gateway (A2-U04) is unknown, and the gateway does not strip identity headers sent by the client.

### Explicit Exclusions

- F04 Order Review — SKIP.
- F11 W3 — not authorized and not started.
- Batch 3 deferred backend defects (B3-04, B3-13, B3-14 – B3-22) and the Batch 1/2 findings — not reopened as migration work.
- Live WRITE for any module.
- The F03 and F17 actions that have no backend handler.

### Readiness

- **Backend contracts:** F27, F31 and F03 are verified on fresh clones. F05, F22 and F23 are verified only on clones that are stale or on a non-main branch.
- **READ:** F27, F31 and F03 are ready, but no live READ has been run yet. For F03, whether `total_rows` is correct still needs live evidence.
- **WRITE:** not ready for any candidate. Each one triggers something hard to undo:
  - F27 sends emails, and reject is irreversible.
  - F31 revokes tokens and deletes the user in AAM.
  - F03 sync goes to the ERP and creates invoices.
  - F05 settles a payment.
- **Dependencies:** existing pickers and the DAL foundation are ready. AAM, payment-service and merchant-service are conditional or unknown. Nothing depends on the open Batch 2/3 findings.
- **Main risks:** `sort_by` is concatenated into SQL (an allowlist is needed). F03 silently limits results to the last year, uses only the first customer id, and ignores database errors.

### Documentation

- **Created:**
  - `bl-whish/cms/BATCH4_SCOPE_DISCOVERY.md` (sections A–N).
  - `frontend/docs/architecture/reviews/BATCH4_SCOPE_DISCOVERY.md` (identical copy).
- **Updated:** `bl-whish/cms/claude-summary.md`, one new line under the current snapshot.
- **Untouched:** all historical reports, including `BATCH3_SCOPE_DISCOVERY.md` and `BATCH3_CLOSURE_GATE.md`.
- **Correction recorded:** the GOPH-4102 inject-point fix is in fact merged on loyalty-service `development`. I recorded this correction in the Batch 4 document instead of editing the Batch 3 report.

### Validation

- **`bl-whish`:** `git status --short` shows `M cms/claude-summary.md` and `?? cms/BATCH4_SCOPE_DISCOVERY.md`.
- **`git diff --check` on `bl-whish`:** it flags the new `claude-summary.md` line as trailing whitespace, but the cause is only its CR. The committed file is now entirely CRLF and I kept that ending. With `core.whitespace=cr-at-eol` the check is clean.
- **Frontend:** `git diff --check` is clean; `docs/` is still untracked.
- **Report accuracy:** one sub-agent's F05 output was fabricated (paths that don't exist), so I dropped it. I checked every claim the recommendation rests on against the source myself, and that check corrected the F27 endpoint path in the document.

### Safety

- No application code changed.
- No backend code changed.
- No live business mutation was performed, and no live API call of any kind was made.
- F11 W3 was not run.
- No feature implementation was started, and nothing was committed.
