from __future__ import annotations

from typing import Any

from .utils import (
    css_declarations,
    escape,
    fmt,
    indent_block,
    media_opacity_attr,
    video_bool_attr,
)
from .recipe import (
    chrome_stack_bounds,
    layer_band_bounds,
    layer_bounds_by_id,
    layer_stroke_width,
)
from .css_gen import interior_media_config
from .svg_path import use_nodes
from .gradients import gradient_stops


def lighting_overlay_layer_svg(
    layer: dict[str, Any],
    width: int,
    height: int,
    overlays: dict[str, str],
) -> str:
    source = layer.get("source")
    href = overlays.get(str(source))
    if not href:
        return ""

    layer_id = escape(layer["id"])
    mask_attr = ""
    clip_attr = ""
    if layer.get("mask") == "chrome_stack":
        mask_attr = ' mask="url(#chrome-stack-mask)"'
    elif layer.get("mask") == "fill":
        clip_attr = ' clip-path="url(#fill-clip)"'
    elif layer.get("mask_ref"):
        mask_attr = f' mask="url(#{escape(layer["mask_ref"])}-band-mask)"'

    blend_attr = (
        f' style="mix-blend-mode:{escape(layer["blend"])}"'
        if layer.get("blend")
        else ""
    )
    return f'''  <g id="{layer_id}" data-layer="{layer_id}"{mask_attr}{clip_attr}{blend_attr}>
    <image href="{href}" x="0" y="0" width="{fmt(width)}" height="{fmt(height)}" preserveAspectRatio="none"/>
  </g>'''


def bevel_ramp_layer_svg(
    layer: dict[str, Any],
    records: list[tuple[dict[str, Any], float]],
    width: int,
    height: int,
    y: float,
) -> str:
    layer_id = escape(layer["id"])
    start = float(layer["start"])
    end = float(layer.get("end", start + float(layer.get("thickness", 0))))
    if end <= start:
        return ""
    pad = float(layer.get("mask_pad", 180))
    canvas_x = -pad
    canvas_y = -pad
    canvas_w = width + pad * 2
    canvas_h = height + pad * 2
    mask_id = f"{layer_id}-mask"
    gradient_id = f"{layer_id}-gradient"
    outer_attrs = (
        f' fill="none" stroke="white" stroke-width="{fmt(2 * end)}"'
        f' stroke-linejoin="round" stroke-linecap="round"'
    )
    inner_attrs = (
        f' fill="black" stroke="black" stroke-width="{fmt(2 * start)}"'
        f' stroke-linejoin="round" stroke-linecap="round"'
    )
    vector = layer.get("gradient_vector", {})
    x1 = float(vector.get("x1", 0))
    y1 = float(vector.get("y1", 1))
    x2 = float(vector.get("x2", 1))
    y2 = float(vector.get("y2", 0))
    if abs(x1) <= 1:
        x1 *= width
    if abs(y1) <= 1:
        y1 *= height
    if abs(x2) <= 1:
        x2 *= width
    if abs(y2) <= 1:
        y2 *= height
    stops = layer.get("stops")
    if stops:
        stop_svg = gradient_stops(stops)
    else:
        stop_svg = gradient_stops(
            [
                {
                    "offset": "0%",
                    "color": layer.get("color_start", "#20272d"),
                    "opacity": layer.get("opacity_start", 1),
                },
                {
                    "offset": "50%",
                    "color": layer.get("color_mid", "#9da7ad"),
                    "opacity": layer.get("opacity_mid", 1),
                },
                {
                    "offset": "100%",
                    "color": layer.get("color_end", "#f8fbff"),
                    "opacity": layer.get("opacity_end", 1),
                },
            ]
        )
    return f'''  <defs>
    <mask id="{mask_id}" maskUnits="userSpaceOnUse" x="{fmt(canvas_x)}" y="{fmt(canvas_y)}" width="{fmt(canvas_w)}" height="{fmt(canvas_h)}">
      <rect x="{fmt(canvas_x)}" y="{fmt(canvas_y)}" width="{fmt(canvas_w)}" height="{fmt(canvas_h)}" fill="black"/>
{use_nodes(records, y, outer_attrs)}
{use_nodes(records, y, inner_attrs)}
    </mask>
    <linearGradient id="{gradient_id}" x1="{fmt(x1)}" y1="{fmt(y1)}" x2="{fmt(x2)}" y2="{fmt(y2)}" gradientUnits="userSpaceOnUse">
      {stop_svg}
    </linearGradient>
  </defs>
  <g id="{layer_id}" data-layer="{layer_id}" mask="url(#{mask_id})">
    <rect x="{fmt(canvas_x)}" y="{fmt(canvas_y)}" width="{fmt(canvas_w)}" height="{fmt(canvas_h)}" fill="url(#{gradient_id})"/>
  </g>'''


