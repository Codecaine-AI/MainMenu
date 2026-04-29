import { dom, state } from "../state.js";
import { clamp, controlModeBadge } from "../utils.js";
import { applyRecipeLightingValue, lightingPathValue } from "../recipe.js";

function lightingSlider(path, labelText, fallback, min, max, step, updateMode = "rebuild") {
  const label = document.createElement("label");
  const header = document.createElement("span");
  const name = document.createElement("span");
  const inputs = document.createElement("span");
  const rangeInput = document.createElement("input");
  const numberInput = document.createElement("input");
  const value = lightingPathValue(path) ?? fallback;
  const controlValue = clamp(Number(value), Number(min), Number(max));

  label.className = "lighting-slider layer-slider";
  label.dataset.updateMode = updateMode;
  header.className = "layer-slider-header";
  inputs.className = "layer-slider-inputs has-range";
  name.textContent = labelText;

  rangeInput.type = "range";
  rangeInput.min = String(min);
  rangeInput.max = String(max);
  rangeInput.step = String(step);
  rangeInput.value = String(controlValue);

  numberInput.type = "number";
  numberInput.min = String(min);
  numberInput.max = String(max);
  numberInput.step = String(step);
  numberInput.value = String(controlValue);

  function applyValue(source) {
    if (source.value === "") return;
    const numericValue = clamp(Number(source.value), Number(min), Number(max));
    rangeInput.value = String(numericValue);
    numberInput.value = String(numericValue);
    applyRecipeLightingValue(path, numericValue);
  }

  rangeInput.addEventListener("input", () => applyValue(rangeInput));
  numberInput.addEventListener("input", () => applyValue(numberInput));

  header.append(name, controlModeBadge(updateMode));
  inputs.append(rangeInput, numberInput);
  label.append(header, inputs);
  return label;
}

function lightingSection(title, controls) {
  const section = document.createElement("section");
  const heading = document.createElement("h3");
  section.className = "lighting-control-section";
  heading.textContent = title;
  section.append(heading, ...controls);
  return section;
}

export function renderLightingEditor() {
  if (!dom.lightingControlList || !state.activeRecipe) return;

  dom.lightingControlList.replaceChildren(
    lightingSection("Overlays", [
      lightingSlider("chrome_shadow_opacity", "Shadow", 0.22, 0, 1, 0.01, "live"),
      lightingSlider("chrome_highlight_opacity", "Highlight", 0.42, 0, 1, 0.01, "live"),
      lightingSlider("ao_opacity", "AO", 0.34, 0, 1, 0.01, "live"),
    ]),
    lightingSection("Light Direction", [
      lightingSlider("light.x", "X", -0.55, -2, 2, 0.05),
      lightingSlider("light.y", "Y", -0.75, -2, 2, 0.05),
      lightingSlider("light.z", "Z", 1.25, 0.1, 4, 0.05),
    ]),
    lightingSection("Surface", [
      lightingSlider("normal_strength", "Normal", 2.4, 0, 6, 0.1),
      lightingSlider("ambient", "Ambient", 0.32, 0, 1, 0.01),
      lightingSlider("diffuse", "Diffuse", 0.42, 0, 1, 0.01),
      lightingSlider("specular", "Specular", 0.86, 0, 2, 0.01),
      lightingSlider("specular_power", "Power", 48, 1, 128, 1),
    ]),
    lightingSection("Quality", [
      lightingSlider("resolution_scale", "Resolution", 3, 0.5, 4, 0.25),
    ]),
  );
}
