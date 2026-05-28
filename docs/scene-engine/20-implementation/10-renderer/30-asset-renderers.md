---
covers: The renderer registry and the per-type renderers, including the glyph-group slot mounting algorithm and the manifest-driven component contract.
concepts: [renderer-registry, glyph-group, slots, foreignObject, component, effect, manifest]
design_refs: [10-system-design/30-rendering-pipeline.md, 10-system-design/15-component-manifest.md]
---

# Asset Renderers

Each object type has one renderer function. They share a contract: `async (object, registryEntry) => HTMLElement`. The contract plus the renderer registry is the entire extension point for new object types.

---

## Renderer Registry (`asset-renderers/index.js`)

A `Map<string, fn>` populated at module load. `getRenderer(type)` returns the function or **throws** if the type is not registered. Throwing here is intentional — an unknown type is a programmer error (typo in the scene, missing renderer registration), not a data error.

Registered types: `video`, `image`, `audio`, `glyph-group`, `text`, `effect`, `component`, `group`.

### Adding a New Type

1. Write `asset-renderers/<type>.js` exporting `async function render<Type>(object, entry)`.
2. Import and `registerRenderer('<type>', renderXxx)` in `asset-renderers/index.js`.
3. Add scene authoring support — registry entries with the matching type, optional manifest, optional inspector hints.

## Per-Type Renderers

### `media.js` — video, image

Mounts a `<video>` or `<img>` from `entry.file`. Videos autoplay, loop, and are muted to satisfy autoplay policies. The wrapper is the media element itself; `applyTransform` and `applyAppearance` style it directly. Object-fit is applied via `appearance.fit` on the inner element.

### `audio.js` — audio

Dynamically imports the audio module (or builds a Web Audio controller from the file at `entry.file`) and returns a small DOM stub so the object participates in the stage tree (for selection, reconciliation) without rendering anything visible.

### `css-effect.js` — effect

Loads the effect's stylesheet (deduped via `stylesheet.js`), returns a wrapper element. The object's `properties` are exposed as CSS custom properties on the wrapper (`--scan-line-density: 3`, `--rgb-fringe: 0.06`, …) so the stylesheet can consume them via `var(--…)`. Effects are typically `transform: { mode: "fill" }`; the universal styling pass handles full-stage layout.

### `component.js` — component

Renders a custom JS component declared by a manifest:

```js
const cssPath = deriveCssPath(entry.path)        // .js → .css
if (cssPath) ensureStylesheet(cssPath)           // load sibling stylesheet
const mod = await loadModule(entry.path)         // fetch + Blob URL + import()
const el = await mod.default({ properties: layer.properties || {}, layerId: layer.id })
return el
```

The Blob-URL `import()` shim avoids webpack analysis warnings for runtime-discovered modules and keeps a single in-memory cache (`moduleCache`) so the same component module is fetched once per session.

A component must default-export a function. Missing default → log error, return an empty placeholder so the rest of the scene survives.

The contract is intentionally minimal: components own their DOM and their internal lifecycle; the renderer never patches their internals. On property changes, the [scene-renderer's update path](10-scene-renderer.md#updatechildren) replaces the component wrapper rather than diffing inside it.

### `glyph-group.js` — glyph-group with slots

The complex one. Algorithm:

1. **Fetch and parse** the SVG at `entry.file` via `DOMParser` (text result is cached in `svgTextCache`).
2. **Hide the background rect** (`<rect id="background">`) — an artifact of the SVG export.
3. **Wrap** the parsed `<svg>` in a `<div class="glyph-group-layer">` sized to the SVG's `viewBox` (parsed by `parseViewBox`).
4. **For each `slot` in `object.slots ?? []`**:
   - `anchor = svg.querySelector('[data-slot="<slot.id>"]')`. Missing → warn and skip.
   - Resolve the slot's asset; if missing, warn and skip.
   - Map the slot's leaf type (`video-fill` → `video`) and call `getRenderer(leafType)(slot, entry)` for the fill element.
   - Build a `<foreignObject>` of viewBox dimensions, copy the anchor's `clip-path` so the fill is constrained to the letter shape.
   - Apply slot `appearance` (`opacity`, `blend`, `fit`, `hue`).
   - Wrap the fill in an `xhtml` `<div>` (overflow hidden) and insert the `<foreignObject>` immediately after the anchor.

Slots replace the legacy `children` array on glyph-groups. Sub-layers without `data-slot` are baked: they render as authored, with no editor presence.

#### Why `<foreignObject>`

Foreign elements need to live *inside* the SVG's coordinate space so they composite between named layers in render order. `<foreignObject>` is the only standards-compliant way to embed HTML inside SVG.

### `text.js` — text

Renders a styled text element using the object's `properties` (`text`, `font`, `size`, `color`). Implementation is a thin wrapper; the heavy lifting is CSS.

### `group.js` — group

An empty positioned wrapper. Children render inside it. No asset, no manifest. Useful for arbitrary nesting and for moving multiple objects together.

## `stylesheet.js`

Internal helper. `ensureStylesheet(href)` deduplicates `<link rel="stylesheet">` tags so multiple effect or component objects sharing a stylesheet only load it once.

## Manifest Reads

When the asset registry merges a project's module registry, each module entry is augmented with its sibling `manifest.json` if present. The renderer doesn't consult the manifest itself — `properties` are passed through to components/effects unchanged. The manifest exists for the **editor** (to render property fields) and for **defaulting** (when a new object is added, the editor seeds `properties` from the manifest's `default` values). See the [component-manifest design doc](../../10-system-design/15-component-manifest.md).

## Source

- `apps/scene-engine/app/_engine/renderer/asset-renderers/index.js`
- `apps/scene-engine/app/_engine/renderer/asset-renderers/media.js`
- `apps/scene-engine/app/_engine/renderer/asset-renderers/css-effect.js`
- `apps/scene-engine/app/_engine/renderer/asset-renderers/glyph-group.js`
- `apps/scene-engine/app/_engine/renderer/asset-renderers/component.js`
- `apps/scene-engine/app/_engine/renderer/asset-renderers/audio.js`
- `apps/scene-engine/app/_engine/renderer/asset-renderers/text.js`
- `apps/scene-engine/app/_engine/renderer/asset-renderers/group.js`
- `apps/scene-engine/app/_engine/renderer/asset-renderers/stylesheet.js`
