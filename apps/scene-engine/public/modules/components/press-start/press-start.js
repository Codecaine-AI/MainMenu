export default function ({ properties = {}, layerId } = {}) {
  const el = document.createElement('div');
  el.className = 'press-start';
  const NBSP = ' ';
  el.textContent = properties.text ?? `PRESS${NBSP}${NBSP}START`;
  el.style.setProperty('--blink-duration', `${properties['blink-rate'] ?? 1.1}s`);
  if (layerId) el.dataset.layerId = layerId;
  return el;
}

// Inspector schema for editor use only — runtime ignores it.
export const properties = {
  sections: [
    {
      id: 'text',
      label: 'Text',
      properties: {
        text: {
          type: 'string',
          label: 'Display Text',
          description: 'The text shown on screen. Two consecutive spaces render as a wider gap (e.g. "PRESS  START").',
        },
      },
    },
    {
      id: 'animation',
      label: 'Animation',
      properties: {
        'blink-rate': {
          type: 'number',
          label: 'Blink Rate',
          description: 'Duration in seconds for one full blink cycle. Lower values blink faster.',
          min: 0.1,
          max: 5,
          step: 0.1,
        },
      },
    },
  ],
};
