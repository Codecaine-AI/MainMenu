# Font Creation Pipeline - Mask Tuning Controls

This document explains how to tune the mask extraction stage of the Codecaine SVG pipeline.

The pipeline has two separate failure points:

```text
crop image → fill mask → traced SVG path → layered SVG render
```

If the crop looks good but the SVG looks bad, tune in this order:

1. **Mask extraction** — make the white mask correctly cover the red letter interior.
2. **Trace smoothing** — make the SVG curve smooth after the mask is structurally correct.
3. **SVG style** — adjust rim, shadow, highlight, and fill colors only after the path is good.

Do not tune the final SVG first. Tune the overlay preview first.

---

## Quick diagnostic command

From the app folder:

```bash
RUN_DIR=$(cat output/runs/latest.txt)

python3 scripts/06_debug_mask_tuning.py \
  --glyph 2 \
  --style "$RUN_DIR/inputs/style.json" \
  --out "$RUN_DIR/01_segment" \
  --debug-out "$RUN_DIR/03_trace/debug/mask_tuning/2"
```

For another glyph:

```bash
python3 scripts/06_debug_mask_tuning.py \
  --glyph A \
  --style "$RUN_DIR/inputs/style.json" \
  --out "$RUN_DIR/01_segment" \
  --debug-out "$RUN_DIR/03_trace/debug/mask_tuning/A"
```

For a direct crop path:

```bash
python3 scripts/06_debug_mask_tuning.py \
  --crop "$RUN_DIR/01_segment/crops/2.png" \
  --style "$RUN_DIR/inputs/style.json" \
  --debug-out "$RUN_DIR/03_trace/debug/mask_tuning/2"
```

This creates:

```text
$RUN_DIR/03_trace/debug/mask_tuning/<glyph>/mask_grid.png
$RUN_DIR/03_trace/debug/mask_tuning/<glyph>/overlay_grid.png
$RUN_DIR/03_trace/debug/mask_tuning/<glyph>/report.json
```

Use `overlay_grid.png` as the main tuning reference.

---

## What a correct overlay looks like

In the overlay grid, the red overlay should cover only the **inner red fill** of the glyph.

Correct:

```text
red interior included
silver rim excluded
white bevel excluded
black drop shadow excluded
background excluded
true counters/holes preserved
small red texture gaps mostly repaired
```

Incorrect:

```text
silver rim included
white bevel included
drop shadow included
interior red fill missing
letter counters filled accidentally
separate bevel grooves merged into one blob
small punctuation erased
```

The mask should represent the **structural fill silhouette**, not the full rendered artwork.

---

## Recommended tuning order

Use this order every time:

```text
1. Check crop quality.
2. Run mask tuning preview for the problem glyph.
3. Pick the best overlay variant.
4. Copy that variant’s settings into config/style.json.
5. Re-run tracing.
6. Check `$RUN_DIR/03_trace/debug/trace_masks/<glyph>.png`.
7. Check final SVG.
8. Only then adjust SVG style.
```

After changing the run's `inputs/style.json`, regenerate masks and paths:

```bash
python3 scripts/run_pipeline.py \
  --run-dir "$RUN_DIR" \
  --from-step trace \
  --through-step svgs \
  --no-upscale
```

Then render a word:

```bash
python3 scripts/05_render_word_svg.py \
  --text CODECAINE \
  --paths "$RUN_DIR/03_trace/paths/glyph_paths.json" \
  --style "$RUN_DIR/inputs/style.json" \
  --out "$RUN_DIR/05_preview/words/CODECAINE.svg" \
  --tracking 4
```

---

## `fill_extraction` controls

These live in:

```text
config/style.json
```

Under:

```json
"fill_extraction": { ... }
```

Example baseline:

```json
"fill_extraction": {
  "red_hue_low": 15,
  "red_hue_high": 165,
  "min_saturation": 35,
  "min_value": 20,
  "median_blur": 3,
  "close_kernel": 9,
  "close_iterations": 2,
  "open_kernel": 3,
  "open_iterations": 1,
  "min_component_area_px": 18,
  "fill_holes_smaller_than_area_ratio": 0.012,
  "use_allowed_region_reconstruction": false,
  "allowed_max_value": 170,
  "allowed_min_saturation": 5,
  "reconstruction_close_kernel": 7,
  "reconstruction_close_iterations": 1,
  "mode": "red_only"
}
```

---

## Core extraction model

The mask extractor converts the crop to HSV and creates a red seed mask.

