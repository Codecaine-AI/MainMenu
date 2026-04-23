from __future__ import annotations

from pathlib import Path

from ..schemas import (
    AssetCatalog,
    AssetComponentReport,
    AssetEntry,
    ComponentGenerationResult,
    ComponentRenderResult,
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

                report_path = run_dir / "assets" / asset.id / "asset_generation"
                if report_path.exists():
                    for iteration_dir in sorted(path for path in report_path.iterdir() if path.is_dir()):
                        critique_report = iteration_dir / "critique" / "report.json"
                        if critique_report.exists():
                            try:
                                AssetComponentReport.model_validate_json(
                                    critique_report.read_text()
                                )
                            except Exception as exc:  # noqa: BLE001
                                errors.append(f"invalid {critique_report}: {exc}")

                legacy_report_path = run_dir / "assets" / asset.id / "report.json"
                if legacy_report_path.exists():
                    try:
                        AssetComponentReport.model_validate_json(legacy_report_path.read_text())
                    except Exception as exc:  # noqa: BLE001
                        errors.append(f"invalid {legacy_report_path}: {exc}")

                generation_root = run_dir / "assets" / asset.id / "asset_generation"
                if generation_root.exists():
                    for iteration_dir in sorted(path for path in generation_root.iterdir() if path.is_dir()):
                        generation_result_path = iteration_dir / "generation" / "result.json"
                        if generation_result_path.exists():
                            try:
                                ComponentGenerationResult.model_validate_json(
                                    generation_result_path.read_text()
                                )
                            except Exception as exc:  # noqa: BLE001
                                errors.append(f"invalid {generation_result_path}: {exc}")

                        render_result_path = iteration_dir / "render" / "result.json"
                        if render_result_path.exists():
                            try:
                                ComponentRenderResult.model_validate_json(
                                    render_result_path.read_text()
                                )
                            except Exception as exc:  # noqa: BLE001
                                errors.append(f"invalid {render_result_path}: {exc}")

    return errors
