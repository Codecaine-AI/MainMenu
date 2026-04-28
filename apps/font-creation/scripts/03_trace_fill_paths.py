"""Step 03: extract red fill masks and trace them into vector paths.

This step starts from the crops created by step 01, then builds a per-glyph
fill mask using HSV red-pixel extraction. Unlike the foreground mask, this mask
tries to represent only the red interior that should become the SVG fill path.

Each extracted mask is saved as-is under output/masks. A separate trace mask is
then produced for path generation by upscaling, blurring, and re-thresholding
the extracted mask. If output/masks looks good but output/debug/trace_masks does
not, tune the trace settings. If output/masks already looks wrong, tune the
fill_extraction settings.

Outputs:
  - output/masks/*.png: extracted red-fill masks.
  - output/debug/trace_masks/*.png: processed masks used for contour tracing.
  - output/paths/glyph_paths.json: SVG path data and font metrics per glyph.
"""

from __future__ import annotations

import argparse
from pathlib import Path
import sys

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from common import (
    extract_red_fill_mask,
    load_rgb,
    read_json,
    save_gray,
    prepare_trace_mask,
    trace_mask_to_path,
    write_json,
)


def trace_fill_paths(
    segments_path: str | Path,
    style_path: str | Path,
    out_dir: str | Path,
    require_upscaled: bool = False,
    path_base: str | Path | None = None,
) -> dict:
    segments_path = Path(segments_path)
    out_dir = Path(out_dir)
    artifact_base = Path(path_base) if path_base is not None else out_dir
    style = read_json(style_path)
    segments_data = read_json(segments_path)
    base_dir = segments_path.parent

    mask_dir = out_dir / "masks"
    path_dir = out_dir / "paths"
    trace_mask_dir = out_dir / "debug" / "trace_masks"
    mask_dir.mkdir(parents=True, exist_ok=True)
    path_dir.mkdir(parents=True, exist_ok=True)
    if bool(style.get("trace", {}).get("save_trace_masks", True)):
        trace_mask_dir.mkdir(parents=True, exist_ok=True)

    glyph_records = []
    failures = []
    segments = segments_data["segments"]
    total = len(segments)
    print(f"Tracing {total} glyph mask(s).", flush=True)

    for index, segment in enumerate(segments, start=1):
        glyph_name = segment["glyph_name"]
        print(f"[trace {index}/{total}] processing {glyph_name} ({total - index} remaining)", flush=True)
        input_key = select_trace_input_key(segment, require_upscaled=require_upscaled)
        input_path = resolve_segment_path(segment[input_key], base_dir=base_dir, artifact_base=artifact_base)
        try:
            crop = load_rgb(input_path)
            mask = extract_red_fill_mask(crop, style, glyph=segment.get("glyph"))
            mask_path = mask_dir / f"{glyph_name}.png"
            save_gray(mask_path, mask)

            if bool(style.get("trace", {}).get("save_trace_masks", True)):
                trace_mask_path = trace_mask_dir / f"{glyph_name}.png"
                save_gray(trace_mask_path, prepare_trace_mask(mask, style.get("trace", {})))

            record = trace_mask_to_path(mask, segment, style)
            record["mask_path"] = str(mask_path.relative_to(artifact_base))
            if bool(style.get("trace", {}).get("save_trace_masks", True)):
                record["trace_mask_path"] = str(trace_mask_path.relative_to(artifact_base))
            record["crop_path"] = segment["crop_path"]
            record["trace_input_path"] = segment[input_key]
            record["trace_input_kind"] = "upscaled" if input_key == "upscaled_crop_path" else "original"
            glyph_records.append(record)
            print(f"[trace {index}/{total}] done {glyph_name}", flush=True)
        except Exception as exc:
            failures.append({
                "glyph": segment.get("glyph"),
                "glyph_name": glyph_name,
                "error": str(exc),
            })
            print(f"WARNING: failed tracing {glyph_name}: {exc}", file=sys.stderr)
            print(f"[trace {index}/{total}] failed {glyph_name}", flush=True)

    result = {
        "source_segments": relative_to_base(segments_path, artifact_base),
        "glyph_count": len(glyph_records),
        "failed_count": len(failures),
        "failures": failures,
        "glyphs": glyph_records,
    }

    write_json(path_dir / "glyph_paths.json", result)
    return result


def select_trace_input_key(segment: dict, require_upscaled: bool) -> str:
    if segment.get("upscaled_crop_path"):
        return "upscaled_crop_path"
    if require_upscaled:
        raise ValueError(f"Missing upscaled_crop_path for glyph {segment.get('glyph_name')}")
    return "crop_path"


def resolve_segment_path(path_value: str, base_dir: Path, artifact_base: Path) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path
    base_candidate = base_dir / path
    if base_candidate.exists():
        return base_candidate
    return artifact_base / path


def relative_to_base(path: Path, base: Path) -> str:
    try:
        return str(path.relative_to(base))
    except ValueError:
        return str(path)


def main() -> None:
    parser = argparse.ArgumentParser(description="Extract red fill masks and trace them into SVG path data.")
    parser.add_argument("--segments", default="output/segments.json", help="segments.json from script 01.")
    parser.add_argument("--style", default="config/style.json", help="Style/config JSON.")
    parser.add_argument("--out", default="output", help="Output directory.")
    parser.add_argument("--require-upscaled", action="store_true", help="Fail unless every segment has upscaled_crop_path.")
    parser.add_argument("--path-base", default=None, help="Base directory for resolving run-relative segment paths.")
    args = parser.parse_args()

    result = trace_fill_paths(args.segments, args.style, args.out, require_upscaled=args.require_upscaled, path_base=args.path_base)
    print(f"Wrote {result['glyph_count']} traced glyph paths to {Path(args.out) / 'paths' / 'glyph_paths.json'}")
    if result["failed_count"]:
        print(f"WARNING: {result['failed_count']} glyphs failed. See failures in JSON.", file=sys.stderr)


if __name__ == "__main__":
    main()
