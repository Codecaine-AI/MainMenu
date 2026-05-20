const AUDIO_SRC = '/assets/audio/melee-menu-song/melee-menu-song.mp3';

function clamp01(value, fallback = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function resolveAudioSrc(src) {
  if (typeof window !== 'undefined' && window.MELEE_BUNDLE_ROOT) {
    return new URL(src.replace(/^\/+/, ''), window.MELEE_BUNDLE_ROOT).href;
  }
  return src;
}

export default function ({ properties = {}, layerId } = {}) {
  const el = document.createElement('div');
  el.style.display = 'none';
  el.dataset.audioId = layerId ?? 'melee-menu-song';

  const audio = document.createElement('audio');
  audio.preload = 'auto';
  audio.src = resolveAudioSrc(AUDIO_SRC);
  audio.style.display = 'none';
  el.appendChild(audio);

  let settings = { ...properties };
  let gestureListener = null;

  function applySettings() {
    audio.volume = clamp01(settings.volume ?? 0.35);
    audio.loop = settings.loop ?? true;
  }

  function clearGestureListener() {
    if (!gestureListener) return;
    document.removeEventListener('pointerdown', gestureListener);
    document.removeEventListener('keydown', gestureListener);
    gestureListener = null;
  }

  function armOnGesture() {
    if (gestureListener) return;
    gestureListener = () => {
      clearGestureListener();
      el.play();
    };
    document.addEventListener('pointerdown', gestureListener, { once: true });
    document.addEventListener('keydown', gestureListener, { once: true });
  }

  el.setAudioProperties = (nextProperties = {}) => {
    settings = { ...settings, ...nextProperties };
    applySettings();
  };

  el.play = () => {
    applySettings();
    const playback = audio.play();
    if (playback?.catch) {
      playback.catch((err) => {
        if (err?.name === 'NotAllowedError') {
          armOnGesture();
          return;
        }
        if (err?.name !== 'AbortError') console.warn('[audio] melee-menu-song playback failed', err);
      });
    }
    return playback;
  };

  el.stop = () => {
    clearGestureListener();
    audio.pause();
    audio.currentTime = 0;
  };

  applySettings();
  if (settings.autoplay ?? true) queueMicrotask(() => el.play());

  queueMicrotask(() => {
    const parent = el.parentNode;
    if (!parent) return;
    const observer = new MutationObserver(() => {
      if (!el.isConnected) {
        observer.disconnect();
        el.stop();
      }
    });
    observer.observe(parent, { childList: true });
  });

  return el;
}
