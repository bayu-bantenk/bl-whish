# WP-0.2 — Google Flow UI Discovery

> **Ringkasan (ID):** Google Flow sudah diinspeksi langsung pada 2026-11-02 memakai akun Anda di profil Chrome terpisah. Tidak ada *pemilih mode* di kotak prompt. **Koreksi dari pengguna:** fitur **"Animate"** ada di menu ⋮ (muncul saat hover) pada tile **gambar**. Hasil inspeksi: menu "Animate" menaruh gambar itu sebagai *ingredient* di kotak prompt agen yang sama. Jadi semua pembuatan video tetap lewat **panel agen (chat)**: lampirkan gambar sebagai *ingredient*, tulis prompt, agen menyebut biaya kredit dan meminta persetujuan, lalu video dirender. Satu video uji (10 kredit) berhasil dibuat, di-download (720p), divalidasi, dan frame terakhirnya diekstrak. Risiko terbesar: **agen Flow menulis ulang prompt**, sehingga *character lock* bisa berubah.

- Inspection date: 2026-11-02, 13:15–13:40 local time.
- Flow URL: `https://flow.google.com` (the old `labs.google/fx/tools/flow` redirects to `https://flow.google.com/about`) — VERIFIED (E-FLOW-01).
- Browser: Google Chrome 156.0.8078.74, dedicated profile, attached over CDP by Playwright 1.64.1 (see `BROWSER_AUTOMATION_ARCHITECTURE.md`).
- Account tier observed: one with daily-refreshing credits; 1080p/4K downloads and tool creation require "Upgrade".
- UI framework: Angular + Angular Material (`_ngcontent-ng-c…`, `mat-button-toggle`, `mat-icon`) — VERIFIED (E-FLOW-06, E-FLOW-18).
- Evidence files: `docs/phase-0/evidence/` (ARIA snapshots, element inventories, screenshots, downloaded media). Email addresses and account names are redacted. Cookies, tokens and storage were never read.

Status labels follow `PHASE_0_EVIDENCE_REGISTER.md`: VERIFIED, PARTIALLY VERIFIED, PROPOSED, UNVERIFIED, BLOCKED.

---

## 1. The most important finding: Flow is now agent-driven

The task brief assumed classic Flow modes (Frames to Video, Animate Image, Text to Video) with a mode selector. **In the current UI the composer has no mode selector**. This was VERIFIED by inspecting the project page, the composer menus, the image edit view, the scene editor and the Tools/Templates catalogue (E-FLOW-02 … E-FLOW-09).

**Correction (2026-11-02, after user feedback):** the first version of this document said that no "Animate" entry point exists. That was wrong. The tile hover menu was not inspected in the first pass. An image tile's hover `More options` menu contains **`menuitem "Animate"`** (E-FLOW-22). Clicking it does **not** open a separate mode. It attaches that image as an ingredient chip to the same agent composer. It spends no credits (balance 40 before and after), and the URL does not change (E-FLOW-23). See §2.11.

Video generation goes through a conversational **agent panel** ("session"):

```
Project page
 └─ Session panel (right side)
     ├─ textbox "What do you want to create?"      ← prompt
     ├─ button "Add ingredients to the prompt box" ← attach images/videos (start frame)
     ├─ button "Agent instructions"                 ← persistent per-project instructions
     ├─ button "Settings"                           ← agent settings (model, ratio, confirm policy)
     └─ button "Start generation"                   ← sends the message to the agent
          ↓
     Agent replies: "…costing 10 credits?"  radiogroup "Permission options": Approve / Always approve / Reject
          ↓ Approve
     New tile in grid with % progress → "Generated video thumbnail"
```

Consequences for the architecture:

1. "Frames to Video" and "Animate Image" lead to the **same workflow**: prompt + image ingredient. The image can be attached in two ways: (a) `Add ingredients to the prompt box` → picker → `Add to prompt`, or (b) the tile menu `Animate`. Both produce an identical `flow-image-ingredient-chip` with no start-frame marker in the DOM (E-FLOW-24). Whether Flow internally passes a different intent for (b) is UNVERIFIED, because no generation was run through path (b). Whether the agent treats the ingredient as a strict *first frame* or as a loose *reference* is **not deterministic UI behaviour** and is UNVERIFIED. In the test, the output's first frame visually matched the source image (same pose, room, dress); this was observed once and is not proven in general.
2. The agent **interprets and rewrites the prompt** (§6). The Flow Adapter must verify what was actually generated.
3. The agent shows the **credit cost before spending** and waits for approval (with the project setting "Confirm before generating: Always"). This gives the automation a safety gate.

## 2. Workflow map

### 2.1 Project navigation — VERIFIED (E-FLOW-02)

| Element | Role | Accessible name / label | Locator candidate | Stability |
|---|---|---|---|---|
| Project URL | — | `/project/<project-uuid>` | URL pattern | High — UUID in URL |
| Project title | heading L1 + textbox | `"Blatifa"` / textbox `"Editable text"` | `get_by_role("heading", level=1)` | Medium (user-editable) |
| Home | button | `"Home"` | role+name | High |
| Back (inside media) | button | `"Back button to go to previous page"` | role+name | High |
| Left nav | navigation | `"Project navigation"` → buttons `All media`, `Images`, `Characters`, `Scenes`; links `Library`, `Tools`, `Create tool`, `Trash` | role+name scoped to navigation | High |
| Media tile | group | `aria-label` = media title (e.g. `"Blatifa"`, `"Cat waving to camera"`) | `get_by_role("group", name=…)` | **Low as identity** — titles are free text, the agent picks them for new media |
| Image tile ID | `img[data-media-id]` | UUID | `[data-media-id="<uuid>"]` | High for images (VERIFIED); **not observed on the video tile** (PARTIALLY VERIFIED, E-FLOW-18) |
| Media detail URL | — | `/project/<project-uuid>/edit/<media-uuid>` | URL pattern | High (VERIFIED for image and video) |
| Scene URL | — | `/project/<project-uuid>/scene/<scene-uuid>` | URL pattern | High |

### 2.2 Generation composer (session panel) — VERIFIED (E-FLOW-02, -03, -11)

| Element | Role | Accessible name | Notes |
|---|---|---|---|
| Prompt input | textbox (contenteditable with `paragraph`) | `"What do you want to create?"` | Accepts typed text; `press_sequentially` worked. `fill()` untested. |
| Attach ingredient | button | `"Add ingredients to the prompt box"` | Opens asset picker (2.3) |
| Agent instructions | button | `"Agent instructions"` | Opens a list with `"Add instruction"` and `"Done"` (E-FLOW-05) |
| Agent settings | button | `"Settings"` (**2 matches on page**; the composer one is index 1) | Must be scoped to the session panel, not `nth` |
| Send | button | `"Start generation"` | `[disabled]` when prompt empty; enabled after typing |
| Stop | button | `"Stop"` | Replaces "Start generation" while the agent is thinking/acting |
| Attached ingredient chip | button | `"Ingredient"` / `"Image ingredient"` with `img "Ingredient image"` | Proves attachment before sending |
| Clear prompt | button | `"Clear prompt"` | Appears when an ingredient/prompt exists |
| Suggestions | buttons | e.g. `"Develop a storyboard"`, `"Edit an image"` | **Change on every load** — never use as anchors (E-FLOW-08) |

### 2.3 Ingredient / start-image selection — VERIFIED (E-FLOW-03, E-FLOW-10)

Clicking "Add ingredients to the prompt box" opens:

- `combobox "Select project"` (current project)
- `tablist "Category navigation"`: `All`, `Images`, `Videos`, `Voices`, `Characters`, `Avatars`, `Uploads`
- `button "Upload media"`
- `textbox "Search assets"`, `combobox "Sort assets"` (default `Recent`)
- `listbox "Asset list"` with `option "<title> Image"`
- `button "Add to prompt"`

