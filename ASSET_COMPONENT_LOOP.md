# Asset Component Loop

This document drafts the CSS/SVG portion of the pipeline that begins after an asset has already been extracted to `extracted.png`.

## Decision

Build this as a fixed loop first, then optionally wrap it in a skill.

Why:

- The loop needs durable files, not chat-state.
- Rendering, screenshots, diffing, and retry counts are mechanical pipeline work.
- A skill is useful later as an operator guide, but it should sit on top of a real loop rather than define the loop itself.

## Loop Shape

Per asset:

1. Generate or revise `component.html` and `component.css`.
2. Render them in a fixed viewport sized to the asset.
3. Save `render.png`.
4. Compare `render.png` to `extracted.png`.
5. Save `diff.png` and `report.json`.
6. Feed `report.json` into the next iteration.
7. Stop only when the asset clears its threshold or hits an iteration cap.

This is intentionally strict. The review phase should behave like a picky art-direction pass, not a friendly summary.

## Recommended Implementation Policy

- Background layers that are actually animated source plates should ship as video-backed assets.
- Frames, panels, and projected menu surfaces should default to CSS + inline SVG hybrid implementations.
- Use CSS for borders, gradients, glows, shadows, transforms, layout, and text.
- Use inline SVG for exact curves, notches, rim shapes, and silhouettes that are awkward in CSS alone.
- Use raster only for small texture/noise details that would be expensive or brittle to reproduce procedurally.

## Why Hybrid

Some MELEE assets appear to have been rendered from 3D or at least from projected flat geometry. For those, the right abstraction is usually:

1. Build the face in SVG and CSS.
2. Add bevel, glow, and shadow as layered SVG/CSS effects.
3. Tilt the whole asset with CSS 3D transforms if the asset behaves like a projected plane.

That keeps the asset editable while still matching the rendered look.

## Asset Directory Contract

Within `runs/<screen-id>/assets/<asset-id>/`:

```text
asset.json
extracted.png
component-prompt.md
component-request.json
component.html
component.css
render.png
diff.png
report.json
```

Optional extras:

```text
notes.md
textures/
```

## Suggested Roles Inside The Loop

- Generator: writes or edits `component.html` and `component.css`
- Renderer: produces `render.png`
- Critic: produces `report.json`
- Orchestrator: decides whether to iterate again

These can all be scripts plus model calls. They do not need to be separate agent products.

## Background Exception

Do not force the animated background through this same asset loop if the final shipped artifact should be video.

For those assets:

- keep a still representative frame for extraction and comparison
- ship the accepted background as `video/mp4` or similar
- judge the background loop on composition fit, color, timing, and compression quality rather than pure CSS fidelity

## Skill Boundary

If a skill is added later, it should do things like:

- "start an asset loop"
- "rerun critique for asset_03"
- "promote accepted component"

It should not be the only place where the loop definition, file contracts, or acceptance logic live.
