import { dom, state, layerVisibility, setStatus, setRecipeDirty, syncRecipeVisibility, loadRecipe } from "./state.js";
import { svgLayers } from "./layer-data.js";

const postLoadHooks = [];
const DEFAULT_RECIPE_ID = "layer-recipe";

export function onSvgLoad(fn) {
  postLoadHooks.push(fn);
}

function runPostLoadHooks() {
  postLoadHooks.forEach((fn) => fn());
}

const STYLE_STORAGE_KEY = "melee3-style-vars";

function loadSavedStyleVars() {
  try {
    return JSON.parse(localStorage.getItem(STYLE_STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

export function setStyleVar(name, value) {
  document.documentElement.style.setProperty(`--${name}`, value);
}

export function syncStyleControl(control) {
  const name = control.dataset.styleVar;
  setStyleVar(name, control.value);
}

export function saveStyleControl(control) {
  const saved = loadSavedStyleVars();
  saved[control.dataset.styleVar] = control.value;
  localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(saved));
}

export function restoreStyleControls(controls) {
  const saved = loadSavedStyleVars();
  for (const control of controls) {
    const value = saved[control.dataset.styleVar];
    if (value !== undefined) control.value = value;
  }
}

function selectedGlyphRecord() {
  return state.glyphPaths.find((record) => record.glyph === state.selectedGlyph) ?? state.glyphPaths[0] ?? null;
}

function glyphSvgSrc({ cacheBust = false } = {}) {
  const record = selectedGlyphRecord();
  if (!record || !state.selectedRecipeId) return "";

  const src = `/generation/outputs/generated/${state.selectedRecipeId}/glyphs/${record.glyph_name}.css-layers.svg`;
  return cacheBust ? `${src}?v=${Date.now()}` : src;
}

function populateSelect(select, items, selectedValue) {
  select.replaceChildren();
  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item.value;
    option.textContent = item.label;
    if (item.value === selectedValue) option.selected = true;
    select.append(option);
  });
}

async function fetchJson(path) {
  const response = await fetch(path);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed: ${path}`);
  return payload;
}

async function loadGlyphPathOptions() {
  const payload = await fetchJson("/api/melee-3/glyph-paths");
  state.glyphPaths = payload.glyphs ?? [];

  const defaultGlyph = state.glyphPaths.find((record) => record.glyph === "@")?.glyph
    ?? state.glyphPaths[0]?.glyph
    ?? "";
  state.selectedGlyph = state.glyphPaths.some((record) => record.glyph === state.selectedGlyph)
    ? state.selectedGlyph
    : defaultGlyph;

  populateSelect(
    dom.assetSelect,
    state.glyphPaths.map((record) => ({ value: record.glyph, label: record.label })),
    state.selectedGlyph,
  );
}

async function loadRecipeOptions() {
  const payload = await fetchJson("/api/melee-3/recipes");
  state.recipes = payload.recipes ?? [];
  const defaultRecipeId = payload.defaultRecipeId || DEFAULT_RECIPE_ID;
  state.selectedRecipeId = state.recipes.some((recipe) => recipe.id === defaultRecipeId)
    ? defaultRecipeId
    : state.recipes[0]?.id || defaultRecipeId;

  populateSelect(
    dom.recipeSelect,
    state.recipes.map((recipe) => ({ value: recipe.id, label: recipe.label })),
    state.selectedRecipeId,
  );
}

export async function initializeAssetControls() {
  setStatus("Loading recipes and glyph paths...");
  await Promise.all([loadRecipeOptions(), loadGlyphPathOptions()]);
  await loadRecipe(state.selectedRecipeId);
  await loadSelectedGlyphSvg({ preserveDirty: false });
}

export async function selectRecipe(recipeId) {
  state.selectedRecipeId = recipeId;
  if (dom.recipeSelect) dom.recipeSelect.value = recipeId;
  setStatus("Loading recipe...");
  await loadRecipe(recipeId);
  await loadSelectedGlyphSvg({ preserveDirty: false });
}

export async function selectGlyph(glyph) {
  state.selectedGlyph = glyph;
  if (dom.assetSelect) dom.assetSelect.value = glyph;
  await loadSelectedGlyphSvg({ preserveDirty: true });
}

export async function loadSelectedGlyphSvg(options = {}) {
  const src = glyphSvgSrc({ cacheBust: options.cacheBust });
  if (!src) {
    dom.mount.innerHTML = '<div class="error-state">No glyph paths found.</div>';
    setStatus("No glyph paths found.");
    runPostLoadHooks();
    return;
  }
  await loadSvg(src, options);
}

export function applyLayerVisibility() {
  const svg = dom.mount.querySelector("svg");
  if (!svg) return;

  svgLayers().forEach((entry) => {
    const layer = svg.querySelector(`#${CSS.escape(entry.id)}`);
    if (layer) layer.classList.toggle("is-hidden", !entry.visible);
  });
}

