"""Step 02: upscale segmented glyph crops with Gemini image generation."""

from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path
import sys
from typing import Callable

from PIL import Image

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

from common import read_json, write_json
from gemini_image import edit_image, resolve_image_size


DEFAULT_IMAGE_MODEL = "gemini-image/gemini-3.1-flash-image-preview"
DEFAULT_IMAGE_SIZE = "2K"
DEFAULT_IMAGE_QUALITY = "high"
DEFAULT_ASPECT_RATIO = "1:1"


@dataclass(frozen=True)
class UpscaleArtifacts:
    glyph_name: str
    image_path: Path
    request_path: Path
    image_size: tuple[int, int] | None = None
    error: str | None = None


def build_prompt(prompt_path: str | Path, description_path: str | Path) -> str:
    template = Path(prompt_path).read_text(encoding="utf-8")
    description = Path(description_path).read_text(encoding="utf-8").strip()
    return template.replace("{{USER_DESCRIPTION}}", description)


def provider_model_name(model: str) -> str:
    if "/" not in model:
        return model
    provider, model_name = model.split("/", 1)
    if provider != "gemini-image":
        raise ValueError(f"Unsupported image model provider for glyph upscale: {provider}")
    return model_name


def resolve_segment_path(path_value: str, base_dir: Path, artifact_base: Path) -> Path:
    path = Path(path_value)
    if path.is_absolute():
        return path
    artifact_candidate = artifact_base / path
    if artifact_candidate.exists():
        return artifact_candidate
    return base_dir / path


def relative_to_base(path: Path, base: Path) -> str:
    try:
        return str(path.relative_to(base))
    except ValueError:
        return str(path)


def upscale_glyphs(
    segments_path: str | Path,
    out_dir: str | Path,
    specimen_path: str | Path,
    prompt_path: str | Path,
    description_path: str | Path,
    image_model: str = DEFAULT_IMAGE_MODEL,
    image_size: str = DEFAULT_IMAGE_SIZE,
    image_quality: str = DEFAULT_IMAGE_QUALITY,
    max_workers: int = 1,
    edit_fn: Callable[..., Path] = edit_image,
    path_base: str | Path | None = None,
) -> dict:
    segments_path = Path(segments_path)
    out_dir = Path(out_dir)
    base_dir = segments_path.parent
    artifact_base = Path(path_base) if path_base is not None else out_dir
    prompt = build_prompt(prompt_path, description_path)
    model_name = provider_model_name(image_model)
    resolved_size = resolve_image_size(image_size, image_quality)

    segments_data = read_json(segments_path)
    image_dir = out_dir / "upscaled" / "images"
    request_dir = out_dir / "upscaled" / "requests"
    for directory in (image_dir, request_dir):
        directory.mkdir(parents=True, exist_ok=True)
    segments = segments_data["segments"]
    total = len(segments)
    print(f"Generating {total} upscaled glyph images with {max(1, int(max_workers))} worker(s).", flush=True)

    def process(segment: dict) -> UpscaleArtifacts:
        glyph_name = segment["glyph_name"]
        original_crop = resolve_segment_path(segment["crop_path"], base_dir=base_dir, artifact_base=artifact_base)
        image_path = image_dir / f"{glyph_name}.png"
        request_path = request_dir / f"{glyph_name}.json"
        aspect_ratio = DEFAULT_ASPECT_RATIO
        request_payload = {
            "glyph": segment["glyph"],
            "glyph_name": glyph_name,
            "model": image_model,
            "resolved_model": model_name,
            "image_size": image_size,
            "resolved_image_size": resolved_size,
            "image_quality": image_quality,
            "aspect_ratio": aspect_ratio,
            "input_images": [str(original_crop)],
            "prompt": prompt,
        }
        write_json(request_path, request_payload)
        try:
            edit_fn([original_crop], prompt, image_path, model_name, resolved_size, image_quality, aspect_ratio)
            with Image.open(image_path) as image:
                generated_size = image.size
            return UpscaleArtifacts(
                glyph_name=glyph_name,
                image_path=image_path,
                request_path=request_path,
                image_size=generated_size,
            )
        except Exception as exc:
            return UpscaleArtifacts(glyph_name, image_path, request_path, error=str(exc))

    artifacts: list[UpscaleArtifacts] = []
    workers = max(1, int(max_workers))
    if workers == 1:
        for index, segment in enumerate(segments, start=1):
            glyph_name = segment["glyph_name"]
            print(f"[upscale {index}/{total}] generating {glyph_name} ({total - index} remaining)", flush=True)
            artifact = process(segment)
            status = "failed" if artifact.error else "done"
            print(f"[upscale {index}/{total}] {status} {glyph_name}", flush=True)
            artifacts.append(artifact)
    else:
        with ThreadPoolExecutor(max_workers=workers) as executor:
            futures = {executor.submit(process, segment): segment for segment in segments}
            for completed, future in enumerate(as_completed(futures), start=1):
                segment = futures[future]
                artifact = future.result()
                status = "failed" if artifact.error else "done"
                print(
                    f"[upscale {completed}/{total}] {status} {segment['glyph_name']} ({total - completed} remaining)",
                    flush=True,
                )
                artifacts.append(artifact)

    by_glyph = {artifact.glyph_name: artifact for artifact in artifacts}
    failures = []
    for segment in segments_data["segments"]:
        artifact = by_glyph[segment["glyph_name"]]
        if artifact.error:
            failures.append({"glyph": segment["glyph"], "glyph_name": segment["glyph_name"], "error": artifact.error})
            segment.pop("upscaled_crop_path", None)
            continue
        segment["upscaled_crop_path"] = str(artifact.image_path.relative_to(artifact_base))

    results = {
        "source_segments": relative_to_base(segments_path, artifact_base),
        "model": image_model,
        "resolved_image_size": resolved_size,
        "glyph_count": len(artifacts) - len(failures),
        "failed_count": len(failures),
        "failures": failures,
        "glyphs": [
            {
                "glyph_name": artifact.glyph_name,
                "image_path": str(artifact.image_path.relative_to(artifact_base)),
                "request_path": str(artifact.request_path.relative_to(artifact_base)),
                "image_size": artifact.image_size,
                "error": artifact.error,
            }
            for artifact in sorted(artifacts, key=lambda item: item.glyph_name)
        ],
    }
    write_json(out_dir / "upscaled" / "results.json", results)
    write_json(segments_path, segments_data)
    return results


