---
covers: app/_engine/lib/asset-types.ts — the shared type list, allowlists, mime inference, slugifier, and the validation gate used by both the upload UI and the upload API route.
concepts: [asset-type, mime, extension, slug, validate-upload]
design_refs: [10-system-design/60-asset-uploads.md]
---

# Asset Types Library

`apps/scene-engine/app/_engine/lib/asset-types.ts` is the single source of truth for what counts as an asset, what file shapes are allowed for each type, and how a filename becomes a container ID. Importing it from both the client and the server keeps the upload form and the upload route in agreement without duplicating tables.

---

## Public API

| Export                              | Purpose                                                                                   |
|-------------------------------------|-------------------------------------------------------------------------------------------|
| `AssetType` (re-exported type)      | `'audio' \| 'image' \| 'video' \| 'glyph' \| 'font'`. Sourced from `@/types/scene`.       |
| `ASSET_TYPES`                       | The five file asset types as a readonly tuple. Iteration order = UI order in the type select. |
| `ASSET_TYPE_RULES`                  | Per-type `{ extensions, mimes }` allowlist.                                               |
| `isAssetType(value)`                | Type-guard for narrowing untyped strings (URL params, form fields) to `AssetType`.        |
| `getTypeFromMime(mime)`             | Returns the type whose mime allowlist contains the given mime, or `null`.                 |
| `slugifyFilename(filename)`         | Splits into `{ slug, ext }`. Slug is lowercased, non-alphanumerics collapsed to `-`.      |
| `validateUpload({ type, mime, filename })` | The full gate — type valid, extension allowed, mime allowed. Returns discriminated `{ ok }`. |

## Allowlist Tables

```ts
audio: { extensions: ['mp3', 'wav', 'ogg'],          mimes: ['audio/mpeg', 'audio/wav', 'audio/ogg'] }
image: { extensions: ['png','jpg','jpeg','webp','gif'], mimes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] }
video: { extensions: ['mp4', 'webm'],                mimes: ['video/mp4', 'video/webm'] }
glyph: { extensions: ['svg'],                        mimes: ['image/svg+xml'] }
font:  { extensions: ['otf','ttf','woff','woff2'],   mimes: ['font/otf', 'font/ttf', 'font/woff', 'font/woff2', ...] }
```

## Slug Semantics

- The portion before the last `.` is lowercased and any run of non-`[a-z0-9]` characters is replaced with a single `-`.
- Leading/trailing `-` is stripped.
- The extension (after the last `.`) is preserved and lowercased; the slug excludes it.
- An empty slug throws — a file like `.png` or `___` has no usable identity.

Examples:

| Input               | Slug          | Ext   |
|---------------------|---------------|-------|
| `Test Fire 3.mp4`   | `test-fire-3` | `mp4` |
| `crt-overlay.css`   | `crt-overlay` | `css` |
| `My_Logo.SVG`       | `my-logo`     | `svg` |

The throw on empty is what guarantees the upload route never writes a registry entry under an invalid key.

## validateUpload — the Single Gate

The route, the form, and any future programmatic uploader all funnel through `validateUpload`. The checks, in order:

1. `type` is one of the five file asset types.
2. The filename's extension is in the type's `extensions` list.
3. The provided `mime` is in the type's `mimes` list.

Any failure returns `{ ok: false, error }` with a human-readable message; the route surfaces that as a 400.

The order matters: type first means the error message can name the type, extension before mime catches the most common drag-into-wrong-bucket case before falling through to the mime check.

## Why a Single Module

The split between client and server in Next.js makes it tempting to duplicate small constants. The cost of doing that here is silent drift — the form might accept a file the server rejects, or vice versa. One module imported on both sides keeps the gate honest.

## Source

- `apps/scene-engine/app/_engine/lib/asset-types.ts`
