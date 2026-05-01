---
covers: src/hooks/useSceneLoader.ts — the React hook that fetches the scene + merged registry and seeds the Zustand store.
concepts: [loader, hook, scene-fetch, registry-merge, race-guard]
---

# Editor Loader

`useSceneLoader(sceneId)` is the React hook the editor's `page.tsx` calls during mount. It loads the merged registry, fetches the scene, and seeds the store. It also exposes `loading` / `error` flags so the shell can render placeholders.

---

## Flow

1. **Load the registry first.** Dynamic-import `asset-registry.js` (browser-only, since it caches in module scope) and call `loadRegistry()`. It merges `public/assets/registry.json` and `public/modules/registry.json` and enriches each module entry with its `manifest.json`. Then `setRegistry(getRegistry())`.
2. **Fetch the scene.** `GET /api/scenes/<id>` with `cache: 'no-store'` so reload always hits disk. Throw on non-OK.
3. **Seed the store.** `setScene(scene)` and `markClean()`.
4. **Errors are surfaced** via the returned `error` string. The editor shell renders the message rather than a blank panel — the same warn-and-explain ethos as the renderer.

## Race Guard

A `loadCount` ref tracks the active load. If `sceneId` changes mid-fetch, the in-flight callback compares `thisLoad === loadCount.current` before writing to the store, so a stale response can't overwrite a fresher one.

## Why Registry First

The asset browser and the inspector both need the registry to render meaningful UI (asset names, manifest fields, swap dropdowns). Loading the registry before the scene means the very first paint can render a populated inspector when the scene also arrives, instead of flashing through an "asset unknown" state.

## Reload Semantics

`useSceneLoader` re-runs whenever `sceneId` changes (the `useCallback` dependency). There is no explicit Reload button in the current toolbar — refreshing the page or navigating between scenes triggers a fresh load. Any unsaved edits are discarded; the dirty flag is reset by `markClean()` on each successful load.

This is also the handoff path from agent edits: after the agent edits `scene.json`, the human refreshes (or navigates to the scene) to see the change.

## Source

- `apps/scene-engine/src/hooks/useSceneLoader.ts`
- `apps/scene-engine/src/renderer/asset-registry.js` — `loadRegistry`, `getRegistry`, `updateEntry`.
- `apps/scene-engine/app/api/scenes/[id]/route.ts` — `GET` reads `scenes/<id>/scene.json` from disk.
