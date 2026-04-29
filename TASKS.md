The current renderer is close. The remaining issue is not the extrusion anymore. It is material continuity across the taper.

Three things are making the taper feel slightly disjointed:

1. Two old raised lip layers are still active.
    inner-highlight-layer and inner-shadow-layer still use filter: "chrome_bevel". That makes the taper read like it becomes raised again at the seam.
2. The ramp colors do not match the top chrome face.
    Your ramp ends at pure white or near-black, while silver-rim-layer uses the much more varied chrome_top gradient. So some sections match and some sections break, depending on where the global gradient happens to land.
3. The top chrome has reflections, but the ramps mostly do not.
    chrome-dark-reflection-layer and chrome-hot-reflection-layer are clipped only to silver-rim-layer. The ramps therefore read as a different material.

The fix is: disable the remaining raised lip layers, soften the ramp color range, add seam-blend bands, and add a very subtle chrome-stack reflection pass.

⸻

1. Disable the remaining old raised lip layers

In layer-recipe.json, change these two layers:

{
  "id": "inner-shadow-layer",
  "visible": false
}
{
  "id": "inner-highlight-layer",
  "visible": false
}

Do not keep chrome_bevel active on these. They are the main reason the bevel still feels like it dips down and rises back up.

The ramp should be the taper. The top face should be the only raised chrome face.

⸻

2. Replace the inner ramp stops

Your current inner ramp ends too white. Replace inner-silver-down-ramp-layer with this:

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
    {
      "offset": "0%",
      "color": "#162027",
      "opacity": 1
    },
    {
      "offset": "18%",
      "color": "#34444d",
      "opacity": 1
    },
    {
      "offset": "38%",
      "color": "#74818a",
      "opacity": 1
    },
    {
      "offset": "58%",
      "color": "#b7c1c8",
      "opacity": 1
    },
    {
      "offset": "78%",
      "color": "#dce4e8",
      "opacity": 1
    },
    {
      "offset": "100%",
      "color": "#edf3f6",
      "opacity": 1
    }
  ],
  "visible": true
}

This still rises toward the top face, but it no longer ends in pure white. Pure white makes the ramp visually detach from the main chrome face.

⸻

3. Replace the outer ramp stops

Replace outer-silver-down-ramp-layer with this:

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
    {
      "offset": "0%",
      "color": "#edf3f6",
      "opacity": 1
    },
    {
      "offset": "18%",
      "color": "#dce4e8",
      "opacity": 1
    },
    {
      "offset": "40%",
      "color": "#a4afb7",
      "opacity": 1
    },
    {
      "offset": "62%",
      "color": "#65747d",
      "opacity": 1
    },
    {
      "offset": "82%",
      "color": "#2a363e",
      "opacity": 1
    },
    {
      "offset": "100%",
      "color": "#10181e",
      "opacity": 1
    }
  ],
  "visible": true
}

The outer taper should descend into darkness, but not hit full black inside the silver material. The black should be reserved for contact cuts and cast shadows.

⸻

4. Add seam-blend layers

These bands make the ramp transition into the main chrome face using the same paint as the top chrome. That is the color-matching move.

Add these immediately after silver-rim-layer and before the reflection layers:

{
  "id": "inner-ramp-top-face-blend-layer",
  "type": "stroke",
  "paint": "url(#chrome-top-gradient)",
  "start": 6.85,
  "thickness": 1.05,
  "opacity": 0.52,
  "dx": 0,
  "dy": 0,
  "mask": "outside_fill",
  "visible": true
},
{
  "id": "outer-ramp-top-face-blend-layer",
  "type": "stroke",
  "paint": "url(#chrome-top-gradient)",
  "start": 29.15,
  "thickness": 1.05,
  "opacity": 0.46,
  "dx": 0,
  "dy": 0,
  "mask": "outside_fill",
  "visible": true
}

These should not have filter: "chrome_bevel". They are not raised surfaces. They are material transition bands.

⸻

5. Add low-side taper contact shadows

Add these after the seam-blend layers:

