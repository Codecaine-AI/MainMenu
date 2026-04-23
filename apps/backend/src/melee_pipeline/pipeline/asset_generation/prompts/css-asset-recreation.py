from __future__ import annotations

import json
from textwrap import dedent
from typing import Any


def build_prompt(
    *,
    asset: Any,
    implementation_mode: Any,
    iteration: int,
    previous_report: Any | None,
    target_size: Any,
) -> str:
    parts = [
        dedent(
            """
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

            <mindset>
            Approach the image like a reconstruction artist. First decide what the main massing and silhouette are doing. Then infer the smallest believable set of structural layers that could produce the look: face, rim, inner panel, bevel, glow, shadow, ornament, and text. Prefer a coherent construction over a pile of ad hoc effects. The goal is not to make something merely similar at a glance; the goal is to make the reference feel inevitable when the result is rendered at the same size.
            </mindset>

            <inputs>
            The loop provides:
            1. `asset.json`
            2. `extracted.png`
            3. Target output files: `component.html`, `component.css`
            4. Optionally the previous `report.json` and prior implementation files for an iteration pass
            </inputs>

            <process>
            Read `asset.json` for the contract, then study `extracted.png` for the actual visual truth. Choose the simplest implementation mode that still preserves editability: pure CSS when the geometry is regular, CSS plus inline SVG when the silhouette or curves need exact control, and raster assistance only for small texture details or noise that would otherwise become brittle. Build at the asset's native aspect ratio with a wrapper that stays tight to the visual bounds. If a previous `report.json` exists, treat it as a continuation pass and repair those defects directly instead of casually rewriting from scratch.
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
            """
        ).strip(),
        "",
        "Treat this as a faithful reconstruction brief, not a generic UI design task. Study the reference "
        "image like an art director and reverse-engineer how it was probably built: silhouette first, then "
        "the big structural layers, then borders, gradients, glow, shadow, texture, and finally any text or "
        "small accents. Favor a build that a later engineer could actually edit and iterate on.",
        "",
        "Return JSON only with this shape:",
        json.dumps(
            {
                "implementation_mode": implementation_mode.value,
                "html": "<div>...</div>",
                "css": ".component { }",
                "notes": ["short implementation note"],
                "raster_dependencies": [],
            },
            indent=2,
        ),
        "",
        "Write the implementation so the root shape lands tightly inside the asset bounds, including any glow "
        "or shadow spill. `html` must be a snippet for insertion inside a wrapper div, not a full document, "
        "and `css` must contain everything needed to render it. Use inline SVG whenever the silhouette, "
        "notches, curves, or projected geometry need more precision than CSS alone can provide.",
        "",
        f"The final render must resolve to exactly {target_size.width}px by {target_size.height}px.",
        "",
        f"Iteration: {iteration}",
        f"Requested implementation mode: {implementation_mode.value}",
        f"Reference image size: {target_size.width}x{target_size.height}",
        "",
        "Asset metadata JSON:",
        json.dumps(asset.model_dump(mode='json'), indent=2),
    ]
    if previous_report is not None:
        parts.extend(
            [
                "",
                "The previous critique report is included below. Treat it as strict art direction and fix those "
                "defects directly unless the current structure is so wrong that a partial rebuild is the cleaner move:",
                previous_report.model_dump_json(indent=2),
            ]
        )
    return "\n".join(parts)
