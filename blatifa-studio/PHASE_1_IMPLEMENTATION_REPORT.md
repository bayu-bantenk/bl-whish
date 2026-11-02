# Phase 1 — Implementation Report: Browser Automation Foundation

> **Ringkasan (ID):** Phase 1 membangun fondasi otomasi browser tanpa memakai kredit. Isinya: kerangka proyek Python 3.12, **BrowserEngine** (Chrome asli + profil khusus + Playwright via CDP, health monitoring, deteksi crash, recovery), **FlowUIInspector** (registry locator ber-skema, validator tanpa fallback, health check per state UI, capture dan laporan yang disensor, deteksi perubahan UI), pembaca **identitas dan saldo kredit** (read-only), utilitas **redaksi**, serta CLI `blatifa`. Hasilnya: 62 test otomatis lulus, 7 test live di Flow asli lulus, dan semua 10 gerbang penerimaan terbukti. Tidak ada upload, generate, atau approve, dan tidak ada kredit terpakai (saldo 40 sebelum dan sesudah).

- Period: 2026-11-02, 14:30–15:35 WIB.
- Working directory: `~/Developments/My Project/blatifa-studio` (local only). No git operations were performed, as the user requested. The read-only reference GitHub repository was not touched.
- Authorization: "Phase 1 — GO WITH CONDITIONS". Installation approved by the user: Python 3.12, pydantic, pyyaml, pytest, ruff (playwright was already present). `git init` was declined.

## 1. Phase 0 reconciliation (done before implementation)

- `PHASE_0_FINAL_AUDIT.md`: gate table now covers E-FLOW-01…25. Animate is documented as **ingredient attachment behaviour**. New open item **U-04a** keeps "stricter start-frame behaviour of Animate = UNVERIFIED". A reconciliation note (§9) was added. The verdict stays **CONDITIONAL PASS**.
- `PHASE_0_EVIDENCE_REGISTER.md`: E-FLOW-21…25 now link to `logs/observation_log.md`, which received the verbatim console output of the re-inspection.

## 2. Environment changes

| Change | Detail |
|---|---|
| Python | 3.12.14 installed by `uv python install 3.12` (managed by uv; global interpreters untouched) |
| `.venv` | Recreated with Python 3.12 (the Phase 0 3.11 discovery venv was replaced); 171 MB |
| Packages | playwright 1.64.1, pydantic 2.14.2, PyYAML 6.0.3; dev: pytest 9.2.0, ruff 0.17.3 (`uv.lock` pinned) |
| Browsers | No Playwright browser downloaded; uses Google Chrome 156.0.8078.74 |
| Workspace | `~/BlatifaStudio` (mode 700): `profiles/main/chrome`, `run/`, `logs/`, `inspections/` |
| Disk | Free space fell from 11 GiB (Phase 0) to **4.8 GiB**; Blatifa accounts for < 0.6 GiB of that |

## 3. Code structure

```
blatifa-studio/
  pyproject.toml, uv.lock
  src/blatifa/
    config.py              Settings, workspace layout, private-dir helper, personal-profile path
    redaction.py           Redactor (emails incl. %40 and masked forms, known names, tokens/cookies) + leak finder
    browser/chrome.py      Real Chrome launch (127.0.0.1, random port, no automation flags), process control
    browser/engine.py      BrowserEngine: start/attach/detach/stop, session file, health(), recover()
    inspector/registry.py  Pydantic schema for locators, steps and UI states; cross-reference checks
    inspector/data/flow_locators.yaml   The registry (8 workflows, 36 entries, 6 states)
    inspector/validator.py Resolve + validate (unique/present/absent/visible/enabled/disabled/checked); never clicks
    inspector/safety.py    Click guard (deny / credit_sensitive / non-VERIFIED / deny-name list)
    inspector/actions.py   The only UI steps: click (guarded), hover, press Escape, goto Flow URL, back, scroll-top
    inspector/health.py    Per-state health check: enter → require → leave → verify left
    inspector/capture.py   ARIA snapshot, element inventory (with custom-element ancestry), masked screenshot
    inspector/report.py    Markdown/JSON reports with mandatory leak self-check (withheld on leak)
    inspector/diff.py      UI change detection on stable role/name pairs
    account/reader.py      Read-only identity + credit balance (VERIFIED/UNKNOWN/UNAVAILABLE)
    cli.py                 `blatifa browser|inspect|health|account`
  tests/
    unit/test_core.py                  redaction, parsing, registry schema, click guard, diff, static prohibitions
    browser/*.py + fixtures/flow_like.html   local Chrome (headless) against a Flow-like fixture
    live/test_flow_live.py             opt-in checks against real Flow (BLATIFA_LIVE=1)
```

About 1,550 lines of source (incl. registry YAML) and 1,000 lines of tests/fixtures.

Dependency direction: `cli → account/inspector → browser`. Only `browser/` launches Chrome or opens CDP connections. No production orchestration code exists (out of scope).

## 4. Key design decisions made during implementation

