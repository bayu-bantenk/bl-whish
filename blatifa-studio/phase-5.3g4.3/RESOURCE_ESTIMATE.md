# Phase 5.3g.4.3: resource estimate

> **Ringkasan (ID):**
> - Minimal: 2 vCPU, 2 GiB RAM, disk virtual 12 GiB (terpakai ±5–6 GiB).
> - Rekomendasi: 2 vCPU, 3 GiB RAM.
> - **Penghambat utama: disk host hanya 9,9 GiB kosong.** Butuh ≥ 20 GiB kosong sebelum Stage 2.
> - Guest macOS tidak realistis di host ini (8 GiB RAM).
> - Semua angka adalah **perkiraan, tanpa benchmark**.

## 1. Host budget (L)

| Resource | Host | Already used by |
|---|---|---|
| RAM | 8 GiB, ≈ 35–40 % free | macOS, the running Blatifa Chrome, the IDE, Docker.app (if running) |
| CPU | 4 P + 4 E cores | — |
| Disk | **9.9 GiB free** | project rule: stop below 5 GiB, no full regression below 10 GiB |

## 2. Linux guest (recommended path), estimates (A)

| Item | Minimum viable | Recommended | Basis |
|---|---|---|---|
| vCPU | 2 | 2 (max 3) | serial tests; one headless Chrome at a time; leave P-cores for the host |
| Guest RAM | **2 GiB** | **3 GiB** | Debian headless ≈ 150–250 MB; headless Chrome with one page ≈ 300–600 MB; Playwright driver (Node) ≈ 100 MB; pytest + Python ≈ 150 MB; ffmpeg for the one UI test ≈ 100–200 MB |
| Swap in guest | 1 GiB swap file | 1 GiB | avoids OOM during the ENG tests, which restart Chrome |
| Virtual disk | 12 GiB (qcow2, sparse) | 16 GiB | base OS ≈ 1.5–2.5 GB, Chrome ≈ 0.4–0.6 GB, ffmpeg + libs ≈ 0.3 GB, uv Python 3.12 + venv ≈ 0.3 GB |
| Golden image on host | ≈ 4–6 GiB | same | qcow2 holds only used blocks |
| Per-run overlay | ≈ 0.3–1 GiB | same | tmp profiles, logs; deleted after the run |
| Input ISO | ≈ 0.1–0.3 GiB | same | code, tests, fixtures (4.2 MB) + one mp4 (2.9 MB) + wheelhouse |
| Output image | 64 MiB | 128 MiB | junit XML, logs, counters |
| Install media / packages (staging, deletable) | ≈ 1–3 GiB | same | Debian image, Chrome .deb, wheels |
| Virtualization software | UTM ≈ 0.5 GB / QEMU via Homebrew ≈ 1 GB | — | — |
| **Peak extra disk** | **≈ 8–11 GiB** | ≈ 10–13 GiB | — |

**Consequence:**
- with 9.9 GiB free, peak use would push the host **below the 5 GiB stop line**;
- **Gate D-1:** at least **20 GiB free** before Stage 2, and at least 10 GiB free at every later stage;
- freeing space is the user's decision. This phase deletes nothing.

## 3. macOS guest (for comparison)

| Item | Estimate (A) |
|---|---|
| Guest RAM | ≥ 4 GiB for usable operation (half the host) |
| Disk | IPSW ≈ 15–19 GB (deletable after install) + VM ≈ 30–40 GB |
| Verdict | **not feasible on this host** without severe memory pressure and ≥ 60 GiB free |

## 4. Runtime (A, no benchmark)

- **Boot:** headless Debian ≈ 10–30 s.
- **43 tests:** on the host they would take a few minutes. In the VM, Chrome starts more slowly (ENG starts Chrome
  ≥ 5 times); estimate 3–10 min.
- **Snapshot/reset:** creating a qcow2 overlay is near-instant; deleting it is one file.

## 5. Trade-offs and limitations

- 2 GiB may cause OOM if Chrome spawns several renderers. 3 GiB is safer but lowers host headroom while the Blatifa
  Chrome runs. **Recommendation:** run with 3 GiB and with other heavy apps closed; record `memory_pressure` before
  and after.
- No GPU acceleration in a headless guest: Chrome uses software rendering (fine for headless DOM tests).
- One fresh overlay per batch costs a reboot each time (≈ 30 s) but gives stronger isolation between batches.
- The FFmpeg / OpenCV requirement applies only to `test_control_ui` (ffmpeg). OpenCV is not a dependency in
  `pyproject.toml`, and PySide6 is not in the venv, so neither is needed in the guest.
