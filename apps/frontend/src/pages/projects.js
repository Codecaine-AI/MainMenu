import { initLayout } from '../shared/layout.js';
import { applyTweaks, wireTweaks } from '../shared/tweaks.js';
import SFX from '../shared/audio.js';
import PROJECTS from '../data/projects.json';

const { screens } = initLayout();
let selected = 0;

function render() {
  const sel = PROJECTS[selected] || PROJECTS[0];
  const el = document.createElement('div');
  el.className = 'screen active';
  el.innerHTML = `
    <div class="menu-shell">
      <div class="header-bar">
        <div class="crumb">Main Menu</div>
        <div class="crumb-sep"></div>
        <div class="crumb active chroma">Projects</div>
        <div class="header-line"></div>
      </div>
      <div class="menu-frame" style="grid-template-columns: 1fr;">
        <div class="projects-grid">
          ${PROJECTS.map((p, i) => `
            <div class="project-card ${i === selected ? 'selected' : ''}" data-i="${i}">
              <div class="project-thumb">${p.thumb}</div>
              <div class="project-title">${p.title}</div>
              <div class="project-meta">${p.kind} &middot; ${p.year}</div>
              <div class="project-tags">
                ${p.tags.map(t => `<span class="project-tag">${t}</span>`).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      <div class="hint-bar">
        <span class="hint-tag">//&nbsp;HINT</span>
        <span>${sel.title} — ${sel.tags.join(' · ')}. Press B to return.</span>
      </div>
    </div>
  `;
  el.querySelectorAll('.project-card').forEach(c => {
    const i = +c.dataset.i;
    c.addEventListener('mouseenter', () => { if (selected !== i) { selected = i; SFX.move(); render(); } });
    c.addEventListener('click', () => { SFX.select(); });
  });
  screens.innerHTML = '';
  screens.appendChild(el);
  applyTweaks();
}

window.addEventListener('keydown', e => {
  const count = PROJECTS.length;
  if (e.key === 'ArrowUp') {
    selected = Math.max(0, selected - 3); SFX.move(); render(); e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    selected = Math.min(count - 1, selected + 3); SFX.move(); render(); e.preventDefault();
  } else if (e.key === 'ArrowLeft') {
    selected = Math.max(0, selected - 1); SFX.move(); render(); e.preventDefault();
  } else if (e.key === 'ArrowRight') {
    selected = Math.min(count - 1, selected + 1); SFX.move(); render(); e.preventDefault();
  } else if (['Escape', 'Backspace', 'b', 'B'].includes(e.key)) {
    SFX.back(); window.location.href = '/menu/'; e.preventDefault();
  }
});

render();
wireTweaks();
