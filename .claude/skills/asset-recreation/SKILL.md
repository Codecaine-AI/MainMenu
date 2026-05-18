---
name: asset-recreation
description: Use when recreating MELEE UI/game assets from screenshots, extracted PNGs, or visual references as editable SVG/CSS artifacts. Trigger for requests to turn an image into SVG, rebuild a menu frame, border, button, glyph-like panel, or scene-engine component, especially when paths need direct rendering and iteration outside the full browser UI.
---

# Asset Recreation

## Purpose

Recreate extracted MELEE assets as maintainable vector/CSS components. Prefer editable SVG geometry plus CSS styling over raster screenshots, and keep path-heavy SVG in its own file so it can be rendered and tuned directly.

## Core Rule

Do not bury complex SVG paths inside JS or HTML when the asset is path-driven.

Create a separate SVG file next to the component or asset output, then have the component load or embed it. This lets the agent render the SVG file directly, inspect the exact geometry, and iterate quickly before checking it inside the full scene/editor.

## Where Files Go

For scene-engine components:

```text
apps/scene-engine/public/modules/components/<component-id>/
├── <component-id>.js
├── <component-id>.css
├── <component-id>.svg              # static/path-heavy geometry
└── manifest.json
```

Use more specific names when helpful, such as `menu-shield-frame.svg`, if the component also renders dynamic text or controls in JS.

For asset-loop runs:

```text
runs/<screen-id>/assets/<asset-id>/
├── extracted.png
├── component.html
├── component.css
├── component.svg                   # static/path-heavy geometry
├── render.png
└── report.json
```

## Workflow

1. Identify what is truly vector geometry.
   Use SVG for borders, notches, panels, silhouettes, masks, and exact curves. Use CSS for glows, fills, shadows, gradients, opacity, transforms, and text styling. Use raster only for texture/noise that would be brittle or expensive to redraw.

2. Create a standalone SVG first.
   Put the path geometry in a separate `.svg` file with a stable `viewBox`. Add minimal fallback `<style>` inside the SVG so it is readable when opened directly. Runtime CSS can override the same classes later.

3. Render the SVG directly.
   Iterate on the `.svg` file before embedding it into the scene. Prefer the bundled renderer script over browser screenshots:

   ```bash
   node .claude/skills/asset-recreation/scripts/render-svg.mjs \
     apps/scene-engine/public/modules/components/<component-id>/<component-id>.svg \
     /tmp/<component-id>-svg.png \
     --width 1440 --height 1080
   ```

   For focused geometry work, render a crop from the SVG output instead of using browser `svgView` URLs:

   ```bash
   node .claude/skills/asset-recreation/scripts/render-svg.mjs \
     apps/scene-engine/public/modules/components/<component-id>/<component-id>.svg \
     /tmp/<component-id>-detail.png \
     --width 1440 --height 1080 \
     --crop 560,60,280,150
   ```

   The script tries CLI renderers in this order: `resvg`, `rsvg-convert`, `inkscape`, then project-local `sharp`. Use headless browser rendering only as a last resort when no CLI renderer is available or when diagnosing a browser-specific SVG behavior. Validate the SVG itself with `xmllint --noout <file>.svg` when available.

4. Tune geometry in the SVG file.
   Edit path coordinates in the `.svg`, not generated JS strings. Re-render the SVG after each meaningful geometry change. Only check the full scene/editor after the standalone SVG is correct.

5. Wire the SVG into the component.
   The JS component may fetch the SVG, import its `<g>`/root content, or inline it from a template. Keep dynamic controls in JS/CSS when needed: labels, colors, selected text, button bounds, or schema-driven properties.

6. Verify in layers.
   First validate SVG syntax and direct render. Then verify component JS/CSS loading. Then verify the full scene/editor render.

## Scene-Engine Notes

- Components under `public/modules/components` can default-export an async render function.
- Keep editor-facing properties in the JS schema, but keep fixed geometry in the SVG file.
- Use the component CSS for class styling so scene properties can map to CSS variables.
- Do not run a production build for routine component/SVG edits; use the running dev server and hot reload.
- Register new components in `apps/scene-engine/public/modules/registry.json` and add `manifest.json` only when the component should appear in the editor add-layer flow.

## Quality Bar

- Match the reference shape first, then polish glow/opacity.
- Make connected geometry actually connected; avoid loose strokes where filled panels or compound paths are needed.
- Prefer named SVG classes like `asset__outer-line`, `asset__inner-line`, `asset__frame-fill`, `asset__rib` over anonymous paths.
- Keep path coordinates understandable enough to hand-edit. If a path becomes hard to reason about, split it into named parts.
- Do not treat the source screenshot as the final asset unless the user explicitly asks for a raster asset.

## Useful Existing Context

- `ASSET_COMPONENT_LOOP.md` documents the broader extracted-asset loop and file contract.
- `apps/pi-asset-loop/` contains the standalone HTML/CSS rendering loop.
- `apps/scene-engine/public/modules/components/` contains scene-engine component examples.
