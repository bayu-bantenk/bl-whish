# Phase 5 — Implementation Report (Live Read-Only Integration Verification)

> **Ringkasan (ID):** Phase 5 menjalankan inspeksi **live read-only** terhadap Google Flow: 1 probe halaman detail dan 4 observasi grid, tanpa satu klik pun dari Blatifa. Saldo kredit 50 → 50, dibaca sendiri oleh pengguna.
>
> Temuan utama:
> - UI Flow **berubah**: tile video selesai tidak lagi punya `img "Generated video thumbnail"`, sehingga locator `grid.video_thumbnail` BROKEN.
> - Ada jenis tile baru: tile karakter.
> - Media id video **tetap tidak bisa didapat** secara read-only.
> - Isolasi folder temp pytest sudah dibangun dan dibuktikan sebelum test lain dijalankan.

Period: 2026-11-03 14:05–15:05 WIB. Working directory: `~/Developments/My Project/blatifa-studio` (not a git repository).

Labels: **VERIFIED LIVE** (observed read-only on the real Flow page in this phase) · **VERIFIED OFFLINE** (tests, fixtures, recorded evidence) · **PARTIALLY VERIFIED** · **SIMULATED** · **UNVERIFIED** · **BLOCKED**.

## 1. pytest temporary-directory safety (done before any other test ran)

**Mechanisms found** (pytest 9.2.0 source, read):
1. Without `--basetemp`, numbered folders `pytest-of-<user>/pytest-N` older than `tmp_path_retention_count` are pruned when the session ends. With count `1`, this is what removed `pytest-41` in Phase 4.
2. With `--basetemp`, an **existing** folder is wiped with `rm_rf` at the start.
3. At session end, pytest removes the basetemp only if it chose that basetemp itself.
4. With policy `failed`, `tmp_path` removes the folder of each passed test inside the current basetemp.

The test code and the source modules contain no other deletion outside their own `tmp_path` or own files (grep: `rmtree`, `unlink`, `remove`, `replace`, `rename`).

**Fix:**
- `tests/pytest_safety.py`, loaded by `tests/conftest.py`, does the following:
  - every run gets a **new, unique** basetemp `<tmp>/blatifa-pytest-runs/run-<utc>-<pid>-<random>`, which also turns off pytest's numbered-folder pruning entirely;
  - an existing `--basetemp` is refused;
  - the run folder carries a token marker, and only that exact folder is removed, only when every test passed;
  - a failed run keeps everything;
  - entries of `pytest-of-<user>` and of earlier Blatifa runs are listed at the start and checked at the end. If one disappeared, the session fails loudly.
- `pyproject.toml`: `tmp_path_retention_count` set from 1 to 1000000, so plain pytest without the plugin never prunes either.

**Proven by:** `tests/unit/test_pytest_isolation.py`, 7 tests. Inner pytest runs use an isolated TMPDIR seeded with a sentinel folder, `pytest-1`, `pytest-2` and an old Blatifa run:
- the hazard is reproduced without the plugin (`pytest-1` pruned);
- with the plugin, a passing run keeps every pre-existing folder and removes only its own;
- a failing run keeps its folder and cleans nothing;
- an existing `--basetemp` is refused and left intact;
- a disappearing pre-existing folder fails the session.

Real temp folder: `pytest-46`, which already existed before Phase 5, survived every run in this phase (logs). Failed runs during development were kept by design. They are not deleted, and their size is in the final audit.

## 2. Read-only live tooling

| Component | What it does | Guarantee |
|---|---|---|
| `flow/live_probe.ReadOnlyPage` / `ReadOnlyLocator` | The only page object the probes get | No click, fill, type, press, hover, check, upload, drag, focus, goto, reload, keyboard or mouse. Locators refuse every action method. `evaluate` runs only two vetted read-only scripts. Tested offline with a fake page and in headless Chrome (a click is refused before it reaches the page; `__clicks` stays 0) |
| `identity_without_interaction` | Identity from the identity button's accessible name | The old `read_identity` scrolls to the top first; the guard refuses it (tested) |
| `credits_without_click` | Balance only if it is already in the accessibility tree | The old `read_credits` clicks the account button; the guard refuses it (tested) |
| `TILE_PROBE_JS` / `MEDIA_ELEMENTS_JS` | Attributes and geometry of grid tiles / media elements | Read-only DOM reads only (static test of forbidden tokens) |
| `redact_url` / `redact_text` | URL shape: scheme, host, path. UUIDs are kept, other long tokens become `<tok:N>`, **every query value is redacted**. Text keeps only progress % and durations | Tested; no signature value in the evidence |
| `observe_tile` | Tile type and generation status. COMPLETED needs a thumbnail **plus** a second signal (video element, duration, or identifier); a thumbnail alone is UNKNOWN; lazy (not loaded) is UNKNOWN; FAILED/PENDING are never produced without evidence | Unit + fixture tests |
| `confirmation` | ABSENT / ANSWERED / OPEN (+ cost READABLE / UNKNOWN) / AMBIGUOUS. Open or unknown always blocks | Unit + fixture tests |
| `dialogs`, `detect_changes`, `locator_matrix`, `proposed_confidence` | Unexpected dialogs; added/removed tiles, structure, state and identifier changes between observations; locator validation **without any enter step**; evidence-based proposals that are **never applied** automatically | Unit + fixture tests |
| `blatifa live-probe` | Attach to the dedicated profile, refuse a page that is not one Flow project or media detail page, observe N times, write a redacted report (leak check) and an optional masked screenshot | Live use below |

