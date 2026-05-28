---
covers: Production renderer — entry points, renderer registry, asset registry, per-type renderers, positioning helpers.
type: overview
concepts: [renderer, registry, dispatch, glyph-group, slots, transform, foreignObject]
design_refs: [10-system-design/30-rendering-pipeline.md, 10-system-design/20-asset-registry.md]
---

# Renderer

The production renderer reads a `SceneJson` and turns it into DOM. It is plain JavaScript modules — no framework — so it works identically inside the Next.js editor (called from `useEffect`), inside individual scene preview pages, and inside the standalone export bundle (called from `boot.js`).

The design rationale and failure semantics are in [System Design / Rendering Pipeline](../../10-system-design/30-rendering-pipeline.md). This section describes the code layout.

---

## File Tree

```
apps/scene-engine/app/_engine/renderer/
├── scene-renderer.js               top-level loop: mount + update reconciliation
├── asset-registry.js               registry load/merge/lookup with caching
├── event-runtime.js                trigger/action event binding
├── runtime-url.js                  bundle-root URL resolution
├── positioning.js                  applyTransform, applyAppearance helpers
└── asset-renderers/
    ├── index.js                    register/getRenderer; type → fn map
    ├── media.js                    video / image renderer
    ├── css-effect.js               CSS effect renderer (manifest properties → CSS vars)
    ├── glyph-group.js              layered SVG + slot mounting via <foreignObject>
    ├── component.js                JS component renderer (Blob-URL import)
    ├── audio.js                    Web Audio renderer
    ├── text.js                     styled text renderer
    ├── group.js                    empty positioned wrapper for nesting
    └── stylesheet.js               shared stylesheet loader helper
```

The renderer is also copied into the standalone export bundle, with absolute paths rewritten to relative — see [build output](../../10-system-design/50-build-output.md).

## Contents

### [10-scene-renderer.md](10-scene-renderer.md)
The top-level loop in `scene-renderer.js`: stage sizing, scene-level appearance, mount vs. update, the `applyObjectStyles` pass, and `updateChildren` reconciliation.

### [20-asset-registry.md](20-asset-registry.md)
`asset-registry.js`: merging active project asset/module/font registries, manifest enrichment, `resolveAsset` semantics, and the optional `updateEntry` maintenance path.

### [30-asset-renderers.md](30-asset-renderers.md)
The renderer registry (`registerRenderer` / `getRenderer`) and each per-type renderer. Includes the glyph-group slot-mounting algorithm and the manifest-driven component contract.

## Key Concepts

| Concept             | Description |
|---------------------|-------------|
| Scene root          | The `#stage` element; sized to `scene.stage.{width,height}`. |
| Object wrapper      | DOM element returned by a renderer; gets `position: absolute` and `data-layer-id`. |
| Renderer registry   | A `Map<string, fn>` populated at module load. Keyed by object `type`. |
| Asset registry      | The merged in-memory map of asset containers + module entries (with manifests). |
| Slot                | An exposed editable sub-surface inside a glyph-group SVG, mounted via `<foreignObject>`. |
| Transform mode      | `fill` (covers parent) or explicit (`x`, `y`, `width`, `height`, `anchor`). |
| Reconciliation      | id-keyed update pass that re-uses existing wrappers across re-renders. |