{
  "id": "inner-ramp-low-contact-layer",
  "type": "stroke",
  "paint": "#030506",
  "start": 1,
  "thickness": 0.75,
  "opacity": 0.28,
  "dx": 0.55,
  "dy": 0.75,
  "mask": "outside_fill",
  "visible": true
},
{
  "id": "outer-ramp-low-contact-layer",
  "type": "stroke",
  "paint": "#030506",
  "start": 37.75,
  "thickness": 0.85,
  "opacity": 0.36,
  "dx": 0.8,
  "dy": 1.05,
  "mask": "outside_fill",
  "visible": true
}

These define the bottom of the taper. The bevel now has:

top-face blend → smooth taper → low contact shadow

instead of:

taper → raised lip → outline

⸻

6. Add subtle stack-wide reflections

Your current reflections are only on silver-rim-layer:

"mask_ref": "silver-rim-layer"

Keep those. But add a very subtle reflection over the whole chrome stack so the ramps share the same material environment.

Add these after the existing top-face reflection layers:

{
  "id": "chrome-stack-soft-dark-reflection-layer",
  "type": "rect-fill",
  "paint": "url(#chrome-dark-reflection-gradient)",
  "opacity": 0.1,
  "height_ratio": 1,
  "mask": "chrome_stack",
  "blend": "multiply",
  "visible": true
},
{
  "id": "chrome-stack-soft-hot-reflection-layer",
  "type": "rect-fill",
  "paint": "url(#chrome-hot-reflection-gradient)",
  "opacity": 0.14,
  "height_ratio": 1,
  "mask": "chrome_stack",
  "blend": "screen",
  "visible": true
}

Keep these subtle. This is just to unify the ramp and top face. If it goes above 0.2, it will flatten the bevel again.

⸻

7. Current layer order should become this

The chrome portion should be ordered like this:

[
  "chrome-extrusion-shadow-layer",
  "chrome-extrusion-stack-layer",
  "edge-shadow-layer",
  "inner-silver-down-ramp-layer",
  "outer-silver-down-ramp-layer",
  "silver-rim-layer",
  "inner-ramp-top-face-blend-layer",
  "outer-ramp-top-face-blend-layer",
  "chrome-dark-reflection-layer",
  "chrome-hot-reflection-layer",
  "chrome-stack-soft-dark-reflection-layer",
  "chrome-stack-soft-hot-reflection-layer",
  "inner-ramp-low-contact-layer",
  "outer-ramp-low-contact-layer",
  "red-lip-boundary-layer",
  "fill-layer",
  "red-contact-shadow-layer",
  "red-contact-core-shadow-layer"
]

Do not render these anymore:

"inner-shadow-layer"
"inner-highlight-layer"

Those are the old raised bands.

⸻

8. Add UI labels if needed

In main.js, add these to layerPresentation:

  "inner-ramp-top-face-blend-layer": {
    order: 66,
    category: "Chrome Ramps",
    name: "Inner Ramp Top Blend",
    role: "matches inner taper into top chrome",
  },
  "outer-ramp-top-face-blend-layer": {
    order: 67,
    category: "Chrome Ramps",
    name: "Outer Ramp Top Blend",
    role: "matches outer taper into top chrome",
  },
  "inner-ramp-low-contact-layer": {
    order: 88,
    category: "Chrome Ramps",
    name: "Inner Ramp Low Contact",
    role: "dark low edge of inner taper",
  },
  "outer-ramp-low-contact-layer": {
    order: 89,
    category: "Chrome Ramps",
    name: "Outer Ramp Low Contact",
    role: "dark low edge of outer taper",
  },
  "chrome-stack-soft-dark-reflection-layer": {
    order: 68,
    category: "Chrome Reflection",
    name: "Stack Dark Reflection",
    role: "subtle reflection shared by all chrome",
  },
  "chrome-stack-soft-hot-reflection-layer": {
    order: 69,
    category: "Chrome Reflection",
    name: "Stack Hot Reflection",
    role: "subtle highlight shared by all chrome",
  },

⸻

Why this should fix the “almost perfect but weird” issue

A single global gradient will never perfectly follow every curve of the glyph. Some sections will look correct and others will feel wrong. That is what you are seeing.

The practical fix is not to make the ramp gradient more dramatic. It is to make the ramp gradient less opinionated, then use:

top-face blend bands
+
low-side contact shadows
+
subtle shared reflection

That makes the taper consistent across all curves without exposing the fact that the gradient is global.

The next render should look less segmented, less “painted,” and more like one continuous chrome bevel sloping down from the top face.