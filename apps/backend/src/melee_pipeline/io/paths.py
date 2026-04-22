from __future__ import annotations

from pathlib import Path

from PIL import Image

from ..schemas import Canvas, RunManifest


def repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def backend_root() -> Path:
    return Path(__file__).resolve().parents[3]


def pipeline_root() -> Path:
    return backend_root() / "src" / "melee_pipeline" / "pipeline"


def default_runs_dir() -> Path:
    return repo_root() / "runs"


def pipeline_phase_root(name: str) -> Path:
    return pipeline_root() / name


def prompt_path(phase: str, name: str) -> Path:
    return pipeline_phase_root(phase) / "prompts" / name


def make_run_id(source_image: Path) -> str:
    return source_image.stem.lower().replace(" ", "-")


def normalize_source_image(source_image: Path, run_dir: Path) -> tuple[Path, Canvas]:
    run_dir.mkdir(parents=True, exist_ok=True)
    output = run_dir / "source.png"
    with Image.open(source_image) as image:
        normalized = image.convert("RGBA")
        normalized.save(output)
        width, height = normalized.size

    divisor = gcd(width, height)
    canvas = Canvas(width=width, height=height, aspect_ratio=f"{width // divisor}:{height // divisor}")
    return output, canvas


def init_run(source_image: Path, runs_dir: Path, run_id: str | None) -> Path:
    source_image = source_image.resolve()
    if not source_image.exists():
        raise FileNotFoundError(f"Source image does not exist: {source_image}")

    selected_run_id = run_id or make_run_id(source_image)
    run_dir = runs_dir.resolve() / selected_run_id
    source_png, canvas = normalize_source_image(source_image, run_dir)

    manifest = RunManifest(
        run_id=selected_run_id,
        source_image=str(source_png.relative_to(run_dir)),
        source_original=str(source_image),
        canvas=canvas,
    )
    (run_dir / "run.json").write_text(manifest.model_dump_json(indent=2) + "\n")
    (run_dir / "assets").mkdir(exist_ok=True)
    return run_dir


def gcd(a: int, b: int) -> int:
    while b:
        a, b = b, a % b
    return max(a, 1)
