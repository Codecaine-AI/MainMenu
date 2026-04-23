from __future__ import annotations

import json
import math
import re
import shutil
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageOps

from ..common import extraction_step_dir, relative_to_asset
from ..io.logging import RunLogger
from ..model_adapters import edit_image, write_text_prompt
from ..model_adapters.gemini_image import resolve_image_size as resolve_gemini_image_size
from ..model_adapters.registry import split_model
from ..prompts.asset_extraction_prompt_generation import build_prompt as build_extraction_prompt
from ..schemas import (
    ExtractionRequest,
    ExtractionResult,
    ImageSize,
    PromptGenerationRequest,
    RunManifest,
    update_manifest,
)
from .catalog import load_catalog


SUPPORTED_GEMINI_IMAGE_ASPECT_RATIOS = (
    "1:1",
    "1:4",
    "1:8",
    "2:3",
    "3:2",
    "3:4",
    "4:1",
    "4:3",
    "4:5",
    "5:4",
    "8:1",
    "9:16",
    "16:9",
    "21:9",
)


@dataclass(frozen=True)
class NormalizedExtractionArtifacts:
    output_path: Path
    raw_output_path: Path
    raw_size: ImageSize
    normalized_size: ImageSize


def write_extraction_request(
    run_dir: Path,
    asset_id: str,
    image_model: str,
    prompt_model: str,
    dry_run: bool,
    size: str,
    quality: str,
    logger: RunLogger | None = None,
) -> ExtractionRequest:
    run_dir = run_dir.resolve()
    logger = logger or RunLogger(run_dir)
    manifest = RunManifest.model_validate_json((run_dir / "run.json").read_text())
    source_image = run_dir / manifest.source_image
    asset_dir = run_dir / "assets" / asset_id
    prompt_generation_dir = extraction_step_dir(run_dir, asset_id, "prompt_generation")
    image_extraction_dir = extraction_step_dir(run_dir, asset_id, "image_extraction")
    asset = load_catalog(run_dir).assets_by_id()[asset_id]
    asset_width, asset_height = asset_dimensions_from_bounds(
        bounds=asset.bounds,
        canvas_width=manifest.canvas.width,
        canvas_height=manifest.canvas.height,
    )
    aspect_ratio = closest_supported_aspect_ratio(asset_width, asset_height)
    target_size = ImageSize(width=asset_width, height=asset_height)
    resolved_image_size = resolve_requested_image_size(image_model, size=size, quality=quality)
    prompt_module = "asset_extraction_pipeline.prompts.asset_extraction_prompt_generation"
    prompt_generation_prompt = build_extraction_prompt(asset=asset).strip() + "\n"
    prompt_request = PromptGenerationRequest(
        asset_id=asset_id,
        model=prompt_model,
        source_image=str(source_image),
        prompt_file=prompt_module,
        asset=asset,
        prompt=prompt_generation_prompt,
    )
    asset_dir.mkdir(parents=True, exist_ok=True)
    prompt_request_path = prompt_generation_dir / "request.json"
    prompt_request_path.write_text(prompt_request.model_dump_json(indent=2) + "\n")
    logger.event(
        "prompt.request_written",
        "prompt_generation",
        "Wrote prompt generation request artifact",
        asset_id=asset_id,
        path=prompt_request_path,
        model=prompt_model,
    )

    if dry_run:
        extraction_prompt = (
            "DRY RUN: this file will contain the model-generated extraction prompt for "
            f"{asset_id} when run without --dry-run."
        )
        logger.event(
            "prompt.dry_run",
            "prompt_generation",
            "Skipped prompt generation model call",
            asset_id=asset_id,
            model=prompt_model,
        )
    else:
        with logger.span(
            "prompt.model_call",
            "prompt_generation",
            "Prompt generation model call",
            asset_id=asset_id,
            model=prompt_model,
        ):
            extraction_prompt = write_text_prompt(source_image, prompt_generation_prompt, prompt_model)
    extraction_prompt_path = prompt_generation_dir / "prompt.txt"
    extraction_prompt_path.write_text(extraction_prompt.strip() + "\n")
    logger.event(
        "prompt.written",
        "prompt_generation",
        "Wrote asset extraction prompt",
        asset_id=asset_id,
        path=extraction_prompt_path,
    )

    output_path = image_extraction_dir / "extracted.png"
    request = ExtractionRequest(
        asset_id=asset_id,
        model=image_model,
        source_image=str(source_image),
        output_path=str(output_path),
        prompt=extraction_prompt,
        size=size,
        quality=quality,
        aspect_ratio=aspect_ratio,
        target_size=target_size,
        resolved_image_size=resolved_image_size,
    )
    image_request_path = image_extraction_dir / "request.json"
    image_request_path.write_text(request.model_dump_json(indent=2) + "\n")
    logger.event(
        "image.request_written",
        "image_extraction",
        "Wrote image extraction request artifact",
        asset_id=asset_id,
        path=image_request_path,
        model=image_model,
        size=size,
        quality=quality,
        aspect_ratio=aspect_ratio,
        resolved_image_size=resolved_image_size,
        target_width=target_size.width,
        target_height=target_size.height,
    )
    return request


