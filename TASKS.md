The current system can get the look. The issue is not the SVG base. The issue is that only silver-rim-layer is being treated like chrome. The taper layers are still being treated like matte beveled fills.

The target finish needs four distinct surfaces:

1. Red enamel fill: deep red, slightly glossy, mostly flat.
2. Inner silver taper: a sloped chrome bevel between red and top chrome.
3. Chrome top face: mirror-metal band with hard white/black reflection cuts.
4. Outer silver taper / sidewall: another sloped chrome bevel dropping into the extrusion shadow.

Right now your recipe has the geometry for this, but not enough material separation.

What is happening now

In layer-recipe.json, this is your core chrome stack:

"chrome_stack": {
  "layer_ids": [
    "inner-silver-down-ramp-layer",
    "silver-rim-layer",
    "outer-silver-down-ramp-layer"
  ]
}

That is the right structure.

But the actual visual treatment is uneven:

{
  "id": "inner-silver-down-ramp-layer",
  "type": "bevel-ramp",
  ...
}

and

{
  "id": "outer-silver-down-ramp-layer",
  "type": "bevel-ramp",
  ...
}

are rendered by bevel_ramp_layer_svg() as a masked rectangle filled with a simple gradient. They are not really getting the same chrome reflection behavior as the main rim.

Meanwhile:

{
  "id": "silver-rim-layer",
  "type": "stroke",
  "paint": "url(#chrome-top-gradient)",
  "filter": "chrome_bevel"
}

does get the chrome gradient, the bevel filter, and the stronger reflection overlays.

So the top face is “semi-chrome,” while the tapers are “gray ramps.” That mismatch is exactly what your examples do not have. In the examples, every silver surface shares the same reflective metal language, even when the surface angle changes.

First change: make chrome darker and brighter, not just lighter

Chrome does not read as shiny because it is bright. It reads as shiny because it has violent contrast: white cuts next to near-black cuts.

Your chrome_top gradient is close, but still too satin. Push it harder.

Change the chrome top logic toward this kind of stop rhythm:

"chrome_top": [
  { "offset": "0%", "color": "#f6fbff" },
  { "offset": "4%", "color": "#ffffff" },
  { "offset": "7%", "color": "#9ca7af" },
  { "offset": "12%", "color": "#222a31" },
  { "offset": "17%", "color": "#050607" },
  { "offset": "21%", "color": "#ffffff" },
  { "offset": "27%", "color": "#f7fbff" },
  { "offset": "31%", "color": "#818b93" },
  { "offset": "42%", "color": "#252d34" },
  { "offset": "49%", "color": "#040506" },
  { "offset": "54%", "color": "#ffffff" },
  { "offset": "61%", "color": "#e4edf2" },
  { "offset": "68%", "color": "#7a858e" },
  { "offset": "78%", "color": "#11171c" },
  { "offset": "84%", "color": "#050607" },
  { "offset": "88%", "color": "#ffffff" },
  { "offset": "93%", "color": "#eef5f9" },
  { "offset": "100%", "color": "#68727a" }
]

The important move is this: do not reduce black. Add more black. Add more white. Chrome needs both.

Then raise the reflection overlays:

{
  "id": "chrome-dark-reflection-layer",
  "opacity": 0.46
},
{
  "id": "chrome-hot-reflection-layer",
  "opacity": 0.82
},
{
  "id": "chrome-stack-soft-dark-reflection-layer",
  "opacity": 0.22
},
{
  "id": "chrome-stack-soft-hot-reflection-layer",
  "opacity": 0.34
}

Your current stack reflection opacities are too low:

"chrome-stack-soft-dark-reflection-layer": 0.1
"chrome-stack-soft-hot-reflection-layer": 0.14

Those are barely affecting the tapers. Raise them. The examples have obvious white highlights and dark mirror bands across the metal.

Second change: make the taper gradients chrome, not gray

Your inner ramp currently moves like this:

"#162027" -> "#34444d" -> "#74818a" -> "#b7c1c8" -> "#dce4e8" -> "#edf3f6"

