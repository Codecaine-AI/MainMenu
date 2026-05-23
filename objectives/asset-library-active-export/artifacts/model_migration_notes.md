# Asset Library Model Notes

- `public/assets/registry.json` is treated as the reusable asset library. Existing ids remain valid library asset ids.
- Scene objects and slots keep their stable object ids and store the selected library asset id in their local `asset` field.
- Editor asset selection now changes the scene object or slot `asset` value in Zustand state and marks the scene dirty. It does not PATCH `/api/registry/[id]` or mutate a library file path.
- Uploads create asset-library records with optional `label`, `scope`, `projectIds`, and timestamps. Existing records without those fields are loaded with derived labels and global availability.
- Project gating is intentionally simple: records are global unless `scope` is `project` and `projectIds` contains the current project id.
- Legacy scenes that already use `asset: "<registry-id>"` continue to render because selected asset ids are still resolved through the merged runtime registry.
- Module manifests may declare `dependencies.modules`, `dependencies.assets`, `dependencies.publicFiles`, and `dependencies.fonts`. String properties can declare `assetType` so export traversal treats their values as asset refs.
- `main-menu-system` declares its secondary modules and CSS/SVG/config dependencies. Its sound properties declare `assetType: "audio"`.