def extract_assets(
    run_dir: Path,
    image_model: str,
    prompt_model: str,
    max_workers: int,
    dry_run: bool,
    size: str = "auto",
    quality: str = "high",
    logger: RunLogger | None = None,
) -> list[ExtractionResult]:
    run_dir = run_dir.resolve()
    logger = logger or RunLogger(run_dir)
    catalog = load_catalog(run_dir)
    manifest_path = run_dir / "run.json"
    manifest = RunManifest.model_validate_json(manifest_path.read_text())
    update_manifest(
        manifest_path,
        status="extraction_requested",
        image_model=image_model,
        prompt_model=prompt_model,
    )
    logger.update_status(
        run_id=manifest.run_id,
        stage="extraction",
        status="running",
        prompt_model=prompt_model,
        image_model=image_model,
        counts={"assets": len(catalog.assets), "completed": 0, "dry_run": 0, "failed": 0},
    )
    logger.event(
        "extraction.started",
        "extraction",
        "Preparing asset extraction",
        asset_count=len(catalog.assets),
        image_model=image_model,
        prompt_model=prompt_model,
        max_workers=max_workers,
        dry_run=dry_run,
        size=size,
        quality=quality,
    )

    try:
        requests = [
            write_extraction_request(
                run_dir,
                asset.id,
                image_model=image_model,
                prompt_model=prompt_model,
                dry_run=dry_run,
                size=size,
                quality=quality,
                logger=logger,
            )
            for asset in catalog.assets
        ]

        logger.event(
            "extraction.requests_prepared",
            "extraction",
            "Prepared extraction requests",
            asset_count=len(requests),
        )

        if dry_run:
            results = [
                ExtractionResult(
                    asset_id=request.asset_id,
                    model=image_model,
                    output_path=request.output_path,
                    status="dry_run",
                    target_size=request.target_size,
                    aspect_ratio=request.aspect_ratio,
                    resolved_image_size=request.resolved_image_size,
                )
                for request in requests
            ]
            logger.event(
                "extraction.dry_run",
                "image_extraction",
                "Skipped image extraction model calls",
                asset_count=len(results),
            )
        else:
            results = _extract_parallel(requests, max_workers=max_workers, logger=logger)

        for result in results:
            asset_dir = run_dir / "assets" / result.asset_id
            result_path = extraction_step_dir(run_dir, result.asset_id, "image_extraction") / "result.json"
            result_path.write_text(result.model_dump_json(indent=2) + "\n")
            logger.event(
                "extraction.result_written",
                "extraction",
                "Wrote extraction result",
                asset_id=result.asset_id,
                path=result_path,
                status=result.status,
            )

        counts = {
            "assets": len(results),
            "completed": sum(result.status == "completed" for result in results),
            "dry_run": sum(result.status == "dry_run" for result in results),
            "failed": sum(result.status == "failed" for result in results),
        }
        if all(result.status in {"completed", "dry_run"} for result in results):
            update_manifest(manifest_path, status="extracted" if not dry_run else "extraction_requested")
            logger.update_status(stage="extraction", status="completed", counts=counts)
            logger.event("extraction.completed", "extraction", "Asset extraction completed", **counts)
        else:
            update_manifest(manifest_path, status="failed")
            logger.update_status(stage="extraction", status="failed", counts=counts)
            logger.event(
                "extraction.failed",
                "extraction",
                "One or more asset extractions failed",
                level="error",
                **counts,
            )
        return results
    except Exception as exc:
        update_manifest(manifest_path, status="failed")
        logger.update_status(stage="extraction", status="failed", last_error=str(exc))
        logger.event("extraction.failed", "extraction", "Asset extraction failed", level="error", error=str(exc))
        raise


def _extract_parallel(
    requests: list[ExtractionRequest],
    max_workers: int,
    logger: RunLogger | None = None,
) -> list[ExtractionResult]:
    logger = logger or RunLogger(Path(requests[0].output_path).resolve().parents[2])
    started = time.monotonic()
    results: list[ExtractionResult] = []

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_request = {
            executor.submit(_run_single_extraction, request, logger): request for request in requests
        }
        for future in as_completed(future_to_request):
            request = future_to_request[future]
            try:
                results.append(future.result())
            except Exception as exc:  # noqa: BLE001
                results.append(
                    ExtractionResult(
                        asset_id=request.asset_id,
                        model=request.model,
                        output_path=request.output_path,
                        status="failed",
                        error=str(exc),
                    )
                )

    order = {request.asset_id: index for index, request in enumerate(requests)}
    results.sort(key=lambda result: order[result.asset_id])
    logger.event(
        "extraction.parallel_finished",
        "image_extraction",
        "Parallel extraction finished",
        duration_seconds=round(time.monotonic() - started, 3),
        workers=max_workers,
    )
    return results


