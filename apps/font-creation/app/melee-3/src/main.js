import "./styles.css";

const workbench = document.querySelector(".workbench");
const scene = document.querySelector("#scene");
const stageTilt = document.querySelector("#stageTilt");
const mount = document.querySelector("#svgMount");
const assetSelect = document.querySelector("#assetSelect");
const regenerateButton = document.querySelector("#regenerateButton");
const resetTiltButton = document.querySelector("#resetTiltButton");
const copyButton = document.querySelector("#copyButton");
const appStatus = document.querySelector("#appStatus");
const layerStackMap = document.querySelector("#layerStackMap");
const chromeLayerSelect = document.querySelector("#chromeLayerSelect");
const chromeStopList = document.querySelector("#chromeStopList");
const chromeGradientPreview = document.querySelector("#chromeGradientPreview");
const chromeEditButton = document.querySelector("#chromeEditButton");
const chromeSaveButton = document.querySelector("#chromeSaveButton");
const chromeResetButton = document.querySelector("#chromeResetButton");
const styleControls = Array.from(document.querySelectorAll("[data-style-var]"));
const editorTabButtons = Array.from(document.querySelectorAll("[data-editor-tab]"));
const editorTabPanels = Array.from(document.querySelectorAll("[data-editor-panel]"));

const defaultTilt = { x: 0, y: 0 };
const tilt = { x: 0, y: 0 };
const tiltLimit = { x: 28, y: 34 };
const layerVisibility = new Map();
const defaultVisibleLayers = new Set(["fill-layer", "red-lip-boundary-layer"]);
let activeRecipe = null;
let savedRecipe = null;
let recipeDirty = false;
let chromeEditing = false;
const layerPresentation = {
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
  "fill-layer": {
    order: 10,
    category: "Interior",
    name: "Red Fill",
    role: "core color shape",
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

let tiltDrag = null;
let pendingTiltFrame = 0;

function setStyleVar(name, value) {
  document.documentElement.style.setProperty(`--${name}`, value);
}

function syncStyleControl(control) {
  setStyleVar(control.dataset.styleVar, control.value);
}

function setStatus(message) {
  if (appStatus) appStatus.textContent = message;
}

function setRecipeDirty(isDirty) {
  recipeDirty = isDirty;
  regenerateButton.disabled = !recipeDirty;
  if (chromeSaveButton) chromeSaveButton.disabled = !recipeDirty;
}

function recipeHasChanges() {
  return JSON.stringify(activeRecipe) !== JSON.stringify(savedRecipe);
}

function setChromeEditing(isEditing) {
  chromeEditing = isEditing;
  chromeEditButton?.classList.toggle("is-active", chromeEditing);
  if (chromeEditButton) chromeEditButton.textContent = chromeEditing ? "Editing" : "Edit";
  renderChromeStops();
}

function selectedChromeStopSource() {
  return chromeStopSource(recipeLayer(chromeLayerSelect?.value), activeRecipe);
}

async function loadRecipe() {
  const response = await fetch("/api/melee-3/recipe");

  if (!response.ok) throw new Error("Recipe API unavailable.");

  activeRecipe = await response.json();
  savedRecipe = structuredClone(activeRecipe);
}

function recipeLayer(layerId) {
  return activeRecipe?.layers?.find((layer) => layer.id === layerId) ?? null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function tiltValue(value) {
  return Number.parseFloat(value.toFixed(2));
}

function renderTilt() {
  pendingTiltFrame = 0;
  stageTilt.style.transform = `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`;
}

function queueTiltRender() {
  if (pendingTiltFrame) return;

  pendingTiltFrame = requestAnimationFrame(renderTilt);
}

function setTilt(x, y, { immediate = false } = {}) {
  tilt.x = tiltValue(clamp(x, -tiltLimit.x, tiltLimit.x));
  tilt.y = tiltValue(clamp(y, -tiltLimit.y, tiltLimit.y));

  if (immediate) {
    if (pendingTiltFrame) {
      cancelAnimationFrame(pendingTiltFrame);
      pendingTiltFrame = 0;
    }
    renderTilt();
    return;
  }

  queueTiltRender();
}

function resetTilt() {
  setTilt(defaultTilt.x, defaultTilt.y, { immediate: true });
}

function activateEditorTab(tabName) {
  editorTabButtons.forEach((button) => {
    const isActive = button.dataset.editorTab === tabName;

    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  editorTabPanels.forEach((panel) => {
    const isActive = panel.dataset.editorPanel === tabName;

    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}

function prettyLayerName(id) {
  return id
    .replace(/-layer$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function gradientIdFromPaint(paint) {
  return paint?.match(/^url\(#(.+)\)$/)?.[1] ?? null;
}

function gradientKeyFromId(gradientId) {
  return gradientId?.replace(/-gradient$/, "").replace(/-/g, "_") ?? null;
}

function gradientKeyFromPaint(paint) {
  return gradientKeyFromId(gradientIdFromPaint(paint));
}

function stopsGradientCss(stops) {
  if (!stops?.length) return null;

  const stopsText = stops.map((stop) => `${stop.color} ${stop.offset}`).join(", ");

  return `linear-gradient(180deg, ${stopsText})`;
}

function gradientCss(gradientKey) {
  return stopsGradientCss(activeRecipe?.gradients?.[gradientKey]);
}

function chromeStopSource(layer, recipe = activeRecipe) {
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

function savedChromeStopSource(source) {
  if (!source || !savedRecipe) return null;

  if (source.type === "gradient") {
    const stops = savedRecipe.gradients?.[source.key];

    return stops ? { ...source, stops } : null;
  }

  const layer = savedRecipe.layers?.find((entry) => entry.id === source.layerId);

  return Array.isArray(layer?.stops) ? { ...source, stops: layer.stops } : null;
}

function gradientPaint(svg, paint) {
  const gradientId = gradientIdFromPaint(paint);
  if (!gradientId) return null;

  if (gradientId === "red-fill-gradient") {
    return gradientCss("red_fill");
  }

  if (gradientId === "red-gloss-gradient") {
    return gradientCss("red_gloss");
  }

  if (gradientId === "silver-gradient") {
    return gradientCss("silver");
  }

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

function layerPaint(layer, svg) {
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

function recipeLayerPaint(layerId, svg) {
  const escapedLayerId = layerId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const styles = Array.from(svg.querySelectorAll("style")).map((style) => style.textContent ?? "").join("\n");
  const match = styles.match(new RegExp(`--[^:;]*-${escapedLayerId}-paint:\\s*([^;]+);`));
  const paint = match?.[1]?.trim();

  if (!paint) return null;

  return gradientPaint(svg, paint) ?? paint;
}

function isSolidColor(paint) {
  return /^#[0-9a-f]{6}$/i.test(paint ?? "");
}

function svgLayers() {
  const svg = mount.querySelector("svg");

  if (!svg) return [];

  return Array.from(svg.querySelectorAll(":scope > g[id]"))
    .map((layer, fileIndex) => {
      const presentation = layerPresentation[layer.id] ?? {};

      return {
        id: layer.id,
        name: presentation.name ?? prettyLayerName(layer.id),
        category: presentation.category ?? "Other",
        role: presentation.role ?? "SVG group",
        order: presentation.order ?? 1000 + fileIndex,
        fileIndex,
        color: layerPaint(layer, svg),
        paint: recipeLayer(layer.id)?.paint,
        gradientKey: gradientKeyFromPaint(recipeLayer(layer.id)?.paint),
        visible: isLayerVisible(layer.id),
      };
    })
    .sort((a, b) => a.order - b.order || a.fileIndex - b.fileIndex);
}

function isLayerVisible(layerId) {
  const layer = recipeLayer(layerId);

  return layerVisibility.get(layerId) ?? layer?.visible ?? defaultVisibleLayers.has(layerId);
}

function setLayerVisible(layerId, visible) {
  const layer = recipeLayer(layerId);

  layerVisibility.set(layerId, visible);
  if (layer) layer.visible = visible;
  setRecipeDirty(true);
}

function syncRecipeVisibility() {
  activeRecipe?.layers?.forEach((layer) => {
    layer.visible = isLayerVisible(layer.id);
  });
}

function unitValue(value, unit = "px") {
  return `${Number(value)}${unit}`;
}

function layerStrokeWidth(layer) {
  if ("start" in layer || "thickness" in layer) {
    return 2 * (Number(layer.start ?? 0) + Number(layer.thickness ?? 0));
  }

  return Number(layer.width ?? 0);
}

function layerInnerStrokeWidth(layer) {
  return 2 * Number(layer.start ?? 0);
}

function formatBandValue(value) {
  const number = Number(value);

  return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/, "");
}

function bandRangeText(layer) {
  const start = Number(layer?.start ?? 0);
  const end = layer && "end" in layer ? Number(layer.end) : start + Number(layer?.thickness ?? 0);

  return `${formatBandValue(start)} -> ${formatBandValue(end)}`;
}

function updateBandRange(layerId) {
  const readout = layerStackMap?.querySelector(`[data-band-range-for="${CSS.escape(layerId)}"]`);

  if (!readout) return;

  readout.textContent = bandRangeText(recipeLayer(layerId));
}

function applyRecipeLayerValue(layerId, property, value) {
  const layer = recipeLayer(layerId);
  const svg = mount.querySelector("svg");

  if (!layer || !svg) return;

  layer[property] = Number(value);
  const cssScope = activeRecipe.css_scope ?? "melee3";
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

  setRecipeDirty(true);
}

function applyRecipeLayerPaint(layerId, paint) {
  const layer = recipeLayer(layerId);
  const svg = mount.querySelector("svg");

  if (!layer || !svg) return;

  layer.paint = paint;
  svg.style.setProperty(`--${activeRecipe.css_scope ?? "melee3"}-${layerId}-paint`, paint);
  setRecipeDirty(true);
}

function chromeLayers() {
  return activeRecipe?.layers?.filter((layer) => {
    const presentation = layerPresentation[layer.id];
    const source = chromeStopSource(layer);

    return presentation?.category?.startsWith("Chrome") && source;
  }) ?? [];
}

function renderChromeEditor() {
  if (!chromeLayerSelect || !chromeStopList || !chromeGradientPreview || !activeRecipe) return;

  const layers = chromeLayers();
  const currentValue = chromeLayerSelect.value || layers[0]?.id || "";

  chromeLayerSelect.replaceChildren();
  layers.forEach((layer) => {
    const option = document.createElement("option");
    option.value = layer.id;
    option.textContent = layerPresentation[layer.id]?.name ?? prettyLayerName(layer.id);
    chromeLayerSelect.append(option);
  });

  chromeLayerSelect.value = layers.some((layer) => layer.id === currentValue) ? currentValue : layers[0]?.id || "";
  renderChromeStops();
}

function renderChromeStops() {
  if (!chromeLayerSelect || !chromeStopList || !chromeGradientPreview || !activeRecipe) return;

  const layer = recipeLayer(chromeLayerSelect.value);
  const source = chromeStopSource(layer);
  const savedSource = savedChromeStopSource(source);
  const stops = source?.stops ?? [];

  chromeStopList.replaceChildren();
  chromeGradientPreview.style.background = stopsGradientCss(stops) ?? "#d6d9dc";
  if (chromeLayerSelect) chromeLayerSelect.disabled = !chromeEditing;
  if (chromeResetButton) chromeResetButton.disabled = !chromeEditing || !savedSource;

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
    color.disabled = !chromeEditing;
    offset.type = "number";
    offset.min = "0";
    offset.max = "100";
    offset.step = "1";
    offset.value = String(Number.parseFloat(stop.offset));
    offset.disabled = !chromeEditing;

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
    chromeStopList.append(row);
  });
}

function resetSelectedChromeGradient() {
  const source = selectedChromeStopSource();
  const savedSource = savedChromeStopSource(source);

  if (!source || !savedSource) return;

  if (source.type === "gradient") {
    activeRecipe.gradients[source.key] = structuredClone(savedSource.stops);
  } else {
    const layer = recipeLayer(source.layerId);
    if (layer) layer.stops = structuredClone(savedSource.stops);
  }

  syncChromeStops(selectedChromeStopSource(), { markDirty: false });
  renderChromeStops();
  setRecipeDirty(recipeHasChanges());
}

function syncChromeStops(source, { markDirty = true } = {}) {
  const svg = mount.querySelector("svg");
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
  chromeGradientPreview.style.background = background;
  layerStackMap?.querySelectorAll(`[data-gradient-key="${source.key}"], [data-stop-layer="${source.layerId}"]`).forEach((swatch) => {
    swatch.style.setProperty("--layer-color", background);
  });
  if (markDirty) setRecipeDirty(true);
}

function recipeControls(layer) {
  const recipe = recipeLayer(layer.id);

  if (!recipe) return null;

  const controls = document.createElement("span");
  controls.className = "layer-controls";

  if (recipe.type === "stroke") {
    if (recipe.mask === "outside_fill") {
      controls.append(
        recipeSlider(layer.id, "start", "Start", recipe.start ?? 0, 0, 40, 0.5),
        recipeSlider(layer.id, "thickness", "Thickness", recipe.thickness ?? 1, 0, 40, 0.5),
      );
    } else {
      controls.append(recipeSlider(layer.id, "width", "Width", recipe.width ?? 0, 0, 40, 0.5));
    }
  } else if (recipe.type === "bevel-ramp") {
    controls.append(
      recipeSlider(layer.id, "start", "Start", recipe.start ?? 0, 0, 40, 0.25),
      recipeSlider(layer.id, "end", "End", recipe.end ?? 8, 0, 48, 0.25),
    );
  } else if (recipe.type === "rect-fill") {
    controls.append(recipeSlider(layer.id, "height_ratio", "Height", recipe.height_ratio ?? 1, 0, 1, 0.01));
  }

  return controls.childElementCount ? controls : null;
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

function recipeSlider(layerId, property, labelText, value, min, max, step) {
  const label = document.createElement("label");
  const header = document.createElement("span");
  const name = document.createElement("span");
  const inputs = document.createElement("span");
  const numberInput = document.createElement("input");
  const controlValue = clamp(Number(value), Number(min), Number(max));

  label.className = "layer-slider";
  header.className = "layer-slider-header";
  inputs.className = "layer-slider-inputs";
  name.textContent = labelText;
  numberInput.type = "number";
  numberInput.min = String(min);
  numberInput.max = String(max);
  numberInput.step = String(step);
  numberInput.value = String(controlValue);

  function syncInputs(nextValue) {
    const numericValue = clamp(Number(nextValue), Number(min), Number(max));
    const formattedValue = String(numericValue);

    numberInput.value = formattedValue;
    applyRecipeLayerValue(layerId, property, formattedValue);
  }

  numberInput.addEventListener("input", () => {
    if (numberInput.value === "") return;
    syncInputs(numberInput.value);
  });

  header.append(name);
  inputs.append(numberInput);
  label.append(header, inputs);

  return label;
}

function applyLayerVisibility() {
  const svg = mount.querySelector("svg");

  if (!svg) return;

  svgLayers().forEach((entry) => {
    const layer = svg.querySelector(`#${CSS.escape(entry.id)}`);
    if (layer) layer.classList.toggle("is-hidden", !entry.visible);
  });
}

function updateLayerVisualizerRow(row, visible) {
  const toggle = row.querySelector(".stack-toggle");

  row.classList.toggle("is-hidden", !visible);
  if (toggle) toggle.textContent = visible ? "On" : "Off";
}

function renderLayerVisualizer() {
  if (!layerStackMap) return;

  const layers = svgLayers();
  layerStackMap.replaceChildren();

  let currentCategory = "";

  layers.forEach((layer) => {
    if (layer.category !== currentCategory) {
      const category = document.createElement("div");

      currentCategory = layer.category;
      category.className = "stack-category";
      category.textContent = layer.category;
      layerStackMap.append(category);
    }

    const row = document.createElement("button");
    const toggle = document.createElement("span");
    const body = document.createElement("span");
    const name = document.createElement("span");
    const metrics = document.createElement("span");
    const swatch = document.createElement("span");
    const colorInput = document.createElement("input");
    const range = bandRange(layer.id);
    const controls = recipeControls(layer);

    row.type = "button";
    row.className = `stack-row${layer.visible ? "" : " is-hidden"}`;
    row.dataset.layerId = layer.id;

    toggle.className = "stack-toggle";
    toggle.textContent = layer.visible ? "On" : "Off";
    body.className = "stack-body";
    name.className = "visualizer-name";
    name.textContent = layer.name;
    metrics.className = "stack-metrics";
    swatch.className = "visualizer-swatch";
    swatch.style.setProperty("--layer-color", layer.color);
    if (layer.gradientKey) swatch.dataset.gradientKey = layer.gradientKey;
    if (recipeLayer(layer.id)?.stops) swatch.dataset.stopLayer = layer.id;
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

    layerStackMap.append(row);
  });
}

async function loadSvg(src) {
  mount.innerHTML = '<div class="load-state">Loading MELEE 3 asset</div>';

  try {
    await loadRecipe();

    const response = await fetch(src);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    mount.innerHTML = text;

    const svg = mount.querySelector("svg");

    if (!svg) throw new Error("No SVG element found");

    svg.classList.add("logo-svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    styleControls.forEach(syncStyleControl);
    layerVisibility.clear();
    applyLayerVisibility();
    renderLayerVisualizer();
    renderChromeEditor();
    setRecipeDirty(false);
  } catch (error) {
    mount.innerHTML = `<div class="error-state">Run a local static server to load ${src}</div>`;
    setStatus(error.message);
  }
}

async function regenerateSvgs() {
  if (!recipeDirty) return;

  setStatus("Saving...");
  regenerateButton.disabled = true;
  syncRecipeVisibility();

  try {
    const response = await fetch("/api/melee-3/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe: activeRecipe }),
    });
    const payload = await response.json();

    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Regeneration failed.");
    }

    await loadSvg(`${assetSelect.value}?v=${Date.now()}`);
    savedRecipe = structuredClone(activeRecipe);
    setRecipeDirty(false);
    setStatus("Saved.");
  } catch (error) {
    setStatus(error.message);
    setRecipeDirty(true);
  } finally {
    regenerateButton.disabled = !recipeDirty;
  }
}

function startTiltDrag(event) {
  if (event.button !== undefined && event.button !== 0) return;

  event.preventDefault();
  const rect = scene.getBoundingClientRect();

  tiltDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: tilt.x,
    originY: tilt.y,
    width: rect.width,
    height: rect.height,
  };

  workbench.classList.add("is-tilting");
  workbench.setPointerCapture(event.pointerId);
}

function updateTiltDrag(event) {
  if (!tiltDrag || event.pointerId !== tiltDrag.pointerId) return;

  const dx = event.clientX - tiltDrag.startX;
  const dy = event.clientY - tiltDrag.startY;
  const nextX = tiltDrag.originX - (dy / tiltDrag.height) * tiltLimit.x * 2;
  const nextY = tiltDrag.originY + (dx / tiltDrag.width) * tiltLimit.y * 2;

  setTilt(nextX, nextY);
}

function stopTiltDrag(event) {
  if (!tiltDrag || event.pointerId !== tiltDrag.pointerId) return;

  tiltDrag = null;
  workbench.classList.remove("is-tilting");
  workbench.releasePointerCapture(event.pointerId);
}

function cssSnapshot() {
  const styleLines = styleControls.map((control) => {
    return `  --${control.dataset.styleVar}: ${control.value};`;
  });

  return [
    ".melee-3-layer-lab {",
    `  --tilt-x: ${tilt.x}deg;`,
    `  --tilt-y: ${tilt.y}deg;`,
    ...styleLines,
    "}",
    "",
    ".melee-3-layer-lab .logo-svg {",
    "  display: block;",
    "  width: 100%;",
    "  height: auto;",
    "  overflow: visible;",
    "}",
  ].join("\n");
}

styleControls.forEach((control) => {
  syncStyleControl(control);
  control.addEventListener("input", () => syncStyleControl(control));
});

editorTabButtons.forEach((button) => {
  button.addEventListener("click", () => activateEditorTab(button.dataset.editorTab));
});

chromeLayerSelect?.addEventListener("change", renderChromeStops);
chromeEditButton?.addEventListener("click", () => setChromeEditing(!chromeEditing));
chromeSaveButton?.addEventListener("click", regenerateSvgs);
chromeResetButton?.addEventListener("click", resetSelectedChromeGradient);
assetSelect.addEventListener("change", () => loadSvg(assetSelect.value));
workbench.addEventListener("pointerdown", startTiltDrag);
workbench.addEventListener("pointermove", updateTiltDrag);
workbench.addEventListener("pointerup", stopTiltDrag);
workbench.addEventListener("pointercancel", stopTiltDrag);
regenerateButton.addEventListener("click", regenerateSvgs);
resetTiltButton.addEventListener("click", resetTilt);

copyButton.addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(cssSnapshot());
    copyButton.textContent = "Copied";
    setTimeout(() => {
      copyButton.textContent = "Copy CSS";
    }, 1200);
  } catch (error) {
    copyButton.textContent = "Copy failed";
    setTimeout(() => {
      copyButton.textContent = "Copy CSS";
    }, 1200);
  }
});

setTilt(defaultTilt.x, defaultTilt.y, { immediate: true });
loadSvg(assetSelect.value);
