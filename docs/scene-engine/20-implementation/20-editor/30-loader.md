---
covers: app/_engine/hooks/useSceneLoader.ts — the React hook that fetches the scene + merged registry, seeds the Zustand store, and preloads component property schemas.
concepts: [loader, hook, scene-fetch, registry-merge, race-guard, component-schema, schema-preload]
---

# Editor Loader

`useSceneLoader(projectId, sceneId)` is the React hook the editor's `page.tsx` calls during mount. It loads the merged registry, fetches the scene for the selected project, and seeds the store. It also exposes `loading` / `error` flags so the shell can render placeholders.

---

## Flow

1. **Load the registry first.** Dynamic-import `asset-registry.js` (browser-only, since it caches in module scope), set `window.MELEE_PROJECT_ID` when a project id is active, and call `loadRegistry({ projectId })`. It fetches the selected project's asset, module, and font registries through project-aware dev routes and enriches each module entry with its `manifest.json`. Then `setRegistry(getRegistry())`.
2. **Fetch the scene.** `GET /api/scenes/<id>?project=<project-id>` with `cache: 'no-store'` so reload always hits disk. Throw on non-OK.
3. **Seed the store.** `setScene(scene)` and `markClean()`.
4. **Errors are surfaced** via the returned `error` string. The editor shell renders the message rather than a blank panel — the same warn-and-explain ethos as the renderer.

## Race Guard

A `loadCount` ref tracks the active load. If `sceneId` changes mid-fetch, the in-flight callback compares `thisLoad === loadCount.current` before writing to the store, so a stale response can't overwrite a fresher one.

## Component Schema Preload

After the scene and registry are loaded, `useSceneLoader` scans the scene for `component`-type layers, resolves each component's module path from the registry, and calls `loadComponentSchema(modulePath)`. This function (in `app/_engine/lib/component-schema-loader.ts`) fetches the component's `.js` file, imports it via a Blob URL shim, reads the module's `properties` export, validates its shape (`{ sections: [...] }`), and caches the result. The resolved schemas are written into the Zustand store's `componentSchemas` map keyed by asset ID.

Schema loading is asynchronous. Until a component's schema arrives, the inspector renders that component's properties under the General fallback section. In practice the loading window is short — the editor already waits for the scene + registry fetch, and component modules are small.

The Blob URL import trick mirrors what the production renderer already does for component modules, so there is no new import mechanism.

## Why Registry First

The add-layer dialog and the inspector both need the registry to render meaningful UI (asset names, manifest fields, asset-selection dropdowns). Loading the registry before the scene means the very first paint can render a populated inspector when the scene also arrives, instead of flashing through an "asset unknown" state.

## Reload Semantics

`useSceneLoader` re-runs whenever `projectId` or `sceneId` changes (the `useCallback` dependency). There is no explicit Reload button in the current UI — refreshing the page or navigating between scenes triggers a fresh load. When the editor has unsaved edits, the command hook guards reload, close, and link navigation before those edits are discarded. The dirty flag is reset by `markClean()` on each successful load.

This is also the handoff path from agent edits: after the agent edits `scene.json`, the human refreshes (or navigates to the scene) to see the change.

## Source

- `apps/scene-engine/app/_engine/hooks/useSceneLoader.ts`
- `apps/scene-engine/app/_engine/lib/component-schema-loader.ts` — `loadComponentSchema`, Blob URL import, cache.
- `apps/scene-engine/app/_engine/renderer/asset-registry.js` — `loadRegistry`, `getRegistry`, `updateEntry`.
- `apps/scene-engine/app/api/scenes/[id]/route.ts` — `GET` reads `Assets/Scenes/<id>/scene.json` through the project path adapter.
