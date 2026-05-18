# Asset Extraction Pipeline

This app is being reshaped into a UI-first extraction workspace.

The TypeScript/Next.js surface models extraction as:

- project -> screens
- screen -> decomposition tree
- split -> target node + residual node
- final node -> isolated asset candidate

The legacy Python CLI remains in `asset_extraction_pipeline/` for now. The new UI writes durable project data under `../../runs/asset-extraction-workspace/projects/` by default, outside the watched Next.js app tree. Set `ASSET_PIPELINE_WORKSPACE_DIR` to override that location.

## Run the UI

```bash
cd apps/asset-extraction-pipeline
npm install
npm run dev
```

Open the local Next.js URL, create a project, add a screen image, then create text-directed splits from the screen workspace.

Current split execution drafts target/residual prompts with the prompt model, lets the user review or edit them, then sends those exact prompts to both image edits in parallel after confirmation. Prompt drafting requires `ANTHROPIC_API_KEY` and uses `ASSET_PIPELINE_PROMPT_MODEL` or `claude-opus-4-7`. Confirmed split image edits use `ASSET_PIPELINE_IMAGE_MODEL` or `gpt-image-2`, with `ASSET_PIPELINE_IMAGE_SIZE=auto` and `ASSET_PIPELINE_IMAGE_QUALITY=high` by default. Set `ASSET_PIPELINE_IMAGE_MODE=placeholder` to skip image calls and create copied placeholder images.

The UI is pinned to a Next.js version that runs on the current local Node 18.15 runtime. Upgrade Node before moving this app to a patched current Next.js release for any non-local deployment.
