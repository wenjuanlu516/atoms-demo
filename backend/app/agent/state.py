from typing import TypedDict


class AgentState(TypedDict):
    project_id: int
    user_request: str
    conversation_history: list[dict]
    plan: dict
    prd: str
    blueprint: dict
    files: list[dict]
    qa_report: dict
    change_level: str
    fix_round: int
    version: int
    error: str | None
    tokens: int
    mode: str
