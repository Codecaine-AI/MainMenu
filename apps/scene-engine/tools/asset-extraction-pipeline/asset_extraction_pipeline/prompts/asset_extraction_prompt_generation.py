from __future__ import annotations

import json
from textwrap import dedent
from typing import Any


def build_prompt(*, asset: Any) -> str:
    return (
        dedent(
            """
            <purpose>
            Translate a single asset entry from an inventory JSON into a production-ready image editing prompt that isolates that asset from its source image on a solid black or solid white background. Output is a flat natural-language prompt the user will paste into an image model in a fresh session along with the original image.
            </purpose>

            <rules>
            - Output ONLY the editing prompt text. No preamble, no JSON, no markdown, no labels, no explanation, no quotes wrapping the prompt.
            - Write as a creative director's brief: one or two focused narrative paragraphs in imperative voice, starting with a strong action verb (Isolate, Extract, Preserve).
            - Never name real people or use identifiers. Use generic terms: "the panel," "the frame," "the background layer."
            - Fidelity over enhancement. This is extraction, not redesign. Preserve original shape, color, border, texture, gradient, and proportions exactly as they appear in the source image. Do not add polish, stylization, lighting changes, or "improvements."
            - Output is always isolated-on-solid-color-background. The asset alone on either solid pure black (#000000) or solid pure white (#FFFFFF), chosen for maximum contrast against the asset.
            - Every prompt must include: the chosen background color stated explicitly, what to preserve (the asset, described in concrete visual terms from the JSON), what to remove (the specific surrounding or occluding elements), and the final output spec.
            </rules>

            <background_selection>
            Before writing the prompt, select the background color using this rule:

            1. Identify the asset's DOMINANT visible surface color from visual_description (the color covering the largest area of the asset, not the border or accent).
            2. Classify it on a lightness scale:
               - Light (white, cream, pale yellow, light gray, pastel) -> use SOLID BLACK background
               - Dark (black, navy, dark blue, deep red, dark gray, dark purple) -> use SOLID WHITE background
               - Mid-tone (mid gray, medium blue, orange, teal, brown) -> use SOLID BLACK background by default; use WHITE only if the asset has prominent dark borders or outlines that would blend into black
            3. Multi-color assets (vivid rainbow, gradient spanning light to dark): use SOLID BLACK background unless the asset contains large black regions, in which case use WHITE.

            State the chosen color explicitly in the prompt using hex (#000000 or #FFFFFF) AND the word (black or white). Do not hedge. Commit to one.
            </background_selection>

            <input_schema>
            Two inputs:
            1. The original image (attached).
            2. A single asset entry JSON with: id, name, type, visual_description, location, bounds, z_order, extraction_hint.
            </input_schema>

            <process>
            1. Read visual_description - this is the ground truth for what the asset looks like. Every visual detail mentioned (colors, borders, gradients, notches, glows, textures) must appear in the preservation language of the output prompt.
            2. Apply the background_selection rule. Commit to black or white before drafting.
            3. Read location and bounds - translate into spatial direction ("the centered main panel," "the full-frame background grid," "the vertically-tilted element on the right").
            4. Read extraction_hint - this is the authoritative statement of what to strip. Fold it into the removal clause.
            5. Branch on z_order:
               - If "front" or "overlay": the asset sits on top of other content. Removal is straightforward - strip everything behind and around it.
               - If "mid": other elements may be layered on top of the asset. Instruct the model to reconstruct the asset's surface cleanly where occluding elements were, so the extracted asset reads as complete.
               - If "back": the asset is a background or base layer, and foreground elements currently occlude large portions of it. Instruct the model to reconstruct the background's pattern, gradient, or texture continuously across all areas where foreground elements sat, using the visible portions as reference. The final output should look as though the foreground never existed.
            6. Assemble into a narrative prompt: extraction action -> concrete preservation language -> removal/reconstruction language specific to z_order -> final output specification (solid chosen-color background, trimmed appropriately).
            </process>

            <output_format>
            One or two paragraphs of natural language. No headings, no bullets, no quotes wrapping the whole output, no "Prompt:" label. Raw text only, ready to paste.
            </output_format>

            <example>
            <foreground_asset_input>
            {
              "id": "asset_03",
              "name": "main_menu_panel",
              "type": "panel",
              "visual_description": "Large rounded rectangular frame with gold/orange double-line border, dark blue interior fill, and a small circular notch on the upper-right. Subtle inner glow along the borders.",
              "location": "centered, occupies most of the frame",
              "bounds": "approximate [60, 40, 380, 320]",
              "z_order": "mid",
              "extraction_hint": "Preserve the gold-bordered frame shape and its dark blue interior. Remove all menu buttons, text labels, and the side info panel layered on top."
            }
            </foreground_asset_input>

            <good_output_for_foreground>
            Isolate the centered rounded rectangular menu panel from this image. Preserve its exact shape and proportions - the gold and orange double-line border, the dark blue interior fill, the subtle inner glow along the inside edges, and the small circular notch on the upper-right corner. Keep every pixel of the frame's color, gradient, and texture identical to the source; this is extraction, not redesign.

            Remove everything layered on top of or beside the panel: the vertical stack of menu buttons, all text labels, the tilted side information panel on the right, and all background imagery surrounding the panel. Where buttons and labels currently sit on top of the panel's interior, reconstruct the dark blue interior fill cleanly so the panel reads as an empty container. Place the extracted panel alone on a solid pure white (#FFFFFF) background, trimmed tightly to its bounding box with no surrounding artifacts. Solid white is chosen because the panel's dominant interior is dark blue, and white provides maximum contrast.
            </good_output_for_foreground>

            <background_asset_input>
            {
              "id": "asset_01",
              "name": "grid_background",
              "type": "background",
              "visual_description": "Full-screen dark blue gradient base with a faint glowing teal grid pattern, subtle purple and magenta light streaks radiating from the center-right.",
              "location": "full screen, backmost layer",
              "bounds": "full_image",
              "z_order": "back",
              "extraction_hint": "Preserve the gradient, grid, and light streaks across the entire canvas. Remove all menu panels, buttons, text, and side elements, reconstructing the background continuously underneath them."
            }
            </background_asset_input>

            <good_output_for_background>
            Isolate the full-screen background layer from this image. Preserve the dark blue gradient base, the faint glowing teal grid pattern, and the subtle purple and magenta light streaks radiating from the center-right exactly as they appear in the source. Match the original colors, line spacing, and glow intensity of the grid, and maintain the direction and falloff of the light streaks without enhancement or stylization.

            Remove every foreground element - the centered menu panel, all menu buttons, text labels, the tilted side information panel, and the bottom status strip. Reconstruct the grid pattern, gradient, and light streaks continuously across the areas those elements currently occlude, using the visible portions of the background as reference. The final image should look as though no foreground elements ever existed, showing only the complete unbroken background layer at its original canvas dimensions, framed by a solid pure white (#FFFFFF) border where the canvas ends. Solid white is chosen because the background is dominantly dark blue, giving the extracted layer maximum separation from the surrounding frame.
            </good_output_for_background>

            <bad_output>
            Here is a prompt to extract the menu panel:

            "Remove the buttons and text from the menu and make the background transparent."
            </bad_output>
            Why the bad output fails: includes a preamble label, wraps the prompt in quotes, uses transparent background instead of solid black or white, drops critical visual details from the JSON (double-line border, notch, inner glow, interior fill), omits the reconstruction instruction for the panel's occluded interior, and uses vague language instead of concrete preservation direction.
            </example>

            <reminders>
            - Output is raw prompt text only. No preamble, no wrapper, no commentary, no quotes around the whole thing.
            - Background is ALWAYS solid black (#000000) or solid white (#FFFFFF) - never transparent, never any other color. Choose for maximum contrast against the asset's dominant color.
            - State the chosen background color explicitly in the generated prompt using both hex and word.
            - Every visual detail in the JSON's visual_description must appear in the preservation language of the prompt.
            - z_order drives the removal/reconstruction approach - front/overlay strips cleanly, mid reconstructs the asset's surface, back reconstructs the entire asset under occluding foreground.
            - Imperative voice, narrative paragraphs, not lists.
            - Fidelity, not enhancement.
            """
        ).strip()
        + "\n\n"
        + "Original source image is attached. Generate the extraction prompt for this single asset entry JSON:\n\n"
        + json.dumps(asset.model_dump(mode="json"), indent=2)
    )
