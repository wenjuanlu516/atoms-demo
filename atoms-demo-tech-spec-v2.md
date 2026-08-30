# Atoms Demo：智能体驱动的应用生成平台 技术方案

> 版本：V2.0（终版）
> 文档性质：可实施开发方案
> 目标：实现一个可运行的网页应用，具备类似 Atoms（atoms.dev）的能力与 UI 交互体验——通过智能体驱动的方式完成代码（应用）生成，并将生成的应用以可视化网页形式进行展示。

---

## 一、项目概述

### 1.1 任务解读

本次挑战要求交付一个 Atoms Demo：

- **可运行的网页应用**：一个真实部署/可启动的 Web 系统，而非设计稿或文档；
- **智能体驱动代码生成**：用户以自然语言表达需求，由多智能体（Multi-Agent）接力完成需求分析、架构设计、编码与验证，用户能"看见"智能体团队的工作过程；
- **生成物可视化展示**：生成的应用必须在浏览器内以可视化、可交互的网页形式即时运行，而非仅交付代码包；
- **对标 Atoms 体验**：交互体验参照 atoms.dev——Chat-first 构建、AI 团队协作呈现、即时预览（App Viewer）、对话式迭代、点选编辑、一键发布。

任务不考察"用 Atoms 做 Atoms"，而是考察如何借助 AI 工具，把想法快速转化为可运行、可体验、可扩展的产品原型。因此本方案的原则是：**轻架构、重体验、快闭环**。

### 1.2 核心用户故事

用户输入一句话："帮我做一个番茄钟工作法应用，要有任务列表和统计"。

点击开始后，左侧聊天流中 AI 团队依次亮相：Mike（队长）确认需求并分派任务 → Emma（产品经理）产出 PRD → Bob（架构师）产出技术蓝图 → Alex（工程师）逐文件编码 → QA 自动运行验证。过程中文件树与代码实时刷新。

完成后，右侧预览区即刻出现一个可交互运行的番茄钟应用。

用户继续对话"把主题改成深色，加一个每日统计图表"，应用增量更新；

用户在预览中点选某个按钮，直接对 AI 说"把这个按钮改成圆角大按钮"，完成点选编辑；

点击 Publish，生成一个可分享的公开访问链接。

### 1.3 验收标准（Demo 成功定义）

| 编号 | 验收项 | 判定方式 |
|------|--------|----------|
| A1 | 系统可一键启动（单命令） | ./start.sh 或 docker compose up 后浏览器可用 |
| A2 | 一句话需求 → 完整应用 | 3 个内置演示需求全部生成成功 |
| A3 | 生成过程智能体可视化 | 聊天流可见各角色的分工、产出物与接力过程 |
| A4 | 生成物浏览器内可交互运行 | 预览区可直接操作（点击、输入、切换页面） |
| A5 | 对话式迭代生效 | 追加修改需求后应用正确增量更新 |
| A6 | 端到端时间可接受 | 单次完整生成 ≤ 3 分钟（主流模型） |
| A7 | 点选编辑可用（P1） | 预览中点选元素 → 对话修改 → 元素更新 |
| A8 | 轻量注册登录可用 | 注册/登录后项目归属该用户，重新登录数据不丢 |
| A9 | 提供可测试的在线访问链接 | 公网地址可直接注册使用，无需自备 API Key |
| A10 | 数据持久化 | 项目、消息、版本、发布快照在服务重启后均保留 |

---

## 二、产品设计

### 2.1 整体界面设计（三栏 Workspace）

对标 Atoms 的 Workspace 布局，采用三栏式 + 顶部工具栏结构：

![图 2-1 Atoms Demo 三栏 Workspace 界面布局](atoms-demo-images/image1.png)

> 图 2-1 Atoms Demo 三栏 Workspace 界面布局

三栏职责：

- **左栏 Chat**：对话即操作（Chat-first）。所有角色消息、产出物摘要、进度在此滚动呈现；底部为输入框；
- **中栏 Code**：文件树 + Monaco 编辑器，生成过程中实时高亮"正在写入"的文件，支持用户手动编辑（保存后触发预览刷新）；
- **右栏 Preview（App Viewer）**：iframe 沙箱中运行生成物，支持视口切换（桌面/移动）、新窗口打开、点选编辑模式。

### 2.2 核心交互流程

#### 流程 0：注册 / 登录（轻量账户体系）

首次访问注册（用户名 + 密码，JWT 鉴权）；登录后进入「我的项目」列表页，可新建、继续、删除项目。所有项目、消息、版本按用户隔离并持久化，重新登录数据不丢。轻量实现（无邮箱/验证码/OAuth），覆盖"初始化/注册/核心主流程"的基本使用要求。

#### 流程 1：首次生成（Build）

1. 用户在输入框描述需求（或选择内置示例）；
2. Chat 流出现 Mike 的"任务分派卡"，列出执行计划（PRD → 架构 → 编码 → 验证）。默认自动继续执行以保证演示流畅；设置中可开启"计划确认"模式，由用户点击批准后才继续（对齐 Atoms 队长"请求你批准"的交互）；
3. 各角色依次工作，每个角色一张角色卡片：头像 + 名字 + 职责 + 产出物（可展开）；
4. Alex 编码阶段，中栏文件树逐个出现文件、Monaco 打开当前写入文件并自动滚动；
5. QA 验证通过后，右栏 App Viewer 自动加载，出现"应用已就绪"动效。

