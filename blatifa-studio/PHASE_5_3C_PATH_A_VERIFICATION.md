# Phase 5.3c — Path A read-only verification (Characters picker → "Add to prompt")

> **Ringkasan (ID):** Pengguna mengklik; Blatifa hanya membaca. Tidak ada klik Blatifa, tidak ada Send, tidak ada kredit,
> tidak ada perubahan registry atau otorisasi. Hasil utama: opsi karakter **`option "Octopus"`** unik dan namanya persis
> label, tetapi chip di kotak prompt hanya bernama **`button "Ingredient"`** tanpa nama karakter. Jadi identitas karakter
> hanya bisa dibuktikan di picker, bukan dari chip.

Plan: `docs/phase-5.3b/INGREDIENT_CLICK_RESEARCH_PLAN.md` §2 (path A only; the `@` path was not part of this run).
Date: 2026-11-05. Account identity VERIFIED `d6c9f4583fa6` in every snapshot. No dialogs. Disk ≈ 8–9 GiB.

## 1. Sequence

| # | Who acted | Action | Snapshot (UTC) | Evidence |
|---|---|---|---|---|
| 0 | — | baseline (grid page, picker closed) | 13:50:20 | `evidence/00_baseline.json` |
| 1 | user | + → tab Characters, nothing selected | 14:53:05 | `evidence/01_characters_tab.json` |
| 2 | user | select Octopus → "Add to prompt" | 14:55:28 / 14:55:46 | `evidence/02_chip.json`, `evidence/02b_chip_subtree.json` |
| 3 | user | "Clear prompt" (chip never clicked) | 14:57:56 / 14:57:57 | `evidence/03_cleared.json`, `evidence/03b_chip_subtree.json` |

Tools (read-only, aria snapshot through `lp.ReadOnlyPage`): `tools/read_ui.py`, `tools/chip_subtree.py`.

## 2. Findings

| Element | Role / name observed | Count | Notes |
|---|---|---|---|
| Picker trigger | `button "Add ingredients to the prompt box"` | 1 | `expanded` while open |
| Category tabs | `tablist "Category navigation"` → `tab "Characters"` | 1 | `selected` after the user's click |
| Asset list | `listbox "Asset list"` | 1 | same as Phase 0 |
| Character option | **`option "Octopus"`** | **1 (unique)** | name equals the episode label exactly; no suffix (images are `"<title> Image"`) |
| Other characters | `option "Sea Lion"`, `option "Dolphin"` | 1 each | no option `selected` before the user's choice |
| Add button | `button "Add to prompt"` | 1 | registry stays `deny: true` |
| Chip after adding | **`button "Ingredient"`** > `img "Character ingredient image"` | 1 | **no character name** in the chip subtree; textbox stayed empty |
| Clear button | `button "Clear prompt"` | 1 | appears only while the composer has content |
| Send | `button "Start generation"` | 1 | `disabled` with an empty textbox |
| After "Clear prompt" | chip, chip image and "Clear prompt" gone | 0 | node multiset identical to the baseline |

Observations:
- Adding closes the picker (the whole tablist/listbox subtree disappears).
- "Clear prompt" removes the ingredient chip too, not only text. This is a safe way to undo an attachment (no chip click).

## 3. Consequences for the plan

1. **Picker locators are good candidates:** `tab "Characters"` and `option "<label>"` (exact, unique) were read once.
   Stability across a second session is not yet confirmed (plan §2.4).
2. **The chip cannot prove which character is attached.** Its accessible name is the generic `"Ingredient"`. A read-only
   check can verify "exactly one character ingredient is attached" (one `button "Ingredient"` holding
   `img "Character ingredient image"`), but **not** that it is Octopus. Image URLs/tokens are not used for identity
   (standing rule).
3. Plan §2.5 ("one chip named after the label") is therefore **not achievable as written**. A viable variant: identity is
   established at the picker step (unique exact `option` name), and the chip check confirms the count and the kind only.
   After sending, the detail page shows the same generic `img "Character ingredient image"` (Phase 5.3b), so the name is
   not recoverable there either; the user's visual check stays the identity confirmation.
4. `FLOW_CHARACTER_MANUAL` in readiness stays as it is.

## 4. What did not happen

No Blatifa click, keypress or text input. No Send, no generation, no credit use. No registry, authorization, code or test
change. No files deleted. The `@` mention path was not examined.

## 5. Session 2 (plan §2.4)

The dedicated Chrome was stopped and started again (`blatifa browser stop/start --profile main`) to get a fresh session;
the user repeated the same three clicks. Evidence: `evidence/session2/` (`s2_00_baseline` 15:00:33, `s2_01_characters_tab`
15:02:00, `s2_02_chip` + `s2_02b_chip_subtree` 15:04:35, `s2_03_cleared` + `s2_03b_chip_subtree` 15:05:51 UTC).

| Check | Result |
|---|---|
| Picker nodes (tablist, `tab "Characters"` selected, listbox, 3 options, "Add to prompt") | identical to session 1 |
| Nodes added by "Add to prompt" | identical: `button "Ingredient"`, `img "Character ingredient image"`, `button "Clear prompt"` |
| Chip subtree | identical; no character name; `Start generation` disabled |
| After "Clear prompt" | chip count 0; composer back to baseline |

One unrelated difference: the number of `img "Generated video thumbnail"` on the grid varied between snapshots
(session 2: 3 → 2 → 1 → 1; session 1: 2 → 2). It does not involve the composer or picker and is likely lazy loading of
grid tiles; it is not used for any conclusion.

Status: **path A read in two sessions; picker and chip locators stable.** Nothing enabled; automation still needs the
separate authorization in plan §3, with the chip-identity limitation in §3 above.
