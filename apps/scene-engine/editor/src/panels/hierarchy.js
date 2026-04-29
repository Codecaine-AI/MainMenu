import { subscribe, getState, setSelectedPath } from '../state.js';

const collapsed = new Set();

function renderTree(layers, basePath = '') {
  const ul = document.createElement('ul');
  ul.className = 'hierarchy-tree';
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const path = basePath ? `${basePath}.children.${i}` : String(i);
    const li = document.createElement('li');
    li.className = 'hierarchy-row';
    li.dataset.path = path;
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

export function initHierarchyPanel() {
  const panel = document.getElementById('panel-hierarchy');
  panel.addEventListener('click', onClick);
  subscribe('scene-changed', renderPanel);
  subscribe('selection-changed', updateActiveRow);
}
