---
covers: The three Next.js route handlers behind asset uploads and container swaps — request shapes, validation, and how each one mutates `assets/registry.json`.
concepts: [api-route, multipart, registry-write, swap, file-listing]
design_refs: [10-system-design/60-asset-uploads.md]
---

# Asset API Routes

Three route handlers under `apps/scene-engine/app/api/` make the upload and swap flows work. All three operate against `public/assets/registry.json` and `public/assets/{type}/` on local disk — there's no database or storage abstraction.

---

## `POST /api/upload`

`apps/scene-engine/app/api/upload/route.ts` — accepts a multipart form, validates, writes the file to disk, and registers a container.

### Request

| Form field | Type      | Required | Notes                                                      |
|------------|-----------|----------|------------------------------------------------------------|
| `file`     | `File`    | yes      | Browser-uploaded file. The server reads `file.type` and `file.name`. |
| `type`     | string    | yes      | One of `audio`, `image`, `video`, `glyph`.                 |

### Behavior

1. `validateUpload({ type, mime: file.type, filename: file.name })` — rejects with 400 on type/extension/mime mismatch.
2. `slugifyFilename(file.name)` produces `{ slug, ext }`. An empty slug throws (returned as 500).
3. Ensures `public/assets/{type}/` exists (`mkdir -p`).
4. Writes the file as `{slug}.{ext}` into that folder. Overwrites on duplicate.
5. Reads `public/assets/registry.json`, sets `registry[slug] = { type, file: "/assets/{type}/{slug}.{ext}" }`, writes it back pretty-printed with a trailing newline.
6. Responds `200 { id: slug, type, file }`.

### Notes

- The slug is the only identity. Two uploads of `Test Fire 3.mp4` and `test_fire_3.mp4` collapse onto the same container `test-fire-3`, overwriting both the file and the registry entry.
- The handler does not cache-bust scenes — a concurrent renderer would still hold the previous bytes for that URL until next reload.
- The registry is rewritten in-place with no concurrency guard. Acceptable for a single-author dev tool.

## `GET /api/assets/[type]`

`apps/scene-engine/app/api/assets/[type]/route.ts` — lists every file inside `public/assets/{type}/`. Powers the inspector's swap dropdown.

### Behavior

1. `isAssetType(type)` — rejects with 400 if `type` isn't one of the four.
2. If the folder doesn't exist, returns `200 { files: [] }`.
3. Reads the directory, filters out subdirectories and dotfiles, and returns each file as `{ name, file: "/assets/{type}/{name}" }`.

### Notes

- The `name` field is the bare filename (used as the dropdown label); `file` is the URL form (used as the dropdown value and shipped to PATCH).
- Subdirectories are filtered out. Files like `audio/start-cue/start-cue.js` (audio with a JS wrapper) sit in subfolders and won't appear in this listing — they remain registry-managed only.

## `PATCH /api/registry/[id]`

`apps/scene-engine/app/api/registry/[id]/route.ts` — moves an existing container's file pointer to a different file. The server-side half of the inspector swap dropdown.

### Request

```json
{ "file": "/assets/video/test-fire-2.mp4" }
```

### Behavior

1. Parses the JSON body. Non-object or missing `file` → 400.
2. Reads `public/assets/registry.json` and looks up `id`. Missing → 404.
3. Verifies the new `file` starts with `/assets/{entry.type}/`. The endpoint will not let a `video` container point at a file under `/assets/glyph/`, etc. → 400 on mismatch.
4. Rewrites `registry[id] = { ...entry, file }` and writes the registry back.
5. Responds `200 { id, type, file }`.

### Notes

- Only `file` is patchable. The container `type` is invariant — changing it would invalidate every scene that references the container.
- The route does not validate that the file actually exists on disk; it trusts the listing endpoint.
- The renderer's in-memory cache must be updated separately (`updateEntry` in `asset-registry.js`) — the route only rewrites disk.

## What's Not Here

- No DELETE — deleting a container or its file is not a first-class flow yet.
- No bulk endpoint — both upload and swap are single-item operations.
- No module-registry endpoint — modules are authored in code, not edited through the API.

## Sources

- `apps/scene-engine/app/api/upload/route.ts`
- `apps/scene-engine/app/api/assets/[type]/route.ts`
- `apps/scene-engine/app/api/registry/[id]/route.ts`
