# Raster Trace to Smooth SVG Workflow

This is the workflow to use when a UI shape needs to match a raster reference first, then become a clean editable SVG component.

The important lesson from the loading dialog work is: do not start by guessing smooth curves. First trace the raster closely enough that the shape is visibly correct, get visual confirmation, and only then replace the dense/choppy trace with smoother authored curves that preserve the traced landmarks.

## When to Use This

Use this process for:

- PS2-style panels, frames, buttons, warning boxes, tabs, and irregular UI shells
- Shapes where “rounded rectangle” is wrong
- Assets where the pixel reference is the ground truth
- Components that need sub-groups like border, body fill, text box, icon, progress pill
- SVGs that must stay lightweight and editable, not embedded PNGs

## The Workflow

### 1. Keep the SVG geometry outside JS

For path-heavy assets, put the geometry in a standalone SVG next to the component.

Example:

```text
Assets/Modules/components/loading-dialog/
├── loading-dialog.js
├── loading-dialog.css
├── loading-dialog.svg
└── manifest.json
```

The JS can still load the SVG template and add dynamic text/progress, but the traced shape should live in the `.svg` file so it can be rendered and tuned directly.

### 2. Load the reference image and find the asset bounds

Start by identifying the real pixel bounds of the colored shape, not the whole screenshot.

```python
from pathlib import Path
from PIL import Image
import numpy as np

ref = Path("to_add/loading_screen/ddy2311-663e5e07-c1c5-438f-9671-0ade6785bcb0.png")
im = np.array(Image.open(ref).convert("RGBA"))

r, g, b, a = [im[:, :, i] for i in range(4)]

purple_mask = (
    (a > 0) &
    (b > 95) &
    (r > 55) &
    (g > 55) &
    (np.abs(r.astype(int) - g.astype(int)) < 45) &
    (b > r + 15) &
    (b > g + 15)
)

ys, xs = np.where(purple_mask)
print(min(xs), min(ys), max(xs), max(ys))
```

For the loading dialog references, the important measured frame bounds were:

```text
2-line frame: x 143..724, y 171..360, size 582x190
3-line frame: x 143..724, y 171..396, size 582x226
```

Those bounds became the component’s frame sizing source of truth.

### 3. Segment the image into masks

Do not trace the whole image at once. Segment by visual layer:

- Purple/blue frame border
- Dark frame fill
- Text box fill
- Progress pill
- Icon yellow
- Icon black/exclamation

For flat UI art, thresholding is usually good enough.

```python
import cv2
import numpy as np
from PIL import Image

im = np.array(Image.open(ref).convert("RGBA"))
r, g, b, a = [im[:, :, i] for i in range(4)]

purple_mask = (
    (a > 0) &
    (b > 95) &
    (r > 55) &
    (g > 55) &
    (np.abs(r.astype(int) - g.astype(int)) < 45) &
    (b > r + 15) &
    (b > g + 15)
).astype(np.uint8) * 255

yellow_mask = (
    (a > 0) &
    (r > 190) &
    (g > 150) &
    (b < 80)
).astype(np.uint8) * 255

dark_mask = (
    (a > 0) &
    (r < 45) &
    (g < 45) &
    (b < 65)
).astype(np.uint8) * 255
```

### 4. Clean JPEG/PNG edge noise before contouring

Small gaps and speckles make awful SVG paths. Clean masks lightly.

```python
kernel = np.ones((3, 3), np.uint8)
purple_mask = cv2.morphologyEx(purple_mask, cv2.MORPH_CLOSE, kernel, iterations=1)
```

Keep this conservative. Too much morphology changes the shape.

### 5. Extract dense contours for the first trace

The first trace should prioritize fidelity over editability.

```python
contours, hierarchy = cv2.findContours(
    purple_mask,
    cv2.RETR_TREE,
    cv2.CHAIN_APPROX_NONE
)

main = max(contours, key=cv2.contourArea)
```

Use `CHAIN_APPROX_NONE` at first because it preserves dense point data. This is what gives you a near-pixel trace.

### 6. Generate the rough trace SVG

Convert contours into SVG path data. For the first pass, many `L` commands are acceptable.

