const loadedStylesheets = new Set();

export function ensureStylesheet(href) {
  if (loadedStylesheets.has(href)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
  loadedStylesheets.add(href);
}
