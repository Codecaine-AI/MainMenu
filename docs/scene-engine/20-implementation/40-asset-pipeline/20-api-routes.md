---
covers: The Next.js route handlers behind project-local asset uploads, file listings, asset-library reads, and container maintenance.
concepts: [api-route, multipart, registry-write, asset-library, file-listing]
design_refs: [10-system-design/60-asset-uploads.md]
---

# Asset API Routes

Route handlers under `apps/scene-engine/app/api/` make upload, selection, project-file serving, and registry reads work. They resolve the active project through the shared project path adapter and operate against `ProjectSettings/registries/assets.json`, `ProjectSettings/registries/modules.json`, `Assets/Media/{type}/`, `Assets/Modules/`, and `Assets/Fonts/` on local disk. There is no database or storage abstraction.

---

## `POST /api/upload`

`apps/scene-engine/app/api/upload/route.ts` — accepts a multipart form, validates, writes the file to disk, and registers a container.

### Request

| Form field | Type      | Required | Notes                                                      |
|------------|-----------|----------|------------------------------------------------------------|
| `file`     | `File`    | yes      | Browser-uploaded file. The server reads `file.type` and `file.name`. |
| `type`     | string    | yes      | One of `audio`, `image`, `video`, `glyph`, `font`.         |
| `projectId` | string  | no       | Selected project. Falls back to the default project when omitted. |
| `label`    | string    | no       | Human-readable label stored on the registry entry.          |
| `scope`    | string    | no       | `project` restricts the entry to this project; otherwise it is global within the registry. |

### Behavior

1. `validateUpload({ type, mime: file.type, filename: file.name })` — rejects with 400 on type/extension/mime mismatch.
2. `slugifyFilename(file.name)` produces `{ slug, ext }`. An empty slug throws (returned as 500).
3. Resolves the selected project root. Missing project → 404.
4. Reads the selected project's asset registry and chooses a unique id from the slugified filename.
5. Ensures `Assets/Media/{type}/` or `Assets/Fonts/` exists (`mkdir -p`).
6. Writes the file as `{id}.{ext}` into that folder.
7. Writes `ProjectSettings/registries/assets.json` with a logical file path (`/assets/{type}/{id}.{ext}` or `/fonts/{id}.{ext}`), optional `label`, `scope`, `projectIds`, and timestamps.
8. Responds `200 { id, type, file, label, scope }`.

### Notes

- The slug is the identity seed. If it collides with an existing registry id, the route appends `-2`, `-3`, etc. instead of overwriting the old container.
- The handler does not cache-bust scenes — a concurrent renderer would still hold the previous bytes for that URL until next reload.
- The registry is rewritten in-place with no concurrency guard. Acceptable for a single-author dev tool.

## `GET /api/assets/[type]`

`apps/scene-engine/app/api/assets/[type]/route.ts` — lists files inside the selected project's type folder and returns matching asset-library records.

### Behavior

1. `isAssetType(type)` — rejects with 400 if `type` isn't one of the five file asset types.
2. Resolves `?project=<project-id>` through the project path adapter. Missing project → 404.
3. Returns `assets` from `listAssetLibrary({ type, projectId, includeUsage: false })`.
4. If the folder doesn't exist, returns `200 { assets, files: [] }`.
5. Reads the directory, filters out subdirectories and dotfiles, and returns each file as `{ name, file }` using `/assets/{type}/{name}` for media and `/fonts/{name}` for fonts.

### Notes

- The `name` field is the bare filename; `file` is the logical URL form.
- Subdirectories are filtered out. Files like `audio/start-cue/start-cue.js` (audio with a JS wrapper) sit in subfolders and won't appear in this listing — they remain registry-managed only.

## `GET /api/asset-library`

`apps/scene-engine/app/api/asset-library/route.ts` — returns registry containers available to the selected project. This is what the inspector asset dropdown uses.

### Query

| Query       | Required | Notes |
|-------------|----------|-------|
| `project`   | no       | Project availability filter. |
| `type`      | no       | Optional asset type filter. Invalid values return 400. |
| `usage`     | no       | Usage metadata is included unless `usage=0`. |

### Behavior

1. Validates `type` when present.
2. Calls `listAssetLibrary({ type, projectId, includeUsage })`.
3. Returns `200 { assets }`, where each asset includes id, type, file, label, scope/project availability, and optional usage locations/count.

## `GET /api/projects/[projectId]/registries/[registry]`

`apps/scene-engine/app/api/projects/[projectId]/registries/[registry]/route.ts` — returns project-local registries for renderer/editor consumption.

| Registry | Source |
| --- | --- |
| `assets` | `ProjectSettings/registries/assets.json` |
| `modules` | `ProjectSettings/registries/modules.json` |
| `fonts` | discovered from `Assets/Fonts/` |

Missing asset/module registry files return `{}`. Unknown projects return 404.

## `GET /api/projects/[projectId]/assets/[...path]`, `/modules/[...path]`, `/fonts/[...path]`

These routes serve project-local files through the dev server. They are the browser-facing form of logical paths like `/assets/video/test-fire.mp4` and `/modules/components/main-menu-system/main-menu-system.js`.

The shared file serving helper:

- resolves paths through the selected project's `ProjectPaths`
- rejects traversal and malformed child paths
- sets content types for JS, CSS, JSON, SVG, media, and fonts
- rewrites logical `/assets`, `/modules`, and `/fonts` references in text files to project API URLs

This is why project modules can keep authored logical paths while still loading correctly from external workspaces during dev.

## `PATCH /api/registry/[id]`

`apps/scene-engine/app/api/registry/[id]/route.ts` — moves an existing container's file pointer to a different file. This is a maintenance/API surface; the current inspector selection dropdown changes scene `asset` ids instead of patching registry file pointers.

### Request

```json
{ "file": "/assets/video/test-fire-2.mp4" }
```

### Behavior

1. Parses the JSON body. Non-object or missing `file` → 400.
2. Resolves `?project=<project-id>` or body `projectId`, falling back to the default project.
3. Reads that project's asset registry and looks up `id`. Missing → 404.
4. Verifies the new `file` starts with `/assets/{entry.type}/` or `/fonts/` for font entries. The endpoint will not let a `video` container point at a glyph file, etc. → 400 on mismatch.
5. Rewrites `registry[id] = { ...entry, file }` and writes the registry back.
6. Responds `200 { id, type, file }`.

### Notes

- Only `file` is patchable. The container `type` is invariant — changing it would invalidate every scene that references the container.
- The route does not validate that the file actually exists on disk; it trusts the listing endpoint.
- The renderer's in-memory cache must be updated separately if this route is used from an active editor session — the route only rewrites disk.

## What's Not Here

- No DELETE — deleting a container or its file is not a first-class flow yet.
- No bulk endpoint — upload and registry patch are single-item operations.
- No module-registry mutation endpoint — modules are authored in code, not edited through the API.

## Sources

- `apps/scene-engine/app/api/upload/route.ts`
- `apps/scene-engine/app/api/assets/[type]/route.ts`
- `apps/scene-engine/app/api/asset-library/route.ts`
- `apps/scene-engine/app/api/projects/[projectId]/registries/[registry]/route.ts`
- `apps/scene-engine/app/api/projects/[projectId]/assets/[...path]/route.ts`
- `apps/scene-engine/app/api/projects/[projectId]/modules/[...path]/route.ts`
- `apps/scene-engine/app/api/projects/[projectId]/fonts/[...path]/route.ts`
- `apps/scene-engine/app/api/registry/[id]/route.ts`
