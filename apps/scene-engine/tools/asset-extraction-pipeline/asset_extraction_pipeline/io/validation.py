from __future__ import annotations

from pathlib import Path

from ..schemas import (
    AssetCatalog,
    AssetEntry,
    RunManifest,
)


def validate_run(run_dir: Path) -> list[str]:
    errors: list[str] = []

    manifest_path = run_dir / "run.json"
    if not manifest_path.exists():
        return [f"missing {manifest_path}"]

    try:
        manifest = RunManifest.model_validate_json(manifest_path.read_text())
    except Exception as exc:  # noqa: BLE001
        return [f"invalid run.json: {exc}"]

    source_path = run_dir / manifest.source_image
    if not source_path.exists():
        errors.append(f"missing source image: {source_path}")

    catalog_path = run_dir / "catalog.json"
    if catalog_path.exists():
        try:
            catalog = AssetCatalog.model_validate_json(catalog_path.read_text())
        except Exception as exc:  # noqa: BLE001
            errors.append(f"invalid catalog.json: {exc}")
        else:
            for asset in catalog.assets:
                asset_path = run_dir / "assets" / asset.id / "asset.json"
                if not asset_path.exists():
                    errors.append(f"missing asset file: {asset_path}")
                    continue
                try:
                    AssetEntry.model_validate_json(asset_path.read_text())
                except Exception as exc:  # noqa: BLE001
                    errors.append(f"invalid {asset_path}: {exc}")

    return errors
