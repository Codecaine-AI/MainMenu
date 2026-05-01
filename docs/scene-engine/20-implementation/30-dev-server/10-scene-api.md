---
covers: sceneApiPlugin in vite.config.js — the GET /api/scenes and PUT /api/scenes/:id middleware.
concepts: [scene-api, vite-plugin, middleware, validation, scene-save]
design_refs: [10-system-design/40-authoring-surfaces.md]
---

# Scene API Plugin

`sceneApiPlugin()` in `apps/scene-engine/vite.config.js` registers two middleware handlers on the dev server. Both are dev-only — they do not exist in production builds.

---

## `GET /api/scenes`

Lists all discovered scenes.

| Aspect          | Behavior                                                                  |
|-----------------|---------------------------------------------------------------------------|
| Method allowed  | `GET` only. Other methods return `405` with `Allow: GET`.                 |
| Trigger paths   | Empty path (`""`), `/`, or `?...` after the `/api/scenes` mount.          |
| Response body   | JSON array of `{ id, name, layerCount }`. Falls back to id-as-name and `0` layers if the scene's `scene.json` fails to parse. |

The handler reads each `scene.json` synchronously inside the request to get the up-to-date `name` and `layers.length`, so the dashboard always reflects the current files (no caching).

## `PUT /api/scenes/:id`

Writes a scene to disk.

### Validation

1. **HTTP method**: must be `PUT`. Otherwise `405` + `Allow: PUT`.
2. **Scene ID**: must match `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Otherwise `400 invalid scene id`.
3. **Body parse**: JSON only. Body parse errors → `400 invalid json body`.
4. **Body shape**: must be a non-array object. Otherwise `400 body must be a json object`.
5. **Body size limit**: 4 MB. Exceeding → request destroyed, `400`.

### Write

If validation passes:

1. `mkdir -p scenes/<id>/`.
2. `writeFile scenes/<id>/scene.json` with `JSON.stringify(body, null, 2) + '\n'`.
3. Respond `204 No Content`.

The 2-space-pretty-with-trailing-newline format is deliberate: it produces stable diffs whether the writer is the editor or the agent or hand-edited.

### Errors

`writeFile` failures respond `500 write failed: <message>`. The handler does not retry.

## Why a Vite Plugin (Not a Separate Server)

- During development, Vite is already serving everything else (HTML, JS, CSS, static assets). Splitting the API onto a separate port would require CORS handling and a second server to run.
- Production has no server runtime — the build outputs static files. Dev-only middleware is the right shape because save is only a dev-time concern in the current architecture.

## Source

- `apps/scene-engine/vite.config.js` — `sceneApiPlugin`, `readJsonBody`.
