import "./styles.css";

const STORAGE_KEY = "melee3-composer-settings";
const DEFAULT_RECIPE_ID = "layer-recipe";
const DEFAULT_TEXT = "CODECAINE";

const dom = {
  recipeSelect: document.querySelector("#composerRecipeSelect"),
  text: document.querySelector("#composerText"),
  trackingRange: document.querySelector("#trackingRange"),
  trackingValue: document.querySelector("#trackingValue"),
  gapList: document.querySelector("#gapList"),
  fastMount: document.querySelector("#fastPreviewMount"),
  exactMount: document.querySelector("#exactPreviewMount"),
  fastPreviewButton: document.querySelector("#fastPreviewButton"),
  exactPreviewButton: document.querySelector("#exactPreviewButton"),
  renderExactButton: document.querySelector("#renderExactButton"),
  copyLinkButton: document.querySelector("#copyComposerLinkButton"),
  exportLink: document.querySelector("#composerExportLink"),
  resetGapsButton: document.querySelector("#resetGapsButton"),
  status: document.querySelector("#composerStatus"),
};

const state = {
  recipes: [],
  glyphs: [],
  recipeId: DEFAULT_RECIPE_ID,
  text: DEFAULT_TEXT,
  tracking: 4,
  gapAdjustments: [],
  exactSvg: "",
  previewMode: "fast",
};

function setStatus(message) {
  dom.status.textContent = message;
}

async function fetchJson(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.error || `Request failed: ${path}`);
  return payload;
}

function loadSavedSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) ?? {};
  } catch {
    return {};
  }
}

function saveSettings() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      recipeId: state.recipeId,
      text: state.text,
      tracking: state.tracking,
      gapAdjustments: state.gapAdjustments,
    }),
  );
}

function chars() {
  return Array.from(state.text);
}

function gapCount() {
  return Math.max(0, chars().length - 1);
}

function normalizeGaps() {
  const count = gapCount();
  state.gapAdjustments = Array.from({ length: count }, (_, index) => Number(state.gapAdjustments[index] || 0));
}

function glyphByChar() {
  return new Map(state.glyphs.map((record) => [record.glyph, record]));
}

function unsupportedChars() {
  const glyphs = glyphByChar();
  return Array.from(new Set(chars().filter((ch) => ch !== " " && !glyphs.has(ch))));
}

function populateRecipeSelect(defaultRecipeId) {
  dom.recipeSelect.replaceChildren();
  state.recipes.forEach((recipe) => {
    const option = document.createElement("option");
    option.value = recipe.id;
    option.textContent = recipe.label;
    option.selected = recipe.id === state.recipeId;
    dom.recipeSelect.append(option);
  });
  if (!state.recipes.some((recipe) => recipe.id === state.recipeId)) {
    state.recipeId = state.recipes[0]?.id || defaultRecipeId || DEFAULT_RECIPE_ID;
  }
  dom.recipeSelect.value = state.recipeId;
}

async function loadRecipeDefaults() {
  const recipe = await fetchJson(`/api/melee-3/recipe?id=${encodeURIComponent(state.recipeId)}`);
  if (!Number.isFinite(Number(state.tracking))) {
    state.tracking = Number(recipe.tracking ?? 4);
  }
}

function syncControls() {
  dom.text.value = state.text;
  dom.trackingRange.value = String(state.tracking);
  dom.trackingValue.value = String(state.tracking);
}

function glyphUrl(record) {
  return `/generation/outputs/generated/${state.recipeId}/glyphs/${record.glyph_name}.css-layers.svg`;
}

function playInlineVideos(root) {
  root.querySelectorAll("foreignObject video").forEach((video) => {
    video.play().catch(() => {});
  });
}

function startFrameVideos(frame) {
  try {
    const doc = frame.contentDocument;
    if (!doc) return;
    doc.querySelectorAll("video").forEach((video) => {
      video.play().catch(() => {});
    });
  } catch {}
}

