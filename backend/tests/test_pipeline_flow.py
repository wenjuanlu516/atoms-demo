"""API happy-path: create → plan → accept → files/preview → iterate → publish → stop-idle."""

from __future__ import annotations

import json
import time
import uuid

import httpx
import pytest


def _sse_events(response: httpx.Response, until: set[str], timeout: float = 40) -> list[dict]:
    found: list[dict] = []
    deadline = time.monotonic() + timeout
    event = "message"
    data = ""
    for line in response.iter_lines():
        if time.monotonic() > deadline:
            break
        if line.startswith("event:"):
            event = line.split(":", 1)[1].strip()
        elif line.startswith("data:"):
            data = line.split(":", 1)[1].strip()
        elif line == "":
            if event in until and data:
                payload = json.loads(data) if data.startswith("{") else {"raw": data}
                found.append({"event": event, "data": payload})
                if event in until and (
                    event != "plan_ready" or True
                ):
                    if {item["event"] for item in found} & until and event in until:
                        if event == "done" or event == "plan_ready" or event == "error":
                            break
            event = "message"
            data = ""
    return found


def _wait_sse(client: httpx.Client, path: str, headers: dict, until: str, timeout: float = 40) -> list[dict]:
    with client.stream("GET", path, headers=headers, timeout=timeout) as response:
        response.raise_for_status()
        return _sse_events(response, {until, "error", "done"}, timeout=timeout)


@pytest.mark.skipif(
    not pytest.importorskip("httpx", reason="httpx required"),
    reason="httpx required",
)
def test_pipeline_against_running_api():
    base = "http://127.0.0.1:8000"
    user = f"flow_{uuid.uuid4().hex[:10]}"
    password = "secret12"
    try:
        health = httpx.get(f"{base}/api/health", timeout=2)
        health.raise_for_status()
    except httpx.HTTPError as exc:
        pytest.skip(f"API not running: {exc}")

    body = health.json()
    if body.get("llm_mock") is not True:
        pytest.skip("need LLM_MOCK=true for the closed-loop check")

    with httpx.Client(base_url=base, timeout=30) as client:
        reg = client.post("/api/auth/register", json={"username": user, "password": password})
        assert reg.status_code in {200, 201}, reg.text
        token = reg.json()["token"]
        auth = {"Authorization": f"Bearer {token}"}

        created = client.post(
            "/api/projects",
            headers=auth,
            json={"prompt": "帮我做一个番茄钟工作法应用，要有任务列表和统计。", "title": "番茄钟工作法"},
        )
        assert created.status_code == 201, created.text
        pid = created.json()["id"]

        stream_headers = {**auth, "Accept": "text/event-stream"}
        events = _wait_sse(client, f"/api/projects/{pid}/stream", stream_headers, "plan_ready")
        kinds = {item["event"] for item in events}
        assert "error" not in kinds or "plan_ready" in kinds, events
        assert "plan_ready" in kinds, events

        approve = client.post(f"/api/projects/{pid}/approve", headers=auth, json={"approved": True})
        assert approve.status_code == 200, approve.text

        events = _wait_sse(client, f"/api/projects/{pid}/stream?last_event_id=0", stream_headers, "done")
        kinds = {item["event"] for item in events}
        assert "done" in kinds, events
        assert "error" not in kinds, events

        detail = client.get(f"/api/projects/{pid}", headers=auth)
        assert detail.status_code == 200
        payload = detail.json()
        assert payload["current_version"] >= 1
        assert payload["status"] in {"idle", "published"}
        paths = {item["path"] for item in payload["files"]}
        assert "index.html" in paths
        roles = {item["role"] for item in payload["messages"]}
        assert {"user", "mike", "emma", "bob", "alex", "qa"} <= roles

        preview = client.get(f"/preview/{pid}/v{payload['current_version']}/index.html")
        assert preview.status_code == 200
        html = preview.text
        assert "<form" in html
        assert "Unexpected token" not in html
        assert "text/babel" not in html

        iterate = client.post(
            f"/api/projects/{pid}/messages",
            headers=auth,
            json={"content": "加一个今日完成数"},
        )
        assert iterate.status_code == 200, iterate.text

        events = _wait_sse(client, f"/api/projects/{pid}/stream", stream_headers, "done", timeout=40)
        kinds = {item["event"] for item in events}
        # minor iterate skips the plan gate
        if "plan_ready" in kinds:
            client.post(f"/api/projects/{pid}/approve", headers=auth, json={"approved": True})
            events = _wait_sse(client, f"/api/projects/{pid}/stream?last_event_id=0", stream_headers, "done")
            kinds = {item["event"] for item in events}
        assert "done" in kinds, events

        published = client.post(f"/api/projects/{pid}/publish", headers=auth)
        assert published.status_code == 200, published.text
        slug = published.json()["slug"]
        page = client.get(f"/p/{slug}/index.html")
        assert page.status_code == 200
        assert "<form" in page.text

        other = client.post(
            "/api/projects",
            headers=auth,
            json={"prompt": "帮我做一个精品咖啡品牌落地页", "title": "咖啡"},
        )
        assert other.status_code == 201
        other_id = other.json()["id"]
        _wait_sse(client, f"/api/projects/{other_id}/stream", stream_headers, "plan_ready")
        stopped = client.post(f"/api/projects/{other_id}/stop", headers=auth)
        assert stopped.status_code == 200
        time.sleep(0.3)
        idle = client.get(f"/api/projects/{other_id}", headers=auth).json()
        assert idle["status"] == "idle"
