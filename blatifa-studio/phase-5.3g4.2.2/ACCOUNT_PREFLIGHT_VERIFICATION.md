# Phase 5.3g.4.2.2: account / preflight verification

> **Ringkasan (ID):** **Tidak terverifikasi**: ketujuh tes `test_account_and_capture.py` tidak dijalankan, karena
> isolasi gagal dibuktikan untuk Chrome.

| Item | Status |
|---|---|
| 7 account/capture tests executed | **NO** |
| `read_credits()` clicks only the fixture DOM | static evidence only (G.4.2.1 ACCOUNT_PREFLIGHT_PATH_AUDIT); **not verified by execution** |
| `run_preflight` uses injected dependencies | static evidence only; not verified by execution |
| New `credit_evidence(reading)` signature exercised on this path | **not exercised** in a browser. It is covered offline by the G.4.2 unit tests (`test_no_production_call_supplies_a_freshness_override`, the 5.3g.4 `run_preflight` tests with fake readers) |
| `CreditSnapshot` → UNKNOWN → `CREDIT_UNKNOWN` | predicted from source; not verified in the browser |
| Limitation | even when run, this path does **not** exercise the freshness calculation: a `CreditSnapshot` returns UNKNOWN before it |
