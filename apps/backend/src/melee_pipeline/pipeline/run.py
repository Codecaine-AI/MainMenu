from __future__ import annotations

from pathlib import Path

from ..io.paths import init_run
from .catalog import catalog_run
from .extract import extract_assets


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
    catalog_run(run_dir, model=catalog_model, dry_run=dry_run)
    if (run_dir / "catalog.json").exists():
        extract_assets(
            run_dir,
            image_model=image_model,
            prompt_model=prompt_model,
            max_workers=max_workers,
            dry_run=dry_run,
            size=image_size,
            quality=image_quality,
        )
    return run_dir
