import { dom, tilt } from "../state.js";

export function cssSnapshot() {
  const styleLines = dom.styleControls.map((control) => {
    return `  --${control.dataset.styleVar}: ${control.value};`;
  });

  return [
    ".melee-3-layer-lab {",
    `  --tilt-x: ${tilt.x}deg;`,
    `  --tilt-y: ${tilt.y}deg;`,
    ...styleLines,
    "}",
    "",
    ".melee-3-layer-lab .logo-svg {",
    "  display: block;",
    "  width: 100%;",
    "  height: auto;",
    "  overflow: visible;",
    "}",
  ].join("\n");
}

export function initCopyButton() {
  dom.copyButton.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(cssSnapshot());
      dom.copyButton.textContent = "Copied";
      setTimeout(() => {
        dom.copyButton.textContent = "Copy CSS";
      }, 1200);
    } catch {
      dom.copyButton.textContent = "Copy failed";
      setTimeout(() => {
        dom.copyButton.textContent = "Copy CSS";
      }, 1200);
    }
  });
}
