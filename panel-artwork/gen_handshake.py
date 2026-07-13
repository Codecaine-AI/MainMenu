"""Handshake side-panel diagram (COMMUNITY item) - 3 candidates, v2.

Pictogram: two sleeved forearms entering from the frame sides, one big
clasped-hands grip mass in the middle, thumb on top, four wrapping finger
lines engraved. Chunky early-2000s icon abstraction, frosted-glass treatment.
"""

import sys, os, math

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from melee_style import *
from PIL import Image, ImageDraw, ImageChops

OUT = os.path.dirname(os.path.abspath(__file__))
W, H = 300, 360
FINAL = (W * 2, H * 2)
WS, HS = FINAL[0] * SUPER, FINAL[1] * SUPER
LW = int(2.2 * 2 * SUPER)


def rot(p, c, ang):
    a = math.radians(ang)
    x, y = p[0] - c[0], p[1] - c[1]
    return (
        c[0] + x * math.cos(a) - y * math.sin(a),
        c[1] + x * math.sin(a) + y * math.cos(a),
    )


def capsule(d, p0, p1, r):
    d.line((*p0, *p1), fill=255, width=int(2 * r))
    for x, y in (p0, p1):
        d.ellipse((x - r, y - r, x + r, y + r), fill=255)


def rounded_rot_rect(size, center, w, h, radius, ang):
    tile = Image.new("L", (int(w * 2), int(h * 2)), 0)
    ImageDraw.Draw(tile).rounded_rectangle(
        (w * 0.5, h * 0.5, w * 1.5, h * 1.5), radius=radius, fill=255
    )
    tile = tile.rotate(-ang, resample=Image.BICUBIC, expand=True)
    m = new_mask(size)
    m.paste(tile, (int(center[0] - tile.width / 2), int(center[1] - tile.height / 2)))
    return m


