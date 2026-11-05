# Phase 5.2.1 — Evidence Register

> **Ringkasan (ID):** Fase ini **tidak punya bukti live baru**. Koreksi registry didasarkan pada bukti live Phase 5.2 yang terekam. Bukti Phase 5 tetap dipertahankan sebagai riwayat.

Kinds: **LIVE-5.2** (recorded 2026-11-03, Phase 5.2) · **LIVE-5** (historical) · **UNIT** · **STATIC** (code/schema inspection) · **CLI**.

| ID | Claim | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P521-01 | Disk gate: 6.6 GiB free, 7.85 GiB swap → no full suite, no Chrome, no heavy tests | `evidence/disk_gate.log` | CLI | VERIFIED |
| E-P521-02 | Rest state: the locator's element (img "Generated video thumbnail") is present inside `flow-video-tile` in 8 of 8 recorded rest-state observations, with no `<video>` | `test_locator_matches_the_recorded_rest_state` over `docs/phase-5.2/evidence/live/20261103T141714Z-live-probe` | UNIT over LIVE-5.2 | VERIFIED (one tile, one session) |
| E-P521-03 | Hover state is a different representation of the same tile (playing `<video>`, no thumbnail); recognised as VIDEO with different signals | `test_hover_state_is_a_different_representation_of_the_same_tile` over `hover_test_on.log` | UNIT over LIVE-5.2 | VERIFIED (one tile, one session) |
| E-P521-04 | After hover: paused `<video>`, thumbnail does not return | `hover_test_off.log`; `test_hover_or_after_hover_never_means_completed[hover_test_off.log]` | UNIT over LIVE-5.2 | VERIFIED |
| E-P521-05 | Neither hover nor after-hover means completion; runner tile stays unknown, no identity | `test_hover_or_after_hover_never_means_completed` | UNIT | VERIFIED OFFLINE |
| E-P521-06 | A rest → hover history stays VIDEO_UNKNOWN; conflicting signals stay VIDEO_UNKNOWN | `test_rest_to_hover_history_stays_unknown_and_conflicts_stay_unknown` | UNIT | VERIFIED OFFLINE |
| E-P521-07 | The Phase 5 BROKEN finding and its evidence path are preserved in the entry's history | `test_entry_is_state_dependent_with_condition_evidence_and_history`; `test_phase5_live_evidence.py::test_registry_reflects_the_live_finding` | UNIT | VERIFIED |
| E-P521-08 | Schema: backward-compatible (old entries unchanged), strict (condition required, only for STATE_DEPENDENT, evidence required, never HIGH); exactly one STATE_DEPENDENT entry | `test_schema_change_is_backward_compatible_and_strict` | UNIT | VERIFIED |
| E-P521-09 | Not clickable; flagged as `LOCATOR_STATE_DEPENDENT` for reads; the adapter's legacy completion path still needs VERIFIED | `test_state_dependent_is_never_clickable_or_trusted_as_verified` | UNIT + STATIC | VERIFIED |
| E-P521-10 | Runner, reconcile, authorization flag and the "no VERIFIED signal" policy unchanged | `test_runner_reconcile_and_state_machine_behaviour_unchanged`; `test_phase5_1_runner_compat.py` (8) | UNIT + SIM | VERIFIED OFFLINE |
| E-P521-11 | Light regression subset | `evidence/pytest_light.log`: 235 passed, 0 failed | CLI | VERIFIED |
| E-P521-12 | Browser and large-simulation tests after this change | deferred (disk gate) | — | **NOT RUN** |
| E-P521-13 | Pre-existing temp folders (sentinel, kept failed runs) untouched | before/after listings in `evidence/pytest_light.log` | CLI | VERIFIED |
| E-P521-14 | Generating vs completed, video identity, scene association | no new evidence | — | unchanged: NOT READY / UNRESOLVED / NOT READY |

## Post-restart regression attempt (2026-11-04 16:24 WIB), appended

| ID | Claim | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P521-15 | No restart happened: boot time Nov 3 15:38, uptime 1 day 46 min | `evidence/preflight_post_restart.log` | CLI | VERIFIED |
| E-P521-16 | Preflight: disk 18 GiB free (pass), swap 7716→7762 of 8192 MB (fail) → full regression not run | `evidence/preflight_post_restart.log`; `PHASE_5_2_1_POST_RESTART_REGRESSION.md` | CLI | VERIFIED |
| E-P521-17 | 369 tests collected; the 134 deferred tests are still not run after the change | `evidence/preflight_post_restart.log` | CLI | **NOT RUN** (E-P521-12 still open) |

## Post-restart regression, attempt 2 (2026-11-05), appended

| ID | Claim | Evidence | Kind | Label |
|---|---|---|---|---|
| E-P521-18 | Restart confirmed (boot Nov 5 15:25); preflight passed: disk 13 GiB, swap 0 MB | `evidence/preflight_post_restart.log` (2nd section) | CLI | VERIFIED |
| E-P521-19 | Full suite: 362 passed, 0 failed, 7 skipped (opt-in live) | `evidence/pytest_full_post_restart.log` | CLI | VERIFIED |
| E-P521-20 | The 134 deferred tests: 127 passed, 7 live skipped (closes E-P521-12 and E-P521-17) | `evidence/pytest_full_post_restart.log` | CLI | VERIFIED |
| E-P521-21 | Compat note renamed `LEGACY_VIDEO_LOCATOR_BROKEN` → `LEGACY_VIDEO_LOCATOR_NOT_VERIFIED` (adapter + 2 browser tests; exact assertions kept; `legacy_ok` logic unchanged) | `PHASE_5_2_1_POST_RESTART_REGRESSION.md` STEP 3 | STATIC | VERIFIED |
| E-P521-22 | Affected tests after the rename: 89 passed; ruff clean | `evidence/pytest_rename_rerun.log` | CLI | VERIFIED |
| E-P521-23 | Old temp folders gone after the restart: cleared by macOS, not by this task | `evidence/preflight_post_restart.log` (2nd section) | CLI | OBSERVED |

## Actions not performed

- No Chrome, no live session, no Flow action, no credits.
- No change to the runner, state machine, reconcile, gates or adapter.
- No completion, identity or association inferred.
- No file, test artifact or temp folder deleted.
- Phase 5 and Phase 5.2 documents and evidence not edited.
