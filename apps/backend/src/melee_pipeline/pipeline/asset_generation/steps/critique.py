from __future__ import annotations

from pathlib import Path

from ....io.logging import RunLogger
from ....io.prompt_loader import parse_json_object, render_prompt
from ....io.paths import prompt_path
from ....model_adapters import write_text_prompt
from ....schemas import AssetComponentReport, ComponentCritiqueRequest
from .common import (
    asset_dir_for,
    iteration_step_dir,
    load_asset_entry,
    reference_image_path,
    resolve_iteration,
    relative_to_asset,
)


def critique_component(
    run_dir: Path,
    asset_id: str,
    model: str,
    iteration: int | None,
    threshold: float,
    logger: RunLogger | None = None,
) -> AssetComponentReport:
    run_dir = run_dir.resolve()
    logger = logger or RunLogger(run_dir)
    asset_dir = asset_dir_for(run_dir, asset_id)
    resolved_iteration = resolve_iteration(run_dir, asset_id, iteration)
    render_dir = iteration_step_dir(run_dir, asset_id, resolved_iteration, "render")
    critique_dir = iteration_step_dir(run_dir, asset_id, resolved_iteration, "critique")
    asset = load_asset_entry(run_dir, asset_id)
    reference_path = reference_image_path(run_dir, asset_id)
    render_path = render_dir / "render.png"
    if not render_path.exists():
        raise FileNotFoundError(f"Missing render image: {render_path}")

    prompt_file = prompt_path("asset_generation", "css-asset-critique.py")
    prompt_body = render_prompt(
        prompt_file,
        asset=asset,
        iteration=resolved_iteration,
        threshold=threshold,
    )
    request = ComponentCritiqueRequest(
        asset_id=asset_id,
        model=model,
        prompt_file=str(prompt_file),
        reference_image=str(reference_path),
        render_image=str(render_path),
        iteration=resolved_iteration,
        prompt=prompt_body,
    )
    (critique_dir / "request.json").write_text(request.model_dump_json(indent=2) + "\n")
    (critique_dir / "prompt.md").write_text(prompt_body)
    logger.event(
        "asset_critique.request_written",
        "asset_generation",
        "Wrote component critique request",
        asset_id=asset_id,
        model=model,
        iteration=resolved_iteration,
        threshold=threshold,
    )

    with logger.span(
        "asset_critique.model_call",
        "asset_generation",
        "Component critique model call",
        asset_id=asset_id,
        model=model,
        iteration=resolved_iteration,
    ):
        response_text = write_text_prompt([reference_path, render_path], prompt_body, model)
    data = parse_json_object(response_text)
    data = normalize_report_payload(data)
    data["threshold"] = threshold
    data["component_html"] = relative_to_asset(
        asset_dir, iteration_step_dir(run_dir, asset_id, resolved_iteration, "generation") / "component.html"
    )
    data["component_css"] = relative_to_asset(
        asset_dir, iteration_step_dir(run_dir, asset_id, resolved_iteration, "generation") / "component.css"
    )
    data["reference_image"] = relative_to_asset(asset_dir, reference_path)
    data["render"] = relative_to_asset(asset_dir, render_path)
    report = AssetComponentReport.model_validate(data)
    (critique_dir / "report.json").write_text(report.model_dump_json(indent=2) + "\n")
    logger.event(
        "asset_critique.completed",
        "asset_generation",
        "Wrote component critique report",
        asset_id=asset_id,
        iteration=resolved_iteration,
        accepted=report.accepted,
        score=report.score,
        threshold=threshold,
    )
    return report


def normalize_report_payload(data: dict) -> dict:
    normalized = dict(data)
    issues = normalized.get("issues")
    if not isinstance(issues, list):
        return normalized

    normalized_issues = []
    for issue in issues:
        if not isinstance(issue, dict):
            normalized_issues.append(issue)
            continue
        item = dict(issue)
        category = item.get("category")
        if isinstance(category, str):
            item["category"] = normalize_issue_token(category)
        else:
            item["category"] = "other"
        severity = item.get("severity")
        if isinstance(severity, str):
            item["severity"] = normalize_issue_token(severity)
        else:
            item["severity"] = "unspecified"
        normalized_issues.append(item)
    normalized["issues"] = normalized_issues
    return normalized


def normalize_issue_token(value: str) -> str:
    token = value.strip().lower().replace("-", "_").replace(" ", "_")
    return token or "other"
