import './styles/editor.css';
import '../../src/renderer/asset-renderers/index.js';
import { loadEditorScene } from './loader.js';
import { initCanvasPanel } from './panels/canvas.js';
import { initHierarchyPanel } from './panels/hierarchy.js';
import { initCanvasHighlight } from './panels/canvas-highlight.js';
import { initCanvasDrop } from './panels/canvas-drop.js';
import { initInspectorPanel } from './panels/inspector.js';
import { initAssetBrowserPanel } from './panels/asset-browser.js';
import { initToolbar } from './panels/toolbar.js';

function boot() {
  initToolbar();
  initCanvasPanel();
  initHierarchyPanel();
  initCanvasHighlight();
  initCanvasDrop();
  initInspectorPanel();
  initAssetBrowserPanel();
  loadEditorScene().catch(err => console.error('[editor] boot failed', err));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
