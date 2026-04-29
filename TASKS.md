Your current renderer is close, but the wrong part is being “raised.”

In your implementation, relief height only feeds the generated lighting PNG overlays. It does not move the SVG geometry upward. The only things that create actual visible depth are:

1. chrome-extrusion-stack-layer
2. chrome-extrusion-shadow-layer
3. projected-shadow layers
4. the contrast of chrome_normal_shadow, chrome_normal_highlight, ambient_occlusion, and chrome_reflection

So if you only increase relief.height, height_to, or height_scale, it can still look flat because the silhouette and cast depth barely change.

The main hidden issue

In render_recipe.py, your height map is rendered at resolution_scale, but the normal gradient is computed in raster pixels:

dy, dx = np.gradient(height_map)

At resolution_scale: 3, your slope gets visually diluted by roughly 3x. Your height field is in SVG units, but the gradient is measured in scaled pixels.

Patch this first.

Patch normal_from_height

Replace:

def normal_from_height(height_map: Any, normal_strength: float, gradient_clip: float | None = None) -> Any:
    import numpy as np
    dy, dx = np.gradient(height_map)

with:

def normal_from_height(
    height_map: Any,
    normal_strength: float,
    gradient_clip: float | None = None,
    sample_scale: float = 1.0,
) -> Any:
    import numpy as np
    dy, dx = np.gradient(height_map)
    # Convert raster-pixel gradient back into SVG-unit gradient.
    # Without this, resolution_scale=2 or 3 makes steep bevels look flatter.
    dx *= sample_scale
    dy *= sample_scale

Then update compute_lighting_maps:

def compute_lighting_maps(height_map: Any, masks: dict[str, Any], recipe: dict[str, Any], sample_scale: float = 1.0) -> dict[str, Any]:

And change the normal call:

normal = normal_from_height(
    normal_source,
    float(lighting.get("normal_strength", 2.4)),
    float(lighting.get("normal_gradient_clip", 0)) or None,
    sample_scale,
)

Also fix the AO edge calculation in the same function. Replace:

dy, dx = np.gradient(normal_source)
edge = np.hypot(dx, dy)

with:

dy, dx = np.gradient(normal_source)
dx *= sample_scale
dy *= sample_scale
edge = np.hypot(dx, dy)

Finally, update the call in generate_lighting_overlays:

maps = compute_lighting_maps(height_map, masks, recipe, scale)

That one change should make your existing bevel read much steeper.

⸻

Then make the depth visible

Your current values are too polite. The bevel exists, but the shadows and sidewall do not assert height strongly enough.

In layer-recipe.json, start with this lighting block:

"lighting": {
  "enabled": true,
  "resolution_scale": 3,
  "curve_steps": 32,
  "embed_images": true,
  "mask_pad": 180,
  "max_overlay_size": 4096,
  "glyph_max_overlay_size": 2400,
  "normal_height_scale": 1.25,
  "normal_blur_sigma": 0.18,
  "normal_gradient_clip": 18,
  "debug": true,
  "debug_labels": ["at", "CODECAINE"],
  "light": {
    "x": -0.9,
    "y": -1.15,
    "z": 0.85
  },
  "view": {
    "x": 0,
    "y": 0,
    "z": 1
  },
  "normal_strength": 3.8,
  "ambient": 0.28,
  "diffuse": 0.48,
  "specular": 1.65,
  "specular_power": 96,
  "chrome_shadow_opacity": 0.34,
  "chrome_highlight_opacity": 0.74,
  "ao_opacity": 0.46
}

The important changes are:

"ambient": 0.28

Lower ambient makes the side planes separate.

"normal_gradient_clip": 18

Your current 9 clamps the steepness. Once the ramp gets steep, raising height stops mattering because the slope is clipped.

"chrome_shadow_opacity": 0.34
"ao_opacity": 0.46

The bevel needs more dark contact. “Raised” is mostly shadow discipline.

⸻

Make the chrome sidewall deeper

Your extrusion is the part that actually changes the silhouette. Increase it.

Change this layer:

{
  "id": "chrome-extrusion-shadow-layer",
  "type": "chrome-extrude",
  "paint": "#020304",
  "opacity": 0.72,
  "steps": 12,
  "step_dx": 1.05,
  "step_dy": 1.22,
  "start_opacity": 0.2,
  "end_opacity": 0.05,
  "visible": true
}

to:

{
  "id": "chrome-extrusion-shadow-layer",
  "type": "chrome-extrude",
  "paint": "#020304",
  "opacity": 0.9,
  "steps": 20,
  "step_dx": 1.25,
  "step_dy": 1.5,
  "start_opacity": 0.3,
  "end_opacity": 0.08,
  "visible": true
}

Then change:

{
  "id": "chrome-extrusion-stack-layer",
  "type": "chrome-extrude",
  "paint": "url(#chrome-extrude-depth-gradient)",
  "opacity": 1,
  "steps": 10,
  "step_dx": 0.9,
  "step_dy": 1.05,
  "start_opacity": 0.58,
  "end_opacity": 0.12,
  "filter": "extrusion_soften",
  "visible": true
}

