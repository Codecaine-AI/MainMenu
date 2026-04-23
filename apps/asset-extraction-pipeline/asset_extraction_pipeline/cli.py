from __future__ import annotations

import argparse
from pathlib import Path

from .io.paths import default_runs_dir, init_run
from .io.validation import validate_run
from .run import run_two_step_pipeline
from .steps.catalog import catalog_run
from .steps.extract import extract_assets


DEFAULT_CATALOG_MODEL = "openai/gpt-5.4"
DEFAULT_PROMPT_MODEL = "anthropic/claude-opus-4-6"
DEFAULT_IMAGE_MODEL = "gemini-image/gemini-3.1-flash-image-preview"


def main() -> None:
    parser = argparse.ArgumentParser(prog="extract-assets")
    parser.add_argument("--runs-dir", type=Path, default=default_runs_dir())
    subparsers = parser.add_subparsers(dest="command", required=True)

    init_parser = subparsers.add_parser("init", help="Create a run folder from a source image.")
    init_parser.add_argument("image", type=Path)
    init_parser.add_argument("--run-id")

    catalog_parser = subparsers.add_parser("catalog", help="Catalog visual assets for a run.")
    catalog_parser.add_argument("run", type=Path)
    catalog_parser.add_argument("--model", default=DEFAULT_CATALOG_MODEL)
    catalog_parser.add_argument("--dry-run", action="store_true")

    extract_parser = subparsers.add_parser("extract-assets", help="Extract all catalog assets.")
    extract_parser.add_argument("run", type=Path)
    extract_parser.add_argument("--image-model", default=DEFAULT_IMAGE_MODEL)
    extract_parser.add_argument("--prompt-model", default=DEFAULT_PROMPT_MODEL)
    extract_parser.add_argument("--max-workers", type=int, default=4)
    extract_parser.add_argument("--dry-run", action="store_true")
    extract_parser.add_argument("--image-size", default="auto")
    extract_parser.add_argument("--image-quality", default="high")

    run_parser = subparsers.add_parser("run", help="Run cataloging, then parallel extraction.")
    run_parser.add_argument("image", type=Path)
    run_parser.add_argument("--run-id")
    run_parser.add_argument("--catalog-model", default=DEFAULT_CATALOG_MODEL)
    run_parser.add_argument("--prompt-model", default=DEFAULT_PROMPT_MODEL)
    run_parser.add_argument("--image-model", default=DEFAULT_IMAGE_MODEL)
    run_parser.add_argument("--max-workers", type=int, default=4)
    run_parser.add_argument("--dry-run", action="store_true")
    run_parser.add_argument("--image-size", default="auto")
    run_parser.add_argument("--image-quality", default="high")

    validate_parser = subparsers.add_parser("validate", help="Validate a run folder.")
    validate_parser.add_argument("run", type=Path)

    args = parser.parse_args()
    args.runs_dir.mkdir(parents=True, exist_ok=True)

    if args.command == "init":
        run_dir = init_run(args.image, runs_dir=args.runs_dir, run_id=args.run_id)
        print(run_dir)
    elif args.command == "catalog":
        catalog = catalog_run(args.run, model=args.model, dry_run=args.dry_run)
        print(args.run if catalog is None else args.run / "catalog.json")
    elif args.command == "extract-assets":
        results = extract_assets(
            args.run,
            image_model=args.image_model,
            prompt_model=args.prompt_model,
            max_workers=args.max_workers,
            dry_run=args.dry_run,
            size=args.image_size,
            quality=args.image_quality,
        )
        completed = sum(result.status == "completed" for result in results)
        dry = sum(result.status == "dry_run" for result in results)
        failed = sum(result.status == "failed" for result in results)
        print(f"assets={len(results)} completed={completed} dry_run={dry} failed={failed}")
    elif args.command == "run":
        run_dir = run_two_step_pipeline(
            source_image=args.image,
            runs_dir=args.runs_dir,
            run_id=args.run_id,
            catalog_model=args.catalog_model,
            prompt_model=args.prompt_model,
            image_model=args.image_model,
            max_workers=args.max_workers,
            dry_run=args.dry_run,
            image_size=args.image_size,
            image_quality=args.image_quality,
        )
        print(run_dir)
    elif args.command == "validate":
        errors = validate_run(args.run)
        if errors:
            for error in errors:
                print(error)
            raise SystemExit(1)
        print(f"ok: {args.run}")


if __name__ == "__main__":
    main()
