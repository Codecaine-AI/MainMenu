# Spec — Standardize Asset Upload Types

## Overview

The scene engine currently treats `public/assets/` as a catch-all for everything renderable: `glyphs/`, `media/`, `audio/`, `effects/`, and `components/`. The user feels this conflates two different categories:

- **Assets** — *external file types* that get rendered on screen (audio, images, glyphs, video). These are the things a user would naturally want to upload.
- **Effects / Components** — code-driven things (CSS effect sheets, JS components like `press-start`). These are authored, not uploaded.

The user wants to:
1. Standardize what counts as an "asset" (uploadable external file types only).
2. Move effects/components out of `assets/` into a separate concept.
3. Add an upload UI where the user picks the asset type and the file lands in the correct folder, registered automatically.

## Problem Statement

`public/assets/` mixes uploadable file content (mp4, svg, audio) with hand-authored code modules (CSS effects, JS components). This makes "asset" mean two different things and blocks any sensible upload UX — you can't let a user upload a `.css` effect or a `.js` component the way they'd upload an mp4. The registry, browser panel, and folder layout all carry this ambiguity.

## Goals

### High-Level Goals

- **Make "asset" mean one thing**: an external, classical media file (audio, image, glyph, video) that the renderer displays. Anything that is *code* belongs elsewhere.
- **Enable user uploads**: a user with no filesystem access should be able to add a new asset to a scene by uploading a file and picking its type, with the system handling storage and registry updates.
- **Container-based referencing**: scenes don't point directly at files — they use containers (slots) that hold a reference to a file. Swap the file in the container, every scene using that container updates. Unity-style indirection between scene layers and raw media files.

### Mid-Level Goals

