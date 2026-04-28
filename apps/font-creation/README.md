# Font Creation Pipeline

A pipeline for turning a rendered alphabet sheet into layered SVG glyph assets for the Codecaine visual type system.

The important idea is simple:

```text
segment glyphs → upscale each crop with Gemini → extract the red interior silhouette → trace it to a clean path → generate all silver rim / shadow / highlight layers from that same path
```

This avoids manually redrawing every letter and avoids tracing the flattened image into a thousand noisy texture fragments.

## Quick start

```bash
cd apps/font-creation
python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt

python3 scripts/run_pipeline.py \
  --run-spec samples/melee/run.json \
  --out output

python3 scripts/05_render_word_svg.py \
  --text CODECAINE \
  --paths output/runs/melee/<timestamp>/03_trace/paths/glyph_paths.json \
  --style config/style.json \
  --out output/runs/melee/<timestamp>/05_preview/words/CODECAINE.svg \
  --tracking 4
```

Open:

```text
output/runs/latest.txt
output/runs/melee/<timestamp>/01_segment/debug/segmentation_preview.png
output/runs/melee/<timestamp>/04_svgs/glyphs/A.svg
output/runs/melee/<timestamp>/05_preview/words/CODECAINE.svg
```

## What the pipeline creates

```text
output/
  runs/
    latest.txt
    melee/
      <timestamp>/
        run.json
        status.json
        inputs/
        01_segment/      crops, segments.json, segmentation debug
        02_upscale/      square Gemini glyph images and request metadata
        03_trace/        masks, trace masks, glyph_paths.json
        04_svgs/         one layered SVG per glyph
        05_preview/      composed word SVGs
```

## Core files

```text
config/glyph-map.json
config/style.json

scripts/01_segment_glyph_sheet.py
scripts/02_upscale_glyphs.py
scripts/03_trace_fill_paths.py
scripts/04_build_layered_svgs.py
scripts/05_render_word_svg.py
scripts/run_pipeline.py
scripts/common.py
```

## Run workflow

Runs are named and timestamped so experiments do not overwrite each other:

```bash
python3 scripts/run_pipeline.py \
  --run-spec samples/melee/run.json \
  --out output
```

The runner snapshots the source image, description, glyph map, style file, and prompt into the run's `inputs/` directory. `run.json` records the resolved settings and `status.json` records each step's status and command.

Resume from a step:

```bash
python3 scripts/run_pipeline.py \
  --run-dir output/runs/melee/<timestamp> \
  --from-step trace \
  --through-step svgs
```

Run only segmentation:

```bash
python3 scripts/run_pipeline.py \
  --run-spec samples/melee/run.json \
  --through-step segment
```

## Upscaling

The full pipeline runs Gemini upscaling by default and expects credentials from `.env` or the environment variables supported by `google-genai`.

```bash
python3 scripts/run_pipeline.py \
  --run-spec samples/melee/run.json \
  --out output \
  --max-workers 4
```

For deterministic local debugging or CI, skip Gemini and trace the original segmented crops:

```bash
python3 scripts/run_pipeline.py \
  --run-spec samples/melee/run.json \
  --out output \
  --no-upscale
```

The prompt template is `prompts/upscale-glyph.md`. The pipeline replaces `{{USER_DESCRIPTION}}` with `samples/melee/description.md` unless `--prompt` or `--description` are provided.

## What to tune first

Start with these settings in `config/style.json`:

```json
{
  "segmentation": {
    "foreground_threshold_mode": "otsu",
    "row_projection_threshold": 30,
    "vertical_threshold_fractions": [0.03, 0.05, 0.08, 0.1, 0.15]
  },
  "fill_extraction": {
    "red_hue_low": 15,
    "red_hue_high": 165,
    "min_saturation": 35,
    "min_value": 20,
    "close_kernel": 9,
    "close_iterations": 2
  },
  "trace": {
    "approx_epsilon_px": 1.4
  }
}
```

If masks miss dark red interior: lower `min_value` and `min_saturation`.

If masks include silver/white border: raise `min_saturation` or tighten the red hue range.

If traced paths are too jagged: raise `approx_epsilon_px`.

If traced paths lose sharp serif details: lower `approx_epsilon_px`.

## Current limitations

This first version is built for testing. It is not a final type-design system yet.

Expected cleanup/tuning areas:

```text
thin punctuation
curly quotes
glyphs with counters: A, D, O, P, Q, R
kerning
exact bevel fidelity
path smoothing
```

The script deliberately creates the silver rim, shadow, and highlight procedurally from the fill path. It does not try to recover every rendered bevel pixel from the source sheet.

## Why SVG first

SVG is the correct test target because it can keep the interior fill clipped separately from the silver rim.

Once the traced fill paths look good, those same paths can be imported into a font editor or automated through FontForge.


## Mask tuning workflow

The crop segmentation can be correct while the SVG still looks bad. Treat these as two separate problems:

1. **Mask extraction**: whether the white mask covers the intended red fill regions.
2. **Path tracing**: whether the SVG path is smooth enough after the mask is correct.

Run a quick mask tuning grid for a glyph:

```bash
RUN_DIR=$(cat output/runs/latest.txt)

python3 scripts/06_debug_mask_tuning.py \
  --glyph 2 \
  --style "$RUN_DIR/inputs/style.json" \
  --out "$RUN_DIR/01_segment" \
  --debug-out "$RUN_DIR/03_trace/debug/mask_tuning/2"
```

Open:

```text
$RUN_DIR/03_trace/debug/mask_tuning/2/mask_grid.png
$RUN_DIR/03_trace/debug/mask_tuning/2/overlay_grid.png
```

Use the overlay grid first. The red overlay should cover the red interior fill and should not cover the silver bevel/cutout areas.

For this source sheet, the default should usually stay:

```json
"mode": "red_only",
"use_allowed_region_reconstruction": false
```

`red_seed_reconstruction` can fill very dark texture inside the letters, but it can also swallow the internal metallic grooves on glyphs like `2`, `S`, `G`, and `Q`.

Main mask controls:

```json
"min_saturation": 35
```

Lower this if the mask misses dark red fill. Raise it if the mask starts eating gray/silver bevels.

```json
"close_kernel": 9,
"close_iterations": 2
```

Increase these if the red interior has tiny cracks. Decrease them if separate red regions get bridged together.

```json
"fill_holes_smaller_than_area_ratio": 0.012
```

Increase slightly if texture holes remain. Decrease if counters or inner bevel gaps are being filled.

Main trace controls:

```json
"path_mode": "cubic_smooth",
"pretrace_upscale": 6,
"pretrace_blur": 4.0,
"approx_epsilon_px": 5.0,
"cubic_tension": 0.65
```

The saved mask can look pixelated because the crop is small. The trace settings upscale and smooth the mask before generating the SVG path. If the SVG is jagged, increase `pretrace_blur` or `approx_epsilon_px`. If the SVG loses sharp detail, lower them.

For the cleanest final font, use the highest-resolution alphabet sheet you can get. A 100-pixel-high crop cannot produce the same curve quality as a 1000-pixel-high source.
