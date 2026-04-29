import { subscribe, getState, mutateLayerAt } from '../state.js';
import { resolveLayer } from '../path.js';

const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay',
  'darken', 'lighten', 'color-dodge', 'color-burn',
  'hard-light', 'soft-light', 'difference', 'exclusion',
  'hue', 'saturation', 'color', 'luminosity',
];

const NUMERIC_PROPERTY_STEPS = {
  opacity: { step: 0.05, min: 0, max: 1 },
  scale: { step: 0.01 },
  hue: { step: 1, min: 0, max: 360 },
};

function emptyState(text) {
  const p = document.createElement('p');
  p.className = 'inspector-empty';
  p.textContent = text;
  return p;
}

function patchFromDottedKey(dottedKey, value) {
  const keys = dottedKey.split('.');
  const root = {};
  let cursor = root;
  for (let i = 0; i < keys.length - 1; i++) {
    cursor[keys[i]] = {};
    cursor = cursor[keys[i]];
  }
  cursor[keys[keys.length - 1]] = value;
  return root;
}

function commitPatch(getCurrentPath, dottedKey, value) {
  const path = getCurrentPath();
  if (path == null) return;
  mutateLayerAt(path, patchFromDottedKey(dottedKey, value));
}

function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    if (t) clearTimeout(t);
    t = setTimeout(() => { t = null; fn(...args); }, ms);
  };
}

function readonlyPair(dl, label, value) {
  if (value === undefined || value === null) return;
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = String(value);
  dd.classList.add('is-readonly');
  dl.append(dt, dd);
}

function appendField(dl, label, control) {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.appendChild(control);
  dl.append(dt, dd);
}

function makeNumberInput(value, opts, onCommit) {
  const input = document.createElement('input');
  input.type = 'number';
  input.value = value;
  if (opts.step != null) input.step = opts.step;
  if (opts.min != null) input.min = opts.min;
  if (opts.max != null) input.max = opts.max;
  const debounced = debounce(() => {
    if (input.value === '') return;
    const n = Number(input.value);
    if (Number.isFinite(n)) onCommit(n);
  }, 80);
  input.addEventListener('input', debounced);
  return input;
}

function makeTextInput(value, onCommit) {
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value ?? '';
  input.addEventListener('change', () => onCommit(input.value));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur();
  });
  return input;
}

function makeCheckbox(value, onCommit) {
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.checked = value !== false;
  input.addEventListener('change', () => onCommit(input.checked));
  return input;
}

function makeBlendSelect(value, onCommit) {
  const sel = document.createElement('select');
  for (const mode of BLEND_MODES) {
    const opt = document.createElement('option');
    opt.value = mode;
    opt.textContent = mode;
    sel.appendChild(opt);
  }
  sel.value = value ?? 'normal';
  sel.addEventListener('change', () => onCommit(sel.value));
  return sel;
}

function renderLayerForm(layer, getCurrentPath) {
  const dl = document.createElement('dl');
  dl.className = 'inspector-list';

  readonlyPair(dl, 'id', layer.id);
  readonlyPair(dl, 'type', layer.type);
  readonlyPair(dl, 'layer', layer.layer);
  readonlyPair(dl, 'asset', layer.asset);

  if (layer.visible !== undefined || layer.type || layer.layer) {
    const visible = layer.visible !== false;
    appendField(dl, 'visible', makeCheckbox(visible, (v) => {
      commitPatch(getCurrentPath, 'visible', v);
    }));
  }

  if (layer.position) {
    if (layer.position.x !== undefined) {
      appendField(dl, 'position.x', makeTextInput(layer.position.x, (v) => {
        const num = Number(v);
        commitPatch(getCurrentPath, 'position.x', Number.isFinite(num) && v.trim() !== '' && !isNaN(num) ? num : v);
      }));
    }
    if (layer.position.y !== undefined) {
      appendField(dl, 'position.y', makeTextInput(layer.position.y, (v) => {
        const num = Number(v);
        commitPatch(getCurrentPath, 'position.y', Number.isFinite(num) && v.trim() !== '' && !isNaN(num) ? num : v);
      }));
    }
  }

  if (layer.properties) {
    for (const [k, v] of Object.entries(layer.properties)) {
      const dotted = `properties.${k}`;
      if (k === 'blend') {
        appendField(dl, dotted, makeBlendSelect(v, (val) => commitPatch(getCurrentPath, dotted, val)));
      } else if (NUMERIC_PROPERTY_STEPS[k] && typeof v === 'number') {
        appendField(dl, dotted, makeNumberInput(v, NUMERIC_PROPERTY_STEPS[k], (val) => commitPatch(getCurrentPath, dotted, val)));
      } else if (typeof v === 'number') {
        appendField(dl, dotted, makeNumberInput(v, { step: 'any' }, (val) => commitPatch(getCurrentPath, dotted, val)));
      } else if (typeof v === 'boolean') {
        appendField(dl, dotted, makeCheckbox(v, (val) => commitPatch(getCurrentPath, dotted, val)));
      } else {
        appendField(dl, dotted, makeTextInput(v, (val) => commitPatch(getCurrentPath, dotted, val)));
      }
    }
  }

  return dl;
}

function renderInspector() {
  const panel = document.getElementById('panel-inspector');
  if (panel.contains(document.activeElement)) return;
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
  panel.appendChild(renderLayerForm(layer, () => getState().selectedPath));
}

export function initInspectorPanel() {
  subscribe('selection-changed', renderInspector);
  subscribe('scene-changed', renderInspector);
  renderInspector();
}
