const AUDIO_SRC = '/assets/audio/ui-navigation/ui-navigation.wav';

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
  el.dataset.audioId = layerId ?? 'ui-navigation';

  const audio = document.createElement('audio');
  audio.preload = 'auto';
  audio.src = resolveAudioSrc(AUDIO_SRC);
  audio.style.display = 'none';
  el.appendChild(audio);

  let settings = { ...properties };

  function applySettings() {
    audio.volume = clamp01(settings.volume ?? 1);
    audio.loop = Boolean(settings.loop);
  }

  el.setAudioProperties = (nextProperties = {}) => {
    settings = { ...settings, ...nextProperties };
    applySettings();
  };

  el.play = () => {
    applySettings();
    audio.currentTime = 0;
    const playback = audio.play();
    if (playback?.catch) {
      playback.catch((err) => {
        if (err?.name !== 'AbortError') console.warn('[audio] ui-navigation playback failed', err);
      });
    }
    return playback;
  };

  el.stop = () => {
    audio.pause();
    audio.currentTime = 0;
  };

  applySettings();
  if (settings.autoplay) queueMicrotask(() => el.play());

  return el;
}
