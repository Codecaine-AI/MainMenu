from __future__ import annotations

from typing import Any

from .utils import escape, fmt


def gradient_stops(stops: list[dict[str, Any]]) -> str:
    lines = []
    for stop in stops:
        opacity = stop.get("opacity")
        opacity_attr = (
            f' stop-opacity="{escape(opacity)}"' if opacity is not None else ""
        )
        lines.append(
            f'<stop offset="{escape(stop["offset"])}" stop-color="{escape(stop["color"])}"{opacity_attr}/>'
        )
    return "\n      ".join(lines)


def gradient_attrs(
    name: str, recipe: dict[str, Any], width: float, height: float
) -> str:
    vector = recipe.get("gradient_vectors", {}).get(name, {})
    units = vector.get("units", "userSpaceOnUse")

    if units == "objectBoundingBox":
        x1 = fmt(float(vector.get("x1", 0)))
        y1 = fmt(float(vector.get("y1", 0)))
        x2 = fmt(float(vector.get("x2", 0)))
        y2 = fmt(float(vector.get("y2", 1)))
        return (
            f'x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" gradientUnits="objectBoundingBox"'
        )

    def coord(key: str, fallback: float, scale: float) -> str:
        value = float(vector.get(key, fallback))
        if abs(value) <= 1:
            value *= scale
        return fmt(value)

    x1 = coord("x1", 0, width)
    y1 = coord("y1", 0, height)
    x2 = coord("x2", 0, width)
    y2 = coord("y2", height, height)

    return f'x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" gradientUnits="userSpaceOnUse"'


def gradient_defs(
    gradients: dict[str, list[dict[str, Any]]],
    recipe: dict[str, Any],
    width: float,
    height: float,
) -> str:
    lines = []
    for name, stops in gradients.items():
        gradient_id = name.replace("_", "-") + "-gradient"
        attrs = gradient_attrs(name, recipe, width, height)
        lines.append(
            f'''    <linearGradient id="{escape(gradient_id)}" {attrs}>
      {gradient_stops(stops)}
    </linearGradient>'''
        )
    return "\n".join(lines)
