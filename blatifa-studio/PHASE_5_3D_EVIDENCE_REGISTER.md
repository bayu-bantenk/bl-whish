# Phase 5.3d — Evidence register

Classifications: VERIFIED · PARTIALLY VERIFIED · PROPOSED · UNVERIFIED · BLOCKED. Rows E-P53D-01…17 were written during
preparation, before any execution; rows E-P53D-18…23 were added after the user executed the experiment (see the execution
report).

| ID | Claim | Class | Evidence |
|---|---|---|---|
| E-P53D-01 | Disk 8.90 GiB (< 10 GiB gate); swap 2.8/4 GiB; memory free 39–41 %; Chrome HEALTHY on the project URL | VERIFIED | `evidence/preflight_1.log` (01:27:12Z) |
| E-P53D-02 | User extended the ≥ 5 GiB override to Phase 5.3d | VERIFIED | AskUserQuestion answer "Lanjut, ≥ 5 GiB berlaku", 2026-11-06 |
| E-P53D-03 | Nonce `[blatifa-exp-12ef8b99]` has no hit in the repository before use | VERIFIED | `grep -rl 12ef8b99` → none (repo holds all earlier prompts) |
| E-P53D-04 | Octopus lock in the prompt is verbatim; SHA `2af1471e…6f12` matches episode record, established value and brief text | VERIFIED | `tools/build_prompt.py` (asserts), offline re-hash of the brief text |
| E-P53D-05 | Prompt SHA-256 `9dc27ab6…f83b`, 996 chars, contains the nonce once and `[FORMAT] … 9:16 …` | VERIFIED | `PROMPT.txt`, `shasum -a 256` |
| E-P53D-06 | Grid at 01:29:04Z: 11 tiles, unique titles, no hover, confirmation ABSENT | VERIFIED | `evidence/A0_grid_baseline.jsonl` |
| E-P53D-07 | Account identity at checkpoint A | VERIFIED (was BLOCKED) | 01:29Z `evidence/A0_ui_baseline.json`: UNKNOWN, dialog "What's new" open, not dismissed by Blatifa. User closed it; 01:41:33Z `evidence/A1_ui_after_dialog.json`: VERIFIED `d6c9f4583fa6`, no dialog, 0 chips; 01:41:34Z `evidence/A1_grid.jsonl`: grid identical to A0 (titles, types, fingerprints), no hover |
| E-P53D-08 | Video tiles on the grid expose no `data-media-id` and no UUID in any URL (image tiles do: `data-media-id`; character tiles: UUID in `/image/<uuid>`) | VERIFIED (5.3b recording + 01:29Z obs) | `docs/phase-5.3b/evidence/live/watch.jsonl`, `evidence/A0_grid_baseline.jsonl` |
| E-P53D-09 | Video tile `src` path fingerprints are stable within one session but change across sessions (e.g. "Pink octopus waving tentacle" `2d7f5ce8…` on 11-05 → `b3326746…` on 11-06) → not a stable identifier | VERIFIED | 5.3b recording vs `A0_grid_baseline.jsonl` |
| E-P53D-10 | Character tile fingerprints (Sea Lion/Octopus/Dolphin) were identical on 11-05 (5.3, 5.3b) and 11-06 | VERIFIED (3 sessions) | same files + `docs/phase-5.3/evidence/live/B_C_D_watch/live-probe.json` |
| E-P53D-11 | Detail-page route `/edit/<uuid>` identifies a video (one route per experiment seen) | PARTIALLY VERIFIED | 5.3 route `ade6bb57…`, 5.3b route `36a14bd6…`; stability on re-open never tested |
| E-P53D-12 | Nonce is readable in the stored prompt on the detail page (scene↔video association) | PARTIALLY VERIFIED | 5.3b `D_marker_paths.txt` (`main > text`, has_nonce True), 5.3 `D_marker_paths.txt`; 2 experiments, never on re-open |
| E-P53D-13 | New tile distinguishable from baseline by title multiset difference + `pending_overlay` | PARTIALLY VERIFIED | 5.3/5.3b recordings, `tests/unit/test_phase5_3_recognition.py`; titles are agent-chosen and not unique by contract |
| E-P53D-14 | Path A picker/chip locators stable | VERIFIED (2 sessions) | `docs/phase-5.3c/PHASE_5_3C_PATH_A_VERIFICATION.md` |
| E-P53D-15 | Credit balance not visible in the page tree without interaction | PARTIALLY VERIFIED | `A0_ui_baseline.json`: no node name contains "credit"; balance stays user-reported (30) |
| E-P53D-16 | `ingredient_picker.add_to_prompt` `deny: true`; `LIVE_ACTIONS_ACTIVE = False` | VERIFIED | `src/blatifa/inspector/data/flow_locators.yaml:191-197`, `src/blatifa/production/authorization.py:30` |
| E-P53D-17 | Observation plan checkpoints B–D | PROPOSED | `PHASE_5_3D_OBSERVATION_PLAN.md` |
| E-P53D-18 | Stable video identifier: detail route stable on re-open and across days/restarts | PARTIALLY VERIFIED | new route `a25e3913…` at 02:42Z and 02:48Z; old route `36a14bd6…` on 11-05 and 11-06 (`evidence/D_detail`, `D2_second_tile`, `D3_first_tile_reopen`) |
| E-P53D-19 | User sent + approved before checkpoints A/B (deviation) | VERIFIED | chat history read after the fact; watcher start 01:52:21Z; `PHASE_5_3D_EXECUTION_REPORT.md` §2 |
| E-P53D-20 | Cost 10 credits, single video; balance 30 → 20 | VERIFIED (quote) / user-reported (balance) | `evidence/selftest_quote_idle.json`; user message |
| E-P53D-21 | Same-title videos distinguished by route + nonce | VERIFIED (1 pair) | `D_detail` vs `D2_second_tile` markers |
| E-P53D-22 | Stored prompt of the new video: nonce, full Octopus lock, style lock, 9:16, character ingredient image | VERIFIED | `evidence/D_detail`, `D_detail_locks` |
| E-P53D-23 | Grid `src` fingerprint of the new tile unchanged across one restart while the old tile's changed | VERIFIED | `watch.jsonl` vs `A2_grid_after_restart.jsonl` |
