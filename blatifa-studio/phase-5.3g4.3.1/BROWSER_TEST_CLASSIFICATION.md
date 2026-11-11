# Phase 5.3g.4.3.1: browser test classification (static)

> **Ringkasan (ID):**
> - **Grup A:** 1 tes. **Grup B:** 27. **Grup C:** 15. **Grup D:** 0.
> - Semua 43 tes tetap meluncurkan Chrome lewat fixture, termasuk yang di Grup A. Jadi **semuanya** tetap butuh
>   isolasi jaringan, karena Chrome sendiri bisa membuat lalu lintas latar belakang (temuan B-1).
> - Bukti historis: ke-43 tes **pernah lulus di host ini** (G.4.1 dan 5.2.1), tetapi dengan jaringan menyala dan
>   tanpa isolasi.
> - Tes tidak diubah, dan pytest tidak dijalankan (termasuk collection).

## 1. Labels and method

- **Labels:** VERIFIED (existing evidence), STATICALLY_CONFIRMED (source inspection), UNVERIFIED, UNKNOWN,
  NOT_APPLICABLE.
- **Read in this phase:**
  - all eight files in `tests/browser/` and `tests/browser/conftest.py`;
  - `src/blatifa/browser/chrome.py`, `config.py`, `inspector/health.py:31-56`, `flow/adapter.py:47-141`;
  - the G.4.2.1 audit.
- The 43-test count comes from the G.4.2.1 AST count (no collection).

## 2. Facts that apply to every test

| # | Fact | Label | Evidence |
|---|---|---|---|
| F1 | Every test obtains a page from `engine` (session) or `fresh_engine`, so a **real Google Chrome** is launched (`DEFAULT_CHROME`, headless, tmp profile) and Playwright attaches over CDP 127.0.0.1 | STATICALLY_CONFIRMED | `conftest.py:24-33`, `test_engine_recovery.py:14-19`, `chrome.py:79-94` |
| F2 | Chrome is started without background-networking flags (B-1), so Chrome itself may contact Google services regardless of the test | STATICALLY_CONFIRMED (absence of flags); traffic itself UNKNOWN | `chrome.py:79-94` |
| F3 | Profile = fresh tmp directory; `assert_profile_allowed` refuses the personal Chrome directory | STATICALLY_CONFIRMED | `chrome.py:64-69`, `config.py:13,34` |
| F4 | **Crash data** of a test Chrome goes to the **personal** `~/Library/Application Support/Google/Chrome/Crashpad`, despite the tmp profile | VERIFIED for crashing Chrome (G.4.2.2); UNKNOWN whether a normal, non-crashing run writes there | `docs/phase-5.3g4.2.2/evidence/crashpad_side_effect.txt` |
| F5 | All 43 passed on this host, connected to the network, with the default Chrome launch | VERIFIED | `evidence/historical_browser_runs.txt` (G.4.1 `pytest_full.log`: 7+6+1+5+5+4+14+1 dots; 5.2.1 the same) |
| F6 | No test reaches Google Flow, the account, a live action, `p53g.db` or the CLI | STATICALLY_CONFIRMED | G.4.2.1 §2, re-read here |

## 3. Criteria per group

The criteria 1–9 are those of the brief: 1 Chrome, 2 Playwright, 3 local fixtures only, 4 localhost, 5 external
DNS/network by the **test content**, 6 live adapter code, 7 Flow interaction, 8 personal profile / persistent
state, 9 convertible to a unit test without loss of intended coverage.

