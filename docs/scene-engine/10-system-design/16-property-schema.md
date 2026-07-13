---
covers: The property schema convention — sectioned property declarations with labels, descriptions, collapse defaults, and a locked type taxonomy. Drives the inspector for all layer types.
concepts: [property-schema, sections, collapsible-sections, property-types, color-fields, descriptions, popover, orphan, general-fallback, schema-resolution]
---

# Property Schema

Every layer type can declare a **property schema** that structures its editable properties into named sections, attaches human-readable labels and descriptions, and locks each property to one of a fixed set of input types. The inspector renders by schema; authors control grouping, ordering, and documentation of every field.

---

## Why Schemas Exist

Components and other layer types can accumulate many properties with terse or technical names. A flat list of unlabeled fields forces the author to know what every key does. Property schemas solve three problems:

1. **Grouping** — related properties appear under named sections (e.g., "Rotation", "3D Position").
2. **Meaning** — each property carries a label (human name) and an optional description (what it does).
3. **Input type** — the schema declares what kind of editor control renders for each property.

## Schema Shape

A schema is an ordered list of **sections**. Each section has an identifier, a display label, an optional description, optional collapse behavior, and an ordered map of **property definitions**. Sections can nest: a section may contain child sections in addition to properties.

A property definition declares:

- **type** — one of a locked set of input types.
- **label** — the human-readable name shown in the inspector.
- **description** — optional plain text explaining what the property does.
- **default** — optional fallback value shown by the inspector when the scene has not saved that property yet.
- Type-specific constraints (min, max, step for numbers; options for selects).

Properties render in declaration order within their section. The author controls the reading flow.

The editor treats `default` as a display/editing fallback only. It does not write default values into scene JSON until the user changes a field. Runtime components should still keep their own defensive fallbacks because exported or older scenes may omit properties.

## Type Taxonomy

The set of allowed property types is closed:

| Type      | Renders as                                                      |
|-----------|-----------------------------------------------------------------|
| `number`  | Slider + numeric input. Optional min, max, step.                |
| `string`  | Single-line text field.                                         |
| `boolean` | Toggle / checkbox.                                              |
| `color`   | Native color picker plus editable color text field.             |
| `select`  | Dropdown with inline options (string list or value+label pairs).|
| `blend`   | Blend-mode dropdown (canonical CSS blend modes).                |
| `fit`     | Object-fit dropdown.                                            |
| `clip`    | Clip-path dropdown.                                             |
| `anchor`  | 9-position anchor selector.                                     |

The specialized types (`blend`, `fit`, `clip`, `anchor`) are shorthands — they select over the system's standard option lists without requiring the author to enumerate them inline.

New widget types can be added by extending this taxonomy. Authors cannot supply custom editor controls via the schema.

## Where Schemas Live

Schemas come from two sources, depending on the layer type:

| Layer type                       | Schema source                                              |
|----------------------------------|------------------------------------------------------------|
| `component`                      | Exported from the component's code module alongside the render function. |
| `media`, `glyph-group`, `audio`  | Declared in a central built-in schema registry maintained alongside the editor. |
| `effect`                         | Uses the legacy [manifest convention](15-component-manifest.md) — not the property schema system. |

Component schemas are co-located with the code they describe: one file to read, one file to edit. Built-in schemas are centralized because those layer types have no authored module to attach to.

## Always-Sectioned Model

Every schema is a list of sections — there is no "flat mode." Even a layer with a single group of properties renders under one named section. This means:

- One rendering path in the inspector; no branching between flat and sectioned layouts.
- Authors start with minimal ceremony (one section named "General" or after the layer type).
- Adding sections later is purely additive — no structural migration.

## Section Collapsibility

Every schema section can declare whether it collapses and whether it starts open:

- `collapsible: true` makes a section header toggle its body.
- `collapsible: false` pins the section open, even for nested sections.
- `defaultOpen: false` starts a section collapsed. On top-level sections, this also opts the section into collapse behavior.
- `defaultOpen: true` starts a collapsible section expanded.

Top-level sections are open by default. Nested sections are collapsible and closed by default unless the schema says otherwise. Use nesting for meaningful ownership boundaries — for example, a broad "Motion" section can contain "Selection", "Layer Changes", and "Title Prism" subsections. Avoid using nesting only to hide unrelated settings; if a group needs to collapse, it should still live under the parent concept that owns it.

## The General Fallback

When a layer has no declared schema (or a component whose schema hasn't loaded yet), all of its saved properties render under an auto-generated **General** section. This ensures every layer is editable immediately.

Properties that exist in the saved data but are absent from the declared schema — **orphans** — also render under General. The system infers an input type from the value's runtime type (number → slider, boolean → toggle, color-like string → color field, other string → text). A developer warning names the orphan and the schema source, so renames and removals don't go unnoticed.

## Description Popovers

Each property label is a click target. Clicking it opens a small floating popover anchored next to the label, showing the property's full label and description. Clicking outside or pressing Escape dismisses it. Section labels with a description behave the same way; sections without a description render a non-clickable header.

This is an **explicit click affordance**, not a hover tooltip. With many properties per inspector, hover tooltips create visual noise; the explicit popup lets the author seek information deliberately.

## Sub-Layer Participation

Sub-layer editing contexts (named SVG sub-layers and foreign media children nested inside glyph-groups) participate in the same sectioned schema rendering. Their schemas come from the same sources the parent uses. The editing experience is uniform regardless of nesting depth.

## Relationship to the Manifest Convention

The property schema system is separate from the [manifest convention](15-component-manifest.md). Manifests (`manifest.json`) still declare module-level metadata (name, type, sizing hint) and are used by effects for property fields. For all other layer types, the property schema is the authoritative source of property structure and labels in the inspector.

See [Authoring Surfaces](40-authoring-surfaces.md) for how schemas integrate into the inspector's section layout.
