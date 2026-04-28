from __future__ import annotations

import html
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Sequence, Tuple

import cv2
import numpy as np
from PIL import Image, ImageDraw


def read_json(path: str | Path) -> Any:
    path = Path(path)
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: str | Path, data: Any) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def load_rgb(path: str | Path) -> np.ndarray:
    return np.array(Image.open(path).convert("RGB"))


def load_gray(path: str | Path) -> np.ndarray:
    return np.array(Image.open(path).convert("L"))


def save_rgb(path: str | Path, image: np.ndarray) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(image.astype(np.uint8), "RGB").save(path)


def save_gray(path: str | Path, image: np.ndarray) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(image.astype(np.uint8), "L").save(path)


def make_foreground_mask(rgb: np.ndarray, style: Dict[str, Any]) -> np.ndarray:
    gray = cv2.cvtColor(rgb, cv2.COLOR_RGB2GRAY)
    mode = style.get("segmentation", {}).get("foreground_threshold_mode", "otsu")

    if mode == "otsu":
        _, mask = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)
    else:
        threshold = int(style.get("segmentation", {}).get("foreground_threshold_value", 200))
        mask = np.where(gray < threshold, 255, 0).astype(np.uint8)

    return mask


def _runs_from_active(active: np.ndarray, min_len: int = 1) -> List[Tuple[int, int]]:
    runs: List[Tuple[int, int]] = []
    i = 0
    n = int(active.shape[0])
    while i < n:
        if bool(active[i]):
            j = i
            while j < n and bool(active[j]):
                j += 1
            if j - i >= min_len:
                runs.append((i, j))
            i = j
        i += 1
    return runs


def smooth_projection(values: np.ndarray, window: int) -> np.ndarray:
    window = max(1, int(window))
    if window <= 1:
        return values.astype(float)
    kernel = np.ones(window, dtype=float) / float(window)
    return np.convolve(values.astype(float), kernel, mode="same")


def find_row_bands(mask: np.ndarray, style: Dict[str, Any], expected_rows: int | None = None) -> List[Tuple[int, int]]:
    seg = style.get("segmentation", {})
    kernel_size = tuple(int(x) for x in seg.get("row_dilate_kernel", [9, 9]))
    dilated = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_RECT, kernel_size), iterations=1)
    projection = dilated.sum(axis=1) / 255.0
    projection = smooth_projection(projection, int(seg.get("projection_smooth_window", 7)))

    base_threshold = float(seg.get("row_projection_threshold", 30))
    min_height = int(seg.get("row_min_height", 20))

    candidate_thresholds = [
        base_threshold,
        base_threshold * 0.75,
        base_threshold * 1.25,
        base_threshold * 0.5,
        base_threshold * 1.5,
        base_threshold * 2.0,
    ]

    best_runs: List[Tuple[int, int]] = []
    for threshold in candidate_thresholds:
        runs = _runs_from_active(projection > threshold, min_height)
        if expected_rows is None:
            if len(runs) > len(best_runs):
                best_runs = runs
        elif len(runs) == expected_rows:
            return runs
        elif not best_runs or abs(len(runs) - expected_rows) < abs(len(best_runs) - expected_rows):
            best_runs = runs

    return best_runs


def merge_boxes_to_count(boxes: List[Tuple[int, int]], target_count: int) -> List[Tuple[int, int]]:
    boxes = list(boxes)
    if target_count <= 0:
        return boxes
    while len(boxes) > target_count:
        gaps = [(boxes[i + 1][0] - boxes[i][1], i) for i in range(len(boxes) - 1)]
        _, idx = min(gaps, key=lambda item: item[0])
        merged = (boxes[idx][0], boxes[idx + 1][1])
        boxes = boxes[:idx] + [merged] + boxes[idx + 2:]
    return boxes


def find_glyph_boxes_in_row(
    row_mask: np.ndarray,
    expected_count: int,
    style: Dict[str, Any],
) -> List[Tuple[int, int]]:
    seg = style.get("segmentation", {})
    kernel_size = tuple(int(x) for x in seg.get("glyph_dilate_kernel", [7, 5]))
    dilated = cv2.dilate(row_mask, cv2.getStructuringElement(cv2.MORPH_RECT, kernel_size), iterations=1)

    projection = dilated.sum(axis=0) / 255.0
    projection = smooth_projection(projection, int(seg.get("projection_smooth_window", 7)))

    row_h = row_mask.shape[0]
    fractions = [float(x) for x in seg.get("vertical_threshold_fractions", [0.05, 0.08, 0.1, 0.15])]

    best: List[Tuple[int, int]] = []
    for frac in fractions:
        threshold = max(1.0, row_h * frac)
        boxes = _runs_from_active(projection > threshold, min_len=3)
        if len(boxes) == expected_count:
            return boxes
        if not best or abs(len(boxes) - expected_count) < abs(len(best) - expected_count):
            best = boxes

    if len(best) > expected_count:
        best = merge_boxes_to_count(best, expected_count)

    return best


