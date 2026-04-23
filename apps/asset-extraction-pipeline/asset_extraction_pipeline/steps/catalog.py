from __future__ import annotations

from pathlib import Path

from ..io.logging import RunLogger
from ..model_adapters import catalog_image
from ..prompts.asset_catalog import build_prompt as build_catalog_prompt
from ..schemas import AssetCatalog, CatalogRequest, RunManifest, update_manifest


def catalog_run(
    run_dir: Path,
    model: str,
    dry_run: bool,
    logger: RunLogger | None = None,
) -> AssetCatalog | None:
    run_dir = run_dir.resolve()
    logger = logger or RunLogger(run_dir)
    manifest_path = run_dir / "run.json"
    manifest = RunManifest.model_validate_json(manifest_path.read_text())
    source_image = run_dir / manifest.source_image
    prompt_module = "asset_extraction_pipeline.prompts.asset_catalog"
    prompt = build_catalog_prompt().strip() + "\n"

    logger.update_status(
        run_id=manifest.run_id,
        stage="catalog",
        status="running",
        catalog_model=model,
        source_image=manifest.source_image,
    )
    logger.event(
        "catalog.started",
        "catalog",
        "Cataloging source image",
        model=model,
        dry_run=dry_run,
        source_image=source_image,
    )

    request = CatalogRequest(
        model=model,
        source_image=str(source_image),
        prompt_file=prompt_module,
        prompt=prompt,
    )
    catalog_request_path = run_dir / "catalog-request.json"
    catalog_request_path.write_text(request.model_dump_json(indent=2) + "\n")
    logger.event(
        "catalog.request_written",
        "catalog",
        "Wrote catalog request artifact",
        path=catalog_request_path,
    )
    update_manifest(manifest_path, status="catalog_requested", catalog_model=model)

    if dry_run:
        logger.update_status(stage="catalog", status="dry_run")
        logger.event("catalog.dry_run", "catalog", "Skipped catalog model call")
        return None

    try:
        with logger.span("catalog.model_call", "catalog", "Catalog model call", model=model):
            catalog = catalog_image(source_image, prompt, model)
        catalog.screen_id = manifest.run_id
        catalog.source_image = manifest.source_image
        catalog.canvas = manifest.canvas
        catalog_path = run_dir / "catalog.json"
        catalog_path.write_text(catalog.model_dump_json(indent=2) + "\n")
        logger.event(
            "catalog.written",
            "catalog",
            "Wrote asset catalog",
            path=catalog_path,
            asset_count=len(catalog.assets),
        )

        for asset in catalog.assets:
            asset_dir = run_dir / "assets" / asset.id
            asset_dir.mkdir(parents=True, exist_ok=True)
            (asset_dir / "asset.json").write_text(asset.model_dump_json(indent=2) + "\n")
            logger.event(
                "catalog.asset_written",
                "catalog",
                "Wrote asset metadata",
                asset_id=asset.id,
                path=asset_dir / "asset.json",
                asset_type=asset.type,
            )

        update_manifest(
            manifest_path,
            status="cataloged",
            catalog_model=model,
            asset_ids=[asset.id for asset in catalog.assets],
        )
        logger.update_status(
            stage="catalog",
            status="completed",
            counts={"assets": len(catalog.assets)},
            asset_ids=[asset.id for asset in catalog.assets],
        )
        logger.event(
            "catalog.completed",
            "catalog",
            "Cataloging completed",
            asset_count=len(catalog.assets),
        )
    except Exception as exc:
        update_manifest(manifest_path, status="failed")
        logger.update_status(stage="catalog", status="failed", last_error=str(exc))
        logger.event("catalog.failed", "catalog", "Cataloging failed", level="error", error=str(exc))
        raise
    return catalog


def load_catalog(run_dir: Path) -> AssetCatalog:
    run_dir = run_dir.resolve()
    catalog_path = run_dir / "catalog.json"
    if not catalog_path.exists():
        raise FileNotFoundError(f"Missing catalog: {catalog_path}")
    return AssetCatalog.model_validate_json(catalog_path.read_text())