#### 流程 2：对话迭代（Iterate）

1. 用户在 Chat 中追加修改需求；
2. Mike 判断变更范围，仅指派 Alex（小改动）或重走 PRD（大改动）；
3. 前端对改动文件做 diff 高亮，预览自动刷新，状态栏版本号 +1，支持回滚到任意历史版本。

#### 流程 3：点选编辑（Select-to-Edit）

1. 用户点击 App Viewer 中的"选择元素"按钮进入点选模式；
2. 鼠标悬停的元素高亮，点击后弹出快捷条（改文案 / 改颜色 / 改尺寸 / 对 AI 说）；
3. 选择"对 AI 说"输入自然语言指令，仅相关文件被修改。

#### 流程 4：发布（Publish）

点击 Publish → 生成公开只读链接（如 /p/{slug}），任何人可访问该静态应用快照。

发布装配与预览装配的差异：发布快照不注入 runtime hook（错误捕获/点选编辑属于编辑态能力），输出纯净静态应用，同时写入 slug → 版本文件的映射，后续同项目可再次发布新版本（slug 不变、内容更新）。

### 2.3 功能优先级

| 优先级 | 功能 | 说明 |
|--------|------|------|
| P0 | Chat-first 生成 | 一句话需求 → 多智能体接力生成完整应用 |
| P0 | 团队模式可视化 | Mike/Emma/Bob/Alex/QA 角色化呈现工作过程 |
| P0 | App Viewer | 生成物在 iframe 沙箱中即时可交互运行 |
| P0 | 对话迭代 | 增量修改 + 版本管理 + 回滚 |
| P0 | 代码视图 | 文件树 + Monaco 实时展示与手动编辑 |
| P1 | 点选编辑 | 预览内点选元素直接对话修改 |
| P1 | 运行时自修复 | 预览报错自动回传 → AI 修复 → 自动重载 |
| P1 | Publish | 一键生成公开分享链接 |
| P2 | Race Mode | 同一需求并行跑两个模型，左右对比择优 |
| P2 | 模板/主题 | 内置起始模板（落地页/管理后台/小游戏） |

---

## 三、总体架构

### 3.1 架构图

![图 3-1 系统总体架构](atoms-demo-images/image2.png)

> 图 3-1 系统总体架构

关键架构决策：

- **单体后端**：FastAPI 单进程 + asyncio 并发管理任务，不引入 Celery/Redis/消息队列。Demo 规模下任务量小，进程内任务管理器（asyncio.Task + 内存任务表）足够，消除部署复杂度；
- **SQLite**：单文件数据库，含建表 SQL，./start.sh 自动初始化，评委零配置；
- **SSE 而非 WebSocket**：任务流是单向服务端推送，SSE 自带断线重连（Last-Event-ID），实现简单、穿透代理友好；
- **服务端零执行业务代码**：生成的应用完全在用户浏览器 iframe 内运行，服务端只负责"装配静态文件 + 提供文件服务"，永不执行生成代码，这是安全与可移植性的基石。

### 3.2 技术选型

| 层 | 选型 | 理由 |
|----|------|------|
| 前端框架 | React 18 + Vite + TypeScript | 生态成熟、Monaco 集成方案多 |
| UI 组件 | Tailwind CSS + shadcn/ui | 快速构建现代三栏布局 |
| 代码编辑器 | Monaco Editor | VS Code 同款，diff 视图开箱即用 |
| 后端框架 | FastAPI（Python 3.12） | 原生 async、SSE 支持好、开发效率高 |
| 智能体编排 | LangGraph | 状态机式多节点管线、支持条件路由与循环（Fix 循环） |
| LLM 接入 | LiteLLM | 统一接口对接 GPT/Claude/DeepSeek/Qwen，模型可配置可切换 |
| 数据库 | SQLite（SQLAlchemy） | 零运维、单文件、演示可携带 |
| 任务流 | SSE（sse-starlette） | 单向推送、自动重连 |
| 部署 | Docker Compose / 单机脚本 | 一键启动 |

### 3.3 工程目录结构

```text
atoms-demo/
  frontend/
    src/
      components/        # 三栏布局、AgentCard、FileTree、Monaco、Preview
      stores/            # zustand stores（chat、project、preview）
      lib/               # SSE client、postMessage、utils
    package.json
  backend/
    app/
      main.py            # FastAPI 入口
      api/               # 路由层
      agent/             # LangGraph 管线、节点、prompts
      runtime/           # 装配器、白名单、hook 注入
      services/          # LLM 服务、任务管理器、EventBus
      models/            # SQLAlchemy 模型
      config.py          # 配置加载
    start.sh             # 一键启动
  docker-compose.yml
  Dockerfile
```

---

## 四、智能体管线设计（核心）

