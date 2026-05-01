import { dom, state, recipeLayer, isLayerVisible, setLayerVisible, setRecipeDirty } from "../state.js";
import { clamp, isSolidColor, formatBandValue, controlModeBadge } from "../utils.js";
import { applyRecipeLayerValue, applyRecipeLayerPaint } from "../recipe.js";
import { svgLayers, layerPresentation } from "../layer-data.js";
import { applyLayerVisibility } from "../viewer.js";
import { layerMediaControls, loadMediaAssets } from "./media.js";

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

  const controls = document.createElement("div");
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

  const mediaControls = layerMediaControls(layer.id);
  if (mediaControls) controls.append(mediaControls);

  controls.classList.toggle("is-disabled", recipe.type === "lighting-overlay" && state.activeRecipe?.lighting?.enabled === false);
  return controls.childElementCount ? controls : null;
}

function updateLayerVisualizerRow(row, visible) {
  const toggle = row.querySelector(".stack-toggle");
  row.classList.toggle("is-hidden", !visible);
  if (toggle) toggle.textContent = visible ? "On" : "Off";
}

function dependentRemovalIds(layerId) {
  const ids = new Set([layerId]);
  let changed = true;

  while (changed) {
    changed = false;
    for (const layer of state.activeRecipe?.layers ?? []) {
      if (ids.has(layer.id)) continue;
      if (ids.has(layer.mask_ref) || ids.has(layer.caster_ref) || ids.has(layer.caster)) {
        ids.add(layer.id);
        changed = true;
      }
    }
  }

  return ids;
}

function pruneLayerReferences(ids) {
  if (state.activeRecipe?.chrome_stack?.layer_ids) {
    state.activeRecipe.chrome_stack.layer_ids = state.activeRecipe.chrome_stack.layer_ids.filter((id) => !ids.has(id));
  }

  if (Array.isArray(state.activeRecipe?.relief?.bands)) {
    state.activeRecipe.relief.bands = state.activeRecipe.relief.bands.filter((band) => !ids.has(band.layer_id));
  }

  ids.forEach((id) => layerVisibility.delete(id));
}

function removeRecipeLayer(layerId) {
  const recipe = recipeLayer(layerId);
  if (!recipe || !state.activeRecipe?.layers) return;

  const ids = dependentRemovalIds(layerId);
  const removedNames = state.activeRecipe.layers
    .filter((layer) => ids.has(layer.id))
    .map((layer) => layer.name ?? layerPresentation[layer.id]?.name ?? layer.id);
  const message = removedNames.length > 1
    ? `Remove ${removedNames[0]} and ${removedNames.length - 1} dependent layer(s)?`
    : `Remove ${removedNames[0]}?`;
  if (!window.confirm(message)) return;

  state.activeRecipe.layers = state.activeRecipe.layers.filter((layer) => !ids.has(layer.id));
  pruneLayerReferences(ids);

  const svg = dom.mount?.querySelector("svg");
  ids.forEach((id) => svg?.querySelector(`#${CSS.escape(id)}`)?.remove());

  setRecipeDirty(true);
  renderLayerVisualizer();
}

function layerManagementControls(layer) {
  const recipe = recipeLayer(layer.id);
  if (!recipe) return null;

  const controls = document.createElement("div");
  const nameLabel = document.createElement("label");
  const nameText = document.createElement("span");
  const nameInput = document.createElement("input");
  const removeButton = document.createElement("button");

  controls.className = "layer-management-controls";
  nameLabel.className = "layer-name-field";
  nameText.textContent = "Name";
  nameInput.type = "text";
  nameInput.value = recipe.name ?? layer.name;
  nameInput.placeholder = layerPresentation[layer.id]?.name ?? layer.id;
  nameInput.setAttribute("aria-label", `Rename ${layer.name}`);
  removeButton.type = "button";
  removeButton.className = "layer-remove-button";
  removeButton.textContent = "Remove";

  nameInput.addEventListener("input", () => {
    const value = nameInput.value.trim();
    if (value) recipe.name = value;
    else delete recipe.name;
    setRecipeDirty(true);
  });

  removeButton.addEventListener("click", () => removeRecipeLayer(layer.id));

  nameLabel.append(nameText, nameInput);
  controls.append(nameLabel, removeButton);
  return controls;
}

export async function renderLayerVisualizer() {
  if (!dom.layerStackMap) return;
  await loadMediaAssets();

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

    const row = document.createElement("div");
    const toggle = document.createElement("button");
    const body = document.createElement("div");
    const name = document.createElement("span");
    const metrics = document.createElement("div");
    const swatch = document.createElement("span");
    const colorInput = document.createElement("input");
    const recipe = recipeLayer(layer.id);
    const range = bandRange(layer.id);
    const controls = recipeControls(layer);
    const managementControls = layerManagementControls(layer);

    row.className = `stack-row${layer.visible ? "" : " is-hidden"}`;
    if (recipe?.type) row.classList.add(`is-${recipe.type}-row`);
    row.dataset.layerId = layer.id;
    row.dataset.layerType = recipe?.type ?? "svg";

    toggle.className = "stack-toggle";
    toggle.type = "button";
    toggle.textContent = layer.visible ? "On" : "Off";
    body.className = "stack-body";
    name.className = "visualizer-name";
    name.textContent = layer.name;
    metrics.className = "stack-metrics";
    swatch.className = "visualizer-swatch";
    swatch.style.setProperty("--layer-color", layer.color);
    swatch.classList.toggle("is-media", !!layer.mediaActive);
    if (layer.mediaActive) swatch.title = "Media surface active";
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
    if (managementControls) body.append(managementControls);
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
