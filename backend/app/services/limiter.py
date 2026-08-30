from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from app.config import get_settings


def _enabled() -> bool:
    return get_settings().app_env == "production"


limiter = Limiter(key_func=get_remote_address, enabled=_enabled(), headers_enabled=True)


def generate_limit() -> str:
    return f"{get_settings().rate_limit_daily}/day"


def rate_limit_handler(_request: Request, _exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        {"detail": "今日生成次数已达上限，请明天再试。"},
        status_code=429,
    )
