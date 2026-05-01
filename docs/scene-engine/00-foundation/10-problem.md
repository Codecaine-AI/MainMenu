---
covers: The composition friction that makes hand-wired pages the bottleneck once the asset library starts to grow.
concepts: [composition, friction, hand-wired, asset-library]
---

# The Problem

Building visually rich landing pages currently means hand-wiring every visual element directly in page-specific CSS and JavaScript. Each new page or visual variation requires bespoke code rather than composing existing pieces. As the asset library grows — chrome glyphs from the font pipeline, video loops, CSS effects, the upcoming CODECAINE-in-a-background scene — the friction of assembling assets into new compositions, not creating the assets themselves, is the bottleneck.

---

## What Hand-Wiring Looks Like

Pages share a fixed scaffold (vortex + CRT overlay + audio) injected by a common bootstrapper, but the visual content of each page is per-page CSS/JS. Adding a new visual variant means writing new bespoke page code: importing the right asset, positioning it, layering it under or over the existing scaffold, wiring its animations.

There is no shared notion of "an asset placed at z-index N with these properties." There is only "a page with this hand-coded markup."

## Why It Doesn't Scale

The library of producible visual material is growing faster than the library of pages.

- The font pipeline emits **layered SVG glyphs** (~30 sub-layers each) such as `CODECAINE.css-layers.svg`.
- Media inputs include **video loops** (`test-fire-2.mp4`, `test-fire-3.mp4`).
- Reusable **CSS effects** (vortex, CRT overlay, chromatic aberration) drift across page-specific stylesheets.
- The asset-extraction pipeline produces additional reconstructed Melee assets.

Every new combination of these into a stage requires writing rendering wiring from scratch, even though the rendering logic for "show this video full-stage," "show this CSS effect on top," "place this glyph centered top-third" repeats every time.

## The Authoring Bottleneck

The user's iterative work is on **composition** — figuring out layer order, blend modes, normal mappings, where to interleave a video texture between two glyph sub-layers — not on rendering plumbing. The hand-wired model keeps reintroducing rendering plumbing as a tax on every composition decision.

## What's Already Working

The font-creation editor (`apps/font-creation/app/melee-3/`) proved a workable pattern at the glyph level: a `layer-recipe.json` is edited both by UI panels and by a backend regeneration API, and the rendered output reflects either source of edits. The scene-engine generalizes that proven pattern from one glyph to one full page.
