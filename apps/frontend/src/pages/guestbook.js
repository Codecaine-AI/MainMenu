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
      <div class="crumb active chroma">Guestbook</div>
      <div class="header-line"></div>
    </div>
    <div class="menu-frame" style="grid-template-columns: 1fr;">
      <div class="stub">
        <h2 class="chroma">Sign the Wall</h2>
        <p>Say hi, drop a doodle, sign with a date stamp. No spam, no ads, just vibes.</p>
        <p style="color: var(--cyan); margin-top: 40px; font-size: 18px; letter-spacing: 0.1em;">// COMING SOON</p>
      </div>
    </div>
    <div class="hint-bar">
      <span class="hint-tag">//&nbsp;HINT</span>
      <span>Guestbook is under construction. Press B to return.</span>
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
