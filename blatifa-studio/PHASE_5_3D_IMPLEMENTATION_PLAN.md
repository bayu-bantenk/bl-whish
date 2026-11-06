# Phase 5.3d — Implementation plan (preparation only)

> **Ringkasan (ID):** Fase ini hanya persiapan. Tidak ada generate, Submit, Approve, klik picker, atau pemakaian kredit.
> Tidak ada perubahan kode produksi, registry, atau otorisasi.

## Scope

| Item | Done in 5.3d | Not done |
|---|---|---|
| Preflight (disk, memory, Chrome, identity) | yes, read-only | no dialog dismissal |
| Experiment ID, nonce, prompt + SHA-256 | yes (offline) | prompt not sent to Flow |
| Octopus lock check | yes, hash and verbatim check | lock never edited |
| Grid baseline | yes, read-only (one observation) | no tile interaction |
| Manual picker instructions | yes (written) | no automation, `deny: true` kept |
| Cost gate, observation plan | yes (written) | no live run |

## Approach

1. Preflight (§2 of the brief). Disk 8.90 GiB was below the 10 GiB gate; the user extended the ≥ 5 GiB override to 5.3d
   (AskUserQuestion, 2026-11-06). Recorded in `evidence/preflight_1.log`.
2. Metadata: `secrets.token_hex(4)` nonce, checked to have no hit in the repository (which holds every earlier prompt and
   nonce). Experiment ID `EXP-P53D-20261106-12EF`. Manifest: `EXPERIMENT_MANIFEST.yaml`.
3. Prompt: `tools/build_prompt.py` uses the production `assemble_prompt`; stops if the Octopus lock is missing, not
   APPROVED, or its SHA differs from `2af1471e…6f12`. The brief's lock text hashes to the same value.
4. Read-only baseline with the existing tools: `docs/phase-5.3b/tools/fast_watch.py` (grid tiles, redacted URL
   fingerprints, confirmation state) and `docs/phase-5.3c/tools/read_ui.py` (accessibility tree, identity, dialogs).
5. Offline re-analysis of the Phase 5.3/5.3b recordings for objective 2 (identifier stability). See the evidence register.

## Tools added

- `tools/build_prompt.py`: offline; writes `PROMPT.txt`. No browser.

No production code, test, registry or authorization file was changed.
