# Phase 5.3g.4.3: network isolation architecture

> **Ringkasan (ID):**
> - **Rekomendasi: Kandidat A**, guest tanpa perangkat jaringan sama sekali. Semua komunikasi (pytest, Playwright,
>   CDP, server fixture, UI kontrol) berjalan di **loopback di dalam guest**. Guest tidak butuh akses ke host.
> - Lapisan kedua di dalam guest: nftables *deny-all* dengan counter. Gunanya untuk atribusi, bukan pengganti
>   lapisan pertama.
> - Data masuk lewat image disk **read-only**. Hasil keluar lewat log serial satu arah ke file, ditambah disk output
>   kecil yang dibaca host setelah VM mati.
> - Kandidat B (jaringan privat) didokumentasikan, tetapi **tidak direkomendasikan**: tidak ada kebutuhan
>   guest↔host yang membenarkannya.

## 1. Why the communication can stay inside the guest (from the code)

- `chrome.launch` binds CDP to `127.0.0.1:<free_port()>` (`src/blatifa/browser/chrome.py:22,72-75,84-85`), and
  `attach()` uses `connect_over_cdp` to that port.
- Fixtures are `file://` pages. `test_control_ui` starts the ControlServer on `127.0.0.1`.
- The Playwright driver is a local child process (pipe).
- **Nothing in the 43 tests needs a peer outside the machine they run on.** If pytest runs in the guest, every flow
  is guest loopback.

## 2. Candidate A: fully disconnected guest (recommended)

```
 HOST (macOS 26.5)                                   GUEST (Debian 13 arm64, own kernel)
 ┌────────────────────────────────────┐             ┌───────────────────────────────────────────┐
 │ UTM/QEMU process                   │             │  lo 127.0.0.1 / ::1   (only interface)    │
 │  devices: cpu, ram, virtio-blk x3, │             │   ├─ pytest ─ Playwright driver (pipe)    │
 │  serial → file, NO NIC, NO vsock,  │             │   ├─ Chrome  CDP 127.0.0.1:<random>       │
 │  NO shares, NO spice agent, NO USB │             │   ├─ ControlServer 127.0.0.1:<random>     │
 │                                    │   disk RO   │   └─ file:// fixtures                     │
 │  input.iso  (staged copy) ─────────┼────────────►│  /mnt/in   (read-only)                    │
 │  output.img (empty, small) ◄───────┼─────────────│  /mnt/out  (results, junit, logs)         │
 │  serial.log ◄──────────────────────┼─ one-way ───│  ttyAMA0 / hvc0 console                   │
 │                                    │             │  nftables: output policy drop, counters   │
 └────────────────────────────────────┘             └───────────────────────────────────────────┘
        no route exists from GUEST to HOST, LAN or Internet: there is no network device
```

**Enforcement layers**

| Layer | Mechanism | Who can undo it |
|---|---|---|
| L1 (primary) | the VM definition has **no network device**: QEMU `-nodefaults` plus an explicit device list without `-nic` / `-netdev`, or the UTM device removed. There is no vsock, no virtio-serial agent, no SPICE channels, no VirtFS/virtio-fs/WebDAV share, no USB redirection, and no guest agent | only the host (VM config). The guest kernel cannot create hardware |
| L2 (defence in depth) | guest nftables: `output` policy drop; accept only `oif lo` except UDP/TCP port 53; counters on every rule; IPv4 and IPv6 (`inet` family) | root in the guest. Accepted, because L1 does not depend on it |
| L3 | guest without a resolver: `/etc/resolv.conf` without nameserver, `systemd-resolved` absent or disabled, no `/etc/hosts` entries besides localhost | root in the guest |
| L4 | host side: the VM process gets no network device, so no host firewall change is needed. **No host system setting is changed** | — |

**Data paths**

- **In:** an ISO built on the host from an **explicit file list** (staged copy: `src/`, `tests/`, `pyproject.toml`,
  `uv.lock`, the one fixture media file `docs/phase-0/evidence/media/E-FLOW-test_720p.mp4`, an offline wheelhouse).
  It is attached read-only. No home directory and no `p53g.db`.
- **Out:**
  - the serial console is written to a file on the host (one-way text; the host treats it as untrusted data);
  - a small raw output disk (e.g. 64 MiB, FAT) that the guest writes. The host attaches it **only after the VM is
    off**, read-only (`hdiutil attach -readonly`).

**Limitations of A**

- No SSH; operation is via the serial console or an unattended start script on the input ISO.
- Provisioning (OS, Chrome .deb, ffmpeg) needs packages. See IMPLEMENTATION_PLAN Stage 2/3:
  - **P1:** offline media and packages prepared on the host;
  - **P2:** a separate provisioning boot with a temporary NIC, **before** any project file enters, and with Chrome
    never launched while networked; the NIC is then removed and the definition re-hashed.
- With no interface, an external connect fails with `ENETUNREACH` (route lookup) before netfilter sees the packet.
  The L2 attribution therefore uses a test-only dummy interface (§5).

## 3. Candidate B: guest-only isolated network (not recommended)

```
 HOST                                   GUEST
 QEMU -netdev user,restrict=on ──────── eth0 10.0.2.15  (no default route configured, no DNS)
   (slirp: guest cannot reach host or Internet; optional host→guest port forward only)
```

