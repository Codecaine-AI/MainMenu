from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw

from ...io.logging import RunLogger
from ...io.paths import prompt_path
from ...model_adapters import write_text_prompt
from ...prompting import parse_json_object, read_prompt
from ...schemas import AssetComponentReport, ComponentCritiqueRequest, ComponentDiffMetrics
from .common import asset_dir_for, load_asset_entry, reference_image_path


def critique_component(
    run_dir: Path,
    asset_id: str,
    model: str,
    iteration: int,
    threshold: float,
    logger: RunLogger | None = None,
) -> AssetComponentReport:
    run_dir = run_dir.resolve()
    logger = logger or RunLogger(run_dir)
    asset_dir = asset_dir_for(run_dir, asset_id)
    asset = load_asset_entry(run_dir, asset_id)
    reference_path = reference_image_path(run_dir, asset_id)
    render_path = asset_dir / "render.png"
    diff_path = asset_dir / "diff.png"
    diff_metrics_path = asset_dir / "diff-metrics.json"
    if not render_path.exists():
        raise FileNotFoundError(f"Missing render image: {render_path}")
    if not diff_path.exists():
        raise FileNotFoundError(f"Missing diff image: {diff_path}")
    if not diff_metrics_path.exists():
        raise FileNotFoundError(f"Missing diff metrics: {diff_metrics_path}")
    diff_metrics = ComponentDiffMetrics.model_validate_json(diff_metrics_path.read_text())

    composite_path = asset_dir / "critique-input.png"
    build_critique_composite(reference_path, render_path, diff_path, composite_path)

    prompt_file = prompt_path("asset_generation", "css-asset-critique.md")
    prompt_template = read_prompt(prompt_file)
    prompt_body = build_critique_prompt(
        prompt_template=prompt_template,
        asset=asset,
        diff_metrics=diff_metrics,
        iteration=iteration,
        threshold=threshold,
    )
    request = ComponentCritiqueRequest(
        asset_id=asset_id,
        model=model,
        prompt_file=str(prompt_file),
        reference_image=str(reference_path),
        render_image=str(render_path),
        diff_image=str(diff_path),
        iteration=iteration,
        prompt=prompt_body,
    )
    (asset_dir / "critique-request.json").write_text(request.model_dump_json(indent=2) + "\n")
    (asset_dir / "critique-prompt.md").write_text(prompt_body)
    logger.event(
        "asset_critique.request_written",
        "asset_generation",
        "Wrote component critique request",
        asset_id=asset_id,
        model=model,
        iteration=iteration,
        threshold=threshold,
    )

    with logger.span(
        "asset_critique.model_call",
        "asset_generation",
        "Component critique model call",
        asset_id=asset_id,
        model=model,
        iteration=iteration,
    ):
        response_text = write_text_prompt(composite_path, prompt_body, model)
    data = parse_json_object(response_text)
    data["threshold"] = threshold
    report = AssetComponentReport.model_validate(data)
    (asset_dir / "report.json").write_text(report.model_dump_json(indent=2) + "\n")
    logger.event(
        "asset_critique.completed",
        "asset_generation",
        "Wrote component critique report",
        asset_id=asset_id,
        iteration=iteration,
        accepted=report.accepted,
        score=report.score,
        threshold=threshold,
    )
    return report


def build_critique_prompt(
    *,
    prompt_template: str,
    asset: object,
    diff_metrics: ComponentDiffMetrics,
    iteration: int,
    threshold: float,
) -> str:
    return (
        f"{prompt_template}\n\n"
        "The attached image is a three-panel comparison in this order: reference asset, current render, "
        "and amplified diff.\n\n"
        f"Iteration: {iteration}\n"
        f"Acceptance threshold: {threshold:.3f}\n\n"
        "Asset metadata JSON:\n"
        f"{json.dumps(asset.model_dump(mode='json'), indent=2)}\n\n"
        "Diff metrics JSON:\n"
        f"{diff_metrics.model_dump_json(indent=2)}\n"
    )


def build_critique_composite(
    reference_path: Path,
    render_path: Path,
    diff_path: Path,
    output_path: Path,
) -> None:
    with Image.open(reference_path).convert("RGBA") as reference, Image.open(render_path).convert(
        "RGBA"
    ) as render, Image.open(diff_path).convert("RGBA") as diff:
        max_height = max(reference.height, render.height, diff.height)
        pad = 24
        label_height = 36
        panel_widths = [reference.width, render.width, diff.width]
        total_width = sum(panel_widths) + pad * 4
        total_height = max_height + label_height + pad * 2
        canvas = Image.new("RGBA", (total_width, total_height), (10, 10, 16, 255))
        draw = ImageDraw.Draw(canvas)
        labels = ("reference", "render", "diff")
        x = pad
        for label, image in zip(labels, (reference, render, diff), strict=True):
            draw.text((x, 8), label, fill=(240, 240, 245, 255))
            y = pad + label_height
            canvas.paste(image, (x, y), image)
            x += image.width + pad
        output_path.write_bytes(b"")
        canvas.save(output_path)
