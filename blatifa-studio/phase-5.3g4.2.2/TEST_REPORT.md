# Phase 5.3g.4.2.2: test report

> **Ringkasan (ID):** Verdict **BLOCKED**. Isolasi jaringan terbukti untuk proses biasa, tetapi Chrome tidak bisa
> berjalan di dalam sandbox. 0 dari 43 tes browser dijalankan.

## 1. Totals

| | Count |
|---|---|
| Browser tests in scope | 43 |
| Executed | **0** |
| Passed / failed / skipped | 0 / 0 / 0 |
| All 43 executed? | **No** |

## 2. Stage results

| Stage | Result | Evidence |
|---|---|---|
| A — isolation design | profile built and loaded (exit 0) | `evidence/isolation.sb`, `evidence/environment_before.txt` |
| B — loopback, external TCP/UDP/IPv6/LAN, DNS, child inheritance | **all as required** | `evidence/isolation_verification.{txt,json}`, `evidence/dns_attribution.txt` |
| B — Chrome inheritance (§4.3) | **FAILED**: Chrome's own sandbox cannot initialise inside `sandbox-exec` → `Target crashed` | `evidence/chrome_inheritance.{json,stderr}`, `evidence/chrome_diag_inside.json`, `evidence/chrome_diag_outside.json` |
| C — batches 1–3 | **not started** (§4.5 stop gate) | — |

## 3. Commands

These are the exact commands; the harness copies are in `evidence/harness/`.
- `sandbox-exec -f evidence/isolation.sb /usr/bin/true`: profile load check.
- `.venv/bin/python -B verify.py evidence/isolation.sb <venv python> evidence/isolation_verification.json`: the
  probes run as `sandbox-exec -f <profile> <python> -B probe.py …`.
- `sandbox-exec -f evidence/isolation.sb <python> -B chrome_check.py`: exit 1, Target crashed.
- `sandbox-exec -f evidence/isolation.sb <python> -B chrome_diag.py <dir>` and the same command without
  `sandbox-exec` (control).

## 4. Verdict: BLOCKED

Isolation could not be proven for Chrome, the process that actually needs it, so the stop gate applied. There was
no Flow interaction and no credits were used, and protected files are unchanged. A new user decision is needed
(see the final report to the user).

Mutation status unchanged: `MUTATION EVIDENCE NOT INDEPENDENTLY VERIFIED`.
