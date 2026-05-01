import { dom, recipeLayer, state, setRecipeDirty } from "../state.js";

const defaultMedia = {
  enabled: false,
  mode: "video",
  src: "",
  opacity: 1,
  fit: "cover",
  scale: 1,
  position_x: 0,
  position_y: 0,
  repeat_x: 1,
  repeat_y: 1,
  rotation: 0,
  speed: 1,
  hue: 0,
  autoplay: true,
  muted: true,
  loop: true,
  playsinline: true,
};

let mediaAssets = [];
let mediaAssetsLoaded = false;
const gridKeys = new Map();

function legacyRecipeMedia(layerId) {
  const media = state.activeRecipe?.interior_media;
  return layerId === "fill-layer" && media && typeof media === "object" ? media : null;
}

function cloneMedia(media = {}) {
  return { ...defaultMedia, ...structuredClone(media), mode: media.mode ?? "video" };
}

function layerMedia(layerId) {
  const layer = recipeLayer(layerId);
  return layer?.media ?? legacyRecipeMedia(layerId);
}

function ensureLayerMedia(layerId) {
  const layer = recipeLayer(layerId);
  if (!layer) return null;
  if (!layer.media) layer.media = cloneMedia(legacyRecipeMedia(layerId) ?? {});
  return layer.media;
}

function removeLegacyMedia(layerId) {
  if (layerId === "fill-layer" && state.activeRecipe?.interior_media) {
    delete state.activeRecipe.interior_media;
  }
}

function getVideoShell(layerId) {
  const svg = dom.mount?.querySelector("svg");
  return svg?.querySelector(`#${CSS.escape(layerId)} .melee-layer-media-shell, #${CSS.escape(layerId)} .melee-fill-media-shell`) ?? null;
}

function setPaintFallbackVisible(layerId, visible) {
  const svg = dom.mount?.querySelector("svg");
  svg?.querySelectorAll(`#${CSS.escape(layerId)} .melee-layer-paint-fallback`).forEach((node) => {
    node.style.display = visible ? "" : "none";
  });
}

function buildVideoElement(src, fit, opacity) {
  const video = document.createElement("video");
  video.src = src;
  video.autoplay = true;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  video.style.width = "100%";
  video.style.height = "100%";
  video.style.display = "block";
  video.style.objectFit = fit;
  video.style.opacity = String(opacity);
  return video;
}

function clearVideoShell(layerId) {
  gridKeys.delete(layerId);
  const shell = getVideoShell(layerId);
  if (!shell) return;
  shell.querySelectorAll("video").forEach((video) => video.remove());
  shell.style.display = "none";
  setPaintFallbackVisible(layerId, true);
}

function applyVideoTransform(layerId) {
  const m = layerMedia(layerId);
  if (!m?.enabled || !m.src) {
    clearVideoShell(layerId);
    return;
  }

  const shell = getVideoShell(layerId);
  if (!shell) return;
  setPaintFallbackVisible(layerId, false);

  const repeatX = Math.max(1, Math.round(m.repeat_x ?? 1));
  const repeatY = Math.max(1, Math.round(m.repeat_y ?? 1));
  const scale = Math.max(0.1, m.scale ?? 1);
  const posX = m.position_x ?? 0;
  const posY = m.position_y ?? 0;
  const rotation = m.rotation ?? 0;
  const speed = Math.max(0.05, m.speed ?? 1);
  const hue = m.hue ?? 0;
  const fit = m.fit ?? "cover";
  const opacity = m.opacity ?? 1;
  const src = m.src ?? "";

  const targetCount = repeatX * repeatY;
  const gridKey = `${targetCount}:${src}`;

  if (gridKey !== gridKeys.get(layerId)) {
    gridKeys.set(layerId, gridKey);
    shell.querySelectorAll("video").forEach((video) => video.remove());

    for (let i = 0; i < targetCount; i += 1) {
      const video = buildVideoElement(src, fit, opacity);
      shell.appendChild(video);
      video.play().catch(() => {});
    }
  }

  if (targetCount > 1) {
    shell.style.display = "grid";
    shell.style.gridTemplateColumns = `repeat(${repeatX}, 1fr)`;
    shell.style.gridTemplateRows = `repeat(${repeatY}, 1fr)`;
  } else {
    shell.style.display = "";
    shell.style.gridTemplateColumns = "";
    shell.style.gridTemplateRows = "";
  }

  shell.style.transform = `translate(${posX}%, ${posY}%) scale(${scale}) rotate(${rotation}deg)`;
  shell.style.transformOrigin = "center center";

  shell.querySelectorAll("video").forEach((video) => {
    video.style.objectFit = fit;
    video.style.opacity = String(opacity);
    video.style.filter = hue !== 0 ? `hue-rotate(${hue}deg)` : "";
    video.playbackRate = speed;
  });
}

