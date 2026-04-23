from __future__ import annotations

from pathlib import Path


def asset_dir_for(run_dir: Path, asset_id: str) -> Path:
    path = run_dir.resolve() / "assets" / asset_id
    if not path.exists():
        raise FileNotFoundError(f"Missing asset directory: {path}")
    return path


def extraction_phase_dir(run_dir: Path, asset_id: str) -> Path:
    return asset_dir_for(run_dir, asset_id) / "extraction"


def extraction_step_dir(run_dir: Path, asset_id: str, step: str) -> Path:
    path = extraction_phase_dir(run_dir, asset_id) / step
    path.mkdir(parents=True, exist_ok=True)
    return path


def relative_to_asset(asset_dir: Path, path: Path) -> str:
    return str(path.resolve().relative_to(asset_dir.resolve()))
