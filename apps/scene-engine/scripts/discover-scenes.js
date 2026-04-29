import { readdirSync, statSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function discoverScenes(rootDir = path.resolve(__dirname, '..')) {
  const scenesDir = path.join(rootDir, 'scenes');
  if (!existsSync(scenesDir)) return [];
  const out = [];
  for (const id of readdirSync(scenesDir)) {
    const dir = path.join(scenesDir, id);
    if (!statSync(dir).isDirectory()) continue;
    const sceneJsonPath = path.join(dir, 'scene.json');
    if (!existsSync(sceneJsonPath)) continue;
    out.push({ id, dir, sceneJsonPath, htmlPath: path.join(dir, 'index.html') });
  }
  return out;
}

export function renderSceneHtml(sceneId, sceneTitle) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>CODECAINE — ${sceneTitle}</title>
</head>
<body>
  <div id="stage-wrap"><div id="stage"></div></div>
  <script>window.__SCENE_ID__ = ${JSON.stringify(sceneId)};</script>
  <script type="module" src="/src/main.js"></script>
</body>
</html>
`;
}

export function ensureSceneHtml(rootDir, scene) {
  if (existsSync(scene.htmlPath)) return false;
  let title = scene.id;
  try {
    const json = JSON.parse(readFileSync(scene.sceneJsonPath, 'utf8'));
    if (typeof json?.name === 'string') title = json.name;
  } catch {}
  writeFileSync(scene.htmlPath, renderSceneHtml(scene.id, title));
  return true;
}

export function ensureAllSceneHtml(rootDir = path.resolve(__dirname, '..')) {
  const scenes = discoverScenes(rootDir);
  for (const s of scenes) ensureSceneHtml(rootDir, s);
  return scenes;
}

export default { discoverScenes, ensureSceneHtml, ensureAllSceneHtml };
