---
covers: asset-registry.js — dual-manifest fetch, single merged in-memory map, swap-by-id mutation, why missing IDs warn instead of throwing.
concepts: [asset-registry, merged-cache, resolveAsset, loadRegistry, updateEntry]
design_refs: [10-system-design/20-asset-registry.md, 10-system-design/60-asset-uploads.md]
---

# Asset Registry (Implementation)

`apps/scene-engine/app/_engine/renderer/asset-registry.js` loads both `/assets/registry.json` and `/modules/registry.json` once, merges them into a single module-level map, and answers ID lookups synchronously after that. It deliberately does not throw on misses — see the rationale in [System Design / Rendering Pipeline / Failure Modes](../../10-system-design/30-rendering-pipeline.md#failure-modes).

---

## Public API

| Export                  | Behavior                                                                                                  |
|-------------------------|-----------------------------------------------------------------------------------------------------------|
| `loadRegistry()`        | Async. Fetches `/assets/registry.json` and `/modules/registry.json` in parallel, merges into one map, caches it module-wide. Idempotent — second call returns the cached map. Concurrent calls share one in-flight promise. |
| `resolveAsset(id)`      | Sync. Returns the merged entry for `id`, or `null` (with warning) if `loadRegistry` hasn't completed or the ID is unknown. |
| `getRegistry()`         | Sync. Returns the full merged map, or `null` if not loaded. Used by the editor's add-layer dialog and inspector. |
| `updateEntry(id, partial)` | Sync. Shallow-merges `partial` into the entry for `id` in the in-memory map. Returns the new entry, or `null` if `id` doesn't exist. Used by the inspector swap dropdown to mirror server-side registry edits without reloading. |

## Merge Semantics

Both manifests are fetched in parallel. The merge starts with the asset map and adds every module entry on top:

- Disjoint IDs (the normal case) end up in one flat map.
- An ID that appears in both manifests is logged as a collision and the **module entry wins**. This is treated as a misconfiguration rather than a feature.

The renderer cannot tell which manifest an entry came from after the merge — that's intentional. Layer dispatch is by `layer.type`, and the entry only needs to expose a `type` and a fetchable file pointer (`file` for assets, `path` for modules).

## State

- `mergedRegistry: Record<string, entry> | null` — the single cached map for the page session.
- `loadPromise: Promise | null` — guards against concurrent first-load races.

There is no per-URL cache; the two manifest URLs are hardcoded and merged eagerly.

## Why Lookups Don't Throw

A scene with one missing container should still render the rest of the scene. Throwing on `resolveAsset` would let one bad ID wipe out the whole stage. Returning `null` lets `scene-renderer.js` `console.warn` and skip that layer.

Programmer errors that *should* be loud — like an unregistered renderer type — do throw, in the asset-renderers index, not here.

## Why an Empty Object on Fetch Failure

`fetchManifest` catches network/parse errors and returns `{}` for that manifest. The merge proceeds with whatever did load. This means a missing `modules/registry.json` doesn't take down asset rendering, and a missing `assets/registry.json` doesn't take down modules. Subsequent lookups warn but don't retry — avoids a thundering herd of failed fetches in a broken dev session.

## Swap Mutation

`updateEntry` is the in-memory side of the inspector swap flow. The flow is:

1. Inspector PATCHes `/api/registry/{id}` with the new `file`. Server rewrites `assets/registry.json`.
2. On 2xx, the inspector calls `updateEntry(id, { file })` to mirror the change in the renderer's cache.
3. The Zustand store mirrors the same change for editor UI state.

Without step 2, the next render would still draw the old file because the cache was loaded at startup.

## Source

- `apps/scene-engine/app/_engine/renderer/asset-registry.js`
