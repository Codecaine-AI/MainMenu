from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path
from typing import TypeVar

from dotenv import load_dotenv
from mirascope import llm
from pydantic import BaseModel

T = TypeVar("T", bound=BaseModel)


def _build_content(prompt: str, source_images: Path | Sequence[Path]) -> list:
    image_paths = [source_images] if isinstance(source_images, Path) else list(source_images)
    return [prompt, *[llm.Image.from_file(image_path) for image_path in image_paths]]


def write_text_prompt(source_images: Path | Sequence[Path], prompt: str, model: str) -> str:
    load_dotenv()
    response = llm.use_model(model, max_tokens=4096).call(_build_content(prompt, source_images))
    return response.text().strip()


def structured_call(
    source_images: Path | Sequence[Path],
    prompt: str,
    model: str,
    response_model: type[T],
) -> T:
    load_dotenv()
    response = llm.use_model(model, max_tokens=4096).call(
        _build_content(prompt, source_images),
        format=llm.format(response_model, mode="json"),
    )
    return response.parse()
