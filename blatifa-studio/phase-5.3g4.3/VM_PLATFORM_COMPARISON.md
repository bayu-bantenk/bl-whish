# Phase 5.3g.4.3: VM platform comparison

> **Ringkasan (ID):**
> - **Rekomendasi:** UTM (gratis, open source) dengan **backend QEMU + HVF** dan guest **Linux ARM64 (Debian 13)**,
>   memakai Google Chrome resmi untuk Linux ARM64. Alternatif yang setara: QEMU langsung (CLI), atau VMware Fusion
>   (gratis, Linux saja).
> - **Guest macOS** paling setia ke kode (path Chrome macOS di-hardcode), tetapi **tidak layak di host ini**: RAM
>   8 GiB, ruang disk kosong 9,9 GiB.
> - Semua klaim dari riset web berasal dari kutipan hasil pencarian, bukan halaman yang dibaca utuh. Semuanya harus
>   diverifikasi ulang di Stage 1.

## 1. Host facts (verified locally, `evidence/host_capabilities.txt`)

| Item | Value |
|---|---|
| Machine | Apple M2, 8 cores (4 performance + 4 efficiency), **8 GiB RAM** |
| OS | macOS 26.5 (25F71), arm64 |
| Free disk | **9.9 GiB** (`df /`). The project rule says no full regression below 10 GiB and stop below 5 GiB |
| Memory | 35–40 % free (`memory_pressure -Q`), with the Blatifa Chrome running |
| Installed virtualization | none (UTM, Parallels, VMware Fusion, OrbStack, tart, lima, qemu, vfkit, `container` absent). Docker.app is present; it was not started |
| Host Chrome | 157.0.8103.40 (from `Info.plist`, not launched) |

## 2. Fact grades

- **L**: verified locally in this phase.
- **V**: vendor or upstream documentation, seen as a search excerpt; re-read the full page in Stage 1.
- **S**: secondary source (news, forum, mirror).
- **A**: assumption, not verified.

## 3. A codebase fact that decides the guest OS (L)

- `src/blatifa/config.py:11` hard-codes
  `DEFAULT_CHROME = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")`.
- Both browser fixtures (`tests/browser/conftest.py`, `test_engine_recovery.fresh_engine`) call
  `pytest.skip("Google Chrome is not installed")` when that **exact path** does not exist. `BLATIFA_CHROME` would
  change the launched binary, but not that check.
- **Consequence:** on a Linux guest, all 43 tests would be **skipped**, not run, unless one of these happens:
  - **G-1:** a file exists at that macOS path inside the guest (a guest-only symlink to the Linux Chrome binary);
  - **G-2:** a code change (outside this phase; the brief forbids changes made only to bypass isolation).
- `PERSONAL_CHROME_DIR` (`config.py:13`) is also a macOS path. On Linux, `assert_profile_allowed` would guard a path
  that does not exist. The guest has no personal data, but the guard would not be the one that protects anything.
- `flow_video_props.html` plays `docs/phase-0/evidence/media/E-FLOW-test_720p.mp4`, which is **H.264 High + AAC**
  (ffprobe). This needs **Google Chrome**: open-source Chromium builds, including Playwright's, usually lack
  proprietary codecs (A). The project only uses `connect_over_cdp`, so no Playwright browser download is needed.

This is open question **Q-1** (see TEST_REPORT).

## 4. Platform comparison

