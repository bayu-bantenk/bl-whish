# Phase 5.3g.2 — DOM evidence

> **Ringkasan (ID):** Pada satu pembacaan read-only (2026-11-10 04:05:51Z), panel "Account settings" ternyata sedang
> terbuka. Blatifa tidak membukanya. Di dalam panel itu ada link "50 Google Flow credits". Pada probe Anda sebelumnya,
> panel tertutup dan saldo tidak ada di halaman. Pemeriksaan langsung berhenti karena ada dialog, sesuai brief §9.

Source: `evidence/dom_discovery.json`, written by `tools/credit_dom_discovery.py` (one run, `ReadOnlyPage`
reads only). Emails and names were never stored: the file has 0 `@` characters, and other texts are kept only as
their length.

## Run conditions

| Item | Value |
|---|---|
| Browser | HEALTHY, Chrome/157.0.8103.40, profile `main` |
| URL (redacted) | `flow.google.com/project/562eec3d-9c48-4802-b152-3ed1d8c91ebd`, no query |
| Identity | VERIFIED, fingerprint matches `d6c9f4583fa6` |
| Dialogs | **1: `dialog`, name length 16** (= "Account settings", the account panel) → stop |
| Steps executed | health, URL, identity, ARIA snapshot of `body`. Stopped before the DOM-text step and the URL re-check. |
| Duration | under 1 s; no click, scroll, hover, script, reload or navigation |

## Findings (accessibility tree, 112 nodes)

| # | Evidence source | Element | Text / attributes (redacted) | Visible | Needs interaction to appear | Confidence |
|---|---|---|---|---|---|---|
| D-1 | ARIA snapshot (current page) | `link` inside the open dialog | name `"50 Google Flow credits"` (matches `CREDITS`) | yes (in the a11y tree) | **yes: the account panel must be open** | high (matches registry `account.credit_link within account.dialog`, Phase 0 E-FLOW-17) |
| D-2 | ARIA snapshot | `/url` of that link | 205 characters (value not stored) | — | same as D-1 | high |
| D-3 | ARIA snapshot | `text` inside the dialog | `"Credits refresh daily at 3:37 PM"` | yes | same as D-1 | high |
| D-4 | ARIA snapshot | other nodes containing "credit" | none | — | — | high |
| D-5 | user's probes 1 and 2 (`dialogs=[]`) and Phase 5 E-P5-22 (5 live probes) | whole page, panel closed | no node matches `CREDITS` → `UNAVAILABLE_WITHOUT_CLICK` | — | — | high |

## Questions in brief §4B

| Question | Answer |
|---|---|
| Balance text in the current DOM? | Only while the account panel is open (D-1). With the panel closed: absent from the accessibility tree (D-5). |
| Relevant element present but hidden? | **Not proven either way.** A hidden-DOM text search (`get_by_text`, which also reads hidden elements) needs the panel closed, and the run stopped first. |
| Visible but the locator fails? | No. When the panel is open, the existing `credits_without_click` reads it (`VERIFIED`, balance 50). |
| Shadow DOM? | No sign of it. The ARIA snapshot includes the link, and Playwright's ARIA snapshot covers open shadow roots. Closed shadow roots cannot be seen and are not claimed. |
| In the accessibility tree already available to the integration? | Yes, but only while the panel is open. |
| Indicator absent from this page? | With the panel closed: there is no balance indicator in the header. Only the `Account details` button exists. |
| Requires a separate UI interaction? | **Yes.** The panel opens through the button "Account details" (registry workflow `account_dialog: click account.account_button`). Today it was open; Blatifa did not open it. |

The value 50 here matches what you reported. It was read from a panel that someone else opened, and it is **not**
used as a verified current balance by any Blatifa result. The live-probe stops on this dialog
(`UNEXPECTED_DIALOG`).
