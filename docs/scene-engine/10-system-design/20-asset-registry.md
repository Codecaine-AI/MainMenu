---
covers: The asset and module registries — split manifests, container indirection, the four asset types, and the swap-by-id semantic that propagates file changes across scenes.
concepts: [registry, container, asset-id, indirection, type-dispatch, swap]
---

# Asset Registry

Scenes never reference files directly. They reference **container IDs**, and the registry maps each ID to a `{ type, file }` (or `{ type, path }`) pair. This indirection is what lets a single file swap update every scene that uses it, lets the renderer dispatch by type, and lets the editor enumerate available material.

There are two registries, split by what kind of thing they describe:

- **`public/assets/registry.json`** — uploadable file assets. Four types: `audio`, `image`, `video`, `glyph`.
- **`public/modules/registry.json`** — code modules. Two types: `effect`, `component`.

Both share the same shape (id → typed entry) and both contribute to the same flat namespace at runtime: scene layers cannot tell which manifest an ID came from.

---

## Asset vs Module

The split is conceptual, not just organizational. An **asset** is an external file a non-developer would recognize as something they could upload — a video clip, an image, an audio sample, an SVG glyph. A **module** is hand-authored code — a CSS effect sheet, a JS component — that ships with the engine and is configured rather than uploaded.

The test: *would it make sense to drag this onto an upload page?* If yes, it's an asset.

This split shapes everything downstream. The upload UI, the asset browser, and the inspector swap dropdown are all scoped to assets only — modules are invisible to those surfaces.

## The Container Model

A registry entry is a **container**: a typed slot that points at a file. Scene layers reference the container by ID. Swapping the file inside the container propagates to every scene that referenced it — no scene edits needed.

```ascii
┌───────────┐    references    ┌──────────────────────┐    points to    ┌─────────────────┐
│  Scene    │─────────────────▶│  Container (registry) │────────────────▶│  File on disk    │
│  Layer    │ "asset":"bg-vid" │  id: "bg-vid"         │  file:          │  /assets/video/  │
│           │                  │  type: "video"        │  "/assets/      │  test-fire-2.mp4 │
└───────────┘                  └──────────────────────┘  video/test..."  └─────────────────┘
```

The model is intentionally Unity-flavored: scenes describe *intent* (which container, what kind, how positioned); the container holds *identity* (this is the bg-video, of type video); the file is just the current bytes for that identity.

## Entry Shape

Asset entries (in `assets/registry.json`):

```json
{
  "bg-video":       { "type": "video", "file": "/assets/video/test-fire.mp4" },
  "in-text-fire":   { "type": "video", "file": "/assets/video/test-fire-3.mp4" },
  "codecaine-logo": { "type": "glyph", "file": "/assets/glyph/CODECAINE.css-layers.svg" },
  "start-cue":      { "type": "audio", "file": "/assets/audio/start-cue/start-cue.js" }
}
```

Module entries (in `modules/registry.json`):

```json
{
  "crt-overlay": { "type": "effect",    "path": "/modules/effects/crt-overlay.css" },
  "press-start": { "type": "component", "path": "/modules/components/press-start/press-start.js" }
}
```

| Field  | Where         | Meaning                                                                    |
|--------|---------------|----------------------------------------------------------------------------|
| `type` | both          | One of `audio`, `image`, `video`, `glyph` (asset) or `effect`, `component` (module). |
| `file` | asset entries | URL of the current bytes inside the container. Swappable.                  |
| `path` | module entries| URL of the module source. Modules don't swap, so the field name reflects that. |

The two field names (`file` vs `path`) are deliberate: `file` signals "this is a swappable pointer in a container," `path` signals "this is where the module source lives."

## Why ID-Based Indirection

If scenes embedded paths directly:

- Renaming or moving an asset would require rewriting every scene that uses it.
- A file swap would mean editing every consuming scene by hand.
- The registry would not exist, so there would be no inventory of "what's available."
- The editor would have no way to enumerate assets for the asset browser.
- Type information would have to be repeated in every layer entry.

Indirection turns the registry into the single inventory and the single point where file pointers can change.

## Asset Taxonomy: Four Types

| Type     | Files                              | Why it's its own type                                                  |
|----------|------------------------------------|------------------------------------------------------------------------|
| `audio`  | `.mp3`, `.wav`, `.ogg`             | Web Audio playback path, distinct from any visual renderer.            |
| `image`  | `.png`, `.jpg`, `.webp`, `.gif`    | Static raster, separate upload allowlist from video.                   |
| `video`  | `.mp4`, `.webm`                    | Looping playback semantics, larger upload size, separate allowlist.    |
| `glyph`  | `.svg`                             | SVG-with-CSS-layers — not a generic image; has its own renderer path.  |

Image and video are split (rather than collapsed under `media`) so the upload UI can reject mismatched files and so the renderers can diverge later.

## Lookup Semantics

When a scene renders, every layer's `asset` field is looked up in a single merged view of both manifests:

1. Both registries are loaded in parallel and merged into one map.
2. For each layer, lookup returns the merged entry or `null`.
3. If the entry is missing, the layer is skipped with a warning. Render does not throw.
4. The renderer is dispatched by **layer** `type`, but receives the registry entry so it can fetch the entry's `file`/`path`.

If the same ID appears in both manifests, the module entry overrides the asset entry and a warning is logged. This is treated as a misconfiguration rather than a normal flow.

The layer's `type` and the registry entry's `type` are *expected* to match in well-formed scenes. Misaligned types result in a fetch returning unusable content rather than a clean error.

## File Swap Propagation

The container model only earns its keep when something actually swaps a file. Two surfaces do:

- **Inspector dropdown.** Selecting an asset-type layer in the editor surfaces a dropdown of every file under `public/assets/{type}/`. Picking one updates the container's `file` pointer. Every other scene that references that container picks up the new bytes on next render.
- **Upload.** Uploading a file with the same slug as an existing container overwrites the file on disk and rewrites the container's `file` pointer to match.

The scene's JSON is never touched by either surface — the indirection makes both operations purely registry-level.

## Foreign Children Reuse the Same Lookup

When a `glyph-group`'s `children` array contains a foreign asset (`{ type, asset, ... }`), it goes through the same lookup as a top-level layer. There is no separate child registry. This is what makes "the same asset on the stage" and "the same asset interleaved inside a glyph" share machinery.

## Adding an Asset

The expected path is the `/upload` page: pick a file, confirm the type, the server writes the file under `public/assets/{type}/` and adds a registry entry keyed by the slugified filename. See [Asset Uploads](60-asset-uploads.md).

The manual path still works — drop a file under `public/assets/{type}/`, add an entry to `assets/registry.json` — but auto-population from upload is the supported flow.

## What's NOT in the Registry

- **Per-scene placement** — that's a layer's job, not a container's.
- **Per-scene properties** — the registry holds what the container *is*, not how a scene uses it. Blend, opacity, scale, hue all live on the layer.
- **Content data for components** — content lives next to the component (e.g. `press-start-data.json` next to `press-start.js`), not in the registry.
- **Ordering** — layer order is the scene's responsibility; the registry is a map, not a list.