export async function loadSvg(src, { preserveDirty = false } = {}) {
  dom.mount.innerHTML = '<div class="load-state">Loading Font Studio asset</div>';
  const wasDirty = state.recipeDirty;
  const cleanSrc = src.replace(/\?.*$/, "");
  state.currentSvgSrc = cleanSrc;

  try {
    const response = await fetch(src);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(`Missing SVG for this recipe/glyph. Use Full Regenerate, or edit and Save, to render ${cleanSrc}.`);
      }
      throw new Error(`HTTP ${response.status}`);
    }

    const text = await response.text();
    dom.mount.innerHTML = text;

    const svg = dom.mount.querySelector("svg");
    if (!svg) throw new Error("No SVG element found");

    svg.classList.add("logo-svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    svg.querySelectorAll("foreignObject video").forEach((video) => {
      video.play().catch(() => {});
    });
    dom.styleControls.forEach(syncStyleControl);
    layerVisibility.clear();

    applyLayerVisibility();
    runPostLoadHooks();

    if (preserveDirty) setRecipeDirty(wasDirty);
    else setRecipeDirty(false);
    setStatus(`Loaded ${cleanSrc}`);
  } catch (error) {
    dom.mount.innerHTML = `<div class="error-state">${error.message}</div>`;
    setStatus(error.message);
    runPostLoadHooks();
    if (preserveDirty) setRecipeDirty(wasDirty);
  }
}

export async function bakeSvg() {
  const src = glyphSvgSrc();
  const svgRelative = src.replace(/^\/generation\//, "").replace(/\?.*$/, "");
  const scale = Number(dom.bakeScale?.value ?? 2);

  setStatus(`Baking at ${scale}x...`);
  dom.bakeButton.disabled = true;

  try {
    const response = await fetch("/api/melee-3/bake", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ svg: svgRelative, scale }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Bake failed.");
    }

    const bakedUrl = payload.bakedSvg;
    await loadSvg(`${bakedUrl}?v=${Date.now()}`, { preserveDirty: true });
    setStatus("Bake complete.");
  } catch (error) {
    setStatus(`Bake error: ${error.message}`);
  } finally {
    dom.bakeButton.disabled = false;
  }
}

export async function regenerateAllRecipes() {
  setStatus("Rebuilding all recipes...");
  dom.regenerateAllButton.disabled = true;
  dom.regenerateButton.disabled = true;
  dom.fullRegenerateButton.disabled = true;

  try {
    const response = await fetch("/api/melee-3/regenerate-all", { method: "POST" });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      const failed = (payload.results || []).filter((entry) => !entry.ok);
      const detail = failed.length ? failed.map((e) => `${e.recipeId}: ${e.error}`).join("; ") : "Rebuild all failed.";
      throw new Error(detail);
    }
    await loadSelectedGlyphSvg({ cacheBust: true, preserveDirty: false });
    setStatus(`Rebuilt ${payload.results.length} recipe(s).`);
  } catch (error) {
    setStatus(error.message);
  } finally {
    dom.regenerateAllButton.disabled = false;
    dom.regenerateButton.disabled = !state.recipeDirty;
    dom.fullRegenerateButton.disabled = false;
  }
}

export async function regenerateSvgs({ full = false } = {}) {
  if (!full && !state.recipeDirty) return;

  setStatus(full ? "Full regenerate (all glyphs)..." : "Saving...");
  dom.regenerateButton.disabled = true;
  if (full) dom.fullRegenerateButton.disabled = true;
  syncRecipeVisibility();

  try {
    const response = await fetch("/api/melee-3/regenerate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipeId: state.selectedRecipeId,
        recipe: state.activeRecipe,
        glyph: state.selectedGlyph,
        full,
      }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Regeneration failed.");
    }

    if (payload.recipe) {
      state.activeRecipe = payload.recipe;
      state.savedRecipe = structuredClone(payload.recipe);
    } else {
      state.savedRecipe = structuredClone(state.activeRecipe);
    }
    await loadSelectedGlyphSvg({ cacheBust: true, preserveDirty: false });
    setRecipeDirty(false);
    setStatus(full ? "Full regenerate complete." : "Saved.");
  } catch (error) {
    setStatus(error.message);
    if (!full) setRecipeDirty(true);
  } finally {
    dom.regenerateButton.disabled = !state.recipeDirty;
    if (full) dom.fullRegenerateButton.disabled = false;
  }
}
