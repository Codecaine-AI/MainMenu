from __future__ import annotations

from pydantic import BaseModel, Field

from ....schemas import ImageSize, ImplementationMode


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
