# Implementation Roadmap

> **Ringkasan (ID):** Urutan fase dari brief pada dasarnya **masuk akal**, tetapi saya usulkan 4 perubahan berdasarkan temuan discovery:
> 1. Pembacaan identitas akun dan saldo kredit (hanya membaca) dipindah ke **Phase 1**, karena sejak Phase 2 sistem sudah memakai kredit dan butuh "rem pengaman".
> 2. Penyimpanan SQLite dan inti state machine dipindah ke **Phase 2**, karena satu adegan pun harus bisa pulih dari crash tanpa membuang kredit.
> 3. Phase 2 punya **gerbang Go/No-Go untuk risiko penulisan ulang prompt** oleh agen Flow (penting untuk lock Octopus).
> 4. Phase 5 difokuskan ke **banyak akun dan perencanaan kredit**.
>
> Setiap fase di bawah punya ruang lingkup, syarat, hasil, kriteria lulus, tes, risiko, dan hal yang tidak termasuk.

## Changes to the proposed sequence

| # | Change | Justification (evidence) |
|---|---|---|
| C1 | Read-only identity + credit reading moves into Phase 1 | Credits are readable from DOM (E-FLOW-17); Phase 2 spends credits (10/clip, E-FLOW-12) and must have gates before the first automated spend |
| C2 | Minimal SQLite persistence + state machine core move into Phase 2 | A crash between Approve and download would otherwise waste credits; recovery requires write-ahead state from the very first automated generation |
| C3 | Phase 2 includes a prompt-fidelity experiment with a Go/No-Go gate | Agent rewrote the prompt (E-FLOW-20); if locks cannot be preserved, later phases are built on a broken assumption |
| C4 | Phase 5 renamed "Multi-Account & Credit Planning" | Single-account credit gates already exist from Phases 1–2; Phase 5 adds multiple profiles, user-initiated switching, planning |
| — | Pre-condition before Phase 4: free disk space | 11 GiB free (E-ENV-02); Chrome profile 242 MB after one session (E-ENV-05) |

Sequence otherwise unchanged: 1 Browser Foundation → 2 Single Scene → 3 Episode & Prompt → 4 Orchestration → 5 Multi-Account & Credit Planning → 6 Desktop → 7 Assembly & Finalization.

---

## Phase 1 — Browser Automation Foundation

- **Scope:** project skeleton (`pyproject.toml`, uv, Python 3.12, ruff, pytest); `BrowserEngine` (launch real Chrome per profile + CDP attach, crash detection, restart); `FlowUIInspector` (capture, registry YAML + Pydantic schema, validator, health checks for `project_idle`, `ingredient_picker_open`, `account_dialog`, `media_detail_video`); read-only `current_identity()` and `read_credits()`; redaction utility; CLI `blatifa inspect`, `blatifa health`; complete the manual checklist items in `FLOW_UI_DISCOVERY.md` §6 that need no credits (1–5, 8).
- **Dependencies:** Phase 0 approval; user approval to install packages.
- **Deliverables:** `blatifa/browser/`, `blatifa/inspector/`, `flow_locators.yaml` (only VERIFIED entries), baseline ARIA snapshots, inspection reports.
- **Acceptance criteria:** Chrome starts with a dedicated profile and the user can log in; identity and balance read with status VERIFIED; all registry entries for non-credit states validate HEALTHY; deliberately broken locator produces `BROKEN` + report, no click; zero credits spent; no secrets in reports (automated grep check).
- **Required tests:** unit (registry schema, validator rules on static HTML fixtures, redaction, credit text parsing); integration (manual-marked) against live Flow: health checks; crash test (kill Chrome → detect → restart).
- **Risks:** Google sign-in behaviour with option B; Flow UI change during development; Chrome auto-update.
- **Out of scope:** any click on `Start generation`/`Approve`; uploads to Flow; episode JSON; UI.

## Phase 2 — Single Scene Production

- **Scope:** `GoogleFlowAgentAdapter` (attach image from Flow asset and from local upload, submit, cost quote parsing, approve/reject, poll, result identification by set difference, download); `VideoProcessingEngine` (ffprobe, decode check, last frame); minimal SQLite (attempt, state_event, ledger, asset); state machine core including `RECONCILING`; spending gate; **prompt-fidelity experiment** (Agent instructions + explicit verbatim wrapper; measure stored prompt vs submitted).
- **Dependencies:** Phase 1.
- **Deliverables:** CLI `blatifa run-scene --prompt-file … --start-image …`; reconciliation tool; experiment report `docs/phase-2/PROMPT_FIDELITY.md`.
- **Acceptance criteria:** 3 consecutive single-scene runs succeed end-to-end; each crash scenario 1, 2, 3, 7, 10 tested by killing the process at that state, with **no duplicate generation**; cost never approved when quote missing or > cap; downloaded file valid and frame extracted. **Go/No-Go:** Octopus lock key phrases preserved in stored prompt in ≥ 9/10 trials (or user explicitly accepts a QC-review workflow).
- **Required tests:** unit (state transitions table-driven, ledger write-ahead, ffprobe parsing with fixture MP4 — the Phase 0 test file can be reused); integration (live, credit-consuming, user-approved budget e.g. ≤ 100 credits); fault-injection tests.
- **Risks:** prompt rewriting; agent wording changes; queue delays; credit budget (~5 clips/day on current tier).
- **Out of scope:** multi-scene episodes; multiple accounts; UI.

