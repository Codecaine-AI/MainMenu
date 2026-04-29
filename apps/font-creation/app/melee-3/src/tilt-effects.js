import { dom, state, tilt, tiltLimit, recipeLayer } from "./state.js";
import { tiltValue, formatSvgNumber } from "./utils.js";
import { layerPresentation } from "./layer-data.js";

const maxTiltMagnitude = Math.sqrt(tiltLimit.x ** 2 + tiltLimit.y ** 2);

const Z_RANGE = 8;
const Z_MIN_ORDER = 10;
const Z_MAX_ORDER = 95;

const layerZDepths = Object.fromEntries(
  Object.entries(layerPresentation).map(([id, { order }]) => [
    id,
    ((Math.min(order, Z_MAX_ORDER) - Z_MIN_ORDER) / (Z_MAX_ORDER - Z_MIN_ORDER)) * Z_RANGE - Z_RANGE / 2,
  ])
);

const shadowTiltSensitivity = {
  "outer-chrome-cast-shadow-on-background-layer": { sensitivity: 0.28, type: "projected" },
  "chrome-top-cast-shadow-on-red-layer": { sensitivity: 0.20, type: "projected" },
  "inner-chrome-cast-shadow-on-red-layer": { sensitivity: 0.18, type: "projected" },
  "chrome-top-cast-shadow-on-lower-bevel-layer": { sensitivity: 0.08, type: "projected" },
  "red-contact-shadow-layer": { sensitivity: 0.06, type: "css" },
  "red-contact-core-shadow-layer": { sensitivity: 0.04, type: "css" },
};

const reflectionTiltSensitivity = {
  "chrome-hot-reflection-layer": { dx: 0.8, dy: 0.3 },
  "chrome-dark-reflection-layer": { dx: 0.6, dy: 0.2 },
  "chrome-stack-soft-hot-reflection-layer": { dx: 0.5, dy: 0.2 },
  "chrome-stack-soft-dark-reflection-layer": { dx: 0.4, dy: 0.15 },
  "inner-ramp-hot-reflection-layer": { dx: 0.4, dy: 0.15 },
  "inner-ramp-dark-reflection-layer": { dx: 0.3, dy: 0.1 },
  "outer-ramp-hot-reflection-layer": { dx: 0.45, dy: 0.18 },
  "outer-ramp-dark-reflection-layer": { dx: 0.3, dy: 0.1 },
};

const GRADIENT_TILT_IDS = ["chrome-dark-reflection-gradient", "chrome-hot-reflection-gradient"];
let gradientBaseVectors = new Map();

export function storeGradientBaseVectors(svg) {
  gradientBaseVectors = new Map();
  for (const id of GRADIENT_TILT_IDS) {
    const el = svg.querySelector(`#${CSS.escape(id)}`);
    if (!el) continue;
    gradientBaseVectors.set(id, {
      x1: Number(el.getAttribute("x1")) || 0,
      y1: Number(el.getAttribute("y1")) || 0,
      x2: Number(el.getAttribute("x2")) || 0,
      y2: Number(el.getAttribute("y2")) || 0,
    });
  }
}

export function patchSvgZTransforms(svg) {
  const styleEl = svg.querySelector("style");
  if (!styleEl) return;

  const scope = state.activeRecipe?.css_scope ?? "melee3";
  let text = styleEl.textContent;

  for (const id of Object.keys(layerPresentation)) {
    const escaped = CSS.escape(id);
    const zVar = `var(--${scope}-${id}-z, 0px)`;

    const ruleWithTransform = new RegExp(
      `(#${escaped}\\s*\\{[^}]*)(transform:\\s*[^;]+)(;[^}]*\\})`,
    );
    if (ruleWithTransform.test(text)) {
      text = text.replace(ruleWithTransform, `$1$2 translateZ(${zVar})$3`);
      continue;
    }

    const ruleWithoutTransform = new RegExp(`(#${escaped}\\s*\\{)([^}]*\\})`);
    if (ruleWithoutTransform.test(text)) {
      text = text.replace(
        ruleWithoutTransform,
        `$1 transform: translateZ(${zVar});$2`,
      );
    }
  }

  styleEl.textContent = text;
}

function cssScope() {
  return state.activeRecipe?.css_scope ?? "melee3";
}

export function renderZDepth(svg) {
  if (!svg) return;
  const scope = cssScope();
  const magnitude = Math.sqrt(tilt.x ** 2 + tilt.y ** 2) / maxTiltMagnitude;
  const scale = magnitude * state.tiltResponseIntensity;

  for (const [id, baseZ] of Object.entries(layerZDepths)) {
    svg.style.setProperty(`--${scope}-${id}-z`, `${tiltValue(baseZ * scale)}px`);
  }
}

