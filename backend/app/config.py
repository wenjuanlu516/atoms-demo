from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"

    llm_mock: bool = True
    llm_api_key: str = ""
    llm_model: str = "deepseek/deepseek-chat"
    llm_base_url: str = "https://api.deepseek.com/v1"
    llm_fallback_model: str = "qwen/qwen-2.5-coder-32b-instruct"
    llm_models: str = (
        "deepseek/deepseek-chat,openai/gpt-4o-mini,"
        "anthropic/claude-3-5-sonnet-latest,qwen/qwen-2.5-coder-32b-instruct"
    )

    jwt_secret: str = "change-me-in-production"
    jwt_expire_hours: int = 72
    database_url: str = "sqlite:///./atoms.db"
    data_dir: str = "./data"
    frontend_dist: str = ""

    rate_limit_daily: int = 5
    max_concurrent_tasks: int = 3
    max_fix_rounds: int = 2
    max_runtime_fix: int = 2
    max_file_size_kb: int = 200
    max_project_size_kb: int = 2048
    max_versions: int = 50
    max_files_per_project: int = 8

    cors_origins: str = "http://localhost:5173,http://localhost:5174,http://localhost:5176,http://127.0.0.1:5176"

    @property
    def model_choices(self) -> list[str]:
        items = [self.llm_model, self.llm_fallback_model, *self.llm_models.split(",")]
        seen: list[str] = []
        for item in items:
            name = item.strip()
            if name and name not in seen:
                seen.append(name)
        return seen

    @property
    def data_path(self) -> Path:
        path = Path(self.data_dir)
        if not path.is_absolute():
            path = BACKEND_DIR / path
        return path

    @property
    def frontend_dist_path(self) -> Path:
        if self.frontend_dist:
            return Path(self.frontend_dist)
        return REPO_ROOT / "frontend" / "dist"

    @property
    def preview_root(self) -> Path:
        return self.data_path / "preview"

    @property
    def publish_root(self) -> Path:
        return self.data_path / "publish"

    @property
    def cors_origin_list(self) -> list[str]:
        return [item.strip() for item in self.cors_origins.split(",") if item.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
