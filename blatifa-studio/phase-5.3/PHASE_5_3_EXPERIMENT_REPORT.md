# Phase 5.3 — Controlled Generation Experiment: Report

Experiment `EXP-P53-20261105-95B8` · nonce `[blatifa-exp-6d7b904b]` · 2026-11-05 · account fingerprint `d6c9f4583fa6` · project `562eec3d-…1ebd`

**One video was generated.** The user sent the prompt and clicked Approve. Blatifa made no click or input; every read was read-only (accessibility tree and DOM properties) with no network instrumentation. There were no retries, no extra scenes, no download, no publishing and no account switch.

## 1. Timeline (WIB)

| Time | Event | Evidence |
|---|---|---|
| 16:07–16:20 | Preflight: disk 10.02 GiB, swap 2.0/3 GiB, identity VERIFIED (after the user closed a dialog) | `evidence/preflight.log` |
| 16:20–16:40 | Nonce reader added (offline) + 5 tests; full suite 367 passed / 7 live skipped | `evidence/pytest_full.log` |
| 16:44 | **A (before):** 3 observations, 9 tiles, stable, no hover | `evidence/live/A_before/` |
| ~16:55 | Prompt sent by the user; agent quote: *"Would you like me to kick off this 1 video generation, costing 10 credits?"* → gate passed (readable, 1 video, 10 ≤ 50); nonce present in the sent message | `evidence/live/P1_confirmation.json` |
| 17:02–19:03 | **Mac asleep** (lid closed, *Clamshell Sleep*); the watcher was suspended | `pmset -g log` |
| 19:07:40–19:08:45 | Watcher obs. 1–4: quote still OPEN | `evidence/live/B_C_D_watch/` |
| ~19:08:50 | User approved (confirmation → ANSWERED at obs. 5) | same |
| 19:09:01–19:09:26 | **B (generating)**, obs. 5–6 | same |
| 19:09:52–19:10:37 | **C (completed, rest)**, obs. 7–10 | same |
| 19:10:53 | obs. 11: the new tile was hovered (playing `<video>`) | same |
| 19:11:13–19:37:30 | **D (stable)**, obs. 12–90: 79 identical observations (paused `<video>`, after-hover state) | same |
| 19:39 | User opened the new tile; detail page read | `evidence/live/D_detail/`, `evidence/live/D_marker_paths.txt` |

## 2. Findings

**New tile.** Exactly **one** new tile by multiset difference ("Pink octopus waving in water"). No pre-existing tile disappeared, and identity was unchanged in all 90 observations.

**B, generating** (obs. 5–6):
- tile structure: `flow-video-tile > flow-pending-tile` + `flow-soupy-overlay[aria-hidden]`;
- texts of length 11, 2→3 (likely a progress %), **764** (= prompt length) and 15;
- no thumbnail, no `<video>`.

**C, completed at rest** (obs. 7–10):
- `flow-pending-tile` and the overlay are gone;
- `img[alt,draggable,src]` (thumbnail) is present, as in the Phase 5.2 rest state;
- texts changed to lengths 11, 8, 4, 9, 11, 28.

**Hover and D:** a playing `<video>` appeared when hovered; after that, a paused `<video>`, exactly like Phase 5.2.

**Video properties:**
- duration 7.918005 s;
- **1280×720 (16:9 landscape, not 9:16)**: the prompt did not name an aspect ratio, so the agent used its default;
- muted, `autoplay` false.

**Media ids:** none on the tile (`data_media_ids` [], 0 candidates).

**Detail page** `/edit/ade6bb57-7fbb-4b34-a66a-c65a27bfcd50` (opened by the user's click):
- one `text` node of 764 characters directly under `main`;
- it contains the **full prompt (whitespace-collapsed) and the full Octopus lock verbatim**, including the nonce;
- no agent chat on the page ("Would you like me", "Permission options", composer, "Approve": all absent);
- the heading is the new tile's title;
- the route id is not in any media attribute;
- the thumbnail `src` carries a different uuid (`8a1f5e9f-…`), which is **not** used as an identity (rule);
- there is no `<video>` on the detail page (as in Phase 5.2).

## 3. Rule compliance and deviations

- **Hover:** obs. 6 (Dolphin hovered) and obs. 11 (the new tile hovered) are **discarded**, because of `discard_if_any_tile_hovered`. That leaves **1 valid B observation**, below the minimum of 3, and 4 valid C observations.
- **Mac sleep:** for about 2 h the watcher was suspended. The quote stayed open throughout, so no observation of the generation was lost, but timings before 19:07 are unrecorded.
- **Disk:** the user lowered the gate to 5 GiB for this experiment. Disk went 10.02 → 8.97 GiB, swap 3.3/4 GiB.
- **Credit balance:** 50 → **40** (both user-reported: 50 on 2026-11-03, 40 after this experiment). The change of −10 **equals the quote**. The balance itself is not readable without a click.

## 4. Code changes (Phase 5.3)

| File | Change |
|---|---|
| `src/blatifa/flow/live_probe.py` | `find_markers()` (pure, offline over a captured tree; reports roles only); `DetailResult.markers` (default empty); `probe_detail(..., markers=)` |
| `src/blatifa/cli.py` | `live-probe --find-text` (repeatable), printed and stored in the detail report |
| `tests/unit/test_phase5_3_markers.py` | new, 5 tests |

Not changed: runner, state machine, reconcile, gates, authorization, registry, adapter.

## 5. Verdicts

| # | Capability | Verdict |
|---|---|---|
| 1 | Controlled single generation | **DONE**: 1 video, quote 10 credits, balance 50 → 40 (user-reported); within the 50-credit budget |
| 2 | Generating vs completed detection | **OBSERVED (n=1), not VERIFIED**. Candidate signal: `flow-pending-tile`/`flow-soupy-overlay` present in B and absent in C/D. Only 1 valid B observation; must be re-confirmed. Production: **NOT READY** |
| 3 | Video media identity | **PARTIALLY RESOLVED**: the route id `ade6bb57-…` is known only from the detail URL after a user click; the tile carries no id |
| 4 | Scene-to-video association | **VERIFIED for n=1**: one new tile by set difference + the detail page of route `ade6bb57-…` stores the full prompt with the nonce and the lock verbatim. Requires opening the detail page (a click, not authorized for automation) |
| 5 | Production runner readiness | **NOT READY** (unchanged) |
| 6 | Aspect ratio | **EXPLAINED, no production change needed**: the hand-written experiment prompt lacked "9:16" and Flow's video default is 16:9. The production builder (`assemble_prompt`) always adds `[FORMAT] One video, 9:16, …`; the Phase 0 prompt with 9:16 gave 720×1280. QC (`check_asset`) rejects 1280×720. Pinned by `tests/unit/test_phase5_3_aspect.py` (3 tests); unit suite 327 passed, ruff clean |

**No overall PASS.**
