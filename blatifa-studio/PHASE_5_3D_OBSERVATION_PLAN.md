# Phase 5.3d — Observation plan (read-only, PROPOSED)

> **Ringkasan (ID):** Rencana pengamatan untuk eksperimen nanti. Blatifa hanya membaca DOM, tanpa klik, tanpa
> instrumen jaringan. Tile baru saja tidak cukup untuk membuktikan bahwa video itu milik eksperimen ini; buktinya harus
> nonce yang terbaca di halaman detail video.

Rules for all checkpoints: no Blatifa click, keypress, navigation or input; no network listeners or interception; cursor
away from tiles (hovered observations are discarded); laptop lid open, `caffeinate -i` during the run. Media `src` values
are kept only as redacted fingerprints (`path_fingerprint`), never raw.

## A. Before the manual submission

| Item | Tool | Pass condition |
|---|---|---|
| Identity | `read_ui.py` | VERIFIED `d6c9f4583fa6`, no dialog |
| Credit balance | user-reported (not visible in the page tree without interaction; 01:29Z read found none) | ≥ cost later |
| Grid inventory | `fast_watch.py` (1 obs) | titles + types + fingerprints recorded; no hover |
| Experiment ID, nonce, prompt hash | manifest | unchanged |
| Ingredient | `read_ui.py` / `chip_subtree.py` | exactly 1 `button "Ingredient"` + `img "Character ingredient image"` |
| Composer text | `docs/phase-5.3b/tools/read_composer.py` | nonce present once; Octopus lock verbatim |

## B. Immediately after the user presses Send

- Start `fast_watch.py` (3 s cadence) **before** Send; keep it running.
- Read the confirmation: cost gate (preparation §4). The user approves or rejects.
- Record tile count and states; a new tile is expected to show `flow-pending-tile` + `flow-soupy-overlay`
  (signal `pending_overlay`, VERIFIED in 5.3/5.3b).

## C. During generation

- Repeated observations; no single `<video>` element and no thumbnail alone counts as completion.
- Never interact with tiles. Record transitions (thumbnail + pending at once = conflict, not completion).

## D. After apparent completion

1. **New vs existing:** multiset difference of tile titles against checkpoint A; exactly one new tile, no pre-existing
   tile gone. Also compare `path_fingerprint`s. Stop if more than one candidate.
2. **Stable identifier:** the grid gives none for videos (see evidence E-P53D-07/08). The only candidate is the detail-page
   route `/edit/<uuid>`, which requires the **user** to open the new tile. Blatifa then reads the URL (route UUID) and,
   after the user returns to the grid and opens it again later (or in a new browser session), checks that the same
   route opens the same stored prompt with the same nonce.
3. **Association:** on the detail page, `live-probe --find-text "[blatifa-exp-12ef8b99]"` must find the nonce in the stored
   prompt, together with `img "Character ingredient image"`. Only nonce-on-detail-page counts as scene↔video evidence;
   title, order, time, and tile appearance do not.
4. Record and report; no claim of association without step 3.

## Stop conditions

Identity not VERIFIED; unexpected dialog or UI; cost unreadable or > 50 (or > balance); prompt or lock changed before
Send; more than one candidate tile; any action that would need a Blatifa click; disk < 5 GiB (user override) or swap
exhausted. No retry, no recovery submission.
