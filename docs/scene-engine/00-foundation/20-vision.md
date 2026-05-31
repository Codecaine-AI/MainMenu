---
covers: The Unity-style scene model the engine is built around — pages as scenes, scenes as composed asset layers, edited by human UI, desktop shell, and agent.
concepts: [unity-scene, composition, shared-file-authoring, vertical-slice]
---

# Vision

A scene-engine that makes **composition** the primary authoring activity. Define assets once in a project workspace, drop them into a scene, edit their properties visually or programmatically, then build the result as a deployable web page or packaged desktop authoring app. The first concrete deliverable is the Codecaine title screen — a layer-rich scene that exercises every major asset path end-to-end.

---

## Unity Scene as the Mental Model

A **scene** corresponds 1:1 to a page. Each scene is one full stage (1440×1080), and assets are placed *into* the scene as typed layers. This mirrors Unity: a Scene is the actual stage of the game, and everything for that stage is placed into it as assets.

Scenes are not interactive applications. They are landing pages and static websites that *feel* like video-game UI screens — title screens, menus, selection screens. The focus is on visual richness and composition, not application logic.

> *"Similarly to the Unity naming, where a Scene is an actual stage of the game, and then everything for that stage is put in as assets into that scene."*

## Asset And Module Types

The engine treats uploadable files and authored modules as separate registry entries because they are created and maintained differently:

| Type          | What it is                                                          |
|---------------|---------------------------------------------------------------------|
| `audio`       | Web Audio sound (start cue, ambient loops)                          |
| `image`       | Static raster media                                                 |
| `video`       | Full-stage or interleaved video loops                               |
| `glyph`       | Layered SVG glyph from the font pipeline                            |
| `font`        | Project-owned font files                                            |
| `effect`      | Authored CSS effect module (CRT overlay, chromatic aberration)      |
| `component`   | Authored JS component module (menu, press-start, procedural shapes) |

## Tree Hierarchy, Not a Flat Stack

Layers form a **tree**. Most layers are leaves; some are **groups** (e.g. the Codecaine logo, which is itself a stack of ~30 SVG sub-layers).

- Groups are collapsible: one row in the layer panel by default.
- Sub-layers within a group are individually configurable (visibility, blend, hue, opacity).
- **Foreign assets can interleave between a group's sub-layers** — for example, placing a fire-video texture between the chrome extrusion shadow and the chrome face of the logo. This is what lets z-depth be expressive at fine granularity.

Z-order is array position. Last entry renders on top.

## Shared-File Authoring

The same project data is edited by multiple authoring surfaces:

1. **Visual editor** — browser UI with drag-and-drop, layer hierarchy, property inspector, deliberate save command, asset selection, and export action.
2. **Main Menu desktop shell** — Electron app that opens the same editor and owns local native capabilities.
3. **Pi Agent / file API** — desktop chat agent or external AI reads and writes project files directly, or PUTs to the Next API route.

No surface is the source of truth. Project files are. The pattern was proven at the glyph level by the font app's `layer-recipe.json`; the scene-engine generalizes it to whole-page compositions and project workspaces.

## The Vertical Slice: Codecaine Title Screen

One concrete scene end-to-end:

- Codecaine logo, centered, top-third, idle shimmer
- A texture/video placed *inside* the logo's layer stack (interleaved sub-layer)
- Full-stage video background
- "Press Start" interactive prompt with blink animation
- CRT overlay on top of everything
- Audio cue

This scene exercises every mechanic the system claims to support: rich z-ordering, mixed asset types, group children with overrides, interleaved foreign assets, components, audio.

## Output Model

Scenes build to a **multi-page web app** bundled with only the active media/modules/fonts required by the exported scenes. Each scene becomes one page in the built output. Not a single-file export (videos can't be inlined). Not a live-rendered CMS (scenes are authored, then built).

## Audience

Built for **the author** as primary user. Not a general-purpose website builder. Polish and documentation matter, but the system is shaped to one person's authoring workflow rather than a multi-tenant product.
