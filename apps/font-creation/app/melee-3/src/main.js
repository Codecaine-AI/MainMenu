import "./styles.css";

import { dom, state, initDom, defaultTilt } from "./state.js";
import { syncStyleControl, saveStyleControl, restoreStyleControls, setTilt, resetTilt, startTiltDrag, updateTiltDrag, stopTiltDrag, loadSvg, regenerateSvgs, onSvgLoad, bakeSvg } from "./viewer.js";
import { resetTiltEffects, renderTiltEffects } from "./tilt-effects.js";
import { activateEditorTab } from "./panels/tabs.js";
import { renderLayerVisualizer } from "./panels/layers.js";
import { renderLightingEditor } from "./panels/lighting.js";
import { renderChromeEditor, renderChromeStops, setChromeEditing, resetSelectedChromeGradient } from "./panels/chrome.js";
import { renderMediaEditor, syncMediaOnLoad } from "./panels/media.js";
import { initCopyButton } from "./panels/actions.js";

initDom();

onSvgLoad(() => {
  renderLayerVisualizer();
  renderChromeEditor();
  renderLightingEditor();
  renderMediaEditor();
  syncMediaOnLoad();
});

restoreStyleControls(dom.styleControls);
dom.styleControls.forEach((control) => {
  syncStyleControl(control);
  control.addEventListener("input", () => {
    syncStyleControl(control);
    saveStyleControl(control);
  });
});

dom.editorTabButtons.forEach((button) => {
  button.addEventListener("click", () => activateEditorTab(button.dataset.editorTab));
});

dom.chromeLayerSelect?.addEventListener("change", renderChromeStops);
dom.chromeEditButton?.addEventListener("click", () => setChromeEditing(!state.chromeEditing));
dom.chromeSaveButton?.addEventListener("click", () => regenerateSvgs());
dom.chromeResetButton?.addEventListener("click", resetSelectedChromeGradient);
dom.mediaSaveButton?.addEventListener("click", () => regenerateSvgs());
dom.lightingSaveButton?.addEventListener("click", () => regenerateSvgs());
dom.assetSelect.addEventListener("change", () => loadSvg(dom.assetSelect.value));
dom.workbench.addEventListener("pointerdown", startTiltDrag);
dom.workbench.addEventListener("pointermove", updateTiltDrag);
dom.workbench.addEventListener("pointerup", stopTiltDrag);
dom.workbench.addEventListener("pointercancel", stopTiltDrag);
dom.regenerateButton.addEventListener("click", () => regenerateSvgs());
dom.fullRegenerateButton.addEventListener("click", () => regenerateSvgs({ full: true }));
dom.bakeButton.addEventListener("click", () => bakeSvg());
dom.resetTiltButton.addEventListener("click", resetTilt);
initCopyButton();

const tiltToggle = document.querySelector("#tiltResponseToggle");
const tiltIntensity = document.querySelector("#tiltResponseIntensity");

tiltToggle?.addEventListener("change", (e) => {
  state.tiltResponseEnabled = e.target.checked;
  if (!state.tiltResponseEnabled) resetTiltEffects();
  else renderTiltEffects();
});

tiltIntensity?.addEventListener("input", (e) => {
  state.tiltResponseIntensity = Math.max(0, Math.min(2, Number(e.target.value)));
});

setTilt(defaultTilt.x, defaultTilt.y, { immediate: true });
loadSvg(dom.assetSelect.value);
