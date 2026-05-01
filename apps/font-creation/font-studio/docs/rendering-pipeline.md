# Font Studio Rendering Pipeline

## Overview

The pipeline converts a recipe JSON and glyph path data into layered SVG files. Each SVG contains an embedded `<style>` block with CSS custom properties, allowing the frontend to override visual parameters live without a server round-trip. Structural changes (geometry, lighting, bevel) require a full re-render via the Python renderer.

---

## Pipeline Flow

### 1. Recipe JSON

**Path:** `projects/melee/recipes/layer-recipe.json`

Single source of truth for all visual parameters. Defines layers, gradients, lighting config, layer media, relief/height map settings, chrome stack, and named variants. Nothing is hardcoded in the renderer — all tunable values come from this file.

### 2. Python Renderer

**Path:** `renderer/scripts/render_recipe.py`

Reads the recipe and glyph paths from `projects/melee/inputs/glyph_paths.json`. For each variant (`word_display`, `glyph_display`):

1. Lays out glyph records with tracking and padding (`records_for_text`)
2. Generates SVG defs: path definitions, clip paths, fill masks, band masks, chrome stack mask, gradient definitions, SVG filters
3. Generates lighting overlays: rasterizes fill mask → builds height map from relief bands → computes normal map → produces shadow/highlight/AO/reflection PNG data URIs
4. Renders each visible layer dispatched by type (`chrome-extrude`, `bevel-ramp`, `projected-shadow`, `lighting-overlay`, `stroke`, `fill`, `rect-fill`)
5. Generates CSS with custom property hooks (`--melee3-{layerId}-{property}`) for live frontend overrides
6. Assembles the complete SVG document

### 3. Generated SVGs

**Path:** `projects/melee/outputs/generated/`

Each SVG contains an embedded `<style>` block. Every tunable property uses the pattern `var(--melee3-{layerId}-{property}, fallback)`. Output files:

- `word/CODECAINE.css-layers.svg` — full word render
- `glyphs/{char}.css-layers.svg` — individual glyph renders

### 4. Vite Dev Server

**Path:** `web/vite.config.js`

Serves the frontend app and exposes API endpoints:

| Endpoint | Method | Description |
|---|---|---|
| `/api/melee-3/recipe` | GET | Returns current recipe JSON |
| `/api/melee-3/regenerate` | POST | Accepts modified recipe, writes it, runs Python renderer, returns result |
| `/generation/*` | GET | Serves files from the active project workspace (SVGs, images, video) |

### 5. Frontend App

**Path:** `web/src/main.js`

Loads SVGs via fetch and injects them as innerHTML. Two update modes:

**Live update** — Sets CSS custom properties directly on the SVG element:
```js
svg.style.setProperty('--melee3-fill-layer-opacity', value)
```
Applies instantly with no server round-trip. Works for: opacity, stroke width, colors, shadow position.

**Rebuild** — POSTs a modified recipe to `/api/melee-3/regenerate`. Python re-renders all SVGs. Frontend reloads the current SVG. Required for: lighting, bevel geometry, height maps, and enabling media on a layer that was previously paint-only.

---

## Recipe Structure

Key top-level fields in `layer-recipe.json`:

| Field | Description |
|---|---|
| `text` | The text string to render |
| `tracking` | Letter spacing |
| `padding_x`, `padding_y` | Canvas padding |
| `background` | Background color/style |
| `css_scope` | CSS selector scope prefix |
| `chrome_stack` | Array of layer IDs that form the chrome stack mask |
| `relief` | Height map config (see below) |
| `lighting` | Lighting params (see below) |
| `materials.chrome` | Chrome reflection opacity and env gradient |
| `gradients` | Named gradient stop arrays (`red_fill`, `red_gloss`, `silver`, etc.) |
| `layers` | Array of layer definitions |
| `variants` | Named override sets that patch recipe values at render time |

### Layer `media`

Controls what renders inside a paint layer. The current renderer applies media on `fill`, `stroke`, and `rect-fill` layers, with old top-level `interior_media` still accepted as a legacy fallback for the fill layer. The `mode` field determines which sub-config is used:

- `css-fire` — CSS-animated fire effect
- `video` — embedded or linked video
- `image` — static image
- `css` — arbitrary CSS
- `paint` — solid paint fill

### `relief`

Controls the height map used for lighting computation:

```json
{
  "height_scale": 1.0,
  "fill_height": 0.8,
  "background_height": 0.0,
  "bands": [
    { "layer_id": "silver-rim", "role": "ramp", "height_from": 0.0, "height_to": 1.0 }
  ]
}
```

Band roles: `ramp`, `raised_plateau`, `plateau`. Optional `crown` modifier applies a peak at band center.

### `lighting`

```json
{
  "light": { "x": 0.3, "y": -0.5, "z": 1.0 },
  "surface": {
    "normal_strength": 1.2,
    "ambient": 0.3,
    "diffuse": 0.8,
    "specular": 0.9,
    "specular_power": 32
  },
  "overlay_opacities": { "shadow": 0.6, "highlight": 0.5, "ao": 0.4, "reflection": 0.3 },
  "resolution_scale": 1.0
}
```

