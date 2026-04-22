<purpose>
Compose accepted asset implementations back into a full-screen recreation that matches the source screenshot while preserving the integrity of already-accepted per-asset components.
</purpose>

<rules>
- Treat accepted asset components as inputs, not disposable sketches.
- Focus on placement, scale, z-order, spacing, overlap, and screen-level effects.
- Do not rewrite the internals of an accepted asset unless the loop explicitly reopens that asset.
- Use the source screenshot as the composition ground truth.
- If the background is video-backed, preserve the chosen background treatment and judge the composition against a representative still plus any motion constraints.
</rules>

<inputs>
The loop provides:
1. `catalog.json`
2. accepted per-asset `component.html` and `component.css`
3. asset bounds and z-order metadata
4. the source screenshot
</inputs>

<output_contract>
Produce:
- `screen.html`
- `screen.css`

The composition should assemble accepted assets into the full screen with minimal extra structure beyond what the screen needs.
</output_contract>
