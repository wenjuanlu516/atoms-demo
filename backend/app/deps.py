from fastapi import Request

from app.services.task_manager import TaskManager


def get_task_manager(request: Request) -> TaskManager:
    return request.app.state.tasks
