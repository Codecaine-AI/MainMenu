# Asset Creation Loop

Pi coding-agent loop that reconstructs one MELEE asset as standalone `component.html` + `component.css`.
The agent writes the files, renders them via headless Chromium, inspects the render against the
extracted reference, edits, re-renders, and keeps iterating until it calls `accept` or hits the
safety cap.

This code now lives inside the scene-engine repo as native support for the Asset Creation System
helper page at `apps/scene-engine/app/projects/[projectId]/helpers/asset-creation/`.

## Install

```
cd apps/scene-engine/tools/asset-creation-loop
bun install
```

The postinstall hook runs `playwright install chromium`.

## Run

```
cd apps/scene-engine/tools/asset-creation-loop
bun run asset-loop --asset ../../../../runs/test-1/assets/asset_03
```

- `--asset` — path to an asset directory, or a bare id (`asset_03`) combined with `--run`.
- `--run` — required when `--asset` is a bare id. Path to the run dir (e.g. `runs/test-1`).

The extension validates that the asset dir contains `asset.json` and `extraction/image_extraction/extracted.png` (falls back to `extracted.png` at the asset-dir root for legacy runs).

## What it writes

In the asset dir, overwritten each turn:

- `component.html`
- `component.css`
- `render.png`

And, once, when the agent calls the `accept` tool:

- `accepted.json` — `{ asset_id, iterations, score, notes, accepted_at }`

No iteration snapshots, no diff image, no run-logger events.

## Tools the extension adds

- `render` — rebuilds the wrapper, screenshots `#asset-root`, writes `render.png`, returns the reference and the new render inline so the agent sees both next turn.
- `accept` — writes `accepted.json` and shuts pi down.

Built-in `read`, `write`, `edit`, `bash`, `grep`, `ls` remain available.
