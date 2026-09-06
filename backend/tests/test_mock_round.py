from app.agent.mock_apps import pick_files
from app.agent.mock_llm import mock_complete


def _mike(user: str) -> dict:
    import json

    return json.loads(mock_complete("You are Mike, the planner.", user, json_mode=True))


def test_iterate_tweak_is_minor() -> None:
    plan = _mike("用户需求：加一个今日完成数\n模式：iterate\n历史：\nuser: 帮我做一个番茄钟")
    assert plan["change_level"] == "minor"


def test_history_new_app_words_do_not_force_major() -> None:
    plan = _mike("用户需求：把标题改大一点\n模式：iterate\n历史：\nuser: 帮我做一个番茄钟")
    assert plan["change_level"] == "minor"


def test_new_product_on_existing_project_is_major() -> None:
    plan = _mike("用户需求：制作一个洛带古镇的旅游攻略，包含景点和美食\n模式：iterate\n历史：\nuser: 番茄钟")
    assert plan["change_level"] == "major"
    assert "PRD" in plan["plan"]


def test_pick_files_uses_latest_request_not_history() -> None:
    files = pick_files("需求：制作一个洛带古镇的旅游攻略，包含景点和美食\n已有文件：['index.html']")
    html = next(item["content"] for item in files if item["path"] == "index.html")
    assert "洛带古镇" in html
    assert "25:00" not in html
    assert "Pomodoro" not in html


def test_pick_files_pomodoro_still_works() -> None:
    files = pick_files("需求：帮我做一个番茄钟工作法应用")
    html = next(item["content"] for item in files if item["path"] == "index.html")
    assert "番茄钟" in html
