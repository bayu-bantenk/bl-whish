# Phase 3 — Implementation Plan (Episode Orchestration & Offline End-to-End Readiness)

> **Ringkasan (ID):** Phase 3 menurut brief ini adalah gabungan dua bagian dari roadmap Phase 0:
> - **seluruh roadmap Phase 3** (model episode, validator, graf dependensi, prompt builder dengan lock persis);
> - **bagian offline dari roadmap Phase 4** (orkestrasi episode, resume/recovery, gate disk, tampilan progres).
>
> Yang **tidak** termasuk dan tetap terbuka: semua bagian live dari roadmap Phase 2 (adapter Flow yang menulis, eksperimen kesetiaan prompt) dan uji live Phase 4. Ambang disk mengikuti brief: peringatan di bawah 10 GiB, berhenti di bawah 5 GiB. Target 30 GiB tidak lagi wajib.

Date: 2026-11-03. Authorization: GO offline/simulated development; NO-GO credit-consuming or any real Flow state-changing action.

## 1. Pre-implementation audit (what was actually found)

| Item | Finding |
|---|---|
| Git | `blatifa-studio` is **not a git repository** (`git init` was declined in Phase 1). No uncommitted git changes exist to protect. Changes are tracked with a file inventory in the implementation report |
| Disk before | 18 GiB free (`df`), swap 5.2 GiB |
| Tests before | 178 passed, 7 skipped (Phase 2 continuation log) |
| Roadmap Phase 3 (Phase 0 doc) | "Episode & Prompt Management": models, loader/validator, dependency graph, lock manager, prompt builder with verbatim invariants, lock-drift QC, import of user prompts. Dependency: "Phase 2 Go decision (prompt format finalised from the experiment)". **Not met**: the prompt-fidelity experiment needs credits |
| Roadmap Phase 4 | Orchestration engine, recovery, pause/resume, disk gate, manifest, backups; "simulation with a FakeFlowAdapter for all 36-scene paths". Its live run and 30 GB precondition are out of reach |
| Implementation vs docs | Phase 2 `prepare_scene` duplicated part of the contract rules (dict-based). No Pydantic episode model existed. The runner ignored `output.filename_stem` / `extract_final_frame`. `flow/` had no `__init__.py`. Three earlier bugs had no dedicated regression test (Phase 1 defects 2 and 4; harness cleanup) |

## 2. Reconciliation decision

| Brief item | Roadmap source | Decision |
|---|---|---|
| Episode loading/validation, graph, ordering, readiness, prompt assembly, exact lock injection | Phase 3 | **In scope** |
| Simulated generation lifecycle, download, media validation, last-frame extraction, checkpoints, progress, resume/recovery, failure reporting | Phase 4 (simulation part) | **In scope, SIMULATED only** |
| Storage gate | Phase 4 ("disk-space gate") | In scope with the **brief's thresholds** (warn < 10 GiB, stop < 5 GiB, configurable). The roadmap's 30 GB precondition is superseded for development |
| Prompt format | Phase 3 dependency on the Phase 2 fidelity experiment | **Provisional**: the contract §5 layout is used. It may change after U-01 is measured |
| Lock manager approval workflow | Phase 3 | **Report only**: missing / changed / unapproved per lock. No approval action (the user did not authorize changing Blatifa from DRAFT) |
| Import of the user's existing prompts | Phase 3 | **Deferred**: no source material supplied |
| Pause/cancel UI, manifest, backups, daily-refresh waiting | Phase 4 | Deferred (pause/resume through the runner exists; manifest/backups not built) |
| Live adapter writes, fidelity experiment, live crash tests | Phase 2 | Remain **BLOCKED** |

## 3. Work items

| # | Item | Module |
|---|---|---|
| W1 | Pydantic episode models (contract §3; no fixed scene limit) | `episodes/models.py` |
| W2 | Validator collecting **every** issue with contract codes + per-lock report (missing / changed / DRAFT) | `episodes/validation.py` |
| W3 | Effective dependency graph, cycle detection, scheduler order, downstream set | `episodes/graph.py` |
| W4 | `prepare_scene` rebuilt on the validated model; `build_job` (prompt + start frame); `output_stem`, `extract_final_frame` honoured by the runner | `production/scene.py`, `runner.py` |
| W5 | Episode engine: next-ready-scene loop, no automatic retry, dependents blocked, storage gate, startup recovery + own-temp sweep, episode-changed detection, LIVE blocked, progress model | `production/episode.py`, `persistence/store.py` |
| W6 | SIMULATED Flow for the CLI (APFS clone of a fixture clip; the run is recorded as SIMULATED) | `simulation.py`, `media/files.clone_or_copy` |
| W7 | CLI `blatifa episode validate / status / simulate` | `cli.py` |
| W8 | Offline E2E suite: the brief §7 list, episode-level crash sweep, CLI test, missing regression tests | `tests/unit/test_episode_e2e.py`, `episode_factory.py`, … |

## 4. Safety rules kept

- No real Flow action. The engine refuses `RunMode.LIVE`; the real adapter's write methods stay BLOCKED (Phase 2).
- Locator confidence policy unchanged (clicks need high; medium/low never clickable; unknown UI fails closed).
- Octopus lock text untouched and test-locked; Blatifa/style locks stay DRAFT and are rejected in production mode.
- Manual confirmation stays a constructor-level requirement of `SceneRunner` (`confirm` callback; no auto-approve option). The CLI auto-confirms only quotes from the SIMULATED adapter, and only when `--yes-simulated` is given.
- Storage: no automatic deletion of user files. Only Blatifa's own `*.part` / `*.part.png` files inside the episode output folder are swept on recovery.
