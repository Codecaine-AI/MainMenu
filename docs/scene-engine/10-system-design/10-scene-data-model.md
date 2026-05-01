---
covers: The canonical scene format — stage, object array, the universal object shape (transform, appearance, properties, slots, events, children), z-order semantics.
concepts: [scene-json, scene-object, transform, appearance, properties, slots, events, children, z-order, anchor, fill-mode]
---

# Scene Data Model

A scene is a JSON document that declares a stage and an ordered tree of typed objects. Every object follows the same canonical shape regardless of type; what differs is which sections it uses. Z-order is array order: index 0 is the back, last entry is on top — recursively, inside `children`.

---

## Top-Level Shape

```json
{
  "id": "title",
  "name": "Title Screen",
  "stage": { "width": 1440, "height": 1080 },
  "appearance": { "hue": 0, "saturation": 1.4 },
  "objects": [ ... ]
}
```

| Field        | Required | Notes                                                                                       |
|--------------|----------|---------------------------------------------------------------------------------------------|
| `id`         | yes      | Lowercase kebab-case (`^[a-z0-9]+(?:-[a-z0-9]+)*$`). Matches the scene's directory name.    |
| `name`       | yes      | Human-readable label shown in dashboards and lists.                                         |
| `stage`      | yes      | Fixed design canvas. Currently always 1440×1080. The renderer scales to viewport at runtime. |
| `appearance` | no       | Scene-level color grading applied to the whole stage (`hue`, `saturation`).                 |
| `objects`    | yes      | Ordered array of scene objects. Empty is valid.                                             |

`objects` (not `layers`) is the canonical name. The renderer reads `scene.objects`.

## Canonical Object Shape

Every scene object is the same fundamental thing: a positioned wrapper with a renderer type, a set of always-present spatial and visual sections, and optional component-specific properties, slots, events, and children.

```json
{
  "id": "press-start",
  "name": "Press Start Button",
  "type": "component",
  "asset": "press-start",
  "visible": true,

  "transform": {
    "x": 30.5, "y": 63.5,
    "width": "auto", "height": "auto",
    "anchor": "top-left",
    "rotation": 0, "scale": 1
  },

  "appearance": { "opacity": 1, "blend": "hard-light" },

  "properties": { "text": "PRESS  START", "blink-rate": 1 },

  "events": [
    { "trigger": "click", "action": "navigate",   "target": "menu" },
    { "trigger": "click", "action": "play-audio", "target": "start-cue" }
  ],

  "children": []
}
```

