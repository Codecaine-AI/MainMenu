---
covers: The editor's React components — Scene controls, Canvas, Hierarchy, Inspector. Always-present sections, schema-driven property fields with sections and description popovers, slot/event editing, project export.
concepts: [scene-section, canvas, hierarchy, inspector, layer-form, property-section, property-field, description-popover, manifest-property-field, slots-section, events-section, drag-drop]
design_refs: [10-system-design/40-authoring-surfaces.md, 10-system-design/16-property-schema.md]
---

# Editor Panels

The editor lives under `apps/scene-engine/app/editor/` as a Next.js client app. Each panel is a React component that subscribes to the [Zustand store](10-state.md) with selector-narrowed slices. Panels do not call each other directly; they communicate by mutating the store.

---

## Scene Controls (`SceneSection.tsx`)

Scene-level control section above the hierarchy with the scene name, dirty dot, scene appearance fields, **Export** button, and **Save** button.

- **Save**: `PUT /api/scenes/<id>?project=<project-id>` with the in-memory scene as the body. On success, `markClean()`. Disabled when `dirty === false`.
- **Export**: `POST /api/export?project=<project-id>`, reads the response as a blob, parses the `Content-Disposition` filename, and triggers a download via a hidden anchor click. Independent of save — the export reads what's on disk, not the in-memory scene. A local `exporting` flag disables the button while the request is in flight.
- **Dirty indicator**: a small dot whose color toggles on `store.dirty`.

## Canvas (`CanvasPanel.tsx`)

Renders the scene live using the **same renderer** the production page uses (`renderScene` from `app/_engine/renderer/scene-renderer.js`). On every store `scene` change, the canvas calls `renderScene(scene, container)`. Because the editor uses the production renderer, "what you see in the canvas" equals "what ships" by construction.

Selection: clicking inside the stage walks up to the nearest element with `dataset.layerId` and calls `setSelectedPath` with the computed path.

## Hierarchy (`HierarchyPanel.tsx` + `HierarchyRow.tsx`)

Tree view of `scene.objects`. Renders one row per object, indented by depth, with disclosure triangles for objects that have `children`. Subscribes to `scene` and `selectedPath`.

### Object types and add menu

`ADDABLE_OBJECT_TYPES` is the canonical menu of types the user can add: `group`, `text`, `video`, `image`, `glyph`, `effect`, `component`, `audio`. The `+` button opens `AddLayerDialog`; selecting `group` or `text` creates an assetless object, and selecting an asset-backed type lists compatible registry entries before creating the object.

New objects are created through `createGroupObject`, `createTextObject`, or `createObjectFromAsset`, then inserted at the requested top-level or group-child position and selected.

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
| Transform    | Always (skipped for sub-layer overrides). Fill toggle. Fill mode → rotation + scale. Explicit → x, y, width, height, anchor, rotation, scale. |
| Appearance   | Always (skipped for sub-layer overrides) — opacity, blend, hue. Adds `fit` for media types (`video`, `image`). |
| Properties (schema) | For components and built-in layer types — one `PropertySection` per section in the resolved schema. Each section renders `PropertyField` entries with clickable label → `DescriptionPopover`. Orphan properties (saved but not in schema) render under an auto-generated "General" section with inferred inputs + console warning. |
| Properties (effect) | For effects only — one `ManifestPropertyField` per manifest descriptor, under a single "Properties" heading. |
| Slots        | Glyph-groups only — `SlotsSection` for adding/editing exposed sub-surface fills.      |
| Events       | Always — `EventsSection` lists `events[]` with add/remove and `(trigger, action, target)` selects. |

Each field's onChange dispatches `mutateObjectAt(path, patchFromDottedKey('transform.x', 50))` or similar — the dotted-key helper builds the nested patch object that `deepMerge` then merges into the canonical shape.

### Schema Resolution in `LayerForm`

`LayerForm` resolves the property schema for the selected layer:

1. **Built-in schema** — `getBuiltinPropertySchema(layerType)` returns a `PropertySchema` for `video`, `image`, `glyph-group`, or `audio`. Returns `undefined` for other types.
2. **Component schema** — if the layer type is `component`, look up `componentSchemas[assetId]` from the Zustand store (populated by the loader at scene open).
3. **Merge** — `layerSchema = builtinSchema ?? componentSchema`. Built-in wins if both somehow exist.
4. **Orphan detection** — `extractSchemaPropertyKeys(schema)` collects all declared keys; saved keys not in that set are orphans. `buildGeneralSection(orphans)` creates a General section with inferred `PropertyDef` entries. A `console.warn` names each orphan.

