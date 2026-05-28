---
covers: The manifest convention for effects and components — module-level metadata, sizing hints, and effect property descriptors.
concepts: [manifest, component, effect, module, properties, sizing, extensibility]
---

# Component Manifest

Effects and components ship a `manifest.json` next to their code. The manifest declares module-level metadata — name, type, sizing hint — and, for effects, the editable property descriptors that drive the inspector.

For **components** and built-in layer types (media, glyph-group, audio), property editing is driven by the [property schema convention](16-property-schema.md), not the manifest. The manifest is still required for name, type, and sizing metadata, but component property fields come from the schema exported by the component's code module.

For **effects**, the manifest remains the authoritative source of property descriptors. Effects are pure CSS and have no code module to attach a schema to.

This is the contract that makes the system open for extension — a new contributor can drop in a CSS file (effect) or JS file (component) plus a manifest, and it just works in both the editor and the runtime.

---

## Where Manifests Live

```
codecaine-site/
├── ProjectSettings/
│   └── registries/
│       └── modules.json
└── Assets/
    └── Modules/
        ├── effects/
        │   └── crt-overlay/
        │       ├── crt-overlay.css
        │       └── manifest.json
        └── components/
            └── press-start/
                ├── press-start.js
                ├── press-start.css
                └── manifest.json
```

`ProjectSettings/registries/modules.json` is the index — each entry declares `type` and the logical `path` to the module's primary file, such as `/modules/components/press-start/press-start.js`. The renderer reads the manifest from the module's directory through the project file routes and merges it into the registry entry at load time.

## Manifest Shape

```json
{
  "name": "CRT Overlay",
  "type": "effect",
  "sizing": "fill",
  "properties": {
    "scan-line-density": { "type": "number", "default": 3,    "min": 1, "max": 10,  "step": 0.5 },
    "vignette-intensity":{ "type": "number", "default": 0.55, "min": 0, "max": 1,   "step": 0.01 },
    "rgb-fringe":        { "type": "number", "default": 0.04, "min": 0, "max": 0.2, "step": 0.01 }
  }
}
```

| Field        | Required | Notes                                                                                          |
|--------------|----------|------------------------------------------------------------------------------------------------|
| `name`       | yes      | Human-readable display name shown in add-layer and inspector surfaces.                         |
| `type`       | yes      | `effect` or `component`. Must agree with the registry entry's `type`.                          |
| `sizing`     | no       | `fill` or `explicit`. Hints the default `transform` mode when this module is added to a scene. |
| `properties` | yes      | Map of property key → property descriptor. May be empty for pure-CSS effects with no knobs.    |

## Property Descriptors

Every value in `properties` is one descriptor object. The `type` field selects the input the editor renders.

### `number`

```json
"blink-rate": { "type": "number", "default": 1.1, "min": 0.1, "max": 5, "step": 0.1, "description": "..." }
```

Renders as a slider + numeric input. `min`/`max`/`step` configure the slider; `default` seeds new objects. `description` is shown as a tooltip / help text.

### `string`

```json
"text": { "type": "string", "default": "PRESS  START", "description": "Button label" }
```

Renders as a single-line text field.

### `boolean`

```json
"shimmer": { "type": "boolean", "default": true }
```

Renders as a toggle.

### `enum`

```json
"variant": { "type": "enum", "default": "primary", "options": ["primary", "ghost"] }
```

Renders as a dropdown of `options`.

## What Manifests Do Not Declare

The manifest is for **component-specific** knobs only. Universal sections are handled generically by the editor and not repeated per-module:

- **Visibility** — `visible` is a universal toggle on every object.
- **Transform** — `x`, `y`, `width`, `height`, `anchor`, `rotation`, `scale`, `mode: "fill"` are always-present, edited the same way for every object type.
- **Appearance** — `opacity`, `blend`, `hue`, `saturation`, `fit` are universal.
- **Events** — wired the same way regardless of object type.

If a property isn't unique to the component, it doesn't belong in the manifest.

## Sizing Hints

`sizing` controls the default transform when this module is added to a scene:

- `fill` — new objects start with `transform: { mode: "fill" }`. Right for full-screen effects (CRT, vignette, vortex).
- `explicit` (or omitted) — new objects start with an explicit transform centered on the stage at sensible defaults.

This is a one-time hint; the user can flip the transform mode in the inspector at any time.

## Renderer Contract

### Effects

Effects are pure CSS. The renderer mounts a wrapper element, attaches the stylesheet, and lets the CSS do the work. The component's `properties` are exposed as CSS custom properties on the wrapper (e.g. `--rgb-fringe: 0.06`) that the stylesheet consumes via `var()`.

### Components

Components export a default function called as:

```js
export default function render({ properties, layerId }) {
  const el = document.createElement('div')
  // ...build the DOM, read properties...
  return el
}
```

The renderer:
1. Loads the JS module via `import()` (with a Blob URL shim for cache-friendly fetches).
2. Loads the sibling CSS file (same path, `.js` → `.css`) into the document.
3. Calls the default export with `{ properties: layer.properties, layerId: layer.id }`.
4. Mounts the returned element inside the object's positioned wrapper.

No further coupling — components are responsible for their own DOM and lifecycle.

## Editor Integration

**Effects**: the inspector iterates the manifest's `properties` and renders one field per descriptor. The descriptor drives the input type, slider range, default, and tooltip.

**Components**: the inspector ignores the manifest's `properties` (if present) and reads the component's [property schema](16-property-schema.md) instead — a sectioned structure exported from the component's code module that provides grouping, labels, descriptions, and a richer type taxonomy. The manifest is still used for `name` (display in add-layer surfaces) and `sizing` (default transform hint).

When the add-layer dialog lists modules, it groups by `type` (effect / component) and shows the manifest's `name`. Adding a module creates a new scene object whose `type` matches the module type, with the asset wired up and a transform seeded from the `sizing` hint.

## Adding a New Module

1. Create a directory under `Assets/Modules/effects/<id>/` or `Assets/Modules/components/<id>/` in the project workspace.
2. Add the code file (`<id>.css` for effects, `<id>.js` for components).
3. Add a `manifest.json` declaring `name`, `type`, optional `sizing`, and `properties`.
4. Register it in `ProjectSettings/registries/modules.json`:
   ```json
   "<id>": { "type": "effect", "path": "/modules/effects/<id>/<id>.css" }
   ```

That is the entire integration surface. No editor changes, no renderer changes, no scene-format changes.
