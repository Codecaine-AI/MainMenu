let sharedCtx = null;
let refCount = 0;

function clamp01(v) {
  return Math.max(0, Math.min(1, Number(v) || 0));
}

function ensureCtx() {
  if (!sharedCtx) sharedCtx = new (window.AudioContext || window.webkitAudioContext)();
  refCount += 1;
  return sharedCtx;
}

function releaseCtx() {
  refCount = Math.max(0, refCount - 1);
  if (refCount === 0 && sharedCtx) {
    sharedCtx.close().catch(() => {});
    sharedCtx = null;
  }
}

export default function ({ properties = {}, layerId } = {}) {
  const el = document.createElement('div');
  el.style.display = 'none';
  el.dataset.audioId = layerId ?? 'audio';
  const volume = clamp01(properties.volume ?? 1.0);
  const loop = !!properties.loop;
  const autoplay = properties.autoplay ?? true;
  let loopTimer = null;
  let armed = false;
  let resumeListener = null;

  function blip(freq, dur, gain) {
    const ctx = sharedCtx;
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'square';
    o.frequency.value = freq;
    g.gain.setValueAtTime(gain * volume, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  }

  function playCue() {
    blip(520, 0.08, 0.07);
    setTimeout(() => blip(780, 0.08, 0.07), 70);
    setTimeout(() => blip(1040, 0.12, 0.07), 140);
  }

  function cleanupGestureListeners() {
    if (resumeListener) {
      document.removeEventListener('pointerdown', resumeListener);
      document.removeEventListener('keydown', resumeListener);
      resumeListener = null;
    }
  }

  function arm() {
    if (armed) return;
    armed = true;
    ensureCtx();
    playCue();
    if (loop) loopTimer = setInterval(playCue, 4000);
  }

  el.play = () => arm();
  el.stop = () => {
    if (loopTimer) {
      clearInterval(loopTimer);
      loopTimer = null;
    }
  };

  if (autoplay) {
    resumeListener = () => {
      arm();
      cleanupGestureListeners();
    };
    document.addEventListener('pointerdown', resumeListener, { once: true });
    document.addEventListener('keydown', resumeListener, { once: true });
  }

  function cleanup() {
    el.stop();
    cleanupGestureListeners();
    if (armed) releaseCtx();
  }

  queueMicrotask(() => {
    const parent = el.parentNode;
    if (!parent) return;
    const obs = new MutationObserver(() => {
      if (!el.isConnected) {
        obs.disconnect();
        cleanup();
      }
    });
    obs.observe(parent, { childList: true });
  });

  return el;
}
