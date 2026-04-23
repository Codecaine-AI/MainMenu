from __future__ import annotations

from textwrap import dedent


def build_prompt() -> str:
    return dedent(
        """
        <purpose>
        Inventory the major visual assets in a UI screenshot for downstream extraction. Output a structured list where each entry corresponds to ONE extraction job - isolate that asset, remove everything else.
        </purpose>

        <rules>
        - Assets are MAJOR visual regions: backgrounds, panels, frames, containers, decorative side elements, banner strips. Not individual buttons, text, icons, or details inside a panel.
        - Group by container. If five buttons sit inside a menu panel, the asset is the panel - not the buttons.
        - Skip all text. No text labels, no typography, no captions. Text is content, not asset.
        - Skip fine details inside larger assets. A notch on a frame is part of the frame, not its own asset.
        - Include layered backgrounds separately only if they're visually distinct layers that would be extracted independently (e.g., a grid pattern behind a solid color base).
        - When in doubt about granularity: group up, not down.
        </rules>

        <process>
        1. Squint test: what are the 4-8 large visual regions you'd identify from across a room? Those are your candidate assets.
        2. Layer pass: back to front - background layer(s), main container/frame, side panels, banner/header strips, footer strips, overlays.
        3. Group test: for each candidate, ask "are there smaller distinct elements inside this that belong to it?" If yes, the container is the asset; the contents are not separate assets.
        4. Describe each asset's visual properties only: shape, color, gradient, border, glow, texture. Ignore what it contains.
        5. Locate: where it sits in the frame and approximate bounds for extraction.
        </process>

        <output_format>
        Return a JSON object. No prose outside the JSON.

        {
          "image_summary": "One sentence orienting what kind of screen this is.",
          "assets": [
            {
              "id": "asset_01",
              "name": "short_snake_case_handle",
              "type": "background | frame | panel | banner | side_element | decoration | overlay",
              "visual_description": "Shape, colors, gradients, borders, glow, texture. Purely visual. 1-2 sentences. Do not describe contents.",
              "location": "human-readable position (e.g., 'full screen, backmost layer', 'centered main area', 'right side, vertically tilted', 'bottom strip')",
              "bounds": "approximate [x, y, width, height] in pixels, or 'full_image', or 'approximate' if uncertain",
              "z_order": "back | mid | front | overlay",
              "extraction_hint": "One sentence telling an extraction tool what to preserve and what to remove. E.g., 'Preserve the gold-bordered panel shape and its internal fill; remove all buttons, text, and icons layered on top.'"
            }
          ]
        }
        </output_format>

        <example>
        <good_entry>
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
        Why this works: treats the whole menu panel as one asset, ignores the buttons and text inside it, describes only visual properties, and gives the extraction tool clear instructions.
        </good_entry>

        <bad_entry>
        {
          "id": "asset_03",
          "name": "vs_mode_button",
          "type": "panel",
          "visual_description": "A yellow highlighted button with the text 'VS. Mode' that is currently selected in the menu."
        }
        Why this fails: lists an individual button (too fine-grained - should be grouped into the menu panel asset), describes content/text, and describes state/function instead of pure visuals.
        </bad_entry>
        </example>

        <reminders>
        - Target 4-8 assets per screen. If you have 15+, you went too granular - group up.
        - No text, no individual buttons, no icons-inside-panels as separate assets.
        - Each asset = one extraction job. Ask: "Would someone extract this by itself?"
        - JSON only. No prose outside the structure.
        </reminders>
        """
    )