| Criterion | UTM (QEMU backend) | UTM (Apple Virtualization backend) | QEMU (CLI, Homebrew) | Parallels Desktop | VMware Fusion Pro | Tart | Docker Desktop (present) |
|---|---|---|---|---|---|---|---|
| Apple Silicon | yes, HVF for arm64 guests (S) | yes (V) | yes, `-accel hvf` (A) | yes (V) | yes, Arm guests only (V: Broadcom KB 315602) | yes, VZ-based (S) | yes |
| Guest OS | Linux arm64, Windows arm64 | macOS, Linux | Linux arm64 | macOS, Linux, Windows arm64 (V) | Linux / Windows **arm64; no macOS guest** (V) | macOS, Linux | Linux containers in a shared VM |
| Chrome arm64 in guest | Google Chrome Linux ARM64 .deb (S: announced 03/2026, later shipped) | macOS guest: same Chrome as host | as UTM QEMU | both | Linux | both | Linux |
| Chrome native sandbox | Linux: userns + seccomp-bpf, own kernel (V: Chromium docs). **Not verified here** | macOS guest: Seatbelt in the guest kernel, not nested (A) | as UTM QEMU | as guest OS | as Linux | as guest OS | **default container seccomp profile blocks user namespaces**; Chrome usually needs `--no-sandbox` or a relaxed profile (A). **Rejected** |
| No network device | remove the device (A: UI); QEMU supports `-nic none` (V) | VZ allows a config with no network device (A: the API is a list) | `-nodefaults -nic none` (V), with every device explicit | VM settings: remove the adapter (A) | remove the adapter (A) | no "none" flag found; softnet restricts (S) | `--network none` (A) |
| Host-only modes | "Host Only" = shared without WAN, guest **can reach the host** (V: UTM docs); "Isolate Guest from Host" option exists (V) | Shared / Bridged (S) | `-netdev user,restrict=on` (V, secondhand quote) | Host-only (A) | Host-only (A) | softnet (S) | bridge networks |
| Shared folders / clipboard | SPICE agent, VirtFS/WebDAV: all removable (A) | VirtioFS, clipboard via guest tools (A) | only what you add | Parallels Tools: shared folders, clipboard on by default (A) | VMware Tools (A) | `--dir` mounts (S) | bind mounts |
| Snapshots / reset | QEMU VMs: snapshots on macOS 26 (S: UTM 5.0.6 notes); qcow2 overlay files (A) | **Apple VM snapshots need macOS 27** (S); file clone instead | qcow2 overlay (`-snapshot` or backing file) (A) | snapshots for macOS VMs since PD 20 (V: KB 128867) | yes (A) | APFS clone (`tart clone`) (S) | images |
| Cost / licence | free, Apache-2.0 (A); paid App Store build is the same app (A) | same | free, GPL | **$99.99–119.99 / year**; CLI `prlctl` only in Pro/Business (V/S) | **free** for all use since 11/2024 (V: Broadcom KB 368667), no support tickets | Fair Source 0.9 or FSL-1.1 (conflicting sources, S) | Docker subscription rules (A) |
| Automation | `utmctl` (A), config.plist | same | one command line = the whole VM definition | `prlctl` (Pro) | `vmrun` (A) | CLI | CLI |
| Auditability | config.plist, QEMU log of the arguments (A) | config.plist | **best**: the full device list is an exact command line; `info qtree` / `info pci` in the monitor | proprietary `.pvm` config | `.vmx` text file | JSON config | engine config |
| Install footprint | app ≈ 0.5 GB (A) | same | Homebrew qemu + deps ≈ 1 GB (A) | ≈ 1 GB (A) | ≈ 1 GB (A) | small | already installed |

## 5. Guest OS options

| Guest | Fit | RAM | Disk | Notes |
|---|---|---|---|---|
| **macOS 26 (VZ)** | best fidelity: same paths, same Chrome build, no shim | ≥ 4 GiB realistically (A) | IPSW ≈ 15–19 GB plus VM disk ≈ 30–40 GB (A) | licence: up to 2 extra macOS instances per Mac for development and testing (V: Apple SLA via secondary); VZ enforces the limit (S). **Not feasible now**: disk and RAM |
| **Debian 13 arm64** | good; needs the Q-1 decision | 2–3 GiB | 10–12 GiB virtual, ≈ 4–6 GiB used (A) | unprivileged user namespaces enabled by default (A), so Chrome's namespace sandbox should start without AppArmor work; Chrome .deb also ships the SUID `chrome-sandbox` (A) |
| Ubuntu 24.04 arm64 | possible | same | same | AppArmor restricts unprivileged user namespaces (V: Chromium doc, Ubuntu discourse). Chrome needs its AppArmor profile; disabling the restriction globally is a **weakening** and is rejected |

