# Font Studio File Map

Font Studio is split into editor code, renderer code, and project data.

```text
font-studio/
  web/                  Vite editor and local API server
  renderer/             Python renderer package and tests
    requirements.txt    Python dependencies for rendering and tests
  projects/
    melee/
      inputs/           Traced glyph paths and media assets
      recipes/          Editable layer recipes
      outputs/generated CSS-layered SVGs produced from recipes
  docs/                 Human-facing architecture notes
```

Regenerate outputs from the current recipe:

```bash
make font-melee3-generate
```

The renderer uses:

```text
projects/melee/inputs/glyph_paths.json
projects/melee/recipes/layer-recipe.json
projects/melee/outputs/generated/
```
