---
covers: The render loop in src/renderer/scene-renderer.js — mount, update reconciliation, transform/appearance application, recursive children.
concepts: [scene-renderer, mount, update, reconciliation, transform, appearance]
design_refs: [10-system-design/30-rendering-pipeline.md]
---

# Scene Renderer

`apps/scene-engine/src/renderer/scene-renderer.js` is the imperative entry point that turns a `SceneJson` into populated DOM. It exposes one function — `renderScene(scene, root)` — and is shared between the editor (called on every store change) and the standalone export (called once at boot, plus on scene navigation).

The renderer is plain JS modules with no framework. The Next.js editor wraps it via `useEffect` + `useRef`; the export bundle calls it from `boot.js`.

---

## Public Surface

```js
import { renderScene } from './renderer/scene-renderer.js'
await renderScene(scene, document.getElementById('stage'))
```

Idempotent: calling it twice with the same scene reconciles instead of re-mounting. Calling it with a different scene reuses any objects whose `id` matches.

## The Loop

`renderScene(scene, root)`:

1. `await loadRegistry()` — populates the asset/module registry caches (idempotent).
2. Set the stage size: `root.style.width = stage.width + 'px'`, same for height.
3. Apply scene-level appearance as a CSS `filter` on the root (`hue-rotate`, `saturate`).
4. Inspect `root.children` for elements bearing `dataset.layerId` — that decides mount vs. update:
   - **First time** (no tagged children): wipe `root.innerHTML`, then `mountObject` each top-level entry, then `reorderChildren` to align DOM order with array order.
   - **Subsequent calls**: `updateChildren(root, scene.objects)` to reconcile in place.

## `mountObject(parent, obj)`

1. `resolveAsset(obj.asset)` — registry lookup. Missing → warn and return `null` (object is skipped).
2. `obj.visible === false` → return `null` (object is not mounted at all on first render).
3. `await getRenderer(obj.type)(obj, entry)` — type dispatch produces the wrapper.
4. Tag with `wrapper.dataset.layerId = obj.id` and append to `parent`.
5. `applyObjectStyles(wrapper, obj, entry)` — sets visibility, transform, appearance, media src and (for glyph-groups) updates slot-related child handling.
6. If `obj.type !== 'glyph-group'` and `obj.children` is non-empty: ensure the wrapper has `position`, recurse `mountObject` for each child, then `reorderChildren`.

Glyph-groups handle their slots inside their renderer (see [asset renderers](30-asset-renderers.md)), so the scene-renderer doesn't recurse into them.

## `applyObjectStyles(el, obj, entry)`

Universal post-mount styling:

- `obj.visible === false` → `display: none` and bail. Otherwise clear `display`.
- `applyTransform(el, obj.transform)` — see [`positioning.js`](#positioning).
- `applyAppearance(el, obj.appearance, { isMedia, mediaEl })` — for media types, the inner `<video>` / `<img>` is found via `findMediaEl` so `object-fit` lands on the right element.
- For media: if `entry.file` doesn't match the existing media `src`, swap it. This is how registry container swaps propagate without re-mounting the wrapper.
- `obj.type === 'glyph-group'` → `updateGlyphGroup(el, obj)` (legacy named-override / foreign-child handling for compatibility with older glyph-group children; new authoring uses [slots](30-asset-renderers.md#glyph-group)).

## `updateChildren(parentEl, childArray)`

The reconciler. Same rules at every level:

1. Build `existing: Map<id, element>` by reading `parentEl.children` `dataset.layerId`.
2. Compute `wantedIds: Set<id>` from `childArray`.
3. For each `(id, el)` in `existing` not in `wantedIds`: `el.remove()`.
4. For each `child` in `childArray`:
   - Resolve its asset; if missing, skip.
   - If a wrapper already exists for `child.id`:
     - For `component` and `effect` types: re-run the renderer and **replace** the wrapper. Components own their internal DOM; replacing is the simplest correct update on property changes.
     - Otherwise: re-apply styles, then recurse `updateChildren` if the object isn't a glyph-group and has its own children.
   - If no wrapper exists: `mountObject` it.
5. `reorderChildren(parentEl, childArray)` — appendChild in array order to align DOM order. Skip if already aligned.

The id-keyed reconciliation is what makes the editor smooth: dragging an object in the hierarchy shuffles DOM nodes rather than tearing them down, so videos keep playing and components keep their internal state.

## `reorderChildren(parentEl, childArray)`

Walks `parentEl.children` and `childArray` in lockstep; if any index disagrees, re-appendChild each tagged element in array order. `appendChild` of an existing node moves it without re-creating, so this is cheap.

Untagged children (anything without `dataset.layerId`) are left in place — currently nothing in the renderer creates such children, but the loop is defensive.

## Positioning (`positioning.js`)

`applyTransform(el, transform)`:

- Always sets `position: absolute`.
- If `transform.mode === 'fill'`: `inset: 0`, `width: 100%`, `height: 100%`, optional rotation/scale via `transform-origin: center center`.
- Otherwise:
  - `left: <x>%`, `top: <y>%`.
  - `width` and `height` from `sizeToCss` (`'auto'` passes through; numbers become `<n>%`).
  - Anchor → translate offsets via `ANCHOR_TRANSLATE` map (e.g. `center` → `-50%, -50%`).
  - Concatenate `translate(...) rotate(...) scale(...)` and set `transform`.
  - `transform-origin: 0 0` when an anchor translation is present, so rotation pivots at the anchor.

`applyAppearance(el, appearance, { isMedia, mediaEl })`:

- `opacity` → `style.opacity`.
- `blend` → `style.mixBlendMode`.
- `hue` → `style.filter = 'hue-rotate(...)'` (or empty if 0).
- `fit` → `mediaEl.style.objectFit` (media types only).

`saturation` is currently honored at the scene level (composed into the root filter); per-object saturation is not separately applied here.

## What This File Does Not Do

- Does **not** import the renderer dispatch table — that comes via `getRenderer` from `asset-renderers/index.js`.
- Does **not** load assets — the registry layer does (`asset-registry.js`).
- Does **not** handle interactivity — `events` wiring lives in the per-type renderers and the export `boot.js`.
- Does **not** implement save / dirty / selection — those are editor concerns ([editor state](../20-editor/10-state.md)).

## Source

- `apps/scene-engine/src/renderer/scene-renderer.js` — the loop.
- `apps/scene-engine/src/renderer/positioning.js` — `applyTransform`, `applyAppearance`.
- `apps/scene-engine/src/renderer/asset-registry.js` — see [20-asset-registry.md](20-asset-registry.md).
- `apps/scene-engine/src/renderer/asset-renderers/` — see [30-asset-renderers.md](30-asset-renderers.md).
