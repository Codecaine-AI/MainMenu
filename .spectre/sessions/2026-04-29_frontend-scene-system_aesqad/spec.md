# Spec: Frontend Scene System

## Overview

The current frontend (`apps/frontend/`) is a Vite multi-page app where each page (title, menu, projects, etc.) is hand-wired: `initLayout()` injects a fixed scaffold, and visuals are baked into per-page CSS/JS. As production assets accumulate (the MELEE-3 chrome glyphs, video loops like `test-fire-2.mp4`, vortex/CRT effect layers, the upcoming CODECAINE-in-a-background composition), this approach is hitting friction. Adding a new visual variant means writing new bespoke page code rather than composing existing pieces.

The user wants to migrate toward a **scene-based composition model** — closer in spirit to a game engine or interactive website builder — where:

- A **scene** corresponds roughly to a page (title screen, main menu, projects screen, etc.).
- Each scene is **composed of typed layers / assets** (a font glyph, a background, a media element, a CSS effect).
- Assets are **first-class, reusable building blocks**: declare a font once, use it across many scenes; declare a background once, place different content into it.
- Different layers can use different rendering strategies (SVG, CSS effects, video, future canvas/WebGL) without each scene having to re-implement the wiring.

This spec captures WHAT the scene system needs to be, not HOW it's implemented.

## Problem Statement

Building visually rich landing pages currently requires hand-wiring every visual element directly in page-specific CSS/JS. Each new page or visual variation means writing bespoke code rather than composing existing pieces. As the asset library grows (chrome glyphs, video loops, CSS effects), the friction of assembling them into new compositions is the bottleneck — not creating the assets themselves.

The scene system makes **composition** the primary authoring activity: define assets once, place them into scenes, and produce landing pages / static sites without re-implementing the rendering wiring each time.

## Goals

### High-Level Goals

- **Scene-based composition for video-game-screen landing pages** — a specialized tool for building visually rich web pages that feel like video game UI screens (title screens, menus, selection screens). Unity Scene model: each scene is one full stage, assets are placed into it.
- **Primary user: the author** — built for personal use, but with UI polish and documentation. Not a general-purpose website builder.

### Mid-Level Goals