### 4.1 角色定义

对标 Atoms 的 AI 团队，设置 5 个角色。每个角色 = 一个独立 System Prompt 的 LLM 调用，而非不同模型——成本可控且表现一致：

| 角色 | 职责 | 输入 | 输出 |
|------|------|------|------|
| Mike 队长 | 解析用户需求，制定执行计划，分派任务 | 用户消息 | 执行计划卡（步骤列表） |
| Emma 产品经理 | 撰写精简 PRD | 需求 + 计划 | PRD（功能清单/页面清单/交互说明） |
| Bob 架构师 | 技术选型（限白名单）、文件结构、数据形态 | PRD | 技术蓝图（栈选择 + file_tree 骨架 + 模块说明） |
| Alex 工程师 | 逐文件生成完整代码 | PRD + 蓝图 | 代码文件（含路径与内容） |
| QA 验证员 | 静态检查 + 运行时验证 + 触发修复 | 全部文件 | 验证报告（通过/问题清单） |

> Mike 在迭代模式下承担"变更分级"（大改动回 Emma，小改动直达 Alex），对齐 Atoms 中 Team Leader "协调并请求确认"的定位。

### 4.2 LangGraph 状态机

![图 4-1 智能体管线（LangGraph 状态机）](atoms-demo-images/image3.png)

> 图 4-1 智能体管线（LangGraph 状态机）

**迭代模式**（第二条及以后的消息）：

迭代分支已合并到图 4-1 中展示。

**Graph 状态（TypedDict）**：

```python
class AgentState(TypedDict):
    user_request: str
    conversation_history: list[dict]   # 全部对话历史
    plan: dict                          # Mike 的执行计划
    prd: str                            # Emma 的 PRD（Markdown）
    blueprint: dict                     # Bob 的技术蓝图（JSON）
    files: list[dict]                   # Alex 生成的文件 [{path, content}]
    qa_report: dict                     # QA 验证报告
    change_level: str                   # minor | major（迭代模式）
    fix_round: int                      # 当前修复轮次
    version: int                        # 当前版本号
    error: str | None                   # 错误信息
```

### 4.3 各节点 Prompt 设计要点

所有 Prompt 遵循统一骨架：**角色人设**（与 Atoms 官方一致的口吻）→ **硬约束**（白名单/输出格式）→ **任务说明** → **输出格式示例**。

**Mike（队长）**——输出 JSON：

```json
{
  "plan": ["PRD", "架构设计", "编码", "验证"],
  "change_level": "major",
  "dispatch": ["Emma", "Bob", "Alex", "QA"]
}
```

**Emma（PM）**——输出 Markdown PRD，限制篇幅（≤500 字）：

```markdown
## 功能清单
- 番茄钟计时器（25分钟工作/5分钟休息）
- 任务列表（增删改查）
- 统计图表（每日完成数）

## 页面清单
- 主页面：计时器 + 任务列表
- 统计页面：图表

## 交互说明
- 点击开始 → 计时启动 → 结束自动切换休息
```

**Bob（架构师）**——输出 JSON 蓝图：

```json
{
  "stack": "react",
  "file_tree": [
    {"path": "index.html", "type": "entry"},
    {"path": "src/App.jsx", "type": "component"},
    {"path": "src/components/Timer.jsx", "type": "component"},
    {"path": "src/components/TaskList.jsx", "type": "component"},
    {"path": "src/components/Stats.jsx", "type": "component"},
    {"path": "src/styles.css", "type": "style"}
  ],
  "modules": {
    "Timer": "番茄钟计时逻辑",
    "TaskList": "任务增删改查",
    "Stats": "Chart.js 图表"
  }
}
```

**Alex（工程师）**——逐文件生成，这是成本大头，分两种策略：

- **蓝图驱动逐文件**：按 file_tree 顺序，每次调用生成 1~2 个文件，输入携带 PRD + 蓝图 + 已生成文件清单（仅路径与摘要，非全文，控制上下文）；
- 输出 JSON：`{"files": [{"path": "...", "content": "..."}], "done": bool}`
- Prompt 硬约束：content 必须是完整可运行文件（无 TODO/占位符）；import 仅允许 CDN 白名单地址；样式统一内联或独立 css 文件。

**QA（验证员）**——两阶段：

1. **静态检查**（纯代码，非 LLM）：JSON Schema 校验 file_tree、检查所有 import 是否在白名单、检查 HTML 入口存在、粗查占位符（TODO、your-api-key）；
2. **LLM 审查**：输入文件清单与关键文件内容，输出 `{"passed": bool, "issues": [{"file": "...", "severity": "blocker|warning", "desc": "..."}]}`，只把 blocker 回传给 Alex 修复。

### 4.4 结构化输出契约（file_tree）

Alex/Bob 的输出统一走 JSON Schema 校验 + 失败自动重试：