| Section      | Required | Contents                                                                                  |
|--------------|----------|-------------------------------------------------------------------------------------------|
| `id`         | yes      | Stable identifier within the scene (used for selection, reconciliation, debugging).       |
| `name`       | no       | Human-readable display name shown in the hierarchy.                                        |
| `type`       | yes      | Renderer type — see [Object Types](#object-types).                                         |
| `asset`      | depends  | Registry ID. Required for object types that render an asset. Omitted for `group`.         |
| `visible`    | no       | When `false`, the renderer skips mounting / hides the element. Defaults to `true`.        |
| `transform`  | yes      | Spatial section — explicit or fill (see below).                                            |
| `appearance` | no       | Visual section — `opacity`, `blend`, `hue`, `saturation`, `fit`.                          |
| `properties` | no       | Component-specific knobs declared by the asset's manifest (see [component-manifest](15-component-manifest.md)). |
| `slots`      | no       | Glyph-group only — exposed editable sub-surfaces (see [Slots](#slots-glyph-groups)).      |
| `events`     | no       | Trigger → action bindings for interactivity.                                              |
| `children`   | no       | Nested child objects (same shape, recursive). Children render inside the parent's wrapper. |

The inspector treats `transform` and `appearance` as **always-present** — even if the JSON omits them, the editor renders the sections with defaults and writes them on first edit.

## Transform

Transform has two mutually exclusive modes: **explicit** (positioned and sized) or **fill** (covers the parent).

### Explicit transform

```json
"transform": {
  "x": 50, "y": 75,
  "width": 30, "height": "auto",
  "anchor": "center",
  "rotation": 0, "scale": 1
}
```

- `x`, `y` — percentages of the parent (number, no unit).
- `width`, `height` — percentages of the parent, or `"auto"` to let intrinsic content / aspect ratio decide.
- `anchor` — which point on the object aligns to `(x, y)`. One of `top-left`, `top`, `top-right`, `left`, `center`, `right`, `bottom-left`, `bottom`, `bottom-right`. Defaults to `top-left`.
- `rotation` — degrees, applied after anchor translation.
- `scale` — uniform multiplier, applied last.

All positioning is **percentage of the parent**. Children of a group are percentages of the group's box, which is itself a percentage of the stage. Pages are single-viewport game-menu screens; percentages are the natural unit.

### Fill mode

```json
"transform": { "mode": "fill", "rotation": 0, "scale": 1 }
```

`mode: "fill"` means "cover the parent" (`inset: 0; width: 100%; height: 100%`). Use it for backgrounds, full-screen video loops, full-screen effect overlays, and audio (which has no visual but still needs a transform field).

Toggling between explicit and fill in the inspector is a one-click operation; the unused fields are stripped.

## Appearance

```json
"appearance": { "opacity": 1, "blend": "hard-light", "hue": 0, "saturation": 1, "fit": "cover" }
```

| Field         | Notes                                                                                  |
|---------------|----------------------------------------------------------------------------------------|
| `opacity`     | `0..1`. Maps to CSS `opacity`.                                                          |
| `blend`       | CSS `mix-blend-mode` value (`normal`, `multiply`, `screen`, `overlay`, …).             |
| `hue`         | Degrees. Maps to CSS `filter: hue-rotate(...)`.                                         |
| `saturation`  | Multiplier. Used by the scene-level appearance filter; on object appearance, treated similarly. |
| `fit`         | Media-only: CSS `object-fit` for the inner `<video>` / `<img>` (`cover`, `contain`, `fill`, …). |

Scene-level `appearance` (on the top-level scene object) applies as a CSS `filter` to the stage root, layered over the per-object filters.

## Object Types

| `type`        | What it renders                                  | Asset registry kind   | Typical `transform` |
|---------------|--------------------------------------------------|-----------------------|---------------------|
| `video`       | Looping `<video>`                                 | `video` (asset)       | `fill` or explicit  |
| `image`       | Static `<img>`                                    | `image` (asset)       | explicit            |
| `audio`       | Web-audio playback (no visual)                    | `audio` (asset)       | `fill` (placeholder) |
| `glyph-group` | Layered SVG with optional editable slots          | `glyph` (asset)       | explicit            |
| `text`        | Editable text (font, size, color)                 | n/a                   | explicit            |
| `effect`      | CSS effect from a module (CRT, vortex, …)         | `effect` (module)     | `fill`              |
| `component`   | Custom JS component from a module                 | `component` (module)  | varies per manifest |
| `group`       | Empty container for organizing children           | n/a (no asset)        | explicit or fill    |

`type` selects the renderer; `asset` resolves to a registry entry. Built-in types (`video`, `image`, `audio`, `glyph-group`, `text`, `group`) are first-class. `effect` and `component` types load module code and read property definitions from a [manifest](15-component-manifest.md).

## Properties

`properties` carries component-specific values — text, blink rate, density, hue, etc. The keys and types are not fixed by the schema; they're declared by the asset's `manifest.json`. The editor reads the manifest to render property fields with the right input (slider, text, enum). The renderer passes `properties` straight to the component's render function.

Universal concerns (visibility, transform, appearance) are **never** in `properties` — that section is reserved for things only the component knows about.

## Slots (Glyph Groups)

A glyph-group is a single object in the hierarchy, not a 40-child tree. The SVG ships with internal sub-layers already finalized by the font-creation pipeline. The SVG author marks specific sub-layers as editable by tagging them with a `data-slot="<slot-id>"` attribute. Those — and only those — appear as `slots` on the scene object.

```json
{
  "id": "codecaine-logo",
  "type": "glyph-group",
  "asset": "codecaine-logo",
  "transform": { "x": 40, "y": 12, "width": 22, "height": 5.5, "anchor": "top-left", "scale": 3.55 },
  "slots": [
    {
      "id": "in-text-fire",
      "type": "video-fill",
      "asset": "in-text-fire",
      "appearance": { "blend": "screen", "opacity": 1, "fit": "cover" }
    }
  ]
}
```

| Slot field    | Notes                                                                |
|---------------|----------------------------------------------------------------------|
| `id`          | Matches a `data-slot="..."` element inside the SVG.                  |
| `type`        | Slot kind. Currently `video-fill` (a video clipped to the slot shape). |
| `asset`       | Registry ID of the fill asset.                                        |
| `appearance`  | Per-slot blend / opacity / fit / hue.                                 |

The slot's clip-path is inherited from the SVG anchor element, so the fill is constrained to the letter shape (or whatever the author exposed). Slots appear in the inspector under the glyph-group object, not as separate hierarchy entries.

## Events

A small set of trigger → action pairs makes interactivity legible in the editor without inventing a visual scripting language.

```json
"events": [
  { "trigger": "click", "action": "navigate",   "target": "menu" },
  { "trigger": "click", "action": "play-audio", "target": "start-cue" }
]
```

| Trigger | Action       | Target meaning                              |
|---------|--------------|---------------------------------------------|
| `click` | `navigate`   | A scene ID in the project — switches pages. |
| `click` | `play-audio` | An asset ID of an audio container.          |
| `hover` | (any)        | Triggered on mouseover.                     |
| `load`  | `autoplay`   | Fires on scene boot.                        |

The renderer maps these to DOM event listeners and the project navigator (`window.MELEE_navigate(sceneId)` in the export bundle).

## Children and Nesting

Any object may have `children`. Children render inside the parent's wrapper, with their `transform` percentages resolved against the parent's box. Moving a parent moves its children.

`children` is **not** how glyph-group sub-layers are modeled — those are `slots`. Children are for general scene composition: a `group` containing a logo + button, an `effect` nested inside a sub-region, etc.

Z-order within a `children` array is array order, same rule as the top-level `objects` array.

## Z-Order

Array position **is** the z-order. First entry is at the back, last is on top. There is no `zIndex` property. Reordering in the editor's hierarchy panel rewrites the array. The same rule applies recursively inside `children`.

## Example: Title Scene

```json
{
  "id": "title",
  "name": "Title Screen",
  "stage": { "width": 1440, "height": 1080 },
  "appearance": { "hue": 0, "saturation": 1.4 },
  "objects": [
    {
      "id": "bg-video",
      "type": "video",
      "asset": "bg-video",
      "transform": { "mode": "fill" },
      "appearance": { "fit": "fill", "blend": "normal", "opacity": 1, "hue": 109 }
    },
    {
      "id": "codecaine-logo",
      "type": "glyph-group",
      "asset": "codecaine-logo",
      "transform": { "x": 40, "y": 12, "width": 22, "height": 5.5, "anchor": "top-left", "scale": 3.55 },
      "properties": { "shimmer": true },
      "slots": [
        {
          "id": "in-text-fire",
          "type": "video-fill",
          "asset": "in-text-fire",
          "appearance": { "blend": "screen", "opacity": 1, "fit": "cover" }
        }
      ]
    },
    {
      "id": "press-start",
      "type": "component",
      "asset": "press-start",
      "transform": { "x": 30.5, "y": 63.5, "width": "auto", "height": "auto", "anchor": "top-left" },
      "appearance": { "opacity": 1, "blend": "hard-light" },
      "properties": { "text": "PRESS  START", "blink-rate": 1 },
      "events": [
        { "trigger": "click", "action": "navigate",   "target": "menu" },
        { "trigger": "click", "action": "play-audio", "target": "start-cue" }
      ]
    },
    {
      "id": "crt",
      "type": "effect",
      "asset": "crt-overlay",
      "visible": false,
      "transform": { "mode": "fill" },
      "appearance": { "opacity": 1 },
      "properties": { "rgb-fringe": 0.06 }
    }
  ]
}
```

Bottom to top: hue-shifted background video, the CODECAINE logo with an in-text fire slot, the press-start button with click bindings, and a CRT overlay (currently hidden).
