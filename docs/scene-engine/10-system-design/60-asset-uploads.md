---
covers: How new asset files enter a project and how scenes select existing containers — the upload page, the inspector asset dropdown, and the validation rules that gate both.
concepts: [upload, container, selection, slug, mime-validation]
design_refs: []
---

# Asset Uploads & Asset Selection

There are two ways a file enters or moves through the system:

- **Upload** — a new file lands on disk and a new container is registered for it.
- **Selection** — a scene layer or glyph slot is pointed at a different existing container of the same asset type.

Both flows are scoped to the five file asset types (`audio`, `image`, `video`, `glyph`, `font`). Modules don't participate — they're hand-authored, not uploaded.

---

## Upload Flow

Upload is a standalone surface (`/upload`), separate from the editor. A user with no filesystem access can add an asset without opening a scene.

```
file picked → type pre-filled from mime → user confirms → POST → server validates → write file → register container
```

Step by step:

1. **Pick a file.** Any file the OS will give the browser.
2. **Pre-fill the type.** The page inspects the file's mime and suggests a type if it matches one allowlist (e.g. `video/mp4` → `video`). The user can override.
3. **Confirm and submit.** Multipart POST to the upload endpoint with the file and the chosen type.
4. **Server validates.** Both the extension and the mime must be in the allowlist for the chosen type. Mismatches reject the upload.
5. **Server writes the file.** Filename = a unique slug of the original filename + original extension. Media lands under the selected project root at `Assets/Media/{type}/{slug}.{ext}`; fonts land under `Assets/Fonts/{slug}.{ext}`.
6. **Server registers the container.** A new entry is written into `ProjectSettings/registries/assets.json` keyed by the slug. Media entries keep logical `file` paths like `/assets/{type}/{slug}.{ext}`; font entries use `/fonts/{slug}.{ext}` and include default font metadata.

The slug is the source of identity. If an upload would collide with an existing container, the server appends a numeric suffix so both containers can coexist.

### Validation rules

| Rule                              | Why                                                                          |
|-----------------------------------|------------------------------------------------------------------------------|
| Type must be one of the five      | Anything else isn't an uploadable file asset.                                |
| Extension must match type's list  | Catches drag-into-wrong-bucket mistakes.                                     |
| Mime must match type's list       | Catches renamed-extension mistakes.                                          |
| Filename slug must be non-empty   | A file named `.png` or `___` has no usable identity.                         |

There is no size limit and no batch upload in this surface — single file at a time.

### Asset type allowlists

| Type    | Extensions                  | Mimes                                                                 |
|---------|-----------------------------|-----------------------------------------------------------------------|
| `audio` | `mp3`, `wav`, `ogg`         | `audio/mpeg`, `audio/wav`, `audio/ogg`                                |
| `image` | `png`, `jpg/jpeg`, `webp`, `gif` | `image/png`, `image/jpeg`, `image/webp`, `image/gif`              |
| `video` | `mp4`, `webm`               | `video/mp4`, `video/webm`                                             |
| `glyph` | `svg`                       | `image/svg+xml`                                                       |
| `font`  | `otf`, `ttf`, `woff`, `woff2` | browser font mimes plus common local/octet-stream fallbacks         |

## Selection Flow

When an asset-type layer is selected in the editor, the inspector shows project-available containers of that same type from `/api/asset-library?project=<project-id>&type=<type>`. Picking a different entry:

1. Mutates the selected scene object or slot from `asset: oldId` to `asset: newId`.
2. Marks the editor dirty; Save writes the scene through `PUT /api/scenes/<id>?project=<project-id>`.
3. Leaves registry entries untouched. Containers remain stable inventory records; scenes decide which container they use.

This is selection by ID, not a registry file-pointer mutation. Other scenes that reference the old container are unaffected.

### Why a dropdown rather than inline upload

Upload and selection are separate concerns. The inspector is for arranging containers in a scene; introducing an upload form there would couple authoring with file management. The dropdown is the smallest UI that supports the container indirection — point the layer at a different registered container without leaving the scene.

If the desired file isn't yet in the project, the path is: go to `/upload?project=<project-id>`, upload it, come back, pick the new container from the dropdown.

## What This Buys

- **Authoring without filesystem access.** A user who can't `cp` a file into a folder can still add a video.
- **Project-local inventory.** Uploads add containers under the selected project root; scenes select those containers by ID.
- **Registry stays canonical.** No hand-editing `registry.json` for normal flows — uploads write entries, and scene selection edits scene JSON.
- **Type discipline.** Validation rejects mismatches at the boundary; the renderer doesn't have to handle a `video` container pointing at a PNG.

## What's Out of Scope

- **Cloud storage.** Uploads write to local disk only.
- **Batch upload.** One file per submission.
- **Custom container IDs at upload time.** IDs are derived from the filename slug; renaming a container is a separate manual registry edit.
- **Module uploads.** Effects and components are authored in code, not uploaded.
- **Delete/rename UI.** Removing a file or renaming a container is not yet a first-class operation.
