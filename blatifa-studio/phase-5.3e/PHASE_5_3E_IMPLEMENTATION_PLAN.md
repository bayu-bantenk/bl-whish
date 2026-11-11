# Phase 5.3e — Implementation plan: manual detail identity handoff

> **Ringkasan (ID):** Rencana ini menghubungkan resolver `media_identity.py` (tanpa mengubah aturannya) ke alur
> rekonsiliasi runner lewat "handoff" manual: runner berhenti, pengguna membuka halaman detail sendiri, Blatifa hanya
> membaca, lalu resolver yang sama memutuskan. Offline; tanpa kredit; runner produksi tetap nonaktif.

Written before any code change (brief §3). Preflight 2026-11-06: disk 6.93 GiB, swap 4.5/6 GiB; baseline hashes of the
protected files in `evidence/baseline_hashes.txt`.

## 1. Existing behaviour (audit)

| Area | Location | Behaviour today |
|---|---|---|
| Resolver | `src/blatifa/flow/media_identity.py` | `resolve_video_identity(DetailEvidence, project_id, nonce)` → VERIFIED (route) / UNRESOLVED (reasons). Not called by any production code. |
| Detail reader | `live_probe.probe_detail` | read-only (`ReadOnlyPage`, vetted scripts only); returns route, dialogs, markers, `nonces`; identity UNKNOWN on detail pages (no account button) |
| Runner, rendering | `runner.py` `_await_render` | complete tile without media id → `NEEDS_MANUAL_INTERVENTION`, `error_code=MEDIA_ID_UNRESOLVED`, `resume_to=RENDERING` |
| Runner, reconcile | `runner.py` `_reconcile` + `reconcile.decide` | complete tile without media id → `NEEDS_MANUAL_INTERVENTION`, code `RECONCILE_UNRESOLVED` |
| Resume | `SceneRunner.resume` | `NEEDS_MANUAL_INTERVENTION → RECONCILING` only |
| Dependants | `episode.py` | a scene in NEEDS_MANUAL_INTERVENTION blocks its dependants (`BLOCKED_BY_DEPENDENCY`) |
| Store | `persistence/store.py` | SQLite, one transaction per transition, append-only triggers on audit tables |
| Authorization | `authorization.py:30` `LIVE_ACTIONS_ACTIVE = False`; registry `deny: true` (18 entries) | unchanged by this phase |
| Nonce | not stored per attempt; `assemble_prompt` adds none | — |

## 2. Integration points

1. `_reconcile`: label the media-id case `MEDIA_ID_UNRESOLVED` (same state, same `resume_to`; only the code is more
   precise). No other runner decision changes.
2. `SceneRunner._manual`: when the code is `MEDIA_ID_UNRESOLVED` and a handoff service is configured, create a handoff
   request (fail-closed: without a nonce binding no handoff is created; the attempt stays manual).
3. New `production/handoff.py`: state machine + service; calls `resolve_video_identity` as the only authority.
4. Store: new append-only tables `attempt_binding`, `handoff_event`, `handoff_evidence`; table `identity_handoff`
   (state row) with a partial unique index (one open handoff per attempt). `CREATE … IF NOT EXISTS`, no change to
   existing tables.
5. Atomic apply in the store: handoff VERIFIED → attempt `NEEDS_MANUAL_INTERVENTION → RECONCILING → COMPLETED` with
   `flow_media_id`, in one transaction, guarded by the attempt's last event id recorded when the handoff was created.
6. CLI `blatifa handoff …` (read-only browser use for `ready` and `observe`).

## 3. Handoff state model

```
MANUAL_HANDOFF_REQUIRED --ready (grid identity VERIFIED)--> WAITING_FOR_USER
WAITING_FOR_USER --confirm-opened (user assertion)--> WAITING_FOR_USER (user_confirmed_at set)
WAITING_FOR_USER --observe (read-only)--> DETAIL_PAGE_OBSERVED --resolver--> IDENTITY_VERIFIED | IDENTITY_REJECTED
IDENTITY_REJECTED --ready--> WAITING_FOR_USER (new identity read, new confirmation needed)
IDENTITY_VERIFIED --apply (atomic, once)--> RECONCILED
any non-terminal --cancel--> HANDOFF_CANCELLED   (attempt unchanged)
```

`MEDIA_ID_UNRESOLVED` stays the attempt's error code (it is not a handoff state). `RECONCILED` is an added terminal
state that marks "applied exactly once" (deviation from the suggested list, needed for duplicate prevention).

## 4. Binding and stale protection

- A handoff binds attempt id, episode, scene, scene version, attempt no, experiment id, project id, nonce, account
  fingerprint and the attempt's last event id.
- `ready`: the project page of the bound project must show identity VERIFIED with the bound fingerprint.
- `observe`: requires user confirmation after the identity read; identity at most 10 min old; URL equal before and after
  the read; then `DetailEvidence(opened_by_user=…, grid_identity_verified=…)` → resolver.
- `apply`: attempt must still be in NEEDS_MANUAL_INTERVENTION with `MEDIA_ID_UNRESOLVED`, no `flow_media_id`, and the
  same last event id; the handoff must be younger than 24 h. Otherwise REJECTED as stale.

## 5. Out of scope

Automatic tile clicks, navigation, generation, approve, download, UI page changes, activating LIVE runs, changing
the resolver, the registry or `authorization.py`, and wiring the nonce into submission (recorded as a prerequisite).
