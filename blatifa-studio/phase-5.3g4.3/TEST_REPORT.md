# Phase 5.3g.4.3: test report (design phase)

> **Ringkasan (ID):**
> - Verdict **DESIGN CONDITIONAL PASS**: arsitekturnya konsisten dan aman di atas kertas, tetapi ada pertanyaan
>   material yang belum terjawab:
>   - path Chrome macOS yang di-hardcode;
>   - disk host;
>   - fakta vendor yang masih sekunder;
>   - perilaku sandbox Chrome di VM.
> - Tidak ada tes yang dijalankan, dan tidak ada hasil tes yang diklaim.

## 1. Documents created

| File | Content |
|---|---|
| `VM_PLATFORM_COMPARISON.md` | host facts, 7 platform options, guest OS options, recommendation, sources |
| `NETWORK_ISOLATION_ARCHITECTURE.md` | Candidates A and B, diagrams, traffic policy, V1–V10, failure conditions |
| `CHROME_SANDBOX_COMPATIBILITY.md` | why nesting failed, `--no-sandbox` rejected, checks C1–C6, Crashpad K1–K4 |
| `TEST_COMPATIBILITY_MATRIX.md` | 8 groups × capabilities, 43-test index, cross-cutting topics |
| `THREAT_MODEL.md` | T1–T17, residual risks R1–R8, acceptance criteria |
| `RESOURCE_ESTIMATE.md` | minimum / recommended VM, host disk gate |
| `IMPLEMENTATION_PLAN.md` | preconditions, Stages 1–10 with PASS / BLOCKED, cleanup rule |
| `SAFETY_AUDIT.md` | scope record, integrity |
| `TEST_REPORT.md` | this file |
| `evidence/` | `host_capabilities.txt`, `protected_hashes_{before,after}.txt`, `profiles_metadata_{before,after}.txt`, `flags_after.txt`, `hash43.sh` |

## 2. Design review checks

| # | Check | Result |
|---|---|---|
| 1 | Chrome native sandbox kept; no `--no-sandbox`, no flag change | yes: C1 forbids it; the design needs no Chrome argument |
| 2 | Network boundary enforced below the guest (VM-level) and verified with A/B attribution | yes: L1 (no device) + L2 (nft) + V3b |
| 3 | Host-only network not assumed safe; disabled adapter not assumed to stop all channels | yes: UTM Host Only rejected; V8 inventories vsock, agents, shares, USB |
| 4 | No broad host folder sharing | yes: read-only ISO from an explicit list + separate output image |
| 5 | Crashpad redirected to disposable storage without changing arguments | yes by design (guest-only); location to be verified (K2) |
| 6 | Disposable state and narrow cleanup | yes: per-run overlays, artifact inventory, `rm -- <file>` only after hash and inode check |
| 7 | All 43 tests mapped; G.4.2.1 findings kept | yes |
| 8 | Every stage has PASS / BLOCKED | yes |
| 9 | Internal consistency (resources ↔ plan ↔ threat model) | yes: the 3 GiB / 2 vCPU and D-1 disk gate are used everywhere |
| 10 | Claims separated into L / V / S / A | yes; see §4 |

## 3. Evidence sources

- **Local (L):**
  - `evidence/host_capabilities.txt`;
  - `src/blatifa/config.py:11,13,24`;
  - `src/blatifa/browser/chrome.py`;
  - `tests/browser/conftest.py`, `test_engine_recovery.py`, `test_video_properties_fixture.py`;
  - ffprobe of the fixture mp4;
  - G.4.2.1 audit, G.4.2.2 evidence.
- **Upstream / vendor (V) and secondary (S):** listed per document (VM_PLATFORM_COMPARISON §7,
  CHROME_SANDBOX_COMPATIBILITY sources).

## 4. Open questions (each needs a user decision or evidence)

| ID | Question | Evidence / decision needed |
|---|---|---|
| **Q-1** | `DEFAULT_CHROME` is a hard-coded macOS path. On a Linux guest all 43 tests would **skip**. Options: G-1 guest-only symlink at that path (an environment deviation), G-2 a test-configuration code change in a separate phase, G-3 a macOS guest (needs a bigger host) | user decision |
| **Q-2** | Host disk: 8.8 GiB free now; the design needs ≥ 20 GiB before Stage 2 | the user frees space |
| Q-3 | Provisioning P1 (offline) or P2 (one networked boot before the project enters) | user decision; feasibility of P1 for Debian arm64 + Chrome .deb + wheels |
| Q-4 | Does UTM (current version) allow a VM with **no** network device and show a complete device inventory? Or is plain QEMU preferred for auditability? | Stage 1: vendor docs, then Stage 2/4 evidence |
| Q-5 | Is Google Chrome for Linux ARM64 officially available, signed, and supporting H.264? | Stage 1: google.com download page + repo signature; Stage 9 VID test |
| Q-6 | Does Chrome's namespace sandbox engage in a Debian 13 arm64 guest without changing kernel settings? | Stage 5 C2–C3, C6 |
| Q-7 | Where does Linux Chrome write crash data with a temporary `--user-data-dir`? | Stage 6 K2 |
| Q-8 | Do GRID / PROBE assertions depend on the kind of media load error (`.example.test`)? | Stage 9/10 observation; fixtures stay unchanged |
| Q-9 | Licence details: UTM licence, Tart's licence (conflicting sources), macOS-guest SLA wording | Stage 1 |
| Q-10 | Does a Linux-Chrome result count as evidence for the macOS production path? (platform difference R2) | user decision on how results are interpreted |

## 5. Unverified assumptions

- RAM, disk and runtime figures (no benchmark).
- That Debian 13 enables unprivileged user namespaces by default.
- That the Chrome .deb ships a usable SUID `chrome-sandbox`.
- UTM device-removal behaviour and its config / log auditability.
- The Apple VZ "no network device" configuration.
- The VMware / Parallels network and tool-integration settings.
- That Docker's default seccomp profile blocks Chrome's namespace sandbox (the reason for rejecting it).
- That crash upload consent is off in a fresh profile.
- That netfilter drops in the `output` hook return `EPERM` to `connect()` (to be shown by V3b).

## 6. Final verdict: **DESIGN CONDITIONAL PASS**

- The architecture is a credible path in which Chrome's native sandbox and VM-level network isolation coexist:
  - a disconnected Linux guest (Candidate A);
  - a VM-level deny with in-guest attribution;
  - no host sharing;
  - a guest-only Crashpad.
- No required protection is weakened.
- It is **not** a DESIGN PASS, for three reasons:
  - Q-1 decides whether the tests can run at all without a code change or an environment deviation;
  - Q-2 blocks Stage 2 on this host;
  - several platform facts are secondary (Q-4, Q-5, Q-9).
- This verdict does not mean that a VM exists or that anything was tested.

Mutation status unchanged: `MUTATION EVIDENCE NOT INDEPENDENTLY VERIFIED`.
