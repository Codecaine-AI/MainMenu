from __future__ import annotations

import copy
import importlib
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path
from types import SimpleNamespace

import pytest

RENDERER_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = RENDERER_ROOT.parent / "projects/melee"


@pytest.fixture(scope="module")
def renderer():
    if str(RENDERER_ROOT) not in sys.path:
        sys.path.insert(0, str(RENDERER_ROOT))
    render_recipe = importlib.import_module("scripts.render_recipe")
    layers = importlib.import_module("scripts.layers")
    lighting = importlib.import_module("scripts.lighting")
    recipe_module = importlib.import_module("scripts.recipe")
    utils = importlib.import_module("scripts.utils")
    css_gen = importlib.import_module("scripts.css_gen")
    return SimpleNamespace(
        render_svg=render_recipe.render_svg,
        projected_shadow_layer_svg=layers.projected_shadow_layer_svg,
        lighting_overlay_layer_svg=layers.lighting_overlay_layer_svg,
        fill_layer_svg=layers.fill_layer_svg,
        layer_svg=layers.layer_svg,
        compose_height_map=lighting.compose_height_map,
        normal_from_height=lighting.normal_from_height,
        rasterize_band_mask=lighting.rasterize_band_mask,
        rasterize_fill_mask=lighting.rasterize_fill_mask,
        layer_opacity_value=recipe_module.layer_opacity_value,
        recipe_for_variant=recipe_module.recipe_for_variant,
        relief_band_bounds=recipe_module.relief_band_bounds,
        relief_config=recipe_module.relief_config,
        recipe_css=css_gen.recipe_css,
        relief_profile_t=utils.relief_profile_t,
        smoothstep01=utils.smoothstep01,
    )


@pytest.fixture(scope="module")
def recipe() -> dict:
    return json.loads(
        (PROJECT_ROOT / "recipes/layer-recipe.json").read_text(encoding="utf-8")
    )


@pytest.fixture(scope="module")
def at_record() -> dict:
    paths = json.loads(
        (PROJECT_ROOT / "inputs/glyph_paths.json").read_text(encoding="utf-8")
    )
    return next(record for record in paths["glyphs"] if record["glyph_name"] == "at")


def test_projected_shadow_layer_emits_filter_mask_and_fill_clip(
    renderer, recipe, at_record
):
    layer = next(
        entry
        for entry in recipe["layers"]
        if entry["id"] == "inner-chrome-cast-shadow-on-red-layer"
    )
    svg = renderer.projected_shadow_layer_svg(
        layer,
        [(at_record, 0.0)],
        int(at_record["advance_width"]),
        int(at_record["units_per_em"]),
        0.0,
        recipe,
    )

    assert 'id="inner-chrome-cast-shadow-on-red-layer-blur"' in svg
    assert 'id="inner-chrome-cast-shadow-on-red-layer-projected-mask"' in svg
    assert 'clip-path="url(#fill-clip)"' in svg
    assert 'data-projected-shadow-blur="inner-chrome-cast-shadow-on-red-layer"' in svg
    assert (
        'data-projected-shadow-transform="inner-chrome-cast-shadow-on-red-layer"' in svg
    )
    assert 'transform="translate(4.6 6.2)"' in svg
    assert 'mask="url(#inner-chrome-cast-shadow-on-red-layer-projected-mask)"' in svg


def test_relief_config_is_optional_and_validates_references(renderer, recipe):
    old_recipe = copy.deepcopy(recipe)
    old_recipe.pop("relief", None)
    old_recipe.pop("lighting", None)

    assert renderer.relief_config(old_recipe)["enabled"] is False

    invalid_recipe = copy.deepcopy(recipe)
    invalid_recipe["relief"]["bands"][0]["layer_id"] = "missing-layer"

    with pytest.raises(ValueError, match="missing-layer"):
        renderer.relief_config(invalid_recipe)


def test_relief_profile_supports_linear_and_preserves_smooth_default(renderer):
    value = 0.25

    assert renderer.relief_profile_t(value, {"profile": "linear"}) == pytest.approx(
        value
    )
    assert renderer.relief_profile_t(value, {}) == pytest.approx(
        renderer.smoothstep01(value)
    )
    assert renderer.relief_profile_t(value, {}) != pytest.approx(value)