def safe_filename_for_glyph(glyph: str, occurrence: int = 1) -> str:
    names = {
        " ": "space",
        ".": "period",
        ",": "comma",
        ":": "colon",
        ";": "semicolon",
        "!": "exclamation",
        "?": "question",
        "'": "apostrophe",
        '"': "quote",
        "“": "left_double_quote",
        "”": "right_double_quote",
        "(": "left_paren",
        ")": "right_paren",
        "[": "left_bracket",
        "]": "right_bracket",
        "{": "left_brace",
        "}": "right_brace",
        "-": "dash",
        "–": "en_dash",
        "—": "em_dash",
        "&": "ampersand",
        "@": "at",
        "#": "hash",
        "$": "dollar",
        "%": "percent",
        "*": "asterisk",
        "+": "plus",
        "=": "equals",
        "/": "slash",
        "\\": "backslash",
        "<": "less_than",
        ">": "greater_than",
        "|": "bar",
        "^": "caret",
        "~": "tilde",
        "`": "backtick",
    }
    if glyph.isalnum():
        base = glyph
    else:
        base = names.get(glyph, f"u{ord(glyph):04X}")

    if glyph == "-" and occurrence > 1:
        base = f"dash_{occurrence}"
    elif occurrence > 1 and not glyph.isalnum():
        base = f"{base}_{occurrence}"

    return base


def count_occurrences_before(row: str, index: int, glyph: str) -> int:
    return row[: index + 1].count(glyph)


def clamp_box(x1: int, y1: int, x2: int, y2: int, w: int, h: int) -> Tuple[int, int, int, int]:
    return max(0, x1), max(0, y1), min(w, x2), min(h, y2)


def extract_red_fill_mask(rgb: np.ndarray, style: Dict[str, Any], glyph: str | None = None) -> np.ndarray:
    cfg = style.get("fill_extraction", {})
    hsv = cv2.cvtColor(rgb, cv2.COLOR_RGB2HSV)
    hue = hsv[:, :, 0]
    sat = hsv[:, :, 1]
    val = hsv[:, :, 2]

    red_hue_low = int(cfg.get("red_hue_low", 15))
    red_hue_high = int(cfg.get("red_hue_high", 165))
    min_saturation = int(cfg.get("min_saturation", 35))
    min_value = int(cfg.get("min_value", 20))

    seed = (((hue <= red_hue_low) | (hue >= red_hue_high)) & (sat >= min_saturation) & (val >= min_value)).astype(np.uint8)

    # Two useful extraction modes:
    #   red_only: traces only the red interior. Best for preserving metallic cutouts/grooves.
    #   red_seed_reconstruction: expands from red seeds into connected dark pixels. Useful when
    #     the interior texture is very black, but it can over-bridge into bevels on glyphs like "2".
    mode = str(cfg.get("mode", "red_only"))
    use_reconstruction = mode in {"red_seed_reconstruction", "reconstruction"} or bool(
        cfg.get("use_allowed_region_reconstruction", False)
    )

    if use_reconstruction:
        allowed_max_value = int(cfg.get("allowed_max_value", 170))
        allowed_min_saturation = int(cfg.get("allowed_min_saturation", 5))
        allowed = (((val < allowed_max_value) & (sat >= allowed_min_saturation)) | (seed > 0)).astype(np.uint8)

        count, labels, stats, _ = cv2.connectedComponentsWithStats(allowed, 8)
        reconstructed = np.zeros_like(seed, dtype=np.uint8)
        for idx in range(1, count):
            component = labels == idx
            if int(seed[component].sum()) > 0:
                reconstructed[component] = 1
        red = reconstructed * 255

        reconstruction_close_kernel = int(cfg.get("reconstruction_close_kernel", 7))
        if reconstruction_close_kernel > 1:
            kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (reconstruction_close_kernel, reconstruction_close_kernel))
            red = cv2.morphologyEx(red, cv2.MORPH_CLOSE, kernel, iterations=int(cfg.get("reconstruction_close_iterations", 1)))
    else:
        red = seed.astype(np.uint8) * 255

    median_blur = int(cfg.get("median_blur", 3))
    if median_blur > 1:
        if median_blur % 2 == 0:
            median_blur += 1
        red = cv2.medianBlur(red, median_blur)

    close_kernel = int(cfg.get("close_kernel", 9))
    if close_kernel > 1:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_kernel, close_kernel))
        red = cv2.morphologyEx(red, cv2.MORPH_CLOSE, kernel, iterations=int(cfg.get("close_iterations", 2)))

    open_kernel = int(cfg.get("open_kernel", 3))
    if open_kernel > 1:
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (open_kernel, open_kernel))
        red = cv2.morphologyEx(red, cv2.MORPH_OPEN, kernel, iterations=int(cfg.get("open_iterations", 1)))

    red = remove_small_components(red, int(cfg.get("min_component_area_px", 18)))
    red = clean_structural_fill_mask(red, cfg, glyph=glyph)
    red = fill_small_holes(red, float(cfg.get("fill_holes_smaller_than_area_ratio", 0.012)))
    red = normalize_silhouette_mask(red, cfg)
    return red


