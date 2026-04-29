import { spawn } from "node:child_process";
import { readFile, writeFile, access, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(appDir, "../../..");
const generationRoot = path.resolve(repoRoot, "font-creation/generation/melee-3");
const recipePath = path.join(generationRoot, "recipes/layer-recipe.json");
const renderScript = path.join(generationRoot, "scripts/render_recipe.py");
const pathsPath = path.join(generationRoot, "inputs/glyph_paths.json");
const outputDir = path.join(generationRoot, "outputs/generated");

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload, null, 2);

  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function runRenderer({ full = false } = {}) {
  const args = [
    "-m",
    "scripts.render_recipe",
    "--paths",
    pathsPath,
    "--recipe",
    recipePath,
    "--out-dir",
    outputDir,
  ];

  if (!full) {
    args.push("--glyphs", "dev");
  }

  return new Promise((resolve, reject) => {
    const child = spawn("python3", args, { cwd: generationRoot });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(stderr || stdout || `Renderer exited with code ${code}`));
      }
    });
  });
}

function contentType(filePath) {
  const ext = path.extname(filePath);

  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".mp4") return "video/mp4";
  return "application/octet-stream";
}

function runBake(svgAbsPath, port, scale) {
  const bakeScript = path.join(appDir, "scripts/bake-svg.mjs");
  const args = [bakeScript, svgAbsPath, String(port), String(scale)];

  return new Promise((resolve, reject) => {
    const child = spawn("node", args, { cwd: appDir });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.on("close", (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(stderr || stdout || `Bake exited with code ${code}`));
    });
  });
}

function fontGenerationApi() {
  return {
    name: "font-generation-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");

        try {
          if (req.method === "GET" && url.pathname === "/api/melee-3/recipe") {
            sendJson(res, 200, JSON.parse(await readFile(recipePath, "utf8")));
            return;
          }

          if (req.method === "GET" && url.pathname === "/api/melee-3/media-assets") {
            const extrasDir = path.join(generationRoot, "inputs/extras");
            const videoExts = new Set([".mp4", ".webm", ".mov", ".m4v", ".ogv"]);
            let assets = [];
            try {
              const entries = await readdir(extrasDir, { withFileTypes: true, recursive: true });
              for (const entry of entries) {
                if (!entry.isFile()) continue;
                const ext = path.extname(entry.name).toLowerCase();
                if (!videoExts.has(ext)) continue;
                const fullPath = path.join(entry.parentPath ?? entry.path, entry.name);
                const relativePath = `/generation/inputs/extras/${path.relative(extrasDir, fullPath)}`;
                assets.push({ name: entry.name, path: relativePath });
              }
            } catch {}
            sendJson(res, 200, { assets });
            return;
          }

          if (req.method === "POST" && url.pathname === "/api/melee-3/regenerate") {
            const payload = await readBody(req);
            const full = payload.full === true;

            if (payload.recipe) {
              await writeFile(recipePath, `${JSON.stringify(payload.recipe, null, 2)}\n`, "utf8");
            }

            const render = await runRenderer({ full });
            sendJson(res, 200, {
              ok: true,
              full,
              recipe: JSON.parse(await readFile(recipePath, "utf8")),
              render,
            });
            return;
          }

          if (req.method === "POST" && url.pathname === "/api/melee-3/bake") {
            const payload = await readBody(req);
            const svgRelative = payload.svg;
            if (!svgRelative) {
              sendJson(res, 400, { ok: false, error: "Missing 'svg' field (generation-relative path)." });
              return;
            }

            const svgAbsPath = path.resolve(generationRoot, svgRelative);
            if (!svgAbsPath.startsWith(generationRoot)) {
              sendJson(res, 403, { ok: false, error: "Path is outside generation workspace." });
              return;
            }

            const serverPort = server.config.server.port || 4177;
            const scale = payload.scale ?? 2;

            const result = await runBake(svgAbsPath, serverPort, scale);

            const bakedDir = path.join(path.dirname(svgAbsPath), "baked");
            const baseName = path.basename(svgAbsPath, ".css-layers.svg");
            const bakedSvgPath = path.join(bakedDir, `${baseName}.baked.svg`);
            const bakedRelative = path.relative(generationRoot, bakedSvgPath);

            sendJson(res, 200, {
              ok: true,
              bakedSvg: `/generation/${bakedRelative}`,
              output: result.stdout,
            });
            return;
          }

          if (req.method === "GET" && url.pathname.startsWith("/generation/")) {
            const relativePath = decodeURIComponent(url.pathname.replace("/generation/", ""));
            const target = path.resolve(generationRoot, relativePath);

            if (!target.startsWith(generationRoot)) {
              sendJson(res, 403, { ok: false, error: "Path is outside generation workspace." });
              return;
            }

            const body = await readFile(target);

            res.statusCode = 200;
            res.setHeader("Content-Type", contentType(target));
            res.setHeader("Cache-Control", "no-store");
            res.end(body);
            return;
          }
        } catch (error) {
          sendJson(res, 500, { ok: false, error: error.message });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), fontGenerationApi()],
  server: {
    port: Number(process.env.MELEE3_APP_PORT || 4177),
  },
});