Selecting `option "Blatifa Image"` then `"Add to prompt"` attached the image (chip visible in E-FLOW-11).

**Upload of a local file** — PARTIALLY VERIFIED:
- No `input[type=file]` exists in the DOM before clicking. Clicking `"Upload media"` inside `page.expect_file_chooser()` **was intercepted by Playwright**: `multiple=True`, `accept=".png,.jpg,.jpeg,.webp,.gif,.heif,.heic,.mp4,.m4v,.mov,.3gp,.avi"` (E-FLOW-10).
- No file was actually uploaded. Upload completion signals, processing time and the resulting asset's title/ID are UNVERIFIED.

### 2.4 Agent settings — VERIFIED (E-FLOW-04)

`heading "Agent settings"` — "Settings for the agent within this project.":

| Setting | Control | Observed value |
|---|---|---|
| Confirm before generating | radiogroup: `Always` / `Never` | **Always** (checked). "Never: Agent will generate media and spend credits automatically." |
| Image default | ratio radios 16:9, 4:3, 1:1, 3:4, 9:16; count x1–x4; model button | 16:9, x2, Nano Banana 2.1 |
| Video default | ratio radios 16:9, 9:16; count x1–x4; model button `"Video generation default model"` | 16:9, x1, **Veo 3.1 - Lite** |
| Save | button `"Save"` | |
| Close | button `"Back"` (Escape did **not** close the panel) | |

Note: the test prompt asked for "9:16"; the result was 720×1280 although the default is 16:9. The agent honoured the prompt over the default (observed once).

Video model menu options were not opened; the list of video models available on this tier is UNVERIFIED.

### 2.5 Cost confirmation — VERIFIED (E-FLOW-12)

After "Start generation":

1. `status "Thinking"` + `button "Stop"` (~10 s).
2. Agent message: *"I'll generate 1 video animating the cat waving her paw and smiling using your default model, Veo 3.1 - Lite."* and *"Would you like me to kick off this 1 video generation, costing 10 credits?"*
3. `radiogroup "Permission options"`: `radio "Approve"`, `radio "Always approve"`, `radio "Reject"`.
4. After `Approve`: all three radios become `[disabled]`, `Approve` is `[checked]`, and the text `Approve` is echoed.

The cost sentence is free text produced by a language model; its wording may change. Parsing must be tolerant (`costing (\d+) credits?`) and must fail closed (unknown cost ⇒ do not approve).

**Never click "Always approve"** — it would remove the safety gate for the rest of the session/project (exact scope UNVERIFIED).

### 2.6 Rendering status — VERIFIED (E-FLOW-13)

| Time after Approve | Grid tile | Agent panel |
|---|---|---|
| +10 s | new `group` with the full rewritten prompt as name; `group "Media options gallery"` → `button "Open video in editor"` | `Stop` visible |
| +20 s | tile renamed `"Cat waving to camera"`; text `"4% <prompt>"` | |
| +30 s | `13%` | |
| +40 s | `22%` | Agent: *"Your video animation has been scheduled and is currently waiting in the queue due to high demand…"* — **misleading**, rendering was already progressing |
| +50 s | `32%` | |
| +60 s | `img "Generated video thumbnail"` (done) | `Start generation [disabled]` |

Conclusions:
- **The grid tile is the authoritative progress signal** (percentage text, then thumbnail). The agent chat text is not reliable for status.
- Progress jumps from 32 % to done within ≤10 s; percentages are not linear.
- Total wall time from Approve to done: ~60 s for one 8-s Veo 3.1 Lite clip at that moment. Queue times under load are UNVERIFIED.
- Failure states (policy refusal, generation error, timeout) were **not observed** — UNVERIFIED.

### 2.7 Completed video view — VERIFIED (E-FLOW-14, E-FLOW-20)

Opening the tile navigates to `/edit/<media-uuid>` and shows:

