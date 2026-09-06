import asyncio
import json
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session
from sse_starlette.sse import EventSourceResponse

from app.config import get_settings
from app.deps import get_task_manager
from app.models import Message, Project, ProjectFile, ProjectVersion, Publish, User, get_db
from pydantic import BaseModel

from app.schemas import ApproveBody, FileUpdate, MessageCreate, ProjectCreate, ProjectDetail, ProjectOut, VersionOut
from app.services.limiter import generate_limit, limiter
from app.services.security import decode_access_token, get_current_user
from app.services.task_manager import TaskManager

router = APIRouter(prefix="/projects", tags=["projects"])


def _chosen_model(raw: str | None) -> str:
    settings = get_settings()
    if raw and raw in settings.model_choices:
        return raw
    return settings.llm_model


def _owned_project(db: Session, user: User, project_id: int) -> Project:
    project = db.get(Project, project_id)
    if project is None or project.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Project not found")
    return project


def _user_from_token(db: Session, token: str) -> User:
    payload = decode_access_token(token)
    user = db.get(User, int(payload.get("sub", 0)))
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


@router.get("", response_model=list[ProjectOut])
def list_projects(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> list[Project]:
    rows = db.scalars(
        select(Project).where(Project.user_id == user.id).order_by(Project.updated_at.desc())
    ).all()
    return list(rows)


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
@limiter.shared_limit(generate_limit, scope="generate")
async def create_project(
    request: Request,
    body: ProjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tasks: TaskManager = Depends(get_task_manager),
) -> Project:
    title = (body.title or body.prompt.strip()[:32] or "Untitled").strip()
    project = Project(user_id=user.id, title=title, status="generating")
    db.add(project)
    db.flush()
    db.add(Message(project_id=project.id, role="user", content=body.prompt))
    db.commit()
    db.refresh(project)
    tasks.spawn_generation(project.id, body.prompt, model=_chosen_model(body.model))
    return project


@router.get("/{pid}", response_model=ProjectDetail)
def get_project(
    pid: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectDetail:
    project = _owned_project(db, user, pid)
    files = db.scalars(
        select(ProjectFile).where(
            ProjectFile.project_id == project.id,
            ProjectFile.version == project.current_version,
        )
    ).all()
    messages = db.scalars(
        select(Message).where(Message.project_id == project.id).order_by(Message.id.asc())
    ).all()
    return ProjectDetail(
        id=project.id,
        title=project.title,
        current_version=project.current_version,
        status=project.status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        files=[{"path": f.path, "size": f.size, "content": f.content} for f in files],
        messages=[
            {"id": m.id, "role": m.role, "content": m.content, "created_at": m.created_at.isoformat()}
            for m in messages
        ],
    )


@router.get("/{pid}/stream")
async def stream_project(
    pid: int,
    request: Request,
    last_event_id: int = Query(default=0),
    token: str | None = Query(default=None),
    tasks: TaskManager = Depends(get_task_manager),
) -> EventSourceResponse:
    header = request.headers.get("authorization", "")
    raw = token
    if header.lower().startswith("bearer "):
        raw = header.split(" ", 1)[1]
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    from app.services.persistence import session_scope

    with session_scope() as db:
        user = _user_from_token(db, raw)
        _owned_project(db, user, pid)
    tasks.resume_if_stale(pid)
    replay_from = last_event_id
    if last_event_id < 0:
        replay_from = tasks.event_bus.last_id(pid)
    header_last = request.headers.get("last-event-id")
    if header_last:
        replay_from = max(replay_from, int(header_last))

    async def event_gen() -> AsyncGenerator[dict, None]:
        queue = tasks.event_bus.subscribe(pid, replay_from)
        try:
            while True:
                if await request.is_disconnected():
                    break
                try:
                    event = await asyncio.wait_for(queue.get(), timeout=15)
                except asyncio.TimeoutError:
                    yield {"event": "ping", "data": "{}"}
                    continue
                yield {
                    "id": str(event["id"]),
                    "event": event["event"],
                    "data": json.dumps(event["data"], ensure_ascii=False),
                }
        finally:
            tasks.event_bus.unsubscribe(pid, queue)

    return EventSourceResponse(event_gen())


@router.post("/{pid}/messages", response_model=ProjectOut)
@limiter.shared_limit(generate_limit, scope="generate")
async def post_message(
    request: Request,
    pid: int,
    body: MessageCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tasks: TaskManager = Depends(get_task_manager),
) -> Project:
    project = _owned_project(db, user, pid)
    if tasks.is_running(pid):
        tasks.stop(pid)
        for _ in range(20):
            if not tasks.is_running(pid):
                break
            await asyncio.sleep(0.05)
    if tasks.is_running(pid):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Generation already running")
    db.add(Message(project_id=project.id, role="user", content=body.content))
    mode = "iterate" if project.current_version > 0 else "build"
    project.status = "iterating" if mode == "iterate" else "generating"
    db.commit()
    db.refresh(project)
    tasks.spawn_generation(project.id, body.content, mode=mode, model=_chosen_model(body.model))
    return project


@router.get("/{pid}/versions", response_model=list[VersionOut])
def list_versions(
    pid: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[VersionOut]:
    project = _owned_project(db, user, pid)
    rows = db.scalars(
        select(ProjectVersion)
        .where(ProjectVersion.project_id == project.id)
        .order_by(ProjectVersion.version.desc())
    ).all()
    return [VersionOut(version=r.version, summary=r.summary, created_at=r.created_at) for r in rows]


@router.get("/{pid}/versions/{version}/files")
def get_version_files(
    pid: int,
    version: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[dict]:
    project = _owned_project(db, user, pid)
    files = db.scalars(
        select(ProjectFile).where(ProjectFile.project_id == project.id, ProjectFile.version == version)
    ).all()
    if not files:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return [{"path": f.path, "content": f.content, "size": f.size} for f in files]


@router.put("/{pid}/files/{file_path:path}")
def update_file(
    pid: int,
    file_path: str,
    body: FileUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    project = _owned_project(db, user, pid)
    current = db.scalars(
        select(ProjectFile).where(
            ProjectFile.project_id == project.id,
            ProjectFile.version == project.current_version,
        )
    ).all()
    if not current:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No files to edit")
    files = [{"path": f.path, "content": f.content} for f in current]
    found = False
    for file in files:
        if file["path"] == file_path:
            file["content"] = body.content
            found = True
    if not found:
        files.append({"path": file_path, "content": body.content})
    from app.services.persistence import save_version

    version = save_version(db, project, files, f"manual edit {file_path}")
    db.commit()
    from app.runtime.assembler import assemble

    assemble(project.id, version, files, publish=False)
    return {"version": version, "path": file_path}


@router.post("/{pid}/stop")
def stop_project(
    pid: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tasks: TaskManager = Depends(get_task_manager),
) -> dict:
    project = _owned_project(db, user, pid)
    stopped = tasks.stop(pid)
    project.status = "idle"
    db.commit()
    return {"stopped": stopped}


@router.post("/{pid}/approve")
async def approve_project(
    pid: int,
    body: ApproveBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tasks: TaskManager = Depends(get_task_manager),
) -> dict:
    project = _owned_project(db, user, pid)
    if not tasks.is_running(pid):
        tasks.resume_if_stale(pid)
    if not tasks.is_running(pid):
        return {"ok": False, "approved": body.approved, "waiting": False}
    for _ in range(50):
        fut = tasks.approvals.get(pid)
        if fut is not None:
            break
        if not tasks.is_running(pid):
            return {"ok": False, "approved": body.approved, "waiting": False}
        await asyncio.sleep(0.05)
    resolved = tasks.resolve_approval(pid, body.approved)
    if not body.approved:
        project.status = "idle"
        db.commit()
    return {"ok": resolved, "approved": body.approved, "waiting": True}


class RollbackBody(BaseModel):
    version: int


class FixBody(BaseModel):
    message: str = ""
    source: str = ""
    model: str | None = None


@router.post("/{pid}/rollback")
def rollback_project(
    pid: int,
    body: RollbackBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    project = _owned_project(db, user, pid)
    files = db.scalars(
        select(ProjectFile).where(ProjectFile.project_id == project.id, ProjectFile.version == body.version)
    ).all()
    if not files:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    project.current_version = body.version
    db.commit()
    from app.runtime.assembler import assemble

    assemble(project.id, body.version, [{"path": f.path, "content": f.content} for f in files], publish=False)
    return {"version": body.version}


@router.post("/{pid}/fix")
@limiter.shared_limit(generate_limit, scope="generate")
async def fix_project(
    request: Request,
    pid: int,
    body: FixBody,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    tasks: TaskManager = Depends(get_task_manager),
) -> dict:
    project = _owned_project(db, user, pid)
    if tasks.is_running(pid):
        return {"accepted": False, "detail": "busy"}
    prompt = f"运行时错误修复：{body.message} @ {body.source}"
    db.add(Message(project_id=project.id, role="system", content=prompt))
    project.status = "iterating"
    db.commit()
    tasks.spawn_generation(project.id, prompt, mode="iterate", model=_chosen_model(body.model))
    return {"accepted": True}


@router.post("/{pid}/publish")
def publish_project(
    pid: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict:
    import secrets

    from app.runtime.assembler import assemble

    project = _owned_project(db, user, pid)
    if project.current_version < 1:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Nothing to publish")
    files = db.scalars(
        select(ProjectFile).where(
            ProjectFile.project_id == project.id,
            ProjectFile.version == project.current_version,
        )
    ).all()
    existing = db.scalar(select(Publish).where(Publish.project_id == pid))
    slug = existing.slug if existing else secrets.token_urlsafe(6)
    if existing:
        existing.version = project.current_version
    else:
        db.add(Publish(project_id=pid, slug=slug, version=project.current_version))
    project.status = "published"
    db.commit()
    dest = assemble(
        project.id,
        project.current_version,
        [{"path": f.path, "content": f.content} for f in files],
        publish=True,
    )
    publish_dir = dest.parent.parent / slug
    _copy_tree(dest, publish_dir)
    return {"slug": slug, "url": f"/p/{slug}/index.html"}


def _copy_tree(src, dest) -> None:
    import shutil

    shutil.copytree(src, dest, dirs_exist_ok=True)


@router.delete("/{pid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    pid: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    project = _owned_project(db, user, pid)
    db.query(Message).filter(Message.project_id == project.id).delete()
    db.query(ProjectFile).filter(ProjectFile.project_id == project.id).delete()
    db.query(ProjectVersion).filter(ProjectVersion.project_id == project.id).delete()
    db.query(Publish).filter(Publish.project_id == project.id).delete()
    db.delete(project)
    db.commit()
