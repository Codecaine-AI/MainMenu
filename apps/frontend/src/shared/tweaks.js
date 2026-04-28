import SFX from './audio.js';

const TWEAK_DEFAULTS = {
  crt: true,
  audio: false,
  speed: 1,
  hue: 48,
  font: "folkpro"
};

let tweaks = { ...TWEAK_DEFAULTS };

export function applyTweaks() {
  document.getElementById('crt').classList.toggle('off', !tweaks.crt);
  SFX.set(tweaks.audio);
  document.querySelectorAll('.vortex .ring').forEach(r => {
    r.style.animationDuration = (90 / Math.max(0.1, tweaks.speed)) + 's';
  });
  const h = tweaks.hue;
  const root = document.documentElement.style;
  root.setProperty('--amber',      `hsl(${h}, 90%, 54%)`);
  root.setProperty('--amber-deep', `hsl(${h}, 85%, 34%)`);
  root.setProperty('--amber-glow', `hsl(${h}, 95%, 70%)`);

  const fontMap = {
    folkpro: "'FolkPro', 'Orbitron', sans-serif",
    orbitron: "'Orbitron', sans-serif",
    michroma: "'Michroma', sans-serif",
    mono: "'JetBrains Mono', monospace",
  };
  document.querySelectorAll('.title-logo, .title-sub, .title-press, .crumb, .pill, .preview-title, .hint-bar, .preview-label, .preview-list, .project-title, .project-meta, .stub h2, .testimonial-card .a, .link-row .label')
    .forEach(n => n.style.fontFamily = fontMap[tweaks.font]);
}

export function wireTweaks() {
  const crt = document.getElementById('tw-crt');
  const audio = document.getElementById('tw-audio');
  const speed = document.getElementById('tw-speed');
  const hue = document.getElementById('tw-hue');
  const font = document.getElementById('tw-font');
  crt.checked = tweaks.crt; audio.checked = tweaks.audio;
  speed.value = tweaks.speed; hue.value = tweaks.hue; font.value = tweaks.font;
  function push(partial) {
    tweaks = { ...tweaks, ...partial };
    applyTweaks();
    try { window.parent.postMessage({ type: '__edit_mode_set_keys', edits: partial }, '*'); } catch {}
  }
  crt.addEventListener('change', () => push({ crt: crt.checked }));
  audio.addEventListener('change', () => push({ audio: audio.checked }));
  speed.addEventListener('input', () => push({ speed: +speed.value }));
  hue.addEventListener('input', () => push({ hue: +hue.value }));
  font.addEventListener('change', () => push({ font: font.value }));

  window.addEventListener('message', e => {
    const d = e.data || {};
    if (d.type === '__activate_edit_mode')   document.getElementById('tweaks-panel').classList.add('on');
    if (d.type === '__deactivate_edit_mode') document.getElementById('tweaks-panel').classList.remove('on');
  });
  try { window.parent.postMessage({ type: '__edit_mode_available' }, '*'); } catch {}
}