```python
from pydantic import BaseModel, ValidationError

class FileNode(BaseModel):
    path: str
    content: str

class AlexOutput(BaseModel):
    files: list[FileNode]
    done: bool

# LLM 服务层的保障策略（services/llm.py）：
# 1. 调用使用 response_format={"type": "json_object"}（支持的模型）
#    或在 Prompt 中强约束 + 提取 JSON 代码块
# 2. pydantic 校验失败 → 将校验错误信息拼回重试，最多 2 次
# 3. 仍失败 → 降级为逐字段修复（仅要求重写非法字段）
# 4. 全链路 Token 用量与耗时写入任务记录，前端状态栏实时展示
```

### 4.5 运行时验证与自动修复闭环

QA 静态检查通过 ≠ 应用能跑。真正的闭环在预览加载之后：

```text
预览加载 → hook.js 捕获运行时错误 → postMessage 回传后端
  → Mike 分析错误 → 指派 Alex 修复相关文件 → 装配新版本 → 预览重新加载
  → 通过则结束；仍报错则进入下一轮修复
```

修复轮次与 Token 消耗有上限（可配置），避免死循环：`MAX_FIX_ROUNDS = 2`（QA 触发）+ `MAX_RUNTIME_FIX = 2`（运行时触发）。

### 4.6 增量迭代与版本管理

- 每次成功生成/迭代创建**不可变版本快照**（project_versions 表，v1、v2…）；
- 迭代时 Mike 的 `change_level=minor` 路径只把"受影响文件"发给 Alex：输入 = 用户指令 + 相关文件全文 + 文件清单，输出 = 被修改文件的完整内容；
- 前端版本条可切换历史版本，预览加载对应快照，一键回滚（本质 = 把当前指针指回旧版本）。

### 4.7 成本与时长预算（单次完整生成）

以 6 文件的 React 应用为例（输入含上下文、输出含代码）：

| 节点 | 调用次数 | 预估 Token（in+out） | 预估耗时 |
|------|----------|----------------------|----------|
| Mike | 1 | ~1K | 5s |
| Emma | 1 | ~2K | 15s |
| Bob | 1 | ~3K | 20s |
| Alex | 3~6（逐文件） | 3~8K/文件 | 90~150s |
| QA（LLM 审查） | 1 | ~4K | 15s |
| 修复轮（期望 <1 轮） | 0~2 | 2~5K/轮 | 0~40s |
| **合计** | **6~11** | **≈ 25K~60K** | **≈ 2.5~4 分钟** |

> A6 验收（≤3 分钟）通过"文件数 ≤8 + 流式呈现过程 + 演示需求已调优"保障；生成过程中用户全程有事可看（角色卡片、文件生长），主观等待感远低于实际时长；
>
> 主流模型下单次生成成本约 ¥0.5~3，演示与评审完全可承受；Demo 阶段无用户登录，生产化时再加配额控制。

---

## 五、浏览器内运行时（App Runtime）

这是本方案的技术核心：生成物如何在"服务端零执行"前提下获得真实运行能力。

### 5.1 设计原则

- 服务端只做静态文件服务与装配，永不执行生成代码；
- 生成物限定为纯前端应用，运行环境 = 用户浏览器的 sandbox iframe；
- 通过技术栈白名单约束 LLM 输出的依赖面，保证任意生成物可运行。

### 5.2 技术栈白名单

允许的外部依赖 CDN 白名单（硬编码于 `whitelist.py`）：

| 栈 | 适用 | 加载方式 |
|----|------|----------|
| static | 落地页、展示、简单交互 | 原生 HTML/CSS/JS，零依赖 |
| react | 复杂交互应用 | CDN ESM + import map（es-react/react-dom@18） |
| vue | 表单/轻交互 | Vue 3 CDN 全局构建 |

- esm.sh / unpkg.com / cdn.jsdelivr.net 上的：react、react-dom、vue、tailwind-browser、chart.js、lucide（图标）；
- 字体：Google Fonts / 系统字体栈。

白名单之外的 import 一律被 QA 拦截，并提示 Alex 改写为白名单依赖或原生实现。

### 5.3 预览装配流程

后端 `runtime/assembler.py` 在每次版本快照后执行装配：

```text
1. 读取版本快照的所有文件
2. 根据 blueprint.stack 选择装配模板（static/react/vue）
3. 重写 import 路径 → CDN 白名单地址
4. 注入 hook.js（运行时错误捕获）
5. 写入预览目录 → /preview/{pid}/v{n}/
```

React 栈的 import map 模板（由蓝图保证写入 index.html）：

```html
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18.3.1",
    "react-dom": "https://esm.sh/react-dom@18.3.1",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client"
  }
}
</script>
```

### 5.4 iframe 沙箱与安全

- `sandbox="allow-scripts"`：可运行脚本，但禁止 same-origin（无法读父页面 Cookie/localStorage、禁止顶级导航跳转、禁止弹窗）；
- 预览路由只服务白名单后缀（html/js/css/json/svg/png）；
- 文件内容入库前做尺寸上限（单文件 ≤ 200KB，总 ≤ 2MB）与敏感模式过滤（`fetch(` 外域请求在 QA 阶段给出 warning，不阻塞）；
- LLM 侧安全（继承成熟实践）：LLM 只拿到项目上下文，无任何系统权限，不配置代码执行工具。

