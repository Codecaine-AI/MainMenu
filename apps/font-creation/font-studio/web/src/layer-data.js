import { dom, recipeLayer, isLayerVisible } from "./state.js";
import { prettyLayerName } from "./utils.js";
import { layerPaint, gradientKeyFromPaint } from "./gradients.js";

export const layerPresentation = {
  "chrome-extrusion-shadow-layer": {
    order: 31,
    category: "Chrome Depth",
    name: "Extrusion Shadow",
    role: "deep lower-right cast body",
  },
  "chrome-extrusion-stack-layer": {
    order: 32,
    category: "Chrome Depth",
    name: "Extrusion Stack",
    role: "stepped metal sidewall depth",
  },
  "outer-chrome-cast-shadow-on-background-layer": {
    order: 33,
    category: "Lighting",
    name: "Outer Cast Shadow",
    role: "soft projection from raised chrome onto the background",
  },
  "fill-layer": {
    order: 10,
    category: "Interior",
    name: "Red Fill",
    role: "core color shape",
  },
  "red-enamel-basin-shadow-layer": {
    order: 11,
    category: "Interior",
    name: "Enamel Basin",
    role: "subtle lower enamel depth",
  },
  "red-enamel-gloss-layer": {
    order: 12,
    category: "Interior",
    name: "Enamel Gloss",
    role: "clearcoat sheen clipped to red fill",
  },
  "red-contact-shadow-layer": {
    order: 21,
    category: "Interior",
    name: "Red Contact Shadow",
    role: "soft shadow cast by raised chrome",
  },
  "red-contact-core-shadow-layer": {
    order: 22,
    category: "Interior",
    name: "Red Core Contact Shadow",
    role: "tight inner occlusion line",
  },
  "inner-chrome-cast-shadow-on-red-layer": {
    order: 23,
    category: "Lighting",
    name: "Inner Cast Shadow",
    role: "directional shadow cast by raised chrome onto red fill",
  },
  "chrome-top-cast-shadow-on-red-layer": {
    order: 24,
    category: "Lighting",
    name: "Top Cast Shadow",
    role: "soft top-rim projection onto the red enamel",
  },
  "chrome-normal-shadow-layer": {
    order: 76,
    category: "Lighting",
    name: "Chrome Normal Shadow",
    role: "height-map shadow overlay on chrome",
  },
  "chrome-environment-reflection-layer": {
    order: 76,
    category: "Chrome Reflection",
    name: "Environment Reflection",
    role: "normal-warped mirror environment across chrome",
  },
  "chrome-normal-highlight-layer": {
    order: 77,
    category: "Lighting",
    name: "Chrome Normal Highlight",
    role: "height-map specular overlay on chrome",
  },
  "ambient-occlusion-layer": {
    order: 78,
    category: "Lighting",
    name: "Ambient Occlusion",
    role: "tight relief darkening at height transitions",
  },
  "final-red-chrome-cut-layer": {
    order: 91,
    category: "Final Edge",
    name: "Red Chrome Cut",
    role: "final crisp separation between enamel and chrome",
  },
  "final-inner-chrome-hotline-layer": {
    order: 92,
    category: "Final Edge",
    name: "Inner Chrome Hotline",
    role: "final bright cut at inner chrome transition",
  },
  "final-outer-chrome-hotline-layer": {
    order: 93,
    category: "Final Edge",
    name: "Outer Chrome Hotline",
    role: "final bright cut at outer chrome transition",
  },
  "final-outer-silhouette-cut-layer": {
    order: 94,
    category: "Final Edge",
    name: "Outer Silhouette Cut",
    role: "final dark edge containment",
  },
  "final-outer-silhouette-hotline-layer": {
    order: 95,
    category: "Final Edge",
    name: "Outer Silhouette Hotline",
    role: "final polished rim highlight",
  },
  "inner-highlight-layer": {
    order: 50,
    category: "Chrome",
    name: "Inner Silver Lip",
    role: "light lip before chrome top",
  },
  "inner-shadow-layer": {
    order: 70,
    category: "Chrome",
    name: "Outer Silver Lip",
    role: "light lip after chrome top",
  },
  "inner-silver-down-ramp-layer": {
    order: 41,
    category: "Chrome Ramps",
    name: "Inner Silver Taper",
    role: "slopes from top chrome down toward red",
  },
  "inner-ramp-red-contact-blackline-layer": {
    order: 42,
    category: "Chrome Ramps",
    name: "Inner Red Contact",
    role: "dark contour where taper meets red",
  },
  "inner-ramp-mid-hotline-layer": {
    order: 43,
    category: "Chrome Ramps",
    name: "Inner Mid Hotline",
    role: "bright contour through the inner taper",
  },
  "inner-ramp-top-hotline-layer": {
    order: 44,
    category: "Chrome Ramps",
    name: "Inner Top Hotline",
    role: "hot contour into the chrome top face",
  },
  "red-lip-boundary-layer": {
    order: 30,
    category: "Separator",
    name: "Red Lip Boundary",
    role: "thin black line outside red",
  },
  "silver-rim-layer": {
    order: 60,
    category: "Chrome",
    name: "Chrome Top",
    role: "main reflective silver band",
  },
  "chrome-top-edge-hotline-layer": {
    order: 61,
    category: "Chrome Reflection",
    name: "Top Edge Hotline",
    role: "hard white edge reflection on the top chrome",
  },
  "chrome-top-edge-shadowline-layer": {
    order: 62,
    category: "Chrome Reflection",
    name: "Top Edge Shadowline",
    role: "dark containment edge on the top chrome",
  },
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
  "chrome-top-cast-shadow-on-lower-bevel-layer": {
    order: 69,
    category: "Lighting",
    name: "Lower Bevel Cast",
    role: "top chrome projection onto lower bevels",
  },
  "chrome-stack-edge-hotline-layer": {
    order: 70,
    category: "Chrome Reflection",
    name: "Stack Edge Hotline",
    role: "shared white edge reflection across all chrome",
  },
  "chrome-stack-edge-shadowline-layer": {
    order: 71,
    category: "Chrome Reflection",
    name: "Stack Edge Shadowline",
    role: "shared dark edge reflection across all chrome",
  },
  "inner-ramp-hot-reflection-layer": {
    order: 72,
    category: "Chrome Reflection",
    name: "Inner Ramp Hot Reflection",
    role: "white mirror cuts on the inner taper",
  },
  "inner-ramp-dark-reflection-layer": {
    order: 73,
    category: "Chrome Reflection",
    name: "Inner Ramp Dark Reflection",
    role: "dark mirror cuts on the inner taper",
  },
  "outer-ramp-hot-reflection-layer": {
    order: 74,
    category: "Chrome Reflection",
    name: "Outer Ramp Hot Reflection",
    role: "white mirror cuts on the outer taper",
  },
  "outer-ramp-dark-reflection-layer": {
    order: 75,
    category: "Chrome Reflection",
    name: "Outer Ramp Dark Reflection",
    role: "dark mirror cuts on the outer taper",
  },
  "chrome-dark-reflection-layer": {
    order: 63,
    category: "Chrome Reflection",
    name: "Dark Reflection",
    role: "dark mirror band on main chrome face",
  },
  "chrome-hot-reflection-layer": {
    order: 64,
    category: "Chrome Reflection",
    name: "Hot Reflection",
    role: "white mirror glints on main chrome face",
  },
  "outer-silver-down-ramp-layer": {
    order: 79,
    category: "Chrome Ramps",
    name: "Outer Silver Taper",
    role: "slopes from top chrome down toward outside wall",
  },
  "outer-ramp-top-hotline-layer": {
    order: 80,
    category: "Chrome Ramps",
    name: "Outer Top Hotline",
    role: "hot contour leaving the chrome top face",
  },
  "outer-ramp-falloff-shadow-layer": {
    order: 81,
    category: "Chrome Ramps",
    name: "Outer Falloff Shadow",
    role: "dark contour before the extrusion falloff",
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
  "edge-shadow-layer": {
    order: 90,
    category: "Exterior",
    name: "Outer Boundary",
    role: "thin black outside containment line",
  },
};

export function svgLayers() {
  const svg = dom.mount.querySelector("svg");
  if (!svg) return [];

  return Array.from(svg.querySelectorAll(":scope > g[id]"))
    .map((layer, fileIndex) => {
      const presentation = layerPresentation[layer.id] ?? {};
      const recipe = recipeLayer(layer.id);
      const mediaActive = recipe?.media?.enabled && !!recipe.media.src;
      return {
        id: layer.id,
        name: recipe?.name ?? presentation.name ?? prettyLayerName(layer.id),
        category: presentation.category ?? "Other",
        role: presentation.role ?? "SVG group",
        order: presentation.order ?? 1000 + fileIndex,
        fileIndex,
        color: layerPaint(layer, svg),
        paint: recipe?.paint,
        gradientKey: gradientKeyFromPaint(recipe?.paint),
        mediaActive,
        visible: isLayerVisible(layer.id),
      };
    })
    .sort((a, b) => a.order - b.order || a.fileIndex - b.fileIndex);
}
