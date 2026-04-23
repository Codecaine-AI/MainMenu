from __future__ import annotations

from pydantic import BaseModel, Field

from ....schemas import ImplementationMode


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
