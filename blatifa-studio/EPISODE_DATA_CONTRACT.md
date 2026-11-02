# WP-0.6 — Episode and Scene Data Contract

> **Ringkasan (ID):** Satu episode disimpan sebagai satu file JSON. File itu berisi: info episode, nilai default (rasio 9:16, durasi 8 detik, model), **library "lock"** (deskripsi karakter dan gaya yang tidak boleh diubah, lengkap dengan hash SHA-256), dan daftar adegan. Setiap adegan bisa mengambil frame awal dari: adegan sebelumnya, adegan tertentu, gambar sendiri, aset Flow, atau tanpa frame. Lock Octopus disimpan **persis kata demi kata**. Saat prompt disusun, sistem memeriksa bahwa teks lock masih utuh. Contoh 3 adegan ada di `examples/sample_episode.json` dan sudah lolos validasi struktur.

Status: schema **PROPOSED**; sample **VALIDATED with a stdlib validator** (`evidence/tools/validate_episode.py`, E-DATA-01). Validation with the actual Pydantic models is UNVERIFIED because Pydantic is not installed (installation not approved in Phase 0).

## 1. Design principles

1. **One canonical file per episode** (JSON, UTF-8). The SQLite database stores *production state*, not the creative source of truth.
2. **Locks are data, not prompt fragments.** Character and style locks live in a library with an ID and a SHA-256 hash; scenes reference them by ID.
3. **Defaults + per-scene override** — only fields that differ are written in a scene.
4. **Explicit frame source.** No implicit "previous scene" assumption.
5. **Versioned scenes** — editing a scene's creative fields increments `version`; outputs are stored per version.
6. Extensible through `schema_version` and optional fields; unknown fields are **rejected** (`extra="forbid"`) to catch typos.

## 2. Generation modes vs. current Flow

| `generation_mode` | Meaning | Flow mechanism (discovered) | Status |
|---|---|---|---|
| `TEXT_TO_VIDEO` | prompt only | agent prompt, no ingredient | UNVERIFIED |
| `IMAGE_TO_VIDEO` | start image + prompt (covers "Frames to Video" and "Animate Image") | agent prompt + image ingredient, attached via the picker (VERIFIED once, with generation) or via image tile ⋮ → `Animate` (entry point VERIFIED, without generation) | VERIFIED once |
| `FRAMES_TO_VIDEO` | start + end image | agent prompt + two ingredients | UNVERIFIED |

The mode is the episode author's *intent*. The Flow Adapter translates it; if the adapter cannot guarantee the mode, it reports `UNSUPPORTED_MODE` rather than guessing.

## 3. Pydantic models (design)

