import { ensureStylesheet } from './stylesheet.js';

export function renderCssEffect(layer, entry) {
  ensureStylesheet(entry.path);
  const root = document.createElement('div');
  root.className = 'crt';
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
