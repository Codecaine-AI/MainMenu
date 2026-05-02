# Spec: Author Property Schemas for Remaining Components

**Session**: `2026-05-02_author-property-schemas-for-remaining-co_d7uyij`
**Created**: 2026-05-02
**Prior Session**: `2026-05-01_inspector-property-sections-and-field-de_ibebt8` — built the schema-driven inspector (sections, descriptions, popovers) and authored schemas for `press-start`, `procedural-sphere`, `procedural-cylinder`.

## Overview

The schema-driven inspector is now live. Three components shipped with authored schemas as part of v1; the remaining components still fall back to the auto-generated "General" section because they don't export a `properties` schema. This session walks through each remaining component and authors a sectioned schema with field-level descriptions, the same way the v1 components were authored.

User framing:
> "What I'd like to do here is go through our existing components and add sections to the properties with the descriptions and such."

## Problem Statement

When the inspector renders a component without a declared schema, every property is dumped under a single "General" section with no descriptions. For components with non-trivial property sets (`orbit-press-start`, `procedural-cylinder-strips-*`, `arc-letterbox`) this is exactly the "soup of fields" the prior session set out to fix — but those components still look that way in the inspector because no one has authored their schema yet.

This is purely an authoring gap, not a system gap.

## Components in Scope

| Component | File(s) | Has schema today? |
|---|---|---|
| `arc-letterbox` | `arc-letterbox.js` | No |
| `orbit-press-start` | `orbit-press-start.js` | No |
| `procedural-cylinder-strips` (mask) | `procedural-cylinder-strips-mask.js` | No |
| `procedural-cylinder-strips` (straight) | `procedural-cylinder-strips-straight.js` | No |

Everything that is *not* a component module (built-in layer types: `media`, `glyph-group`, `effect`, `audio`) already has its schema in `apps/scene-engine/src/lib/builtin-property-schemas.ts` and is out of scope here.

## Goals

### High-Level Goals

- Make every existing component in `apps/scene-engine/public/modules/components/` legible in the inspector — no component should render under a bare "General" fallback.

### Mid-Level Goals

- For each in-scope component, group its properties into named sections that reflect the actual conceptual structure of that component (rotation, position, splitting, color, …).
- Give every property a human-readable `label` and a plain-text `description` that explains what it does in editor terms (not implementation terms).
- Where useful, give the section itself a `description` (clickable on the section header) to summarize the group.

### Detailed Goals

*To be filled per component during exploration. The deliverable per component is a `properties` export at the bottom of the component's `.js` module, in the same shape as `press-start.js`.*

## Non-Goals

- Changing the inspector renderer or schema infrastructure — that shipped in the prior session and is locked.
- Changing component runtime behavior — only the `properties` export is added; the default-values constant moves into the schema's per-field `default` (or stays as runtime defaults, decided per-component).
- Re-organizing built-in layer schemas (`media`, `glyph-group`, `effect`, `audio`) — out of scope.
- Adding new property `type`s to the locked enum (`number | string | boolean | select | blend | fit | clip | anchor`).
- Adding new components or changing the component set.

## Success Criteria

- [ ] `arc-letterbox` exports a sectioned `properties` schema; every field has a label + description; opens cleanly in the inspector with no orphan-warning.
- [ ] `orbit-press-start` exports a sectioned `properties` schema; every field has a label + description; opens cleanly with no orphan-warning.
- [ ] `procedural-cylinder-strips-mask` exports a sectioned `properties` schema; every field has a label + description; opens cleanly with no orphan-warning.
- [ ] `procedural-cylinder-strips-straight` exports a sectioned `properties` schema; every field has a label + description; opens cleanly with no orphan-warning.
- [ ] No runtime regressions — each component still renders identically in the scene viewport with its existing saved property values.
- [ ] Section/property naming follows the pattern set by `press-start` / `procedural-sphere` / `procedural-cylinder` (Title Case section labels, sentence-case descriptions).

## Context & Background

Reference implementations from the prior session:

