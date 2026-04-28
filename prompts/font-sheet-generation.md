<task>
Generate a single image: a complete font specimen sheet rendering every required character in the exact letterform style of the provided reference images. The specimen becomes source material for vectorizing the typeface, so every glyph must be consistent, legible, sharp, and faithful to the reference style.
</task>

<user_input>
{{USER_DESCRIPTION}}
</user_input>

<mode>
{{MODE}}
</mode>

<reference_images>
The user has attached one or more images showing the target style applied to a limited set of characters. Treat these as the ground truth for letterform shape and surface treatment. Background and environmental lighting in the references are NOT part of the target style — ignore them.
</reference_images>

<style_extraction>
Before rendering, internally identify these attributes from the references. Do not output this analysis — use it to constrain generation:

1. Letterform skeleton: serif / sans-serif / slab / display. Stroke contrast (uniform vs modulated). Proportions (condensed / normal / extended). Weight.
2. Surface treatment of the letter interior: solid color, gradient, texture, image fill, pattern. Note exact colors and how the fill varies across a single letter.
3. Border/rim treatment: presence, thickness, color, gradient direction, bevel, highlight placement.
4. Depth effects: drop shadow (offset, blur, color, opacity), inner shadow, 3D extrusion, glow.
5. Spacing and baseline behavior visible in the reference.

If the reference shows only some characters, extrapolate the style consistently to characters not shown. Curves, diagonals, and shapes absent from the reference (e.g., Q, R, S, &, %) must be invented in a way visually coherent with what is shown.
</style_extraction>

<character_set>
Render every character required by the active mode. Omit nothing.

If MODE is "uppercase":
Row 1: A B C D E F G H I J K L M
Row 2: N O P Q R S T U V W X Y Z
Row 3: 0 1 2 3 4 5 6 7 8 9
Row 4: . , : ; ! ? ' " ( ) [ ] { } - – —
Row 5: & @ # $ % * + = / \ < > | ^ ~ `

If MODE is "full":
Row 1: A B C D E F G H I J K L M
Row 2: N O P Q R S T U V W X Y Z
Row 3: a b c d e f g h i j k l m
Row 4: n o p q r s t u v w x y z
Row 5: 0 1 2 3 4 5 6 7 8 9
Row 6: . , : ; ! ? ' " ( ) [ ] { } - – —
Row 7: & @ # $ % * + = / \ < > | ^ ~ `

In "uppercase" mode, do not produce any lowercase letterforms anywhere in the specimen.
</character_set>

<output_format>
A single image, landscape orientation, sufficient resolution that every glyph is sharp and individually traceable.

Layout:
- Background: flat, neutral, uniform — solid medium-gray or off-white. Choose whichever provides maximum contrast against the reference style's letter colors. The background must NOT contain texture, gradient, lighting effects, or scenery. The specimen is a working artifact, not a poster.
- Rows evenly spaced vertically.
- Within each row, characters evenly spaced horizontally with consistent baseline.
- Each character rendered at the same size as its row-mates.
- Letter rows render at one size; numerals, punctuation, and symbols may render at proportionally appropriate sizes for that category.
- No row labels, no captions, no decorative framing — just the characters on the neutral background.
- Every character receives the full style treatment: same fill, same rim, same shadow, same depth as the reference.
</output_format>

<constraints>
- The specimen must NOT default to a generic stylized font (no "fancy serif," no "video game logo font," no "metallic chrome alphabet"). Every letterform attribute is dictated by the references.
- The specimen must NOT show only the characters in the reference. Render every character required by the active mode.
- The specimen must NOT vary style mid-sheet. Every glyph receives identical treatment.
- The specimen must NOT reproduce the reference's background, lighting, or environmental effects. The specimen background is always neutral and flat.
- The specimen must NOT add narrative elements (no logos, mascots, scenery, decorative borders).
- Where the reference is ambiguous, prioritize internal consistency of the specimen over speculative interpretation.
- Letterforms must remain legible. Stylistic effects do not override glyph recognizability.
</constraints>

<reminders>
Match every letterform attribute of the references. Ignore reference backgrounds. Render every character required by the active mode. Same style across every glyph. Neutral background. No generic fallbacks.
</reminders>