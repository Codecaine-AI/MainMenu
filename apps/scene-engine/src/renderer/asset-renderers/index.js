import { renderMedia } from './media.js';
import { renderCssEffect } from './css-effect.js';
import { renderGlyphGroup } from './glyph-group.js';

const registry = new Map();

export function registerRenderer(type, fn) {
  registry.set(type, fn);
}

export function getRenderer(type) {
  const fn = registry.get(type);
  if (!fn) throw new Error(`No renderer registered for type: ${type}`);
  return fn;
}

registerRenderer('media', renderMedia);
registerRenderer('effect', renderCssEffect);
registerRenderer('glyph-group', renderGlyphGroup);
