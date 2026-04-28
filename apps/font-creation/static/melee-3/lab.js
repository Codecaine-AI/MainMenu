const root = document.documentElement;
const mount = document.querySelector("#svgMount");
const assetSelect = document.querySelector("#assetSelect");
const presetSelect = document.querySelector("#presetSelect");
const controls = Array.from(document.querySelectorAll("[data-var]"));
const strokeControls = Array.from(document.querySelectorAll("[data-stroke-layer]"));
const layerToggles = Array.from(document.querySelectorAll("[data-layer]"));
const resetButton = document.querySelector("#resetButton");
const copyButton = document.querySelector("#copyButton");
const controlsByName = new Map(controls.map((control) => [control.dataset.var, control]));

const defaults = Object.fromEntries(
  controls.map((control) => [control.dataset.var, control.value]),
);
const strokeDefaults = Object.fromEntries(
  strokeControls.map((control) => [control.dataset.strokeLayer, control.value]),
);

const presets = {
  classic: {
    "depth": "28",
    "tilt-x": "8",
    "tilt-y": "-11",
    "rim-scale": "1",
    "layer-spread": "13",
    "extra-rim-count": "3",
    "extra-rim-width": "106",
    "extra-rim-step": "11",
    "extra-rim-curve": "4",
    "extra-rim-offset": "11",
    "extra-rim-oppose": "0.55",
    "extra-rim-angle": "-38",
    "extra-rim-opacity": "0.72",
    "extra-rim-light": "#ffffff",
    "extra-rim-dark": "#343a40",
    "glare": "0.44",
    "gloss": "0.32",
    "shadow-power": "0.8",
    "contrast": "1.1",
    "saturation": "1.08",
    "red-top": "#f03024",
    "red-base": "#760505",
    "steel-dark": "#22272c",
    "stage-color": "#17191f",
  },
  deep: {
    "depth": "72",
    "tilt-x": "14",
    "tilt-y": "-22",
    "rim-scale": "1.1",
    "layer-spread": "33",
    "extra-rim-count": "6",
    "extra-rim-width": "138",
    "extra-rim-step": "13",
    "extra-rim-curve": "7",
    "extra-rim-offset": "21",
    "extra-rim-oppose": "0.22",
    "extra-rim-angle": "35",
    "extra-rim-opacity": "0.84",
    "extra-rim-light": "#f8fbff",
    "extra-rim-dark": "#171a1f",
    "glare": "0.34",
    "gloss": "0.2",
    "shadow-power": "1",
    "contrast": "1.2",
    "saturation": "1",
    "red-top": "#e32a20",
    "red-base": "#510606",
    "steel-dark": "#15191d",
    "stage-color": "#181b20",
  },
  sliced: {
    "depth": "46",
    "tilt-x": "-6",
    "tilt-y": "18",
    "rim-scale": "0.94",
    "layer-spread": "42",
    "extra-rim-count": "8",
    "extra-rim-width": "118",
    "extra-rim-step": "5",
    "extra-rim-curve": "-8",
    "extra-rim-offset": "24",
    "extra-rim-oppose": "0.78",
    "extra-rim-angle": "-22",
    "extra-rim-opacity": "0.62",
    "extra-rim-light": "#ffffff",
    "extra-rim-dark": "#242a30",
    "glare": "0.62",
    "gloss": "0.18",
    "shadow-power": "0.76",
    "contrast": "1.3",
    "saturation": "1.18",
    "red-top": "#ff3b2f",
    "red-base": "#690909",
    "steel-dark": "#30353a",
    "stage-color": "#20242a",
  },
  split: {
    "depth": "52",
    "tilt-x": "11",
    "tilt-y": "-18",
    "rim-scale": "0.98",
    "layer-spread": "25",
    "extra-rim-count": "2",
    "extra-rim-width": "132",
    "extra-rim-step": "0",
    "extra-rim-curve": "0",
    "extra-rim-offset": "34",
    "extra-rim-oppose": "1",
    "extra-rim-angle": "-32",
    "extra-rim-opacity": "0.76",
    "extra-rim-light": "#ffffff",
    "extra-rim-dark": "#1d2329",
    "glare": "0.76",
    "gloss": "0.27",
    "shadow-power": "0.82",
    "contrast": "1.22",
    "saturation": "1.08",
    "red-top": "#f53a2f",
    "red-base": "#6a0807",
    "steel-dark": "#21272d",
    "stage-color": "#1c2026",
  },
  foil: {
    "depth": "24",
    "tilt-x": "9",
    "tilt-y": "-25",
    "rim-scale": "1.18",
    "layer-spread": "18",
    "extra-rim-count": "5",
    "extra-rim-width": "96",
    "extra-rim-step": "-3",
    "extra-rim-curve": "10",
    "extra-rim-offset": "14",
    "extra-rim-oppose": "0.35",
    "extra-rim-angle": "-65",
    "extra-rim-opacity": "0.82",
    "extra-rim-light": "#ffffff",
    "extra-rim-dark": "#66707a",
    "glare": "0.92",
    "gloss": "0.48",
    "shadow-power": "0.54",
    "contrast": "1.36",
    "saturation": "1.32",
    "red-top": "#f24a3c",
    "red-base": "#82110e",
    "steel-dark": "#3c4248",
    "stage-color": "#26282d",
  },
  glass: {
    "depth": "18",
    "tilt-x": "2",
    "tilt-y": "-7",
    "rim-scale": "0.88",
    "layer-spread": "8",
    "extra-rim-count": "2",
    "extra-rim-width": "82",
    "extra-rim-step": "18",
    "extra-rim-curve": "-2",
    "extra-rim-offset": "7",
    "extra-rim-oppose": "0.1",
    "extra-rim-angle": "-20",
    "extra-rim-opacity": "0.42",
    "extra-rim-light": "#ffffff",
    "extra-rim-dark": "#87909a",
    "glare": "1",
    "gloss": "0.86",
    "shadow-power": "0.38",
    "contrast": "0.94",
    "saturation": "0.88",
    "red-top": "#ff6a5c",
    "red-base": "#9b1712",
    "steel-dark": "#48505a",
    "stage-color": "#22252b",
  },
};

