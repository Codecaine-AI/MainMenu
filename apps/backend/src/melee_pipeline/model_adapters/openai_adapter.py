from __future__ import annotations

import base64
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI


def client() -> OpenAI:
    load_dotenv()
    return OpenAI()


def edit_image(
    source_image: Path,
    prompt: str,
    output_path: Path,
    model: str,
    size: str,
    quality: str,
) -> Path:
    kwargs: dict[str, object] = {
        "model": model,
        "image": source_image.open("rb"),
        "prompt": prompt,
    }
    if size:
        kwargs["size"] = size
    if quality:
        kwargs["quality"] = quality

    try:
        result = client().images.edit(**kwargs)
    finally:
        image_file = kwargs.get("image")
        if image_file is not None:
            image_file.close()

    output_path.parent.mkdir(parents=True, exist_ok=True)
    image_base64 = result.data[0].b64_json
    output_path.write_bytes(base64.b64decode(image_base64))
    return output_path
