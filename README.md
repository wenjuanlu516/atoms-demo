# Atoms Demo

Chat-first multi-agent app builder. Describe a product in one sentence; a visible AI team (Mike / Emma / Bob / Alex / QA) generates a runnable web app in the browser.

## Quick start

```bash
cp .env.example .env   # LLM_MOCK=true by default
./start.sh             # builds frontend, starts API + SPA on :8000
```

Open http://localhost:8000

### Development (hot reload)

Terminal 1 — backend:

```bash
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Terminal 2 — frontend:

```bash
cd frontend
npm install
npm run dev            # :5173, proxies /api /preview /p → :8000
```

### Docker

```bash
cp .env.example .env
docker compose up --build
```

## LLM configuration

| Mode | How |
|------|-----|
| Mock (default) | `LLM_MOCK=true` — deterministic pipeline, no API key |
| Real model | `LLM_MOCK=false` + `LLM_API_KEY` + `LLM_MODEL` / `LLM_BASE_URL` |

Keys stay on the server. The browser never sees them.

## Demo

1. 注册一个账号并登录
2. 在「我的项目」点选「番茄钟工作法」
3. 左侧看 Mike → Emma → Bob → Alex → QA 接力；中间文件树生长；右侧预览可点击开始/添加任务
4. 在对话里追加修改，或在预览中点「选择元素」后对 AI 说
5. 保存代码会生成新版本；顶栏可回滚；Publish 得到 `/p/{slug}` 公开链接

默认 `LLM_MOCK=true`，三个内置需求都会生成可运行的静态应用。切换真实模型：

```bash
LLM_MOCK=false
LLM_API_KEY=sk-...
LLM_MODEL=deepseek/deepseek-chat
```

## Stack

- Frontend: React + Vite + TypeScript + Tailwind
- Backend: FastAPI + SQLite + LangGraph + LiteLLM
- Runtime: generated apps run in a sandboxed iframe (server never executes them)
