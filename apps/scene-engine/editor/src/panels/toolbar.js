import { getState, getDirty, markClean, subscribe } from '../state.js';
import { getEditorSceneId, loadEditorScene } from '../loader.js';

function setSaveDisabled(btn, disabled) {
  if (!btn) return;
  btn.disabled = disabled;
  btn.classList.toggle('is-disabled', disabled);
}

function setDirtyDot(dot, dirty) {
  if (!dot) return;
  dot.classList.toggle('is-dirty', dirty);
  dot.title = dirty ? 'Unsaved changes' : 'No changes';
}

async function saveScene() {
  const { scene } = getState();
  if (!scene) return;
  const id = getEditorSceneId();
  const body = JSON.stringify(scene, null, 2);
  const res = await fetch(`/api/scenes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body,
  });
  if (res.status !== 204) {
    const text = await res.text().catch(() => '');
    throw new Error(`save failed: ${res.status} ${text}`);
  }
  markClean();
}

async function reloadScene() {
  if (getDirty() && !confirm('Discard unsaved changes and reload from disk?')) return;
  await loadEditorScene();
}

export function initToolbar() {
  const sceneId = getEditorSceneId();
  const titleEl = document.querySelector('[data-toolbar-title]');
  if (titleEl) titleEl.textContent = `Scene: ${sceneId}`;

  const saveBtn = document.querySelector('[data-toolbar-save]');
  const reloadBtn = document.querySelector('[data-toolbar-reload]');
  const dirtyDot = document.querySelector('[data-toolbar-dirty]');

  setSaveDisabled(saveBtn, !getDirty());
  setDirtyDot(dirtyDot, getDirty());

  saveBtn?.addEventListener('click', async () => {
    setSaveDisabled(saveBtn, true);
    try {
      await saveScene();
    } catch (err) {
      console.error('[toolbar] save failed', err);
      alert(`Save failed: ${err.message}`);
      setSaveDisabled(saveBtn, !getDirty());
    }
  });

  reloadBtn?.addEventListener('click', () => {
    reloadScene().catch(err => {
      console.error('[toolbar] reload failed', err);
      alert(`Reload failed: ${err.message}`);
    });
  });

  subscribe('dirty-changed', (e) => {
    setSaveDisabled(saveBtn, !e.detail);
    setDirtyDot(dirtyDot, e.detail);
  });
}
