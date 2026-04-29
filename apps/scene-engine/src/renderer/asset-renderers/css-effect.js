const loadedStylesheets = new Set();

function ensureStylesheet(href) {
  if (loadedStylesheets.has(href)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
  loadedStylesheets.add(href);
}

export function renderCssEffect(layer) {
  ensureStylesheet(layer.asset);
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
  root.style.opacity = layer.properties?.opacity ?? 1;
  return root;
}