OpenCV HSV hue range is:

```text
0–179
```

A pixel is considered red if:

```text
hue <= red_hue_low OR hue >= red_hue_high
```

and:

```text
saturation >= min_saturation
value >= min_value
```

Default red range:

```json
"red_hue_low": 15,
"red_hue_high": 165
```

This captures red near the low and high ends of the OpenCV hue circle.

---

## Control reference

| Setting | What it controls | Increase when | Decrease when | Starting range |
|---|---|---|---|---|
| `mode` | Main extraction method | Use `red_seed_reconstruction` only when dark interior areas are missing badly | Use `red_only` to preserve bevel gaps and avoid flooding | `red_only` |
| `red_hue_low` | Low-side red hue capture | Orange/red fill is being missed | Non-red pixels are included | `10–20` |
| `red_hue_high` | High-side red hue capture | Purple/magenta red fill is being missed | Non-red pixels are included | `160–170` |
| `min_saturation` | How strongly red a pixel must be | Gray/silver bevel leaks into mask | Dark/desaturated red interior is missing | `25–45` |
| `min_value` | Minimum brightness | Black shadow is leaking in | Dark red texture is missing | `10–35` |
| `median_blur` | Speckle cleanup before morphology | Single-pixel noise appears | Fine details disappear | `0, 1, 3, 5` |
| `close_kernel` | Repairs cracks/gaps in the red fill | The mask has interior breaks or texture holes | Bevel grooves or counters start merging | `5–13` |
| `close_iterations` | Repeats close operation | Cracks remain after one close | Shapes become bloated or merged | `1–3` |
| `open_kernel` | Removes small islands/noise | Random specks survive | Punctuation or thin parts disappear | `0–5` |
| `open_iterations` | Repeats open operation | Speckle noise survives | Real details are erased | `0–2` |
| `min_component_area_px` | Removes tiny disconnected components | Noise dots survive | Small punctuation vanishes | `0–30` |
| `fill_holes_smaller_than_area_ratio` | Fills tiny holes inside the mask | Red texture holes remain | True counters or bevel cuts are filled | `0.004–0.02` |
| `use_allowed_region_reconstruction` | Legacy reconstruction toggle | Usually leave false | Usually leave false | `false` |
| `allowed_max_value` | Reconstruction dark-region ceiling | Reconstruction misses dark interior | Reconstruction swallows rim/shadow | `145–170` |
| `allowed_min_saturation` | Reconstruction saturation floor | Reconstruction misses desaturated red | Reconstruction includes gray bevel | `5–25` |
| `reconstruction_close_kernel` | Closing after reconstruction | Reconstruction has cracks | Reconstruction over-merges | `3–9` |
| `reconstruction_close_iterations` | Repeats reconstruction close | Reconstruction has cracks | Reconstruction over-merges | `0–2` |

---

## Extraction modes

### `red_only`

Recommended default:

```json
"mode": "red_only",
"use_allowed_region_reconstruction": false
```

This only captures pixels that are actually red enough.

Use when:

```text
silver bevels need to stay out
metallic grooves should remain separated
letters like 2, S, Q, R are flooding into blobs
```

This is usually the correct mode for the current alphabet sheet.

---

### `red_seed_reconstruction`

Use only when necessary:

```json
"mode": "red_seed_reconstruction"
```

This starts from red seed pixels, then expands into connected dark regions that meet the `allowed_*` rules.

Use when:

```text
large areas of dark red/black interior texture are missing
red_only produces a broken, incomplete letter
```

Avoid when:

```text
silver bevel grooves are being swallowed
letter counters are filling
shape becomes a thick blob
```

For glyphs like `2`, reconstruction is often too aggressive.

---

## Practical presets

### Safe default

Use this for most glyphs:

```json
"fill_extraction": {
  "mode": "red_only",
  "use_allowed_region_reconstruction": false,
  "red_hue_low": 15,
  "red_hue_high": 165,
  "min_saturation": 35,
  "min_value": 20,
  "median_blur": 3,
  "close_kernel": 9,
  "close_iterations": 2,
  "open_kernel": 3,
  "open_iterations": 1,
  "min_component_area_px": 18,
  "fill_holes_smaller_than_area_ratio": 0.012
}
```

---

### More interior capture

Use when the red interior is incomplete:

```json
"fill_extraction": {
  "mode": "red_only",
  "use_allowed_region_reconstruction": false,
  "red_hue_low": 15,
  "red_hue_high": 165,
  "min_saturation": 25,
  "min_value": 15,
  "median_blur": 3,
  "close_kernel": 11,
  "close_iterations": 2,
  "open_kernel": 3,
  "open_iterations": 1,
  "min_component_area_px": 12,
  "fill_holes_smaller_than_area_ratio": 0.02
}
```

Risk:

```text
may include bevel pixels
may merge internal grooves
```

---

### More conservative extraction

Use when the silver/gray bevel leaks into the mask:

```json
"fill_extraction": {
  "mode": "red_only",
  "use_allowed_region_reconstruction": false,
  "red_hue_low": 12,
  "red_hue_high": 168,
  "min_saturation": 45,
  "min_value": 25,
  "median_blur": 3,
  "close_kernel": 7,
  "close_iterations": 1,
  "open_kernel": 3,
  "open_iterations": 1,
  "min_component_area_px": 18,
  "fill_holes_smaller_than_area_ratio": 0.006
}
```

Risk:

```text
may miss dark red texture
may fragment the fill
```

---

### Hole-sensitive glyphs

Use when `A`, `D`, `O`, `P`, `Q`, `R`, `0`, `4`, `6`, `8`, or `9` lose counters/holes:

```json
"fill_extraction": {
  "mode": "red_only",
  "use_allowed_region_reconstruction": false,
  "red_hue_low": 15,
  "red_hue_high": 165,
  "min_saturation": 35,
  "min_value": 20,
  "median_blur": 3,
  "close_kernel": 7,
  "close_iterations": 1,
  "open_kernel": 3,
  "open_iterations": 1,
  "min_component_area_px": 12,
  "fill_holes_smaller_than_area_ratio": 0.004
}
```

Risk:

```text
small texture holes may remain
```

---

### Thin punctuation

Use when punctuation disappears or breaks apart:

```json
"fill_extraction": {
  "mode": "red_only",
  "use_allowed_region_reconstruction": false,
  "red_hue_low": 15,
  "red_hue_high": 165,
  "min_saturation": 25,
  "min_value": 15,
  "median_blur": 1,
  "close_kernel": 5,
  "close_iterations": 1,
  "open_kernel": 0,
  "open_iterations": 0,
  "min_component_area_px": 0,
  "fill_holes_smaller_than_area_ratio": 0.004
}
```

Risk:

```text
more noise may survive
```

---

## `trace` controls

Mask extraction decides the shape. Trace controls decide how that shape becomes an SVG path.

These live under:

```json
"trace": { ... }
```

Example baseline:

```json
"trace": {
  "backend": "cv2",
  "approx_epsilon_px": 5.0,
  "path_mode": "cubic_smooth",
  "pretrace_upscale": 6,
  "pretrace_blur": 4.0,
  "pretrace_threshold": 127,
  "cubic_tension": 0.65,
  "min_contour_area_px": 8,
  "save_trace_masks": true
}
```

---

## Trace control reference

| Setting | What it controls | Increase when | Decrease when | Starting range |
|---|---|---|---|---|
| `path_mode` | Path command type | Use `cubic_smooth` for smoother curves | Use straight paths only for debugging | `cubic_smooth` |
| `pretrace_upscale` | Upscales mask before tracing | SVG is stair-stepped or blocky | Trace becomes slow or over-smoothed | `4–8` |
| `pretrace_blur` | Blurs upscaled mask before thresholding | Curves are jagged | Corners/details are too soft | `2.0–6.0` |
| `pretrace_threshold` | Re-threshold after blur | Raise to shrink/clarify mask | Lower to expand/retain thin areas | `110–150` |
| `approx_epsilon_px` | Contour simplification amount | Too many points / noisy curves | Important shape details are lost | `3.0–7.0` |
| `cubic_tension` | Bezier handle strength | Curves need more softness | Curves overshoot or look inflated | `0.45–0.85` |
| `min_contour_area_px` | Removes tiny traced contours | Tiny fragments remain | Small punctuation disappears | `0–50` |
| `save_trace_masks` | Saves processed trace masks | Keep true while tuning | Turn off only for cleaner output | `true` |

---

## Trace smoothing preset

Use when the mask is structurally correct but the SVG looks jagged:

```json
"trace": {
  "backend": "cv2",
  "path_mode": "cubic_smooth",
  "pretrace_upscale": 6,
  "pretrace_blur": 4.0,
  "pretrace_threshold": 127,
  "approx_epsilon_px": 5.0,
  "cubic_tension": 0.65,
  "min_contour_area_px": 8,
  "save_trace_masks": true
}
```

