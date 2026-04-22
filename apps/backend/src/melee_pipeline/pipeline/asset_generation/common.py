from __future__ import annotations

from pathlib import Path

from ...schemas import AssetComponentReport, AssetEntry


def asset_dir_for(run_dir: Path, asset_id: str) -> Path:
    path = run_dir.resolve() / "assets" / asset_id
    if not path.exists():
        raise FileNotFoundError(f"Missing asset directory: {path}")
    return path


def asset_file_path(run_dir: Path, asset_id: str) -> Path:
    return asset_dir_for(run_dir, asset_id) / "asset.json"


def reference_image_path(run_dir: Path, asset_id: str) -> Path:
    path = asset_dir_for(run_dir, asset_id) / "extracted.png"
    if not path.exists():
        raise FileNotFoundError(f"Missing extracted asset image: {path}")
    return path


def load_asset_entry(run_dir: Path, asset_id: str) -> AssetEntry:
    path = asset_file_path(run_dir, asset_id)
    if not path.exists():
        raise FileNotFoundError(f"Missing asset metadata: {path}")
    return AssetEntry.model_validate_json(path.read_text())


def load_existing_report(run_dir: Path, asset_id: str) -> AssetComponentReport | None:
    path = asset_dir_for(run_dir, asset_id) / "report.json"
    if not path.exists():
        return None
    return AssetComponentReport.model_validate_json(path.read_text())
