# Phase 5.3g.4 — Gate consolidation (Stage C)

> **Ringkasan (ID):** Sekarang hanya ada satu pintu masuk untuk saldo: `gates.credit_evidence()`. `preflight_gate`
> hanya menerima nilai dari pintu itu. `approval_gate` menerima nilai dari `approval_balance()`, yang juga lewat pintu
> itu, kecuali angka simulasi untuk adapter simulasi. Aturan bisnis kedua gate tidak berubah sama sekali (hash
> sumbernya sama dengan versi sebelum 5.3g.3).

## The boundary

`credit_evidence(x) → (ReadStatus, balance, why)`:

| Input | Result |
|---|---|
| `BalanceReading` VERIFIED_WITHOUT_INTERACTION, 0 ≤ age ≤ 300 s (5 s skew) | `(VERIFIED, n)` |
| `BalanceReading` USER_REPORTED / OBSERVED_IN_ALREADY_OPEN_PANEL / UNAVAILABLE | `(UNKNOWN, None)` |
| `BalanceReading` stale (> 300 s) or future-dated | `(UNKNOWN, None)` |
| legacy `CreditSnapshot` (any status, any balance) | `(UNKNOWN, None, "legacy click-derived read … diagnostic only …")` |
| `None` | `(UNKNOWN, None, "no reading")` |
| anything else: `int`, `bool`, `float`, `str`, `ReadStatus`, tuple, dict | `(UNKNOWN, None, "unsupported credit evidence type …")` |

`approval_balance(value, simulated_adapter) → int | None`:
- `simulated_adapter=True` and `type(value) is int` and `value ≥ 0` → `value` (simulation only);
- otherwise `credit_evidence(value)` → `n` if VERIFIED, else `None`. `approval_gate` then blocks with
  `COST_OVER_BALANCE`.

`runner.is_simulated_adapter(adapter)`:
- True for `blatifa.simulation.SimulatedFlow` (exact module and qualname);
- True for test doubles defined outside the `blatifa` package;
- False for every other class inside the package, including `GoogleFlowAgentAdapter`, any future in-package
  adapter, and an impostor named `SimulatedFlow` in another module.

## No bypass

| Path | Proof (test) |
|---|---|
| direct `ReadStatus.VERIFIED` | `credit_evidence(ReadStatus.VERIFIED)` → UNKNOWN; `PreflightInputs` is built only in `run_preflight`, from `credit_evidence` (AST + source tests) |
| legacy `CreditSnapshot` | `test_legacy_read_credits_output_cannot_pass_credit_evidence`, `test_run_preflight_cannot_authorize_from_a_click_derived_balance`, `test_blatifa_preflight_command_blocks_on_click_derived_evidence` |
| user-reported | `test_user_reported_and_observed_panel_stay_unverified_even_for_simulation`; runner test with `user_reported("10000")` → `COST_OVER_BALANCE`, no approve |
| cached / historical | stale and future readings → UNKNOWN; `credit_evidence` has no state, no ledger, no settings input |
| simulation defaults | `10_000` and `lambda: GateResult()` occur once in `src`, inside the simulate branch together with `SimulatedFlow`; `EpisodeEngine.run` refuses non-SIMULATED modes |
| direct numeric injection | `approval_balance(n, simulated_adapter=False)` is None; runner test: a live-classified adapter with `balance=lambda: 40` is rejected (`COST_OVER_BALANCE`, `reject` called, `approve` never) |
| call graph | `test_call_graph_of_every_credit_decision` pins every call site of `preflight_gate`, `PreflightInputs`, `approval_gate`, `approval_balance`, `credit_evidence`, `read_credits`, `run_preflight` and `SceneRunner` |

## Gate rules unchanged

`preflight_gate` and `approval_gate` are byte-identical to the pre-5.3g.3 source (sha256 of their source
`181d780a…`, asserted by `test_preflight_and_approval_rules_are_unchanged`). Only their inputs changed.
