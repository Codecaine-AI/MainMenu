import { initLayout } from '../shared/layout.js';
import { applyTweaks, wireTweaks } from '../shared/tweaks.js';
import SFX from '../shared/audio.js';
import MENUS from '../data/menus.json';

const { screens } = initLayout();
let selected = 0;

const ROUTES = {
  projects: '/projects/',
  testimonials: '/testimonials/',
  links: '/links/',
  about: '/about/',
  guestbook: '/guestbook/',
};

function render() {
  const menu = MENUS.main;
  const sel = menu.items[selected] || menu.items[0];
  const el = document.createElement('div');
  el.className = 'screen active';
  el.innerHTML = `
    <div class="menu-shell">
      <div class="header-bar">
        <div class="crumb">Main Menu</div>
        <div class="header-slits">
          <div class="slit"></div>
          <div class="slit"></div>
          <div class="slit"></div>
        </div>
      </div>
      <div class="menu-frame">
        <div class="menu-list">
          ${menu.items.map((it, i) => `
            <div class="pill ${i === selected ? 'selected' : ''}" data-i="${i}">
              ${it.label}
              <div class="pill-tip"></div>
            </div>
          `).join('')}
        </div>
        <div class="ns-divider">
          <div class="tick-row"></div>
          <div class="ns-label">NEXT SCREEN</div>
        </div>
        <div class="preview">
          <div class="preview-label">PREVIEW</div>
          <div class="preview-title">${sel.preview.title}</div>
          <div class="preview-sub">${sel.preview.sub}</div>
          <div class="preview-list">
            ${sel.preview.list.map(x => `<div>${x}</div>`).join('')}
          </div>
        </div>
      </div>
      <div class="hint-bar">
        <span>${sel.preview.title}: ${sel.hint}</span>
      </div>
    </div>
  `;
  el.querySelectorAll('.pill').forEach(p => {
    const i = +p.dataset.i;
    p.addEventListener('mouseenter', () => {
      if (selected !== i) { selected = i; SFX.move(); render(); }
    });
    p.addEventListener('click', () => {
      SFX.select();
      const route = ROUTES[menu.items[i].id];
      if (route) window.location.href = route;
    });
  });
  screens.innerHTML = '';
  screens.appendChild(el);
  applyTweaks();
}

window.addEventListener('keydown', e => {
  const count = MENUS.main.items.length;
  if (e.key === 'ArrowUp') {
    selected = (selected - 1 + count) % count; SFX.move(); render(); e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    selected = (selected + 1) % count; SFX.move(); render(); e.preventDefault();
  } else if (['Enter', ' ', 'NumpadEnter'].includes(e.key)) {
    SFX.select();
    const route = ROUTES[MENUS.main.items[selected].id];
    if (route) window.location.href = route;
    e.preventDefault();
  } else if (['Escape', 'Backspace', 'b', 'B'].includes(e.key)) {
    SFX.back();
    window.location.href = '/';
    e.preventDefault();
  }
});

render();
wireTweaks();
