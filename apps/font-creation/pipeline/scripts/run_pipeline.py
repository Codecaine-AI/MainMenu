"""Run the glyph-sheet pipeline inside a timestamped run directory."""

from __future__ import annotations

import argparse
from datetime import datetime
import json
from pathlib import Path
import shutil
import subprocess
import sys
from typing import Any


STEP_ORDER = ["segment", "upscale", "trace", "svgs", "preview"]
STEP_DIRS = {
    "segment": "01_segment",
    "upscale": "02_upscale",
    "trace": "03_trace",
    "svgs": "04_svgs",
    "preview": "05_preview",
}
INPUT_NAMES = {
    "image": "alphabet-sheet.jpeg",
    "description": "description.md",
    "glyph_map": "glyph-map.json",
    "style": "style.json",
    "prompt": "upscale-glyph.md",
}


def read_json(path: str | Path) -> Any:
    with Path(path).open("r", encoding="utf-8") as f:
        return json.load(f)


def write_json(path: str | Path, data: Any) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")


def run(cmd: list[str], cwd: Path) -> None:
    print("+ " + " ".join(cmd))
    subprocess.run(cmd, cwd=str(cwd), check=True)


def resolve_path(root: Path, value: str | Path) -> Path:
    path = Path(value)
    return path if path.is_absolute() else root / path


def rel(path: Path, base: Path) -> str:
    return str(path.relative_to(base))


def timestamp() -> str:
    return datetime.now().strftime("%Y%m%d-%H%M%S")


def default_spec(args: argparse.Namespace) -> dict[str, Any]:
    return {
        "name": Path(args.image).stem if args.image else "run",
        "image": args.image,
        "description": args.description,
        "glyph_map": args.glyph_map,
        "style": args.style,
        "prompt": args.prompt,
        "render_text": args.render_text if args.render_text is not None else "CODECAINE",
        "tracking": args.tracking,
        "upscale": {
            "enabled": not args.no_upscale,
            "image_model": args.image_model or "gemini-image/gemini-3.1-flash-image-preview",
            "image_size": args.image_size or "2K",
            "image_quality": args.image_quality or "high",
            "max_workers": args.max_workers if args.max_workers is not None else 4,
        },
    }


def load_spec(args: argparse.Namespace, root: Path) -> dict[str, Any]:
    if args.run_spec:
        spec = read_json(resolve_path(root, args.run_spec))
    else:
        if not args.image:
            raise SystemExit("--image is required when --run-spec or --run-dir is not provided.")
        spec = default_spec(args)

    if args.no_upscale:
        spec.setdefault("upscale", {})["enabled"] = False
    if args.image_model is not None:
        spec.setdefault("upscale", {})["image_model"] = args.image_model
    if args.image_size is not None:
        spec.setdefault("upscale", {})["image_size"] = args.image_size
    if args.image_quality is not None:
        spec.setdefault("upscale", {})["image_quality"] = args.image_quality
    if args.max_workers is not None:
        spec.setdefault("upscale", {})["max_workers"] = args.max_workers
    if args.render_text is not None:
        spec["render_text"] = args.render_text
    if args.tracking is not None:
        spec["tracking"] = args.tracking
    return spec


def create_run(args: argparse.Namespace, root: Path) -> tuple[Path, dict[str, Any]]:
    spec = load_spec(args, root)
    run_name = str(spec.get("name") or "run")
    out_root = resolve_path(root, args.out)
    run_dir = out_root / "runs" / run_name / timestamp()
    if run_dir.exists():
        raise SystemExit(f"Run directory already exists: {run_dir}")
    run_dir.mkdir(parents=True)

    inputs_dir = run_dir / "inputs"
    inputs_dir.mkdir()
    resolved = dict(spec)
    for key, filename in INPUT_NAMES.items():
        value = spec.get(key)
        if not value:
            raise SystemExit(f"Run spec is missing required field: {key}")
        source = resolve_path(root, value)
        destination = inputs_dir / filename
        shutil.copy2(source, destination)
        resolved[key] = rel(destination, run_dir)
        resolved[f"{key}_source"] = str(source)

    resolved.setdefault("upscale", {})
    resolved["upscale"].setdefault("enabled", True)
    resolved["upscale"].setdefault("image_model", "gemini-image/gemini-3.1-flash-image-preview")
    resolved["upscale"].setdefault("image_size", "2K")
    resolved["upscale"].setdefault("image_quality", "high")
    resolved["upscale"].setdefault("max_workers", 4)
    resolved.setdefault("render_text", "CODECAINE")
    resolved.setdefault("tracking", None)
    resolved["run_dir"] = str(run_dir)
    resolved["created_at"] = datetime.now().isoformat(timespec="seconds")

    write_json(run_dir / "run.json", resolved)
    write_json(run_dir / "status.json", initial_status())
    latest_path = out_root / "runs" / "latest.txt"
    latest_path.parent.mkdir(parents=True, exist_ok=True)
    latest_path.write_text(str(run_dir) + "\n", encoding="utf-8")
    return run_dir, resolved


