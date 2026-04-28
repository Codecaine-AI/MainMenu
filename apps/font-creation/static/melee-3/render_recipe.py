from __future__ import annotations

import argparse
import html
import json
import math
from pathlib import Path
from typing import Any


def read_json(path: str | Path) -> Any:
    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def fmt(value: float) -> str:
    if abs(value - round(value)) < 0.001:
        return str(int(round(value)))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def gradient_stops(stops: list[dict[str, Any]]) -> str:
    lines = []
    for stop in stops:
        opacity = stop.get("opacity")
        opacity_attr = f' stop-opacity="{escape(opacity)}"' if opacity is not None else ""
        lines.append(f'<stop offset="{escape(stop["offset"])}" stop-color="{escape(stop["color"])}"{opacity_attr}/>')
    return "\n      ".join(lines)


def glyph_id(record: dict[str, Any]) -> str:
    return "glyph_" + "_".join(f"{ord(ch):04X}" for ch in record["glyph"])


def css_var(scope: str, layer_id: str, prop: str) -> str:
    return f"--{scope}-{layer_id}-{prop}"


def recipe_css(recipe: dict[str, Any]) -> str:
    scope = recipe.get("css_scope", "melee3")
    lines = [":root {"]
    for layer in recipe["layers"]:
        layer_id = layer["id"]
        for prop in ["paint", "width", "opacity", "dx", "dy"]:
            if prop in layer:
                value = layer[prop]
                unit = "px" if prop in {"width", "dx", "dy"} and isinstance(value, (int, float)) else ""
                lines.append(f"  {css_var(scope, layer_id, prop)}: {value}{unit};")
        if layer.get("type") == "rect-fill":
            lines.append(f"  {css_var(scope, layer_id, 'height-ratio')}: {layer.get('height_ratio', 1)};")
    lines.append("}")
    lines.append("")
    lines.append("g[data-layer] { transform-box: fill-box; transform-origin: center; }")
    for layer in recipe["layers"]:
        layer_id = layer["id"]
        selector = f"#{layer_id}"
        dx = f"var({css_var(scope, layer_id, 'dx')}, 0px)"
        dy = f"var({css_var(scope, layer_id, 'dy')}, 0px)"
        lines.append(f"{selector} {{ opacity: var({css_var(scope, layer_id, 'opacity')}, 1); transform: translate({dx}, {dy}); }}")
        if layer["type"] == "stroke":
            lines.append(
                f"{selector} use {{ stroke: var({css_var(scope, layer_id, 'paint')}); "
                f"stroke-width: var({css_var(scope, layer_id, 'width')}); }}"
            )
    return "\n      ".join(lines)


def defs_svg(recipe: dict[str, Any], height: float, path_defs: str, clip_uses: str) -> str:
    gradients = recipe.get("gradients", {})
    filters = recipe.get("filters", {})
    shadow = filters.get("drop_shadow", {})
    glow = filters.get("rim_glow", {})
    return f'''  <defs>
{path_defs}
    <clipPath id="fill-clip" clipPathUnits="userSpaceOnUse">
{clip_uses}
    </clipPath>
    <linearGradient id="red-fill-gradient" x1="0" y1="0" x2="0" y2="{fmt(height)}" gradientUnits="userSpaceOnUse">
      {gradient_stops(gradients.get("red_fill", []))}
    </linearGradient>
    <linearGradient id="red-gloss-gradient" x1="0" y1="0" x2="0" y2="{fmt(height)}" gradientUnits="userSpaceOnUse">
      {gradient_stops(gradients.get("red_gloss", []))}
    </linearGradient>
    <linearGradient id="silver-gradient" x1="0" y1="0" x2="0" y2="{fmt(height)}" gradientUnits="userSpaceOnUse">
      {gradient_stops(gradients.get("silver", []))}
    </linearGradient>
    <filter id="drop-shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="{escape(shadow.get("dx", 24))}" dy="{escape(shadow.get("dy", 30))}" stdDeviation="{escape(shadow.get("std_deviation", 16))}" flood-color="{escape(shadow.get("color", "#050505"))}" flood-opacity="{escape(shadow.get("opacity", 0.65))}"/>
    </filter>
    <filter id="rim-glow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="{escape(glow.get("std_deviation", 3))}" result="blur"/>
      <feFlood flood-color="{escape(glow.get("color", "#ffffff"))}" flood-opacity="{escape(glow.get("opacity", 0.34))}"/>
      <feComposite in2="blur" operator="in"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>'''


def use_nodes(records: list[tuple[dict[str, Any], float]], y: float, attrs: str = "") -> str:
    lines = []
    for record, x in records:
        lines.append(f'    <use href="#{glyph_id(record)}" transform="translate({fmt(x)} {fmt(y)})"{attrs}/>')
    return "\n".join(lines)


