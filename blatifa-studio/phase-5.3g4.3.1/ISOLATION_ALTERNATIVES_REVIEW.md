# Phase 5.3g.4.3.1: isolation alternatives review (summary)

> **Ringkasan (ID):**
> - Mac **bisa** memberi isolasi jaringan yang cukup untuk Chrome tanpa mematikan sandbox-nya, yaitu dengan
>   **pemutusan jaringan fisik** yang dibuktikan secara read-only dan diawasi selama run. Ini masih desain dan
>   belum dibuktikan.
> - Masalah yang tersisa bukan jaringan, melainkan **Crashpad di direktori Chrome personal**.
> - Firewall per aplikasi (LuLu, Little Snitch) tidak cukup. macOS Application Firewall tidak bisa dipakai.
> - VM tidak diperlukan, kecuali bukti pemutusan gagal.

## 1. Answers Q1–Q10

| Q | Answer | Label | Where |
|---|---|---|---|
| Q1 Physical disconnection sufficient, localhost preserved? | **Yes in principle**, if all interfaces are down and N1–N11 pass. Today the only active path is Wi-Fi `en0`; Ethernet adapters inactive; `utun` IPv6 default routes must be shown unusable | UNVERIFIED (design); host state VERIFIED | MACOS_NETWORK_ISOLATION_OPTIONS §1–2 |
| Q2 Chrome native sandbox while offline? | **Expected yes**: network-layer isolation does not nest Seatbelt. The default launch works on this host (G.4.1: 43/43 passed, online). Offline start-up and sandbox engagement are not yet shown | VERIFIED (online launch); UNVERIFIED (offline, sandbox engaged) | CHROME_SANDBOX_COMPATIBILITY §2 |
| Q3 Can firewall tools isolate Chrome and its children? | **Application Firewall: no** (incoming only). **PF: yes**, system-wide and process-agnostic, with counters; needs root and a firewall change. **LuLu / Little Snitch: not proven**: helper coverage UNKNOWN, and DNS through `mDNSResponder` is not covered by a Chrome rule | mixed; see table | MACOS_NETWORK_ISOLATION_OPTIONS §3 |
| Q4 Tests without a real browser? | only **#39** `test_state_with_missing_param_is_skipped`, statically. As written, it still launches Chrome via the fixture | STATICALLY_CONFIRMED | BROWSER_TEST_CLASSIFICATION §3–5 |
| Q5 Tests runnable with Chrome while disconnected? | Groups **A + B: 28 tests**. Group C (15) technically also, but only under separate approval | UNVERIFIED | BROWSER_TEST_CLASSIFICATION §5 |
| Q6 Must remain blocked? | **All 43 today** (no isolation, no authorization). Group C must never run on a connected host. Group D is empty | STATICALLY_CONFIRMED | BROWSER_TEST_CLASSIFICATION §4–5 |
| Q7 Meaningful subset without VM or installation? | **Yes, by design** (option 1) | UNVERIFIED | IMPLEMENTATION_RECOMMENDATION §4 |
| Q8 Lowest risk for 8 GiB RAM and limited disk? | **Option 1** (no disk, RAM or software); plus **1b** (test-only macOS user) if the Crashpad risk is not accepted | — | IMPLEMENTATION_RECOMMENDATION §1 |
| Q9 Evidence before approving execution? | N1–N11; the Chrome command-line, helper and sandbox checks; the H8 decision; protected hashes before and after; separate approval per group | — | THREAT_MODEL acceptance criteria |
| Q10 Risk to personal profile, Flow or external network? | **Personal profile:** no (tmp profile + guard). **Personal Chrome directory:** **yes, Crashpad** (VERIFIED on crash), unless 1b or acceptance. **Flow:** no static path; offline is a backstop. **External network:** removed by option 1 if verified; the Blatifa Chrome also goes offline (not touched) | STATICALLY_CONFIRMED / VERIFIED / UNVERIFIED | THREAT_MODEL H5–H9 |

## 2. Key evidence used

- **G.4.2.2:**
  - `sandbox-exec` blocks ordinary processes (VERIFIED);
  - Chrome crashes under it (VERIFIED);
  - Crashpad writes to the personal directory (VERIFIED).
- **G.4.1 and 5.2.1 full-regression logs:**
  - all 43 browser tests passed on this host with the default Chrome launch (VERIFIED);
  - those runs were **not network-isolated**.
- **Host state now** (read-only):
  - Wi-Fi only;
  - Application Firewall enabled (incoming);
  - no LuLu or Little Snitch;
  - a Bitdefender Network Extension is active.
- **Source:**
  - `chrome.py` (launch arguments, CDP on 127.0.0.1);
  - `conftest.py`;
  - `health.py:34-36`;
  - `adapter.py:52-54,132-136`.

## 3. Discrepancies noted

- The brief says "Mac mini M1". `sysctl` reports `Mac14,7`, Apple M2. The measured values are used.
- Free disk read 8.8 GiB in the previous phase and 10 GiB at 14:01 in this phase. It fluctuates and should be
  re-measured before any run.
