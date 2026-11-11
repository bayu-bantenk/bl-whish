# Phase 5.3g.4.3.1: macOS network isolation options

> **Ringkasan (ID):**
> - **Pemutusan jaringan fisik** (Wi-Fi off, adapter Ethernet dicabut, tethering dicabut) secara arsitektur
>   **cukup**: loopback tetap ada, dan ia menghilangkan semua rute keluar untuk semua proses, termasuk Chrome
>   Helper dan DNS. Tetapi efeknya ke seluruh Mac, dan harus **dibuktikan** saat itu juga. Belum dibuktikan.
> - **macOS Application Firewall** hanya mengatur koneksi **masuk**, jadi tidak bisa dipakai.
> - **PF** bawaan bisa memblokir semua egress kecuali `lo0` dan menyediakan counter. Ini perubahan firewall sistem
>   (butuh root dan otorisasi).
> - **LuLu dan Little Snitch** perlu instalasi. DNS Chrome lewat `mDNSResponder` tidak tertangkap oleh aturan
>   per-aplikasi untuk Chrome. Cakupan untuk proses helper belum terbukti.
> - Tidak ada yang diubah atau dipasang di fase ini.

## 1. Current host state (VERIFIED, read-only, `evidence/host_network_state.txt`)

| Item | State |
|---|---|
| Model | `Mac14,7`, Apple M2, 8 GiB. The brief says "Mac mini M1"; the measured values are used |
| Free disk | 10 GiB at 14:01 (8.8–10 GiB during this session; it fluctuates) |
| Active path | **Wi-Fi `en0`**: the only interface in `scutil --nwi` (IPv4 + DNS, reachable); IPv4 default route via `en0` |
| Ethernet | `en3`, `en4` ("Ethernet Adapter", i.e. USB / dock adapters): **inactive** |
| Thunderbolt | `en1`, `en2`, `bridge0`: inactive |
| Other | `awdl0` (active, AWDL peer-to-peer) and `llw0`: link-local IPv6 only. `utun0`–`utun3`: up, link-local IPv6 and IPv6 default routes (system tunnels). `ap1`, `anpi0/1`: inactive. `gif0`, `stf0`: down |
| IPv6 | `scutil --nwi`: "No IPv6 states found", so there is no global IPv6 connectivity at the moment |
| VPN / PPP | one PPP modem service, disconnected; no proxy (`HTTPEnable 0`, `HTTPSEnable 0`) |
| Application Firewall | enabled; "block all" disabled (`socketfilterfw` query) |
| PF | `/etc/pf.conf` holds only Apple anchors. Runtime state **UNKNOWN** (`pfctl` needs root; not run) |
| Network Extensions | **one active third-party extension: Bitdefender `dci-network-extension`**. It was not inspected; its interaction with tests is UNKNOWN |
| LuLu / Little Snitch | absent |

## 2. Option A: physical network disconnection (Q1)

### 2.1 What would have to be off

- **Wi-Fi (`en0`) off.** AWDL / `llw0` use the Wi-Fi radio; that they go down with Wi-Fi is UNVERIFIED.
- **All Ethernet adapters unplugged** (`en3`, `en4`).
- **No iPhone over USB or Bluetooth.** USB tethering and Bluetooth PAN create new interfaces when connected.
- **Personal Hotspot auto-join** is avoided because Wi-Fi stays off.
- **Thunderbolt bridge:** no Thunderbolt peer.
- **VPN / PPP** stays disconnected.
- The `utun` system tunnels carry no traffic without an underlying path. This is UNVERIFIED and must show in the
  evidence.

The disconnection is a **system network change** (forbidden in this phase). In a future phase the **user** should
do it by hand, so that Claude does not change any network setting.

### 2.2 What stays available

- **Loopback:** `lo0` is independent of physical links (STATICALLY_CONFIRMED by its flags; UNVERIFIED while
  disconnected). CDP, the ControlServer and Playwright use only `127.0.0.1`.
- **DNS:** without a reachable interface, `mDNSResponder` has no resolver, and lookups fail locally. This covers
  `.example.test` and Chrome's own lookups. UNVERIFIED.
- **IPv4/IPv6, child processes, Chrome Helpers:** without a route, no process can send off-host. That covers every
  process, including Chrome Helper, the network service and system daemons. It is structural, not per process.
  UNVERIFIED until shown.

### 2.3 Evidence needed before any test (all read-only, without root)

| # | Evidence | PASS |
|---|---|---|
| N1 | `scutil --nwi` | "No IPv4 states found" **and** "No IPv6 states found" |
| N2 | `netstat -rn -f inet` / `-f inet6` | no `default` route (allowed: `lo0`, link-local `fe80::/64%…`, multicast) |
| N3 | `ifconfig -a` | every non-loopback interface either `status: inactive` or carries link-local IPv6 only; no `inet` other than 127.0.0.1 |
| N4 | `route -n get 192.0.2.1`, `route -n get -inet6 2001:db8::1` | "not in table" / no route |
| N5 | probe (unsandboxed Python, own process): TCP 192.0.2.1:80, TCP 1.1.1.1:443, TCP [2606:4700:4700::1111]:443, UDP 1.1.1.1:53 | `ENETUNREACH` / `EHOSTUNREACH` **immediately** (< 50 ms). A timeout or ECONNREFUSED is a FAIL |
| N6 | `getaddrinfo("example.com")` | fails **quickly** with a "no network" error code |
| N7 | loopback echo: server and client on 127.0.0.1 | body matches |
| N8 | `networksetup -getairportpower en0` | Off |
| N9 | **continuous monitor during the run**: a read-only loop (1 s) over `scutil --nwi` and the default routes | any appearance of a reachable interface → abort the run, record it |
| N10 | child inheritance | a grandchild process gets the same N5 result (structural, but recorded) |
| N11 | Chrome background activity | `lsof -nP -i -a -p <test Chrome pids>` snapshots (own processes; read-only) show only 127.0.0.1 sockets |

