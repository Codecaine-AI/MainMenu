from __future__ import annotations

from pathlib import Path

from ..io.paths import prompt_path
from ..model_adapters import catalog_image
from ..prompting import read_prompt
from ..schemas import AssetCatalog, CatalogRequest, RunManifest, update_manifest


def catalog_run(run_dir: Path, model: str, dry_run: bool) -> AssetCatalog | None:
    run_dir = run_dir.resolve()
    manifest_path = run_dir / "run.json"
    manifest = RunManifest.model_validate_json(manifest_path.read_text())
    source_image = run_dir / manifest.source_image
    prompt_file = prompt_path("asset-catalog.md")
    prompt = read_prompt(prompt_file)

    request = CatalogRequest(
        model=model,
        source_image=str(source_image),
        prompt_file=str(prompt_file),
        prompt=prompt,
    )
    (run_dir / "catalog-request.json").write_text(request.model_dump_json(indent=2) + "\n")
    update_manifest(manifest_path, status="catalog_requested", catalog_model=model)

    if dry_run:
        return None

    catalog = catalog_image(source_image, prompt, model)
    catalog.screen_id = manifest.run_id
    catalog.source_image = manifest.source_image
    catalog.canvas = manifest.canvas
    (run_dir / "catalog.json").write_text(catalog.model_dump_json(indent=2) + "\n")

    for asset in catalog.assets:
        asset_dir = run_dir / "assets" / asset.id
        asset_dir.mkdir(parents=True, exist_ok=True)
        (asset_dir / "asset.json").write_text(asset.model_dump_json(indent=2) + "\n")

    update_manifest(
        manifest_path,
        status="cataloged",
        catalog_model=model,
        asset_ids=[asset.id for asset in catalog.assets],
    )
    return catalog


def load_catalog(run_dir: Path) -> AssetCatalog:
    run_dir = run_dir.resolve()
    catalog_path = run_dir / "catalog.json"
    if not catalog_path.exists():
        raise FileNotFoundError(f"Missing catalog: {catalog_path}")
    return AssetCatalog.model_validate_json(catalog_path.read_text())
