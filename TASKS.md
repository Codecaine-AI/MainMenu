The red fill should become an interior media surface. The glyph shape stays the mask. The chrome, bevels, shadows, highlights, enamel gloss, and final edge cuts stay exactly where they are.

Architecturally:

existing glyph path
  ↓
fill-clip mask
  ↓
interior media surface
  ↓
red enamel shadows/gloss
  ↓
chrome shadows/highlights/final cuts

So the font is no longer “red fill with effects.” It becomes a chrome-relief shell revealing an animated interior substrate.

Core change

Add a root-level interior_media config to layer-recipe.json. Leave fill-layer as the fallback paint.

"interior_media": {
  "enabled": true,
  "mode": "css-animation",
  "opacity": 1,
  "fit": "cover",
  "css": {
    "background": "radial-gradient(circle at 24% 18%, rgba(255,255,255,.72) 0 3%, transparent 11%), radial-gradient(circle at 72% 64%, rgba(255,0,0,.55) 0 9%, transparent 26%), linear-gradient(125deg, #2a0000, #d21414 34%, #050000 58%, #b40000 78%, #4d0000)",
    "background-size": "180% 180%",
    "animation": "melee-fill-pan 9s ease-in-out infinite alternate"
  },
  "keyframes": "@keyframes melee-fill-pan { 0% { background-position: 0% 18%; filter: saturate(1.05) contrast(1.08); } 100% { background-position: 100% 82%; filter: saturate(1.32) contrast(1.18); } }"
}

Place it near the top of the recipe, next to background, css_scope, chrome_stack, etc.

Your existing fill-layer can remain:

{
  "id": "fill-layer",
  "type": "fill",
  "paint": "url(#red-fill-gradient)",
  "opacity": 1,
  "visible": true
}

That red gradient becomes the fallback underneath the media.

⸻

Video mode

Swap interior_media to this:

"interior_media": {
  "enabled": true,
  "mode": "video",
  "src": "/media/interior-loop.mp4",
  "poster": "/media/interior-poster.jpg",
  "opacity": 1,
  "fit": "cover",
  "autoplay": true,
  "muted": true,
  "loop": true,
  "playsinline": true
}

Because the app injects the SVG inline with mount.innerHTML = text, the generated SVG can contain a foreignObject with XHTML <video>. This is the correct path for browser/app rendering.

For static PNG export, ordinary SVG rasterizers may ignore the video/foreignObject and show only the fallback red fill. For animated export, render through the browser/headless-browser path.

⸻

Image texture mode

"interior_media": {
  "enabled": true,
  "mode": "image",
  "href": "/media/brushed-metal-red.jpg",
  "opacity": 1,
  "preserve_aspect_ratio": "xMidYMid slice"
}

This is the most portable non-video mode.

⸻

Patch render_recipe.py

Add these helpers above layer_svg:

def css_declarations(style: Any) -> str:
    if not style:
        return ""
    if isinstance(style, str):
        return style.strip().rstrip(";")
    if isinstance(style, dict):
        declarations = []
        for key, value in style.items():
            if value is None:
                continue
            declarations.append(f"{key}: {value}")
        return "; ".join(declarations)
    return ""
def interior_media_config(layer: dict[str, Any], recipe: dict[str, Any]) -> dict[str, Any] | None:
    media = recipe.get("interior_media")
    if not isinstance(media, dict):
        media = layer.get("media")
    if not isinstance(media, dict):
        return None
    if media.get("enabled") is False:
        return None
    mode = str(media.get("mode", "paint")).lower()
    if mode in {"paint", "gradient", "none", "off"}:
        return None
    return media
def media_opacity_attr(media: dict[str, Any]) -> str:
    if "opacity" not in media:
        return ""
    return f' opacity="{escape(media["opacity"])}"'
def video_bool_attr(media: dict[str, Any], key: str, attr: str, default: bool = True) -> str:
    if bool(media.get(key, default)):
        return f' {attr}="{attr}"'
    return ""