**How the attribution works:**
- the "denial" here is **the absence of a route**;
- `ENETUNREACH` in under 50 ms together with N1–N4 is the positive proof;
- a timeout means a packet *was* sent somewhere, so it is a FAIL, not proof;
- a per-packet counter is not available without root (PF, `tcpdump` via `pktap`).

### 2.4 Assessment (Q1)

- **Sufficient for isolation:** yes in principle, if N1–N11 pass. It does not touch Chrome's sandbox at all.
  UNVERIFIED.
- **Side effects:**
  - the whole Mac is offline;
  - the running **Blatifa Chrome** loses its network: its Flow tab may show errors, but no action is taken, and
    nothing is clicked or generated;
  - the Bitdefender extension, iCloud and updates stall.
  
  On reconnection nothing is replayed by Blatifa (no queued live action exists; `LIVE_ACTIONS_ACTIVE=False`).
- **Main weakness:** it depends on the user keeping everything off for the whole run. N9 turns a silent
  reconnection into an abort.

## 3. Option B: application-level firewalls (Q3)

| Question | macOS Application Firewall | PF (built in) | LuLu | Little Snitch 6 |
|---|---|---|---|---|
| Blocks outbound? | **no**, incoming only (Apple docs; UNVERIFIED here) | yes (`block out`) | yes (rules / block mode; UNVERIFIED) | yes (UNVERIFIED) |
| Covers Chrome Helpers / children? | NOT_APPLICABLE | **yes**: packet level, process-agnostic (system-wide) | UNKNOWN: per app; helpers are separate binaries in the bundle; open issue on child-process chaining (objective-see/LuLu#530) | UNKNOWN: rules by path or code identity |
| Localhost kept? | NOT_APPLICABLE | yes with `pass quick on lo0` (UNVERIFIED) | UNKNOWN (NE filters are not documented here for loopback) | UNKNOWN |
| DNS covered? | no | yes: all port-53 packets off-host, including `mDNSResponder` | **not by a Chrome rule**: Chrome on macOS normally resolves through `mDNSResponder`, a system process, so a per-app block on Chrome misses the lookup (STATICALLY reasoned; UNVERIFIED). DoH by Chrome itself would be covered | same gap, unless `mDNSResponder` is blocked too (that is system-wide) |
| Installation | none | none | **yes** + system extension approval | **yes**, paid licence |
| Admin rights | — | **root** (`pfctl`) | yes (extension approval) | yes; CLI needs root and "Allow access via Terminal" |
| Configuration change | — | **system firewall change**: load an anchor, enable with a token (`pfctl -E`), release (`pfctl -X`) | new rules + mode | new rules |
| Independently verifiable? | — | **yes**: `pfctl -a <anchor> -vsr` counters, `pfctl -s References` | partly (rule file / UI) | yes: `littlesnitch export-model` JSON (needs root) |
| Chrome sandbox conflict? | — | none expected: kernel packet filter, no Seatbelt nesting (UNVERIFIED) | none expected: Network Extension, not a process sandbox (UNVERIFIED); may interact with the existing Bitdefender extension (UNKNOWN) | same |
| Verdict | **unusable** | **viable, system-wide**: equivalent to disconnection but with counters; needs explicit authorization for a system firewall change | **not sufficient alone**: DNS gap, unproven helper coverage | **not sufficient alone**, same gaps; also cost |

- "Can block ordinary app traffic" does **not** imply "isolates Chrome". The per-app tools have two unproven links:
  the helper processes, and DNS done by a system daemon on Chrome's behalf.
- PF and physical disconnection avoid both, because they do not depend on process identity.

## 4. Sources

- Apple, firewall settings: <https://support.apple.com/guide/mac-help/change-firewall-preferences-on-mac-mh11783/mac>, <https://support.apple.com/guide/apple-business-essentials/axmd759a1124/web>
- LuLu: <https://objective-see.org/products/lulu.html>, <https://github.com/objective-see/LuLu/issues/530>
- Little Snitch 6 CLI: <https://help.obdev.at/littlesnitch6/cmd-overview>, <https://help.obdev.at/littlesnitch6/cmd-export-model>, rules: <https://help.obdev.at/littlesnitch6/concepts-rules>
- PF on macOS: <https://www.unix.com/man-page/osx/8/pfctl>, <https://github-wiki-see.page/m/shawfdong/hyades/wiki/PF-on-Mac-OS-X>, <https://man.openbsd.org/pf.conf>
