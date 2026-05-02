const TAU = Math.PI * 2;
const MAX_OPEN_SPEED = 1.2;

function numberProp(properties, key, fallback) {
  const value = properties[key];
  return Number.isFinite(value) ? value : fallback;
}

function colorProp(properties, key, fallback) {
  return typeof properties[key] === 'string' ? properties[key] : fallback;
}

function booleanProp(properties, key, fallback) {
  return typeof properties[key] === 'boolean' ? properties[key] : fallback;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function wrapUnit(value) {
  return ((value % 1) + 1) % 1;
}

function smoothstep(edge0, edge1, value) {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function centeredDistance(value) {
  return Math.abs(wrapUnit(value + 0.5) - 0.5);
}

function pulseWindow(phase, width, feather) {
  const halfWidth = clamp(width, 0.001, 1) * 0.5;
  const distance = centeredDistance(phase);
  if (distance <= halfWidth) return 1;
  if (distance >= halfWidth + feather) return 0;
  return 1 - smoothstep(halfWidth, halfWidth + feather, distance);
}

function oscillateWindow(phase, hold, transition) {
  const endpointHold = clamp(hold, 0, 0.45);
  const edge = Math.max(0.001, transition);
  const total = endpointHold * 2 + edge * 2;
  const t = wrapUnit(phase) * total;

  if (t < endpointHold) return 0;
  if (t < endpointHold + edge) {
    return smoothstep(0, 1, (t - endpointHold) / edge);
  }
  if (t < endpointHold + edge + endpointHold) return 1;
  return 1 - smoothstep(0, 1, (t - endpointHold - edge - endpointHold) / edge);
}

function timedGate(elapsed, closedHoldSeconds, transitionSeconds, openHoldSeconds, offsetSeconds) {
  const closedHold = Math.max(0, closedHoldSeconds);
  const transition = Math.max(0.001, transitionSeconds);
  const openHold = Math.max(0, openHoldSeconds);
  const total = closedHold + transition + openHold + transition;
  const t = wrapUnit((elapsed + offsetSeconds) / total) * total;

  if (t < closedHold) return 0;
  if (t < closedHold + transition) {
    return smoothstep(0, 1, (t - closedHold) / transition);
  }
  if (t < closedHold + transition + openHold) return 1;
  return 1 - smoothstep(0, 1, (t - closedHold - transition - openHold) / transition);
}

function setupCanvas(canvas, ctx, width, height, dprCap) {
  const dpr = Math.min(Math.max(1, window.devicePixelRatio || 1), dprCap);
  const nextWidth = Math.max(1, Math.round(width * dpr));
  const nextHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function parseHexColor(value) {
  if (typeof value !== 'string') return null;
  const hex = value.trim();
  const short = /^#([a-f\d])([a-f\d])([a-f\d])$/i.exec(hex);
  if (short) {
    return {
      r: parseInt(short[1] + short[1], 16),
      g: parseInt(short[2] + short[2], 16),
      b: parseInt(short[3] + short[3], 16),
    };
  }
  const long = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!long) return null;
  return {
    r: parseInt(long[1], 16),
    g: parseInt(long[2], 16),
    b: parseInt(long[3], 16),
  };
}

function mixColor(a, b, t) {
  const amount = clamp(t, 0, 1);
  return {
    r: Math.round(a.r + (b.r - a.r) * amount),
    g: Math.round(a.g + (b.g - a.g) * amount),
    b: Math.round(a.b + (b.b - a.b) * amount),
  };
}

function wrapDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function hslToRgb(hue, saturation, lightness) {
  const h = wrapDegrees(hue) / 360;
  const s = clamp(saturation, 0, 1);
  const l = clamp(lightness, 0, 1);

  if (s === 0) {
    const value = Math.round(l * 255);
    return { r: value, g: value, b: value };
  }

  const hueToChannel = (p, q, t) => {
    let next = t;
    if (next < 0) next += 1;
    if (next > 1) next -= 1;
    if (next < 1 / 6) return p + (q - p) * 6 * next;
    if (next < 1 / 2) return q;
    if (next < 2 / 3) return p + (q - p) * (2 / 3 - next) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: Math.round(hueToChannel(p, q, h + 1 / 3) * 255),
    g: Math.round(hueToChannel(p, q, h) * 255),
    b: Math.round(hueToChannel(p, q, h - 1 / 3) * 255),
  };
}

function hueDistance(a, b) {
  const delta = Math.abs(wrapDegrees(a) - wrapDegrees(b));
  return Math.min(delta, 360 - delta);
}

function hueWindow(hue, center, width) {
  const halfWidth = Math.max(1, width) * 0.5;
  const distance = hueDistance(hue, center);
  return 1 - smoothstep(halfWidth * 0.42, halfWidth, distance);
}

function applyColorContrast(color, contrast) {
  const amount = clamp(contrast, 0, 1.5);
  return {
    r: Math.round(clamp(128 + (color.r - 128) * amount, 0, 255)),
    g: Math.round(clamp(128 + (color.g - 128) * amount, 0, 255)),
    b: Math.round(clamp(128 + (color.b - 128) * amount, 0, 255)),
  };
}

function colorAt(position, colorA, colorB, colorC, bias) {
  const t = Math.pow(wrapUnit(position), Math.max(0.1, bias));
  if (t < 0.5) return mixColor(colorA, colorB, t * 2);
  return mixColor(colorB, colorC, (t - 0.5) * 2);
}

function colorAtHueWheel(position, options) {
  const {
    wheelHueShift,
    wheelSaturation,
    wheelLightness,
    wheelMintLift,
    wheelSoftness,
    wheelContrast,
  } = options;
  const hue = wrapDegrees(wheelHueShift + wrapUnit(position) * 360);
  const softness = clamp(wheelSoftness, 0, 1);
  const mintBand = Math.max(
    hueWindow(hue, 84, 74 + softness * 86),
    hueWindow(hue, 148, 58 + softness * 70) * 0.72,
  );
  const blueBand = Math.max(
    hueWindow(hue, 226, 78 + softness * 42),
    hueWindow(hue, 264, 58 + softness * 38) * 0.78,
  );
  const magentaBand = hueWindow(hue, 322, 72 + softness * 34);
  const warmBand = hueWindow(hue, 24, 58 + softness * 38);
  const saturation = clamp(
    wheelSaturation * (1 - mintBand * 0.38 - warmBand * 0.08) + magentaBand * 0.04,
    0,
    1,
  );
  const lightness = clamp(
    wheelLightness + mintBand * wheelMintLift + warmBand * 0.035 + magentaBand * 0.02 - blueBand * 0.045,
    0.08,
    0.86,
  );
  return applyColorContrast(hslToRgb(hue, saturation, lightness), wheelContrast);
}

function colorAtMeleeSpectrum(position, options) {
  const t = Math.pow(wrapUnit(position), Math.max(0.1, options.colorBias));
  const blue = options.colorA;
  const violet = options.colorB;
  const red = options.colorC;
  const magenta = options.colorD || mixColor(violet, red, 0.48);
  const stops = [
    { at: 0, color: blue },
    { at: 0.2, color: violet },
    { at: 0.38, color: magenta },
    { at: 0.55, color: red },
    { at: 0.72, color: magenta },
    { at: 0.86, color: violet },
    { at: 1, color: blue },
  ];

  for (let i = 1; i < stops.length; i += 1) {
      const prev = stops[i - 1];
      const next = stops[i];
      if (t <= next.at) {
        const local = smoothstep(0, 1, (t - prev.at) / Math.max(0.0001, next.at - prev.at));
        const color = mixColor(prev.color, next.color, local);
      return applyColorContrast(color, options.wheelContrast);
    }
  }

  return stops[0].color;
}

function paletteColorAt(position, options) {
  if (options.paletteMode === 'melee-spectrum') {
    return colorAtMeleeSpectrum(position, options);
  }
  if (options.paletteMode === 'hue-wheel') {
    return colorAtHueWheel(position, options);
  }
  return colorAt(position, options.colorA, options.colorB, options.colorC, options.colorBias);
}

function rgba(color, alpha) {
  return `rgba(${color.r}, ${color.g}, ${color.b}, ${clamp(alpha, 0, 1)})`;
}

function resizeTexture(texture, width, height, scale) {
  const nextWidth = Math.max(2, Math.round(width * scale));
  const nextHeight = Math.max(2, Math.round(height * scale));
  if (texture.width !== nextWidth || texture.height !== nextHeight) {
    texture.width = nextWidth;
    texture.height = nextHeight;
  }
}

function paintTexture(texture, textureCtx, width, height, options) {
  const {
    colorA,
    colorB,
    colorC,
    colorBias,
    colorCycle,
    colorOffset,
    colorPhase,
    paletteMode,
    textureAngle,
    textureScale,
  } = options;
  const tw = texture.width;
  const th = texture.height;
  const diagonal = Math.hypot(tw, th) * 1.35;
  const colorCycleDensity = Math.max(1, Math.abs(colorCycle));
  const bandCount = paletteMode === 'hue-wheel' || paletteMode === 'melee-spectrum'
    ? Math.min(240, Math.max(48, Math.ceil(48 * textureScale * colorCycleDensity)))
    : Math.max(3, Math.ceil(8 * textureScale));

  textureCtx.clearRect(0, 0, tw, th);
  textureCtx.save();
  textureCtx.translate(tw / 2, th / 2);
  textureCtx.rotate(textureAngle);

  const gradient = textureCtx.createLinearGradient(-diagonal / 2, 0, diagonal / 2, 0);
  for (let i = 0; i <= bandCount; i += 1) {
    const stop = i / bandCount;
    const color = paletteColorAt(stop * colorCycle + colorOffset + colorPhase, options);
    gradient.addColorStop(stop, rgba(color, 1));
  }

  textureCtx.fillStyle = gradient;
  textureCtx.fillRect(-diagonal / 2, -diagonal / 2, diagonal, diagonal);
  textureCtx.restore();

  if (tw !== width || th !== height) {
    return { sourceWidth: tw, sourceHeight: th };
  }
  return { sourceWidth: width, sourceHeight: height };
}

function projectTunnelPoint(angle, depth, options) {
  const {
    centerX,
    centerY,
    radiusX,
    radiusY,
    innerRadius,
    outerRadius,
    depthCurve,
  } = options;
  const easedDepth = Math.pow(clamp(depth, 0, 1), depthCurve);
  const radius = innerRadius + (outerRadius - innerRadius) * easedDepth;
  return {
    x: centerX + Math.cos(angle) * radiusX * radius,
    y: centerY + Math.sin(angle) * radiusY * radius,
  };
}

function addSlatPath(ctx, fixedTheta, movingTheta, options) {
  const { curveSteps } = options;
  for (let i = 0; i <= curveSteps; i += 1) {
    const depth = i / curveSteps;
    const point = projectTunnelPoint(fixedTheta, depth, options);
    if (i === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  }
  for (let i = curveSteps; i >= 0; i -= 1) {
    const depth = i / curveSteps;
    const point = projectTunnelPoint(movingTheta, depth, options);
    ctx.lineTo(point.x, point.y);
  }
  ctx.closePath();
}

function drawCylinderStrips(ctx, texture, textureCtx, width, height, properties, elapsed) {
  const animate = booleanProp(properties, 'animate', true);
  const centerX = width * numberProp(properties, 'center-x', 0.5);
  const centerY = height * numberProp(properties, 'center-y', 0.52);
  const radius = numberProp(properties, 'radius', numberProp(properties, 'radius-x', 1.5));
  const radiusX = width * radius;
  const radiusY = height * radius;
  const innerRadius = clamp(numberProp(properties, 'inner-radius', 0.02), 0, 1);
  const outerRadius = clamp(numberProp(properties, 'outer-radius', 1.04), 0.05, 3);
  const depthCurve = clamp(numberProp(properties, 'depth-curve', 1.18), 0.2, 4);
  const stripCount = Math.max(4, Math.round(numberProp(properties, 'strip-count', 40)));
  const stripWidth = clamp(numberProp(properties, 'strip-width', 0.86), 0.05, 1.5);
  const curveSteps = Math.max(3, Math.round(numberProp(properties, 'curve-steps', 7)));
  const opacity = clamp(numberProp(properties, 'opacity', 0.26), 0, 1);
  const minimumOpen = clamp(numberProp(properties, 'minimum-open', 0), 0, 1);
  const rotationOffset = numberProp(properties, 'rotation-offset', 0) * Math.PI / 180;
  const closedHoldSeconds = clamp(numberProp(properties, 'closed-hold-seconds', 0.12), 0, 10);
  const openHoldSeconds = clamp(numberProp(properties, 'open-hold-seconds', 0.12), 0, 10);
  const transitionSeconds = clamp(numberProp(properties, 'transition-seconds', 0.45), 0.02, 10);
  const gateOffsetSeconds = numberProp(properties, 'gate-offset-seconds', 0);
  const colorCycle = numberProp(properties, 'color-cycle', 1.25);
  const colorOffset = numberProp(properties, 'color-offset', 0);
  const colorSpeed = numberProp(properties, 'color-speed', 0.04);
  const colorBias = numberProp(properties, 'color-bias', 0.9);
  const paletteMode = colorProp(properties, 'palette-mode', 'melee-spectrum');
  const wheelHueShift = numberProp(properties, 'wheel-hue-shift', 226);
  const wheelSaturation = clamp(numberProp(properties, 'wheel-saturation', 0.82), 0, 1.2);
  const wheelLightness = clamp(numberProp(properties, 'wheel-lightness', 0.53), 0.08, 0.86);
  const wheelMintLift = clamp(numberProp(properties, 'wheel-mint-lift', 0.16), -0.2, 0.35);
  const wheelSoftness = clamp(numberProp(properties, 'wheel-softness', 0.58), 0, 1);
  const wheelContrast = clamp(numberProp(properties, 'wheel-contrast', 0.92), 0, 1.5);
  const textureAngle = numberProp(properties, 'texture-angle', -18) * Math.PI / 180;
  const textureSpeed = numberProp(properties, 'texture-speed', 0.08);
  const textureScale = clamp(numberProp(properties, 'texture-scale', 1), 0.2, 4);
  const textureResolution = clamp(numberProp(properties, 'texture-resolution', 0.55), 0.2, 1);
  const colorA = parseHexColor(colorProp(properties, 'color-start', '#2030ff')) || { r: 32, g: 48, b: 255 };
  const colorB = parseHexColor(colorProp(properties, 'color-mid', '#3f2dff')) || { r: 63, g: 45, b: 255 };
  const colorC = parseHexColor(colorProp(properties, 'color-end', '#ff2f75')) || { r: 255, g: 47, b: 117 };
  const colorD = parseHexColor(colorProp(properties, 'color-magenta', '#ac2ba0'));
  const gateTime = animate ? elapsed : 0;
  const colorPhase = animate ? elapsed * colorSpeed + elapsed * textureSpeed : 0;
  const stripArc = TAU / stripCount;
  const options = {
    centerX,
    centerY,
    radiusX,
    radiusY,
    innerRadius,
    outerRadius,
    depthCurve,
    curveSteps,
    colorA,
    colorB,
    colorC,
    colorD,
    colorBias,
    colorCycle,
    colorOffset,
    colorPhase,
    paletteMode,
    wheelHueShift,
    wheelSaturation,
    wheelLightness,
    wheelMintLift,
    wheelSoftness,
    wheelContrast,
    textureAngle,
    textureScale,
  };

  ctx.clearRect(0, 0, width, height);

  resizeTexture(texture, width, height, textureResolution);
  const textureMeta = paintTexture(texture, textureCtx, width, height, options);

  ctx.save();
  ctx.beginPath();
  const openGate = timedGate(
    gateTime,
    closedHoldSeconds,
    transitionSeconds,
    openHoldSeconds,
    gateOffsetSeconds,
  );
  const open = minimumOpen + (1 - minimumOpen) * openGate;
  for (let strip = 0; strip < stripCount; strip += 1) {
    const stripNorm = strip / stripCount;
    const theta = stripNorm * TAU + rotationOffset;
    const fullWidth = stripArc * stripWidth;
    const openWidth = fullWidth * open;
    if (openWidth <= stripArc * 0.004) continue;
    const fixedTheta = theta - fullWidth * 0.5;
    const movingTheta = fixedTheta + openWidth;
    addSlatPath(ctx, fixedTheta, movingTheta, options);
  }

  ctx.clip();
  ctx.globalAlpha = opacity;
  ctx.globalCompositeOperation = colorProp(properties, 'composite', 'source-over');
  ctx.drawImage(texture, 0, 0, textureMeta.sourceWidth, textureMeta.sourceHeight, 0, 0, width, height);
  ctx.restore();
}

export default function ({ properties = {}, layerId } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'procedural-cylinder-strips';
  if (layerId) wrap.dataset.layerId = layerId;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  wrap.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  const texture = document.createElement('canvas');
  const textureCtx = texture.getContext('2d');
  let raf = 0;
  let start = performance.now();
  let lastDraw = 0;

  const render = (now) => {
    if (!wrap.isConnected) {
      cancelAnimationFrame(raf);
      raf = 0;
      observer.disconnect();
      return;
    }

    const targetFps = clamp(numberProp(properties, 'target-fps', 24), 1, 60);
    if (now - lastDraw >= 1000 / targetFps) {
      const rect = wrap.getBoundingClientRect();
      const width = Math.max(1, rect.width);
      const height = Math.max(1, rect.height);
      const dprCap = clamp(numberProp(properties, 'dpr-cap', 1), 1, 2);
      setupCanvas(canvas, ctx, width, height, dprCap);
      drawCylinderStrips(ctx, texture, textureCtx, width, height, properties, (now - start) / 1000);
      lastDraw = now;
    }

    raf = requestAnimationFrame(render);
  };

  const observer = new IntersectionObserver((entries) => {
    const visible = entries.some((entry) => entry.isIntersecting);
    if (visible && !raf) {
      start = performance.now();
      lastDraw = 0;
      raf = requestAnimationFrame(render);
    } else if (!visible && raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  });

  observer.observe(wrap);
  raf = requestAnimationFrame(render);

  return wrap;
}

// Inspector schema for editor use only — runtime ignores it.
export const properties = {
  sections: [
    {
      id: 'animation',
      label: 'Animation',
      description: 'Master toggle for the gate-open animation and the palette/texture phase scrolling.',
      properties: {
        animate: {
          type: 'boolean',
          label: 'Animate',
          description: 'Whether the gate-open animation and palette/texture phase scrolling advance over time. Disable to render a still frame at t=0.',
        },
      },
    },
    {
      id: 'position',
      label: 'Position',
      description: 'Normalized 0–1 coordinates of the tunnel center within the layer. 0.5, 0.5 is dead center.',
      properties: {
        'center-x': {
          type: 'number',
          label: 'Center X',
          description: 'Horizontal position of the tunnel center, expressed as a fraction of layer width. 0 is the left edge, 1 is the right edge.',
          min: 0,
          max: 1,
          step: 0.01,
        },
        'center-y': {
          type: 'number',
          label: 'Center Y',
          description: 'Vertical position of the tunnel center, expressed as a fraction of layer height. 0 is the top edge, 1 is the bottom edge.',
          min: 0,
          max: 1,
          step: 0.01,
        },
      },
    },
    {
      id: 'geometry',
      label: 'Geometry',
      description: 'Shape of the tunnel itself — overall scale, the inner ring radius, the outer ring radius, and how the depth between them is eased.',
      properties: {
        radius: {
          type: 'number',
          label: 'Radius',
          description: 'Overall tunnel radius as a fraction of layer width and height. Values above 1 push the outer ring beyond the layer edges.',
          min: 0,
          step: 0.01,
        },
        'inner-radius': {
          type: 'number',
          label: 'Inner Radius',
          description: 'Where each strip starts at the back of the tunnel, as a fraction of `radius`. 0 collapses the strips to a point at the center.',
          min: 0,
          max: 1,
          step: 0.01,
        },
        'outer-radius': {
          type: 'number',
          label: 'Outer Radius',
          description: 'Where each strip ends at the front of the tunnel, as a fraction of `radius`. Values above 1 extend the strips past the nominal radius.',
          min: 0.05,
          max: 3,
          step: 0.01,
        },
        'depth-curve': {
          type: 'number',
          label: 'Depth Curve',
          description: 'Easing exponent applied between inner and outer radius. 1 is linear; higher values bunch strips toward the front, lower values bunch them toward the back.',
          min: 0.2,
          max: 4,
          step: 0.01,
        },
        'radius-x': {
          type: 'number',
          label: 'Radius X (legacy)',
          description: 'Legacy fallback for `radius`. Older scenes set this key to size the tunnel; new scenes should use `radius`.',
          min: 0,
          step: 0.01,
        },
      },
    },
    {
      id: 'strips',
      label: 'Strips',
      description: 'Radial slats that divide the tunnel — how many, how wide each one is, and how its curve is tessellated.',
      properties: {
        'strip-count': {
          type: 'number',
          label: 'Strip Count',
          description: 'Number of radial slats around the tunnel. Higher values produce a finer grille at the cost of fill rate.',
          min: 4,
          step: 1,
        },
        'strip-width': {
          type: 'number',
          label: 'Strip Width',
          description: 'Fraction of each strip slot occupied by the slat itself. 1 fills the slot edge-to-edge; lower values leave gaps between adjacent slats even when fully open.',
          min: 0.05,
          max: 1.5,
          step: 0.01,
        },
        'curve-steps': {
          type: 'number',
          label: 'Curve Steps',
          description: 'Number of line segments used to tessellate each slat from inner to outer radius. Higher values produce smoother curves; lower values produce a faceted look.',
          min: 3,
          step: 1,
        },
        'rotation-offset': {
          type: 'number',
          label: 'Rotation Offset',
          description: 'Static rotation applied to the entire strip ring, in degrees. Use to align the gap between strips with other on-stage elements.',
          min: 0,
          max: 360,
          step: 1,
        },
        'minimum-open': {
          type: 'number',
          label: 'Minimum Open',
          description: 'Floor on the gate-open amount, 0–1. 0 lets the strips fully close; higher values keep them at least this far open even at the bottom of the cycle.',
          min: 0,
          max: 1,
          step: 0.01,
        },
      },
    },
    {
      id: 'appearance',
      label: 'Appearance',
      description: 'Opacity dims the textured strips uniformly; composite controls how the strips blend onto the canvas underneath.',
      properties: {
        opacity: {
          type: 'number',
          label: 'Opacity',
          description: 'Overall opacity of the strip mask, 0–1. Applied uniformly after the texture is masked through the strips.',
          min: 0,
          max: 1,
          step: 0.01,
        },
        composite: {
          type: 'string',
          label: 'Composite Mode',
          description: 'Canvas global composite operation used when drawing the masked texture (e.g. `source-over`, `screen`, `lighter`). Defaults to `source-over`.',
        },
      },
    },
    {
      id: 'gate-timing',
      label: 'Gate Timing',
      description: 'The strips animate as a four-phase gate — closed hold, opening transition, open hold, closing transition. These knobs set the duration of each phase plus a phase offset.',
      properties: {
        'closed-hold-seconds': {
          type: 'number',
          label: 'Closed Hold',
          description: 'Seconds spent fully closed at the bottom of the gate cycle before opening.',
          min: 0,
          max: 10,
          step: 0.01,
        },
        'transition-seconds': {
          type: 'number',
          label: 'Transition',
          description: 'Seconds spent ramping between closed and open. Used for both the opening and closing transitions.',
          min: 0.02,
          max: 10,
          step: 0.01,
        },
        'open-hold-seconds': {
          type: 'number',
          label: 'Open Hold',
          description: 'Seconds spent fully open at the top of the gate cycle before closing.',
          min: 0,
          max: 10,
          step: 0.01,
        },
        'gate-offset-seconds': {
          type: 'number',
          label: 'Gate Offset',
          description: 'Phase offset added to the gate clock, in seconds. Use to desynchronize multiple strip layers so they open at different times.',
          step: 0.01,
        },
      },
    },
    {
      id: 'palette',
      label: 'Palette',
      description: 'Choose a palette mode and shape how it is sampled across the texture — how many cycles fit, where it starts, how fast it scrolls, and how the gradient is biased.',
      properties: {
        'palette-mode': {
          type: 'select',
          label: 'Palette Mode',
          description: 'Which color algorithm fills the texture. `melee-spectrum` is the canonical Melee gradient, `hue-wheel` walks the full HSL hue circle, and `tri-color` interpolates the three custom colors below.',
          options: ['melee-spectrum', 'hue-wheel', 'tri-color'],
        },
        'color-cycle': {
          type: 'number',
          label: 'Color Cycle',
          description: 'How many full palette cycles span one texture sweep. Higher values pack more bands into the same area.',
          step: 0.01,
        },
        'color-offset': {
          type: 'number',
          label: 'Color Offset',
          description: 'Static phase offset applied to the palette sample position, 0–1 wraps. Use to dial in which color sits at the front of the texture at t=0.',
          step: 0.01,
        },
        'color-speed': {
          type: 'number',
          label: 'Color Speed',
          description: 'Rate at which the palette scrolls through the texture per second. 0 freezes the palette in place; negative values reverse the scroll.',
          step: 0.01,
        },
        'color-bias': {
          type: 'number',
          label: 'Color Bias',
          description: 'Exponent applied to the palette sample position before lookup. 1 is linear; higher values bias toward the start of the palette, lower values bias toward the end.',
          min: 0.1,
          step: 0.01,
        },
      },
    },
    {
      id: 'melee-spectrum',
      label: 'Melee Spectrum Colors',
      description: 'The four canonical Melee gradient stops. Feed `melee-spectrum` mode directly and `tri-color` mode minus the magenta accent.',
      properties: {
        'color-start': {
          type: 'string',
          label: 'Start Color',
          description: 'First gradient stop. The blue end of the canonical Melee spectrum. Hex string (e.g. `#2030ff`).',
        },
        'color-mid': {
          type: 'string',
          label: 'Mid Color',
          description: 'Middle gradient stop. The violet bridge between blue and red. Hex string (e.g. `#3f2dff`).',
        },
        'color-end': {
          type: 'string',
          label: 'End Color',
          description: 'Last gradient stop. The red/pink end of the canonical Melee spectrum. Hex string (e.g. `#ff2f75`).',
        },
        'color-magenta': {
          type: 'string',
          label: 'Magenta Accent',
          description: 'Optional magenta accent woven between the violet and red stops in `melee-spectrum` mode. Hex string (e.g. `#ac2ba0`); falls back to a midpoint of mid+end when unset.',
        },
      },
    },
    {
      id: 'hue-wheel',
      label: 'Hue Wheel Colors',
      description: 'Only applies when palette mode is `hue-wheel`. Shapes how the HSL hue circle is sampled, weighted, and contrast-adjusted before being painted across the texture.',
      properties: {
        'wheel-hue-shift': {
          type: 'number',
          label: 'Hue Shift',
          description: 'Starting hue of the wheel, in degrees. Rotates the entire palette around the HSL hue circle.',
          min: 0,
          max: 360,
          step: 1,
        },
        'wheel-saturation': {
          type: 'number',
          label: 'Saturation',
          description: 'Base saturation applied to every hue, 0–1.2. The renderer can pull saturation lower in the mint band; it never pushes it higher than this floor.',
          min: 0,
          max: 1.2,
          step: 0.01,
        },
        'wheel-lightness': {
          type: 'number',
          label: 'Lightness',
          description: 'Base lightness applied to every hue. Per-band lifts and dips are added on top of this baseline.',
          min: 0.08,
          max: 0.86,
          step: 0.01,
        },
        'wheel-mint-lift': {
          type: 'number',
          label: 'Mint Lift',
          description: 'Extra lightness added to the green/mint band. Positive values brighten greens; negative values push them into shadow.',
          min: -0.2,
          max: 0.35,
          step: 0.01,
        },
        'wheel-softness': {
          type: 'number',
          label: 'Softness',
          description: 'How wide the per-hue band weighting falls off. Higher values blur the bands together for a smoother wheel; lower values keep each band tight.',
          min: 0,
          max: 1,
          step: 0.01,
        },
        'wheel-contrast': {
          type: 'number',
          label: 'Contrast',
          description: 'Final RGB contrast multiplier applied around the 128 midpoint. 1 leaves colors untouched; values below 1 wash them out; values above 1 deepen them.',
          min: 0,
          max: 1.5,
          step: 0.01,
        },
      },
    },
    {
      id: 'texture',
      label: 'Texture',
      description: 'The palette is painted onto an offscreen texture which is then masked by the strips. These knobs orient that texture, scroll it over time, and trade resolution for performance.',
      properties: {
        'texture-angle': {
          type: 'number',
          label: 'Texture Angle',
          description: 'Rotation of the gradient bands across the texture, in degrees. 0 runs the bands horizontally; 90 runs them vertically.',
          min: -180,
          max: 180,
          step: 1,
        },
        'texture-speed': {
          type: 'number',
          label: 'Texture Speed',
          description: 'Additional scroll rate added to the palette phase per second. Stacks on top of `color-speed`.',
          step: 0.01,
        },
        'texture-scale': {
          type: 'number',
          label: 'Texture Scale',
          description: 'Multiplier on band density and gradient extent. Higher values pack more bands into the same texture; the band count adapts automatically for hue-wheel and melee-spectrum modes.',
          min: 0.2,
          max: 4,
          step: 0.01,
        },
        'texture-resolution': {
          type: 'number',
          label: 'Texture Resolution',
          description: 'Offscreen texture resolution as a fraction of layer size, 0.2–1. Lower values are cheaper to redraw; 1 matches the layer pixel-for-pixel.',
          min: 0.2,
          max: 1,
          step: 0.01,
        },
      },
    },
    {
      id: 'performance',
      label: 'Performance',
      description: 'Caps that trade visual fidelity for cost — bound the redraw rate and the pixel ratio used when sizing the canvas.',
      properties: {
        'target-fps': {
          type: 'number',
          label: 'Target FPS',
          description: 'Maximum redraw rate, capped at 60. Lower values reduce GPU/CPU load at the cost of choppier motion.',
          min: 1,
          max: 60,
          step: 1,
        },
        'dpr-cap': {
          type: 'number',
          label: 'DPR Cap',
          description: 'Upper bound on the device pixel ratio used when sizing the canvas. 1 forces logical-pixel rendering; 2 allows up to retina sharpness.',
          min: 1,
          max: 2,
          step: 0.1,
        },
      },
    },
  ],
};
