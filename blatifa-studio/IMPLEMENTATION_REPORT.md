# Phase 5.3g.3 — Implementation report

> **Ringkasan (ID):** F-2 dan F-3 sudah diperbaiki, offline.
> - Parser kredit sekarang ketat. Status saldo membawa asal-usulnya sendiri.
> - Credit gate hanya menerima saldo terverifikasi tanpa interaksi yang masih segar.
> - Tiga file produksi diubah dan satu modul baru ditambahkan. F-1 (klik di `blatifa account` / `preflight`) tidak
>   disentuh.
> - Tiga tes lama disesuaikan secara terbatas dan terdokumentasi (lihat §5).

## 1. Stage A — audit before the change

| Item | Finding |
|---|---|
| Git | not a git repository; state is proven by hashes (`evidence/baseline_hashes.txt`, 97 files, all matching before the change) |
| Parser | `account/reader.py:24` `CREDITS` + `parse_credits` (`re.sub(r"[,.]", "", …)`) — the source of `50.5.5 → 5055` and `5,0,0 → 500` |
| Parser users | `reader.read_credits` (used by `blatifa account`, `production/preflight.run_preflight` → `blatifa preflight`); `live_probe.credits_without_click` (used by `probe`, `probe_detail` → `blatifa live-probe`); `docs/phase-5.3g2/tools/credit_dom_discovery.py` (historical tool, imports `CREDITS`, not run) |
| Status model | `ReadStatus` (VERIFIED / ESTIMATED / UNKNOWN / UNAVAILABLE) for `CreditSnapshot`; plain dicts with string statuses in `live_probe` |
| live-probe | `cli.cmd_live_probe`: any `credits["status"] != "VERIFIED"` → `CREDIT_BALANCE_UNREADABLE_WITHOUT_CLICK` |
| blatifa account / preflight | `read_credits` clicks `Account details` / `Close account panel` (F-1). Its `ReadStatus` goes straight into `preflight_gate` |
| Credit gate | `gates.preflight_gate` accepts `VERIFIED`/`ESTIMATED` with a balance; `approval_gate` needs a balance ≥ cost + reserve |
| Experiment runner | `ProductionRunner(balance=Callable)`; the CLI passes `lambda: 10_000` only in `simulate`. `manual_submission` has no balance input. Not affected. |
| Hash locks | `live_probe.py` is locked by the 5.3g, 5.3g.1 and 5.3g.2 baselines; `reader.py` by the 5.3g.2 baseline. Any fix of F-2/F-3 necessarily changes those hashes (see §5). |

## 2. Changes

| File | Change |
|---|---|
| `src/blatifa/account/balance.py` (**new**) | strict parser (`parse_balance`, `ParseKind`, `Context`, `BalanceParse`), status contract (`BalanceStatus`, `Reason`, `BalanceReading`), `read_from_tree`, `user_reported`. Pure: imports only `re`, `dataclasses`, `datetime`, `enum`, `collections.abc` and `flow.aria` |
| `src/blatifa/account/reader.py` | `CREDITS` strict; `parse_credits` delegates to `parse_balance`. `read_credits` / `_close_panel` / identity code byte-identical (everything from `def read_identity` to the end) |
| `src/blatifa/flow/live_probe.py` | `credits_without_click(tree)` = `read_from_tree(tree).legacy()`; new `balance_without_click(tree)`; module docstring. `probe`, `probe_detail`, `dialogs`, `ReadOnlyPage` unchanged |
| `src/blatifa/production/gates.py` | new `credit_evidence(reading, now, max_age_s)`; `preflight_gate` / `approval_gate` unchanged |

