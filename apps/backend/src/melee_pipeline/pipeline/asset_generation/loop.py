from __future__ import annotations

from pathlib import Path

from ...io.logging import RunLogger
from ...schemas import ImplementationMode
from .steps.critique import critique_component
from .steps.critique_models import AssetComponentReport
from .steps.generate import generate_component
from .steps.render import render_component


def run_asset_loop(
    run_dir: Path,
    asset_id: str,
    generation_model: str,
    critique_model: str,
    implementation_mode: ImplementationMode = ImplementationMode.CSS_SVG_HYBRID,
    max_iterations: int = 3,
    threshold: float = 0.95,
    browser: str = "chromium",
    dry_run: bool = False,
    logger: RunLogger | None = None,
) -> AssetComponentReport | None:
    run_dir = run_dir.resolve()
    logger = logger or RunLogger(run_dir)
    logger.update_status(
        stage="asset_generation",
        status="running",
        active_asset_ids=[asset_id],
        counts={"iterations": 0, "max_iterations": max_iterations},
    )
    logger.event(
        "asset_loop.started",
        "asset_generation",
        "Starting asset generation loop",
        asset_id=asset_id,
        generation_model=generation_model,
        critique_model=critique_model,
        implementation_mode=implementation_mode,
        max_iterations=max_iterations,
        threshold=threshold,
        browser=browser,
        dry_run=dry_run,
    )

    report: AssetComponentReport | None = None
    for iteration in range(1, max_iterations + 1):
        generate_component(
            run_dir,
            asset_id=asset_id,
            model=generation_model,
            implementation_mode=implementation_mode,
            iteration=iteration,
            dry_run=dry_run,
            logger=logger,
        )
        if dry_run:
            logger.update_status(
                stage="asset_generation",
                status="dry_run",
                counts={"iterations": iteration, "max_iterations": max_iterations},
            )
            return None
        render_component(run_dir, asset_id=asset_id, browser=browser, iteration=iteration, logger=logger)
        report = critique_component(
            run_dir,
            asset_id=asset_id,
            model=critique_model,
            iteration=iteration,
            threshold=threshold,
            logger=logger,
        )
        logger.update_status(
            stage="asset_generation",
            status="running",
            active_asset_ids=[asset_id],
            counts={"iterations": iteration, "max_iterations": max_iterations},
            last_score=report.score,
            accepted=report.accepted,
        )
        if report.accepted or report.score >= threshold:
            logger.update_status(
                stage="asset_generation",
                status="completed",
                active_asset_ids=[asset_id],
                counts={"iterations": iteration, "max_iterations": max_iterations},
                last_score=report.score,
                accepted=True,
            )
            logger.event(
                "asset_loop.completed",
                "asset_generation",
                "Asset generation loop accepted component",
                asset_id=asset_id,
                iteration=iteration,
                score=report.score,
                threshold=threshold,
            )
            return report

    if report is not None:
        logger.update_status(
            stage="asset_generation",
            status="failed",
            active_asset_ids=[asset_id],
            counts={"iterations": max_iterations, "max_iterations": max_iterations},
            last_score=report.score,
            accepted=False,
        )
        logger.event(
            "asset_loop.max_iterations",
            "asset_generation",
            "Asset generation loop hit iteration cap without acceptance",
            level="error",
            asset_id=asset_id,
            score=report.score,
            threshold=threshold,
            max_iterations=max_iterations,
        )
    return report
