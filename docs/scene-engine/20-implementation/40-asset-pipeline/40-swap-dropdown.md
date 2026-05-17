---
covers: AssetSwapDropdown.tsx, LayerForm integration, and editor-store.updateContainerFile — how the inspector swaps a container's file and keeps the renderer cache in sync.
concepts: [swap-dropdown, registry-mutation, store-mirror]
design_refs: [10-system-design/60-asset-uploads.md]
---

# Inspector Swap Dropdown

`apps/scene-engine/app/editor/_components/AssetSwapDropdown.tsx` is the client side of the swap flow. When an asset-type layer is selected in the inspector, the dropdown lists every file under `public/assets/{type}/` and lets the user re-point the container at a different one without leaving the scene.

Three pieces cooperate: the dropdown component, the `LayerForm` that mounts it, and the `editor-store` action that mirrors the change in memory.

---

## Component: `AssetSwapDropdown`

| Prop          | Type        | Notes                                                            |
|---------------|-------------|------------------------------------------------------------------|
| `assetId`     | string      | The container ID (registry key).                                 |
| `assetType`   | `AssetType` | One of the four asset types — drives the listing fetch.          |
| `currentFile` | string      | The container's current `file` value. Pre-selected in the menu.  |

### Behavior

- **Mount.** Fetches `/api/assets/{type}` and stores `[{ name, file }]` in local state. Cancels stale fetches on `assetType` change.
- **Render.** Shows a `<select>` of every fetched file. If the current file isn't in the listing (e.g. it was just renamed), it's prepended so the dropdown still reflects truth.
- **Change.** On selection:
  1. PATCH `/api/registry/{assetId}` with `{ file: newFile }`.
  2. On error, surfaces the server's `error` message inline.
  3. On success, calls `useEditorStore.updateContainerFile(assetId, newFile)` to mirror the change.

The component does not manage the network state of the upload page — it assumes the file already exists on disk.

## Mounting: `LayerForm`

`LayerForm` reads the selected layer's `asset` ID, looks the container up in the in-memory registry, and mounts the dropdown only when:

- The container exists.
- Its `type` is one of the four asset types (`isAssetType(...)`) — modules don't get a swap dropdown.
- The entry has a `file` field — narrows from the `AssetContainer | ModuleEntry` union.

This is the only place that distinguishes assets from modules in the inspector. Module-typed containers (effects, components) skip the dropdown silently.

## Cache mirror: `editor-store.updateContainerFile`

`apps/scene-engine/app/_engine/store/editor-store.ts` exposes `updateContainerFile(id, file)` — async because it lazy-imports the renderer's `asset-registry.js`:

```ts
const { updateEntry } = await import('@/renderer/asset-registry')
updateEntry(id, { file })
set({ registry: { ...registry, [id]: { ...registry[id], file } } })
```

Two caches end up updated:

- **Renderer cache** (`mergedRegistry` in `asset-registry.js`) — what the renderer reads on the next layer render.
- **Zustand store** — what the inspector and add-layer dialog read for UI state.

Without both, the next render or the next inspector reload would still see the old pointer.

The lazy `import('@/renderer/asset-registry')` is intentional: the renderer module is browser-only, and dynamic import keeps it out of any SSR boundary the store might be touched from.

## Why a Three-Way Update

The flow looks redundant — server, renderer cache, store cache — but each has a different lifecycle:

| Cache               | Lifetime              | Why it has to be touched                                              |
|---------------------|-----------------------|-----------------------------------------------------------------------|
| `assets/registry.json` | persistent          | Source of truth. Survives reload.                                    |
| `mergedRegistry`    | page session          | Loaded once at scene boot; renderer reads it on every render.         |
| Zustand `registry`  | editor lifecycle      | Drives inspector + add-layer dialog UI; unrelated to render path.     |

Skipping any one of them produces a visible inconsistency: stale on disk, stale on canvas, or stale in the inspector.

## Sources

- `apps/scene-engine/app/editor/_components/AssetSwapDropdown.tsx`
- `apps/scene-engine/app/editor/_components/LayerForm.tsx`
- `apps/scene-engine/app/_engine/store/editor-store.ts`