Unchanged: `cli.py`, `authorization.py` (`LIVE_ACTIONS_ACTIVE = False`), `flow_locators.yaml` (18 × `deny: true`; the
registry's loose `credit_link` name pattern stays, and the parser is the arbiter), `handoff.py`,
`nonce_binding.py`, `manual_submission.py`, `store.py`, `runner.py`, `preflight.py`. Exact diffs:
`evidence/production_changes.diff`. The pre-change files were reconstructed by reversing the edits and match the
baseline hashes exactly.

## 3. Root causes

- **F-2:** a permissive pattern plus "drop punctuation and join digits". Fixed with an explicit grammar
  (`CREDIT_PARSER_CONTRACT.md`).
- **F-3:** the reader searched the whole tree and returned one status for "visible in the page" and "inside an
  already open dialog". Fixed with a provenance contract (`CREDIT_STATUS_CONTRACT.md`).

## 4. Consumer impact

| Consumer | Before | After |
|---|---|---|
| `live-probe` (`probe`, `probe_detail`) | open panel → `VERIFIED`, 50 | open panel → `OBSERVED_IN_ALREADY_OPEN_PANEL`, `balance` None, `observed_balance` 50. Still read-only; still `UNEXPECTED_DIALOG`; still `CREDIT_BALANCE_UNREADABLE_WITHOUT_CLICK` (status ≠ VERIFIED) |
| `live-probe`, malformed text | `"50.5.5 …"` → `VERIFIED`, 5055 | `UNAVAILABLE` / `INVALID_FORMAT`, `balance` None → stop reason as above |
| `live-probe`, idle page with a balance | `VERIFIED` | `VERIFIED` (identical dict) |
| `blatifa account` / `blatifa preflight` (F-1) | malformed → VERIFIED with a wrong number | malformed → `UNKNOWN` (`unparsed credit text`) → `CREDIT_UNKNOWN`. Clicks unchanged. **Not run.** |
| `preflight_gate`, `approval_gate` | — | unchanged; new `credit_evidence` is the only bridge from a `BalanceReading` |
| Runner, manual submission, handoff, nonce binding | — | unchanged (hash-verified) |
| Live-probe report JSON | `balances: [50]` possible for a non-verified read | `balances` hold only verified values (None otherwise) |

## 5. Changes to existing tests (limited, documented)

The brief authorizes changing the parser and the status. Three existing invariant tests compare the **current** hash
of `live_probe.py` / `reader.py` with their 5.3g, 5.3g.1 and 5.3g.2 baselines, so they must fail on any fix. Instead
of editing the historical baseline files, which stay byte-identical:

- new helper `tests/unit/protected_hashes.py::matches(path, digest)`. It passes when the hash equals the baseline,
  **or** when `(path, baseline, current)` is listed exactly in `evidence/approved_changes.txt` (6 entries). Any other
  file change, or other content in a listed file, still fails;
- `test_phase5_3g_preflight.py`, `test_phase5_3g1_manual_submission.py`, `test_phase5_3g2_credit_discovery.py`: the
  single `sha256 == digest` line uses `matches` instead;
- `test_phase5_3g2_credit_discovery.py`:
  - the strict `xfail` for F-2 is removed (5.3g.2 TEST_REPORT required that once F-2 is fixed). The two cases now
    pass as normal tests;
  - two asserts `credits_without_click(OPEN)["balance"] == 50` now assert `observed_balance == 50`, `balance is None`
    and the `OBSERVED_IN_ALREADY_OPEN_PANEL` status. This is stricter, and it is the F-3 fix itself;
  - one unused import is removed.

Diff: `evidence/test_changes.diff`. Tests locked by the 5.3f / 5.3f.1 test baselines (`test_core.py`,
`test_phase5_probe.py`, `test_phase5_live_evidence.py`, …) are **unchanged**, and all of their old assertions pass.

## 6. Remaining risks

| ID | Risk |
|---|---|
| F-1 | `blatifa account` / `blatifa preflight` still click to read credits, and their `ReadStatus.VERIFIED` still goes to `preflight_gate` directly, not through `credit_evidence`. Do not use them. Separate decision required. |
| F-4 | Whether a hidden credit element exists while the panel is closed is still unproven (5.3g.2). |
| R-a | Comma grouping (`1,250`) is accepted on the basis of the en-US UI locale, not an observed Flow balance ≥ 1000. |
| R-b | `VERIFIED_WITHOUT_INTERACTION` relies on "no dialog in the ARIA tree". A non-dialog popover opened by someone would not be detected. Flow has never shown the balance outside the panel (5.3g.2 D-5). |
| R-c | `OBSERVED_IN_ALREADY_OPEN_PANEL` relies on the dialog name "Account settings" (observed once, 5.3g.2 D-1). |
| R-d | The hash-supersession list must itself stay unchanged; its hash is in `evidence/new_files_hashes.txt`. |

## 7. Recommendation for Phase 5.3g.4 (not authorized)

1. If the user wants a Blatifa-read balance, implement R-2 of 5.3g.2 on top of `balance_without_click`. The user
   opens the panel themselves, and Blatifa reads once, read-only.
   - Design the trust rule explicitly. One option is a separate status (for example
     `VERIFIED_USER_OPENED_PANEL`) that `credit_evidence` accepts only with a fresh user confirmation "I opened it",
     an identity check before and after, and an unchanged URL.
   - Do not reuse `OBSERVED_IN_ALREADY_OPEN_PANEL` as evidence: it says nothing about who opened the panel.
2. Otherwise keep R-1: the balance is `user_reported(...)`, shown to the user next to the Flow quote, and never
   evidence.
3. Decide F-1 separately. For example, route `run_preflight` through `credit_evidence`, or retire the click path.
