---
covers: asset-registry.js — project-aware manifest fetch, single merged in-memory map, optional cache mutation, why missing IDs warn instead of throwing.
concepts: [asset-registry, merged-cache, resolveAsset, loadRegistry, project-registry]
design_refs: [10-system-design/20-asset-registry.md, 10-system-design/60-asset-uploads.md]
---

# Asset Registry (Implementation)

`apps/scene-engine/app/_engine/renderer/asset-registry.js` loads the active project's asset, module, and font registries, merges them into a single module-level map, and answers ID lookups synchronously after that. It deliberately does not throw on misses — see the rationale in [System Design / Rendering Pipeline / Failure Modes](../../10-system-design/30-rendering-pipeline.md#failure-modes).

---

## Public API

| Export                  | Behavior                                                                                                  |
|-------------------------|-----------------------------------------------------------------------------------------------------------|
| `loadRegistry({ projectId? })` | Async. Resolves registry URLs for an export bundle or a catalog-backed project dev route; fetches asset/module/font registries in parallel, merges into one map, and caches by registry key. Concurrent calls for the same key share one in-flight promise. |
| `resolveAsset(id)`      | Sync. Returns the merged entry for `id`, or `null` (with warning) if `loadRegistry` hasn't completed or the ID is unknown. |
| `getRegistry()`         | Sync. Returns the full merged map, or `null` if not loaded. Used by the editor's add-layer dialog and inspector. |
| `updateEntry(id, partial)` | Sync. Shallow-merges `partial` into the active in-memory entry. Kept for maintenance flows that patch a registry entry during an active session. |

## Merge Semantics

The selected manifest URLs are fetched in parallel. The merge starts with font entries and asset entries, then adds every module entry on top:

- Disjoint IDs (the normal case) end up in one flat map.
- An ID that appears in both manifests is logged as a collision and the **module entry wins**. This is treated as a misconfiguration rather than a feature.

The renderer cannot tell which manifest an entry came from after the merge — that's intentional. Layer dispatch is by `layer.type`, and the entry only needs to expose a `type` and a fetchable file pointer (`file` for assets, `path` for modules).

## State

- `mergedRegistry: Record<string, entry> | null` — the active cached map for the page session.
- `activeRegistryKey: string | null` — identifies whether the active map came from a bundle or project dev route.
- `registryCache: Map<string, registry>` — caches merged registries by key.
- `loadPromises: Map<string, Promise>` — guards against concurrent first-load races per key.

The normal dev path is project-aware: `/api/projects/<project-id>/registries/assets`, `/modules`, and `/fonts`. Export bundles use `/assets/registry.json`, `/modules/registry.json`, and `/fonts/registry.json` resolved through `MELEE_BUNDLE_ROOT`. Outside an export bundle, callers must provide a project id.

## Why Lookups Don't Throw

A scene with one missing container should still render the rest of the scene. Throwing on `resolveAsset` would let one bad ID wipe out the whole stage. Returning `null` lets `scene-renderer.js` `console.warn` and skip that layer.

Programmer errors that *should* be loud — like an unregistered renderer type — do throw, in the asset-renderers index, not here.

## Why an Empty Object on Fetch Failure

`fetchManifest` catches network/parse errors and returns `{}` for that manifest. The merge proceeds with whatever did load. This means a missing `modules/registry.json` doesn't take down asset rendering, and a missing `assets/registry.json` doesn't take down modules. Subsequent lookups warn but don't retry — avoids a thundering herd of failed fetches in a broken dev session.

## Optional Cache Mutation

`updateEntry` is the in-memory side of direct registry-patch maintenance flows. The current inspector asset dropdown changes scene `asset` references, so it does not call `updateEntry`.

If a caller PATCHes `/api/registry/{id}` while the editor is open, it can call `updateEntry(id, { file })` after the server responds to keep the renderer cache aligned without a page reload.

Without that explicit cache update, the next render uses the registry snapshot loaded at scene boot.

## Source

- `apps/scene-engine/app/_engine/renderer/asset-registry.js`
