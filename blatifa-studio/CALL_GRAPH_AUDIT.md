# Phase 5.3g.4.1: Phase A audit and call graph

> **Ringkasan (ID):**
> - **Audit (sebelum perubahan):** di 5.3g.4, `is_simulated_adapter()` memberi hak simulasi ke semua kelas di
>   luar paket `blatifa`, dan `approval_balance()` menerima flag `simulated_adapter` dari pemanggil.
> - **Sesudah perubahan:** jalur produksi tetap satu. `credit_evidence()` hanya dipanggil oleh `cmd_account`
>   (diagnostik), `approval_balance` dan `run_preflight`. `approval_balance` hanya dipanggil oleh
>   `SceneRunner._gate_balance`. `is_simulated_adapter` hanya dipanggil oleh `approval_balance`.

## 1. Phase A finding (read-only, before any change)

Files inspected: `production/gates.py`, `production/runner.py`, `production/preflight.py`, `account/balance.py`,
`account/reader.py`, `cli.py`, `simulation.py`, `tests/unit/simflow.py`, the 5.3g.4 tests and reports, and
`docs/phase-5.3g4/evidence/approved_changes.txt`.

**Exact 5.3g.4 implementation** (`runner.py`, sha256 before `761c36be…`):

```python
def is_simulated_adapter(adapter: object) -> bool:
    cls = type(adapter)
    if cls.__module__ == "blatifa.simulation" and cls.__qualname__ == "SimulatedFlow":
        return True
    return not (cls.__module__ == "blatifa" or cls.__module__.startswith("blatifa."))
```
together with `gates.approval_balance(value, *, simulated_adapter: bool, now=None)`.

**Why package-location classification is unsafe**

1. It is a denylist. Any class outside `blatifa.*` was trusted: a future production adapter in a plug-in or a
   separate package, or a wrapper class around the real adapter, would have been allowed to send bare numbers.
2. `__module__` and `__qualname__` are writable strings. A class could set
   `__module__ = "blatifa.simulation"` and `__qualname__ = "SimulatedFlow"` and pass the first branch.
3. `approval_balance(simulated_adapter=True)` let any caller assert simulation with a boolean, without having an
   adapter at all.

**Every caller that could submit a raw numeric balance (before)**

| Caller | Adapter | Raw value | Status in 5.3g.4 | After 5.3g.4.1 |
|---|---|---|---|---|
| `cli.cmd_episode` (`episode simulate`) | `SimulatedFlow(Path(args.clip))` | `lambda: 10_000` | accepted (in-package simulation) | accepted (exact `SimulatedFlow`) |
| `tests/unit/simflow.make` (60 historical tests) | `FakeFlow` and subclasses | `lambda: 40` | accepted (outside the package) | **refused**. `make()` now supplies `fresh_balance` (a `BalanceReading`) |
| `test_phase5_3f1_strict_default` | `NamelessFlow(SimulatedFlow)` via `episode simulate` | `10_000` | accepted (outside the package) | subclass removed; the exact `SimulatedFlow` with `observe` patched locally |
| Any code calling `approval_balance(x, simulated_adapter=True)` | none needed | any int | accepted | parameter removed |
| Any future `SceneRunner(adapter=<out-of-package adapter>, balance=lambda: n)` | any | any int | **accepted** | refused |

No production code outside `cli.cmd_episode` constructs a `SceneRunner` (AST, below).

## 2. Call graph after the change (AST over `src/blatifa`, `test_call_graph_of_trust_and_credit_decisions`)

| Function | Called only from |
|---|---|
| `is_simulated_adapter` | `production/gates.py: approval_balance` |
| `approval_balance` | `production/runner.py: _gate_balance` |
| `approval_gate` | `production/runner.py: _decide_on_quote` (twice, both via `self._gate_balance()`) |
| `credit_evidence` | `cli.py: cmd_account` (diagnostic verdict only), `production/gates.py: approval_balance`, `production/preflight.py: run_preflight` |
| `preflight_gate`, `PreflightInputs` | `production/preflight.py: run_preflight` |
| `read_credits` | `cli.py: cmd_account`, `production/preflight.py: run_preflight` (diagnostic; never gate input) |
| `SceneRunner` | `cli.py: cmd_episode` (simulate branch, `SimulatedFlow`) |

Further assertions:
- `_gate_balance` is exactly `return approval_balance(self.balance(), adapter=self.adapter)`. `_decide_on_quote`
  never reads `self.balance()` directly.
- No source file contains the identifier `simulated_adapter`. No code reads an attribute named `is_simulated`,
  `simulated` or similar. `gates.py` and `runner.py` contain no `__module__`, `__qualname__`,
  `.startswith("blatifa.")`, `isinstance(adapter` or `issubclass(`. `runner.is_simulated_adapter` no longer exists.
- The simulate branch still builds `SimulatedFlow(Path(args.clip))` with `balance=lambda: 10_000`, and
  `cli.SimulatedFlow is blatifa.simulation.SimulatedFlow`.

## 3. F-1 and earlier protections (re-checked, unchanged)

- The 5.3g.4 call-graph and boundary tests (`test_call_graph_of_every_credit_decision`,
  `test_gate_inputs_come_only_from_the_boundary`) still pass. Only the expected source string for
  `_gate_balance` was updated, to the new API.
- `run_preflight` still takes its gate credit input only from `credit_evidence(credits)`. A click-derived
  `CreditSnapshot` gives `CREDIT_UNKNOWN` (the 5.3g.4 F-1 tests pass unchanged).
- The business rules of `preflight_gate` and `approval_gate` are byte-identical. Their source sha256 is
  `181d780a…`, the same as before 5.3g.3.
- Nonce binding, manual submission and handoff are not changed. Their files are not in the manifest, and
  `test_every_change_since_the_5_3g4_1_baseline_is_approved_or_a_pinned_root` fails on any unlisted change. Their
  tests (5.3e, 5.3f, 5.3f.1, 5.3g.1) pass.
