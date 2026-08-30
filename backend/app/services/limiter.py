from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings


def _enabled() -> bool:
    return get_settings().app_env == "production"


# Do not write X-RateLimit headers: limited routes return Pydantic models,
# and slowapi crashes with 500 if it tries to set headers on a non-Response.
limiter = Limiter(
    key_func=get_remote_address,
    enabled=_enabled(),
    headers_enabled=False,
    swallow_errors=True,
)


def generate_limit() -> str:
    return f"{get_settings().rate_limit_daily}/day"


def rate_limit_handler(_request: Request, _exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        {"detail": "今日生成次数已达上限，请明天再试。"},
        status_code=429,
    )
