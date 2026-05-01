from __future__ import annotations

import argparse
import copy
import math
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path
from typing import Any

from .css_gen import recipe_css
from .layers import layer_svg
from .lighting import generate_lighting_overlays
from .masks_defs import defs_svg
from .recipe import recipe_for_variant
from .svg_path import glyph_id, use_nodes
from .utils import escape, read_json

RENDERER_ROOT = Path(__file__).resolve().parents[1]
STUDIO_ROOT = RENDERER_ROOT.parent
DEFAULT_PROJECT_ROOT = STUDIO_ROOT / "projects/melee"


def records_for_text(
    text: str, glyphs: dict[str, dict[str, Any]], recipe: dict[str, Any]
) -> tuple[list[tuple[dict[str, Any], float]], int, int, float]:
    units_per_em = int(next(iter(glyphs.values())).get("units_per_em", 1000))
    tracking = float(recipe.get("tracking", 4))
    padding_x = float(recipe.get("padding_x", 48))
    padding_y = float(recipe.get("padding_y", 40))
    current_x = padding_x
    records: list[tuple[dict[str, Any], float]] = []

    for ch in text:
        if ch == " ":
            current_x += units_per_em * 0.35 + tracking
            continue
        record = glyphs[ch]
        records.append((record, current_x))
        current_x += float(record["advance_width"]) + tracking

    width = int(math.ceil(current_x - tracking + padding_x))
    height = int(units_per_em + padding_y * 2)
    return records, width, height, padding_y


def render_svg(
    records: list[tuple[dict[str, Any], float]],
    width: int,
    height: int,
    y: float,
    recipe: dict[str, Any],
    label: str,
    variant_name: str | None = None,
    debug_dir: Path | None = None,
) -> str:
    unique_records = []
    seen = set()
    for record, _ in records:
        key = glyph_id(record)
        if key in seen:
            continue
        seen.add(key)
        unique_records.append(record)

    path_defs = "\n".join(
        f'    <path id="{glyph_id(record)}" d="{escape(record["path_d"])}" fill-rule="{escape(record.get("fill_rule", "evenodd"))}"/>'
        for record in unique_records
    )
    clip_uses = use_nodes(records, y)
    visible_layers = [layer for layer in recipe["layers"] if layer.get("visible", True)]
    overlays = generate_lighting_overlays(
        records, width, height, y, recipe, label, debug_dir, variant_name
    )
    layers = "\n\n".join(
        layer_svg(layer, records, width, height, y, recipe, overlays)
        for layer in visible_layers
    )
    css = recipe_css(recipe)
    bg = recipe.get("background")
    bg_rect = (
        f'  <rect id="background" width="{width}" height="{height}" fill="{escape(bg)}"/>\n\n'
        if bg
        else ""
    )
    variant_attr = (
        f' data-recipe-variant="{escape(variant_name)}"' if variant_name else ""
    )

    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" role="img" aria-label="{escape(label)}"{variant_attr}>
{defs_svg(recipe, width, height, path_defs, clip_uses, records, y)}
  <style>
      {css}
  </style>

{bg_rect}{layers}
</svg>
'''


DEV_GLYPHS = {"@", "A", "R", "F", "*", "K"}


def _render_task(task: dict[str, Any]) -> tuple[str, str]:
    svg = render_svg(
        task["records"],
        task["width"],
        task["height"],
        task["y"],
        copy.deepcopy(task["recipe"]),
        task["label"],
        task["variant_name"],
        task["debug_dir"],
    )
    Path(task["out_path"]).write_text(svg, encoding="utf-8")
    return task["variant_name"], task["label"]


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Render CSS-addressable SVGs from MELEE traced glyph paths and a layer recipe."
    )
    parser.add_argument(
        "--paths", default=str(DEFAULT_PROJECT_ROOT / "inputs/glyph_paths.json")
    )
    parser.add_argument(
        "--recipe", default=str(DEFAULT_PROJECT_ROOT / "recipes/layer-recipe.json")
    )
    parser.add_argument(
        "--out-dir", default=str(DEFAULT_PROJECT_ROOT / "outputs/generated/layer-recipe")
    )
    parser.add_argument(
        "--glyphs",
        help="Comma-separated glyph chars to render (subset mode). Use 'dev' for the built-in dev subset.",
    )
    parser.add_argument(
        "--glyph",
        action="append",
        help="A single glyph char to render. May be supplied more than once.",
    )
    parser.add_argument(
        "--max-workers",
        type=int,
        default=5,
        help="Worker process cap. 1 = sequential (debugging).",
    )
    args = parser.parse_args()

    paths = read_json(args.paths)
    recipe = read_json(args.recipe)
    glyphs = {record["glyph"]: record for record in paths["glyphs"]}
    out_dir = Path(args.out_dir)

    subset: set[str] | None = None
    if args.glyphs:
        if args.glyphs == "dev":
            subset = DEV_GLYPHS
        else:
            subset = set(args.glyphs.split(","))
    if args.glyph:
        subset = (subset or set()) | set(args.glyph)

    text = recipe.get("text", "CODECAINE")
    records, width, height, y = records_for_text(text, glyphs, recipe)
    word_recipe = recipe_for_variant(recipe, "word_display")
    glyph_recipe = recipe_for_variant(recipe, "glyph_display")
    debug_dir = out_dir / "debug"
    word_dir = out_dir / "word"
    glyph_dir = out_dir / "glyphs"
    word_dir.mkdir(parents=True, exist_ok=True)
    glyph_dir.mkdir(parents=True, exist_ok=True)

    tasks: list[dict[str, Any]] = [
        {
            "records": records,
            "width": width,
            "height": height,
            "y": y,
            "recipe": word_recipe,
            "label": text,
            "variant_name": "word_display",
            "debug_dir": debug_dir,
            "out_path": str(word_dir / f"{text}.css-layers.svg"),
        }
    ]
    for record in paths["glyphs"]:
        if subset is not None and record["glyph"] not in subset:
            continue
        tasks.append(
            {
                "records": [(record, 0.0)],
                "width": int(record["advance_width"]),
                "height": int(record.get("units_per_em", 1000)),
                "y": 0.0,
                "recipe": glyph_recipe,
                "label": record["glyph"],
                "variant_name": "glyph_display",
                "debug_dir": debug_dir,
                "out_path": str(glyph_dir / f"{record['glyph_name']}.css-layers.svg"),
            }
        )

    total = len(paths["glyphs"])
    workers = max(1, min(args.max_workers, len(tasks)))
    if workers == 1:
        for task in tasks:
            variant, label = _render_task(task)
            print(f"  rendered {variant}/{label}")
    else:
        with ProcessPoolExecutor(max_workers=workers) as pool:
            futures = [pool.submit(_render_task, task) for task in tasks]
            for fut in as_completed(futures):
                variant, label = fut.result()
                print(f"  rendered {variant}/{label}")

    rendered_glyphs = len(tasks) - 1
    print(
        f"Wrote {rendered_glyphs}/{total} glyph SVGs + word to {out_dir} "
        f"(workers={workers})"
    )


if __name__ == "__main__":
    main()
