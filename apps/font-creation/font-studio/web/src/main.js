import "./styles.css";

import { dom, state, initDom } from "./state.js";
import { syncStyleControl, saveStyleControl, restoreStyleControls, initializeAssetControls, selectRecipe, selectGlyph, regenerateSvgs, regenerateAllRecipes, onSvgLoad, bakeSvg } from "./viewer.js";
import { activateEditorTab } from "./panels/tabs.js";
import { renderLayerVisualizer } from "./panels/layers.js";
import { renderLightingEditor } from "./panels/lighting.js";
import { renderChromeEditor, renderChromeStops, setChromeEditing, resetSelectedChromeGradient } from "./panels/chrome.js";
import { syncMediaOnLoad } from "./panels/media.js";
import { initCopyButton } from "./panels/actions.js";

initDom();

onSvgLoad(() => {
  renderLayerVisualizer();
  renderChromeEditor();
  renderLightingEditor();
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
dom.lightingSaveButton?.addEventListener("click", () => regenerateSvgs());
dom.assetSelect.addEventListener("change", () => selectGlyph(dom.assetSelect.value));
dom.recipeSelect.addEventListener("change", () => selectRecipe(dom.recipeSelect.value));
dom.regenerateButton.addEventListener("click", () => regenerateSvgs());
dom.fullRegenerateButton.addEventListener("click", () => regenerateSvgs({ full: true }));
dom.regenerateAllButton?.addEventListener("click", () => regenerateAllRecipes());
dom.bakeButton.addEventListener("click", () => bakeSvg());
initCopyButton();

initializeAssetControls().catch((error) => {
  if (dom.appStatus) dom.appStatus.textContent = error.message;
});
