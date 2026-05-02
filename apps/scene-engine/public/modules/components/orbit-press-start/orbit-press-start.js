function numberProp(properties, key, fallback) {
  const value = properties[key];
  return Number.isFinite(value) ? value : fallback;
}

function stringProp(properties, key, fallback) {
  return typeof properties[key] === 'string' ? properties[key] : fallback;
}

function setupCanvas(canvas, ctx, width, height) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const nextWidth = Math.max(1, Math.round(width * dpr));
  const nextHeight = Math.max(1, Math.round(height * dpr));
  if (canvas.width !== nextWidth || canvas.height !== nextHeight) {
    canvas.width = nextWidth;
    canvas.height = nextHeight;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function tiltDegrees(properties) {
  const legacyTilt = numberProp(properties, 'tilt', -8);
  return {
    x: numberProp(properties, 'tilt-x', 0),
    y: numberProp(properties, 'tilt-y', 0),
    z: numberProp(properties, 'tilt-z', legacyTilt),
  };
}

function degreesToRadians(degrees) {
  return degrees * Math.PI / 180;
}

function projectPoint(x, y, z, options) {
  const z3 = z + options.positionZ;
  const perspective = options.cameraDistance / Math.max(1, options.cameraDistance - z3);
  return {
    x: options.cx + options.positionX + x * perspective,
    y: options.cy + options.positionY + y * perspective,
    z: z3,
    perspective,
  };
}

function roundedRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawCenter(ctx, cx, cy, radius, properties) {
  const fill = stringProp(properties, 'center-fill', '#7c7d7a');
  const rim = stringProp(properties, 'center-rim', '#1a1a18');
  const highlight = stringProp(properties, 'center-highlight', 'rgba(255, 255, 255, 0.24)');

  const gradient = ctx.createRadialGradient(
    cx - radius * 0.32,
    cy - radius * 0.42,
    radius * 0.08,
    cx,
    cy,
    radius,
  );
  gradient.addColorStop(0, highlight);
  gradient.addColorStop(0.38, fill);
  gradient.addColorStop(1, '#3d3e3c');

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();
  ctx.lineWidth = Math.max(1, radius * 0.08);
  ctx.strokeStyle = rim;
  ctx.stroke();
  ctx.restore();
}

function drawBackMarker(ctx, point, options) {
  const { width, height, color, alpha, scale, scaleX } = options;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.scale(scale * scaleX, scale);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  roundedRect(ctx, -width / 2, -height / 2, width, height, Math.max(1, height * 0.06));
  ctx.fill();
  ctx.restore();
}

function drawLetter(ctx, point, character, options) {
  const {
    cellWidth,
    cellHeight,
    radius,
    textColor,
    panelColor,
    shadowColor,
    font,
    scale,
    scaleX,
  } = options;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.scale(scale * scaleX, scale);
  ctx.globalAlpha = point.alpha;

  roundedRect(ctx, -cellWidth / 2, -cellHeight / 2, cellWidth, cellHeight, radius);
  ctx.fillStyle = panelColor;
  ctx.fill();

  ctx.font = font;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = textColor;
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = 7;
  ctx.shadowOffsetY = 1;
  ctx.fillText(character, 0, 1);
  ctx.restore();
}

function orbitProjection(angle, options) {
  const radialFace = Math.cos(angle);
  const x0 = Math.sin(angle) * options.radiusX;
  const y0 = 0;
  const z0 = radialFace * options.radiusX;
  const cosX = Math.cos(options.tiltX);
  const sinX = Math.sin(options.tiltX);
  const cosY = Math.cos(options.tiltY);
  const sinY = Math.sin(options.tiltY);
  const y1 = y0 * cosX - z0 * sinX;
  const z1 = y0 * sinX + z0 * cosX;
  const x2 = x0 * cosY + z1 * sinY;
  const z2 = -x0 * sinY + z1 * cosY;
  const projected = projectPoint(x2, y1, z2, options);
  return { projected, z2 };
}

function orbitPoint(angle, options) {
  const { projected, z2 } = orbitProjection(angle, options);
  const faceDepth = Math.max(-1, Math.min(1, z2 / Math.max(1, options.radiusX)));

  return {
    x: projected.x,
    y: projected.y,
    z: projected.z,
    alpha: Math.max(0.28, Math.min(1, 0.48 + Math.abs(faceDepth) * 0.52)),
    faceDepth,
    faceScaleX: Math.max(options.edgeScale, Math.abs(faceDepth)),
    perspective: projected.perspective,
  };
}

function drawFrame(ctx, width, height, properties, elapsed) {
  const text = stringProp(properties, 'text', 'PRESS  START');
  const copies = Math.max(1, Math.round(numberProp(properties, 'copies', numberProp(properties, 'repeat', 2))));
  const speed = numberProp(properties, 'rotation-speed', 0.46);
  const direction = numberProp(properties, 'direction', 1) >= 0 ? 1 : -1;
  const phase = numberProp(properties, 'phase', 0) * Math.PI / 180;
  const tilt = tiltDegrees(properties);
  const tiltX = degreesToRadians(tilt.x);
  const tiltY = degreesToRadians(tilt.y);
  const tiltZ = degreesToRadians(tilt.z);
  const fontSize = numberProp(properties, 'font-size', 34);
  const cellWidth = numberProp(properties, 'letter-cell-width', 43);
  const cellHeight = numberProp(properties, 'letter-cell-height', numberProp(properties, 'panel-height', 48));
  const backMarkerMargin = Math.max(0, numberProp(properties, 'back-marker-margin', 5));
  const backMarkerWidth = Math.max(1, cellWidth - backMarkerMargin * 2);
  const backMarkerHeight = Math.max(1, cellHeight - backMarkerMargin * 2);
  const centerRadius = numberProp(properties, 'center-radius', 42);
  const radiusX = numberProp(properties, 'orbit-radius-x', 164);
  const edgeScale = Math.max(0.01, Math.min(1, numberProp(properties, 'edge-scale', 0.3)));
  const angleSpacing = numberProp(properties, 'letter-angle-spacing', 10.5) * Math.PI / 180;
  const markerColor = stringProp(properties, 'back-marker-color', '#737476');
  const textColor = stringProp(properties, 'text-color', '#ffd52d');
  const panelColor = stringProp(properties, 'panel-color', '#090908');
  const shadowColor = stringProp(properties, 'glow-color', 'rgba(255, 213, 45, 0.78)');
  const fontFamily = stringProp(properties, 'font-family', 'FolkPro, Orbitron, sans-serif');
  const fontWeight = stringProp(properties, 'font-weight', '900');
  const cx = width / 2;
  const cy = height / 2;
  const positionX = numberProp(properties, 'position-x', numberProp(properties, 'offset-x', 0));
  const positionY = numberProp(properties, 'position-y', numberProp(properties, 'offset-y', 0));
  const positionZ = numberProp(properties, 'position-z', 0);
  const cameraDistance = Math.max(1, numberProp(properties, 'camera-distance', 900));

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tiltZ);
  ctx.translate(-cx, -cy);

  const font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.font = font;
  const characters = [...text];
  const angleStep = Math.PI * 2 / copies;
  const rotation = elapsed * speed * direction + phase;
  const centerOffset = (characters.length - 1) / 2;
  const options = { cx, cy, radiusX, tiltX, tiltY, positionX, positionY, positionZ, cameraDistance, edgeScale };
  const drawItems = [];
  const centerPoint = projectPoint(0, 0, 0, options);

  for (let copy = 0; copy < copies; copy += 1) {
    for (let index = 0; index < characters.length; index += 1) {
      if (characters[index] === ' ') continue;
      const offset = index - centerOffset;
      const angle = rotation + copy * angleStep + offset * angleSpacing;
      const point = orbitPoint(angle, options);
      drawItems.push({ point, angle, character: characters[index] });
    }
  }

  for (const item of drawItems.filter((item) => item.point.faceDepth < 0).sort((a, b) => a.point.z - b.point.z)) {
    drawBackMarker(ctx, item.point, {
      width: backMarkerWidth,
      height: backMarkerHeight,
      color: markerColor,
      alpha: 0.3 + Math.abs(item.point.faceDepth) * 0.34,
      scale: item.point.perspective,
      scaleX: item.point.faceScaleX,
    });
  }

  drawCenter(ctx, centerPoint.x, centerPoint.y, centerRadius * centerPoint.perspective, properties);

  for (const item of drawItems.filter((item) => item.point.faceDepth >= 0).sort((a, b) => a.point.z - b.point.z)) {
    drawLetter(ctx, item.point, item.character, {
      cellWidth,
      cellHeight,
      radius: numberProp(properties, 'letter-radius', numberProp(properties, 'panel-radius', 3)),
      textColor,
      panelColor,
      shadowColor,
      font,
      scale: (0.74 + item.point.faceDepth * 0.26) * item.point.perspective,
      scaleX: item.point.faceScaleX,
    });
  }

  ctx.restore();
}

export default function ({ properties = {}, layerId } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'orbit-press-start';
  if (layerId) wrap.dataset.layerId = layerId;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  wrap.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  let raf = 0;
  let start = performance.now();

  const render = (now) => {
    if (!wrap.isConnected) {
      cancelAnimationFrame(raf);
      raf = 0;
      observer.disconnect();
      return;
    }
    const rect = wrap.getBoundingClientRect();
    const baseWidth = wrap.clientWidth || rect.width;
    const baseHeight = wrap.clientHeight || rect.height;
    const padding = Math.max(0, numberProp(properties, 'viewport-padding', 180));
    const width = Math.max(1, baseWidth + padding * 2);
    const height = Math.max(1, baseHeight + padding * 2);
    canvas.style.left = `${-padding}px`;
    canvas.style.top = `${-padding}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    setupCanvas(canvas, ctx, width, height);
    drawFrame(ctx, width, height, properties, (now - start) / 1000);
    raf = requestAnimationFrame(render);
  };

  const observer = new IntersectionObserver((entries) => {
    const visible = entries.some((entry) => entry.isIntersecting);
    if (visible && !raf) {
      start = performance.now();
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
