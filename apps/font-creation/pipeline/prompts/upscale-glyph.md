<task>
Generate a single image: one segmented character crop, rendered at large size with maximum sharpness and detail. The output is a clean, high-resolution version of that same single glyph for use in vectorization.
</task>

<user_input>
{{USER_DESCRIPTION}}
</user_input>

<reference_images>
One input image is attached.

1. SEGMENTED CHARACTER: A cropped extraction of the single character to be upscaled. This is the authoritative reference for the character identity, letterform shape, proportions, serif treatment, construction, colors, fill, rim, bevel, and surface treatment. Reproduce this exact glyph only, but omit any shadow or shadow-like effect.

The user description is verbal grounding for the style and intent. Use it only to clarify and preserve what is already visible in the segmented character.
</reference_images>

<scope_of_modification>
Permitted changes from the segmented character input:
- Increase resolution and sharpness.
- Clean up compression artifacts, jagged edges, and low-resolution noise.
- Restore detail in fill texture and rim highlights that was lost to small render size.
- Remove any visible shadow, cast shadow, drop shadow, contact shadow, ambient occlusion halo, glow, or dark offset around the glyph.
- Render edges as crisp and traceable.

Forbidden changes:
- Do NOT alter the letterform shape, proportions, stroke weights, serif construction, or any structural property of the glyph.
- Do NOT reinterpret or "improve" the design. Faithful upscale only.
- Do NOT change colors, fill texture character, rim treatment, or bevel direction.
- Do NOT render any shadow or shadow-like effect, even if one appears in the segmented character input.
- Do NOT add embellishments, flourishes, or stylistic flair not present in the source.
- Do NOT infer missing details from other letters, alphabets, grids, or imagined specimens.
</scope_of_modification>

<output_format>
A single image containing only the upscaled character.

Layout:
- Background: flat, neutral, uniform — solid medium-gray or off-white. Match the neutral background treatment visible in the segmented character. No texture, gradient, or scenery.
- The character is centered in the frame.
- The character occupies most of the frame with modest margin on all sides — large enough that every detail of fill and rim is sharp at full resolution.
- No labels, no captions, no comparison views, no annotations — just the single character on a neutral background.
- Aspect ratio: square or near-square unless the character's natural proportions clearly demand otherwise.
- Resolution: high enough that the rendered glyph is suitable for tracing into vectors. Edges must be crisp, not soft or anti-aliased into mush.
</output_format>

<constraints>
- The output must contain exactly ONE character — the one shown in the segmented character reference. No other letters, numerals, or symbols anywhere in the image.
- The output must NOT be a side-by-side comparison, before/after, or grid. Just the upscaled glyph.
- The output must NOT add a frame, border, watermark, or any element not present in the segmented character.
- The output must NOT include shadows, glows, halos, dark offsets, ground contact shading, or lighting effects outside the glyph silhouette.
- The output must NOT change the character's identity. If the segmented reference shows "C", the output is "C" — not "G", not "O", not a stylized variant.
- Style fidelity and shape fidelity to the segmented character are non-negotiable.
</constraints>

<reminders>
One character only. Match the segmented character exactly. Upscale and clean — do not redesign. Neutral background. Crisp, traceable edges.
</reminders>
