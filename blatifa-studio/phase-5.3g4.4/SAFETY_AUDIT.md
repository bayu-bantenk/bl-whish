# Phase 5.3g.4.4: safety audit (documentation stage)

> **Ringkasan (ID):**
> - Tahap ini hanya membuat dua dokumen. Tidak ada kode, tes, manifest, hash, Git, browser, Flow, maupun kredit yang
>   disentuh.
> - R-2 hanya mencakup provenance jalur akuisisi di dalam proses yang sama. R-2 **tidak** membuktikan bahwa sumbernya
>   Google Flow dan tidak memberi jaminan lintas proses.
> - **Live approval tetap DIBLOKIR** sampai autentisitas sumber dan koordinasi anggaran lintas proses ditangani di
>   fase terpisah dan disetujui tersendiri.

## 1. Scope of this stage

| Item | State |
|---|---|
| Phase | `5.3g.4.4`, R-2: Balance Reading Provenance and Single-Use Authorization |
| Authorization | write two documents only: `R2_DESIGN_SPEC.md` and this file |
| Open decisions OPEN-1 to OPEN-4 | **RESOLVED** by user approval, 2026-11-18 (`R2_DESIGN_SPEC.md` §6.4, §6.5, §8, §6.6) |
| Decisions 1 to 3 | **APPROVED** by the user, 2026-11-18 (`R2_DESIGN_SPEC.md` §6.6, §6.7, §6.8) |
| FAULTED latch | **APPROVED** by the user, 2026-11-18 (`R2_DESIGN_SPEC.md` §5.4, §6.8) |
| AMB-1 to AMB-4 | **RESOLVED** by user approval, 2026-11-18 (`R2_DESIGN_SPEC.md` §4, §5.4, §9.4, §11) |
| Design freeze | **NOT YET DECLARED** (remaining items: `R2_DESIGN_SPEC.md` §11) |
| Implementation | **NOT AUTHORIZED, NOT STARTED.** `src/blatifa/account/provenance.py` does not exist |
| Testing | **NOT AUTHORIZED, NOT RUN** |
| Live Google Flow interaction | **NOT AUTHORIZED** |

## 2. Safety state (checked read-only on 2026-11-18)

| Item | Result | How checked |
|---|---|---|
| Source code changes | **NONE** | file modification times (§5) |
| Test file changes | **NONE** | file modification times (§5) |
| Manifest / hash / `protected_hashes.py` | **NONE**; no hash computed | file modification times (§5) |
| Git state | not a git repository; nothing to change | — |
| Tests run | **NONE** | — |
| Browser, Chrome, Playwright, CDP, live probe | **NOT TOUCHED** | — |
| Google Flow | **NOT TOUCHED** | — |
| Credits consumed | **0** | — |
| `LIVE_ACTIONS_ACTIVE` | `Final = False` (`src/blatifa/production/authorization.py:30`), unchanged | grep |
| `deny: true` | 18, unchanged (`src/blatifa/inspector/data/flow_locators.yaml`) | grep count |
| `BLATIFA_LIVE` | unset | environment check |
| `--no-sandbox` | not used | — |
| Personal Chrome profile, credentials, cookies, tokens, Crashpad | not accessed | — |

## 3. Trust boundary statements (Option C)

These statements are binding for every later R-2 document and report:

1. The registry proves only the **provenance of the acquisition path inside the same Python process**: the reading
   came from `acquire_balance`, it is unchanged in the snapshot fields, and it has not yet authorized an approval.
2. **A fake Page can still be supplied.** `acquire_balance(page)` does not prove that the Page belongs to Google Flow
   (`src/blatifa/flow/live_probe.py:75-77`: `ReadOnlyPage` wraps whatever page object it is given).
3. **Deliberate manipulation inside the same Python process is outside the R-2 guarantee.** This includes
   monkeypatching, writing to the registry, and `object.__setattr__` races (`R2_DESIGN_SPEC.md` §7.3).
4. **There is no cross-process guarantee.** The registry is process-local memory.
5. **Source authenticity is not proven.**
6. **Live approval stays blocked** until the prerequisites in §4 are met.
7. **The FAULTED latch is process-local** (`R2_DESIGN_SPEC.md` §5.4). It does not coordinate with other processes.
   Terminating a FAULTED process and starting a new one, in production or in a test, gives an empty registry, but it
   does **not** establish source authenticity and does **not** provide cross-process budget safety.
8. **The FAULTED guarantee is limited.** No authorization or registration can succeed after the registry enters
   FAULTED. Rollback is **not** guaranteed, and a partly written registry entry may remain; it is never used.

## 4. Live prerequisites (U-9), all OPEN

