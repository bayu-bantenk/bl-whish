# Phase 5.3g.4.1: explicit adapter trust and documentation hardening

> **Ringkasan (ID):**
> - Trust simulasi berbasis lokasi paket diganti dengan satu aturan eksplisit: `type(adapter) is SimulatedFlow`.
> - Flag `simulated_adapter` dari pemanggil dihapus.
> - Docstring yang menyebut pembacaan kredit "read-only" dikoreksi.
> - Tiga file tes historis diubah dengan persetujuan eksplisit pengguna, dan semuanya tercatat di
>   `evidence/approved_changes.txt`.
> - Aturan bisnis gate tidak berubah.
> - Offline penuh: tidak ada Flow, tidak ada kredit.

## 1. Previous weakness

In 5.3g.4, `runner.is_simulated_adapter()` trusted every class outside the `blatifa` package. It also trusted a
class whose writable `__module__`/`__qualname__` strings named `blatifa.simulation.SimulatedFlow`. On top of that,
`gates.approval_balance()` took a caller-supplied `simulated_adapter: bool`. Any future adapter outside the package
could therefore send a bare number to `approval_gate`. Full audit: CALL_GRAPH_AUDIT.md §1.

## 2. Implemented and tested

| Change | File | Evidence |
|---|---|---|
| `is_simulated_adapter(adapter)` moved to `gates` and reduced to `return type(adapter) is SimulatedFlow` (imported class object) | `production/gates.py` | `test_trust_rule_is_one_exact_type_check`, 99 rejection cases, 4 mutants caught |
| `approval_balance(value, *, adapter, now=None)`: the trust decision is made from the adapter itself. `simulated_adapter` parameter removed | `production/gates.py` | `test_no_caller_supplied_trust_anywhere` |
| `SceneRunner._gate_balance()` passes `adapter=self.adapter`. The location-based function was deleted | `production/runner.py` | `test_call_graph_of_trust_and_credit_decisions`, runner tests with spy on `approval_gate` |
| Read-only wording corrected (docstrings only; AST without docstrings identical, `evidence/docstring_only_check.txt`) | `production/preflight.py`, `cli.py` (module + `cmd_preflight`), `account/reader.py`, `account/__init__.py` | `test_click_based_credit_reading_is_not_called_read_only` |
| New test module, 138 tests | `tests/unit/test_phase5_3g4_1_adapter_trust.py` | TEST_REPORT.md |

Contract and test matrix: ADAPTER_TRUST_CONTRACT.md.

## 3. Historical test changes (user-approved, 2026-11-10)

**Why they were needed.** The exact-type rule made 61 historical tests fail functionally
(`evidence/conflict_run_exact_trust_before_test_fixes.txt`: 66 failures, 5 of them expected hash checks):
- 60 tests build their runner via `simflow.make()` with `FakeFlow` and a bare `lambda: 40`;
- 1 test (5.3f.1) used `NamelessFlow(SimulatedFlow)`.

`simflow.py` is pinned by exact digest in `docs/phase-5.3f1/evidence/tests_baseline_hashes.txt`, which the 5.3f
test reads. That pin had no approved-change path.

I stopped and asked the user, offering four options. The user chose to "change the historical test doubles and the
pin via approved-change". They set conditions: no autouse fixture or shim, no production change for test doubles,
exact type only with no subclass, and every change recorded with path, old and new hash. I then presented the
complete file list with the reason and hash impact of each change, and the user approved it.

| File | Change | Assertions |
|---|---|---|
| `tests/unit/simflow.py` | `make()` passes `balance=fresh_balance`: a `BalanceReading` parsed by the production parser `read_from_tree` from an ARIA fixture | none (helper) |
| `tests/unit/test_phase5_3f_nonce_binding.py` | integrity loop: `hashlib… == digest` → `ph.matches(path, digest)` (exact digest, or an exact chain in the pinned manifests) | the `LIVE_ACTIONS_ACTIVE` and `deny: true == 18` checks are untouched |
| `tests/unit/test_phase5_3f1_strict_default.py` | `NamelessFlow` subclass → `monkeypatch.setattr(SimulatedFlow, "observe", …)` in that one test (the real observe runs, only `media_id` is removed). **Added:** the adapter used was of exact type `SimulatedFlow`; raw `10_000`/`"10000"` from `FakeFlow` is refused | the original assertions are unchanged |

