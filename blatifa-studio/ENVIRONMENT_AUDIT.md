# WP-0.1 — Environment Audit

Audit date: 2026-11-02. All values below were **VERIFIED** by running commands on the target machine (evidence IDs refer to `PHASE_0_EVIDENCE_REGISTER.md`).

## 1. Host

| Item | Value | Status | Evidence |
|---|---|---|---|
| OS | macOS 26.5 (build 25F71) | VERIFIED | E-ENV-01 `sw_vers` |
| Architecture | arm64, Apple M2, 8 cores | VERIFIED | E-ENV-01 `uname -m`, `sysctl` |
| RAM | 8 GiB | VERIFIED | E-ENV-01 `sysctl hw.memsize` |
| Free disk (data volume) | **11 GiB free of 460 GiB (98 % used)** | VERIFIED — **CRITICAL RISK** | E-ENV-02 `df -h` |

### Disk space is a production blocker

A 36-scene episode produces 36+ MP4 files, 36 extracted frames, optional retries and a final assembly. At a rough 5–30 MB per 8-second clip, one episode may take 0.5–2 GB, before the browser profile caches (Chrome profiles commonly reach 0.5–1 GB each) are counted. With 11 GiB free and macOS needing headroom for swap and updates, the machine can run **Phase 1–2 experiments** but not sustained multi-episode, multi-profile production. The figures per clip are estimates (UNVERIFIED) until real Flow downloads are measured in Phase 2.

Recommendation: free at least 30–50 GB, or put the production workspace on an external drive, before Phase 4. The application must check free space before each download (see `PRODUCTION_STATE_MACHINE.md`).

8 GiB RAM is enough for one headed Chrome plus a PySide6 UI. Running several Chrome profiles at the same time is not recommended on this machine.

## 2. Python

| Interpreter | Version | Source | Notes |
|---|---|---|---|
| `python3` on PATH | 3.10.16 | mise (`~/.config/mise/config.toml`) | Global default |
| `/opt/homebrew/bin/python3.10` | 3.10.21 | Homebrew | |
| `/Library/Frameworks/.../3.11/bin/python3.11` | 3.11.1 | python.org installer | Used for the discovery venv |
| `/usr/bin/python3` | 3.9.6 | Apple CLT | Do not use |
| `python` (2.7) | 2.7 | python.org legacy | Do not use |

Tools: `uv` 0.12.18 and `mise` 2026.7.5 are available. `pyenv`, `conda`, `pipx` and `poetry` are not installed.

**Recommendation (PROPOSED):** create the project environment with `uv` and a pinned Python 3.12 (`uv python install 3.12`), managed through `pyproject.toml` + `uv.lock`. Python 3.12 is supported by Playwright, PySide6 and Pydantic v2. The global Python versions must not be changed.

## 3. Python packages

Before Phase 0 none of the proposed packages were installed in any global interpreter (`playwright`, `PySide6`, `pydantic`, `opencv-python`, `pytest`, `Pillow` → not installed; E-ENV-03).

With user approval (2026-11-02), one isolated environment was created for discovery only:

- `blatifa-studio/.venv` (Python 3.11.1, created by `uv venv`), size 134 MB.
- Installed: `playwright==1.64.1`, `greenlet==3.5.6`, `pyee==13.0.1`, `typing-extensions==4.16.0`.
- **No Playwright-bundled browsers were downloaded** (`~/Library/Caches/ms-playwright` does not exist). Discovery uses the installed Google Chrome over CDP.

This venv is a throwaway discovery environment. Phase 1 should recreate it from `pyproject.toml` with Python 3.12.

## 4. Browsers

| Browser | Version | Status |
|---|---|---|
| Google Chrome | 156.0.8078.74 | VERIFIED (Info.plist + CDP `/json/version`) |
| Firefox | 152.0.5 | VERIFIED |
| Safari | 26.5 | VERIFIED |

The user's normal Chrome data directory has 7 profiles (`Default`, `Profile 1, 3–7`). **Blatifa Studio must never use or modify these profiles.** Discovery uses a separate profile at `blatifa-studio/.profiles/discovery` (mode `700`).

## 5. Media and data tools

| Tool | Version | Notes |
|---|---|---|
| FFmpeg / FFprobe | 9.0.1 (Homebrew, `/opt/homebrew/bin`) | `libx264` and `h264_videotoolbox` encoders available |
| SQLite CLI | 3.51.0 | Python `sqlite3` module is built in |
| Node.js | 24.16.0 (mise) | Not required by the architecture |
| git | 2.50.1 | Project directory is **not** a git repository yet |
| Homebrew | present | |
| Tesseract (OCR) | **not installed** | Only relevant if the OCR fallback is ever approved |

## 5a. Security-relevant host facts

| Item | Value | Status | Evidence |
|---|---|---|---|
| FileVault disk encryption | On | VERIFIED | E-ENV-04 `fdesetup status` |
| Discovery Chrome profile size after one session | 242 MB, mode `drwx------` | VERIFIED | E-ENV-05 `du -sh`, `ls -ld` |

## 6. Existing directories

Working directory `~/Developments/My Project` contains:

| Directory | Relation to Blatifa Studio | Action |
|---|---|---|
| `blatifa-studio/` | Target project; was **empty** at audit start | Phase 0 docs written here |
| `gpos-b2b-mobile/` | Unrelated project | Not touched |
| `Krisbow Sync/` | Unrelated (decompiled Android app contents) | Not touched |

No existing documentation was found that could be overwritten.

## 7. Files created during Phase 0

| Path | Purpose | Commit to git? |
|---|---|---|
| `blatifa-studio/docs/phase-0/**` | Phase 0 deliverables | Yes |
| `blatifa-studio/.venv/` | Discovery venv | No (`.gitignore`) |
| `blatifa-studio/.profiles/discovery/` | Isolated Chrome profile with the user's Google login | **Never** — contains session cookies |

## 8. Conclusions

1. The toolchain (Python via uv, Chrome, FFmpeg, SQLite) is adequate. — VERIFIED
2. Free disk space is the main environmental risk. — VERIFIED
3. 8 GiB RAM limits parallel browser profiles to one active at a time. — PROPOSED constraint
4. Python 3.12 via `uv` is recommended for the real project. — PROPOSED
