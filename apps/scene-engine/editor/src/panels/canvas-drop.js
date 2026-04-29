import { getState, addLayerAt } from '../state.js';

const STAGE_W = 1440;
const STAGE_H = 1080;

function collectIds(scene, set = new Set()) {
  if (!scene?.layers) return set;
  const walk = (layers) => {
    for (const l of layers) {
      if (l.id) set.add(l.id);
      if (l.children) walk(l.children);
    }
  };
  walk(scene.layers);
  return set;
}

function uniqueId(base, scene) {
  const used = collectIds(scene);
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}-${n}`)) n++;
  return `${base}-${n}`;
}

function buildLayer(assetId, entry, dropPos, scene) {
  const id = uniqueId(assetId, scene);
  switch (entry.type) {
    case 'media':
      return { id, type: 'media', asset: assetId, properties: { fit: 'cover', blend: 'normal', opacity: 1.0 } };
    case 'effect':
      return { id, type: 'effect', asset: assetId, properties: { opacity: 1.0 } };
    case 'glyph-group':
      return {
        id,
        type: 'glyph-group',
        asset: assetId,
        position: { x: dropPos.x, y: dropPos.y },
        properties: { scale: 0.18 },
      };
    case 'component':
      return {
        id,
        type: 'component',
        asset: assetId,
        position: { x: dropPos.x, y: dropPos.y },
        properties: {},
      };
    case 'audio':
      return { id, type: 'audio', asset: assetId, properties: { volume: 1.0, loop: true, autoplay: true } };
    default:
      return { id, type: entry.type, asset: assetId, properties: {} };
  }
}

function dropPositionOnStage(e, stage) {
  const rect = stage.getBoundingClientRect();
  if (rect.width === 0 || rect.height === 0) return { x: STAGE_W / 2, y: STAGE_H / 2 };
  const scaleX = rect.width / STAGE_W;
  const scaleY = rect.height / STAGE_H;
  const x = Math.round((e.clientX - rect.left) / scaleX);
  const y = Math.round((e.clientY - rect.top) / scaleY);
  return {
    x: Math.max(0, Math.min(STAGE_W, x)),
    y: Math.max(0, Math.min(STAGE_H, y)),
  };
}

function hasAssetPayload(e) {
  return e.dataTransfer?.types?.includes('application/x-asset-id');
}

export function initCanvasDrop() {
  const panel = document.getElementById('panel-canvas');
  const stage = document.getElementById('panel-canvas-stage');
  if (!panel || !stage) return;

  const onDragOver = (e) => {
    if (!hasAssetPayload(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    panel.classList.add('is-drop-target');
  };
  const onDragLeave = (e) => {
    if (e.target === panel || !panel.contains(e.relatedTarget)) {
      panel.classList.remove('is-drop-target');
    }
  };
  const onDrop = (e) => {
    panel.classList.remove('is-drop-target');
    const assetId = e.dataTransfer.getData('application/x-asset-id') || e.dataTransfer.getData('text/plain');
    if (!assetId) return;
    const { scene, registry } = getState();
    if (!scene || !registry) return;
    const entry = registry[assetId];
    if (!entry) return;
    e.preventDefault();
    const pos = dropPositionOnStage(e, stage);
    const newLayer = buildLayer(assetId, entry, pos, scene);
    const topLength = scene.layers?.length ?? 0;
    addLayerAt('', topLength, newLayer);
  };

  panel.addEventListener('dragenter', onDragOver);
  panel.addEventListener('dragover', onDragOver);
  panel.addEventListener('dragleave', onDragLeave);
  panel.addEventListener('drop', onDrop);
}
