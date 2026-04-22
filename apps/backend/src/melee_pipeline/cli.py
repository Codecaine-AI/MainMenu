from __future__ import annotations

import argparse
from pathlib import Path

from .io.paths import default_runs_dir, init_run
from .pipeline import (
    catalog_run,
    critique_component,
    diff_component,
    extract_assets,
    generate_component,
    render_component,
    run_asset_loop,
    run_two_step_pipeline,
)
from .io.validation import validate_run
from .schemas import ImplementationMode


DEFAULT_CATALOG_MODEL = "openai/gpt-5.4"
DEFAULT_PROMPT_MODEL = "anthropic/claude-opus-4-6"
DEFAULT_IMAGE_MODEL = "gemini-image/gemini-3.1-flash-image-preview"
DEFAULT_COMPONENT_MODEL = "anthropic/claude-opus-4-6"
DEFAULT_CRITIQUE_MODEL = "openai/gpt-5.4"


def main() -> None:
    parser = argparse.ArgumentParser(prog="melee-pipeline")
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

    generate_parser = subparsers.add_parser(
        "generate-component", help="Generate component HTML/CSS for one extracted asset."
    )
    generate_parser.add_argument("run", type=Path)
    generate_parser.add_argument("asset_id")
    generate_parser.add_argument("--model", default=DEFAULT_COMPONENT_MODEL)
    generate_parser.add_argument(
        "--implementation-mode",
        default=ImplementationMode.CSS_SVG_HYBRID.value,
        choices=[mode.value for mode in ImplementationMode],
    )
    generate_parser.add_argument("--iteration", type=int, default=1)
    generate_parser.add_argument("--dry-run", action="store_true")

    render_parser = subparsers.add_parser(
        "render-component", help="Render one generated component to a PNG screenshot."
    )
    render_parser.add_argument("run", type=Path)
    render_parser.add_argument("asset_id")
    render_parser.add_argument("--browser", default="chromium")
    render_parser.add_argument("--settle-ms", type=int, default=350)

    diff_parser = subparsers.add_parser(
        "diff-component", help="Diff a rendered component PNG against its extracted asset."
    )
    diff_parser.add_argument("run", type=Path)
    diff_parser.add_argument("asset_id")

    critique_parser = subparsers.add_parser(
        "critique-component", help="Produce a strict critique report for one rendered asset."
    )
    critique_parser.add_argument("run", type=Path)
    critique_parser.add_argument("asset_id")
    critique_parser.add_argument("--model", default=DEFAULT_CRITIQUE_MODEL)
    critique_parser.add_argument("--iteration", type=int, default=1)
    critique_parser.add_argument("--threshold", type=float, default=0.95)

    loop_parser = subparsers.add_parser(
        "run-asset-loop",
        help="Run generate -> render -> diff -> critique for one asset until accepted or capped.",
    )
    loop_parser.add_argument("run", type=Path)
    loop_parser.add_argument("asset_id")
    loop_parser.add_argument("--generation-model", default=DEFAULT_COMPONENT_MODEL)
    loop_parser.add_argument("--critique-model", default=DEFAULT_CRITIQUE_MODEL)
    loop_parser.add_argument(
        "--implementation-mode",
        default=ImplementationMode.CSS_SVG_HYBRID.value,
        choices=[mode.value for mode in ImplementationMode],
    )
    loop_parser.add_argument("--max-iterations", type=int, default=3)
    loop_parser.add_argument("--threshold", type=float, default=0.95)
    loop_parser.add_argument("--browser", default="chromium")
    loop_parser.add_argument("--dry-run", action="store_true")

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
    elif args.command == "generate-component":
        result = generate_component(
            args.run,
            asset_id=args.asset_id,
            model=args.model,
            implementation_mode=ImplementationMode(args.implementation_mode),
            iteration=args.iteration,
            dry_run=args.dry_run,
        )
        print("dry_run" if result is None else args.run / "assets" / args.asset_id / "component.html")
    elif args.command == "render-component":
        result = render_component(
            args.run,
            asset_id=args.asset_id,
            browser=args.browser,
            settle_ms=args.settle_ms,
        )
        print(args.run / "assets" / args.asset_id / result.render_path)
    elif args.command == "diff-component":
        metrics = diff_component(args.run, asset_id=args.asset_id)
        print(
            f"pixel_mismatch={metrics.pixel_mismatch_ratio:.6f} "
            f"alpha_mismatch={metrics.alpha_mismatch_ratio:.6f} "
            f"mean_delta={metrics.mean_abs_channel_delta:.3f}"
        )
    elif args.command == "critique-component":
        report = critique_component(
            args.run,
            asset_id=args.asset_id,
            model=args.model,
            iteration=args.iteration,
            threshold=args.threshold,
        )
        print(
            f"score={report.score:.6f} threshold={report.threshold:.6f} accepted={report.accepted}"
        )
    elif args.command == "run-asset-loop":
        report = run_asset_loop(
            args.run,
            asset_id=args.asset_id,
            generation_model=args.generation_model,
            critique_model=args.critique_model,
            implementation_mode=ImplementationMode(args.implementation_mode),
            max_iterations=args.max_iterations,
            threshold=args.threshold,
            browser=args.browser,
            dry_run=args.dry_run,
        )
        if report is None:
            print("dry_run")
        else:
            print(
                f"score={report.score:.6f} threshold={report.threshold:.6f} "
                f"accepted={report.accepted}"
            )
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
