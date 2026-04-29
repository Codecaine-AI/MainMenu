import { renderMedia } from './media.js';
import { renderCssEffect } from './css-effect.js';
import { renderGlyphGroup } from './glyph-group.js';
import { renderComponent } from './component.js';
import { renderAudio } from './audio.js';

const registry = new Map();

export function registerRenderer(type, fn) {
  registry.set(type, fn);
}

export function getRenderer(type) {
  const fn = registry.get(type);
  if (!fn) throw new Error(`No renderer registered for type: ${type}`);
  return fn;
}

registerRenderer('video', renderMedia);
registerRenderer('image', renderMedia);
registerRenderer('effect', renderCssEffect);
registerRenderer('glyph-group', renderGlyphGroup);
registerRenderer('component', renderComponent);
registerRenderer('audio', renderAudio);
