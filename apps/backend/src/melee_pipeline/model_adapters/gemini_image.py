from __future__ import annotations

from pathlib import Path


def edit_image(
    source_image: Path,
    prompt: str,
    output_path: Path,
    model: str,
    size: str,
    quality: str,
) -> None:
    raise NotImplementedError(
        "Gemini image extraction adapter is reserved but not implemented yet. "
        "Use an openai-image/* model for now."
    )
