import { dom, state, setRecipeDirty } from "../state.js";

let mediaAssets = [];

function media() {
  return state.activeRecipe?.interior_media;
}

function ensureMedia() {
  if (!state.activeRecipe) return null;
  if (!state.activeRecipe.interior_media) {
    state.activeRecipe.interior_media = {
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
  }
  return state.activeRecipe.interior_media;
}

function getVideoShell() {
  const svg = dom.mount?.querySelector("svg");
  return svg?.querySelector("#fill-layer .melee-fill-media-shell") ?? null;
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

let lastGridKey = "";

function applyVideoTransform() {
  const m = media();
  if (!m) return;

  const shell = getVideoShell();
  if (!shell) return;

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

  if (gridKey !== lastGridKey) {
    lastGridKey = gridKey;
    const existing = Array.from(shell.querySelectorAll("video"));
    for (const v of existing) v.remove();

    for (let i = 0; i < targetCount; i++) {
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

  shell.querySelectorAll("video").forEach((v) => {
    v.style.objectFit = fit;
    v.style.opacity = String(opacity);
    v.style.filter = hue !== 0 ? `hue-rotate(${hue}deg)` : "";
    v.playbackRate = speed;
  });
}

function swapVideoSource(src) {
  lastGridKey = "";
  applyVideoTransform();
}

async function fetchMediaAssets() {
  try {
    const response = await fetch("/api/melee-3/media-assets");
    if (!response.ok) return [];
    const data = await response.json();
    return data.assets ?? [];
  } catch {
    return [];
  }
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

export async function renderMediaEditor() {
  const list = dom.mediaControlList;
  if (!list) return;
  list.replaceChildren();

  if (!mediaAssets.length) {
    mediaAssets = await fetchMediaAssets();
  }

  const m = ensureMedia();
  if (!m) return;

  const sourceSection = document.createElement("div");
  sourceSection.className = "media-control-section";

  const sourceLabel = document.createElement("label");
  sourceLabel.className = "media-source-label";
  const sourceName = document.createElement("span");
  sourceName.textContent = "Video Source";
  const sourceSelect = document.createElement("select");
  sourceSelect.className = "media-source-select";

  const noneOption = document.createElement("option");
  noneOption.value = "";
  noneOption.textContent = "None (disabled)";
  sourceSelect.append(noneOption);

  for (const asset of mediaAssets) {
    const option = document.createElement("option");
    option.value = asset.path;
    option.textContent = asset.name;
    if (m.src === asset.path) option.selected = true;
    sourceSelect.append(option);
  }

  if (m.src && !mediaAssets.some((a) => a.path === m.src)) {
    const option = document.createElement("option");
    option.value = m.src;
    option.textContent = m.src.split("/").pop();
    option.selected = true;
    sourceSelect.append(option);
  }

  if (!m.src) {
    noneOption.selected = true;
  }

  sourceSelect.addEventListener("change", () => {
    const val = sourceSelect.value;
    m.src = val;
    m.enabled = !!val;
    if (val) {
      swapVideoSource(val);
    }
    setRecipeDirty(true);
    renderControls();
  });

  sourceLabel.append(sourceName, sourceSelect);
  sourceSection.append(sourceLabel);
  list.append(sourceSection);

  const controlsContainer = document.createElement("div");
  controlsContainer.id = "mediaControlsContainer";
  list.append(controlsContainer);

  renderControls();

  function renderControls() {
    const container = document.getElementById("mediaControlsContainer");
    if (!container) return;
    container.replaceChildren();

    if (!m.enabled || !m.src) {
      const hint = document.createElement("p");
      hint.className = "media-hint";
      hint.textContent = "Select a video source to enable media controls.";
      container.append(hint);
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
        applyVideoTransform();
        setRecipeDirty(true);
      }),
      mediaSlider("Scale", m.scale ?? 1, 0.1, 5, 0.05, (v) => {
        m.scale = v;
        applyVideoTransform();
        setRecipeDirty(true);
      }),
      mediaSlider("Position X", m.position_x ?? 0, -100, 100, 1, (v) => {
        m.position_x = v;
        applyVideoTransform();
        setRecipeDirty(true);
      }),
      mediaSlider("Position Y", m.position_y ?? 0, -100, 100, 1, (v) => {
        m.position_y = v;
        applyVideoTransform();
        setRecipeDirty(true);
      }),
      mediaSlider("Rotation", m.rotation ?? 0, -180, 180, 1, (v) => {
        m.rotation = v;
        applyVideoTransform();
        setRecipeDirty(true);
      }),
      mediaSlider("Speed", m.speed ?? 1, 0.05, 4, 0.05, (v) => {
        m.speed = v;
        applyVideoTransform();
        setRecipeDirty(true);
      }),
      mediaSlider("Hue", m.hue ?? 0, -180, 180, 1, (v) => {
        m.hue = v;
        applyVideoTransform();
        setRecipeDirty(true);
      }),
    );

    container.append(transformSection);

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
      applyVideoTransform();
      setRecipeDirty(true);
    });
    fitLabel.append(fitName, fitSelect);
    fitSection.append(fitLabel);

    fitSection.append(
      mediaSlider("Repeat X", m.repeat_x ?? 1, 1, 8, 1, (v) => {
        m.repeat_x = Math.round(v);
        applyVideoTransform();
        setRecipeDirty(true);
      }),
      mediaSlider("Repeat Y", m.repeat_y ?? 1, 1, 8, 1, (v) => {
        m.repeat_y = Math.round(v);
        applyVideoTransform();
        setRecipeDirty(true);
      }),
    );

    container.append(fitSection);

    requestAnimationFrame(() => applyVideoTransform());
  }
}

export function syncMediaOnLoad() {
  lastGridKey = "";
  const m = media();
  if (m?.enabled) {
    requestAnimationFrame(() => applyVideoTransform());
  }
}
