# MELEE

MELEE is an experiment in recreating the Super Smash Bros. Melee main menu in CSS and HTML. The project is being set up as a monorepo so the visual prototype, prompt templates, and extraction pipeline can evolve independently.

## Repository Layout

```text
apps/
  backend/              Python pipeline app for image cataloging and asset extraction
    prompts/            Backend-owned prompt templates
    src/melee_pipeline/
      pipeline/         Catalog, extraction, and run orchestration stages
      model_adapters/   Mirascope text routing and image provider adapters
      io/               Run paths and validation
assets/                 Reference images, videos, and curated source material
prompts/                General design/prototype prompts not owned by the backend
screenshots/            Saved prototype screenshots
index.html              Current hand-built CSS/HTML prototype
SYSTEM_DESIGN.md        System-level architecture
PLAN.md                 Implementation plan and tradeoffs
```

Generated pipeline output is written under `runs/`, which is ignored by git.

## Backend Pipeline

The backend starts with a two-step flow:

1. Catalog the major visual assets in a source image.
2. For each cataloged asset, use a text model through Mirascope to generate an extraction prompt, then extract the assets in parallel with an image model.

The first implementation lives in `apps/backend` and is intended to be run with `uv`.

```bash
cd apps/backend
uv run melee-pipeline --help
```

Dry-run a full pipeline without calling model APIs:

```bash
uv run melee-pipeline run ../../assets/Super-Smash-Bros-Melee07292023-112856-24048_thumb.jpg --run-id first-pass --dry-run
```

Run the model-backed flow:

```bash
export OPENAI_API_KEY=...
export ANTHROPIC_API_KEY=...
uv run melee-pipeline run ../../assets/Super-Smash-Bros-Melee07292023-112856-24048_thumb.jpg --run-id first-pass
```

Text model ids use Mirascope provider prefixes such as `anthropic/claude-opus-4-6`, `openai/gpt-5.4`, or `google/gemini-3-pro`. Image extraction defaults to `gemini-image/gemini-3.1-flash-image-preview`; `openai-image/gpt-image-2` remains available as an alternate image model.

Validate a run folder:

```bash
uv run melee-pipeline validate ../../runs/first-pass
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
      extraction-prompt.txt
      image-request.json
      extracted.png
      extraction-result.json
```

While a run is active, use these files to track progress:

```bash
tail -f runs/first-pass/run.log
tail -f runs/first-pass/events.jsonl
cat runs/first-pass/status.json
```

`run.log` is the readable timeline, `events.jsonl` is structured event data, and
`status.json` is the latest stage/count snapshot for quick inspection.

## Current Status

- `index.html` is the current hand-authored prototype.
- `SYSTEM_DESIGN.md` describes the target system.
- `PLAN.md` captures the current implementation strategy.
- `apps/backend` contains the initial Python pipeline scaffold.

The next useful milestone is a real run against one reference image, then inspecting whether the catalog granularity and extracted assets are good enough for a CSS recreation loop.
