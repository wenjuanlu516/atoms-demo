import json
from collections.abc import Iterator
from contextlib import contextmanager

from sqlalchemy.orm import Session

from app.models import Message, Project, ProjectFile, ProjectVersion, get_session_factory


@contextmanager
def session_scope() -> Iterator[Session]:
    session = get_session_factory()()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def add_message(db: Session, project_id: int, role: str, content: str, metadata: dict | None = None) -> None:
    db.add(
        Message(
            project_id=project_id,
            role=role,
            content=content,
            metadata_json=json.dumps(metadata) if metadata else None,
        )
    )


def write_files(db: Session, project_id: int, version: int, files: list[dict]) -> None:
    for file in files:
        content = file["content"]
        db.add(
            ProjectFile(
                project_id=project_id,
                version=version,
                path=file["path"],
                content=content,
                size=len(content.encode("utf-8")),
            )
        )


def save_version(db: Session, project: Project, files: list[dict], summary: str) -> int:
    version = project.current_version + 1
    project.current_version = version
    project.status = "idle"
    db.add(
        ProjectVersion(
            project_id=project.id,
            version=version,
            snapshot_json=json.dumps(files, ensure_ascii=False),
            summary=summary,
        )
    )
    write_files(db, project.id, version, files)
    return version
