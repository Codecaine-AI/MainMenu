SHELL := /bin/bash

BACKEND_DIR ?= apps/backend
RUNS_DIR ?= runs
IMAGE ?= assets/Super-Smash-Bros-Melee07292023-112856-24048_thumb.jpg
RUN_ID ?= first-pass
RUN_DIR ?= $(RUNS_DIR)/$(RUN_ID)
CATALOG_MODEL ?= openai/gpt-5.4
PROMPT_MODEL ?= anthropic/claude-opus-4-6
IMAGE_MODEL ?= openai-image/gpt-image-2
MAX_WORKERS ?= 4
IMAGE_SIZE ?= auto
IMAGE_QUALITY ?= high

.PHONY: help backend-help init dry-run run catalog extract extract-dry-run validate compile clean-runs

help:
	@printf '%s\n' 'MELEE commands'
	@printf '%s\n' ''
	@printf '%s\n' 'Usage:'
	@printf '%s\n' '  make dry-run IMAGE=assets/source.jpg RUN_ID=test'
	@printf '%s\n' '  make run OPENAI_API_KEY=... ANTHROPIC_API_KEY=...'
	@printf '%s\n' ''
	@printf '%s\n' 'Targets:'
	@printf '%s\n' '  backend-help   Show melee-pipeline CLI help'
	@printf '%s\n' '  init           Create a run folder from IMAGE'
	@printf '%s\n' '  dry-run        Create run + catalog request without model API calls'
	@printf '%s\n' '  run            Run cataloging, then parallel asset extraction'
	@printf '%s\n' '  catalog        Catalog assets for RUN_DIR'
	@printf '%s\n' '  extract        Extract all catalog assets for RUN_DIR'
	@printf '%s\n' '  extract-dry-run Generate extraction requests without model API calls'
	@printf '%s\n' '  validate       Validate RUN_DIR'
	@printf '%s\n' '  compile        Compile-check backend Python files'
	@printf '%s\n' '  clean-runs     Delete generated runs/'
	@printf '%s\n' ''
	@printf '%s\n' 'Variables:'
	@printf '%s\n' '  IMAGE=$(IMAGE)'
	@printf '%s\n' '  RUN_ID=$(RUN_ID)'
	@printf '%s\n' '  RUN_DIR=$(RUN_DIR)'
	@printf '%s\n' '  CATALOG_MODEL=$(CATALOG_MODEL)'
	@printf '%s\n' '  PROMPT_MODEL=$(PROMPT_MODEL)'
	@printf '%s\n' '  IMAGE_MODEL=$(IMAGE_MODEL)'
	@printf '%s\n' '  MAX_WORKERS=$(MAX_WORKERS)'

backend-help:
	@cd $(BACKEND_DIR) && uv run melee-pipeline --help

init:
	@cd $(BACKEND_DIR) && uv run melee-pipeline --runs-dir ../../$(RUNS_DIR) init ../../$(IMAGE) --run-id $(RUN_ID)

dry-run:
	@cd $(BACKEND_DIR) && uv run melee-pipeline --runs-dir ../../$(RUNS_DIR) run ../../$(IMAGE) --run-id $(RUN_ID) --catalog-model $(CATALOG_MODEL) --prompt-model $(PROMPT_MODEL) --image-model $(IMAGE_MODEL) --max-workers $(MAX_WORKERS) --image-size $(IMAGE_SIZE) --image-quality $(IMAGE_QUALITY) --dry-run

run:
	@cd $(BACKEND_DIR) && uv run melee-pipeline --runs-dir ../../$(RUNS_DIR) run ../../$(IMAGE) --run-id $(RUN_ID) --catalog-model $(CATALOG_MODEL) --prompt-model $(PROMPT_MODEL) --image-model $(IMAGE_MODEL) --max-workers $(MAX_WORKERS) --image-size $(IMAGE_SIZE) --image-quality $(IMAGE_QUALITY)

catalog:
	@cd $(BACKEND_DIR) && uv run melee-pipeline catalog ../../$(RUN_DIR) --model $(CATALOG_MODEL)

extract:
	@cd $(BACKEND_DIR) && uv run melee-pipeline extract-assets ../../$(RUN_DIR) --image-model $(IMAGE_MODEL) --prompt-model $(PROMPT_MODEL) --max-workers $(MAX_WORKERS) --image-size $(IMAGE_SIZE) --image-quality $(IMAGE_QUALITY)

extract-dry-run:
	@cd $(BACKEND_DIR) && uv run melee-pipeline extract-assets ../../$(RUN_DIR) --image-model $(IMAGE_MODEL) --prompt-model $(PROMPT_MODEL) --max-workers $(MAX_WORKERS) --image-size $(IMAGE_SIZE) --image-quality $(IMAGE_QUALITY) --dry-run

validate:
	@cd $(BACKEND_DIR) && uv run melee-pipeline validate ../../$(RUN_DIR)

compile:
	@python3 -m compileall $(BACKEND_DIR)/src

clean-runs:
	rm -rf $(RUNS_DIR)
