# Phase 5.3g.4.2.1: execution approval gate

> **Ringkasan (ID):** Tidak ada tes browser yang dijalankan. Menurut definisi brief, belum ada tes yang SAFE untuk
> dijalankan apa adanya. Semua 43 tes UNKNOWN karena kriteria jaringan. Persetujuan pengguna: **PENDING**.

| Item | Value |
|---|---|
| Browser tests discovered | 43 (8 files; AST count) |
| SAFE (eligible as-is) | **0** |
| UNSAFE (forbidden) | **0** |
| UNKNOWN | **43**: all because external network traffic by Chrome itself cannot be excluded (B-1); 10 of them also load `.test` URLs (B-2) |
| Browser tests executed in this phase | **0** |
| User approval to execute | **PENDING** |

## UNKNOWN list

All tests in:
- `test_account_and_capture.py` (7)
- `test_adapter_v2_grid.py` (6)
- `test_control_ui.py` (1)
- `test_engine_recovery.py` (5)
- `test_flow_adapter.py` (5)
- `test_live_probe_fixture.py` (4)
- `test_validator_and_health.py` (14)
- `test_video_properties_fixture.py` (1)

The full table is in BROWSER_TEST_SAFETY_AUDIT.md §3.

## Options for the user (none is taken without explicit approval)

1. **Run under run-time network isolation (no code change).** Run `tests/browser` only, inside a macOS
   `sandbox-exec` profile that denies outbound network except loopback, or with networking switched off. Log the
   policy and the full output. If the isolation is proven, every other criterion is already evidenced, so the tests
   could then be treated as SAFE-under-isolation. Proposed order: `test_engine_recovery` → `test_account_and_capture`
   → the rest. Stop at the first unexpected event, without retry.
2. **Code change in a later phase.** Add test-only Chrome flags that block external hosts and background traffic, and
   replace the two `.test` URLs with `data:` URIs. Re-audit afterwards.
3. **Accept the current state.** Leave G.4.2 at CONDITIONAL PASS without browser coverage.

## Preconditions for any future run

- `BLATIFA_CHROME`, `BLATIFA_WORKSPACE` and `BLATIFA_LIVE` unset.
- `LIVE_ACTIONS_ACTIVE=False`, 18 `deny: true`.
- Only `tests/browser` (plus `-rs` and a stored log).
- No CLI `account`/`preflight`/`live-probe`/`browser`.
- No retry after an anomaly.
