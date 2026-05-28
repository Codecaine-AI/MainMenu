---
covers: AssetSwapDropdown.tsx, LayerForm/SlotsSection integration, and editor-store asset selection actions — how the inspector points layers and slots at project-local containers.
concepts: [asset-dropdown, asset-selection, store-mutation]
design_refs: [10-system-design/60-asset-uploads.md]
---

# Inspector Asset Dropdown

`apps/scene-engine/app/editor/_components/AssetSwapDropdown.tsx` is the client side of asset selection. When an asset-type layer or glyph slot is selected in the inspector, the dropdown lists project-available registry containers of the same type and lets the user point that scene reference at another container.

Three pieces cooperate: the dropdown component, the `LayerForm` or `SlotsSection` that mounts it, and the editor-store action that changes the selected scene reference.

---

## Component: `AssetSwapDropdown`

| Prop          | Type        | Notes                                                            |
|---------------|-------------|------------------------------------------------------------------|
| `assetId`     | string      | The container ID (registry key).                                 |
| `assetType`   | `AssetType` | One of the file asset types — drives the listing fetch.          |
| `projectId`   | string      | Optional project filter for the asset-library request.           |
| `onSelect`    | function    | Receives the next asset id selected by the user.                 |

### Behavior

- **Mount.** Fetches `/api/asset-library?type={type}&usage=0&project={projectId}` and stores `AssetLibraryRecord[]` in local state. Cancels stale fetches on `assetType` or `projectId` change.
- **Render.** Shows a `<select>` of matching containers by label. If the current asset id is not in the listing, it is prepended so the dropdown still reflects the saved scene.
- **Change.** On selection:
  1. Calls `onSelect(nextAssetId)`.
  2. `LayerForm` maps that to `setObjectAssetAt(path, nextAssetId)`.
  3. `SlotsSection` maps it to `setSlotAssetAt(path, slotIndex, nextAssetId)`.

The component does not upload files and does not mutate registries. It assumes the container already exists in the selected project registry.

## Mounting: `LayerForm`

`LayerForm` reads the selected layer's `asset` ID, looks the container up in the in-memory registry, and mounts the dropdown only when:

- The container exists.
- Its `type` is one of the file asset types (`isAssetType(...)`) — modules don't get a dropdown.
- The entry has a `file` field — narrows from the `AssetContainer | ModuleEntry` union.

`SlotsSection` uses the same component for glyph-group slots. Module-typed containers (effects, components) skip the dropdown silently.

## Store Mutations

`apps/scene-engine/app/_engine/store/editor-store.ts` exposes two synchronous selection mutations:

```ts
setObjectAssetAt(path, assetId)
setSlotAssetAt(path, slotIndex, assetId)
```

Both clone the scene, update only the selected `asset` field, and mark the store dirty. Save persists the changed scene JSON. The in-memory registry is not changed because the container did not change, only the scene's reference to it.

## Why Selection Updates Scene JSON

Selection and registry maintenance are intentionally separate:

| Surface             | Persistent write       | Effect |
|---------------------|------------------------|--------|
| Asset dropdown      | scene JSON             | This layer/slot points at another container. |
| Upload page         | project asset registry | New bytes and a new container are added. |
| Registry PATCH API  | project asset registry | Existing container's file pointer changes. |

That split keeps a local scene selection from unexpectedly changing every other scene that references the same container.

## Sources

- `apps/scene-engine/app/editor/_components/AssetSwapDropdown.tsx`
- `apps/scene-engine/app/editor/_components/LayerForm.tsx`
- `apps/scene-engine/app/_engine/store/editor-store.ts`
