# Phase 3 — Implementation Report

> **Ringkasan (ID):** Blatifa Studio sekarang bisa memproduksi **episode utuh secara simulasi**. Episode dimuat dan divalidasi dengan laporan lengkap. Urutan adegan disusun dari graf dependensi. Prompt dirakit dengan lock Octopus yang **persis sama**. Frame awal diambil dari frame terakhir adegan sebelumnya. Progres tersimpan per adegan, dapat dilanjutkan setelah crash atau restart, dan kegagalan dilaporkan per adegan beserta dampaknya ke adegan yang bergantung.
>
> Semua generate di fase ini adalah **SIMULATED**: tidak ada satu pun aksi di Google Flow dan tidak ada kredit terpakai. Mode LIVE ditolak oleh kode.

Period: 2026-11-03 09:48–11:00 WIB. Working directory: `~/Developments/My Project/blatifa-studio` (not a git repository).

## 1. Implemented capabilities

| # | Capability (brief §4) | Implementation | Kind of evidence |
|---|---|---|---|
| 1 | Episode loading & validation | `episodes/models.py` (Pydantic, `extra=forbid`, no fixed scene limit) + `episodes/validation.py` (collects **all** issues; error/warning severity; per-lock report) | unit (real sample + generated episodes 1–120 scenes) |
| 2 | Scene dependency graph | `episodes/graph.py`: frame dependency plus `depends_on`, cycle detection with the cycle path, downstream set | unit |
| 3 | Dependency ordering | topological order; among ready scenes the lowest `order` first (state machine §7) | unit (sizes 1, 7, 36, 120) |
| 4 | Scene readiness | engine: dependencies FRAME_READY, scene has no blocking issue, storage OK; runner VALIDATING: start image exists, every lock verbatim in the prompt | simulated E2E |
| 5 | Prompt assembly | `production/scene.assemble_prompt` (contract §5 layout, provisional until U-01) | unit + E2E |
| 6 | Exact Character Lock injection | lock text inserted unmodified; invariant check; every submitted prompt in the 36-scene run contains the user's Octopus text byte-for-byte | E2E |
| 7 | Start-frame resolution | custom image (inside workspace, sha256 check), previous / specific scene final frame from the store, flow_asset → `UNSUPPORTED_START_FRAME` (BLOCKED) | E2E |
| 8 | Simulated generation lifecycle | the Phase 2 `SceneRunner` driven by the engine; `FakeFlow` (tests) and `SimulatedFlow` (CLI) | SIMULATED |
| 9 | Simulated download & media validation | real ffprobe + full decode on cloned fixture clips; junk / landscape / truncated payloads → `INVALID_ASSET` | SIMULATED + real ffmpeg |
| 10 | Last-frame extraction | real ffmpeg (`-sseof`, frame-select fallback); `extract_final_frame: false` honoured | real ffmpeg on fixture |
| 11 | Checkpoint persistence | SQLite write-ahead per transition (Phase 2), `episode_run` table (mode + episode file hash), latest-attempt queries | unit + E2E |
| 12 | Episode progress | `EpisodeProgress`: counts, done/total, percent, storage level, stop reason; per scene status / state / attempts / error / checkpoint / deps / waiting / start-frame source + path / video / last frame / issues | E2E + CLI |
| 13 | Resume & recovery | `EpisodeEngine.recover`: startup scan (interrupted → RECONCILING) + sweep of Blatifa's own temp files; resume continues the latest non-terminal attempt; episode-file change during production → manual (`EPISODE_CHANGED_DURING_PRODUCTION`) | crash sweeps |
| 14 | Failure reporting | per-scene error codes; dependents `BLOCKED_BY_DEPENDENCY`; independent chains continue; no automatic retry | E2E |

User visibility (§9): `blatifa episode validate FILE [--allow-draft]`, `blatifa episode status FILE [--json]`, `blatifa episode simulate FILE --clip MP4 [--max-scenes N] [--yes-simulated]` (SIMULATED workspace `<workspace>/simulation/`, its own `simulation.db`).

## 2. Storage & temporary files (§8)

