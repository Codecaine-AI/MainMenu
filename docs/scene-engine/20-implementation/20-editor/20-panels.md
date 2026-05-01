---
covers: The editor's React components — Toolbar, Canvas, Hierarchy, Inspector. Always-present sections, manifest-driven property fields, slot/event editing, project export.
concepts: [toolbar, canvas, hierarchy, inspector, layer-form, manifest-property-field, slots-section, events-section, drag-drop]
design_refs: [10-system-design/40-authoring-surfaces.md]
---

# Editor Panels

The editor lives under `apps/scene-engine/app/editor/` as a Next.js client app. Each panel is a React component that subscribes to the [Zustand store](10-state.md) with selector-narrowed slices. Panels do not call each other directly; they communicate by mutating the store.

---

## Toolbar (`EditorToolbar.tsx`)

Header strip with the scene name, dirty dot, **Export** button, and **Save** button.

- **Save**: `PUT /api/scenes/<id>` with the in-memory scene as the body. On success, `markClean()`. Disabled when `dirty === false`.
- **Export**: `POST /api/export`, reads the response as a blob, parses the `Content-Disposition` filename, and triggers a download via a hidden anchor click. Independent of save — the export reads what's on disk, not the in-memory scene. A local `exporting` flag disables the button while the request is in flight.
- **Dirty indicator**: a small dot whose color toggles on `store.dirty`.

## Canvas (`CanvasPanel.tsx`)

Renders the scene live using the **same renderer** the production page uses (`renderScene` from `src/renderer/scene-renderer.js`). On every store `scene` change, the canvas calls `renderScene(scene, container)`. Because the editor uses the production renderer, "what you see in the canvas" equals "what ships" by construction.

Selection: clicking inside the stage walks up to the nearest element with `dataset.layerId` and calls `setSelectedPath` with the computed path.

Drop target: drops from the asset/module browser construct a minimal scene object (id, type, asset, default transform/appearance) and call `addObjectAt('', scene.objects.length, obj)`.

## Hierarchy (`HierarchyPanel.tsx` + `HierarchyRow.tsx`)

Tree view of `scene.objects`. Renders one row per object, indented by depth, with disclosure triangles for objects that have `children`. Subscribes to `scene` and `selectedPath`.

### Object types and add menu

`OBJECT_TYPES` is the canonical menu of types the user can add: `group`, `video`, `image`, `glyph-group`, `text`, `effect`, `component`, `audio`. The `+` button opens an absolutely-positioned dropdown; selecting a type calls `createDefaultObject(type)`:

- `video`, `effect`, `audio` → `transform: { mode: "fill" }`.
- `group` → `transform: { x: 0, y: 0, width: 100, height: 100, anchor: "top-left" }`.
- Everything else → centered explicit transform (`x: 50, y: 50, width: 30, height: "auto", anchor: "center"`).

Every default carries `appearance: { opacity: 1, blend: "normal", hue: 0 }`, empty `properties`, `events`, `children`, and `visible: true`. The new object is appended at the top level and selected.

### Click → select
Sets `selectedPath` to the clicked row's path.

### Drag-and-drop reorder
Native HTML5 drag-and-drop with `application/x-layer-path` payload. On drag-over, `computeRegion` decides drop zone:

- For non-group rows: top half = `before`, bottom half = `after`.
- For group rows (`children` is an array): top quarter = `before`, bottom quarter = `after`, middle = `into`.

`regionToToPath` translates the region + target path into a destination path. `before` → same path. `after` → increment last index. `into` → append to the target's `children`. The store's `moveObject` handles same-container index adjustment.

A drop indicator (`{ path, region }`) is rendered as a styled border on the targeted row during drag-over.

### Group expansion
Tracked locally in the panel as a `Set<string>` of collapsed paths. Not part of the store — refreshing the editor expands everything.

### `SceneSection`
A small header above the hierarchy that displays scene-level info (id, name) and lets the user select the scene root for editing scene-level appearance.

## Inspector (`InspectorPanel.tsx` + `LayerForm.tsx`)

Property editor for the object at `selectedPath`. The shell `InspectorPanel` is intentionally thin: it resolves the object via `resolveObject(scene, path)` and delegates to `LayerForm` keyed by `selectedPath` (so forms reset cleanly when selection changes).

