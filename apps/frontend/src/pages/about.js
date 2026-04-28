import { initLayout } from '../shared/layout.js';
import { applyTweaks, wireTweaks } from '../shared/tweaks.js';
import SFX from '../shared/audio.js';

const { screens } = initLayout();

const el = document.createElement('div');
el.className = 'screen active';
el.innerHTML = `
  <div class="menu-shell">
    <div class="header-bar">
      <div class="crumb">Main Menu</div>
      <div class="crumb-sep"></div>
      <div class="crumb active chroma">About</div>
      <div class="header-line"></div>
    </div>
    <div class="menu-frame" style="grid-template-columns: 1fr;">
      <div class="stub">
        <h2 class="chroma">Player One</h2>
        <p>Codecaine is a workshop run by one caffeinated human who designs, builds, and occasionally demolishes software for a living. Shipping since the era of CRT televisions and save files that fit on a memory card.</p>
        <p>Currently: taking on small, strange, high-polish commissions. Interfaces that feel like objects. Tools that feel like toys. Websites that remember they are, in fact, on a computer.</p>
        <p style="color: var(--amber); font-family: 'FolkPro', 'Orbitron', sans-serif; font-size: 18px; letter-spacing: 0.2em; margin-top: 30px;">// STATS</p>
        <p>HP 87/100 &nbsp;&middot;&nbsp; MP 42/60 &nbsp;&middot;&nbsp; XP 9,182 &nbsp;&middot;&nbsp; COFFEE STREAK 2,118 DAYS</p>
      </div>
    </div>
    <div class="hint-bar">
      <span class="hint-tag">//&nbsp;HINT</span>
      <span>Hand-crafted artisanal HTML. Press B to return.</span>
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
