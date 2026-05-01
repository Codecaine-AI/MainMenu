---
covers: src/store/editor-store.ts — the Zustand store, object paths, mutations, and the deep-merge patching algorithm.
concepts: [zustand-store, mutation, object-path, deep-merge, structured-clone, dirty]
design_refs: [10-system-design/40-authoring-surfaces.md]
---

# Editor State

`apps/scene-engine/src/store/editor-store.ts` holds the editor's reactive state. It uses Zustand for subscription/selection, but the mutation algorithms — pathed navigation, structuredClone, deep-merge — would look the same in any store framework.

There is **one** store per page; selectors are component-local.

---

## Store Shape

```ts
interface EditorStore {
  scene: SceneJson | null
  registry: Registry | null
  selectedPath: string | null
  dirty: boolean

  setScene, setRegistry, setSelectedPath, markDirty, markClean
  mutateScene(patch)
  mutateObjectAt(path, patch)
  addObjectAt(parentPath, index, object)
  removeObjectAt(path) → removed | null
  moveObject(fromPath, toPath)
  updateContainerFile(id, file) → Promise<void>
}
```

| Field          | Set by                               | Read by                                          |
|----------------|--------------------------------------|--------------------------------------------------|
| `scene`        | `setScene` (loader, mutations)       | Canvas, Hierarchy, Inspector                     |
| `registry`     | `setRegistry` (loader)               | Inspector (manifest, container swap), Hierarchy   |
| `selectedPath` | `setSelectedPath` (hierarchy / canvas) | Inspector (which object), highlight overlay      |
| `dirty`        | `markDirty` / `markClean`            | Toolbar (save button enabled, dirty indicator)   |

## Object Paths

A path is a string addressing a node in the scene tree:

| Path                          | Refers to                                       |
|-------------------------------|-------------------------------------------------|
| `"0"`                         | First top-level object                           |
| `"2"`                         | Third top-level object                           |
| `"2.children.1"`              | Second child of the third top-level object       |
| `"0.children.3.children.0"`   | Deeper child path                                |

`""` (empty string) refers to the top-level container — `scene.objects` itself — used as a `parentPath` for `addObjectAt`.

`parsePath` splits on `.children.` and coerces indices to numbers. Splitting on the literal token (not `.`) keeps top-level indices simple numbers and the path readable.

### Navigation Helpers

| Helper                      | Returns                                                        | Used by               |
|-----------------------------|----------------------------------------------------------------|-----------------------|
| `navigateToParentContainer` | `{ container, index }` — array containing the leaf and its index | `mutate`, `remove`, `move` |
| `navigateToContainer`       | The array referenced by `parentPath` (the children array, or `scene.objects` for `""`) | `add` |

Both walk the path one segment at a time, returning sentinel values on a missing object. `opts.create` lazily creates `children: []` on the way down so an object can be dropped into a group that didn't have a children array yet.

## Mutations

Every mutation is **immutable**: it `structuredClone`s the current scene, mutates the clone, and replaces `scene` in the store. The clone-then-replace pattern means components using selectors with default equality see a change and re-render; components using slice selectors only re-render when their slice actually changed.

Every mutation also sets `dirty: true`.

### `mutateObjectAt(path, patch)`

Deep-merges `patch` into the object at `path`. Used by the inspector for property edits.

`deepMerge` is recursive: object-typed branches merge, scalars and arrays replace. Arrays replace wholesale (no element-wise merging) — this matters for `events`, `children`, and `slots`, which are entirely rewritten when the inspector edits them.

The inspector sends patches via `patchFromDottedKey('transform.x', 50)` style helpers, which `deepMerge` reassembles into nested objects.

Setting a deep field to `undefined` is how the inspector clears an entry — e.g. flipping fill mode strips the explicit `x`/`y`/`width`/`height` by patching them to `undefined`.

### `mutateScene(patch)`

Same rules as `mutateObjectAt` but applied to the top-level scene (used for `scene.appearance`, `scene.name`, etc.).

### `addObjectAt(parentPath, index, object)`

Inserts `object` into the children array at `parentPath`, at position `index` (clamped to `[0, length]`). `parentPath = ""` means top-level. Lazily creates `children: []` on the parent if missing.

The Hierarchy panel uses this for the add-object menu (always appends to top-level) and for drag-into-group drops.

### `removeObjectAt(path)`

Removes the object at `path`, returns the removed object (or `null` if not found). Used for delete and as the first half of moves.

### `moveObject(fromPath, toPath)`

Moves an object from `fromPath` to `toPath`. Guards against:

- Empty paths → no-op.
- `fromPath === toPath` → no-op.
- `toPath` is inside `fromPath`'s subtree (would orphan the object) → no-op.

When source and destination containers are the same and the source index is before the destination index, the destination index is decremented by one to account for the removal happening first. This makes drag-reorder within a single parent feel natural.

### `updateContainerFile(id, file)`

Asset-swap: updates the registry entry's `file` pointer (in memory and via `asset-registry.js`'s `updateEntry`). Doesn't mark dirty by itself — the swap is a registry concern, not a scene-data concern; the scene's `asset` id is unchanged.

## What This File Does Not Do

- Network I/O — the loader (`useSceneLoader`) and toolbar handle that.
- DOM rendering — components handle that.
- Validation — patches are trusted; malformed scenes are caught by the renderer's failure modes.
- Undo / redo — not yet implemented.

## Source

- `apps/scene-engine/src/store/editor-store.ts`
- `apps/scene-engine/src/lib/path.ts` — `resolveObject` for read-side path lookups.
- `apps/scene-engine/src/lib/patch.ts` — `patchFromDottedKey` helper.
