# Phase 5.3g.4.3: implementation plan (future phase, NOT executed)

> **Ringkasan (ID):**
> - Rencana bertahap 10 stage untuk fase implementasi berikutnya, masing-masing dengan kriteria PASS/BLOCKED.
> - **Tidak ada stage yang dijalankan sekarang.**
> - Stage 2 dan Stage 3 memerlukan unduhan dan instalasi, jadi butuh otorisasi baru.
> - Stage 10 adalah otorisasi terpisah untuk menjalankan tes.

## 0. Preconditions (decisions the user must make first)

| ID | Decision |
|---|---|
| D-1 | Free host disk to **≥ 20 GiB** (the user's action; nothing is deleted by Claude without explicit approval) |
| Q-1 | How `DEFAULT_CHROME` exists in a Linux guest: **G-1** guest-only symlink at the macOS path, **G-2** a code change in a separate phase, or **G-3** a macOS guest on a host with enough resources |
| P | Provisioning: **P1** offline (packages downloaded on the host, guest never has a NIC) or **P2** one networked provisioning boot before any project file enters |
| L | Platform choice and licence acceptance (Stage 1) |

General rules for every stage:
- evidence goes to `docs/phase-<impl>/evidence/`;
- protected hashes and `p53g.db` are checked before and after;
- any ambiguity → BLOCKED, stop, report;
- no host firewall, DNS or network change;
- no Chrome flags, no code changes, no Flow;
- all VM artifacts live in one new directory, e.g. `~/BlatifaVM/` (never inside `~/BlatifaStudio/`), recorded in
  an artifact inventory.

## Stage 1: platform selection

- **Do:**
  - re-read the cited vendor pages in full;
  - confirm the UTM (or QEMU) version and licence;
  - confirm that a NIC-less definition is possible, and how the device inventory is shown;
  - confirm Google Chrome Linux ARM64 availability and its signature;
  - confirm the Debian 13 arm64 image checksum source.
- **PASS:** every fact in VM_PLATFORM_COMPARISON graded V or L; the user approves platform, guest OS, Q-1 and P.
- **BLOCKED:** NIC-less operation impossible or unprovable on the chosen platform; Chrome ARM64 for Linux not
  officially available; licence not acceptable.

## Stage 2: disposable VM creation

- **Do:**
  - install the platform (approved download);
  - create the golden VM with an explicit device list: CPU 2, RAM 3 GiB, virtio-blk system disk, serial console to
    a file, no display, **no NIC** (P1) or a temporary NIC (P2), no vsock, no shares, no SPICE agent, no USB;
  - record the definition (QEMU command line / config.plist / .vmx) and its sha256;
  - create the artifact inventory.
- **PASS:** the definition matches the design byte for byte; the inventory lists every created file; free disk
  ≥ 10 GiB.
- **BLOCKED:** an unexpected default device (e.g. an automatic NIC, a sound or USB controller that the platform
  forces); free disk < 10 GiB.

## Stage 3: guest OS hardening

- **Do:**
  - install Debian 13 arm64 minimal (no desktop) and verify the image checksum;
  - install `nftables`, `ffmpeg`, Google Chrome ARM64 (.deb, signature verified), and uv-managed Python 3.12;
  - with P2, the NIC is used only now, and **Chrome is not launched**;
  - disable `systemd-resolved`, empty `resolv.conf`, remove unattended-upgrades;
  - create an unprivileged `tester` user (no sudo for the test user);
  - install the nftables ruleset (NETWORK_ISOLATION_ARCHITECTURE §2 L2);
  - with P2: shut down, **remove the NIC from the definition**, re-hash the definition.
- **PASS:**
  - package list and versions recorded;
  - the kernel user-namespace setting recorded **unchanged**;
  - the definition has no NIC;
  - the golden image is hashed and then treated as read-only.
- **BLOCKED:** packages unverifiable; the NIC cannot be removed; the AppArmor/userns setting would have to be
  weakened.

## Stage 4: network isolation

- **Do:** boot a per-run overlay; collect the host device inventory (`info qtree`, `info pci`, `info network` or
  the platform equivalent) and the guest view (`/sys/class/net`, `ip route`, `nft list ruleset`).
- **PASS:** only `lo` exists; no routes; nft ruleset loaded with zeroed counters; inventory matches Stage 2.
- **BLOCKED:** any network device, vsock, share or agent channel.

## Stage 5: Chrome installation and native sandbox verification

- **Do:** C1–C6 (CHROME_SANDBOX_COMPATIBILITY §4), with the unchanged `BrowserEngine` launch inside the
  disconnected guest, run by a harness script on the input ISO (not pytest).
- **PASS:** C1–C6 all pass.
- **BLOCKED:** a sandbox layer missing, a crash, or a disabling flag present.

## Stage 6: temporary workspace / profile / Crashpad verification

- **Do:**
  - confirm that the profile dir is under the tmp workspace (mode 0o700);
  - apply the Q-1 mechanism and record it;
  - trigger one guest-only renderer crash (CDP `Page.crash` on `about:blank`) and record where the crash data was
    written (K2);
  - confirm the staged paths (`tests/fixtures/`, `docs/phase-0/evidence/media/E-FLOW-test_720p.mp4`) and the ISO
    manifest (no `p53g.db`, no home data).
- **PASS:** every path is inside the guest overlay or the read-only ISO; nothing is shared with the host.
- **BLOCKED:** a path outside the expected locations; ambiguous crash location.

## Stage 7: loopback and CDP verification

- **Do:** V1, V2.
- **PASS:** echo body matches; `/json/version` answers from the fixture's Chrome.
- **BLOCKED:** otherwise.

## Stage 8: external network denial verification

- **Do:** V3–V10, including the dummy0 A/B (V3b) and the 120 s idle Chrome (V9).
- **PASS:**
  - every external attempt gives `ENETUNREACH` (L1);
  - with dummy0 it gives `EPERM` and the counter rises (L2);
  - every non-`lo` counter stays 0 during V9;
  - dummy0 is removed afterwards and the routes are empty again.
- **BLOCKED:** any success, timeout outside the defined A/B step, missing counter increment, or a disagreement
  between runs.

## Stage 9: browser test readiness review

- **Do:**
  - collect the evidence of Stages 1–8;
  - run `pytest --collect-only -m browser` in the guest **only if this stage is authorized**; it must list the
    same 43 IDs as G.4.2.1 §3;
  - re-evaluate B-1 to B-7 against the evidence;
  - write the readiness report.
- **PASS:** all acceptance criteria in THREAT_MODEL §4 except item 9.
- **BLOCKED:** a criterion is unmet or ambiguous.

## Stage 10: separate user authorization for test execution

- **Do:** present the readiness report and **wait**. Only after explicit approval:
  - run the batches in order ENG → ACC → the rest, each in a fresh overlay;
  - read the counters after each batch;
  - power off;
  - attach the output image read-only;
  - delete the overlays from the inventory, one file at a time, checking hash and inode.
- **PASS:** 43 executed, results reported as they are (pass / fail / skip, where a skip counts as not executed);
  all counters still 0 for non-`lo`; host integrity unchanged.
- **BLOCKED:** missing approval; an isolation counter changed; an unexpected host file change (STOP, do not
  restore automatically).

## Cleanup rule (all stages)

- Only files listed in the artifact inventory are removed. Each removal names an absolute path, checks the
  recorded sha256 and inode, and uses `rm -- <file>` (no `-r`, no globs, no variables that could expand to a home
  directory).
- Directories are removed with `rmdir` only when they are empty.
- Removing the virtualization software is a separate user decision.
