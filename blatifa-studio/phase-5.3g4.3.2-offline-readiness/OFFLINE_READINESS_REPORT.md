# Phase 5.3g.4.3.2 offline readiness: report

> **Ringkasan (ID):**
> - Verdict persiapan: **CONDITIONAL PASS**.
> - Skrip verifikasi mandiri sudah dibuat dan diaudit secara statis: Python stdlib, read-only, tanpa root, fail-closed.
> - Tiga hal masih terbuka:
>   - skrip belum pernah dieksekusi, termasuk `--selftest`;
>   - format output macOS saat offline belum diamati;
>   - keputusan D-1 sampai D-4 menunggu Anda.
> - Ini **bukan** PASS isolasi jaringan. Tidak ada yang mengizinkan pemutusan jaringan atau tes browser.

## 1. Scope

- **Done:** preparation only. The script and documentation were created and statically audited.
- **Not done:** the N1–N11 verification and the 60 s monitor, any network change, Chrome, Playwright, pytest and
  Flow.

## 2. Files inspected

| Path | Purpose |
|---|---|
| `docs/phase-5.3g4.3.1/MACOS_NETWORK_ISOLATION_OPTIONS.md` §1–2.4 | the original N1–N11 table and attribution rules |
| `docs/phase-5.3g4.3.1/{THREAT_MODEL,IMPLEMENTATION_RECOMMENDATION,ISOLATION_ALTERNATIVES_REVIEW,TEST_REPORT,SAFETY_AUDIT}.md` | H3/H4 provisions, option 1/1b, acceptance criteria |
| `docs/phase-5.3g4.3.1/evidence/host_network_state.txt` | interface, route and nwi formats observed online |
| `docs/phase-5.3g4.3.1/evidence/hash431.sh` | integrity convention (adapted as `evidence/hash4332.sh`) |
| `docs/` listing, `tools/` listing | naming conventions: `docs/phase-<id>/`, `evidence/` subfolder |
| `src/blatifa/inspector/data/flow_locators.yaml`, `authorization.py:30` | flag verification only (count and grep) |

- The repository root is `~/Developments/My Project/blatifa-studio`. It is not a git repository.
- **No previous 5.3G.4.3.2 prompt or specification exists in the repository.** The only `4.3.2` matches are hash
  digests inside older evidence files.

## 3. Preparation decisions

