# Main Menu

Main Menu is the authoring environment for the **MELEE scene engine**: a
Next.js and Electron tool for building fixed-viewport, video-game-style web
experiences from reusable scenes, assets, and components.

The project grew from a recreation of the *Super Smash Bros. Melee* menu. It
now treats each page as a 1440×1080 scene made from typed layers. The same
project files can be edited in the browser editor, by the desktop app's agent,
or directly as JSON, then rendered or exported as a standalone site.

## How it works

- External projects are discovered through a local workspace catalog.
- Each project keeps scenes, media, modules, fonts, and registries in its own
  workspace; this repository contains the engine rather than the site content.
- A framework-free JavaScript renderer turns scene objects into DOM.
- A React/Zustand editor and Next.js route handlers load, edit, and save the
  same project files.
- The Electron shell packages the editor as the **Main Menu** desktop app and
  provides the native bridge for Pi Agent sessions.

## Repository layout

```text
apps/scene-engine/   Next.js editor, renderer, APIs, Electron shell, and tools
docs/scene-engine/   Foundation, system-design, implementation, and runbook docs
dev-notes/           Dated engineering and asset-workflow notes
panel-artwork/       Editable SVG artwork generators and style references
to_add/              Source images and video references awaiting integration
ai_docs/             Local reference material for supporting tools and APIs
MOTION.md            Motion language, easing curves, and current menu timings
Makefile             Common development, desktop, build, and pipeline commands
```

## Run locally

Create `apps/scene-engine/workspace.catalog.json` from
`workspace.catalog.example.json` and point its project root at a compatible
external workspace.

```bash
make install
make dev
```

The dashboard is available at <http://localhost:3000>. Equivalent app-local
commands are `npm install` and `npm run dev` from `apps/scene-engine/`.

For the Electron authoring app, run `make desktop`. Production builds use
`make build`; `make preview` builds and serves the Next.js app locally.
An unpacked macOS app can be produced with `npm run desktop:pack:mac` from
`apps/scene-engine/`.

## Current status

The engine currently supports browser and desktop authoring, project and scene
navigation, schema-driven inspection, asset upload and selection, Pi Agent
integration, standalone ZIP export, and a project deploy endpoint.

The active Codecaine workspace is external to this repository. Its implemented
scenes are `title` and `menu`; projects, testimonials, links, about, and
guestbook remain planned migrations from the retired frontend. macOS directory
packaging is available, but signing, notarization, auto-update, and installer
distribution are not yet part of the workflow.

See [`docs/scene-engine/`](docs/scene-engine/00-overview.md) for the architecture
and [`apps/scene-engine/agents.md`](apps/scene-engine/agents.md) for detailed
authoring and verification guidance.
