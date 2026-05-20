const SVG_NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;

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
  'marker-pulse-double-gap': 0.22,
  'swirl-count-min': 3,
  'swirl-count-max': 4,
  'swirl-size': 2.7,
  'swirl-spacing': 2.7,
  'swirl-turns': 1.72,
  'swirl-twist-degrees': -220,
  'swirl-arm-twist-degrees': 540,
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

function randomInt(min, max) {
  return Math.floor(randomBetween(min, max + 1));
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
  const doubleGap = clamp(
    numberProp(
      properties,
      'marker-pulse-double-gap',
      numberProp(properties, 'pulse-double-gap', DEFAULTS['marker-pulse-double-gap']),
    ),
    0,
    4,
  );
  const mode = stringProp(properties, 'pulse-mode', DEFAULTS['pulse-mode']);

  return {
    contractSpeed,
    gap,
    doubleGap,
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

function createSwirlPathData(radius, turns) {
  const steps = 58;
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const spiralRadius = radius * (1 - t * 0.88);
    const angle = turns * TAU * t;
    points.push({
      x: Math.cos(angle) * spiralRadius,
      y: Math.sin(angle) * spiralRadius,
    });
  }

  return points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ');
}

function createSwirlTemplate(properties, point) {
  const baseRadius = clamp(numberProp(properties, 'pulse-base-radius', DEFAULTS['pulse-base-radius']), 1, 600);
  const color = stringProp(properties, 'marker-pulse-color', DEFAULTS['marker-pulse-color']);
  const coreOpacity = clamp(numberProp(properties, 'marker-pulse-opacity', DEFAULTS['marker-pulse-opacity']), 0, 1);
  const edgeOpacity = clamp(numberProp(properties, 'marker-pulse-edge-opacity', DEFAULTS['marker-pulse-edge-opacity']), 0, 1);
  const thickness = clamp(numberProp(properties, 'marker-pulse-thickness', DEFAULTS['marker-pulse-thickness']), 1, 80);
  const featherWidth = clamp(numberProp(properties, 'marker-pulse-feather-width', DEFAULTS['marker-pulse-feather-width']), thickness, 180);
  const minCount = clamp(Math.round(numberProp(properties, 'swirl-count-min', DEFAULTS['swirl-count-min'])), 1, 8);
  const maxCount = clamp(Math.round(numberProp(properties, 'swirl-count-max', DEFAULTS['swirl-count-max'])), minCount, 8);
  const count = randomInt(minCount, maxCount);
  const size = clamp(numberProp(properties, 'swirl-size', DEFAULTS['swirl-size']), 0.1, 8);
  const spacing = clamp(numberProp(properties, 'swirl-spacing', size), 0, 12);
  const turns = clamp(numberProp(properties, 'swirl-turns', DEFAULTS['swirl-turns']), 0.5, 4);
  const swirlRadius = baseRadius * 0.48 * size;
  const clusterRadius = baseRadius * 0.84 * spacing;
  const angleOffset = randomBetween(0, TAU);
  const pathData = createSwirlPathData(swirlRadius, turns);

  const anchor = svgEl('g', {
    transform: `translate(${point.x.toFixed(3)} ${point.y.toFixed(3)})`,
  });
  const cluster = svgEl('g', {
    class: 'background-pulse__swirl-cluster',
  });
  cluster.style.setProperty('--background-pulse-feather-blur', `${Math.max(0, (featherWidth - thickness) * 0.3)}px`);
  cluster.style.setProperty('--background-pulse-core-blur', `${Math.max(0.3, thickness * 0.2)}px`);
  cluster.style.filter = `drop-shadow(0 0 ${Math.max(4, featherWidth * 0.42).toFixed(2)}px ${color})`;

  for (let i = 0; i < count; i += 1) {
    const angle = angleOffset + (i / count) * TAU;
    const arm = svgEl('g', {
      class: 'background-pulse__swirl-arm',
      transform: `translate(${(Math.cos(angle) * clusterRadius).toFixed(2)} ${(Math.sin(angle) * clusterRadius).toFixed(2)}) rotate(${((angle * 180) / Math.PI + 28).toFixed(2)})`,
    });
    const curl = svgEl('g', {
      class: 'background-pulse__swirl-curl',
    });
    curl.appendChild(svgEl('path', {
      class: 'background-pulse__swirl-path background-pulse__swirl-path--feather',
      d: pathData,
      stroke: color,
      'stroke-width': featherWidth,
      opacity: edgeOpacity,
    }));
    curl.appendChild(svgEl('path', {
      class: 'background-pulse__swirl-path background-pulse__swirl-path--core',
      d: pathData,
      stroke: color,
      'stroke-width': thickness,
      opacity: coreOpacity,
    }));
    arm.appendChild(curl);
    cluster.appendChild(arm);
  }

  anchor.appendChild(cluster);
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

function startPulseSequence(root, svg, properties) {
  if (typeof window === 'undefined' || typeof Element === 'undefined' || typeof Element.prototype.animate !== 'function') return;
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;

  const timing = pulseTiming(properties);
  const durationMs = Math.max(16, timing.contractSpeed * 1000);
  const gapMs = Math.max(0, timing.gap * 1000);
  const doubleGapMs = Math.max(0, timing.doubleGap * 1000);
  const pulseRadius = clamp(numberProp(properties, 'marker-pulse-radius', DEFAULTS['marker-pulse-radius']), 1, 8);
  const targetRadius = clamp(numberProp(properties, 'marker-pulse-target-radius', DEFAULTS['marker-pulse-target-radius']), 0, 1);
  const timers = new Set();
  const activeAnimations = new Set();
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
    for (const animation of activeAnimations) animation.cancel();
    activeAnimations.clear();
  };

  const nextCadenceType = () => {
    if (timing.mode === 'single' || timing.mode === 'double' || timing.mode === 'swirl') return timing.mode;
    const options = ['single', 'double', 'swirl'];
    return options[Math.min(options.length - 1, Math.floor(Math.random() * options.length))];
  };

  const firePulse = (point) => {
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

    const transformAnimation = animatedRing.animate(
      [
        {
          transform: `scale(${pulseRadius})`,
        },
        {
          transform: `scale(${targetRadius})`,
        },
      ],
      {
        duration: durationMs,
        easing: 'linear',
        fill: 'forwards',
      },
    );
    const opacityAnimation = animatedRing.animate(
      [
        {
          opacity: 0,
          offset: 0,
        },
        {
          opacity: 1,
          offset: 0.12,
        },
        {
          opacity: 1,
          offset: 0.82,
        },
        {
          opacity: 0,
          offset: 1,
        },
      ],
      {
        duration: durationMs,
        easing: 'linear',
        fill: 'forwards',
      },
    );

    activeAnimations.add(transformAnimation);
    activeAnimations.add(opacityAnimation);
    Promise.allSettled([transformAnimation.finished, opacityAnimation.finished])
      .finally(() => {
        activeAnimations.delete(transformAnimation);
        activeAnimations.delete(opacityAnimation);
        pulse.remove();
      });
  };

  const fireSwirl = (point) => {
    if (!root.isConnected) {
      if (hasConnected) clearTimers();
      return;
    }
    hasConnected = true;

    const swirl = createSwirlTemplate(properties, point ?? randomFieldPoint(fieldOptions(properties)));
    const animatedCluster = swirl.querySelector('.background-pulse__swirl-cluster');
    if (!animatedCluster) return;
    animatedCluster.style.opacity = '0';
    svg.appendChild(swirl);

    const twistDegrees = clamp(numberProp(properties, 'swirl-twist-degrees', DEFAULTS['swirl-twist-degrees']), -1080, 1080);
    const transformAnimation = animatedCluster.animate(
      [
        {
          transform: 'rotate(0deg)',
        },
        {
          transform: `rotate(${twistDegrees}deg)`,
        },
      ],
      {
        duration: durationMs,
        easing: 'linear',
        fill: 'forwards',
      },
    );
    const armTwistDegrees = clamp(numberProp(properties, 'swirl-arm-twist-degrees', DEFAULTS['swirl-arm-twist-degrees']), -1440, 1440);
    const armAnimations = [...swirl.querySelectorAll('.background-pulse__swirl-curl')].map((curl) => (
      curl.animate(
        [
          {
            transform: 'rotate(0deg)',
          },
          {
            transform: `rotate(${armTwistDegrees}deg)`,
          },
        ],
        {
          duration: durationMs,
          easing: 'linear',
          fill: 'forwards',
        },
      )
    ));
    const opacityAnimation = animatedCluster.animate(
      [
        {
          opacity: 0,
          offset: 0,
        },
        {
          opacity: 1,
          offset: 0.08,
        },
        {
          opacity: 1,
          offset: 0.78,
        },
        {
          opacity: 0,
          offset: 1,
        },
      ],
      {
        duration: durationMs,
        easing: 'linear',
        fill: 'forwards',
      },
    );

    activeAnimations.add(transformAnimation);
    activeAnimations.add(opacityAnimation);
    for (const animation of armAnimations) activeAnimations.add(animation);
    Promise.allSettled([
      transformAnimation.finished,
      opacityAnimation.finished,
      ...armAnimations.map((animation) => animation.finished),
    ])
      .finally(() => {
        activeAnimations.delete(transformAnimation);
        activeAnimations.delete(opacityAnimation);
        for (const animation of armAnimations) activeAnimations.delete(animation);
        swirl.remove();
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
    const cadenceType = nextCadenceType();
    if (cadenceType === 'swirl') {
      fireSwirl(point);
      setTimer(scheduleCycle, durationMs + gapMs);
      return;
    }

    firePulse(point);
    if (cadenceType === 'double') setTimer(() => firePulse(point), doubleGapMs);
    setTimer(scheduleCycle, durationMs + (cadenceType === 'double' ? doubleGapMs : 0) + gapMs);
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
      sections: [
        {
          id: 'swirl-style',
          label: 'Swirl',
          description: 'Configuration for the spiral-cluster cadence used by Swirl mode and the Random cadence pool.',
          properties: {
            'swirl-count-min': {
              type: 'number',
              label: 'Min Count',
              description: 'Minimum number of spiral marks spawned by a swirl cadence.',
              min: 1,
              max: 8,
              step: 1,
            },
            'swirl-count-max': {
              type: 'number',
              label: 'Max Count',
              description: 'Maximum number of spiral marks spawned by a swirl cadence.',
              min: 1,
              max: 8,
              step: 1,
            },
            'swirl-size': {
              type: 'number',
              label: 'Size',
              description: 'Fixed size multiplier for the whole swirl cluster. Swirls keep this size while twisting and fading.',
              min: 0.1,
              max: 8,
              step: 0.05,
            },
            'swirl-spacing': {
              type: 'number',
              label: 'Spacing',
              description: 'Distance multiplier between the cadence center and each spiral mark.',
              min: 0,
              max: 12,
              step: 0.05,
            },
            'swirl-turns': {
              type: 'number',
              label: 'Turns',
              description: 'How many rotations each spiral mark winds through before reaching its center.',
              min: 0.5,
              max: 4,
              step: 0.05,
            },
            'swirl-twist-degrees': {
              type: 'number',
              label: 'Cluster Twist',
              description: 'Rotation applied to the whole swirl cluster while it is visible.',
              min: -1080,
              max: 1080,
              step: 5,
            },
            'swirl-arm-twist-degrees': {
              type: 'number',
              label: 'Arm Twist',
              description: 'Local rotation applied to each spiral mark while the swirl cadence is visible.',
              min: -1440,
              max: 1440,
              step: 5,
            },
          },
        },
      ],
    },
    {
      id: 'pulse-timing',
      label: 'Pulse Timing',
      description: 'Controls which cadence plays and how long to wait after each cadence finishes before cueing the next one.',
      properties: {
        'pulse-mode': {
          type: 'select',
          label: 'Mode',
          description: 'Single emits one ring, Double emits two rings, Swirl emits a spiral cluster, and Random chooses independently from all three cadence types.',
          options: [
            { value: 'random', label: 'Random' },
            { value: 'single', label: 'Single' },
            { value: 'double', label: 'Double' },
            { value: 'swirl', label: 'Swirl' },
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
        'marker-pulse-double-gap': {
          type: 'number',
          label: 'Double Gap',
          description: 'Seconds between the first and second ring starts in each double cadence.',
          min: 0,
          max: 4,
          step: 0.01,
        },
        'pulse-gap': {
          type: 'number',
          label: 'Gap',
          description: 'Seconds to wait after a cadence finishes before cueing the next random field point.',
          min: 0,
          max: 12,
          step: 0.1,
        },
      },
    },
  ],
};
