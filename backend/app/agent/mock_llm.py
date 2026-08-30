import json

from app.agent.mock_apps import pick_files, pick_stack


def _role(system: str) -> str:
    head = system[:80]
    if "Mike" in head:
        return "mike"
    if "Emma" in head:
        return "emma"
    if "Bob" in head:
        return "bob"
    if "Alex" in head:
        return "alex"
    if "QA" in head:
        return "qa"
    return "unknown"


def mock_complete(system: str, user: str, *, json_mode: bool = False) -> str:
    role = _role(system)
    if role == "mike":
        minor = "minor" in user.lower() or "小改" in user or "颜色" in user or "文案" in user
        return json.dumps(
            {
                "plan": ["编码", "验证"] if minor else ["PRD", "架构设计", "编码", "验证"],
                "change_level": "minor" if minor else "major",
                "dispatch": ["Alex", "QA"] if minor else ["Emma", "Bob", "Alex", "QA"],
            },
            ensure_ascii=False,
        )
    if role == "emma":
        return (
            "## 功能清单\n- 核心交互完整可用\n- 信息层级清晰\n- 支持基础增删或操作\n\n"
            "## 页面清单\n- 主页面\n\n"
            "## 交互说明\n- 用户一键开始，界面即时反馈，状态可见"
        )
    if role == "bob":
        files = pick_files(user)
        return json.dumps(
            {
                "stack": pick_stack(user),
                "file_tree": [
                    {"path": f["path"], "type": "entry" if f["path"].endswith(".html") else "source"}
                    for f in files
                ],
                "modules": {f["path"]: "generated module" for f in files},
            },
            ensure_ascii=False,
        )
    if role == "alex":
        return json.dumps({"files": pick_files(user), "done": True}, ensure_ascii=False)
    if role == "qa":
        return json.dumps({"passed": True, "issues": []})
    return "ok"
