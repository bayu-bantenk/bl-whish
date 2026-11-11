# Phase 5.3g.4.2.1: account and preflight path audit (`tests/browser/test_account_and_capture.py`)

> **Ringkasan (ID):** Ketujuh tes di file ini memakai halaman fixture lokal `flow_like.html` di Chrome headless
> dengan profil sementara.
> - `read_credits()` **memang dipanggil dan mengklik**, tetapi hanya di DOM fixture lokal.
> - `run_preflight` memakai `page`, `registry` dan `tmp_path` yang diinjeksi tes, dan memanggil `credit_evidence`
>   dengan signature baru (satu argumen).
> - Tidak ada jalur ke Flow, adapter live, atau DB eksperimen.
> - Verdict: **UNKNOWN** hanya karena kriteria jaringan Chrome (B-1). Tes ini **belum dijalankan** setelah G.4.2.

## 1. Call path (static, from source)

```
test_preflight_reads_everything_and_clicks_only_phase1_controls(open_fixture, registry, tmp_path)
└─ open_fixture()                                    tests/browser/conftest.py
   ├─ engine.page()          → BrowserEngine(Settings(workspace=<tmp>), "test", headless=True), CDP 127.0.0.1:<own port>
   ├─ page.goto("about:blank"); page.goto(FIXTURE.as_uri())   FIXTURE = tests/fixtures/flow_like.html (file://)
├─ read_identity(page, registry)                     account/reader.py:121
│  ├─ perform(scroll_top)                            inspector/actions.py (page.evaluate only)
│  └─ validate("account.identity_button") → reads the accessible name; no click
└─ run_preflight(page, registry, tmp_path, fp, SpendingPolicy(min_free_disk_bytes=0))   production/preflight.py
   ├─ read_identity(page, registry)                  (as above)
   ├─ read_credits(page, registry)                   account/reader.py:133   ← CLICKS (fixture DOM only)
   │  ├─ perform(scroll_top)
   │  ├─ perform(click "account.account_button")     assert_click_allowed: allowed target (not deny / credit-sensitive)
   │  ├─ validate("account.dialog"), validate("account.credit_link") → CreditSnapshot(VERIFIED, 40)
   │  └─ _close_panel → click "Close account panel"
   ├─ credit_evidence(credits)                       production/gates.py  (G.4.2 signature: one argument)
   │  └─ isinstance(credits, CreditSnapshot) → (UNKNOWN, None, LEGACY_CLICK_READ)   ← returns before any time check
   ├─ run_state(page, registry, "project_idle" | "agent_settings", {})   clicks "Settings", "Back" on the fixture
   ├─ free_bytes(tmp_path)
   └─ preflight_gate(PreflightInputs(credit_status=UNKNOWN, balance=None, …))  → blocks [CREDIT_UNKNOWN]
```

## 2. Required proofs

| Question (brief §4.3) | Answer | Evidence |
|---|---|---|
| Does the browser use the fixture page? | **Yes** | `conftest.FIXTURE = tests/fixtures/flow_like.html`, `fixture_url()` = `FIXTURE.as_uri()` (+ `#variant`); variants `noidentity`, `nocredits`, `badcredits` and `confirmnever` are hash fragments of the same local file |
| Does the account reader get fixture data or the user's browser? | **Fixture data** | the `page` comes from the fixture Chrome with a fresh temporary profile (`<tmp>/profiles/test/chrome`); the identity is the fixture's invented `jane.tester@example.com` |
| Can `read_credits()` be called? | **Yes, it is called directly** by `test_credits_*` (3 tests) and through `run_preflight` (1 test) | `test_account_and_capture.py` |
| Is there a click that opens the account panel? | **Yes, on the fixture**: `Account details` and `Close account panel` (asserted: `clicks(page) == ["Account details", "Close account panel"]`) | fixture JS records clicks in `window.__clicks`; nothing leaves the page |
| Does `run_preflight` use only injected dependencies? | **Yes**: `page`, `registry` (`load_registry()`), `workspace=tmp_path`, `expected_fingerprint` and `policy` are all passed in. No `Settings()`, no `BrowserEngine`, no CLI | `production/preflight.py` |
| Does `credit_evidence` use the new signature? | **Yes**: `credit_evidence(credits)`, the one-argument form, at `preflight.py:42`. A `CreditSnapshot` returns UNKNOWN before the freshness code, so the G.4.2 change does not alter this path's result | `gates.py`, AST call inventory (G.4.2) |
| Any path to a live adapter? | **No**: this file does not import `blatifa.flow.adapter`; `run_preflight` calls no adapter | imports of the file and of `preflight.py` |
| Any external interaction? | **No test-initiated one**. `flow_like.html` has only `data:` image sources and `#` links, and no script fetches anything. Chrome's own background networking is not excluded (B-1) | fixture scan |
| Credit-sensitive clicks? | **Asserted absent**: the test checks that `Start generation`, `Approve`, `Always approve` and `Upload media` were not clicked; `composer.send` / `account.identity_button` are refused by `assert_click_allowed` (`test_validator_and_health`) | test + `inspector/actions.py` |

## 3. Expected outcome after G.4.2 (prediction, NOT a test result)

From the source, `test_preflight_reads_everything_and_clicks_only_phase1_controls` is expected to pass unchanged:
- `credit_evidence(CreditSnapshot)` → `(UNKNOWN, None, LEGACY_CLICK_READ)`;
- `LEGACY_CLICK_READ` contains "diagnostic only";
- the gate blocks `[CREDIT_UNKNOWN]`.

This prediction is **UNVERIFIED** until the test is run with separate user approval.

## 4. Classification of the 7 tests in this file

All 7 are **UNKNOWN**, for the network criterion only (B-1: Chrome background networking). Every other criterion is
evidenced:
- local fixture;
- no Flow;
- temporary profile;
- no credentials;
- no live adapter;
- tmp-only writes;
- clicks confined to the fixture DOM.