### `variants`

Named sets of recipe overrides applied at render time. Example:

```json
"variants": {
  "word_display": { "text": "CODECAINE" },
  "glyph_display": { "tracking": 0, "padding_x": 20 }
}
```

---

## Layer Types

Each entry in the `layers` array has an `id`, a `type`, and type-specific parameters.

| Type | Description |
|---|---|
| `fill` | Interior letterform fill. Supports layer-owned `media` modes. |
| `stroke` | SVG stroke. Supports optional band masking via `outside_fill` mask with `start` and `thickness` params. Can use layer-owned `media` as its surface. |
| `bevel-ramp` | Band-masked gradient ramp. Used for chrome edge tapers. |
| `chrome-extrude` | Stepped offset rectangles simulating 3D extrusion depth. |
| `projected-shadow` | Gaussian blur + offset drop shadow. |
| `lighting-overlay` | Pre-rendered PNG data URI from height/normal map computation. Embedded as `<image>`. |
| `rect-fill` | Simple rectangle with a `height_ratio` param. Can use layer-owned `media` as its surface. |

---

## CSS Custom Property System

The renderer generates a `<style>` block inside each SVG with custom property declarations:

```css
:root {
  --melee3-fill-layer-opacity: 1;
  --melee3-silver-rim-layer-width: 12px;
}
```

Layer rules reference these properties with a fallback:

```css
#fill-layer { opacity: var(--melee3-fill-layer-opacity, 1); }
#silver-rim { stroke-width: var(--melee3-silver-rim-layer-width, 12px); }
```

The naming convention is: `--melee3-{layer-id}-{property}` where `layer-id` uses hyphens and `property` is the CSS property name.

The frontend overrides these at runtime by calling `svg.style.setProperty(...)` on the injected SVG element. Since the SVG is injected as innerHTML, the properties set on the SVG element scope down to all child elements.

---

## Lighting Pipeline

The lighting overlay is a pre-rendered PNG baked into the SVG as a data URI. Computation flow:

1. **Rasterize fill mask** — PIL renders the glyph fill mask at the target resolution
2. **Build height map** — numpy composes height values from the `relief.bands` config. Each band maps to a region with a role:
   - `ramp` — linear gradient from `height_from` to `height_to` across the band
   - `raised_plateau` — flat raised surface at `height_to`
   - `plateau` — flat surface
   - Optional `crown` modifier adds a peak at band center
3. **Stabilize** — blur and clamp the height map to remove artifacts
4. **Compute normals** — derive surface normal vectors from height map gradients
5. **Compute lighting maps** — apply Phong lighting model to produce separate shadow, highlight, ambient occlusion, and reflection maps
6. **Encode** — each map is encoded as PNG and embedded as a base64 data URI
7. **Embed** — injected as `<image>` elements in the SVG defs, composited at their configured opacities

Lighting is fully static after generation — changing any lighting param requires a rebuild.

---

## Module Structure

The renderer is split across these modules under `renderer/scripts/`:

| Module | Responsibility |
|---|---|
| `render_recipe.py` | Entry point, CLI argument handling, top-level render pipeline orchestration |
| `utils.py` | Math, color conversion, and string utility functions |
| `recipe.py` | Recipe loading, variant merging, layer geometry helpers |
| `css_gen.py` | CSS generation, custom property declarations, interior fire CSS |
| `svg_path.py` | SVG path parsing, contour extraction, glyph ID and use-node helpers |
| `gradients.py` | SVG gradient definition generation |
| `masks_defs.py` | Band mask generation, chrome stack mask, full SVG `<defs>` block assembly |
| `lighting.py` | Height map construction, normal map computation, lighting overlay rendering |
| `layers.py` | Per-layer SVG emission — one function per layer type |

When adding a new layer type, add the emission function to `layers.py` and register it in the dispatch table in `render_recipe.py`. When changing how CSS properties are named or scoped, update `css_gen.py` and the corresponding frontend selector logic in `main.js`.

---

## Making Changes

**To add a tunable parameter:**
1. Add it to the recipe JSON with a default value
2. Emit it as a CSS custom property in `css_gen.py`
3. Reference it via `var(--melee3-...)` in the layer emission in `layers.py`
4. Wire up the frontend control in `main.js` using `svg.style.setProperty(...)`

**To add a new layer type:**
1. Define the layer schema in the recipe
2. Write an emission function in `layers.py`
3. Register it in the dispatch table in `render_recipe.py`
4. Add relief band entries if the layer needs height map participation

**To change lighting behavior:**
Modify `lighting.py`. All lighting params are read from the `lighting` key in the recipe — no hardcoded values should exist in that module.

**To regenerate all outputs from the current recipe:**
```sh
cd apps/font-creation/font-studio/renderer
python3 -m scripts.render_recipe
```