def chrome_extrude_layer_svg(
    layer: dict[str, Any],
    records: list[tuple[dict[str, Any], float]],
    width: int,
    height: int,
    y: float,
    recipe: dict[str, Any],
) -> str:
    bounds = chrome_stack_bounds(recipe)
    if not bounds:
        return ""

    layer_id = escape(layer["id"])
    filter_attr = ""
    if layer.get("filter") == "extrusion_soften":
        filter_attr = ' filter="url(#extrusion-soften)"'
    start, end = bounds
    steps = max(1, int(layer.get("steps", 12)))
    step_dx = float(layer.get("step_dx", 0.8))
    step_dy = float(layer.get("step_dy", 1.0))
    start_opacity = float(layer.get("start_opacity", 0.72))
    end_opacity = float(layer.get("end_opacity", 0.18))
    pad = float(layer.get("mask_pad", 180))
    paint = escape(layer.get("paint", "#101418"))
    canvas_x = -pad
    canvas_y = -pad
    canvas_w = width + pad * 2
    canvas_h = height + pad * 2
    outer_attrs = (
        f' fill="none" stroke="white" stroke-width="{fmt(2 * end)}"'
        f' stroke-linejoin="round" stroke-linecap="round"'
    )
    inner_attrs = (
        f' fill="black" stroke="black" stroke-width="{fmt(2 * start)}"'
        f' stroke-linejoin="round" stroke-linecap="round"'
    )
    masks = []
    bodies = []
    for index in range(steps, 0, -1):
        position = (index - 1) / (steps - 1) if steps > 1 else 0
        opacity = start_opacity + (end_opacity - start_opacity) * position
        tx = step_dx * index
        ty = step_dy * index
        mask_id = f"{layer_id}-step-{index}-mask"
        masks.append(
            f'''    <mask id="{mask_id}" maskUnits="userSpaceOnUse" x="{fmt(canvas_x)}" y="{fmt(canvas_y)}" width="{fmt(canvas_w)}" height="{fmt(canvas_h)}">
      <rect x="{fmt(canvas_x)}" y="{fmt(canvas_y)}" width="{fmt(canvas_w)}" height="{fmt(canvas_h)}" fill="black"/>
      <g transform="translate({fmt(tx)} {fmt(ty)})">
{use_nodes(records, y, outer_attrs)}
{use_nodes(records, y, inner_attrs)}
      </g>
    </mask>'''
        )
        bodies.append(
            f'''    <g opacity="{fmt(opacity)}" mask="url(#{mask_id})">
      <rect x="{fmt(canvas_x)}" y="{fmt(canvas_y)}" width="{fmt(canvas_w)}" height="{fmt(canvas_h)}" fill="{paint}"/>
    </g>'''
        )

    return f'''  <defs>
{chr(10).join(masks)}
  </defs>
  <g id="{layer_id}" data-layer="{layer_id}"{filter_attr}>
{chr(10).join(bodies)}
  </g>'''


