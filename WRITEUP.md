# Atoms Demo · 一页说明

Chat-first 多智能体应用生成器：一句话需求 → Mike / Emma / Bob / Alex / QA 接力编码 → 浏览器里立刻跑起来，并可对话迭代。

官方 Atoms 覆盖研究、后端、发布等更广能力。本 Demo **只做构建环**：生成、预览、迭代、版本、轻量发布。

| | |
|---|---|
| 仓库 | https://github.com/wenjuanlu516/atoms-demo |
| 公网 | https://wenjuanlu516.github.io/atoms-demo/ （GitHub Pages 静态演示，内置回放，免配 Key）。完整服务端管线见本地 / Docker。 |
| 本地 | 开发：http://localhost:5176 （API `:8010`）。本机 8000 / 5173 已给其它服务。 |
| 开发 | 后端 `:8010` + 前端 `npm run dev` → http://localhost:5176（预览与 SSE 走 Vite 代理） |
| Docker | `docker compose up --build` |
| 默认 | `LLM_MOCK=true`，三个内置示例不消耗 Key |
| 真模型 | `LLM_MOCK=false` + 服务端 `LLM_API_KEY`（浏览器看不到 Key） |
| 腾讯云 | http://111.230.155.101:8000 （轻量 Docker）。默认 Mock；真模型见下方 |

故障时以本页脚本 + 录屏 + 本地 `./start.sh` 兜底。

## 腾讯云轻量：走真模型

服务器已经 `docker compose` 跑着时，不要改仓库里的 `.env.example`。SSH 登录后：

```bash
nano ~/atoms-demo/.env
```

至少改这两行（Key 只放服务器，不要提交）：

```bash
LLM_MOCK=false
LLM_API_KEY=sk-你的key
LLM_MODEL=deepseek/deepseek-chat
```

然后重启容器（不用 `--build`，只重载环境变量）：

```bash
cd ~/atoms-demo
sudo docker compose up -d
```

`curl -sS http://127.0.0.1:8000/api/health` 里应看到 `"llm_mock":false`。浏览器打开 http://111.230.155.101:8000 硬刷新。更新代码则 `git pull` 后再 `sudo docker compose up -d --build`。

## 三分钟怎么看

1. 注册登录 → 选「番茄钟工作法」。左栏立刻出现用户消息和进度，不必重开项目。
2. 接受计划后看 Emma → Bob → Alex → QA 接力；中栏文件生长、Monaco 跟写；右栏出来后加任务 / 开计时。
3. 对话里说「加一个今日完成数」；文件树看「新 / 改」，可对比上一版；顶栏切版本回滚。
4. 预览点「选择元素」，对 AI 说改一处；或直接改代码保存。
5. Publish，打开 `/p/{slug}`。

另外两个示例：咖啡落地页（static）、记账本（Vue + 图）。

## 为什么这样做

- **服务端零执行生成代码。** 只存快照、装配静态文件。预览是沙箱 iframe（`allow-scripts allow-forms allow-modals`，无 `allow-same-origin`）。表单能提交，父页面 Cookie 读不到。生成代码里的 `localStorage` 由 hook 垫一层内存存储，避免沙箱 `SecurityError`。
- **SSE + 轮询双通道，过程当时就能看见。** 生成事件走 SSE；角色正文同时落库。前端每秒把已落库的 Emma/Bob/Alex/QA 补进对话，代理卡住也不会只剩进度条。从「我的项目」点示例会带着当前轮次进工作台，不会冲掉聊天。
- **LiteLLM 换模型，LangGraph 管状态机。** Mike 判断 minor 则跳过 Emma/Bob；QA blocker 最多回传 Alex 两轮。默认 Mock 保证无 Key 也能走完闭环。
- **预览在「出站时」改写，而不是赌模型写出可跑 HTML。** 模型常写 `<script src="./src/App.jsx">` 或 Babel CDN。服务端拆掉本地模块 / `text/babel`，把 React JSX（含 `map` 块体）和 Vue SFC 编进页面，注入 UMD 运行时。单独去拉 `.jsx` 也会先编成 JS。浏览器不必再跑 Babel。
- **版本是不可变快照。** 迭代、手改、回滚都是换指针；发布快照不带编辑 hook。

## 做到哪、没做哪

| 验收 | 状态 |
|---|---|
| A1 一键启动 | 有 `start.sh` / Compose |
| A2 三句示例 → 应用 | Mock 与真模型均可；React/Vue 预览靠出站改写 |
| A3 过程可见 | 角色卡实时回填、进度轨、多轮归档、排队 / 停止 |
| A4 预览可点 | iframe 可点、可提交表单；番茄钟可加任务 |
| A5 对话迭代 | 增量管线 + diff + 回滚并留聊天说明 |
| A6 时长 | 过程先看见；真模型约 2–4 分钟，视文件数 |
| A7 点选 | 能圈元素并对 AI 说；快捷条（改色 / 改尺寸）未做 |
| A8 / A10 账户与持久化 | JWT + 用户隔离；SQLite 存项目 / 消息 / 版本 / 发布。公网免费档无持久盘，以本地 / Compose 卷为准。 |
| A9 公网 | Pages 静态回放；完整管线 http://111.230.155.101:8000 。真模型改服务器 `~/atoms-demo/.env` 后 `sudo docker compose up -d` |

未做：运行时 CDN 本地化、Race Mode。点选目前是「选中 → 一句话」，不是完整快捷条。公网默认 Mock（Mock 不限次数）；真模型时每 IP 每日约 50 次生成。


## 怎么用 AI 做这个 Demo

方案、LangGraph 节点、三栏 UI、预览改写都是人和模型对着真实失败迭代出来的：JSX 当 JS 解析（`Unexpected token '<'`）、`map` 块体编译坏掉、iframe 禁表单导致「添加」没反应、角色卡只在重开项目时出现、沙箱里 `localStorage` 报错。Prompt 放在 `backend/app/agent/`，白名单和静态 QA 在 `whitelist.py`。原则是：**模型负责写应用，平台负责让它跑起来、看得见、可回退。**