Not changed: the 5.3e and 5.3f.1 integrity checks. Their baselines contain none of the changed files, which was
checked with 0 mismatches.

**One requirement that could not be met literally.** The user asked for an assertion that "the observation
provides a valid `BalanceReading`". In `episode simulate` the observation carries no balance. The balance comes
from `cli.py` (`lambda: 10_000`) and is accepted only because the adapter is the exact `SimulatedFlow`. Changing
that would have been a production change made for a test, which was forbidden. The requirement is covered
instead by:
- the exact-type assertion in the 5.3f.1 test;
- the rejection of raw values from untrusted adapters (same test, and the 99 cases);
- `test_the_test_double_supplies_valid_evidence_through_the_official_path`, which shows that the `simflow` evidence
  is a valid `BalanceReading` accepted by `credit_evidence`.

## 4. 5.3g.4 test and integrity helper (integrity roots)

- `tests/unit/test_phase5_3g4_credit_paths.py` changes:
  - its calls moved to the new API (`simulated_adapter=False/True` → `adapter=LIVE/SIM`);
  - `assert is_simulated_adapter(FakeFlow())` became `assert not …`, which is stricter. The test was renamed from
    `test_only_simulated_flow_and_out_of_package_doubles_count_as_simulation` to
    `test_only_the_exact_simulated_flow_counts_as_simulation`;
  - the `_LiveClassifiedFlow` test now sets `lambda: 40` explicitly, because `make()` now supplies evidence;
  - the expected `_gate_balance` source string was updated;
  - `INTEGRITY_ROOTS` now also pins the new helper sha and the 5.3g4.1 manifest.
- `tests/unit/protected_hashes.py`: the 5.3g4.1 manifest was added to `MANIFESTS`, and the docstring was updated.
- Neither file can be a manifest row: the helper is never approvable, and a row for the 5.3g.4 test would create a
  hash cycle. Both are pinned by exact digest in the new 5.3g.4.1 test, and their old hashes are recorded in the
  manifest header.

## 5. Audited, not changed

- `inspector/data/flow_locators.yaml` `account_dialog.description`: "Account panel opened from the top bar
  (read-only), closed with its close button". The text already says that the panel is opened and closed. It is
  registry data in the file with the 18 `deny: true` protections, so I left it alone.
- Historical phase documents (5.3g … 5.3g.4): they are evidence, so they were not edited. The
  5.3g.4 CREDIT_PATH_AUDIT already describes `read_credits` as clicking (B-4).
- The `blatifa account` and `blatifa preflight` help texts: already corrected in 5.3g.4, and now pinned by a test.
- `read_credits()` itself still clicks. Removing that is still deferred and is the user's decision.

## 6. Not proven / limitations

1. In-process Python is not a security boundary. Code in the same process can monkeypatch `SimulatedFlow`,
   reassign `runner.adapter` or replace `gates.is_simulated_adapter`. The rule protects against misclassification,
   not against hostile code already inside the process.
2. No independent trust anchor. The project is not a git repository, and all pins are repository-local.
3. The assurance of the 5.3f integrity check changed. It used to accept exactly the baseline digest. It now accepts
   the baseline digest or an exact approved chain in the pinned manifests. This is fail-closed (proven), but a
   change can now be approved by editing the manifest plus the pins in two tests instead of editing the historical
   test.
4. F-4 is still open: it is unknown whether the balance is in the DOM while the panel is closed.
5. `ESTIMATED` is still accepted by `preflight_gate`, but nothing produces it (gate rules unchanged by design).

## 7. Deferred

These are the same items as in 5.3g.4: the `read_credits` clicks, R-2 (provenance-carrying production balance), the
`ESTIMATED` decision, and an external trust anchor.
