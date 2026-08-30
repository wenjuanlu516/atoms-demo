import asyncio

from app.models import Project
from app.services.event_bus import EventBus
from app.services.persistence import add_message, save_version, session_scope

MOCK_FILES = [
    {
        "path": "index.html",
        "content": """<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Focus</title>
    <link rel="stylesheet" href="./src/styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.js"></script>
  </body>
</html>
""",
    },
    {
        "path": "src/main.js",
        "content": """let left = 25 * 60;
let run = false;
let done = 0;
const time = document.createElement('div');
time.className = 'time';
const toggle = document.createElement('button');
toggle.textContent = '开始';
const stats = document.createElement('p');
stats.className = 'stats';
const root = document.getElementById('root');
root.innerHTML = '<h1>Focus</h1>';
root.append(stats, time, toggle);
const render = () => {
  const m = String(Math.floor(left / 60)).padStart(2, '0');
  const s = String(left % 60).padStart(2, '0');
  time.textContent = `${m}:${s}`;
  stats.textContent = `今日完成 ${done} 个番茄`;
};
setInterval(() => {
  if (!run) return;
  left -= 1;
  if (left <= 0) { left = 25 * 60; run = false; toggle.textContent = '开始'; done += 1; }
  render();
}, 1000);
toggle.onclick = () => { run = !run; toggle.textContent = run ? '暂停' : '开始'; };
render();
""",
    },
    {
        "path": "src/styles.css",
        "content": """body { margin: 0; font-family: system-ui, sans-serif; background: #11131a; color: #eef0f5; }
#root { max-width: 420px; margin: 48px auto; padding: 0 20px; }
.time { font-size: 72px; letter-spacing: 2px; margin: 16px 0; }
button { background: #7c6af7; color: #fff; border: 0; padding: 10px 18px; border-radius: 12px; cursor: pointer; }
.stats { color: #8b93a7; }
""",
    },
]


async def run_mock_pipeline(project_id: int, prompt: str, bus: EventBus) -> None:
    with session_scope() as db:
        project = db.get(Project, project_id)
        if project:
            project.status = "generating"

    async def emit(event: str, data: dict) -> None:
        await bus.publish(project_id, event, data)

    await emit("agent_start", {"role": "mike", "title": "正在拆解需求"})
    await asyncio.sleep(0.35)
    mike_md = (
        "**执行计划**\n\n1. Emma 产出 PRD\n2. Bob 给出技术蓝图\n3. Alex 逐文件编码\n4. QA 静态验证\n\n"
        f"需求摘要：{prompt[:80]}"
    )
    await emit("agent_message", {"role": "mike", "content_md": mike_md})
    with session_scope() as db:
        add_message(db, project_id, "mike", mike_md)

    await emit("agent_start", {"role": "emma", "title": "撰写 PRD"})
    await asyncio.sleep(0.4)
    emma_md = "## 功能清单\n- 核心交互\n- 清晰信息架构\n\n## 页面清单\n- 主页面\n\n## 交互说明\n- 一键开始，即时反馈"
    await emit("agent_message", {"role": "emma", "content_md": emma_md})
    with session_scope() as db:
        add_message(db, project_id, "emma", emma_md)

    await emit("agent_start", {"role": "bob", "title": "设计技术蓝图"})
    await asyncio.sleep(0.35)
    bob_md = '```json\n{"stack":"static","file_tree":["index.html","src/main.js","src/styles.css"]}\n```'
    await emit("agent_message", {"role": "bob", "content_md": bob_md})
    with session_scope() as db:
        add_message(db, project_id, "bob", bob_md)

    await emit("agent_start", {"role": "alex", "title": "开始编码"})
    written: list[dict] = []
    for file in MOCK_FILES:
        await asyncio.sleep(0.35)
        written.append(file)
        await emit(
            "file_write",
            {"path": file["path"], "size": len(file["content"]), "action": "create"},
        )
    alex_md = f"已写入 {len(written)} 个文件。"
    await emit("agent_message", {"role": "alex", "content_md": alex_md})
    with session_scope() as db:
        add_message(db, project_id, "alex", alex_md)

    await emit("validation", {"passed": True, "issues": []})
    with session_scope() as db:
        add_message(db, project_id, "qa", "静态检查通过，未发现 blocker。")
        project = db.get(Project, project_id)
        if project is None:
            return
        version = save_version(db, project, written, "mock generation")

    await emit("version", {"version": version, "summary": "mock generation"})
    await emit("done", {"status": "success", "stats": {"tokens": 0, "duration": 3}})
