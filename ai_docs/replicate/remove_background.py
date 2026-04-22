"""Background removal phase — uses Replicate's background-remover model."""

from __future__ import annotations

import io
import logging
import time

import replicate
from replicate.client import Client

log = logging.getLogger(__name__)

REMOVER_MODEL = "851-labs/background-remover:a029dff38972b5fda4ec5d75d7d1cd25aeff621d2cf4946a41055d7db66b80bc"


def run_remove_background(image_bytes: bytes, api_token: str) -> tuple[bytes, int]:
    """Remove background from an image via Replicate.

    Returns (result_bytes, duration_ms).
    """
    log.info(
        "remove_bg.start | model=%s  input=%d bytes", REMOVER_MODEL, len(image_bytes)
    )
    client = Client(api_token=api_token)
    started = time.perf_counter()

    output = client.run(
        REMOVER_MODEL,
        input={
            "image": io.BytesIO(image_bytes),
        },
    )

    duration_ms = int((time.perf_counter() - started) * 1000)

    # output is a FileOutput object — call .read() to get bytes
    result_bytes = output.read()
    log.info(
        "remove_bg.done | %dms  output=%d bytes",
        duration_ms,
        len(result_bytes),
    )
    return result_bytes, duration_ms
