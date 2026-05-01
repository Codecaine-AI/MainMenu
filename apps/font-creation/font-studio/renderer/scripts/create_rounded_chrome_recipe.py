from __future__ import annotations

import copy
import json
from pathlib import Path

RENDERER_ROOT = Path(__file__).resolve().parents[1]
STUDIO_ROOT = RENDERER_ROOT.parent
PROJECT_ROOT = STUDIO_ROOT / "projects/melee"
SOURCE = PROJECT_ROOT / "recipes/layer-recipe.json"
TARGET = PROJECT_ROOT / "recipes/rounded-chrome-recipe.json"


def fill_media_from_recipe(recipe: dict) -> dict | None:
    for layer in recipe.get("layers", []):
        if layer.get("id") == "fill-layer" and isinstance(layer.get("media"), dict):
            return copy.deepcopy(layer["media"])
    media = recipe.get("interior_media")
    return copy.deepcopy(media) if isinstance(media, dict) else None


def main() -> None:
    source_recipe = json.loads(SOURCE.read_text(encoding="utf-8"))
    recipe = copy.deepcopy(source_recipe)
    fill_media = fill_media_from_recipe(recipe)
    recipe.pop("interior_media", None)
    recipe["css_scope"] = "melee3-round"
    recipe["chrome_stack"] = {"layer_ids": ["chrome-dome-layer"]}
    recipe["relief"] = {
        "enabled": True,
        "height_scale": 72,
        "fill_height": 0,
        "background_height": -20,
        "bands": [
            {
                "id": "chrome-round-dome-relief",
                "layer_id": "chrome-dome-layer",
                "role": "semicircle_dome",
                "edge_height": 8,
                "height": 128,
                "power": 1.0,
                "crown": 0,
                "profile": "semicircle",
            }
        ],
    }
    recipe.setdefault("materials", {}).setdefault("chrome", {}).update(
        {
            "reflection_enabled": True,
            "reflection_opacity": 0.62,
            "normal_warp_x": 0.18,
            "normal_warp_y": 0.28,
            "reflection_edge_guard_px": 1.2,
            "reflection_edge_feather_px": 8,
        }
    )
    recipe.setdefault("lighting", {}).update(
        {
            "normal_strength": 4.6,
            "ambient": 0.72,
            "diffuse": 0.72,
            "specular": 1.8,
            "specular_power": 78,
            "chrome_shadow_opacity": 0.72,
            "chrome_highlight_opacity": 0.86,
            "ao_opacity": 0.18,
        }
    )
    recipe["layers"] = [
        {
            "id": "chrome-extrusion-shadow-layer",
            "type": "chrome-extrude",
            "paint": "#020304",
            "opacity": 0.82,
            "steps": 18,
            "step_dx": 1.1,
            "step_dy": 1.35,
            "start_opacity": 0.26,
            "end_opacity": 0.07,
            "visible": True,
        },
        {
            "id": "chrome-extrusion-stack-layer",
            "type": "chrome-extrude",
            "paint": "url(#chrome-extrude-depth-gradient)",
            "opacity": 0.92,
            "steps": 16,
            "step_dx": 1.0,
            "step_dy": 1.25,
            "start_opacity": 0.68,
            "end_opacity": 0.14,
            "filter": "extrusion_soften",
            "visible": True,
        },
        {
            "id": "outer-chrome-cast-shadow-on-background-layer",
            "type": "projected-shadow",
            "caster_ref": "chrome-dome-layer",
            "receiver": "background",
            "paint": "#020304",
            "opacity": 0.22,
            "dx": 12,
            "dy": 15,
            "blur": 10.5,
            "blend": "multiply",
            "visible": True,
        },
        {
            "id": "chrome-dome-layer",
            "type": "stroke",
            "paint": "url(#chrome-top-gradient)",
            "start": 1.1,
            "thickness": 36.5,
            "opacity": 1,
            "dx": 0,
            "dy": 0,
            "filter": "chrome_bevel",
            "mask": "outside_fill",
            "visible": True,
        },
        {
            "id": "chrome-environment-reflection-layer",
            "type": "lighting-overlay",
            "source": "chrome_reflection",
            "mask": "chrome_stack",
            "opacity": 0.62,
            "visible": True,
        },
        {
            "id": "chrome-normal-shadow-layer",
            "type": "lighting-overlay",
            "source": "chrome_shadow",
            "mask": "chrome_stack",
            "opacity": 0.72,
            "blend": "multiply",
            "visible": True,
        },
        {
            "id": "chrome-normal-highlight-layer",
            "type": "lighting-overlay",
            "source": "chrome_highlight",
            "mask": "chrome_stack",
            "opacity": 0.86,
            "blend": "screen",
            "visible": True,
        },
        {
            "id": "chrome-dark-reflection-layer",
            "type": "rect-fill",
            "paint": "url(#chrome-dark-reflection-gradient)",
            "opacity": 0.12,
            "height_ratio": 1,
            "mask_ref": "chrome-dome-layer",
            "blend": "multiply",
            "visible": True,
        },
        {
            "id": "chrome-hot-reflection-layer",
            "type": "rect-fill",
            "paint": "url(#chrome-hot-reflection-gradient)",
            "opacity": 0.42,
            "height_ratio": 1,
            "mask_ref": "chrome-dome-layer",
            "blend": "screen",
            "visible": True,
        },
        {
            "id": "inner-contact-cut-layer",
            "type": "stroke",
            "paint": "#050505",
            "start": 0,
            "thickness": 0.9,
            "opacity": 0.82,
            "dx": 0,
            "dy": 0,
            "mask": "outside_fill",
            "visible": True,
        },
        {
            "id": "inner-contact-hotline-layer",
            "type": "stroke",
            "paint": "#f8fbff",
            "start": 1.05,
            "thickness": 0.38,
            "opacity": 0.38,
            "dx": -0.12,
            "dy": -0.18,
            "mask": "outside_fill",
            "visible": True,
        },
        {
            "id": "outer-silhouette-cut-layer",
            "type": "stroke",
            "paint": "#05080a",
            "start": 37.15,
            "thickness": 0.85,
            "opacity": 0.78,
            "dx": 0.12,
            "dy": 0.18,
            "mask": "outside_fill",
            "visible": True,
        },
        {
            "id": "outer-silhouette-hotline-layer",
            "type": "stroke",
            "paint": "#f6fbff",
            "start": 36.55,
            "thickness": 0.45,
            "opacity": 0.34,
            "dx": -0.15,
            "dy": -0.2,
            "mask": "outside_fill",
            "visible": True,
        },
        {
            "id": "fill-layer",
            "type": "fill",
            "paint": "url(#red-fill-gradient)",
            **({"media": fill_media} if fill_media else {}),
            "opacity": 1,
            "visible": True,
        },
        {
            "id": "red-enamel-basin-shadow-layer",
            "type": "rect-fill",
            "paint": "url(#red-enamel-basin-gradient)",
            "opacity": 0.38,
            "height_ratio": 1,
            "clip": "fill",
            "blend": "multiply",
            "visible": True,
        },
        {
            "id": "red-enamel-gloss-layer",
            "type": "rect-fill",
            "paint": "url(#red-gloss-gradient)",
            "opacity": 0.12,
            "height_ratio": 0.62,
            "clip": "fill",
            "blend": "screen",
            "visible": True,
        },
        {
            "id": "chrome-cast-shadow-on-fill-layer",
            "type": "projected-shadow",
            "caster_ref": "chrome-dome-layer",
            "receiver": "fill",
            "paint": "#020304",
            "opacity": 0.2,
            "dx": 4.4,
            "dy": 5.8,
            "blur": 5.2,
            "blend": "multiply",
            "visible": True,
        },
        {
            "id": "fill-contact-soft-shadow-layer",
            "type": "stroke",
            "paint": "#050505",
            "width": 15,
            "opacity": 0.07,
            "dx": 1.6,
            "dy": 2.4,
            "clip": "fill",
            "filter": "contact_soften",
            "visible": True,
        },
        {
            "id": "ambient-occlusion-layer",
            "type": "lighting-overlay",
            "source": "ambient_occlusion",
            "mask": "fill",
            "opacity": 0.18,
            "blend": "multiply",
            "visible": True,
        },
    ]
    TARGET.write_text(json.dumps(recipe, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {TARGET}")


if __name__ == "__main__":
    main()