def fill_layer_svg(layer: dict[str, Any], width: int, height: int, recipe: dict[str, Any]) -> str:
    layer_id = escape(layer["id"])
    paint = escape(layer.get("paint", "url(#red-fill-gradient)"))
    media = interior_media_config(layer, recipe)
    blend_attr = f' style="mix-blend-mode:{escape(layer["blend"])}"' if layer.get("blend") else ""
    fallback_rect = f'    <rect width="{width}" height="{height}" fill="{paint}"/>'
    if not media:
        return (
            f'  <g id="{layer_id}" data-layer="{layer_id}" clip-path="url(#fill-clip)"{blend_attr}>\n'
            f'{fallback_rect}\n'
            f'  </g>'
        )
    mode = str(media.get("mode", "")).lower()
    if mode == "image":
        href = media.get("href") or media.get("src")
        if not href:
            return (
                f'  <g id="{layer_id}" data-layer="{layer_id}" clip-path="url(#fill-clip)"{blend_attr}>\n'
                f'{fallback_rect}\n'
                f'  </g>'
            )
        preserve = media.get("preserve_aspect_ratio", "xMidYMid slice")
        return f'''  <g id="{layer_id}" data-layer="{layer_id}" clip-path="url(#fill-clip)"{blend_attr}>
{fallback_rect}
    <image href="{escape(href)}" x="0" y="0" width="{fmt(width)}" height="{fmt(height)}" preserveAspectRatio="{escape(preserve)}"{media_opacity_attr(media)}/>
  </g>'''
    if mode in {"css", "css-animation", "animation"}:
        shell_style = "width:100%; height:100%; overflow:hidden"
        declarations = css_declarations(media.get("css"))
        if declarations:
            shell_style += "; " + declarations
        if "opacity" in media:
            shell_style += f"; opacity:{media['opacity']}"
        return f'''  <g id="{layer_id}" data-layer="{layer_id}" clip-path="url(#fill-clip)"{blend_attr}>
{fallback_rect}
    <foreignObject x="0" y="0" width="{fmt(width)}" height="{fmt(height)}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="melee-fill-media-shell" style="{escape(shell_style)}"></div>
    </foreignObject>
  </g>'''
    if mode == "video":
        src = media.get("src")
        sources = media.get("sources", [])
        poster = f' poster="{escape(media["poster"])}"' if media.get("poster") else ""
        fit = escape(media.get("fit", "cover"))
        video_style = f"width:100%; height:100%; display:block; object-fit:{fit}"
        if "opacity" in media:
            video_style += f"; opacity:{media['opacity']}"
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
        return f'''  <g id="{layer_id}" data-layer="{layer_id}" clip-path="url(#fill-clip)"{blend_attr}>
{fallback_rect}
    <foreignObject x="0" y="0" width="{fmt(width)}" height="{fmt(height)}">
      <div xmlns="http://www.w3.org/1999/xhtml" class="melee-fill-media-shell" style="width:100%; height:100%; overflow:hidden">
        <video {' '.join(part for part in attrs if part)}>
{source_nodes}
        </video>
      </div>
    </foreignObject>
  </g>'''
    return (
        f'  <g id="{layer_id}" data-layer="{layer_id}" clip-path="url(#fill-clip)"{blend_attr}>\n'
        f'{fallback_rect}\n'
        f'  </g>'
    )

Then change the existing fill branch inside layer_svg.

Replace this:

if layer_type == "fill":
    return f'  <g id="{layer_id}" data-layer="{layer_id}" clip-path="url(#fill-clip)">\n    <rect width="{width}" height="{height}" fill="{escape(layer.get("paint", "url(#red-fill-gradient)"))}"/>\n  </g>'

With this:

if layer_type == "fill":
    return fill_layer_svg(layer, width, height, recipe)

Then add keyframe injection to recipe_css.

Inside recipe_css, before return "\n      ".join(lines), add:

    interior_media = recipe.get("interior_media")
    if isinstance(interior_media, dict) and interior_media.get("enabled") is not False:
        keyframes = interior_media.get("keyframes")
        if keyframes:
            lines.append("")
            lines.append(str(keyframes))

That gives the generated SVG the CSS animation definition.

⸻

Result

The generated fill layer becomes:

<g id="fill-layer" clip-path="url(#fill-clip)">
  <rect fill="url(#red-fill-gradient)"/>
  <foreignObject>
    <div class="melee-fill-media-shell">...</div>
  </foreignObject>
</g>

Everything already above it remains active:

red-enamel-basin-shadow-layer
red-enamel-gloss-layer
chrome-top-cast-shadow-on-red-layer
inner-chrome-cast-shadow-on-red-layer
ambient-occlusion-layer
final edge cuts

So the moving texture/video does not flatten the design. It is still trapped inside the letterform and still receives the chrome/enamel shadow system.

Important constraint

Use three modes deliberately:

image          → best for portable texture SVGs
css-animation  → best for procedural animated interiors
video          → best for live app/browser rendering

The video mode is for inline browser rendering. The current app already does inline injection, so it fits the system. For exported static assets, keep the fallback red fill or capture through the browser.