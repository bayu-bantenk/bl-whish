# Phase 5.3g.4.1: safety and integrity audit

> **Ringkasan (ID):**
> - Fase ini sepenuhnya offline: tidak ada Chrome, Flow, klik, maupun kredit.
> - Dari 309 file yang dilindungi, 11 berubah. Sembilan tercatat persis di `approved_changes.txt`, dan dua adalah
>   integrity root yang di-pin dengan digest eksak.
> - Semua artefak 5.3g.1 sampai 5.3g.4, DB eksperimen, `LIVE_ACTIONS_ACTIVE=False` dan 18 `deny: true` utuh.
> - Hash lokal di repo **bukan** perlindungan kriptografis.

## 1. Forbidden actions: none performed

| Action | Performed? |
|---|---|
| Open Google Flow, start or attach Chrome, any live browser | no |
| Click, type, submit, approve, reject, generate, publish, download (live) | no |
| `blatifa account`, `blatifa preflight`, `blatifa browser`, `live-probe` | not run. The tests drive no CLI command that reaches a browser, and `test_this_module_never_reaches_a_browser` checks the new module |
| Network interception, private API, cookies, tokens, credentials, local/session storage | no |
| `BLATIFA_LIVE=1` | no (unset; the 7 live tests stay skipped) |
| Change `LIVE_ACTIONS_ACTIVE` or a `deny: true` entry | no |
| Delete historical artifacts or evidence | no. Kept temp folders from failed test runs were not removed either |
| Credits consumed | 0 |

## 2. Protected hashes

- `evidence/protected_hashes_before.txt`, recorded before any edit, covers 309 entries:
  - the 289-file 5.3g.4 baseline;
  - all files in `docs/phase-5.3g4`;
  - every `.py` file in `src/blatifa` and `tests`;
  - `p53g.db`.
- `evidence/protected_hashes_after.txt` was recorded after the full regression. **11 entries differ:**

| File | Why | Approved by |
|---|---|---|
| `src/blatifa/production/gates.py`, `production/runner.py` | explicit trust (phase scope) | manifest row |
| `src/blatifa/production/preflight.py`, `cli.py`, `account/reader.py`, `account/__init__.py` | docstrings only (AST check in `evidence/docstring_only_check.txt`) | manifest row |
| `tests/unit/simflow.py`, `test_phase5_3f_nonce_binding.py`, `test_phase5_3f1_strict_default.py` | historical tests, user-approved list (IMPLEMENTATION_REPORT §3) | manifest row |
| `tests/unit/protected_hashes.py`, `tests/unit/test_phase5_3g4_credit_paths.py` | integrity roots (new manifest pin, new API) | exact digest in `test_phase5_3g4_1_adapter_trust.INTEGRITY_ROOTS`; old digests in the manifest header |

`test_every_change_since_the_5_3g4_1_baseline_is_approved_or_a_pinned_root` fails in three cases:
- any other file differs from its before-hash;
- an approved row does not match exactly (`old` = before, `new` = current);
- a listed file was not actually changed.

`test_manifest_lists_only_the_user_approved_files` pins the list of nine files.

## 3. The approved-change mechanism stays fail-closed

| Property | Evidence |
|---|---|
| The manifest is pinned by sha256 in the helper **and** in two separate tests (5.3g.4, 5.3g.4.1) | `test_integrity_roots_are_pinned_independently`, `test_integrity_roots_are_pinned_here_too` |
| A manifest cannot approve itself, the helper, or any `*hashes*` baseline file. The four direct baselines of 5.3e/5.3f/5.3f.1 are never approvable | `test_historical_trust_roots_cannot_be_approved_and_are_unchanged`, plus the 5.3g.4 tests |
| A tampered manifest pin raises `ManifestIntegrityError` and is not ignored | `test_the_5_3f_check_fails_closed_without_an_approved_chain` |
| Without a manifest, the 5.3f check requires the historical digest again, so the changed `simflow.py` fails | same test |
| The 5.3f check keeps its `LIVE_ACTIONS_ACTIVE` and `deny: true == 18` assertions | same test (source check) |
| All direct baseline files are byte-identical to before | same tests |

