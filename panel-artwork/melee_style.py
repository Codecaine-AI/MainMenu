"""Shared frosted-glass Melee diagram pipeline (see STYLE_SPEC.md).

Everything is drawn as L-mode masks at SUPER x final resolution, then
composited into a single RGBA with: bloom halo -> frosted fill -> bright
stroke, feathered and downsampled. Zero hue in the art itself.
"""

from PIL import Image, ImageDraw, ImageFilter, ImageFont, ImageChops
import numpy as np

SUPER = 4  # supersample factor

LINE_RGB = (236, 242, 255)
FILL_RGB = (255, 255, 255)


def new_mask(size):
    return Image.new("L", size, 0)


def _odd(n):
    n = max(3, int(round(n)))
    return n if n % 2 == 1 else n + 1


def dilate(mask, px):
    if px <= 0:
        return mask
    return mask.filter(ImageFilter.MaxFilter(_odd(px * 2 + 1)))


def erode(mask, px):
    if px <= 0:
        return mask
    return mask.filter(ImageFilter.MinFilter(_odd(px * 2 + 1)))


def stroke_of(mask, width):
    """Uniform outline band centered on the mask edge."""
    half = max(1, int(round(width / 2)))
    return ImageChops.subtract(dilate(mask, half), erode(mask, max(0, width - half)))


def outer_stroke(mask, width):
    """Outline band fully outside the mask edge."""
    return ImageChops.subtract(dilate(mask, width), mask)


def text_mask(size, text, font_path, font_px, center, tracking=0):
    """Render text into a mask, optionally with letter tracking (px)."""
    m = new_mask(size)
    d = ImageDraw.Draw(m)
    font = ImageFont.truetype(font_path, font_px)
    if tracking:
        widths = [d.textlength(ch, font=font) for ch in text]
        total = sum(widths) + tracking * (len(text) - 1)
        x = center[0] - total / 2
        asc, desc = font.getmetrics()
        y = center[1] - (asc + desc) / 2
        for ch, w in zip(text, widths):
            d.text((x, y), ch, font=font, fill=255)
            x += w + tracking
    else:
        d.text(center, text, font=font, fill=255, anchor="mm")
    return m


def rounded_rect_mask(size, box, radius):
    m = new_mask(size)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=radius, fill=255)
    return m


def layer(size, mask, rgb, alpha):
    """RGBA layer from mask scaled by alpha."""
    a = mask.point(lambda v: int(v * alpha))
    out = Image.new("RGBA", size, rgb + (0,))
    out.putalpha(a)
    return out


def compose(size_final, layers, feather=0.7, noise=0.025, seed=7):
    """layers: list of (mask@SUPER, rgb, alpha, blur_px@SUPER).
    Composited in order (first = bottom)."""
    w, h = size_final
    ws, hs = w * SUPER, h * SUPER
    out = Image.new("RGBA", (ws, hs), (0, 0, 0, 0))
    for mask, rgb, alpha, blur in layers:
        if blur > 0:
            mask = mask.filter(ImageFilter.GaussianBlur(blur))
        out = Image.alpha_composite(out, layer((ws, hs), mask, rgb, alpha))
    out = out.resize((w, h), Image.LANCZOS)
    if noise > 0:
        rng = np.random.default_rng(seed)
        arr = np.array(out).astype(np.float32)
        n = rng.normal(1.0, noise, (h, w, 1))
        arr[..., 3:] = np.clip(arr[..., 3:] * n, 0, 255)
        out = Image.fromarray(arr.astype(np.uint8), "RGBA")
    if feather > 0:
        out = out.filter(ImageFilter.GaussianBlur(feather))
    return out


def frame_layers(
    size_super,
    inset,
    radius,
    line_w,
    fill_alpha=0.05,
    inner_alpha=0.62,
    outer_alpha=0.22,
    gap=None,
):
    """Melee double-outline rounded container. Returns list of layer tuples."""
    ws, hs = size_super
    gap = gap if gap is not None else line_w * 2
    inner_box = (inset, inset, ws - inset, hs - inset)
    inner = new_mask((ws, hs))
    ImageDraw.Draw(inner).rounded_rectangle(inner_box, radius=radius, fill=255)
    outer_box = (inset - gap, inset - gap, ws - inset + gap, hs - inset + gap)
    outer = new_mask((ws, hs))
    ImageDraw.Draw(outer).rounded_rectangle(outer_box, radius=radius + gap, fill=255)
    inner_stroke = stroke_of(inner, line_w)
    outer_stroke_m = stroke_of(outer, max(2, line_w - 2))
    return [
        (inner_stroke, LINE_RGB, 0.30, line_w * 2.2),  # frame bloom
        (inner, FILL_RGB, fill_alpha, 0),  # faint card frost
        (outer_stroke_m, LINE_RGB, outer_alpha, 0),  # outer faint line
        (inner_stroke, LINE_RGB, inner_alpha, 0),  # inner bright line
    ]


def label_box_layers(
    size_super,
    box,
    radius,
    text,
    font_px,
    line_w,
    box_alpha=0.30,
    stroke_alpha=0.55,
    font_path="/System/Library/Fonts/Supplemental/Arial Black.ttf",
    tracking=None,
):
    """Bracketed frosted label pill with CUT-OUT letters (panel shows through),
    per the reference ON / English boxes."""
    ws, hs = size_super
    boxm = new_mask((ws, hs))
    ImageDraw.Draw(boxm).rounded_rectangle(box, radius=radius, fill=255)
    cx, cy = (box[0] + box[2]) / 2, (box[1] + box[3]) / 2
    tr = tracking if tracking is not None else font_px * 0.10
    tm = text_mask((ws, hs), text, font_path, font_px, (cx, cy), tracking=tr)
    boxs = stroke_of(boxm, line_w)
    frost = ImageChops.subtract(boxm, dilate(tm, max(1, line_w // 3)))
    return [
        (boxs, LINE_RGB, 0.25, line_w * 2),
        (frost, FILL_RGB, box_alpha, 0),
        (boxs, LINE_RGB, stroke_alpha, 0),
    ]


def art_layers(
    shape_mask,
    line_w,
    fill_alpha=0.17,
    stroke_alpha=0.88,
    bloom_alpha=0.38,
    bloom_mult=2.6,
    top_light=True,
    size_super=None,
):
    """Standard treatment for a diagram shape: bloom + frost + bright stroke
    (+ subtle top-edge highlight)."""
    s = stroke_of(shape_mask, line_w)
    out = [
        (s, LINE_RGB, bloom_alpha, line_w * bloom_mult),
        (shape_mask, FILL_RGB, fill_alpha, 0),
        (s, LINE_RGB, stroke_alpha, 0),
    ]
    if top_light:
        shifted = shape_mask.transform(
            shape_mask.size, Image.AFFINE, (1, 0, 0, 0, 1, line_w * 1.2)
        )
        hi = ImageChops.subtract(shape_mask, shifted)
        out.append((hi, (255, 255, 255), 0.30, line_w * 0.8))
    return out
