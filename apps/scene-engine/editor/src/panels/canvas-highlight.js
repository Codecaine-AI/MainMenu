import { subscribe, getState } from '../state.js';
import { resolveLayerEl } from '../path.js';

function applyHighlight() {
  const stage = document.getElementById('panel-canvas-stage');
  if (!stage) return;
  stage.querySelectorAll('.is-canvas-selected').forEach(el => el.classList.remove('is-canvas-selected'));
  const { scene, selectedPath } = getState();
  if (!selectedPath) return;
  const el = resolveLayerEl(scene, selectedPath, stage);
  if (el) el.classList.add('is-canvas-selected');
}

export function initCanvasHighlight() {
  subscribe('selection-changed', applyHighlight);
  subscribe('scene-changed', applyHighlight);
}
