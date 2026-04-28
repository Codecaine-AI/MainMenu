import { initLayout } from '../shared/layout.js';
import { applyTweaks, wireTweaks } from '../shared/tweaks.js';
import SFX from '../shared/audio.js';
import LINKS from '../data/links.json';

const { screens } = initLayout();
let selected = 0;

function render() {
  const sel = LINKS[selected] || LINKS[0];
  const el = document.createElement('div');
  el.className = 'screen active';
  el.innerHTML = `
    <div class="menu-shell">
      <div class="header-bar">
        <div class="crumb">Main Menu</div>
        <div class="crumb-sep"></div>
        <div class="crumb active chroma">Links</div>
        <div class="header-line"></div>
      </div>
      <div class="menu-frame" style="grid-template-columns: 1fr;">
        <div class="stub">
          <h2 class="chroma">Directory</h2>
          <div>
            ${LINKS.map((l, i) => `
              <div class="link-row ${i === selected ? 'selected' : ''}" data-i="${i}">
                <div class="label">${l.label}</div>
                <div class="url">${l.url}</div>
                <div class="arrow">&gt;</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
      <div class="hint-bar">
        <span class="hint-tag">//&nbsp;HINT</span>
        <span>${sel.label} — ${sel.url}</span>
      </div>
    </div>
  `;
  el.querySelectorAll('.link-row').forEach(r => {
    const i = +r.dataset.i;
    r.addEventListener('mouseenter', () => { if (selected !== i) { selected = i; SFX.move(); render(); } });
    r.addEventListener('click', () => { SFX.select(); });
  });
  screens.innerHTML = '';
  screens.appendChild(el);
  applyTweaks();
}

window.addEventListener('keydown', e => {
  const count = LINKS.length;
  if (e.key === 'ArrowUp') {
    selected = (selected - 1 + count) % count; SFX.move(); render(); e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    selected = (selected + 1) % count; SFX.move(); render(); e.preventDefault();
  } else if (['Escape', 'Backspace', 'b', 'B'].includes(e.key)) {
    SFX.back(); window.location.href = '/menu/'; e.preventDefault();
  }
});

render();
wireTweaks();