def remove_small_components(mask: np.ndarray, min_area_px: int) -> np.ndarray:
    if min_area_px <= 0:
        return mask
    binary = (mask > 0).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(binary, 8)
    cleaned = np.zeros_like(binary)
    for idx in range(1, count):
        if int(stats[idx, cv2.CC_STAT_AREA]) >= min_area_px:
            cleaned[labels == idx] = 1
    return (cleaned * 255).astype(np.uint8)


def clean_structural_fill_mask(mask: np.ndarray, cfg: Dict[str, Any], glyph: str | None = None) -> np.ndarray:
    """Remove material-detail fragments before the mask becomes a vector contour."""
    cleanup = cfg.get("structural_cleanup", {})
    if not bool(cleanup.get("enabled", False)):
        return mask

    output = (mask > 0).astype(np.uint8) * 255

    close_kernel = int(cleanup.get("close_kernel", 0))
    if close_kernel > 1:
        if close_kernel % 2 == 0:
            close_kernel += 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_kernel, close_kernel))
        output = cv2.morphologyEx(output, cv2.MORPH_CLOSE, kernel, iterations=int(cleanup.get("close_iterations", 1)))

    min_area_ratio = float(cleanup.get("min_component_area_ratio", 0))
    if min_area_ratio > 0:
        output = remove_small_components(output, int(output.shape[0] * output.shape[1] * min_area_ratio))

    force_single = set(str(item) for item in cleanup.get("force_single_component_glyphs", []))
    force_alnum = bool(cleanup.get("force_single_component_for_alnum", False))
    if (glyph is not None and glyph in force_single) or (glyph is not None and glyph.isalnum() and force_alnum):
        output = keep_largest_component(output)

    return output


def keep_largest_component(mask: np.ndarray) -> np.ndarray:
    binary = (mask > 0).astype(np.uint8)
    count, labels, stats, _ = cv2.connectedComponentsWithStats(binary, 8)
    if count <= 1:
        return (binary * 255).astype(np.uint8)

    largest_idx = max(range(1, count), key=lambda idx: int(stats[idx, cv2.CC_STAT_AREA]))
    return np.where(labels == largest_idx, 255, 0).astype(np.uint8)


def normalize_silhouette_mask(mask: np.ndarray, cfg: Dict[str, Any]) -> np.ndarray:
    normalization = cfg.get("silhouette_normalization", {})
    if not bool(normalization.get("enabled", False)):
        return mask

    binary = (mask > 0).astype(np.uint8) * 255
    method = str(normalization.get("method", "blur_threshold"))
    if method == "blur_threshold":
        sigma = float(normalization.get("smooth_sigma_px", 14))
        if sigma > 0:
            binary = cv2.GaussianBlur(binary, (0, 0), sigmaX=sigma, sigmaY=sigma)
        threshold = int(normalization.get("threshold", 127))
        _, output = cv2.threshold(binary, threshold, 255, cv2.THRESH_BINARY)
        return output.astype(np.uint8)

    contours, hierarchy = cv2.findContours(binary, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    if hierarchy is None:
        return binary

    min_contour_area = binary.shape[0] * binary.shape[1] * float(normalization.get("min_contour_area_ratio", 0.0005))
    min_hole_area = binary.shape[0] * binary.shape[1] * float(normalization.get("min_hole_area_ratio", 0.002))
    epsilon_ratio = float(normalization.get("contour_epsilon_ratio", 0.006))
    max_epsilon_px = float(normalization.get("max_epsilon_px", 28))

    output = np.zeros_like(binary)
    hierarchy = hierarchy[0]
    simplified: List[Tuple[np.ndarray, int, float]] = []

    for idx, contour in enumerate(contours):
        area = abs(cv2.contourArea(contour))
        parent = int(hierarchy[idx][3])
        area_limit = min_hole_area if parent != -1 else min_contour_area
        if area < area_limit:
            continue

        perimeter = cv2.arcLength(contour, True)
        epsilon = min(max_epsilon_px, max(1.0, perimeter * epsilon_ratio))
        approx = cv2.approxPolyDP(contour, epsilon, True)
        if len(approx) >= 3:
            simplified.append((approx, parent, area))

    for contour, parent, _ in sorted(simplified, key=lambda item: item[2], reverse=True):
        color = 0 if parent != -1 else 255
        cv2.drawContours(output, [contour], -1, color, -1)

    close_kernel = int(normalization.get("final_close_kernel", 0))
    if close_kernel > 1:
        if close_kernel % 2 == 0:
            close_kernel += 1
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (close_kernel, close_kernel))
        output = cv2.morphologyEx(output, cv2.MORPH_CLOSE, kernel, iterations=int(normalization.get("final_close_iterations", 1)))

    return output


