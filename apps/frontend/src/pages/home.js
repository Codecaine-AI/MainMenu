import { initLayout } from '../shared/layout.js';
import { applyTweaks, wireTweaks } from '../shared/tweaks.js';
import SFX from '../shared/audio.js';

const { screens } = initLayout();

function goToMenu() {
  SFX.start();
  window.location.href = '/menu/';
}

const el = document.createElement('div');
el.id = 'title-screen';
el.className = 'screen active';
el.innerHTML = `
  <div style="position:relative;">
    <div class="title-logo chroma">CODECAINE<span class="title-tm">™</span></div>
    <div class="title-sub chroma">personal site // v4.06</div>
    <div class="title-press">PRESS&nbsp;&nbsp;START</div>
    <div class="title-copyright">
      &copy; 2026 CODECAINE LABS &nbsp;//&nbsp; HAND-ASSEMBLED ON A WEEKNIGHT<br>
      NO COOKIES, NO TRACKING, NO QUARTERS REQUIRED
    </div>
  </div>
`;
el.addEventListener('click', goToMenu);
screens.appendChild(el);

window.addEventListener('keydown', e => {
  if (['Enter', ' ', 'NumpadEnter'].includes(e.key)) {
    goToMenu();
    e.preventDefault();
  }
});

applyTweaks();
wireTweaks();
