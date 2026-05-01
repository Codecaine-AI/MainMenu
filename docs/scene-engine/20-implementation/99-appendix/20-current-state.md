---
covers: Snapshot of currently-shipped scenes and registered assets.
concepts: [snapshot, scenes, assets, inventory]
---

# Current State

Snapshot of what's in the scene-engine right now. Update by re-reading `scenes/` and `assets/registry.json`.

---

## Scenes

| ID    | Name         | Description                                                       |
|-------|--------------|-------------------------------------------------------------------|
| title | Title Screen | CODECAINE chrome logo, fire interleave, PRESS START, CRT, audio.  |

Other pages from the retired `apps/frontend/` (menu, projects, testimonials, links, about, guestbook) are planned migrations but not yet implemented as scenes.

## Assets

Source of truth: `apps/scene-engine/assets/registry.json`.

| ID              | Type        | Path                                          |
|-----------------|-------------|-----------------------------------------------|
| `bg-video`      | media       | `/assets/media/test-fire-2.mp4`               |
| `in-text-fire`  | media       | `/assets/media/test-fire-3.mp4`               |
| `crt-overlay`   | effect      | `/assets/effects/crt-overlay.css`             |
| `codecaine-logo`| glyph-group | `/assets/glyphs/CODECAINE.css-layers.svg`     |
| `press-start`   | component   | `/assets/components/press-start/press-start.js` |
| `start-cue`     | audio       | `/assets/audio/start-cue/start-cue.js`        |

## Title Scene Layer Stack

Outline (read full JSON in `apps/scene-engine/scenes/title/scene.json`):

1. `bg-video` (media, full-stage)
2. `codecaine-logo` (glyph-group, centered, top-third)
   - Sub-layer overrides + interleaved `in-text-fire` (media)
3. `press-start` (component, centered, lower-third)
4. `crt-overlay` (effect, full-stage)
5. `start-cue` (audio)
