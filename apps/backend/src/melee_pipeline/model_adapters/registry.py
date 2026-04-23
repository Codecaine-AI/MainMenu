from __future__ import annotations

from collections.abc import Sequence
from pathlib import Path

from ..io.prompt_loader import parse_json_object
from ..schemas import AssetCatalog
from . import mirascope_text
from . import openai_adapter


def split_model(model: str, default_provider: str) -> tuple[str, str]:
    if "/" not in model:
        return default_provider, model
    provider, model_name = model.split("/", 1)
    return provider, model_name


def normalize_model(model: str, default_provider: str) -> str:
    provider, model_name = split_model(model, default_provider=default_provider)
    return f"{provider}/{model_name}"


def write_text_prompt(source_images: Path | Sequence[Path], prompt: str, model: str) -> str:
    provider, _ = split_model(model, default_provider="openai")
    if provider in {"anthropic", "google", "openai"}:
        return mirascope_text.write_text_prompt(
            source_images, prompt, normalize_model(model, default_provider="openai")
        )
    raise ValueError(f"Unsupported Mirascope text model provider: {provider}")


def catalog_image(source_image: Path, prompt: str, model: str) -> AssetCatalog:
    text = write_text_prompt(source_image, prompt, model)
    return AssetCatalog.model_validate(parse_json_object(text))


def edit_image(
    source_image: Path,
    prompt: str,
    output_path: Path,
    model: str,
    size: str,
    quality: str,
    aspect_ratio: str | None = None,
) -> Path:
    provider, model_name = split_model(model, default_provider="openai-image")
    if provider in {"openai", "openai-image"}:
        return openai_adapter.edit_image(source_image, prompt, output_path, model_name, size, quality)
    if provider == "gemini-image":
        from .gemini_image import edit_image as edit_gemini_image

        return edit_gemini_image(
            source_image, prompt, output_path, model_name, size, quality, aspect_ratio
        )
    raise ValueError(f"Unsupported image model provider: {provider}")