- `apps/scene-engine/public/modules/components/press-start/press-start.js`
- `apps/scene-engine/public/modules/components/procedural-sphere/procedural-sphere.js`
- `apps/scene-engine/public/modules/components/procedural-cylinder/procedural-cylinder.js`

Schema shape (locked from prior session):

```ts
type PropertySchema = { sections: Section[] };
type Section = {
  id: string;
  label: string;
  description?: string;
  properties?: Record<string, PropertyDef>;
  sections?: Section[];
};
type PropertyDef =
  | { type: "number";  label: string; description?: string; min?: number; max?: number; step?: number }
  | { type: "string";  label: string; description?: string }
  | { type: "boolean"; label: string; description?: string }
  | { type: "select";  label: string; description?: string; options: string[] | { value: string; label: string }[] }
  | { type: "blend" | "fit" | "clip" | "anchor"; label: string; description?: string };
```

## Key Decisions

### Match the prior session's authoring pattern exactly
**Decision**: Each new schema follows the shape established by `press-start.js`, `procedural-sphere.js`, and `procedural-cylinder.js` — `export const properties = { sections: [...] }` at the bottom of the component module.
**Rationale**: User said "match prior session." Consistency across all components is more valuable than locally-optimal variations.
**Made**: 2026-05-02

### Defaults stay in the render function, NOT in the schema
**Decision**: Default values continue to live as `??` fallback literals inside the component's render function (e.g. `properties.text ?? "PRESS START"`). PropertyDef does not carry a `default` field.
**Rationale**: This is what the v1-authored components do. The schema is editor-only metadata; the renderer ignores it. Adding `default` to the locked PropertyDef enum would be schema-shape change, out of scope for this session.
**Made**: 2026-05-02

### One commit per component
**Decision**: Each of the four files becomes its own checkpoint/commit (so four checkpoints total). The two `procedural-cylinder-strips-*.js` variants are separate checkpoints, not paired.
**Rationale**: User chose "one checkpoint per component." Mirrors the prior session's per-component checkpoint cadence and keeps reviews narrow.
**Made**: 2026-05-02

### Author first, review the diff
**Decision**: For each component I read the source, propose a sectioning + descriptions, and present the diff. No per-component interview before authoring.
**Rationale**: User chose "Author first, then review." This is content-authoring work where the cost of a bad first draft is small (just a re-write).
**Made**: 2026-05-02

### Description voice: match v1
**Decision**: Descriptions follow the v1 voice — terse, editor-facing, sentence case, plain text, ~1–2 sentences. Example from `press-start`: *"Duration in seconds for one full blink cycle. Lower values blink faster."* No implementation jargon ("CSS variable", "WebGL uniform"); user-facing effect only.
**Rationale**: Consistency with the three already-shipped schemas. User explicitly chose "match prior session."
**Made**: 2026-05-02

### Section IDs are kebab-case, labels are Title Case
**Decision**: `id: "rotation"`, `label: "Rotation"` — same convention press-start uses (`id: "animation"`, `label: "Animation"`).
**Rationale**: Already the de-facto pattern.
**Made**: 2026-05-02

## Open Questions

*All cross-cutting authoring rules are locked. Per-component sectioning is intentionally NOT pre-decided — it will be drafted during plan/build by reading each component's render code, then presented to the user for review (per the "author first, then review" decision).*

## File Structure

```
apps/scene-engine/public/modules/components/
├── arc-letterbox/
│   └── arc-letterbox.js                              # modified — add `properties` export
├── orbit-press-start/
│   └── orbit-press-start.js                          # modified — add `properties` export
├── procedural-cylinder-strips/
│   ├── procedural-cylinder-strips-mask.js            # modified — add `properties` export
│   └── procedural-cylinder-strips-straight.js        # modified — add `properties` export
```

No new files. No changes outside `public/modules/components/`.

## Notes

- Authoring is per-component and largely independent — the work parallelizes naturally and could be split into one checkpoint per component (or one per file, treating the two strips variants separately).
- Reading each component's render code is the primary research step: section grouping should follow the conceptual blocks the render code already uses (e.g., "if the file computes rotation from `speed` + `axis`, those belong together").
