import { resolveAsset } from './asset-registry.js';
import { renderAudio } from './asset-renderers/audio.js';

const EVENT_CLEANUP = Symbol('meleeEventCleanup');
const audioElements = new Map();

function eventsForTrigger(events, trigger) {
  if (!Array.isArray(events)) return [];
  return events.filter((event) => event?.trigger === trigger);
}

function pointerTriggers(events) {
  const triggers = new Set();
  for (const event of events ?? []) {
    if (event?.trigger === 'click' || event?.trigger === 'hover') triggers.add(event.trigger);
  }
  return triggers;
}

function orderedBindings(bindings) {
  const navigate = [];
  const other = [];
  for (const binding of bindings) {
    if (binding?.action === 'navigate') navigate.push(binding);
    else other.push(binding);
  }
  return [...other, ...navigate];
}

async function defaultPlayAudio(target, binding = {}) {
  if (!target) return;
  const properties = { autoplay: false, ...(binding.properties ?? {}) };
  let el = audioElements.get(target);
  if (!el || !el.isConnected) {
    const entry = resolveAsset(target);
    if (!entry) return;
    el = await renderAudio(
      {
        id: `event-audio-${target}`,
        type: 'audio',
        asset: target,
        properties,
      },
      entry,
    );
    el.dataset.eventAudioId = target;
    el.style.display = 'none';
    document.body.appendChild(el);
    audioElements.set(target, el);
  } else if (typeof el.setAudioProperties === 'function') {
    el.setAudioProperties(properties);
  }
  if (typeof el.play === 'function') el.play();
}

export async function playAudio(target, binding = {}) {
  await defaultPlayAudio(target, binding);
}

if (typeof window !== 'undefined' && typeof window.MELEE_playAudio !== 'function') {
  window.MELEE_playAudio = (target, binding = {}) => playAudio(target, binding);
}

async function runBinding(binding, layer, runtime) {
  const target = binding?.target;
  if (binding?.action === 'navigate') {
    if (!target) return;
    if (typeof runtime?.navigate === 'function') {
      await runtime.navigate(target, { binding, layer });
      return;
    }
    if (typeof window !== 'undefined' && typeof window.MELEE_navigate === 'function') {
      await window.MELEE_navigate(target);
      return;
    }
    console.warn(`[events] No navigate handler for target '${target}'`);
    return;
  }

  if (binding?.action === 'play-audio' || binding?.action === 'autoplay') {
    const audioTarget = target ?? layer.asset;
    if (typeof runtime?.playAudio === 'function') {
      await runtime.playAudio(audioTarget, { binding, layer });
      return;
    }
    await playAudio(audioTarget, binding);
    return;
  }

  console.warn(`[events] Unsupported action '${binding?.action}'`);
}

async function runBindings(bindings, layer, runtime) {
  for (const binding of orderedBindings(bindings)) {
    await runBinding(binding, layer, runtime);
  }
}

export function bindObjectEvents(el, layer, options = {}) {
  if (el[EVENT_CLEANUP]) {
    el[EVENT_CLEANUP]();
    el[EVENT_CLEANUP] = null;
  }

  const enabled = options.events !== false;
  const events = enabled ? (layer.events ?? []) : [];
  const triggers = pointerTriggers(events);
  el.style.pointerEvents = enabled ? (triggers.size > 0 ? 'auto' : 'none') : '';
  el.style.cursor = enabled && triggers.has('click') ? 'pointer' : '';

  if (!enabled || events.length === 0) return;

  const cleanups = [];
  for (const trigger of triggers) {
    const domEvent = trigger === 'hover' ? 'mouseenter' : trigger;
    const handler = (event) => {
      event.stopPropagation();
      const bindings = eventsForTrigger(events, trigger);
      runBindings(bindings, layer, options.runtime).catch((err) => {
        console.error(`[events] ${trigger} handler failed`, err);
      });
    };
    el.addEventListener(domEvent, handler);
    cleanups.push(() => el.removeEventListener(domEvent, handler));
  }

  const loadBindings = eventsForTrigger(events, 'load');
  if (loadBindings.length > 0) {
    queueMicrotask(() => {
      if (!el.isConnected) return;
      runBindings(loadBindings, layer, options.runtime).catch((err) => {
        console.error('[events] load handler failed', err);
      });
    });
  }

  el[EVENT_CLEANUP] = () => {
    for (const cleanup of cleanups) cleanup();
  };
}