| Element | Role / name |
|---|---|
| Title | `heading "Cat waving to camera"` (editable) |
| Actions | `Favorite`, `Share`, **`Download media`**, `Move to trash`, `Hide history`, `More options`, `Done editing scene` |
| Player | `img "Scene video preview"`, `Play`, `Mute`, `Full screen`, `Disable loop`, text `"Total duration: 00:08:00"` |
| Frame | **`button "Save frame"`** — native "save current frame" (not tested) |
| History | generation record: ingredient image + **stored prompt text** + `Reuse prompt` / `Expand prompt` |
| Edit composer | `textbox "Describe how to edit this video…"`, model text `Veo 3.1 - Lite` |

### 2.8 Download — VERIFIED (E-FLOW-14, -15, -16)

`button "Download media"` opens a `menu`:

| menuitem | State |
|---|---|
| `270p Animated GIF` | enabled |
| `720p Original size` | enabled |
| `1080p Upscaled` | **disabled** + link `Upgrade` |
| `4K Upscaled` | **disabled** + link `Upgrade` |

`page.expect_download()` around a click on `720p Original size`:
- download event fired in 0.5 s; URL scheme `blob:` (origin flow.google.com); `suggested_filename = "Cat_waving_to_camera_24b5daf0.mp4"`; `download.failure() = None`; `save_as()` succeeded.
- File: 2,867,757 bytes, SHA-256 `c9290efb3ba65021769765bb47cd3cc2b9ab24e6c5c9e7fd3440d7e8871ecdf8`.
- `ffprobe`: H.264 High, 720×1280, yuv420p, 24 fps, 190 frames, AAC LC 48 kHz stereo, duration 7.93 s.
- Full decode `ffmpeg -i … -f null -` reported no errors.
- Last frame (index 189) extracted to PNG 720×1280 (E-FLOW-16). Visual check: character consistent with source image.

Whether "1080p Upscaled" costs credits on a higher tier is UNVERIFIED.

### 2.9 Credits and account — VERIFIED (E-FLOW-17)

