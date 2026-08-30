from datetime import datetime

from pydantic import BaseModel, Field


class AuthRequest(BaseModel):
    username: str = Field(min_length=3, max_length=32, pattern=r"^[a-zA-Z0-9_]+$")
    password: str = Field(min_length=6, max_length=72)


class UserOut(BaseModel):
    id: int
    username: str
    created_at: datetime

    model_config = {"from_attributes": True}


class AuthResponse(BaseModel):
    token: str
    user: UserOut


class ProjectCreate(BaseModel):
    prompt: str = Field(min_length=1, max_length=4000)
    title: str | None = Field(default=None, max_length=200)
    model: str | None = Field(default=None, max_length=120)


class ProjectOut(BaseModel):
    id: int
    title: str
    current_version: int
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ProjectDetail(ProjectOut):
    files: list[dict] = []
    messages: list[dict] = []


class MessageCreate(BaseModel):
    content: str = Field(min_length=1, max_length=4000)
    model: str | None = Field(default=None, max_length=120)


class ApproveBody(BaseModel):
    approved: bool


class FileUpdate(BaseModel):
    content: str = Field(max_length=200_000)


class VersionOut(BaseModel):
    version: int
    summary: str | None
    created_at: datetime
