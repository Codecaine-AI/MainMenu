export const defaultTilt = { x: 0, y: 0 };
export const tilt = { x: 0, y: 0 };
export const tiltLimit = { x: 28, y: 34 };
export const layerVisibility = new Map();
export const defaultVisibleLayers = new Set(["fill-layer", "red-lip-boundary-layer"]);

export const state = {
  activeRecipe: null,
  savedRecipe: null,
  recipeDirty: false,
  chromeEditing: false,
  tiltDrag: null,
  pendingTiltFrame: 0,
  tiltResponseEnabled: true,
  tiltResponseIntensity: 1.0,
};

export const dom = {
  workbench: null,
  scene: null,
  stageTilt: null,
  mount: null,
  assetSelect: null,
  regenerateButton: null,
  resetTiltButton: null,
  copyButton: null,
  fullRegenerateButton: null,
  appStatus: null,
  layerStackMap: null,
  chromeLayerSelect: null,
  chromeStopList: null,
  chromeGradientPreview: null,
  chromeEditButton: null,
  chromeSaveButton: null,
  chromeResetButton: null,
  mediaControlList: null,
  mediaSaveButton: null,
  lightingControlList: null,
  lightingSaveButton: null,
  bakeButton: null,
  bakeScale: null,
  styleControls: [],
  editorTabButtons: [],
  editorTabPanels: [],
};

export function initDom() {
  dom.workbench = document.querySelector(".workbench");
  dom.scene = document.querySelector("#scene");
  dom.stageTilt = document.querySelector("#stageTilt");
  dom.mount = document.querySelector("#svgMount");
  dom.assetSelect = document.querySelector("#assetSelect");
  dom.regenerateButton = document.querySelector("#regenerateButton");
  dom.resetTiltButton = document.querySelector("#resetTiltButton");
  dom.copyButton = document.querySelector("#copyButton");
  dom.fullRegenerateButton = document.querySelector("#fullRegenerateButton");
  dom.appStatus = document.querySelector("#appStatus");
  dom.layerStackMap = document.querySelector("#layerStackMap");
  dom.chromeLayerSelect = document.querySelector("#chromeLayerSelect");
  dom.chromeStopList = document.querySelector("#chromeStopList");
  dom.chromeGradientPreview = document.querySelector("#chromeGradientPreview");
  dom.chromeEditButton = document.querySelector("#chromeEditButton");
  dom.chromeSaveButton = document.querySelector("#chromeSaveButton");
  dom.chromeResetButton = document.querySelector("#chromeResetButton");
  dom.mediaControlList = document.querySelector("#mediaControlList");
  dom.mediaSaveButton = document.querySelector("#mediaSaveButton");
  dom.lightingControlList = document.querySelector("#lightingControlList");
  dom.lightingSaveButton = document.querySelector("#lightingSaveButton");
  dom.bakeButton = document.querySelector("#bakeButton");
  dom.bakeScale = document.querySelector("#bakeScale");
  dom.styleControls = Array.from(document.querySelectorAll("[data-style-var]"));
  dom.editorTabButtons = Array.from(document.querySelectorAll("[data-editor-tab]"));
  dom.editorTabPanels = Array.from(document.querySelectorAll("[data-editor-panel]"));
}

export function setStatus(message) {
  if (dom.appStatus) dom.appStatus.textContent = message;
}

export function setRecipeDirty(isDirty) {
  state.recipeDirty = isDirty;
  dom.regenerateButton.disabled = !state.recipeDirty;
  if (dom.chromeSaveButton) dom.chromeSaveButton.disabled = !state.recipeDirty;
  if (dom.mediaSaveButton) dom.mediaSaveButton.disabled = !state.recipeDirty;
  if (dom.lightingSaveButton) dom.lightingSaveButton.disabled = !state.recipeDirty;
}

export function recipeHasChanges() {
  return JSON.stringify(state.activeRecipe) !== JSON.stringify(state.savedRecipe);
}

export function recipeLayer(layerId) {
  return state.activeRecipe?.layers?.find((layer) => layer.id === layerId) ?? null;
}

export function isLayerVisible(layerId) {
  const layer = recipeLayer(layerId);
  return layerVisibility.get(layerId) ?? layer?.visible ?? defaultVisibleLayers.has(layerId);
}

export function setLayerVisible(layerId, visible) {
  const layer = recipeLayer(layerId);
  layerVisibility.set(layerId, visible);
  if (layer) layer.visible = visible;
  setRecipeDirty(true);
}

export function syncRecipeVisibility() {
  state.activeRecipe?.layers?.forEach((layer) => {
    layer.visible = isLayerVisible(layer.id);
  });
}

export async function loadRecipe() {
  const response = await fetch("/api/melee-3/recipe");
  if (!response.ok) throw new Error("Recipe API unavailable.");
  state.activeRecipe = await response.json();
  state.savedRecipe = structuredClone(state.activeRecipe);
}