`button "Account details"` (its child button's accessible name is `"Google Account: <name> (<email>)"`) opens `dialog "Account settings"` with:

- `<name> <email>` text (identity),
- `link "Switch account"` → Google AccountChooser,
- **`link "40 Google Flow credits"`** (balance after the 10-credit test),
- text **`"Credits refresh daily at 3:37 PM"`**,
- `link "Upgrade"`, `link "Manage subscription"`, `button "Sign out of all accounts"`,
- `switch "Visible watermarking"`.

Per-action cost is also shown in the image editor: `"Generating will use"` + `link "0 credits"` (Nano Banana image edit, E-FLOW-07).

Details in `ACCOUNT_CREDIT_ARCHITECTURE.md`.

### 2.10 Other areas inspected

| Area | Finding | Status |
|---|---|---|
| Image edit view (`/edit/<uuid>` of an image) | `textbox "What do you want to change?"`, `button "Settings trigger"` → ratio radios + `button "Select model family"` → `menuitem` Nano Banana Pro / 2 Lite / 2.1 (**image models only**), `"Generating will use 0 credits"` | VERIFIED (E-FLOW-07) |
| Add media menu (top bar "+") | `menuitem` `Upload`, `New collection`, `Create character`, `New scene` | VERIFIED (E-FLOW-08) |
| Scenes / scene editor | Timeline editor: `Add clip` opens `dialog "Select media"` with tabs `Videos` / `Uploads` (selects **existing** videos), `Download scene`, `Toggle aspect ratio`. It assembles clips; it does not generate them. | VERIFIED (E-FLOW-09). One empty test scene was created and moved to **Trash** (still there: "1 item in trash"). |
| Tools / Templates | Community post-processing tools (Shader Effects, Transition Machine, Stringout Creator, Video Resizer, Type Overlays…). No frames-to-video tool. "Upgrade to create tools". Tabs `My Tools / Community / Templates` are `button[role=radio]` inside `mat-button-toggle-group`. | VERIFIED (E-FLOW-06) |
| Top bar Settings | View mode Grid/Batch, Grid size, `Sound on hover`, `Return silent videos`, `Show tile details`, `Clear prompt on submit` (on) | VERIFIED |
| Session history | `button "Open session history"` exists; after a reload it was not found within 30 s (layout changed). | PARTIALLY VERIFIED |
| Characters section | Present in nav and in the ingredient picker (`Characters`, `Avatars` tabs). Not opened. | UNVERIFIED |

### 2.11 Tile hover menu and "Animate": VERIFIED (E-FLOW-21 … E-FLOW-25)

The tile container is the custom element `flow-grid-tile-container` with `role="group"`, `aria-label=<title>` and class `mat-context-menu-trigger`. The class suggests that a right-click opens the same menu (UNVERIFIED). Hovering a tile reveals these buttons: `Favorite`, `Reuse prompt`, `More options`, `<title>`.

| `More options` menu on an **image** tile | `More options` menu on a **video** tile |
|---|---|
| Favorite, Reuse prompt, **Animate**, Add to prompt, Download ▸, Copy, Rename, Share, Set project cover, Flag output, Move to trash | Favorite, Reuse prompt, **Add to scene**, Add to prompt, Download ▸, Copy, Rename, Share, **Publish to YouTube**, Set project cover, Flag output, Move to trash |

- `Animate` (image only) attaches the image as an ingredient chip in the session composer. The prompt stays empty, `Clear prompt` appears, and `Start generation` still has to be pressed. Balance read before and after: `40 Google Flow credits` both times.
- A video tile has **no** `Animate`/`Extend` entry. Continuing from a previous clip therefore still needs the final-frame image, which the app extracts with FFmpeg or which Flow could produce with `Save frame` (untested).
- `Download ▸` in the tile menu is a submenu. Downloading straight from the grid without opening `/edit/<uuid>` may be possible, but its items were not opened (UNVERIFIED).
- **`Publish to YouTube` is an outward-facing action. The automation must never click it** (it goes on the Inspector deny-list).
- **Clicking the ingredient chip (`button "Ingredient"`, which has `cdkoverlayorigin`) removed the ingredient** (E-FLOW-25). The adapter must verify the chip by reading it and never by clicking it.

### 2.12 Other behaviours found during the re-inspection

| Behaviour | Consequence | Evidence |
|---|---|---|
| When the grid was scrolled down, the whole top bar (search, `Add media menu`, `Account details`) disappeared from the accessibility tree | Scroll the grid to the top before using top-bar locators | E-FLOW-21 (`21b-state`) |
| The account panel did **not** close with Escape. Its transparent `cdk-overlay-backdrop` blocked pointer events on the grid | Close it with `button "Close account panel"` | E-FLOW-21 |
| The agent session survived a full Chrome restart, including the approval history, and got the auto-generated title "Smiling Cat Paw Wave" | Sessions are persistent. Recovery can read the past cost confirmation | E-FLOW-21 |
| A `Videos` nav button appeared once the project contained a video | The navigation set depends on the project's content | E-FLOW-21 |

## 3. Workflow-by-workflow status

| Workflow (from brief) | Exists as distinct mode? | Equivalent in current Flow | End-to-end status |
|---|---|---|---|
| A. Frames to Video (start frame) | No mode selector | Agent + image ingredient | **VERIFIED once** (existing project image as ingredient) |
| A'. Start + end frame | No | Possibly two ingredients + instructions | UNVERIFIED |
| B. Animate Image | **Entry point exists:** image tile ⋮ → `Animate` | Attaches the image as an ingredient to the agent composer (same as A) | Entry point VERIFIED (no credits). Generation through this path UNVERIFIED |
| C. Text to Video | No (no selector) | Agent prompt without ingredient | UNVERIFIED (not run, to save credits) |
| Upload local start image | — | `Upload media` → file chooser | PARTIALLY VERIFIED (chooser intercepted; no upload) |
| Extend / jump-to / continue clip | — | Not found as a control; edit composer "Describe how to edit this video…" exists | UNVERIFIED |

## 4. Locator stability assessment

| Strategy | Observation | Verdict |
|---|---|---|
| Role + accessible name | Almost all controls have meaningful names (`"Start generation"`, `"Download media"`, `"Add to prompt"`, `menuitem "720p Original size"`) | **Primary strategy** |
| Duplicate names | `"Settings"` ×2, `"More options"` ×many, `"Back"` vs `"Back button to go to previous page"` | Always scope to a container (session panel, dialog, menu) |
| Text without role | Tools tabs, percentage text, cost sentence, `"Total duration: …"` | Use only for reading values, with regex |
| Stable attributes | `data-media-id` (UUID) on image tiles; URL UUIDs | Use for identity |
| Angular attributes | `_ngcontent-ng-c2017669135`, `_nghost-ng-c…` | **Never use** — build-hash dependent |
| CSS classes | Not inspected deliberately (Material class names) | Avoid |
| Agent-generated text | Titles, chat replies, rewritten prompts | Non-deterministic — never as locators |
| Coordinates | — | Not used anywhere in discovery |

## 5. Observed limitations and risks

1. **Prompt rewriting (critical).** Typed: *"Animate this image into one 8-second 9:16 video: the cat gently waves her paw at the camera and smiles. Keep her appearance exactly the same."* Stored by Flow: *"The orange tabby cat wearing a floral dress gently waves her paw at the camera and smiles, maintaining her appearance."* The agent paraphrased and dropped the explicit "exactly the same". The Octopus mouth lock could be shortened or dropped the same way. See mitigations in `SYSTEM_ARCHITECTURE.md` §7.
2. **Non-deterministic agent text** (status messages, titles, cost wording, suggestion chips).
3. **Misleading agent status** ("waiting in the queue" while rendering).
4. **Daily credit budget**: 10 credits per Veo 3.1 Lite clip and a balance of 40 after the test (≈50/day inferred, UNVERIFIED) ⇒ ~5 clips/day; a 36-scene episode needs ~360 credits.
5. **Tier limits**: 1080p/4K and tool creation require upgrade.
6. **Error states not observed**: content-policy rejection, failed render, out-of-credit message, session expiry page.
7. **The agent may choose a model/ratio/count** different from what the automation intends; the plan sentence ("using your default model, Veo 3.1 - Lite", "1 video") must be checked before approval.

## 6. Manual inspection checklist (remaining items)

To be done in Phase 1 with the same dedicated profile; no credit needed unless stated:

1. Open `Settings` → `Video generation default model` menu and record all video models and their names.
2. Open `Characters` nav and the `Characters` / `Avatars` ingredient tabs; record whether a character can be attached as a consistent identity reference.
3. Upload one small PNG via `Upload media`; record upload progress UI, completion signal, resulting tile title and `data-media-id`.
4. Hover a video tile; record whether a `data-media-id` or similar appears on the video tile.
5. With balance known, send a prompt that should be refused (e.g. empty ingredient + nonsense) and click **Reject** at confirmation; record the reject flow (0 credits).
6. (Credits) Text-to-video without ingredient; start+end frame with two ingredients.
7. (Credits) Verify whether "Agent instructions" like *"Use my prompt verbatim, do not rewrite it"* stop prompt rewriting.
8. Let the session expire / sign out in a throwaway profile; record the logged-out state of a `/project/…` URL.
9. Trigger the insufficient-credit path when the balance is below 10; record exact text.
10. Delete the empty test scene from Trash if not wanted.
11. Open the tile `Download ▸` submenu and the right-click context menu on a tile, and record their items (no credits needed).
12. (Credits) Generate once through image tile ⋮ → `Animate` with the same prompt as the picker test. Compare the agent's plan sentence, the cost, and how closely the first frame matches the source image (start frame vs. loose reference).
