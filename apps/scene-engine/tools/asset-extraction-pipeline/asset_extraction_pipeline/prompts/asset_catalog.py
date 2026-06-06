from __future__ import annotations


ASSET_CATALOG_PROMPT = """<purpose>
Inventory distinct visual assets in a UI screenshot at extraction granularity. Each listed asset is a visually self-contained region an extraction pipeline will isolate as one piece.
</purpose>

<granularity>
Target unit: a visually self-contained region. The test is visual attachment, not semantic role.

ATTACHMENT TEST: Does this element look like one connected graphic, or does it look like distinct pieces that happen to be near each other?
- Connected graphic (decorative border + title text + backing plate that clearly form one titled banner) = ONE asset, bundled.
- Visually distinct panel adjacent to another panel (a tilted side-panel next to a main menu frame) = SEPARATE assets, even if they belong to the same screen.

INCLUDE as assets:
- Background layers (grids, gradients, scene backdrops)
- Self-contained frame/panel regions, each counted separately (main menu frame, side sub-panel, description strip, info box)
- Anything visually bundled INTO a panel (its title, its border decoration, its backing plate) stays with that panel
- Interactive composite elements as whole units (a button with its label is one asset)
- Selection/highlight overlays (active-state graphics distinct from the base element they sit on)
- Visually substantial decorative elements (logos, corner ornaments)

EXCLUDE (do not list as separate assets):
- Sub-parts of a visually-connected region (the border alone, the title text alone, the backing box alone when they form one banner — bundle them)
- Standalone body text, captions, option labels inside buttons, or menu item text
- Tiny incidental marks unless clearly reusable components
- Sub-parts of composite interactive elements (button outline alone, button icon alone)
</granularity>

<worked_example>
Example screen: a game main menu with a titled frame on the left (red border + "Main Menu" text + white backing box), a vertical stack of menu buttons inside it, a tilted sub-panel on the right showing sub-options, and a description strip at the bottom.

Correct asset breakdown:
- background (grid pattern behind everything)
- main_menu_frame (red border + "Main Menu" title + white backing — bundled, they form one banner graphic)
- menu_option_button (the repeating button template, instance_count: 5)
- selection_highlight (yellow glow overlay on the active button — separate, it's an overlay)
- tilted_side_panel (the angled sub-panel on the right — SEPARATE from main frame, it's a visually distinct region)
- description_strip (bottom bar — separate, distinct region)

Incorrect: splitting main_menu_frame into border + title_text + white_box (over-decomposition, they're visually attached).
Incorrect: merging main_menu_frame with tilted_side_panel as "menu_system" (over-merging, they're distinct regions).
</worked_example>

<rules>
- Describe what the asset IS visually (shape, color, material), not what it MEANS functionally.
- If multiple elements share the same visual template, list ONCE with instance_count.
- Never skip background and frame layers — most commonly missed.
- If bounds are uncertain, state "approximate" or "unknown". Do not fabricate precision.
</rules>

<asset_type_vocabulary>
`type` is a free-form snake_case string. Prefer one of the canonical values below; only invent a new one if none of these fit, and still keep it short, lowercase, snake_case, and purely visual.

Canonical values and when to use each:
- background: the backmost scene/backdrop layer (grids, gradients, skybox, scene art behind everything).
- panel_frame: a self-contained titled/bordered panel that reads as one connected banner graphic (border + title + backing plate bundled).
- container: a plain holding region inside a panel (a list backing, a stack backdrop, a grouping box without its own titled frame).
- composite_button: an interactive element bundled with its label/icon as one unit (button + text + icon glyph = one asset).
- selector_overlay: an active-state/highlight graphic that sits on top of a base element (yellow glow on the selected button, cursor ring, focus indicator).
- decoration: a visually substantial but non-interactive ornament (logo, corner flourish, character portrait, emblem).
- divider: a thin separator line or strip between regions (horizontal rule, vertical splitter).

Good `type` values: "background", "panel_frame", "container", "composite_button", "selector_overlay", "decoration", "divider".
Bad `type` values: "menu" (functional, not visual), "UI" (too generic), "Panel Frame" (wrong case/spacing), "button_text" (sub-part of composite_button — should be bundled).
</asset_type_vocabulary>

<process>
1. Scan back-to-front: background → distinct panel regions → containers inside panels → composite interactive elements → overlays.
2. Apply the attachment test: for each candidate, check whether its sub-parts are visually connected (bundle them) or visually distinct (list separately).
3. Exclude standalone text and sub-parts of bundled elements.
4. Deduplicate: group visually-identical elements as instances of one asset.
5. Describe each asset's visual properties only.
</process>

<output_format>
Return a JSON object. No prose outside the JSON.

{
  "image_summary": "One sentence orienting the screen type.",
  "assets": [
    {
      "id": "asset_01",
      "type": "background | panel_frame | container | composite_button | selector_overlay | decoration | divider",
      "name": "descriptive handle (e.g., 'grid_background', 'main_menu_frame', 'tilted_side_panel')",
      "visual_description": "Shape, colors, gradients, borders, glow, texture. Purely visual. 1-2 sentences.",
      "includes": "For bundled assets, list what's visually attached (e.g., 'red border + title text + white backing plate'). Omit for atomic assets.",
      "instance_count": 1,
      "instances": [
        {
          "location": "human-readable position",
          "bounds": "approximate: [x,y,w,h] or 'unknown'",
          "z_order": "back | mid | front | overlay",
          "notes": "distinguishing details if any"
        }
      ]
    }
  ],
  "extraction_candidates": ["asset_01", "asset_03"]
}
</output_format>

<example>
<good_asset_entry>
{
  "id": "asset_02",
  "type": "panel_frame",
  "name": "main_menu_frame",
  "visual_description": "Rectangular panel with a red-to-orange gradient border, an angled title banner at the top reading 'Main Menu' in stylized text, and a semi-transparent dark backing plate filling the interior.",
  "includes": "outer red border + angled title banner + 'Main Menu' title text + backing plate",
  "instance_count": 1,
  "instances": [
    {"location": "upper-left to center, dominant frame", "bounds": "approximate", "z_order": "mid", "notes": "contains menu button stack as separate assets"}
  ]
}
Why this works: the border, title text, and backing plate are visually attached — they form one connected banner graphic, so they're bundled. The tilted side panel would be a separate asset because it's a visually distinct region.
</good_asset_entry>

<bad_asset_entry>
[
  {"id": "asset_02", "name": "red_border"},
  {"id": "asset_03", "name": "main_menu_title_text"},
  {"id": "asset_04", "name": "white_backing_box"},
  {"id": "asset_05", "name": "entire_menu_system_including_side_panel"}
]
Why this fails: asset_02 through asset_04 over-decompose a visually-attached banner into its parts — none are useful in isolation. asset_05 over-merges two visually distinct regions (main frame and tilted side panel) that should be separate extractable assets.
</bad_asset_entry>
</example>

<reminders>
- Attachment test: visually connected = bundle. Visually distinct = separate.
- A titled panel (border + title + backing) is ONE asset. An adjacent tilted sub-panel is a DIFFERENT asset.
- No standalone text. No sub-parts of bundled elements. No sub-parts of composite buttons.
- Deduplicate identical visuals via instance_count.
- JSON only.
</reminders>
"""
