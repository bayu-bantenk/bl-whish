# Phase 5.3g.4.3: Chrome sandbox compatibility

> **Ringkasan (ID):**
> - Di macOS, `sandbox-exec` dan sandbox Seatbelt milik Chrome memakai mekanisme kernel yang **sama**. Proses yang
>   sudah di-sandbox tidak bisa memasang sandbox kedua, jadi Chrome crash.
> - Di VM, guest punya **kernel sendiri**. Sandbox Chrome (Linux: user namespace + seccomp-bpf; macOS guest:
>   Seatbelt) berjalan seperti di mesin biasa, dan isolasi jaringan dilakukan di level hardware virtual, bukan
>   di level proses.
> - Ini **desain**: kompatibilitas Chrome **belum diverifikasi** dan baru boleh diklaim setelah Stage 5.

## 1. Why `sandbox-exec` failed (G.4.2.2 evidence)

- Chrome on macOS confines its renderer, GPU and network-service processes with Seatbelt (`sandbox_init` family;
  V: Chromium Mac sandbox docs).
- `sandbox-exec` applies a Seatbelt profile to our whole process tree. When Chrome's helpers tried to apply their
  own profile inside it, the kernel refused:
  - `sandbox initialization failed: Operation not permitted`;
  - `aperitif: Failed to initialize sandbox`;
  - the network service and GPU process crashed;
  - `new_page` failed with `Target crashed`.
  
  The evidence is in `docs/phase-5.3g4.2.2/evidence/chrome_diag_inside.json`.
- The same launch **outside** the sandbox worked (`chrome_diag_outside.json`). So the cause is the **nesting** of
  two Seatbelt profiles, not Chrome or the fixture.
- No upstream document was found that states the nesting rule explicitly. The conclusion rests on the A/B evidence
  above (L).

## 2. Why `--no-sandbox` is rejected

- It turns off Chrome's process isolation: renderers would run with the full rights of the user, and the security
  boundary under test would no longer exist.
- It changes the launch arguments, i.e. code (`chrome.build_args`) or configuration. The brief forbids that "merely
  to bypass isolation".
- It makes the test environment differ from production launches, so a passing run would say less.
- **Core principle:** never trade one boundary (the Chrome sandbox) for another (network isolation).

## 3. Guest OS isolation versus nested Seatbelt

| | `sandbox-exec` on the host | VM guest |
|---|---|---|
| Kernel | shared with the host | **separate** guest kernel |
| Network boundary | per-process Seatbelt rules | virtual hardware: no NIC exists |
| Chrome sandbox | must nest in Seatbelt → refused | first-level sandbox in the guest kernel, as on bare metal |
| Personal host data | same filesystem; Crashpad wrote to `~/Library/...` | guest filesystem only; no shares |
| Escape needed to reach the host | none (same machine) | a hypervisor escape |

- **Linux guest:**
  - layer 1 is the namespace sandbox, which uses unprivileged user namespaces; the SUID `chrome-sandbox` is the
    fallback;
  - layer 2 is seccomp-bpf (V: Chromium Linux sandboxing doc).
  
  Debian enables unprivileged user namespaces by default (A). Ubuntu 23.10+ restricts them through AppArmor (V);
  there Chrome needs its AppArmor profile, and turning the restriction off globally is rejected.
- **macOS guest:** the same Seatbelt sandbox as on bare metal, inside the guest kernel. Nothing is nested (A).

## 4. Required Chrome sandbox checks (Stage 5, before any test)

These are run with the **unchanged** fixture launch (`BrowserEngine(Settings(workspace=<tmp>), "test",
headless=True)`) inside the disconnected guest.

| # | Check | PASS |
|---|---|---|
| C1 | Launch arguments | the command line of the browser process (`/proc/<pid>/cmdline`) equals `chrome.build_args` output; **no** `--no-sandbox`, `--disable-setuid-sandbox`, `--disable-gpu-sandbox`, `--no-zygote`, `--single-process` |
| C2 | Renderer sandbox | `chrome://sandbox` (opened in the test Chrome via CDP; it is a local page) reports the namespace or SUID layer **and** seccomp-BPF for renderers |
| C3 | Kernel view | for a renderer pid: `/proc/<pid>/status` shows `Seccomp: 2`; the pid / net namespace differs from the browser process (`/proc/<pid>/ns/*`) |
| C4 | GPU / network service | `chrome://gpu` shows the GPU sandbox state; the network service runs as its own process (utility type). Headless may run without a GPU process, and that is recorded as is |
| C5 | Page works | `new_page` → `about:blank` → `file://` fixture loads; no `Target crashed` |
| C6 | Negative control | the guest kernel setting for user namespaces is recorded (`kernel.unprivileged_userns_clone` or equivalent). It is **not** changed to make C2 pass |

If C1–C5 do not all pass → BLOCKED. Changing kernel or sandbox settings to make them pass needs a new user
decision.

## 5. Crashpad isolation requirements

- **Host problem (G.4.2.2):** on macOS, Chrome writes its crash database to
  `~/Library/Application Support/Google/Chrome/Crashpad` even with a temporary `--user-data-dir`. 47 dumps landed
  in the personal directory. The user chose KEEP; those files are not touched.
- **In the VM:**
  - the crash database is inside the **guest** filesystem;
  - on Linux this is either `<user-data-dir>/Crash Reports` or the default `~/.config/google-chrome/Crash Reports`.
    Sources conflict (S: Gentoo bug, Chromium crash-report page), so this is to be **verified** in Stage 6;
  - either location is disposable, because the whole guest disk is a per-run overlay deleted after the run.
  
  This meets the requirement without changing Chrome arguments.
- **Requirements:**
  - **K1:** no host directory is mounted in the guest, so no crash data can reach the host.
  - **K2:** Stage 6 records where crash data actually goes (after a guest-only intentional renderer crash via CDP
    `Page.crash`, inside the guest only) and that it lies under the guest workspace or guest home.
  - **K3:** crash *upload* is impossible (no NIC) and consent is off in a fresh profile (A). The counters from V9
    show no attempt leaving `lo`.
  - **K4:** the output disk does **not** receive crash dumps unless the user asks for them.
- `--crash-dumps-dir` or environment variables could redirect the database, but that would change the launch.
  They are not used.

## 6. What may be claimed now

- **Nothing about Chrome's behaviour in the VM is verified.**
- The design rests on two things: the G.4.2.2 A/B evidence about why nesting fails, and the upstream description of
  the Linux sandbox layers.
- Compatibility is claimed only after Stage 5 (C1–C6) passes in an authorized implementation phase.

Sources:
- <https://chromium.googlesource.com/chromium/src/+/HEAD/sandbox/mac/seatbelt_sandbox_design.md>
- <https://chromium.googlesource.com/chromium/src/+/main/sandbox/mac/README.md>
- <https://chromium.googlesource.com/chromium/src/+/main/docs/linux/sandboxing.md>
- <https://chromium.googlesource.com/chromium/src/+/main/docs/security/apparmor-userns-restrictions.md>
- <https://chromium.org/developers/crash-reports>
- <https://bugs.gentoo.org/804151>
- <https://chromium.googlesource.com/chromium/src/+/lkgr/chrome/app/chrome_crash_reporter_client.cc>
