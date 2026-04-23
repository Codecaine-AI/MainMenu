// Isolated critic for the MELEE asset reconstruction loop.
//
// runCritique is a stateless one-shot pi-ai call: it receives the source
// screenshot, extracted reference, current render, extraction prompt, and
// asset.json, and returns a structured JSON issue list. The caller is the
// scoring authority — the main agent never writes prose critiques or self-
// scores; it executes whatever issues come back and renders again.

import { readFileSync } from "node:fs";

import {
  completeSimple,
  type Api,
  type Context,
  type Model,
} from "@mariozechner/pi-ai";

export type IssueSeverity = "blocking" | "major" | "minor";

export interface CritiqueIssue {
  id: string;
  region: string;
  severity: IssueSeverity;
  description: string;
  fix_hint: string;
}

export interface CritiqueResult {
  issues: CritiqueIssue[];
  verdict: string;
  raw: string;
}

export interface RunCritiqueInput {
  model: Model<Api>;
  auth: { apiKey?: string; headers?: Record<string, string> };
  sourcePngPath: string;
  extractedPngPath: string;
  renderPngPath: string;
  extractionPromptText: string;
  assetJson: string;
  signal?: AbortSignal;
}

const CRITIC_SYSTEM_PROMPT = `<role>
Art-director critic. You compare a rendered HTML/CSS implementation against an
extracted game asset reference and report visual defects as structured JSON.
You have no memory of prior critiques. Every call is fresh.
</role>

<inputs_you_receive>
1. source.png — original screenshot the asset was cut from. Ground truth for
   how the asset looks in situ. Use this when the extraction looks damaged,
   bled, or reconstructed wrong where foreground elements occluded regions.
2. extracted.png — isolated asset on a solid background. The primary reference
   the implementer is matching. Lossy: the extractor may mangle edges, drift
   colors slightly, or hallucinate reconstruction.
3. render.png — current HTML/CSS render.
4. extraction_prompt.txt — prompt used to generate extracted.png. Reveals
   whether source/extracted divergence is intentional.
5. asset.json — structured metadata. visual_description is authoritative for
   what the asset IS.
</inputs_you_receive>

<category_checks>
Walk these first. A category defect is blocking even if pixel-level regional
checks pass — a technically close match to the wrong genre is still the wrong
asset.

- Genre. Does the render read as the same KIND of object as the reference?
  MELEE assets have specific visual DNA: chunky borders, hard gradients,
  high-contrast fills, projected/tilted planes, glow used deliberately. A
  render that matches the color palette but reads as a generic modern UI
  panel (soft rounded corners, uniform pastel gradient, subtle drop shadow)
  is a blocking genre defect.

- Slop signatures. Flag any of these as blocking:
  - Left-border accent stripe with soft gradient fill behind it, when the
    reference has nothing of the kind.
  - Uniform single-direction gradient standing in for a specific multi-stop
    gradient in the reference.
  - SVG paths attempting to redraw complex illustration or photographic
    detail from the reference when a raster region would be honest.
  - Corner radius applied uniformly where the reference has mixed corners
    (square + rounded, concave + convex).
  - Outer drop shadow used as a substitute for the reference's specific
    glow treatment.

- Color sourcing. Sample dominant fill, border, and glow colors from the
  reference. If the render's values look plausible but do not match — even
  close — flag as color drift. Invented palettes are a blocking defect when
  they shift the asset's overall read, major when they only affect detail.

- Projection. If the reference reads as a tilted or foreshortened plane, does
  the render match the perspective? A front-on render of a tilted reference
  is a blocking projection defect.
</category_checks>

<regional_checks>
After category, walk these for every region of the asset. Compare render.png
against extracted.png (source.png is tiebreaker where extraction looks
damaged):

- Silhouette direction per edge. For top, bottom, left, right edges: does the
  reference have tabs, callouts, notches, flanges, or protrusions? For each
  feature, state whether it extends OUTward from the panel body or cuts
  INward, and whether the render matches. A tab drawn inverted is a blocking
  silhouette defect.
- Corners. For each of TL, TR, BL, BR: concave (inward indent), convex
  (outward bump), square, or rounded? Does the render match?
- Dimensional drift. Reference and render should be the same size. Measure
  any divergence in pixels along each edge.
- Borders and edges. Thickness, hardness, alpha artifacting.
- Gradients. Direction, stops, falloff. Multi-stop gradients must be
  multi-stop in the render.
- Shadows and glows. Spread, intensity, color.
- Internal structure. Inner shapes, dividers, ornaments.
- Text. Font, weight, stroke, shadow, color, position. Text must be live
  text in the render, not rasterized — if it looks rasterized, flag it.
- Interior fill. Color, any inner gradient or texture.
</regional_checks>

<non_issues>
Do not flag:
- Honest raster placeholders for sub-details the implementer could not
  recreate (complex illustration, character portraits, specific iconography).
  These will be declared in the implementation's accept notes. Judge only
  their color block and size, not their content.
- Subpixel differences in antialiasing that are invisible at native size.
- Font hinting differences when the correct font family is rendering.
- Minor wrapper-level whitespace as long as the asset bounds are correct.

If you are unsure whether something is a real defect vs. an artifact of
extraction or rendering, check source.png. If the feature is present in the
source but not in extracted.png, the extractor is at fault and the render
should match source.png.
</non_issues>

<severity_rules>
- blocking: genre defect, slop signature, silhouette-direction mismatch,
  wrong projection, inverted corner, missing required structural element,
  wrong aspect ratio, color drift that shifts the asset's overall read.
- major: clearly visible color drift in detail, missing visual layer (glow,
  inner shadow, specific border treatment), dimensional drift >4px on any
  edge, wrong text position, rasterized text that should be live.
- minor: small color drift, soft gradient falloff mismatch, subpixel edge
  softness, small text-shadow differences.

If you are unsure whether something is a defect, err toward reporting it.
False positives are cheap; silent failures are expensive.
</severity_rules>

<reply_format>
Return a single JSON object and nothing else — no prose before or after, no
markdown fences. Shape:

{
  "verdict": "one sentence overall read of the match",
  "issues": [
    {
      "id": "I1",
      "region": "genre" | "slop" | "projection" | "top_edge" | "bottom_edge" | "left_edge" | "right_edge" | "top_left_corner" | "top_right_corner" | "bottom_left_corner" | "bottom_right_corner" | "tab_callout" | "interior_fill" | "border" | "glow" | "shadow" | "text" | "gradient" | "dimensional" | "color" | "other",
      "severity": "blocking" | "major" | "minor",
      "description": "what is wrong, named concretely",
      "fix_hint": "one-sentence suggestion; the implementer picks the actual fix"
    }
  ]
}

When the render matches the reference well enough to ship, return:
{ "verdict": "...", "issues": [] }

An empty issues array is the convergence signal. Use it only when you have
actually walked every category check AND every regional check and found no
defect worth reporting.
</reply_format>`;