export async function loadMediaAssets() {
  if (mediaAssetsLoaded) return mediaAssets;
  mediaAssetsLoaded = true;
  try {
    const response = await fetch("/api/melee-3/media-assets");
    if (!response.ok) return mediaAssets;
    const data = await response.json();
    mediaAssets = data.assets ?? [];
  } catch {
    mediaAssets = [];
  }
  return mediaAssets;
}

function mediaSlider(labelText, value, min, max, step, onChange) {
  const label = document.createElement("label");
  const header = document.createElement("span");
  const inputs = document.createElement("span");
  const rangeInput = document.createElement("input");
  const numberInput = document.createElement("input");

  label.className = "media-slider";
  header.className = "media-slider-header";
  header.textContent = labelText;
  inputs.className = "media-slider-inputs";

  rangeInput.type = "range";
  rangeInput.min = String(min);
  rangeInput.max = String(max);
  rangeInput.step = String(step);
  rangeInput.value = String(value);

  numberInput.type = "number";
  numberInput.min = String(min);
  numberInput.max = String(max);
  numberInput.step = String(step);
  numberInput.value = String(value);

  function sync(val) {
    const clamped = Math.max(Number(min), Math.min(Number(max), Number(val)));
    rangeInput.value = String(clamped);
    numberInput.value = String(clamped);
    onChange(clamped);
  }

  rangeInput.addEventListener("input", () => sync(rangeInput.value));
  numberInput.addEventListener("input", () => {
    if (numberInput.value === "") return;
    sync(numberInput.value);
  });

  inputs.append(rangeInput, numberInput);
  label.append(header, inputs);
  return label;
}

function markMediaDirty(layerId) {
  removeLegacyMedia(layerId);
  setRecipeDirty(true);
}

function writableLayerMedia(layerId) {
  return ensureLayerMedia(layerId);
}

