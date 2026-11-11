# Phase 5.3g.4.2.2: safety audit

> **Ringkasan (ID):**
> - Tidak ada interaksi dengan Flow, tidak ada kredit, dan tidak ada tes browser yang dijalankan.
> - Jaringan eksternal terbukti DITOLAK untuk proses yang di-sandbox.
> - Ada **efek samping**: Chrome uji yang crash menulis 47 crash dump dan `settings.dat` ke database Crashpad di
>   direktori Chrome **personal**. Tidak ada yang dihapus; keputusan diserahkan ke pengguna.

## 1. Safety state

| Item | Result |
|---|---|
| Flow interaction | **NONE** |
| Live browser profile (user's Chrome / Blatifa Chrome) | **NONE**: not attached, not navigated. The Blatifa Chrome (CDP 127.0.0.1:50568) kept running untouched, and its port was denied inside the sandbox |
| External network access from sandboxed processes | **DENIED** (EPERM, proven: NETWORK_ISOLATION_REPORT §2) |
| Deliberate control outside the sandbox boundary | one TCP SYN to 192.0.2.1:80 (TEST-NET, no host; answered with ECONNREFUSED); one DNS lookup of `example.com` by the system resolver (A/B control) |
| Browser tests (pytest) | **0 executed** |
| Chrome started | 2 harness runs inside the sandbox (both crashed) + 1 control run outside (start → about:blank → loopback page only). All temporary profiles; all processes ended (0 left over) |
| Credits consumed | **0** |
| Live generation authorized | **NO** |
| `LIVE_ACTIONS_ACTIVE` | `Final = False`, unchanged |
| `deny: true` | 18, unchanged |
| `BLATIFA_LIVE` / `BLATIFA_CHROME` / `BLATIFA_WORKSPACE` | unset |

## 2. Side effect: personal Chrome Crashpad database

- **What was written:** 47 `.dmp` files (≈ 366 KB each) in
  `~/Library/Application Support/Google/Chrome/Crashpad/completed/`, plus an update of `Crashpad/settings.dat`.
  Times 11:38:46–11:39:48 (+07:00), i.e. the two sandboxed Chrome runs (`evidence/crashpad_side_effect.txt`).
- **Cause:** Chrome on macOS keeps its crash database in the default Chrome directory even when it runs with a
  temporary `--user-data-dir`.
- **What the dumps contain:** memory of the crashed **test** Chrome processes, which had only `about:blank` and a
  loopback page open in an empty temporary profile.
- **Not done:** the contents were not read, and nothing was deleted or moved (no deletion is authorized).
- **Upload: UNVERIFIED, by inference not possible.** The crashpad handler of the test Chrome ran inside the sandbox,
  where all external connections fail with EPERM. The reports are under `completed/`, which Crashpad does not
  upload again. Whether a report was "skipped" or "uploaded" is recorded in the database metadata, which was **not
  read**, because it belongs to the personal Chrome directory.
- **Correction to Phase 5.3g.4.2.1 (the historical document is not edited).** The static audit stated that browser
  tests do not touch the personal Chrome directory. That holds for the profile, cookies and storage. It does
  **not** hold for Chrome's crash database: any crashing test Chrome writes there.

User decision needed:
- keep the 47 dumps;
- or have them removed (by the user, or by Claude with explicit approval);
- and whether future browser runs must set a separate crash directory (a code change).

## 3. Integrity

- **Protected hashes:** `evidence/protected_hashes_before.txt` and `protected_hashes_after.txt` cover 1786 entries:
  every project file except `.venv`, `__pycache__`, `.ruff_cache` and this folder, plus `p53g.db`. They are
  **identical**.
- **Unchanged:**
  - production code, tests and fixtures;
  - manifests and integrity roots;
  - the G.1–G.4.2.1 evidence and reports;
  - `p53g.db` (`a6e4cacf…`), prompts, nonces and attempts.
- **New files:** only `docs/phase-5.3g4.2.2/` (documents, evidence, and harness copies in `evidence/harness/`).
