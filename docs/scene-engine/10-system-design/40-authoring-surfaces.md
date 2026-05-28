---
covers: The authoring contract — visual editor, desktop shell, and Pi Agent editing the same project scene files. Always-present inspector sections. Schema-driven property fields with collapsible sections and description popovers.
concepts: [authoring, editor, desktop-shell, pi-agent, dirty-tracking, save, inspector-sections, collapsible-sections, schema-driven, property-schema]
---

# Authoring Surfaces

Scenes are authored through three cooperating surfaces:

- **Visual editor** — browser UI for human layout, selection, inspection, and save.
- **Main Menu desktop shell** — native wrapper that opens the same editor and owns local process authority.
- **Pi Agent** — desktop chat agent that receives current project, scene, and selected-layer context, then works against the local workspace.

None of these surfaces is the source of truth. Project files are. The contract between them is simple: edit `Assets/Scenes/<scene-id>/scene.json` and project-local registries, then the other surfaces pick up the change on their next load.

---

## Visual Editor

Three-panel layout in the browser, whether opened from the Next dev server or inside Main Menu:

| Panel | Role |
| --- | --- |
| Hierarchy | Object tree, drag-and-drop reorder, drag-into-group, add-layer dialog, scene save controls, and the desktop Pi Agent panel below the tree. |
| Canvas | Live preview of the scene rendered by the same code path as production. |
| Inspector | Collapsed scene globals at the top, then the property editor for the selected object. Always renders Transform and Appearance; conditionally renders Properties, Events, Slots, Text, and Asset selection. |

State is held in a Zustand store with three core pieces:

- `scene` — the current scene tree, structurally cloned on mutation.
- `registry` — merged asset, module, and font registry.
- `selectedPath` — a dotted path identifying the selected object (`2.children.1`).

Mutations (`mutateObjectAt`, `addObjectAt`, `removeObjectAt`, `moveObject`) replace the scene with a structurally cloned, modified copy and mark the store dirty. Components subscribe with selectors and re-render only on the slices they care about.

### Always-Present Inspector Sections

Every selected object shows the same shell, regardless of type:

1. **Header** — name, type chip, visibility toggle, delete button.
2. **Asset** — read-only asset id for modules, with an asset-selection dropdown when the asset is a file container (`audio`, `image`, `video`, `glyph`, `font`). Modules (`effect`, `component`) are not swappable.
3. **Transform** — fill toggle. When fill: rotation + scale. When explicit: x, y, width (% or auto), height (% or auto), anchor select, rotation, scale.
4. **Appearance** — opacity, blend, hue. For media types (`video`, `image`): also fit. For scene-level selection: also saturation.
5. **Properties** — rendered by the [property schema](16-property-schema.md). Properties are grouped into named sections with clickable labels that open description popovers. Dense groups can be nested and collapsed where that matches the owning concept.
6. **Slots** — glyph-groups only. Lists the SVG's exposed slots; each slot has its own asset selector and per-slot appearance fields.
7. **Events** — trigger -> action -> target rows with add/remove. Available for any object that can plausibly receive events.

The always-present rule keeps authoring predictable: Transform and Appearance render even when the JSON omits them, with defaults filled in. The first edit writes the section; subsequent edits patch it.

### Dirty Tracking And Save

Edits set the dirty flag. Save writes the current scene back to disk via `PUT /api/scenes/<id>?project=<project-id>`. The post-save state is clean until the next mutation.

The dirty flag is not persisted. Refreshing the editor discards unsaved edits. This keeps the file as the source of truth and makes save deliberate.

### Export

The project page's Export Project button is a one-shot action: `POST /api/export?project=<project-id>` returns a zip of the selected project. Export is independent of save; the export reads what is on disk, not the in-memory scene. See [Build And Distribution Output](50-build-output.md).

## Desktop Shell

Main Menu is a desktop host for the same visual editor. It does not define another scene format or another editing model. It provides:

- an Electron window for `/editor?project=<project-id>&scene=<scene-id>`
- a typed `window.mainMenu` bridge for native capabilities
- packaged runtime startup so the desktop app does not require an already-running external browser server
- a writable workspace location for project files in packaged mode
- Pi Agent IPC owned by the native process

The browser renderer remains sandboxed. Native authority stays outside React.

## Pi Agent / File Surface

The Pi Agent can read and write the same `scene.json` directly:

- **Read**: open the catalog project's `Assets/Scenes/{id}/scene.json`, or `GET /api/scenes/{id}?project={project-id}` from the Next dev server.
- **Write (file)**: edit the file in place.
- **Write (API)**: `PUT /api/scenes/{id}?project={project-id}` with the full scene JSON as the body.

In the desktop app, the Pi Agent starts from a bottom-left sidebar chat panel. Each request includes the active project id, scene id, selected layer path, selected layer name, and selected layer type. The renderer only talks to `window.mainMenu.agent`; the native process owns the SDK session, session directory, abort/reset controls, and working-directory selection.

The agent does not subscribe to live scene updates. It edits, the human reloads the editor or page to see the change. Symmetrically, after the human saves, the agent re-reads the file on its next pass.

The canonical object shape is the same on both sides. An agent writing a new object follows the same rules as the editor's add-object defaults.

## Why Reload-Based Handoff

Real-time collaboration would require operational transform, conflict resolution, and presence. That is a substantial increase in surface area for no current benefit. The author and the agent rarely edit at the same instant, and the file-as-source-of-truth model is enough.

## What The Surfaces Must Know

All surfaces must understand:

- the [scene data model](10-scene-data-model.md)
- the [project model](05-project-model.md)
- the [component manifest convention](15-component-manifest.md)
- the [rendering pipeline's failure modes](30-rendering-pipeline.md#failure-modes)

The visual editor does not need to know Pi SDK details. The Pi Agent does not need to know React internals. They coordinate through project files and the narrow desktop bridge.

## What Lives Where

| Concern | Editor | Desktop shell | Pi Agent |
| --- | --- | --- | --- |
| Visual placement | Primary | Hosts | Possible but awkward |
| Object ordering, selection, grouping | Primary | Hosts | Possible |
| Property tuning | Primary | Hosts | Primary |
| Bulk edits across many objects | Awkward | Hosts | Primary |
| Generating new asset combinations | Possible | Native authority | Primary |
| Authoring new components/effects | Awkward | Native authority | Primary |
| Computing layered SVGs / chrome tuning | Awkward | Native authority | Primary |
| Wiring events | Primary | Hosts | Primary |

The agent earns its keep on mechanical or computationally heavy edits. The editor earns its keep on taste-driven edits that need an eye on the canvas. The desktop shell earns its keep by giving both surfaces a controlled native boundary.
