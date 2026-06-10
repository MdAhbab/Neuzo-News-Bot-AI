"""
Central configuration for Neuzo.

Loads backend/config.yaml once and applies environment variable overrides so
secrets (database password, API keys) never need to live in the YAML file.
"""

import logging
import os
import threading
from pathlib import Path
from typing import Any, Dict, Optional

import yaml

logger = logging.getLogger(__name__)

# Anchor all paths to the backend directory so the server works regardless of
# the current working directory it was launched from.
BASE_DIR = Path(__file__).resolve().parent
CONFIG_PATH = BASE_DIR / "config.yaml"

# Load backend/.env into the process environment if python-dotenv is available
try:
    from dotenv import load_dotenv
    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass

_lock = threading.Lock()
_config: Optional[Dict[str, Any]] = None

# (config section, key, environment variable, cast)
_ENV_OVERRIDES = [
    ("database", "host", "DATABASE_HOST", str),
    ("database", "port", "DATABASE_PORT", int),
    ("database", "database", "DATABASE_NAME", str),
    ("database", "user", "DATABASE_USER", str),
    ("database", "password", "DATABASE_PASSWORD", str),
    ("news_api", "api_key", "NEWSAPI_KEY", str),
    ("ollama", "host", "OLLAMA_HOST", str),
    ("ollama", "model", "OLLAMA_MODEL", str),
    ("news_pipeline", "provider", "NEWS_PROVIDER", str),
]


def load_config(force_reload: bool = False) -> Dict[str, Any]:
    """Load and cache the application configuration."""
    global _config
    with _lock:
        if _config is None or force_reload:
            try:
                with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                    cfg = yaml.safe_load(f) or {}
            except FileNotFoundError:
                logger.warning("config.yaml not found at %s, using defaults", CONFIG_PATH)
                cfg = {}

            for section, key, env_var, cast in _ENV_OVERRIDES:
                value = os.getenv(env_var)
                if value:
                    try:
                        cfg.setdefault(section, {})[key] = cast(value)
                    except (TypeError, ValueError):
                        logger.warning("Ignoring invalid value for %s", env_var)

            _config = cfg
        return _config


def get_output_dir() -> Path:
    """Resolve the report output directory (relative paths anchor to backend/)."""
    cfg = load_config()
    configured = cfg.get("document", {}).get("output_dir", "output")
    path = Path(configured)
    if not path.is_absolute():
        path = BASE_DIR / path
    path.mkdir(parents=True, exist_ok=True)
    return path