def projected_shadow_layer_svg(
    layer: dict[str, Any],
    records: list[tuple[dict[str, Any], float]],
    width: int,
    height: int,
    y: float,
    recipe: dict[str, Any],
) -> str:
    caster_ref = layer.get("caster_ref") or layer.get("caster")
    if not caster_ref:
        raise ValueError(
            f"Projected shadow layer {layer.get('id', '<unknown>')} is missing caster_ref."
        )

    caster_bounds = layer_bounds_by_id(recipe, str(caster_ref))
    if caster_bounds is None:
        raise ValueError(
            f"Projected shadow layer {layer.get('id', '<unknown>')} references caster_ref {caster_ref!r}, "
            "but that layer does not exist or has no band bounds."
        )

    layer_id = escape(layer["id"])
    mask_id = f"{layer_id}-projected-mask"
    filter_id = f"{layer_id}-blur"
    start, end = caster_bounds
    dx = float(layer.get("dx", 0))
    dy = float(layer.get("dy", 0))
    blur = max(0.0, float(layer.get("blur", 0)))
    pad = float(layer.get("mask_pad", recipe.get("lighting", {}).get("mask_pad", 180)))
    paint = escape(layer.get("paint", "#020304"))
    canvas_x = -pad
    canvas_y = -pad
    canvas_w = width + pad * 2
    canvas_h = height + pad * 2
    outer_attrs = (
        f' fill="none" stroke="white" stroke-width="{fmt(2 * end)}"'
        f' stroke-linejoin="round" stroke-linecap="round"'
    )
    inner_attrs = (
        f' fill="black" stroke="black" stroke-width="{fmt(2 * start)}"'
        f' stroke-linejoin="round" stroke-linecap="round"'
    )
    fill_attrs = ' fill="black"'
    receiver = layer.get("receiver", "fill")
    if receiver == "fill":
        receiver_attr = ' clip-path="url(#fill-clip)"'
    elif receiver == "chrome_stack":
        receiver_attr = ' mask="url(#chrome-stack-mask)"'
    else:
        receiver_attr = ""
    blend_attr = (
        f' style="mix-blend-mode:{escape(layer["blend"])}"'
        if layer.get("blend")
        else ""
    )

    return f'''  <defs>
    <filter id="{filter_id}" filterUnits="userSpaceOnUse" x="{fmt(canvas_x)}" y="{fmt(canvas_y)}" width="{fmt(canvas_w)}" height="{fmt(canvas_h)}" color-interpolation-filters="sRGB">
      <feGaussianBlur in="SourceGraphic" stdDeviation="{fmt(blur)}" data-projected-shadow-blur="{layer_id}"/>
    </filter>
    <mask id="{mask_id}" maskUnits="userSpaceOnUse" x="{fmt(canvas_x)}" y="{fmt(canvas_y)}" width="{fmt(canvas_w)}" height="{fmt(canvas_h)}">
      <rect x="{fmt(canvas_x)}" y="{fmt(canvas_y)}" width="{fmt(canvas_w)}" height="{fmt(canvas_h)}" fill="black"/>
      <g transform="translate({fmt(dx)} {fmt(dy)})" data-projected-shadow-transform="{layer_id}">
{use_nodes(records, y, outer_attrs)}
{use_nodes(records, y, inner_attrs)}
{use_nodes(records, y, fill_attrs)}
      </g>
    </mask>
  </defs>
  <g id="{layer_id}" data-layer="{layer_id}"{receiver_attr}{blend_attr} filter="url(#{filter_id})">
    <rect x="{fmt(canvas_x)}" y="{fmt(canvas_y)}" width="{fmt(canvas_w)}" height="{fmt(canvas_h)}" fill="{paint}" mask="url(#{mask_id})"/>
  </g>'''


