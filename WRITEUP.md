# Atoms Demo · 一页说明

Chat-first 多智能体应用生成器：一句话需求 → Mike / Emma / Bob / Alex / QA 接力编码 → 浏览器里立刻跑起来，并可对话迭代。

官方 Atoms 覆盖研究、后端、发布等更广能力。本 Demo **只做构建环**：生成、预览、迭代、版本、轻量发布。

| | |
|---|---|
| 仓库 | https://github.com/wenjuanlu516/atoms-demo |
| 公网 | https://wenjuanlu516.github.io/atoms-demo/ （GitHub Pages 静态演示，内置回放，免配 Key）。完整服务端管线见本地 / Docker。 |
| 本地 | `cp .env.example .env && ./start.sh` → http://localhost:8000 |
| Docker | `docker compose up --build` |
| 默认 | `LLM_MOCK=true`，三个内置示例不消耗 Key |
| 真模型 | `LLM_MOCK=false` + 服务端 `LLM_API_KEY`（浏览器看不到 Key） |

故障时以本页脚本 + 录屏 + 本地 `./start.sh` 兜底。

## 三分钟怎么看

1. 注册登录 → 选「番茄钟工作法」。
2. 左栏看计划卡与角色接力；中栏文件生长、Monaco 跟写；右栏出来后点开始 / 加任务。
3. 对话里说「加一个今日完成数」；文件树看「新 / 改」，可对比上一版；顶栏切版本回滚。
4. 预览点「选择元素」，对 AI 说改一处；或直接改代码保存。
5. Publish，打开 `/p/{slug}`。

另外两个示例：咖啡落地页（static）、记账本（Vue + 图）。

## 为什么这样做

- **服务端零执行生成代码。** 只存快照、装配静态文件。预览是沙箱 iframe（`allow-scripts`）。安全边界清楚，也避免评委机器上跑不可信代码。
- **SSE + 进程内任务，不上队列。** 生成是单向事件流；断线用 Last-Event-ID。Demo 并发很小，少一套 Redis。
- **LiteLLM 换模型，LangGraph 管状态机。** Mike 判断 minor 则跳过 Emma/Bob；QA blocker 最多回传 Alex 两轮。默认 Mock 保证无 Key 也能走完闭环。
- **预览在「出站时」改写，而不是赌模型写出可跑 HTML。** React JSX / Vue SFC 在服务端编译进页面，注入 React/Vue 运行时。模型仍写常见工程文件，浏览器不必再拉 Babel / SFC loader。
- **版本是不可变快照。** 迭代、手改、回滚都是换指针；发布快照不带编辑 hook。

## 做到哪、没做哪

| 验收 | 状态 |
|---|---|
| A1 一键启动 | 有 `start.sh` / Compose |
| A2 三句示例 → 应用 | Mock 与真模型均可；React/Vue 预览靠出站改写 |
| A3 过程可见 | 角色卡、进度轨、多轮归档、排队 / 停止 |
| A4 预览可点 | iframe 沙箱 |
| A5 对话迭代 | 增量管线 + diff + 回滚并留聊天说明 |
| A6 时长 | 过程先看见；真模型约 2–4 分钟，视文件数 |
| A7 点选 | 能圈元素并对 AI 说；快捷条（改色 / 改尺寸）未做 |
| A8 / A10 账户与持久化 | JWT + 用户隔离；SQLite 存项目 / 消息 / 版本 / 发布。公网免费档无持久盘，以本地 / Compose 卷为准。 |
| A9 公网 | https://wenjuanlu516.github.io/atoms-demo/ ；静态回放。真模型请本地跑 |

未做：运行时 CDN 本地化、Race Mode。点选目前是「选中 → 一句话」，不是完整快捷条。公网默认 Mock，每 IP 每日 5 次生成。

## 怎么用 AI 做这个 Demo

方案、LangGraph 节点、三栏 UI、预览改写都是人和模型对着真实失败迭代出来的（JSX 换行、Vue SFC、iframe 空白）。Prompt 放在 `backend/app/agent/`，白名单和静态 QA 在 `whitelist.py`。原则是：**模型负责写应用，平台负责让它跑起来、看得见、可回退。**