def fill_small_holes(mask: np.ndarray, max_hole_area_ratio: float) -> np.ndarray:
    if max_hole_area_ratio <= 0:
        return mask
    binary = (mask > 0).astype(np.uint8) * 255
    contours, hierarchy = cv2.findContours(binary, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_SIMPLE)
    if hierarchy is None:
        return binary
    area_limit = max(1.0, binary.shape[0] * binary.shape[1] * max_hole_area_ratio)
    hierarchy = hierarchy[0]
    output = binary.copy()

    for idx, contour in enumerate(contours):
        parent = hierarchy[idx][3]
        if parent != -1:
            area = abs(cv2.contourArea(contour))
            if area <= area_limit:
                cv2.drawContours(output, [contour], -1, 255, -1)

    return output


def mask_bbox(mask: np.ndarray) -> Tuple[int, int, int, int] | None:
    ys, xs = np.where(mask > 0)
    if xs.size == 0 or ys.size == 0:
        return None
    x1 = int(xs.min())
    y1 = int(ys.min())
    x2 = int(xs.max()) + 1
    y2 = int(ys.max()) + 1
    return x1, y1, x2, y2


def normalize_contour_points(
    points: np.ndarray,
    bbox: Tuple[int, int, int, int],
    scale: float,
    x_offset: float,
    y_offset: float,
) -> List[Tuple[float, float]]:
    x1, y1, _, _ = bbox
    pts: List[Tuple[float, float]] = []
    for p in points.reshape(-1, 2):
        x = x_offset + (float(p[0]) - x1) * scale
        y = y_offset + (float(p[1]) - y1) * scale
        pts.append((x, y))
    return pts


def format_num(value: float) -> str:
    if abs(value - round(value)) < 0.001:
        return str(int(round(value)))
    return f"{value:.2f}".rstrip("0").rstrip(".")


def contour_to_path(points: Sequence[Tuple[float, float]]) -> str:
    if not points:
        return ""
    first = points[0]
    parts = [f"M {format_num(first[0])} {format_num(first[1])}"]
    for x, y in points[1:]:
        parts.append(f"L {format_num(x)} {format_num(y)}")
    parts.append("Z")
    return " ".join(parts)


def prepare_trace_mask(mask: np.ndarray, trace_cfg: Dict[str, Any]) -> np.ndarray:
    """Return a binary mask optimized for vector tracing.

    The saved mask should stay honest to extraction. The trace mask can be upscaled,
    blurred, and re-thresholded to remove pixel stair-steps before path creation.
    """
    output = (mask > 0).astype(np.uint8) * 255

    upscale = int(trace_cfg.get("pretrace_upscale", 1))
    if upscale > 1:
        output = cv2.resize(
            output,
            (output.shape[1] * upscale, output.shape[0] * upscale),
            interpolation=cv2.INTER_CUBIC,
        )

    blur = float(trace_cfg.get("pretrace_blur", 0))
    if blur > 0:
        output = cv2.GaussianBlur(output, (0, 0), sigmaX=blur, sigmaY=blur)

    threshold = int(trace_cfg.get("pretrace_threshold", 127))
    _, output = cv2.threshold(output, threshold, 255, cv2.THRESH_BINARY)
    return output.astype(np.uint8)


def contour_to_cubic_path(points: Sequence[Tuple[float, float]], tension: float = 0.65) -> str:
    """Convert a closed contour to cubic Bezier commands using Catmull-Rom handles."""
    if len(points) < 3:
        return contour_to_path(points)

    pts = [np.array(p, dtype=float) for p in points]
    n = len(pts)
    first = pts[0]
    parts = [f"M {format_num(first[0])} {format_num(first[1])}"]

    tension = float(tension)
    for i in range(n):
        p0 = pts[(i - 1) % n]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n]

        c1 = p1 + (p2 - p0) * (tension / 6.0)
        c2 = p2 - (p3 - p1) * (tension / 6.0)

        parts.append(
            "C "
            f"{format_num(c1[0])} {format_num(c1[1])} "
            f"{format_num(c2[0])} {format_num(c2[1])} "
            f"{format_num(p2[0])} {format_num(p2[1])}"
        )

    parts.append("Z")
    return " ".join(parts)


