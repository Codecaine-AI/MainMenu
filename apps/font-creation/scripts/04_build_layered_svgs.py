"""Step 04: build one layered SVG file per glyph.

This step reads the traced path records from step 02 and wraps each glyph path
with the configured SVG styling: fill, metallic stroke, shadow, gradients, and
viewbox/metric data. It does not re-run mask extraction or tracing; it only
turns existing path data into standalone SVG assets.

Output:
  - output/svgs/glyphs/*.svg: styled SVG file for each traced glyph.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from common import glyph_svg, read_json


def build_layered_svgs(paths_path: str | Path, style_path: str | Path, out_dir: str | Path) -> int:
    out_dir = Path(out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    style = read_json(style_path)
    data = read_json(paths_path)
    glyphs = data.get("glyphs", data)

    count = 0
    for record in glyphs:
        svg = glyph_svg(record, style)
        out_path = out_dir / f"{record['glyph_name']}.svg"
        out_path.write_text(svg, encoding="utf-8")
        count += 1

    return count


def main() -> None:
    parser = argparse.ArgumentParser(description="Build layered SVG files from traced glyph paths.")
    parser.add_argument("--paths", default="output/paths/glyph_paths.json", help="glyph_paths.json from script 02.")
    parser.add_argument("--style", default="config/style.json", help="Style/config JSON.")
    parser.add_argument("--out", default="output/svgs/glyphs", help="Output glyph SVG directory.")
    args = parser.parse_args()

    count = build_layered_svgs(args.paths, args.style, args.out)
    print(f"Wrote {count} glyph SVGs to {args.out}")


if __name__ == "__main__":
    main()
