# Phase 5.3g.4.1: adapter trust contract

> **Ringkasan (ID):** Hanya satu objek yang boleh mengirim saldo berupa angka mentah ke `approval_gate`: instance
> dengan tipe **persis** `blatifa.simulation.SimulatedFlow`. Adapter lain dianggap produksi / tidak dipercaya,
> apa pun modul, nama kelas, kelas induk, atau atributnya. Adapter seperti itu wajib mengirim `BalanceReading`
> yang lolos `credit_evidence()`. Tidak ada flag dari pemanggil dan tidak ada API registrasi.

## 1. The rule

```python
# src/blatifa/production/gates.py
def is_simulated_adapter(adapter: object) -> bool:
    return type(adapter) is SimulatedFlow          # blatifa.simulation.SimulatedFlow, imported, not named

def approval_balance(value: object, *, adapter: object, now=None) -> int | None:
    if is_simulated_adapter(adapter) and type(value) is int and value >= 0:
        return value                                # offline simulation only
    status, balance, _ = credit_evidence(value, now=now)
    return balance if status is ReadStatus.VERIFIED else None
```

`SceneRunner._gate_balance()` calls `approval_balance(self.balance(), adapter=self.adapter)`. The trust decision is
made from the adapter the runner would click Approve with. A caller cannot pass a separate claim about it.

## 2. What establishes trust, and what does not

| Property of the adapter | Trusted? | Test |
|---|---|---|
| `type(adapter) is SimulatedFlow` (the built-in class object) | **yes**: bare non-negative `int` accepted | `test_exact_simulated_flow_keeps_its_simulation_behavior`, `test_runner_with_the_exact_simulated_flow_accepts_a_bare_number` |
| Defined outside the `blatifa` package (`thirdparty.flow_adapter`) | no | `test_untrusted_adapter_cannot_pass_a_raw_balance[external module-*]` |
| `is_simulated = True` / `simulated = True` attributes | no | `[is_simulated = True-*]`, `[FakeFlow subclass claiming simulation-*]` |
| Class named `SimulatedFlow` in module `blatifa.simulation` (a lookalike) | no | `[name and module of SimulatedFlow-*]` |
| Class name containing `Simulated` | no | `[class name contains Simulated-*]` |
| Subclass of `SimulatedFlow` | no | `[subclass of SimulatedFlow-*]`, `test_runner_with_a_simulated_flow_subclass_refuses_a_bare_number` |
| Object whose `__class__` property returns `SimulatedFlow` (fools `isinstance`) | no | `[spoofed __class__-*]` |
| Test double `FakeFlow` (tests/unit/simflow.py) | no | `[FakeFlow test double-*]`, `test_runner_never_passes_a_raw_balance_from_an_untrusted_adapter` |
| Real live adapter `GoogleFlowAgentAdapter` | no | `[real live adapter-*]` |
| `None`, or the `SimulatedFlow` class object itself | no | `[None-*]`, `[the SimulatedFlow class itself-*]` |
| Caller-supplied boolean (`simulated_adapter=True`, the 5.3g.4 API) | removed; no such parameter exists | `test_no_caller_supplied_trust_anywhere` |

`test_untrusted_shapes_really_look_like_simulation` confirms that each negative case does fool a naive check (on
the name, the module, a flag or `isinstance`). The rejections therefore test something real.

Raw values tried against every untrusted adapter: `40, 0, 10_000, "40", "10000", "40 Google Flow credits", 40.0,
True, b"40"`. That is 99 combinations, and all are rejected.

## 3. What every untrusted adapter must supply

A `BalanceReading` that `credit_evidence()` accepts. That means status `VERIFIED_WITHOUT_INTERACTION`, age ≤ 300 s,
and not dated more than 5 s in the future. Everything else becomes `None`, and `approval_gate` then blocks with
`COST_OVER_BALANCE`:

| Evidence from an untrusted adapter | Result | Test |
|---|---|---|
| fresh `VERIFIED_WITHOUT_INTERACTION` | the balance (goes through `credit_evidence`, proven with a spy) | `test_untrusted_adapter_with_evidence_follows_credit_evidence` |
| stale (301 s) / future-dated (−60 s) | None | same |
| `USER_REPORTED` | None | same |
| `OBSERVED_IN_ALREADY_OPEN_PANEL` | None | same |
| legacy `CreditSnapshot` (click-derived) | None | same |
| `None` | None, and `CREDIT_UNKNOWN` in `preflight_gate` | same, `test_none_stays_credit_unknown` |

The exact `SimulatedFlow` gets no exemption for these: an unverified reading is `None` for it too
(`test_even_the_exact_simulated_flow_gets_no_unverified_evidence`).

## 4. Why unknown adapters fail closed

- Trust is an allowlist of one class object, not a denylist. A new adapter, written anywhere, starts out untrusted.
- The check uses `type()`, so subclassing, renaming, moving the module, adding attributes or overriding
  `__class__` cannot widen it.
- The 5.3g.4 parameter `simulated_adapter: bool` is gone. Without a flag, a caller cannot claim simulation.
- There is no registry, set or hook to add classes to. The rule is one line, and
  `test_trust_rule_is_one_exact_type_check` pins it through the AST.
- Four mutants of the rule were tried (`isinstance`, a qualname comparison, the old package-boundary rule, and
  honouring `is_simulated`). The new tests fail on each of them: 22, 12, 89 and 22 failures (TEST_REPORT §3).

## 5. Test doubles

- `FakeFlow` and every subclass of it are **not** trusted. `simflow.make()` now passes
  `balance=simflow.fresh_balance`. That function builds a `BalanceReading` by parsing an idle-page ARIA fixture with
  the production parser `account.balance.read_from_tree`. The value goes through `approval_balance` and then
  `credit_evidence`, exactly like a production balance.
- The 5.3f.1 test that needed nameless results in `episode simulate` no longer uses a subclass. It patches
  `SimulatedFlow.observe` with `monkeypatch`, inside that one test, so the CLI builds the exact `SimulatedFlow`.
  The test asserts that the adapter really was of exact type `SimulatedFlow`, and that the same raw `10_000` /
  `"10000"` from an untrusted adapter is refused.
- No autouse fixture, no conftest change, and no production change was made for test doubles.

## 6. Limits (not proven / not claimed)

- **In-process code is not a security boundary.** Python code running in the same process can monkeypatch
  `SimulatedFlow`'s methods, reassign `runner.adapter`, or replace `gates.is_simulated_adapter`. The 5.3f.1 test
  patches `observe` legitimately. The contract protects against an adapter that is accidentally or wrongly
  classified, not against hostile code already inside the process.
- `SimulatedFlow`'s own methods are trusted to stay offline. That is a property of `simulation.py`, which is
  protected by hash.
- Repository-local hashes are not a cryptographic trust anchor (SAFETY_AUDIT §4).
