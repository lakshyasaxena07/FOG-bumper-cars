"""Background AI processing and job queue package."""

from backend.app.processing.pipeline import (
    STAGE_PERCENT,
    STAGES,
    execute_stage,
    register_stage_handler,
    unregister_stage_handler,
)
from backend.app.processing.service import ProcessingService, SpawnFn
from backend.app.processing.worker import run_job

__all__ = [
    "STAGE_PERCENT",
    "STAGES",
    "ProcessingService",
    "SpawnFn",
    "execute_stage",
    "register_stage_handler",
    "run_job",
    "unregister_stage_handler",
]