def test_normal_from_height_scales_raster_gradient_to_svg_units(renderer):
    import numpy as np

    height_map = np.tile(np.arange(5, dtype=np.float32), (5, 1))

    base_normal = renderer.normal_from_height(
        height_map, normal_strength=1, sample_scale=1
    )
    scaled_normal = renderer.normal_from_height(
        height_map, normal_strength=1, sample_scale=3
    )

    base_x_slope = abs(float(base_normal[2, 2, 0] / base_normal[2, 2, 2]))
    scaled_x_slope = abs(float(scaled_normal[2, 2, 0] / scaled_normal[2, 2, 2]))

    assert scaled_x_slope == pytest.approx(base_x_slope * 3)


def test_recipe_uses_trapezoidal_chrome_tuning(renderer, recipe):
    relief_by_id = {entry["id"]: entry for entry in recipe["relief"]["bands"]}
    layer_by_id = {entry["id"]: entry for entry in recipe["layers"]}

    assert recipe["relief"]["height_scale"] == 72
    assert recipe["relief"]["background_height"] == -20
    assert relief_by_id["inner-ramp-relief"] == {
        "id": "inner-ramp-relief",
        "layer_id": "inner-silver-down-ramp-layer",
        "role": "ramp",
        "height_from": 0,
        "height_to": 56,
        "crown": 0,
        "profile": "linear",
    }
    assert relief_by_id["chrome-top-relief"] == {
        "id": "chrome-top-relief",
        "layer_id": "silver-rim-layer",
        "role": "raised_plateau",
        "edge_height": 56,
        "height": 122,
        "shoulder_width_ratio": 0.045,
        "crown": 0,
        "profile": "linear",
    }
    assert relief_by_id["outer-ramp-relief"] == {
        "id": "outer-ramp-relief",
        "layer_id": "outer-silver-down-ramp-layer",
        "role": "ramp",
        "height_from": 56,
        "height_to": -14,
        "crown": 0,
        "profile": "linear",
    }

    assert recipe["lighting"]["normal_height_scale"] == 1.25
    assert recipe["lighting"]["normal_blur_sigma"] == 0.18
    assert recipe["lighting"]["normal_gradient_clip"] == 18
    assert recipe["lighting"]["light"] == {"x": -0.9, "y": -1.15, "z": 0.85}
    assert recipe["lighting"]["normal_strength"] == 4.2
    assert recipe["lighting"]["ambient"] == 0.74
    assert recipe["lighting"]["diffuse"] == 0.81
    assert recipe["lighting"]["specular"] == 1.65
    assert recipe["lighting"]["specular_power"] == 90
    assert recipe["lighting"]["chrome_shadow_opacity"] == 0.8
    assert recipe["materials"]["chrome"]["reflection_edge_guard_px"] == 2
    assert recipe["materials"]["chrome"]["reflection_edge_feather_px"] == 6
    assert recipe["lighting"]["chrome_highlight_opacity"] == 0.8
    assert recipe["lighting"]["ao_opacity"] == 0.2

    shadow = layer_by_id["chrome-top-cast-shadow-on-lower-bevel-layer"]
    assert shadow["opacity"] == 0.14
    assert shadow["dx"] == 1.5
    assert shadow["dy"] == 1.9
    assert shadow["blur"] == 0.9
    assert (
        renderer.layer_opacity_value(
            layer_by_id["chrome-normal-highlight-layer"], recipe
        )
        == 0.8
    )

    assert layer_by_id["inner-silver-down-ramp-layer"]["start"] == 1
    assert layer_by_id["inner-silver-down-ramp-layer"]["end"] == 6.8
    assert layer_by_id["silver-rim-layer"]["start"] == 6.8
    assert layer_by_id["silver-rim-layer"]["thickness"] == 23.2
    assert layer_by_id["outer-silver-down-ramp-layer"]["start"] == 30
    assert layer_by_id["outer-silver-down-ramp-layer"]["end"] == 38.4
    assert layer_by_id["inner-ramp-top-face-blend-layer"]["start"] == 5.95
    assert layer_by_id["inner-ramp-top-face-blend-layer"]["thickness"] == 2.45
    assert layer_by_id["inner-ramp-top-face-blend-layer"]["opacity"] == 0.34
    assert layer_by_id["outer-ramp-top-face-blend-layer"]["start"] == 28.85
    assert layer_by_id["outer-ramp-top-face-blend-layer"]["thickness"] == 2.7
    assert layer_by_id["outer-ramp-top-face-blend-layer"]["opacity"] == 0.5
    assert layer_by_id["inner-ramp-top-hotline-layer"]["start"] == 5.85
    assert layer_by_id["inner-ramp-top-hotline-layer"]["opacity"] == 0.76
    assert layer_by_id["outer-ramp-top-hotline-layer"]["start"] == 29.35
    assert layer_by_id["outer-ramp-top-hotline-layer"]["opacity"] == 0.56
    assert layer_by_id["final-inner-chrome-hotline-layer"]["start"] == 6.55
    assert layer_by_id["final-inner-chrome-hotline-layer"]["opacity"] == 0.58
    assert layer_by_id["final-outer-chrome-hotline-layer"]["start"] == 29.7
    assert layer_by_id["final-outer-chrome-hotline-layer"]["opacity"] == 0.5
    assert layer_by_id["chrome-top-inner-lift-shadow-layer"]["start"] == 6.78
    assert layer_by_id["chrome-top-inner-lift-shadow-layer"]["opacity"] == 0.36
    assert layer_by_id["chrome-top-outer-lift-shadow-layer"]["start"] == 29.42
    assert layer_by_id["chrome-top-outer-lift-shadow-layer"]["opacity"] == 0.34