| Decision | Reason / evidence |
|---|---|
| Chrome runs **detached** and its pid/port live in `run/<profile>.json` (mode 600) | Separate CLI calls share one Chrome. Recovery can find the crashed instance (E-P1-07) |
| One Playwright driver per process | The sync API cannot run two drivers in one thread (found by a failing test) |
| `detach()` = `browser.close()` on a CDP connection | Verified that this only disconnects. Chrome keeps running (test `test_detach_keeps_chrome_running`) |
| Page counts as responsive while `readyState == "loading"` | First live start reported PAGE_UNRESPONSIVE during normal loading (E-P1-02) |
| Workspace root is mode 700, not just sub-folders | The first live start created `~/BlatifaStudio` as 755. Fixed and tested |
| Accessible names parsed from `aria_snapshot()` with single-quoted-YAML handling | Names containing `: ` are emitted as `- 'button "…"': text` (also visible in Phase 0 evidence) |
| Registry rejects inline regex flags such as `(?i)` | Playwright evaluates patterns as JavaScript RegExp, where Python inline flags fail silently (found by a failing test) |
| Composer `Settings` scoped by the custom element `flow-creative-agent-prompt-box` | Live inspection: the top-bar Settings sits in `flow-tile-view-header` (E-P1-03). No `nth` is used anywhere |
| Credit link with an unexpected format → UNKNOWN; no credit link → UNAVAILABLE | Distinguishes a UI change from a tier without a balance |
| Reports store only a 12-hex identity fingerprint, never the e-mail (not even masked) | Strict reading of "no secrets in reports". The masked e-mail is printed to the terminal only |
| Screenshots mask the account button, account dialog and "Hi …" greeting | Text redaction cannot clean pixels |

## 5. Safety mechanisms (prohibitions → enforcement)

| Prohibition | Enforcement | Evidence |
|---|---|---|
| No upload | `upload_media` entry `deny: true`. `Upload media` is on the deny-name list. Static test forbids `set_input_files`/`expect_file_chooser` | unit + browser tests |
| No Start generation / Approve / Always approve | `send` and `approve` are `credit_sensitive`; `always_approve` is `deny`. All are on the deny-name list. No Phase 1 state reaches them | `test_denied_and_credit_sensitive_elements_cannot_be_clicked` |
| No credit spending | Above. Balance read at the start and end of Phase 1: 40 → 40 | E-P1-10 |
| No login/MFA/CAPTCHA automation | No typing API exists in the code (static test forbids `fill`, `type`, `press_sequentially`). The user signed in manually | E-P1-01 |
| No cookie/token/secret access | Static test forbids `cookies(`, `storage_state`, `localStorage`, `sessionStorage`, `indexedDB`, `route(`, request/response listeners | `test_source_never_uses_prohibited_browser_apis` |
| No multi-account rotation | No account-switching code. `switch_account` and `sign_out` are `deny` | registry |
| No coordinate clicking | Static test forbids `mouse.click/down/up/move`. All clicks are role-based locator clicks | static test |
| No silent fallback | The validator has no fallback list. Failure ⇒ BROKEN / UNTRUSTED / SKIPPED | broken-locator tests |
| Only VERIFIED locators are clicked | The guard rejects other statuses (`test_unverified_locator_is_untrusted_and_never_clicked`) | browser test |

The Phase 1 UI interactions on live Flow were limited to: opening/closing the account panel, the ingredient picker (Escape), Agent settings (Back, no Save), the image tile's More-options menu (Escape), and navigating to an existing video's detail page and back.

## 6. Usage

```bash
cd blatifa-studio
.venv/bin/blatifa browser start --profile main      # opens real Chrome; user signs in manually
.venv/bin/blatifa browser status --profile main
.venv/bin/blatifa account --profile main            # identity + credits (read-only)
.venv/bin/blatifa health --profile main \
    --param image_tile=Blumaro \
    --param video_url=https://flow.google.com/project/<project>/edit/<video-media-id>
.venv/bin/blatifa inspect --profile main --label home [--baseline <old>.aria.yaml]
.venv/bin/blatifa browser recover --profile main    # after a crash
.venv/bin/blatifa browser stop --profile main
.venv/bin/pytest                                    # unit + local-browser tests
BLATIFA_LIVE=1 BLATIFA_PROFILE=main BLATIFA_IMAGE_TILE=… BLATIFA_VIDEO_URL=… .venv/bin/pytest -m live
```

Exit codes: 0 OK, 2 unhealthy/unknown, 3 browser not running, 4 report withheld due to leak.

## 7. Defects found and fixed during Phase 1

1. Accessible-name parser failed on YAML-quoted names → rewritten, with unit tests for every observed form.
2. Two sync Playwright drivers in one thread → process-wide driver.
3. `(?i)` regex silently never matched in the browser → pattern rewritten and schema rule added.
4. `PAGE_UNRESPONSIVE` false alarm while loading → loading counts as responsive.
5. Workspace root created 755 → forced to 700, tested.
6. Masked e-mail and full e-mail hash were written to reports → replaced by a 12-hex fingerprint. The redactor now also catches masked e-mails. Earlier reports containing them were deleted from the workspace before evidence was collected.

## 8. Known limitations

- `account.md` prints Python enum reprs (`<ReadStatus.VERIFIED: 'VERIFIED'>`). Cosmetic only.
- `media_detail_video` and `tile_menu_image` need parameters (a video URL and an image tile title). Without them they are SKIPPED, not run.
- The `ingredient_picker` leave step relies on Escape closing the picker. Verified on live Flow, but if Flow changes this, the health check reports it as a failed leave.
- Minimised-window behaviour and option B (`launch_persistent_context`) were not tested; neither is needed by the chosen architecture.
- The UI change detector compares role/name pairs only. It does not detect layout or style changes.
