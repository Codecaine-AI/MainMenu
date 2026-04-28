"""Step 06: generate mask-tuning previews for a single glyph crop.

This is a diagnostic helper, not a required production pipeline step. It runs
several fill_extraction variants against one crop so the red-fill mask can be
compared before tracing. Use it to separate extraction problems from trace
smoothing problems: tune extraction here until the white mask matches the
intended red interior, then tune trace settings in step 02 if needed.

Outputs:
  - output/debug/mask_tuning/<glyph>/mask_grid.png: side-by-side masks.
  - output/debug/mask_tuning/<glyph>/overlay_grid.png: masks over the crop.
  - output/debug/mask_tuning/<glyph>/report.json: area/component counts.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any, Dict, List, Tuple

import cv2
import numpy as np
from PIL import Image, ImageDraw

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from common import extract_red_fill_mask, load_rgb, read_json, safe_filename_for_glyph, save_gray


def component_count(mask: np.ndarray) -> int:
    count, labels, stats, _ = cv2.connectedComponentsWithStats((mask > 0).astype(np.uint8), 8)
    return max(0, count - 1)


def mask_overlay(rgb: np.ndarray, mask: np.ndarray) -> Image.Image:
    image = Image.fromarray(rgb.astype(np.uint8), "RGB").convert("RGBA")
    overlay = Image.new("RGBA", image.size, (255, 0, 0, 0))
    alpha = Image.fromarray(np.where(mask > 0, 125, 0).astype(np.uint8), "L")
    overlay.putalpha(alpha)
    return Image.alpha_composite(image, overlay).convert("RGB")


def thumb(image: Image.Image, target_w: int = 180, target_h: int = 210) -> Image.Image:
    image = image.convert("RGB")
    scale = min(target_w / image.width, target_h / image.height)
    w = max(1, int(image.width * scale))
    h = max(1, int(image.height * scale))
    resized = image.resize((w, h), Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", (target_w, target_h), "white")
    canvas.paste(resized, ((target_w - w) // 2, (target_h - h) // 2))
    return canvas


def make_grid(items: List[Tuple[str, Image.Image, int, int]], out_path: Path, title: str) -> None:
    cols = 4
    cell_w = 210
    cell_h = 260
    rows = (len(items) + cols - 1) // cols
    top = 38
    grid = Image.new("RGB", (cols * cell_w, rows * cell_h + top), "white")
    draw = ImageDraw.Draw(grid)
    draw.text((10, 10), title, fill=(0, 0, 0))

    for idx, (name, image, area, comps) in enumerate(items):
        x = (idx % cols) * cell_w
        y = (idx // cols) * cell_h + top
        grid.paste(thumb(image), (x + 15, y + 5))
        draw.text((x + 8, y + 218), name[:28], fill=(0, 0, 0))
        draw.text((x + 8, y + 236), f"area={area} comps={comps}", fill=(0, 0, 0))

    out_path.parent.mkdir(parents=True, exist_ok=True)
    grid.save(out_path)


def variant_style(base_style: Dict[str, Any], updates: Dict[str, Any]) -> Dict[str, Any]:
    style = json.loads(json.dumps(base_style))
    style.setdefault("fill_extraction", {}).update(updates)
    return style


def default_variants(style: Dict[str, Any]) -> List[Tuple[str, Dict[str, Any]]]:
    cfg = style.get("fill_extraction", {})
    return [
        ("base_from_style", {}),
        ("red_only_sat45", {"mode": "red_only", "use_allowed_region_reconstruction": False, "min_saturation": 45}),
        ("red_only_sat35", {"mode": "red_only", "use_allowed_region_reconstruction": False, "min_saturation": 35}),
        ("red_only_sat25", {"mode": "red_only", "use_allowed_region_reconstruction": False, "min_saturation": 25}),
        ("close_less_9x1", {"mode": "red_only", "use_allowed_region_reconstruction": False, "close_kernel": 9, "close_iterations": 1}),
        ("close_more_11x2", {"mode": "red_only", "use_allowed_region_reconstruction": False, "close_kernel": 11, "close_iterations": 2}),
        ("open_off", {"mode": "red_only", "use_allowed_region_reconstruction": False, "open_kernel": 0, "open_iterations": 0}),
        ("recon_strict", {"mode": "red_seed_reconstruction", "use_allowed_region_reconstruction": False, "allowed_max_value": 145, "allowed_min_saturation": 25}),
        ("recon_medium", {"mode": "red_seed_reconstruction", "use_allowed_region_reconstruction": False, "allowed_max_value": 160, "allowed_min_saturation": 12}),
        ("recon_loose", {"mode": "red_seed_reconstruction", "use_allowed_region_reconstruction": False, "allowed_max_value": 170, "allowed_min_saturation": 5}),
        ("tiny_holes_fill_more", {"mode": "red_only", "use_allowed_region_reconstruction": False, "fill_holes_smaller_than_area_ratio": 0.02}),
        ("tiny_holes_fill_less", {"mode": "red_only", "use_allowed_region_reconstruction": False, "fill_holes_smaller_than_area_ratio": 0.004}),
    ]


def resolve_crop_path(args: argparse.Namespace) -> Path:
    if args.crop:
        return Path(args.crop)

    if not args.glyph:
        raise ValueError("Pass either --crop or --glyph.")

    glyph_name = safe_filename_for_glyph(args.glyph)
    return Path(args.out) / "crops" / f"{glyph_name}.png"


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate mask tuning previews for one glyph crop.")
    parser.add_argument("--glyph", default="2", help="Glyph character to load from output/crops, e.g. 2, A, Q.")
    parser.add_argument("--crop", default=None, help="Direct path to a crop image. Overrides --glyph.")
    parser.add_argument("--style", default="config/style.json", help="Style/config JSON.")
    parser.add_argument("--out", default="output", help="Pipeline output directory.")
    parser.add_argument("--debug-out", default=None, help="Where to write tuning previews. Default: output/debug/mask_tuning/<glyph_name>")
    args = parser.parse_args()

    style = read_json(args.style)
    crop_path = resolve_crop_path(args)
    rgb = load_rgb(crop_path)

    glyph_name = crop_path.stem
    debug_dir = Path(args.debug_out) if args.debug_out else Path(args.out) / "debug" / "mask_tuning" / glyph_name
    debug_dir.mkdir(parents=True, exist_ok=True)

    mask_items: List[Tuple[str, Image.Image, int, int]] = []
    overlay_items: List[Tuple[str, Image.Image, int, int]] = []
    report = []

    for name, updates in default_variants(style):
        variant = variant_style(style, updates)
        mask = extract_red_fill_mask(rgb, variant, glyph=args.glyph)
        area = int(mask.sum() // 255)
        comps = component_count(mask)
        save_gray(debug_dir / f"{name}.png", mask)

        mask_img = Image.fromarray(mask, "L").convert("RGB")
        overlay_img = mask_overlay(rgb, mask)

        mask_items.append((name, mask_img, area, comps))
        overlay_items.append((name, overlay_img, area, comps))
        report.append({"name": name, "updates": updates, "area_px": area, "component_count": comps})

    make_grid(mask_items, debug_dir / "mask_grid.png", f"Mask variants for {glyph_name}: white = extracted fill")
    make_grid(overlay_items, debug_dir / "overlay_grid.png", f"Overlay variants for {glyph_name}: red overlay = extracted fill")

    with (debug_dir / "report.json").open("w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)
        f.write("\n")

    print(f"Wrote tuning previews to {debug_dir}")
    print(f"Open: {debug_dir / 'mask_grid.png'}")
    print(f"Open: {debug_dir / 'overlay_grid.png'}")


if __name__ == "__main__":
    main()
