import { state, dom, recipeLayer, setRecipeDirty } from "./state.js";
import { unitValue, formatBandValue, formatSvgNumber, layerStrokeWidth, layerInnerStrokeWidth } from "./utils.js";

function bandRangeText(layer) {
  const start = Number(layer?.start ?? 0);
  const end = layer && "end" in layer ? Number(layer.end) : start + Number(layer?.thickness ?? 0);
  return `${formatBandValue(start)} -> ${formatBandValue(end)}`;
}

function updateBandRange(layerId) {
  const readout = dom.layerStackMap?.querySelector(`[data-band-range-for="${CSS.escape(layerId)}"]`);
  if (!readout) return;
  readout.textContent = bandRangeText(recipeLayer(layerId));
}

function updateProjectedShadowGeometry(svg, layer) {
  const transformNode = svg.querySelector(`[data-projected-shadow-transform="${CSS.escape(layer.id)}"]`);
  const blurNode = svg.querySelector(`[data-projected-shadow-blur="${CSS.escape(layer.id)}"]`);
  transformNode?.setAttribute("transform", `translate(${formatSvgNumber(layer.dx ?? 0)} ${formatSvgNumber(layer.dy ?? 0)})`);
  blurNode?.setAttribute("stdDeviation", formatSvgNumber(layer.blur ?? 0));
}

export function applyRecipeLayerValue(layerId, property, value) {
  const layer = recipeLayer(layerId);
  const svg = dom.mount.querySelector("svg");
  if (!layer || !svg) return;

  layer[property] = Number(value);

  if (property === "opacity" && layer.type === "lighting-overlay") {
    const lightingOpacityBySource = {
      chrome_shadow: "chrome_shadow_opacity",
      chrome_highlight: "chrome_highlight_opacity",
      ambient_occlusion: "ao_opacity",
    };
    const lightingKey = lightingOpacityBySource[layer.source];
    if (lightingKey) {
      if (!state.activeRecipe.lighting) state.activeRecipe.lighting = {};
      state.activeRecipe.lighting[lightingKey] = layer[property];
    } else if (layer.source === "chrome_reflection") {
      if (!state.activeRecipe.materials) state.activeRecipe.materials = {};
      if (!state.activeRecipe.materials.chrome) state.activeRecipe.materials.chrome = {};
      state.activeRecipe.materials.chrome.reflection_opacity = layer[property];
    }
  }

  const cssScope = state.activeRecipe.css_scope ?? "melee3";
  const cssProperty = property === "start" || property === "thickness" ? "width" : property;
  const cssName = `--${cssScope}-${layerId}-${cssProperty}`;
  const cssValue = cssProperty === "opacity" ? String(layer[property]) : unitValue(cssProperty === "width" ? layerStrokeWidth(layer) : layer[property]);
  svg.style.setProperty(cssName, cssValue);

  if (property === "start" || property === "thickness") {
    svg.style.setProperty(`--${cssScope}-${layerId}-inner-width`, unitValue(layerInnerStrokeWidth(layer)));
    updateBandRange(layerId);
  }

  if (property === "end") {
    updateBandRange(layerId);
  }

  if (property === "height_ratio") {
    const rect = svg.querySelector(`#${CSS.escape(layerId)} rect`);
    if (rect) rect.setAttribute("height", String(svg.viewBox.baseVal.height * layer[property]));
  }

  if (layer.type === "projected-shadow" && ["dx", "dy", "blur"].includes(property)) {
    updateProjectedShadowGeometry(svg, layer);
  }

  setRecipeDirty(true);
}

export function applyRecipeLayerPaint(layerId, paint) {
  const layer = recipeLayer(layerId);
  const svg = dom.mount.querySelector("svg");
  if (!layer || !svg) return;

  layer.paint = paint;
  svg.style.setProperty(`--${state.activeRecipe.css_scope ?? "melee3"}-${layerId}-paint`, paint);
  setRecipeDirty(true);
}

export function lightingPathValue(path) {
  return path.split(".").reduce((value, key) => value?.[key], state.activeRecipe?.lighting);
}

export function setLightingPathValue(path, value) {
  if (!state.activeRecipe.lighting) state.activeRecipe.lighting = {};
  const keys = path.split(".");
  let target = state.activeRecipe.lighting;
  keys.slice(0, -1).forEach((key) => {
    if (!target[key]) target[key] = {};
    target = target[key];
  });
  target[keys.at(-1)] = Number(value);
}

function syncLightingOpacityLayer(path, value) {
  const layerByPath = {
    chrome_shadow_opacity: "chrome-normal-shadow-layer",
    chrome_highlight_opacity: "chrome-normal-highlight-layer",
    ao_opacity: "ambient-occlusion-layer",
  };
  const layerId = layerByPath[path];
  if (layerId) applyRecipeLayerValue(layerId, "opacity", value);
}

export function applyRecipeLightingValue(path, value) {
  setLightingPathValue(path, value);
  syncLightingOpacityLayer(path, value);
  setRecipeDirty(true);
}