More smoothing:

```json
"pretrace_upscale": 8,
"pretrace_blur": 5.0,
"approx_epsilon_px": 6.0,
"cubic_tension": 0.75
```

More fidelity:

```json
"pretrace_upscale": 6,
"pretrace_blur": 2.5,
"approx_epsilon_px": 3.0,
"cubic_tension": 0.55
```

---

## Symptom-to-control map

| Symptom | First controls to adjust |
|---|---|
| Red interior missing | Lower `min_saturation`, lower `min_value`, slightly widen hue range |
| Dark red texture missing | Lower `min_value`, lower `min_saturation`, consider strict reconstruction |
| Silver/white rim included | Raise `min_saturation`, use `red_only`, reduce `close_kernel`, reduce reconstruction |
| Black shadow included | Raise `min_value`, avoid reconstruction, reduce `allowed_max_value` |
| Mask has cracks | Increase `close_kernel`, increase `close_iterations`, increase `fill_holes_smaller_than_area_ratio` |
| Mask becomes a blob | Reduce `close_kernel`, reduce `close_iterations`, lower `fill_holes_smaller_than_area_ratio`, use `red_only` |
| True holes/counters filled | Lower `fill_holes_smaller_than_area_ratio`, reduce `close_kernel`, avoid reconstruction |
| Small punctuation disappears | Lower `min_component_area_px`, lower or disable `open_kernel`, lower `min_saturation` |
| Too many tiny specks | Increase `open_kernel`, increase `min_component_area_px`, increase `median_blur` |
| SVG is jagged | Increase `pretrace_upscale`, increase `pretrace_blur`, use `cubic_smooth` |
| SVG loses sharp detail | Lower `pretrace_blur`, lower `approx_epsilon_px`, lower `cubic_tension` |
| SVG too bloated | Raise `pretrace_threshold`, lower `pretrace_blur` |
| SVG too thin | Lower `pretrace_threshold`, lower `min_value`, lower `min_saturation` |

---

## Reading the tuning grid

The debug script generates these default variants:

```text
base_from_style
red_only_sat45
red_only_sat35
red_only_sat25
close_less_9x1
close_more_11x2
open_off
recon_strict
recon_medium
recon_loose
tiny_holes_fill_more
tiny_holes_fill_less
```

Use them as directional probes:

```text
red_only_sat45       stricter red selection
red_only_sat25       looser red selection
close_less_9x1       less gap repair, less merging
close_more_11x2      more gap repair, more merging
open_off             preserves tiny details, also preserves noise
recon_strict         cautious dark-region expansion
recon_medium         stronger dark-region expansion
recon_loose          aggressive expansion, likely to over-merge
tiny_holes_fill_more fills more interior pinholes
tiny_holes_fill_less preserves counters/gaps better
```

Pick the variant whose overlay best covers the interior fill. Then transfer its settings into `config/style.json`.

---

## Specific advice for glyph `2`

For the current `2` crop, the usual failure is over-merging: the mask swallows internal bevel separations and turns the glyph into a rough blob.

Start with:

```json
"mode": "red_only",
"use_allowed_region_reconstruction": false,
"min_saturation": 35,
"close_kernel": 9,
"close_iterations": 2,
"fill_holes_smaller_than_area_ratio": 0.012
```

If it still captures too much bevel:

```json
"min_saturation": 45,
"close_kernel": 7,
"close_iterations": 1,
"fill_holes_smaller_than_area_ratio": 0.006
```

Avoid `recon_medium` and `recon_loose` for `2` unless the red interior is severely incomplete.

---

## High-resolution source rule

The smoother the source crop, the better the SVG.

A crop around `100 × 150 px` can be made usable, but it will never produce perfect font-grade outlines without smoothing or manual cleanup.

Quality hierarchy:

```text
high-res glyph sheet → clean mask → smooth SVG path
current-res glyph sheet → tuned mask → acceptable smoothed SVG path
current-res glyph sheet → raw mask → jagged SVG path
```

If possible, generate or source the alphabet sheet at 2×, 4×, or higher resolution before segmentation.

---

## Final tuning rule

Keep these separate:

```text
mask = the letter’s structural interior shape
trace = smooth vector version of the mask
SVG style = decorative silver rim, shadow, highlight, and fill
```

Do not use SVG style settings to fix a bad mask.

Do not use trace smoothing to fix a structurally wrong mask.

Get the overlay right first.