def test_raised_plateau_height_map_lifts_middle_without_edge_jump(renderer):
    import numpy as np
    from scipy import ndimage

    record = {
        "glyph": "box",
        "glyph_name": "box",
        "path_d": "M 30 30 L 70 30 L 70 70 L 30 70 Z",
    }
    records = [(record, 0.0)]
    recipe = {
        "layers": [
            {
                "id": "inner",
                "type": "stroke",
                "mask": "outside_fill",
                "start": 0,
                "thickness": 5,
            },
            {
                "id": "top",
                "type": "stroke",
                "mask": "outside_fill",
                "start": 5,
                "thickness": 10,
            },
            {
                "id": "outer",
                "type": "stroke",
                "mask": "outside_fill",
                "start": 15,
                "thickness": 5,
            },
        ],
        "relief": {
            "enabled": True,
            "height_scale": 32,
            "fill_height": 0,
            "background_height": -8,
            "bands": [
                {
                    "id": "inner-relief",
                    "layer_id": "inner",
                    "role": "ramp",
                    "height_from": 0,
                    "height_to": 24,
                },
                {
                    "id": "top-relief",
                    "layer_id": "top",
                    "role": "raised_plateau",
                    "edge_height": 32,
                    "height": 56,
                    "shoulder_width_ratio": 0.11,
                    "crown": 4,
                },
                {
                    "id": "outer-relief",
                    "layer_id": "outer",
                    "role": "ramp",
                    "height_from": 24,
                    "height_to": 2,
                },
            ],
        },
        "lighting": {"curve_steps": 4},
    }

    height_map, _ = renderer.compose_height_map(records, 100, 100, 0, recipe, 1)
    fill_image = renderer.rasterize_fill_mask(records, 100, 100, 0, 1, curve_steps=4)
    fill_mask = np.asarray(fill_image, dtype=bool)
    outside_distance = ndimage.distance_transform_edt(~fill_mask)
    start, end = renderer.relief_band_bounds(recipe, recipe["relief"]["bands"][1])
    top_mask = renderer.rasterize_band_mask(outside_distance, fill_mask, start, end, 1)
    raw_t = np.clip((outside_distance[top_mask] - start) / (end - start), 0, 1)
    top_heights = height_map[top_mask]

    edge_heights = top_heights[np.minimum(raw_t, 1 - raw_t) <= 0.05]
    middle_heights = top_heights[np.abs(raw_t - 0.5) <= 0.05]

    assert edge_heights.size > 0
    assert middle_heights.size > 0
    assert float(np.median(edge_heights)) == pytest.approx(32, abs=0.1)
    assert float(np.median(middle_heights)) == pytest.approx(60, abs=0.1)
    assert float(np.median(middle_heights) - np.median(edge_heights)) > 25


