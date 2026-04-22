from __future__ import annotations

from datetime import datetime, timezone
from enum import StrEnum
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class AssetType(StrEnum):
    BACKGROUND = "background"
    FRAME = "frame"
    PANEL = "panel"
    BANNER = "banner"
    SIDE_ELEMENT = "side_element"
    DECORATION = "decoration"
    OVERLAY = "overlay"


class ZOrder(StrEnum):
    BACK = "back"
    MID = "mid"
    FRONT = "front"
    OVERLAY = "overlay"


class Canvas(BaseModel):
    width: int
    height: int
    aspect_ratio: str


class AssetEntry(BaseModel):
    model_config = ConfigDict(extra="allow")

    id: str = Field(pattern=r"^asset_[0-9A-Za-z_-]+$")
    name: str
    type: AssetType
    visual_description: str
    location: str
    bounds: str
    z_order: ZOrder
    extraction_hint: str


class AssetCatalog(BaseModel):
    model_config = ConfigDict(extra="allow")

    image_summary: str
    assets: list[AssetEntry]
    screen_id: str | None = None
    source_image: str | None = None
    canvas: Canvas | None = None

    def assets_by_id(self) -> dict[str, AssetEntry]:
        return {asset.id: asset for asset in self.assets}


class RunManifest(BaseModel):
    run_id: str
    source_image: str
    source_original: str
    canvas: Canvas
    status: Literal[
        "initialized",
        "catalog_requested",
        "cataloged",
        "extraction_requested",
        "extracted",
        "failed",
    ] = "initialized"
    catalog_model: str | None = None
    prompt_model: str | None = None
    image_model: str | None = None
    asset_ids: list[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class CatalogRequest(BaseModel):
    model: str
    source_image: str
    prompt_file: str
    prompt: str


class ExtractionRequest(BaseModel):
    asset_id: str
    model: str
    source_image: str
    output_path: str
    prompt: str
    size: str = "auto"
    quality: str = "high"
    aspect_ratio: str | None = None


class PromptGenerationRequest(BaseModel):
    asset_id: str
    model: str
    source_image: str
    prompt_file: str
    asset: AssetEntry
    prompt: str


class ExtractionResult(BaseModel):
    asset_id: str
    model: str
    output_path: str
    status: Literal["dry_run", "completed", "failed"]
    error: str | None = None
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


def update_manifest(path: Path, **changes: object) -> RunManifest:
    manifest = RunManifest.model_validate_json(path.read_text())
    data = manifest.model_dump()
    data.update(changes)
    data["updated_at"] = datetime.now(timezone.utc)
    updated = RunManifest.model_validate(data)
    path.write_text(updated.model_dump_json(indent=2) + "\n")
    return updated
