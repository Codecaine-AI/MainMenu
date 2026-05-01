---
covers: How new asset files enter the system and how existing container files are swapped — the upload page, the inspector swap dropdown, and the validation rules that gate both.
concepts: [upload, container, swap, slug, mime-validation]
design_refs: []
---

# Asset Uploads & File Swaps

There are two ways a file enters or moves through the system:

- **Upload** — a new file lands on disk and a new container is registered for it.
- **Swap** — an existing container's file pointer is moved to a different file under the same type folder.

Both flows are scoped to the four asset types (`audio`, `image`, `video`, `glyph`). Modules don't participate — they're hand-authored, not uploaded.

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
5. **Server writes the file.** Filename = slug of the original filename + original extension. Path = `public/assets/{type}/{slug}.{ext}`. Existing files at the same path are overwritten.
6. **Server registers the container.** A new entry `{ type, file: "/assets/{type}/{slug}.{ext}" }` is written into `public/assets/registry.json` keyed by the slug. If the slug already exists, the entry is overwritten with the new file pointer.

The slug is the source of identity. Two uploads of `Test Fire 3.mp4` and `test fire 3.mp4` collapse onto the same container `test-fire-3`.

### Validation rules

| Rule                              | Why                                                                          |
|-----------------------------------|------------------------------------------------------------------------------|
| Type must be one of the four      | Anything else isn't an asset by definition.                                  |
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

## Swap Flow

When an asset-type layer is selected in the editor, the inspector shows a dropdown of every file under `public/assets/{type}/` for that container's type. Picking a different file:

1. Sends a PATCH to the registry endpoint with the new file path.
2. Server verifies the file path is rooted at `/assets/{type}/` for the container's type — the swap can't move a video container to point at a glyph file.
3. Server rewrites the registry entry's `file` field. The slug (the container ID) does not change.
4. Client mirrors the change into the in-memory registry so the renderer picks up the new bytes immediately.

The scene JSON is never touched. Every other scene that references the container picks up the new file on next render.

### Why a dropdown rather than inline upload

Upload and swap are separate concerns. The inspector is for arranging containers in a scene; introducing an upload form there would couple authoring with file management. The dropdown is the smallest UI that supports the container indirection — point the container at a different file without leaving the scene.

If the desired file isn't yet in the type folder, the path is: go to `/upload`, upload it, come back, pick it from the dropdown.

## What This Buys

- **Authoring without filesystem access.** A user who can't `cp` a file into a folder can still add a video.
- **Cross-scene file changes in one click.** Swap `bg-video`'s file once; every scene using `bg-video` updates.
- **Registry stays canonical.** No hand-editing `registry.json` for normal flows — uploads write entries, swaps update entries.
- **Type discipline.** Validation rejects mismatches at the boundary; the renderer doesn't have to handle a `video` container pointing at a PNG.

## What's Out of Scope

- **Cloud storage.** Uploads write to local disk only.
- **Batch upload.** One file per submission.
- **Custom container IDs at upload time.** IDs are derived from the filename slug; renaming a container is a separate (manual) registry edit.
- **Module uploads.** Effects and components are authored in code, not uploaded.
- **Delete/rename UI.** Removing a file or renaming a container is not yet a first-class operation.