def trace_mask_to_path(mask: np.ndarray, segment: Dict[str, Any], style: Dict[str, Any]) -> Dict[str, Any]:
    trace_cfg = style.get("trace", {})
    metrics = style.get("metrics", {})
    units_per_em = int(metrics.get("units_per_em", 1000))
    default_baseline = float(metrics.get("baseline", 830))
    default_target_height = float(metrics.get("cap_height", 760))
    side_bearing = float(metrics.get("side_bearing", 64))

    row_index = str(segment.get("row_index", 0))
    row_override = metrics.get("row_overrides", {}).get(row_index, {})
    baseline = float(row_override.get("baseline", default_baseline))
    target_height = float(row_override.get("target_height", default_target_height))

    trace_mask = prepare_trace_mask(mask, trace_cfg)
    bbox = mask_bbox(trace_mask)
    if bbox is None:
        raise ValueError(f"No fill mask pixels found for glyph {segment.get('glyph')}")

    x1, y1, x2, y2 = bbox
    ink_w = max(1, x2 - x1)
    ink_h = max(1, y2 - y1)
    scale = target_height / ink_h

    max_ink_width = float(metrics.get("max_ink_width", 1200))
    if ink_w * scale > max_ink_width:
        scale = max_ink_width / ink_w

    ink_w_units = ink_w * scale
    advance_width = int(math.ceil(ink_w_units + 2 * side_bearing))
    y_offset = baseline - ink_h * scale
    x_offset = side_bearing

    contours, hierarchy = cv2.findContours((trace_mask > 0).astype(np.uint8) * 255, cv2.RETR_TREE, cv2.CHAIN_APPROX_NONE)
    if not contours:
        raise ValueError(f"No contours found for glyph {segment.get('glyph')}")

    epsilon = float(trace_cfg.get("approx_epsilon_px", 5.0))
    min_area = float(trace_cfg.get("min_contour_area_px", 8))
    path_mode = str(trace_cfg.get("path_mode", "cubic_smooth"))
    cubic_tension = float(trace_cfg.get("cubic_tension", 0.65))

    path_parts: List[str] = []
    contour_count = 0
    for contour in contours:
        if len(contour) < 3:
            continue
        area = abs(cv2.contourArea(contour))
        if area < min_area:
            continue
        approx = cv2.approxPolyDP(contour, epsilon, True)
        if len(approx) < 3:
            continue
        pts = normalize_contour_points(approx, bbox, scale, x_offset, y_offset)
        if path_mode == "cubic_smooth":
            path_parts.append(contour_to_cubic_path(pts, tension=cubic_tension))
        else:
            path_parts.append(contour_to_path(pts))
        contour_count += 1

    path_d = " ".join(path_parts)
    return {
        "glyph": segment["glyph"],
        "glyph_name": segment["glyph_name"],
        "unicode": segment.get("unicode"),
        "row_index": segment.get("row_index"),
        "index_in_row": segment.get("index_in_row"),
        "advance_width": advance_width,
        "units_per_em": units_per_em,
        "baseline": baseline,
        "target_height": target_height,
        "side_bearing": side_bearing,
        "ink_bbox_source_px": [x1, y1, x2, y2],
        "ink_size_units": [round(ink_w_units, 3), round(ink_h * scale, 3)],
        "scale": round(scale, 6),
        "contour_count": contour_count,
        "path_mode": path_mode,
        "pretrace_upscale": int(trace_cfg.get("pretrace_upscale", 1)),
        "path_d": path_d,
        "fill_rule": "evenodd",
    }


def svg_escape(value: str) -> str:
    return html.escape(value, quote=True)


def gradient_stops_svg(stops: Sequence[Dict[str, str]]) -> str:
    lines = []
    for stop in stops:
        lines.append(f'<stop offset="{svg_escape(str(stop["offset"]))}" stop-color="{svg_escape(str(stop["color"]))}"/>')
    return "\n      ".join(lines)


def gradient_stops_with_opacity_svg(stops: Sequence[Dict[str, Any]]) -> str:
    lines = []
    for stop in stops:
        opacity = stop.get("opacity")
        opacity_attr = f' stop-opacity="{svg_escape(str(opacity))}"' if opacity is not None else ""
        lines.append(
            f'<stop offset="{svg_escape(str(stop["offset"]))}" stop-color="{svg_escape(str(stop["color"]))}"{opacity_attr}/>'
        )
    return "\n      ".join(lines)


