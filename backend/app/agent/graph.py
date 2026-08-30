from typing import Literal

from langgraph.graph import END, START, StateGraph

from app.agent.context import emit
from app.agent.nodes import alex_node, bob_node, emma_node, mike_node, qa_node
from app.agent.state import AgentState
from app.config import get_settings
from app.models import Project
from app.runtime.assembler import assemble
from app.services.llm import USAGE
from app.services.persistence import save_version, session_scope


def route_after_mike(state: AgentState) -> Literal["emma", "alex", "end"]:
    if state.get("error"):
        return "end"
    if state.get("change_level") == "minor":
        return "alex"
    return "emma"


def route_after_qa(state: AgentState) -> Literal["alex", "finalize"]:
    settings = get_settings()
    report = state.get("qa_report") or {}
    blockers = [i for i in report.get("issues", []) if i.get("severity") == "blocker"]
    if blockers and state.get("fix_round", 0) <= settings.max_fix_rounds:
        return "alex"
    return "finalize"


async def finalize_node(state: AgentState) -> dict:
    files = state.get("files") or []
    summary = "generation complete"
    with session_scope() as db:
        project = db.get(Project, state["project_id"])
        if project is None:
            return {"error": "project missing"}
        version = save_version(db, project, files, summary)
    assemble(state["project_id"], version, files, publish=False)
    await emit("version", {"version": version, "summary": summary})
    status = "success" if (state.get("qa_report") or {}).get("passed") else "failed_with_best_effort"
    await emit("done", {"status": status, "stats": {"tokens": USAGE.tokens, "duration": USAGE.duration}})
    return {"version": version}


def build_agent_graph():
    graph = StateGraph(AgentState)
    graph.add_node("mike", mike_node)
    graph.add_node("emma", emma_node)
    graph.add_node("bob", bob_node)
    graph.add_node("alex", alex_node)
    graph.add_node("qa", qa_node)
    graph.add_node("finalize", finalize_node)
    graph.add_edge(START, "mike")
    graph.add_conditional_edges("mike", route_after_mike, {"emma": "emma", "alex": "alex", "end": END})
    graph.add_edge("emma", "bob")
    graph.add_edge("bob", "alex")
    graph.add_edge("alex", "qa")
    graph.add_conditional_edges("qa", route_after_qa, {"alex": "alex", "finalize": "finalize"})
    graph.add_edge("finalize", END)
    return graph.compile()
