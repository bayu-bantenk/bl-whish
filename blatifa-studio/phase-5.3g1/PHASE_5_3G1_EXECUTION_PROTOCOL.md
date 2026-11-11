# Phase 5.3g.1 — Execution protocol for the next phase (NOT EXECUTED, NOT AUTHORIZED)

> **Ringkasan (ID):** Ini urutan langkah untuk satu video manual nanti. Setiap langkah butuh izin terpisah dan
> eksplisit, termasuk biaya yang Anda cek dan setujui sebelum Send. Blatifa hanya membaca. Yang memilih karakter,
> menempel prompt, menekan Send dan Approve, serta membuka tile adalah **Anda**.

`DB=~/BlatifaStudio/experiments/phase-5.3g/p53g.db` · attempt `4ae102de6bbb4612b9b862449fbd993c` · nonce
`[blatifa-exp-1e05d92f]` · prompt sha256 `f45e9887…35c5`

## Preconditions

| # | Precondition |
|---|---|
| P1 | The user's explicit authorization for **one** manual generation, with a credit ceiling (≤ 50 and ≤ balance), no retries |
| P2 | `uv run blatifa experiment status` → `PREPARED`, with the same nonce and hash as above |
| P3 | Disk ≥ 5 GiB; lid open; protected hashes OK; `LIVE_ACTIONS_ACTIVE = False`; `BLATIFA_LIVE` unset |

## A. Before Send (user acts, Blatifa reads)

1. User reviews `docs/phase-5.3g1/FINAL_PROMPT.txt` and copies it exactly: `pbcopy < docs/phase-5.3g1/FINAL_PROMPT.txt`.
2. `uv run blatifa browser start --profile main --url https://flow.google.com/project/562eec3d-9c48-4802-b152-3ed1d8c91ebd`
   (dedicated profile only).
3. Blatifa: read-only identity check on the grid (`blatifa live-probe`). Identity must be VERIFIED with `d6c9f4583fa6`.
4. User: `+` → Characters → option "Octopus" → Add to prompt (path A, as in 5.3d). Then paste the prompt. **Do not
   Send yet.**
5. Blatifa: read-only composer check (the 5.3d `read_composer.py` method). The nonce must be present exactly once
   and the locks verbatim. **The user waits for Blatifa's "OK, boleh Send".**
6. User: Send. Blatifa reads the cost quote read-only (the 5.3d `read_quote.py` method). Gate: readable, 1 video,
   ≤ the ceiling, ≤ the balance. The user decides and presses Approve. Never "Always approve".

## B. After the video is finished

7. Attest, with the user's own words and the cost Flow showed:
   `uv run blatifa experiment attest --nonce "[blatifa-exp-1e05d92f]" --prompt-sha256 f45e9887b2ec1cad11589f620409654596c1d72429db969fee3cee8ba87735c5 --project 562eec3d-9c48-4802-b152-3ed1d8c91ebd --account d6c9f4583fa6 --statement "<kata-kata pengguna>" --cost <n>`
   → `MANUAL_SUBMISSION_REPORTED`
8. `uv run blatifa experiment handoff` → handoff id, `DETAIL_OBSERVATION_PENDING`
9. On the grid: `uv run blatifa handoff ready <hid> --db $DB --profile main` → `WAITING_FOR_USER`.
10. User, within 10 min: click the new video's tile **yourself**; open its detail page; nothing else.
11. `uv run blatifa handoff confirm-opened <hid> --db $DB`
12. `uv run blatifa handoff observe <hid> --db $DB --profile main` → `RECONCILED` (route = URL route, nonce on the page)
    or `IDENTITY_REJECTED`.
13. `uv run blatifa experiment status` → `RECONCILED` or `UNRESOLVED`. Save the outputs to `docs/phase-5.3g1/evidence/`
    or to the next phase's evidence folder.

## Abort (never retry automatically)

Abort on any of these:
- identity not VERIFIED, or a wrong project or account;
- the composer does not hold the exact prompt or the nonce;
- a cost that is unreadable, over the ceiling, or for more than 1 video;
- any dialog, a browser crash, or disk < 5 GiB;
- any request for Blatifa to click or type.

If the prompt was changed before Send, do **not** attest. That attempt stays `PREPARED`, a new preparation needs a
new experiment DB, and no second generation happens without a new authorization. To stop a handoff:
`uv run blatifa handoff cancel <hid> --db $DB --reason "<why>"`.

## Never

Blatifa clicks, types, Sends, Approves, Generates or Publishes; automatic tile clicks; Character Picker automation;
network listeners or interception; account switching; `BLATIFA_LIVE=1`; legacy handoff mode; reuse of a retired nonce.
