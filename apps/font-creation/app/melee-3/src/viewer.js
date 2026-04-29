import { dom, state, tilt, tiltLimit, defaultTilt, layerVisibility, setStatus, setRecipeDirty, syncRecipeVisibility, loadRecipe } from "./state.js";
import { clamp, tiltValue } from "./utils.js";
import { svgLayers } from "./layer-data.js";
import { renderTiltEffects, patchSvgZTransforms, storeGradientBaseVectors } from "./tilt-effects.js";

const postLoadHooks = [];

export function onSvgLoad(fn) {
  postLoadHooks.push(fn);
}

const STYLE_STORAGE_KEY = "melee3-style-vars";

function loadSavedStyleVars() {
  try {
    return JSON.parse(localStorage.getItem(STYLE_STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

export function setStyleVar(name, value) {
  document.documentElement.style.setProperty(`--${name}`, value);
}

export function syncStyleControl(control) {
  const name = control.dataset.styleVar;
  setStyleVar(name, control.value);
}

export function saveStyleControl(control) {
  const saved = loadSavedStyleVars();
  saved[control.dataset.styleVar] = control.value;
  localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(saved));
}

export function restoreStyleControls(controls) {
  const saved = loadSavedStyleVars();
  for (const control of controls) {
    const value = saved[control.dataset.styleVar];
    if (value !== undefined) control.value = value;
  }
}

function renderTilt() {
  state.pendingTiltFrame = 0;
  dom.stageTilt.style.transform = `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`;
  renderTiltEffects();
}

function queueTiltRender() {
  if (state.pendingTiltFrame) return;
  state.pendingTiltFrame = requestAnimationFrame(renderTilt);
}

export function setTilt(x, y, { immediate = false } = {}) {
  tilt.x = tiltValue(clamp(x, -tiltLimit.x, tiltLimit.x));
  tilt.y = tiltValue(clamp(y, -tiltLimit.y, tiltLimit.y));

  if (immediate) {
    if (state.pendingTiltFrame) {
      cancelAnimationFrame(state.pendingTiltFrame);
      state.pendingTiltFrame = 0;
    }
    renderTilt();
    return;
  }

  queueTiltRender();
}

export function resetTilt() {
  setTilt(defaultTilt.x, defaultTilt.y, { immediate: true });
}

export function startTiltDrag(event) {
  if (event.button !== undefined && event.button !== 0) return;
  event.preventDefault();
  const rect = dom.scene.getBoundingClientRect();

  state.tiltDrag = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    originX: tilt.x,
    originY: tilt.y,
    width: rect.width,
    height: rect.height,
  };

  dom.workbench.classList.add("is-tilting");
  dom.workbench.setPointerCapture(event.pointerId);
}

export function updateTiltDrag(event) {
  if (!state.tiltDrag || event.pointerId !== state.tiltDrag.pointerId) return;
  const dx = event.clientX - state.tiltDrag.startX;
  const dy = event.clientY - state.tiltDrag.startY;
  const nextX = state.tiltDrag.originX - (dy / state.tiltDrag.height) * tiltLimit.x * 2;
  const nextY = state.tiltDrag.originY + (dx / state.tiltDrag.width) * tiltLimit.y * 2;
  setTilt(nextX, nextY);
}

export function stopTiltDrag(event) {
  if (!state.tiltDrag || event.pointerId !== state.tiltDrag.pointerId) return;
  state.tiltDrag = null;
  dom.workbench.classList.remove("is-tilting");
  dom.workbench.releasePointerCapture(event.pointerId);
}

export function applyLayerVisibility() {
  const svg = dom.mount.querySelector("svg");
  if (!svg) return;

  svgLayers().forEach((entry) => {
    const layer = svg.querySelector(`#${CSS.escape(entry.id)}`);
    if (layer) layer.classList.toggle("is-hidden", !entry.visible);
  });
}

export async function loadSvg(src) {
  dom.mount.innerHTML = '<div class="load-state">Loading MELEE 3 asset</div>';

  try {
    await loadRecipe();
    const response = await fetch(src);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const text = await response.text();
    dom.mount.innerHTML = text;

    const svg = dom.mount.querySelector("svg");
    if (!svg) throw new Error("No SVG element found");

    svg.classList.add("logo-svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const isBaked = svg.dataset.baked === "true";

    if (!isBaked) {
      patchSvgZTransforms(svg);
      storeGradientBaseVectors(svg);
    }

    svg.querySelectorAll("foreignObject video").forEach((video) => {
      video.play().catch(() => {});
    });
    dom.styleControls.forEach(syncStyleControl);
    layerVisibility.clear();

    applyLayerVisibility();
    postLoadHooks.forEach((fn) => fn());

    setRecipeDirty(false);
  } catch (error) {
    dom.mount.innerHTML = `<div class="error-state">Run a local static server to load ${src}</div>`;
    setStatus(error.message);
  }
}

export async function bakeSvg() {
  const src = dom.assetSelect.value;
  const svgRelative = src.replace(/^\/generation\//, "").replace(/\?.*$/, "");
  const scale = Number(dom.bakeScale?.value ?? 2);

  setStatus(`Baking at ${scale}x...`);
  dom.bakeButton.disabled = true;

  try {
    const response = await fetch("/api/melee-3/bake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ svg: svgRelative, scale }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Bake failed.");
    }

    const bakedUrl = payload.bakedSvg;
    const currentOption = dom.assetSelect.options[dom.assetSelect.selectedIndex];
    const bakedLabel = `${currentOption.textContent.replace(/ \(baked\)$/, "")} (baked)`;

    let bakedOption = Array.from(dom.assetSelect.options).find(
      (o) => o.dataset.bakedFrom === src,
    );
    if (!bakedOption) {
      bakedOption = document.createElement("option");
      bakedOption.dataset.bakedFrom = src;
      currentOption.after(bakedOption);
    }
    bakedOption.value = bakedUrl;
    bakedOption.textContent = bakedLabel;
    bakedOption.dataset.baked = "true";

    dom.assetSelect.value = bakedUrl;
    await loadSvg(bakedUrl);
    setStatus("Bake complete.");
  } catch (error) {
    setStatus(`Bake error: ${error.message}`);
  } finally {
    dom.bakeButton.disabled = false;
  }
}

export async function regenerateSvgs({ full = false } = {}) {
  if (!full && !state.recipeDirty) return;

  setStatus(full ? "Full regenerate (all glyphs)..." : "Saving...");
  dom.regenerateButton.disabled = true;
  if (full) dom.fullRegenerateButton.disabled = true;
  syncRecipeVisibility();

  try {
    const response = await fetch("/api/melee-3/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipe: state.activeRecipe, full }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Regeneration failed.");
    }

    await loadSvg(`${dom.assetSelect.value}?v=${Date.now()}`);
    state.savedRecipe = structuredClone(state.activeRecipe);
    setRecipeDirty(false);
    setStatus(full ? "Full regenerate complete." : "Saved.");
  } catch (error) {
    setStatus(error.message);
    if (!full) setRecipeDirty(true);
  } finally {
    dom.regenerateButton.disabled = !state.recipeDirty;
    if (full) dom.fullRegenerateButton.disabled = false;
  }
}