That is a smooth gray slope. It will never look like polished metal.

Use a broken chrome ramp instead:

{
  "id": "inner-silver-down-ramp-layer",
  "type": "bevel-ramp",
  "start": 1,
  "end": 7.2,
  "opacity": 1,
  "gradient_vector": {
    "x1": 0.82,
    "y1": 0.9,
    "x2": 0.18,
    "y2": 0.1
  },
  "stops": [
    { "offset": "0%", "color": "#050607", "opacity": 1 },
    { "offset": "13%", "color": "#182127", "opacity": 1 },
    { "offset": "25%", "color": "#5f6b74", "opacity": 1 },
    { "offset": "36%", "color": "#ffffff", "opacity": 1 },
    { "offset": "43%", "color": "#dce6eb", "opacity": 1 },
    { "offset": "54%", "color": "#66737c", "opacity": 1 },
    { "offset": "65%", "color": "#10161b", "opacity": 1 },
    { "offset": "76%", "color": "#f8fbff", "opacity": 1 },
    { "offset": "88%", "color": "#a8b3bb", "opacity": 1 },
    { "offset": "100%", "color": "#f2f7fa", "opacity": 1 }
  ],
  "visible": true
}

For the outer ramp, reverse the feeling: bright upper lip, dark lower/right falloff.

{
  "id": "outer-silver-down-ramp-layer",
  "type": "bevel-ramp",
  "start": 29.6,
  "end": 38.2,
  "opacity": 1,
  "gradient_vector": {
    "x1": 0.16,
    "y1": 0.06,
    "x2": 0.9,
    "y2": 0.94
  },
  "stops": [
    { "offset": "0%", "color": "#ffffff", "opacity": 1 },
    { "offset": "8%", "color": "#edf4f8", "opacity": 1 },
    { "offset": "18%", "color": "#9da8b0", "opacity": 1 },
    { "offset": "31%", "color": "#2b343b", "opacity": 1 },
    { "offset": "43%", "color": "#050607", "opacity": 1 },
    { "offset": "54%", "color": "#151c22", "opacity": 1 },
    { "offset": "65%", "color": "#ffffff", "opacity": 1 },
    { "offset": "73%", "color": "#d8e2e8", "opacity": 1 },
    { "offset": "85%", "color": "#68737c", "opacity": 1 },
    { "offset": "100%", "color": "#071015", "opacity": 1 }
  ],
  "visible": true
}

This makes the tapers use the same visual vocabulary as the chrome top: black cuts, white cuts, cold blue-gray steel between them.

Third change: use the unused chrome edge gradients

You already defined these:

"chrome_edge_hotline"
"chrome_edge_shadowline"

But they are not being used as layers.

Use them. They are exactly the kind of detail the references have: a hot white metal edge and a dark containment edge.

Add top-face overlays after silver-rim-layer:

{
  "id": "chrome-top-edge-hotline-layer",
  "type": "rect-fill",
  "paint": "url(#chrome-edge-hotline-gradient)",
  "opacity": 0.42,
  "height_ratio": 1,
  "mask_ref": "silver-rim-layer",
  "blend": "screen",
  "visible": true
},
{
  "id": "chrome-top-edge-shadowline-layer",
  "type": "rect-fill",
  "paint": "url(#chrome-edge-shadowline-gradient)",
  "opacity": 0.26,
  "height_ratio": 1,
  "mask_ref": "silver-rim-layer",
  "blend": "multiply",
  "visible": true
}

Then use the same idea on the full chrome stack:

{
  "id": "chrome-stack-edge-hotline-layer",
  "type": "rect-fill",
  "paint": "url(#chrome-edge-hotline-gradient)",
  "opacity": 0.18,
  "height_ratio": 1,
  "mask": "chrome_stack",
  "blend": "screen",
  "visible": true
},
{
  "id": "chrome-stack-edge-shadowline-layer",
  "type": "rect-fill",
  "paint": "url(#chrome-edge-shadowline-gradient)",
  "opacity": 0.16,
  "height_ratio": 1,
  "mask": "chrome_stack",
  "blend": "multiply",
  "visible": true
}

