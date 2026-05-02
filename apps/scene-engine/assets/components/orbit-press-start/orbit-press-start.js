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
  const { width, height, color, alpha, scaleY } = options;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.scale(1, scaleY);
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
    scaleY,
  } = options;
  ctx.save();
  ctx.translate(point.x, point.y);
  ctx.scale(scale, scale * scaleY);
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

function orbitPoint(angle, options) {
  const radialFace = Math.cos(angle);
  return {
    x: options.cx + Math.sin(angle) * options.radiusX,
    y: options.cy + radialFace * options.radiusY,
    z: radialFace,
    alpha: Math.max(0.28, Math.min(1, 0.48 + Math.abs(radialFace) * 0.52)),
    faceScaleY: Math.max(0.08, Math.abs(radialFace)),
  };
}

function drawFrame(ctx, width, height, properties, elapsed) {
  const text = stringProp(properties, 'text', 'PRESS  START');
  const copies = Math.max(1, Math.round(numberProp(properties, 'copies', numberProp(properties, 'repeat', 2))));
  const speed = numberProp(properties, 'rotation-speed', 0.46);
  const direction = numberProp(properties, 'direction', 1) >= 0 ? 1 : -1;
  const phase = numberProp(properties, 'phase', 0) * Math.PI / 180;
  const tilt = numberProp(properties, 'tilt', -8) * Math.PI / 180;
  const fontSize = numberProp(properties, 'font-size', 34);
  const cellWidth = numberProp(properties, 'letter-cell-width', 43);
  const cellHeight = numberProp(properties, 'letter-cell-height', numberProp(properties, 'panel-height', 48));
  const centerRadius = numberProp(properties, 'center-radius', 42);
  const radiusX = numberProp(properties, 'orbit-radius-x', 164);
  const radiusY = numberProp(properties, 'orbit-radius-y', 25);
  const angleSpacing = numberProp(properties, 'letter-angle-spacing', 10.5) * Math.PI / 180;
  const markerSize = numberProp(properties, 'back-marker-size', 38);
  const markerColor = stringProp(properties, 'back-marker-color', '#737476');
  const textColor = stringProp(properties, 'text-color', '#ffd52d');
  const panelColor = stringProp(properties, 'panel-color', '#090908');
  const shadowColor = stringProp(properties, 'glow-color', 'rgba(255, 213, 45, 0.78)');
  const fontFamily = stringProp(properties, 'font-family', 'FolkPro, Orbitron, sans-serif');
  const fontWeight = stringProp(properties, 'font-weight', '900');
  const cx = width / 2 + numberProp(properties, 'offset-x', 0);
  const cy = height / 2 + numberProp(properties, 'offset-y', 0);

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(tilt);
  ctx.translate(-cx, -cy);

  const font = `${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.font = font;
  const characters = [...text];
  const angleStep = Math.PI * 2 / copies;
  const rotation = elapsed * speed * direction + phase;
  const centerOffset = (characters.length - 1) / 2;
  const options = { cx, cy, radiusX, radiusY };
  const drawItems = [];

  for (let copy = 0; copy < copies; copy += 1) {
    for (let index = 0; index < characters.length; index += 1) {
      if (characters[index] === ' ') continue;
      const offset = index - centerOffset;
      const angle = rotation + copy * angleStep + offset * angleSpacing;
      const point = orbitPoint(angle, options);
      drawItems.push({ point, angle, character: characters[index] });
    }
  }

  for (const item of drawItems.filter((item) => item.point.z < 0).sort((a, b) => a.point.z - b.point.z)) {
    drawBackMarker(ctx, item.point, {
      width: numberProp(properties, 'back-marker-width', cellWidth),
      height: markerSize,
      color: markerColor,
      alpha: 0.3 + Math.abs(item.point.z) * 0.34,
      scaleY: item.point.faceScaleY,
    });
  }

  drawCenter(ctx, cx, cy, centerRadius, properties);

  for (const item of drawItems.filter((item) => item.point.z >= 0).sort((a, b) => a.point.z - b.point.z)) {
    drawLetter(ctx, item.point, item.character, {
      cellWidth,
      cellHeight,
      radius: numberProp(properties, 'letter-radius', numberProp(properties, 'panel-radius', 3)),
      textColor,
      panelColor,
      shadowColor,
      font,
      scale: 0.74 + item.point.z * 0.26,
      scaleY: item.point.faceScaleY,
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
    const width = Math.max(1, rect.width);
    const height = Math.max(1, rect.height);
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