- **Visual scene editor** — Canvas-based UI where assets can be dragged, positioned, and their properties edited in-place. Comparable to a Unity scene view / Figma canvas.
- **Agent-editable from the backend** — The same scene data that the visual editor manipulates must also be readable/writable by an AI agent programmatically. The agent is a first-class authoring peer, not an afterthought. (This mirrors how the font app's `layer-recipe.json` is edited both by the UI panels and by the regenerate API.)
- **Asset registry** — A place where produced assets (chrome glyphs, video loops, CSS effects, extracted/reconstructed Melee assets) are registered and become available as drag-and-drop building blocks in the editor.

### Detailed Goals

#### CodeCaine Title Scene (Vertical Slice)

The first concrete scene to build, establishing what the system must support:

- **CodeCaine logo** — Centered, top-third. Idle shimmer animation. The layered chrome SVG glyph as a scene asset.
- **In-text element** — Something placed *behind the text* but in front of other layers — implying z-depth interleaving within the logo itself, not just flat back-to-front stacking.
- **Scene background** — A full-scene background layer (could be video, animated effect, static image — to be determined). Separate from the in-text element.
- **"Press Start" button** — Interactive prompt element, likely with its existing blink animation.
- **CRT overlay** — Scanline + vignette effect layer on top of everything.
- **Additional animations** — Room for other animated elements, effects, decorative pieces. The scene is layer-rich — *"there's going to be a lot of different things in that scene."*

This scene establishes that the system needs: rich z-ordering, mixed asset types (SVG, video, CSS effects, interactive elements), per-asset animation/properties, and the ability to interleave layers at fine granularity.

#### Layer Model: Collapsible Groups (Tree Hierarchy)

The scene's layer structure is a **tree**, not a flat stack:

- A scene contains **nodes** — some are leaf assets (a video, a CSS effect), some are **groups** (the CodeCaine logo).
- Groups are **collapsible**: by default they appear as one item in the layer panel. Expand a group to see and configure its sub-layers.
- Sub-layers within a group have their own **configurable properties** (textures, blend modes, visibility, etc.) — the user can adjust the texture on a specific chrome layer within the logo, for example.
- Sub-layers can **reference other assets** — e.g., one of the logo's layers contains a video reference. This means assets can appear at any depth in the tree, not just at the scene's top level.
- Other scene assets can be **interleaved between a group's sub-layers** — e.g., placing a background element between the logo's extrusion shadow and its chrome face.

This is analogous to Photoshop layer groups or Unity's Hierarchy panel. The scene editor presents a single tree view where z-order is determined by position in the tree, and groups can be expanded/collapsed for manageable navigation.

User on the model: *"For the CodeCaine, it then has all the layers. You can adjust the texture and stuff on each given layer, but then also there is the video reference in the one layer there."*

### Output / Deployment Model

The scene system produces a **multi-page web app** bundled with its media assets (videos, images, SVGs). Each scene corresponds to a page in the built output. The app gets published as a deployable website.

- Not a single-file standalone export (media like videos can't be inlined).
- Not a live-rendered CMS — scenes are authored in the editor, then built/bundled.
- Exact build tooling and deployment pipeline are future concerns — the priority is the authoring and composition model.

## Non-Goals

- Interactive web applications (this is for landing pages / static sites)
- Single-file standalone HTML exports (media assets require bundling)
- Defining the exact build/deploy pipeline on day one
- Keeping the existing `apps/frontend/` as a separate system — the scene system **replaces** it
- Scene-to-scene transitions or navigation in the editor — navigation is a rendered-website concern, not an editor concern

## Success Criteria

Vertical slice: CodeCaine title scene built end-to-end in the scene editor.

- [ ] Can open the scene editor, see an empty stage (1440×1080)
- [ ] Can browse the asset registry and see available glyphs, media, effects
- [ ] Can drag/place the CodeCaine glyph-group onto the stage
- [ ] Can expand the glyph-group to see and toggle its sub-layers
- [ ] Can add a video background layer and see it render behind the logo
- [ ] Can add the CRT effect overlay and see it render on top
- [ ] Can reorder layers (drag in the hierarchy panel)
- [ ] Can adjust properties on selected layers (blend mode, opacity, position, scale)
- [ ] Can save the scene as `scene.json` and reload it
- [ ] The agent (Claude Code) can edit `scene.json` and the editor reflects the changes on reload
- [ ] Can build/export the scene as a deployable web page

## Context & Background

### Existing Building Blocks

The project already has scattered pieces of what a scene system would formalize:

- **`apps/frontend/`** — Vite multi-page app, vanilla JS/CSS, fixed 1440×1080 stage, shared `initLayout()` scaffold with vortex + CRT overlay. Pages: `/`, `/menu/`, `/projects/`, `/testimonials/`, `/links/`, `/about/`, `/guestbook/`. Data-driven from `src/data/*.json` for menus/projects/testimonials/links.
- **`apps/font-creation/generation/melee-3/`** — Produces layered SVG glyphs (e.g. `CODECAINE.css-layers.svg`) via a Python recipe pipeline (`recipes/layer-recipe.json` + `scripts/render_recipe.py`). Each glyph is itself a stack of ~30 named layers (chrome, lighting, fills, etc.).
- **`apps/font-creation/app/melee-3/`** — Vite editor app for tuning the glyph layer recipe. Already implements a layer-based mental model (`src/layer-data.js`, `panels/layers.js`) and a recipe → render → display loop via custom Vite middleware (`/api/melee-3/regenerate`, `/api/melee-3/bake`).
- **Media inputs** — `inputs/extras/test-fire-2.mp4`, `test-fire-3.mp4` available as candidate background/effect media.
- **`apps/asset-extraction-pipeline/`** + **`apps/pi-asset-loop/`** — Produce extracted PNG assets and CSS/HTML reconstructions from Melee screenshots, feeding raw asset material into the system.

### User's Mental Model

**Unity Scene model**: a Scene is an actual stage — the full screen the user is looking at. Everything for that stage is placed into it as assets. Like Unity, the Scene is the container, assets are the things inside it.

- **Title Screen scene**: Contains the CodeCaine logo asset, a background asset, potentially future assets (positional elements, decorative pieces).
- **Main Menu scene**: Contains the menu items and associated interactive elements.

This is **for landing pages and static websites**, not interactive applications. Each scene produces a standalone web page that is visually rich but not an "app." The focus is composition — assembling existing visual building blocks into a stage — rather than application logic.

User's own framing: *"Similarly to the Unity naming, where a Scene is an actual stage of the game, and then everything for that stage is put in as assets into that scene."*

### Font-Creation Pipeline: Stays Separate, App Absorbed

- **Pipeline stays** (`apps/font-creation/pipeline/`) — Python scripts that segment, upscale, trace, and build layered SVGs from glyph sheets. This is an asset production tool. It produces SVG assets that get placed into the scene engine's asset registry.
- **App gets absorbed** — The melee-3 Vite editor app's layer editing capabilities (layer panels, lighting controls, chrome tuning, media panels, recipe API) move into the scene editor as the property inspector for `glyph-group` assets. No separate editor app.
- **Flow**: Pipeline generates SVG → asset lands in registry → scene editor is where you tune layers, adjust lighting, compose into scenes.

User's framing: *"The actual pipeline itself would still be within font creation, but the app may get moved then outside of it to the more editor view now."*

### Migration: Replaces Existing Frontend

The scene system **replaces** `apps/frontend/` entirely. All existing pages (home, menu, projects, testimonials, links, about, guestbook) would eventually be rebuilt as scenes within the new system. The existing shared infrastructure (vortex/CRT effects, audio, tweaks panel, layout scaffold) gets absorbed as reusable scene assets/effects rather than hard-wired page code.

The existing data files (`menus.json`, `projects.json`, `testimonials.json`, `links.json`) and their content carry over — they migrate into their respective component asset directories (e.g. `assets/components/menu/menu-data.json`).

### Authoring Model: Dual-surface

The system has **two authoring surfaces** that operate on the same underlying scene data:

1. **Visual editor (human)** — Canvas with drag-and-drop asset placement, property panels, layer ordering. The user directly manipulates the scene visually.
2. **Agent/API (AI)** — Programmatic read/write access to the same scene data. The agent does heavy lifting like figuring out layer ordering, normal mappings, chrome effects, and other computationally intensive or taste-driven adjustments.

This dual-surface pattern already exists in the font-creation app (`melee-3`): the UI panels let the user tweak layers and lighting, while the backend API (`/api/melee-3/regenerate`) lets the recipe be written and re-rendered programmatically. The scene system generalizes this to full-page compositions.

User on agent authoring: *"A lot of the editing I was doing was trying to figure out how to lay out the assets for that CodeCaine logo. How do I lay out the different layers and such, and then do different normal mappings and other things like that?"* — this kind of exploratory, iterative work is where the agent earns its keep.

**Agent workflow**: The agent operates from the CLI (Claude Code), reading and writing `scene.json` files directly. No real-time collaboration or editor-state awareness needed. The human uses the visual editor, the agent uses file I/O — both operate on the same `scene.json`. The agent needs to understand the scene data format to make meaningful edits (add/remove/reorder layers, adjust properties, insert assets).

This mirrors the existing workflow with `layer-recipe.json` in the font app — the agent edits the recipe file, the user views results in the browser.

## Key Decisions

<!-- Decisions will be added here as the conversation progresses. -->

## Open Questions

- [x] What is the precise definition of a "scene" vs. a "page"? **Answered**: Scene = Page, 1:1. Unity Scene model — each scene is one full stage, assets are placed into it. For landing pages/static sites, not apps.
- [x] What asset types are first-class on day one? **Answered**: All five: `glyph-group` (layered SVG glyphs with sub-layers), `media` (video, images, textures), `effect` (CSS effects — CRT, vortex, chromatic aberration), `component` (data-driven JS components — menu, press-start), `audio` (SFX, ambient sound).
- [x] How are scenes defined? **Answered**: Visual canvas editor (human) + programmatic API (agent). Both read/write the same underlying scene data format. Dual-surface authoring.
- [x] Is there a runtime authoring/edit mode? **Answered**: Yes — visual editor with canvas, drag-and-drop, property editing. Also agent-editable from the backend.
- [x] Does content stay separate from scene composition? **Answered**: Yes (Option A). Assets in registry are reusable, content lives with components, scenes are lean composition manifests that reference assets by ID.
- [x] Do scenes need transitions between each other? **Answered**: Navigation is a rendered-website concern, not a scene-editor concern. Published site navigates like a normal webpage. Keyboard nav (arrow keys, Enter, Escape) lives in component/page code, not in the scene system. The editor views/edits one scene at a time — no transition wiring needed.
- [x] What's the relationship between the font-creation pipeline/app and the scene system? **Answered**: The Python pipeline (`apps/font-creation/pipeline/`) stays separate — it's an asset factory that produces SVGs. The Vite editor app (`apps/font-creation/app/melee-3/`) gets absorbed into the scene editor — its layer editing capabilities (layer panels, lighting, chrome, media controls) become part of the scene editor's inspector for glyph-group assets. Pipeline produces → registry holds → scene editor tunes and composes.
- [x] What's the first concrete scene to ship as a vertical slice? **Answered**: CodeCaine title screen — logo (centered, top-third, shimmer), in-text background element, full scene background, press start button, CRT overlay, additional animations. Layer-rich scene with fine-grained z-ordering.

## File Structure

### Chosen Structure: Content separate, assets reusable

Scenes own visual composition only. Content-heavy pages use "component" assets that internally read their own data files. Assets live in the registry as reusable building blocks. Scenes reference assets by ID.

```
apps/scene-engine/
├── package.json
├── vite.config.js
│
├── assets/                          # Asset registry — reusable building blocks
│   ├── registry.json                # Master list: id, type, path, metadata
│   │
│   ├── glyphs/                      # Font/glyph assets (from font-creation pipeline)
│   │   ├── CODECAINE.css-layers.svg
│   │   ├── A.css-layers.svg
│   │   └── ...
│   │
│   ├── media/                       # Video loops, images, audio
│   │   ├── test-fire-2.mp4
│   │   ├── test-fire-3.mp4
│   │   └── ...
│   │
│   ├── effects/                     # CSS effect definitions (vortex, CRT, etc.)
│   │   ├── vortex.css
│   │   ├── crt-overlay.css
│   │   └── chromatic-aberration.css
│   │
│   ├── audio/                       # Sound effects, ambient audio
│   │   └── ...
│   │
│   └── components/                  # Data-driven component assets
│       ├── menu/
│       │   ├── menu.js              # Renders pill buttons from data
│       │   ├── menu.css
│       │   └── menu-data.json       # ← content lives WITH the component
│       ├── projects/
│       │   ├── projects.js
│       │   ├── projects.css
│       │   └── projects-data.json
│       ├── press-start/
│       │   ├── press-start.js
│       │   └── press-start.css
│       └── ...
│
├── scenes/                          # Scene definitions — one per page
│   ├── title/
│   │   └── scene.json               # Layer tree: what assets, where, what properties
│   ├── main-menu/
│   │   └── scene.json
│   ├── projects/
│   │   └── scene.json
│   └── ...
│
├── editor/                          # Visual scene editor (dev-time tool)
│   ├── index.html
│   ├── src/
│   │   ├── canvas.js                # Stage renderer / preview
│   │   ├── hierarchy.js             # Layer tree panel (collapsible groups)
│   │   ├── inspector.js             # Property panel for selected asset
│   │   ├── asset-browser.js         # Browse/search asset registry
│   │   └── ...
│   └── api/                         # Backend API for agent editing
│       └── scenes.js                # CRUD endpoints for scene.json files
│
└── renderer/                        # Production renderer (shared with editor preview)
    ├── scene-renderer.js            # Reads scene.json → DOM
    ├── asset-renderers/             # Per-type renderers
    │   ├── svg-glyph.js
    │   ├── video.js
    │   ├── css-effect.js
    │   ├── audio.js
    │   ├── component.js             # Loads + renders data-driven components
    │   └── ...
    └── ...
```

**Key principle**: Scenes are composition manifests — they declare *which* assets go *where* with *what properties*. They don't own the assets or the content. Content lives with each component asset (e.g. `menu-data.json` next to `menu.js`).

### Scene Data Format (Canonical Reference)

Both the visual editor and the agent API operate on this format. Z-order is top-to-bottom in the `layers` array (last item renders on top).

```json
{
  "id": "title",
  "name": "Title Screen",
  "stage": { "width": 1440, "height": 1080 },
  "layers": [
    {
      "id": "bg-video",
      "type": "media",
      "asset": "media/test-fire-2.mp4",
      "properties": { "fit": "cover", "blend": "normal", "opacity": 1.0 }
    },
    {
      "id": "vortex",
      "type": "effect",
      "asset": "effects/vortex.css",
      "properties": { "speed": 1.0, "blend": "screen" }
    },
    {
      "id": "codecaine-logo",
      "type": "glyph-group",
      "asset": "glyphs/CODECAINE.css-layers.svg",
      "position": { "x": "center", "y": "33%" },
      "properties": { "scale": 1.0, "shimmer": true },
      "children": [
        { "id": "extrusion-shadow", "layer": "Chrome Depth/Extrusion Shadow", "visible": true },
        { "id": "in-text-element", "type": "media", "asset": "media/some-texture.mp4", "properties": { "blend": "multiply" } },
        { "id": "red-fill", "layer": "Interior/Red Fill", "visible": true, "properties": { "hue": 0 } },
        { "id": "chrome-top", "layer": "Chrome/Top", "visible": true }
      ]
    },
    {
      "id": "press-start",
      "type": "component",
      "asset": "components/press-start/press-start.js",
      "position": { "x": "center", "y": "75%" },
      "properties": { "blink-rate": 1.1 }
    },
    {
      "id": "crt",
      "type": "effect",
      "asset": "effects/crt-overlay.css",
      "properties": { "scanline-opacity": 0.3, "vignette": true }
    }
  ]
}
```

**Layer types confirmed for the format (all five required day one):**
- `glyph-group` — layered SVG glyph with expandable `children` sub-layers; children can interleave other assets
- `media` — video, image, texture (with fit, blend, opacity)
- `effect` — CSS effect definitions (vortex, CRT, chromatic aberration)
- `component` — data-driven JS component (menu, projects, press-start) that owns its own content
- `audio` — sound effects, ambient audio (the existing Web Audio square-wave SFX and future audio assets)

**Group model:** `children` array on group nodes. Child entries can be either references to the asset's internal layers (`"layer": "Chrome/Top"`) or independent assets inserted between them (`"type": "media", "asset": "..."`). This enables the interleaving discussed earlier.

## Diagrams

*To be added as the model crystallizes.*

## Notes

User quote on the vision: *"It is almost like an interactive website builder type feel."* Driving use case: putting CODECAINE into a background and building more of a scene around it.
