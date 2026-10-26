"""Load API keys for the model adapters.

Order: the repo .env first (found by walking up from this package), then the
shared workspace file (~/workspace/.env, or the path in WORKSPACE_ENV_FILE).
Neither file overrides a variable that is already set, so real environment
variables win, then the repo .env, then the workspace file. A missing
workspace file is skipped.
"""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import find_dotenv, load_dotenv


def workspace_env_file() -> Path:
    override = os.environ.get("WORKSPACE_ENV_FILE")
    if override:
        return Path(override).expanduser()
    return Path.home() / "workspace" / ".env"


def load_env() -> None:
    load_dotenv(find_dotenv(), override=False)
    workspace_env = workspace_env_file()
    if workspace_env.is_file():
        load_dotenv(workspace_env, override=False)
