# Phase 2 — Google Flow Adapter Progress

> **Ringkasan (ID):** Adapter Google Flow sekarang ada (`src/blatifa/flow/`).
>
> **Membaca** UI sudah diimplementasikan, karena didukung bukti rekaman live dari Phase 0/1. Yang bisa dibaca: tile grid (termasuk status render), status konfirmasi biaya, dan prompt yang disimpan Flow. Pembacaan memakai snapshot aksesibilitas dan tidak pernah mengklik.
>
> Semua aksi yang **mengubah** sesuatu sengaja **BLOCKED**: lampirkan gambar/Animate, upload, submit, Approve, Reject, download. Aksi ini melempar error sebelum menyentuh halaman.
>
> Locator kini punya tingkat **keyakinan** (high/medium/low). Klik hanya diizinkan untuk locator *high*, yaitu yang sudah dicek live oleh health check Phase 1. Karena itu, Approve dan Reject (*medium*, baru terlihat sekali) tidak bisa diklik meski nanti diizinkan, sampai divalidasi live.
>
> Hasil pembacaan dibedakan menjadi: tidak ditemukan, lebih dari satu, tidak terlihat, nonaktif, status tidak dikenal, dan status berubah tak terduga.
>
> **Tidak ada aksi Flow sungguhan yang dipakai untuk menguji adapter.** Semua tes memakai snapshot rekaman (offline) dan halaman fixture lokal.

Status labels used below: VERIFIED, SIMULATED, PARTIALLY VERIFIED, PROPOSED, BLOCKED.
Date: 2026-11-03. Authorization: GO non-credit development / NO-GO live credit testing (unchanged).

## 1. Missing locators: discovery from existing evidence (no live session used)

All discovery was done **offline** from files recorded in Phase 0/1. Google Flow was not opened during this work.

| Need | Evidence found | Locator / reading rule | Registry status, confidence | Can it be confirmed by read-only live inspection? |
|---|---|---|---|---|
| **Reject** | `radio "Reject"` inside `radiogroup "Permission options"`: open state in `observation_log.md#e-flow-12`, answered/disabled state in `aria/21b-state.aria.yaml` | `cost_confirmation.reject` (role radio, name "Reject", within permission_group) | VERIFIED, **medium**, `deny: true` | Only while a confirmation is open, which needs a submit: **BLOCKED** (prohibited). Its *effect* is UNVERIFIED |
| **Persisted (stored) prompt** | `/edit/<uuid>` page: `button "Ingredient"` → `text: <prompt>` → `button "Reuse prompt"`, plus `button "Expand prompt"` (`aria/20-download-menu.aria.yaml`) | Structural reader `read_stored_prompt` + anchors `media_detail.history_ingredient` / `reuse_prompt` / `expand_prompt` | anchors VERIFIED **medium**, `deny`; the text itself has no role/name | Yes: open an existing video's detail page (same as Phase 1 state `media_detail_video`), no clicks. Not done in this round |
| **Tile generation status** | tile = `flow-grid-tile-container` (role group, aria-label = title) inside `cdk-virtual-scroll-viewport` (`project-idle.elements.json`); done = `img "Generated video thumbnail"`; image = `img "Tile displaying a user's image"`; rendering = text `"4% …"` (observation log only) | `grid.tile` (css), `grid.video_thumbnail`, `grid.image_thumbnail`, `grid.progress_text` | tile/thumbnails VERIFIED **medium**; progress text **PARTIALLY_VERIFIED, low** | Idle/done/image tiles: yes (read-only grid capture). Rendering %, failed tiles: only during a generation: **BLOCKED** |

Two facts found that matter for the design:
- **The grid is virtualised.** `cdk-virtual-scroll-viewport` means tiles outside the viewport may be absent from the DOM. The set difference therefore treats *missing earlier tiles* as `STATE_CHANGED` and never as "nothing changed".
- **Video tiles carry no media id** (E-FLOW-18, re-confirmed: `flow-video-tile` has no `data-media-id`). A finished result cannot yet be linked to `/edit/<uuid>` without a navigation click. The runner stops with `MEDIA_ID_UNRESOLVED` instead of guessing.

## 2. Locator confidence and ambiguity handling (implemented)

| Mechanism | Where | Status |
|---|---|---|
| `confidence: high / medium / low` on every registry entry (default **low**). high = rule-checked live by a Phase 1 health check (30 entries); medium = recorded live evidence only (6 existing + 8 new); low = log/inferred (1: `grid.progress_text`) | `inspector/registry.py`, `flow_locators.yaml` | VERIFIED (unit) |
| `confidence: high` requires `status: VERIFIED` (schema rule) | registry schema | VERIFIED (unit) |
| **Clicks require high confidence** (in addition to VERIFIED, not deny, not credit_sensitive, deny-name list) | `inspector/safety.py` | VERIFIED (unit). Phase 1 click paths still pass (regression suite) |
| Adapter reads require ≥ medium. Low-confidence signals (progress %) only refine an already-read tile | `flow/adapter.py` | SIMULATED (fixture) |
| Ambiguity: `unique` failures → `AMBIGUOUS`; two open confirmations → `AMBIGUOUS` → "unknown"; two history entries → `AMBIGUOUS`; duplicate tile titles handled as a **multiset** | `flow/readers.py`, `flow/outcomes.py` | VERIFIED (unit, on recorded + synthetic snapshots) |

