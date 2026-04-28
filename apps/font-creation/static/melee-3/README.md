# MELEE 3 Static Layer Lab

Stable copy of the most recent `melee-3` font run:

```text
apps/font-creation/output/runs/melee-3/20260427-203602
```

The browser lab in `index.html` loads copied SVG assets from `assets/` and inlines them so `lab.css` can target the original SVG layer IDs directly.

Run it with a static server:

```bash
cd apps/font-creation/static/melee-3
python3 -m http.server 4177
```

Open:

```text
http://localhost:4177
```

Useful edit points:

```text
lab.css       CSS variables, stage treatment, and layer transforms
lab.js        presets, asset loading, layer toggles, and generated extra rim bands
layer-recipe.json
              editable recipe for baked SVG layers, widths, colors, offsets, gradients
render_recipe.py
              regenerates recipe-based SVGs from traced path data
assets/word   composed word SVG
assets/glyphs individual glyph SVGs
assets/upscaled/images
              copied Gemini upscaled glyph PNGs
assets/trace  copied masks, trace masks, and glyph_paths.json
generated/    SVGs rendered from layer-recipe.json
```

The `Original Widths` controls change the real `stroke-width` values on the generated SVG groups.

The `Rim Builder` controls clone `#silver-rim-layer` into a generated `#extra-rim-layer`. Use `Extra Rims`, `Start Width`, `Width Step`, and `Curve` to build a stepped bevel. Use `Offset`, `Oppose`, and `Angle` to push bands in the same direction or split them in opposite directions for pointed/ridged border experiments.

## Regenerate CSS-layered SVGs

Edit `layer-recipe.json`, then run:

```bash
cd apps/font-creation/static/melee-3
python3 render_recipe.py
```

This writes:

```text
generated/word/CODECAINE.css-layers.svg
generated/glyphs/*.css-layers.svg
```

The recipe renderer does not retrace pixels. It uses `assets/trace/paths/glyph_paths.json` and changes how layers are built around those traced paths.

## Retrace from copied upscales

The copied upscales are in:

```text
assets/upscaled/images
```

The run-relative segment file and compatibility paths are also preserved:

```text
assets/01_segment/segments.json
assets/01_segment/crops
assets/02_upscale/upscaled/images -> assets/upscaled/images
assets/config/style.json
```

To experiment with retracing, edit `assets/config/style.json`, then run:

```bash
apps/font-creation/.venv/bin/python apps/font-creation/scripts/03_trace_fill_paths.py \
  --segments apps/font-creation/static/melee-3/assets/01_segment/segments.json \
  --style apps/font-creation/static/melee-3/assets/config/style.json \
  --out apps/font-creation/static/melee-3/assets/retrace-smoke \
  --require-upscaled \
  --path-base apps/font-creation/static/melee-3/assets
```

That writes fresh masks, trace masks, and `glyph_paths.json` under `assets/retrace-smoke`. Point `render_recipe.py --paths` at that new `glyph_paths.json` if you want to rebuild the CSS-layered SVGs from a retrace.
