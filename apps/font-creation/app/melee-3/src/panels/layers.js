import { dom, state, recipeLayer, isLayerVisible, setLayerVisible, setRecipeDirty } from "../state.js";
import { clamp, isSolidColor, formatBandValue, controlModeBadge } from "../utils.js";
import { applyRecipeLayerValue, applyRecipeLayerPaint } from "../recipe.js";
import { svgLayers, layerPresentation } from "../layer-data.js";
import { applyLayerVisibility } from "../viewer.js";

function bandRangeText(layer) {
  const start = Number(layer?.start ?? 0);
  const end = layer && "end" in layer ? Number(layer.end) : start + Number(layer?.thickness ?? 0);
  return `${formatBandValue(start)} -> ${formatBandValue(end)}`;
}

function bandRange(layerId) {
  const layer = recipeLayer(layerId);
  if (!layer || (layer.type !== "bevel-ramp" && layer.mask !== "outside_fill") || !("start" in layer || "thickness" in layer || "end" in layer)) return null;

  const readout = document.createElement("span");
  const label = document.createElement("span");
  const value = document.createElement("span");

  readout.className = "band-range";
  label.textContent = "Band";
  value.dataset.bandRangeFor = layerId;
  value.textContent = bandRangeText(layer);
  readout.append(label, value);
  return readout;
}

function recipeSlider(layerId, property, labelText, value, min, max, step, updateMode = "live") {
  const label = document.createElement("label");
  const header = document.createElement("span");
  const name = document.createElement("span");
  const inputs = document.createElement("span");
  const numberInput = document.createElement("input");
  const controlValue = clamp(Number(value), Number(min), Number(max));

  label.className = "layer-slider";
  label.dataset.updateMode = updateMode;
  header.className = "layer-slider-header";
  inputs.className = "layer-slider-inputs";
  name.textContent = labelText;
  numberInput.type = "number";
  numberInput.min = String(min);
  numberInput.max = String(max);
  numberInput.step = String(step);
  numberInput.value = String(controlValue);

  numberInput.addEventListener("input", () => {
    if (numberInput.value === "") return;
    const numericValue = clamp(Number(numberInput.value), Number(min), Number(max));
    numberInput.value = String(numericValue);
    applyRecipeLayerValue(layerId, property, String(numericValue));
  });

  header.append(name, controlModeBadge(updateMode));
  inputs.append(numberInput);
  label.append(header, inputs);
  return label;
}

function recipeControls(layer) {
  const recipe = recipeLayer(layer.id);
  if (!recipe) return null;

  const controls = document.createElement("span");
  controls.className = "layer-controls";

  if ("opacity" in recipe) {
    controls.append(recipeSlider(layer.id, "opacity", "Opacity", recipe.opacity ?? 1, 0, 1, 0.01, "live"));
  }

  if (recipe.type === "stroke") {
    if (recipe.mask === "outside_fill") {
      controls.append(
        recipeSlider(layer.id, "start", "Start", recipe.start ?? 0, 0, 40, 0.5, "live"),
        recipeSlider(layer.id, "thickness", "Thickness", recipe.thickness ?? 1, 0, 40, 0.5, "live"),
      );
    } else {
      controls.append(recipeSlider(layer.id, "width", "Width", recipe.width ?? 0, 0, 40, 0.5, "live"));
    }
  } else if (recipe.type === "bevel-ramp") {
    controls.append(
      recipeSlider(layer.id, "start", "Start", recipe.start ?? 0, 0, 40, 0.25, "rebuild"),
      recipeSlider(layer.id, "end", "End", recipe.end ?? 8, 0, 48, 0.25, "rebuild"),
    );
  } else if (recipe.type === "rect-fill") {
    controls.append(recipeSlider(layer.id, "height_ratio", "Height", recipe.height_ratio ?? 1, 0, 1, 0.01, "live"));
  } else if (recipe.type === "projected-shadow") {
    controls.append(
      recipeSlider(layer.id, "dx", "DX", recipe.dx ?? 0, -24, 24, 0.25, "live"),
      recipeSlider(layer.id, "dy", "DY", recipe.dy ?? 0, -24, 24, 0.25, "live"),
      recipeSlider(layer.id, "blur", "Blur", recipe.blur ?? 1, 0, 16, 0.25, "live"),
    );
  }

  controls.classList.toggle("is-disabled", recipe.type === "lighting-overlay" && state.activeRecipe?.lighting?.enabled === false);
  return controls.childElementCount ? controls : null;
}

function updateLayerVisualizerRow(row, visible) {
  const toggle = row.querySelector(".stack-toggle");
  row.classList.toggle("is-hidden", !visible);
  if (toggle) toggle.textContent = visible ? "On" : "Off";
}

export function renderLayerVisualizer() {
  if (!dom.layerStackMap) return;

  const layers = svgLayers();
  dom.layerStackMap.replaceChildren();
  let currentCategory = "";

  layers.forEach((layer) => {
    if (layer.category !== currentCategory) {
      const category = document.createElement("div");
      currentCategory = layer.category;
      category.className = "stack-category";
      category.textContent = layer.category;
      dom.layerStackMap.append(category);
    }

    const row = document.createElement("button");
    const toggle = document.createElement("span");
    const body = document.createElement("span");
    const name = document.createElement("span");
    const metrics = document.createElement("span");
    const swatch = document.createElement("span");
    const colorInput = document.createElement("input");
    const recipe = recipeLayer(layer.id);
    const range = bandRange(layer.id);
    const controls = recipeControls(layer);

    row.type = "button";
    row.className = `stack-row${layer.visible ? "" : " is-hidden"}`;
    if (recipe?.type) row.classList.add(`is-${recipe.type}-row`);
    row.dataset.layerId = layer.id;
    row.dataset.layerType = recipe?.type ?? "svg";

    toggle.className = "stack-toggle";
    toggle.textContent = layer.visible ? "On" : "Off";
    body.className = "stack-body";
    name.className = "visualizer-name";
    name.textContent = layer.name;
    metrics.className = "stack-metrics";
    swatch.className = "visualizer-swatch";
    swatch.style.setProperty("--layer-color", layer.color);
    if (layer.gradientKey) swatch.dataset.gradientKey = layer.gradientKey;
    if (recipe?.stops) swatch.dataset.stopLayer = layer.id;
    colorInput.type = "color";
    colorInput.className = "visualizer-color-input";
    colorInput.value = isSolidColor(layer.paint) ? layer.paint : "#d6d9dc";
    colorInput.disabled = !isSolidColor(layer.paint);

    if (isSolidColor(layer.paint)) {
      swatch.classList.add("is-editable");
      swatch.append(colorInput);
      colorInput.addEventListener("input", () => {
        applyRecipeLayerPaint(layer.id, colorInput.value);
        swatch.style.setProperty("--layer-color", colorInput.value);
      });
    }

    body.append(name);
    if (controls) metrics.append(controls);
    if (range) metrics.append(range);
    if (metrics.childElementCount) body.append(metrics);
    row.append(toggle, body, swatch);

    toggle.addEventListener("click", (event) => {
      event.stopPropagation();
      const visible = !isLayerVisible(layer.id);
      setLayerVisible(layer.id, visible);
      applyLayerVisibility();
      updateLayerVisualizerRow(row, visible);
    });
    body.addEventListener("click", (event) => {
      if (event.target.closest(".layer-controls")) event.stopPropagation();
    });
    swatch.addEventListener("click", (event) => {
      event.stopPropagation();
    });

    dom.layerStackMap.append(row);
  });
}
