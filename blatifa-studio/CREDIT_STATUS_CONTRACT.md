# Phase 5.3g.3 — Credit status contract (F-3)

> **Ringkasan (ID):** Nilai saldo dan asal-usulnya sekarang dipisah. Ada empat status:
> `VERIFIED_WITHOUT_INTERACTION`, `OBSERVED_IN_ALREADY_OPEN_PANEL`, `USER_REPORTED` dan `UNAVAILABLE`. Setiap status
> punya kolom nilainya sendiri, dan hanya kolom itu yang boleh terisi. Credit gate hanya menerima
> `VERIFIED_WITHOUT_INTERACTION` yang masih segar (≤ 300 detik). Saldo dari panel yang sudah terbuka tidak pernah
> disebut "tanpa interaksi".

Module: `src/blatifa/account/balance.py` (`BalanceStatus`, `Reason`, `BalanceReading`, `read_from_tree`,
`user_reported`). Gate input: `src/blatifa/production/gates.py::credit_evidence`.

## Root cause (F-3)

`live_probe.credits_without_click` searched the **whole** tree. A balance inside the open "Account settings" dialog
returned `{"status": "VERIFIED", "balance": 50, "detail": "visible without interaction"}`. The value was never used,
because `probe()` stops on any dialog, but the label was false and the value sat in the field meant for a verified
balance.

## Statuses

| Status | Meaning | Value field (the only one allowed) | Credit gate |
|---|---|---|---|
| `VERIFIED_WITHOUT_INTERACTION` | exactly one valid balance text, outside every dialog, while **no** dialog is open | `verified_balance` | accepted if fresh |
| `OBSERVED_IN_ALREADY_OPEN_PANEL` | exactly one valid balance text, inside the single dialog named exactly "Account settings" | `observed_balance`; `panel_opened_by = "UNKNOWN"` always | rejected |
| `USER_REPORTED` | stated by the user (`user_reported(statement)`) | `user_reported_balance` | rejected |
| `UNAVAILABLE` | anything else | none | rejected |

`UNAVAILABLE` reasons: `TREE_UNREADABLE`, `NOT_PRESENT`, `MULTIPLE_VALUES`, `INVALID_FORMAT`, `AMBIGUOUS_FORMAT`,
`MISSING_VALUE`, `DIALOG_PRESENT` (balance outside a dialog while some dialog is open), `INSIDE_OTHER_DIALOG` (another
dialog, an `alertdialog`, or more than one dialog), `MIXED_LOCATIONS` (same text inside and outside a dialog).

## Provenance kept on every reading

`status`, `reason`, `source` (`aria_snapshot:page`, `aria_snapshot:dialog "Account settings"`, `user_statement`),
`observed_text` (raw text), `parse` (the parser verdict), one value field, `panel_opened_by`, `refresh_text`, `detail`,
`read_at` (time zone required).

Invariants enforced in `BalanceReading.__post_init__` (construction fails otherwise):
- only the value field of the current status may be set;
- a status with a value needs a `VALID` parse whose value is equal to it;
- `panel_opened_by` exists only for `OBSERVED_IN_ALREADY_OPEN_PANEL` and is always `UNKNOWN`. Who opened the panel
  is never inferred;
- `USER_REPORTED` always goes with reason `USER_STATEMENT`, and that reason with nothing else;
- `read_at` must parse and carry a time zone.

## Legacy shape (`live_probe.credits_without_click`)

`ProbeResult.credits` keeps its dict shape for existing consumers. Its `"balance"` key is now the **verified value
only**.

| Reading | Legacy dict |
|---|---|
| VERIFIED_WITHOUT_INTERACTION | `{"status": "VERIFIED", "balance": n, "refresh": …, "detail": "visible without interaction"}` (unchanged) |
| OBSERVED_IN_ALREADY_OPEN_PANEL | `{"status": "OBSERVED_IN_ALREADY_OPEN_PANEL", "balance": None, "observed_balance": n, "refresh": …, "panel_opened_by": "UNKNOWN", "detail": "observed in an account panel that was already open; who opened it is unknown"}` |
| NOT_PRESENT | `{"status": "UNAVAILABLE_WITHOUT_CLICK", …}` (unchanged) |
| MULTIPLE_VALUES | `{"status": "AMBIGUOUS", …}` (unchanged) |
| TREE_UNREADABLE | `{"status": "UNKNOWN", …}` (unchanged) |
| other UNAVAILABLE reasons | `{"status": "UNAVAILABLE", "balance": None, "detail": …, "reason": …}` |

`live_probe.balance_without_click(tree)` returns the full `BalanceReading` for new code (Phase 5.3g.4).

## Credit gate input

`credit_evidence(reading, now=…, max_age_s=300) → (ReadStatus, balance, why)`:
- `(VERIFIED, n)` only for `VERIFIED_WITHOUT_INTERACTION` with `0 ≤ age ≤ 300 s` (5 s clock skew allowed);
- everything else, including `None`, gives `(UNKNOWN, None)`. `preflight_gate` then blocks with `CREDIT_UNKNOWN`.

It has no default value, reads no ledger, settings or memory, and keeps no state. `preflight_gate` and
`approval_gate` themselves are unchanged.