`LayerForm` renders **always-present** sections plus conditional ones:

| Section      | When                                                                                  |
|--------------|---------------------------------------------------------------------------------------|
| Header       | Always — name, type chip, visibility toggle, delete.                                  |
| Asset        | When `layer.asset` is set. Read-only id; `AssetSwapDropdown` for swappable container types (`audio`, `image`, `video`, `glyph`). |
| Transform    | Always. Fill toggle. Fill mode → rotation + scale. Explicit → x, y, width, height, anchor, rotation, scale. |
| Appearance   | Always — opacity, blend, hue. Adds `fit` for media types (`video`, `image`).          |
| Properties   | When the asset has a manifest with at least one property — one `ManifestPropertyField` per descriptor. |
| Slots        | Glyph-groups only — `SlotsSection` for adding/editing exposed sub-surface fills.      |
| Events       | Always — `EventsSection` lists `events[]` with add/remove and `(trigger, action, target)` selects. |

Each field's onChange dispatches `mutateObjectAt(path, patchFromDottedKey('transform.x', 50))` or similar — the dotted-key helper builds the nested patch object that `deepMerge` then merges into the canonical shape.

### `toggleFill(nextFill)`

Switching transform mode is a single store mutation:

- `fill` → `mode: "fill"` and explicit fields set to `undefined` (so `deepMerge` strips them).
- explicit → `mode: undefined` and seed `x: 0, y: 0, width: "auto", height: "auto", anchor: "top-left"`, preserving any existing rotation/scale.

The "fields set to undefined" trick relies on `deepMerge` treating `undefined` as a key-clear, which is what keeps the saved JSON tidy.

### Inputs (`inputs/`)

| Component               | Renders                                                                  |
|-------------------------|--------------------------------------------------------------------------|
| `RangedInput`           | Slider + numeric input synced, debounced commit.                         |
| `BlendSelect`           | Blend-mode dropdown (canonical CSS blend modes from `inspector-config`). |
| `FitSelect`             | Object-fit dropdown.                                                     |
| `AnchorSelect`          | 9-position anchor selector (3×3 grid of buttons).                        |
| `EventsSection`         | Add / remove / edit `EventBinding` rows.                                 |
| `ManifestPropertyField` | Single property field; reads the manifest descriptor and dispatches to number/string/boolean/enum sub-inputs. |
| `InspectorSection`      | Visual shell — `InspectorHeader`, `InspectorSection`, `FieldRow`, `ReadonlyValue`. |

### `SlotsSection.tsx`

Glyph-group slots editor. Lists each slot with its own asset selector and per-slot appearance fields. Add/remove rewrites `slots[]` wholesale (arrays are replaced, not merged, so the JSON stays clean).

### `AssetSwapDropdown.tsx`

For container-typed assets (audio/image/video/glyph), shows a dropdown of files in `public/assets/<type>/` (fetched from `/api/assets/<type>`). Selecting a file calls `updateContainerFile(id, file)` — a registry-level swap, not a scene mutation.

## Loader (`useSceneLoader.ts`)

Custom hook that fetches the scene + merged registry on mount, calls `setScene` and `setRegistry`, and handles error/loading states. Lives in `src/hooks/useSceneLoader.ts`.

## Source

- `apps/scene-engine/app/editor/page.tsx` — editor shell (4-panel grid, `useSceneLoader`).
- `apps/scene-engine/app/editor/_components/EditorToolbar.tsx`
- `apps/scene-engine/app/editor/_components/CanvasPanel.tsx`
- `apps/scene-engine/app/editor/_components/HierarchyPanel.tsx`
- `apps/scene-engine/app/editor/_components/HierarchyRow.tsx`
- `apps/scene-engine/app/editor/_components/InspectorPanel.tsx`
- `apps/scene-engine/app/editor/_components/LayerForm.tsx`
- `apps/scene-engine/app/editor/_components/SlotsSection.tsx`
- `apps/scene-engine/app/editor/_components/AssetSwapDropdown.tsx`
- `apps/scene-engine/app/editor/_components/inputs/`
