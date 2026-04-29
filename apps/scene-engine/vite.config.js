import { defineConfig } from 'vite';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const SCENES_DIR = resolve(__dirname, 'scenes');
const SCENE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function readJsonBody(req, limit = 4 * 1024 * 1024) {
  return new Promise((resolvePromise, rejectPromise) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        rejectPromise(new Error('payload too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8');
        resolvePromise(text ? JSON.parse(text) : null);
      } catch (err) {
        rejectPromise(err);
      }
    });
    req.on('error', rejectPromise);
  });
}

function sceneSavePlugin() {
  return {
    name: 'scene-save',
    configureServer(server) {
      server.middlewares.use('/api/scenes/', async (req, res, next) => {
        const url = req.url || '';
        const match = url.match(/^\/([^/?#]+)\/?(?:[?#].*)?$/);
        if (!match) {
          next();
          return;
        }
        const id = match[1];
        if (req.method !== 'PUT') {
          res.statusCode = 405;
          res.setHeader('Allow', 'PUT');
          res.end();
          return;
        }
        if (!SCENE_ID_RE.test(id)) {
          res.statusCode = 400;
          res.end('invalid scene id');
          return;
        }
        let body;
        try {
          body = await readJsonBody(req);
        } catch {
          res.statusCode = 400;
          res.end('invalid json body');
          return;
        }
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          res.statusCode = 400;
          res.end('body must be a json object');
          return;
        }
        const dest = resolve(SCENES_DIR, id, 'scene.json');
        try {
          await mkdir(dirname(dest), { recursive: true });
          await writeFile(dest, JSON.stringify(body, null, 2) + '\n', 'utf8');
        } catch (err) {
          res.statusCode = 500;
          res.end(`write failed: ${err.message}`);
          return;
        }
        res.statusCode = 204;
        res.end();
      });
    },
  };
}

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
  },
  plugins: [sceneSavePlugin()],
});