This will make the top, inner taper, and outer taper feel like one continuous metal object instead of three unrelated gray bands.

Fourth change: expose bevel-ramp masks globally

Right now mask_ref works well for normal stroke layers like silver-rim-layer, because band_masks_svg() creates masks for stroke layers with mask: "outside_fill".

But inner-silver-down-ramp-layer and outer-silver-down-ramp-layer are bevel-ramp layers. Their masks are created locally inside bevel_ramp_layer_svg(), not globally as *-band-mask.

That limits how easily you can target them with reflection layers.

In render_recipe.py, add a shared helper:

def layer_band_bounds(layer: dict[str, Any]) -> tuple[float, float] | None:
    if layer.get("type") == "bevel-ramp" and "start" in layer:
        start = float(layer["start"])
        end = float(layer.get("end", start + float(layer.get("thickness", 0))))
        return start, end
    if layer.get("mask") == "outside_fill" and ("start" in layer or "thickness" in layer):
        start = float(layer.get("start", 0))
        end = start + float(layer.get("thickness", 0))
        return start, end
    return None

Then update band_masks_svg() so it also creates masks for bevel-ramp layers:

def band_masks_svg(recipe, records, width, height, y):
    scope = recipe.get("css_scope", "melee3")
    masks = []
    for layer in recipe["layers"]:
        bounds = layer_band_bounds(layer)
        if not bounds:
            continue
        start, end = bounds
        layer_id = layer["id"]
        escaped_layer_id = escape(layer_id)
        if layer.get("type") == "stroke":
            outer_width = f"var({css_var(scope, layer_id, 'width')})"
            inner_width = f"var({css_var(scope, layer_id, 'inner-width')})"
        else:
            outer_width = fmt(2 * end)
            inner_width = fmt(2 * start)
        outer_attrs = (
            f' fill="none" stroke="white" stroke-width="{outer_width}"'
            f' stroke-linejoin="round" stroke-linecap="round"'
        )
        inner_attrs = (
            f' fill="black" stroke="black" stroke-width="{inner_width}"'
            f' stroke-linejoin="round" stroke-linecap="round"'
        )
        masks.append(
            f'''    <mask id="{escaped_layer_id}-band-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="{fmt(width)}" height="{fmt(height)}">
      <rect width="{fmt(width)}" height="{fmt(height)}" fill="black"/>
{use_nodes(records, y, outer_attrs)}
{use_nodes(records, y, inner_attrs)}
    </mask>'''
        )
    return "\n".join(masks)

Now you can add reflection layers directly to the inner and outer tapers:

{
  "id": "inner-ramp-hot-reflection-layer",
  "type": "rect-fill",
  "paint": "url(#chrome-hot-reflection-gradient)",
  "opacity": 0.32,
  "height_ratio": 1,
  "mask_ref": "inner-silver-down-ramp-layer",
  "blend": "screen",
  "visible": true
},
{
  "id": "inner-ramp-dark-reflection-layer",
  "type": "rect-fill",
  "paint": "url(#chrome-dark-reflection-gradient)",
  "opacity": 0.22,
  "height_ratio": 1,
  "mask_ref": "inner-silver-down-ramp-layer",
  "blend": "multiply",
  "visible": true
},
{
  "id": "outer-ramp-hot-reflection-layer",
  "type": "rect-fill",
  "paint": "url(#chrome-hot-reflection-gradient)",
  "opacity": 0.28,
  "height_ratio": 1,
  "mask_ref": "outer-silver-down-ramp-layer",
  "blend": "screen",
  "visible": true
},
{
  "id": "outer-ramp-dark-reflection-layer",
  "type": "rect-fill",
  "paint": "url(#chrome-dark-reflection-gradient)",
  "opacity": 0.26,
  "height_ratio": 1,
  "mask_ref": "outer-silver-down-ramp-layer",
  "blend": "multiply",
  "visible": true
}

