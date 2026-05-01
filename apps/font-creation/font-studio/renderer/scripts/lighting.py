from __future__ import annotations

import base64
import io
import math
from pathlib import Path
from typing import Any

from .recipe import (
    relief_band_bounds,
    relief_config,
)
from .svg_path import svg_path_contours
from .utils import (
    hex_to_rgb,
    normalize_vector,
    relief_profile_t,
    safe_label,
    stop_offset_value,
)

RENDERER_ROOT = Path(__file__).resolve().parents[1]
STUDIO_ROOT = RENDERER_ROOT.parent
DEFAULT_PROJECT_ROOT = STUDIO_ROOT / "projects/melee"


def rasterize_fill_mask(
    records: list[tuple[dict[str, Any], float]],
    width: int,
    height: int,
    y: float,
    scale: float,
    curve_steps: int = 32,
) -> Any:
    from PIL import Image, ImageChops, ImageDraw

    image_size = (
        max(1, int(math.ceil(width * scale))),
        max(1, int(math.ceil(height * scale))),
    )
    combined = Image.new("1", image_size, 0)

    for record, x_offset in records:
        glyph_mask = Image.new("1", image_size, 0)
        for contour in svg_path_contours(record["path_d"], curve_steps=curve_steps):
            if len(contour) < 3:
                continue
            contour_mask = Image.new("1", image_size, 0)
            points = [((x_offset + px) * scale, (y + py) * scale) for px, py in contour]
            ImageDraw.Draw(contour_mask).polygon(points, fill=1)
            glyph_mask = ImageChops.logical_xor(glyph_mask, contour_mask)
        combined = ImageChops.logical_or(combined, glyph_mask)

    return combined


def rasterize_band_mask(
    outside_distance: Any,
    fill_mask: Any,
    start: float,
    end: float,
    scale: float,
) -> Any:
    start_px = start * scale
    end_px = end * scale
    return (~fill_mask) & (outside_distance >= start_px) & (outside_distance <= end_px)


def compose_height_map(
    records: list[tuple[dict[str, Any], float]],
    width: int,
    height: int,
    y: float,
    recipe: dict[str, Any],
    scale: float,
) -> tuple[Any, dict[str, Any]]:
    import numpy as np
    from scipy import ndimage

    relief = relief_config(recipe)
    if not relief["enabled"]:
        image_w = max(1, int(math.ceil(width * scale)))
        image_h = max(1, int(math.ceil(height * scale)))
        empty = np.zeros((image_h, image_w), dtype=np.float32)
        return empty, {
            "fill": empty.astype(bool),
            "chrome_stack": empty.astype(bool),
            "relief": empty.astype(bool),
        }

    curve_steps = int(recipe.get("lighting", {}).get("curve_steps", 32))
    fill_image = rasterize_fill_mask(records, width, height, y, scale, curve_steps)
    fill_mask = np.asarray(fill_image, dtype=bool)
    outside_distance = ndimage.distance_transform_edt(~fill_mask)
    height_map = np.full(fill_mask.shape, relief["background_height"], dtype=np.float32)
    height_map[fill_mask] = relief["fill_height"]

    chrome_stack = np.zeros(fill_mask.shape, dtype=bool)
    relief_mask = fill_mask.copy()

    for band in relief["bands"]:
        start, end = relief_band_bounds(recipe, band)
        if end <= start:
            continue
        mask = rasterize_band_mask(outside_distance, fill_mask, start, end, scale)
        if not np.any(mask):
            continue
        chrome_stack |= mask
        relief_mask |= mask
        role = band.get("role", "plateau")
        raw_t = np.clip((outside_distance[mask] / scale - start) / (end - start), 0, 1)
        shaped_t = relief_profile_t(raw_t, band)
        if role == "ramp":
            height_from = float(band.get("height_from", relief["fill_height"]))
            height_to = float(band.get("height_to", height_from))
            height_map[mask] = height_from + (height_to - height_from) * shaped_t
        elif role in {"semicircle", "semicircle_dome", "round_dome", "dome"}:
            edge_height = float(
                band.get("edge_height", band.get("height_from", relief["fill_height"]))
            )
            band_width = max(end - start, 0.001)
            # A true semicircle over a band has radius = band_width / 2.
            # The old absolute height path is still available, but should be explicit.
            height_mode = str(band.get("height_mode", "band_radius")).lower()
            if height_mode in {"absolute", "fixed"}:
                top_height = float(
                    band.get("height", edge_height + band_width * 0.5)
                )
            else:
                radius_scale = float(band.get("radius_scale", 1.0))
                top_height = edge_height + band_width * 0.5 * radius_scale
            curve = str(band.get("curve", band.get("profile", "semicircle"))).lower()
            if curve in {"bubble", "soft", "sine", "cosine"}:
                # Softer visual bubble. Avoids the hard vertical tangent of a pure semicircle.
                dome_t = np.sin(raw_t * math.pi)
            else:
                # Geometric semicircle.
                x = raw_t * 2.0 - 1.0
                dome_t = np.sqrt(np.clip(1.0 - x * x, 0.0, 1.0))
            power = float(band.get("power", 1.0))
            if power != 1.0:
                dome_t = np.power(np.clip(dome_t, 0.0, 1.0), power)
            height_map[mask] = edge_height + (top_height - edge_height) * dome_t
        elif role == "raised_plateau":
            edge_height = float(
                band.get("edge_height", band.get("height", relief["height_scale"]))
            )
            top_height = float(band.get("height", edge_height))
            shoulder_width = max(float(band.get("shoulder_width_ratio", 0.18)), 0.001)
            edge_distance = np.minimum(raw_t, 1 - raw_t)
            lift_t = relief_profile_t(edge_distance / shoulder_width, band)
            height_map[mask] = edge_height + (top_height - edge_height) * lift_t
        else:
            height_map[mask] = float(band.get("height", relief["height_scale"]))
        crown = float(band.get("crown", 0))
        if crown:
            height_map[mask] += np.sin(raw_t * math.pi) * crown

    return height_map, {
        "fill": fill_mask,
        "chrome_stack": chrome_stack,
        "relief": relief_mask,
    }