function setCssVar(name, value, unit = "") {
  root.style.setProperty(`--${name}`, `${value}${unit}`);
}

function syncControl(control) {
  setCssVar(control.dataset.var, control.value, control.dataset.unit || "");
}

function numberValue(name) {
  return Number.parseFloat(controlsByName.get(name)?.value || "0");
}

function stringValue(name) {
  return controlsByName.get(name)?.value || "";
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function mixHex(a, b, t) {
  const start = hexToRgb(a);
  const end = hexToRgb(b);

  return rgbToHex({
    r: start.r + (end.r - start.r) * t,
    g: start.g + (end.g - start.g) * t,
    b: start.b + (end.b - start.b) * t,
  });
}

function applyPreset(name) {
  const preset = presets[name];

  if (!preset) return;

  controls.forEach((control) => {
    const value = preset[control.dataset.var];

    if (value === undefined) return;

    control.value = value;
    syncControl(control);
  });

  buildExtraRims();
}

function setLayerStrokeWidth(layerId, width) {
  const svg = mount.querySelector("svg");
  const layer = svg?.querySelector(`#${layerId}`);

  if (!layer) return;

  svg.style.setProperty(`--melee3-${layerId}-width`, `${width}px`);
  layer.querySelectorAll("[stroke-width]").forEach((node) => {
    node.setAttribute("stroke-width", width);
  });
}

function applyStrokeWidths() {
  strokeControls.forEach((control) => {
    setLayerStrokeWidth(control.dataset.strokeLayer, control.value);
  });
}

function applyLayerVisibility() {
  const svg = mount.querySelector("svg");

  if (!svg) return;

  layerToggles.forEach((toggle) => {
    const layer = svg.querySelector(`#${toggle.dataset.layer}`);

    if (layer) layer.classList.toggle("is-hidden", !toggle.checked);
  });
}

function createRimUseClone(useNode, stroke, width) {
  const clone = useNode.cloneNode(true);

  clone.setAttribute("fill", "none");
  clone.setAttribute("stroke", stroke);
  clone.setAttribute("stroke-width", width.toFixed(2));
  clone.setAttribute("stroke-linejoin", "round");
  clone.setAttribute("stroke-linecap", "round");

  return clone;
}

function buildExtraRims() {
  const svg = mount.querySelector("svg");

  if (!svg) return;

  svg.querySelector("#extra-rim-layer")?.remove();

  const source = svg.querySelector("#silver-rim-layer");
  const sourceUses = Array.from(source?.querySelectorAll("use") || []);
  const count = Math.max(0, Math.round(numberValue("extra-rim-count")));

  if (!source || sourceUses.length === 0 || count === 0) {
    applyLayerVisibility();
    return;
  }

  const startWidth = numberValue("extra-rim-width");
  const widthStep = numberValue("extra-rim-step");
  const curve = numberValue("extra-rim-curve");
  const offset = numberValue("extra-rim-offset");
  const oppose = numberValue("extra-rim-oppose");
  const angle = (numberValue("extra-rim-angle") * Math.PI) / 180;
  const light = stringValue("extra-rim-light");
  const dark = stringValue("extra-rim-dark");
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");

  group.setAttribute("id", "extra-rim-layer");

  for (let i = 0; i < count; i += 1) {
    const t = count === 1 ? 0 : i / (count - 1);
    const centered = count === 1 ? 0 : t * 2 - 1;
    const curvedWidth = startWidth - widthStep * i + curve * centered * centered;
    const width = Math.max(1, curvedWidth);
    const sameDirection = i + 1;
    const opposingDirection = centered * count;
    const distance = offset * ((1 - Math.abs(oppose)) * sameDirection + Math.abs(oppose) * opposingDirection * Math.sign(oppose || 1));
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const band = document.createElementNS("http://www.w3.org/2000/svg", "g");

    band.setAttribute("data-extra-rim-band", `${i + 1}`);
    band.setAttribute("transform", `translate(${dx.toFixed(2)} ${dy.toFixed(2)})`);
    band.setAttribute("opacity", (0.92 - t * 0.42).toFixed(2));

    sourceUses.forEach((useNode) => {
      band.append(createRimUseClone(useNode, mixHex(light, dark, t), width));
    });

    group.append(band);
  }

  source.before(group);
  applyLayerVisibility();
}

async function loadSvg(src) {
  mount.innerHTML = '<div class="load-state">Loading MELEE 3 asset</div>';

  try {
    const response = await fetch(src);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    mount.innerHTML = text;

    const svg = mount.querySelector("svg");

    if (!svg) throw new Error("No SVG element found");

    svg.classList.add("logo-svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    applyStrokeWidths();
    buildExtraRims();
    applyLayerVisibility();
  } catch (error) {
    mount.innerHTML = `<div class="error-state">Run a local static server to load ${src}</div>`;
  }
}

function cssSnapshot() {
  const lines = controls.map((control) => {
    const name = control.dataset.var;
    const unit = control.dataset.unit || "";
    return `  --${name}: ${control.value}${unit};`;
  });
  const strokeLines = strokeControls.map((control) => {
    return `  ${control.dataset.strokeLayer}: ${control.value}px`;
  });

  return [
    ".melee-3-layer-lab {",
    ...lines,
    "}",
    "",
    "Original SVG stroke widths:",
    ...strokeLines,
    "",
    "Extra rims are generated in lab.js from #silver-rim-layer.",
  ].join("\n");
}

controls.forEach((control) => {
  syncControl(control);
  control.addEventListener("input", () => {
    syncControl(control);

    if (control.dataset.var.startsWith("extra-rim")) buildExtraRims();
  });
});

strokeControls.forEach((control) => {
  control.addEventListener("input", applyStrokeWidths);
});

layerToggles.forEach((toggle) => {
  toggle.addEventListener("change", applyLayerVisibility);
});

assetSelect.addEventListener("change", () => loadSvg(assetSelect.value));
presetSelect.addEventListener("change", () => applyPreset(presetSelect.value));

resetButton.addEventListener("click", () => {
  controls.forEach((control) => {
    control.value = defaults[control.dataset.var];
    syncControl(control);
  });
  strokeControls.forEach((control) => {
    control.value = strokeDefaults[control.dataset.strokeLayer];
  });
  presetSelect.value = "classic";
  applyStrokeWidths();
  buildExtraRims();
});

copyButton.addEventListener("click", async () => {
  const css = cssSnapshot();

  try {
    await navigator.clipboard.writeText(css);
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

applyPreset("classic");
loadSvg(assetSelect.value);