| Group / files | n | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
|---|---|---|---|---|---|---|---|---|---|---|
| ENG `test_engine_recovery.py` | 5 | yes | yes | yes (`about:blank`) | CDP | no (F2 only) | no | no | tmp profile; F4 | **no**: process start / kill / recover / reuse is the coverage |
| ACC `test_account_and_capture.py` | 7 | yes | yes | yes (`flow_like.html`) | CDP | no (F2) | no (`read_credits`, `run_preflight` click the fixture DOM only) | no | tmp_path writes; F4 | **no**: real DOM, accessibility tree, clicks, screenshot |
| UI `test_control_ui.py` | 1 | yes | yes | ControlServer on 127.0.0.1 | CDP + 127.0.0.1 server | no (F2; the UI has a CSP without external sources, per G.4.2.1) | no (`FakeFlow`) | no | tmp SQLite / episode; F4 | **no**: rendered page, CSP, console errors |
| VAL `test_validator_and_health.py`, except #39 | 13 | yes | yes | yes | CDP | no (F2) | no | no | F4 | **no**: locator resolution in a real DOM |
| VID `test_video_properties_fixture.py` | 1 | yes | yes | yes (local mp4) | CDP | no (F2) | no | no | F4 | **no**: real media decoding |
| GRID `test_adapter_v2_grid.py` | 6 | yes | yes | file:// page that references `https://flow.example.test/…` | CDP | **yes**: `.example.test` lookup (B-2) | `FixtureAdapter` (subclass of the live adapter; read methods only) | no | F4 | no |
| PROBE `test_live_probe_fixture.py` | 4 | yes | yes | file:// page that references `https://media.example.test/…` | CDP | **yes** (B-2) | `live_probe` module (read-only page wrapper) | no | F4 | no |
| ADP `test_flow_adapter.py` | 5 | yes | yes | yes (`flow_grid.html`) | CDP | no test-initiated traffic | **yes**: real `GoogleFlowAgentAdapter` (B-4). `_open()` → `flow.google.com` exists in code; unreachable from these tests (`stored_prompt("../../etc")` fails the UUID check at `adapter.py:134-135` before `_open`) | **no** (statically) | F4 | no |
| #39 `test_state_with_missing_param_is_skipped` | 1 | **as written yes** (fixture) | yes | yes | CDP | no (F2) | no | no | F4 | **yes**: `run_state` returns SKIPPED at `health.py:34-36` before any page call. A unit test with a stub page would keep the intended coverage. It would be a **new** test (not authorized here) |

## 4. Group assignment

| Group | Definition used | Tests | n |
|---|---|---|---|
| **A** | assertion needs no real browser (statically) | #39 | **1** |
| **B** | real browser required; everything the test itself loads is local | ENG #15–19, ACC #1–7, UI #14, VAL #29–38 and #40–42, VID #43 | **27** |
| **C** | network behaviour uncertain because of the test content or live adapter code | GRID #8–13, PROBE #25–28, ADP #20–24 | **15** |
| **D** | live or sensitive behaviour; do not execute | none | **0** |

Notes:
- **Group A is not "safe to run as is".** #39 still launches Chrome through `open_fixture`.
- **Group B is not "safe because it is local".** F2 (Chrome background traffic) and F4 (Crashpad) apply to all
  of them.
- **Group C** is C for different reasons:
  - GRID / PROBE make Chrome try to resolve reserved `.test` names. Statically, their assertions do not depend on
    the media loading: GRID checks that keys like `ready_state` exist, and PROBE parses the poster URL string. So
    an offline failure should not change the result. Label: STATICALLY_CONFIRMED for the assertions, UNVERIFIED
    at runtime.
  - ADP holds live adapter code with a Flow URL. It is safe only because no test reaches `_open`. Group D is
    avoided only through that static argument, so ADP stays C (sensitive) and must run last, with offline
    isolation as a backstop.
- **Group D is empty**, but that rests on the static audit (F6). Any test change re-opens the classification.

## 5. Q4–Q6 answers

- **Q4 (no real browser needed):** only #39, statically. As written, even #39 launches Chrome.
- **Q5 (could run with Chrome while physically disconnected):** all 28 tests of Groups A and B, once the
  disconnection is proven (MACOS_NETWORK_ISOLATION_OPTIONS §2). Group C (15) could also run offline: offline
  turns their only external path into a local failure. Because they are sensitive, they need a **separate**
  authorization after Groups A and B. UNVERIFIED.
- **Q6 (must remain blocked):**
  - **today, all 43**: no isolation is in place, and no execution is authorized;
  - **never on a connected host:** Group C;
  - **conditional:** every test, unless the user accepts or mitigates F4 (Crashpad in the personal directory).
