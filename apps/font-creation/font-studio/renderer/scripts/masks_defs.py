from __future__ import annotations

from typing import Any

from .utils import escape, fmt
from .recipe import chrome_stack_bounds, layer_band_bounds
from .css_gen import css_var
from .svg_path import use_nodes
from .gradients import gradient_defs


def band_masks_svg(
    recipe: dict[str, Any],
    records: list[tuple[dict[str, Any], float]],
    width: float,
    height: float,
    y: float,
) -> str:
    scope = recipe.get("css_scope", "melee3")
    masks = []
    for layer in recipe["layers"]:
        bounds = layer_band_bounds(layer)
        if not bounds:
            continue

        start, end = bounds
        layer_id = layer["id"]
        escaped_layer_id = escape(layer_id)
        if layer.get("type") == "stroke":
            outer_width = f"var({css_var(scope, layer_id, 'width')})"
            inner_width = f"var({css_var(scope, layer_id, 'inner-width')})"
        else:
            outer_width = fmt(2 * end)
            inner_width = fmt(2 * start)
        outer_attrs = (
            f' fill="none" stroke="white" stroke-width="{outer_width}"'
            f' stroke-linejoin="round" stroke-linecap="round"'
        )
        inner_attrs = (
            f' fill="black" stroke="black" stroke-width="{inner_width}"'
            f' stroke-linejoin="round" stroke-linecap="round"'
        )
        masks.append(
            f'''    <mask id="{escaped_layer_id}-band-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="{fmt(width)}" height="{fmt(height)}">
      <rect width="{fmt(width)}" height="{fmt(height)}" fill="black"/>
{use_nodes(records, y, outer_attrs)}
{use_nodes(records, y, inner_attrs)}
    </mask>'''
        )

    return "\n".join(masks)


def chrome_stack_mask_svg(
    recipe: dict[str, Any],
    records: list[tuple[dict[str, Any], float]],
    width: float,
    height: float,
    y: float,
) -> str:
    bounds = chrome_stack_bounds(recipe)
    if not bounds:
        return ""

    start, end = bounds
    outer_width = fmt(2 * end)
    inner_width = fmt(2 * start)
    outer_attrs = (
        f' fill="none" stroke="white" stroke-width="{outer_width}"'
        f' stroke-linejoin="round" stroke-linecap="round"'
    )
    inner_attrs = (
        f' fill="black" stroke="black" stroke-width="{inner_width}"'
        f' stroke-linejoin="round" stroke-linecap="round"'
    )
    fill_attrs = ' fill="black"'
    return f'''    <mask id="chrome-stack-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="{fmt(width)}" height="{fmt(height)}">
      <rect width="{fmt(width)}" height="{fmt(height)}" fill="black"/>
{use_nodes(records, y, outer_attrs)}
{use_nodes(records, y, inner_attrs)}
{use_nodes(records, y, fill_attrs)}
    </mask>'''


