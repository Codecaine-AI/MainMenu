import { dom, state, recipeLayer, setRecipeDirty, recipeHasChanges } from "../state.js";
import { clamp, prettyLayerName } from "../utils.js";
import { chromeStopSource, savedChromeStopSource, stopsGradientCss, gradientKeyFromPaint } from "../gradients.js";
import { layerPresentation } from "../layer-data.js";

function selectedChromeStopSource() {
  return chromeStopSource(recipeLayer(dom.chromeLayerSelect?.value), state.activeRecipe);
}

function syncChromeStops(source, { markDirty = true } = {}) {
  const svg = dom.mount.querySelector("svg");
  const stops = source?.stops;
  if (!source || !stops) return;

  const gradientId = source.type === "gradient" ? `${source.key.replace(/_/g, "-")}-gradient` : `${source.layerId}-gradient`;

  if (svg) {
    const gradientElement = svg.querySelector(`#${CSS.escape(gradientId)}`);
    const svgStops = Array.from(gradientElement?.querySelectorAll("stop") ?? []);
    stops.forEach((stop, index) => {
      svgStops[index]?.setAttribute("stop-color", stop.color);
      svgStops[index]?.setAttribute("offset", stop.offset);
    });
  }

  const background = stopsGradientCss(stops) ?? "#d6d9dc";
  dom.chromeGradientPreview.style.background = background;
  dom.layerStackMap?.querySelectorAll(`[data-gradient-key="${source.key}"], [data-stop-layer="${source.layerId}"]`).forEach((swatch) => {
    swatch.style.setProperty("--layer-color", background);
  });
  if (markDirty) setRecipeDirty(true);
}

export function renderChromeStops() {
  if (!dom.chromeLayerSelect || !dom.chromeStopList || !dom.chromeGradientPreview || !state.activeRecipe) return;

  const layer = recipeLayer(dom.chromeLayerSelect.value);
  const source = chromeStopSource(layer);
  const savedSource = savedChromeStopSource(source);
  const stops = source?.stops ?? [];

  dom.chromeStopList.replaceChildren();
  dom.chromeGradientPreview.style.background = stopsGradientCss(stops) ?? "#d6d9dc";
  if (dom.chromeLayerSelect) dom.chromeLayerSelect.disabled = !state.chromeEditing;
  if (dom.chromeResetButton) dom.chromeResetButton.disabled = !state.chromeEditing || !savedSource;

  stops.forEach((stop, index) => {
    const row = document.createElement("label");
    const name = document.createElement("span");
    const controls = document.createElement("span");
    const color = document.createElement("input");
    const offset = document.createElement("input");

    row.className = "chrome-stop-row";
    controls.className = "chrome-stop-controls";
    name.textContent = `Stop ${index + 1}`;
    color.type = "color";
    color.value = stop.color;
    color.disabled = !state.chromeEditing;
    offset.type = "number";
    offset.min = "0";
    offset.max = "100";
    offset.step = "1";
    offset.value = String(Number.parseFloat(stop.offset));
    offset.disabled = !state.chromeEditing;

    color.addEventListener("input", () => {
      stop.color = color.value;
      syncChromeStops(source);
    });
    offset.addEventListener("input", () => {
      if (offset.value === "") return;
      stop.offset = `${clamp(Number(offset.value), 0, 100)}%`;
      syncChromeStops(source);
    });

    controls.append(color, offset);
    row.append(name, controls);
    dom.chromeStopList.append(row);
  });
}

export function setChromeEditing(isEditing) {
  state.chromeEditing = isEditing;
  dom.chromeEditButton?.classList.toggle("is-active", state.chromeEditing);
  if (dom.chromeEditButton) dom.chromeEditButton.textContent = state.chromeEditing ? "Editing" : "Edit";
  renderChromeStops();
}

export function resetSelectedChromeGradient() {
  const source = selectedChromeStopSource();
  const savedSource = savedChromeStopSource(source);
  if (!source || !savedSource) return;

  if (source.type === "gradient") {
    state.activeRecipe.gradients[source.key] = structuredClone(savedSource.stops);
  } else {
    const layer = recipeLayer(source.layerId);
    if (layer) layer.stops = structuredClone(savedSource.stops);
  }

  syncChromeStops(selectedChromeStopSource(), { markDirty: false });
  renderChromeStops();
  setRecipeDirty(recipeHasChanges());
}

function chromeLayers() {
  return state.activeRecipe?.layers?.filter((layer) => {
    const presentation = layerPresentation[layer.id];
    const source = chromeStopSource(layer);
    return presentation?.category?.startsWith("Chrome") && source;
  }) ?? [];
}

export function renderChromeEditor() {
  if (!dom.chromeLayerSelect || !dom.chromeStopList || !dom.chromeGradientPreview || !state.activeRecipe) return;

  const layers = chromeLayers();
  const currentValue = dom.chromeLayerSelect.value || layers[0]?.id || "";

  dom.chromeLayerSelect.replaceChildren();
  layers.forEach((layer) => {
    const option = document.createElement("option");
    option.value = layer.id;
    option.textContent = layerPresentation[layer.id]?.name ?? prettyLayerName(layer.id);
    dom.chromeLayerSelect.append(option);
  });

  dom.chromeLayerSelect.value = layers.some((layer) => layer.id === currentValue) ? currentValue : layers[0]?.id || "";
  renderChromeStops();
}