def load_run(run_dir: str | Path, root: Path) -> tuple[Path, dict[str, Any]]:
    path = resolve_path(root, run_dir)
    if not path.exists():
        raise SystemExit(f"Run directory does not exist: {path}")
    return path, read_json(path / "run.json")


def initial_status() -> dict[str, Any]:
    return {
        "steps": {
            step: {"status": "pending", "started_at": None, "ended_at": None, "command": None, "error": None}
            for step in STEP_ORDER
        }
    }


def load_status(run_dir: Path) -> dict[str, Any]:
    path = run_dir / "status.json"
    if path.exists():
        status = read_json(path)
    else:
        status = initial_status()
    for step in STEP_ORDER:
        status.setdefault("steps", {}).setdefault(step, initial_status()["steps"][step])
    return status


def mark_step(run_dir: Path, step: str, state: str, command: list[str] | None = None, error: str | None = None) -> None:
    status = load_status(run_dir)
    record = status["steps"][step]
    now = datetime.now().isoformat(timespec="seconds")
    record["status"] = state
    if state == "running":
        record["started_at"] = now
        record["ended_at"] = None
        record["command"] = command
        record["error"] = None
    elif state in {"completed", "failed", "skipped"}:
        record["ended_at"] = now
        record["error"] = error
    write_json(run_dir / "status.json", status)


def selected_steps(from_step: str | None, through_step: str | None, upscale_enabled: bool, render_text: str | None) -> list[str]:
    start = STEP_ORDER.index(from_step) if from_step else 0
    end = STEP_ORDER.index(through_step) if through_step else len(STEP_ORDER) - 1
    if start > end:
        raise SystemExit("--from-step must be earlier than or equal to --through-step.")
    steps = STEP_ORDER[start : end + 1]
    if not upscale_enabled and "upscale" in steps:
        steps.remove("upscale")
    if not render_text and "preview" in steps:
        steps.remove("preview")
    return steps


def require_artifact(path: Path, step: str) -> None:
    if not path.exists():
        raise SystemExit(f"Cannot run {step}: required artifact is missing: {path}")


def run_step(step: str, cmd: list[str], cwd: Path, run_dir: Path) -> None:
    mark_step(run_dir, step, "running", command=cmd)
    try:
        run(cmd, cwd=cwd)
    except subprocess.CalledProcessError as exc:
        mark_step(run_dir, step, "failed", error=str(exc))
        raise
    mark_step(run_dir, step, "completed")