to:

{
  "id": "chrome-extrusion-stack-layer",
  "type": "chrome-extrude",
  "paint": "url(#chrome-extrude-depth-gradient)",
  "opacity": 1,
  "steps": 18,
  "step_dx": 1.08,
  "step_dy": 1.32,
  "start_opacity": 0.72,
  "end_opacity": 0.16,
  "filter": "extrusion_soften",
  "visible": true
}

That will make the chrome body visibly project down and right instead of only glowing on the surface.

⸻

Strengthen the cast shadow

This is the second major “pop” source.

Change:

{
  "id": "outer-chrome-cast-shadow-on-background-layer",
  "opacity": 0.1,
  "dx": 7.2,
  "dy": 9.5,
  "blur": 7.2
}

to:

{
  "id": "outer-chrome-cast-shadow-on-background-layer",
  "opacity": 0.22,
  "dx": 12,
  "dy": 15,
  "blur": 10.5
}

Then raise the internal red-contact shadows:

{
  "id": "inner-chrome-cast-shadow-on-red-layer",
  "opacity": 0.28,
  "dx": 4.6,
  "dy": 6.2,
  "blur": 2.8
}
{
  "id": "chrome-top-cast-shadow-on-red-layer",
  "opacity": 0.16,
  "dx": 4.4,
  "dy": 5.8,
  "blur": 5.6
}

Right now the red center does not believe the chrome rim is towering over it. These shadows fix that.

⸻

Use the angle formula correctly

For your bevel ramps, the apparent angle is controlled by this ratio:

angle = atan(height_delta / ramp_width)

Your current ramp widths are approximately:

inner ramp: 6.8 - 1 = 5.8
outer ramp: 38.4 - 30 = 8.4

For literal slope targets:

30°: height_delta ≈ width * 0.577
60°: height_delta ≈ width * 1.732
70°: height_delta ≈ width * 2.747

So for the outer ramp:

30° ≈ 4.8
60° ≈ 14.5
70° ≈ 23.1

Your current relief deltas are already larger than that:

"inner-ramp-relief": 0 -> 42
"outer-ramp-relief": 42 -> -4

So the issue is not that the mathematical height is too low. The issue is that the normal rendering, clipping, shadows, and extrusion are not making that height readable.

That is why increasing height_to alone does not solve it.

⸻

Use this relief preset after the normal-scale patch

After applying the sample_scale patch, use less absurd height but stronger contrast:

"relief": {
  "enabled": true,
  "height_scale": 72,
  "fill_height": 0,
  "background_height": -20,
  "bands": [
    {
      "id": "inner-ramp-relief",
      "layer_id": "inner-silver-down-ramp-layer",
      "role": "ramp",
      "height_from": 0,
      "height_to": 56,
      "crown": 0,
      "profile": "linear"
    },
    {
      "id": "chrome-top-relief",
      "layer_id": "silver-rim-layer",
      "role": "raised_plateau",
      "edge_height": 56,
      "height": 122,
      "shoulder_width_ratio": 0.045,
      "crown": 0,
      "profile": "linear"
    },
    {
      "id": "outer-ramp-relief",
      "layer_id": "outer-silver-down-ramp-layer",
      "role": "ramp",
      "height_from": 56,
      "height_to": -14,
      "crown": 0,
      "profile": "linear"
    }
  ]
}

The top becomes a flatter raised plateau, while the inner and outer ramps read as steep planes.

⸻

Make reflections help the shape

Your chrome reflection is good, but it is too restrained for a raised metal form.

Change:

"materials": {
  "chrome": {
    "reflection_enabled": true,
    "reflection_opacity": 0.58,
    "normal_warp_x": 0.08,
    "normal_warp_y": 0.16,
    "reflection_edge_guard_px": 4,
    "reflection_edge_feather_px": 10
  }
}

to:

"materials": {
  "chrome": {
    "reflection_enabled": true,
    "reflection_opacity": 0.68,
    "normal_warp_x": 0.16,
    "normal_warp_y": 0.3,
    "reflection_edge_guard_px": 2,
    "reflection_edge_feather_px": 6
  }
}

This makes the angled side planes bend the environment harder, which sells steepness.

⸻

The practical tuning order

Do it in this order:

1. Patch the normal scale bug in render_recipe.py.
2. Increase extrusion steps and offsets.
3. Strengthen cast shadows.
4. Lower ambient and increase AO/shadow overlays.
5. Raise normal_gradient_clip.
6. Only then adjust relief heights.

The biggest visual win will come from steps 1, 2, and 3.

One more important point: your lighting overlays are baked into the generated SVG as embedded PNGs. So changes to relief, normal strength, light direction, reflection warp, or resolution will not fully update live in the app. You need to hit Save/regenerate to see the actual bevel steepness.