### 5.5 运行时错误捕获与回传（hook.js）

注入到每个预览页面的轻量脚本（约 80 行，无依赖）：

```javascript
// hook.js 核心逻辑
window.addEventListener('error', (event) => {
  window.parent.postMessage({
    __atoms: true,
    type: 'runtime_error',
    message: event.message,
    source: event.filename + ':' + event.lineno,
  }, '*');
});

window.addEventListener('unhandledrejection', (event) => {
  window.parent.postMessage({
    __atoms: true,
    type: 'runtime_error',
    message: 'Unhandled Promise: ' + event.reason,
    source: 'promise',
  }, '*');
});
```

父页面（App Viewer 组件）监听 message 事件：过滤 `__atoms` 标记 → UI 上显示错误条（"检测到运行错误，正在自动修复…"）→ 调 `POST /api/projects/{pid}/fix`，携带错误信息 → 进入 4.5 的修复循环。

### 5.6 点选编辑实现

1. **进入点选模式**：父页面通过 postMessage 通知 hook.js 开启标注模式；
2. **注入标注样式**：hook.js 为所有元素添加 `:hover` 描边（`outline: 2px solid #6366f1`）；
3. **点击捕获**：拦截 click，`event.preventDefault()`，取目标元素信息：标签、文本摘要、类名、以及注入的 `data-atom-id`（装配时按 DOM 顺序为 Alex 的组件文件建立元素→文件映射的近似方案：优先按"组件名→文件"启发式定位）；
4. **快捷条**：浮层提供常用操作（文案/颜色/尺寸）与"对 AI 说"输入框；
5. **生成结构化编辑指令**：`{"target": "App.jsx 中标题元素", "instruction": "改为圆角大按钮，主色调紫色"}` → 走 minor 迭代管线。

> 实现分级：V1 实现"点选 → 定位到文件 + 用户口述指令"（文件级定位已够用）；V2 再做元素级精确定位（AST 级映射）。

---

## 六、后端详细设计

### 6.1 API 设计

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/auth/register | 注册（用户名+密码），返回 JWT |
| POST | /api/auth/login | 登录，返回 JWT |
| GET | /api/auth/me | 当前用户信息（Authorization: Bearer） |
| POST | /api/projects | 创建项目（首个需求），返回 project_id，后台启动管线 |
| GET | /api/projects/{pid} | 项目详情：当前版本、文件清单、状态 |
| GET | /api/projects/{pid}/stream | SSE 事件流（全生命周期） |
| POST | /api/projects/{pid}/messages | 追加消息（迭代），触发增量管线 |
| GET | /api/projects/{pid}/versions | 版本列表 |
| GET | /api/projects/{pid}/versions/{v}/files | 某版本全部文件 |
| PUT | /api/projects/{pid}/files/{path} | 用户手动改代码（触发预览刷新 + 新版本） |
| POST | /api/projects/{pid}/fix | 运行时错误回传，触发自动修复 |
| POST | /api/projects/{pid}/stop | 取消当前生成任务 |
| POST | /api/projects/{pid}/publish | 发布 → 返回公开 slug |
| GET | /preview/{pid}/v{n}/{path} | 预览文件服务（装配后） |
| GET | /p/{slug}/{path} | 已发布应用的只读访问 |

### 6.2 SSE 事件协议

所有事件带递增 id，支持断线重连补发：

| event | data 结构 | 时机 |
|-------|-----------|------|
| agent_start | `{role, title}` | 某角色开始工作 |
| agent_message | `{role, content_md}` | 角色的产出物/思考摘要（Markdown） |
| file_write | `{path, size, action: create/update}` | Alex 写入文件 |
| file_diff | `{path, added, removed}` | 迭代时的变更统计 |
| validation | `{passed, issues[]}` | QA 报告 |
| version | `{version, summary}` | 新版本快照完成 |
| runtime_error | `{message, source}` | 预览运行时错误透传到 Chat 流 |
| fix_start/fix_end | `{round, result}` | 自动修复轮次 |
| done | `{status: success|failed_with_best_effort, stats:{tokens, duration}}` | 任务结束 |
| error | `{message, recoverable}` | 系统级错误 |

### 6.3 数据模型（SQLite / SQLAlchemy）

```sql
-- 用户表
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 项目表
CREATE TABLE projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    current_version INTEGER DEFAULT 0,
    status TEXT DEFAULT 'idle',  -- idle | generating | iterating | published
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 版本快照表
CREATE TABLE project_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    version INTEGER NOT NULL,
    snapshot_json TEXT NOT NULL,  -- 完整文件树 JSON
    summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(project_id, version)
);

-- 文件表（按版本存储）
CREATE TABLE project_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    version INTEGER NOT NULL,
    path TEXT NOT NULL,
    content TEXT NOT NULL,
    size INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 消息表（对话历史）
CREATE TABLE messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    role TEXT NOT NULL,  -- user | mike | emma | bob | alex | qa | system
    content TEXT NOT NULL,
    metadata_json TEXT,  -- 附加数据（产出物、文件引用等）
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 发布表
CREATE TABLE publishes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL REFERENCES projects(id),
    slug TEXT UNIQUE NOT NULL,
    version INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### 6.4 任务管理器（进程内）

```python
import asyncio
from collections import defaultdict

