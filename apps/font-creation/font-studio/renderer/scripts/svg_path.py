from __future__ import annotations

import re
from typing import Any

from .utils import fmt

PATH_TOKEN_RE = re.compile(r"[MmLlHhVvCcZz]|[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?")
SVG_PATH_CONTOUR_CACHE: dict[tuple[str, int], list[list[tuple[float, float]]]] = {}


def glyph_id(record: dict[str, Any]) -> str:
    return "glyph_" + "_".join(f"{ord(ch):04X}" for ch in record["glyph"])


def use_nodes(
    records: list[tuple[dict[str, Any], float]], y: float, attrs: str = ""
) -> str:
    lines = []
    for record, x in records:
        lines.append(
            f'    <use href="#{glyph_id(record)}" transform="translate({fmt(x)} {fmt(y)})"{attrs}/>'
        )
    return "\n".join(lines)


def svg_path_contours(
    path_d: str, curve_steps: int = 32
) -> list[list[tuple[float, float]]]:
    cache_key = (path_d, curve_steps)
    cached = SVG_PATH_CONTOUR_CACHE.get(cache_key)
    if cached is not None:
        return cached

    tokens = PATH_TOKEN_RE.findall(path_d)
    contours: list[list[tuple[float, float]]] = []
    contour: list[tuple[float, float]] = []
    index = 0
    command = ""
    current = (0.0, 0.0)
    start = (0.0, 0.0)

    def is_command(value: str) -> bool:
        return len(value) == 1 and value.isalpha()

    def number() -> float:
        nonlocal index
        value = float(tokens[index])
        index += 1
        return value

    def finish_contour() -> None:
        nonlocal contour
        if len(contour) > 1:
            contours.append(contour)
        contour = []

    while index < len(tokens):
        if is_command(tokens[index]):
            command = tokens[index]
            index += 1
        if not command:
            raise ValueError("SVG path data starts without a command.")

        relative = command.islower()
        op = command.upper()

        if op == "M":
            first = True
            while index + 1 < len(tokens) and not is_command(tokens[index]):
                x = number()
                y_value = number()
                if relative:
                    x += current[0]
                    y_value += current[1]
                current = (x, y_value)
                if first:
                    finish_contour()
                    contour = [current]
                    start = current
                    first = False
                else:
                    contour.append(current)
            command = "l" if relative else "L"
        elif op == "L":
            while index + 1 < len(tokens) and not is_command(tokens[index]):
                x = number()
                y_value = number()
                if relative:
                    x += current[0]
                    y_value += current[1]
                current = (x, y_value)
                contour.append(current)
        elif op == "H":
            while index < len(tokens) and not is_command(tokens[index]):
                x = number()
                if relative:
                    x += current[0]
                current = (x, current[1])
                contour.append(current)
        elif op == "V":
            while index < len(tokens) and not is_command(tokens[index]):
                y_value = number()
                if relative:
                    y_value += current[1]
                current = (current[0], y_value)
                contour.append(current)
        elif op == "C":
            while index + 5 < len(tokens) and not is_command(tokens[index]):
                x1, y1 = number(), number()
                x2, y2 = number(), number()
                x3, y3 = number(), number()
                if relative:
                    x1 += current[0]
                    y1 += current[1]
                    x2 += current[0]
                    y2 += current[1]
                    x3 += current[0]
                    y3 += current[1]
                x0, y0 = current
                for step in range(1, curve_steps + 1):
                    t = step / curve_steps
                    mt = 1 - t
                    x = mt**3 * x0 + 3 * mt**2 * t * x1 + 3 * mt * t**2 * x2 + t**3 * x3
                    y_curve = (
                        mt**3 * y0 + 3 * mt**2 * t * y1 + 3 * mt * t**2 * y2 + t**3 * y3
                    )
                    contour.append((x, y_curve))
                current = (x3, y3)
        elif op == "Z":
            if contour and contour[-1] != start:
                contour.append(start)
            finish_contour()
            current = start
        else:
            raise ValueError(f"Unsupported SVG path command: {command}")

    finish_contour()
    SVG_PATH_CONTOUR_CACHE[cache_key] = contours
    return contours
