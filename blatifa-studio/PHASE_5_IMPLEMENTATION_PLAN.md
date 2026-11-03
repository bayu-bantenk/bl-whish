# Phase 5 — Implementation Plan (Live Read-Only Integration Verification)

> **Ringkasan (ID):** Phase 5 memverifikasi integrasi terhadap UI Google Flow yang **asli**, hanya dengan membaca: tanpa klik, tanpa ketik, tanpa upload, tanpa generate.
>
> Sebelum test apa pun dijalankan, isolasi folder temp pytest dibuktikan dulu, karena kasus `pytest-41` di Phase 4 tidak boleh terulang.

Date: 2026-11-03. Authorization: brief Phase 5 §2. Live = read-only. No Flow mutation under any circumstances.

## 1. Audit (what was actually found)

| Item | Finding |
|---|---|
| Git | Still not a git repository. No uncommitted changes to protect. Inventory in the report |
| Phase 4 deliverables vs code | Spot-checked: `LIVE_ACTIONS_ACTIVE = False`; adapter writes raise BLOCKED; registry unchanged since Phase 2 |
| pytest cleanup | Two mechanisms can delete folders the current run did not create: (1) numbered-folder pruning in `pytest-of-<user>` (count 1 in `pyproject.toml`; that removed `pytest-41`); (2) `rm_rf` of an **existing** `--basetemp`. Session finish removes a basetemp only when pytest chose it. `tmp_path` removes per-test folders of passed tests inside the current basetemp. No test fixture or source module deletes anything outside its own tmp_path or its own files (grep of `rmtree`/`unlink`/`remove`/`replace`) |
| Account reader | Identity is read from the identity button's accessible name (**no click**). Credit balance is read by **clicking** `account.account_button` to open the panel, then closing it. The latter is not allowed in Phase 5 ("no locator is authorized to perform a click") |
| Inspector health | Every state except `project_idle` enters by click, hover, press or navigation. `project_idle` enters with `scroll_top`. Phase 5 validates locators **without** any enter step |
| Media id evidence | Image tiles: `data-media-id` (VERIFIED). Video tiles: none. **New cross-check:** on `/edit/24f29e76…` (an image detail page), the images on the page carry `data-media-id` `991d411b…` and `15283160…`, not `24f29e76…`. The recorded evidence therefore does **not** show that `data-media-id` equals the `/edit/<uuid>` route id. The runner assumes it does (it passes the id to `/edit/`). Correspondence = UNVERIFIED |
| Generation status | The adapter classifies a tile with a "Generated video thumbnail" as finished. The brief says completion must not be inferred from a thumbnail alone → needs a stricter reader |

## 2. Work items

| # | Item | Module |
|---|---|---|
| W1 | Pytest isolation: unique marked basetemp per run, refusal of an existing `--basetemp`, removal of only this run's folder and only on success, before/after listing check; retention count raised so plain pytest never prunes. Tests with sentinels **before any other test runs** | `tests/pytest_safety.py`, `tests/conftest.py`, `pyproject.toml`, `tests/unit/test_pytest_isolation.py` |
| W2 | No-click page guard: a read-only view of the page that has no click/type/hover/press/upload methods and refuses any locator action | `flow/live_probe.py` |
| W3 | Read-only probes: session health, identity (no click), credit balance **without click** (only if visible in the page's accessibility tree), grid tiles with DOM attributes (`src` redacted), media-id candidates, generation status (multi-signal), cost confirmation state, unexpected dialogs, locator validation without enter steps, structural signature for change detection, privacy-masked screenshot | `flow/live_probe.py` |
| W4 | CLI `blatifa live-probe` (read-only, repeatable, redacted JSON report) | `cli.py` |
| W5 | Offline tests (pure functions + local fixture in headless Chrome) | `tests/unit/test_phase5_*.py`, `tests/browser/test_live_probe_fixture.py` |
| W6 | Live session: user starts/logs in; Blatifa attaches; probe ×2 (stability); credits before/after; close session | manual + CLI |

## 3. Stop conditions (brief §13) — applied before every live step

Any need to click; credit change; ambiguous identity; a locator that cannot be inspected safely; an unexpected dialog; any attempt to upload, submit, generate, approve, reject, download or publish; disk < 5 GiB; doubt about test cleanup.

## 4. Not changed

Authorization model (inactive), adapter write methods (BLOCKED), state machine, locks, registry confidence (no promotion without live read-only evidence; no promotion to HIGH from fixtures).
