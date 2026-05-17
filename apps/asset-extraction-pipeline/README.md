# Asset Extraction Pipeline

This app is being reshaped into a UI-first extraction workspace.

The TypeScript/Next.js surface models extraction as:

- project -> screens
- screen -> decomposition tree
- split -> target node + residual node
- final node -> isolated asset candidate

The legacy Python CLI remains in `asset_extraction_pipeline/` for now. The new UI writes durable project data under `workspace/projects/`, which is intentionally gitignored.

## Run the UI

```bash
cd apps/asset-extraction-pipeline
npm install
npm run dev
```

Open the local Next.js URL, create a project, add a screen image, then create text-directed splits from the screen workspace.

Current split execution records the tree, request metadata, and target/residual prompt artifacts. Image model execution is the next integration step.

The UI is pinned to a Next.js version that runs on the current local Node 18.15 runtime. Upgrade Node before moving this app to a patched current Next.js release for any non-local deployment.
