---
covers: app/upload/page.tsx — the standalone /upload page. File picker, mime-driven type pre-fill, submit flow, success/error rendering.
concepts: [upload-form, mime-prefill, status-state]
design_refs: [10-system-design/60-asset-uploads.md]
---

# Upload Page

`apps/scene-engine/app/upload/page.tsx` is a small client-only page at `/upload`. With `?project=<project-id>`, it writes files and registry entries into the selected project workspace. The editor links to it but does not embed it.

---

## State

| State        | Type                                                | Notes                                       |
|--------------|-----------------------------------------------------|---------------------------------------------|
| `file`       | `File \| null`                                      | The picked file.                            |
| `type`       | `AssetType \| ''`                                   | Pre-filled from mime, user-overridable.     |
| `label`      | `string`                                            | Optional human-readable registry label.     |
| `scope`      | `AssetScope`                                        | `project` when opened from a project, otherwise `global`. |
| `status`     | `'idle' \| 'submitting' \| 'success' \| 'error'`    | Drives button label, message color.         |
| `message`    | `string`                                            | Success summary or server error.            |

## Flow

1. **File selected.** `onFileChange` stores the file and calls `getTypeFromMime(f.type)`. If a unique match exists, `type` is set to that suggestion; the user may override with the dropdown.
2. **Type confirmed.** The dropdown lists `ASSET_TYPES` directly — same source as the server's allowlist.
3. **Submit.** Builds `FormData` with `file`, `type`, `label`, `scope`, and `projectId` when present, then POSTs to `/api/upload`.
4. **Success.** Sets status to `success` and shows `Uploaded {id} as {scope}` with a link back to the asset library.
5. **Failure.** Reads `error` from the JSON body and shows it.

The button is disabled while `submitting`, while `file` is null, and while `type` is empty — all three preconditions for a useful submission.

## Why Standalone

Upload is decoupled from the editor on purpose. A user adding a new asset doesn't need a scene open, and embedding the form in the inspector would conflate "arrange this scene" with "add new bytes to the project." The container model means the inspector only ever needs to *reference* containers, not create them.

## Source

- `apps/scene-engine/app/upload/page.tsx`