def test_semicircle_dome_height_map_rounds_from_edge_to_crown(renderer):
    import numpy as np
    from scipy import ndimage

    record = {
        "glyph": "box",
        "glyph_name": "box",
        "path_d": "M 30 30 L 70 30 L 70 70 L 30 70 Z",
    }
    records = [(record, 0.0)]
    recipe = {
        "layers": [
            {
                "id": "dome",
                "type": "stroke",
                "mask": "outside_fill",
                "start": 5,
                "thickness": 20,
            },
        ],
        "relief": {
            "enabled": True,
            "height_scale": 64,
            "fill_height": 0,
            "background_height": -8,
            "bands": [
                {
                    "id": "dome-relief",
                    "layer_id": "dome",
                    "role": "semicircle_dome",
                    "edge_height": 4,
                    "height": 44,
                    "power": 1.0,
                },
            ],
        },
        "lighting": {"curve_steps": 4},
    }

    height_map, _ = renderer.compose_height_map(records, 100, 100, 0, recipe, 1)
    fill_image = renderer.rasterize_fill_mask(records, 100, 100, 0, 1, curve_steps=4)
    fill_mask = np.asarray(fill_image, dtype=bool)
    outside_distance = ndimage.distance_transform_edt(~fill_mask)
    start, end = renderer.relief_band_bounds(recipe, recipe["relief"]["bands"][0])
    dome_mask = renderer.rasterize_band_mask(outside_distance, fill_mask, start, end, 1)
    raw_t = np.clip((outside_distance[dome_mask] - start) / (end - start), 0, 1)
    dome_heights = height_map[dome_mask]

    edge_heights = dome_heights[np.minimum(raw_t, 1 - raw_t) <= 0.05]
    crown_heights = dome_heights[np.abs(raw_t - 0.5) <= 0.05]
    quarter_heights = dome_heights[np.abs(raw_t - 0.25) <= 0.05]

    assert edge_heights.size > 0
    assert crown_heights.size > 0
    assert quarter_heights.size > 0
    assert float(np.median(edge_heights)) == pytest.approx(4, abs=1.0)
    assert float(np.median(crown_heights)) == pytest.approx(44, abs=1.0)
    assert float(np.median(edge_heights)) < float(np.median(quarter_heights))
    assert float(np.median(quarter_heights)) < float(np.median(crown_heights))


def test_lighting_overlay_layer_emits_image_and_chrome_stack_mask(renderer, recipe):
    layer = next(
        entry
        for entry in recipe["layers"]
        if entry["id"] == "chrome-normal-shadow-layer"
    )
    svg = renderer.lighting_overlay_layer_svg(
        layer, 986, 1000, {"chrome_shadow": "data:image/png;base64,abc"}
    )

    assert 'id="chrome-normal-shadow-layer"' in svg
    assert 'mask="url(#chrome-stack-mask)"' in svg
    assert '<image href="data:image/png;base64,abc"' in svg
    assert 'preserveAspectRatio="none"' in svg


def test_fill_layer_uses_layer_media(renderer, recipe):
    layer = next(entry for entry in recipe["layers"] if entry["id"] == "fill-layer")
    svg = renderer.fill_layer_svg(layer, 986, 1080, recipe)
    css = renderer.recipe_css(recipe)

    assert '<rect width="986" height="1080" fill="url(#red-fill-gradient)"/>' not in svg
    assert '<foreignObject x="0" y="0" width="986" height="1080">' in svg
    assert 'class="melee-layer-paint-fallback" style="display:none"' in svg
    assert 'class="melee-layer-media-shell melee-fill-media-shell"' in svg
    assert '<video src="/generation/inputs/extras/test-fire.mp4"' in svg
    assert "filter:hue-rotate(-155.0deg)" in svg
    assert "--melee3-fill-layer-paint: url(#red-fill-gradient);" in css


def test_fill_layer_supports_image_and_video_media(renderer):
    image_layer = {
        "id": "fill-layer",
        "type": "fill",
        "paint": "url(#red-fill-gradient)",
        "media": {
            "enabled": True,
            "mode": "image",
            "href": "/media/brushed-metal-red.jpg",
            "opacity": 0.8,
            "preserve_aspect_ratio": "xMidYMid slice",
        },
    }
    video_layer = {
        "id": "fill-layer",
        "type": "fill",
        "paint": "url(#red-fill-gradient)",
        "media": {
            "enabled": True,
            "mode": "video",
            "src": "/media/interior-loop.mp4",
            "poster": "/media/interior-poster.jpg",
            "opacity": 0.9,
        },
    }
    image_svg = renderer.fill_layer_svg(
        image_layer,
        200,
        120,
        {},
    )
    video_svg = renderer.fill_layer_svg(
        video_layer,
        200,
        120,
        {},
    )

    assert '<rect width="200" height="120" fill="url(#red-fill-gradient)"/>' not in image_svg
    assert 'class="melee-layer-paint-fallback" style="display:none"' in image_svg
    assert '<image href="/media/brushed-metal-red.jpg"' in image_svg
    assert 'preserveAspectRatio="xMidYMid slice"' in image_svg
    assert 'opacity="0.8"' in image_svg

    assert '<rect width="200" height="120" fill="url(#red-fill-gradient)"/>' not in video_svg
    assert 'class="melee-layer-paint-fallback" style="display:none"' in video_svg
    assert '<video src="/media/interior-loop.mp4"' in video_svg
    assert 'poster="/media/interior-poster.jpg"' in video_svg
    assert 'autoplay="autoplay"' in video_svg
    assert 'muted="muted"' in video_svg
    assert "object-fit:cover; opacity:0.9" in video_svg