One mistake was caught by an existing Phase 1 test. My first `live-probe` version counted network requests (`page.on("request")`), which the Phase 1 source scan forbids. The listener was **removed** and the test left unchanged. It never ran live.

## 3. Live session (2026-11-03, dedicated profile `main`)

| Step | Who | Result |
|---|---|---|
| Start Chrome (`blatifa browser start --profile main`) | Blatifa | HEALTHY, CDP on 127.0.0.1, Chrome 156 |
| Sign-in, opening the project, opening the video detail page | **User** | — |
| Detail-page probe (`/edit/6e7ded7f…`) | Blatifa, read-only | Identity button **not present** on the detail page → `IDENTITY_UNREADABLE` → stopped there |
| Credit balance, start | **User**, read in the account panel | **50** |
| Back to the project grid | **User** | — |
| Grid probes: 2 × (2 observations; 10 s, then 30 s apart) | Blatifa, read-only | Identity VERIFIED, 9 tiles, no dialog, confirmation ABSENT, no change between observations |
| Masked screenshot | Blatifa | Account avatar masked; checked by eye before it was kept |
| Credit balance, end | **User** | **50** (no change) |
| Close Chrome (`blatifa browser stop`) | Blatifa | NOT_RUNNING; profile kept |

Credit balance was not readable without a click (`UNAVAILABLE_WITHOUT_CLICK`, every observation). The user chose to read it themselves. Their message "kamu boleh cek semua sendiri" was **not** taken as permission to click: the brief forbids clicks in writing.

## 4. Live findings

### 4.1 UI change: finished video tile

| | Recorded (Phase 0/1, 2026-11-02) | Live (2026-11-03) |
|---|---|---|
| Video tile | `img "Generated video thumbnail"` | `flow-video-tile` > `video[aria-label, controlslist, disablepictureinpicture, loop, src]`, **no** such img |
| `grid.video_thumbnail` | VERIFIED / medium | **0 matches in 4 observations** → registry set to **BROKEN / low** with this evidence |
| Effect on the existing adapter | — | `read_tile` (ARIA) would read the finished video as **UNKNOWN**, which is fail-closed. A live runner would end in `RENDER_TIMEOUT` → manual and never treat the video as finished. **Not changed in Phase 5**: changing the reader changes runner behaviour, which needs a separate approval |

New tile type: `flow-character-tile` (img "Character thumbnail", `src` = `flow-content.google/image/<uuid>`), from Flow's new "Characters" section. It is classified UNKNOWN, with no registry entry.

### 4.2 Media identifiers (investigation)

| Source element | Attribute | Observed format (redacted) | Stable? | Unique? | Usable for reconciliation? |
|---|---|---|---|---|---|
| Grid image tile `img[alt="Tile displaying a user's image"]` | `data-media-id` | UUID | Yes: same 4 values as Phase 0 (2026-11-02) and in all 4 observations | One per tile | **Yes for images**. Correspondence to `/edit/<uuid>` remains **UNVERIFIED**: the recorded image detail URL `24f29e76…` matches no `data-media-id` |
| Grid image tile, same img | `src` | `https://flow.google.com/asb/<tok:182>` (no query) | Same fingerprint over ~3 min | Unknown | No: opaque token |
| Detail page image thumbnails | `src` | `https://flow-content.google/image/<uuid>?Expires&KeyName&Signature` (values redacted) | — | The UUID **equals the tile's `data-media-id`** (5 of 5 images) | Confirms `data-media-id` is the image's content id |
| Grid **video** tile `video` | `src` | `https://flow.google.com/asb/<tok:181>` | Same fingerprint over ~3 min | Unknown | **No**: opaque, no UUID |
| Detail-page video thumbnail `img[alt="Generated video thumbnail"]` | `src` | `https://flow.google.com/asb/<tok:172>` | — | Differs from the grid token of the same video | **No** |
| Video tile, any attribute | `data-*` | none | — | — | — |
| Video route id `6e7ded7f…` (URL of the page the user opened; same as Phase 0) | — | not present in any attribute on the grid or the detail page | Stable route id since Phase 0 | — | Only reachable by navigation, which needs a click → BLOCKED |

**Conclusion:** no reliable read-only identifier exists for videos. `MEDIA_ID_UNRESOLVED` stays.

