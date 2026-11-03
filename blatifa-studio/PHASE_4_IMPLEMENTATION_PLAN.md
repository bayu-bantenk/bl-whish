# Phase 4 — Implementation Plan (Production Readiness & Control Layer)

> **Ringkasan (ID):** Phase 4 menambahkan **lapisan kontrol**:
> - antarmuka lokal untuk memantau episode dan adegan;
> - **readiness gate** yang melaporkan semua masalah sekaligus;
> - tata kelola Character dan Style Lock;
> - **model otorisasi aksi** untuk operasi live di masa depan. Model ini dirancang dan diuji, tetapi **tidak diaktifkan**.
>
> Semua pekerjaan berlangsung offline, tanpa aksi Google Flow dan tanpa kredit. UI dibangun **tanpa paket baru**: server pustaka standar Python di 127.0.0.1 dan halaman HTML/JS lokal tanpa CDN. Alasannya, pemasangan paket butuh persetujuan, dan roadmap baru mengadopsi PySide6 di Phase 6.

Date: 2026-11-03. Authorization: GO non-credit / offline / mock / local UI / read-only local data. NO-GO: any real Flow state-changing action or credit use.

## 1. Mandatory initial audit (what was actually found)

| Item | Finding |
|---|---|
| Git / uncommitted changes | `blatifa-studio` is **still not a git repository**. No uncommitted git changes exist to protect. Changes are tracked with a file inventory in the implementation report. No existing file is replaced wholesale. Existing modules get additive edits only |
| Docs vs code (Phase 3) | Re-read the Phase 3 code against its docs. They match on the points checked: `EpisodeEngine` blocks LIVE; `SceneStatus` values; store tables. One gap the docs do not mention: the store has **no per-attempt event timestamps API** (only `last_event`) and no record of which lock text a produced scene used. Both are needed for checkpoint history and lock governance |
| Existing UI capabilities | **No graphical or web UI exists.** Only the CLI: `episode validate / status / simulate`, `lock-check`, `preflight`, `health`, `inspect`, `account`, `media` |
| Missing production-control capabilities | Dashboard, scene list and detail views; one consolidated readiness report (validation, storage, locks, media references, Flow UI and locator confidence are checked in different places or not at all); per-action authorization model with audit; an immutable-lock pin; detection of lock text changed *after* scenes were produced; a safe edit path with forced revalidation |
| Roadmap boundaries (Phase 0 roadmap) | Roadmap Phase 4 = orchestration (done offline in Phase 3). GUI = roadmap **Phase 6** (PySide6). Multi-account = Phase 5. Reconciliation: this brief's "Phase 4" is a **control/readiness layer** across roadmap Phases 4–6. The UI here is a **local web control panel** (stdlib only). It does not replace the Phase 6 desktop app. Roadmap Phase 4's live run and 30 GB precondition remain out of scope |
| Media id evidence | Image tiles carry `data-media-id` (VERIFIED, E-FLOW-18). Video tiles carry none (E-FLOW-18; Phase 2 re-check). The video thumbnail `img` has a `src`, but the capture tool **drops `src` by design** (privacy), so the recorded evidence cannot tell whether it contains the id |
| Storage | 17 GiB free at the start of Phase 4 (`df`). `pytest-41` = 1.5 GB of test output, investigated read-only (§5) |
| Baseline tests | 201 passed, 7 skipped (Phase 3 log) |

## 2. Work items

| # | Item | Module |
|---|---|---|
| W1 | Lock governance: immutable pin of the approved Octopus lock (by SHA-256), character/style split of missing / changed / DRAFT / RETIRED, "lock text changed after scenes were produced" (new append-only `lock_usage` table, recorded by the engine) | `episodes/locks.py`, `persistence/store.py`, `production/episode.py` |
| W2 | Readiness gate: one report with every finding (category, code, where, severity, which run it blocks: simulation / live); categories from brief §4 | `production/readiness.py` |
| W3 | Read-only media-id reader: accepts only a well-formed `data-media-id`; never guesses. Tested on recorded evidence | `flow/media_ids.py` |
| W4 | Action authorization model: catalogue of every Flow action (credit impact, authorization, preconditions, expected UI state, expected result, recovery, audit). Fail-closed `Authorizer`. Single-use manual confirmations. Append-only `authorization_audit`. **Hard-wired inactive** in Phase 4 | `production/authorization.py`, `persistence/store.py` |
| W5 | Control service (read models): dashboard, scene list, scene detail (assembled prompt, exact lock text, reference images, frame dependency, output files, checkpoint history), readiness, authorization view. Safe edit of scene prompt fields only. An edit bumps the scene version, keeps a backup, writes an audit row, and marks validation **STALE** until revalidated | `ui/service.py` |
| W6 | Local web UI: `http.server` on 127.0.0.1 only, Host-header check, per-session token for POST, strict CSP, no external resources, images only from inside the workspace | `ui/server.py`, `ui/static/*` |
| W7 | CLI: `blatifa ui FILE`, `blatifa episode readiness FILE` | `cli.py` |
| W8 | Tests: UI service + HTTP + headless page, dashboard, scene detail, readiness, lock integrity, authorization, security/privacy, Phase 1–3 regression | `tests/unit/test_phase4_*.py`, `tests/browser/test_control_ui.py` |

## 3. Safety rules kept

- No real Flow action. The adapter's write methods stay BLOCKED. The engine still refuses LIVE. The authorization model is never connected to the adapter, and its activation flag is a module constant (`False`), not a setting.
- Locator confidence policy unchanged. Approve stays medium and is not clickable. Reject and Always approve stay `deny`.
- Locks are never edited, shortened or re-formatted by any Phase 4 code path. The UI cannot edit locks or change a lock's status. DRAFT is never promoted.
- No automatic disk cleanup. `pytest-41` is investigated only.
- No package installs.

## 4. Out of scope (remains open)

Live read-only inspection of Flow (not in this brief's GO list), PySide6 desktop app (Phase 6), multi-account (Phase 5), and pause/cancel controls that act on a running live production.

## 5. Storage investigation plan (`pytest-41`)

Read-only: `du`, file counts by extension, timestamps. No files are opened that could hold personal data: the folder contains throw-away headless-Chrome test profiles, and their cookie and login databases are not read.