```python
from __future__ import annotations
import hashlib
from enum import Enum
from typing import Annotated, Literal, Union
from pydantic import BaseModel, ConfigDict, Field, model_validator, field_validator

SceneId = Annotated[str, Field(pattern=r"^S\d{2,3}$")]
LockId = Annotated[str, Field(pattern=r"^[a-z0-9_]{2,40}$")]

class Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)

class GenerationMode(str, Enum):
    TEXT_TO_VIDEO = "TEXT_TO_VIDEO"
    IMAGE_TO_VIDEO = "IMAGE_TO_VIDEO"
    FRAMES_TO_VIDEO = "FRAMES_TO_VIDEO"

class AspectRatio(str, Enum):
    PORTRAIT = "9:16"
    LANDSCAPE = "16:9"          # only the two video ratios seen in Flow settings

class LockStatus(str, Enum):
    DRAFT = "DRAFT"; APPROVED = "APPROVED"; RETIRED = "RETIRED"

class Lock(Strict):
    id: LockId
    lock_text: str = Field(min_length=10)
    lock_sha256: str = Field(pattern=r"^[0-9a-f]{64}$")
    status: LockStatus

    @model_validator(mode="after")
    def _hash_matches(self):
        if hashlib.sha256(self.lock_text.encode("utf-8")).hexdigest() != self.lock_sha256:
            raise ValueError(f"lock {self.id}: text was modified (hash mismatch)")
        return self

class ReferenceImage(Strict):
    kind: Literal["file", "flow_asset"]
    path: str | None = None
    flow_media_id: str | None = None
    label: str | None = None

class CharacterLock(Lock):
    display_name: str
    reference_images: list[ReferenceImage] = []

class StyleLock(Lock): ...

# --- start frame sources (discriminated union) ---
class NoStartFrame(Strict):
    source: Literal["none"]

class PreviousSceneFrame(Strict):
    source: Literal["previous_scene_final_frame"]

class SpecificSceneFrame(Strict):
    source: Literal["scene_final_frame"]
    scene_id: SceneId

class CustomImage(Strict):
    source: Literal["custom_image"]
    path: str                               # relative to the episode workspace
    sha256: str | None = None               # filled on import; verified before upload

class FlowAsset(Strict):                    # extension: reuse an image already in the Flow project
    source: Literal["flow_asset"]
    flow_media_id: str

StartFrame = Annotated[
    Union[NoStartFrame, PreviousSceneFrame, SpecificSceneFrame, CustomImage, FlowAsset],
    Field(discriminator="source"),
]

class RetryPolicy(Strict):
    max_attempts: int = Field(2, ge=1, le=5)
    max_credits_per_scene: int = Field(20, ge=0)
    retry_on: list[Literal["RENDER_FAILED", "INVALID_ASSET", "QC_FAILED"]] = []
    require_user_approval_for_retry: bool = True

class SceneOutput(Strict):
    filename_stem: Annotated[str, Field(pattern=r"^[A-Za-z0-9_-]{1,64}$")]
    extract_final_frame: bool = True

class Defaults(Strict):
    generation_mode: GenerationMode = GenerationMode.IMAGE_TO_VIDEO
    aspect_ratio: AspectRatio = AspectRatio.PORTRAIT
    expected_duration_s: int = Field(8, ge=1, le=60)
    flow_model: str = "Veo 3.1 - Lite"
    download_quality: Literal["720p", "1080p", "4k"] = "720p"
    style_lock_ids: list[LockId] = []
    negative_instructions: list[str] = []
    retry_policy: RetryPolicy = RetryPolicy()

class Scene(Strict):
    id: SceneId
    order: int = Field(ge=1)
    version: int = Field(1, ge=1)
    title: str
    characters: list[LockId] = []
    action: str = Field(min_length=5)
    camera: str | None = None
    negative_instructions: list[str] = []
    start_frame: StartFrame
    end_frame: StartFrame | None = None       # only for FRAMES_TO_VIDEO
    depends_on: list[SceneId] = []            # explicit ordering deps, in addition to frame deps
    # optional overrides of Defaults
    generation_mode: GenerationMode | None = None
    aspect_ratio: AspectRatio | None = None
    expected_duration_s: int | None = None
    flow_model: str | None = None
    retry_policy: RetryPolicy | None = None
    output: SceneOutput

class EpisodeMeta(Strict):
    id: Annotated[str, Field(pattern=r"^[a-z0-9-]{3,64}$")]
    title: str
    series: str
    language: str = "id"
    version: int = 1
    created_at: str
    notes: str | None = None

class Locks(Strict):
    characters: list[CharacterLock] = []
    styles: list[StyleLock] = []

class Episode(Strict):
    schema_version: Literal["1.0"]
    episode: EpisodeMeta
    defaults: Defaults
    locks: Locks
    scenes: list[Scene] = Field(min_length=1, max_length=200)

    @model_validator(mode="after")
    def _graph(self):
        # unique ids, contiguous order, known lock ids, resolvable frame sources,
        # frame-source scene must extract_final_frame, no cycles (same rules as validate_episode.py)
        ...
        return self
```

## 4. Validation rules (enforced at load time)

