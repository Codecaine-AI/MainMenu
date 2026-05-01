---
covers: The server + client surfaces that move asset files into the system and swap container file pointers.
type: overview
concepts: [upload, swap, validation, registry-mutation]
design_refs: [10-system-design/60-asset-uploads.md]
---

# Asset Pipeline (Implementation)

The Next.js routes and shared validation library that implement the upload/swap surfaces described in [System Design / Asset Uploads](../../10-system-design/60-asset-uploads.md).

This section covers everything between "user picks a file" and "scene renders the new bytes." The inspector dropdown UI itself is documented under [editor / panels](../20-editor/20-panels.md).

---

## File Tree

```
apps/scene-engine/
├── src/lib/asset-types.ts                    Validation + slug shared between client and server
├── app/upload/page.tsx                       /upload — standalone upload form
├── app/api/upload/route.ts                   POST — write file + register container
├── app/api/assets/[type]/route.ts            GET  — list files in a type folder (powers swap dropdown)
└── app/api/registry/[id]/route.ts            PATCH — update a container's file pointer
```

## Contents

### [10-asset-types.md](10-asset-types.md)
The shared `asset-types` library — type list, mime/extension allowlists, mime → type inference, filename slugification, and the `validateUpload` gate used by both the client and the upload route.

### [20-api-routes.md](20-api-routes.md)
The three API routes — upload, file listing, registry patch — including request/response shapes, validation behavior, and how they interact with `assets/registry.json` on disk.

### [30-upload-page.md](30-upload-page.md)
The `/upload` page — file picker, mime-driven type pre-fill, submit flow, success/error rendering.

### [40-swap-dropdown.md](40-swap-dropdown.md)
`AssetSwapDropdown.tsx`, its mounting in `LayerForm`, and `editor-store.updateContainerFile` — the client side of the swap flow and the three caches it has to keep aligned.

## Key Concepts

| Concept              | Description |
|----------------------|-------------|
| Container slug       | The container ID, derived from the slugified filename at upload time. Stable across re-uploads. |
| Type allowlist       | Per-type list of allowed extensions and mimes. Same constants on client (UI hints) and server (gate). |
| Registry write       | Both `POST /api/upload` and `PATCH /api/registry/[id]` write `public/assets/registry.json` directly — no DB. |
| Type folder          | `public/assets/{type}/` — the file lives here; the registry's `file` field is the URL form. |