### Outcome classes (`FlowProblem`)

| Outcome | Produced when |
|---|---|
| `NOT_FOUND` | locator count 0, no tiles, no history entry |
| `AMBIGUOUS` | > 1 match where one is required; > 1 open confirmation; > 1 history entry |
| `NOT_VISIBLE` | matched but hidden |
| `DISABLED` | matched but not enabled |
| `STATE_UNKNOWN` | tile with no / contradictory signals; partly disabled radios; unexpected history layout; unparseable snapshot; Playwright error |
| `STATE_CHANGED` | earlier tiles vanished; confirmation options differ from Approve/Always approve/Reject; a control expected checked/disabled/absent is not; browser not on the production project |
| `UNTRUSTED` / `SKIPPED` | locator not VERIFIED or confidence too low / missing parameter |

"An element matched" is never enough. Example: a tile showing both a thumbnail *and* a percentage is `UNKNOWN`, not "done".

## 3. Adapter methods

| Method | Behaviour | Evidence | Status |
|---|---|---|---|
| `snapshot_media()` | grid titles (multiset); raises on any non-OK read | Phase 1 live grid snapshot (offline) + fixture | **PARTIALLY VERIFIED** (recorded live data offline) / SIMULATED (fixture) |
| `observe(pre)` | new tiles by multiset difference. Kinds: done / rendering(%) / unknown. Vanished tiles → `inspected_ok=False` | same + log text for % | PARTIALLY VERIFIED / SIMULATED |
| `pending_confirmation()` | True = one open; False = all answered; **None** = absent / ambiguous / changed | `21b-state` (answered), log (open) | PARTIALLY VERIFIED / SIMULATED |
| `current_quote()` | agent paragraphs before the open radiogroup → `parse_cost_quote` gives 10 credits / 1 video / Veo 3.1 - Lite on the recorded text | E-FLOW-12 text | PARTIALLY VERIFIED |
| `stored_prompt(media_id)` | navigates to `/edit/<uuid>` (UUID-validated, Flow host only), reads the history text, returns to the project | `20-download-menu` | PARTIALLY VERIFIED (parse of recorded page). Navigation not run live |
| `attach_start_image`, `submit`, `approve`, `reject`, `download` | raise `BlockedOperationError("BLOCKED_BY_AUTHORIZATION")` before any page action | — | **BLOCKED** |
| media-id resolution for a finished tile | not implemented | needs a click on the tile (E-FLOW-14) | **PROPOSED** |

Integration with the runner: the runner treats `BLOCKED_BY_AUTHORIZATION` like any adapter error, so the attempt ends in `NEEDS_MANUAL_INTERVENTION` before anything is attached or submitted (fixture test `test_reads_never_click_and_blocked_operations_touch_nothing`). Unknown tiles are polled until timeout and then go to manual. Three consecutive unreadable observations → `UI_UNREADABLE` → manual.

## 4. Tests (all executed; none against live Flow)

| Test file | What | Kind | Result |
|---|---|---|---|
| `tests/unit/test_flow_readers.py` | parser on all 27 recorded snapshots; grid / confirmation / stored prompt on recorded pages; 11 outcome classifications; anomalies (ambiguous, changed, unknown, vanished, duplicates); honest registry confidence | offline on **recorded live** data + synthetic | see `evidence/logs/pytest_full_continuation.log` |
| `tests/browser/test_flow_adapter.py` | adapter in headless Chrome against `tests/fixtures/flow_grid.html` (9 variants); reads never click; blocked operations touch nothing; wrong project / bad ids refused | **SIMULATED** (local fixture) | same log |
| `tests/unit/test_core.py` (updated) | clicks require high confidence; high requires VERIFIED | unit | same log |

## 5. Remaining blockers for the adapter

| # | Blocker | Needs |
|---|---|---|
| A1 | Read-only live validation of the new medium locators (grid tiles, history anchors, stored-prompt text) | Your OK for a read-only session (same kind as Phase 1: open project and an existing video page, no clicks) |
| A2 | Rendering %, failed-tile UI, open confirmation, Reject effect, insufficient-credit text | Only observable during a generation: **BLOCKED** until credit testing is authorized |
| A3 | Media id of a finished tile (click into the tile) | A UI click outside the current read-only states: needs authorization + a high-confidence locator |
| A4 | Possible truncation of long stored prompts (`Expand prompt`) | Live check on a long prompt; clicking Expand is a UI action (deny today) |
| A5 | Virtualised grid: set difference across many tiles | Live check with > 1 screen of tiles; may need a dedicated empty project per episode (PROPOSED in Phase 0) |
| A6 | Attach / submit / approve / reject / download implementations | Explicit authorization (and budget for credit-consuming steps) |
