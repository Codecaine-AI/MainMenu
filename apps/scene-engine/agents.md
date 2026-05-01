# Agent Guide: Scene Engine

How to author and edit scenes programmatically from Claude Code or any file-based agent.

## Quick start

The dev server is running at **http://localhost:5173**. You do not need to start it.

### List available scenes

```bash
curl -s http://localhost:5173/api/scenes | jq
```

### Read a scene

```bash
cat apps/scene-engine/scenes/title/scene.json
```

Or fetch from the dev server:
```bash
curl -s http://localhost:5173/scenes/title/scene.json | jq
```

### Edit a scene

Edit `scenes/{id}/scene.json` directly. The editor picks up changes on reload (Reload button or browser refresh).

### Save via API

```bash
curl -X PUT http://localhost:5173/api/scenes/title \
  -H 'Content-Type: application/json' \
  -d @apps/scene-engine/scenes/title/scene.json
```

The PUT endpoint writes the JSON to disk with stable 2-space formatting.

## Scene JSON structure

```json
{
  "id": "scene-id",
  "name": "Human-readable Name",
  "stage": { "width": 1440, "height": 1080 },
  "layers": [ ... ]
}
```

### Layer schema

Every layer has `id`, `type`, and `asset` (registry ID). Optional: `position`, `properties`, `children`.

| type         | what it renders                          | key properties                    |
|--------------|------------------------------------------|-----------------------------------|
| media        | video or image                           | fit, blend, opacity               |
| effect       | CSS overlay (CRT, vortex)                | opacity                           |
| glyph-group  | layered SVG (chrome font glyphs)         | scale, shimmer                    |
| component    | JS component (press-start, menu)         | varies per component              |
| audio        | Web Audio sound                          | volume, loop, autoplay            |

### Position

```json
"position": { "x": "center", "y": "33%" }
```
Values: `"center"`, percentage string (`"75%"`), or pixel number. Omit for full-stage layers (media backgrounds, effects).

### Z-order

Array position in `layers` determines z-order. Index 0 is the back; last element is on top.

### Group children (glyph-group only)

```json
"children": [
  { "id": "sub-id", "layer": "data-layer-attribute", "visible": true, "properties": { "hue": 20 } },
  { "id": "foreign-id", "type": "media", "asset": "registry-id", "properties": { "blend": "screen" } }
]
```

Two kinds of children:
- **Named sub-layer**: references an SVG layer by its `data-layer` attribute. Can override `visible` and `properties`.
- **Foreign asset**: a full layer (`type` + `asset`) interleaved between the group's SVG layers.

## Adding assets

1. Place the file under `assets/{type}/` (e.g. `assets/media/my-video.mp4`)
2. Add an entry to `assets/registry.json`:
   ```json
   "my-video": {
     "type": "media",
     "path": "/assets/media/my-video.mp4"
   }
   ```
3. Reference it in a scene layer with `"asset": "my-video"`

## Creating a new scene

1. Create `scenes/{id}/scene.json` with the scene JSON structure above
2. The dev server auto-discovers it (restart may be needed since discovery runs at config load)
3. The dashboard at http://localhost:5173/ will show the new scene

Scene IDs must be lowercase kebab-case: `^[a-z0-9]+(?:-[a-z0-9]+)*$`

## Current scenes

| id    | name         | description                                                    |
|-------|--------------|----------------------------------------------------------------|
| title | Title Screen | CODECAINE chrome logo, fire interleave, PRESS START, CRT, audio |

## Current assets (registry.json)

| id              | type        | path                                          |
|-----------------|-------------|-----------------------------------------------|
| bg-video        | media       | /assets/media/test-fire-2.mp4                 |
| in-text-fire    | media       | /assets/media/test-fire-3.mp4                 |
| crt-overlay     | effect      | /assets/effects/crt-overlay.css               |
| codecaine-logo  | glyph-group | /assets/glyphs/CODECAINE.css-layers.svg       |
| press-start     | component   | /assets/components/press-start/press-start.js |
| start-cue       | audio       | /assets/audio/start-cue/start-cue.js          |

## Verifying changes

After editing a scene.json, confirm it renders:

```bash
# Check the JSON is valid
cat apps/scene-engine/scenes/title/scene.json | jq . > /dev/null && echo "valid"

# Check the dev server serves it
curl -s -o /dev/null -w "%{http_code}" http://localhost:5173/scenes/title/scene.json
# expect: 200
```

The visual result must be verified in the browser at http://localhost:5173/scenes/title/ (production view) or http://localhost:5173/editor/?scene=title (editor view).