function renderFastPreview() {
  normalizeGaps();
  const missing = unsupportedChars();
  if (!state.text) {
    dom.fastMount.innerHTML = '<div class="load-state">Enter text to compose</div>';
    return;
  }
  if (missing.length) {
    dom.fastMount.innerHTML = `<div class="error-state">Missing glyphs: ${missing.map((ch) => JSON.stringify(ch)).join(", ")}</div>`;
    return;
  }

  const glyphs = glyphByChar();
  const unitsPerEm = Number(state.glyphs[0]?.units_per_em || 1000);
  let currentX = 0;
  const placements = [];
  chars().forEach((ch, index) => {
    const gap = Number(state.gapAdjustments[index] || 0);
    if (ch === " ") {
      currentX += unitsPerEm * 0.35 + state.tracking + gap;
      return;
    }
    const record = glyphs.get(ch);
    placements.push({ record, x: currentX, width: Number(record.advance_width || unitsPerEm) });
    currentX += Number(record.advance_width || unitsPerEm) + state.tracking + gap;
  });

  const width = Math.max(1, currentX - state.tracking);
  const available = Math.max(320, dom.fastMount.clientWidth - 48);
  const scale = Math.min(1, available / width);
  const height = Math.ceil(unitsPerEm * scale);
  const inner = document.createElement("div");
  inner.className = "fast-word-inner";
  inner.style.width = `${width}px`;
  inner.style.height = `${unitsPerEm}px`;
  inner.style.transform = `scale(${scale})`;

  placements.forEach(({ record, x, width: glyphWidth }) => {
    const frame = document.createElement("iframe");
    frame.className = "fast-glyph-frame";
    frame.title = record.glyph;
    frame.src = glyphUrl(record);
    frame.style.left = `${x}px`;
    frame.style.width = `${glyphWidth}px`;
    frame.style.height = `${unitsPerEm}px`;
    frame.addEventListener("load", () => startFrameVideos(frame));
    inner.append(frame);
  });

  const frame = document.createElement("div");
  frame.className = "fast-word-frame";
  frame.style.width = `${Math.ceil(width * scale)}px`;
  frame.style.height = `${height}px`;
  frame.append(inner);
  dom.fastMount.replaceChildren(frame);
}

function renderGapControls() {
  normalizeGaps();
  const letters = chars();
  dom.gapList.replaceChildren();

  if (letters.length < 2) {
    dom.gapList.innerHTML = '<p class="gap-empty">No pairs in this text.</p>';
    return;
  }

  state.gapAdjustments.forEach((value, index) => {
    const row = document.createElement("label");
    row.className = "gap-row";
    const left = letters[index] === " " ? "space" : letters[index];
    const right = letters[index + 1] === " " ? "space" : letters[index + 1];
    row.innerHTML = `
      <span class="gap-pair">${left} / ${right}</span>
      <span class="gap-inputs">
        <input type="range" min="-240" max="240" step="1" value="${value}" data-gap-range="${index}" aria-label="Spacing ${left} ${right}" />
        <input type="number" min="-240" max="240" step="1" value="${value}" data-gap-value="${index}" aria-label="Spacing value ${left} ${right}" />
      </span>
    `;
    dom.gapList.append(row);
  });
}

function updatePreview() {
  normalizeGaps();
  renderGapControls();
  renderFastPreview();
  saveSettings();
}

function setPreviewMode(mode) {
  state.previewMode = mode;
  dom.fastPreviewButton.classList.toggle("is-active", mode === "fast");
  dom.exactPreviewButton.classList.toggle("is-active", mode === "exact");
  dom.fastMount.hidden = mode !== "fast";
  dom.exactMount.hidden = mode !== "exact";
}

