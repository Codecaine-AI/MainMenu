SHELL := /bin/bash

PIPELINE_DIR ?= apps/asset-extraction-pipeline
RUNS_DIR ?= runs
IMAGE ?= assets/Super-Smash-Bros-Melee07292023-112856-24048_thumb.jpg
RUN_ID ?= first-pass
RUN_DIR ?= $(RUNS_DIR)/$(RUN_ID)
MAX_WORKERS ?= 4

.PHONY: help pipeline-help init dry-run run catalog extract extract-dry-run validate compile clean-runs

help:
	@printf '%s\n' 'MELEE commands'
	@printf '%s\n' ''
	@printf '%s\n' 'Usage:'
	@printf '%s\n' '  make dry-run IMAGE=assets/source.jpg RUN_ID=test'
	@printf '%s\n' '  make run OPENAI_API_KEY=... ANTHROPIC_API_KEY=...'
	@printf '%s\n' ''
	@printf '%s\n' 'Targets:'
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