def test_fill_layer_still_supports_legacy_recipe_media(renderer):
    layer = {"id": "fill-layer", "type": "fill", "paint": "url(#red-fill-gradient)"}
    svg = renderer.fill_layer_svg(
        layer,
        200,
        120,
        {
            "interior_media": {
                "enabled": True,
                "mode": "video",
                "src": "/media/legacy-loop.mp4",
            }
        },
    )

    assert '<video src="/media/legacy-loop.mp4"' in svg


def test_fill_layer_uses_paint_when_media_is_off(renderer):
    layer = {
        "id": "fill-layer",
        "type": "fill",
        "paint": "url(#red-fill-gradient)",
        "media": {
            "enabled": False,
            "mode": "video",
            "src": "/media/interior-loop.mp4",
        },
    }
    svg = renderer.fill_layer_svg(layer, 200, 120, {})

    assert '<rect width="200" height="120" fill="url(#red-fill-gradient)"/>' in svg
    assert "<video" not in svg


def test_stroke_and_rect_layers_can_use_media_surface(renderer, at_record):
    media = {
        "enabled": True,
        "mode": "video",
        "src": "/media/surface-loop.mp4",
    }
    stroke_svg = renderer.layer_svg(
        {
            "id": "chrome-media-layer",
            "type": "stroke",
            "paint": "#f5f7fa",
            "width": 12,
            "media": media,
        },
        [(at_record, 0.0)],
        986,
        1080,
        0.0,
        {"layers": []},
    )
    rect_svg = renderer.layer_svg(
        {
            "id": "gloss-media-layer",
            "type": "rect-fill",
            "paint": "#ffffff",
            "height_ratio": 0.5,
            "media": media,
        },
        [(at_record, 0.0)],
        986,
        1080,
        0.0,
        {"layers": []},
    )

    assert 'id="chrome-media-layer-media-mask"' in stroke_svg
    assert '<video src="/media/surface-loop.mp4"' in stroke_svg
    assert '<foreignObject x="0" y="0" width="986" height="540">' in rect_svg
    assert '<video src="/media/surface-loop.mp4"' in rect_svg


def test_rendered_svg_contains_lighting_layers_and_is_valid_xml(
    renderer, recipe, at_record
):
    test_recipe = copy.deepcopy(recipe)
    test_recipe["lighting"]["debug"] = False
    svg = renderer.render_svg(
        [(at_record, 0.0)],
        int(at_record["advance_width"]),
        int(at_record["units_per_em"]),
        0.0,
        test_recipe,
        at_record["glyph"],
    )

    ET.fromstring(svg)
    assert 'id="inner-chrome-cast-shadow-on-red-layer"' in svg
    assert 'id="chrome-normal-shadow-layer"' in svg
    assert 'id="chrome-normal-highlight-layer"' in svg
    assert 'id="chrome-environment-reflection-layer"' in svg
    assert 'id="ambient-occlusion-layer"' in svg
    assert "<foreignObject" in svg
    assert 'class="melee-layer-media-shell melee-fill-media-shell"' in svg
    assert '<video src="/generation/inputs/extras/test-fire.mp4"' in svg
    assert "data:image/png;base64," in svg


def test_word_variant_reduces_reflection_and_shadow_depth(renderer, recipe):
    word_recipe = renderer.recipe_for_variant(recipe, "word_display")
    base_shadow = next(
        entry
        for entry in recipe["layers"]
        if entry["id"] == "inner-chrome-cast-shadow-on-red-layer"
    )
    word_shadow = next(
        entry
        for entry in word_recipe["layers"]
        if entry["id"] == "inner-chrome-cast-shadow-on-red-layer"
    )

    assert word_recipe["lighting"]["resolution_scale"] == 2
    assert word_recipe["materials"]["chrome"]["reflection_opacity"] == 0.36
    assert word_shadow["dx"] == pytest.approx(base_shadow["dx"] * 0.78)
    assert word_shadow["blur"] == pytest.approx(base_shadow["blur"] * 0.86)


def test_recipe_without_relief_still_renders_valid_xml(renderer, recipe, at_record):
    old_recipe = copy.deepcopy(recipe)
    old_recipe.pop("relief", None)
    old_recipe.pop("lighting", None)

    svg = renderer.render_svg(
        [(at_record, 0.0)],
        int(at_record["advance_width"]),
        int(at_record["units_per_em"]),
        0.0,
        old_recipe,
        at_record["glyph"],
    )

    ET.fromstring(svg)
    assert "data:image/png;base64," not in svg
