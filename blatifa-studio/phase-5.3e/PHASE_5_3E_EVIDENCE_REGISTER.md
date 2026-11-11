# Phase 5.3e — Evidence register

Classifications: VERIFIED · PARTIALLY VERIFIED · PROPOSED · UNVERIFIED · BLOCKED. All rows are offline; no live
Flow interaction took place in this phase.

| ID | Claim | Class | Evidence |
|---|---|---|---|
| E-P53E-01 | Resolver acceptance logic unchanged | VERIFIED | `media_identity.py` hash equal to baseline; `test_phase5_3d_identity.py` 9 passed |
| E-P53E-02 | `LIVE_ACTIONS_ACTIVE = False`, registry (18 × `deny: true`) and `authorization.py` unchanged | VERIFIED | `evidence/baseline_hashes.txt` + `shasum -c` 7/7 OK; `test_protected_files_and_flags_are_unchanged` |
| E-P53E-03 | Runner stops with `MEDIA_ID_UNRESOLVED` and requests a handoff; nothing re-submitted | VERIFIED (simulated) | `test_runner_pauses_and_requests_a_handoff_when_the_media_id_is_unresolved` |
| E-P53E-04 | Only matching experiment/scene/project/nonce evidence reconciles | VERIFIED (recorded pages) | mismatch tests over `docs/phase-5.3d/evidence/D_detail`, `D2_second_tile`, `D3_first_tile_reopen` |
| E-P53E-05 | Verified identity applied exactly once, atomically | VERIFIED (simulated) | duplicate/concurrent apply tests |
| E-P53E-06 | Crash after observation / after verification resumes safely | VERIFIED (simulated) | two crash tests (store reopened) |
| E-P53E-07 | Handoff code has no mutating browser call; observation uses `ReadOnlyPage` | VERIFIED (static) | `test_handoff_code_has_no_mutating_browser_calls` |
| E-P53E-08 | Closed browser during `observe` leaves the state unchanged | VERIFIED (simulated page) | `test_cli_observe_with_closed_browser_keeps_the_state` |
| E-P53E-09 | Audit tables append-only; evidence hash-checked on read | VERIFIED | `test_audit_tables_are_append_only`; `Store.handoff_evidence` |
| E-P53E-10 | Full regression | VERIFIED | `evidence/pytest_full.log`: 480 passed, 7 skipped |
| E-P53E-11 | `handoff ready` / `observe` against the live Flow page | UNVERIFIED | needs a live read-only session (user opens the tile) |
| E-P53E-12 | Submission binds a nonce (`bind_attempt` + `append_nonce`) | PROPOSED | not implemented; prerequisite for live use |
| E-P53E-13 | Live end-to-end handoff on a real generated video | BLOCKED | production runner inactive; no generation authorized in this phase |
| E-P53E-14 | Resource state during the work | VERIFIED | disk 6.93 → 7.10 GiB, swap 4.5/6 GiB; nothing deleted |