def _run_single_extraction(request: ExtractionRequest, logger: RunLogger) -> ExtractionResult:
    asset_id = request.asset_id
    output_path = Path(request.output_path)
    asset_dir = output_path.parent

    with logger.span(
        "image.model_call",
        "image_extraction",
        "Image extraction model call",
        asset_id=asset_id,
        model=request.model,
        output_path=output_path,
    ):
        temp_path = edit_image(
            source_image=Path(request.source_image),
            prompt=request.prompt,
            model=request.model,
            output_path=output_path,
            size=request.size,
            quality=request.quality,
            aspect_ratio=request.aspect_ratio,
        )

    artifacts = normalize_extracted_file(
        temp_path,
        output_path,
        target_size=request.target_size,
        asset_dir=asset_dir,
    )
    logger.event(
        "image.completed",
        "image_extraction",
        "Image extraction completed",
        asset_id=asset_id,
        path=artifacts.output_path,
        raw_output_path=artifacts.raw_output_path,
        raw_width=artifacts.raw_size.width,
        raw_height=artifacts.raw_size.height,
        normalized_width=artifacts.normalized_size.width,
        normalized_height=artifacts.normalized_size.height,
        target_width=request.target_size.width,
        target_height=request.target_size.height,
        aspect_ratio=request.aspect_ratio,
        resolved_image_size=request.resolved_image_size,
    )
    return ExtractionResult(
        asset_id=asset_id,
        model=request.model,
        output_path=str(artifacts.output_path),
        status="completed",
        raw_output_path=str(artifacts.raw_output_path),
        raw_size=artifacts.raw_size,
        normalized_size=artifacts.normalized_size,
        target_size=request.target_size,
        aspect_ratio=request.aspect_ratio,
        resolved_image_size=request.resolved_image_size,
    )


def normalize_extracted_file(
    temp_path: Path,
    output_path: Path,
    target_size: ImageSize,
    asset_dir: Path | None = None,
) -> NormalizedExtractionArtifacts:
    temp_path = temp_path.resolve()
    output_path = output_path.resolve()
    asset_dir = asset_dir.resolve() if asset_dir else output_path.parent.resolve()
    asset_dir.mkdir(parents=True, exist_ok=True)
    raw_path = asset_dir / "raw-extracted.png"

    for path in {output_path, raw_path, asset_dir / "alpha-mask.png"}:
        if path.exists() and path.resolve() != temp_path:
            if path.is_dir():
                shutil.rmtree(path)
            else:
                path.unlink()

    with Image.open(temp_path).convert("RGBA") as extracted_image:
        raw_size = ImageSize(width=extracted_image.width, height=extracted_image.height)
        extracted_image.save(raw_path)
        normalized_image = normalize_extracted_image(extracted_image, target_size)
        normalized_size = ImageSize(width=normalized_image.width, height=normalized_image.height)
        normalized_image.save(output_path)

    if temp_path not in {raw_path, output_path} and temp_path.exists():
        temp_path.unlink()

    return NormalizedExtractionArtifacts(
        output_path=output_path,
        raw_output_path=raw_path,
        raw_size=raw_size,
        normalized_size=normalized_size,
    )


def normalize_extracted_image(image: Image.Image, target_size: ImageSize) -> Image.Image:
    source = image.convert("RGBA")
    target_width = max(target_size.width, 1)
    target_height = max(target_size.height, 1)
    if source.size == (target_width, target_height):
        return source.copy()

    fitted = ImageOps.contain(
        source,
        (target_width, target_height),
        method=Image.Resampling.LANCZOS,
    )
    canvas = Image.new("RGBA", (target_width, target_height), (0, 0, 0, 0))
    x = (target_width - fitted.width) // 2
    y = (target_height - fitted.height) // 2
    canvas.paste(fitted, (x, y), fitted)
    return canvas


def resolve_requested_image_size(model: str, *, size: str, quality: str) -> str | None:
    provider, _ = split_model(model, default_provider="openai-image")
    if provider == "gemini-image":
        return resolve_gemini_image_size(size=size, quality=quality)

    normalized_size = (size or "").strip()
    return normalized_size or None


def asset_dimensions_from_bounds(bounds: str, canvas_width: int, canvas_height: int) -> tuple[int, int]:
    if bounds == "full_image":
        return canvas_width, canvas_height

    match = re.search(r"\[\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*,\s*([0-9]+)\s*\]", bounds)
    if match:
        width = max(int(match.group(3)), 1)
        height = max(int(match.group(4)), 1)
        return width, height

    return max(canvas_width, 1), max(canvas_height, 1)


def closest_supported_aspect_ratio(width: int, height: int) -> str:
    width = max(width, 1)
    height = max(height, 1)
    target = width / height

    def parse_ratio(value: str) -> float:
        w_str, h_str = value.split(":", 1)
        return int(w_str) / int(h_str)

    return min(
        SUPPORTED_GEMINI_IMAGE_ASPECT_RATIOS,
        key=lambda ratio: abs(math.log(target) - math.log(parse_ratio(ratio))),
    )
