from __future__ import annotations

from pathlib import Path

from .io.logging import RunLogger
from .io.paths import init_run
from .steps.catalog import catalog_run
from .steps.extract import extract_assets


def run_two_step_pipeline(
    source_image: Path,
    runs_dir: Path,
    run_id: str | None,
    catalog_model: str,
    prompt_model: str,
    image_model: str,
    max_workers: int,
    dry_run: bool,
    image_size: str,
    image_quality: str,
) -> Path:
    runs_dir = runs_dir.resolve()
    run_dir = init_run(source_image, runs_dir=runs_dir, run_id=run_id)
    logger = RunLogger(run_dir)
    logger.update_status(
        run_id=run_dir.name,
        stage="run",
        status="running",
        source_image=source_image.resolve(),
        catalog_model=catalog_model,
        prompt_model=prompt_model,
        image_model=image_model,
    )
    logger.event(
        "run.started",
        "run",
        "Pipeline run started",
        source_image=source_image.resolve(),
        dry_run=dry_run,
        catalog_model=catalog_model,
        prompt_model=prompt_model,
        image_model=image_model,
        max_workers=max_workers,
    )
    try:
        catalog_run(run_dir, model=catalog_model, dry_run=dry_run, logger=logger)
        if (run_dir / "catalog.json").exists():
            results = extract_assets(
                run_dir,
                image_model=image_model,
                prompt_model=prompt_model,
                max_workers=max_workers,
                dry_run=dry_run,
                size=image_size,
                quality=image_quality,
                logger=logger,
            )
            failed = sum(result.status == "failed" for result in results)
            if failed:
                logger.update_status(stage="run", status="failed")
                logger.event(
                    "run.failed",
                    "run",
                    "Pipeline run completed with failed assets",
                    level="error",
                    failed=failed,
                    assets=len(results),
                )
            else:
                logger.update_status(stage="run", status="completed")
                logger.event("run.completed", "run", "Pipeline run completed")
        else:
            logger.update_status(stage="run", status="dry_run")
            logger.event("run.dry_run", "run", "Pipeline dry-run completed before extraction")
    except Exception as exc:
        logger.update_status(stage="run", status="failed", last_error=str(exc))
        logger.event("run.failed", "run", "Pipeline run failed", level="error", error=str(exc))
        raise
    return run_dir
