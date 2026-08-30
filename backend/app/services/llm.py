import json
import re
import time
from typing import Any

from pydantic import BaseModel, ValidationError

from app.config import get_settings


class LlmUsage:
    def __init__(self) -> None:
        self.tokens = 0
        self.calls = 0
        self.started = time.monotonic()

    @property
    def duration(self) -> int:
        return int(time.monotonic() - self.started)


USAGE = LlmUsage()


def extract_json(text: str) -> str:
    text = text.strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fenced:
        return fenced.group(1).strip()
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return text[start : end + 1]
    return text


async def complete(system: str, user: str, *, json_mode: bool = False) -> str:
    from app.agent.context import model_var

    settings = get_settings()
    USAGE.calls += 1
    if settings.llm_mock:
        from app.agent.mock_llm import mock_complete

        text = mock_complete(system, user, json_mode=json_mode)
        USAGE.tokens += max(1, len(system + user + text) // 4)
        return text

    import litellm

    chosen = model_var.get() or settings.llm_model
    kwargs: dict[str, Any] = {
        "model": chosen,
        "api_key": settings.llm_api_key,
        "api_base": settings.llm_base_url or None,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}
    try:
        response = await litellm.acompletion(**kwargs)
    except Exception:
        if settings.llm_fallback_model:
            kwargs["model"] = settings.llm_fallback_model
            response = await litellm.acompletion(**kwargs)
        else:
            raise
    text = response.choices[0].message.content or ""
    usage = getattr(response, "usage", None)
    if usage:
        USAGE.tokens += int(getattr(usage, "total_tokens", 0) or 0)
    else:
        USAGE.tokens += max(1, len(text) // 4)
    return text


async def complete_model(system: str, user: str, model: type[BaseModel]) -> BaseModel:
    last_error = ""
    prompt = user
    for _ in range(3):
        raw = await complete(system, prompt, json_mode=True)
        try:
            return model.model_validate_json(extract_json(raw))
        except ValidationError as exc:
            last_error = str(exc)
            prompt = f"{user}\n\n上次 JSON 校验失败，请只重写非法字段：\n{last_error}"
    raise ValueError(f"LLM JSON validation failed: {last_error}")


def parse_json_object(text: str) -> dict:
    return json.loads(extract_json(text))
