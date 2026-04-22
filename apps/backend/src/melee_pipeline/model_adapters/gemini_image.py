from __future__ import annotations

import base64
from io import BytesIO
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types
from PIL import Image


SUPPORTED_IMAGE_SIZES = {"512", "1K", "2K", "4K"}
QUALITY_TO_IMAGE_SIZE = {
    "low": "512",
    "standard": "1K",
    "medium": "1K",
    "high": "2K",
    "hd": "2K",
    "ultra": "4K",
}


def client() -> genai.Client:
    load_dotenv()
    return genai.Client()


def edit_image(
    source_image: Path,
    prompt: str,
    output_path: Path,
    model: str,
    size: str,
    quality: str,
    aspect_ratio: str | None = None,
) -> None:
    image_size = _resolve_image_size(size=size, quality=quality)
    config_kwargs: dict[str, Any] = {"response_modalities": ["TEXT", "IMAGE"]}
    image_config_kwargs: dict[str, str] = {}
    api_client = client()
    if aspect_ratio:
        image_config_kwargs["aspect_ratio"] = aspect_ratio
    if image_size:
        image_config_kwargs["image_size"] = image_size
    if image_config_kwargs:
        config_kwargs["image_config"] = types.ImageConfig(**image_config_kwargs)

    with Image.open(source_image) as image:
        image.load()
        response = api_client.models.generate_content(
            model=model,
            contents=[prompt, image],
            config=types.GenerateContentConfig(**config_kwargs),
        )

    output_path.parent.mkdir(parents=True, exist_ok=True)
    for part in _response_parts(response):
        image = part.as_image() if hasattr(part, "as_image") else None
        if image is not None:
            image.save(output_path)
            return

        inline_data = getattr(part, "inline_data", None)
        if inline_data is None:
            inline_data = getattr(part, "inlineData", None)
        if inline_data is None:
            continue

        data = getattr(inline_data, "data", None)
        if data is None:
            continue
        if isinstance(data, str):
            data = base64.b64decode(data)
        _save_image_bytes(data, output_path)
        return

    text_parts = [
        getattr(part, "text", None)
        for part in _response_parts(response)
        if getattr(part, "text", None)
    ]
    detail = f" Text response: {' '.join(text_parts)}" if text_parts else ""
    raise RuntimeError(f"Gemini image response did not include an image part.{detail}")


def _resolve_image_size(size: str, quality: str) -> str:
    normalized_size = (size or "").strip().upper()
    if normalized_size and normalized_size not in {"AUTO", "DEFAULT"}:
        if normalized_size in SUPPORTED_IMAGE_SIZES:
            return normalized_size
        if "X" in normalized_size:
            return _image_size_from_dimensions(normalized_size)
        raise ValueError(
            "Gemini image size must be one of 512, 1K, 2K, 4K, auto, or dimensions "
            f"such as 1024x1024; got {size!r}."
        )

    normalized_quality = (quality or "").strip().lower()
    return QUALITY_TO_IMAGE_SIZE.get(normalized_quality, "2K")


def _image_size_from_dimensions(size: str) -> str:
    try:
        width_text, height_text = size.split("X", 1)
        largest = max(int(width_text), int(height_text))
    except ValueError as exc:
        raise ValueError(f"Invalid image dimensions for Gemini image size: {size!r}") from exc

    if largest <= 512:
        return "512"
    if largest <= 1024:
        return "1K"
    if largest <= 2048:
        return "2K"
    return "4K"


def _save_image_bytes(data: bytes, output_path: Path) -> None:
    try:
        with Image.open(BytesIO(data)) as image:
            image.save(output_path)
    except OSError:
        output_path.write_bytes(data)


def _response_parts(response: Any) -> list[Any]:
    parts = getattr(response, "parts", None)
    if parts is not None:
        return list(parts)

    candidates = getattr(response, "candidates", None) or []
    collected: list[Any] = []
    for candidate in candidates:
        content = getattr(candidate, "content", None)
        if content is None:
            continue
        collected.extend(getattr(content, "parts", None) or [])
    return collected
