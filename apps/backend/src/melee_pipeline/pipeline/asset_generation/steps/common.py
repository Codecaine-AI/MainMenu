from __future__ import annotations

from pathlib import Path

from ....schemas import AssetComponentReport, AssetEntry


def asset_dir_for(run_dir: Path, asset_id: str) -> Path:
    path = run_dir.resolve() / "assets" / asset_id
    if not path.exists():
        raise FileNotFoundError(f"Missing asset directory: {path}")
    return path


def asset_file_path(run_dir: Path, asset_id: str) -> Path:
    return asset_dir_for(run_dir, asset_id) / "asset.json"


def reference_image_path(run_dir: Path, asset_id: str) -> Path:
    asset_dir = asset_dir_for(run_dir, asset_id)
    structured = asset_dir / "extraction" / "image_extraction" / "extracted.png"
    if structured.exists():
        return structured
    legacy = asset_dir / "extracted.png"
    if legacy.exists():
        return legacy
    raise FileNotFoundError(f"Missing extracted asset image: {structured}")


def load_asset_entry(run_dir: Path, asset_id: str) -> AssetEntry:
    path = asset_file_path(run_dir, asset_id)
    if not path.exists():
        raise FileNotFoundError(f"Missing asset metadata: {path}")
    return AssetEntry.model_validate_json(path.read_text())


def load_existing_report(run_dir: Path, asset_id: str) -> AssetComponentReport | None:
    asset_dir = asset_dir_for(run_dir, asset_id)
    latest = latest_iteration_dir(run_dir, asset_id)
    if latest is not None:
        path = latest / "critique" / "report.json"
        if path.exists():
            return AssetComponentReport.model_validate_json(path.read_text())
    legacy = asset_dir / "report.json"
    if legacy.exists():
        return AssetComponentReport.model_validate_json(legacy.read_text())
    return None


def extraction_phase_dir(run_dir: Path, asset_id: str) -> Path:
    return asset_dir_for(run_dir, asset_id) / "extraction"


def extraction_step_dir(run_dir: Path, asset_id: str, step: str) -> Path:
    path = extraction_phase_dir(run_dir, asset_id) / step
    path.mkdir(parents=True, exist_ok=True)
    return path


def asset_generation_phase_dir(run_dir: Path, asset_id: str) -> Path:
    path = asset_dir_for(run_dir, asset_id) / "asset_generation"
    path.mkdir(parents=True, exist_ok=True)
    return path


def iteration_dir(run_dir: Path, asset_id: str, iteration: int) -> Path:
    path = asset_generation_phase_dir(run_dir, asset_id) / f"iteration_{iteration:02d}"
    path.mkdir(parents=True, exist_ok=True)
    return path


def iteration_step_dir(run_dir: Path, asset_id: str, iteration: int, step: str) -> Path:
    path = iteration_dir(run_dir, asset_id, iteration) / step
    path.mkdir(parents=True, exist_ok=True)
    return path


def latest_iteration_dir(run_dir: Path, asset_id: str) -> Path | None:
    root = asset_generation_phase_dir(run_dir, asset_id)
    candidates = sorted(
        path
        for path in root.iterdir()
        if path.is_dir() and path.name.startswith("iteration_")
    )
    return candidates[-1] if candidates else None


def resolve_iteration(run_dir: Path, asset_id: str, iteration: int | None) -> int:
    if iteration is not None:
        return iteration
    latest = latest_iteration_dir(run_dir, asset_id)
    if latest is None:
        raise FileNotFoundError(
            f"No asset_generation iterations found for asset {asset_id}. Provide --iteration."
        )
    return int(latest.name.removeprefix("iteration_"))


def relative_to_asset(asset_dir: Path, path: Path) -> str:
    return str(path.resolve().relative_to(asset_dir.resolve()))