| # | Prerequisite | State | Needed before live approval |
|---|---|---|---|
| L-1 | Source authenticity: evidence that the Page read is the real Google Flow page of the bound account | **NOT PROVEN**; not part of R-2 | yes, own phase and own approval |
| L-2 | Cross-process budget coordination: two processes must not each spend against the same balance | **NOT AVAILABLE**; not part of R-2 (Q4) | yes, own phase and own approval |
| L-3 | R-2 implemented and tested | **NOT AUTHORIZED** | yes |
| L-4 | Existing live blockers from earlier phases (`LIVE_ACTIONS_ACTIVE = False`, 18 `deny: true`, 5.3g.4.3.x isolation work) | unchanged | yes |

R-2 alone, even once implemented and tested, **does not authorize** any live approval, credit use or Flow
interaction.

## 5. Change control for this stage

- Start of work: 2026-11-18T07:18:25Z (UTC).
- Open-decision update started 2026-11-18 14:29:47 +0700. Decisions 1 to 3 update started 2026-11-18 14:51:05 +0700.
- FAULTED latch / first AMB update started 2026-11-18 22:05:45 +0700. AMB-1 to AMB-4 final update started
  2026-11-18 22:13:24 +0700.
- Files allowed to be created: `docs/phase-5.3g4.4/R2_DESIGN_SPEC.md` and `docs/phase-5.3g4.4/SAFETY_AUDIT.md`. The
  directory `docs/phase-5.3g4.4/` was created for them.
- Check method: list every file in the repository modified after the start time. Expected result: only the two
  documents above. The result is reported in the stage's final report.
- **NOT VERIFIED by this method:** content-level integrity. No hash was computed, by instruction. A modification-time
  check cannot detect a change that preserved the old timestamp.

## 6. Residual risks recorded at this stage

| # | Risk | State |
|---|---|---|
| S-1 | macOS monotonic clock behaviour across sleep/wake | UNVERIFIED (`R2_DESIGN_SPEC.md` OPEN-5) |
| S-2 | Same-process races and manipulation | outside guarantee (OPEN-6) |
| S-3 | `credit_evidence` UNKNOWN mapping for a non-stale reason | **RESOLVED** (OPEN-1): `BALANCE_READING_STALE`, internal reason UNKNOWN, no new public code |
| S-4 | Internal registry exception | **RESOLVED** (OPEN-2): only `ProvenanceRegistryError` becomes `BALANCE_READING_REGISTRY_ERROR`. `credit_evidence` and `approval_gate` exceptions, `KeyboardInterrupt` and `SystemExit` propagate |
| S-5 | `PAUSE_BLOCKS` membership of the new codes | **RESOLVED** (OPEN-3): unchanged. R-2 blocks go to manual intervention and never retry automatically |
| S-6 | Lock interface between `gates` and `provenance` | **RESOLVED** (OPEN-4): `provenance` owns the lock; `gates` passes an `evaluate_gate` callback; no lock exposed; no import cycle |
| S-7 | `test_phase5_3g4_2_freshness.py` is pinned by no test (D-9) | pre-existing gap; plan in `R2_DESIGN_SPEC.md` §9.2 |
| S-8 | The R-2 specification lived only in conversation until this stage | closed by `R2_DESIGN_SPEC.md`; freeze still not declared |
| S-9 | Malformed callback result (`.allowed` missing, raising or non-bool) | **SPECIFIED** (Decision 1): exception propagates, nothing consumed, never REGISTRY_ERROR, never authorization |
| S-10 | `ProvenanceRegistryError` while marking CONSUMED | **SPECIFIED** (Decision 3): REGISTRY_ERROR; allowed result discarded; no rollback claimed; FAULTED latch blocks later attempts in the process (latch **APPROVED**: permanent until process termination, no clearing API) |
| S-11 | `acquire_balance` behaviour while FAULTED | **RESOLVED** (AMB-1): raises `ProvenanceRegistryError` in Cases A, B and C, for every reading status including `OBSERVED` and `UNAVAILABLE`; nothing registered or returned; Case A never calls `aria_snapshot()`. Page and `AriaParseError` failures propagate unchanged and do not set FAULTED |
| S-12 | FAULTED latch scope | process-local only; no cross-process coordination; a restart does not prove source authenticity or budget safety (§3 item 7) |
| S-13 | Partial registration entry after `ProvenanceRegistryError` | **RESOLVED** (AMB-2): no rollback guaranteed; the entry may remain and is never used, because authorization stops before examining entries and registration stops at the in-lock check (§3 item 8) |
| S-14 | Lock-free FAULTED pre-check | **RESOLVED** (AMB-3): early exit only; the in-lock re-check is mandatory and deciding; authorization and consumption stay atomic; the lock is not exposed |
| S-15 | FAULTED test isolation | **RESOLVED** (AMB-4): separate Python process per FAULTED case in the future test phase; no production reset API. Testing remains NOT AUTHORIZED |
