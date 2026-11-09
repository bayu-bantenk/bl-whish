# Phase 5.3g — Preflight report (offline)

> **Ringkasan (ID):** Preflight offline selesai. Mode ketat tetap default dan tidak ada mode legacy dalam kode
> produksi. Database eksperimen terpisah sudah disiapkan dan masih kosong. Namun video kandidat 5.3D **tidak
> memenuhi syarat strict**. Video itu dikirim pengguna langsung dari `PROMPT.txt`, sehingga tidak pernah ada catatan
> persiapan dan ikatan nonce di database sebelum pengiriman. Nonce-nya juga sudah ditandai pensiun. Sesuai brief §10,
> status kandidat adalah **BLOCKED**. Tidak ada binding yang dibuat-buat. Tidak ada browser, Flow atau kredit yang
> dipakai.

## 1. Baseline (5.3f.1)

| Check | Result |
|---|---|
| `docs/phase-5.3f1/evidence/baseline_hashes.txt` (26), `tests_baseline_hashes.txt` (32), `post_change_hashes.txt` (7) | all OK before any 5.3g change |
| Strict default | `HandoffService(require_preparation=True, legacy_opt_in=None)` |
| Legacy references in `src` outside `handoff.py` | none |
| 5.3g baseline | `evidence/baseline_hashes.txt` (41 files: the 26 from 5.3f.1, all `docs/phase-5.3f1` files, `runner.py`, `store.py`, `live_probe.py`); `evidence/pre_change_hashes.txt` (`handoff.py`, `cli.py`) |

## 2. Handoff paths audited

| Step | Code | Finding |
|---|---|---|
| Handoff creation | `HandoffService.request` ← runner hook only (`episode simulate`; tests) | strict. There is **no CLI command that creates a handoff**; an attempt in `NEEDS_MANUAL_INTERVENTION / MEDIA_ID_UNRESOLVED` with a valid preparation is required. |
| `handoff ready` | `cmd_handoff` → `ReadOnlyPage` → `identity_without_interaction` → `svc.ready` | Checks identity VERIFIED, bound fingerprint and bound project from the URL. Does not assume a detail page is open, and does not click or navigate. **Gap found:** it did not re-check the preparation, so a handoff of unknown origin (legacy, older DB) could proceed. **Closed** in 5.3g (§4). |
| `confirm-opened` | `svc.confirm_opened` | Records the user's assertion once. No browser use. |
| `observe` | `probe_detail` (read-only, vetted scripts), path before and after, nonce text hash → `svc.observe` → stored evidence (SHA-256, append-only) → `resolve_video_identity` (unchanged) | A page change is detected (`url_path ≠ url_path_after`). User opening is enforced by the timestamp order: identity read ≤ confirmation ≤ observation. The identity read must be ≤ 10 min old. Titles, tile order, timestamps and positions are not used. |
| Result | `apply_verified_identity` | VERIFIED → attempt `COMPLETED` with the route, once, in one transaction. Anything else → `IDENTITY_REJECTED`, and the attempt stays `MEDIA_ID_UNRESOLVED`. No next scene is started. |
| Failures | browser closed, page unreadable or crash | state unchanged (event noted). `recover` uses only stored evidence. |

## 3. Experiment isolation

| Item | Value |
|---|---|
| Experiment database | `~/BlatifaStudio/experiments/phase-5.3g/p53g.db` (new; the folder did not exist before; folder `0700`, file `0600`) |
| Contents | schema only; every table has 0 rows (`schema_info` 1) |
| Old databases | `~/BlatifaStudio/simulation/simulation.db` was only read, with `immutable=1` (no WAL or shm written). Nothing was deleted, changed or reused. |
| Handoff records reused | none |

## 4. Change made (necessary, documented)

`HandoffService.ready` now refuses when `binding_problems(attempt)` is not empty. In strict mode that means a missing
binding, a missing stored prompt, or any verification failure. `cmd_handoff ready` performs the same check **before**
attaching to the browser, so nothing is read from Flow for an ineligible handoff. Explicit legacy mode keeps its 5.3e
behaviour (tests only). Files: `src/blatifa/production/handoff.py`, `src/blatifa/cli.py`. The resolver, runner, store,
nonce binding, registry and authorization are unchanged.

## 5. Candidate: the Phase 5.3d video

`docs/phase-5.3g/tools/check_candidate.py` (read-only) → `evidence/candidate_check.json`:

| Fact | Value |
|---|---|
| Experiment / scene | `EXP-P53D-20261106-12EF` / `EXP-P53D-S01` |
| Project / account | `562eec3d-…` / `d6c9f4583fa6` |
| Nonce / route | `[blatifa-exp-12ef8b99]` / `a25e3913-9eec-40e9-aafa-cf6c76961965` |
| `PROMPT.txt` SHA-256 = manifest | yes |
| Prompt carries exactly that nonce, in the `append_nonce` layout | yes |
| Blatifa databases on this machine | 1 (`simulation.db`): 0 attempts, 0 bindings, no `attempt_preparation` table (created before 5.3f) |
| `attempt_preparation` + `attempt_binding` for this nonce, written before submission | **none** |
| Manifest `nonce_retired` | `true` |

**Verdict for the candidate: BLOCKED.** The facts are consistent, but the strict-preparation evidence (a binding
persisted *before* submission, in the same transaction as the prepared prompt) never existed. That is because the
5.3d video was submitted by the user outside the Store, before 5.3f existed. Writing such a record now would be a
binding created after the fact, using a retired nonce. Brief §4 and §10 forbid this.

## 6. Ways forward (each needs a separate decision)

| Option | What it proves | Cost / risk |
|---|---|---|
| **A (recommended).** New controlled experiment: Blatifa prepares an attempt in `p53g.db` (strict, new nonce). The user sends that exact stored prompt by hand, as in 5.3d. The attempt is recorded as manually submitted and set to `MEDIA_ID_UNRESOLVED`. Then the live read-only protocol runs. | the full strict chain on a real video | 1 generation (≈ 10 credits); needs a generation authorization and a small "manual-submission attempt" tool (not built) |
| B. Historical import of 5.3d, labelled `RECONSTRUCTED`, with the retired nonce | only the read-only page path; **not** strict preparation | contradicts the 5.3d nonce retirement and brief §4; not recommended |
| C. No handoff, read-only probes only (`live-probe`) | nothing new (already shown in 5.3d) | none |
