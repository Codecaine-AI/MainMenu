import '../styles/fonts.css';
import '../styles/base.css';
import '../styles/effects.css';
import '../styles/title.css';
import '../styles/menu.css';
import '../styles/screens.css';
import '../styles/tweaks.css';

export function initLayout() {
  document.body.innerHTML = `
    <div id="stage-wrap">
      <div id="stage">
        <div class="vortex">
          <div class="ring"></div>
          <div class="ring r2"></div>
          <div class="haze"></div>
        </div>
        <div id="screens"></div>
        <div class="crt" id="crt">
          <div class="scan"></div>
          <div class="rgb"></div>
          <div class="vign"></div>
        </div>
      </div>
    </div>
    <div id="tweaks-panel">
      <h3>TWEAKS</h3>
      <div class="tweak"><label>CRT scanlines</label><input type="checkbox" id="tw-crt" checked></div>
      <div class="tweak"><label>Menu audio</label><input type="checkbox" id="tw-audio"></div>
      <div class="tweak"><label>Vortex speed</label><input type="range" id="tw-speed" min="0" max="2" step="0.1" value="1"></div>
      <div class="tweak"><label>Accent hue</label><input type="range" id="tw-hue" min="0" max="360" step="1" value="48"></div>
      <div class="tweak"><label>Font family</label>
        <select id="tw-font">
          <option value="folkpro" selected>FolkPro</option>
          <option value="orbitron">Orbitron</option>
          <option value="michroma">Michroma</option>
          <option value="mono">JetBrains Mono</option>
        </select>
      </div>
    </div>
  `;

  const stage = document.getElementById('stage');
  const wrap = document.getElementById('stage-wrap');
  const screens = document.getElementById('screens');

  function fitStage() {
    const sw = wrap.clientWidth, sh = wrap.clientHeight;
    const s = Math.min(sw / 1440, sh / 1080);
    stage.style.transform = `scale(${s})`;
  }
  window.addEventListener('resize', fitStage);
  fitStage();

  return { stage, screens };
}