| Rule | Implementation | Status |
|---|---|---|
| Disk check before every scene | engine: `free < stop_bytes` → stop before any Flow/download step; `< warn_bytes` → `storage=WARN` | VERIFIED (unit, with injected free-space values) |
| Configurable thresholds | `StorageThresholds(warn_bytes=10 GiB, stop_bytes=5 GiB)`; CLI `--warn-gib`, `--stop-gib` | VERIFIED |
| Temp-file lifecycle | downloads land as `<stem>.mp4.part`, fsync, atomic rename; frames as `.part.png` then rename; the runner deletes its `.part` on failure; recovery sweeps leftover `*.part` / `*.part.png` **only inside `episodes/<episode_id>/`** | VERIFIED (unit: a user file in the same folder survives) |
| No duplicated large media | simulated results are APFS copy-on-write clones (`cp -c`) of the fixture | `cp -c` success VERIFIED; actual block sharing **not measured** (`du` cannot see it) → PARTIALLY VERIFIED |
| No automatic deletion of user files | nothing outside the episode output folder is ever deleted; outputs are never overwritten | VERIFIED (code + unit) |
| Small fixtures only | the 2.8 MB Phase 0 clip and generated 1–120-scene JSON; no artificial large media | — |
| Test temp files (found during Phase 3) | the first full runs left ≈ 1.5 GB per run in pytest's temp folder (the test FakeFlow *copied* the clip in every crash-sweep scenario; pytest kept 3 runs). Fixed: the test FakeFlow clones the clip, and `pyproject.toml` sets `tmp_path_retention_policy = "failed"`, `tmp_path_retention_count = 1`. Measured afterwards: a full run leaves 0 bytes. With the new setting pytest itself pruned two older temp folders from today's earlier runs (≈ 0.9 GB of test output). `pytest-41` (1.5 GB, test output from an earlier run today) remains until pytest prunes it or you approve removing it | VERIFIED |

## 3. Changes to existing code (regression-relevant)

| File | Change | Why |
|---|---|---|
| `production/scene.py` | rebuilt on the Pydantic model + validator; same public API and error codes | one source of rules |
| `production/runner.py` | `SceneJob.output_stem`, `extract_final_frame` | contract fields were ignored |
| `persistence/store.py` | `episode_run` table; `latest_attempt`, `attempt_count`, `last_event`, `register_episode_run`, `episode_mode` | episode resume + SIMULATED/LIVE separation |
| `browser/engine.py` | `RESPONSIVE_READY_STATES` constant (behaviour unchanged) | testable regression for Phase 1 defect 4 |
| `media/files.py` | `clone_or_copy` | no duplicated simulated media |
| `tools/devserver_leak_check.py` | `--ready-timeout` | testable regression for the harness cleanup bug |
| `tests/unit/simflow.py` | multi-scene features. The no-resubmit violation rule is now **per scene (prompt)**: the old global rule would flag every second scene of an episode. Its strength for a single scene is unchanged | E2E |
| `tests/unit/test_scene_and_crash_sweep.py`, `test_runner_simulation.py` | none in Phase 3 | — |

No existing assertion was removed or weakened.

## 4. File inventory (no git: files created or modified in Phase 3)

New: `src/blatifa/episodes/{__init__,models,graph,validation}.py`, `src/blatifa/production/episode.py`, `src/blatifa/simulation.py`, `src/blatifa/flow/__init__.py`, `tests/unit/episode_factory.py`, `tests/unit/test_episode_e2e.py`, `docs/phase-3/*`.
Modified: `pyproject.toml` (pytest temp retention only), `src/blatifa/{cli.py, browser/engine.py, media/files.py, persistence/store.py, production/runner.py, production/scene.py}`, `tools/devserver_leak_check.py`, `tests/unit/{simflow.py, test_core.py, test_devserver_tool.py}`, `tests/browser/test_engine_recovery.py`.
Untouched: Phase 0/1/2 docs and evidence, the episode sample, `~/BlatifaStudio`, both Chrome profiles, every file outside `blatifa-studio` (apart from the session scratchpad).

## 5. Known limitations

- **Everything about generation is SIMULATED.** Real Flow timing, wording, failures, the virtualised grid and media-id resolution are not exercised (Phase 2 blockers A1–A6 remain).
- The prompt layout is provisional until the prompt-fidelity experiment (U-01).
- No manifest file, backups, pause/cancel commands, or daily-credit-refresh waiting (roadmap Phase 4 items not in this brief).
- One process at a time: the engine assumes it is the only writer to its database and episode folder.
- Checkpoint timestamps are UTC ISO-8601 (display conversion to WIB not done).
- `du` overstates SIMULATED output size because it cannot see APFS clone sharing.
