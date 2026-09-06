from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi.errors import RateLimitExceeded
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.api import api_router
from app.api.preview import router as preview_router
from app.config import get_settings
from app.models import init_db
from app.services.limiter import limiter, rate_limit_handler
from app.services.task_manager import TaskManager

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    app.state.tasks = TaskManager()
    yield
    await app.state.tasks.shutdown()


app = FastAPI(title="Atoms Demo", version="0.1.0", lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, rate_limit_handler)

if settings.app_env == "production":
    app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

if settings.app_env != "production":
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

app.include_router(api_router, prefix="/api")
app.include_router(preview_router)


def _spa_index() -> Path | None:
    index = settings.frontend_dist_path / "index.html"
    return index if index.exists() else None


dist = settings.frontend_dist_path
if dist.exists():
    assets = dist / "assets"
    if assets.exists():
        app.mount("/assets", StaticFiles(directory=assets), name="assets")

    @app.get("/{full_path:path}")
    def spa_fallback(full_path: str):
        candidate = dist / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        index = _spa_index()
        if index is None:
            return {"ok": True, "hint": "frontend dist not built yet"}
        return FileResponse(index, headers={"Cache-Control": "no-cache"})