- Define the canonical set of asset types (the user's working list: audio, images, glyphs, video — to be confirmed).
- Reorganize `public/assets/` so it only contains true assets; relocate effects/components to a separate top-level concept.
- Update the registry schema (or split the registry) so it cleanly distinguishes assets from non-asset modules.
- Build an upload page/UI: pick type → select file → server stores it under the right folder → registry entry is created.
- Update the editor's asset browser so it surfaces the new categorization correctly.

### Detailed Goals

- **Canonical asset types**: `audio`, `image`, `video`, `glyph`. Four types, not three — image and video are split (different mime allowlists, semantically different to the user, lets renderers diverge later).
- Glyph stays its own type (it's SVG with CSS-layer behavior — not a generic image).
- Upload lives on a standalone `/upload` page, separate from the editor. Decoupled — usable without opening a scene.
- **Upload flow**: file first, then type. User drops/picks a file, then is asked what asset type it is (pre-fill suggestion from mime if unambiguous). Mime/extension validation rejects mismatches. Overwrite on duplicate filename.
- **Asset IDs are auto-generated** from the filename at upload time (slugified). Registry file stays as source of truth, but upload auto-populates entries — no hand-editing registry.json.
- **Container model**: scene layers reference containers (not raw files). A container holds a type + a pointer to the actual media file. Swapping the file in a container updates all usages. Think Unity materials/textures.
- **File swapping**: inspector shows a dropdown of all files in the matching type folder. Pick one → container's file pointer updates.
- **Split registries**: `public/assets/registry.json` for assets, `public/modules/registry.json` for effects/components.
- **Directory reorg**: move effects → `public/modules/effects/`, components → `public/modules/components/`. Rename `media/` → split into `image/` + `video/`. Simple git moves.
- **Storage**: local disk only (writes to `public/assets/{type}/`). No cloud abstraction.

## Non-Goals

- **Behavior/parameter system**: Effects and components get a Unity-script-like parameter system, but that's a separate spec. Here we only relocate them out of `assets/` into `public/modules/`.
- **Cloud storage**: No S3, no pluggable storage backend. Uploads write to local disk.
- **Editor upload inline**: No mini-upload in the inspector. Upload is a standalone page; the inspector just has a dropdown to swap files.
- **Batch upload**: Single file upload only for v1. Batch/multi-file can be added later.
- **Custom asset IDs**: IDs are auto-generated from filenames. No manual ID entry.

## Success Criteria

- [ ] `public/assets/` contains only `audio/`, `image/`, `video/`, `glyph/` directories and `registry.json`
- [ ] Effects and components live under `public/modules/` with their own `registry.json`
- [ ] Asset registry entries only contain the 4 asset types (audio, image, video, glyph)
- [ ] Standalone `/upload` page: drop a file → pick type (pre-filled from mime) → file stored in correct folder → registry entry auto-created
- [ ] Upload rejects files whose mime/extension doesn't match the selected type
- [ ] Inspector shows a dropdown to swap the file on asset-type layers
- [ ] Existing title scene renders correctly after the reorg (paths updated in registry)
- [ ] Asset browser in the editor only shows asset-type entries (not modules)

## Context & Background

Current layout (from prior exploration):

```
apps/scene-engine/public/assets/
  registry.json
  glyphs/      ← SVG fonts (asset)
  media/       ← videos/images (asset)
  audio/       ← audio (asset)
  effects/     ← CSS sheets (NOT asset per user)
  components/  ← JS modules (NOT asset per user)
```

Registry shape today: `{ id: { type, path } }` where `type ∈ {media, effect, glyph-group, component, audio}`. Loaded at runtime via `src/renderer/asset-registry.js`. Editor drag source: `app/editor/_components/AssetBrowserPanel.tsx`. No upload UI exists today — assets are added by hand-editing files and `registry.json`.

User's mental model (verbatim): *"Assets, to me, are external things that we could bring in. It would be like audio files, images, glyphs, and other things like that. I don't really think effects and components, like press start, should be in assets, because assets is more for classical file types that are then rendered on the screen or something like that."*

### Container Model (Confirmed)

The existing registry already maps IDs → `{ type, path }`. The container model evolves this: **registry entries become containers** — they have a type (audio, image, video, glyph) and a swappable file pointer. Scene layers keep referencing container IDs (`"asset": "bg-video"`). The indirection means you can swap the underlying file (e.g. `test-fire-2.mp4` → `other-fire.mp4`) via the inspector/editor without editing the scene JSON.

```ascii
┌───────────┐      references      ┌──────────────────────┐      points to      ┌──────────────────┐
│  Scene    │─────────────────────▶│  Container (registry) │─────────────────────▶│  File on disk     │
│  Layer    │   "asset": "bg-video"│  id: "bg-video"       │   file: "test.mp4"   │  /assets/video/   │
│           │                      │  type: "video"        │   (swappable)        │  test.mp4         │
└───────────┘                      └──────────────────────┘                      └──────────────────┘
```

**Key property**: swapping the file in a container updates every scene that uses that container — no scene edits needed.

## Key Decisions

### Asset taxonomy: four types — audio, image, video, glyph
**Rationale**: User defines an asset as "external classical file types that get rendered." Splitting `media` into `image` and `video` is worth the small extra surface area because they have different upload validation (mime allowlists), different natural use cases, and different renderer paths in the future. Glyph stays separate from image because SVG-with-CSS-layers isn't a generic image and has its own renderer.
**Made**: 2026-04-29

### Non-asset content stays under `public/`, not `src/`
**Rationale**: User's mental model — *"public is more like where the user would put things, and source is maintained as the actual functionality of the application."* `public/` = authored content (scenes, assets, behaviors); `src/` = the engine itself. Effects and components are content the user authors/configures, not engine code, so they belong on the public/ side of that line even though they're written in code today.
**Made**: 2026-04-29

### Split registries: assets and modules get separate manifests
**Rationale**: Clean separation — each system owns its manifest. The asset registry only contains the 4 uploadable types. The module registry covers effects/components and will evolve when the behavior spec lands. One fetch per system.
**Made**: 2026-04-29

### Upload flow: file first, type second, auto-ID from filename
**Rationale**: Drag/pick a file, system pre-fills type from mime (e.g. .mp4 → video), user confirms or overrides. ID is slugified from filename (e.g. "Test Fire 3.mp4" → "test-fire-3"). No manual ID entry — keeps it fast, consistent. Mime/extension validation rejects mismatches.
**Made**: 2026-04-29

### File swapping via inspector dropdown
**Rationale**: When a container layer is selected in the editor, the inspector shows a dropdown of all files in the matching type folder. Pick one → container's file pointer updates in the registry. Simple, no inline upload needed.
**Made**: 2026-04-29

### Local disk storage only
**Rationale**: This is a dev-time authoring tool. Upload writes directly to `public/assets/{type}/`. No cloud abstraction — keeps it simple, avoids premature generalization.
**Made**: 2026-04-29

### Effects/components are parameterized "behaviors" — deferred to a separate spec
**Rationale**: User surfaced that effects/components are Unity-style scripts with knobs (CRT line thickness, scan speed, etc.). This is a larger design problem than a rename — it needs its own spec for the parameter schema, the inspector UI, and the registration model. For *this* spec, the only action is to relocate effects/components out of `assets/` into a placeholder bucket under `public/` so the "asset" concept is clean.
**Made**: 2026-04-29

## Open Questions

- [x] ~~What is the canonical set of asset types?~~ **Decided**: `audio`, `image`, `video`, `glyph` (split image/video).
- [x] ~~Stay in `public/` or move into `src/`?~~ **Decided**: stay in `public/`. User's framing: public = authored content, src = the engine itself.
- [x] ~~Where does the upload UI live?~~ **Decided**: Standalone page (`/upload` route), not inside the editor.
- [x] ~~Container model?~~ **Decided**: Registry entries *are* containers. Scene layers reference container IDs, containers point to files. Swapping a file updates all usages.
- [x] ~~Asset ID entry?~~ **Decided**: Auto-discovered from the filesystem, no manual ID entry at upload time.
- [x] ~~Placeholder directory for effects/components?~~ **Decided**: `public/modules/`. Neutral name — doesn't commit to "behavior" framing before that spec is done.
- [x] ~~Registry split?~~ **Decided**: Split registries. `public/assets/registry.json` for assets, `public/modules/registry.json` for effects/components. Each system owns its manifest.
- [x] ~~Upload validation?~~ **Decided**: Mime/extension check only. Reject files that don't match the selected type's allowed formats. No size limits. Overwrite on duplicate filename.
- [x] ~~Migration approach?~~ **Decided**: Simple git move commands to restructure. Only one scene, handful of files — no migration script needed.
- [x] ~~Storage backend?~~ **Decided**: Local disk only. Upload writes to `public/assets/{type}/`. Dev-time tool, no abstraction layer.
- [x] ~~Auto-discovery model?~~ **Decided**: Registry file stays as source of truth, but the upload UI auto-populates entries (ID from filename, type from folder). No hand-editing registry.json.
- [x] ~~File swapping in editor?~~ **Decided**: Dropdown in the inspector listing all files of the matching type folder. Pick one to swap the container's file pointer.

## File Structure

### Target layout after reorg

```
apps/scene-engine/
  public/
    assets/                          # ONLY uploadable file assets
      registry.json                  # asset containers: { id: { type, file } }
      audio/                         # .mp3, .wav, .ogg
        start-cue.js                 # (existing audio asset with JS wrapper)
      image/                         # .png, .jpg, .webp, .gif  (NEW - split from media/)
      video/                         # .mp4, .webm              (NEW - split from media/)
        test-fire-2.mp4              # moved from media/
        test-fire-3.mp4              # moved from media/
      glyph/                         # .svg                     (renamed from glyphs/)
        CODECAINE.css-layers.svg     # moved from glyphs/

    modules/                         # NON-ASSET code modules (NEW)
      registry.json                  # module entries (effect, component)
      effects/                       # moved from assets/effects/
        crt-overlay.css
      components/                    # moved from assets/components/
        press-start/
          press-start.js
          press-start-data.json
          press-start.css

  app/
    upload/
      page.tsx                       # NEW - standalone upload page

    api/
      upload/
        route.ts                     # NEW - handles file upload + registry update
      assets/
        [type]/
          route.ts                   # NEW - lists files in a type folder (for inspector dropdown)
```

## Notes

- User explicitly framed this around "classical file types that are then rendered" — the test for what's an asset is "would a non-developer recognize this as a file they could upload?"