def media_surface_svg(
    layer_id: str, media: dict[str, Any], width: float, height: float
) -> str:
    mode = str(media.get("mode", "")).lower()
    if mode == "image":
        href = media.get("href") or media.get("src")
        if not href:
            return ""
        preserve = media.get("preserve_aspect_ratio", "xMidYMid slice")
        return f'    <image href="{escape(href)}" x="0" y="0" width="{fmt(width)}" height="{fmt(height)}" preserveAspectRatio="{escape(preserve)}"{media_opacity_attr(media)}/>'

    if mode in {"css", "css-animation", "animation"}:
        shell_style = "width:100%; height:100%; overflow:hidden"
        declarations = css_declarations(media.get("css"))
        if declarations:
            shell_style += "; " + declarations
        if "opacity" in media:
            shell_style += f"; opacity:{media['opacity']}"
        return f'''    <foreignObject x="0" y="0" width="{fmt(width)}" height="{fmt(height)}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="melee-layer-media-shell melee-fill-media-shell" style="{escape(shell_style)}"></div>
    </foreignObject>'''

    if mode == "video":
        src = media.get("src")
        if not src and not media.get("sources"):
            return ""
        sources = media.get("sources", [])
        poster = f' poster="{escape(media["poster"])}"' if media.get("poster") else ""
        fit = escape(media.get("fit", "cover"))
        video_style = f"width:100%; height:100%; display:block; object-fit:{fit}"
        if "opacity" in media:
            video_style += f"; opacity:{media['opacity']}"
        hue = float(media.get("hue", 0))
        if hue != 0:
            video_style += f"; filter:hue-rotate({hue}deg)"
        attrs = [
            f'style="{escape(video_style)}"',
            'preload="auto"',
            poster,
            video_bool_attr(media, "autoplay", "autoplay", True),
            video_bool_attr(media, "muted", "muted", True),
            video_bool_attr(media, "loop", "loop", True),
            video_bool_attr(media, "playsinline", "playsinline", True),
            video_bool_attr(media, "controls", "controls", False),
        ]
        if src:
            attrs.insert(0, f'src="{escape(src)}"')
        source_nodes = ""
        if isinstance(sources, list):
            source_nodes = "\n".join(
                f'        <source src="{escape(source.get("src", ""))}" type="{escape(source.get("type", ""))}"></source>'
                for source in sources
                if isinstance(source, dict) and source.get("src")
            )

        repeat_x = max(1, int(media.get("repeat_x", 1)))
        repeat_y = max(1, int(media.get("repeat_y", 1)))
        scale = max(0.1, float(media.get("scale", 1)))
        pos_x = float(media.get("position_x", 0))
        pos_y = float(media.get("position_y", 0))
        rotation = float(media.get("rotation", 0))

        shell_style = "width:100%; height:100%; overflow:hidden"
        if repeat_x > 1 or repeat_y > 1:
            shell_style += f"; display:grid; grid-template-columns:repeat({repeat_x}, 1fr); grid-template-rows:repeat({repeat_y}, 1fr)"
        has_transform = scale != 1 or pos_x != 0 or pos_y != 0 or rotation != 0
        if has_transform:
            shell_style += f"; transform:translate({pos_x}%, {pos_y}%) scale({scale}) rotate({rotation}deg); transform-origin:center center"

        video_tag = f"<video {' '.join(part for part in attrs if part)}>\n{source_nodes}\n        </video>"
        total = repeat_x * repeat_y
        video_nodes = "\n".join(f"        {video_tag}" for _ in range(total))

        return f'''    <foreignObject x="0" y="0" width="{fmt(width)}" height="{fmt(height)}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="melee-layer-media-shell melee-fill-media-shell" style="{escape(shell_style)}">
{video_nodes}
      </div>
    </foreignObject>'''

    return ""


def fill_layer_svg(
    layer: dict[str, Any], width: int, height: int, recipe: dict[str, Any]
) -> str:
    layer_id = escape(layer["id"])
    paint = escape(layer.get("paint", "url(#red-fill-gradient)"))
    media = interior_media_config(layer, recipe)
    blend_attr = (
        f' style="mix-blend-mode:{escape(layer["blend"])}"'
        if layer.get("blend")
        else ""
    )
    fallback_rect = f'    <rect width="{width}" height="{height}" fill="{paint}"/>'
    media_body = media_surface_svg(layer_id, media, width, height) if media else ""
    if media_body:
        hidden_fallback = f'    <rect class="melee-layer-paint-fallback" style="display:none" width="{width}" height="{height}" fill="{paint}"/>'
        return (
            f'  <g id="{layer_id}" data-layer="{layer_id}" clip-path="url(#fill-clip)"{blend_attr}>\n'
            f"{hidden_fallback}\n"
            f"{media_body}\n"
            f"  </g>"
        )

    return (
        f'  <g id="{layer_id}" data-layer="{layer_id}" clip-path="url(#fill-clip)"{blend_attr}>\n'
        f"{fallback_rect}\n"
        f"  </g>"
    )


