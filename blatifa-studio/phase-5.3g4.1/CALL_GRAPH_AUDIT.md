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

## 4. Freshness override parameters (static audit, added 2026-11-11; no code changed)

> **Ringkasan (ID):** `credit_evidence` menerima `now` dan `max_age_s`, sedangkan `approval_balance` menerima `now`.
> Pemanggil bisa memakai keduanya untuk menggeser batas freshness. Pemeriksaan source membuktikan tidak ada
> pemanggil produksi yang mengisinya. Risiko API ini tetap **OPEN**.

**Signatures** (`src/blatifa/production/gates.py`):

```python
CREDIT_EVIDENCE_MAX_AGE_S = 300
CREDIT_EVIDENCE_MAX_CLOCK_SKEW_S = 5
def credit_evidence(reading, *, now: datetime | None = None, max_age_s: int = CREDIT_EVIDENCE_MAX_AGE_S): ...
    age = ((now or datetime.now(UTC)) - parse_time(reading.read_at)).total_seconds()
    if age < -CREDIT_EVIDENCE_MAX_CLOCK_SKEW_S: -> UNKNOWN ("dated in the future")
    if age > max_age_s:                        -> UNKNOWN ("not a current balance")
def approval_balance(value, *, adapter, now: datetime | None = None): ...
    credit_evidence(value, now=now)            # max_age_s is not exposed here
```

Both parameters are keyword-only, so they cannot be passed by accident as positional arguments.

**Default policy vs. caller override**

| Input | Default (no override) | What a caller can do by overriding |
|---|---|---|
| `now` (`credit_evidence`, `approval_balance`) | real wall clock, `datetime.now(UTC)` | Pass an earlier time and an old reading looks fresh. For example, `now = reading.read_at` makes a reading of any age have age 0 and be accepted. Pass a later time and fresh readings are rejected. |
| `max_age_s` (`credit_evidence` only) | `CREDIT_EVIDENCE_MAX_AGE_S` = 300 s | Pass a larger value and stale readings are accepted. Pass a smaller or negative value and everything is rejected. |
| clock skew | `CREDIT_EVIDENCE_MAX_CLOCK_SKEW_S` = 5 s | Not a parameter. It is a module constant and can only be changed in-process (monkeypatch, see the same-process limitation). |

An override can never turn a non-`VERIFIED_WITHOUT_INTERACTION` reading into evidence. The status, type and
`verified_balance` checks run before the age check. An override changes only *how old* a verified reading may be.

**Every production call site (AST over `src/blatifa`, 2026-11-11)**

| Call site | Arguments | Override used? |
|---|---|---|
| `cli.py:196` `credit_evidence(credits)` (`cmd_account`, diagnostic verdict) | 1 positional, no keywords | no |
| `production/preflight.py:42` `credit_evidence(credits)` (`run_preflight`) | 1 positional, no keywords | no |
| `production/gates.py:174` `credit_evidence(value, now=now)` (inside `approval_balance`) | forwards `approval_balance`'s own `now` | only if `approval_balance` got one |
| `production/runner.py:189` `approval_balance(self.balance(), adapter=self.adapter)` (`_gate_balance`) | `adapter` only | **no**, so `now` is None and the wall clock is used |

Result: no production caller sets `now` or `max_age_s`. Every production path uses the default policy (wall clock,
300 s, 5 s). The constants are assigned only at their definition (`gates.py:112–113`) and read at `:125` and `:145`.

**Status: OPEN API risk.** Nothing prevents a future caller from passing an override. Test coverage of the
"no override in production" property is partial and indirect:
- the two gate-feeding call sites are pinned by exact source strings. `credit_status, balance, why = credit_evidence(credits)`
  in `run_preflight` is checked by `test_gate_inputs_come_only_from_the_boundary` (5.3g.4).
  `return approval_balance(self.balance(), adapter=self.adapter)` is checked by
  `test_call_graph_of_trust_and_credit_decisions` (5.3g.4.1);
- the diagnostic call in `cmd_account` is not pinned;
- no test checks every call site for `now=` / `max_age_s=` keywords.

Tests do pass `now=` deliberately (5.3g.3 contract tests with a fixed `NOW`). Removing or restricting the
parameters, or adding such a test, would be a code change and is outside this documentation remediation.
