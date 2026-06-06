from __future__ import annotations

import json
import re
from typing import Any, cast


def parse_json_object(text: str) -> dict[str, Any]:
    """Parse a JSON object from model output, tolerating ```json fences."""
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
