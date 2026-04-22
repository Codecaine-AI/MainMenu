from __future__ import annotations

import json
import math
import re
import shutil
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from ...io.logging import RunLogger
from ...io.paths import prompt_path
from ...model_adapters import edit_image, write_text_prompt
from ...prompting import read_prompt
from ...schemas import (
    ExtractionRequest,
    ExtractionResult,
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
    asset = load_catalog(run_dir).assets_by_id()[asset_id]
    asset_width, asset_height = asset_dimensions_from_bounds(
        bounds=asset.bounds,
        canvas_width=manifest.canvas.width,
        canvas_height=manifest.canvas.height,
    )
    aspect_ratio = closest_supported_aspect_ratio(asset_width, asset_height)
    prompt_file = prompt_path("extraction", "asset-extraction-prompt-generation.md")
    prompt_template = read_prompt(prompt_file)

    prompt_generation_prompt = (
        f"{prompt_template}\n\n"
        "Original source image is attached. Generate the extraction prompt for this single "
        "asset entry JSON:\n\n"
        f"{json.dumps(asset.model_dump(mode='json'), indent=2)}"
    )
    prompt_request = PromptGenerationRequest(
        asset_id=asset_id,
        model=prompt_model,
        source_image=str(source_image),
        prompt_file=str(prompt_file),
        asset=asset,
        prompt=prompt_generation_prompt,
    )
    asset_dir.mkdir(parents=True, exist_ok=True)
    prompt_request_path = asset_dir / "prompt-generation-request.json"
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
    extraction_prompt_path = asset_dir / "extraction-prompt.txt"
    extraction_prompt_path.write_text(extraction_prompt.strip() + "\n")
    logger.event(
        "prompt.written",
        "prompt_generation",
        "Wrote asset extraction prompt",
        asset_id=asset_id,
        path=extraction_prompt_path,
    )

    output_path = asset_dir / "extracted.png"
    request = ExtractionRequest(
        asset_id=asset_id,
        model=image_model,
        source_image=str(source_image),
        output_path=str(output_path),
        prompt=extraction_prompt,
        size=size,
        quality=quality,
        aspect_ratio=aspect_ratio,
    )
    image_request_path = asset_dir / "image-request.json"
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
            result_path = asset_dir / "extraction-result.json"
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

    normalized_path = normalize_extracted_file(temp_path, output_path, asset_dir=asset_dir)
    logger.event(
        "image.completed",
        "image_extraction",
        "Image extraction completed",
        asset_id=asset_id,
        path=normalized_path,
    )
    return ExtractionResult(
        asset_id=asset_id,
        model=request.model,
        output_path=str(normalized_path),
        status="completed",
    )


def normalize_extracted_file(temp_path: Path, output_path: Path, asset_dir: Path | None = None) -> Path:
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

    if temp_path != raw_path:
        shutil.copyfile(temp_path, raw_path)

    if temp_path != output_path:
        shutil.move(temp_path, output_path)

    return output_path


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
