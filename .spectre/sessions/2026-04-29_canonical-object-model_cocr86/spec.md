# Canonical Object Model

**Session**: `2026-04-29_canonical-object-model_cocr86`
**Date**: 2026-04-29
**Status**: Finalized

## Overview

Define a canonical, well-structured object model for the MELEE scene engine — a Unity-style 2D editor for composing web pages that can be exported as standalone static sites with bundled assets.

## Problem Statement

The current scene format (`scene.json`) uses a flat `layers[]` array where each layer has an ad-hoc mix of transform properties scattered across `position`, `properties.scale`, `properties.position_x/y`, `properties.rotation`, and rendering concerns like `blend`, `opacity`, `fit`. There's no explicit z-index — ordering is implicit via array position. The format grew organically and doesn't have a canonical shape that cleanly separates **transform** (where/how it's placed in space), **appearance** (how it looks), and **behavior** (what it does).

The end goal is a format that:
- Maps cleanly to a Unity-style inspector (Transform, Renderer, Components)
- Supports explicit z-ordering
- Produces exportable static web pages with assets

## Current State

### Existing Layer Shape
```json
{
  "id": "string",
  "type": "video | glyph-group | component | effect | audio",
  "asset": "registry-id",
  "visible": true,
  "position": { "x": "center | % | px", "y": "center | % | px" },
  "properties": {
    "scale": 0.18,
    "opacity": 1,
    "blend": "normal",
    "fit": "cover",
    "position_x": 0,
    "position_y": 0,
    "rotation": 0,
    "hue": 0,
    "speed": 1,
    "clip": "fill-clip"
  },
  "children": []
}
```

### Key Observations
- Transform data is split: `position` at top level, `scale`/`rotation`/`position_x/y` inside `properties`
- No width/height/size concept on layers
- Z-order is array index (implicit, not inspectable)
- `properties` is a grab-bag mixing transform, appearance, and behavior
- `children` are used for glyph-group sub-layers and foreign media — this nesting serves a specific SVG compositing purpose, not general hierarchy
- The renderer is imperative vanilla JS that reads this format directly

## Core Mental Model

This is a **visual design tool that outputs CSS/HTML**. The user places objects (SVGs, images, videos, custom components) on a 2D canvas, adjusts their properties through an inspector, and exports the result as a standalone static web page with bundled assets.

The aesthetic is **Figma (spatial design + layering) blended with Unity (inspector with always-present Transform, typed property sections)**. Not Unity's ECS architecture — Unity's *editor ergonomics*: every object always has spatial properties visible, and components/effects expose a known set of tweakable knobs.

### Key Principles (from user)
- **Every object has a Transform** — always visible in the inspector, even if position is 0,0 and scale is 1. The current behavior of hiding Transform when properties don't exist in the JSON is wrong.
- **Components declare their editable properties** — a CRT effect should expose "graininess", "scan-line density", etc. Right now, effects are opaque; the inspector can't know what knobs exist.
- **Objects have clear spatial bounds** — the CRT effect covering the whole screen should be explicit, not ambiguous. Every object should have a clear answer to "where is this and how big is it?"
- **Events/interactions are attachable** — onClick on a button to play a sound, onChange handlers, key events. Standardized structure for wiring behavior.
- **The output is CSS** — transforms become CSS transforms, positioning becomes CSS positioning. The data model should map directly to what CSS can express.

## High-Level Goals

1. Define a canonical object shape with clean separation: Transform (where), Appearance (how it looks), Behavior (what it does)
2. Inspector always shows all relevant sections — no more "hidden because the property isn't in the JSON yet"
3. Components/effects declare a property manifest so the inspector knows what knobs to show
4. Attachable event system (onClick, onChange, onKeyDown) for interactivity
5. Explicit spatial bounds and z-ordering for every object
6. Export pipeline that maps the object model directly to static HTML/CSS/JS

## Component / Effect Contract

Components and effects must be **self-describing**. The editor needs to know what properties exist, their types, defaults, and valid ranges — without hardcoding per-component knowledge.

### Approach: Manifest file
Each component or effect ships a `manifest.json` alongside its code. The manifest declares:
- Editable properties (name, type, default, range/options)
- What the component renders (full-screen overlay? positioned element?)
- *Potentially*: events it can emit or respond to

### Design constraint: Easy extensibility for open source
- A new contributor should be able to drop in a CSS file + manifest and have it work in the editor
- "Bring your own CSS/JS" — the system should accommodate custom effects, components, textures
- The convention must be simple enough that writing a new component is low-friction

### SVG sub-layer richness
SVG sub-layers (within glyph-groups) should support more than solid colors. Users want to fill individual SVG layers with videos, textures, gradients — making each sub-layer a compositing surface, not just a paint bucket. This is already partially working (the `in-text-fire` video child clipped to the fill shape), but needs to be a first-class, easily-authored pattern.

## Object Model Philosophy

**Universal base + attachable components.** Every object in a scene is the same fundamental thing — a "scene object" with a transform (position, rotation, scale, z-index). What makes objects different is the components attached to them.

This is the Unity GameObject model at the data level: a Logo is a scene object with a GlyphGroup renderer. A CRT effect is a scene object with an Effect renderer. A "Press Start" button is a scene object with a Component renderer. Audio is a scene object with an Audio component (no visual, but still positional in the hierarchy).

### Built-in base types
Some common object types should ship as built-ins so users don't have to create components for basics:
- **Text** — editable text with font, color, size
- **Image/Video** — media display
- **Audio** — sound playback
- **Shape** — basic rectangle/ellipse (useful for backgrounds, hit areas)

These provide a "just works" starting point. Custom components extend beyond these.

### Existing component pattern (press-start)
The press-start component already demonstrates the right direction:
- `press-start.js` — render function receiving `{ properties, layerId }`
- `press-start-data.json` — proto-manifest with defaults (`text`, `blink-rate`)
- `press-start.css` — visual styling using CSS custom properties (`--blink-duration`)

This needs to be formalized into a consistent manifest convention.

### Existing effect pattern (CRT overlay)
The CRT overlay is pure CSS with no manifest — its tweakable properties (scan-line density, vignette intensity, RGB fringe) are baked into the CSS values. The new model should let an effect author expose these as named, editable properties.

## Events / Interactions

### Scope reality check
These are **static landing pages** — stylish, fun, 2-3 pages max per site (e.g., title screen → menu → maybe one more). Not complex apps. The event model doesn't need visual scripting or node graphs.

### What needs to be representable
A very small set of triggers and actions:
- **onClick → navigate** — click "Press Start" → go to the menu page
- **onClick → play sound** — click the button → play `start-cue`
- **onLoad → autoplay** — page loads → play background audio, start animations
- *Maybe* **onHover → visual change** — hover state for interactive elements

### The real questions
1. **Editor visibility** — how do you show in the inspector that press-start has an onClick wired to "navigate to /menu" and "play start-cue"? Probably just a simple Events section listing trigger → action pairs.
2. **Export mapping** — these all map to trivial HTML/JS in the output: `<a href>`, `element.addEventListener('click', ...)`, `new Audio().play()`. The challenge is representing it cleanly in scene.json and making the export emit the right code.

### User's framing
"I can do this in TypeScript without a problem — I just want it visible in the UI so you know what's going on." The event system is about **editor legibility**, not about enabling capability the user can't already code. Keep it simple: a small list of trigger → action bindings on each object, rendered as a section in the inspector.

## Export Pipeline

### Approach: Fully bundled standalone copy
The export produces a self-contained folder that includes:
- `scene.json` (the scene data as-is)
- The vanilla JS renderer
- All referenced assets (images, videos, audio, SVGs, fonts)
- Component/effect code (JS + CSS)
- A minimal `index.html` that boots the renderer

The user downloads a zip, unzips it, opens `index.html`, and it works. No build step, no server needed.

### Why this approach
- The renderer already exists and works — no need to build a compiler
- The scene.json format IS the source of truth, both in editor and in output
- Simpler to build and maintain
- The object model only needs to serve the editor and the existing renderer — no CSS compilation mapping required

### Implication for the object model
Since scene.json ships directly, the canonical object shape needs to be clean and self-documenting. It's not just internal editor state — it's the format that runs in production. But it does NOT need to map 1:1 to CSS properties, because the renderer handles that translation.

## Hierarchy / Nesting

### Decision: General parent-child nesting is supported
Objects can be nested arbitrarily — not just glyph-group children. You can group the logo + press-start into a "title-content" container and move them together. This matches both Unity (nested GameObjects) and Figma (frames containing objects).

### Child transforms are relative to parent
Moving a group moves all children. Children's positions are offsets from the parent's anchor point. This maps directly to CSS: parent `div` with `position: relative`, children with `position: absolute` inside it.

### Percentage-based positioning
All positions use percentages, not pixels. The stage dimensions (1440x1080) define the design aspect ratio, but the output scales to whatever screen size it's displayed on. This ensures responsive behavior — a logo at `x: 50%, y: 20%` stays centered at 20% from the top regardless of viewport.

### Sizing

**Key context**: These pages are game-menu style — **single viewport, no scrolling**. Everything is self-contained on one screen. This makes percentage-based sizing natural and intuitive, not awkward. A logo at `width: 60%` of the stage, a button at `width: 30%` — those are readable numbers.

**"Natural size" doesn't exist for most objects.** Text, effects, custom components — their size is entirely a function of how we choose to render them relative to the viewport. Only images, videos, and SVGs have intrinsic aspect ratios. So `content` mode as a default doesn't work.

**Resolved sizing model:**
- **Everything sized as percentage of parent** (which is ultimately percentage of stage/viewport)
- `width` as the primary dimension (percentage). `height` can be `auto` (maintain aspect ratio for media/SVG) or an explicit percentage.
- `fill` as a shorthand/mode for full-parent coverage (backgrounds, effects, overlays)
- Text font-size would also need to be viewport-relative to scale properly
- Objects with intrinsic aspect ratios (SVG, image, video): set width %, height auto
- Objects without intrinsic size (text, components): set width % and height % explicitly, or width % with content-driven height

### Z-ordering
Array position = z-order (last = frontmost), same as current behavior. Controlled via drag-and-drop reordering in the hierarchy panel. No explicit `z-index` numbers — avoids the classic `z-index: 9999` debugging nightmare. This is how Figma does it.

Within nested groups, children have their own local z-order (array position within `children[]`), and the group itself has a position in its parent's z-stack.

### Glyph-group / SVG handling

**SVGs are "done" when they enter the scene engine.** The 40+ sub-layers (chrome shadows, reflections, bevels) are finalized during SVG authoring — a separate process (the Melee 3 font-creation app can even bake these to PNG). They do NOT become child objects in the scene hierarchy.

**Only explicitly exposed layers appear in the editor.** The SVG author marks certain layers as editable — e.g., a fill layer that accepts a video texture, or a color layer. In the title scene, the only editable sub-layer is the `in-text-fire` video fill clipped to the letter shapes.

**Model:**
- A glyph-group is ONE object in the scene hierarchy
- The SVG's internal layers render as-is (baked)
- Editable layers are exposed as **slots** — configurable fill/texture/color surfaces within the object
- These slots appear in the inspector under the glyph-group object, not as separate objects in the hierarchy
- The current 40-child array in scene.json goes away; replaced by a small `slots` list of only the exposed editables

This keeps the hierarchy panel clean and the scene data lightweight, while still allowing rich SVG compositing for the layers that matter.

## Mid-Level Goals

1. **Canonical object shape**: Implement the approved `transform` / `appearance` / `properties` / `events` / `children` structure across scene.json, TypeScript types, renderer, and editor
2. **Always-present inspector sections**: Transform and Appearance always render in the inspector with defaults, regardless of what's in the JSON
3. **Manifest convention**: Formalize `manifest.json` for components/effects; migrate press-start and CRT to use it; editor reads manifests to build property UI dynamically
4. **General nesting**: Extend the renderer and hierarchy panel to support arbitrary parent-child nesting with relative transforms
5. **Percentage-based spatial model**: Convert positioning and sizing to percentage-of-parent; implement `fill` mode for backgrounds/effects
6. **Events section**: Add trigger→action pairs to the object model and render an Events section in the inspector
7. **Project manifest**: Introduce `project.json` to tie scenes together; export bundles all scenes + assets
8. **SVG slot model**: Replace the 40-child glyph-group pattern with exposed slots for editable layers only
9. **Export pipeline**: Build the "download as standalone site" flow — bundle renderer + scenes + assets into a zip

## Key Decisions

1. **Unity's editor UX, not Unity's architecture** — Inspector ergonomics (always-visible Transform, collapsible typed sections), not entity-component-system.
2. **Manifest-based component contract** — Components/effects declare their properties via manifest.json. Editor reads manifests dynamically. Open-source extensible.
3. **Universal base + attachable components** — Every scene object has a transform; behavior differs by attached type/component.
4. **Simple trigger→action events** — Not visual scripting. Small list of bindings visible in the inspector.
5. **Fully bundled export** — scene.json + renderer + assets ship together. No compilation to HTML/CSS.
6. **Percentage-based everything** — Single-viewport game-menu pages. All positioning and sizing relative to parent/stage.
7. **Array position = z-order** — Drag-and-drop reordering. No explicit z-index numbers.
8. **Child transforms relative to parent** — Moving a group moves its children.
9. **SVGs are baked** — Only author-exposed slots are editable in the scene editor. Sub-layers don't clutter the hierarchy.
10. **Thin project manifest** — Appearance lives on scenes/objects, not the project.
11. **Shape is a component, not a built-in** — Keep built-in types minimal; extensibility via modules.
12. **Group as a built-in type** — Empty structural container for organizing/nesting.

## Canonical Object Shape (Approved)

Every scene object follows this shape. `children` are recursive (same shape).

```json
{
  "id": "press-start",
  "name": "Press Start Button",
  "type": "component",
  "asset": "press-start",
  "visible": true,

  "transform": {
    "x": 50,
    "y": 75,
    "width": 30,
    "height": "auto",
    "rotation": 0,
    "scale": 1,
    "anchor": "center"
  },

  "appearance": {
    "opacity": 1,
    "blend": "normal",
    "hue": 0
  },

  "properties": {
    "text": "PRESS  START",
    "blink-rate": 1.1
  },

  "events": [
    { "trigger": "click", "action": "navigate", "target": "/menu" },
    { "trigger": "click", "action": "play-audio", "target": "start-cue" }
  ],

  "children": []
}
```

### Field breakdown

| Section | Always present | Contents |
|---------|---------------|----------|
| `id`, `name` | Yes | Identity — `id` is machine key, `name` is human-readable display name |
| `type`, `asset` | Yes | What this renders — `type` is the renderer type, `asset` is the registry ID |
| `visible` | Yes | Toggle visibility |
| `transform` | Yes | Spatial: `x`, `y` (%), `width` (%), `height` (% or `"auto"`), `rotation` (deg), `scale` (multiplier), `anchor` |
| `appearance` | Yes | Visual: `opacity`, `blend`, `hue`, `fit` (for media). Always shown in inspector. |
| `properties` | Yes (may be `{}`) | Component-specific knobs, driven by manifest. Only these are type-dependent. |
| `events` | Yes (may be `[]`) | Trigger → action pairs for interactivity |
| `children` | Yes (may be `[]`) | Nested child objects (same shape, recursive) |

### Fill mode for backgrounds/effects

Objects that cover their parent use `"transform": { "mode": "fill" }` instead of explicit x/y/width/height. This applies to background videos, fullscreen effects like CRT, overlays.

### Scene-level shape

```json
{
  "id": "title",
  "name": "Title Screen",
  "stage": {
    "width": 1440,
    "height": 1080
  },
  "objects": [ ... ]
}
```

Note: `layers` renamed to `objects` to match the new terminology.

## Component Manifest Shape

Each component/effect ships a `manifest.json` alongside its code. The manifest declares only component-specific properties — things the editor wouldn't know about otherwise.

```json
{
  "name": "CRT Overlay",
  "type": "effect",
  "sizing": "fill",
  "properties": {
    "scan-line-density": { "type": "number", "default": 3, "min": 1, "max": 10, "step": 0.5 },
    "vignette-intensity": { "type": "number", "default": 0.55, "min": 0, "max": 1 },
    "rgb-fringe": { "type": "number", "default": 0.04, "min": 0, "max": 0.2 }
  }
}
```

### What the manifest does NOT include
- **Enabled/visible** — that's a universal object-level toggle (`visible` field), controlled from the hierarchy. Not a component property.
- **Transform or appearance** — those are universal sections on every object.
- Anything the editor already knows about generically.

### What the manifest declares
- `name`: human-readable display name
- `type`: renderer type (`effect`, `component`, etc.)
- `sizing`: default sizing hint (`fill` for effects, omitted for positioned objects)
- `properties`: component-specific knobs with type, default, and constraints (min/max/step for numbers, options for enums, etc.)
- *Potentially*: `events` the component can emit, `slots` for glyph-groups

## Project Hierarchy

A **project** is a collection of scenes (pages) that form a site. Each scene is one full-viewport page. Navigation events route between scenes, just like clicking a link routes between pages on a normal website.

### Structure
```
project.json          ← project manifest (name, scenes list, shared settings)
scenes/
  title/scene.json    ← one scene = one page
  menu/scene.json
  credits/scene.json
public/
  assets/             ← shared across all scenes in the project
  modules/
```

### What project.json provides (kept thin)
- Project name and metadata
- List of scenes (with default/entry scene — which page loads first)
- Stage aspect ratio (shared across scenes)
- The export bundles ALL scenes in the project + shared assets

**The project manifest is intentionally minimal.** Appearance settings (hue, saturation, color grading) live at the scene level or even per-object via `appearance`. No bloated project-level config.

### Scene-level global appearance
Each scene can have its own color grading / global appearance settings (hue, saturation, etc.) separate from individual object appearances. This could be a top-level `appearance` block on the scene:
```json
{
  "id": "title",
  "name": "Title Screen",
  "stage": { "width": 1440, "height": 1080 },
  "appearance": { "hue": 0, "saturation": 1 },
  "objects": [ ... ]
}
```

### Navigation between scenes
Navigate events reference scene IDs: `{ "trigger": "click", "action": "navigate", "target": "menu" }`. The renderer resolves scene IDs to page routes.

## Built-in Object Types

| Type | Description | Has visual | Sizing default |
|------|-------------|-----------|----------------|
| `video` | Video media (loops, backgrounds) | Yes | `fill` or explicit |
| `image` | Static images | Yes | explicit % |
| `audio` | Sound effects, music | No | n/a |
| `glyph-group` | Layered SVGs with exposed slots | Yes | explicit % |
| `text` | Editable text (font, size, color) | Yes | explicit % |
| `effect` | CSS effects from modules (CRT, etc.) | Yes (overlay) | `fill` |
| `component` | Custom JS components from modules | Yes | varies (per manifest) |
| `group` | Empty container for organizing/nesting children | No (structural) | explicit % or `fill` |

**Shape is not a built-in** — it's just a component. Someone creates a `rectangle` or `ellipse` component with a manifest, drops it in modules.

## Open Questions (for planning phase)

- Migration path from current scene.json to new format
- Renderer refactor strategy (update in-place vs. rewrite)
- Order of implementation (which mid-level goals first)