## 4. Not claimed

- **No cryptographic protection.** All pins and manifests live in the same repository and can be edited together.
  An edit of the helper, the manifest and both pinning tests would go through. It would be visible on review, but
  nothing prevents it. The project is not a git repository. **An independent trust anchor (for example a signed git
  tag, or a hash list held outside the repository) remains future work.**
- In-process Python code can monkeypatch the trust rule or `SimulatedFlow` (ADAPTER_TRUST_CONTRACT §6).

## 5. Historical artifacts and experiment

| Item | Result |
|---|---|
| `docs/phase-5.3g1` (20 files), `5.3g2` (11), `5.3g3` (14), `5.3g4` (18) | all identical to before |
| `docs/phase-5.3e`, `5.3f`, `5.3f1` baseline files | identical (and never approvable) |
| `~/BlatifaStudio/experiments/phase-5.3g/p53g.db` | `a6e4cacf…`, unchanged (hash only; not opened for writing) |
| `FINAL_PROMPT.txt` / `BASE_PROMPT.txt` | `f45e9887…` / `828d967a…`, unchanged |
| Experiment `EXP-P53G-20261110-56C3`: attempt, nonce, prompt | not touched |

## 6. Safety controls

`evidence/flags_after.txt`, identical to `docs/phase-5.3g4/evidence/flags_after.txt`:
- `LIVE_ACTIONS_ACTIVE: Final = False`;
- `deny: true` count 18;
- `BLATIFA_LIVE` unset.

Not changed: manual submission, nonce binding, handoff, the media_identity resolver, the Octopus lock, and the gate
business rules (`181d780a…`).

## 7. Open limitations (consolidated 2026-11-11; none is resolved by 5.3g.4.1)

> **Ringkasan (ID):** Ketujuh butir di bawah tetap terbuka atau ditunda. Tidak satu pun diselesaikan oleh fase
> ini. Tabel ini hanya menyelaraskan dokumentasi.

| # | Limitation | Status | Where documented |
|---|---|---|---|
| 1 | F-4: whether the balance is in the DOM while the account panel is closed is not proven | OPEN | IMPLEMENTATION_REPORT §6 |
| 2 | `read_credits()` still opens and closes the account panel by clicking (so `blatifa account` and `blatifa preflight` interact with the browser) | OPEN, removal deferred to a user decision | IMPLEMENTATION_REPORT §5–7, CALL_GRAPH_AUDIT §1–2, docstrings of `preflight.py` / `reader.py` |
| 3 | `ESTIMATED` is still accepted by `preflight_gate`; nothing produces it | OPEN (gate rules unchanged by design) | IMPLEMENTATION_REPORT §6–7 |
| 4 | R-2: provenance-carrying production balance | DEFERRED | IMPLEMENTATION_REPORT §7 |
| 5 | Repository-local hashes are not an independent cryptographic trust anchor | OPEN, future work | §4 above, IMPLEMENTATION_REPORT §6, ADAPTER_TRUST_CONTRACT §6 |
| 6 | Same-process monkeypatch is not a security boundary (trust rule, `SimulatedFlow`, `runner.adapter`, module constants) | OPEN | §4 above, ADAPTER_TRUST_CONTRACT §6, IMPLEMENTATION_REPORT §6 |
| 7 | Freshness override: `credit_evidence(now=, max_age_s=)` and `approval_balance(now=)` can move the freshness window; no production caller sets them | OPEN API risk | CALL_GRAPH_AUDIT §4, ADAPTER_TRUST_CONTRACT §6, IMPLEMENTATION_REPORT §6 |

Evidence gap (not a limitation of the code): the four mutation checks are NOT INDEPENDENTLY VERIFIED (TEST_REPORT §3).
