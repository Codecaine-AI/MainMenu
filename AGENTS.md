# Agent Notes

## Scene Engine Dev Server

Unless the user says otherwise, assume the scene engine dev server is already running at `http://localhost:3000`.

The scene engine is set up for hot reload. For routine edits to scene JSON, public modules, components, CSS, manifests, and other frontend files, verify through the running dev server/browser instead of rebuilding the app.

Do not run `npm run build` just to check ordinary scene engine changes. Run a production build only when the user explicitly asks for it, when preparing a production handoff, or when the specific question is whether the production build compiles.

If the running server appears unavailable, do a light health check first. Start or restart the dev server only when that check fails or the user requests it.