async function renderExact() {
  const missing = unsupportedChars();
  if (missing.length) {
    setStatus(`Missing glyphs: ${missing.map((ch) => JSON.stringify(ch)).join(", ")}`);
    return;
  }

  setStatus("Rendering exact SVG...");
  dom.renderExactButton.disabled = true;
  try {
    const payload = await fetchJson("/api/melee-3/compose", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipeId: state.recipeId,
        text: state.text,
        tracking: state.tracking,
        gapAdjustments: state.gapAdjustments,
      }),
    });
    state.exactSvg = payload.svg;
    dom.exportLink.href = payload.svg;
    dom.exportLink.hidden = false;
    dom.copyLinkButton.disabled = false;
    await loadExactSvg(`${payload.svg}?v=${Date.now()}`);
    setPreviewMode("exact");
    setStatus("Exact SVG rendered.");
  } catch (error) {
    setStatus(error.message);
  } finally {
    dom.renderExactButton.disabled = false;
  }
}

async function loadExactSvg(src) {
  dom.exactMount.innerHTML = '<div class="load-state">Loading exact SVG</div>';
  const response = await fetch(src);
  if (!response.ok) throw new Error("Generated SVG could not be loaded.");
  const svgText = await response.text();
  dom.exactMount.innerHTML = svgText;
  const svg = dom.exactMount.querySelector("svg");
  if (svg) {
    svg.classList.add("logo-svg");
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    playInlineVideos(dom.exactMount);
  }
}

async function copySvgLink() {
  if (!state.exactSvg) return;
  await navigator.clipboard.writeText(new URL(state.exactSvg, window.location.origin).toString());
  setStatus("Copied SVG link.");
}

function bindEvents() {
  dom.text.addEventListener("input", () => {
    state.text = dom.text.value;
    normalizeGaps();
    updatePreview();
  });
  dom.recipeSelect.addEventListener("change", () => {
    state.recipeId = dom.recipeSelect.value;
    state.exactSvg = "";
    dom.copyLinkButton.disabled = true;
    dom.exportLink.hidden = true;
    updatePreview();
  });
  dom.trackingRange.addEventListener("input", () => {
    state.tracking = Number(dom.trackingRange.value);
    syncControls();
    updatePreview();
  });
  dom.trackingValue.addEventListener("input", () => {
    state.tracking = Number(dom.trackingValue.value);
    syncControls();
    updatePreview();
  });
  dom.gapList.addEventListener("input", (event) => {
    const target = event.target;
    const index = Number(target.dataset.gapRange ?? target.dataset.gapValue);
    if (!Number.isInteger(index)) return;
    state.gapAdjustments[index] = Number(target.value);
    const row = target.closest(".gap-row");
    row?.querySelectorAll("input").forEach((input) => {
      if (input !== target) input.value = target.value;
    });
    renderFastPreview();
    saveSettings();
  });
  dom.resetGapsButton.addEventListener("click", () => {
    state.gapAdjustments = Array.from({ length: gapCount() }, () => 0);
    updatePreview();
  });
  dom.renderExactButton.addEventListener("click", renderExact);
  dom.copyLinkButton.addEventListener("click", copySvgLink);
  dom.fastPreviewButton.addEventListener("click", () => setPreviewMode("fast"));
  dom.exactPreviewButton.addEventListener("click", () => setPreviewMode("exact"));
  window.addEventListener("resize", renderFastPreview);
}

async function init() {
  setStatus("Loading composer assets...");
  const saved = loadSavedSettings();
  state.recipeId = saved.recipeId || DEFAULT_RECIPE_ID;
  state.text = saved.text || DEFAULT_TEXT;
  state.tracking = Number.isFinite(Number(saved.tracking)) ? Number(saved.tracking) : Number.NaN;
  state.gapAdjustments = Array.isArray(saved.gapAdjustments) ? saved.gapAdjustments : [];

  const [recipesPayload, glyphPayload] = await Promise.all([
    fetchJson("/api/melee-3/recipes"),
    fetchJson("/api/melee-3/glyph-paths"),
  ]);
  state.recipes = recipesPayload.recipes ?? [];
  state.glyphs = glyphPayload.glyphs ?? [];
  populateRecipeSelect(recipesPayload.defaultRecipeId);
  await loadRecipeDefaults();
  normalizeGaps();
  syncControls();
  bindEvents();
  updatePreview();
  setStatus("Composer ready.");
}

init().catch((error) => {
  setStatus(error.message);
});