const REPLY_INSTRUCTION = `Walk every check in <what_to_check> against the three images. Return the JSON object described in <reply_format>. No prose, no markdown fences — JSON only.`;

export async function runCritique(
  input: RunCritiqueInput,
): Promise<CritiqueResult> {
  const sourceBase64 = readFileSync(input.sourcePngPath).toString("base64");
  const extractedBase64 = readFileSync(input.extractedPngPath).toString(
    "base64",
  );
  const renderBase64 = readFileSync(input.renderPngPath).toString("base64");

  const userText = [
    "Images follow in this order: source screenshot, extracted reference, current render.",
    "",
    "extraction_prompt.txt:",
    input.extractionPromptText.trim(),
    "",
    "asset.json:",
    input.assetJson.trim(),
    "",
    REPLY_INSTRUCTION,
  ].join("\n");

  const context: Context = {
    systemPrompt: CRITIC_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "source.png (ground truth in situ):" },
          { type: "image", data: sourceBase64, mimeType: "image/png" },
          { type: "text", text: "extracted.png (primary reference):" },
          { type: "image", data: extractedBase64, mimeType: "image/png" },
          { type: "text", text: "render.png (current implementation):" },
          { type: "image", data: renderBase64, mimeType: "image/png" },
          { type: "text", text: userText },
        ],
        timestamp: Date.now(),
      },
    ],
  };

  const first = await completeSimple(input.model, context, {
    apiKey: input.auth.apiKey,
    headers: input.auth.headers,
    reasoning: "high",
    signal: input.signal,
  });
  const firstText = extractText(first.content);
  const firstParsed = tryParse(firstText);
  if (firstParsed) {
    return { ...firstParsed, raw: firstText };
  }

  // One retry with stricter instruction.
  const retryContext: Context = {
    systemPrompt: CRITIC_SYSTEM_PROMPT,
    messages: [
      ...context.messages,
      {
        role: "assistant",
        content: [{ type: "text", text: firstText }],
        api: first.api,
        provider: first.provider,
        model: first.model,
        usage: first.usage,
        stopReason: first.stopReason,
        timestamp: Date.now(),
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text: "Your previous reply was not valid JSON. Return the JSON object described in <reply_format> and nothing else. No prose, no markdown fences.",
          },
        ],
        timestamp: Date.now(),
      },
    ],
  };

  const second = await completeSimple(input.model, retryContext, {
    apiKey: input.auth.apiKey,
    headers: input.auth.headers,
    reasoning: "high",
    signal: input.signal,
  });
  const secondText = extractText(second.content);
  const secondParsed = tryParse(secondText);
  if (secondParsed) {
    return { ...secondParsed, raw: secondText };
  }

  return {
    issues: [
      {
        id: "I1",
        region: "other",
        severity: "blocking",
        description: `Critic returned unparseable JSON twice. Raw reply: ${truncate(secondText, 400)}`,
        fix_hint:
          "Render again and call critique; the next critic call starts fresh.",
      },
    ],
    verdict: "Critic parse failure — treat as unconverged.",
    raw: secondText,
  };
}