def main() -> None:
    parser = argparse.ArgumentParser(description="Upscale segmented glyph crops with Gemini image generation.")
    parser.add_argument("--segments", default="output/segments.json", help="segments.json from script 01.")
    parser.add_argument("--out", default="output", help="Output directory.")
    parser.add_argument("--specimen", default="samples/alphabet-sheet.jpeg", help="Deprecated; ignored. Upscale uses only each segmented crop image.")
    parser.add_argument("--prompt", default="prompts/upscale-glyph.md", help="Prompt template.")
    parser.add_argument("--description", default="samples/melee/description.md", help="Style description markdown.")
    parser.add_argument("--image-model", default=DEFAULT_IMAGE_MODEL, help="Image model provider/name.")
    parser.add_argument("--image-size", default=DEFAULT_IMAGE_SIZE, help="Gemini image size.")
    parser.add_argument("--image-quality", default=DEFAULT_IMAGE_QUALITY, help="Image quality hint.")
    parser.add_argument("--max-workers", type=int, default=1, help="Concurrent Gemini requests.")
    parser.add_argument("--path-base", default=None, help="Base directory for paths written back to segments.json.")
    parser.add_argument("--allow-failures", action="store_true", help="Exit 0 when one or more glyph upscales fail.")
    args = parser.parse_args()

    result = upscale_glyphs(
        args.segments,
        args.out,
        args.specimen,
        args.prompt,
        args.description,
        args.image_model,
        args.image_size,
        args.image_quality,
        args.max_workers,
        path_base=args.path_base,
    )
    print(f"Wrote {result['glyph_count']} upscaled glyph images to {Path(args.out) / 'upscaled' / 'images'}")
    if result["failed_count"]:
        message = f"{result['failed_count']} glyph upscales failed. See {Path(args.out) / 'upscaled' / 'results.json'}."
        if args.allow_failures:
            print(f"WARNING: {message}", file=sys.stderr)
        else:
            raise SystemExit(message)


if __name__ == "__main__":
    main()
