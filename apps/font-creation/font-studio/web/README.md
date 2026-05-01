# Font Studio Web

Vite application for inspecting and tuning generated layered SVG font assets.

```bash
make font-melee3-install
make font-melee3-app
```

Open:

```text
http://localhost:4177
```

The app reads and writes the active project workspace:

```text
apps/font-creation/font-studio/projects/melee
```

`Save` posts the current recipe controls to the Vite dev-server API. The API
writes the recipe, runs the Python renderer from `../renderer`, and then the
app reloads the generated SVG output.
