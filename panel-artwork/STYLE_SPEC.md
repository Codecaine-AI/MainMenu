# Melee Right-Panel Diagram Style Spec
Synthesized from 4 independent vision reads of ~580 reference frames
(IMG_1793_right_menu_image_frames, real GameCube footage of SSBM menu).

## The one-line DNA
Frosted-glass monochrome schematic: milky-white embossed line-art with faint
translucent fills, rounded-everything containers, chunky bracketed labels,
soft bloom on every stroke — floating over the blue grid; the PANEL supplies
the color, the ART supplies no hue.

## Hard rules
1. **Monochrome artwork.** All strokes/fills are cool white (#dce6ff→#ffffff).
   Zero hue in the diagram itself (sole reference exception: the tiny red
   hinomaru). Theme color comes from the panel/frame behind it.
2. **Two alpha planes.** Strokes at ~75–90% white; interior "frosted glass"
   fills at ~10–25% white. Depth = alpha, never color or gradient.
3. **Rounded-rect containment.** The diagram lives inside its own
   rounded-rectangle frame (double outline: bright inner stroke + fainter
   offset outer stroke, "engraved glass" bevel). Generous inner margins
   (8–12% padding); artwork fills ~65–75% of its container.
4. **Chunky rounded geometry.** Capsules, rounded rects, circles. No sharp
   corners, no thin spindly detail. Icon abstraction level = early-2000s
   pictogram (mini controllers, TVs, flags).
5. **Labels are part of the schematic.** Short ALL-CAPS words in bracketed/
   boxed pills (ON, STEREO, MONO…), blocky squarish sans, rendered as frosted
   white shapes with the same emboss/bloom as the line art — not crisp text.
6. **Soft everywhere.** Every stroke carries a gaussian halo (modest additive
   glow); edges feathered 1–2px at display res. Nothing crisp vector-flat.
7. **Flat orthographic.** No isometric, no 3D rotation. Tilt/skew comes from
   the panel layer (side-menu already renders perspective), never baked in.
8. **No designed grain.** Speckle/moiré in footage is projection artifact.
   A whisper of noise (≤3%) is acceptable to kill digital flatness; no
   scanlines, no heavy grain.
9. **Line weight.** Uniform, medium-thin (≈2px at 278-wide panel scale,
   i.e. ~1/140 of art width), no taper. Double-stroke on containers only.
10. **Value range compressed high-key.** No true black in the art; darkest
    tone is the panel showing through.

## Numeric anchors (from footage sampling)
- Panel-region avg (blue menus): #818dc8 · highlights #c9d9f7
- Art line color target: #e8efff at 0.85α, bloom halo same hue, 0.3–0.4α
- Frosted fill: #ffffff at 0.10–0.22α

## Contribution-grid specific translation
GitHub-style heat levels survive, but expressed as frosted-glass alpha steps
(level 0 ≈ 6% white … level 4 ≈ 90% white) inside a rounded double-outline
frame, cells rounded, soft glow on hottest cells. Sits INSIDE the panel with
margins — never bleeding past the panel edge.
