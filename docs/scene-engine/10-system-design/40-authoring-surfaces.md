---
covers: The dual-surface authoring contract — visual editor and agent both editing the same scene.json. Always-present inspector sections. Schema-driven property fields with sections and description popovers.
concepts: [authoring, editor, agent, dual-surface, dirty-tracking, save, inspector-sections, schema-driven, property-schema]
---

# Authoring Surfaces

Two surfaces author scenes: a **visual editor** in the browser and an **AI agent** writing files (or PUTting to the Next API routes). They are symmetric — neither is the source of truth, the `scene.json` file is. The contract between them is simple: edit the file, the other side picks up the change on its next load.

---

## Visual Editor (Human Surface)

Three-panel layout in the browser:

| Panel         | Role                                                                                |
|---------------|-------------------------------------------------------------------------------------|
| Hierarchy     | Scene globals, Save, Export, dirty indicator, scene metadata, object tree, drag-and-drop reorder, drag-into-group, and add-layer dialog. |
| Canvas        | Live preview of the scene rendered by the same code path as production.             |
| Inspector     | Property editor for the selected object. Always renders Transform and Appearance; conditionally renders Properties (manifest-driven), Events, Slots, Text, Asset swap. |

State is held in a Zustand store with three pieces:

- `scene` — the current scene tree, structurally cloned on mutation.
- `registry` — merged asset + module registry.
- `selectedPath` — a dotted path identifying the selected object (`2.children.1`).

Mutations (`mutateObjectAt`, `addObjectAt`, `removeObjectAt`, `moveObject`) replace the scene with a structurally cloned, modified copy and **mark the store dirty**. Components subscribe with selectors and re-render only on the slices they care about.

### Always-Present Inspector Sections

Every selected object shows the same shell, regardless of type:

1. **Header** — name, type chip, visibility toggle, delete button.
2. **Asset** — read-only asset id, with an asset-swap dropdown when the asset is a swappable container (audio/image/video/glyph). Modules (effects/components) are not swappable.
3. **Transform** — fill toggle. When fill: rotation + scale. When explicit: x, y, width (% or auto), height (% or auto), anchor select, rotation, scale.
4. **Appearance** — opacity, blend, hue. For media types (video/image): also fit. For scene-level selection: also saturation.
5. **Properties** — rendered by [property schema](16-property-schema.md). Properties are grouped into named sections with clickable labels that open description popovers. For effects, properties are driven by the manifest descriptor. For all other layer types, properties are driven by the schema (component-exported or built-in). Layers without a declared schema render all properties under a single auto-generated "General" section. Orphan properties (saved but absent from the schema) also land in General with an inferred input type.
6. **Slots** — glyph-groups only. Lists the SVG's exposed slots; each slot has its own asset selector and per-slot appearance fields.
7. **Events** — list of trigger → action → target rows with add/remove. Available for any object that can plausibly receive events.

The "always-present" rule is the key change from older revisions: Transform and Appearance render even when the JSON omits them, with defaults filled in. The first edit writes the section; subsequent edits patch it. The user never sees "this section doesn't exist yet — add it manually."

### Dirty Tracking and Save

Edits set the dirty flag. `SceneSection` shows a dirty indicator in the hierarchy panel. Save writes the current scene back to disk via the Next API route (`PUT /api/scenes/<id>?project=<project-id>`). The post-save state is "clean" until the next mutation.

The dirty flag is **not persisted** — refreshing the editor discards any unsaved edits. This is the agreed semantic; it forces deliberate save and keeps the file as the source of truth.

### Export

The hierarchy panel's Export button is a separate one-shot action: `POST /api/export?project=<project-id>` returns a zip of the selected project (renderer + scenes + assets + modules + fonts + boot files). See [build output](50-build-output.md). Export is independent of save; the export reads what's on disk, not the in-memory scene.

## Agent / File Surface

The agent reads and writes the same `scene.json` directly:

- **Read**: open `apps/scene-engine/projects/{project-id}/scenes/{id}/scene.json`, or `GET` the file from the Next dev server.
- **Write (file)**: edit the file in place.
- **Write (API)**: `PUT /api/scenes/{id}?project={project-id}` with the full scene JSON as the body. The dev server validates the ID (kebab-case), parses the body, and writes it with stable 2-space formatting plus a trailing newline.

The agent does **not** subscribe to live updates. It edits, the human reloads the editor (or the page) to see the change. Symmetrically, after the human saves, the agent re-reads the file on its next pass.

The canonical object shape — `transform` always present, `appearance` optional, `properties` driven by manifest — is the same on both sides. An agent writing a new object follows the same rules as the editor's add-object defaults.

## Why Reload-Based Handoff

Real-time collaboration would require operational transform / conflict resolution / presence — a substantial increase in surface area for no current benefit. The author and the agent rarely edit at the same instant, and the file-as-source-of-truth model is enough.

## What Both Surfaces Must Know

Both surfaces must understand:

- The [scene data model](10-scene-data-model.md) — canonical object shape, transform modes, slot structure.
- The [project model](05-project-model.md) — how scenes compose into a project.
- The [component manifest convention](15-component-manifest.md) — how to read property descriptors and write valid `properties` payloads.
- The [rendering pipeline's failure modes](30-rendering-pipeline.md#failure-modes) — what a malformed scene will render as.

Neither surface needs to know about the other. They are coordinated through the file.

## What Lives Where

| Concern                                          | Editor      | Agent       |
|--------------------------------------------------|-------------|-------------|
| Visual placement (drag, eyeball alignment)       | Primary     | Possible but awkward |
| Object ordering, selection, grouping             | Primary     | Possible    |
| Property tuning (sliders, blend, opacity, hue)   | Primary     | Primary     |
| Bulk edits across many objects                   | Awkward     | Primary     |
| Generating new asset combinations                | Possible    | Primary     |
| Authoring new components/effects (code + manifest) | Awkward   | Primary     |
| Computing layered SVGs / chrome tuning           | Awkward     | Primary     |
| Wiring events that map to known triggers/actions | Primary     | Primary     |

The agent earns its keep on the kinds of edits that are mechanical or computationally heavy. The editor earns its keep on the kinds that are taste-driven and need an eye on the canvas.
