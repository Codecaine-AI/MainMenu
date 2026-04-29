import { subscribe, getState } from '../state.js';

const TYPE_ORDER = ['media', 'effect', 'glyph-group', 'component', 'audio'];

function emptyState(text) {
  const p = document.createElement('p');
  p.className = 'inspector-empty';
  p.textContent = text;
  return p;
}

function renderGroup(type, entries) {
  const section = document.createElement('section');
  section.className = 'asset-group';
  const h4 = document.createElement('h4');
  h4.className = 'asset-group-title';
  h4.textContent = type;
  const ul = document.createElement('ul');
  ul.className = 'asset-list';
  for (const { id, path } of entries) {
    const li = document.createElement('li');
    li.className = 'asset-row';
    li.dataset.assetId = id;
    const idSpan = document.createElement('span');
    idSpan.className = 'asset-id';
    idSpan.textContent = id;
    const pathSpan = document.createElement('span');
    pathSpan.className = 'asset-path';
    pathSpan.textContent = path;
    li.append(idSpan, pathSpan);
    ul.appendChild(li);
  }
  section.append(h4, ul);
  return section;
}

function renderBrowser() {
  const panel = document.getElementById('panel-asset-browser');
  panel.replaceChildren();
  const heading = document.createElement('h3');
  heading.className = 'asset-browser-heading';
  heading.textContent = 'Assets';
  panel.appendChild(heading);
  const { registry } = getState();
  if (!registry) {
    panel.appendChild(emptyState('Loading registry...'));
    return;
  }
  const groups = Object.entries(registry).reduce((acc, [id, entry]) => {
    (acc[entry.type] ??= []).push({ id, ...entry });
    return acc;
  }, {});
  const content = document.createElement('div');
  content.className = 'asset-browser-content';
  const seen = new Set();
  for (const type of TYPE_ORDER) {
    if (groups[type]?.length) {
      content.appendChild(renderGroup(type, groups[type]));
      seen.add(type);
    }
  }
  for (const type of Object.keys(groups).sort()) {
    if (!seen.has(type)) content.appendChild(renderGroup(type, groups[type]));
  }
  panel.appendChild(content);
}

export function initAssetBrowserPanel() {
  subscribe('registry-changed', renderBrowser);
  renderBrowser();
}