### 4.3 Generation status, cost confirmation, lazy loading

- **Generation status:** only finished media was present. No rendering, failed or queued tile was observed live, so GENERATING, FAILED and PENDING are **UNVERIFIED live**. The finished video reads as UNKNOWN: the new structure has no recognised thumbnail, and completion is never inferred.
- **Cost confirmation:** no confirmation was present (ABSENT, correctly read). OPEN, cost-readable, unknown-cost and ambiguous states are **VERIFIED OFFLINE only**.
- **Lazy loading:** 9 tiles in the DOM, all in the viewport and loaded. The page is scrollable (screenshot), but without scrolling nothing more can be said. Virtualisation remains **UNVERIFIED live**.

### 4.4 Locator confidence matrix (live read-only, 4 observations, idle project page)

| Locator | Registry before | Live result | Assigned (Phase 5) | Clickable in Phase 5? |
|---|---|---|---|---|
| navigation.project_nav | VERIFIED / high | HEALTHY ×4 | HIGH (re-confirmed live, read-only) | no |
| account.account_button | VERIFIED / high | HEALTHY ×4 | HIGH (re-confirmed) | no |
| account.identity_button | VERIFIED / high, deny | HEALTHY ×4 | HIGH (re-confirmed); absent on the detail page | no (deny) |
| composer.prompt_input, add_ingredient, agent_instructions | VERIFIED / high | HEALTHY ×4 | HIGH (re-confirmed) | no |
| composer.send (Start generation) | VERIFIED / high, credit-sensitive | HEALTHY ×4 (unique, visible, disabled) | HIGH for observation; never clickable | **no** |
| grid.tile | VERIFIED / medium | HEALTHY ×4 (9) | MEDIUM kept; **HIGH candidate**, needs your approval. Not applied, because HIGH would make it clickable (`open_media_detail`) | no |
| grid.image_thumbnail | VERIFIED / medium | HEALTHY ×4 (5) | MEDIUM kept; HIGH candidate (needs approval) | no |
| grid.video_thumbnail | VERIFIED / medium | **BROKEN ×4 (0)** | **BROKEN / LOW** (registry updated) | no |
| grid.progress_text | PARTIALLY_VERIFIED / low | absent (no rendering tile) | LOW / UNVERIFIED live | no |
| cost_confirmation.permission_group | VERIFIED / medium | absent | MEDIUM / UNVERIFIED live | no |
| cost_confirmation.approve | VERIFIED / medium, credit-sensitive | absent (scope missing) | MEDIUM / **UNVERIFIED live** | **no** |
| cost_confirmation.reject | VERIFIED / medium, deny | absent | MEDIUM / **UNVERIFIED live** | **no** |
| cost_confirmation.always_approve | VERIFIED / medium, deny | absent | MEDIUM / UNVERIFIED live | no |
| Prompt text (media_detail.history_*) | VERIFIED / medium | not checked (history panel not open) | UNVERIFIED live | no |
| New: video `video` element, character tile | — | observed | UNVERIFIED (no registry entry yet) | no |

No locator was promoted. The only registry change is the evidence-based demotion of `grid.video_thumbnail`.

## 5. Changes to existing code

| File | Change | Why |
|---|---|---|
| `pyproject.toml` | `tmp_path_retention_count = 1000000` (was 1) | never prune earlier pytest folders |
| `tests/conftest.py` (new), `tests/pytest_safety.py` (new) | temp isolation | brief §3 |
| `src/blatifa/inspector/data/flow_locators.yaml` | `grid.video_thumbnail`: VERIFIED/medium → **BROKEN/low**, with live evidence | live finding §4.1 |
| `src/blatifa/production/authorization.py` | read locators that are BROKEN are reported (`LOCATOR_BROKEN`) | fail closed |
| `tests/unit/test_phase4_authorization.py` | exact expected reasons now include the two video-thumbnail reasons (stricter; nothing removed) | registry change |
| `src/blatifa/cli.py` | `live-probe` (grid and detail) | brief §4–5 |

Unchanged: adapter write methods (BLOCKED), authorization flag (`False`), runner, state machine, readers, locks, episode sample.

## 6. File inventory (no git)

- **New:** `src/blatifa/flow/live_probe.py`, `tests/conftest.py`, `tests/pytest_safety.py`, `tests/fixtures/flow_probe.html`, `tests/unit/{test_pytest_isolation,test_phase5_probe,test_phase5_live_evidence}.py`, `tests/browser/test_live_probe_fixture.py`, `docs/phase-5/*`.
- **Modified:** as listed in §5.

Outside the project:
- the dedicated profile `~/BlatifaStudio/profiles/main` was used, not modified by Blatifa (Chrome itself updates its own profile data while running);
- `~/BlatifaStudio/inspections/*-live-*` holds the original redacted reports;
- `<tmp>/blatifa-pytest-runs/` holds the kept failed runs.
