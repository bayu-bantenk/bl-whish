# Phase 5.3d — Experiment preparation

> **Ringkasan (ID):** Prompt, nonce, dan ID eksperimen sudah siap untuk Anda tinjau. Lock Octopus sama persis (hash
> cocok). Belum ada yang dikirim ke Flow. Pemilihan karakter, Send, dan Approve tetap Anda lakukan sendiri, dan hanya
> setelah ada keputusan izin terpisah.

## 1. Metadata

| Field | Value |
|---|---|
| Experiment ID | `EXP-P53D-20261106-12EF` |
| Nonce | `[blatifa-exp-12ef8b99]` (new; 0 hits in the repository) |
| Prepared at | 2026-11-06T01:30Z |
| Scene ID | `EXP-P53D-S01` (experiment-only, Octopus only; the episode file is unchanged) |
| Prompt file | `docs/phase-5.3d/PROMPT.txt`, 996 characters |
| Prompt SHA-256 | `9dc27ab674fac0c2dbe8ef11de9df0152394e604ef8be787b534aa3033e7f83b` |
| Character ingredient | Flow character **Octopus** (path A, attached manually by the user) |
| Octopus lock | `octopus_pink`, APPROVED, SHA `2af1471e6fff10cea47f3154cf425cb7c4d74c1320eda6ef7377cac2d2666f12`, verbatim |
| Style lock | `blatifa_3d_style`, DRAFT, SHA `c8c53e54…ec90d`, inserted verbatim as text only (not approved by this use) |
| Grid baseline | `evidence/A0_grid_baseline.jsonl` (11 tiles, 01:29:04Z); see §5 |
| Manifest | `EXPERIMENT_MANIFEST.yaml` |

## 2. Final prompt (complete, for review)

```
[STYLE] Soft 3D animated family-friendly style, warm cozy lighting, consistent character design across all scenes, no text, no subtitles, no watermark overlays.
[CHARACTERS] The Octopus has a very important facial characteristic: its mouth is a small rounded protruding circular pout. ABSOLUTELY PRESERVE THIS OCTOPUS MOUTH. Do NOT turn the Octopus mouth into a normal smiling mouth. Do NOT make the mouth wide. Do NOT flatten the mouth. Do NOT remove the protruding circular pout.
[SCENE] The pink octopus from the attached Octopus character floats gently in calm, clear blue water against a plain, simple background and slowly waves one tentacle at the camera. Keep its appearance exactly as in the attached character. No other characters, no other objects.
[CAMERA] Static camera, medium shot.
[AVOID] no text or subtitles in the video; no extra characters
[FORMAT] One video, 9:16, about 8 seconds.
Experiment reference, metadata only, never shown as text in the video: [blatifa-exp-12ef8b99]
```

Lock checks (offline, `tools/build_prompt.py`): the episode lock text hashes to its recorded SHA; that SHA equals the
established `2af1471e…6f12`; the lock text given in the brief hashes to the same value; it occurs verbatim in the prompt.

The nonce is a metadata line at the end. In Phase 5.3 and 5.3b, Flow's agent rewrote the non-lock text but kept the
nonce and the locks in the stored prompt; the same is expected but not assumed.

## 3. Manual Character Picker procedure (user only)

Blatifa never clicks the picker or "Add to prompt" (`deny: true` stays). Locators verified read-only in two sessions
(Phase 5.3c).

1. Click **+** (Add ingredients to the prompt box), then the tab **Characters**.
2. Confirm there is **exactly one** option named **Octopus**. Stop if it is missing or appears more than once.
3. Click **Octopus**, then **Add to prompt**.
4. Blatifa reads: exactly one `button "Ingredient"` holding `img "Character ingredient image"`.
5. The chip has no character name, so the Octopus identity rests on step 2–3 (your selection). Never click the chip
   (it removes the ingredient). To undo, use **Clear prompt**.
6. Paste the prompt from §2 into the prompt box (text only). Blatifa reads the composer: nonce present, chip count 1.

## 4. Cost gate (before any Approve)

- The cost must be shown by Flow in the confirmation ("…costing N credits?") and read by Blatifa from the page.
- Unreadable → STOP. N > 50 → STOP. N > current balance → STOP. More than one video in the quote → STOP.
- No assumed cost; earlier experiments (10 credits) are not used to infer it.
- Recorded: the quote text, N, the read time, and the evidence file (accessibility-tree JSON; a screenshot only if
  the user takes one).
- The user decides alone whether to Approve. Never "Always approve".

## 5. Pre-experiment grid record (read-only, 2026-11-06 01:29Z)

11 tiles, no hover, confirmation ABSENT: 3 videos ("Pink octopus waving tentacle", "Pink octopus waving in water",
"Cat waving to camera"), 3 characters (Sea Lion, Octopus, Dolphin), 5 images. Titles are unique.

**Identity at that moment: UNKNOWN**, because a Flow dialog "What's new" was open (`evidence/A0_ui_baseline.json`).
Blatifa did not dismiss it. Checkpoint A must be re-taken after the user closes the dialog; until then the live part of
the preparation is **BLOCKED** (see the evidence register).
