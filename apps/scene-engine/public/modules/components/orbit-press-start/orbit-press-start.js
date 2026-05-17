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

function drawFrame(ctx, width, height, properties, elapsed, layer = 'all') {
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
  const centerVisible = properties['center-visible'] !== false;
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

  const shouldDrawBack = layer === 'all' || layer === 'back';
  const shouldDrawFront = layer === 'all' || layer === 'front';

  if (shouldDrawBack) {
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
  }

  if (shouldDrawFront) {
    if (centerVisible && centerRadius > 0) {
      drawCenter(ctx, centerPoint.x, centerPoint.y, centerRadius * centerPoint.perspective, properties);
    }

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
  }

  ctx.restore();
}

export default function ({ properties = {}, layerId } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'orbit-press-start';
  if (layerId) wrap.dataset.layerId = layerId;

  const backCanvas = document.createElement('canvas');
  backCanvas.className = 'orbit-press-start__canvas orbit-press-start__canvas--back';
  backCanvas.setAttribute('aria-hidden', 'true');

  const frontCanvas = document.createElement('canvas');
  frontCanvas.className = 'orbit-press-start__canvas orbit-press-start__canvas--front';
  frontCanvas.setAttribute('aria-hidden', 'true');

  wrap.append(backCanvas, frontCanvas);

  const backCtx = backCanvas.getContext('2d');
  const frontCtx = frontCanvas.getContext('2d');
  let raf = 0;
  let start = performance.now();

  const sizeCanvas = (canvas, ctx, width, height, padding) => {
    canvas.style.left = `${-padding}px`;
    canvas.style.top = `${-padding}px`;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    setupCanvas(canvas, ctx, width, height);
  };

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
    const elapsed = (now - start) / 1000;
    sizeCanvas(backCanvas, backCtx, width, height, padding);
    sizeCanvas(frontCanvas, frontCtx, width, height, padding);
    drawFrame(backCtx, width, height, properties, elapsed, 'back');
    drawFrame(frontCtx, width, height, properties, elapsed, 'front');
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

// Inspector schema for editor use only — runtime ignores it.
export const properties = {
  sections: [
    {
      id: 'text',
      label: 'Text',
      properties: {
        text: {
          type: 'string',
          label: 'Display Text',
          description: 'The orbiting marquee text. Two consecutive spaces render as a wider gap (e.g. "PRESS  START"); single spaces are skipped entirely so each visible character gets its own letter cell.',
        },
        'font-family': {
          type: 'string',
          label: 'Font Family',
          description: 'CSS font-family stack used for every letter. Falls back through the list if the primary face fails to load.',
        },
        'font-weight': {
          type: 'string',
          label: 'Font Weight',
          description: 'CSS font-weight applied to every letter (e.g. "400", "700", "900").',
        },
        'font-size': {
          type: 'number',
          label: 'Font Size',
          description: 'Glyph height in pixels at the front of the orbit. Letters at the back of the orbit appear smaller after perspective scaling.',
          min: 8,
          max: 96,
          step: 1,
        },
      },
    },
    {
      id: 'animation',
      label: 'Animation',
      description: 'Controls how the marquee spins around the central hub.',
      properties: {
        'rotation-speed': {
          type: 'number',
          label: 'Rotation Speed',
          description: 'Angular velocity of the orbit in radians per second. Higher values spin the marquee faster; 0 freezes it.',
          min: -3,
          max: 3,
          step: 0.01,
        },
        direction: {
          type: 'number',
          label: 'Direction',
          description: 'Spin direction. Positive values rotate one way; negative values reverse it. Sign is the only thing that matters.',
          min: -1,
          max: 1,
          step: 1,
        },
        phase: {
          type: 'number',
          label: 'Phase Offset',
          description: 'Starting rotation in degrees. Use to dial in which letter is at the front when the scene loads.',
          min: 0,
          max: 360,
          step: 1,
        },
      },
    },
    {
      id: 'tilt',
      label: 'Tilt',
      description: 'The three axes set the camera-relative orientation of the orbit ring; the legacy `tilt` key seeded only the Z axis.',
      properties: {
        'tilt-x': {
          type: 'number',
          label: 'Tilt X',
          description: 'Pitch of the orbit ring in degrees. Positive values tip the front of the ring downward.',
          min: -75,
          max: 75,
          step: 0.5,
        },
        'tilt-y': {
          type: 'number',
          label: 'Tilt Y',
          description: 'Yaw of the orbit ring in degrees. Positive values rotate the ring around the vertical axis.',
          min: -75,
          max: 75,
          step: 0.5,
        },
        'tilt-z': {
          type: 'number',
          label: 'Tilt Z',
          description: 'Roll of the entire layer in degrees. Rotates the canvas around the layer center after the orbit is projected.',
          min: -75,
          max: 75,
          step: 0.5,
        },
        tilt: {
          type: 'number',
          label: 'Tilt (legacy)',
          description: 'Legacy fallback for `tilt-z`. Older scenes set this single key to control roll; new scenes should use `tilt-z` directly.',
          min: -75,
          max: 75,
          step: 0.5,
        },
      },
    },
    {
      id: 'position',
      label: 'Position',
      description: 'Offsets translate the projected orbit relative to the layer center; legacy `offset-x` / `offset-y` keys feed the same values.',
      properties: {
        'position-x': {
          type: 'number',
          label: 'Position X',
          description: 'Fine horizontal offset of the orbit center in pixels, relative to the layer center.',
          min: -100,
          max: 100,
          step: 0.25,
        },
        'position-y': {
          type: 'number',
          label: 'Position Y',
          description: 'Fine vertical offset of the orbit center in pixels, relative to the layer center.',
          min: -100,
          max: 100,
          step: 0.25,
        },
        'position-z': {
          type: 'number',
          label: 'Position Z',
          description: 'Depth offset of the orbit center, in the same units as the camera distance. Negative values push the orbit away from the camera; positive values pull it closer.',
          min: -800,
          max: 800,
          step: 1,
        },
        'offset-x': {
          type: 'number',
          label: 'Offset X (legacy)',
          description: 'Legacy fallback for `position-x`. Older scenes set this key to translate the orbit horizontally; new scenes should use `position-x`.',
          min: -100,
          max: 100,
          step: 0.25,
        },
        'offset-y': {
          type: 'number',
          label: 'Offset Y (legacy)',
          description: 'Legacy fallback for `position-y`. Older scenes set this key to translate the orbit vertically; new scenes should use `position-y`.',
          min: -100,
          max: 100,
          step: 0.25,
        },
      },
    },
    {
      id: 'orbit',
      label: 'Orbit',
      description: 'Knobs that shape the ring itself — how many copies of the text travel around it, how wide the ring is, and how the letters are spaced.',
      properties: {
        copies: {
          type: 'number',
          label: 'Copies',
          description: 'How many evenly-spaced copies of the text travel around the orbit. 1 puts a single string on the ring; higher values stagger duplicates around it.',
          min: 1,
          max: 4,
          step: 1,
        },
        'orbit-radius-x': {
          type: 'number',
          label: 'Orbit Radius',
          description: 'Horizontal radius of the orbit in pixels, measured before perspective is applied.',
          min: 20,
          max: 500,
          step: 1,
        },
        'letter-angle-spacing': {
          type: 'number',
          label: 'Letter Angle Spacing',
          description: 'Angular gap between consecutive letters in degrees. Larger values spread the letters further around the ring.',
          min: 0,
          max: 90,
          step: 0.1,
        },
        'edge-scale': {
          type: 'number',
          label: 'Edge Scale',
          description: 'Minimum horizontal scale applied to letters at the side of the ring (90° from camera). Lower values flatten side letters more aggressively, selling the 3D illusion.',
          min: 0.01,
          max: 1,
          step: 0.01,
        },
        repeat: {
          type: 'number',
          label: 'Repeat (legacy)',
          description: 'Legacy fallback for `copies`. Older scenes set this key to control how many copies of the text orbit; new scenes should use `copies`.',
          min: 1,
          max: 4,
          step: 1,
        },
      },
    },
    {
      id: 'letter-cells',
      label: 'Letter Cells',
      description: 'Each visible character gets a rounded panel cell behind it; these knobs size the cell and round its corners.',
      properties: {
        'letter-cell-width': {
          type: 'number',
          label: 'Cell Width',
          description: 'Width of each letter panel in pixels, measured at the front of the orbit.',
          min: 8,
          max: 120,
          step: 1,
        },
        'letter-cell-height': {
          type: 'number',
          label: 'Cell Height',
          description: 'Height of each letter panel in pixels, measured at the front of the orbit.',
          min: 8,
          max: 120,
          step: 1,
        },
        'letter-radius': {
          type: 'number',
          label: 'Cell Corner Radius',
          description: 'Corner radius of each letter panel in pixels. 0 gives sharp rectangles.',
          min: 0,
          max: 60,
          step: 0.5,
        },
        'panel-height': {
          type: 'number',
          label: 'Panel Height (legacy)',
          description: 'Legacy fallback for `letter-cell-height`. Older scenes set this key to size the panel; new scenes should use `letter-cell-height`.',
          min: 8,
          max: 120,
          step: 1,
        },
        'panel-radius': {
          type: 'number',
          label: 'Panel Radius (legacy)',
          description: 'Legacy fallback for `letter-radius`. Older scenes set this key to round panel corners; new scenes should use `letter-radius`.',
          min: 0,
          max: 60,
          step: 0.5,
        },
      },
    },
    {
      id: 'back-markers',
      label: 'Back Markers',
      description: 'Letters on the back half of the orbit are replaced by simpler rounded markers so the front-facing text stays readable.',
      properties: {
        'back-marker-margin': {
          type: 'number',
          label: 'Back Marker Margin',
          description: 'Inset in pixels applied to each back marker, shrinking it relative to the letter cell. Higher values produce smaller, more recessed markers.',
          min: 0,
          max: 40,
          step: 0.5,
        },
        'back-marker-color': {
          type: 'color',
          label: 'Back Marker Color',
          description: 'Fill color of the rounded markers shown on the back half of the orbit. CSS color string.',
        },
      },
    },
    {
      id: 'center-hub',
      label: 'Center Hub',
      description: 'The hub is the radial-gradient disc at the orbit center; size and the three gradient stops are tuned independently.',
      properties: {
        'center-radius': {
          type: 'number',
          label: 'Hub Radius',
          description: 'Radius of the central hub in pixels, measured before perspective is applied.',
          min: 0,
          max: 160,
          step: 1,
        },
        'center-visible': {
          type: 'boolean',
          label: 'Show Hub',
          description: 'Draw the radial center hub. Disable this when another component is used as the press target.',
        },
        'center-fill': {
          type: 'color',
          label: 'Hub Fill',
          description: 'Mid-stop color of the hub radial gradient. Sets the dominant body color of the disc. CSS color string.',
        },
        'center-rim': {
          type: 'color',
          label: 'Hub Rim',
          description: 'Stroke color drawn around the outside of the hub. CSS color string.',
        },
        'center-highlight': {
          type: 'color',
          label: 'Hub Highlight',
          description: 'Inner-stop color of the hub radial gradient — typically a translucent white that creates the specular sheen near the upper-left.',
        },
      },
    },
    {
      id: 'colors',
      label: 'Colors',
      description: 'Per-letter colors — the glyph fill, the panel background behind the glyph, and the glow shadow under the glyph.',
      properties: {
        'text-color': {
          type: 'color',
          label: 'Text Color',
          description: 'Glyph fill color. CSS color string.',
        },
        'panel-color': {
          type: 'color',
          label: 'Panel Color',
          description: 'Background color of the rounded letter panel sitting behind each glyph. CSS color string.',
        },
        'glow-color': {
          type: 'color',
          label: 'Glow Color',
          description: 'Shadow color used for the soft glow under each glyph. CSS color string (typically a translucent variant of the text color).',
        },
      },
    },
    {
      id: 'camera',
      label: 'Camera',
      description: 'Camera distance controls perspective foreshortening; viewport padding extends the canvas beyond the layer bounds so out-of-bounds letters are not clipped.',
      properties: {
        'camera-distance': {
          type: 'number',
          label: 'Camera Distance',
          description: 'Distance from the camera to the orbit center, in the same units as `position-z`. Larger values flatten the perspective; smaller values exaggerate it.',
          min: 100,
          max: 3000,
          step: 10,
        },
        'viewport-padding': {
          type: 'number',
          label: 'Viewport Padding',
          description: 'Extra pixels of canvas added on every side of the layer bounds. Increase if letters get clipped at the edges of the layer.',
          min: 0,
          max: 600,
          step: 10,
        },
      },
    },
  ],
};
