import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

const appDir = path.dirname(fileURLToPath(import.meta.url));
const studioRoot = path.resolve(appDir, "..");
const fontCreationRoot = path.resolve(studioRoot, "..");
const rendererRoot = path.join(studioRoot, "renderer");
const projectRoot = path.join(studioRoot, "projects/melee");
const recipesDir = path.join(projectRoot, "recipes");
const pathsPath = path.join(projectRoot, "inputs/glyph_paths.json");
const outputDir = path.join(projectRoot, "outputs/generated");
const defaultRecipeId = "layer-recipe";

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

function isInside(parent, target) {
  const relative = path.relative(parent, target);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function recipePathForId(recipeId = defaultRecipeId) {
  if (!/^[a-zA-Z0-9_-]+$/.test(recipeId)) {
    throw new Error("Invalid recipe id.");
  }

  const target = path.resolve(recipesDir, `${recipeId}.json`);
  if (!isInside(recipesDir, target)) {
    throw new Error("Recipe path is outside recipes directory.");
  }
  return target;
}

function recipeOutputDir(recipeId = defaultRecipeId) {
  const target = path.resolve(outputDir, recipeId);
  if (!isInside(outputDir, target)) {
    throw new Error("Output path is outside generated directory.");
  }
  return target;
}

function labelFromId(id) {
  return id
    .split(/[-_]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function readGlyphPaths() {
  const data = JSON.parse(await readFile(pathsPath, "utf8"));
  return data.glyphs.map((record) => ({
    glyph: record.glyph,
    glyph_name: record.glyph_name,
    advance_width: record.advance_width,
    units_per_em: record.units_per_em,
    label: record.glyph === record.glyph_name ? record.glyph : `${record.glyph} (${record.glyph_name})`,
    output_path_template: `/generation/outputs/generated/{recipeId}/glyphs/${record.glyph_name}.css-layers.svg`,
    default_output_path: `/generation/outputs/generated/${defaultRecipeId}/glyphs/${record.glyph_name}.css-layers.svg`,
  }));
}

async function readRecipes() {
  const entries = await readdir(recipesDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => {
      const id = path.basename(entry.name, ".json");
      return {
        id,
        filename: entry.name,
        label: labelFromId(id) || id,
        path: `/generation/recipes/${entry.name}`,
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

function runRenderer({ recipeId = defaultRecipeId, glyph, full = false, recipePath, outDir, wordOnly = false } = {}) {
  const selectedRecipePath = recipePathForId(recipeId);
  const args = [
    "-m",
    "scripts.render_recipe",
    "--paths",
    pathsPath,
    "--recipe",
    recipePath || selectedRecipePath,
    "--out-dir",
    outDir || recipeOutputDir(recipeId),
  ];

  if (!full && glyph) {
    args.push("--glyph", glyph);
  }
  if (wordOnly) {
    args.push("--word-only");
  }

  return new Promise((resolve, reject) => {
    const child = spawn(pythonExecutable(), args, { cwd: rendererRoot });
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

function safeOutputName(value) {
  const name = String(value || "")
    .replace(/[^A-Za-z0-9._-]+/g, "_")
    .replace(/^[._-]+|[._-]+$/g, "")
    .slice(0, 80);
  return name || "composition";
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeGapAdjustments(value, gapCount) {
  if (!Array.isArray(value)) return Array.from({ length: gapCount }, () => 0);
  return Array.from({ length: gapCount }, (_, index) => Number(value[index] || 0));
}

async function runComposer({ recipeId = defaultRecipeId, text, tracking, gapAdjustments }) {
  const glyphs = await readGlyphPaths();
  const supported = new Set(glyphs.map((record) => record.glyph));
  const missing = Array.from(new Set(Array.from(text).filter((ch) => ch !== " " && !supported.has(ch))));
  if (missing.length) {
    const detail = missing.map((ch) => JSON.stringify(ch)).join(", ");
    const error = new Error(`Missing glyph path for ${detail}.`);
    error.status = 400;
    throw error;
  }

  const sourceRecipePath = recipePathForId(recipeId);
  const recipe = JSON.parse(await readFile(sourceRecipePath, "utf8"));
  const gapCount = Math.max(0, Array.from(text).length - 1);
  recipe.text = text;
  recipe.tracking = Number(tracking ?? recipe.tracking ?? 4);
  recipe.gap_adjustments = normalizeGapAdjustments(gapAdjustments, gapCount);

  const composerDir = path.join(recipeOutputDir(recipeId), "composer");
  await mkdir(composerDir, { recursive: true });
  const recipePath = path.join(composerDir, `${safeOutputName(text)}.recipe.json`);
  await writeFile(recipePath, `${JSON.stringify(recipe, null, 2)}\n`, "utf8");

  const render = await runRenderer({
    recipeId,
    recipePath,
    outDir: composerDir,
    wordOnly: true,
  });
  const svgRelative = path.relative(projectRoot, path.join(composerDir, "word", `${safeOutputName(text)}.css-layers.svg`));

  return {
    ok: true,
    recipeId,
    text,
    tracking: recipe.tracking,
    gapAdjustments: recipe.gap_adjustments,
    svg: `/generation/${svgRelative}`,
    render,
  };
}

function pythonExecutable() {
  const candidates = [
    process.env.FONT_STUDIO_PYTHON,
    process.env.MELEE3_PYTHON,
    process.env.CONDA_PREFIX ? path.join(process.env.CONDA_PREFIX, "bin/python3") : null,
    process.env.HOME ? path.join(process.env.HOME, "anaconda3/bin/python") : null,
    path.join(fontCreationRoot, ".venv/bin/python"),
    "python3",
  ].filter(Boolean);

  return candidates.find((candidate) => candidate === "python3" || existsSync(candidate)) ?? "python3";
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

function activeServerPort(server) {
  const address = server.httpServer?.address();
  if (address && typeof address === "object" && "port" in address) {
    return address.port;
  }
  return server.config.server.port || 4177;
}

function fontGenerationApi() {
  return {
    name: "font-generation-api",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url || "/", "http://localhost");

        try {
          if (req.method === "GET" && url.pathname === "/api/melee-3/recipe") {
            const recipeId = url.searchParams.get("id") || defaultRecipeId;
            sendJson(res, 200, JSON.parse(await readFile(recipePathForId(recipeId), "utf8")));
            return;
          }

          if (req.method === "GET" && url.pathname === "/api/melee-3/recipes") {
            sendJson(res, 200, { recipes: await readRecipes(), defaultRecipeId });
            return;
          }

          if (req.method === "GET" && url.pathname === "/api/melee-3/glyph-paths") {
            sendJson(res, 200, { glyphs: await readGlyphPaths() });
            return;
          }

          if (req.method === "GET" && url.pathname === "/api/melee-3/media-assets") {
            const extrasDir = path.join(projectRoot, "inputs/extras");
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
            const recipeId = payload.recipeId || defaultRecipeId;
            const full = payload.full === true;
            const selectedRecipePath = recipePathForId(recipeId);

            if (payload.recipe) {
              await writeFile(selectedRecipePath, `${JSON.stringify(payload.recipe, null, 2)}\n`, "utf8");
            }

            const render = await runRenderer({ recipeId, glyph: payload.glyph, full });
            sendJson(res, 200, {
              ok: true,
              recipeId,
              full,
              recipe: JSON.parse(await readFile(selectedRecipePath, "utf8")),
              render,
            });
            return;
          }

          if (req.method === "POST" && url.pathname === "/api/melee-3/regenerate-all") {
            const recipes = await readRecipes();
            const results = [];
            for (const recipe of recipes) {
              try {
                const render = await runRenderer({ recipeId: recipe.id, full: true });
                results.push({ recipeId: recipe.id, ok: true, render });
              } catch (error) {
                results.push({ recipeId: recipe.id, ok: false, error: error.message });
              }
            }
            const ok = results.every((entry) => entry.ok);
            sendJson(res, ok ? 200 : 500, { ok, results });
            return;
          }

          if (req.method === "POST" && url.pathname === "/api/melee-3/compose") {
            const payload = await readBody(req);
            const text = normalizeText(payload.text);
            if (!text) {
              sendJson(res, 400, { ok: false, error: "Text is required." });
              return;
            }
            const result = await runComposer({
              recipeId: payload.recipeId || defaultRecipeId,
              text,
              tracking: payload.tracking,
              gapAdjustments: payload.gapAdjustments,
            });
            sendJson(res, 200, result);
            return;
          }

          if (req.method === "POST" && url.pathname === "/api/melee-3/bake") {
            const payload = await readBody(req);
            const svgRelative = payload.svg;
            if (!svgRelative) {
              sendJson(res, 400, { ok: false, error: "Missing 'svg' field (generation-relative path)." });
              return;
            }

            const svgAbsPath = path.resolve(projectRoot, svgRelative);
            if (!isInside(projectRoot, svgAbsPath)) {
              sendJson(res, 403, { ok: false, error: "Path is outside font project workspace." });
              return;
            }

            const serverPort = activeServerPort(server);
            const scale = payload.scale ?? 2;

            const result = await runBake(svgAbsPath, serverPort, scale);

            const bakedDir = path.join(path.dirname(svgAbsPath), "baked");
            const baseName = path.basename(svgAbsPath, ".css-layers.svg");
            const bakedSvgPath = path.join(bakedDir, `${baseName}.baked.svg`);
            const bakedRelative = path.relative(projectRoot, bakedSvgPath);

            sendJson(res, 200, {
              ok: true,
              bakedSvg: `/generation/${bakedRelative}`,
              output: result.stdout,
            });
            return;
          }

          if (req.method === "GET" && url.pathname.startsWith("/generation/")) {
            const relativePath = decodeURIComponent(url.pathname.replace("/generation/", ""));
            const target = path.resolve(projectRoot, relativePath);

            if (!isInside(projectRoot, target)) {
              sendJson(res, 403, { ok: false, error: "Path is outside font project workspace." });
              return;
            }

            let body;
            try {
              body = await readFile(target);
            } catch (error) {
              if (error.code === "ENOENT") {
                sendJson(res, 404, { ok: false, error: "Generated file not found." });
                return;
              }
              throw error;
            }

            res.statusCode = 200;
            res.setHeader("Content-Type", contentType(target));
            res.setHeader("Cache-Control", "no-store");
            res.end(body);
            return;
          }
        } catch (error) {
          sendJson(res, error.status || 500, { ok: false, error: error.message });
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), fontGenerationApi()],
  build: {
    rollupOptions: {
      input: {
        main: path.join(appDir, "index.html"),
        composer: path.join(appDir, "composer/index.html"),
      },
    },
  },
  server: {
    port: Number(process.env.FONT_STUDIO_APP_PORT || 4177),
  },
});
