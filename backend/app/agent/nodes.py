import asyncio

from app.agent import prompts
from app.agent.context import emit, manager_var
from app.agent.contracts import AlexOut, BlueprintOut, PlanOut, QaOut
from app.agent.state import AgentState
from app.services.llm import complete, complete_model
from app.services.persistence import add_message, session_scope


async def mike_node(state: AgentState) -> dict:
    await emit("agent_start", {"role": "mike", "title": "正在拆解需求"})
    await asyncio.sleep(0.35)
    history = "\n".join(f"{m.get('role')}: {m.get('content')}" for m in state.get("conversation_history", [])[-8:])
    plan = await complete_model(
        prompts.MIKE,
        f"用户需求：{state['user_request']}\n模式：{state.get('mode', 'build')}\n历史：\n{history}",
        PlanOut,
    )
    md = "**执行计划**\n\n" + "\n".join(f"{i}. {step}" for i, step in enumerate(plan.plan, 1))
    md += f"\n\n变更级别：`{plan.change_level}`"
    if plan.dispatch:
        md += "\n指派：" + "、".join(plan.dispatch)
    await emit("agent_message", {"role": "mike", "content_md": md})
    with session_scope() as db:
        add_message(db, state["project_id"], "mike", md)

    skip_gate = state.get("mode") == "iterate" and plan.change_level == "minor"
    if not skip_gate:
        await emit(
            "plan_ready",
            {
                "plan": plan.plan,
                "change_level": plan.change_level,
                "dispatch": plan.dispatch,
            },
        )
        manager = manager_var.get(None)
        if manager is None:
            from app.services.task_manager import current_manager

            manager = current_manager()
        approved = await manager.wait_approval(state["project_id"])
        if not approved:
            from app.models import Project

            with session_scope() as db:
                project = db.get(Project, state["project_id"])
                if project:
                    project.status = "idle"
            await emit("error", {"message": "你取消了这次计划，团队已停下。", "recoverable": True})
            await emit("done", {"status": "cancelled", "stats": {"tokens": 0, "duration": 0}})
            return {"plan": plan.model_dump(), "change_level": plan.change_level, "error": "rejected"}
        await emit("agent_message", {"role": "mike", "content_md": "计划已批准，团队开始执行。"})
        with session_scope() as db:
            add_message(db, state["project_id"], "mike", "计划已批准，团队开始执行。")

    return {"plan": plan.model_dump(), "change_level": plan.change_level, "error": None}


async def emma_node(state: AgentState) -> dict:
    await emit("agent_start", {"role": "emma", "title": "撰写 PRD"})
    await asyncio.sleep(0.4)
    prd = await complete(prompts.EMMA, f"需求：{state['user_request']}\n计划：{state.get('plan')}")
    await emit("agent_message", {"role": "emma", "content_md": prd})
    with session_scope() as db:
        add_message(db, state["project_id"], "emma", prd)
    return {"prd": prd}


async def bob_node(state: AgentState) -> dict:
    await emit("agent_start", {"role": "bob", "title": "设计技术蓝图"})
    await asyncio.sleep(0.4)
    blueprint = await complete_model(
        prompts.BOB,
        f"PRD：\n{state.get('prd', '')}\n需求：{state['user_request']}",
        BlueprintOut,
    )
    md = f"```json\n{blueprint.model_dump_json(indent=2)}\n```"
    await emit("agent_message", {"role": "bob", "content_md": md})
    with session_scope() as db:
        add_message(db, state["project_id"], "bob", md)
    return {"blueprint": blueprint.model_dump()}


async def alex_node(state: AgentState) -> dict:
    title = "修复问题" if state.get("fix_round") else "开始编码"
    await emit("agent_start", {"role": "alex", "title": title})
    await asyncio.sleep(0.3)
    existing = state.get("files") or []
    names = [f.get("path") for f in existing]
    issues = state.get("qa_report", {}).get("issues", [])
    user = (
        f"需求：{state['user_request']}\nPRD：{state.get('prd', '')}\n"
        f"蓝图：{state.get('blueprint')}\n已有文件：{names}\n"
        f"需要修复：{issues}"
    )
    output = await complete_model(prompts.ALEX, user, AlexOut)
    merged = {f["path"]: f for f in existing}
    for file in output.files:
        merged[file.path] = {"path": file.path, "content": file.content}
        await emit(
            "file_write",
            {
                "path": file.path,
                "size": len(file.content),
                "action": "update" if file.path in names else "create",
                "content": file.content,
            },
        )
        await asyncio.sleep(0.35)
    files = list(merged.values())
    md = f"已写入 {len(output.files)} 个文件。"
    await emit("agent_message", {"role": "alex", "content_md": md})
    with session_scope() as db:
        add_message(db, state["project_id"], "alex", md)
    return {"files": files}


async def qa_node(state: AgentState) -> dict:
    await emit("agent_start", {"role": "qa", "title": "验证产出"})
    await asyncio.sleep(0.3)
    from app.runtime.whitelist import static_check

    static = static_check(state.get("files") or [], state.get("blueprint") or {})
    llm = await complete_model(
        prompts.QA,
        f"文件：{[f.get('path') for f in state.get('files', [])]}\n静态检查：{static}",
        QaOut,
    )
    issues = [i.model_dump() for i in llm.issues] + static.get("issues", [])
    blockers = [i for i in issues if i.get("severity") == "blocker"]
    report = {"passed": len(blockers) == 0, "issues": issues}
    await emit("validation", report)
    with session_scope() as db:
        add_message(db, state["project_id"], "qa", "验证通过" if report["passed"] else f"发现 {len(blockers)} 个 blocker")
    fix_round = state.get("fix_round", 0)
    if blockers:
        fix_round += 1
    return {"qa_report": report, "fix_round": fix_round}
