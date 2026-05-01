---
covers: The Unity-style scene model the engine is built around — pages as scenes, scenes as composed asset layers, edited by both human and agent.
concepts: [unity-scene, composition, dual-surface, vertical-slice]
---

# Vision

A scene-engine that makes **composition** the primary authoring activity. Define assets once, drop them into a scene, edit their properties either visually or programmatically, build the result as a deployable web page. The first concrete deliverable is the CodeCaine title screen — a layer-rich scene that exercises every asset type end-to-end.

---

## Unity Scene as the Mental Model

A **scene** corresponds 1:1 to a page. Each scene is one full stage (1440×1080), and assets are placed *into* the scene as typed layers. This mirrors Unity: a Scene is the actual stage of the game, and everything for that stage is placed into it as assets.

Scenes are not interactive applications. They are landing pages and static websites that *feel* like video-game UI screens — title screens, menus, selection screens. The focus is on visual richness and composition, not application logic.

> *"Similarly to the Unity naming, where a Scene is an actual stage of the game, and then everything for that stage is put in as assets into that scene."*

## Five Asset Types, Day One

The vision requires all five asset types from the start because the title scene needs them all:

| Type          | What it is                                                          |
|---------------|---------------------------------------------------------------------|
| `media`       | Video, image, texture                                               |
| `effect`      | CSS effect (CRT overlay, vortex, chromatic aberration)              |
| `glyph-group` | Layered SVG glyph from the font pipeline, with expandable sub-layers |
| `component`   | Data-driven JS component (menu, press-start) that owns its content  |
| `audio`       | Web Audio sound (start cue, ambient loops)                          |

## Tree Hierarchy, Not a Flat Stack

Layers form a **tree**. Most layers are leaves; some are **groups** (e.g. the CodeCaine logo, which is itself a stack of ~30 SVG sub-layers).

- Groups are collapsible: one row in the layer panel by default.
- Sub-layers within a group are individually configurable (visibility, blend, hue, opacity).
- **Foreign assets can interleave between a group's sub-layers** — for example, placing a fire-video texture between the chrome extrusion shadow and the chrome face of the logo. This is what lets z-depth be expressive at fine granularity.

Z-order is array position. Last entry renders on top.

## Dual-Surface Authoring

The same scene data is edited by **two authoring surfaces**:

1. **Visual editor (human)** — Canvas-based UI with drag-and-drop, layer hierarchy, property inspector, save button.
2. **Agent / file API (AI)** — Claude Code reads and writes `scene.json` directly, or PUTs to the dev-server API. Heavy lifting tasks (figuring out layer ordering, normal maps, chrome tuning) belong here.

Neither surface is privileged. The pattern was proven at the glyph level by the font app's `layer-recipe.json`; the scene-engine generalizes it to whole-page compositions.

## The Vertical Slice: CodeCaine Title Screen

One concrete scene end-to-end:

- CodeCaine logo, centered, top-third, idle shimmer
- A texture/video placed *inside* the logo's layer stack (interleaved sub-layer)
- Full-stage video background
- "Press Start" interactive prompt with blink animation
- CRT overlay on top of everything
- Audio cue

This scene exercises every mechanic the system claims to support: rich z-ordering, mixed asset types, group children with overrides, interleaved foreign assets, components, audio.

## Output Model

Scenes build to a **multi-page web app** bundled with its media. Each scene becomes one page in the built output. Not a single-file export (videos can't be inlined). Not a live-rendered CMS (scenes are authored, then built).

## Audience

Built for **the author** as primary user. Not a general-purpose website builder. Polish and documentation matter, but the system is shaped to one person's authoring workflow rather than a multi-tenant product.
