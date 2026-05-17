---
covers: Snapshot of currently-shipped scenes and registered assets.
concepts: [snapshot, scenes, assets, inventory]
---

# Current State

Snapshot of what's in the scene-engine right now. Update by re-reading `projects/`, `public/assets/registry.json`, and `public/modules/registry.json`.

---

## Projects

| ID         | Name      | Entry | Scenes |
|------------|-----------|-------|--------|
| codecaine  | Codecaine | title | title, menu |

## Scenes

| ID    | Name         | Description                                                       |
|-------|--------------|-------------------------------------------------------------------|
| title | Title Screen | CODECAINE chrome logo, fire interleave, PRESS START, CRT, audio.  |
| menu  | Main Menu    | Minimal navigation target for the title screen's start event.     |

Other pages from the retired `apps/frontend/` (projects, testimonials, links, about, guestbook) are planned migrations but not yet implemented as scenes.

## Assets

Sources of truth: `apps/scene-engine/public/assets/registry.json` and `apps/scene-engine/public/modules/registry.json`.

| ID              | Type        | Path                                          |
|-----------------|-------------|-----------------------------------------------|
| `bg-video`      | video       | `/assets/video/test-fire-2.mp4`               |
| `in-text-fire`  | video       | `/assets/video/test-fire.mp4`                 |
| `codecaine-logo`| glyph       | `/assets/glyph/CODECAINE.css-layers.svg`      |
| `codecaine-rounded-chrome-logo` | glyph | `/assets/glyph/CODECAINE.rounded-chrome.css-layers.svg` |
| `start-cue`     | audio       | `/assets/audio/start-cue/start-cue.js`        |
| `crt-overlay`   | effect      | `/modules/effects/crt-overlay/crt-overlay.css` |
| `press-start`   | component   | `/modules/components/press-start/press-start.js` |
| `orbit-press-start` | component | `/modules/components/orbit-press-start/orbit-press-start.js` |
| `procedural-sphere` | component | `/modules/components/procedural-sphere/procedural-sphere.js` |
| `procedural-cylinder` | component | `/modules/components/procedural-cylinder/procedural-cylinder.js` |
| `procedural-cylinder-strips-mask` | component | `/modules/components/procedural-cylinder-strips/procedural-cylinder-strips-straight.js` |
| `arc-letterbox` | component   | `/modules/components/arc-letterbox/arc-letterbox.js` |

## Title Scene Layer Stack

Outline (read full JSON in `apps/scene-engine/projects/codecaine/scenes/title/scene.json`):

1. `base-barber-cylinder` (component)
2. `procedural-sphere` (component)
3. `procedural-cylinder` (component)
4. `codecaine-rounded-chrome-logo` (glyph-group)
5. `text` (text)
6. `press-start` (component)
7. `smash-style-letterbox` (component)
8. `crt` (effect)