def handshake_masks(cx, cy, u, tilt):
    """Returns (solid shape mask, engraved cut-line mask)."""
    size = (WS, HS)
    shape = new_mask(size)
    d = ImageDraw.Draw(shape)
    a = math.radians(tilt)
    dx, dy = math.cos(a), -math.sin(a)

    # sleeves + forearms: thick capsules, flat-cut at the outer ends
    arm_r = u * 0.60
    lwrist = (cx - u * 1.05, cy + u * 0.05)
    rwrist = (cx + u * 1.05, cy + u * 0.05)
    reach = u * 3.4
    lstart = (lwrist[0] - reach * dx, lwrist[1] + reach * dy)
    rstart = (rwrist[0] + reach * dx, rwrist[1] + reach * dy)
    capsule(d, lstart, lwrist, arm_r)
    capsule(d, rstart, rwrist, arm_r)
    # flat cuts at sleeve ends
    cutw = u * 1.4
    d_cut = ImageDraw.Draw(shape)
    lcut = [
        rot((lstart[0] - cutw, lstart[1] - cutw * 1.5), lstart, tilt),
        rot((lstart[0] + u * 0.1, lstart[1] - cutw * 1.5), lstart, tilt),
        rot((lstart[0] + u * 0.1, lstart[1] + cutw * 1.5), lstart, tilt),
        rot((lstart[0] - cutw, lstart[1] + cutw * 1.5), lstart, tilt),
    ]
    d_cut.polygon([(x - u * 0.55 * dx, y + u * 0.55 * dy) for x, y in lcut], fill=0)
    rcut = [
        rot((rstart[0] - u * 0.1, rstart[1] - cutw * 1.5), rstart, -tilt),
        rot((rstart[0] + cutw, rstart[1] - cutw * 1.5), rstart, -tilt),
        rot((rstart[0] + cutw, rstart[1] + cutw * 1.5), rstart, -tilt),
        rot((rstart[0] - u * 0.1, rstart[1] + cutw * 1.5), rstart, -tilt),
    ]
    d_cut.polygon([(x + u * 0.55 * dx, y + u * 0.55 * dy) for x, y in rcut], fill=0)

    # clasped grip mass: fat rounded rect, slightly rotated
    grip = rounded_rot_rect(size, (cx, cy), u * 2.7, u * 1.75, u * 0.80, tilt + 6)
    shape = ImageChops.lighter(shape, grip)
    d = ImageDraw.Draw(shape)
    # thumb ridge protruding on top, pointing right
    capsule(d, (cx - u * 0.30, cy - u * 0.98), (cx + u * 0.55, cy - u * 0.80), u * 0.32)
    # four wrapping fingertips protruding below the grip (silhouette scallops)
    for i in range(4):
        fx = cx - u * 0.62 + i * u * 0.46
        fy = cy + u * 0.72 + (i - 1.5) ** 2 * u * -0.045 + u * 0.06
        r = u * 0.30
        d.ellipse((fx - r, fy - r, fx + r, fy + r), fill=255)

    # engraved details (cut lines): cuffs, wrists, hand seam, finger separations
    det = new_mask(size)
    dd = ImageDraw.Draw(det)
    cut_w = max(3, int(LW * 0.9))
    for (wx, wy), s in ((lstart, 1), (rstart, -1)):
        p = (wx + u * 0.55 * dx * s, wy - u * 0.55 * dy)
        n = (dy * s, dx)
        dd.line((p[0] - n[0] * u * 0.85, p[1] - n[1] * u * 0.85,
                 p[0] + n[0] * u * 0.85, p[1] + n[1] * u * 0.85),
                fill=255, width=cut_w)
    for (wx, wy), s in ((lwrist, 1), (rwrist, -1)):
        n = (dy * s, dx)
        dd.line((wx - n[0] * u * 0.7, wy - n[1] * u * 0.7,
                 wx + n[0] * u * 0.7, wy + n[1] * u * 0.7),
                fill=255, width=cut_w)
    # seam between the two hands, diagonal across the grip
    dd.line((cx - u * 0.15, cy - u * 0.9, cx - u * 0.75, cy + u * 0.75),
            fill=255, width=cut_w)
    # short separations between fingertip scallops
    for i in range(3):
        fx = cx - u * 0.62 + (i + 0.5) * u * 0.46
        dd.line((fx, cy + u * 0.45, fx - u * 0.08, cy + u * 0.95),
                fill=255, width=max(2, int(cut_w * 0.8)))
    return shape, det


def build(variant, path):
    layers = []
    layers += frame_layers(
        (WS, HS), inset=int(10 * 2 * SUPER), radius=int(18 * 2 * SUPER), line_w=LW
    )
    label = variant.get("label")
    art_cy = HS * (0.42 if label else 0.50)
    shape, det = handshake_masks(
        WS / 2, art_cy, WS * variant["scale"], tilt=variant["tilt"]
    )
    # engrave the cut lines out of the solid, then apply standard treatment
    det = ImageChops.multiply(det, erode(shape, int(LW * 0.8)))
    cut = ImageChops.subtract(shape, det)
    layers += art_layers(
        cut,
        LW,
        fill_alpha=variant["fill"],
        stroke_alpha=0.95,
        bloom_alpha=variant["bloom"],
    )
    if label:
        lw_, lh_ = WS * 0.60, HS * 0.10
        box = (WS / 2 - lw_ / 2, HS * 0.78, WS / 2 + lw_ / 2, HS * 0.78 + lh_)
        layers += label_box_layers(
            (WS, HS),
            box,
            radius=int(lh_ * 0.22),
            text=label,
            font_px=int(lh_ * 0.52),
            line_w=LW,
        )
    img = compose(FINAL, layers, feather=0.9, noise=0.022, seed=23)
    img.save(path)
    print("wrote", path)


V = [
    dict(scale=0.145, tilt=14, fill=0.18, bloom=0.40, label="COMMUNITY"),
    dict(scale=0.155, tilt=14, fill=0.18, bloom=0.40, label=None),
    dict(scale=0.125, tilt=9, fill=0.26, bloom=0.55, label="COMMUNITY"),
]
for i, v in enumerate(V, 1):
    build(v, os.path.join(OUT, f"handshake_c{i}.png"))
