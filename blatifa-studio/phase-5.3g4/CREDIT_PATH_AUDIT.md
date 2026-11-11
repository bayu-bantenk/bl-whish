# Phase 5.3g.4 — Credit path audit (Stage A)

> **Ringkasan (ID):** Semua jalur produksi yang membaca saldo, membuat status saldo, atau memanggil `preflight_gate`
> dan `approval_gate` sudah ditelusuri. Audit ini dibuat sebelum kode diubah.
> - Celah F-1: hasil klik `read_credits()` masuk langsung ke `preflight_gate`.
> - Celah kedua: `SceneRunner` memberi angka saldo mentah (`self.balance()`) langsung ke `approval_gate`, tanpa
>   lewat `credit_evidence()`.
> Keduanya ditutup di fase ini. Grafik panggilan di bawah dikunci oleh tes AST.

Method: `grep` and an AST walk over `src/blatifa` for every call and construction listed below, done before the
first edit. After the change, the call graph is asserted by
`test_phase5_3g4_credit_paths.py::test_call_graph_of_every_credit_decision`.

## 1. Call graph (after 5.3g.4)

```
blatifa account ── cli.cmd_account
                    ├─ reader.read_identity            (scroll_top)
                    ├─ reader.read_credits             (CLICK Account details / Close account panel)  → CreditSnapshot
                    └─ gates.credit_evidence(snapshot) → (UNKNOWN, None, "legacy … diagnostic only")
                       → prints "credit authorization: NOT GRANTED"; report.credit_authorization.granted = false
                       (no gate is called; exit code = "read succeeded", unchanged)

blatifa preflight ── cli.cmd_preflight
                      └─ preflight.run_preflight
                          ├─ reader.read_identity, reader.read_credits (CLICK, diagnostic only)
                          ├─ gates.credit_evidence(snapshot)  → (UNKNOWN, None, why)       ◄── common boundary
                          ├─ inspector.health.run_state(project_idle, agent_settings)
                          └─ gates.preflight_gate(PreflightInputs(credit_status, balance from credit_evidence))
                             → CREDIT_UNKNOWN for every legacy read

blatifa live-probe ── cli.cmd_live_probe / cli._live_probe_detail
                       └─ live_probe.probe / probe_detail → credits_without_click → balance.read_from_tree
                          (read-only; result is diagnostic and a stop reason; no gate is called)

blatifa episode simulate ── cli.cmd_episode (simulate branch only)
                             └─ EpisodeEngine(mode=SIMULATED).run   (any other mode → LiveRunBlockedError)
                                 └─ SceneRunner(SimulatedFlow, preflight=lambda: GateResult(), balance=lambda: 10_000)
                                     ├─ READY: self.preflight()        (simulation: always allowed)
                                     └─ _decide_on_quote → approval_gate(quote, policy, self._gate_balance(), …)
                                         └─ _gate_balance → gates.approval_balance(value, simulated_adapter=…)
                                             ├─ bare int: only if is_simulated_adapter(adapter)
                                             └─ otherwise gates.credit_evidence(value)   ◄── common boundary
```

## 2. Inventory

| Item | Where | Status |
|---|---|---|
| Read a balance (click) | `account/reader.py::read_credits` ← `cli.cmd_account`, `production/preflight.run_preflight` | audited; click behaviour **not changed** (deferred decision) |
| Read a balance (no click) | `account/balance.py::read_from_tree` ← `live_probe.credits_without_click` / `balance_without_click` ← `probe`, `probe_detail` | audited, not changed |
| User statement | `balance.user_reported` | no production caller (tests only) |
| Construct `CreditSnapshot` | only `reader.read_credits` | audited, not changed |
| Produce `ReadStatus.VERIFIED` | identity readers (`reader.read_identity`, `live_probe.identity_without_interaction`); `reader.read_credits`; `gates.credit_evidence` (the only credit one that reaches a gate) | — |
| Produce `ReadStatus.ESTIMATED` | nowhere (enum value reserved). `preflight_gate` still accepts it, but `credit_evidence` never returns it | audited, not changed |
| Construct `BalanceReading` | `balance.read_from_tree`, `balance.user_reported` | — |
| Call `preflight_gate` / build `PreflightInputs` | only `preflight.run_preflight` | **changed**: inputs from `credit_evidence` |
| Call `approval_gate` | only `SceneRunner._decide_on_quote` | **changed**: balance from `approval_balance` |
| Approve / reject an attempt | `SceneRunner._decide_on_quote` → `adapter.approve()` / `reject()`. The live `GoogleFlowAgentAdapter.approve/reject` raise `BlockedOperationError`; `authorization.LIVE_ACTIONS_ACTIVE = False` | audited, not changed |
| Construct `SceneRunner` | only `cli.cmd_episode` (simulate) | audited, not changed |
| Ledger | `store.ledger_write` (runner), `store.ledger` (UI listing), `store.credits_spent` (no production caller) | audited; never used as a balance |
| UI (`ui/service.py`) | lists the ledger; no gate, no runner, no balance | audited, not changed |
| Readiness (`production/readiness.py`) | authorization specs only; no balance | audited, not changed |
| `tests/live/test_flow_live.py` | calls `read_credits` (opt-in `BLATIFA_LIVE=1`; skipped) | not run |
| `docs/phase-5.3g2/tools/credit_dom_discovery.py` | imports `CREDITS`; historical tool | not run, not changed |

## 3. Bypasses found before the change

| ID | Bypass | Severity | Resolution |
|---|---|---|---|
| B-1 (F-1) | `run_preflight`: `credit_status=credits.status, balance=credits.balance` from the click-based `read_credits` → `preflight_gate` accepted `VERIFIED` | high (policy) | fixed: `credit_evidence(credits)` → always `UNKNOWN` |
| B-2 | `SceneRunner._decide_on_quote`: `approval_gate(…, self.balance(), …)` took any number from any caller | medium (no production caller today) | fixed: `approval_balance` → bare numbers only for the simulated adapter, everything else through `credit_evidence` |
| B-3 | `cmd_account` printed `credits: VERIFIED balance=…` with no statement about authorization | low (diagnostic) | fixed: explicit `credit authorization: NOT GRANTED`, also in the report |
| B-4 | CLI help called `account` and `preflight` "read-only", although `read_credits` clicks | low (documentation) | fixed: help text now says so |
