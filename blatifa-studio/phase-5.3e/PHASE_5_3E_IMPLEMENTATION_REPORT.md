# Phase 5.3e — Implementation report

> **Ringkasan (ID):** Handoff manual sudah terpasang. Runner berhenti saat ID video tidak terselesaikan dan membuat
> permintaan handoff. Pengguna membuka halaman detail sendiri; Blatifa hanya membaca; resolver yang sama memutuskan.
> Identitas VERIFIED diterapkan tepat sekali secara atomik. Semua offline; belum ada verifikasi live.

## 1. Files

| File | Change |
|---|---|
| `src/blatifa/production/handoff.py` (new) | `HandoffState`, `TRANSITIONS`, `HandoffService` (`request`, `ready`, `confirm_opened`, `observe`, `resolve`, `apply`, `cancel`, `recover`) |
| `src/blatifa/persistence/store.py` | new tables `attempt_binding`, `identity_handoff` (+ partial unique index: one open handoff per attempt), `handoff_event`, `handoff_evidence`; append-only/no-delete triggers; methods `bind_attempt`, `binding`, `handoff_*`, `apply_verified_identity` (atomic); `HandoffConflictError`. Existing tables untouched (`CREATE … IF NOT EXISTS`). |
| `src/blatifa/production/runner.py` | optional `on_media_unresolved` hook called after an attempt stops with `MEDIA_ID_UNRESOLVED`; the reconcile media-id case is labelled `MEDIA_ID_UNRESOLVED` instead of `RECONCILE_UNRESOLVED` (same state, same `resume_to`) |
| `src/blatifa/production/reconcile.py` | constant `MEDIA_ID_REASON` (same text as before) |
| `src/blatifa/cli.py` | `blatifa handoff status|show|ready|confirm-opened|observe|cancel|recover [--db]` |
| `tests/unit/test_phase5_3e_handoff.py` (new) | 88 tests |

Not changed (hash-checked, `evidence/baseline_hashes.txt`): `media_identity.py`, `flow_locators.yaml`,
`authorization.py`, the sample episode, the 5.3/5.3b/5.3d manifests.

## 2. How it works

1. Before submission (future live path): `store.bind_attempt(attempt, experiment, project, nonce, account_fp)`.
2. Rendering ends with a complete tile without media id → attempt `NEEDS_MANUAL_INTERVENTION/MEDIA_ID_UNRESOLVED`;
   the runner returns (paused); dependants stay `BLOCKED_BY_DEPENDENCY`; the hook creates `MANUAL_HANDOFF_REQUIRED`
   bound to attempt, scene, version, attempt no, experiment, project, nonce, account and the attempt's last event id.
3. `handoff ready <id>` (user on the grid): read-only identity on the bound project page → `WAITING_FOR_USER`.
4. The user opens the suspected video's detail page, then `handoff confirm-opened <id>` (recorded once).
5. `handoff observe <id>`: `probe_detail` (read-only) + URL before/after; evidence stored with SHA-256 (append-only)
   → `DETAIL_PAGE_OBSERVED` → `resolve_video_identity` with `opened_by_user` (confirmation between identity read and
   observation) and `grid_identity_verified` (identity read ≤ 10 min old). Extra rejections only: page changed,
   evidence bound to another handoff.
6. VERIFIED → `apply_verified_identity` in one transaction: checks state, error code, no media id yet, unchanged last
   event id, binding, age ≤ 24 h; attempt → RECONCILING → COMPLETED with the route; handoff → RECONCILED. Stale →
   `IDENTITY_REJECTED`. The next scene is not started.
7. `recover` finishes `DETAIL_PAGE_OBSERVED` / `IDENTITY_VERIFIED` from stored evidence without reading the browser.

## 3. Deviations and limitations

- Extra state `RECONCILED` (terminal, "applied once"); `MEDIA_ID_UNRESOLVED` is the attempt's error code, not a handoff
  state.
- Extra command `ready` (grid identity read before the user opens the tile); `recover` for crash recovery.
- CLI is `blatifa handoff …`, not `blatifa episode handoff …` (the `episode` command takes a positional action + file).
- The control UI was not changed.
- **No submission path binds a nonce yet**: nothing calls `bind_attempt` + `append_nonce` automatically, so in today's
  SIMULATED runs no handoff is created (the attempt stays manual, fail-closed). Needed before a live test.
- Identity freshness uses Blatifa's clock; the 10 min and 24 h limits are fixed constants.
- Disk 6.9–7.1 GiB during the work (below the usual 10 GiB warning); nothing was deleted; the suite ran to completion.
- Not verified live: all evidence is the recorded 5.3d pages and simulated runs.
