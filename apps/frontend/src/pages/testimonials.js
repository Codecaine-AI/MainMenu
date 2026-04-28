import { initLayout } from '../shared/layout.js';
import { applyTweaks, wireTweaks } from '../shared/tweaks.js';
import SFX from '../shared/audio.js';
import TESTIMONIALS from '../data/testimonials.json';

const { screens } = initLayout();

const el = document.createElement('div');
el.className = 'screen active';
el.innerHTML = `
  <div class="menu-shell">
    <div class="header-bar">
      <div class="crumb">Main Menu</div>
      <div class="crumb-sep"></div>
      <div class="crumb active chroma">Testimonials</div>
      <div class="header-line"></div>
    </div>
    <div class="menu-frame" style="grid-template-columns: 1fr;">
      <div class="stub" style="overflow:auto;">
        <h2 class="chroma">Receipts</h2>
        ${TESTIMONIALS.map(t => `
          <div class="testimonial-card">
            <div class="q">“${t.q}”</div>
            <div class="a">${t.a}</div>
          </div>
        `).join('')}
      </div>
    </div>
    <div class="hint-bar">
      <span class="hint-tag">//&nbsp;HINT</span>
      <span>Press B (or Esc) to return to Main Menu.</span>
    </div>
  </div>
`;
screens.appendChild(el);

window.addEventListener('keydown', e => {
  if (['Escape', 'Backspace', 'b', 'B'].includes(e.key)) {
    SFX.back(); window.location.href = '/menu/'; e.preventDefault();
  }
});

applyTweaks();
wireTweaks();
