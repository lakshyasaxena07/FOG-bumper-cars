"""Background AI processing and job queue package."""

from backend.app.processing.extraction import (
    DETECTIONS_COLUMNS,
    DetectionBox,
    Detector,
    DummyDetector,
    YOLODetector,
    extract_camera_video,
    extract_session_detections,
)
from backend.app.processing.pipeline import (
    STAGE_PERCENT,
    STAGES,
    execute_stage,
    register_stage_handler,
    set_detector_factory,
    unregister_stage_handler,
)
from backend.app.processing.service import ProcessingService, SpawnFn
from backend.app.processing.worker import run_job

__all__ = [
    "DETECTIONS_COLUMNS",
    "DetectionBox",
    "Detector",
    "DummyDetector",
    "ProcessingService",
    "STAGE_PERCENT",
    "STAGES",
    "SpawnFn",
    "YOLODetector",
    "execute_stage",
    "extract_camera_video",
    "extract_session_detections",
    "register_stage_handler",
    "run_job",
    "set_detector_factory",
    "unregister_stage_handler",
]
