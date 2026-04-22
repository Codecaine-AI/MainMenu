from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageChops

from ...io.logging import RunLogger
from ...schemas import BoundingBox, ComponentDiffMetrics, ImageSize
from .common import asset_dir_for, reference_image_path


def diff_component(
    run_dir: Path,
    asset_id: str,
    logger: RunLogger | None = None,
) -> ComponentDiffMetrics:
    run_dir = run_dir.resolve()
    logger = logger or RunLogger(run_dir)
    asset_dir = asset_dir_for(run_dir, asset_id)
    reference_path = reference_image_path(run_dir, asset_id)
    render_path = asset_dir / "render.png"
    if not render_path.exists():
        raise FileNotFoundError(f"Missing render image: {render_path}")

    diff_path = asset_dir / "diff.png"

    with Image.open(reference_path).convert("RGBA") as reference_image, Image.open(render_path).convert(
        "RGBA"
    ) as render_image:
        metrics = compare_images(
            asset_id=asset_id,
            reference_image=reference_image,
            render_image=render_image,
            diff_path=diff_path,
        )

    (asset_dir / "diff-metrics.json").write_text(metrics.model_dump_json(indent=2) + "\n")
    logger.event(
        "asset_diff.completed",
        "asset_generation",
        "Computed render diff metrics",
        asset_id=asset_id,
        path=diff_path,
        pixel_mismatch_ratio=round(metrics.pixel_mismatch_ratio, 6),
        alpha_mismatch_ratio=round(metrics.alpha_mismatch_ratio, 6),
        mean_abs_channel_delta=round(metrics.mean_abs_channel_delta, 3),
    )
    return metrics


def compare_images(
    *,
    asset_id: str,
    reference_image: Image.Image,
    render_image: Image.Image,
    diff_path: Path,
) -> ComponentDiffMetrics:
    compare_width = max(reference_image.width, render_image.width)
    compare_height = max(reference_image.height, render_image.height)
    reference_canvas = Image.new("RGBA", (compare_width, compare_height), (0, 0, 0, 0))
    render_canvas = Image.new("RGBA", (compare_width, compare_height), (0, 0, 0, 0))
    reference_canvas.paste(reference_image, (0, 0))
    render_canvas.paste(render_image, (0, 0))

    diff = ImageChops.difference(reference_canvas, render_canvas)
    amplified = amplify_diff(diff)
    amplified.save(diff_path)

    pixels = compare_width * compare_height
    mismatch_count = 0
    alpha_mismatch_count = 0
    channel_delta_total = 0.0

    diff_pixels = diff.load()
    for y in range(compare_height):
        for x in range(compare_width):
            r, g, b, a = diff_pixels[x, y]
            if r or g or b or a:
                mismatch_count += 1
            if a:
                alpha_mismatch_count += 1
            channel_delta_total += (r + g + b + a) / 4.0

    reference_bbox = alpha_bbox(reference_canvas)
    render_bbox = alpha_bbox(render_canvas)
    dominant_color_delta = color_distance(
        mean_opaque_color(reference_canvas),
        mean_opaque_color(render_canvas),
    )

    return ComponentDiffMetrics(
        asset_id=asset_id,
        reference_size=ImageSize(width=reference_image.width, height=reference_image.height),
        render_size=ImageSize(width=render_image.width, height=render_image.height),
        compare_size=ImageSize(width=compare_width, height=compare_height),
        pixel_mismatch_ratio=(mismatch_count / pixels) if pixels else 0.0,
        alpha_mismatch_ratio=(alpha_mismatch_count / pixels) if pixels else 0.0,
        mean_abs_channel_delta=(channel_delta_total / pixels) if pixels else 0.0,
        dominant_color_delta=dominant_color_delta,
        reference_bbox=reference_bbox,
        render_bbox=render_bbox,
        bbox_delta=bbox_delta(reference_bbox, render_bbox),
    )


def alpha_bbox(image: Image.Image) -> BoundingBox | None:
    bbox = image.getchannel("A").getbbox()
    if bbox is None:
        return None
    left, top, right, bottom = bbox
    return BoundingBox(left=left, top=top, right=right, bottom=bottom)


def bbox_delta(reference: BoundingBox | None, render: BoundingBox | None) -> dict[str, int]:
    if reference is None or render is None:
        return {}
    return {
        "left": render.left - reference.left,
        "top": render.top - reference.top,
        "right": render.right - reference.right,
        "bottom": render.bottom - reference.bottom,
        "width": (render.right - render.left) - (reference.right - reference.left),
        "height": (render.bottom - render.top) - (reference.bottom - reference.top),
    }


def mean_opaque_color(image: Image.Image) -> tuple[float, float, float]:
    pixels = image.load()
    width, height = image.size
    red = 0.0
    green = 0.0
    blue = 0.0
    total_alpha = 0.0
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            alpha = a / 255.0
            red += r * alpha
            green += g * alpha
            blue += b * alpha
            total_alpha += alpha
    if total_alpha == 0:
        return (0.0, 0.0, 0.0)
    return (red / total_alpha, green / total_alpha, blue / total_alpha)


def color_distance(a: tuple[float, float, float], b: tuple[float, float, float]) -> float:
    return ((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2) ** 0.5


def amplify_diff(diff: Image.Image) -> Image.Image:
    pixels = diff.load()
    width, height = diff.size
    output = Image.new("RGBA", diff.size, (0, 0, 0, 0))
    out_pixels = output.load()
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            strength = max(r, g, b, a)
            if strength == 0:
                out_pixels[x, y] = (0, 0, 0, 0)
                continue
            out_pixels[x, y] = (
                min(255, r * 3),
                min(255, g * 3),
                min(255, b * 3),
                min(255, max(80, a * 3)),
            )
    return output
