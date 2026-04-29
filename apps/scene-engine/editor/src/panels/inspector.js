import { subscribe, getState } from '../state.js';
import { resolveLayer } from '../path.js';

function emptyState(text) {
  const p = document.createElement('p');
  p.className = 'inspector-empty';
  p.textContent = text;
  return p;
}

function dlPair(dl, key, value) {
  if (value === undefined || value === null) return;
  const dt = document.createElement('dt');
  dt.textContent = key;
  const dd = document.createElement('dd');
  dd.textContent = String(value);
  dl.append(dt, dd);
}

function renderLayerDl(layer) {
  const dl = document.createElement('dl');
  dl.className = 'inspector-list';
  dlPair(dl, 'id', layer.id);
  dlPair(dl, 'type', layer.type);
  dlPair(dl, 'layer', layer.layer);
  dlPair(dl, 'asset', layer.asset);
  dlPair(dl, 'visible', layer.visible);
  if (layer.position) {
    dlPair(dl, 'position.x', layer.position.x);
    dlPair(dl, 'position.y', layer.position.y);
  }
  if (layer.properties) {
    for (const [k, v] of Object.entries(layer.properties)) {
      dlPair(dl, `properties.${k}`, v);
    }
  }
  return dl;
}

function renderInspector() {
  const panel = document.getElementById('panel-inspector');
  panel.replaceChildren();
  const heading = document.createElement('h3');
  heading.className = 'inspector-heading';
  heading.textContent = 'Inspector';
  panel.appendChild(heading);
  const { scene, selectedPath } = getState();
  if (!scene) {
    panel.appendChild(emptyState('Loading scene...'));
    return;
  }
  if (!selectedPath) {
    panel.appendChild(emptyState('Select a layer to inspect.'));
    return;
  }
  const layer = resolveLayer(scene, selectedPath);
  if (!layer) {
    panel.appendChild(emptyState('Selected path no longer resolves.'));
    return;
  }
  panel.appendChild(renderLayerDl(layer));
}

export function initInspectorPanel() {
  subscribe('selection-changed', renderInspector);
  subscribe('scene-changed', renderInspector);
  renderInspector();
}
