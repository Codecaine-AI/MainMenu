export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function unitValue(value, unit = "px") {
  return `${Number(value)}${unit}`;
}

export function formatBandValue(value) {
  const number = Number(value);
  return Number.isInteger(number) ? String(number) : number.toFixed(1).replace(/\.0$/, "");
}

export function formatSvgNumber(value) {
  const number = Number(value);
  if (Math.abs(number - Math.round(number)) < 0.001) return String(Math.round(number));
  return number.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

export function prettyLayerName(id) {
  return id
    .replace(/-layer$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function isSolidColor(paint) {
  return /^#[0-9a-f]{6}$/i.test(paint ?? "");
}

export function layerStrokeWidth(layer) {
  if ("start" in layer || "thickness" in layer) {
    return 2 * (Number(layer.start ?? 0) + Number(layer.thickness ?? 0));
  }
  return Number(layer.width ?? 0);
}

export function layerInnerStrokeWidth(layer) {
  return 2 * Number(layer.start ?? 0);
}

export function controlModeBadge(mode) {
  const badge = document.createElement("span");
  badge.className = `control-mode-badge is-${mode}`;
  badge.textContent = mode === "live" ? "Live" : "Rebuild";
  return badge;
}
