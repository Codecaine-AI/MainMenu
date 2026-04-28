"""Step 05: compose a word SVG from traced glyph records.

This step reads glyph path records from step 02, looks up each requested
character, and lays the glyphs out horizontally using their advance widths plus
optional tracking. It reuses the same layered SVG styling helpers as step 03,
but writes a single composed word instead of one file per glyph.

Output:
  - the requested word SVG path, for example output/svgs/words/CODECAINE.svg.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from common import glyph_records_by_char, read_json, word_svg


def render_word(text: str, paths_path: str | Path, style_path: str | Path, out_path: str | Path, tracking: float | None = None) -> Path:
    data = read_json(paths_path)
    style = read_json(style_path)
    glyphs = glyph_records_by_char(data)

    svg = word_svg(text, glyphs, style, tracking=tracking)

    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(svg, encoding="utf-8")
    return out_path


def main() -> None:
    parser = argparse.ArgumentParser(description="Compose a word SVG from traced glyph paths.")
    parser.add_argument("--text", required=True, help="Text to render.")
    parser.add_argument("--paths", default="output/paths/glyph_paths.json", help="glyph_paths.json from script 02.")
    parser.add_argument("--style", default="config/style.json", help="Style/config JSON.")
    parser.add_argument("--out", required=True, help="Output word SVG path.")
    parser.add_argument("--tracking", type=float, default=None, help="Additional space between glyphs in SVG units.")
    args = parser.parse_args()

    path = render_word(args.text, args.paths, args.style, args.out, tracking=args.tracking)
    print(f"Wrote word SVG to {path}")


if __name__ == "__main__":
    main()