That is the main material fix.

Fifth change: make taper highlights contour-based

The strongest version is not a single diagonal gradient clipped to the taper. The strongest version is a distance-from-red contour bevel.

Your current bevel-ramp is scene-gradient based. It says: “fill the whole ramp with a diagonal gradient.”

A better bevel says: “at distance 1 from the red fill, use dark contact shadow; at distance 3, use mid steel; at distance 5, use white highlight; at distance 7, blend into top chrome.”

That follows the actual glyph contour. It will look much more 3D on curves like @, O, C, and Q.

You can fake this immediately with thin stroke bands:

{
  "id": "inner-ramp-red-contact-blackline-layer",
  "type": "stroke",
  "paint": "#020304",
  "start": 1,
  "thickness": 0.75,
  "opacity": 0.58,
  "dx": 0.25,
  "dy": 0.45,
  "mask": "outside_fill",
  "visible": true
},
{
  "id": "inner-ramp-mid-hotline-layer",
  "type": "stroke",
  "paint": "url(#chrome-edge-hotline-gradient)",
  "start": 4.8,
  "thickness": 0.9,
  "opacity": 0.62,
  "dx": 0,
  "dy": 0,
  "mask": "outside_fill",
  "visible": true
},
{
  "id": "inner-ramp-top-hotline-layer",
  "type": "stroke",
  "paint": "#ffffff",
  "start": 6.75,
  "thickness": 0.65,
  "opacity": 0.72,
  "dx": -0.25,
  "dy": -0.35,
  "mask": "outside_fill",
  "visible": true
}

And for the outer taper:

{
  "id": "outer-ramp-top-hotline-layer",
  "type": "stroke",
  "paint": "#ffffff",
  "start": 29.35,
  "thickness": 0.75,
  "opacity": 0.68,
  "dx": -0.25,
  "dy": -0.35,
  "mask": "outside_fill",
  "visible": true
},
{
  "id": "outer-ramp-falloff-shadow-layer",
  "type": "stroke",
  "paint": "#020304",
  "start": 36.8,
  "thickness": 1.1,
  "opacity": 0.5,
  "dx": 0.4,
  "dy": 0.55,
  "mask": "outside_fill",
  "visible": true
}

These thin contour strokes will do more for perceived 3D than another smooth gradient.

Important app issue

In main.js, your bevel-ramp controls currently expose this:

recipeSlider(layer.id, "dx_start", "Dx Start", ...)
recipeSlider(layer.id, "dy_start", "Dy Start", ...)

and:

recipeSlider(layer.id, "dx_end", "Dx End", ...)
recipeSlider(layer.id, "dy_end", "Dy End", ...)

But render_recipe.py does not use dx_start, dy_start, dx_end, or dy_end inside bevel_ramp_layer_svg().

So those controls are not changing the render meaningfully.

For taper tuning, expose these instead:

recipeSlider(layer.id, "start", "Start", recipe.start ?? 0, 0, 40, 0.25)
recipeSlider(layer.id, "end", "End", recipe.end ?? 8, 0, 48, 0.25)

Or better: expose the taper stops in the Chrome editor. Right now chromeLayers() only includes layers whose paint points to a global gradient:

const gradientKey = gradientKeyFromPaint(layer.paint);

But your taper layers use inline stops, not paint.

That means the UI is not really set up to tune the taper material yet.

Tuning order

Use this order:

1. Make chrome_top harsher: more white, more black, less middle gray.
2. Raise chrome-hot-reflection-layer and chrome-dark-reflection-layer opacity.
3. Raise the chrome stack reflection layers so the tapers receive the same material language.
4. Replace smooth gray taper stops with chrome-like broken stops.
5. Add contour hotline/shadowline strokes at the taper boundaries.
6. Expose bevel-ramp masks globally so mask_ref can target inner and outer taper layers.
7. Only after that, tune extrusion depth and red gloss.

The key principle: do not try to make the taper shiny by making it lighter. Make it shiny by giving it the same black/white reflection cuts as the main chrome face.