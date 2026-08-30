import asyncio

from app.agent.context import bus_var, manager_var, model_var, project_id_var
from app.agent.graph import build_agent_graph
from app.agent.state import AgentState
from app.config import get_settings
from app.services.event_bus import EventBus
from app.services import llm as llm_mod
from app.services.llm import LlmUsage


_CURRENT = None


def current_manager():
    if _CURRENT is None:
        raise RuntimeError("TaskManager is not initialized")
    return _CURRENT


class TaskManager:
    def __init__(self) -> None:
        settings = get_settings()
        self.semaphore = asyncio.Semaphore(settings.max_concurrent_tasks)
        self.tasks: dict[int, asyncio.Task] = {}
        self.event_bus = EventBus()
        self.graph = build_agent_graph()
        self.approvals: dict[int, asyncio.Future] = {}
        global _CURRENT
        _CURRENT = self

    def is_running(self, project_id: int) -> bool:
        task = self.tasks.get(project_id)
        return task is not None and not task.done()

    def spawn_generation(self, project_id: int, prompt: str, mode: str = "build", model: str = "") -> None:
        if self.is_running(project_id):
            return
        self.approvals.pop(project_id, None)
        self.event_bus.clear(project_id)
        self.tasks[project_id] = asyncio.create_task(self._run(project_id, prompt, mode, model))

    def resume_if_stale(self, project_id: int, model: str = "") -> bool:
        if self.is_running(project_id):
            return False
        from sqlalchemy import select

        from app.models import Message, Project
        from app.services.persistence import session_scope

        with session_scope() as db:
            project = db.get(Project, project_id)
            if project is None or project.status not in {"generating", "iterating"}:
                return False
            msgs = db.scalars(
                select(Message).where(Message.project_id == project_id).order_by(Message.id.asc())
            ).all()
            last_user = next((item.content for item in reversed(msgs) if item.role == "user"), None)
            if not last_user:
                project.status = "idle"
                return False
            mode = "iterate" if project.current_version > 0 or project.status == "iterating" else "build"
        self.spawn_generation(project_id, last_user, mode=mode, model=model)
        return True

    async def wait_approval(self, project_id: int, timeout: float = 600) -> bool:
        loop = asyncio.get_running_loop()
        existing = self.approvals.get(project_id)
        if existing is None:
            existing = loop.create_future()
            self.approvals[project_id] = existing
        try:
            return bool(await asyncio.wait_for(asyncio.shield(existing), timeout=timeout))
        except TimeoutError:
            return False

    def resolve_approval(self, project_id: int, approved: bool) -> bool:
        fut = self.approvals.get(project_id)
        if fut is None:
            try:
                loop = asyncio.get_running_loop()
            except RuntimeError:
                return False
            fut = loop.create_future()
            self.approvals[project_id] = fut
        if fut.done():
            return False

        def _set() -> None:
            if not fut.done():
                fut.set_result(approved)

        fut.get_loop().call_soon_threadsafe(_set)
        return True

    async def _run(self, project_id: int, prompt: str, mode: str, model: str = "") -> None:
        async with self.semaphore:
            project_id_var.set(project_id)
            bus_var.set(self.event_bus)
            manager_var.set(self)
            model_var.set(model)
            llm_mod.USAGE = LlmUsage()
            try:
                history = [{"role": "user", "content": prompt}]
                files: list[dict] = []
                if mode == "iterate":
                    from app.models import Message, Project, ProjectFile
                    from app.services.persistence import session_scope
                    from sqlalchemy import select

                    with session_scope() as db:
                        project = db.get(Project, project_id)
                        if project and project.current_version:
                            rows = db.scalars(
                                select(ProjectFile).where(
                                    ProjectFile.project_id == project_id,
                                    ProjectFile.version == project.current_version,
                                )
                            ).all()
                            files = [{"path": r.path, "content": r.content} for r in rows]
                        msgs = db.scalars(
                            select(Message).where(Message.project_id == project_id).order_by(Message.id.asc())
                        ).all()
                        history = [{"role": m.role, "content": m.content} for m in msgs][-12:]
                initial: AgentState = {
                    "project_id": project_id,
                    "user_request": prompt,
                    "conversation_history": history,
                    "plan": {},
                    "prd": "",
                    "blueprint": {},
                    "files": files,
                    "qa_report": {},
                    "change_level": "minor" if mode == "iterate" else "major",
                    "fix_round": 0,
                    "version": 0,
                    "error": None,
                    "tokens": 0,
                    "mode": mode,
                }
                await self.graph.ainvoke(initial)
            except asyncio.CancelledError:
                await self.event_bus.publish(
                    project_id, "error", {"message": "已取消", "recoverable": True}
                )
                raise
            except Exception as exc:  # noqa: BLE001
                from app.models import Project
                from app.services.persistence import session_scope

                with session_scope() as db:
                    project = db.get(Project, project_id)
                    if project:
                        project.status = "idle"
                await self.event_bus.publish(
                    project_id, "error", {"message": str(exc), "recoverable": False}
                )
            finally:
                self.approvals.pop(project_id, None)

    def stop(self, project_id: int) -> bool:
        fut = self.approvals.get(project_id)
        if fut is not None and not fut.done():
            self.resolve_approval(project_id, False)
            return True
        task = self.tasks.get(project_id)
        if task and not task.done():
            task.cancel()
            return True
        return False

    async def shutdown(self) -> None:
        for task in self.tasks.values():
            task.cancel()
        if self.tasks:
            await asyncio.gather(*self.tasks.values(), return_exceptions=True)
