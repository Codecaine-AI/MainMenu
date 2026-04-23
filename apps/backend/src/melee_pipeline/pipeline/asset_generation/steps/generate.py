from __future__ import annotations

from pathlib import Path

from PIL import Image

from ....io.logging import RunLogger
from ....io.prompt_loader import parse_json_object, render_prompt
from ....io.paths import prompt_path
from ....model_adapters import write_text_prompt
from ....schemas import (
    ComponentGenerationRequest,
    ComponentGenerationResult,
    ImageSize,
    ImplementationMode,
)
from .common import (
    asset_dir_for,
    iteration_step_dir,
    load_asset_entry,
    load_existing_report,
    reference_image_path,
    relative_to_asset,
)


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
    generation_dir = iteration_step_dir(run_dir, asset_id, iteration, "generation")
    asset = load_asset_entry(run_dir, asset_id)
    reference_image = reference_image_path(run_dir, asset_id)
    with Image.open(reference_image) as reference:
        target_size = ImageSize(width=reference.width, height=reference.height)
    previous_report = load_existing_report(run_dir, asset_id) if iteration > 1 else None
    prompt_file = prompt_path("asset_generation", "css-asset-recreation.py")
    prompt_body = render_prompt(
        prompt_file,
        asset=asset,
        implementation_mode=implementation_mode,
        iteration=iteration,
        previous_report=previous_report,
        target_size=target_size,
    )

    request = ComponentGenerationRequest(
        asset_id=asset_id,
        model=model,
        prompt_file=str(prompt_file),
        reference_image=str(reference_image),
        target_size=target_size,
        output_html=relative_to_asset(asset_dir, generation_dir / "component.html"),
        output_css=relative_to_asset(asset_dir, generation_dir / "component.css"),
        implementation_mode=implementation_mode,
        iteration=iteration,
        prompt=prompt_body,
    )
    request_path = generation_dir / "request.json"
    prompt_path_out = generation_dir / "prompt.md"
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
        target_width=target_size.width,
        target_height=target_size.height,
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

    (generation_dir / "component.html").write_text(result.html.rstrip() + "\n")
    (generation_dir / "component.css").write_text(result.css.rstrip() + "\n")
    (generation_dir / "result.json").write_text(
        result.model_dump_json(indent=2) + "\n"
    )
    logger.event(
        "asset_generation.completed",
        "asset_generation",
        "Wrote component implementation files",
        asset_id=asset_id,
        iteration=iteration,
        implementation_mode=result.implementation_mode,
        path=generation_dir,
    )
    return result