export function renderShadowTilt(svg) {
  if (!svg || !state.activeRecipe) return;
  const scope = cssScope();
  const intensity = state.tiltResponseIntensity;

  for (const [layerId, { sensitivity, type }] of Object.entries(shadowTiltSensitivity)) {
    const layer = recipeLayer(layerId);
    if (!layer) continue;

    const baseDx = layer.dx ?? 0;
    const baseDy = layer.dy ?? 0;
    const tiltDx = tiltValue(-tilt.y * sensitivity * intensity);
    const tiltDy = tiltValue(tilt.x * sensitivity * intensity);
    const totalDx = baseDx + tiltDx;
    const totalDy = baseDy + tiltDy;

    if (type === "projected") {
      const transformNode = svg.querySelector(
        `[data-projected-shadow-transform="${CSS.escape(layerId)}"]`,
      );
      transformNode?.setAttribute(
        "transform",
        `translate(${formatSvgNumber(totalDx)} ${formatSvgNumber(totalDy)})`,
      );
    } else {
      svg.style.setProperty(`--${scope}-${layerId}-dx`, `${tiltValue(totalDx)}px`);
      svg.style.setProperty(`--${scope}-${layerId}-dy`, `${tiltValue(totalDy)}px`);
    }
  }
}

export function renderReflectionTilt(svg) {
  if (!svg || !state.activeRecipe) return;
  const scope = cssScope();
  const intensity = state.tiltResponseIntensity;

  for (const [layerId, { dx: dxSens, dy: dySens }] of Object.entries(reflectionTiltSensitivity)) {
    const layer = recipeLayer(layerId);
    if (!layer) continue;

    const baseDx = layer.dx ?? 0;
    const baseDy = layer.dy ?? 0;
    const tiltDx = tiltValue(tilt.y * dxSens * intensity);
    const tiltDy = tiltValue(-tilt.x * dySens * intensity);

    svg.style.setProperty(`--${scope}-${layerId}-dx`, `${tiltValue(baseDx + tiltDx)}px`);
    svg.style.setProperty(`--${scope}-${layerId}-dy`, `${tiltValue(baseDy + tiltDy)}px`);
  }

  for (const [gradId, base] of gradientBaseVectors) {
    const el = svg.querySelector(`#${CSS.escape(gradId)}`);
    if (!el) continue;
    el.setAttribute("x2", formatSvgNumber(base.x2 + tilt.y * 0.4 * intensity));
    el.setAttribute("y2", formatSvgNumber(base.y2 - tilt.x * 0.2 * intensity));
  }
}

export function renderTiltEffects() {
  if (!state.tiltResponseEnabled) return;
  const svg = dom.mount.querySelector("svg");
  if (!svg) return;
  renderShadowTilt(svg);
  renderReflectionTilt(svg);
  renderZDepth(svg);
}

export function resetTiltEffects() {
  const svg = dom.mount.querySelector("svg");
  if (!svg || !state.activeRecipe) return;
  const scope = cssScope();

  for (const [layerId, { type }] of Object.entries(shadowTiltSensitivity)) {
    const layer = recipeLayer(layerId);
    if (!layer) continue;

    if (type === "projected") {
      const transformNode = svg.querySelector(
        `[data-projected-shadow-transform="${CSS.escape(layerId)}"]`,
      );
      transformNode?.setAttribute(
        "transform",
        `translate(${formatSvgNumber(layer.dx ?? 0)} ${formatSvgNumber(layer.dy ?? 0)})`,
      );
    } else {
      svg.style.setProperty(`--${scope}-${layerId}-dx`, `${tiltValue(layer.dx ?? 0)}px`);
      svg.style.setProperty(`--${scope}-${layerId}-dy`, `${tiltValue(layer.dy ?? 0)}px`);
    }
  }

  for (const layerId of Object.keys(reflectionTiltSensitivity)) {
    const layer = recipeLayer(layerId);
    if (!layer) continue;
    svg.style.setProperty(`--${scope}-${layerId}-dx`, `${tiltValue(layer.dx ?? 0)}px`);
    svg.style.setProperty(`--${scope}-${layerId}-dy`, `${tiltValue(layer.dy ?? 0)}px`);
  }

  for (const id of Object.keys(layerZDepths)) {
    svg.style.setProperty(`--${scope}-${id}-z`, "0px");
  }

  for (const [gradId, base] of gradientBaseVectors) {
    const el = svg.querySelector(`#${CSS.escape(gradId)}`);
    if (!el) continue;
    el.setAttribute("x2", formatSvgNumber(base.x2));
    el.setAttribute("y2", formatSvgNumber(base.y2));
  }
}