def defs_svg(
    recipe: dict[str, Any],
    width: float,
    height: float,
    path_defs: str,
    clip_uses: str,
    records: list[tuple[dict[str, Any], float]],
    y: float,
) -> str:
    gradients = recipe.get("gradients", {})
    filters = recipe.get("filters", {})
    bevel = filters.get("chrome_bevel", {})
    lip_bevel = filters.get("chrome_lip_bevel", {})
    outside_fill_mask_uses = clip_uses.replace("<use ", '<use fill="black" ')
    band_masks = band_masks_svg(recipe, records, width, height, y)
    chrome_stack_mask = chrome_stack_mask_svg(recipe, records, width, height, y)
    return f'''  <defs>
{path_defs}
    <clipPath id="fill-clip" clipPathUnits="userSpaceOnUse">
{clip_uses}
    </clipPath>
    <mask id="outside-fill-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="{fmt(width)}" height="{fmt(height)}">
      <rect width="{fmt(width)}" height="{fmt(height)}" fill="white"/>
{outside_fill_mask_uses}
    </mask>
{band_masks}
{chrome_stack_mask}
{gradient_defs(gradients, recipe, width, height)}
    <filter id="contact-soften" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="{escape(filters.get("contact_soften", {}).get("std_deviation", 1.8))}"/>
    </filter>
    <filter id="extrusion-soften" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="{escape(filters.get("extrusion_soften", {}).get("std_deviation", 0.45))}"/>
    </filter>
    <filter id="chrome-lip-bevel" x="-18%" y="-18%" width="136%" height="136%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="{escape(lip_bevel.get("std_deviation", 0.32))}" result="soft-alpha"/>
      <feOffset in="soft-alpha" dx="{escape(lip_bevel.get("highlight_dx", -0.65))}" dy="{escape(lip_bevel.get("highlight_dy", -0.85))}" result="upper-edge"/>
      <feFlood flood-color="{escape(lip_bevel.get("highlight_color", "#ffffff"))}" flood-opacity="{escape(lip_bevel.get("highlight_opacity", 0.34))}" result="upper-color"/>
      <feComposite in="upper-color" in2="upper-edge" operator="in" result="upper-highlight"/>
      <feComposite in="upper-highlight" in2="SourceAlpha" operator="in" result="upper-highlight-in"/>
      <feOffset in="soft-alpha" dx="{escape(lip_bevel.get("shadow_dx", 0.85))}" dy="{escape(lip_bevel.get("shadow_dy", 1.12))}" result="lower-edge"/>
      <feFlood flood-color="{escape(lip_bevel.get("shadow_color", "#020304"))}" flood-opacity="{escape(lip_bevel.get("shadow_opacity", 0.62))}" result="lower-color"/>
      <feComposite in="lower-color" in2="lower-edge" operator="in" result="lower-shadow"/>
      <feComposite in="lower-shadow" in2="SourceAlpha" operator="in" result="lower-shadow-in"/>
      <feSpecularLighting
        in="soft-alpha"
        surfaceScale="{escape(lip_bevel.get("surface_scale", 2.2))}"
        specularConstant="{escape(lip_bevel.get("specular_constant", 0.18))}"
        specularExponent="{escape(lip_bevel.get("specular_exponent", 46))}"
        lighting-color="{escape(lip_bevel.get("specular_color", "#ffffff"))}"
        result="specular"
      >
        <fePointLight x="{escape(lip_bevel.get("light_x", -520))}" y="{escape(lip_bevel.get("light_y", -720))}" z="{escape(lip_bevel.get("light_z", 650))}"/>
      </feSpecularLighting>
      <feComposite in="specular" in2="SourceAlpha" operator="in" result="specular-in"/>
      <feBlend in="SourceGraphic" in2="lower-shadow-in" mode="multiply" result="shadowed-lip"/>
      <feBlend in="shadowed-lip" in2="upper-highlight-in" mode="screen" result="rim-lit-lip"/>
      <feBlend in="rim-lit-lip" in2="specular-in" mode="screen" result="lit-lip"/>
      <feComposite in="lit-lip" in2="SourceAlpha" operator="in"/>
    </filter>
    <filter id="chrome-bevel" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceAlpha" stdDeviation="{escape(bevel.get("std_deviation", 0.45))}" result="soft-alpha"/>
      <feOffset in="soft-alpha" dx="{escape(bevel.get("highlight_dx", -1.15))}" dy="{escape(bevel.get("highlight_dy", -1.35))}" result="upper-edge"/>
      <feFlood flood-color="{escape(bevel.get("highlight_color", "#ffffff"))}" flood-opacity="{escape(bevel.get("highlight_opacity", 0.82))}" result="upper-color"/>
      <feComposite in="upper-color" in2="upper-edge" operator="in" result="upper-highlight"/>
      <feComposite in="upper-highlight" in2="SourceAlpha" operator="in" result="upper-highlight-in"/>
      <feOffset in="soft-alpha" dx="{escape(bevel.get("shadow_dx", 1.35))}" dy="{escape(bevel.get("shadow_dy", 2.05))}" result="lower-edge"/>
      <feFlood flood-color="{escape(bevel.get("shadow_color", "#030405"))}" flood-opacity="{escape(bevel.get("shadow_opacity", 0.78))}" result="lower-color"/>
      <feComposite in="lower-color" in2="lower-edge" operator="in" result="lower-shadow"/>
      <feComposite in="lower-shadow" in2="SourceAlpha" operator="in" result="lower-shadow-in"/>
      <feSpecularLighting
        in="soft-alpha"
        surfaceScale="{escape(bevel.get("surface_scale", 4.8))}"
        specularConstant="{escape(bevel.get("specular_constant", 0.75))}"
        specularExponent="{escape(bevel.get("specular_exponent", 42))}"
        lighting-color="{escape(bevel.get("specular_color", "#ffffff"))}"
        result="specular"
      >
        <fePointLight x="{escape(bevel.get("light_x", -520))}" y="{escape(bevel.get("light_y", -760))}" z="{escape(bevel.get("light_z", 720))}"/>
      </feSpecularLighting>
      <feComposite in="specular" in2="SourceAlpha" operator="in" result="specular-in"/>
      <feBlend in="SourceGraphic" in2="lower-shadow-in" mode="multiply" result="shadowed-chrome"/>
      <feBlend in="shadowed-chrome" in2="upper-highlight-in" mode="screen" result="rim-lit-chrome"/>
      <feBlend in="rim-lit-chrome" in2="specular-in" mode="screen" result="lit-chrome"/>
      <feComposite in="lit-chrome" in2="SourceAlpha" operator="in"/>
    </filter>
  </defs>'''
