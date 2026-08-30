from fastapi import APIRouter

from app.config import get_settings

router = APIRouter(tags=["health"])


@router.get("/health")
def health() -> dict:
    settings = get_settings()
    return {
        "ok": True,
        "service": "atoms-demo",
        "env": settings.app_env,
        "llm_mock": settings.llm_mock,
        "llm_model": settings.llm_model if not settings.llm_mock else "mock",
        "model_choices": settings.model_choices,
    }
