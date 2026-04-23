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


class ImplementationMode(StrEnum):
    PURE_CSS = "pure_css"
    CSS_SVG_HYBRID = "css_svg_hybrid"
    RASTER_BACKED = "raster_backed"
    VIDEO_BACKGROUND = "video_background"


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
    target_size: ImageSize
    resolved_image_size: str | None = None


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
    raw_output_path: str | None = None
    raw_size: ImageSize | None = None
    normalized_size: ImageSize | None = None
    target_size: ImageSize | None = None
    aspect_ratio: str | None = None
    resolved_image_size: str | None = None
    completed_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))


class ComponentGenerationRequest(BaseModel):
    asset_id: str
    model: str
    prompt_file: str
    reference_image: str
    target_size: ImageSize | None = None
    output_html: str = "component.html"
    output_css: str = "component.css"
    implementation_mode: ImplementationMode = ImplementationMode.CSS_SVG_HYBRID
    iteration: int = 1
    prompt: str


class ComponentGenerationResult(BaseModel):
    implementation_mode: ImplementationMode = ImplementationMode.CSS_SVG_HYBRID
    html: str
    css: str
    notes: list[str] = Field(default_factory=list)
    raster_dependencies: list[str] = Field(default_factory=list)


class ComponentIssue(BaseModel):
    category: str = Field(min_length=1)
    severity: str = Field(min_length=1)
    summary: str
    region: str | None = None
    evidence: str | None = None
    suggested_fix: str | None = None


class AssetComponentReport(BaseModel):
    asset_id: str
    iteration: int = 1
    implementation_mode: ImplementationMode = ImplementationMode.CSS_SVG_HYBRID
    component_html: str = "component.html"
    component_css: str = "component.css"
    reference_image: str = "extracted.png"
    render: str = "render.png"
    score: float = Field(ge=0.0, le=1.0)
    threshold: float = Field(ge=0.0, le=1.0)
    accepted: bool
    notes: list[str] = Field(default_factory=list)
    raster_dependencies: list[str] = Field(default_factory=list)
    issues: list[ComponentIssue] = Field(default_factory=list)


class ComponentCritiqueRequest(BaseModel):
    asset_id: str
    model: str
    prompt_file: str
    reference_image: str
    render_image: str
    iteration: int = 1
    prompt: str


class ImageSize(BaseModel):
    width: int
    height: int


class ComponentRenderResult(BaseModel):
    asset_id: str
    browser: str = "safari"
    wrapper_path: str = "_render-wrapper.html"
    render_path: str = "render.png"
    image_size: ImageSize


def update_manifest(path: Path, **changes: object) -> RunManifest:
    manifest = RunManifest.model_validate_json(path.read_text())
    data = manifest.model_dump()
    data.update(changes)
    data["updated_at"] = datetime.now(timezone.utc)
    updated = RunManifest.model_validate(data)
    path.write_text(updated.model_dump_json(indent=2) + "\n")
    return updated
