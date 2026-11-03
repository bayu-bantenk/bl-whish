# Phase 5.1 — Implementation Plan (Media Recognition & Runner Compatibility)

> **Ringkasan (ID):** Fase ini membuat pengenal tile berbasis bukti DOM live Phase 5: video, gambar, karakter, atau tidak dikenal. Pengenal ini dilengkapi aturan **dua sinyal independen** untuk status "selesai" dan observasi berulang untuk stabilitas. Adapter juga berhenti memakai locator lama yang BROKEN.
>
> Semua offline. Tidak ada sesi Flow, klik, atau kredit.
>
> Konsekuensi yang jujur: dengan bukti yang ada sekarang, **belum ada dua sinyal penyelesaian yang terverifikasi live**. Karena itu status "video selesai" sengaja **tidak bisa dicapai** oleh pengenal di produksi, dan hasilnya UNKNOWN.

Date: 2026-11-03. Authorization: offline only (brief §2). No live session was started.

## 1. Mandatory safety audit (findings)

| Item | Finding |
|---|---|
| Baseline (15:50 WIB, after the macOS restart) | Free disk 16 GiB (`df -h`), 18 GB (`df -H`). Swap 0.57 GiB used of 1 GiB (one swap file). No leftover Chrome, headless test Chrome or pytest process. Profile `main` NOT_RUNNING (`logs/baseline.log`) |
| Temp folders | `pytest-of-<user>/pytest-46` and the four kept failed runs (`blatifa-pytest-runs`, 91 MB) **no longer exist**. They were not removed by Blatifa or pytest. macOS clears the per-user temp folder (`/var/folders/…/T`) on restart. Consequence: kept failure artifacts do not survive a restart. Location unchanged; documented |
| Temp isolation | `tests/pytest_safety.py` and `tests/conftest.py` unchanged since Phase 5; `tmp_path_retention_count = 1000000`. The isolation tests run first again (see report) |
| Mutation methods | `GoogleFlowAgentAdapter.attach_start_image/submit/approve/reject/download` raise `BLOCKED_BY_AUTHORIZATION`; `LIVE_ACTIONS_ACTIVE = False` |
| Old video locator in use | `flow/readers.read_tile` still maps `img "Generated video thumbnail"` to `VIDEO_DONE`, and `adapter.observe` turns `VIDEO_DONE` into `complete=True`. That is **silent use of a BROKEN locator** (registry: BROKEN since Phase 5) |
| Runner / state machine | A tile with `state_known=False` is never treated as finished: the runner keeps polling, then `RENDER_TIMEOUT` → manual. Reconcile: unknown → manual. Complete without a media id → `MEDIA_ID_UNRESOLVED` → manual. More than one new tile → `AMBIGUOUS_RESULT`. Dependents wait for FRAME_READY. **No state-machine change is needed**; compatibility belongs in the adapter |
| Network instrumentation | None in `src` (Phase 1 source scan passes) |

## 2. Evidence available for recognition (Phase 5 live, 4 observations + 1 detail probe)

| Tile kind | Observed DOM (tag[attribute names]) | Evidence |
|---|---|---|
| Video (finished) | `flow-video-tile` > `video[aria-label, controlslist, disablepictureinpicture, loop, src]`; `src` = opaque `/asb/` token; no duration text; no `data-media-id` | `docs/phase-5/evidence/live/*-live-probe/live-probe.json` |
| Image | `flow-image-tile` > `img[alt="Tile displaying a user's image", data-media-id, draggable, src]` | same |
| Character | `flow-character-tile` > `img[alt="Character thumbnail", draggable, src]`; `src` = `flow-content.google/image/<uuid>` | same |
| Rendering (new UI) | **never observed** | — |
| Failed / queued | **never observed** in any phase | — |
| Rendering (old UI) | text `"<n>% <prompt>"` (observation log E-FLOW-13; no ARIA or DOM recorded) | Phase 0 |

**Not recorded by Phase 5:** video `readyState`, `duration`, `videoWidth`/`videoHeight`, and the value of the video `aria-label`. Any signal built on these has **no live evidence yet**.

## 3. Work items

| # | Item | Module |
|---|---|---|
| W1 | Tile type model VIDEO / IMAGE / CHARACTER / UNKNOWN / AMBIGUOUS from the observed custom elements **and** their content (both required) | `flow/media_recognition.py` |
| W2 | Video state model with named signals, each in an independence group and with an evidence level. COMPLETED needs ≥ 2 signals from different groups, each at level VERIFIED (discriminating, live). Conflicts → UNKNOWN. FAILED / PENDING only from VERIFIED signals (none exist) | same |
| W3 | Shipped signal policy = the current evidence. Test-only policies exercise the logic and are never used in production code | same |
| W4 | Repeated-observation tracker: state history per session-local tile key; stable = N identical consecutive observations without conflict; regression or conflict → UNKNOWN; duplicate keys → UNKNOWN. No sleeping inside; the caller paces observations | same |
| W5 | Probe script extended (read-only properties only): video `readyState`, `duration`, `videoWidth`, `videoHeight` | `flow/live_probe.py` |
| W6 | Adapter compatibility: the old thumbnail no longer means "done" while its locator is not VERIFIED (recorded as `LEGACY_VIDEO_LOCATOR_BROKEN`). New tiles are recognised by the new model through the read-only DOM script; only a stable VIDEO_COMPLETED yields `complete=True` (and the media id stays unresolved → manual). Character, image or unknown tiles → `state_known=False` | `flow/adapter.py` |
| W7 | Registry: new entries for the observed tile elements (PARTIALLY_VERIFIED / low: observed in the DOM, never validated as locators); `grid.video_thumbnail` stays BROKEN | registry YAML |
| W8 | Tests listed in brief §11; complete suite; lint | `tests/unit/test_phase5_1_*.py`, `tests/browser/…` |

## 4. Not done

No live session. No change to the runner, state machine, reconcile, locks, authorization or mutation methods. No network instrumentation. No video identity mechanism (none is evidence-backed).
