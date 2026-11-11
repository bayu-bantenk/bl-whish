# Phase 5.3g.1 — Implementation report

> **Ringkasan (ID):** Ada layanan dan CLI baru (`blatifa experiment …`) untuk eksperimen yang prompt-nya dikirim
> pengguna secara manual. Satu attempt baru sudah disiapkan dalam mode strict di `p53g.db`, dengan nonce baru yang
> tidak pernah dipakai dan bukan nonce pensiun. Prompt final tersimpan byte demi byte. Konfirmasi pengguna
> (attestation) dicatat sekali dan tidak bisa diubah; catatan itu tidak pernah dianggap bukti identitas video.
> Hanya resolver yang dapat menghasilkan RECONCILED. Semua offline; belum ada generate.

## 1. Files

| File | Change |
|---|---|
| `src/blatifa/production/manual_submission.py` (new) | Experiment DB identity, strict preparation of the experiment attempt, exact-prompt access, user attestation, strict handoff opening, status, `RETIRED_NONCES` |
| `src/blatifa/production/handoff.py` | `binding_problems`: in an experiment DB the attempt must be registered and attested (in **both** modes); in strict mode a retired nonce is refused |
| `src/blatifa/cli.py` | `blatifa experiment init|prepare|show|prompt|attest|handoff|status`; the database path is fixed at `EXPERIMENT_DB` (there is no `--db` option) |
| `tests/unit/test_phase5_3g1_manual_submission.py` (new) | 32 tests |
| `docs/phase-5.3g1/tools/build_base_prompt.py` (new) | builds the base prompt without a nonce (production assembler, lock hashes checked) |
| `docs/phase-5.3g1/BASE_PROMPT.txt`, `FINAL_PROMPT.txt` (new) | base prompt; exact final prompt exported from the DB |

Unchanged: `nonce_binding.py`, `store.py`, `runner.py`, `media_identity.py`, registry, `authorization.py`, Octopus lock,
manifests, and all 5.3d–5.3g evidence (`evidence/baseline_hashes.txt`, 54 files). The new tables are created by
`manual_submission.ensure_schema` only in an experiment DB; `store.py` stays byte-identical.

## 2. Data (append-only / immutable, triggers on update and delete)

| Table | Content |
|---|---|
| `experiment_identity` (one row) | experiment id, DB realpath, project, account fingerprint, purpose. Written only when the DB file is the expected path and empty. |
| `manual_attempt` | registers an attempt as this experiment's manual attempt |
| `manual_submission` | attempt (PK), nonce (UNIQUE), final prompt hash, experiment, project, account, `source = 'USER_MANUAL_CONFIRMATION'` (CHECK), `flow_verified = 0` (CHECK), the user's statement, reported cost, `reported_at` |

## 3. Lifecycle and status

| Status | Condition |
|---|---|
| `PREPARED` | attempt `READY`; preparation valid against the experiment identity; registered; no attestation |
| `MANUAL_SUBMISSION_REPORTED` | attestation recorded. In the same transaction the attempt goes `READY → NEEDS_MANUAL_INTERVENTION / MEDIA_ID_UNRESOLVED` with `resume_to = RENDERING` (the result may exist in Flow; never resubmitted) and `submitted_at = reported_at`. The event text says "reported by the user … not verified by Flow". No ledger row is written; the reported cost is stored in the attestation and in `quoted_cost`. |
| `DETAIL_OBSERVATION_PENDING` | strict handoff open (`MANUAL_HANDOFF_REQUIRED` … `IDENTITY_VERIFIED`) |
| `RECONCILED` | handoff `RECONCILED` **and** attempt `COMPLETED` with `flow_media_id = verified_route`. Only the resolver path reaches it. |
| `UNRESOLVED` | any consistency problem, or a rejected or cancelled handoff |

The attestation is checked against the stored records: the attempt must be `READY`, registered and validly prepared;
the nonce must equal the binding and not be retired; the hash must equal the stored final prompt; project and
account must equal the binding and the identity; the statement must not be empty; the cost must be ≥ 0. An
identical repeat returns the existing row with nothing new written. A different one is refused with
`CONFLICTING_ATTESTATION`. `BEGIN IMMEDIATE` serializes concurrent attesters.

## 4. Prepared attempt (real, offline)

| Item | Value |
|---|---|
| DB | `~/BlatifaStudio/experiments/phase-5.3g/p53g.db`. Before writing: file hash = the 5.3g state, 0 rows. |
| Experiment | `EXP-P53G-20261110-56C3` (new; no prior hits) |
| Episode / scene / attempt | `EXP-P53G` / `EXP-P53G-S01` v1 #1 / `4ae102de6bbb4612b9b862449fbd993c` |
| Project / account | `562eec3d-9c48-4802-b152-3ed1d8c91ebd` / `d6c9f4583fa6` (from the 5.3d evidence; verified live only at `handoff ready`) |
| Nonce | `[blatifa-exp-1e05d92f]`: fresh, not retired, no hits in docs, src, tests or inspections before preparation |
| Base prompt | 902 bytes, sha256 `828d967a…`; equal to the user-reviewed 5.3d prompt without its nonce line |
| Final prompt | 996 bytes, sha256 `f45e9887b2ec1cad11589f620409654596c1d72429db969fee3cee8ba87735c5` (`FINAL_PROMPT.txt`, exported by `experiment prompt --out`, byte-identical to the DB) |
| Status | `PREPARED`; attestation none; media id none |

The 5.3d records, the retired 5.3d nonce and `simulation.db` were not touched (`simulation.db` hash unchanged).

## 5. Limitations

- The attestation records what the user reports. Neither Flow nor Blatifa proves that the submitted text was exactly
  the stored prompt. The detail-page nonce check in the resolver catches a missing or different nonce, but not small
  edits elsewhere in the prompt. The protocol adds a read-only composer check before Send.
- No ledger entry is made for a manual submission, so `credits_spent` does not count it. The cost is in the
  attestation.
- Identity freshness (10 min) and handoff age (24 h, counted from handoff creation) still apply. Open the handoff
  only when the video is finished.
- The experiment DB allows one attempt. A new attempt (for example after a changed prompt) needs a new experiment DB
  and a new decision.
