---
covers: System Design entry point — language-agnostic blueprints for how the scene-engine works.
type: overview
---

# System Design

How the scene-engine works *as a system*, independent of the framework and JavaScript specifics that implement it. Read this layer to understand intended behavior before changing it.

If a description here would still hold true if the engine were rewritten in a different stack, it belongs here. If it depends on a specific module, file path, or framework, it belongs in [Implementation](../20-implementation/00-overview.md).

---

## File Tree

```
docs/10-system-design/
├── 00-overview.md            (this file)
├── 05-project-model.md       Project manifest, scenes list, navigation
├── 10-scene-data-model.md    Canonical SceneObject shape, transform, slots, events
├── 15-component-manifest.md  manifest.json convention for effects/components
├── 16-property-schema.md     Sectioned property schemas — labels, descriptions, type taxonomy
├── 20-asset-registry.md      Containers, dual asset/module manifests, lookup
├── 30-rendering-pipeline.md  Scene → DOM, dispatch, slots, scene-level grading
├── 40-authoring-surfaces.md  Editor, desktop shell, Pi Agent — same project data
├── 50-build-output.md        Standalone export + packaged desktop authoring app
└── 60-asset-uploads.md       Upload flow + inspector asset-selection dropdown
```

---

## Contents

### [05-project-model.md](05-project-model.md)
The project manifest: how multiple scenes form a deliverable site, the `entry` scene, navigation between scenes, and what intentionally does *not* live at the project level.

### [10-scene-data-model.md](10-scene-data-model.md)
The canonical scene shape: stage, scene-level appearance, the universal SceneObject (transform, appearance, properties, slots, events, children), the eight built-in object types, and z-order semantics.

### [15-component-manifest.md](15-component-manifest.md)
The manifest convention: a `manifest.json` declaring module-level metadata (name, type, sizing) and, for effects, editable property descriptors. Components use the property schema instead of manifest properties.

### [16-property-schema.md](16-property-schema.md)
The property schema convention: sectioned property declarations with labels, descriptions, and a locked type taxonomy. Drives the inspector for components and built-in layer types. Defines the General fallback, orphan handling, and description popovers.

### [20-asset-registry.md](20-asset-registry.md)
The container indirection between scenes and files: dual asset/module manifests, the five file asset types, swap-by-id semantics, and how registry lookup affects renderer dispatch.

### [30-rendering-pipeline.md](30-rendering-pipeline.md)
How a scene becomes DOM: registry load, type dispatch, transform/appearance application, glyph-group slot mounting, scene-level color grading, mount-vs-update reconciliation.

### [40-authoring-surfaces.md](40-authoring-surfaces.md)
The authoring contract: visual editor, desktop shell, and Pi Agent all operate on the same project files. Always-present inspector sections, schema-driven property fields with sections and description popovers, dirty tracking, save semantics, and agent context handoff.

### [50-build-output.md](50-build-output.md)
How a project becomes a deployable site or authoring app: `/api/export` builds an active-dependency standalone zip, and the desktop app packages the Next standalone runtime for local editing.

### [60-asset-uploads.md](60-asset-uploads.md)
How new asset files enter the system and how scenes select existing containers — the upload page, the inspector dropdown, and the validation rules that gate both.

---

## Key Concepts

| Concept              | Description |
|----------------------|-------------|
| Project              | A `project.json` plus a set of scenes. Ships as one bundle. |
| Scene                | A 1440×1080 stage with an ordered tree of typed objects. 1:1 with a page. |
| Scene object         | The universal entry in a scene's tree. Always has `transform`; optionally `appearance`, `properties`, `slots`, `events`, `children`. |
| Transform            | Spatial section. Either explicit (`x`, `y`, `width`, `height`, `anchor`) or `mode: "fill"`. |
| Appearance           | Visual section: `opacity`, `blend`, `hue`, `saturation`, `fit`. Available at scene and object level. |
| Slot                 | An exposed editable sub-surface inside a glyph-group SVG. Replaces the legacy 40-child array. |
| Manifest             | A `manifest.json` next to a component or effect declaring module-level metadata and, for effects, property descriptors. |
| Property schema      | A sectioned property declaration (labels, descriptions, locked type taxonomy) that drives the inspector for components and built-in layer types. |
| Asset                | An external file (audio, image, video, glyph, font) referenced by container ID. |
| Module               | An authored code unit (effect, component) referenced by container ID. |
| Container            | A typed registry entry that points at a file or module path. Scenes reference containers by ID. |
| Renderer (per type)  | A function that turns an object plus its registry entry into a DOM wrapper. |
| Authoring surface    | A way of editing a scene or project. Current surfaces are the browser editor, desktop shell, and Pi Agent. |
| Desktop shell        | Native wrapper that opens the visual editor and owns privileged local capabilities. |
| Pi Agent             | Desktop-only chat agent that receives project/scene/selection context and edits through the local workspace. |
| Stage                | The fixed 1440×1080 box every scene renders into. |
