from __future__ import annotations

from pydantic import BaseModel

from ....schemas import ImageSize


class ComponentRenderResult(BaseModel):
    asset_id: str
    browser: str = "safari"
    wrapper_path: str = "_render-wrapper.html"
    render_path: str = "render.png"
    image_size: ImageSize