```python
def contour_to_path(contour, origin_x=0, origin_y=0):
    pts = contour[:, 0, :]
    commands = [f"M {pts[0][0] - origin_x} {pts[0][1] - origin_y}"]
    for x, y in pts[1:]:
        commands.append(f"L {x - origin_x} {y - origin_y}")
    commands.append("Z")
    return " ".join(commands)

d = contour_to_path(main, origin_x=112, origin_y=171)

svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 613 226">
  <path fill="#7474c4" fill-rule="evenodd" d="{d}"/>
</svg>'''
```

This first SVG may be point-heavy and choppy when enlarged. That is fine. The point is to confirm the geometry.

### 7. Group the asset before wiring it into the component

Do not leave the asset as one anonymous path. Give the component useful sub-groups.

```svg
<g id="loading-dialog-two" class="loading-dialog__asset loading-dialog__asset--two">
  <g class="loading-dialog__border-group">
    <!-- outer border, frame fill, inner border -->
  </g>

  <g class="loading-dialog__text-box-group">
    <!-- recessed dark text box -->
  </g>

  <g class="loading-dialog__progress-group">
    <!-- lower progress pill -->
  </g>

  <g class="loading-dialog__icon-group">
    <!-- warning icon -->
  </g>
</g>
```

This makes layout and future tuning much easier. The component can clone these groups from the SVG template and then overlay dynamic text/progress in JS.

### 8. Render the rough trace and get confirmation

Do not smooth yet.

First render the traced version and compare it to the reference. The goal at this stage is:

- Correct silhouette
- Correct step/notch placement
- Correct border proportions
- Correct text box and progress pill placement
- Correct overall width/height for each content variant

The dense trace is allowed to look choppy. Ask for visual confirmation once the shape is near-perfect.

This gate matters because smoothing can accidentally move corners and edges. If the rough trace is wrong, smoothing only makes a wrong shape prettier.

### 9. Extract simplified landmarks for smoothing

Once the rough trace is confirmed, use `approxPolyDP` at a few tolerances to identify important landmarks.

```python
for eps in [0.8, 1.5, 2.5, 4, 6, 8, 12]:
    approx = cv2.approxPolyDP(main, eps, True)[:, 0, :]
    print("eps", eps, "points", len(approx))
    print(" ".join(f"({x - 112},{y - 171})" for x, y in approx))
```

For the 2-line loading dialog, useful outer frame landmarks looked like this:

```text
(31,141) (31,179) (36,186) (44,189) (599,189)
(605,187) (612,179) (612,10) (601,0) (69,0)
(59,8) (58,17) (97,17) (105,23) (107,38)
(116,46) (575,46) (583,52) (585,58) (585,120)
(583,126) (574,132) (41,132)
```

These are not the final path. They are the anchors/control targets used to author smooth curves.

### 10. Replace choppy contour edges with smooth SVG curves

The cleanup pass should preserve the measured anchors while replacing many tiny line segments with `C`/`Q` curves.

Bad cleanup:

```svg
<!-- Too generic; loses the reference shape -->
<rect x="31" y="0" width="582" height="190" rx="12"/>
```

Good cleanup:

```svg
<path
  class="loading-dialog__border-soft loading-dialog__outer-border-fill"
  d="
    M 58 17
    C 58 8 62 2 69 0
    H 601
    C 607 0 612 5 612 11
    V 178
    C 612 184 606 189 599 189
    H 44
    C 37 189 31 183 31 176
    V 143
    C 31 137 35 132 42 132
    H 574
    C 581 132 585 126 585 120
    V 58
    C 585 52 581 46 575 46
    H 116
    C 111 46 108 42 107 38
    C 106 28 103 17 97 17
    H 58
    Z
  "/>
```

For the loading dialog, the key improvement was using both:

- A filled outer border silhouette for the thick purple/lavender lip
- Smooth stroked paths for the bright inner/outer highlight lines

Only using strokes made the frame too thin and lost the PS2-style weight at the bottom edge.

### 11. Keep dynamic variants explicit

If the shape height changes with text content, keep separate SVG groups for each known height.

```svg
<g id="loading-dialog-two" data-frame-width="582" data-frame-height="190">
  ...
</g>

<g id="loading-dialog-three" data-frame-width="582" data-frame-height="226">
  ...
</g>
```

