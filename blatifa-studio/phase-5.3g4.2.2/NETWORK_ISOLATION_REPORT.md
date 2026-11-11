# Phase 5.3g.4.2.2: network isolation report

> **Ringkasan (ID):** Sandbox `sandbox-exec` terbukti menolak semua jaringan eksternal (TCP/UDP IPv4/IPv6, LAN,
> DNS) dan tetap mengizinkan loopback, termasuk untuk proses anak. **Namun Chrome tidak bisa berjalan di dalamnya.**
> Sandbox internal Chrome gagal diinisialisasi (`Operation not permitted`), sehingga renderer, GPU dan network
> service crash. Pewarisan isolasi ke Chrome **tidak terbukti**. Status: **BLOCKED**; pytest tidak dijalankan.

## 1. Design

- **Mechanism:** `/usr/bin/sandbox-exec` (SBPL), macOS 26.5 (25F71), arm64. It applies to the whole process tree
  started under it. No system-wide firewall or network setting was changed.
- **Profile** `evidence/isolation.sb`:
  - `(allow default)`, then `(deny network-outbound)`;
  - `(allow network-outbound (remote ip "localhost:*"))`, which means 127.0.0.1 and ::1 only;
  - `(allow network-outbound (remote unix-socket))`;
  - then **deny** on loopback for every port that was listening (TCP) or bound (UDP) when the profile was
    generated (21 ports). These include **50568, the CDP port of the running Blatifa Chrome**, plus postgres,
    rabbitmq, dbeaver, `[::1]:7679`, 53 and 853;
  - and **deny** of the `mDNSResponder` unix socket, which blocks the system resolver.
- **Pre-checks** (`evidence/environment_before.txt`):
  - no system proxy (`scutil --proxy`: HTTP/HTTPS disabled, no PAC);
  - no `*_proxy` variables;
  - the DNS resolver is `192.168.1.2` (LAN, not loopback);
  - `BLATIFA_LIVE`, `BLATIFA_CHROME` and `BLATIFA_WORKSPACE` unset.

## 2. Verification results (`evidence/isolation_verification.{txt,json}`, `evidence/dns_attribution.txt`)

| # | Check | Result | Attribution |
|---|---|---|---|
| 4.1 | Loopback echo to a new port (sandboxed child → server outside) | **CONNECTED, "pong"** | — |
| 4.1 | Loopback to a port with a deny rule (our own listener B) | **EPERM** | the same listener answers outside the sandbox → the per-port deny works. The real 50568 was **not** probed, on purpose |
| 4.2 | TCP 192.0.2.1:80 (TEST-NET, no host) | **EPERM**, 0 ms | outside the sandbox the same target gives ECONNREFUSED after 11 ms → EPERM comes from the sandbox, not from the network |
| 4.2 | TCP 1.1.1.1:443, TCP [2606:4700:4700::1111]:443, TCP LAN 192.168.1.2:53 | **EPERM** (all) | immediate EPERM, the sandbox signature |
| 4.2 | UDP 1.1.1.1:53, UDP 192.168.1.2:53, UDP 127.0.0.1:53 | **EPERM** (all) | sandbox |
| 4.2 | DNS `getaddrinfo("example.com")` | **fails** (EAI_NONAME, 2 ms) | A/B on the same profile: the mDNSResponder socket gives EPERM; without that rule the socket connects and the name resolves. This control made **one** DNS query for example.com through the system daemon |
| 4.3 | Child process of the sandboxed Python: TCP 1.1.1.1:443 / loopback echo | **EPERM** / **CONNECTED** | inheritance works for ordinary children |
| 4.3 | **Chrome launched exactly like the fixture** (`BrowserEngine(Settings(workspace=<tmp>), "test", headless=True)`) | **FAILED**: `BrowserContext.new_page: Target crashed` | `evidence/chrome_diag_inside.json`: Chrome log `sandbox initialization failed: Operation not permitted`, `aperitif: Failed to initialize sandbox`, `Network service crashed`, `GPU process exited unexpectedly`. The control outside the sandbox (start, attach, about:blank, loopback) works: `evidence/chrome_diag_outside.json` |

## 3. Why it is blocked

Chrome on macOS starts its renderer, GPU and network-service processes inside its own Seatbelt sandbox
(`sandbox_init`). A process that is already confined by `sandbox-exec` may not initialise a further sandbox, so
these processes die and no page can be opened. The only known way to run Chrome under `sandbox-exec` would be
`--no-sandbox` or something similar. That needs a change to the launch arguments (code or configuration), and it
weakens Chrome's own process isolation. Both are outside this authorization: "Do not try a weaker isolation
mechanism without a new user decision".

## 4. Limitations of the mechanism itself (even if Chrome could run)

- **System daemons are outside the boundary.** Work done by system daemons through Mach/XPC (e.g. `trustd`) is not
  covered. The resolver path through mDNSResponder is covered by the explicit socket rule.
- **No violation log.** macOS did not log any sandbox violation for `sandbox-exec` here: `(debug deny)` produced no
  entries, and `(with report)` is not allowed on deny rules. Attribution therefore rests on errno EPERM and A/B
  controls.
- **The port list is a snapshot.** A service that starts listening on loopback after the profile was generated would
  be reachable.

## 5. Side effect found (see SAFETY_AUDIT §2)

The crashing test Chrome wrote **47 crash dumps** and updated `settings.dat` in the **personal** Chrome Crashpad
database (`~/Library/Application Support/Google/Chrome/Crashpad/`), although it ran with a temporary
`--user-data-dir`. The evidence is `evidence/crashpad_side_effect.txt`: names, times and sizes only.
