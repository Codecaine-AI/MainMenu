import { renderScene } from '../../../src/renderer/scene-renderer.js';
import { subscribe } from '../state.js';

function fitStageToPanel() {
  const panel = document.getElementById('panel-canvas');
  const stage = document.getElementById('panel-canvas-stage');
  if (!panel || !stage) return;
  const scale = Math.min(panel.clientWidth / 1440, panel.clientHeight / 1080, 1);
  stage.style.transform = `scale(${scale})`;
}

export function initCanvasPanel() {
  const stage = document.getElementById('panel-canvas-stage');
  subscribe('scene-changed', async (e) => {
    await renderScene(e.detail, stage);
    fitStageToPanel();
  });
  window.addEventListener('resize', fitStageToPanel);
  fitStageToPanel();
}