def style_defs(svg: Dict[str, Any], height: float) -> str:
    silver_stops = gradient_stops_svg(svg.get("silver_gradient", []))
    fill_stops = gradient_stops_svg(svg.get("fill_gradient", []))
    gloss = svg.get("red_gloss", {})
    shadow = svg.get("shadow", {})
    glow = svg.get("rim_glow", {})
    gloss_stops = gradient_stops_with_opacity_svg([
        {"offset": "0%", "color": "#ffffff", "opacity": gloss.get("start_opacity", 0.78)},
        {"offset": "34%", "color": "#ffffff", "opacity": gloss.get("mid_opacity", 0.16)},
        {"offset": "68%", "color": "#ffffff", "opacity": gloss.get("mid_opacity", 0.16)},
        {"offset": "100%", "color": "#ffffff", "opacity": gloss.get("end_opacity", 0.0)},
    ])

    return f'''    <linearGradient id="silver-gradient" x1="0" y1="0" x2="0" y2="{height}" gradientUnits="userSpaceOnUse">
      {silver_stops}
    </linearGradient>
    <linearGradient id="red-fill-gradient" x1="0" y1="0" x2="0" y2="{height}" gradientUnits="userSpaceOnUse">
      {fill_stops}
    </linearGradient>
    <linearGradient id="red-gloss-gradient" x1="0" y1="0" x2="0" y2="{height}" gradientUnits="userSpaceOnUse">
      {gloss_stops}
    </linearGradient>
    <filter id="drop-shadow" x="-40%" y="-40%" width="180%" height="180%">
      <feDropShadow dx="{shadow.get("dx", 24)}" dy="{shadow.get("dy", 30)}" stdDeviation="{shadow.get("std_deviation", 16)}" flood-color="{svg_escape(shadow.get("stroke_color", "#000000"))}" flood-opacity="{shadow.get("opacity", 0.65)}"/>
    </filter>
    <filter id="rim-glow" x="-25%" y="-25%" width="150%" height="150%">
      <feGaussianBlur stdDeviation="{glow.get("std_deviation", 3)}" result="blur"/>
      <feFlood flood-color="{svg_escape(glow.get("stroke_color", "#ffffff"))}" flood-opacity="{glow.get("opacity", 0.34)}"/>
      <feComposite in2="blur" operator="in"/>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>'''


def glyph_svg(glyph_record: Dict[str, Any], style: Dict[str, Any]) -> str:
    svg = style.get("svg_style", {})
    width = int(glyph_record["advance_width"])
    height = int(glyph_record.get("units_per_em", 1000))
    d = glyph_record["path_d"]

    bg = svg.get("background_color", "#111827")
    fill = svg.get("fill_color", "#8b0000")
    include_bg = bool(svg.get("include_background", True))

    shadow = svg.get("shadow", {})
    outer = svg.get("outer_depth", {})
    rim = svg.get("silver_rim", {})
    glow = svg.get("rim_glow", {})
    edge_shadow = svg.get("edge_shadow", {})
    edge_highlight = svg.get("edge_highlight", {})
    gloss = svg.get("red_gloss", {})
    highlight = svg.get("inner_highlight", {})
    inner_shadow = svg.get("inner_shadow", {})
    fill_paint = "url(#red-fill-gradient)" if svg.get("fill_gradient") else fill
    gloss_height = height * float(gloss.get("height_ratio", 0.42))

    bg_rect = f'<rect id="background" width="{width}" height="{height}" fill="{svg_escape(bg)}"/>' if include_bg else ""

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="{svg_escape(glyph_record["glyph"])}">
  <defs>
    <path id="glyph-fill" d="{svg_escape(d)}" fill-rule="{glyph_record.get("fill_rule", "evenodd")}"/>
    <clipPath id="glyph-fill-clip" clipPathUnits="userSpaceOnUse">
      <use href="#glyph-fill"/>
    </clipPath>
{style_defs(svg, height)}
  </defs>

  {bg_rect}

  <g id="shadow-layer">
    <use href="#glyph-fill" fill="none" stroke="{svg_escape(shadow.get("stroke_color", "#050505"))}" stroke-width="{shadow.get("stroke_width", 112)}" stroke-linejoin="round" stroke-linecap="round" filter="url(#drop-shadow)"/>
  </g>

  <g id="outer-depth-layer">
    <use href="#glyph-fill" fill="none" stroke="{svg_escape(outer.get("stroke_color", "#151515"))}" stroke-width="{outer.get("stroke_width", 92)}" stroke-linejoin="round" stroke-linecap="round" opacity="{outer.get("opacity", 1.0)}"/>
  </g>

  <g id="rim-glow-layer">
    <use href="#glyph-fill" fill="none" stroke="{svg_escape(glow.get("stroke_color", "#ffffff"))}" stroke-width="{glow.get("stroke_width", 82)}" stroke-linejoin="round" stroke-linecap="round" filter="url(#rim-glow)"/>
  </g>

  <g id="edge-shadow-layer">
    <use href="#glyph-fill" fill="none" stroke="{svg_escape(edge_shadow.get("stroke_color", "#050505"))}" stroke-width="{edge_shadow.get("stroke_width", 82)}" stroke-linejoin="round" stroke-linecap="round" opacity="{edge_shadow.get("opacity", 0.95)}"/>
  </g>

  <g id="silver-rim-layer">
    <use href="#glyph-fill" fill="none" stroke="url(#silver-gradient)" stroke-width="{rim.get("stroke_width", 72)}" stroke-linejoin="round" stroke-linecap="round"/>
  </g>

  <g id="fill-layer" clip-path="url(#glyph-fill-clip)">
    <rect width="{width}" height="{height}" fill="{svg_escape(fill_paint)}"/>
  </g>

  <g id="red-gloss-layer" clip-path="url(#glyph-fill-clip)" opacity="{gloss.get("opacity", 0.38)}">
    <rect width="{width}" height="{format_num(gloss_height)}" fill="url(#red-gloss-gradient)"/>
  </g>

  <g id="edge-highlight-layer">
    <use href="#glyph-fill" fill="none" stroke="{svg_escape(edge_highlight.get("stroke_color", "#ffffff"))}" stroke-width="{edge_highlight.get("stroke_width", 22)}" stroke-linejoin="round" stroke-linecap="round" opacity="{edge_highlight.get("opacity", 0.72)}"/>
  </g>

  <g id="inner-highlight-layer">
    <use href="#glyph-fill" fill="none" stroke="{svg_escape(highlight.get("stroke_color", "#ffffff"))}" stroke-width="{highlight.get("stroke_width", 12)}" stroke-linejoin="round" stroke-linecap="round" opacity="{highlight.get("opacity", 0.95)}"/>
  </g>

  <g id="inner-shadow-layer">
    <use href="#glyph-fill" fill="none" stroke="{svg_escape(inner_shadow.get("stroke_color", "#1c1c1c"))}" stroke-width="{inner_shadow.get("stroke_width", 5)}" stroke-linejoin="round" stroke-linecap="round" opacity="{inner_shadow.get("opacity", 0.45)}"/>
  </g>
