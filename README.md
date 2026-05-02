# MELEE — Main Menu

An editor and composition engine for building websites that feel like video game menus.

Game menus have a specific aesthetic: one fixed viewport, no scrolling, layered composition, interactive navigation through selections and transitions, cinematic polish. There's no tool that targets this for the web — Figma is for documents and layouts, Unity is for games. Main Menu sits in the gap: compose assets into fixed-viewport screens, edit them visually or programmatically, build the result as a deployable web page.

The project started as an attempt to recreate the Super Smash Bros. Melee home screen in CSS and HTML. The iteration needs kept growing — adjusting layers, colors, blend modes, animations — and it became clear the bottleneck wasn't making assets, it was composing them. The monorepo structure lets the visual editor, prompt templates, extraction pipeline, and asset-recreation agent evolve independently.

## Repository Layout

```text
apps/
  asset-extraction-pipeline/       Python pipeline: catalog a screen and extract each asset as PNG
    asset_extraction_pipeline/
      steps/                       catalog.py, extract.py
      prompts/                     asset_catalog.py, asset_extraction_prompt_generation.py
      model_adapters/              Mirascope text routing + Gemini/OpenAI image adapters
      io/                          Run paths, logging, JSON utils, validation
      cli.py, run.py, schemas.py, common.py, __init__.py
    tests/
  pi-asset-loop/                   Pi coding-agent extension that reconstructs one asset as HTML/CSS
    extensions/asset-loop.ts
    src/{args,renderer,wrapper,systemPrompt,pngSize}.ts
assets/                            Reference images, videos, and curated source material
prompts/                           General design/prototype prompts not owned by the apps
screenshots/                       Saved prototype screenshots
index.html                         Current hand-built CSS/HTML prototype
SYSTEM_DESIGN.md                   System-level architecture
PLAN.md                            Implementation plan and tradeoffs
```

Generated pipeline output is written under `runs/`, which is ignored by git.

## Asset Extraction Pipeline

Two steps, run with `uv`:

1. Catalog the major visual assets in a source image.
2. For each cataloged asset, use a text model (through Mirascope) to generate an extraction prompt, then extract the assets in parallel with an image model.

```bash
cd apps/asset-extraction-pipeline
uv run extract-assets --help
```

Dry-run a full pipeline without calling model APIs:

```bash
uv run extract-assets run ../../assets/Super-Smash-Bros-Melee07292023-112856-24048_thumb.jpg --run-id first-pass --dry-run
```

Run the model-backed flow:

```bash
export OPENAI_API_KEY=...
export ANTHROPIC_API_KEY=...
uv run extract-assets run ../../assets/Super-Smash-Bros-Melee07292023-112856-24048_thumb.jpg --run-id first-pass
```

Text model ids use Mirascope provider prefixes such as `anthropic/claude-opus-4-6`, `openai/gpt-5.4`, or `google/gemini-3-pro`. Image extraction defaults to `gemini-image/gemini-3.1-flash-image-preview`; `openai-image/gpt-image-2` remains available as an alternate image model.

Validate a run folder:

```bash
uv run extract-assets validate ../../runs/first-pass
```

The pipeline writes artifacts like:

```text
runs/first-pass/
  run.json
  source.png
  run.log
  events.jsonl
  status.json
  catalog.json
  catalog-request.json
  assets/
    asset_01/
      asset.json
      extraction/
        prompt_generation/
          request.json
          prompt.txt
        image_extraction/
          request.json
          extracted.png
```

While a run is active, use these files to track progress:

```bash
tail -f runs/first-pass/run.log
tail -f runs/first-pass/events.jsonl
cat runs/first-pass/status.json
```

`run.log` is the readable timeline, `events.jsonl` is structured event data, and `status.json` is the latest stage/count snapshot for quick inspection.

## Pi Asset Loop

Once an asset is extracted, `apps/pi-asset-loop/` is a Pi coding-agent extension that reconstructs it as standalone `component.html` + `component.css`. The agent writes the files, calls a `render` tool to screenshot the HTML, compares against the extracted reference, edits, and re-renders until it calls `accept` or hits a 10-iteration cap.

```bash
cd apps/pi-asset-loop
bun install
pi -e extensions/asset-loop.ts --asset ../../runs/first-pass/assets/asset_01
```

See `apps/pi-asset-loop/README.md` for the full flow.

## Current Status

- `index.html` is the current hand-authored prototype.
- `SYSTEM_DESIGN.md` describes the target system.
- `PLAN.md` captures the current implementation strategy.
- `apps/asset-extraction-pipeline` handles cataloging + extraction.
- `apps/pi-asset-loop` handles per-asset HTML/CSS reconstruction.

The next useful milestone is a real run against one reference image, then driving the pi asset loop against each extracted asset to see how close it lands.