class TaskManager:
    def __init__(self, max_concurrent: int = 3):
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.tasks: dict[int, asyncio.Task] = {}
        self.event_bus = EventBus()

    async def start_generation(self, project_id: int, request: str):
        async with self.semaphore:
            # 启动 LangGraph 管线
            graph = build_agent_graph()
            initial_state = AgentState(
                user_request=request,
                conversation_history=[],
            )
            await graph.ainvoke(initial_state, config={"project_id": project_id})

class EventBus:
    """按 project_id 维护订阅者队列"""
    def __init__(self):
        self._subscribers: dict[int, list[asyncio.Queue]] = defaultdict(list)
        self._event_cache: dict[int, list] = defaultdict(list)  # ring buffer

    async def publish(self, project_id: int, event: dict):
        self._event_cache[project_id].append(event)
        for queue in self._subscribers[project_id]:
            await queue.put(event)

    def subscribe(self, project_id: int, last_event_id: int = 0):
        queue = asyncio.Queue()
        self._subscribers[project_id].append(queue)
        # 断线重连：补发 last_event_id 之后的事件
        for event in self._event_cache[project_id][last_event_id:]:
            queue.put_nowait(event)
        return queue
```

> EventBus 按 project_id 维护订阅者队列，SSE 断线重连时按 Last-Event-ID 从事件缓存（内存 ring buffer + DB 持久化）补发；
>
> 单实例并发上限 = 3（信号量），超出排队，保证演示稳定性。

---

## 七、前端详细设计

### 7.1 组件划分

```text
frontend/src/
  components/
    layout/
      Workspace.tsx          # 三栏布局容器
      TopBar.tsx             # 顶部工具栏（logo、项目名、版本条、Publish）
    chat/
      ChatPanel.tsx          # 左栏容器
      AgentCard.tsx           # 角色卡片（头像、名字、产出物展开）
      MessageInput.tsx       # 底部输入框
      ExampleCards.tsx        # 内置示例需求卡片
    code/
      CodePanel.tsx           # 中栏容器
      FileTree.tsx            # 文件树
      CodeEditor.tsx          # Monaco 编辑器
      DiffView.tsx            # 版本 diff 视图
    preview/
      PreviewPanel.tsx        # 右栏容器
      AppViewer.tsx           # iframe 沙箱 + 点选编辑
      ViewportSwitch.tsx      # 桌面/移动视口切换
      ErrorBar.tsx            # 运行时错误提示条
  stores/
    chatStore.ts              # 对话流状态
    projectStore.ts           # 项目、版本、文件状态
    previewStore.ts           # 预览状态
  lib/
    sseClient.ts              # EventSource + 指数退避重连
    postMessage.ts            # iframe 通信
    utils.ts
```

### 7.2 关键前端机制

- **SSE 客户端**：EventSource + 指数退避重连 + 按 id 去重；事件驱动 zustand store 更新；
- **生成中的"呼吸感"**：`agent_start` → AgentCard 显示打字动画；`file_write` → 文件树插入节点 + Monaco 定位到该文件并展示"正在写入"状态；
- **Markdown 渲染**：react-markdown + 代码高亮（Emma 的 PRD、Bob 的蓝图、QA 报告）；
- **预览刷新策略**：收到 `version` 事件才刷新 iframe（避免半成品闪烁）；手动改代码保存后即时刷新；
- **空状态引导**：首次进入时 Chat 流中即出现 Mike 的角色化欢迎语（头像 + 人设口吻："你好！我是队长 Mike…告诉我你的想法，我会协调团队把它做出来"），下方展示 3 个内置示例需求卡片，点击即填入——对齐 Atoms 各 Agent 的拟人化呈现，降低评委上手成本。

---

## 八、安全设计

| 风险 | 措施 |
|------|------|
| 生成代码攻击宿主 | iframe `sandbox="allow-scripts"`（无 same-origin）；postMessage 校验 `__atoms` 标记与来源 |
| 恶意外联 | import/CDN 白名单硬校验；外域 `fetch` 仅告警不阻塞 |
| LLM 注入系统操作 | LLM 无系统权限、无工具执行层；仅读写项目文本上下文 |
| 资源滥用 | 单文件 200KB/总量 2MB 上限；单项目版本数上限 50；并发信号量 |
| Prompt 注入（用户诱导生成恶意页） | QA 静态规则扫描（`document.cookie`、`eval`、外域表单提交等模式 → blocker） |
| API Key 泄漏 | Key 仅存服务端 `.env`；发布页不含任何服务端信息 |

---

## 九、端到端时序（首次生成）

![图 9-1 首次生成端到端时序](atoms-demo-images/image4.png)

> 图 9-1 首次生成端到端时序

```text
用户输入需求
  │
  ├─ POST /api/projects → 创建项目 + 启动管线
  │
  ├─ SSE Stream:
  │   ├─ [Mike] agent_start → 执行计划卡
  │   ├─ [Emma] agent_start → PRD（Markdown）
  │   ├─ [Bob] agent_start → 技术蓝图（JSON）
  │   ├─ [Alex] agent_start → file_write × N（逐文件流式）
  │   ├─ [QA] validation → 验证报告
  │   │   ├─ 通过 → version 事件
  │   │   └─ 不通过 → fix_start → Alex 修复 → fix_end → 重新验证
  │   ├─ version → 新版本快照完成
  │   └─ done → 任务结束统计
  │
  ├─ 前端收到 version → 刷新 iframe 预览
  │
  └─ hook.js 检测运行时错误（如有）
      └─ runtime_error → POST /api/projects/{pid}/fix → 修复循环
