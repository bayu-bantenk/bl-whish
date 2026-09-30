# Legacy API Contract Evidence — Content detail / create / update

| Field | Value |
|---|---|
| Evidence status (overall) | **Request side: VERIFIED_RUNTIME (legacy app outbound). Response handling: LEGACY_CODE. Real backend: UNKNOWN (A5.5R BLOCKED)** |
| Captured | 2026-09-30 (A6), legacy commit `00bc6ea`, Node 24.16.0, local capture gateway (`/tmp/a6r`, outside the repo) |
| Fixture | `frontend/test/fixtures/api/legacy-content-write/request-captured.json` (sanitized) |
| Target | `frontend/src/packages/content/repository/{dto,content.repository}.ts` |

## How it was obtained

- The unmodified legacy app ran with `APIGATEWAY_URL` pointed at a local capture server.
- Login and the create / edit / update forms were driven with `curl`, including `_csrf` and `_method=PUT`.
- The server recorded the outbound gateway requests, with `Authorization` redacted.
- **No real backend was contacted.**
- Cleanup:
  - session files created by the run were deleted (98 pre-existing files remain, re-checked after A6);
  - legacy `git status` is unchanged;
  - the processes were stopped.

## Legacy routes

| Legacy (browser → Adonis) | Controller | Gateway | New route |
|---|---|---|---|
| `GET /content/create` | `create` (view only) | — | `/dashboard/content/create` |
| `POST /content` | `store` | `POST /api/v1/cms/contents` | Server Action `createContentAction` |
| `GET /content/:id/edit` | `edit` | `GET /api/v1/cms/contents/:id` | `/dashboard/content/update/[id]` |
| `POST /content/:id?_method=PUT` | `update` | `PUT /api/v1/cms/contents/:id` | Server Action `updateContentAction` |
| `POST /content/delete`, `/content/multidelete` | `delete`, `multidelete` | `DELETE /api/v1/cms/contents/:id`, `DELETE …/bulk {ids}` (LEGACY_CODE, not captured) | **deferred** |

## Requests (VERIFIED_RUNTIME, legacy side)

| Case | Method / path | Body |
|---|---|---|
| store | `POST /api/v1/cms/contents` | `{"code":"TC","name":"Syarat","is_active":false,"value":"<p>x</p>"}` |
| store with an empty value | same | `{"code":"TC","name":"Syarat","is_active":true,"value":null}` — Adonis turns `""` into `null` |
| store without a value field | same | `value` key absent |
| edit load | `GET /api/v1/cms/contents/12` | none |
| update | `PUT /api/v1/cms/contents/12` | `{"code":"PRIVACY","name":"Kebijakan","is_active":false,"value":"<p>baru</p>"}` |

- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <REDACTED>`; no API key.
- **Types:** `is_active` is a JSON **boolean** (the repository converts the form string `'true'`).

## Response handling (LEGACY_CODE; confirmed against the capture server's replies)

| Operation | Legacy success condition | Legacy failure behaviour |
|---|---|---|
| store | envelope `code == 201` (a `code 200` reply was treated as **failure**, VERIFIED_RUNTIME) | redirect back, flash `warning` "Konten tidak berhasil ditambahkan", input lost |
| update | envelope `code == 200` | flash key `Warning` (never rendered: silent failure) |
| edit | envelope `code == 200` → `data`; reads `data.code`, `data.name`, `data.value` | "Konten tidak ditemukan" → list |
| edit status | **`data.is_active` is not read**: the `<select>` is never pre-selected (VERIFIED_RUNTIME), so saving an inactive item makes it active | legacy defect |
| validation | `code`, `name` required (`ContentCreateEdit.js`); **no message shown** for them (A3.2); no gateway call on failure (VERIFIED_RUNTIME) | legacy defect |

## Unknowns (real backend)

1. Whether create really answers `code 201` (and whether HTTP 201 or 200).
2. Whether the detail response contains `is_active` (the target requires it and shows a Contract error otherwise).
3. Error bodies for duplicate code, validation (400 vs 422, field-error shape) and conflicts.
4. Whether `value` accepts `null` vs `""`.
5. Maximum lengths.
6. Delete / bulk-delete semantics and responses.
7. Whether `PUT` is idempotent / safe to replay (OD-04; the target never replays it).
