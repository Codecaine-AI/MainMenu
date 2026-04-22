from __future__ import annotations

import json
from pathlib import Path

from ...io.logging import RunLogger
from ...io.paths import prompt_path
from ...model_adapters import write_text_prompt
from ...prompting import parse_json_object, read_prompt
from ...schemas import (
    ComponentGenerationRequest,
    ComponentGenerationResult,
    ImplementationMode,
)
from .common import asset_dir_for, load_asset_entry, load_existing_report, reference_image_path


def generate_component(
    run_dir: Path,
    asset_id: str,
    model: str,
    implementation_mode: ImplementationMode = ImplementationMode.CSS_SVG_HYBRID,
    iteration: int = 1,
    dry_run: bool = False,
    logger: RunLogger | None = None,
) -> ComponentGenerationResult | None:
    run_dir = run_dir.resolve()
    logger = logger or RunLogger(run_dir)
    asset_dir = asset_dir_for(run_dir, asset_id)
    asset = load_asset_entry(run_dir, asset_id)
    reference_image = reference_image_path(run_dir, asset_id)
    previous_report = load_existing_report(run_dir, asset_id) if iteration > 1 else None
    prompt_file = prompt_path("asset_generation", "css-asset-recreation.md")
    prompt_template = read_prompt(prompt_file)
    prompt_body = build_generation_prompt(
        prompt_template=prompt_template,
        asset=asset,
        implementation_mode=implementation_mode,
        iteration=iteration,
        previous_report=previous_report,
    )

    request = ComponentGenerationRequest(
        asset_id=asset_id,
        model=model,
        prompt_file=str(prompt_file),
        reference_image=str(reference_image),
        implementation_mode=implementation_mode,
        iteration=iteration,
        prompt=prompt_body,
    )
    request_path = asset_dir / "component-request.json"
    prompt_path_out = asset_dir / "component-prompt.md"
    request_path.write_text(request.model_dump_json(indent=2) + "\n")
    prompt_path_out.write_text(prompt_body)
    logger.event(
        "asset_generation.request_written",
        "asset_generation",
        "Wrote component generation request",
        asset_id=asset_id,
        path=request_path,
        model=model,
        iteration=iteration,
        implementation_mode=implementation_mode,
    )

    if dry_run:
        logger.event(
            "asset_generation.dry_run",
            "asset_generation",
            "Skipped component generation model call",
            asset_id=asset_id,
            model=model,
            iteration=iteration,
        )
        return None

    with logger.span(
        "asset_generation.model_call",
        "asset_generation",
        "Component generation model call",
        asset_id=asset_id,
        model=model,
        iteration=iteration,
    ):
        response_text = write_text_prompt(reference_image, prompt_body, model)
    result = ComponentGenerationResult.model_validate(parse_json_object(response_text))

    (asset_dir / "component.html").write_text(result.html.rstrip() + "\n")
    (asset_dir / "component.css").write_text(result.css.rstrip() + "\n")
    (asset_dir / "component-generation-result.json").write_text(
        result.model_dump_json(indent=2) + "\n"
    )
    logger.event(
        "asset_generation.completed",
        "asset_generation",
        "Wrote component implementation files",
        asset_id=asset_id,
        iteration=iteration,
        implementation_mode=result.implementation_mode,
    )
    return result


def build_generation_prompt(
    *,
    prompt_template: str,
    asset: object,
    implementation_mode: ImplementationMode,
    iteration: int,
    previous_report: object | None,
) -> str:
    parts = [
        prompt_template,
        "",
        "Return JSON only with this shape:",
        json.dumps(
            {
                "implementation_mode": implementation_mode.value,
                "html": "<div>...</div>",
                "css": ".component { }",
                "notes": ["short implementation note"],
                "raster_dependencies": [],
            },
            indent=2,
        ),
        "",
        "Constraints:",
        "- `html` must be a snippet suitable for insertion inside a wrapper div, not a full document.",
        "- `css` must contain all styles needed for the snippet.",
        "- Keep the implementation tight to the asset bounds.",
        "- Use inline SVG inside the HTML snippet when needed for silhouette precision.",
        "",
        f"Iteration: {iteration}",
        f"Requested implementation mode: {implementation_mode.value}",
        "",
        "Asset metadata JSON:",
        json.dumps(asset.model_dump(mode='json'), indent=2),
    ]
    if previous_report is not None:
        parts.extend(
            [
                "",
                "Previous critique report JSON. Fix these issues directly unless the structure is unsalvageable:",
                previous_report.model_dump_json(indent=2),
            ]
        )
    return "\n".join(parts).strip() + "\n"