```

---

## 十、实施计划

总工时：8~10 个工作日（单人 + AI 辅助开发）。原则：先打通端到端最小闭环，再纵向加厚体验，最后上线公网。

| 阶段 | 内容 | 产出/验收 | 工时 |
|------|------|-----------|------|
| D0 Spike | iframe 运行时验证：静态栈 + React CDN/import map 样例手工装配运行；hook.js 错误捕获 demo | 最高风险点提前排雷 | 0.5d |
| D1 骨架 | 三栏布局 + FastAPI 骨架 + SSE 通道（先用 mock 事件流） | 界面骨架可演示假数据 | 1d |
| D2 管线 | LangGraph 五节点 + Prompt 初版 + 结构化输出校验 + LiteLLM 接入 | 一句话→文件生成（尚无预览） | 1.5d |
| D3 运行时 | 装配器 + 白名单 + 预览服务 + hook 注入 | 端到端闭环：生成即可运行 | 1d |
| D4 体验 | AgentCard/文件树动画/自动滚动/状态栏/错误条 | Atoms 式过程可视化成型 | 1d |
| D5 迭代 | 消息追加管线 + 版本快照/回滚 + diff 视图 + 手动编辑代码 | 对话迭代可用 | 1d |
| D6 增强 | 运行时自修复 + 点选编辑（文件级）+ Publish | P1 全达成 | 1~1.5d |
| D7 打磨 | 3 个内置需求回归调优（Prompt 迭代）、README、演示脚本彩排、Docker 化 | 验收 A1~A7 全过 | 1d |
| D7.5 账户 | 轻量注册登录（JWT）+ 用户项目隔离 + 「我的项目」列表页 | 验收 A8 | 0.5~1d |
| D8 上线 | Dockerfile + 云部署（Railway / Render / 腾讯云 CloudBase）+ 服务端 Key + IP 限流 + 在线链接回归测试 + 演示录屏兜底 | 验收 A9/A10，交付在线访问链接 | 1d |

**内置演示需求**（Prompt 调优的基准集）：

1. 番茄钟 + 任务列表（react 栈，交互型）；
2. 咖啡品牌落地页（static 栈，视觉型）；
3. 个人记账本（vue 或 react 栈，含图表）。

---

## 十一、演示脚本（3 分钟）

| 时间 | 动作 | 讲述要点 |
|------|------|----------|
| 0:00–0:20 | 打开首页，点击示例"番茄钟" | "一句话需求，AI 团队开工" |
| 0:20–1:10 | 凝视 Chat 流：Mike 分派 → Emma PRD → Bob 选栈蓝图 → Alex 逐文件编码（文件树实时生长） | "看得见的多智能体协作，正是 Atoms 的核心体验" |
| 1:10–1:40 | 生成完成，App Viewer 出现可交互番茄钟；现场点击启动计时、添加任务 | "生成物即时运行、真实可交互，而非代码包" |
| 1:40–2:10 | 切到 Code 面板浏览代码；手动改一处标题保存，预览即时刷新 | "代码透明可改" |
| 2:10–2:40 | 对话迭代："加一个今日专注统计条"；展示版本 diff 与回滚；点选标题按钮做一次点选编辑 | "对话式迭代 + 点选编辑" |
| 2:40–3:00 | 点击 Publish，展示公开链接 | "从想法到可分享产品的完整闭环" |

---

## 十二、风险与应对

| 风险 | 概率 | 应对 |
|------|------|------|
| LLM 输出非法 JSON/代码不完整 | 高 | Schema 校验+错误回传重试 2 次；降级逐字段修复；Alex Prompt 强调"完整文件无占位" |
| 生成物运行报错 | 高 | hook.js 自动回传 + 定向修复闭环（4.5）；修复上限后展示 best-effort 结果与错误说明 |
| 生成时间过长 | 中 | 逐文件流式生成（先见过程后见结果）；文件数上限 8；Token 预算控制；演示用调优过的示例 |
| React CDN 栈兼容问题 | 中 | D0 Spike 提前验证；降级路径：蓝图规则倾向 static 栈 |
| 单进程任务并发挤兑 | 低 | 信号量限流 + 排队提示；Demo 场景并发极小 |
| 模型 API 波动 | 中 | LiteLLM 多模型可切换（.env 改一行）；关键演示前预热缓存 |
| 公网部署后 API Key 被刷爆 | 中 | Key 仅存服务端环境变量；slowapi 限流（每 IP 每日生成 5 次）；异常流量熔断提示 |
| 云平台冷启动慢 / 临时故障 | 中 | 健康检查 + 平台自动重启；演示录屏视频兜底；缓存 file_tree 快照可离线回放装配结果 |

---

## 十三、扩展路线（Demo 之后）

- **Race Mode**：同一需求并行跑两个模型（两条独立管线 + 双预览），左右分屏对比，用户择优保留——架构上仅需任务管理器支持并行任务与前端分屏；
- **Atoms Cloud 式后端**：为生成物提供可选轻后端（数据持久化/登录），采用"生成的应用走平台提供的受控 BFF"，保持服务端零执行生成代码原则；
- **模板与主题市场**：Bob 的蓝图前置"起始模板"选择，缩短生成路径；
- **GitHub 导出**：项目文件一键打包推送用户仓库；
- **真实深度研究角色（Iris）**：接入搜索工具，为落地页生成真实文案素材。

---

## 附录 A：环境与配置

```bash
# .env
LLM_API_KEY=sk-xxx
LLM_MODEL=deepseek/deepseek-chat
LLM_BASE_URL=https://api.deepseek.com/v1

