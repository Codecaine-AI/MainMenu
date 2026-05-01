from __future__ import annotations

from typing import Any

from .utils import fmt
from .recipe import (
    layer_inner_stroke_width,
    layer_opacity_value,
    layer_stroke_width,
    layer_uses_css_transform,
)


def css_var(scope: str, layer_id: str, prop: str) -> str:
    return f"--{scope}-{layer_id}-{prop}"


def interior_media_config(
    layer: dict[str, Any], recipe: dict[str, Any]
) -> dict[str, Any] | None:
    media = layer.get("media")
    if not isinstance(media, dict):
        media = recipe.get("interior_media")
    if not isinstance(media, dict):
        return None
    if media.get("enabled") is False:
        return None
    mode = str(media.get("mode", "paint")).lower()
    if mode in {"paint", "gradient", "none", "off"}:
        return None
    return media


def recipe_css(recipe: dict[str, Any]) -> str:
    scope = recipe.get("css_scope", "melee3")
    lines = [":root {"]
    for layer in recipe["layers"]:
        layer_id = layer["id"]
        for prop in ["paint", "width", "opacity", "dx", "dy"]:
            if prop in layer:
                value = (
                    layer_opacity_value(layer, recipe)
                    if prop == "opacity"
                    else layer[prop]
                )
                unit = (
                    "px"
                    if prop in {"width", "dx", "dy"} and isinstance(value, (int, float))
                    else ""
                )
                lines.append(f"  {css_var(scope, layer_id, prop)}: {value}{unit};")
        if layer.get("type") == "stroke" and ("start" in layer or "thickness" in layer):
            lines.append(
                f"  {css_var(scope, layer_id, 'width')}: {fmt(layer_stroke_width(layer))}px;"
            )
            lines.append(
                f"  {css_var(scope, layer_id, 'inner-width')}: {fmt(layer_inner_stroke_width(layer))}px;"
            )
        if layer.get("type") == "rect-fill":
            lines.append(
                f"  {css_var(scope, layer_id, 'height-ratio')}: {layer.get('height_ratio', 1)};"
            )
    lines.append("}")
    lines.append("")
    lines.append("g[data-layer] { transform-box: fill-box; transform-origin: center; }")
    for layer in recipe["layers"]:
        layer_id = layer["id"]
        selector = f"#{layer_id}"
        if layer_uses_css_transform(layer):
            dx = f"var({css_var(scope, layer_id, 'dx')}, 0px)"
            dy = f"var({css_var(scope, layer_id, 'dy')}, 0px)"
            transform = f" transform: translate({dx}, {dy});"
        else:
            transform = ""
        lines.append(
            f"{selector} {{ opacity: var({css_var(scope, layer_id, 'opacity')}, 1);{transform} }}"
        )
        if layer["type"] == "stroke":
            lines.append(
                f"{selector} use {{ stroke: var({css_var(scope, layer_id, 'paint')}); "
                f"stroke-width: var({css_var(scope, layer_id, 'width')}); }}"
            )
    media_configs = [recipe.get("interior_media")]
    media_configs.extend(layer.get("media") for layer in recipe["layers"])
    seen_keyframes = set()
    for interior_media in media_configs:
        if not isinstance(interior_media, dict) or interior_media.get("enabled") is False:
            continue
        keyframes = interior_media.get("keyframes")
        keyframes_key = str(keyframes)
        if keyframes_key in seen_keyframes:
            continue
        if keyframes:
            seen_keyframes.add(keyframes_key)
            lines.append("")
            lines.append(keyframes_key)
    return "\n      ".join(lines)
