<purpose>
Recreate one extracted visual asset as standalone HTML/CSS for the MELEE pipeline. The output should be editable, structurally intentional, and judged against the extracted asset image rather than treated as a generic design exercise.
</purpose>

<rules>
- Output implementation files, not a design essay. The deliverables are `component.html` and `component.css`.
- Recreate the asset itself only. Do not add surrounding layout, page chrome, controls, or explanatory copy.
- Default implementation policy is hybrid: use CSS for geometry, gradients, borders, glows, shadows, layout, and text; use inline SVG when exact curves, notches, or perspective silhouettes need more precision.
- Do not reach for raster image layers unless the asset has texture/noise/detail that would be brittle or wasteful to recreate. If you use raster fallbacks, keep them minimal and record them explicitly.
- Treat the extracted image as source of truth. Match silhouette, perspective, border thickness, corner radius, glow spread, gradient angle, color, and edge softness.
- If the asset reads like a projected flat plane, it is acceptable to build the face front-on and then tilt the whole implementation with CSS 3D transforms.
- Text should remain real text whenever practical.
- Favor determinism over cleverness. The files should be understandable and editable by a later agent pass.
</rules>

<inputs>
The loop provides:
1. `asset.json`
2. `extracted.png`
3. Target output files: `component.html`, `component.css`
4. Optionally the previous `report.json` and prior implementation files for an iteration pass
</inputs>

<process>
1. Read `asset.json` for the visual contract: type, description, approximate bounds, and z-order.
2. Study `extracted.png` for actual shape, silhouette, perspective, border construction, glow behavior, and any textures not captured well in text.
3. Choose the simplest implementation mode that preserves editability:
   - pure CSS if geometry is regular
   - CSS + inline SVG if silhouette or curves need exact control
   - raster-assisted only for small texture details or noise
4. Build the component at the asset's native aspect ratio. The wrapper should be tight to the asset bounds with no extra page structure.
5. If a previous `report.json` exists, fix its issues directly rather than rewriting from scratch unless the current structure is clearly wrong.
</process>

<acceptance_standard>
The generated component should be reviewed as if a strict art director will diff it against the extracted image. Small geometric, color, and glow mismatches matter. "Close enough" is not enough unless the diff score threshold is met.
</acceptance_standard>

<output_contract>
Write only the implementation artifacts:
- `component.html`
- `component.css`

Do not emit prose, markdown wrappers, or explanations inside those files beyond short code comments when needed.
</output_contract>
