# Phase 0 Evidence Register

> **Ringkasan (ID):** Daftar semua bukti Phase 0 beserta statusnya. **VERIFIED** = diuji dan diamati langsung. **PARTIALLY VERIFIED** = sebagian diuji. **PROPOSED** = rekomendasi desain. **UNVERIFIED** = belum diuji. **BLOCKED** = tidak bisa diperiksa. Tidak ada hasil yang dikarang. Semua file bukti ada di `docs/phase-0/evidence/` dan email/nama akun sudah disensor.

Paths are relative to `docs/phase-0/evidence/`.

## 1. Environment

| ID | Claim | Status | Evidence |
|---|---|---|---|
| E-ENV-01 | macOS 26.5 arm64, M2, 8 GiB; Python 3.10.16 default (mise), 3.11.1, 3.10.21, 3.9.6; uv 0.12.18 | VERIFIED | command output in `ENVIRONMENT_AUDIT.md` |
| E-ENV-02 | Data volume 11 GiB free (98 % used) | VERIFIED | `df -h` |
| E-ENV-03 | No Playwright/PySide6/Pydantic/OpenCV/pytest installed globally; Chrome 156.0.8078.74, Firefox 152.0.5, Safari 26.5; FFmpeg 9.0.1 with libx264/videotoolbox; SQLite 3.51.0; no Tesseract | VERIFIED | command output |
| E-ENV-04 | FileVault On | VERIFIED | `fdesetup status` |
| E-ENV-05 | Discovery profile 242 MB, mode 700 | VERIFIED | `du`, `ls -ld` |
| E-ENV-06 | Discovery venv `.venv` (Python 3.11.1) with playwright 1.64.1 only; no bundled browsers downloaded | VERIFIED | `uv pip install` output |

## 2. Google Flow

| ID | Claim | Status | Evidence |
|---|---|---|---|
| E-FLOW-01 | Flow lives at `flow.google.com`; logged-out landing `/about` | VERIFIED | `aria/00-landing.*`, `screenshots/00-landing.png` |
| E-FLOW-02 | Project page structure, navigation, session composer, account button | VERIFIED | `aria/01-after-login.*`, `screenshots/01-after-login.png` |
| E-FLOW-03 | Ingredient picker: tabs, Upload media, Asset list, Add to prompt | VERIFIED | `aria/02-composer-plus.*` |
| E-FLOW-04 | Agent settings incl. "Confirm before generating: Always/Never", video defaults (16:9/9:16, x1–x4, Veo 3.1 - Lite) | VERIFIED | `aria/03-composer-settings.*`, `screenshots/03-composer-settings.png` |
| E-FLOW-05 | Agent instructions panel (Add instruction / Done) | VERIFIED | `aria/05-agent-instructions.*` |
| E-FLOW-06 | Tools/Templates are post-processing tools; no frames-to-video mode; tool creation requires upgrade; Angular Material markup | VERIFIED | `aria/06-tools.*`, `aria/07-templates.*`, screenshots |
| E-FLOW-07 | Image edit view: image models only (Nano Banana Pro/2 Lite/2.1); "Generating will use 0 credits" | VERIFIED | `aria/09-image-detail.*`, `aria/10-edit-settings.*`, `aria/11-model-family.*` |
| E-FLOW-08 | Add-media menu (Upload, New collection, Create character, New scene); suggestion chips vary per load | VERIFIED | `aria/12-add-media.*`, `aria/13-scenes.*` |
| E-FLOW-09 | Scene editor is a clip timeline; Add clip selects existing videos | VERIFIED | `aria/14-new-scene.*`, `aria/15-add-clip.*` |
| E-FLOW-10 | Upload chooser interceptable by Playwright (multiple, accepted types) | PARTIALLY VERIFIED (no file uploaded) | `logs/observation_log.md` |
| E-FLOW-11 | Image ingredient attached + prompt typed; Start generation enabled | VERIFIED | `aria/16-prompt-ready.*`, `screenshots/16-prompt-ready.png` |
| E-FLOW-12 | Agent quotes cost ("costing 10 credits") and offers Approve / Always approve / Reject | VERIFIED (once) | `aria/17-after-send.*`, `logs/observation_log.md`, `screenshots/18-approved.png` |
| E-FLOW-13 | Rendering progress shown as % on grid tile; completion = "Generated video thumbnail"; ~60 s; agent status text misleading | VERIFIED (once) | `logs/observation_log.md`, `screenshots/19-after-render.png` |
| E-FLOW-14 | Video detail view controls; download menu 270p GIF / 720p / 1080p & 4K disabled (Upgrade); Save frame button | VERIFIED | `aria/20-download-menu.*`, `screenshots/20-download-menu.png` |
| E-FLOW-15 | `expect_download` over CDP works; blob URL; suggested filename | VERIFIED | `logs/observation_log.md` |
| E-FLOW-16 | Downloaded MP4 valid (H.264 720×1280 24 fps 7.93 s + AAC); full decode OK; last frame extracted | VERIFIED | `media/E-FLOW-test_720p.mp4`, `media/E-FLOW-test_720p.ffprobe.json`, `media/E-FLOW-test_last_frame.png` |
| E-FLOW-17 | Account dialog shows identity, "40 Google Flow credits", "Credits refresh daily at 3:37 PM", Switch account, Visible watermarking | VERIFIED (once) | `logs/observation_log.md` (screenshot withheld: shows e-mail) |
| E-FLOW-18 | Results persist after reload; image tiles have `data-media-id`; video tile showed none; Angular build-hash attributes present | VERIFIED / PARTIAL for video ID | `logs/observation_log.md` |
| E-FLOW-19 | Real Chrome with dedicated profile + CDP: Google login completed by user without reported issues | VERIFIED (one login) | `logs/observation_log.md` |
| E-FLOW-20 | Agent rewrote the submitted prompt | VERIFIED (once) | `aria/20-download-menu.aria.yaml` (stored prompt) vs `aria/16-prompt-ready.aria.yaml` (typed) |
| E-FLOW-21 | After a Chrome restart, the login and the agent session persisted (auto title "Smiling Cat Paw Wave"). A scrolled grid hides the top bar from the a11y tree. The account panel ignores Escape (backdrop blocks the grid) | VERIFIED | `aria/21b-state.aria.yaml`, `screenshots/21b-state.png` |
| E-FLOW-22 | The image tile hover menu contains `Animate` (pointed out by the user). Tile = `flow-grid-tile-container.mat-context-menu-trigger` | VERIFIED | `aria/22-tile-hover.aria.yaml`, `aria/23-tile-menu.aria.yaml`, `screenshots/23-tile-menu.png`, `tools/flow_animate.py` output |
| E-FLOW-23 | `Animate` attaches the image as an ingredient to the agent composer. The URL is unchanged and credits stayed at 40 before and after | VERIFIED | `aria/24-after-animate.aria.yaml`, `screenshots/24-after-animate.png` |
| E-FLOW-24 | The ingredient chip DOM (`flow-image-ingredient-chip > button[aria-label=Ingredient][cdkoverlayorigin]`) has no start-frame marker | VERIFIED | `tools/chip_probe.py` output |
| E-FLOW-25 | Clicking the ingredient chip removed the ingredient. The video tile menu has `Add to scene` and `Publish to YouTube`, and no Animate/Extend | VERIFIED | `aria/25-chip-click.aria.yaml`, `aria/26-video-tile-menu.aria.yaml`, `screenshots/26-video-tile-menu.png` |

