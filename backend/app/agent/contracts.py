from pydantic import BaseModel, Field


class PlanOut(BaseModel):
    plan: list[str]
    change_level: str = "major"
    dispatch: list[str] = Field(default_factory=list)


class FileNode(BaseModel):
    path: str
    content: str


class FileTreeItem(BaseModel):
    path: str
    type: str = "source"


class BlueprintOut(BaseModel):
    stack: str
    file_tree: list[FileTreeItem]
    modules: dict[str, str] = Field(default_factory=dict)


class AlexOut(BaseModel):
    files: list[FileNode]
    done: bool = True


class QaIssue(BaseModel):
    file: str
    severity: str
    desc: str


class QaOut(BaseModel):
    passed: bool
    issues: list[QaIssue] = Field(default_factory=list)
