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
        request = user.split("用户需求：", 1)[-1].split("\n模式", 1)[0] if "用户需求：" in user else user
        iterate = "模式：iterate" in user or "模式:iterate" in user
        rewrite = any(key in request for key in ("重做", "重新做", "换一个", "改成完全", "换成"))
        tweak = any(key in request for key in ("加一个", "加个", "增加", "改一下", "小改", "颜色", "文案", "删掉", "删除"))
        new_app = any(key in request for key in ("制作", "帮我做", "做一个", "做个", "开发一个", "写一个"))
        minor = (
            "minor" in request.lower()
            or (iterate and tweak and not rewrite)
            or (iterate and not rewrite and not new_app)
        )
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
