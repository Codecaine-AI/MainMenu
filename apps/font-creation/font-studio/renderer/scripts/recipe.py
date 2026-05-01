from __future__ import annotations

import copy
from typing import Any

from .utils import SHADOW_DEPTH_SCALES


CHROME_LAYER_IDS = {
    "edge-highlight-layer",
    "inner-highlight-layer",
    "silver-rim-layer",
    "inner-shadow-layer",
    "inner-silver-up-edge-layer",
}


def set_nested_value(target: dict[str, Any], dotted_path: str, value: Any) -> None:
    keys = dotted_path.split(".")
    current = target
    for key in keys[:-1]:
        child = current.get(key)
        if not isinstance(child, dict):
            child = {}
            current[key] = child
        current = child
    current[keys[-1]] = copy.deepcopy(value)


def apply_shadow_depth(recipe: dict[str, Any], depth: str | None) -> None:
    scale = SHADOW_DEPTH_SCALES.get(str(depth or ""))
    if not scale:
        return

    for layer in recipe.get("layers", []):
        if layer.get("type") != "projected-shadow":
            continue
        for key in ("dx", "dy"):
            if key in layer:
                layer[key] = float(layer[key]) * scale["offset"]
        if "blur" in layer:
            layer["blur"] = float(layer["blur"]) * scale["blur"]
        if "opacity" in layer:
            layer["opacity"] = float(layer["opacity"]) * scale["opacity"]


def recipe_for_variant(recipe: dict[str, Any], variant_name: str) -> dict[str, Any]:
    variant = recipe.get("variants", {}).get(variant_name)
    if not variant:
        return recipe

    next_recipe = copy.deepcopy(recipe)
    for key, value in variant.items():
        if "." in key:
            set_nested_value(next_recipe, key, value)
        elif isinstance(value, dict) and isinstance(next_recipe.get(key), dict):
            merged = copy.deepcopy(next_recipe[key])
            merged.update(copy.deepcopy(value))
            next_recipe[key] = merged
        else:
            next_recipe[key] = copy.deepcopy(value)

    apply_shadow_depth(next_recipe, next_recipe.get("shadow", {}).get("depth"))
    return next_recipe


def layer_stroke_width(layer: dict[str, Any]) -> float:
    if "start" in layer or "thickness" in layer:
        return 2 * (float(layer.get("start", 0)) + float(layer.get("thickness", 0)))
    return float(layer.get("width", 0))


def layer_inner_stroke_width(layer: dict[str, Any]) -> float:
    return 2 * float(layer.get("start", 0))


def layer_band_bounds(layer: dict[str, Any]) -> tuple[float, float] | None:
    if layer.get("type") == "bevel-ramp" and "start" in layer:
        start = float(layer["start"])
        end = float(layer.get("end", start + float(layer.get("thickness", 0))))
        return start, end

    if layer.get("mask") == "outside_fill" and (
        "start" in layer or "thickness" in layer
    ):
        start = float(layer.get("start", 0))
        end = start + float(layer.get("thickness", 0))
        return start, end

    return None


def layer_bounds_by_id(
    recipe: dict[str, Any], layer_id: str
) -> tuple[float, float] | None:
    for layer in recipe.get("layers", []):
        if layer.get("id") == layer_id:
            return layer_band_bounds(layer)
    return None


def relief_band_bounds(
    recipe: dict[str, Any], relief_band: dict[str, Any]
) -> tuple[float, float]:
    layer_id = relief_band.get("layer_id")
    if not layer_id:
        raise ValueError(
            f"Relief band {relief_band.get('id', '<unknown>')} is missing layer_id."
        )

    bounds = layer_bounds_by_id(recipe, str(layer_id))
    if bounds is None:
        raise ValueError(
            f"Relief band {relief_band.get('id', '<unknown>')} references layer_id {layer_id!r}, "
            "but that layer does not exist or has no band bounds."
        )
    return bounds


def relief_config(recipe: dict[str, Any]) -> dict[str, Any]:
    config = recipe.get("relief")
    if not config or config.get("enabled") is False:
        return {
            "enabled": False,
            "bands": [],
            "fill_height": 0.0,
            "background_height": 0.0,
            "height_scale": 1.0,
        }

    bands = config.get("bands", [])
    if not isinstance(bands, list):
        raise ValueError("relief.bands must be a list.")

    for band in bands:
        relief_band_bounds(recipe, band)

    return {
        **config,
        "enabled": True,
        "bands": bands,
        "fill_height": float(config.get("fill_height", 0)),
        "background_height": float(config.get("background_height", -8)),
        "height_scale": float(config.get("height_scale", 14)),
    }


def chrome_stack_bounds(recipe: dict[str, Any]) -> tuple[float, float] | None:
    config = recipe.get("chrome_stack", {})
    if config.get("enabled") is False:
        return None
    if "start" in config and "end" in config:
        return float(config["start"]), float(config["end"])

    layer_ids = set(config.get("layer_ids", CHROME_LAYER_IDS))
    bands = []
    for layer in recipe["layers"]:
        if layer.get("id") not in layer_ids:
            continue
        bounds = layer_band_bounds(layer)
        if bounds:
            bands.append(bounds)

    if not bands:
        return None
    return min(start for start, _ in bands), max(end for _, end in bands)


def layer_uses_css_transform(layer: dict[str, Any]) -> bool:
    return layer.get("type") != "projected-shadow"


def layer_opacity_value(layer: dict[str, Any], recipe: dict[str, Any]) -> Any:
    if layer.get("type") == "lighting-overlay":
        lighting = recipe.get("lighting", {})
        source = layer.get("source")
        if source == "chrome_shadow" and "chrome_shadow_opacity" in lighting:
            return lighting["chrome_shadow_opacity"]
        if source == "chrome_highlight" and "chrome_highlight_opacity" in lighting:
            return lighting["chrome_highlight_opacity"]
        if source == "ambient_occlusion" and "ao_opacity" in lighting:
            return lighting["ao_opacity"]
        if source == "chrome_reflection":
            chrome = recipe.get("materials", {}).get("chrome", {})
            if "reflection_opacity" in chrome:
                return chrome["reflection_opacity"]
    return layer.get("opacity", 1)
