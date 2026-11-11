# Phase 5.3g.2 — Credit balance read-only discovery: report

> **Ringkasan (ID):** Saldo kredit Flow hanya muncul di dalam panel akun ("Account settings"). Panel itu baru
> terbuka setelah tombol "Account details" diklik. Saat panel tertutup, saldo tidak ada di halaman, sehingga hasilnya
> `UNAVAILABLE_WITHOUT_CLICK`. Klasifikasi: **RESULT C — REQUIRES_USER_INTERACTION**. Ada dua temuan sampingan:
> perintah lama `blatifa account` dan `blatifa preflight` membaca kredit dengan *mengklik* panel, dan parser kredit
> menerima pengelompokan angka yang salah. Tidak ada kode produksi yang diubah.

## 1. Executive summary

- The balance is a link `"<n> Google Flow credits"` inside the dialog "Account settings". The dialog opens when the
  `Account details` button is clicked. The page header shows no balance.
- Blatifa's read-only probe reads the accessibility tree only, so with the panel closed it correctly reports
  `UNAVAILABLE_WITHOUT_CLICK`, and the CLI adds `CREDIT_BALANCE_UNREADABLE_WITHOUT_CLICK`.
- In today's single read-only run the panel happened to be open (Blatifa did not open it). The link read
  "50 Google Flow credits", and the run stopped on the dialog, as required.
- **Classification: RESULT C — REQUIRES_USER_INTERACTION.** Safe approach: manual user confirmation. A future
  option is a read performed while the user holds the panel open (see the recommendation).

## 2. Root cause (established)

1. `cli.cmd_live_probe` → `lp.probe(ro, registry)` per probe (`live_probe.py:444`).
2. `probe` → `body_tree(page)` = `page.locator("body").aria_snapshot()` (read-only) → `credits_without_click(tree)`
   (`live_probe.py:328`).
3. `credits_without_click` looks for nodes whose name or value matches
   `CREDITS = ^(?P<n>\d[\d,.]*) Google Flow credits?$` (`account/reader.py:24`). With the panel closed there is no
   such node → `{"status": "UNAVAILABLE_WITHOUT_CLICK", "balance": None}` (`live_probe.py:340`).
4. `cmd_live_probe`: `if any(p.credits["status"] != "VERIFIED" …): stop.append("CREDIT_BALANCE_UNREADABLE_WITHOUT_CLICK")`
   (`cli.py:628-629`).
5. The only element that carries the balance is registry `account.credit_link` (`within: account.dialog`), which is
   rendered only inside the open account panel (registry workflow `account_dialog`: `click account.account_button`).

This is fail-closed behaviour, not a locator defect.

## 3. Existing code paths

| Path | File | Interaction | Used here |
|---|---|---|---|
| `blatifa live-probe` → `credits_without_click` | `cli.py`, `flow/live_probe.py` | none (`ReadOnlyPage`) | yes (its methods) |
| `blatifa account` → `account.reader.read_credits` | `cli.py:183`, `account/reader.py:129` | **clicks `Account details`, then `Close account panel`** (raw page, not `ReadOnlyPage`) | **no** |
| `blatifa preflight` → `production/preflight.run_preflight` → `read_credits` | `production/preflight.py:31` | **same clicks** | **no** |
| Identity | `live_probe.identity_without_interaction` (`validate` + `aria_snapshot`) | none | yes |
| Locators | `flow_locators.yaml` `account.*` (`credit_link`, `credit_link_any`, `refresh_text`, `dialog`) | — | read |
| Model and stop | `ProbeResult.credits`, `probe()` → `UNEXPECTED_DIALOG`, CLI → `CREDIT_BALANCE_*` | — | — |
| Tests | `test_phase5_probe.py::test_credits_are_read_only_when_visible_without_a_click`, `test_core.py`, `test_phase5_live_evidence.py`, `tests/browser/test_live_probe_fixture.py` | — | — |

## 4. Findings

| ID | Finding | Severity | Status |
|---|---|---|---|
| F-1 | `blatifa account` and `blatifa preflight` open and close the account panel with clicks (`read_credits`). These are UI interactions, but not Flow mutations and not credit-consuming. `account_button` and `close_panel` carry no `deny: true`. These commands conflict with the current "no click" policy and must not be used for credit reading under it. | medium (policy) | documented; not changed |
| F-2 | `parse_credits` accepts malformed digit grouping: `"50.5.5 …"` → 5055, `"5,0,0 …"` → 500. `"1.000"` is read as 1000 (locale ambiguity). | low (Flow currently shows plain integers) | documented with a strict `xfail` test; not changed |
| F-3 | `credits_without_click` labels any hit "visible without interaction", even when the hit lies inside an open dialog that someone opened. The value is not used, because `probe()` stops on the dialog, but the label is misleading. | low | documented; not changed |
| F-4 | Whether the credit element exists hidden in the DOM while the panel is closed is not established: the run stopped first. | — | open (limitation) |

## 5. Browser architecture (§4C)

`ReadOnlyPage` already provides everything a read needs: `aria_snapshot`, `count`, `is_visible`, `inner_text`,
`text_content`, `get_attribute` and role- or text-based locators. Clicks, typing, hover, navigation, reload and
non-vetted scripts are refused. A future read of the balance while the user holds the panel open needs **no new
browser capability**. It needs only a different stop policy for one expected dialog (see the recommendation).

## 6. Classification

**RESULT C — REQUIRES_USER_INTERACTION.** Evidence: absent with the panel closed (2 user probes, and 5 live probes in
Phase 5); present only inside the open "Account settings" dialog today. A and B are excluded: there is no
interaction-free location, and the current locator and parser read it correctly when it is present. D is excluded:
the location is proven.

## 7. Limitations

- One live read. The panel state was not controlled, and its opener is unknown (not Blatifa: this phase's tool makes
  no click, and earlier commands were not run in this session).
- F-4 is open. Closed shadow roots cannot be seen.
- The 50-credit value is observed text from a panel opened by someone else. It is not a verified current balance.
