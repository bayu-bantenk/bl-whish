# Phase 5.3g.4.3: threat model

> **Ringkasan (ID):** Ancaman utama dan kontrolnya. Risiko sisa yang tidak bisa dihilangkan:
> - celah hypervisor;
> - provisioning yang butuh unduhan;
> - Chrome di guest Linux tidak identik dengan Chrome macOS produksi;
> - perlunya keputusan Q-1 (path Chrome);
> - disk host yang hampir penuh.

## 1. Assets

- The user's personal Chrome data, including the Crashpad dumps that were kept.
- The Blatifa Chrome profile, its session, and CDP 127.0.0.1:50568.
- The Google account and Flow credits.
- `p53g.db`, prompts, nonces, attempts.
- Historical evidence G.1–G.4.2.2.
- The host home directory, SSH keys, keychain.
- Host disk space (9.9 GiB free).

## 2. Threats and controls

| # | Threat | Control | Verification |
|---|---|---|---|
| T1 | Chrome background requests (updates, Safe Browsing, variations) | **no NIC** (L1); nftables drop + counters (L2) | V3, V3b, V9 |
| T2 | DNS bypass (DoH, built-in resolver, `.example.test`) | no NIC; no nameserver; `lo:53` denied and counted. DoH needs IP connectivity, which is absent | V5, V9 |
| T3 | IPv6 bypass | `inet` table; no device, so no RA / SLAAC | V4 |
| T4 | Guest → host (IP, vsock, agents, clipboard, drag-and-drop, USB, shared folders) | VM definition without those devices; device inventory hashed | V8; config hash before and after each run |
| T5 | Host folder exposure | **no shares**; input is a read-only ISO built from an explicit file list; output is a separate empty image | inventory of the ISO; output image read only after shutdown, read-only |
| T6 | Personal profile access | the guest has no host filesystem; profile is the tmp profile inside the guest | Stage 6 |
| T7 | Crashpad writes to the personal host directory | the crash database lives in the guest; no share exists | K1–K4 |
| T8 | Chrome sandbox disabled | **prohibited**: C1 (no sandbox-disabling flags), C2–C3 (sandbox engaged); kernel userns setting not altered | Stage 5 |
| T9 | Test reaches Google Flow | G.4.2.1 static audit (B-4 unreachable) **plus** no route in the VM | static + V3 |
| T10 | Live action / credit consumption | the guest has no Google session, no network, `LIVE_ACTIONS_ACTIVE=False`, 18 `deny: true`; `BLATIFA_LIVE` unset in the guest | grep in the staged copy; guest `env` dump |
| T11 | Snapshot / overlay leaks sensitive state | only the staged copy (code, tests, fixtures, one mp4) and public packages enter; no `p53g.db`, no home data, no tokens | ISO manifest with hashes |
| T12 | Cleanup damages host data | **exact artifact inventory** (absolute paths + sha256 + inode). Delete only listed regular files, one by one, after checking hash and inode. **No recursive delete, no globbing, nothing outside the VM directory** | inventory before and after |
| T13 | Provisioning downloads (OS image, Chrome .deb, wheels) are tampered with | vendor checksums or signatures (Debian SHA512SUMS + signature; Chrome repo signature); recorded hashes; a separate approval for downloads | Stage 2–3 evidence |
| T14 | Provisioning NIC (option P2) left in place | NIC removed **before** any project file enters; definition hash compared; V3/V8 rerun on every boot | V3, V8 |
| T15 | Guest output (serial log, output disk) is malicious or misleading | treated as data, never executed; output image attached `-readonly` on the host; hashed | procedure |
| T16 | Host resource exhaustion (RAM 8 GiB, disk 9.9 GiB) disturbs the running Blatifa Chrome or fills the disk | small VM (RESOURCE_ESTIMATE); disk gate ≥ 20 GiB free before Stage 2, stop below 10 GiB | `df` before every stage |
| T17 | Guest-path shim (Q-1, option G-1) hides a production difference | if approved: one symlink only, at the exact `DEFAULT_CHROME` path, recorded as an environment deviation in the report | Stage 6 |

## 3. Residual risks (cannot be fully eliminated)

| Risk | Why it remains | Handling |
|---|---|---|
| R1 Hypervisor or virtual-device escape | QEMU/HVF bugs | few devices; current release; no network device means no attack surface in the network stack |
| R2 Platform difference | Linux Chrome ≠ macOS Chrome used in production; the tests then prove Linux behaviour | stated in every report; a macOS guest (more resources) would remove it |
| R3 Provisioning needs external downloads | OS, Chrome and wheels must come from somewhere | P1 (host-side download, offline install) preferred; P2 only with approval; checksums |
| R4 Guest root can change L2/L3 | L2/L3 are inside the guest | L1 does not depend on the guest |
| R5 Vendor facts are partly secondary | search excerpts, conflicting licence / snapshot info | re-read in Stage 1 |
| R6 DNS-error behaviour of `.example.test` differs from the host | no resolver vs NXDOMAIN | observed and reported, fixtures unchanged |
| R7 Serial console is a guest → host channel | needed to get output | one-way into a file; never interpreted |
| R8 Host disk nearly full | 9.9 GiB free | hard gate (T16) |

## 4. Acceptance criteria for a future test run

1. V1–V10 PASS (NETWORK_ISOLATION_ARCHITECTURE §5).
2. C1–C6 PASS (CHROME_SANDBOX_COMPATIBILITY §4).
3. K1–K4 verified.
4. The device inventory and VM definition hash are unchanged since verification.
5. The staged ISO contains no `p53g.db`, no home data, and no credentials. It has a manifest with hashes.
6. `LIVE_ACTIONS_ACTIVE=False`, 18 `deny: true`, and `BLATIFA_*` unset in the guest.
7. Q-1 is decided by the user and documented.
8. Host integrity (protected hashes, `p53g.db`) is unchanged before and after.
9. A **separate user authorization** for test execution (Stage 10).
