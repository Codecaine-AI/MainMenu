function numberProp(properties, key, fallback) {
  const value = properties[key];
  return Number.isFinite(value) ? value : fallback;
}

function stringProp(properties, key, fallback) {
  return typeof properties[key] === 'string' ? properties[key] : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function setInitialVars(button, properties) {
  button.style.setProperty('--key-width', `${clamp(numberProp(properties, 'key-width', 36), 10, 100)}%`);
  button.style.setProperty('--press-glow-color', stringProp(properties, 'press-glow-color', '#d7281f'));
  button.style.setProperty('--press-glow-expand', '0px');
  button.style.setProperty('--press-glow-blur', '0px');
  button.style.setProperty('--press-glow-y', '0px');
  button.style.setProperty('--press-glow-opacity', '0');
  button.style.setProperty('--stage-x', '0px');
  button.style.setProperty('--stage-y', '0px');
  button.style.setProperty('--stage-scale', '1');
  button.style.setProperty('--tilt-x', '0deg');
  button.style.setProperty('--tilt-y', '0deg');
  button.style.setProperty('--shadow-y', '0px');
  button.style.setProperty('--shadow-scale', '1');
  button.style.setProperty('--shadow-opacity', '0.5');
  button.style.setProperty('--light-x', '50%');
  button.style.setProperty('--light-y', '18%');
}

function fallbackHitRect(button, properties) {
  const rect = button.getBoundingClientRect();
  const keyWidth = clamp(numberProp(properties, 'key-width', 36), 10, 100) / 100;
  const width = rect.width * keyWidth;
  const left = rect.left + (rect.width - width) / 2;
  return {
    left,
    right: left + width,
    top: rect.top,
    bottom: rect.bottom,
    width,
    height: rect.height,
  };
}

function hitRectFor(button, hitTarget, properties) {
  const rect = hitTarget?.getBoundingClientRect();
  if (rect && rect.width > 1 && rect.height > 1) return rect;
  return fallbackHitRect(button, properties);
}

function eventInsideRect(event, rect) {
  return (
    event.clientX >= rect.left &&
    event.clientX <= rect.right &&
    event.clientY >= rect.top &&
    event.clientY <= rect.bottom
  );
}

function addMotion(button, properties, hitTarget) {
  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
  const hoverPress = clamp(numberProp(properties, 'hover-press', 0.58), 0, 1);
  const activePress = clamp(numberProp(properties, 'active-press', 1), 0, 1);
  const focusPress = clamp(numberProp(properties, 'focus-press', 0.34), 0, 1);
  const pressDepth = clamp(numberProp(properties, 'press-depth', 18), 0, 44);
  const pressGlowSize = clamp(numberProp(properties, 'press-glow-size', 44), 0, 180);
  const pressGlowBlur = clamp(numberProp(properties, 'press-glow-blur', 22), 0, 100);
  const pressGlowOpacity = clamp(numberProp(properties, 'press-glow-opacity', 0.72), 0, 1);
  const pressGlowY = clamp(numberProp(properties, 'press-glow-y', 14), -80, 100);
  const floatAmount = clamp(numberProp(properties, 'float-amount', 5), 0, 28);
  const floatSpeed = clamp(numberProp(properties, 'float-speed', 3.8), 0.1, 12);
  const idleTilt = clamp(numberProp(properties, 'idle-tilt', 4), -12, 18);

  const state = {
    press: 0,
    targetPress: 0,
    mx: 0,
    my: 0,
    targetMx: 0,
    targetMy: 0,
    start: performance.now(),
    raf: 0,
    hovering: false,
  };

  const setPointer = (event) => {
    const rect = hitRectFor(button, hitTarget, properties);
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    state.targetMx = clamp((event.clientX - cx) / Math.max(1, rect.width / 2), -1, 1);
    state.targetMy = clamp((event.clientY - cy) / Math.max(1, rect.height / 2), -1, 1);
  };

  const resetHover = () => {
    state.hovering = false;
    state.targetPress = button.matches(':focus-visible') ? focusPress : 0;
    state.targetMx = 0;
    state.targetMy = 0;
    button.classList.remove('codecaine-keycap-start--hover');
  };

  const updateHover = (event) => {
    const inside = eventInsideRect(event, hitRectFor(button, hitTarget, properties));
    state.hovering = inside;
    button.classList.toggle('codecaine-keycap-start--hover', inside);

    if (!inside) {
      state.targetPress = button.matches(':focus-visible') ? focusPress : 0;
      state.targetMx = 0;
      state.targetMy = 0;
      return false;
    }

    state.targetPress = hoverPress;
    setPointer(event);
    return true;
  };

  const render = (now) => {
    if (!button.isConnected) {
      cancelAnimationFrame(state.raf);
      state.raf = 0;
      return;
    }

    const ease = reduceMotion ? 1 : 0.15;
    state.press += (state.targetPress - state.press) * ease;
    state.mx += (state.targetMx - state.mx) * ease;
    state.my += (state.targetMy - state.my) * ease;

    const seconds = (now - state.start) / 1000;
    const float = reduceMotion ? 0 : Math.sin(seconds * Math.PI * 2 / floatSpeed) * floatAmount;
    const pressY = state.press * pressDepth;
    const glowExpand = state.press * pressGlowSize;
    const glowBlur = state.press * pressGlowBlur;
    const glowY = state.press * pressGlowY;
    const glowOpacity = state.press * pressGlowOpacity;
    const lightX = 50 + state.mx * 16;
    const lightY = 18 + state.my * 10 + state.press * 8;

    button.style.setProperty('--press-glow-expand', `${glowExpand.toFixed(3)}px`);
    button.style.setProperty('--press-glow-blur', `${glowBlur.toFixed(3)}px`);
    button.style.setProperty('--press-glow-y', `${glowY.toFixed(3)}px`);
    button.style.setProperty('--press-glow-opacity', glowOpacity.toFixed(4));
    button.style.setProperty('--stage-x', `${(state.mx * 5).toFixed(3)}px`);
    button.style.setProperty('--stage-y', `${(float + pressY).toFixed(3)}px`);
    button.style.setProperty('--stage-scale', (1 - state.press * 0.025).toFixed(4));
    button.style.setProperty('--tilt-x', `${(idleTilt + state.press * 7 - state.my * 2).toFixed(3)}deg`);
    button.style.setProperty('--tilt-y', `${(state.mx * -4).toFixed(3)}deg`);
    button.style.setProperty('--shadow-y', `${(float * -0.12 + pressY * 0.34).toFixed(3)}px`);
    button.style.setProperty('--shadow-scale', (1 + state.press * 0.18).toFixed(4));
    button.style.setProperty('--shadow-opacity', (0.45 + state.press * 0.25).toFixed(4));
    button.style.setProperty('--light-x', `${lightX.toFixed(2)}%`);
    button.style.setProperty('--light-y', `${lightY.toFixed(2)}%`);

    state.raf = requestAnimationFrame(render);
  };

  const bindPointerTarget = () => {
    if (!button.isConnected) {
      requestAnimationFrame(bindPointerTarget);
      return;
    }
    const target = button.parentElement || button;

    target.addEventListener('pointerenter', (event) => {
      updateHover(event);
    });
    target.addEventListener('pointermove', updateHover);
    target.addEventListener('pointerleave', resetHover);
    target.addEventListener('pointerdown', (event) => {
      if (!updateHover(event)) return;
      state.targetPress = activePress;
    });
    target.addEventListener('pointerup', (event) => {
      if (updateHover(event)) state.targetPress = hoverPress;
    });
  };

  requestAnimationFrame(bindPointerTarget);
  button.addEventListener('focus', () => {
    state.targetPress = Math.max(state.targetPress, focusPress);
  });
  button.addEventListener('blur', () => {
    state.targetPress = state.hovering ? hoverPress : 0;
  });

  state.raf = requestAnimationFrame(render);
}

export default function ({ properties = {}, layerId } = {}) {
  const button = document.createElement('button');
  button.className = 'codecaine-keycap-start';
  button.type = 'button';
  button.setAttribute('aria-label', stringProp(properties, 'aria-label', 'Press start'));
  if (layerId) button.dataset.layerId = layerId;
  setInitialVars(button, properties);

  const stage = document.createElement('span');
  stage.className = 'codecaine-keycap-start__stage';
  stage.setAttribute('aria-hidden', 'true');

  const shadow = document.createElement('span');
  shadow.className = 'codecaine-keycap-start__shadow';

  const artWrap = document.createElement('span');
  artWrap.className = 'codecaine-keycap-start__art-wrap';

  const img = document.createElement('img');
  img.className = 'codecaine-keycap-start__art';
  img.alt = '';
  img.decoding = 'async';
  img.draggable = false;
  img.src = stringProp(properties, 'image-src', '/assets/image/codecaine-start-keycap.png');

  const light = document.createElement('span');
  light.className = 'codecaine-keycap-start__light';

  const label = document.createElement('span');
  label.className = 'codecaine-keycap-start__sr';
  label.textContent = stringProp(properties, 'label', 'Press Start');

  artWrap.append(img, light);
  stage.append(shadow, artWrap);
  button.append(stage, label);
  addMotion(button, properties, artWrap);

  return button;
}

// Inspector schema for editor use only — runtime ignores it.
export const properties = {
  sections: [
    {
      id: 'asset',
      label: 'Keycap Asset',
      properties: {
        'image-src': {
          type: 'string',
          label: 'Image Source',
          description: 'Public image URL for the rendered keycap.',
        },
        'normal-src': {
          type: 'string',
          label: 'Normal Source',
          description: 'Reserved URL for the future normal-map shader path.',
        },
        'key-width': {
          type: 'number',
          label: 'Key Width',
          description: 'Keycap width as a percentage of the component layer width.',
          min: 10,
          max: 100,
          step: 1,
        },
      },
    },
    {
      id: 'motion',
      label: 'Motion',
      properties: {
        'hover-press': {
          type: 'number',
          label: 'Hover Press',
          description: 'How far the key depresses on hover, from 0 to 1.',
          min: 0,
          max: 1,
          step: 0.01,
        },
        'active-press': {
          type: 'number',
          label: 'Active Press',
          description: 'How far the key depresses while clicked or tapped.',
          min: 0,
          max: 1,
          step: 0.01,
        },
        'press-depth': {
          type: 'number',
          label: 'Press Depth',
          description: 'Maximum downward travel in pixels.',
          min: 0,
          max: 44,
          step: 1,
        },
        'press-glow-color': {
          type: 'color',
          label: 'Press Glow Color',
          description: 'Color of the red aura that expands behind the keycap as it presses down.',
        },
        'press-glow-size': {
          type: 'number',
          label: 'Press Glow Size',
          description: 'Maximum outward expansion of the press glow in pixels.',
          min: 0,
          max: 180,
          step: 1,
        },
        'press-glow-blur': {
          type: 'number',
          label: 'Press Glow Blur',
          description: 'Maximum blur radius of the press glow in pixels.',
          min: 0,
          max: 100,
          step: 1,
        },
        'press-glow-opacity': {
          type: 'number',
          label: 'Press Glow Opacity',
          description: 'Maximum opacity of the press glow at full press.',
          min: 0,
          max: 1,
          step: 0.01,
        },
        'press-glow-y': {
          type: 'number',
          label: 'Press Glow Y',
          description: 'Maximum vertical offset of the press glow in pixels. Positive values push the glow downward.',
          min: -80,
          max: 100,
          step: 1,
        },
        'float-amount': {
          type: 'number',
          label: 'Float Amount',
          description: 'Idle floating amplitude in pixels.',
          min: 0,
          max: 28,
          step: 1,
        },
        'float-speed': {
          type: 'number',
          label: 'Float Speed',
          description: 'Seconds per idle float cycle.',
          min: 0.1,
          max: 12,
          step: 0.1,
        },
        'idle-tilt': {
          type: 'number',
          label: 'Idle Tilt',
          description: 'Resting X-axis tilt in degrees.',
          min: -12,
          max: 18,
          step: 0.5,
        },
      },
    },
    {
      id: 'accessibility',
      label: 'Accessibility',
      properties: {
        label: {
          type: 'string',
          label: 'Hidden Label',
          description: 'Hidden label text for screen readers.',
        },
        'aria-label': {
          type: 'string',
          label: 'ARIA Label',
          description: 'Button aria-label announced by assistive technology.',
        },
      },
    },
  ],
};