| Decision | Reason |
|---|---|
| **Python 3 standard library**, run as `/usr/bin/python3 -I` | it is already present (Xcode's 3.9.6, `xcode-select -p` = `/Applications/Xcode.app/...`, which is system-wide); it provides errno and nanosecond timing for `ENETUNREACH < 50 ms`, which zsh cannot measure reliably; `-I` ignores the user site, `PYTHON*` variables and the current directory |
| Single file, no project import | the test account runs it from `/Users/Shared/blatifa-offline/`; it needs no project code, venv or `p53g.db` |
| Directory `docs/phase-5.3g4.3.2-offline-readiness/` | the name the brief suggests; it keeps `docs/phase-5.3g4.3.2/` free for the real run's evidence |
| Allow-list command runner | makes "read-only only" auditable in one place |
| Passive → active → monitor, each gated | no probe packet is attempted unless every passive check already shows no path; a FAIL stops the run at once |
| Brief IDs as the primary numbering, original IDs recorded per check | see §4 |
| No `CONDITIONAL PASS` except the H3 case | the brief permits it only where the original spec does |

## 4. Conflicts between the brief and the original specification (documented, not silently resolved)

| # | Conflict | Handling | Decision needed |
|---|---|---|---|
| C-1 | **Numbering.** The brief's N1–N11 are not the original N1–N11 (for example, original N1 = `scutil --nwi`, brief N3 = `scutil --nwi`) | every original check is implemented except original N11 (C-4); `checks.json` records both IDs (SCRIPT_AUDIT §4) | D-2: confirm the mapping |
| C-2 | **Probe targets and accepted errno.** The original N5 used `1.1.1.1`, `2606:4700:4700::1111` and accepted `EHOSTUNREACH`; the brief requires TEST-NET only and `ENETUNREACH` only | the **stricter** brief rule; `EHOSTUNREACH` → BLOCKED | none (stricter) |
| C-3 | **Monitor length.** Original N9 = "continuous during the run"; the brief = exactly 60 s | 60 s here; a test-run monitor must be designed separately later | noted |
| C-4 | **Original N11** (`lsof` on test-Chrome pids) needs a running test Chrome, which this brief forbids, and it would select Chrome processes | not implemented; recorded as `NOT_APPLICABLE` in N11 details; belongs to the test-run phase | noted |
| C-5 | **Internal inconsistency in the original.** N2 says "no default route", but H3 / Q1 say the `utun` IPv6 defaults "must be shown unusable". On this host there are four interface-scoped `utun` defaults (`UGcIg`), and `route get -inet6 2001:db8::1` already says "not in table" while online | scoped `utun` defaults on link-local-only `utun`s, plus "not in table", plus N8 `ENETUNREACH` → **CONDITIONAL PASS**; anything else → BLOCKED/FAIL. If the defaults persist offline (likely), the best possible result is CONDITIONAL PASS | **D-1**: accept the H3 provision, or require their absence (then the result is BLOCKED) |
| C-6 | **DNS.** The brief adds `scutil --dns` inspection. The original N6 says "fails quickly" without a number | N6a = no resolver with a nameserver `Reachable`; N6b = `gaierror` in < 1 s (proposed) | **D-3**: approve the 1 s threshold |
| C-7 | **N9 listener.** The brief: "only if the original requires" | the original N7 requires a loopback echo, so it is kept; 127.0.0.1 only, no `::1` (not required) | none |

## 5. Dependencies (all already on the Mac; nothing installed)

- **Interpreter:** `/usr/bin/python3` (shim) → Xcode Python 3.9.6.
- **Read-only commands:**
  - `/sbin/ifconfig`, `/sbin/route`;
  - `/usr/sbin/scutil`, `/usr/sbin/netstat`, `/usr/sbin/networksetup`;
  - `/usr/bin/sw_vers`, `/usr/bin/uname`, `/usr/bin/id`.
- **User-side check:** `shasum` (the user verifies the script's hash).

The script checks every command at start-up (P0) and stops BLOCKED if one is missing. It never installs anything.
Evidence: `evidence/tool_availability.txt`.

## 6. Offline assumptions

| Assumption | Label |
|---|---|
| The script needs no network, API, Claude Code, Chrome, Playwright or pytest | STATICALLY_CONFIRMED |
| `/usr/bin/python3` works in the test account with no dialog | UNKNOWN (guide A3) |
| The test account can read `/Users/Shared/blatifa-offline/` and write evidence there | UNVERIFIED (standard macOS permissions) |
| Offline output formats match the parsers | UNVERIFIED; a mismatch gives BLOCKED |
| With Wi-Fi off and no cable, macOS returns `ENETUNREACH` immediately for unrouted destinations | UNVERIFIED; expected from the online `route get` "not in table" result for IPv6 |

## 7. Unresolved risks

1. **The parsers have never run.** The selftest is prepared but unauthorized here (D-4).
2. **The `utun` scoped IPv6 defaults** probably persist offline. The result is then capped at CONDITIONAL PASS (D-1).
3. **The 1 s monitor sampling** leaves an exposure window of up to about 1 s.
4. **Bitdefender** Network Extension: UNKNOWN.
5. **The test account's identity and configuration are unknown to Claude.** The script enforces only the name the
   user passes.
6. **Original N11** (test-Chrome sockets) remains open for the test-run phase.
7. **Blatifa Chrome stopped**, cause UNKNOWN (§8).
8. **Disk space** is not checked by the script (evidence is about 100 KB). The free space read 14 GiB at the start
   of this phase.

## 8. Unexpected change observed (recorded, not restored)

- **Observation:** the Blatifa Chrome (CDP `127.0.0.1:50568`) was listening in 5.3g.4.3.1. At the end of this
  phase (11:02 +0700), nothing is listening on that port, and no process with `--remote-debugging-port` exists
  (`evidence/flags_after.txt`; read-only `lsof` and `ps`).
- **This phase did not cause it:**
  - no `kill` or signal;
  - no CDP connection;
  - no `blatifa browser` command;
  - the script was never run.
- **Cause and time:** UNKNOWN. It was not restarted, per the brief.
- **Effect on the offline plan:** none. The script does not use that Chrome. The user should confirm whether it was
  closed on purpose.

## 9. Verdict: **CONDITIONAL PASS**

- **The preparation is complete and defensible:** a self-contained, fail-closed, read-only script; a guide; a static
  audit; and evidence of no side effects.
- **The conditions:**
  - D-1 (the H3 `utun` provision);
  - D-2 (the N-mapping);
  - D-3 (the DNS 1 s threshold);
  - D-4 (authorize `--selftest` before the offline run);
  - the guide A3 interpreter check in the test account.
- **It is not:** a network isolation PASS. It does not authorize disconnecting, running the script offline, or any
  later phase.
