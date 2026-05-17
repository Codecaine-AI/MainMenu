function numberOr(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function styleIdForLayer(layerId) {
  return `text-layer-style-${String(layerId).replace(/[^a-zA-Z0-9_-]/g, '-')}`;
}

function cssString(value) {
  return String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function applyCustomCss(layer) {
  const layerId = layer.id;
  if (!layerId) return;

  const styleId = styleIdForLayer(layerId);
  let styleEl = document.getElementById(styleId);
  const customCss = String(layer.properties?.customCss ?? '').trim();

  if (!customCss) {
    styleEl?.remove();
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = styleId;
    document.head.appendChild(styleEl);
  }

  styleEl.textContent = `[data-layer-id="${cssString(layerId)}"] {\n${customCss}\n}`;
}

export function applyTextProperties(el, layer) {
  const props = layer.properties || {};
  el.textContent = String(props.text ?? 'New Text');
  el.style.display = 'inline-block';
  el.style.whiteSpace = 'pre-wrap';
  el.style.fontFamily = String(props.fontFamily ?? 'FolkPro');
  el.style.fontSize = `${numberOr(props.fontSize, 72)}px`;
  el.style.fontWeight = String(props.fontWeight ?? 700);
  el.style.color = String(props.color ?? '#ffffff');
  el.style.lineHeight = String(numberOr(props.lineHeight, 1));
  el.style.letterSpacing = `${numberOr(props.letterSpacing, 0)}px`;
  el.style.textAlign = String(props.textAlign ?? 'left');
  if (layer.transform?.mode !== 'fill' && layer.transform?.width === 'auto') {
    el.style.width = 'max-content';
  }
  if (layer.transform?.mode !== 'fill' && layer.transform?.height === 'auto') {
    el.style.height = 'auto';
  }
  applyCustomCss(layer);
}

export function renderText(layer) {
  const el = document.createElement('div');
  el.className = 'text-layer';
  applyTextProperties(el, layer);
  return el;
}