# 可选：备选模型
LLM_FALLBACK_MODEL=qwen/qwen-2.5-coder-32b-instruct

# 数据库
DATABASE_URL=sqlite:///./atoms.db

# 限流
RATE_LIMIT_DAILY=5

# 并发
MAX_CONCURRENT_TASKS=3
```

## 附录 B：一键启动

一键启动 = 单命令 + 单端口：`start.sh` 中先构建前端产物（vite build），再由 FastAPI 直接托管 dist/ 静态目录——生产形态整个系统只有**一个服务、一个端口**（:8000），无 Node 常驻进程、无 CORS 配置；开发时才使用 Vite 热更新（:5173 + 代理）。

```bash
#!/bin/bash
# start.sh
set -e

echo "Building frontend..."
cd frontend && npm install && npm run build && cd ..

echo "Installing backend deps..."
cd backend && pip install -r requirements.txt

echo "Initializing database..."
python -c "from app.models import init_db; init_db()"

echo "Starting server on :8000..."
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

## 附录 C：开发方法论——AI 辅助开发（呼应任务 Highlight）

本方案自身的开发过程即是"借助 AI 工具将想法快速转化为产品原型"的实践：

- **方案即 AI 产出**：本技术方案由 AI 基于对 atoms.dev 的实时调研生成、评审、迭代；
- **开发期 AI 分工**：前端三栏 UI/组件脚手架、后端 API 层、LangGraph 节点与 Prompt 初版均由 AI 结对生成，人工聚焦架构决策、Prompt 调优与体验打磨；
- **自举验证**：内置的 3 个演示需求同时作为管线回归测试集，每次 Prompt 修改后自动跑一遍生成冒烟，量化改动收益；
- **经验沉淀**：所有角色的 System Prompt 独立成文件（`agent/prompts/`），本身就是"用 AI 工程化方法管理 AI"的示范。

## 附录 D：测试策略

- **单元测试（pytest）**：LLM 服务层的 JSON 校验/重试逻辑、白名单校验、装配器路径重写；
- **管线集成测试**：录制并回放 LLM 响应（mock LiteLLM），验证状态机流转、Fix 循环上限、版本快照正确性；
- **端到端冒烟**：3 个内置需求真实跑通（CI 每日一次），断言：生成文件数、预览 HTTP 200、hook 注入存在；
- **前端组件测试**：SSE 事件流 → store → UI 的渲染逻辑（Vitest + Testing Library）。

## 附录 E：在线部署方案（公网可测试链接）

**目标**：与本地 `./start.sh` 完全同构的单容器部署，公网可直接访问与测试。

### 部署形态

- **单 Docker 容器**：FastAPI 托管前端产物（dist/）+ 服务端 API + SQLite（挂载持久卷）；
- **Dockerfile 多阶段构建**：Node 阶段 vite build → Python 运行时阶段仅含 dist/ 与服务端代码，镜像精简；
- **平台选择**（按优先级）：Railway / Render / 腾讯云 CloudBase——均支持 Docker 部署、持久卷、自定义域名，有免费或低费档位。

### 关键配置

- LLM API Key 仅存服务端环境变量，前端零暴露——评委打开链接即可直接体验，无需自备 Key；
- SQLite 持久卷：数据文件挂载到平台 Volume，容器重启/重新部署数据不丢（满足数据持久化要求）；
- 限流：slowapi 每 IP 每日生成 5 次，超出后给友好提示（保护 Key 与演示稳定性）；
- 健康检查：`/api/health` 供平台探活，异常自动重启；
- 交付物：在线访问链接 + 3 分钟完整演示录屏（环境故障时兜底）+ 本地 start.sh（评委可离线复现）。

### 离线回放兜底

缓存一份已调优成功的 file_tree 快照入库；「示例演示模式」可直接从快照装配预览（不调用 LLM），保证任何网络环境下核心体验可展示。