function extractText(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((c) => c.type === "text" && typeof c.text === "string")
    .map((c) => c.text as string)
    .join("\n")
    .trim();
}

function tryParse(text: string): Omit<CritiqueResult, "raw"> | null {
  const stripped = stripFences(text).trim();
  const jsonCandidate = extractJsonObject(stripped);
  if (!jsonCandidate) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCandidate);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const obj = parsed as Record<string, unknown>;
  const verdict = typeof obj.verdict === "string" ? obj.verdict : "";
  const rawIssues = Array.isArray(obj.issues) ? obj.issues : null;
  if (rawIssues === null) return null;
  const issues: CritiqueIssue[] = [];
  for (let i = 0; i < rawIssues.length; i++) {
    const normalized = normalizeIssue(rawIssues[i], i);
    if (normalized) issues.push(normalized);
  }
  return { verdict, issues };
}

function normalizeIssue(raw: unknown, index: number): CritiqueIssue | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const severity = normalizeSeverity(r.severity);
  if (!severity) return null;
  return {
    id: typeof r.id === "string" && r.id.length > 0 ? r.id : `I${index + 1}`,
    region:
      typeof r.region === "string" && r.region.length > 0 ? r.region : "other",
    severity,
    description: typeof r.description === "string" ? r.description : "",
    fix_hint: typeof r.fix_hint === "string" ? r.fix_hint : "",
  };
}

function normalizeSeverity(v: unknown): IssueSeverity | null {
  if (v === "blocking" || v === "major" || v === "minor") return v;
  return null;
}

function stripFences(text: string): string {
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/m;
  const match = text.trim().match(fence);
  return match ? match[1]! : text;
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}
