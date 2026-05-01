SHELL := /bin/bash

FRONTEND_DIR ?= apps/scene-engine
PIPELINE_DIR ?= apps/asset-extraction-pipeline
FONT_STUDIO_WEB_DIR ?= apps/font-creation/font-studio/web
FONT_STUDIO_RENDERER_DIR ?= apps/font-creation/font-studio/renderer
FONT_STUDIO_PROJECT_DIR ?= apps/font-creation/font-studio/projects/melee
FONT_STUDIO_PORT ?= 4177
RUNS_DIR ?= runs
IMAGE ?= assets/Super-Smash-Bros-Melee07292023-112856-24048_thumb.jpg
RUN_ID ?= first-pass
RUN_DIR ?= $(RUNS_DIR)/$(RUN_ID)
MAX_WORKERS ?= 4

.PHONY: help frontend dev build preview clean install \
       font-studio-install font-studio-app font-studio-build font-studio-generate font-studio-generate-quick font-studio-bake \
       pipeline-help init dry-run run catalog extract extract-dry-run validate compile clean-runs

help:
	@printf '%s\n' 'MELEE commands'
	@printf '%s\n' ''
	@printf '%s\n' '── Frontend (apps/scene-engine) ──────────────'
	@printf '%s\n' '  make frontend   Start Vite dev server (hot reload)'
	@printf '%s\n' '  make dev        Start Vite dev server (hot reload)'
	@printf '%s\n' '  make build      Production build → apps/scene-engine/dist/'
	@printf '%s\n' '  make preview    Serve the built dist/ locally'
	@printf '%s\n' '  make install    Install npm dependencies'
	@printf '%s\n' '  make clean      Delete dist/ and node_modules/'
	@printf '%s\n' ''
	@printf '%s\n' '── Font Studio (apps/font-creation/font-studio) ───────────────'
	@printf '%s\n' '  make font-studio-install        Install Vite app dependencies'
	@printf '%s\n' '  make font-studio-app            Start font studio app at http://localhost:$(FONT_STUDIO_PORT)'
	@printf '%s\n' '  make font-studio-build          Build font studio app'
	@printf '%s\n' '  make font-studio-generate       Regenerate ALL glyph SVGs from the recipe'
	@printf '%s\n' '  make font-studio-generate-quick Regenerate dev subset (@,A,R,F,K,*) + word only'
	@printf '%s\n' '  make font-studio-bake           Bake current word SVG to PNGs (requires dev server running)'
	@printf '%s\n' ''
	@printf '%s\n' '── Pipeline (apps/asset-extraction-pipeline) ──'
	@printf '%s\n' '  make dry-run IMAGE=assets/source.jpg RUN_ID=test'
	@printf '%s\n' '  make run OPENAI_API_KEY=... ANTHROPIC_API_KEY=...'
	@printf '%s\n' ''
	@printf '%s\n' '  pipeline-help   Show extract-assets CLI help'
	@printf '%s\n' '  init            Create a run folder from IMAGE'
	@printf '%s\n' '  dry-run         Create run + catalog request without model API calls'
	@printf '%s\n' '  run             Run cataloging, then parallel asset extraction'
	@printf '%s\n' '  catalog         Catalog assets for RUN_DIR'
	@printf '%s\n' '  extract         Extract all catalog assets for RUN_DIR'
	@printf '%s\n' '  extract-dry-run Generate extraction requests without model API calls'
	@printf '%s\n' '  validate        Validate RUN_DIR'
	@printf '%s\n' '  compile         Compile-check pipeline Python files'
	@printf '%s\n' '  clean-runs      Delete generated runs/'
	@printf '%s\n' ''
	@printf '%s\n' 'Variables:'
	@printf '%s\n' '  IMAGE=$(IMAGE)'
	@printf '%s\n' '  RUN_ID=$(RUN_ID)'
	@printf '%s\n' '  RUN_DIR=$(RUN_DIR)'
	@printf '%s\n' '  MAX_WORKERS=$(MAX_WORKERS)'
	@printf '%s\n' '  FONT_STUDIO_PORT=$(FONT_STUDIO_PORT)'

# ── Frontend ────────────────────────────────────────────────
install:
	cd $(FRONTEND_DIR) && npm install

frontend: dev

dev:
	cd $(FRONTEND_DIR) && npm run dev

build:
	cd $(FRONTEND_DIR) && npm run build

preview: build
	cd $(FRONTEND_DIR) && npm run preview

clean:
	rm -rf $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/node_modules

# ── Font Studio ──────────────────────────────────────────────
font-studio-install:
	cd $(FONT_STUDIO_WEB_DIR) && npm install

font-studio-app:
	cd $(FONT_STUDIO_WEB_DIR) && FONT_STUDIO_APP_PORT=$(FONT_STUDIO_PORT) npm run dev

font-studio-build:
	cd $(FONT_STUDIO_WEB_DIR) && npm run build

font-studio-generate:
	cd $(FONT_STUDIO_RENDERER_DIR) && python3 -m scripts.render_recipe

font-studio-generate-quick:
	cd $(FONT_STUDIO_RENDERER_DIR) && python3 -m scripts.render_recipe --glyphs dev

font-studio-bake:
	cd $(FONT_STUDIO_WEB_DIR) && node scripts/bake-svg.mjs "$(CURDIR)/$(FONT_STUDIO_PROJECT_DIR)/outputs/generated/word/CODECAINE.css-layers.svg" $(FONT_STUDIO_PORT)

# ── Pipeline ─────────────────────────────────────────────────
pipeline-help:
	@cd $(PIPELINE_DIR) && uv run extract-assets --help

init:
	@cd $(PIPELINE_DIR) && uv run extract-assets --runs-dir ../../$(RUNS_DIR) init ../../$(IMAGE) --run-id $(RUN_ID)

dry-run:
	@cd $(PIPELINE_DIR) && uv run extract-assets --runs-dir ../../$(RUNS_DIR) run ../../$(IMAGE) --run-id $(RUN_ID) --max-workers $(MAX_WORKERS) --dry-run

run:
	@cd $(PIPELINE_DIR) && uv run extract-assets --runs-dir ../../$(RUNS_DIR) run ../../$(IMAGE) --run-id $(RUN_ID) --max-workers $(MAX_WORKERS)

catalog:
	@cd $(PIPELINE_DIR) && uv run extract-assets catalog ../../$(RUN_DIR)

extract:
	@cd $(PIPELINE_DIR) && uv run extract-assets extract-assets ../../$(RUN_DIR) --max-workers $(MAX_WORKERS)

extract-dry-run:
	@cd $(PIPELINE_DIR) && uv run extract-assets extract-assets ../../$(RUN_DIR) --max-workers $(MAX_WORKERS) --dry-run

validate:
	@cd $(PIPELINE_DIR) && uv run extract-assets validate ../../$(RUN_DIR)

compile:
	@python3 -m compileall $(PIPELINE_DIR)/asset_extraction_pipeline

clean-runs:
	rm -rf $(RUNS_DIR)
