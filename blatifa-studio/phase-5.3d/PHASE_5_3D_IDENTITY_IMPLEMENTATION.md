# Phase 5.3d follow-up — video identity in code (option 1)

> **Ringkasan (ID):** Temuan 5.3d dimasukkan ke kode sebagai logika murni (tanpa browser, tanpa klik). ID video = rute
> halaman detail yang dibuka **pengguna**; video dianggap milik scene hanya jika nonce scene itu terbaca dan tidak ada
> nonce Blatifa lain. Selain itu: UNRESOLVED → intervensi manual. Runner tetap nonaktif.

Authorized by the user: "lanjut pilihan 1" (2026-11-06). Offline only; no credits, no Flow interaction.

## Changes

| File | Change |
|---|---|
| `src/blatifa/flow/media_identity.py` (new) | `new_nonce`, `append_nonce` (same metadata line as 5.3–5.3d), `find_nonces(tree)`, `DetailEvidence` (+ `from_detail` for `DetailResult`/recordings), `resolve_video_identity` → `IdentityResult` VERIFIED/UNRESOLVED, `with_identity(tile, result)` |
| `src/blatifa/flow/live_probe.py` | `DetailResult.nonces`: every Blatifa nonce on the detail page (read-only, from the already captured tree) |
| `src/blatifa/cli.py` | `live-probe` detail output also prints the nonce count |
| `tests/unit/test_phase5_3d_identity.py` (new, 9 tests) | over the recorded 5.3d detail pages and grid |

VERIFIED requires all of: URL path `/project/<project>/edit/<route>` of the expected project; page opened by the user;
identity VERIFIED on the project page right before; no dialog; the scene's nonce present; no other Blatifa nonce.

## Not changed

- The runner is not wired to call this (it has no adapter that may open a detail page; opening a tile is a user click).
  Its existing behaviour stays: a complete tile without media id → `MEDIA_ID_UNRESOLVED` → manual intervention.
- `assemble_prompt` does not add a nonce by itself; `append_nonce` is available for the submission step.
- Registry, authorization (`LIVE_ACTIONS_ACTIVE = False`), `deny: true` entries, existing tests: unchanged.

## Verification

ruff: all checks passed. `tests/unit/test_phase5_3d_identity.py`: 9 passed. Full suite: **392 passed, 7 skipped**
(`evidence/pytest_full_identity.log`); before: 383 passed.

Recorded cases covered: new video on open and re-open → same route `a25e3913…`; same-title old video → `36a14bd6…`
(equals the 5.3b manifest) only with its own nonce; wrong nonce, foreign nonce, other project, grid page, dialog,
not user-opened, identity not verified → UNRESOLVED; reconcile completes only with a VERIFIED identity.