def layer_svg(layer: dict[str, Any], records: list[tuple[dict[str, Any], float]], width: int, height: int, y: float) -> str:
    layer_id = escape(layer["id"])
    layer_type = layer["type"]
    filter_name = layer.get("filter")
    filter_attr = ""
    if filter_name == "drop_shadow":
        filter_attr = ' filter="url(#drop-shadow)"'
    elif filter_name == "rim_glow":
        filter_attr = ' filter="url(#rim-glow)"'

    if layer_type == "stroke":
        attrs = ' fill="none" stroke-linejoin="round" stroke-linecap="round"'
        return f'  <g id="{layer_id}" data-layer="{layer_id}"{filter_attr}>\n{use_nodes(records, y, attrs)}\n  </g>'
    if layer_type == "fill":
        return f'  <g id="{layer_id}" data-layer="{layer_id}" clip-path="url(#fill-clip)">\n    <rect width="{width}" height="{height}" fill="{escape(layer.get("paint", "url(#red-fill-gradient)"))}"/>\n  </g>'
    if layer_type == "rect-fill":
        rect_height = height * float(layer.get("height_ratio", 1))
        return f'  <g id="{layer_id}" data-layer="{layer_id}" clip-path="url(#fill-clip)">\n    <rect width="{width}" height="{fmt(rect_height)}" fill="{escape(layer.get("paint", "url(#red-gloss-gradient)"))}"/>\n  </g>'
    raise ValueError(f"Unsupported layer type: {layer_type}")


def records_for_text(text: str, glyphs: dict[str, dict[str, Any]], recipe: dict[str, Any]) -> tuple[list[tuple[dict[str, Any], float]], int, int, float]:
    units_per_em = int(next(iter(glyphs.values())).get("units_per_em", 1000))
    tracking = float(recipe.get("tracking", 4))
    padding_x = float(recipe.get("padding_x", 48))
    padding_y = float(recipe.get("padding_y", 40))
    current_x = padding_x
    records: list[tuple[dict[str, Any], float]] = []

    for ch in text:
        if ch == " ":
            current_x += units_per_em * 0.35 + tracking
            continue
        record = glyphs[ch]
        records.append((record, current_x))
        current_x += float(record["advance_width"]) + tracking

    width = int(math.ceil(current_x - tracking + padding_x))
    height = int(units_per_em + padding_y * 2)
    return records, width, height, padding_y


def render_svg(records: list[tuple[dict[str, Any], float]], width: int, height: int, y: float, recipe: dict[str, Any], label: str) -> str:
    unique_records = []
    seen = set()
    for record, _ in records:
        key = glyph_id(record)
        if key in seen:
            continue
        seen.add(key)
        unique_records.append(record)

    path_defs = "\n".join(
        f'    <path id="{glyph_id(record)}" d="{escape(record["path_d"])}" fill-rule="{escape(record.get("fill_rule", "evenodd"))}"/>'
        for record in unique_records
    )
    clip_uses = use_nodes(records, y)
    layers = "\n\n".join(layer_svg(layer, records, width, height, y) for layer in recipe["layers"])
    css = recipe_css(recipe)
    bg = recipe.get("background")
    bg_rect = f'  <rect id="background" width="{width}" height="{height}" fill="{escape(bg)}"/>\n\n' if bg else ""

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="{escape(label)}">
{defs_svg(recipe, height, path_defs, clip_uses)}
  <style>
      {css}
  </style>

{bg_rect}{layers}
</svg>
'''


def main() -> None:
    parser = argparse.ArgumentParser(description="Render CSS-addressable SVGs from MELEE traced glyph paths and a layer recipe.")
    parser.add_argument("--paths", default="assets/trace/paths/glyph_paths.json")
    parser.add_argument("--recipe", default="layer-recipe.json")
    parser.add_argument("--out-dir", default="generated")
    args = parser.parse_args()

    paths = read_json(args.paths)
    recipe = read_json(args.recipe)
    glyphs = {record["glyph"]: record for record in paths["glyphs"]}
    out_dir = Path(args.out_dir)

    text = recipe.get("text", "CODECAINE")
    records, width, height, y = records_for_text(text, glyphs, recipe)
    word_svg = render_svg(records, width, height, y, recipe, text)
    word_dir = out_dir / "word"
    word_dir.mkdir(parents=True, exist_ok=True)
    (word_dir / f"{text}.css-layers.svg").write_text(word_svg, encoding="utf-8")

    glyph_dir = out_dir / "glyphs"
    glyph_dir.mkdir(parents=True, exist_ok=True)
    for record in paths["glyphs"]:
        glyph_records = [(record, 0.0)]
        svg = render_svg(glyph_records, int(record["advance_width"]), int(record.get("units_per_em", 1000)), 0.0, recipe, record["glyph"])
        (glyph_dir / f"{record['glyph_name']}.css-layers.svg").write_text(svg, encoding="utf-8")

    print(f"Wrote recipe SVGs to {out_dir}")


if __name__ == "__main__":
    main()
