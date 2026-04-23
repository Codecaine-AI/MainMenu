from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

from dotenv import load_dotenv
from mirascope import llm


def write_text_prompt(source_images: Path | Sequence[Path], prompt: str, model: str) -> str:
    load_dotenv()
    image_paths = [source_images] if isinstance(source_images, Path) else list(source_images)
    response = llm.use_model(model, max_tokens=4096).call(
        [
            prompt,
            *[llm.Image.from_file(image_path) for image_path in image_paths],
        ]
    )
    return response.text().strip()
