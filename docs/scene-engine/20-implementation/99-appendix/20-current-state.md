---
covers: Snapshot of currently-shipped scenes and registered assets.
concepts: [snapshot, scenes, assets, inventory]
---

# Current State

Snapshot of what's in the scene-engine right now. Update by re-reading the active workspace catalog, `ProjectSettings/project.json`, `ProjectSettings/registries/assets.json`, and `ProjectSettings/registries/modules.json`.

---

## Workspace

The active Codecaine project is an external workspace, not the app-local legacy project folder.

| Concern | Current value |
| --- | --- |
| Catalog example | `apps/scene-engine/workspace.catalog.example.json` |
| Local catalog | `apps/scene-engine/workspace.catalog.json` (gitignored) |
| Active project root | `../codecaine-site/` from the MELEE repo root |
| Project layout | `ProjectSettings/`, `Assets/Scenes/`, `Assets/Media/`, `Assets/Modules/`, `Assets/Fonts/` |

Legacy app-local Codecaine files remain as fallback/source comparison data, but normal authoring and export resolve through the workspace catalog.

## Projects

| ID         | Name      | Entry | Scenes |
|------------|-----------|-------|--------|
| codecaine  | Codecaine | title | title, menu |

## Scenes

| ID    | Name         | Description                                                       |
|-------|--------------|-------------------------------------------------------------------|
| title | Title Screen | CODECAINE chrome logo, fire interleave, PRESS START, CRT, audio.  |
| menu  | Main Menu    | Main-menu background with a stateful nested main-menu component and inspector-editable menu graph. |

Other pages from the retired `apps/frontend/` (projects, testimonials, links, about, guestbook) are planned migrations but not yet implemented as scenes.

## Assets

Sources of truth for Codecaine: `../codecaine-site/ProjectSettings/registries/assets.json` and `../codecaine-site/ProjectSettings/registries/modules.json`.

| ID              | Type        | Path                                          |
|-----------------|-------------|-----------------------------------------------|
| `bg-video`      | video       | `/assets/video/test-fire-3.mp4`               |
| `in-text-fire`  | video       | `/assets/video/codecaine-title-fire-loop.webm` |
| `main-menu-bg-blue` | video   | `/assets/video/main-menu-backgrounds/blue.webm` |
| `main-menu-bg-green` | video  | `/assets/video/main-menu-backgrounds/green.webm` |
| `main-menu-bg-purple` | video | `/assets/video/main-menu-backgrounds/purple.webm` |
| `main-menu-bg-red` | video    | `/assets/video/main-menu-backgrounds/red.webm` |
| `main-menu-bg-yellow` | video | `/assets/video/main-menu-backgrounds/yellow.webm` |
| `codecaine-logo`| glyph       | `/assets/glyph/CODECAINE.css-layers.svg`      |
| `codecaine-rounded-chrome-logo` | glyph | `/assets/glyph/CODECAINE.rounded-chrome.css-layers.svg` |
| `start-cue`     | audio       | `/assets/audio/start-cue/start-cue.js`        |
| `ui-navigation` | audio       | `/assets/audio/ui-navigation/ui-navigation.js` |
| `ui-forward`    | audio       | `/assets/audio/ui-forward/ui-forward.js`      |
| `ui-back`       | audio       | `/assets/audio/ui-back/ui-back.js`            |
| `melee-menu-song` | audio     | `/assets/audio/melee-menu-song/melee-menu-song.js` |
| `crt-overlay`   | effect      | `/modules/effects/crt-overlay/crt-overlay.css` |
| `press-start`   | component   | `/modules/components/press-start/press-start.js` |
| `orbit-press-start` | component | `/modules/components/orbit-press-start/orbit-press-start.js` |
| `codecaine-keycap-start` | component | `/modules/components/codecaine-keycap-start/codecaine-keycap-start.js` |
| `procedural-sphere` | component | `/modules/components/procedural-sphere/procedural-sphere.js` |
| `procedural-cylinder` | component | `/modules/components/procedural-cylinder/procedural-cylinder.js` |
| `procedural-cylinder-strips-mask` | component | `/modules/components/procedural-cylinder-strips/procedural-cylinder-strips-straight.js` |
| `arc-letterbox` | component   | `/modules/components/arc-letterbox/arc-letterbox.js` |
| `menu-shield` | component   | `/modules/components/menu-shield/menu-shield.js` |
| `menu-items` | component   | `/modules/components/menu-items/menu-items.js` |
| `side-menu` | component   | `/modules/components/side-menu/side-menu.js` |
| `main-menu-system` | component | `/modules/components/main-menu-system/main-menu-system.js` |
| `main-menu-rings` | component | `/modules/components/main-menu-rings/main-menu-rings.js` |
| `background-pulse` | component | `/modules/components/background-pulse/background-pulse.js` |

The `main-menu-system` component now supports two configuration sources. The active scene stores an inline `properties.menu-config` object for editor-driven menu data, including menus, item nesting, previews, shared `menuTheming` for the gold row treatment/pulse, and named menu themes for shield/side-panel color changes. `/modules/components/main-menu-system/menu-config.json` remains the starter/fallback config when no inline graph is present.

## Title Scene Layer Stack

Outline (read full JSON in `../codecaine-site/Assets/Scenes/title/scene.json`):

1. `base-barber-cylinder` (component)
2. `procedural-sphere` (component)
3. `procedural-cylinder` (component)
4. `codecaine-rounded-chrome-logo` (glyph-group)
5. `text` (text)
6. `press-start` (component)
7. `smash-style-letterbox` (component)
8. `crt` (effect)

## Authoring Surfaces

| Surface | Current state |
| --- | --- |
| Browser dev editor | `/editor?project=codecaine&scene=title` or `menu` |
| Main Menu desktop app | Electron shell under `apps/scene-engine/desktop/`; opens the same editor route |
| Pi Agent | Chat panel docked below the hierarchy in the left sidebar; available through `window.mainMenu.agent` in desktop mode |

The desktop app keeps `contextIsolation: true` and `nodeIntegration: false`. Pi SDK sessions are owned by Electron main, not React.

## Export And Packaging

| Output | Command / Endpoint | Current behavior |
| --- | --- | --- |
| Standalone site zip | `POST /api/export?project=codecaine` | Exports active scenes, pruned active asset/module/font registries, `export-graph.json`, `Makefile`, and `server.mjs`. |
| Git deploy trigger | `POST /api/projects/codecaine/deploy` | Writes `ProjectSettings/deployment.json`, commits all `codecaine-site` changes, and pushes the current branch for Railway. |
| Local export preview | `make run` inside extracted zip | Serves the static export with Node. |
| Desktop app | `npm run desktop:pack:mac` in `apps/scene-engine` | Builds Next standalone runtime and packages `Main Menu.app` for macOS directory output. |
