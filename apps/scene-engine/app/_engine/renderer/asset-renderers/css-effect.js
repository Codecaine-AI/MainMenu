import { ensureStylesheet } from './stylesheet.js';

function numberProp(properties, key, fallback) {
  const value = properties?.[key];
  return Number.isFinite(value) ? value : fallback;
}

export function applyCssEffectProperties(root, properties = {}) {
  const scanLineDensity = numberProp(properties, 'scan-line-density', 3);
  const scanLineThickness = numberProp(properties, 'scan-line-thickness', 1);
  const vignetteIntensity = numberProp(properties, 'vignette-intensity', 0.55);
  const rgbFringe = numberProp(properties, 'rgb-fringe', 0.04);

  root.style.setProperty('--crt-scan-gap', `${Math.max(1, scanLineDensity)}px`);
  root.style.setProperty('--crt-scan-thickness', `${Math.max(0.25, scanLineThickness)}px`);
  root.style.setProperty('--crt-scan-opacity', String(Math.min(1, Math.max(0, scanLineDensity / 30))));
  root.style.setProperty('--crt-vignette-opacity', String(Math.min(1, Math.max(0, vignetteIntensity))));
  root.style.setProperty('--crt-rgb-opacity', String(Math.min(1, Math.max(0, rgbFringe))));
}

export function renderCssEffect(layer, entry) {
  ensureStylesheet(entry.path);
  const root = document.createElement('div');
  root.className = 'crt';
  applyCssEffectProperties(root, layer.properties);
  const scan = document.createElement('div');
  scan.className = 'scan';
  const rgb = document.createElement('div');
  rgb.className = 'rgb';
  const vign = document.createElement('div');
  vign.className = 'vign';
  root.appendChild(scan);
  root.appendChild(rgb);
  root.appendChild(vign);
  return root;
}
