from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from mirascope import llm


def write_text_prompt(source_image: Path, prompt: str, model: str) -> str:
    load_dotenv()
    response = llm.use_model(model, max_tokens=4096).call(
        [
            prompt,
            llm.Image.from_file(source_image),
        ]
    )
    return response.text().strip()
