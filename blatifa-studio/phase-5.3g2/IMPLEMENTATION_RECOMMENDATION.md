# Phase 5.3g.2 — Implementation recommendation (NOT IMPLEMENTED)

> **Ringkasan (ID):** Rekomendasinya: konfirmasi saldo secara manual oleh Anda. Pilihan untuk masa depan: Anda
> sendiri membuka panel akun, lalu Blatifa membaca saldonya read-only, dengan sumber tercatat jelas sebagai panel yang
> dibuka pengguna. Semua ini perlu keputusan dan fase terpisah.

## R-1 (now): manual user confirmation — recommended

- Before any generation, the user reads the balance in Flow and reports it.
- It is recorded as `USER_REPORTED`, with the time and the user's words, and is **never** turned into `VERIFIED`.
- The cost gate uses the Flow quote ("costing N credits"), read read-only, together with the user-reported balance.
- There is nothing to build in Blatifa: the 5.3g.1 protocol already has the user approve the cost.

## R-2 (optional, future phase): read-only balance read while the user holds the panel open

Same pattern as the detail-page handoff: the user opens the panel, and Blatifa only reads.

1. A new command (for example `blatifa credits read-open-panel`) with no click and no close. Blatifa never dismisses
   the panel.
2. Preconditions: identity VERIFIED **before** the user opens the panel; the user confirms "panel opened by me".
3. The read uses the existing `ReadOnlyPage` + `aria_snapshot`. Exactly one dialog is present, named exactly
   "Account settings". Exactly one `account.credit_link` must lie **inside** that dialog; no other dialog; the URL
   is unchanged before and after.
4. Result: `status = VERIFIED_USER_OPENED_PANEL` (not `VERIFIED_WITHOUT_INTERACTION`), with `read_at` and a short
   validity (for example ≤ 5 min). It is never reused later.
5. The normal `live-probe` keeps treating any dialog as `UNEXPECTED_DIALOG` (unchanged).

Needs: separate approval, a design note, and tests. No new browser capability is needed.

## R-3 (cleanups found, separate decision)

| ID | Proposal |
|---|---|
| F-1 | Gate or retire `blatifa account` and `blatifa preflight` credit reading (`read_credits` clicks). For example: use `credits_without_click` in preflight, and require an explicit flag for the click path. |
| F-2 | Make `CREDITS` strict: `^(?P<n>\d{1,3}(?:,\d{3})*\|\d+) Google Flow credits?$`. Treat `.` as invalid. Then remove the `xfail` mark in `test_phase5_3g2_credit_discovery.py`. |
| F-3 | `credits_without_click`: ignore hits inside any dialog (or report `INSIDE_DIALOG`), so that "without interaction" stays true. |

None of these is implemented in 5.3g.2.
