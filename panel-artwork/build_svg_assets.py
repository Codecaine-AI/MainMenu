"""Build final side-panel SVG assets from the user's staged source vectors.

Keeps the source paths crisp (sharp vector edges) and wraps them in the
Melee frosted-schematic chrome: double-outline rounded frame, glow underlays
(blurred duplicates BEHIND crisp art, so lines stay sharp), frosted label box
with cut-out lettering, and a subtle turbulence-grain + scanline pass for the
codecaine technical-gritty feel.
"""

import re, os

SP = os.path.dirname(os.path.abspath(__file__))
OUT = "/Users/Ford/Github Repos/Codecaine/codecaine-site/Assets/Media/image"
LINE = "#ecf2ff"


def extract_paths(svg_file):
    s = open(svg_file).read()
    return re.findall(r'<path[^>]*\bd="([^"]+)"', s)


def art_group(
    paths,
    transform,
    fill_opacity,
    stroke_width=None,
    stroke_opacity=0.9,
    bloom_mode="fill",
):
    d = "".join(f'<path d="{p}"/>' for p in paths)
    stroke = (
        f' stroke="{LINE}" stroke-opacity="{stroke_opacity}" '
        f'stroke-width="{stroke_width}" stroke-linejoin="round"'
        if stroke_width
        else ""
    )
    if bloom_mode == "stroke":
        # halo hugs the edges only, interior stays frosted-translucent
        bloom = (
            f'<g transform="{transform}" fill="none" stroke="#dfe9ff" '
            f'stroke-opacity="0.6" stroke-width="{(stroke_width or 8) * 2}" '
            f'stroke-linejoin="round" filter="url(#bloom)">{d}</g>'
        )
    else:
        # bloom underlay: blurred duplicate behind the crisp art
        bloom = (
            f'<g transform="{transform}" fill="#dfe9ff" fill-opacity="0.55" '
            f'filter="url(#bloom)">{d}</g>'
        )
    return (
        bloom
        + f'<g transform="{transform}" fill="{LINE}" fill-opacity="{fill_opacity}"'
        + f"{stroke}>{d}</g>"
    )


def label_box(text):
    return f'''
  <g filter="url(#bloom)"><rect x="165" y="572" width="270" height="58" rx="11"
      fill="none" stroke="{LINE}" stroke-opacity="0.4" stroke-width="4"/></g>
  <rect x="165" y="572" width="270" height="58" rx="11"
      fill="{LINE}" fill-opacity="0.28" stroke="{LINE}" stroke-opacity="0.55" stroke-width="2.5"/>
  <text x="300" y="614" text-anchor="middle" font-family="Arial Black, Arial, sans-serif"
      font-weight="900" font-size="35" letter-spacing="5"
      fill="#0a0e1c" fill-opacity="0.82">{text}</text>'''


def wrap(body, label):
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 720" width="600" height="720">
  <defs>
    <filter id="bloom" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch"/>
      <feColorMatrix values="0 0 0 0 0.93  0 0 0 0 0.96  0 0 0 0 1  0 0 0 0.9 0"/>
    </filter>
    <pattern id="scan" width="4" height="4" patternUnits="userSpaceOnUse">
      <rect width="4" height="1" y="1.5" fill="{LINE}" fill-opacity="0.5"/>
    </pattern>
    <clipPath id="frameclip"><rect x="34" y="34" width="532" height="652" rx="36"/></clipPath>
  </defs>

  <!-- frame: glow underlay, faint outer line, bright inner line, frost fill -->
  <g filter="url(#bloom)">
    <rect x="34" y="34" width="532" height="652" rx="36" fill="none"
        stroke="{LINE}" stroke-opacity="0.4" stroke-width="4.5"/>
  </g>
  <rect x="34" y="34" width="532" height="652" rx="36"
      fill="#ffffff" fill-opacity="0.05"
      stroke="{LINE}" stroke-opacity="0.68" stroke-width="3"/>
  <rect x="24" y="24" width="552" height="672" rx="44" fill="none"
      stroke="{LINE}" stroke-opacity="0.28" stroke-width="2"/>

  {body}
  {label}

  <!-- technical grit: fine grain + scanlines, clipped to the frame -->
  <g clip-path="url(#frameclip)">
    <rect x="34" y="34" width="532" height="652" filter="url(#grain)" opacity="0.07"/>
    <rect x="34" y="34" width="532" height="652" fill="url(#scan)" opacity="0.05"/>
  </g>
</svg>'''


# --- razor A: flat solid blade, straight on (design 1-3, single path, vb 864) ---
paths = extract_paths(f"{SP}/sources/RazorBladedesigns1/Razor Blade (3) SVG.svg")
body = art_group(
    paths, "translate(66.7,126.7) scale(0.54)", 0.26, stroke_width=8, bloom_mode="stroke"
)
open(f"{OUT}/side-mission-razor.svg", "w").write(wrap(body, ""))

# --- razor B: engraved diagonal blade (design 2-24, 61 paths, vb 864) ---
paths = extract_paths(f"{SP}/sources/RazorBladedesigns2/Razor Blade (24) SVG.svg")
body = art_group(paths, "translate(71,131) scale(0.53)", 0.85)
open(f"{OUT}/side-mission-razor-b.svg", "w").write(wrap(body, ""))

# --- handshake: clasped arms (8 paths, vb 3000) ---
paths = extract_paths(
    f"{SP}/sources/Black_Handshake_Clipart_By_Arthmost/Handshake_Clipart_By_Arthmost.svg"
)
body = art_group(paths, "translate(-60,0) scale(0.24)", 0.80)
open(f"{OUT}/side-community-handshake.svg", "w").write(
    wrap(body, "")
)

print("wrote 3 svg assets to", OUT)
