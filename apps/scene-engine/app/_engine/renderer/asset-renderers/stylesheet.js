import { resolveRuntimeUrl } from '../runtime-url.js';

const loadedStylesheets = new Set();

export function ensureStylesheet(href) {
  const resolvedHref = resolveRuntimeUrl(href);
  if (loadedStylesheets.has(resolvedHref)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = resolvedHref;
  document.head.appendChild(link);
  loadedStylesheets.add(resolvedHref);
}
