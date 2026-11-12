# Phase 5.3g.4.3.2 offline readiness: script audit

> **Ringkasan (ID):**
> - Review statis untuk `script/n_isolation_check.py` (SHA-256 `d6ec5c21…5eff`, 1280 baris, Python stdlib saja).
> - Skrip **belum pernah dijalankan**, termasuk `--selftest`. Satu-satunya pemeriksaan yang dilakukan adalah
>   `compile()` tanpa eksekusi.
> - Tidak ditemukan dependensi online, perintah privileged, perintah yang mengubah sistem, maupun jalur ke Chrome.
> - Risiko utamanya: format output macOS saat offline belum pernah diamati. Kalau formatnya berbeda, hasilnya
>   **BLOCKED** (aman), bukan PASS palsu.

Full hash: `d6ec5c215d0d101ab5bde857e049e075def0bdd4f33e3e2fab17924e31245eff`. Raw audit output:
`evidence/static_audit.txt`.

## 1. Static review findings

| # | Finding | Result |
|---|---|---|
| S1 | Syntax: `compile()` under `/usr/bin/python3 -I -B` (3.9.6). Not executed, no bytecode written | OK |
| S2 | Imports: `argparse datetime errno hashlib ipaddress json os platform pwd re socket subprocess sys time traceback`. All standard library | OK |
| S3 | Python 3.9 compatible (no `match`, no `X \| Y` types, no 3.10+ API) | OK by inspection |
| S4 | Bug found during review and fixed before the hash was taken: `parse_nwi` used `\s*` after `Network interfaces:`, which could swallow the next line. Now `[ \t]*` | fixed |
| S5 | `--selftest` (31 fixture cases) exists but was **not executed** (outside this phase's authorization) | NOT RUN |
| S6 | Masking regex: a MAC-like pattern can over-mask a fully expanded IPv6 address **in the saved raw text only**. Classification uses the unmasked text in memory | cosmetic |

## 2. Safety review

| Property | How it is enforced | Label |
|---|---|---|
| Only read-only commands | `ALLOWED_COMMANDS` allow-list (13 fixed argv lists) plus `networksetup -getairportpower <enN>` (device name regex-checked). `run_cmd` refuses any other key. Absolute paths, `shell=False`, `stdin=/dev/null`, minimal env | STATICALLY_CONFIRMED |
| No privileges | refuses `euid == 0`; no `sudo` anywhere; every command used works as a standard user (`pfctl` deliberately absent) | STATICALLY_CONFIRMED |
| No system change | no `-set*` networksetup verb, no `route add/delete/change`, no `ifconfig … down/up`, no `pfctl`, no `socketfilterfw`, no DNS write | STATICALLY_CONFIRMED (grep) |
| No Chrome / CDP / browser | no process enumeration (`ps`, `pgrep`, `lsof`), no `kill`, no signal, no port 9222/50568, no HTTP client. The only sockets: one probe per call to documentation addresses, and one loopback pair on an ephemeral port that the script itself bound | STATICALLY_CONFIRMED |
| Listener | `bind(("127.0.0.1", 0))` only; checks the bound host; closed in `finally`. No `0.0.0.0`, `::` or `::1` bind (`0.0.0.0` appears only in the masking keep-list) | STATICALLY_CONFIRMED |
| Probes | numeric `192.0.2.1`, `198.51.100.1`, `2001:db8::1`; non-blocking `connect_ex`, socket closed immediately; one attempt; no retry loop. UDP uses `connect` only (route lookup); **nothing is sent** | STATICALLY_CONFIRMED |
| No packet while a path exists | active probes run only after every passive check (N1–N5, N6a, N10a) is PASS or CONDITIONAL. If a route does exist, a TCP SYN can leave once to a TEST-NET address (non-routable by definition); the result is FAIL | STATICALLY_CONFIRMED |
| DNS lookup | `getaddrinfo("example.com")` runs last, in a sub-process with a 15 s kill timeout, only after N3/N4/N5/N7/N8 passed. It is corroboration only | STATICALLY_CONFIRMED |
| Fail closed | an unknown output becomes BLOCKED; a command error or timeout becomes BLOCKED; an unexpected exception becomes BLOCKED (traceback saved, masked); a missing mandatory check becomes BLOCKED; FAIL stops at once | STATICALLY_CONFIRMED |
| No runtime relaxation | thresholds, monitor length and targets are module constants; the only CLI options are `--expected-user` and `--out` | STATICALLY_CONFIRMED |
| Test account gate | `--expected-user` is required. It must equal `pwd.getpwuid(getuid())`, `$USER` and `$LOGNAME`; otherwise BLOCKED. The name is never guessed | STATICALLY_CONFIRMED |
| `BLATIFA_LIVE` | any value set → BLOCKED (stricter than "not 1") | STATICALLY_CONFIRMED |
| Evidence | written only under `--out`, which must be **new** (never overwritten); `run.log`, `checks.json` and `monitor.jsonl` are fsync'ed per line; `SHA256SUMS` at the end | STATICALLY_CONFIRMED |
| Personal data | reads no file except itself; no home, profile, Crashpad, cookie or keychain path appears in the code | STATICALLY_CONFIRMED (grep: no `Library/`, no `Crashpad`) |

## 3. Offline dependency review (§7 of the brief)

| # | Requirement | Result |
|---|---|---|
| 1 | No external URL | YES (no `http` string) |
| 2 | No package installation | YES (stdlib only) |
| 3 | No external documentation fetched | YES |
| 4 | No remote shell script | YES |
| 5 | No DNS for external probes | YES (numeric addresses) |
| 6 | No API / Claude Code call | YES |
| 7 | No browser or Flow component | YES |
| 8 | No privileged command | YES |
| 9 | No network configuration modified | YES |
| 10 | All output paths local | YES (`--out` on the local disk) |
| 11 | Fail-closed error handling | YES (§2) |
| 12 | Monitoring stops after 60 s | YES: 60 samples at `start + i`; the loop sleeps to `start + 60` and ends; a late sample (≥ 1 s) is BLOCKED |
| 13 | No silent suppression of failed checks | YES: every check is recorded, and a missing ID makes N11 BLOCKED |
| 14 | Cannot select or control a Chrome process | YES (no process enumeration or signalling at all) |
| — | Interpreter availability in the **test account** | **UNKNOWN**: `/usr/bin/python3` is a shim to Xcode's Python 3.9.6. The Xcode licence and first-run state for another account are not verified (guide step 3) |

## 4. N1–N11 coverage matrix

Brief IDs are used. The original 5.3g.4.3.1 IDs are in the second column (see OFFLINE_READINESS_REPORT §4 for the conflicts).

| Brief | Original | Implementation | PASS criterion | Readiness |
|---|---|---|---|---|
| N1 physical interfaces | N3 | `ifconfig -a` | every non-`lo0` interface: no IPv4, IPv6 link-local only. Routable IPv4 or non-link-local IPv6 → FAIL; link-local IPv4 → BLOCKED | Prepared |
| N2 VPN / tunnels | (N3 utun) | `scutil --nc list`; `utun/ipsec/ppp/gif/stf/tun/tap` addresses | no service `Connected` (→ FAIL), none `Connecting/Disconnecting` (→ BLOCKED); tunnels link-local only | Prepared |
| N3 reachability | N1 | `scutil --nwi` | "No IPv4 states found" and "No IPv6 states found" and no interface listed; else FAIL; unrecognised → BLOCKED | Prepared |
| N4 IPv4 default | N2 (inet), N4 (v4) | `netstat -rn -f inet`; `route -n get 192.0.2.1` | no default row and "not in table" | Prepared |
| N5 IPv6 default | N2 (inet6), N4 (v6), H3 | `netstat -rn -f inet6`; `route -n get -inet6 2001:db8::1` | no default row and "not in table" → PASS. Only interface-scoped `utun` defaults with a link-local gateway on link-local-only `utun`s, plus "not in table" → **CONDITIONAL PASS** (H3 provision, decision D-1). Unscoped default → FAIL | Prepared (D-1 pending) |
| N6 DNS | N6 + new | (a) `scutil --dns`: no resolver with a nameserver is `Reachable`; (b) `getaddrinfo("example.com")` fails with `gaierror` in < 1 s | (a) and (b); never sufficient on its own | Partially prepared: the 1 s threshold is a proposal (D-3) |
| N7 IPv4 TCP | N5 (v4) | TCP 192.0.2.1:80, 198.51.100.1:443; UDP connect 192.0.2.1:53 | each `ENETUNREACH` in < 50 ms; `EINPROGRESS`, success or `ECONNREFUSED` → FAIL; anything else, or slow → BLOCKED | Prepared |
| N8 IPv6 TCP | N5 (v6) | TCP [2001:db8::1]:80; UDP connect [2001:db8::1]:53 | same; socket creation error → BLOCKED with the exact reason | Prepared |
| N9 localhost listener | N7 | 127.0.0.1:0 listener, echo of a random nonce | body matches, peer 127.0.0.1 | Prepared |
| N10 alternative paths | N8, N10 | (a) hardware ports, `ifconfig -l` vs `-a`, Wi-Fi power; (b) grandchild process probe | (a) Wi-Fi power **Off** (On → BLOCKED); no active port with an address; (b) grandchild `ENETUNREACH` < 50 ms with a correct ppid | Prepared |
| Monitor | N9 | 60 × 1 s: `scutil --nwi`, both default-route sets, `ifconfig -l`, one IPv4 probe | no change against sample 1; any new unscoped default or reachability → FAIL abort; other changes, command errors or lateness → BLOCKED abort; samples written before abort are kept | Prepared |
| N11 verdict | — | `consolidate()` | PASS only if all 14 mandatory records (P0, N1–N5, N6a, N6b, N7–N9, N10a, N10b, MON) are PASS; CONDITIONAL only if N5 is the only conditional one; otherwise the worst result | Prepared |
| — | N11 (test Chrome `lsof`) | **not implemented**: it needs a running test Chrome, which this phase forbids | — | NOT_APPLICABLE here (belongs to the test-run phase) |

## 5. Known limitations

1. **Offline output formats are not observed.** In particular: whether `scutil --nwi` lists an empty `Network
   interfaces:` line, whether the `utun` scoped defaults persist, and whether AWDL goes down with Wi-Fi. A mismatch
   gives BLOCKED.
2. **Selftest not run.** The parsers have never executed. This can only cause a false BLOCKED or a crash (which is
   also BLOCKED), not a PASS without evidence, because each PASS needs explicit positive strings or errno values.
3. **Exposure window:** the monitor samples once per second, so a reconnection could last up to about 1 s before it
   is detected.
4. **No packet counter.** The proof is the absence of a route plus a fast `ENETUNREACH`; nothing counts packets
   (that needs root).
5. **Bitdefender** network extension: behaviour UNKNOWN; not inspected.
6. `example.com` lookup: it is a real resolver call. It runs only after five route and probe checks have shown no
   path.
7. The script attests only to the 60-second window. Isolation during a later test run needs its own monitor (C-3).
