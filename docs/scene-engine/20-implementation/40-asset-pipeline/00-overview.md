---
covers: The server + client surfaces that move asset files into the system and point scenes at project-local containers.
type: overview
concepts: [upload, asset-selection, validation, registry-mutation]
design_refs: [10-system-design/60-asset-uploads.md]
---

# Asset Pipeline (Implementation)

The Next.js routes and shared validation library that implement the upload and asset-selection surfaces described in [System Design / Asset Uploads](../../10-system-design/60-asset-uploads.md).

This section covers everything between "user picks a file" and "scene renders the new bytes." The inspector dropdown UI itself is documented under [editor / panels](../20-editor/20-panels.md).

---

## File Tree

```
apps/scene-engine/
├── app/_engine/lib/asset-types.ts            Validation + slug shared between client and server
├── app/_engine/lib/asset-library.ts          Project-local library listing + usage counts
├── app/_engine/lib/export-reachability.ts    Active export graph collector
├── app/upload/page.tsx                       /upload — standalone upload form
├── app/api/upload/route.ts                   POST — write file + register container
├── app/api/assets/[type]/route.ts            GET  — list files in a project type folder
├── app/api/asset-library/route.ts            GET  — list project-available containers + usage
├── app/api/projects/[projectId]/...          GET  — project-local assets/modules/fonts/registries
└── app/api/registry/[id]/route.ts            PATCH — update a container's file pointer
```

## Contents

### [10-asset-types.md](10-asset-types.md)
The shared `asset-types` library — type list, mime/extension allowlists, mime → type inference, filename slugification, and the `validateUpload` gate used by both the client and the upload route.

### [20-api-routes.md](20-api-routes.md)
The asset API routes — upload, project file listing, asset-library listing, and registry patch — including request/response shapes, validation behavior, and how they interact with the selected project's registries on disk.

### [30-upload-page.md](30-upload-page.md)
The `/upload` page — file picker, mime-driven type pre-fill, submit flow, success/error rendering.

### [40-swap-dropdown.md](40-swap-dropdown.md)
`AssetSwapDropdown.tsx`, its mounting in `LayerForm` and `SlotsSection`, and the store actions that point a layer or slot at another container.

## Key Concepts

| Concept              | Description |
|----------------------|-------------|
| Container slug       | The container ID, derived from the slugified filename at upload time. Stable across re-uploads. |
| Type allowlist       | Per-type list of allowed extensions and mimes. Same constants on client (UI hints) and server (gate). |
| Registry write       | `POST /api/upload` writes `ProjectSettings/registries/assets.json`; `PATCH /api/registry/[id]` can still mutate a container file pointer for maintenance flows. |
| Type folder          | Media files live under `Assets/Media/{type}/`; fonts live under `Assets/Fonts/`; registry `file` fields stay in logical `/assets/...` or `/fonts/...` form. |
| Active export graph  | `export-reachability.ts` prunes exported registries to scene-reachable assets/modules/fonts plus declared dependencies. |
