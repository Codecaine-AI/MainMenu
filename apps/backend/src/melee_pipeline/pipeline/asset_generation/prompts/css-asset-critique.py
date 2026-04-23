from __future__ import annotations

import json
from textwrap import dedent
from typing import Any


def build_prompt(*, asset: Any, iteration: int, threshold: float) -> str:
    return (
        dedent(
            """
            <purpose>
            Compare a rendered HTML/CSS asset recreation against its extracted reference image and produce a strict, actionable report for the next iteration of the loop.
            </purpose>

            <rules>
            - Be severe, specific, and visual. Do not give credit for effort.
            - The reference image is the ground truth. Judge the render only by fidelity to that image.
            - Call out concrete visual defects: silhouette, perspective, border thickness, corner radius, glow intensity, gradient direction, shadow spread, color drift, texture mismatch, alignment drift, alpha edge damage.
            - Prefer "what is wrong and how to fix it" over general commentary.
            - Do not praise acceptable areas unless that matters to prevent regressions.
            - If the render uses raster fallback, say whether that fallback is justified or should be replaced with CSS/SVG.
            - Return structured JSON only. No prose outside the JSON object.
            </rules>

            <inputs>
            The loop provides:
            1. `asset.json`
            2. `extracted.png` as the reference image
            3. `render.png` as the current implementation render
            4. Optionally the current `component.html` and `component.css`
            </inputs>

            <comparison_method>
            - Compare the attached reference and render images directly.
            - Judge what is actually visible, not what a pixel-diff heuristic might have highlighted.
            </comparison_method>

            <output_format>
            Return a JSON object with this shape:

            {
              "asset_id": "asset_01",
              "iteration": 2,
              "implementation_mode": "pure_css | css_svg_hybrid | raster_backed | video_background",
              "component_html": "component.html",
              "component_css": "component.css",
              "reference_image": "extracted.png",
              "render": "render.png",
              "score": 0.0,
              "threshold": 0.0,
              "accepted": false,
              "notes": [
                "One-line summary of the most important remaining defect."
              ],
              "raster_dependencies": [],
              "issues": [
                {
                  "category": "Free-form short tag such as silhouette, perspective, border, glow, gradient, color, shadow, texture, alignment, typography, alpha_edge, corner_radius, spacing, or outline",
                  "severity": "Free-form short tag such as blocker, major, minor, nit, high, medium, or low",
                  "summary": "Specific statement of what is wrong.",
                  "region": "Optional localized region such as 'upper-right notch' or 'left outer rim'.",
                  "evidence": "Short explanation tied to the diff or visible mismatch.",
                  "suggested_fix": "Concrete next action."
                }
              ]
            }
            </output_format>

            <issue_guidance>
            - `category` should be a short visual label, not a sentence.
            - Good examples for `category`: `silhouette`, `corner_radius`, `border`, `glow`, `gradient`, `color`, `alignment`, `spacing`, `outline`, `alpha_edge`.
            - Good examples for `severity`: `blocker`, `major`, `minor`, `nit`, `high`, `medium`, `low`.
            - Prefer consistent tags within one report, but do not force a fixed vocabulary if a more precise label helps.
            </issue_guidance>

            <scoring_guidance>
            - Use `score` in the range `0.0` to `1.0`, where `1.0` means a nearly exact visual match.
            - Set `accepted` to `true` only when the remaining defects are minor enough to ship for this asset class.
            - Panels, frames, and projected UI elements should be graded more harshly on silhouette and border accuracy than on subtle texture noise.
            - `threshold` should reflect the acceptance bar used for this asset, not merely the current score.
            </scoring_guidance>
            """
        ).strip()
        + "\n\n"
        + "Two images are attached in this order: first the extracted reference asset, then the current render. Compare those two images directly and judge only the visible result.\n\n"
        + f"Iteration: {iteration}\n"
        + f"Acceptance threshold: {threshold:.3f}\n\n"
        + "Asset metadata JSON:\n"
        + f"{json.dumps(asset.model_dump(mode='json'), indent=2)}"
    )