When no schema exists (e.g., a component whose module hasn't loaded yet), all properties render under General.

### `toggleFill(nextFill)`

Switching transform mode is a single store mutation:

- `fill` → `mode: "fill"` and explicit fields set to `undefined` (so `deepMerge` strips them).
- explicit → `mode: undefined` and seed `x: 0, y: 0, width: "auto", height: "auto", anchor: "top-left"`, preserving any existing rotation/scale.

The "fields set to undefined" trick relies on `deepMerge` treating `undefined` as a key-clear, which is what keeps the saved JSON tidy.

### Schema-driven Components

| Component               | Renders                                                                  |
|-------------------------|--------------------------------------------------------------------------|
| `PropertySection`       | A schema section: header label (clickable if section has a description), nested `PropertyField` entries, recursive child `PropertySection` entries. Expanded by default. |
| `PropertyField`         | One property row: clickable label + input dispatched by the `PropertyDef.type`. Maps `number` → `RangedInput`, `string` → text input, `boolean` → checkbox, `select` → dropdown, `blend` → `BlendSelect`, `fit` → `FitSelect`, `clip` → `ClipSelect`, `anchor` → `AnchorSelect`. |
| `DescriptionPopover`    | Floating popover anchored next to the clicked label. Shows the property's full label and plain-text description. Dismisses on click-outside or Escape. Used by both property labels and section labels. |

### Inputs (`inputs/`)

| Component               | Renders                                                                  |
|-------------------------|--------------------------------------------------------------------------|
| `RangedInput`           | Slider + numeric input synced, debounced commit.                         |
| `BlendSelect`           | Blend-mode dropdown (canonical CSS blend modes from `inspector-config`). |
| `FitSelect`             | Object-fit dropdown.                                                     |
| `ClipSelect`            | Clip-path dropdown.                                                      |
| `AnchorSelect`          | 9-position anchor selector (3×3 grid of buttons).                        |
| `EventsSection`         | Add / remove / edit `EventBinding` rows.                                 |
| `ManifestPropertyField` | Single property field for effects; reads the manifest descriptor and dispatches to number/string/boolean/enum sub-inputs. |
| `InspectorSection`      | Visual shell — `InspectorHeader`, `InspectorSection`, `FieldRow`, `ReadonlyValue`. |

### `SlotsSection.tsx`

Glyph-group slots editor. Lists each slot with its own asset selector and per-slot appearance fields. Add/remove rewrites `slots[]` wholesale (arrays are replaced, not merged, so the JSON stays clean).

### `AssetSwapDropdown.tsx`

For container-typed assets (audio/image/video/glyph), shows a dropdown of files in `public/assets/<type>/` (fetched from `/api/assets/<type>`). Selecting a file calls `updateContainerFile(id, file)` — a registry-level swap, not a scene mutation.

## Loader (`useSceneLoader.ts`)

Custom hook that fetches the scene + merged registry on mount, calls `setScene` and `setRegistry`, and handles error/loading states. Lives in `app/_engine/hooks/useSceneLoader.ts`.

## Source

- `apps/scene-engine/app/editor/page.tsx` — editor shell (3-panel grid, `useSceneLoader`).
- `apps/scene-engine/app/editor/_components/CanvasPanel.tsx`
- `apps/scene-engine/app/editor/_components/HierarchyPanel.tsx`
- `apps/scene-engine/app/editor/_components/HierarchyRow.tsx`
- `apps/scene-engine/app/editor/_components/SceneSection.tsx`
- `apps/scene-engine/app/editor/_components/AddLayerDialog.tsx`
- `apps/scene-engine/app/editor/_components/InspectorPanel.tsx`
- `apps/scene-engine/app/editor/_components/LayerForm.tsx`
- `apps/scene-engine/app/editor/_components/PropertySection.tsx`
- `apps/scene-engine/app/editor/_components/PropertyField.tsx`
- `apps/scene-engine/app/editor/_components/DescriptionPopover.tsx`
- `apps/scene-engine/app/editor/_components/SlotsSection.tsx`
- `apps/scene-engine/app/editor/_components/AssetSwapDropdown.tsx`
- `apps/scene-engine/app/editor/_components/inputs/`
- `apps/scene-engine/app/_engine/types/property-schema.ts`
- `apps/scene-engine/app/_engine/lib/builtin-property-schemas.ts`
- `apps/scene-engine/app/_engine/lib/component-schema-loader.ts`
