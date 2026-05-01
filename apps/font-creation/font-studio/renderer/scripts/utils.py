from __future__ import annotations

import html
import math
import re
from typing import Any


def read_json(path: str | Any) -> Any:
    from pathlib import Path
    import json

    with Path(path).open("r", encoding="utf-8") as handle:
        return json.load(handle)


def escape(value: Any) -> str:
    return html.escape(str(value), quote=True)


def fmt(value: float) -> str:
    if abs(value - round(value)) < 0.001:
        return str(int(round(value)))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, value))


def smoothstep01(value: Any) -> Any:
    import numpy as np

    value = np.clip(value, 0, 1)
    return value * value * (3 - 2 * value)


def relief_profile_t(value: Any, band: dict[str, Any]) -> Any:
    import numpy as np

    value = np.clip(value, 0, 1)
    profile = str(band.get("profile", "smooth")).lower()
    if profile == "linear":
        return value
    return smoothstep01(value)


def lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def hex_to_rgb(value: str) -> tuple[int, int, int]:
    raw = value.strip().lstrip("#")
    if len(raw) == 3:
        raw = "".join(ch * 2 for ch in raw)
    if len(raw) != 6:
        return (255, 255, 255)
    return (int(raw[0:2], 16), int(raw[2:4], 16), int(raw[4:6], 16))


def rgb_to_hex(rgb: tuple[int, int, int]) -> str:
    return "#" + "".join(f"{max(0, min(255, channel)):02x}" for channel in rgb)


def lerp_color(a: str, b: str, t: float) -> str:
    t = clamp01(t)
    ar, ag, ab = hex_to_rgb(a)
    br, bg, bb = hex_to_rgb(b)
    return rgb_to_hex(
        (
            int(round(lerp(ar, br, t))),
            int(round(lerp(ag, bg, t))),
            int(round(lerp(ab, bb, t))),
        )
    )


def indent_block(text: str, spaces: int) -> str:
    pad = " " * spaces
    return "\n".join(f"{pad}{line}" if line else line for line in text.splitlines())


def normalize_vector(
    vector: dict[str, Any], fallback: tuple[float, float, float]
) -> tuple[float, float, float]:
    x = float(vector.get("x", fallback[0]))
    y = float(vector.get("y", fallback[1]))
    z = float(vector.get("z", fallback[2]))
    length = math.sqrt(x * x + y * y + z * z)
    if length <= 0:
        return fallback
    return x / length, y / length, z / length


def css_declarations(style: Any) -> str:
    if not style:
        return ""
    if isinstance(style, str):
        return style.strip().rstrip(";")
    if isinstance(style, dict):
        declarations = []
        for key, value in style.items():
            if value is None:
                continue
            declarations.append(f"{key}: {value}")
        return "; ".join(declarations)
    return ""


def css_safe_ident(value: Any) -> str:
    raw = str(value or "melee3")
    ident = re.sub(r"[^A-Za-z0-9_-]+", "-", raw).strip("-")
    return ident or "melee3"


def css_rgba(color: str, alpha: float) -> str:
    r, g, b = hex_to_rgb(color)
    return f"rgba({r}, {g}, {b}, {clamp01(float(alpha)):.3f})"


def safe_label(
    label: str, records: list[tuple[dict[str, Any], float]] | None = None
) -> str:
    if records and len(records) == 1:
        return str(
            records[0][0].get("glyph_name")
            or SPECIAL_LABELS.get(records[0][0].get("glyph"), label)
        )
    if label in SPECIAL_LABELS:
        return SPECIAL_LABELS[label]
    sanitized = re.sub(r"[^A-Za-z0-9_.-]+", "_", label).strip("_")
    return sanitized or "render"


def media_opacity_attr(media: dict[str, Any]) -> str:
    if "opacity" not in media:
        return ""
    return f' opacity="{escape(media["opacity"])}"'


def video_bool_attr(
    media: dict[str, Any], key: str, attr: str, default: bool = True
) -> str:
    if bool(media.get(key, default)):
        return f' {attr}="{attr}"'
    return ""


def stop_offset_value(stop: dict[str, Any]) -> float:
    raw = str(stop.get("offset", "0")).strip()
    try:
        if raw.endswith("%"):
            return clamp01(float(raw[:-1]) / 100)
        return clamp01(float(raw))
    except ValueError:
        return 0.0


SPECIAL_LABELS = {
    " ": "space",
    "!": "exclamation",
    '"': "double_quote",
    "#": "hash",
    "$": "dollar",
    "%": "percent",
    "&": "ampersand",
    "'": "apostrophe",
    "(": "left_paren",
    ")": "right_paren",
    "*": "asterisk",
    "+": "plus",
    ",": "comma",
    "-": "dash",
    ".": "period",
    "/": "slash",
    ":": "colon",
    ";": "semicolon",
    "<": "less_than",
    "=": "equals",
    ">": "greater_than",
    "?": "question",
    "@": "at",
    "[": "left_bracket",
    "\\": "backslash",
    "]": "right_bracket",
    "^": "caret",
    "`": "backtick",
    "{": "left_brace",
    "|": "bar",
    "}": "right_brace",
    "~": "tilde",
}

SHADOW_DEPTH_SCALES = {
    "large": {"offset": 1.0, "blur": 1.0, "opacity": 1.0},
    "medium": {"offset": 0.78, "blur": 0.86, "opacity": 0.9},
    "small": {"offset": 0.55, "blur": 0.68, "opacity": 0.72},
}
