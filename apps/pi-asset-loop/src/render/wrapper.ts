// Transparent body + #asset-root inline-block so the screenshot can clip to the
// bounding box and keep alpha edges intact. Ported from the original Python render step.

export function buildRenderWrapper(componentHtml: string, componentCss: string): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <style>
    ${componentCss}

    html, body {
      margin: 0;
      padding: 0;
      background: transparent;
      width: max-content;
      height: max-content;
    }

    body {
      display: inline-block;
    }

    #asset-root {
      position: relative;
      display: inline-block;
      isolation: isolate;
    }
  </style>
</head>
<body>
  <div id="asset-root">
${componentHtml}
  </div>
</body>
</html>
`;
}
