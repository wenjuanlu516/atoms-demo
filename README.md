# Atoms Demo

一句话需求 → Mike / Emma / Bob / Alex / QA 接力编码 → 浏览器里立刻跑起来，并可对话迭代。

评委说明见 [WRITEUP.md](./WRITEUP.md)。本 Demo 只做构建环（生成、预览、迭代、版本、轻量发布）。

| | |
|---|---|
| 仓库 | https://github.com/wenjuanlu516/atoms-demo |
| 完整管线 | http://111.230.155.101:8000 （腾讯云轻量 + Docker，默认 `LLM_MOCK=true`） |
| 静态演示 | https://wenjuanlu516.github.io/atoms-demo/ （GitHub Pages 回放，免配 Key，无服务端生成） |
| 本地开发 | 后端 `:8010` + 前端 `npm run dev` → http://localhost:5176 （避开本机已占用的 8000 / 5173） |

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/wenjuanlu516/atoms-demo)

## Quick start

```bash
cp .env.example .env   # 默认 LLM_MOCK=true
# 终端 1
cd backend && PYTHONPATH=. uvicorn app.main:app --host 127.0.0.1 --port 8010
# 终端 2
cd frontend && npm run dev
```

打开 http://localhost:5176（不要用 :5173 / :8000，那是本机其它服务）。

一键单端口：`PORT=8010 ./start.sh` → http://localhost:8010

### 开发（热更新）

后端用 **Python 3.12**。不要加 `--reload`（会打断进行中的批准 / SSE）。

```bash
# 终端 1
cd backend
python3.12 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
PYTHONPATH=. uvicorn app.main:app --host 127.0.0.1 --port 8010

# 终端 2
cd frontend
npm install
npm run dev            # :5176，代理 /api /preview /p → :8010
```

打开 http://localhost:5176，改完后硬刷新。

### Docker

```bash
cp .env.example .env
docker compose up --build
```

## 演示怎么点

1. 注册登录 → 在「我的项目」点「番茄钟工作法」（不要停在卡住的 `/w/new` 硬等）。
2. 左栏出现计划后点 **Accept**。不点 Accept，Emma 不会开工。
3. 看 Emma → Bob → Alex → QA 接力；中栏文件生长；右栏出来后**加任务 / 开计时**。
4. 对话里说「加一个今日完成数」；文件树看「新 / 改」；顶栏可回滚。
5. 预览「选择元素」后对 AI 说改一处；或 Publish 打开 `/p/{slug}`。

另外两个示例：咖啡落地页（static）、记账本（Vue + 图）。真模型大约 2–4 分钟；Mock 大约十几秒。

## 腾讯云轻量

完整服务：http://111.230.155.101:8000  
控制台防火墙放行 **TCP 8000**。

**更新代码：**

```bash
cd ~/atoms-demo
git pull --ff-only origin main
sudo docker compose up -d --build
```

**走真模型**（只改服务器上的 `.env`，不要提交 Key）：

```bash
nano ~/atoms-demo/.env
```

```bash
LLM_MOCK=false
LLM_API_KEY=sk-你的key
LLM_MODEL=deepseek/deepseek-chat
```

```bash
cd ~/atoms-demo
sudo docker compose up -d
```

`curl -sS http://127.0.0.1:8000/api/health` 应返回 `"llm_mock":false`，然后硬刷新公网页。数据库在 Docker 卷里，重建镜像不会清库。

第一次安装可用 [deploy/lighthouse.sh](./deploy/lighthouse.sh)。

## Render

点上方 Deploy to Render，按 Blueprint 创建免费 Web Service。默认 Mock。闲置会休眠；免费档无持久盘。真模型在 Render 环境变量里设 `LLM_MOCK=false` 和 `LLM_API_KEY`。

## LLM

| 模式 | 配置 |
|------|------|
| Mock（默认） | `LLM_MOCK=true`，不消耗 Key |
| 真模型 | `LLM_MOCK=false` + `LLM_API_KEY` + `LLM_MODEL` / `LLM_BASE_URL` |

Key 只放服务端，浏览器看不到。生产环境每天每 IP 5 次生成。

## 实现要点

- **服务端不执行生成代码。** 只存快照。预览是沙箱 iframe：`allow-scripts allow-forms allow-modals`，无 `allow-same-origin`。
- **出站改写预览。** 模型常写 `<script src="./src/App.jsx">`；服务端把 React JSX / Vue SFC 编进页面再交给 iframe。
- **过程当时可见。** SSE + 落库轮询回填角色卡，不必重开项目。
- **版本是快照。** 迭代、手改、回滚换指针。

## Stack

- 前端：React + Vite + TypeScript + Tailwind + Monaco
- 后端：FastAPI + SQLite + LangGraph + LiteLLM
- 运行时：生成应用只在 iframe 里跑
