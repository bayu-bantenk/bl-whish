# Phase 5.3g — Live read-only execution protocol (NOT EXECUTED)

> **Ringkasan (ID):** Ini urutan langkah untuk uji live read-only, jika nanti disetujui. Protokol **belum
> dijalankan**, dan saat ini **tidak bisa dijalankan**: belum ada attempt dengan persiapan strict (lihat preflight
> §5). Prasyarat P1 harus dipenuhi lebih dulu, lewat keputusan terpisah.

## Preconditions (all required; stop if any is missing)

| # | Precondition | Check |
|---|---|---|
| P1 | `p53g.db` holds exactly one attempt prepared by `prepare_attempt` (new nonce, real experiment, project `562eec3d-…`, account `d6c9f4583fa6`), in `NEEDS_MANUAL_INTERVENTION / MEDIA_ID_UNRESOLVED`, and one handoff in `MANUAL_HANDOFF_REQUIRED` | `handoff status` / `show`; **currently not met (BLOCKED)** |
| P2 | The user's explicit approval of this live read-only run | message in the conversation |
| P3 | Disk ≥ 5 GiB (≥ 10 GiB preferred), lid open, cursor away from tiles | `df -h /` |
| P4 | `LIVE_ACTIONS_ACTIVE = False`, 18 × `deny: true`, protected hashes OK | `shasum -c docs/phase-5.3g/evidence/baseline_hashes.txt` |
| P5 | `BLATIFA_LIVE` not set; no runner started | — |

`DB=~/BlatifaStudio/experiments/phase-5.3g/p53g.db` below.

## Sequence

| Step | Who | Action | Expected |
|---|---|---|---|
| 1 | user (or Blatifa, after approval) | `uv run blatifa browser start --profile main --url https://flow.google.com/project/562eec3d-9c48-4802-b152-3ed1d8c91ebd` | dedicated Chrome on the project **grid**; never the personal profile |
| 2 | Blatifa | `uv run blatifa handoff status --db $DB` then `handoff show <id> --db $DB` | one handoff, `MANUAL_HANDOFF_REQUIRED` |
| 3 | Blatifa | `uv run blatifa handoff ready <id> --db $DB --profile main` (read-only) | `WAITING_FOR_USER`. It is refused if the binding is invalid (before any browser read), if identity is not VERIFIED, if the fingerprint differs, or if the page is not the bound project. |
| 4 | **user** | Within 10 minutes of step 3: click the candidate video tile **yourself** and wait for its detail page. Do nothing else: no edit, no Send, no Approve. Dismiss no dialog; if one appears, report it. | URL `/project/562eec3d-…/edit/<route>` |
| 5 | Blatifa | `uv run blatifa handoff confirm-opened <id> --db $DB` | the confirmation is recorded once |
| 6 | Blatifa | `uv run blatifa handoff observe <id> --db $DB --profile main` (read-only) | `RECONCILED`, with `verified_route` equal to the route in the URL. Otherwise `IDENTITY_REJECTED` with reasons, and the attempt stays `MEDIA_ID_UNRESOLVED`. |
| 7 | Blatifa | `uv run blatifa handoff show <id> --db $DB`; save the output and evidence hash to `docs/phase-5.3g/evidence/` | — |
| 8 | user | Go back to the grid (browser Back) if wanted; close the dedicated Chrome when done | — |

## Abort rules (no automatic retry)

Abort on any of the following: identity not VERIFIED, a wrong project or account, a dialog, an unexpected page, a
browser crash or close, disk < 5 GiB, any request to click, type, Send, Approve or Generate, or a credit-balance
change. A failed `ready` or `observe` leaves the state unchanged and is noted. A rejected handoff needs a new
`ready` and a new confirmation, and only after a new approval. To stop: `uv run blatifa handoff cancel <id> --db $DB
--reason "<why>"`.

## Never

Generate, Submit, Approve, Publish, prompt edits, uploads, Character Picker, automatic tile clicks, navigation by
Blatifa, network listeners or interception, account switching, `BLATIFA_LIVE=1`, legacy handoff mode, reuse of the
retired 5.3d nonce.
