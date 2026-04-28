const SFX = (() => {
  let ctx = null, enabled = false;
  function ensure() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); }
  function blip(freq = 520, dur = 0.06, type = 'square', gain = 0.06) {
    if (!enabled) return;
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(gain, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  }
  return {
    set: v => { enabled = v; },
    move: () => blip(620, 0.05, 'square', 0.04),
    select: () => { blip(880, 0.07, 'square', 0.07); setTimeout(() => blip(1320, 0.09, 'square', 0.05), 40); },
    back: () => blip(360, 0.09, 'square', 0.06),
    start: () => {
      blip(520, 0.08, 'square', 0.07);
      setTimeout(() => blip(780, 0.08, 'square', 0.07), 70);
      setTimeout(() => blip(1040, 0.12, 'square', 0.07), 140);
    }
  };
})();

export default SFX;
