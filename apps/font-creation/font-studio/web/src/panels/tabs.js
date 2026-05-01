import { dom } from "../state.js";

export function activateEditorTab(tabName) {
  dom.editorTabButtons.forEach((button) => {
    const isActive = button.dataset.editorTab === tabName;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-selected", isActive ? "true" : "false");
  });

  dom.editorTabPanels.forEach((panel) => {
    const isActive = panel.dataset.editorPanel === tabName;
    panel.classList.toggle("is-active", isActive);
    panel.hidden = !isActive;
  });
}
