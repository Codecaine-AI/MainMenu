import { state, recipeLayer } from "./state.js";

export function gradientIdFromPaint(paint) {
  return paint?.match(/^url\(#(.+)\)$/)?.[1] ?? null;
}

export function gradientKeyFromId(gradientId) {
  return gradientId?.replace(/-gradient$/, "").replace(/-/g, "_") ?? null;
}

export function gradientKeyFromPaint(paint) {
  return gradientKeyFromId(gradientIdFromPaint(paint));
}

export function stopsGradientCss(stops) {
  if (!stops?.length) return null;
  const stopsText = stops.map((stop) => `${stop.color} ${stop.offset}`).join(", ");
  return `linear-gradient(180deg, ${stopsText})`;
}

export function gradientCss(gradientKey) {
  return stopsGradientCss(state.activeRecipe?.gradients?.[gradientKey]);
}

export function gradientPaint(svg, paint) {
  const gradientId = gradientIdFromPaint(paint);
  if (!gradientId) return null;

  if (gradientId === "red-fill-gradient") return gradientCss("red_fill");
  if (gradientId === "red-gloss-gradient") return gradientCss("red_gloss");
  if (gradientId === "silver-gradient") return gradientCss("silver");

  if (gradientId.endsWith("-gradient")) {
    const gradient = gradientCss(gradientKeyFromId(gradientId));
    if (gradient) return gradient;
  }

  const gradient = svg.querySelector(`#${CSS.escape(gradientId)}`);
  if (!gradient) return null;

  const stops = Array.from(gradient.querySelectorAll("stop"))
    .map((stop) => {
      const color = stop.getAttribute("stop-color") || "#d6d9dc";
      const offset = stop.getAttribute("offset") || "";
      return `${color} ${offset}`.trim();
    })
    .join(", ");

  if (!stops) return null;

  const isHorizontal = gradient.getAttribute("x2") !== gradient.getAttribute("x1");
  return `linear-gradient(${isHorizontal ? "90deg" : "180deg"}, ${stops})`;
}

export function recipeLayerPaint(layerId, svg) {
  const escapedLayerId = layerId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const styles = Array.from(svg.querySelectorAll("style")).map((style) => style.textContent ?? "").join("\n");
  const match = styles.match(new RegExp(`--[^:;]*-${escapedLayerId}-paint:\\s*([^;]+);`));
  const paint = match?.[1]?.trim();
  if (!paint) return null;
  return gradientPaint(svg, paint) ?? paint;
}

export function layerPaint(layer, svg) {
  const recipePaint = recipeLayerPaint(layer.id, svg);
  if (recipePaint) return recipePaint;

  const use = layer.querySelector("use");
  const rect = layer.querySelector("rect");
  const stroke = use?.getAttribute("stroke");
  const fill = rect?.getAttribute("fill") || use?.getAttribute("fill");
  const paint = stroke && stroke !== "none" ? stroke : fill;

  if (!paint) return "#d6d9dc";
  return gradientPaint(svg, paint) ?? paint;
}

export function chromeStopSource(layer, recipe = state.activeRecipe) {
  if (!layer || !recipe) return null;

  const gradientKey = gradientKeyFromPaint(layer.paint);
  if (gradientKey && recipe.gradients?.[gradientKey]) {
    return {
      type: "gradient",
      key: gradientKey,
      layerId: layer.id,
      stops: recipe.gradients[gradientKey],
    };
  }

  if (Array.isArray(layer.stops)) {
    return {
      type: "layer",
      key: layer.id,
      layerId: layer.id,
      stops: layer.stops,
    };
  }

  return null;
}

export function savedChromeStopSource(source) {
  if (!source || !state.savedRecipe) return null;

  if (source.type === "gradient") {
    const stops = state.savedRecipe.gradients?.[source.key];
    return stops ? { ...source, stops } : null;
  }

  const layer = state.savedRecipe.layers?.find((entry) => entry.id === source.layerId);
  return Array.isArray(layer?.stops) ? { ...source, stops: layer.stops } : null;
}
