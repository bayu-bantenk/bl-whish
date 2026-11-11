# Attaching a Flow character automatically — research plan (PROPOSED, nothing enabled)

> **Ringkasan (ID):** Ini hanya rancangan. Tidak ada klik yang diaktifkan dan tidak ada kode yang berubah.
>
> Ada dua jalur untuk melampirkan karakter "Octopus" secara otomatis:
> - **A:** tombol + → tab Characters → pilih → "Add to prompt";
> - **B:** ketik `@` → pilih dari daftar.
>
> Sebelum bisa dipakai, setiap locator harus diverifikasi read-only dari tindakan **Anda sendiri**, lalu diizinkan secara eksplisit. Jalur A lebih aman karena sebagian locator-nya sudah VERIFIED.

## 1. What is known

| Element | Registry / evidence | Status |
|---|---|---|
| `button "Add ingredients to the prompt box"` (`composer.add_ingredient`) | VERIFIED/high; the health check already opens the picker and closes it with Escape | usable for opening only |
| Picker: `listbox "Asset list"`, `tablist "Category navigation"` (All, Images, Videos, Voices, **Characters**, Avatars, Uploads) | VERIFIED/high (Phase 0) | read-only |
| `button "Add to prompt"` | VERIFIED/high, **`deny: true`** | never clicked by Blatifa |
| Option for an **image** in the asset list: `option "<title> Image"` | VERIFIED once (E-FLOW-11, "Blatifa Image") | — |
| Option for a **character** (Characters tab) | **UNVERIFIED** (tab never opened) | — |
| `@` mention list in the prompt box | **UNVERIFIED** (the user used it in Phase 5.3b; no DOM read while it was open) | — |
| Attached character in the composer | Phase 5.3b: the accessibility text showed `Octopus` before the prompt; the role of the chip was not captured | PARTIAL |
| Stored result | Phase 5.3b detail page: `img "Character ingredient image"` | OBSERVED once |
| Hazard | clicking an ingredient chip **removes** it (E-FLOW-25) | VERIFIED |

## 2. Read-only verification (no Blatifa click, no credits)

1. The **user** opens the picker (+), opens the **Characters** tab and leaves it open. Blatifa reads the accessibility tree:
   - tab state;
   - the option role and name for "Octopus";
   - whether the option names are unique.
2. The **user** selects "Octopus" and clicks "Add to prompt". Blatifa reads the composer chip: role, name, and whether the name is unique.
3. The **user** clears it, then types `@` in the prompt box. Blatifa reads the mention list: role (`listbox`/`option`?) and names.
4. Repeat in a second session to confirm the locators are stable.
5. A new **`flow_character` attachment check**, read-only: before sending, the composer must show exactly one character chip named after the episode's `reference_images[].label`. This alone is useful today as a gate for the *manual* attachment, and would replace the `FLOW_CHARACTER_MANUAL` reminder with a verified read.

No generation is needed. Send is never pressed.

## 3. What automation would require (separate authorization)

- New registry entries with evidence (`ingredient_picker.characters_tab`, `ingredient_picker.character_option`, `composer.character_chip`), each VERIFIED **and** high confidence. The click guard (`assert_click_allowed`) already demands this.
- Lifting `deny: true` from `ingredient_picker.add_to_prompt`. This is an explicit user decision, recorded in the registry notes.
- `authorization.py`: a new action `attach_character` (state-changing; denied while `LIVE_ACTIONS_ACTIVE` is False). Credit impact: none expected (attaching was free in Phase 0), but it must be re-confirmed by the balance reading.
- Path A only. The `@` path types into the prompt box and depends on a pop-up timing, so it stays manual.
- Guard rails:
  - never click a chip (E-FLOW-25);
  - attach exactly one character whose option name equals the label;
  - verify the chip by reading after attaching;
  - stop if the name is ambiguous or missing;
  - no upload.

## 4. Acceptance tests (offline, before any live use)

- Fixtures from the step-2 recordings: option and chip found by exact name; ambiguous or missing names stop the flow.
- The click guard refuses the new entries until they are VERIFIED/high.
- `attach_character` is denied while `LIVE_ACTIONS_ACTIVE` is False.
- The readiness `FLOW_CHARACTER_MANUAL` finding is replaced only when the chip check passes.

Status: **PROPOSED**. Nothing in this plan is implemented or enabled.
