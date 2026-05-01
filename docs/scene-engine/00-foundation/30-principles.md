---
covers: The decisions that shape what does and doesn't belong in the scene-engine.
concepts: [principles, decisions, scope, non-goals]
---

# Principles & Decisions

The decisions below were made deliberately during spec. They constrain what the scene-engine should and should not become.

---

## Principles

### 1. Scene = Page, 1:1
Each scene corresponds to one full page. No multi-scene composition, no nested scenes, no scene-as-component. The Unity Scene model: one stage, one page.

### 2. Composition is the primary authoring activity
The system optimizes for *placing existing assets into a stage*, not for creating new assets. Asset creation (font pipeline, extraction pipeline) lives outside this app. The scene-engine only consumes registered assets.

### 3. Dual-surface authoring is symmetric
The visual editor and the agent both read and write the same `scene.json`. Neither is the source of truth — the file is. No editor-state awareness in the agent, no real-time collaboration protocol, no operational transform.

### 4. Content separate from composition (Option A)
- **Assets** in the registry are reusable visual building blocks.
- **Content** lives with each component asset (e.g. `menu-data.json` next to `menu.js`).
- **Scenes** are lean composition manifests — they reference assets by ID and declare placement, but never embed content.

This avoids duplication and keeps the editor focused on visual composition rather than copywriting.

### 5. Z-order is array position
Last layer in the array renders on top. No z-index numbers, no separate ordering field. The data shape *is* the order.

### 6. Layers form a tree, not a flat stack
Groups have `children`. Children can either be **named sub-layer overrides** (referencing an SVG `data-layer` attribute) or **foreign assets** (full layers interleaved between sub-layers). This enables fine-grained z-depth control inside complex assets like the CODECAINE logo.

### 7. The font pipeline stays separate; the editor app is absorbed
- The Python pipeline (`apps/font-creation/pipeline/`) remains a standalone asset factory.
- The melee-3 Vite editor app is folded into the scene editor as the glyph-group property inspector. One editor, not two.

### 8. The scene-engine fully replaces `apps/frontend/`
The previous hand-wired Vite multi-page app is retired. All pages — title, menu, projects, testimonials, links, about, guestbook — eventually rebuild as scenes. Shared infrastructure (vortex, CRT, audio, tweaks) becomes reusable assets, not page-bootstrapped scaffolding.

---

## Non-Goals

- **Interactive web applications.** This is for landing pages and static sites.
- **Single-file standalone HTML exports.** Media (videos) requires bundling.
- **A general-purpose website builder.** Built for one author, with one taste.
- **Scene-to-scene transitions or navigation in the editor.** Navigation is a rendered-website concern. The editor views one scene at a time.
- **A defined production deployment pipeline on day one.** The priority is the authoring and composition model. Build/deploy come later.
- **Real-time multi-author collaboration.** The agent and the human are not editing simultaneously.