Then JS chooses the variant based on measured text lines.

```js
const variantKey = lines.length >= 3 ? 'three' : 'two';
const source = template[variantKey];
const asset = document.importNode(source, true);
parent.appendChild(asset);
```

### 12. Validate before handoff

Run syntax checks:

```bash
xmllint --noout Assets/Modules/components/loading-dialog/loading-dialog.svg
node --check Assets/Modules/components/loading-dialog/loading-dialog.js
```

Confirm no embedded raster image slipped in:

```bash
rg -n '<image|data:image' Assets/Modules/components/loading-dialog
```

Render the standalone SVG:

```bash
node .agents/skills/asset-recreation/scripts/render-svg.mjs \
  Assets/Modules/components/loading-dialog/loading-dialog.svg \
  /tmp/loading-dialog-svg.png \
  --width 1226 \
  --height 452
```

Then render the actual scene through the running dev server:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new \
  --disable-gpu \
  --no-first-run \
  --user-data-dir=/tmp/chrome-loading-dialog-check \
  --virtual-time-budget=5000 \
  --screenshot=/tmp/loading-scene.png \
  --window-size=1440,1080 \
  'http://localhost:3000/scenes/loading?project=codecaine'
```

For ordinary scene-engine component changes, use the running dev server/hot reload. Do not run a production build just to check SVG/CSS/component edits.

## Practical Rules

- Trace first, smooth second.
- Do not hand-wave irregular UI into rounded rectangles.
- Use masks and contours to find real bounds and landmarks.
- Keep the dense trace around until the user confirms the shape.
- Smooth by fitting curves to landmarks, not by inventing new geometry.
- Use filled silhouettes for thick borders/lips; strokes alone often look too thin.
- Keep named SVG groups for layout: border, text box, progress, icon, text.
- Validate that the SVG is real vector geometry, with no embedded `<image>` or `data:image`.
- Check the standalone SVG first, then the live component.

## Common Failure Modes

### Smoothing too early

If you smooth before the traced silhouette is approved, you lose the only objective reference. The result may be clean but wrong.

### Over-simplifying the landmark path

High `approxPolyDP` tolerances produce too few points. That creates generic rounded boxes and misses small notches, steps, and asymmetric corners.

Use multiple tolerances and compare:

```python
for eps in [0.8, 1.5, 2.5, 4, 6, 8]:
    ...
```

### Losing thick border mass

If the reference has a thick border or bottom lip, represent it as a fill shape. A stroked outline may be smooth but will not match the visual weight.

### Forgetting component layout

SVG fidelity is not enough. The component also needs:

- Stable viewBox
- Frame width/height metadata
- Grouped subcomponents
- CSS variables for colors/opacities
- Dynamic JS text/progress overlays

### Trusting the standalone SVG too much

Standalone templates with multiple variants may render variants on top of each other. Use direct SVG rendering for geometry sanity, but use the live scene render for final component verification.

## Loading Dialog Reference Notes

Reference images:

```text
to_add/loading_screen/ddy2311-663e5e07-c1c5-438f-9671-0ade6785bcb0.png
to_add/loading_screen/ddy2301-1d92e000-747e-4133-b190-b15ae645ffc7.png
```

Component files:

```text
/Users/Ford/Github Repos/Codecaine/codecaine-site/Assets/Modules/components/loading-dialog/loading-dialog.js
/Users/Ford/Github Repos/Codecaine/codecaine-site/Assets/Modules/components/loading-dialog/loading-dialog.css
/Users/Ford/Github Repos/Codecaine/codecaine-site/Assets/Modules/components/loading-dialog/loading-dialog.svg
/Users/Ford/Github Repos/Codecaine/codecaine-site/Assets/Modules/components/loading-dialog/manifest.json
```

The final loading dialog SVG uses:

- `loading-dialog__border-group`
- `loading-dialog__text-box-group`
- `loading-dialog__progress-group`
- `loading-dialog__icon-group`
- Separate 2-line and 3-line variants
- Smooth cubic paths for frame corners and the stepped notch
- A filled outer border silhouette plus bright/soft stroked border lines

