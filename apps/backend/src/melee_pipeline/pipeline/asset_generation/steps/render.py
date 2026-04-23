from __future__ import annotations

import math
from pathlib import Path

from PIL import Image
from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import sync_playwright

from ....io.logging import RunLogger
from ....schemas import ComponentRenderResult, ImageSize
from .common import asset_dir_for, iteration_step_dir, reference_image_path, resolve_iteration, relative_to_asset


def render_component(
    run_dir: Path,
    asset_id: str,
    browser: str = "chromium",
    iteration: int | None = None,
    settle_ms: int = 350,
    logger: RunLogger | None = None,
) -> ComponentRenderResult:
    run_dir = run_dir.resolve()
    logger = logger or RunLogger(run_dir)
    asset_dir = asset_dir_for(run_dir, asset_id)
    resolved_iteration = resolve_iteration(run_dir, asset_id, iteration)
    generation_dir = iteration_step_dir(run_dir, asset_id, resolved_iteration, "generation")
    render_dir = iteration_step_dir(run_dir, asset_id, resolved_iteration, "render")
    reference_image = reference_image_path(run_dir, asset_id)
    component_html = generation_dir / "component.html"
    component_css = generation_dir / "component.css"
    if not component_html.exists():
        raise FileNotFoundError(f"Missing component HTML: {component_html}")
    if not component_css.exists():
        raise FileNotFoundError(f"Missing component CSS: {component_css}")

    wrapper_path = render_dir / "wrapper.html"
    render_path = render_dir / "render.png"
    wrapper_path.write_text(build_render_wrapper(component_html.read_text(), component_css.read_text()))

    with Image.open(reference_image) as image:
        width, height = image.size
    viewport_width = max(width + 160, 900)
    viewport_height = max(height + 200, 700)

    with logger.span(
        "asset_render.browser",
        "asset_generation",
        "Render component in browser",
        asset_id=asset_id,
        browser=browser,
    ):
        render_with_playwright(
            wrapper_path=wrapper_path,
            render_path=render_path,
            browser=browser,
            viewport_width=viewport_width,
            viewport_height=viewport_height,
            settle_ms=settle_ms,
        )

    with Image.open(render_path) as render:
        render_result = ComponentRenderResult(
            asset_id=asset_id,
            browser=browser,
            wrapper_path=relative_to_asset(asset_dir, wrapper_path),
            render_path=relative_to_asset(asset_dir, render_path),
            image_size=ImageSize(width=render.width, height=render.height),
        )
    (render_dir / "result.json").write_text(render_result.model_dump_json(indent=2) + "\n")
    logger.event(
        "asset_render.completed",
        "asset_generation",
        "Rendered component screenshot",
        asset_id=asset_id,
        path=render_path,
        width=render_result.image_size.width,
        height=render_result.image_size.height,
        browser=browser,
        iteration=resolved_iteration,
    )
    return render_result


def build_render_wrapper(component_markup: str, component_css: str) -> str:
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    {component_css}

    html, body {{
      margin: 0;
      padding: 0;
      background: transparent;
      width: max-content;
      height: max-content;
    }}

    body {{
      display: inline-block;
    }}

    #asset-root {{
      position: relative;
      display: inline-block;
      isolation: isolate;
    }}
  </style>
</head>
<body>
  <div id="asset-root">
{component_markup}
  </div>
</body>
</html>
"""


def render_with_playwright(
    *,
    wrapper_path: Path,
    render_path: Path,
    browser: str,
    viewport_width: int,
    viewport_height: int,
    settle_ms: int,
) -> None:
    if browser not in {"chromium", "firefox", "webkit"}:
        raise ValueError(f"Unsupported browser renderer: {browser}")

    try:
        with sync_playwright() as playwright:
            browser_type = getattr(playwright, browser)
            launched = browser_type.launch(headless=True)
            try:
                context = launched.new_context(
                    viewport={"width": viewport_width, "height": viewport_height},
                    device_scale_factor=1,
                )
                page = context.new_page()
                page.goto(wrapper_path.resolve().as_uri(), wait_until="load")
                page.wait_for_timeout(max(settle_ms, 0))
                page.wait_for_function(
                    """
                    () => !document.fonts || document.fonts.status === "loaded"
                    """,
                    timeout=5_000,
                )
                locator = page.locator("#asset-root")
                locator.wait_for(state="visible", timeout=5_000)
                box = locator.bounding_box()
                if box is None:
                    raise RuntimeError("Failed to measure rendered asset bounds.")
                page.screenshot(
                    path=str(render_path),
                    omit_background=True,
                    clip={
                        "x": max(math.floor(box["x"]), 0),
                        "y": max(math.floor(box["y"]), 0),
                        "width": max(math.ceil(box["width"]), 1),
                        "height": max(math.ceil(box["height"]), 1),
                    },
                )
            finally:
                launched.close()
    except PlaywrightError as exc:
        raise RuntimeError(
            "Failed to launch Playwright browser. Run `./.venv/bin/playwright install chromium` "
            "in apps/backend to install the renderer binary."
        ) from exc