def layer_svg(
    layer: dict[str, Any],
    records: list[tuple[dict[str, Any], float]],
    width: int,
    height: int,
    y: float,
    recipe: dict[str, Any],
    overlays: dict[str, str] | None = None,
) -> str:
    layer_id = escape(layer["id"])
    layer_type = layer["type"]
    if layer_type == "chrome-extrude":
        return chrome_extrude_layer_svg(layer, records, width, height, y, recipe)
    if layer_type == "bevel-ramp":
        return bevel_ramp_layer_svg(layer, records, width, height, y)
    if layer_type == "projected-shadow":
        return projected_shadow_layer_svg(layer, records, width, height, y, recipe)
    if layer_type == "lighting-overlay":
        return lighting_overlay_layer_svg(layer, width, height, overlays or {})

    filter_name = layer.get("filter")
    filter_attr = ""
    if filter_name == "chrome_bevel":
        filter_attr = ' filter="url(#chrome-bevel)"'
    elif filter_name == "chrome_lip_bevel":
        filter_attr = ' filter="url(#chrome-lip-bevel)"'
    elif filter_name == "contact_soften":
        filter_attr = ' filter="url(#contact-soften)"'
    elif filter_name == "extrusion_soften":
        filter_attr = ' filter="url(#extrusion-soften)"'
    if layer.get("mask_ref"):
        mask_attr = f' mask="url(#{escape(layer["mask_ref"])}-band-mask)"'
    elif layer.get("mask") == "chrome_stack":
        mask_attr = ' mask="url(#chrome-stack-mask)"'
    elif layer.get("mask") == "outside_fill" and (
        "start" in layer or "thickness" in layer
    ):
        mask_attr = f' mask="url(#{layer_id}-band-mask)"'
    elif layer.get("mask") == "outside_fill":
        mask_attr = ' mask="url(#outside-fill-mask)"'
    else:
        mask_attr = ""
    clip_attr = ' clip-path="url(#fill-clip)"' if layer.get("clip") == "fill" else ""
    blend_attr = ""
    if layer.get("blend"):
        blend_attr = f' style="mix-blend-mode:{escape(layer["blend"])}"'

    if layer_type == "stroke":
        media = interior_media_config(layer, recipe)
        media_body = (
            media_surface_svg(layer_id, media, width, height) if media else ""
        )
        if media_body:
            media_mask_id = f"{layer_id}-media-mask"
            attrs = (
                f' fill="none" stroke="white" stroke-width="{fmt(layer_stroke_width(layer))}"'
                f' stroke-linejoin="round" stroke-linecap="round"'
            )
            fallback_attrs = ' class="melee-layer-paint-fallback" style="display:none" fill="none" stroke-linejoin="round" stroke-linecap="round"'
            media_uses = use_nodes(records, y, attrs)
            fallback_uses = use_nodes(records, y, fallback_attrs)
            return f'''  <defs>
    <mask id="{media_mask_id}" maskUnits="userSpaceOnUse" x="0" y="0" width="{fmt(width)}" height="{fmt(height)}">
      <rect x="0" y="0" width="{fmt(width)}" height="{fmt(height)}" fill="black"/>
{media_uses}
    </mask>
  </defs>
  <g id="{layer_id}" data-layer="{layer_id}"{filter_attr}{mask_attr}{clip_attr}{blend_attr}>
{fallback_uses}
    <g mask="url(#{media_mask_id})">
{indent_block(media_body, 6)}
    </g>
  </g>'''

        attrs = ' fill="none" stroke-linejoin="round" stroke-linecap="round"'
        uses = use_nodes(records, y, attrs)
        if filter_attr and (mask_attr or clip_attr):
            return (
                f'  <g id="{layer_id}" data-layer="{layer_id}"{filter_attr}{blend_attr}>\n'
                f"    <g{mask_attr}{clip_attr}>\n"
                f"{indent_block(uses, 6)}\n"
                f"    </g>\n"
                f"  </g>"
            )
        return f'  <g id="{layer_id}" data-layer="{layer_id}"{filter_attr}{mask_attr}{clip_attr}{blend_attr}>\n{uses}\n  </g>'
    if layer_type == "fill":
        return fill_layer_svg(layer, width, height, recipe)
    if layer_type == "rect-fill":
        rect_height = height * float(layer.get("height_ratio", 1))
        clip_attr = (
            ""
            if layer.get("mask") == "chrome_stack" or layer.get("mask_ref")
            else ' clip-path="url(#fill-clip)"'
        )
        media = interior_media_config(layer, recipe)
        media_body = (
            media_surface_svg(layer_id, media, width, rect_height) if media else ""
        )
        if media_body:
            hidden_fallback = (
                f'    <rect class="melee-layer-paint-fallback" style="display:none" '
                f'width="{width}" height="{fmt(rect_height)}" '
                f'fill="{escape(layer.get("paint", "url(#red-gloss-gradient)"))}"/>'
            )
            return (
                f'  <g id="{layer_id}" data-layer="{layer_id}"'
                f"{filter_attr}{mask_attr}{clip_attr}{blend_attr}>\n"
                f"{hidden_fallback}\n"
                f"{media_body}\n"
                f"  </g>"
            )
        return (
            f'  <g id="{layer_id}" data-layer="{layer_id}"'
            f"{filter_attr}{mask_attr}{clip_attr}{blend_attr}>\n"
            f'    <rect width="{width}" height="{fmt(rect_height)}" '
            f'fill="{escape(layer.get("paint", "url(#red-gloss-gradient)"))}"/>\n'
            f"  </g>"
        )
    raise ValueError(f"Unsupported layer type: {layer_type}")
