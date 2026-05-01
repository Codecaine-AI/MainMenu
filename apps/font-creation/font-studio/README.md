# Font Studio

Font Studio is the layered SVG font asset tool. It combines a browser editor,
a Python SVG renderer, and project workspaces that hold glyph paths, recipes,
and generated outputs.

```text
font-studio/
  web/                  Vite editor and local API server
  renderer/             Python layered-SVG renderer and tests
  projects/
    melee/              Current MELEE font project data
      inputs/           Traced glyph paths and media assets
      recipes/          Editable render recipes
      outputs/          Generated SVGs, debug maps, and baked assets
  docs/                 Pipeline and recipe documentation
```

The browser still serves project files under `/generation/...` so existing
recipes and generated SVGs can keep stable media URLs. On disk, those files now
come from `projects/melee`.

Run the editor:

```bash
make font-melee3-install
make font-melee3-app
```

Install renderer dependencies when using a fresh Python environment:

```bash
cd apps/font-creation/font-studio/renderer
python3 -m pip install -r requirements.txt
```

Render from the command line:

```bash
cd apps/font-creation/font-studio/renderer
python3 -m scripts.render_recipe
```

The default renderer project is `../projects/melee`. Use `--paths`,
`--recipe`, and `--out-dir` to render another project or recipe explicitly.