## 6. Recommendation

- **Platform:** UTM with the **QEMU backend (HVF)**. It is free and supports snapshots on macOS 26 for QEMU VMs, and
  all channels (NIC, SPICE agent, shares, USB) can be removed. **Equivalent and more auditable:** plain QEMU from
  the command line, with `-nodefaults` and an explicit device list.
- **Guest:** Debian 13 arm64, headless (no desktop), with Google Chrome for Linux ARM64, `ffmpeg`, and Python 3.12
  via uv. Debian's packaged Python is 3.13, and the project requires `<3.13`.
- **Alternatives:**
  - VMware Fusion Pro: free, Linux guests, `.vmx` config readable as text.
  - Parallels Desktop only if the cost is accepted. Its tools integration is on by default and must be stripped.
- **Rejected:**
  - Docker / containers, because Chrome's sandbox normally needs a relaxed seccomp profile or `--no-sandbox`;
  - Apple `container` (not installed, and its sandbox behaviour is unknown);
  - Ubuntu with the global userns restriction turned off;
  - a macOS guest on this host (resources).
- **Choose the platform only at Stage 1** of IMPLEMENTATION_PLAN, after re-reading the cited pages in full and
  after the user decides Q-1 (guest path shim, code change, or a host with room for a macOS guest).

## 7. Sources

- UTM network modes: <https://docs.getutm.app/settings-qemu/devices/network/network> (V)
- UTM 5.0.6 release notes (snapshots; Apple VMs need macOS 27): <https://newreleases.io/project/github/utmapp/UTM/release/v5.0.6> (S, mirror of the GitHub release)
- UTM v3.0.0 notes (QEMU recommended over the Apple backend): <https://newreleases.io/project/github/utmapp/UTM/release/v3.0.0> (S)
- QEMU network emulation: <https://qemu.readthedocs.io/en/v10.0.3/system/devices/net.html>; `-nic` option: <https://www.qemu.org/2018/05/31/nic-parameter/> (V)
- Parallels macOS-VM limitations: <https://kb.parallels.com/128867> (V); CLI is Pro/Business: <https://docs.parallels.com/landing/parallels-desktop-developers-guide/command-line-interface-utility> (V)
- VMware Fusion on Apple silicon, Arm guests: <https://knowledge.broadcom.com/external/article/315602> (V); free licence: <https://knowledge.broadcom.com/external/article/368667> (V)
- Tart licence: <https://www.github.com/cirruslabs/tart/blob/main/LICENSE> (V, but its current state conflicts with secondary sources); softnet: <https://github.com/cirruslabs/softnet/blob/main/README.md>
- Apple Virtualization: <https://developer.apple.com/documentation/virtualization/vznetworkdevice>, <https://developer.apple.com/documentation/virtualization/running-macos-in-a-virtual-machine-on-apple-silicon> (V)
- macOS VM licence limit: <https://developer.apple.com/forums/thread/826102> (S); licence texts: <https://www.apple.com/legal/sla/> (V, not read)
- Chrome for ARM64 Linux: <https://www.theregister.com/2026/03/13/google_announces_chrome_for_arm64/>, <https://linuxiac.com/?p=216911> (S)
- Chromium Linux sandbox: <https://chromium.googlesource.com/chromium/src/+/main/docs/linux/sandboxing.md> (V)
- AppArmor userns restriction: <https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md> (V), <https://discourse.ubuntu.com/t/understanding-apparmor-user-namespace-restriction/58007> (V)
- Apple `container`: <https://www.infoq.com/news/2025/06/apple-container-linux> (S)