| Rule | Error |
|---|---|
| Scene IDs unique; `order` is 1..N without gaps | `ORDER_INVALID` |
| `previous_scene_final_frame` not allowed on order 1 | `NO_PREVIOUS_SCENE` |
| `scene_final_frame.scene_id` exists and is not the scene itself | `UNKNOWN_SCENE_REF` |
| Referenced scene has `extract_final_frame: true` | `FRAME_NOT_PRODUCED` |
| Effective dependency graph (frame deps ∪ `depends_on`) is acyclic | `DEPENDENCY_CYCLE` |
| All `characters` and `style_lock_ids` exist | `UNKNOWN_LOCK` |
| Every lock's SHA-256 matches its text | `LOCK_TAMPERED` |
| `FRAMES_TO_VIDEO` requires `end_frame`; others forbid it | `MODE_FRAME_MISMATCH` |
| `custom_image` path is inside the workspace, extension in png/jpg/jpeg/webp | `UNSAFE_PATH` |
| `DRAFT` locks allowed only when the episode is not in production mode | `LOCK_NOT_APPROVED` |

**Scene dependency model.** The scheduler uses the effective graph. Example from the sample: `S02 → S01` (previous frame), `S03 → S01` (specific frame) and `S03 → S02` (explicit `depends_on`). A scene whose start frame is `none`, `custom_image` or `flow_asset` and has no `depends_on` is independent and may be produced in any order.

## 5. Prompt assembly contract

The Prompt Builder produces an `AssembledPrompt` and **never edits lock text**:

```
[STYLE]       <style lock_text verbatim>
[CHARACTERS]  <character lock_text verbatim, one per line, in scene.characters order>
[SCENE]       <scene.action>
[CAMERA]      <scene.camera>
[AVOID]       <defaults.negative_instructions + scene.negative_instructions>
[FORMAT]      One video, <aspect_ratio>, about <expected_duration_s> seconds.
```

```python
class AssembledPrompt(Strict):
    scene_id: SceneId
    scene_version: int
    text: str
    text_sha256: str
    lock_ids: list[LockId]
    lock_hashes: dict[LockId, str]
```

Invariants (unit-tested in Phase 3):
1. For each referenced lock, `lock_text` occurs **verbatim** in `text` (substring check).
2. Normalisation (whitespace trimming) is applied only to non-lock parts.
3. Lock text is never truncated to fit a length limit; if Flow imposes a limit, assembly fails with `PROMPT_TOO_LONG`.

**Discovery caveat:** the Flow agent rewrote the submitted prompt (E-FLOW-20). Verbatim *assembly* does not guarantee verbatim *generation*. The adapter therefore records the prompt **as stored by Flow** (generation history text) and Quality Control compares it with the lock key phrases (e.g. "protruding circular pout"). A missing key phrase raises `LOCK_DRIFT_SUSPECTED` for user review. See `SYSTEM_ARCHITECTURE.md` §7.

## 6. Output metadata (produced, not authored)

Stored in SQLite and mirrored to `<workspace>/episodes/<id>/manifest.json`:

```json
{"scene_id": "S01", "scene_version": 1, "attempt": 1,
 "flow_project_id": "…", "flow_media_id": "…", "flow_title": "…", "flow_stored_prompt": "…",
 "quoted_cost": 10, "account_id": "acct_a",
 "video_path": "episodes/blatifa-ep001/S01/v1/a1/S01_v1.mp4", "video_sha256": "…",
 "probe": {"codec": "h264", "width": 720, "height": 1280, "fps": 24, "duration_s": 7.93, "audio": "aac"},
 "final_frame_path": "…/S01_v1_last.png", "final_frame_sha256": "…",
 "qc": {"status": "PASS", "issues": []}}
```

## 7. Sample

`examples/sample_episode.json` — 3 scenes demonstrating custom image, previous-scene frame and specific-scene frame sources, an explicit dependency, a per-scene retry override, and the Octopus lock verbatim (`lock_sha256 = 2af1471e…6f12`). The Blatifa character lock and the style lock are `DRAFT` (derived from the existing Flow image prompt); the user must approve or rewrite them.