def stabilized_normal_source(
    height_map: Any,
    masks: dict[str, Any],
    recipe: dict[str, Any],
    sample_scale: float = 1.0,
) -> Any:
    import numpy as np
    from scipy import ndimage

    lighting = recipe.get("lighting", {})
    relief_mask = masks.get("relief")
    source = height_map.astype(np.float32).copy()
    if relief_mask is not None and np.any(relief_mask):
        outside = ~relief_mask
        _, nearest = ndimage.distance_transform_edt(outside, return_indices=True)
        source[outside] = source[nearest[0][outside], nearest[1][outside]]

    source *= float(lighting.get("normal_height_scale", 1.0))
    sigma = float(lighting.get("normal_blur_sigma", 0))
    blur_units = str(lighting.get("normal_blur_units", "px")).lower()
    if blur_units in {"svg", "user", "user_space", "userspace"}:
        sigma *= sample_scale
    if sigma > 0:
        source = ndimage.gaussian_filter(source, sigma=sigma)
    return source


def normal_from_height(
    height_map: Any,
    normal_strength: float,
    gradient_clip: float | None = None,
    sample_scale: float = 1.0,
) -> Any:
    import numpy as np

    dy, dx = np.gradient(height_map)
    dx *= sample_scale
    dy *= sample_scale
    if gradient_clip is not None and gradient_clip > 0:
        slope = np.hypot(dx, dy)
        factor = np.minimum(1.0, gradient_clip / np.maximum(slope, 1e-6))
        dx *= factor
        dy *= factor
    normal = np.dstack(
        [
            -dx * normal_strength,
            -dy * normal_strength,
            np.ones_like(height_map),
        ]
    )
    length = np.linalg.norm(normal, axis=2, keepdims=True)
    length[length == 0] = 1
    return normal / length


def reflection_edge_fade(chrome_mask: Any, recipe: dict[str, Any]) -> Any:
    import numpy as np
    from scipy import ndimage

    chrome = recipe.get("materials", {}).get("chrome", {})
    guard_px = float(chrome.get("reflection_edge_guard_px", 4))
    feather_px = max(float(chrome.get("reflection_edge_feather_px", 10)), 0.001)
    distance = ndimage.distance_transform_edt(chrome_mask)
    return np.clip((distance - guard_px) / feather_px, 0, 1)