export function layerMediaControls(layerId) {
  const layer = recipeLayer(layerId);
  const mediaLayerTypes = new Set(["fill", "stroke", "rect-fill"]);
  if (!layer || !mediaLayerTypes.has(layer.type)) return null;

  const wrapper = document.createElement("div");
  wrapper.className = "layer-media-controls";
  let m = layerMedia(layerId) ?? defaultMedia;
  if (!layer.media && legacyRecipeMedia(layerId)) m = ensureLayerMedia(layerId);
  if (!m) return null;

  const sourceSection = document.createElement("div");
  sourceSection.className = "media-control-section";

  const sourceLabel = document.createElement("label");
  sourceLabel.className = "media-source-label";
  const sourceName = document.createElement("span");
  sourceName.textContent = "Surface";
  const sourceSelect = document.createElement("select");
  sourceSelect.className = "media-source-select";

  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "Paint / gradient";
  sourceSelect.append(noneOption);

  for (const asset of mediaAssets) {
    const option = document.createElement("option");
    option.value = asset.path;
    option.textContent = asset.name;
    if (m.src === asset.path) option.selected = true;
    sourceSelect.append(option);
  }

  if (m.src && !mediaAssets.some((asset) => asset.path === m.src)) {
    const option = document.createElement("option");
    option.value = m.src;
    option.textContent = m.src.split("/").pop();
    option.selected = true;
    sourceSelect.append(option);
  }

  if (!m.src) noneOption.selected = true;

  const controlsContainer = document.createElement("div");
  controlsContainer.className = "layer-media-transform-controls";

  function renderControls() {
    controlsContainer.replaceChildren();

    if (!m.enabled || !m.src) {
      return;
    }

    const transformSection = document.createElement("div");
    transformSection.className = "media-control-section";

    const transformTitle = document.createElement("h3");
    transformTitle.textContent = "Transform";
    transformSection.append(transformTitle);

    transformSection.append(
      mediaSlider("Opacity", m.opacity ?? 1, 0, 1, 0.01, (v) => {
        m.opacity = v;
        applyVideoTransform(layerId);
        markMediaDirty(layerId);
      }),
      mediaSlider("Scale", m.scale ?? 1, 0.1, 5, 0.05, (v) => {
        m.scale = v;
        applyVideoTransform(layerId);
        markMediaDirty(layerId);
      }),
      mediaSlider("Position X", m.position_x ?? 0, -100, 100, 1, (v) => {
        m.position_x = v;
        applyVideoTransform(layerId);
        markMediaDirty(layerId);
      }),
      mediaSlider("Position Y", m.position_y ?? 0, -100, 100, 1, (v) => {
        m.position_y = v;
        applyVideoTransform(layerId);
        markMediaDirty(layerId);
      }),
      mediaSlider("Rotation", m.rotation ?? 0, -180, 180, 1, (v) => {
        m.rotation = v;
        applyVideoTransform(layerId);
        markMediaDirty(layerId);
      }),
      mediaSlider("Speed", m.speed ?? 1, 0.05, 4, 0.05, (v) => {
        m.speed = v;
        applyVideoTransform(layerId);
        markMediaDirty(layerId);
      }),
      mediaSlider("Hue", m.hue ?? 0, -180, 180, 1, (v) => {
        m.hue = v;
        applyVideoTransform(layerId);
        markMediaDirty(layerId);
      }),
    );

    const fitSection = document.createElement("div");
    fitSection.className = "media-control-section";

    const fitTitle = document.createElement("h3");
    fitTitle.textContent = "Fit & Repeat";
    fitSection.append(fitTitle);

    const fitLabel = document.createElement("label");
    fitLabel.className = "media-fit-label";
    const fitName = document.createElement("span");
    fitName.textContent = "Object Fit";
    const fitSelect = document.createElement("select");
    for (const mode of ["cover", "contain", "fill", "none"]) {
      const opt = document.createElement("option");
      opt.value = mode;
      opt.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
      if (m.fit === mode) opt.selected = true;
      fitSelect.append(opt);
    }
    fitSelect.addEventListener("change", () => {
      m.fit = fitSelect.value;
      applyVideoTransform(layerId);
      markMediaDirty(layerId);
    });
    fitLabel.append(fitName, fitSelect);
    fitSection.append(fitLabel);

    fitSection.append(
      mediaSlider("Repeat X", m.repeat_x ?? 1, 1, 8, 1, (v) => {
        m.repeat_x = Math.round(v);
        applyVideoTransform(layerId);
        markMediaDirty(layerId);
      }),
      mediaSlider("Repeat Y", m.repeat_y ?? 1, 1, 8, 1, (v) => {
        m.repeat_y = Math.round(v);
        applyVideoTransform(layerId);
        markMediaDirty(layerId);
      }),
    );

    controlsContainer.append(transformSection, fitSection);
    requestAnimationFrame(() => applyVideoTransform(layerId));
  }

  sourceSelect.addEventListener("change", () => {
    m = writableLayerMedia(layerId);
    if (!m) return;
    m.src = sourceSelect.value;
    m.enabled = !!m.src;
    gridKeys.delete(layerId);
    if (m.enabled) {
      applyVideoTransform(layerId);
    } else {
      clearVideoShell(layerId);
    }
    markMediaDirty(layerId);
    renderControls();
  });

  sourceLabel.append(sourceName, sourceSelect);
  sourceSection.append(sourceLabel);
  wrapper.append(sourceSection, controlsContainer);
  renderControls();
  return wrapper;
}

export function syncMediaOnLoad() {
  gridKeys.clear();
  state.activeRecipe?.layers?.forEach((layer) => {
    const m = layerMedia(layer.id);
    if (m?.enabled) requestAnimationFrame(() => applyVideoTransform(layer.id));
  });
}
