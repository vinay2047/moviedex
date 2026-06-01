"""Health check endpoint with ML model status reporting."""

from fastapi import APIRouter, Request

router = APIRouter(tags=["health"])


@router.get("/health")
async def health_check(request: Request) -> dict:
    """Application health check.

    Reports overall status and whether the ML recommendation models
    (Two-Tower retrieval and NeuMF ONNX ranker) are loaded and ready.
    """
    pipeline = getattr(request.app.state, "pipeline", None)
    models_status = {
        "retrieval": pipeline is not None and pipeline.retrieval_ready,
        "ranker": pipeline is not None and pipeline.ranker_ready,
    }

    return {
        "status": "ok",
        "version": "0.2.0",
        "models": models_status,
    }
