const SVG_NS = 'http://www.w3.org/2000/svg';

const DEFAULTS = {
  'pulse-x': 914,
  'pulse-y': 574,
  'field-x': 914,
  'field-y': 574,
  'field-width': 360,
  'field-height': 220,
  'show-debug-rect': false,
  'pulse-base-radius': 58,
  'pulse-mode': 'random',
  'marker-pulse-opacity': 0.72,
  'marker-pulse-edge-opacity': 0.24,
  'marker-pulse-color': '#dce0cd',
  'marker-pulse-thickness': 6,
  'marker-pulse-feather-width': 36,
  'marker-pulse-radius': 2.7,
  'marker-pulse-target-radius': 0,
  'marker-pulse-contract-speed': 1.8,
  'pulse-gap': 1.2,
};

function svgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) {
    el.setAttribute(key, String(value));
  }
  return el;
}

function numberProp(properties, key, fallback) {
  const value = Number(properties[key]);
  return Number.isFinite(value) ? value : fallback;
}

function stringProp(properties, key, fallback) {
  return typeof properties[key] === 'string' ? properties[key] : fallback;
}

function booleanProp(properties, key, fallback) {
  if (typeof properties[key] === 'boolean') return properties[key];
  if (properties[key] === 'true') return true;
  if (properties[key] === 'false') return false;
  return fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function fieldOptions(properties) {
  const centerX = numberProp(properties, 'field-x', numberProp(properties, 'pulse-x', DEFAULTS['field-x']));
  const centerY = numberProp(properties, 'field-y', numberProp(properties, 'pulse-y', DEFAULTS['field-y']));
  const width = clamp(numberProp(properties, 'field-width', DEFAULTS['field-width']), 0, 2400);
  const height = clamp(numberProp(properties, 'field-height', DEFAULTS['field-height']), 0, 1800);
  return {
    centerX,
    centerY,
    width,
    height,
    left: centerX - width / 2,
    top: centerY - height / 2,
  };
}

function pulseTiming(properties) {
  const contractSpeed = clamp(
    numberProp(
      properties,
      'marker-pulse-contract-speed',
      numberProp(properties, 'marker-pulse-interval', DEFAULTS['marker-pulse-contract-speed']),
    ),
    0.4,
    8,
  );
  const gap = clamp(
    numberProp(
      properties,
      'pulse-gap',
      numberProp(
        properties,
        'marker-pulse-single-cooldown',
        numberProp(
          properties,
          'marker-pulse-double-cooldown',
          numberProp(properties, 'marker-pulse-cooldown', DEFAULTS['pulse-gap']),
        ),
      ),
    ),
    0,
    12,
  );
  const mode = stringProp(properties, 'pulse-mode', DEFAULTS['pulse-mode']);

  return {
    contractSpeed,
    gap,
    mode,
  };
}

function randomFieldPoint(field) {
  return {
    x: randomBetween(field.left, field.left + field.width),
    y: randomBetween(field.top, field.top + field.height),
  };
}

function createPulseTemplate(properties, point) {
  const baseRadius = clamp(numberProp(properties, 'pulse-base-radius', DEFAULTS['pulse-base-radius']), 1, 600);
  const color = stringProp(properties, 'marker-pulse-color', DEFAULTS['marker-pulse-color']);
  const coreOpacity = clamp(numberProp(properties, 'marker-pulse-opacity', DEFAULTS['marker-pulse-opacity']), 0, 1);
  const edgeOpacity = clamp(numberProp(properties, 'marker-pulse-edge-opacity', DEFAULTS['marker-pulse-edge-opacity']), 0, 1);
  const thickness = clamp(
    numberProp(properties, 'marker-pulse-thickness', DEFAULTS['marker-pulse-thickness']),
    1,
    80,
  );
  const featherWidth = clamp(
    numberProp(properties, 'marker-pulse-feather-width', DEFAULTS['marker-pulse-feather-width']),
    thickness,
    180,
  );

  const anchor = svgEl('g', {
    transform: `translate(${point.x.toFixed(3)} ${point.y.toFixed(3)})`,
  });
  const pulse = svgEl('g', {
    class: 'background-pulse__ring',
  });
  pulse.style.setProperty('--background-pulse-feather-blur', `${Math.max(0, (featherWidth - thickness) * 0.35)}px`);
  pulse.style.setProperty('--background-pulse-core-blur', `${Math.max(0.45, thickness * 0.35)}px`);
  pulse.style.filter = `drop-shadow(0 0 ${Math.max(4, featherWidth * 0.36).toFixed(2)}px ${color})`;

  pulse.appendChild(svgEl('circle', {
    class: 'background-pulse__ring-feather',
    cx: 0,
    cy: 0,
    r: baseRadius,
    stroke: color,
    'stroke-width': featherWidth,
    opacity: edgeOpacity,
  }));
  pulse.appendChild(svgEl('circle', {
    class: 'background-pulse__ring-core',
    cx: 0,
    cy: 0,
    r: baseRadius,
    stroke: color,
    'stroke-width': thickness,
    opacity: coreOpacity,
  }));

  anchor.appendChild(pulse);
  return anchor;
}

function appendDebugRect(svg, properties) {
  if (!booleanProp(properties, 'show-debug-rect', DEFAULTS['show-debug-rect'])) return;
  const field = fieldOptions(properties);
  svg.appendChild(svgEl('rect', {
    class: 'background-pulse__debug-rect',
    x: field.left,
    y: field.top,
    width: field.width,
    height: field.height,
    rx: 6,
    ry: 6,
  }));
}

function pulseCountForMode(mode) {
  if (mode === 'single') return 1;
  if (mode === 'double') return 2;
  return Math.random() < 0.5 ? 1 : 2;
}

function startPulseSequence(root, svg, properties) {
  if (typeof window === 'undefined' || typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const timing = pulseTiming(properties);
  const durationMs = Math.max(16, timing.contractSpeed * 1000);
  const gapMs = Math.max(0, timing.gap * 1000);
  const pulseRadius = clamp(numberProp(properties, 'marker-pulse-radius', DEFAULTS['marker-pulse-radius']), 1, 8);
  const targetRadius = clamp(numberProp(properties, 'marker-pulse-target-radius', DEFAULTS['marker-pulse-target-radius']), 0, 1);
  const settleRadius = targetRadius + (pulseRadius - targetRadius) * 0.08;
  const timers = new Set();
  let hasConnected = false;

  const setTimer = (fn, delay) => {
    const id = window.setTimeout(() => {
      timers.delete(id);
      fn();
    }, delay);
    timers.add(id);
    return id;
  };

  const clearTimers = () => {
    for (const id of timers) window.clearTimeout(id);
    timers.clear();
  };

  const queueNext = (fn, delayMs = gapMs) => {
    setTimer(fn, delayMs);
  };

  const firePulse = (point, remainingAtPoint) => {
    if (!root.isConnected) {
      if (hasConnected) clearTimers();
      return;
    }
    hasConnected = true;

    const pulse = createPulseTemplate(properties, point ?? randomFieldPoint(fieldOptions(properties)));
    const animatedRing = pulse.querySelector('.background-pulse__ring');
    if (!animatedRing) return;
    animatedRing.style.opacity = '0';
    svg.appendChild(pulse);

    const animation = animatedRing.animate(
      [
        {
          opacity: 0,
          transform: `scale(${pulseRadius})`,
          offset: 0,
          easing: 'ease-in',
        },
        {
          opacity: 1,
          transform: `scale(${pulseRadius})`,
          offset: 0.18,
          easing: 'ease-in-out',
        },
        {
          opacity: 1,
          transform: `scale(${settleRadius})`,
          offset: 0.78,
          easing: 'ease-out',
        },
        {
          opacity: 0,
          transform: `scale(${targetRadius})`,
          offset: 1,
        },
      ],
      {
        duration: durationMs,
        fill: 'forwards',
      },
    );

    animation.finished
      .catch(() => {})
      .finally(() => {
        pulse.remove();
        if (!root.isConnected) {
          clearTimers();
          return;
        }
        if (remainingAtPoint > 1) {
          queueNext(() => firePulse(point, remainingAtPoint - 1));
        } else {
          queueNext(scheduleCycle);
        }
      });
  };

  const scheduleCycle = () => {
    if (!root.isConnected) {
      if (hasConnected) {
        clearTimers();
      } else {
        setTimer(scheduleCycle, 16);
      }
      return;
    }
    hasConnected = true;

    const field = fieldOptions(properties);
    const point = randomFieldPoint(field);
    firePulse(point, pulseCountForMode(timing.mode));
  };

  scheduleCycle();
}

export default function ({ properties = {}, layerId } = {}) {
  const root = document.createElement('div');
  root.className = 'background-pulse';
  root.setAttribute('aria-label', 'Background pulse');
  if (layerId) root.dataset.layerId = layerId;

  const svg = svgEl('svg', {
    class: 'background-pulse__svg',
    viewBox: '0 0 1440 1080',
    preserveAspectRatio: 'xMidYMid meet',
    'aria-hidden': 'true',
  });
  root.appendChild(svg);

  appendDebugRect(svg, properties);
  startPulseSequence(root, svg, properties);

  return root;
}

export const properties = {
  sections: [
    {
      id: 'placement',
      label: 'Pulse Field',
      description: 'Stage-space rectangle where pulse cadences can appear. The component fills the stage, so these values use the 1440 by 1080 coordinate space.',
      properties: {
        'field-x': {
          type: 'number',
          label: 'Center X',
          description: 'Horizontal stage position of the pulse field center.',
          min: -400,
          max: 1840,
          step: 1,
        },
        'field-y': {
          type: 'number',
          label: 'Center Y',
          description: 'Vertical stage position of the pulse field center.',
          min: -400,
          max: 1480,
          step: 1,
        },
        'field-width': {
          type: 'number',
          label: 'Width',
          description: 'Width of the random pulse field in stage pixels.',
          min: 0,
          max: 2400,
          step: 1,
        },
        'field-height': {
          type: 'number',
          label: 'Height',
          description: 'Height of the random pulse field in stage pixels.',
          min: 0,
          max: 1800,
          step: 1,
        },
        'show-debug-rect': {
          type: 'boolean',
          label: 'Debug Rect',
          description: 'Shows a dashed rectangle over the random pulse field while positioning it.',
        },
        'pulse-base-radius': {
          type: 'number',
          label: 'Base Radius',
          description: 'Unscaled radius of the pulse ring in stage pixels. Pulse Radius multiplies this value.',
          min: 1,
          max: 600,
          step: 1,
        },
      },
    },
    {
      id: 'pulse-style',
      label: 'Pulse Style',
      description: 'Same visual controls as the menu item marker pulse: color, core opacity, feather opacity, thickness, and contraction radius.',
      properties: {
        'marker-pulse-color': {
          type: 'color',
          label: 'Pulse Color',
          description: 'Color of the contracting background pulse ring.',
        },
        'marker-pulse-opacity': {
          type: 'number',
          label: 'Core Opacity',
          description: 'Opacity of the pulse ring core at peak visibility.',
          min: 0,
          max: 1,
          step: 0.01,
        },
        'marker-pulse-edge-opacity': {
          type: 'number',
          label: 'Edge Opacity',
          description: 'Opacity of the soft outer feather around the pulse ring.',
          min: 0,
          max: 1,
          step: 0.01,
        },
        'marker-pulse-thickness': {
          type: 'number',
          label: 'Thickness',
          description: 'Base width in stage pixels for the brightest part of the pulse ring.',
          min: 1,
          max: 80,
          step: 0.5,
        },
        'marker-pulse-feather-width': {
          type: 'number',
          label: 'Feather Width',
          description: 'Total width in stage pixels for the soft outer falloff around the pulse ring.',
          min: 1,
          max: 180,
          step: 1,
        },
        'marker-pulse-radius': {
          type: 'number',
          label: 'Pulse Radius',
          description: 'Starting radius multiplier for each contracting pulse.',
          min: 1,
          max: 8,
          step: 0.05,
        },
        'marker-pulse-target-radius': {
          type: 'number',
          label: 'Target Radius',
          description: 'Ending radius multiplier. Use 0 to collapse the pulse to the center point.',
          min: 0,
          max: 1,
          step: 0.01,
        },
      },
    },
    {
      id: 'pulse-timing',
      label: 'Pulse Timing',
      description: 'Controls how many pulses happen and how long to wait after each pulse finishes before cueing the next one.',
      properties: {
        'pulse-mode': {
          type: 'select',
          label: 'Mode',
          description: 'Single emits one pulse per field point, Double emits two pulses at the same random point, and Random chooses single or double for each point.',
          options: [
            { value: 'random', label: 'Random' },
            { value: 'single', label: 'Single' },
            { value: 'double', label: 'Double' },
          ],
        },
        'marker-pulse-contract-speed': {
          type: 'number',
          label: 'Contract Speed',
          description: 'Seconds each pulse spends contracting into the target.',
          min: 0.4,
          max: 8,
          step: 0.1,
        },
        'pulse-gap': {
          type: 'number',
          label: 'Gap',
          description: 'Seconds to wait after any pulse finishes before cueing the next pulse.',
          min: 0,
          max: 12,
          step: 0.1,
        },
      },
    },
  ],
};
