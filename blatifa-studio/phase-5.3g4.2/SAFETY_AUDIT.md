# Phase 5.3g.4.2: safety and integrity audit

> **Ringkasan (ID):**
> - Fase ini sepenuhnya offline: tidak ada Flow, browser, maupun kredit.
> - Dari 326 file yang dilindungi, 5 berubah: 2 baris manifest dan 3 integrity root yang di-pin eksak.
> - Riwayat G.1 sampai G.4.1, DB eksperimen, flag, dan 18 `deny: true` utuh.

## 1. Safety

| Item | Result |
|---|---|
| Flow interaction | **NONE** |
| Browser interaction (Chrome, Playwright, CDP) | **NONE**. `tests/browser` was excluded from the run, and `tests/live` was skipped |
| `blatifa account` / `preflight` / `live-probe` / `browser *` | not run |
| Cookies, tokens, storage, network interception | none |
| Credits consumed | **0** |
| Live generation authorized | **NO** |
| `LIVE_ACTIONS_ACTIVE` | `Final = False` (`authorization.py:30`), unchanged |
| `deny: true` | 18, unchanged (`flow_locators.yaml` hash unchanged) |
| `BLATIFA_LIVE` | unset |
| Mutation tests | not run |

Evidence: `evidence/resource_and_flags_before.txt` and `evidence/flags_after.txt`.

## 2. Protected hashes

`evidence/protected_hashes_before.txt` was recorded before any edit. It has 326 entries:
- the G.4.1 list;
- every file of `docs/phase-5.3g4.1`;
- every `.py` file in `src/blatifa` and `tests`;
- `p53g.db`.

`evidence/protected_hashes_after.txt` was recorded after the full run: 321 entries are unchanged and **5 changed**:

| File | Kind | Approved by |
|---|---|---|
| `src/blatifa/production/gates.py` | production (phase scope) | manifest row `0a2fa5d0… → 5b701a9e…` |
| `tests/unit/test_phase5_3g3_credit_contract.py` | historical test (user-approved migration) | manifest row `411df6e5… → 67d8a44b…` |
| `tests/unit/protected_hashes.py` | integrity root | exact pin in the G.4, G.4.1 and G.4.2 tests (`bba115a2…`) |
| `tests/unit/test_phase5_3g4_credit_paths.py` | integrity root | exact pin in the G.4.1 and G.4.2 tests |
| `tests/unit/test_phase5_3g4_1_adapter_trust.py` | integrity root | exact pin in the G.4.2 test |

The roots cannot be manifest rows: the helper is never approvable, and a row for either test would create a hash
cycle. Their old digests are in the manifest header.

A whole-tree comparison with the snapshot taken at the start of the G.4.2 audit (1782 files) shows, besides those
5 files, only:
- the new `tests/unit/test_phase5_3g4_2_freshness.py`;
- the new `docs/phase-5.3g4.2/` files;
- `.ruff_cache` (lint tool cache, not a project file).

## 3. Integrity mechanism

- **New manifest** `docs/phase-5.3g4.2/evidence/approved_changes.txt` (sha `8c762e0d…`):
  - registered in `protected_hashes.MANIFESTS`;
  - pinned again in the G.4, G.4.1 and G.4.2 tests;
  - it contains no row for a root, a manifest or a baseline (`test_manifest_lists_only_the_approved_files`).
- **Pin order (DAG):** manifest → helper → G.4 test → G.4.1 test → G.4.2 test. Each file pins only files earlier
  in that order.
- **The G.4.1 integrity test is now chain-aware**, as required by the audit. Previously it accepted only the exact
  G.4.1 rows. Now:
  - a G.4.1 row must still start at its G.4.1 before-digest;
  - the file must be at the G.4.1 new digest, or at a digest reached from it by later pinned manifests
    (`protected_hashes.matches`, the same fail-closed mechanism used since 5.3g.3);
  - files without a G.4.1 row must be unchanged or reach their digest by a pinned chain;
  - roots must match exactly.

  No exclusion by path was added.
- **The G.4.2 integrity test accepts only exact matches:** every entry must be unchanged, equal to an exact G.4.2
  row, or a pinned root. Changed set = rows + roots, exactly.
- **Fail-closed, proven** by `test_without_the_new_manifest_the_change_is_refused`: without the G.4.2 manifest the
  changed `gates.py` is refused, and a wrong pin raises `ManifestIntegrityError`.
- **Not claimed:** cryptographic protection. All pins live in this repository (OPEN, below).

## 4. Historical artifacts

| Item | Result |
|---|---|
| `docs/phase-5.3g1` (20 files), `5.3g2` (11), `5.3g3` (14), `5.3g4` (18), `5.3g4.1` (16) | identical to before |
| `docs/phase-5.3e` / `5.3f` / `5.3f1` baseline files | identical |
| `p53g.db` | `a6e4cacf…`, unchanged; hash only, never opened for writing |
| `FINAL_PROMPT.txt` / `BASE_PROMPT.txt` | `f45e9887…` / `828d967a…`, unchanged |
| Experiment `EXP-P53G-20261110-56C3`, attempt, nonce | not touched; no new experiment or attempt was created |
| Manual submission, nonce binding, handoff, media_identity, Octopus lock | files unchanged |
| Gate business rules | `181d780a…`, unchanged |

## 5. OPEN and DEFERRED (not resolved by this phase)

| # | Item | Status |
|---|---|---|
| 1 | R-2: `read_at` provenance. A re-stamped (`replace(read_at=now)`) or directly constructed `BalanceReading` is judged fresh | **OPEN, deferred to R-2** |
| 2 | Same-process monkeypatching (helper, `SimulatedFlow`, the trust rule) | OPEN |
| 3 | F-4 | OPEN |
| 4 | `read_credits()` clicks (opens and closes the account panel) | OPEN; not invoked, not changed |
| 5 | `ESTIMATED` accepted by `preflight_gate`, no producer | OPEN; gate unchanged |
| 6 | Repository-local hashes are not an independent trust anchor | OPEN |
| 7 | Mutation evidence | `MUTATION EVIDENCE NOT INDEPENDENTLY VERIFIED` |
| 8 | `tests/browser` (43) not run in G.4.2 | coverage gap of this phase (TEST_REPORT §3) |

Closed by this phase: the G.4.1 item **"OPEN — freshness override API risk"**, at the API level. Callers can no
longer pass `now` or `max_age_s`. Item 1 remains a separate, open way to make an old reading look fresh.
