# MELEE 3 Font App

Vite application for inspecting and tuning the MELEE 3 generated SVG layer system.

```bash
make font-melee3-install
make font-melee3-app
```

Open:

```text
http://localhost:4177
```

The app reads and writes the generation workspace:

```text
apps/font-creation/generation/melee-3
```

`Regenerate SVGs` posts the current layer controls to the Vite dev-server API. The API writes the recipe and runs the generation renderer, then the app reloads the generated SVG output.
