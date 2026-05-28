---
covers: Documentation entry point — three layers (Foundation, System Design, Implementation) for the MELEE scene-engine.
type: overview
---

# Documentation

Three-layer documentation for the MELEE scene-engine — the Next.js app and desktop shell under `apps/scene-engine/` that author, render, export, and package video-game-screen landing pages as composed scenes.

Read in order. Each layer answers a different question.

---

## Layers

### [00-foundation/](00-foundation/00-overview.md)
**Why and what.** The problem the scene-engine solves, the mental model behind it, and the principles that shape decisions.

### [10-system-design/](10-system-design/00-overview.md)
**The blueprint.** System-agnostic description of how scenes, assets, layers, project workspaces, export, and authoring surfaces fit together. Read before changing behavior.

### [20-implementation/](20-implementation/00-overview.md)
**The codebase.** How `apps/scene-engine/` actually delivers the design — renderer, editor, dev server API, desktop shell, Pi Agent bridge, and appendix material.

---

## Scope

This documentation covers the **scene-engine** (`apps/scene-engine/`). Other apps in the monorepo —
`apps/asset-extraction-pipeline/`, `apps/pi-asset-loop/`, `apps/font-creation/` — feed assets into the
scene-engine but are documented in their own READMEs and `SYSTEM_DESIGN.md` at the repository root.