</svg>
'''


def safe_id_for_char(ch: str) -> str:
    return "glyph_" + "_".join(f"{ord(c):04X}" for c in ch)


def word_svg(text: str, glyphs_by_char: Dict[str, Dict[str, Any]], style: Dict[str, Any], tracking: float | None = None) -> str:
    svg = style.get("svg_style", {})
    renderer = style.get("word_renderer", {})
    units_per_em = int(style.get("metrics", {}).get("units_per_em", 1000))
    tracking_value = float(renderer.get("default_tracking", 4) if tracking is None else tracking)
    padding_x = float(renderer.get("padding_x", 48))
    padding_y = float(renderer.get("padding_y", 40))

    records: List[Tuple[str, Dict[str, Any], float]] = []
    current_x = padding_x
    missing: List[str] = []
    for ch in text:
        if ch == " ":
            current_x += units_per_em * 0.35 + tracking_value
            continue
        record = glyphs_by_char.get(ch)
        if record is None:
            missing.append(ch)
            continue
        records.append((ch, record, current_x))
        current_x += float(record["advance_width"]) + tracking_value

    if missing:
        raise ValueError(f"Missing glyphs for: {', '.join(repr(x) for x in missing)}")

    total_width = max(1, int(math.ceil(current_x - tracking_value + padding_x)))
    total_height = int(units_per_em + padding_y * 2)
    y_translate = padding_y

    unique_chars = []
    seen = set()
    for ch, record, _ in records:
        if ch not in seen:
            seen.add(ch)
            unique_chars.append((ch, record))

    bg = svg.get("background_color", "#111827")
    fill = svg.get("fill_color", "#8b0000")
    include_bg = bool(svg.get("include_background", True))
    shadow = svg.get("shadow", {})
    outer = svg.get("outer_depth", {})
    rim = svg.get("silver_rim", {})
    glow = svg.get("rim_glow", {})
    edge_shadow = svg.get("edge_shadow", {})
    edge_highlight = svg.get("edge_highlight", {})
    gloss = svg.get("red_gloss", {})
    highlight = svg.get("inner_highlight", {})
    inner_shadow = svg.get("inner_shadow", {})
    fill_paint = "url(#red-fill-gradient)" if svg.get("fill_gradient") else fill
    gloss_height = total_height * float(gloss.get("height_ratio", 0.42))

    defs_paths = []
    for ch, record in unique_chars:
        defs_paths.append(f'<path id="{safe_id_for_char(ch)}" d="{svg_escape(record["path_d"])}" fill-rule="{record.get("fill_rule", "evenodd")}"/>')

    clip_uses = []
    for ch, record, x in records:
        clip_uses.append(f'<use href="#{safe_id_for_char(ch)}" transform="translate({format_num(x)} {format_num(y_translate)})"/>')

    layer_uses = []
    for ch, record, x in records:
        href = f'#{safe_id_for_char(ch)}'
        t = f'translate({format_num(x)} {format_num(y_translate)})'
        layer_uses.append((href, t))

    def uses_for_attrs(attrs: str) -> str:
        return "\n    ".join(f'<use href="{href}" transform="{t}" {attrs}/>' for href, t in layer_uses)

    bg_rect = f'<rect id="background" width="{total_width}" height="{total_height}" fill="{svg_escape(bg)}"/>' if include_bg else ""

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {total_width} {total_height}" role="img" aria-label="{svg_escape(text)}">
  <defs>
    {' '.join(defs_paths)}

    <clipPath id="word-fill-clip" clipPathUnits="userSpaceOnUse">
      {' '.join(clip_uses)}
    </clipPath>

{style_defs(svg, total_height)}
  </defs>

  {bg_rect}

  <g id="shadow-layer">
    {uses_for_attrs(f'fill="none" stroke="{svg_escape(shadow.get("stroke_color", "#050505"))}" stroke-width="{shadow.get("stroke_width", 112)}" stroke-linejoin="round" stroke-linecap="round" filter="url(#drop-shadow)"')}
  </g>

  <g id="outer-depth-layer">
    {uses_for_attrs(f'fill="none" stroke="{svg_escape(outer.get("stroke_color", "#151515"))}" stroke-width="{outer.get("stroke_width", 92)}" stroke-linejoin="round" stroke-linecap="round" opacity="{outer.get("opacity", 1.0)}"')}
  </g>

  <g id="rim-glow-layer">
    {uses_for_attrs(f'fill="none" stroke="{svg_escape(glow.get("stroke_color", "#ffffff"))}" stroke-width="{glow.get("stroke_width", 82)}" stroke-linejoin="round" stroke-linecap="round" filter="url(#rim-glow)"')}
  </g>

  <g id="edge-shadow-layer">
    {uses_for_attrs(f'fill="none" stroke="{svg_escape(edge_shadow.get("stroke_color", "#050505"))}" stroke-width="{edge_shadow.get("stroke_width", 82)}" stroke-linejoin="round" stroke-linecap="round" opacity="{edge_shadow.get("opacity", 0.95)}"')}
  </g>

  <g id="silver-rim-layer">
    {uses_for_attrs(f'fill="none" stroke="url(#silver-gradient)" stroke-width="{rim.get("stroke_width", 72)}" stroke-linejoin="round" stroke-linecap="round"')}
  </g>

  <g id="fill-layer" clip-path="url(#word-fill-clip)">
    <rect width="{total_width}" height="{total_height}" fill="{svg_escape(fill_paint)}"/>
  </g>

  <g id="red-gloss-layer" clip-path="url(#word-fill-clip)" opacity="{gloss.get("opacity", 0.38)}">
    <rect width="{total_width}" height="{format_num(gloss_height)}" fill="url(#red-gloss-gradient)"/>
  </g>

  <g id="edge-highlight-layer">
    {uses_for_attrs(f'fill="none" stroke="{svg_escape(edge_highlight.get("stroke_color", "#ffffff"))}" stroke-width="{edge_highlight.get("stroke_width", 22)}" stroke-linejoin="round" stroke-linecap="round" opacity="{edge_highlight.get("opacity", 0.72)}"')}
  </g>

  <g id="inner-highlight-layer">
    {uses_for_attrs(f'fill="none" stroke="{svg_escape(highlight.get("stroke_color", "#ffffff"))}" stroke-width="{highlight.get("stroke_width", 12)}" stroke-linejoin="round" stroke-linecap="round" opacity="{highlight.get("opacity", 0.95)}"')}
  </g>

  <g id="inner-shadow-layer">
    {uses_for_attrs(f'fill="none" stroke="{svg_escape(inner_shadow.get("stroke_color", "#1c1c1c"))}" stroke-width="{inner_shadow.get("stroke_width", 5)}" stroke-linejoin="round" stroke-linecap="round" opacity="{inner_shadow.get("opacity", 0.45)}"')}
  </g>
</svg>
'''


def make_segmentation_preview(rgb: np.ndarray, segments: Sequence[Dict[str, Any]], out_path: str | Path) -> None:
    image = Image.fromarray(rgb.astype(np.uint8), "RGB")
    draw = ImageDraw.Draw(image)
    for seg in segments:
        x1, y1, x2, y2 = seg["bbox"]
        label = seg["glyph_name"]
        draw.rectangle([x1, y1, x2, y2], outline=(255, 0, 0), width=2)
        draw.text((x1 + 2, max(0, y1 - 14)), label, fill=(255, 0, 0))
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(out_path)


def glyph_records_by_char(path_data: Dict[str, Any]) -> Dict[str, Dict[str, Any]]:
    records = path_data.get("glyphs", path_data)
    by_char: Dict[str, Dict[str, Any]] = {}
    for record in records:
        ch = record.get("glyph")
        if ch and ch not in by_char:
            by_char[ch] = record
    return by_char