| Property | Design |
|---|---|
| Default route | none (static address, no gateway) |
| DNS | none (no nameserver; slirp DNS is unreachable under `restrict=on` (V, secondhand)) |
| NAT / bridged / vmnet host-only | **not used**. UTM "Host Only" and "Shared" let the guest reach the host (V: UTM docs) and are rejected |
| Guest → host | **none**. `restrict=on` isolates the guest from the host and the outer network (V, secondhand quote) |
| Host → guest | optional single `hostfwd=tcp:127.0.0.1:<p>-:22` for result collection |
| Guest firewall | same nftables as A, with `eth0` input/output dropped except the one forwarded port |

- **Is guest-to-host communication necessary?** **No.** pytest, Chrome and the fixtures all run in the guest, and
  results leave by serial or output disk. B only adds attack surface: slirp's TCP/IP stack in the host process, and
  the forwarded port.
- B would only be justified if the runner had to stay on the host and drive a guest Chrome over CDP. That would
  expose CDP across the VM boundary, so it is **rejected**.

## 4. Allowed and denied traffic (A)

| Flow | Policy |
|---|---|
| guest `lo` 127.0.0.1 / ::1, any port except 53 | **allow** (CDP, ControlServer, Playwright) |
| guest `lo` port 53 (UDP/TCP) | **deny** with a counter (shows DNS attempts) |
| any non-`lo` IPv4 / IPv6, TCP / UDP / ICMP | **impossible** (no device); L2 drop with a counter |
| guest → host (IP, vsock, shares, clipboard, USB, agent) | **impossible** (no channel) |
| guest → serial console | allowed, one-way text to a host file |
| guest ↔ disks | input read-only; output read/write, a dedicated empty image |

## 5. Verification requirements (all must PASS before any test run)

Each check records command, output, errno and timing. A/B controls separate *policy denial* from *unreachable*,
*timeout* and *DNS failure*.

| # | Requirement | Positive evidence | Attribution |
|---|---|---|---|
| V1 | Loopback fixture | guest-local HTTP echo on `127.0.0.1:<p>` returns the expected body | — |
| V2 | CDP | the fixture's Chrome answers `GET http://127.0.0.1:<port>/json/version` | — |
| V3 | External IPv4 blocked | (a) host: VM definition dump shows no NIC; QEMU monitor `info network` empty, `info pci` without a network class. (b) guest: `/sys/class/net` = `{lo}`, `ip -4 route` empty, `connect(192.0.2.1:80)` → `ENETUNREACH` in < 5 ms | **L1:** structural (hardware absent), cross-checked from host and guest |
| V3b | L2 policy works | create `dummy0` with a default route (test only, no hardware). **Without** the nft rule, `connect(192.0.2.1:80)` → SYN sent into dummy0 → timeout. **With** the rule → `EPERM` immediately and the drop counter +1. Then remove dummy0 | proves the nft layer is a real policy denial, not unreachability |
| V4 | IPv6 | as V3/V3b with `2001:db8::1` and `2606:4700:4700::1111`; `ip -6 route` empty except `lo` | same |
| V5 | DNS | `getaddrinfo("example.com")` fails; `resolv.conf` has no nameserver; the counter on `lo:53` shows the attempt (Chrome / glibc fallback to 127.0.0.1:53) | counter, not just the failure |
| V6 | UDP | `sendto(1.1.1.1:53)` → `ENETUNREACH`; with dummy0 → `EPERM` and counter | same |
| V7 | LAN | `connect(192.168.1.2:53)` (the host LAN resolver) → `ENETUNREACH`; no route | L1 |
| V8 | Guest → host | no host-visible channel: device inventory (`info qtree`) lists only cpu, memory, virtio-blk ×3, serial, rng (optional). No vsock CID, no virtio-serial port, no 9p/virtiofs tag | inventory |
| V9 | Chrome background networking | run the fixture's Chrome (headless, temp profile) idle for 120 s on `about:blank`: all non-`lo` counters stay 0 (no route), `lo:53` counter may rise; Chrome's NetLog (if enabled by a guest-only policy) shows only failures. **No Chrome flag change** | counters + no device |
| V10 | Child inheritance | a grandchild process (Python → shell → curl) gets the same `ENETUNREACH` | structural: applies to every guest process |

**Failure conditions (any of them → BLOCKED, no test run):**
- a network device, vsock, share, clipboard agent or USB device is present;
- any route other than `lo` exists outside the V3b test window;
- any external connect succeeds, times out (outside V3b's "without rule" step), or returns `ECONNREFUSED` from a
  non-loopback address;
- V3b does not show `EPERM` plus a counter increment;
- the evidence is incomplete, or two runs disagree.

## 6. DNS and IPv6 controls

- **DNS:**
  - no resolver configuration;
  - nftables denies loopback port 53 (so a local stub cannot be added silently);
  - the `.example.test` hosts (B-2) fail locally;
  - Chrome's built-in DNS client finds no nameserver.
- **IPv6:**
  - the `inet` family table covers both IPv4 and IPv6;
  - with no device there are no IPv6 router advertisements;
  - `net.ipv6.conf.all.disable_ipv6` is **not** used, because `::1` stays available for local services.
