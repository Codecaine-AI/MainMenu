"""Step 01: segment the source glyph sheet into per-glyph crops.

This step uses a broad grayscale foreground mask to find rows and glyph boxes.
The mask is intentionally inclusive: dark fill, shadows, bevels, outlines, and
other foreground artwork can all count. It is used only to locate glyphs on the
sheet, not to decide the final vector fill shape.

Outputs:
  - output/debug/foreground_mask.png: full-sheet segmentation mask.
  - output/debug/segmentation_preview.png: boxes overlaid on the source sheet.
  - output/crops/*.png: padded crop image for each detected glyph.
  - output/segments.json: crop paths, glyph metadata, and source bounding boxes.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from common import (
    clamp_box,
    count_occurrences_before,
    find_glyph_boxes_in_row,
    find_row_bands,
    load_rgb,
    make_foreground_mask,
    make_segmentation_preview,
    read_json,
    safe_filename_for_glyph,
    save_gray,
    save_rgb,
    write_json,
)


def relative_to_base(path: Path, base: Path) -> str:
    try:
        return str(path.relative_to(base))
    except ValueError:
        return str(path)


def segment_glyph_sheet(
    image_path: str | Path,
    glyph_map_path: str | Path,
    style_path: str | Path,
    out_dir: str | Path,
    path_base: str | Path | None = None,
) -> dict:
    image_path = Path(image_path)
    out_dir = Path(out_dir)
    artifact_base = Path(path_base) if path_base is not None else out_dir

    style = read_json(style_path)
    glyph_map = read_json(glyph_map_path)
    rows = glyph_map["rows"]

    rgb = load_rgb(image_path)
    height, width = rgb.shape[:2]

    out_dir.mkdir(parents=True, exist_ok=True)
    crop_dir = out_dir / "crops"
    crop_dir.mkdir(parents=True, exist_ok=True)
    debug_dir = out_dir / "debug"
    debug_dir.mkdir(parents=True, exist_ok=True)

    foreground_mask = make_foreground_mask(rgb, style)
    save_gray(debug_dir / "foreground_mask.png", foreground_mask)

    row_bands = find_row_bands(foreground_mask, style, expected_rows=len(rows))
    if len(row_bands) != len(rows):
        print(f"WARNING: expected {len(rows)} rows, detected {len(row_bands)} rows.", file=sys.stderr)

    row_padding = int(style.get("segmentation", {}).get("row_padding_px", 12))
    glyph_padding = int(style.get("segmentation", {}).get("glyph_padding_px", 10))

    segments = []
    for row_index, row_text in enumerate(rows):
        if row_index >= len(row_bands):
            print(f"WARNING: no detected row for glyph-map row {row_index}: {row_text}", file=sys.stderr)
            continue

        y1, y2 = row_bands[row_index]
        ry1 = max(0, y1 - row_padding)
        ry2 = min(height, y2 + row_padding)
        row_mask = foreground_mask[ry1:ry2, :]

        boxes = find_glyph_boxes_in_row(row_mask, expected_count=len(row_text), style=style)
        if len(boxes) != len(row_text):
            print(f"WARNING: row {row_index} expected {len(row_text)} glyphs but detected {len(boxes)}.", file=sys.stderr)

        count = min(len(row_text), len(boxes))
        for index_in_row in range(count):
            glyph = row_text[index_in_row]
            occurrence = count_occurrences_before(row_text, index_in_row, glyph)
            glyph_name = safe_filename_for_glyph(glyph, occurrence)

            x1, x2 = boxes[index_in_row]
            bx1, by1, bx2, by2 = clamp_box(x1 - glyph_padding, ry1 - glyph_padding, x2 + glyph_padding, ry2 + glyph_padding, width, height)

            crop = rgb[by1:by2, bx1:bx2, :]
            crop_path = crop_dir / f"{glyph_name}.png"
            save_rgb(crop_path, crop)

            segments.append({
                "glyph": glyph,
                "glyph_name": glyph_name,
                "unicode": ord(glyph),
                "row_index": row_index,
                "index_in_row": index_in_row,
                "bbox": [int(bx1), int(by1), int(bx2), int(by2)],
                "crop_path": str(crop_path.relative_to(artifact_base)),
            })

    make_segmentation_preview(rgb, segments, debug_dir / "segmentation_preview.png")

    result = {
        "source_image": relative_to_base(image_path, artifact_base),
        "rows": rows,
        "row_bands": [[int(a), int(b)] for a, b in row_bands],
        "segments": segments,
    }

    write_json(out_dir / "segments.json", result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description="Segment a raster glyph sheet into individual glyph crops.")
    parser.add_argument("--image", required=True, help="Input alphabet/glyph sheet image.")
    parser.add_argument("--glyph-map", default="config/glyph-map.json", help="Glyph map JSON.")
    parser.add_argument("--style", default="config/style.json", help="Style/config JSON.")
    parser.add_argument("--out", default="output", help="Output directory.")
    parser.add_argument("--path-base", default=None, help="Base directory for paths written to segments.json.")
    args = parser.parse_args()

    result = segment_glyph_sheet(args.image, args.glyph_map, args.style, args.out, path_base=args.path_base)
    print(f"Wrote {len(result['segments'])} glyph crops to {Path(args.out) / 'crops'}")
    print(f"Wrote segmentation data to {Path(args.out) / 'segments.json'}")
    print(f"Wrote preview to {Path(args.out) / 'debug' / 'segmentation_preview.png'}")


if __name__ == "__main__":
    main()
