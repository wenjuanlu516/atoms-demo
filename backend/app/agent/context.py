from contextvars import ContextVar
from typing import TYPE_CHECKING

from app.services.event_bus import EventBus

if TYPE_CHECKING:
    from app.services.task_manager import TaskManager

project_id_var: ContextVar[int] = ContextVar("project_id")
bus_var: ContextVar[EventBus] = ContextVar("bus")
manager_var: ContextVar["TaskManager"] = ContextVar("manager")
model_var: ContextVar[str] = ContextVar("model", default="")


async def emit(event: str, data: dict) -> None:
    await bus_var.get().publish(project_id_var.get(), event, data)
