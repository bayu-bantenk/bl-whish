# Phase 5.3g.4.2: call graph after freshness hardening

> **Ringkasan (ID):**
> - Tidak ada pemanggil (produksi maupun lainnya) yang bisa mengirim waktu atau umur maksimal, karena parameternya
>   sudah tidak ada.
> - Semua adapter tak-dipercaya tetap lewat `credit_evidence()`.
> - Asal-usul `read_at` tetap **OPEN**, ditunda ke R-2.

## 1. Signatures (AST and `inspect`, 2026-11-11)

| Function | Before (5.3g.4.1) | After (5.3g.4.2) |
|---|---|---|
| `credit_evidence` | `(reading, *, now: datetime \| None = None, max_age_s: int = CREDIT_EVIDENCE_MAX_AGE_S)` | `(reading)` |
| `approval_balance` | `(value, *, adapter, now: datetime \| None = None)` | `(value, *, adapter)` |
| `_freshness_verdict` (new, private) | — | `(age_s)`; pure, no clock, no policy argument |
| `preflight_gate`, `approval_gate` | unchanged | unchanged (source sha `181d780a…`) |

Passing `now=` or `max_age_s=` now raises `TypeError` at the call, because the parameters do not exist
(`test_signatures_have_no_freshness_overrides`). No public function in `gates` takes a parameter named `now`,
`max_age_s`, `max_age`, `clock`, `skew`, `freshness`, `freshness_policy`, `today`, `at` or `time`
(`test_no_public_function_in_gates_accepts_a_time_or_age`).

## 2. Call sites (AST over `src/blatifa`)

| Call | Location | Kind | Keywords |
|---|---|---|---|
| `credit_evidence(credits)` | `cli.py` `cmd_account` | diagnostic (input is a `CreditSnapshot`, always UNKNOWN) | none |
| `credit_evidence(value)` | `production/gates.py` `approval_balance` | internal forwarding; no time is forwarded any more | none |
| `credit_evidence(credits)` | `production/preflight.py` `run_preflight` | production (input is a `CreditSnapshot`, always UNKNOWN) | none |
| `approval_balance(self.balance(), adapter=self.adapter)` | `production/runner.py` `_gate_balance` | production and simulation | `adapter` |
| `_freshness_verdict(age)` | `production/gates.py` `credit_evidence` only | internal | none |

`test_no_production_call_supplies_a_freshness_override` pins this list. It also fails on any `**kwargs` forwarding
and on any call to `_freshness_verdict` outside `credit_evidence`.

Unchanged from 5.3g.4.1, re-checked by the existing tests:
- `approval_gate` ← `_decide_on_quote` (twice, both via `_gate_balance`);
- `preflight_gate` / `PreflightInputs` ← `run_preflight`;
- `read_credits` ← `cmd_account`, `run_preflight`;
- `SceneRunner` ← `cmd_episode` (simulate, `SimulatedFlow`).

## 3. Untrusted adapters still use validated evidence

The exact-type rule `type(adapter) is SimulatedFlow` is untouched. Proven by `test_adapter_trust_is_unchanged` and
the 138 G.4.1 tests:
- **Exact `SimulatedFlow`:** a bare int is accepted, as before. A stale reading gives `None`.
- **Everything else** (subclass, lookalike name/module with `is_simulated = True`, `FakeFlow`, the real
  `GoogleFlowAgentAdapter`, `None`):
  - bare int or str → `None`;
  - fresh `BalanceReading` → the balance, through `credit_evidence`;
  - stale reading → `None`.

## 4. Not covered: where `read_at` comes from (R-2, deferred)

`credit_evidence` now always measures age against the real UTC clock, but it cannot know whether `read_at` is true.
`replace(old_reading, read_at=now)`, or a directly constructed `BalanceReading`, is judged fresh.
`test_read_at_provenance_is_still_open_r2` documents this on purpose; it does not fix it. No production producer
of a VERIFIED `BalanceReading` reaches either gate today (see the 5.3g.4.2 audit).
