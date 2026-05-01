import { syncMediaSurface } from '../media-surface.js';

export function renderMedia(layer, entry) {
  const wrapper = document.createElement('div');
  wrapper.className = 'media-layer';
  wrapper.style.width = '100%';
  wrapper.style.height = '100%';
  wrapper.style.position = 'relative';
  wrapper.style.overflow = 'hidden';
  syncMediaSurface(wrapper, {
    type: layer.type,
    entry,
    appearance: layer.appearance,
    properties: layer.properties,
  });
  return wrapper;
}
