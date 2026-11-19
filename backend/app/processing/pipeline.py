"""Pipeline stage registry and execution hooks.

Stages flow:
extracting -> segmenting -> ranking -> building -> done
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any

log = logging.getLogger("processing.pipeline")

STAGES: tuple[str, ...] = ("extracting", "segmenting", "ranking", "building")

STAGE_PERCENT: dict[str, float] = {
    "extracting": 25.0,
    "segmenting": 50.0,
    "ranking": 75.0,
    "building": 90.0,
    "done": 100.0,
}

# Optional custom stage handlers (for tests and step-by-step feature plug-in)
_STAGE_HANDLERS: dict[str, Callable[[Path, dict[str, Any]], None]] = {}


def register_stage_handler(stage: str, handler: Callable[[Path, dict[str, Any]], None]) -> None:
    _STAGE_HANDLERS[stage] = handler


def unregister_stage_handler(stage: str) -> None:
    _STAGE_HANDLERS.pop(stage, None)


def execute_stage(stage: str, session_dir: Path, meta: dict[str, Any]) -> None:
    """Execute a single pipeline stage.

    In Step 13, stubs are used if no custom handler is registered.
    In Steps 14-16, real stage logic will be plugged in.
    """
    fail_file = session_dir / "fail_stage.txt"
    if fail_file.is_file():
        target = fail_file.read_text(encoding="utf-8").strip()
        if target == stage:
            raise RuntimeError(f"Simulated pipeline failure at stage {stage}")

    if stage in _STAGE_HANDLERS:
        _STAGE_HANDLERS[stage](session_dir, meta)
        return

    # Default stub behavior for Step 13:
    log.debug("Executing stage stub for %s in %s", stage, session_dir.name)