def run_pipeline(run_dir: Path, spec: dict[str, Any], args: argparse.Namespace, root: Path) -> None:
    upscale_cfg = spec.get("upscale", {})
    upscale_enabled = bool(upscale_cfg.get("enabled", True)) and not args.no_upscale
    render_text = spec.get("render_text")
    steps = selected_steps(args.from_step, args.through_step, upscale_enabled, render_text)

    image = run_dir / spec["image"]
    glyph_map = run_dir / spec["glyph_map"]
    style = run_dir / spec["style"]
    prompt = run_dir / spec["prompt"]
    description = run_dir / spec["description"]

    segment_dir = run_dir / STEP_DIRS["segment"]
    upscale_dir = run_dir / STEP_DIRS["upscale"]
    trace_dir = run_dir / STEP_DIRS["trace"]
    svg_dir = run_dir / STEP_DIRS["svgs"] / "glyphs"
    preview_dir = run_dir / STEP_DIRS["preview"] / "words"
    segments_path = segment_dir / "segments.json"
    paths_path = trace_dir / "paths" / "glyph_paths.json"

    if "segment" in steps:
        run_step("segment", [
            sys.executable, "scripts/01_segment_glyph_sheet.py",
            "--image", str(image),
            "--glyph-map", str(glyph_map),
            "--style", str(style),
            "--out", str(segment_dir),
            "--path-base", str(run_dir),
        ], root, run_dir)
    elif any(step in steps for step in ["upscale", "trace", "svgs", "preview"]):
        require_artifact(segments_path, "later steps")

    if "upscale" in steps:
        require_artifact(segments_path, "upscale")
        run_step("upscale", [
            sys.executable, "scripts/02_upscale_glyphs.py",
            "--segments", str(segments_path),
            "--out", str(upscale_dir),
            "--path-base", str(run_dir),
            "--prompt", str(prompt),
            "--description", str(description),
            "--image-model", str(upscale_cfg.get("image_model", "gemini-image/gemini-3.1-flash-image-preview")),
            "--image-size", str(upscale_cfg.get("image_size", "2K")),
            "--image-quality", str(upscale_cfg.get("image_quality", "high")),
            "--max-workers", str(upscale_cfg.get("max_workers", 4)),
            "--allow-failures",
        ], root, run_dir)
    elif not upscale_enabled:
        mark_step(run_dir, "upscale", "skipped", error="Upscale disabled for this run.")

    if "trace" in steps:
        require_artifact(segments_path, "trace")
        cmd = [
            sys.executable, "scripts/03_trace_fill_paths.py",
            "--segments", str(segments_path),
            "--style", str(style),
            "--out", str(trace_dir),
            "--path-base", str(run_dir),
        ]
        run_step("trace", cmd, root, run_dir)
    elif any(step in steps for step in ["svgs", "preview"]):
        require_artifact(paths_path, "later steps")

    if "svgs" in steps:
        require_artifact(paths_path, "svgs")
        run_step("svgs", [
            sys.executable, "scripts/04_build_layered_svgs.py",
            "--paths", str(paths_path),
            "--style", str(style),
            "--out", str(svg_dir),
        ], root, run_dir)

    if "preview" in steps:
        require_artifact(paths_path, "preview")
        word_out = preview_dir / f"{render_text}.svg"
        cmd = [
            sys.executable, "scripts/05_render_word_svg.py",
            "--text", str(render_text),
            "--paths", str(paths_path),
            "--style", str(style),
            "--out", str(word_out),
        ]
        if spec.get("tracking") is not None:
            cmd.extend(["--tracking", str(spec["tracking"])])
        run_step("preview", cmd, root, run_dir)

    print(f"Run directory: {run_dir}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run the glyph-sheet to layered-SVG pipeline.")
    parser.add_argument("--run-spec", default=None, help="Run spec JSON with inputs and settings.")
    parser.add_argument("--run-dir", default=None, help="Existing run directory to resume.")
    parser.add_argument("--from-step", choices=STEP_ORDER, default=None, help="First step to run.")
    parser.add_argument("--through-step", choices=STEP_ORDER, default=None, help="Last step to run.")
    parser.add_argument("--image", default=None, help="Input alphabet/glyph sheet image.")
    parser.add_argument("--glyph-map", default="config/glyph-map.json", help="Glyph map JSON.")
    parser.add_argument("--style", default="config/style.json", help="Style/config JSON.")
    parser.add_argument("--out", default="output", help="Output root directory.")
    parser.add_argument("--render-text", default=None, help="Optional word to render after building glyph SVGs.")
    parser.add_argument("--tracking", type=float, default=None, help="Tracking used for optional word render.")
    parser.add_argument("--no-upscale", action="store_true", help="Skip Gemini upscale and trace original crops.")
    parser.add_argument("--image-model", default=None, help="Gemini image model.")
    parser.add_argument("--image-size", default=None, help="Gemini output image size.")
    parser.add_argument("--image-quality", default=None, help="Gemini image quality hint.")
    parser.add_argument("--max-workers", type=int, default=None, help="Concurrent Gemini upscale requests.")
    parser.add_argument("--prompt", default="prompts/upscale-glyph.md", help="Upscale prompt template.")
    parser.add_argument("--description", default="inputs/melee-3/description.md", help="Style description markdown.")
    args = parser.parse_args()

    root = Path(__file__).resolve().parents[1]
    if args.run_dir:
        run_dir, spec = load_run(args.run_dir, root)
    else:
        run_dir, spec = create_run(args, root)
    run_pipeline(run_dir, spec, args, root)


if __name__ == "__main__":
    main()