## 3. Data contract

| ID | Claim | Status | Evidence |
|---|---|---|---|
| E-DATA-01 | `examples/sample_episode.json` is structurally valid: lock hashes, Octopus lock verbatim, unique contiguous order, refs resolvable, acyclic graph `S02→S01, S03→{S01,S02}` | VERIFIED (stdlib validator) | `tools/validate_episode.py` output "RESULT: VALID" |
| E-DATA-02 | Same sample validates against the Pydantic models | UNVERIFIED | Pydantic not installed (no approval sought in Phase 0) |

## 4. Not verified / blocked items

| Item | Status | Reason |
|---|---|---|
| Generation started via tile menu `Animate` (vs. picker) | UNVERIFIED | Would need credits; DOM shows no difference |
| Right-click context menu on tiles; tile `Download ▸` submenu items | UNVERIFIED | Not opened |
| Text-to-video (no ingredient) | UNVERIFIED | Not run to save credits |
| Start + end frame | UNVERIFIED | No control found; would need credits |
| Actual local file upload completing | UNVERIFIED | Chooser intercepted only |
| Insufficient-credit message | UNVERIFIED | Balance was sufficient |
| Generation failure / policy refusal UI | UNVERIFIED | Not observed |
| Session expiry DOM on `/project/` URL | UNVERIFIED | Not simulated |
| Daily credit allowance amount | UNVERIFIED | 50 inferred from 40 + 10 |
| Video model list | UNVERIFIED | Menu not opened |
| Prompt-preservation via Agent instructions | UNVERIFIED | Needs credits (Phase 2) |
| Option B `launch_persistent_context` login | UNVERIFIED | Not tested |
| Minimised/headless behaviour | UNVERIFIED | Not tested |
| Multi-account switching | UNVERIFIED | Only one account used |
| Pydantic model validation | UNVERIFIED | Package not installed |
| **BLOCKED items** | none | Flow was accessible |

## 5. Proposed (design) items

All of `FLOW_INSPECTOR_ARCHITECTURE.md`, `BROWSER_AUTOMATION_ARCHITECTURE.md` (except option A mechanics), `ACCOUNT_CREDIT_ARCHITECTURE.md` §2–6, `EPISODE_DATA_CONTRACT.md` models, `PRODUCTION_STATE_MACHINE.md`, `SYSTEM_ARCHITECTURE.md`, `IMPLEMENTATION_ROADMAP.md` are **PROPOSED** designs built on the evidence above.

## 6. Redaction statement

E-mail addresses (including URL-encoded forms) and the account display name were replaced with `<email-redacted>` / `<account-name>` in all text evidence; a grep for `gmail`, `%40` and the account surname returned no matches after copying. The account-dialog screenshot was not stored. Project and media UUIDs are kept (they are not credentials). No cookies, storage, headers or tokens were read at any point. Screenshot `01-after-login.png` shows the first-name greeting and avatar initial.
