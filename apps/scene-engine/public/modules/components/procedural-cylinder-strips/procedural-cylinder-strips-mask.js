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

function colorAt(position, colorA, colorB, colorC, bias) {
  const t = Math.pow(wrapUnit(position), Math.max(0.1, bias));
  if (t < 0.5) return mixColor(colorA, colorB, t * 2);
  return mixColor(colorB, colorC, (t - 0.5) * 2);
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
    textureAngle,
    textureScale,
  } = options;
  const tw = texture.width;
  const th = texture.height;
  const diagonal = Math.hypot(tw, th) * 1.35;
  const bandCount = Math.max(3, Math.ceil(8 * textureScale));

  textureCtx.clearRect(0, 0, tw, th);
  textureCtx.save();
  textureCtx.translate(tw / 2, th / 2);
  textureCtx.rotate(textureAngle);

  const gradient = textureCtx.createLinearGradient(-diagonal / 2, 0, diagonal / 2, 0);
  for (let i = 0; i <= bandCount; i += 1) {
    const stop = i / bandCount;
    const color = colorAt(stop * colorCycle + colorOffset + colorPhase, colorA, colorB, colorC, colorBias);
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
  const openSpeed = clamp(numberProp(properties, 'open-speed', 0.16), -MAX_OPEN_SPEED, MAX_OPEN_SPEED);
  const visibleWidth = clamp(numberProp(properties, 'visible-width', 0.42), 0.01, 1);
  const feather = clamp(numberProp(properties, 'feather', 0.2), 0.001, 0.5);
  const pulseOffset = numberProp(properties, 'pulse-offset', 0);
  const colorCycle = numberProp(properties, 'color-cycle', 1.25);
  const colorOffset = numberProp(properties, 'color-offset', 0);
  const colorSpeed = numberProp(properties, 'color-speed', 0.04);
  const colorBias = numberProp(properties, 'color-bias', 0.9);
  const textureAngle = numberProp(properties, 'texture-angle', -18) * Math.PI / 180;
  const textureSpeed = numberProp(properties, 'texture-speed', 0.08);
  const textureScale = clamp(numberProp(properties, 'texture-scale', 1), 0.2, 4);
  const textureResolution = clamp(numberProp(properties, 'texture-resolution', 0.55), 0.2, 1);
  const colorA = parseHexColor(colorProp(properties, 'color-start', '#2030ff')) || { r: 32, g: 48, b: 255 };
  const colorB = parseHexColor(colorProp(properties, 'color-mid', '#3f2dff')) || { r: 63, g: 45, b: 255 };
  const colorC = parseHexColor(colorProp(properties, 'color-end', '#ff2f75')) || { r: 255, g: 47, b: 117 };
  const openPhase = animate ? elapsed * openSpeed + pulseOffset : pulseOffset;
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
    colorBias,
    colorCycle,
    colorOffset,
    colorPhase,
    textureAngle,
    textureScale,
  };

  ctx.clearRect(0, 0, width, height);

  resizeTexture(texture, width, height, textureResolution);
  const textureMeta = paintTexture(texture, textureCtx, width, height, options);

  ctx.save();
  ctx.beginPath();
  const openGate = pulseWindow(openPhase, visibleWidth, feather);
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
