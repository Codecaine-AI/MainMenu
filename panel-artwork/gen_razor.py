"""Razor blade side-panel diagram (MISSION item) - 3 candidates."""

import sys, os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from melee_style import *
from PIL import Image, ImageDraw, ImageChops

OUT = os.path.dirname(os.path.abspath(__file__))
W, H = 300, 360  # stage-unit-ish final size (x2 later if needed)
FINAL = (W * 2, H * 2)  # ship at 2x for retina
WS, HS = FINAL[0] * SUPER, FINAL[1] * SUPER
LW = int(2.2 * 2 * SUPER)  # ~2.2 stage px line weight


def blade_mask(cx, cy, bw, bh, angle=0.0):
    """Classic double-edge safety razor blade silhouette with cutouts."""
    size = (WS, HS)
    pad = int(bw * 0.6)
    tile = Image.new("L", (int(bw + 2 * pad), int(bh + 2 * pad)), 0)
    d = ImageDraw.Draw(tile)
    x0, y0 = pad, pad
    x1, y1 = pad + bw, pad + bh
    r = bh * 0.10
    d.rounded_rectangle((x0, y0, x1, y1), radius=r, fill=255)
    # curved side notches (short edges)
    nr = bh * 0.22
    d.ellipse((x0 - nr, y0 + bh / 2 - nr, x0 + nr, y0 + bh / 2 + nr), fill=0)
    d.ellipse((x1 - nr, y0 + bh / 2 - nr, x1 + nr, y0 + bh / 2 + nr), fill=0)
    # center slot: long capsule with square key in middle
    sw, sh = bw * 0.46, bh * 0.115
    scx, scy = x0 + bw / 2, y0 + bh / 2
    d.rounded_rectangle(
        (scx - sw / 2, scy - sh / 2, scx + sw / 2, scy + sh / 2), radius=sh / 2, fill=0
    )
    kw = bh * 0.16
    d.rectangle((scx - kw / 2, scy - kw, scx + kw / 2, scy + kw), fill=0)
    # two round pin holes
    hr = bh * 0.075
    for hx in (scx - sw * 0.72, scx + sw * 0.72):
        d.ellipse((hx - hr, scy - hr, hx + hr, scy + hr), fill=0)
    if angle:
        tile = tile.rotate(angle, resample=Image.BICUBIC, expand=True)
    m = new_mask(size)
    m.paste(tile, (int(cx - tile.width / 2), int(cy - tile.height / 2)))
    return m


def edge_bevel_lines(cx, cy, bw, bh, angle=0.0):
    """Thin lines parallel to the two sharpened long edges."""
    size = (WS, HS)
    pad = int(bw * 0.6)
    tile = Image.new("L", (int(bw + 2 * pad), int(bh + 2 * pad)), 0)
    d = ImageDraw.Draw(tile)
    x0, y0, x1, y1 = pad, pad, pad + bw, pad + bh
    inset = bh * 0.14
    lw = max(2, LW // 2)
    d.line((x0 + bw * 0.10, y0 + inset, x1 - bw * 0.10, y0 + inset), fill=255, width=lw)
    d.line((x0 + bw * 0.10, y1 - inset, x1 - bw * 0.10, y1 - inset), fill=255, width=lw)
    if angle:
        tile = tile.rotate(angle, resample=Image.BICUBIC, expand=True)
    m = new_mask(size)
    m.paste(tile, (int(cx - tile.width / 2), int(cy - tile.height / 2)))
    return m


def build(variant, path):
    layers = []
    layers += frame_layers(
        (WS, HS), inset=int(10 * 2 * SUPER), radius=int(18 * 2 * SUPER), line_w=LW
    )
    label = variant.get("label")
    art_cy = HS * (0.42 if label else 0.50)
    bw, bh = WS * variant["bw"], WS * variant["bw"] * variant["aspect"]
    bm = blade_mask(WS / 2, art_cy, bw, bh, variant["angle"])
    layers += art_layers(
        bm,
        LW,
        fill_alpha=variant["fill"],
        stroke_alpha=0.95,
        bloom_alpha=variant["bloom"],
    )
    if variant.get("bevel"):
        bl = edge_bevel_lines(WS / 2, art_cy, bw, bh, variant["angle"])
        bl = ImageChops.multiply(bl, erode(bm, LW))  # keep inside blade
        layers.append((bl, LINE_RGB, 0.45, LW))
    if label:
        lw_, lh_ = WS * 0.46, HS * 0.10
        box = (WS / 2 - lw_ / 2, HS * 0.78, WS / 2 + lw_ / 2, HS * 0.78 + lh_)
        layers += label_box_layers(
            (WS, HS),
            box,
            radius=int(lh_ * 0.22),
            text=label,
            font_px=int(lh_ * 0.62),
            line_w=LW,
        )
    img = compose(FINAL, layers, feather=0.9, noise=0.022, seed=11)
    img.save(path)
    print("wrote", path)


V = [
    dict(bw=0.74, aspect=0.475, angle=0, fill=0.18, bloom=0.40, bevel=True, label="MISSION"),
    dict(bw=0.80, aspect=0.475, angle=0, fill=0.18, bloom=0.40, bevel=True, label=None),
    dict(bw=0.72, aspect=0.475, angle=0, fill=0.26, bloom=0.55, bevel=True, label="MISSION"),
]
for i, v in enumerate(V, 1):
    build(v, os.path.join(OUT, f"razor_c{i}.png"))
