from __future__ import annotations

import json
import re
import runpy
from collections.abc import Callable
from pathlib import Path
from typing import Any, cast


def render_prompt(path: Path, **kwargs: Any) -> str:
    builder = load_prompt_builder(path)
    prompt = builder(**kwargs)
    if not isinstance(prompt, str):
        raise TypeError(f"Prompt builder at {path} must return a string")
    return prompt.strip() + "\n"


def load_prompt_builder(path: Path, builder_name: str = "build_prompt") -> Callable[..., str]:
    namespace = runpy.run_path(str(path))
    builder = namespace.get(builder_name)
    if not callable(builder):
        raise ValueError(f"Prompt file {path} must define a callable `{builder_name}`")
    return cast(Callable[..., str], builder)


def parse_json_object(text: str) -> dict[str, Any]:
    stripped = text.strip()
    if stripped.startswith("```"):
        stripped = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", stripped)

    try:
        return cast(dict[str, Any], json.loads(stripped))
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", stripped, re.DOTALL)
        if not match:
            raise
        return cast(dict[str, Any], json.loads(match.group(0)))
