SHELL := /bin/bash

FRONTEND_DIR ?= apps/frontend
PIPELINE_DIR ?= apps/asset-extraction-pipeline
FONT_MELEE3_APP_DIR ?= apps/font-creation/app/melee-3
FONT_MELEE3_GENERATION_DIR ?= apps/font-creation/generation/melee-3
FONT_MELEE3_PORT ?= 4177
RUNS_DIR ?= runs
IMAGE ?= assets/Super-Smash-Bros-Melee07292023-112856-24048_thumb.jpg
RUN_ID ?= first-pass
RUN_DIR ?= $(RUNS_DIR)/$(RUN_ID)
MAX_WORKERS ?= 4

.PHONY: help frontend dev build preview clean install \
       font-melee3-install font-melee3-app font-melee3-build font-melee3-generate \
       pipeline-help init dry-run run catalog extract extract-dry-run validate compile clean-runs

help:
	@printf '%s\n' 'MELEE commands'
	@printf '%s\n' ''
	@printf '%s\n' '── Frontend (apps/frontend) ──────────────'
	@printf '%s\n' '  make frontend   Start Vite dev server (hot reload)'
	@printf '%s\n' '  make dev        Start Vite dev server (hot reload)'
	@printf '%s\n' '  make build      Production build → apps/frontend/dist/'
	@printf '%s\n' '  make preview    Serve the built dist/ locally'
	@printf '%s\n' '  make install    Install npm dependencies'
	@printf '%s\n' '  make clean      Delete dist/ and node_modules/'
	@printf '%s\n' ''
	@printf '%s\n' '── Font Creation / MELEE 3 ───────────────'
	@printf '%s\n' '  make font-melee3-install     Install Vite app dependencies'
	@printf '%s\n' '  make font-melee3-app         Start MELEE 3 font app at http://localhost:$(FONT_MELEE3_PORT)'
	@printf '%s\n' '  make font-melee3-build       Build MELEE 3 font app'
	@printf '%s\n' '  make font-melee3-generate    Regenerate CSS-layered SVG outputs from the recipe'
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
	@printf '%s\n' '  FONT_MELEE3_PORT=$(FONT_MELEE3_PORT)'

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

# ── Font Creation / MELEE 3 ──────────────────────────────────
font-melee3-install:
	cd $(FONT_MELEE3_APP_DIR) && npm install

font-melee3-app:
	cd $(FONT_MELEE3_APP_DIR) && MELEE3_APP_PORT=$(FONT_MELEE3_PORT) npm run dev

font-melee3-build:
	cd $(FONT_MELEE3_APP_DIR) && npm run build

font-melee3-generate:
	cd $(FONT_MELEE3_GENERATION_DIR) && python3 scripts/render_recipe.py

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
