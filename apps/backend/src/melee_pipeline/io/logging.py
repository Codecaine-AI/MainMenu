from __future__ import annotations

import json
import threading
import time
from collections.abc import Iterator
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SENSITIVE_KEY_PARTS = ("api_key", "apikey", "token", "secret", "password")
NOISY_KEYS = {"prompt", "prompt_text", "prompt_body", "extraction_prompt"}


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class RunLogger:
    """Write live and durable progress logs for a pipeline run."""

    def __init__(self, run_dir: Path, echo: bool = True) -> None:
        self.run_dir = run_dir.resolve()
        self.run_dir.mkdir(parents=True, exist_ok=True)
        self.echo = echo
        self.events_path = self.run_dir / "events.jsonl"
        self.log_path = self.run_dir / "run.log"
        self.status_path = self.run_dir / "status.json"
        self._lock = threading.Lock()

    def event(
        self,
        event: str,
        stage: str,
        message: str,
        *,
        level: str = "info",
        asset_id: str | None = None,
        **fields: Any,
    ) -> None:
        record: dict[str, Any] = {
            "ts": utc_now_iso(),
            "level": level,
            "stage": stage,
            "event": event,
            "message": message,
        }
        if asset_id is not None:
            record["asset_id"] = asset_id
        record.update({key: self._clean_value(key, value) for key, value in fields.items()})

        line = json.dumps(record, ensure_ascii=True, default=str)
        text_line = self._format_text_line(record)
        with self._lock:
            with self.events_path.open("a", encoding="utf-8") as file:
                file.write(line + "\n")
            with self.log_path.open("a", encoding="utf-8") as file:
                file.write(text_line + "\n")
            if self.echo:
                print(text_line, flush=True)

    def update_status(
        self,
        *,
        stage: str | None = None,
        status: str | None = None,
        active_asset_ids: list[str] | None = None,
        counts: dict[str, int] | None = None,
        last_error: str | None = None,
        **fields: Any,
    ) -> None:
        existing: dict[str, Any] = {}
        if self.status_path.exists():
            try:
                existing = json.loads(self.status_path.read_text(encoding="utf-8"))
            except json.JSONDecodeError:
                existing = {}

        existing["updated_at"] = utc_now_iso()
        if stage is not None:
            existing["stage"] = stage
        if status is not None:
            existing["status"] = status
        if active_asset_ids is not None:
            existing["active_asset_ids"] = active_asset_ids
        if counts is not None:
            existing["counts"] = counts
        if last_error is not None:
            existing["last_error"] = last_error
        elif status in {"running", "completed", "dry_run"}:
            existing.pop("last_error", None)
        for key, value in fields.items():
            existing[key] = self._clean_value(key, value)

        tmp_path = self.status_path.with_suffix(".json.tmp")
        with self._lock:
            tmp_path.write_text(json.dumps(existing, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
            tmp_path.replace(self.status_path)

    @contextmanager
    def span(
        self,
        event_prefix: str,
        stage: str,
        message: str,
        *,
        asset_id: str | None = None,
        **fields: Any,
    ) -> Iterator[None]:
        start = time.perf_counter()
        self.event(
            f"{event_prefix}.started",
            stage,
            message,
            asset_id=asset_id,
            **fields,
        )
        try:
            yield
        except Exception as exc:
            duration_ms = int((time.perf_counter() - start) * 1000)
            self.event(
                f"{event_prefix}.failed",
                stage,
                f"{message} failed",
                level="error",
                asset_id=asset_id,
                duration_ms=duration_ms,
                error=str(exc),
                **fields,
            )
            raise
        duration_ms = int((time.perf_counter() - start) * 1000)
        self.event(
            f"{event_prefix}.completed",
            stage,
            f"{message} completed",
            asset_id=asset_id,
            duration_ms=duration_ms,
            **fields,
        )

    def _format_text_line(self, record: dict[str, Any]) -> str:
        base = (
            f"{record['ts']} [{record['level']}] [{record['stage']}] "
            f"{record['event']}: {record['message']}"
        )
        details = []
        for key, value in record.items():
            if key in {"ts", "level", "stage", "event", "message"}:
                continue
            details.append(f"{key}={value}")
        return f"{base} {' '.join(details)}" if details else base

    def _clean_value(self, key: str, value: Any) -> Any:
        lowered = key.lower()
        if any(part in lowered for part in SENSITIVE_KEY_PARTS):
            return "[redacted]"
        if lowered in NOISY_KEYS:
            if isinstance(value, str):
                return f"[omitted {len(value)} chars]"
        if isinstance(value, Path):
            return str(value)
        return value
