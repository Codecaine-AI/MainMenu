import { subscribe, getState, setSelectedPath, moveLayer } from '../state.js';
import { resolveLayer } from '../path.js';

const collapsed = new Set();

function siblingPath(path, offset) {
  const parts = path.split('.children.');
  const last = Number(parts[parts.length - 1]) + offset;
  parts[parts.length - 1] = String(last);
  return parts.join('.children.');
}

function intoPath(path, childCount) {
  return `${path}.children.${childCount}`;
}

function clearAllDropIndicators(panel) {
  panel.querySelectorAll('.drop-indicator-before, .drop-indicator-after, .drop-indicator-into')
    .forEach(r => r.classList.remove('drop-indicator-before', 'drop-indicator-after', 'drop-indicator-into'));
}

function computeRegion(e, row, isGroup) {
  const rect = row.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const third = rect.height / 3;
  if (isGroup) {
    if (y < third) return 'before';
    if (y > rect.height - third) return 'after';
    return 'into';
  }
  return y < rect.height / 2 ? 'before' : 'after';
}

function regionToToPath(targetPath, region, scene) {
  if (region === 'before') return targetPath;
  if (region === 'after') return siblingPath(targetPath, 1);
  if (region === 'into') {
    const layer = resolveLayer(scene, targetPath);
    const count = layer?.children?.length ?? 0;
    return intoPath(targetPath, count);
  }
  return null;
}

function renderTree(layers, basePath = '') {
  const ul = document.createElement('ul');
  ul.className = 'hierarchy-tree';
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const path = basePath ? `${basePath}.children.${i}` : String(i);
    const li = document.createElement('li');
    li.className = 'hierarchy-row';
    li.dataset.path = path;
    li.dataset.layerType = layer.type ?? 'sub-layer';
    li.draggable = true;
    const hasChildren = layer.children?.length > 0;
    if (hasChildren) {
      const chev = document.createElement('button');
      chev.className = 'chev';
      chev.dataset.togglePath = path;
      chev.textContent = collapsed.has(path) ? '▶' : '▼';
      li.appendChild(chev);
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'chev';
      spacer.textContent = ' ';
      li.appendChild(spacer);
    }
    const label = document.createElement('span');
    label.className = 'label';
    label.textContent = `${layer.id} [${layer.type ?? 'sub-layer'}]`;
    li.appendChild(label);
    ul.appendChild(li);
    if (hasChildren && !collapsed.has(path)) {
      ul.appendChild(renderTree(layer.children, path));
    }
  }
  return ul;
}

function updateActiveRow() {
  const panel = document.getElementById('panel-hierarchy');
  panel.querySelectorAll('.hierarchy-row.is-selected').forEach(r => r.classList.remove('is-selected'));
  const path = getState().selectedPath;
  if (path) panel.querySelector(`.hierarchy-row[data-path="${CSS.escape(path)}"]`)?.classList.add('is-selected');
}

function renderPanel() {
  const panel = document.getElementById('panel-hierarchy');
  const scene = getState().scene;
  panel.replaceChildren(scene ? renderTree(scene.layers) : document.createTextNode(''));
  updateActiveRow();
}

function onClick(e) {
  const chev = e.target.closest('.chev[data-toggle-path]');
  if (chev) {
    const path = chev.dataset.togglePath;
    if (collapsed.has(path)) collapsed.delete(path);
    else collapsed.add(path);
    renderPanel();
    return;
  }
  const row = e.target.closest('.hierarchy-row');
  if (row && !e.target.closest('.chev')) {
    setSelectedPath(row.dataset.path);
  }
}

function onDragStart(e) {
  const row = e.target.closest('.hierarchy-row');
  if (!row) return;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('application/x-layer-path', row.dataset.path);
  e.dataTransfer.setData('text/plain', row.dataset.path);
}

function onDragOver(e) {
  if (!e.dataTransfer.types.includes('application/x-layer-path')) return;
  const row = e.target.closest('.hierarchy-row');
  const panel = document.getElementById('panel-hierarchy');
  clearAllDropIndicators(panel);
  if (!row) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const isGroup = row.dataset.layerType === 'glyph-group';
  const region = computeRegion(e, row, isGroup);
  row.classList.add(`drop-indicator-${region}`);
}

function onDragLeave(e) {
  const panel = document.getElementById('panel-hierarchy');
  if (!panel.contains(e.relatedTarget)) clearAllDropIndicators(panel);
}

function onDrop(e) {
  const panel = document.getElementById('panel-hierarchy');
  if (!e.dataTransfer.types.includes('application/x-layer-path')) {
    clearAllDropIndicators(panel);
    return;
  }
  const fromPath = e.dataTransfer.getData('application/x-layer-path');
  const row = e.target.closest('.hierarchy-row');
  clearAllDropIndicators(panel);
  if (!fromPath || !row) return;
  e.preventDefault();
  const isGroup = row.dataset.layerType === 'glyph-group';
  const region = computeRegion(e, row, isGroup);
  const targetPath = row.dataset.path;
  if (region === 'into' && (targetPath === fromPath || targetPath.startsWith(fromPath + '.children.'))) return;
  const toPath = regionToToPath(targetPath, region, getState().scene);
  if (!toPath) return;
  if (toPath === fromPath) return;
  if (toPath.startsWith(fromPath + '.children.')) return;
  moveLayer(fromPath, toPath);
}

export function initHierarchyPanel() {
  const panel = document.getElementById('panel-hierarchy');
  panel.addEventListener('click', onClick);
  panel.addEventListener('dragstart', onDragStart);
  panel.addEventListener('dragover', onDragOver);
  panel.addEventListener('dragleave', onDragLeave);
  panel.addEventListener('drop', onDrop);
  subscribe('scene-changed', renderPanel);
  subscribe('selection-changed', updateActiveRow);
}