## Phase 3 — Episode & Prompt Management

- **Scope:** Pydantic episode models, loader/validator, dependency graph; Character Lock Manager (hash, approval workflow); Prompt Builder with verbatim invariants; lock-drift QC; import of user's existing scene prompts.
- **Dependencies:** Phase 2 Go decision (prompt format finalised from the experiment).
- **Deliverables:** `blatifa/episodes/`, `blatifa/prompts/`, `blatifa validate episode.json`, approved Blatifa Family lock library.
- **Acceptance criteria:** sample and one real 36-scene episode validate; invalid fixtures produce the documented error codes; property tests prove locks appear verbatim; Octopus lock hash `2af1471e…6f12` unchanged.
- **Required tests:** unit + property-based (Hypothesis optional) for prompt assembly; schema fixtures for every validation rule.
- **Risks:** user's existing prompts not structured; DRAFT locks not yet approved.
- **Out of scope:** running production.

## Phase 4 — Production Orchestration

- **Scope:** Scene Scheduler; full Production Engine over an episode; Recovery Manager startup scan; pause/resume/cancel; disk-space gate; daily-refresh waiting on the same account; manifest generation; backups.
- **Dependencies:** Phases 2 and 3; **free disk ≥ 30 GB** (or external workspace).
- **Deliverables:** `blatifa produce episode.json`, resumable across restarts.
- **Acceptance criteria:** a 6-scene test episode (≈60 credits, spread over days if needed) completes with at least one forced restart mid-episode and no duplicate generation; all 12 failure scenarios have a passing test (automated or documented manual).
- **Required tests:** simulation with a `FakeFlowAdapter` for all 36-scene paths and failures; live run on a short episode.
- **Risks:** long wall-clock time (credit-limited); manual activity in the same Flow project; agent nondeterminism.
- **Out of scope:** multi-account switching; GUI.

## Phase 5 — Multi-Account & Credit Planning

- **Scope:** multiple profiles; account registry and status; **user-initiated** account selection on pause; credit planning view; per-account ledger; insufficient-credit handling with real captured Flow text.
- **Dependencies:** Phase 4.
- **Deliverables:** `blatifa accounts add/login/check`, planner.
- **Acceptance criteria:** identity mismatch always blocks; switching only after explicit user choice; no code path switches accounts automatically (verified by test + code review); credit status labels correct.
- **Required tests:** unit (planner math, status transitions); live identity checks on two of the user's own accounts.
- **Risks:** Google ToS for the user's specific plan/accounts; RAM limits for multiple Chrome instances (8 GiB).
- **Out of scope:** automatic rotation, parallel multi-account generation.

## Phase 6 — Desktop Application

- **Scope:** PySide6 UI over existing services: episode list/editor (read-mostly), production board with scene states, cost/credit panel, account panel, Inspector viewer, activity log (Indonesian), take-over/pause; packaging for macOS (PyInstaller or briefcase — decide then).
- **Dependencies:** Phases 1–5 service APIs stable.
- **Deliverables:** `.app` bundle for the user's Mac.
- **Acceptance criteria:** every action available in CLI is available in UI; UI contains no business logic (enforced by import rules/tests); UI remains responsive during rendering.
- **Required tests:** pytest-qt smoke tests; view-model unit tests.
- **Risks:** packaging Playwright + Chrome path; macOS permissions.
- **Out of scope:** new production capabilities; headless mode (separate evaluation).

## Phase 7 — Video Assembly & Finalization

- **Scope:** concatenate scene clips (FFmpeg concat demuxer or Flow's "Stringout Creator"/scene editor — evaluate), audio normalisation, optional transitions, final export, visual QC between consecutive scenes (frame similarity; re-evaluate OpenCV), archive/cleanup policy.
- **Dependencies:** Phase 4 outputs.
- **Deliverables:** `blatifa assemble episode`, final MP4 + report.
- **Acceptance criteria:** assembled video duration = sum of clips ± tolerance; no re-encode artefacts beyond agreed settings; deterministic output for same inputs.
- **Required tests:** FFmpeg pipelines with fixture clips.
- **Risks:** 720p limit on current tier; audio track differences; disk space.
- **Out of scope:** publishing/uploading to social platforms.

## Cross-phase rules

- Every phase ends with an audit document and evidence register update.
- Locator registry changes require evidence.
- Credit-consuming tests need an explicit user-approved budget per phase.
