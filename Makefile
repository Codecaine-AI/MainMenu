SHELL := /bin/bash

FRONTEND_DIR ?= apps/scene-engine
PIPELINE_DIR ?= apps/scene-engine/tools/asset-extraction-pipeline
FONT_EFFECTS_WEB_DIR ?= apps/font-creation/font-effects/web
FONT_EFFECTS_RENDERER_DIR ?= apps/font-creation/font-effects/renderer
FONT_EFFECTS_OUTPUTS_DIR ?= apps/font-creation/font-effects/outputs
FONT_EFFECTS_PORT ?= 4177
RUNS_DIR ?= runs
IMAGE ?= assets/Super-Smash-Bros-Melee07292023-112856-24048_thumb.jpg
RUN_ID ?= first-pass
RUN_DIR ?= $(RUNS_DIR)/$(RUN_ID)
MAX_WORKERS ?= 4

.PHONY: help frontend dev desktop desktop-dev build preview clean install \
       font-effects-install font-effects-app font-effects-build font-effects-generate font-effects-generate-quick font-effects-bake \
       pipeline-ui pipeline-ui-install pipeline-help init dry-run run catalog extract extract-dry-run validate compile clean-runs

help:
	@printf '%s\n' 'MELEE commands'
	@printf '%s\n' ''
	@printf '%s\n' '── Frontend (apps/scene-engine) ──────────────'
	@printf '%s\n' '  make frontend   Start Next.js dev server (hot reload)'
	@printf '%s\n' '  make dev        Start Next.js dev server (hot reload)'
	@printf '%s\n' '  make desktop    Start Main Menu Electron shell in dev mode'
	@printf '%s\n' '  make build      Production build → apps/scene-engine/.next/'
	@printf '%s\n' '  make preview    Build and serve the Next.js app locally'
	@printf '%s\n' '  make install    Install npm dependencies'
	@printf '%s\n' '  make clean      Delete .next, dist, and node_modules/'
	@printf '%s\n' ''
	@printf '%s\n' '── Font Effects (apps/font-creation/font-effects) ─────────────'
	@printf '%s\n' '  make font-effects-install        Install Vite app dependencies'
	@printf '%s\n' '  make font-effects-app            Start font effects app at http://localhost:$(FONT_EFFECTS_PORT)'
	@printf '%s\n' '  make font-effects-build          Build font effects app'
	@printf '%s\n' '  make font-effects-generate       Regenerate ALL glyph SVGs from the recipe'
	@printf '%s\n' '  make font-effects-generate-quick Regenerate dev subset (@,A,R,F,K,*) + word only'
	@printf '%s\n' '  make font-effects-bake           Bake current word SVG to PNGs (requires dev server running)'
	@printf '%s\n' ''
	@printf '%s\n' '── Pipeline (apps/scene-engine project helpers) ──'
	@printf '%s\n' '  make pipeline-ui                  Start scene-engine UI with helper pages'
	@printf '%s\n' '  make pipeline-ui-install          Install scene-engine dependencies'
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
	@printf '%s\n' '  FONT_EFFECTS_PORT=$(FONT_EFFECTS_PORT)'

# ── Frontend ────────────────────────────────────────────────
install:
	cd $(FRONTEND_DIR) && npm install

frontend: dev

dev:
	cd $(FRONTEND_DIR) && npm run dev

desktop: desktop-dev

desktop-dev:
	cd $(FRONTEND_DIR) && npm run desktop:dev

build:
	cd $(FRONTEND_DIR) && npm run build

preview: build
	cd $(FRONTEND_DIR) && npm run start

clean:
	rm -rf $(FRONTEND_DIR)/.next $(FRONTEND_DIR)/dist $(FRONTEND_DIR)/node_modules

# ── Font Effects ─────────────────────────────────────────────
font-effects-install:
	cd $(FONT_EFFECTS_WEB_DIR) && npm install

font-effects-app:
	cd $(FONT_EFFECTS_WEB_DIR) && FONT_EFFECTS_APP_PORT=$(FONT_EFFECTS_PORT) npm run dev

font-effects-build:
	cd $(FONT_EFFECTS_WEB_DIR) && npm run build

font-effects-generate:
	cd $(FONT_EFFECTS_RENDERER_DIR) && python3 -m scripts.render_recipe

font-effects-generate-quick:
	cd $(FONT_EFFECTS_RENDERER_DIR) && python3 -m scripts.render_recipe --glyphs dev

font-effects-bake:
	cd $(FONT_EFFECTS_WEB_DIR) && node scripts/bake-svg.mjs "$(CURDIR)/$(FONT_EFFECTS_OUTPUTS_DIR)/generated/melee-3/layer-recipe/word/CODECAINE.css-layers.svg" $(FONT_EFFECTS_PORT)

# ── Pipeline ─────────────────────────────────────────────────
pipeline-ui-install:
	cd $(FRONTEND_DIR) && npm install

pipeline-ui:
	cd $(FRONTEND_DIR) && npm run dev

pipeline-help:
	@cd $(PIPELINE_DIR) && uv run extract-assets --help

init:
	@cd $(PIPELINE_DIR) && uv run extract-assets --runs-dir "$(CURDIR)/$(RUNS_DIR)" init "$(CURDIR)/$(IMAGE)" --run-id $(RUN_ID)

dry-run:
	@cd $(PIPELINE_DIR) && uv run extract-assets --runs-dir "$(CURDIR)/$(RUNS_DIR)" run "$(CURDIR)/$(IMAGE)" --run-id $(RUN_ID) --max-workers $(MAX_WORKERS) --dry-run

run:
	@cd $(PIPELINE_DIR) && uv run extract-assets --runs-dir "$(CURDIR)/$(RUNS_DIR)" run "$(CURDIR)/$(IMAGE)" --run-id $(RUN_ID) --max-workers $(MAX_WORKERS)

catalog:
	@cd $(PIPELINE_DIR) && uv run extract-assets catalog "$(CURDIR)/$(RUN_DIR)"

extract:
	@cd $(PIPELINE_DIR) && uv run extract-assets extract-assets "$(CURDIR)/$(RUN_DIR)" --max-workers $(MAX_WORKERS)

extract-dry-run:
	@cd $(PIPELINE_DIR) && uv run extract-assets extract-assets "$(CURDIR)/$(RUN_DIR)" --max-workers $(MAX_WORKERS) --dry-run

validate:
	@cd $(PIPELINE_DIR) && uv run extract-assets validate "$(CURDIR)/$(RUN_DIR)"

compile:
	@python3 -m compileall $(PIPELINE_DIR)/asset_extraction_pipeline

clean-runs:
	rm -rf $(RUNS_DIR)
