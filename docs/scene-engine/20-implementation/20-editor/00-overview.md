---
covers: Visual editor — Next.js client app, Zustand store, three panels, scene save/export controls, collapsible sections, schema-driven property inspector.
type: overview
concepts: [editor, react, zustand, panels, mutations, collapsible-sections, schema-driven, property-schema]
design_refs: [10-system-design/40-authoring-surfaces.md, 10-system-design/16-property-schema.md]
---

# Visual Editor

A three-panel browser app for authoring scenes, built with Next.js + React + Tailwind + Zustand. The store holds the live scene tree, the merged registry, and selection state. Panels subscribe with selectors and re-render only on relevant changes. Mutations are immutable (`structuredClone` then patch) and mark the store dirty.

The design rationale is in [System Design / Authoring Surfaces](../../10-system-design/40-authoring-surfaces.md). This section describes the code.

---

## File Tree

```
apps/scene-engine/app/editor/
├── page.tsx                            shell — 3-panel grid, useSceneLoader
└── _components/
    ├── CanvasPanel.tsx                 live preview using the production renderer
    ├── HierarchyPanel.tsx              object tree, drag reorder, add menu
    ├── HierarchyRow.tsx                recursive tree row
    ├── InspectorPanel.tsx              shell that resolves selected object
    ├── LayerForm.tsx                   always-present sections + schema-driven properties
    ├── MainMenuConfigEditor.tsx        bespoke main-menu graph and tuning editor
    ├── PropertySection.tsx             section header + nested properties + nested sections
    ├── PropertyField.tsx               clickable label + input dispatch by schema type
    ├── DescriptionPopover.tsx          floating popover (anchored, click-away/Esc dismiss)
    ├── SlotsSection.tsx                glyph-group slot editor
    ├── AssetSwapDropdown.tsx           per-container file swap
    ├── SceneSection.tsx                collapsed scene settings + hierarchy save controls
    └── inputs/
        ├── RangedInput.tsx             slider + numeric, debounced
        ├── BlendSelect.tsx             blend-mode dropdown
        ├── FitSelect.tsx               object-fit dropdown
        ├── AnchorSelect.tsx            9-position anchor selector
        ├── ClipSelect.tsx              clip-path dropdown
        ├── EventsSection.tsx           event binding rows
        ├── ManifestPropertyField.tsx   one field per manifest descriptor (effects only)
        └── InspectorSection.tsx        Header / Section / FieldRow / ReadonlyValue

apps/scene-engine/app/_engine/
├── store/editor-store.ts               Zustand store + mutations + componentSchemas cache
├── hooks/useSceneLoader.ts             fetch scene + registry, seed store, preload component schemas
├── types/
│   └── property-schema.ts             PropertySchema / Section / PropertyDef types
└── lib/
    ├── path.ts                         resolveObject, resolveLayerEl
    ├── patch.ts                        patchFromDottedKey
    ├── inspector-config.ts             BLEND_MODES, FIT_OPTIONS, NUMERIC_PROPERTY_STEPS
    ├── builtin-property-schemas.ts     schemas for media / glyph-group / audio + orphan helpers
    └── component-schema-loader.ts      dynamic-import component .js, extract properties export, cache
```

## Contents

### [10-state.md](10-state.md)
The Zustand store, object-path semantics, the deep-merge patch algorithm, and each mutation (`mutateObjectAt`, `addObjectAt`, `removeObjectAt`, `moveObject`, `updateContainerFile`).

### [20-panels.md](20-panels.md)
The React components — Toolbar, Canvas, Hierarchy, Inspector — including always-present sections, drag-and-drop reorder, manifest-driven property fields, slots, and events.

### [30-loader.md](30-loader.md)
`useSceneLoader` — how the editor reads the project + scene IDs from query params, fetches the scene + registry, and seeds the store.

## Key Concepts

| Concept                     | Description |
|-----------------------------|-------------|
| Zustand store               | `{ scene, registry, selectedPath, dirty, componentSchemas }` plus mutations. Selectors drive granular re-renders. |
| Object path                 | Dotted string like `0`, `2.children.1`, `0.children.3.children.0`. Encodes a position in the scene tree. |
| Mutation                    | A function that produces a new scene tree (via `structuredClone`), replaces the store's `scene`, and marks dirty. |
| Always-present section      | Transform and Appearance render on every selection, even when the JSON omits them. |
| Collapsible section         | Editor and schema sections can opt into local open/closed state; dense groups can start collapsed. |
| Schema-driven property field| Property field rendered from a `PropertySchema` — sections, clickable labels, description popovers. Covers components and built-in layer types. |
| Manifest-driven field       | Property field generated from the asset's `manifest.json` descriptor. Used only for effects. |
| Slot                        | Glyph-group sub-surface edited under the parent object, not as a separate hierarchy entry. |
| Event binding               | Trigger → action → target row stored on the object's `events[]`. |
| Dirty                       | A boolean toggled by mutations and reset on save. Drives the toolbar's dirty indicator and Save button. |
