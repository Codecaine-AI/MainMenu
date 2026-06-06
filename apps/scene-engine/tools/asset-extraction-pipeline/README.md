# Asset Extraction Pipeline

This package is the Python extraction CLI used by the scene-engine asset extraction helper.

The TypeScript/Next.js surface models extraction as:

- project -> screens
- screen -> decomposition tree
- split -> target node + residual node
- final node -> isolated asset candidate

The UI lives in `apps/scene-engine/app/projects/[projectId]/helpers/asset-extraction/`.
Helper workspace data is stored inside each scene project under `ProjectSettings/helpers/asset-extraction/`
for external projects, or `.helpers/asset-extraction/` for legacy embedded projects.

## Run the UI

```bash
cd apps/scene-engine
npm install
npm run dev
```

Open a project, choose Helpers, then open Asset Extraction. Add a screen image, then create
text-directed splits from the screen workspace.

Current split execution drafts target/residual prompts with the prompt model, lets the user review or edit them, then sends those exact prompts to both image edits in parallel after confirmation. Prompt drafting requires `ANTHROPIC_API_KEY` and uses `ASSET_PIPELINE_PROMPT_MODEL` or `claude-opus-4-7`. Confirmed split image edits use `ASSET_PIPELINE_IMAGE_MODEL` or `gpt-image-2`, with `ASSET_PIPELINE_IMAGE_SIZE=auto` and `ASSET_PIPELINE_IMAGE_QUALITY=high` by default. Set `ASSET_PIPELINE_IMAGE_MODE=placeholder` to skip image calls and create copied placeholder images.

The Python CLI remains available from this directory through `uv run extract-assets`.