def chrome_reflection_map(normal: Any, chrome_mask: Any, recipe: dict[str, Any]) -> Any:
    import numpy as np
    from PIL import Image

    chrome = recipe.get("materials", {}).get("chrome", {})
    if chrome.get("reflection_enabled") is False:
        alpha = np.zeros(chrome_mask.shape, dtype=np.uint8)
        return Image.fromarray(np.dstack([alpha, alpha, alpha, alpha]), "RGBA")

    environment = chrome.get("environment") or [
        {"offset": "0%", "color": "#ffffff"},
        {"offset": "9%", "color": "#101820"},
        {"offset": "27%", "color": "#ffffff"},
        {"offset": "48%", "color": "#050708"},
        {"offset": "58%", "color": "#f7fbff"},
        {"offset": "84%", "color": "#111820"},
        {"offset": "100%", "color": "#59636b"},
    ]
    stops = sorted(environment, key=stop_offset_value)
    positions = np.array([stop_offset_value(stop) for stop in stops], dtype=np.float32)
    colors = np.array(
        [hex_to_rgb(str(stop.get("color", "#ffffff"))) for stop in stops],
        dtype=np.float32,
    )
    opacities = np.array(
        [float(stop.get("opacity", 1)) for stop in stops], dtype=np.float32
    )

    height, width = chrome_mask.shape
    vertical = np.linspace(0, 1, height, dtype=np.float32)[:, None]
    warp_x = float(chrome.get("normal_warp_x", 0.12))
    warp_y = float(chrome.get("normal_warp_y", 0.22))
    edge_fade = reflection_edge_fade(chrome_mask, recipe)
    env_t = np.clip(
        vertical
        + normal[..., 0] * warp_x * edge_fade
        + normal[..., 1] * warp_y * edge_fade,
        0,
        1,
    )
    flat_t = env_t.ravel()

    rgb = np.zeros((height, width, 3), dtype=np.float32)
    for index in range(3):
        rgb[..., index] = np.interp(flat_t, positions, colors[:, index]).reshape(
            height, width
        )
    contrast = float(chrome.get("reflection_contrast", 1.0))
    brightness = float(chrome.get("reflection_brightness", 1.0))
    rgb = ((rgb - 127.5) * contrast + 127.5) * brightness
    soft_limit = float(chrome.get("reflection_soft_limit", 228))
    soft_knee = max(float(chrome.get("reflection_soft_knee", 24)), 0.001)
    excess = np.maximum(rgb - soft_limit, 0.0)
    rgb = np.where(
        rgb > soft_limit,
        soft_limit + soft_knee * (1.0 - np.exp(-excess / soft_knee)),
        rgb,
    )
    rgb = np.clip(rgb, 0, 255)
    channels = np.zeros((height, width, 4), dtype=np.uint8)
    channels[..., :3] = rgb.astype(np.uint8)
    alpha = np.interp(flat_t, positions, opacities).reshape(height, width)
    alpha *= float(chrome.get("reflection_alpha_scale", 1.0))
    channels[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
    return Image.fromarray(channels, "RGBA")


def compute_lighting_maps(
    height_map: Any,
    masks: dict[str, Any],
    recipe: dict[str, Any],
    sample_scale: float = 1.0,
) -> dict[str, Any]:
    import numpy as np
    from PIL import Image

    lighting = recipe.get("lighting", {})
    light = np.array(
        normalize_vector(lighting.get("light", {}), (-0.55, -0.75, 1.25)),
        dtype=np.float32,
    )
    view = np.array(
        normalize_vector(lighting.get("view", {}), (0.0, 0.0, 1.0)), dtype=np.float32
    )
    half_vector = light + view
    half_vector = half_vector / max(float(np.linalg.norm(half_vector)), 0.0001)

    normal_source = stabilized_normal_source(height_map, masks, recipe, sample_scale)
    normal = normal_from_height(
        normal_source,
        float(lighting.get("normal_strength", 2.4)),
        float(lighting.get("normal_gradient_clip", 0)) or None,
        sample_scale,
    )
    diffuse = np.clip(np.sum(normal * light, axis=2), 0, 1)
    specular = np.clip(np.sum(normal * half_vector, axis=2), 0, 1) ** float(
        lighting.get("specular_power", 48)
    )

    ambient = float(lighting.get("ambient", 0.32))
    diffuse_strength = float(lighting.get("diffuse", 0.42))
    specular_strength = float(lighting.get("specular", 0.86))
    chrome_mask = masks["chrome_stack"]

    lit = np.clip(ambient + diffuse_strength * diffuse, 0, 1)
    shadow_alpha = np.clip(1 - lit, 0, 1)
    rim_strength = float(lighting.get("chrome_rim_strength", 0.0))
    rim_power = max(float(lighting.get("chrome_rim_power", 2.0)), 0.001)
    # Brightens glancing curved surfaces. This is essential for chrome bubble forms.
    rim = np.power(np.clip(1.0 - normal[..., 2], 0, 1), rim_power)
    highlight_alpha = np.clip(
        specular * specular_strength + rim * rim_strength * chrome_mask,
        0,
        1,
    )

    dy, dx = np.gradient(normal_source)
    dx *= sample_scale
    dy *= sample_scale
    edge = np.hypot(dx, dy)
    if np.max(edge) > 0:
        edge = edge / np.max(edge)
    ao_alpha = np.clip(edge, 0, 1)

    def rgba(color: tuple[int, int, int], alpha: Any) -> Image.Image:
        channels = np.zeros((*alpha.shape, 4), dtype=np.uint8)
        channels[..., 0] = color[0]
        channels[..., 1] = color[1]
        channels[..., 2] = color[2]
        channels[..., 3] = np.clip(alpha * 255, 0, 255).astype(np.uint8)
        return Image.fromarray(channels, "RGBA")

    normal_rgb = ((normal + 1) * 127.5).clip(0, 255).astype(np.uint8)
    height_min = float(np.min(height_map))
    height_max = float(np.max(height_map))
    height_span = max(height_max - height_min, 0.0001)
    height_gray = (
        ((height_map - height_min) / height_span * 255).clip(0, 255).astype(np.uint8)
    )

    return {
        "chrome_shadow": rgba((0, 0, 0), shadow_alpha),
        "chrome_highlight": rgba((255, 255, 255), highlight_alpha),
        "chrome_reflection": chrome_reflection_map(normal, chrome_mask, recipe),
        "ambient_occlusion": rgba((0, 0, 0), ao_alpha),
        "_height_debug": Image.fromarray(height_gray, "L"),
        "_normal_debug": Image.fromarray(normal_rgb, "RGB"),
    }


def encode_png_data_uri(image: Any) -> str:
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", compress_level=4)
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def save_lighting_debug_maps(
    label: str,
    maps: dict[str, Any],
    recipe: dict[str, Any],
    debug_dir: Path | None = None,
    variant_name: str | None = None,
) -> None:
    lighting = recipe.get("lighting", {})
    if not lighting.get("debug", False):
        return

    debug_labels = set(lighting.get("debug_labels", ["at", "CODECAINE"]))
    if label not in debug_labels:
        return

    debug_dir = debug_dir or DEFAULT_PROJECT_ROOT / "outputs/generated/debug"
    if variant_name:
        debug_dir = debug_dir / variant_name
    debug_dir.mkdir(parents=True, exist_ok=True)
    maps["_height_debug"].save(debug_dir / f"{label}.height.png")
    maps["_normal_debug"].save(debug_dir / f"{label}.normal.png")
    if "chrome_reflection" in maps:
        maps["chrome_reflection"].save(debug_dir / f"{label}.chrome-reflection.png")


def lighting_resolution_scale(
    width: int,
    height: int,
    recipe: dict[str, Any],
    records: list[tuple[dict[str, Any], float]],
) -> float:
    lighting = recipe.get("lighting", {})
    requested = max(0.25, float(lighting.get("resolution_scale", 1)))
    max_overlay_size = float(lighting.get("max_overlay_size", 4096))
    if len(records) == 1:
        max_overlay_size = min(
            max_overlay_size, float(lighting.get("glyph_max_overlay_size", 1400))
        )
    longest_edge = max(width, height, 1)
    return min(requested, max_overlay_size / longest_edge)


def generate_lighting_overlays(
    records: list[tuple[dict[str, Any], float]],
    width: int,
    height: int,
    y: float,
    recipe: dict[str, Any],
    label: str,
    debug_dir: Path | None = None,
    variant_name: str | None = None,
) -> dict[str, str]:
    lighting = recipe.get("lighting", {})
    if not lighting or lighting.get("enabled") is False:
        return {}
    if not relief_config(recipe)["enabled"]:
        return {}

    scale = lighting_resolution_scale(width, height, recipe, records)
    height_map, masks = compose_height_map(records, width, height, y, recipe, scale)
    maps = compute_lighting_maps(height_map, masks, recipe, scale)
    label_name = safe_label(label, records)
    save_lighting_debug_maps(label_name, maps, recipe, debug_dir, variant_name)
    return {
        "chrome_shadow": encode_png_data_uri(maps["chrome_shadow"]),
        "chrome_highlight": encode_png_data_uri(maps["chrome_highlight"]),
        "chrome_reflection": encode_png_data_uri(maps["chrome_reflection"]),
        "ambient_occlusion": encode_png_data_uri(maps["ambient_occlusion"]),
    }
