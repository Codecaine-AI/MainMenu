from __future__ import annotations

import json
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from ..io.paths import prompt_path
from ..model_adapters import edit_image, write_text_prompt
from ..prompting import read_prompt
from ..schemas import (
    ExtractionRequest,
    ExtractionResult,
    PromptGenerationRequest,
    RunManifest,
    update_manifest,
)
from .catalog import load_catalog


def write_extraction_request(
    run_dir: Path,
    asset_id: str,
    image_model: str,
    prompt_model: str,
    dry_run: bool,
    size: str,
    quality: str,
) -> ExtractionRequest:
    run_dir = run_dir.resolve()
    manifest = RunManifest.model_validate_json((run_dir / "run.json").read_text())
    source_image = run_dir / manifest.source_image
    asset_dir = run_dir / "assets" / asset_id
    asset = load_catalog(run_dir).assets_by_id()[asset_id]
    prompt_file = prompt_path("asset-extraction-prompt-generation.md")
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
    (asset_dir / "prompt-generation-request.json").write_text(
        prompt_request.model_dump_json(indent=2) + "\n"
    )

    if dry_run:
        extraction_prompt = (
            "DRY RUN: this file will contain the model-generated extraction prompt for "
            f"{asset_id} when run without --dry-run."
        )
    else:
        extraction_prompt = write_text_prompt(source_image, prompt_generation_prompt, prompt_model)
    (asset_dir / "extraction-prompt.txt").write_text(extraction_prompt.strip() + "\n")

    output_path = asset_dir / "extracted.png"
    request = ExtractionRequest(
        asset_id=asset_id,
        model=image_model,
        source_image=str(source_image),
        output_path=str(output_path),
        prompt=extraction_prompt,
        size=size,
        quality=quality,
    )
    (asset_dir / "image-request.json").write_text(request.model_dump_json(indent=2) + "\n")
    return request


def extract_assets(
    run_dir: Path,
    image_model: str,
    prompt_model: str,
    max_workers: int,
    dry_run: bool,
    size: str = "auto",
    quality: str = "high",
) -> list[ExtractionResult]:
    run_dir = run_dir.resolve()
    catalog = load_catalog(run_dir)
    manifest_path = run_dir / "run.json"
    update_manifest(
        manifest_path,
        status="extraction_requested",
        image_model=image_model,
        prompt_model=prompt_model,
    )

    requests = [
        write_extraction_request(
            run_dir,
            asset.id,
            image_model=image_model,
            prompt_model=prompt_model,
            dry_run=dry_run,
            size=size,
            quality=quality,
        )
        for asset in catalog.assets
    ]

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
    else:
        results = _extract_parallel(requests, max_workers=max_workers)

    for result in results:
        asset_dir = run_dir / "assets" / result.asset_id
        (asset_dir / "extraction-result.json").write_text(result.model_dump_json(indent=2) + "\n")

    if all(result.status in {"completed", "dry_run"} for result in results):
        update_manifest(manifest_path, status="extracted" if not dry_run else "extraction_requested")
    else:
        update_manifest(manifest_path, status="failed")

    return results


def _extract_parallel(requests: list[ExtractionRequest], max_workers: int) -> list[ExtractionResult]:
    results: list[ExtractionResult] = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_map = {executor.submit(_extract_one, request): request for request in requests}
        for future in as_completed(future_map):
            results.append(future.result())
    return sorted(results, key=lambda result: result.asset_id)


def _extract_one(request: ExtractionRequest) -> ExtractionResult:
    try:
        edit_image(
            source_image=Path(request.source_image),
            prompt=request.prompt,
            output_path=Path(request.output_path),
            model=request.model,
            size=request.size,
            quality=request.quality,
        )
        return ExtractionResult(
            asset_id=request.asset_id,
            model=request.model,
            output_path=request.output_path,
            status="completed",
        )
    except Exception as exc:  # noqa: BLE001 - recorded per asset for run inspection.
        return ExtractionResult(
            asset_id=request.asset_id,
            model=request.model,
            output_path=request.output_path,
            status="failed",
            error=str(exc),
        )
