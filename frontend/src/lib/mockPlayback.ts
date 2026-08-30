import { useChatStore } from '@/stores/chatStore'
import { usePreviewStore } from '@/stores/previewStore'
import { useProjectStore } from '@/stores/projectStore'

const MOCK_FILES: { path: string; content: string }[] = [
  {
    path: 'index.html',
    content: `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>Pomodoro</title>
    <script type="importmap">
      { "imports": { "react": "https://esm.sh/react@18.3.1", "react-dom/client": "https://esm.sh/react-dom@18.3.1/client" } }
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./src/main.jsx"></script>
  </body>
</html>`,
  },
  {
    path: 'src/main.jsx',
    content: `import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import './styles.css'

createRoot(document.getElementById('root')).render(<App />)`,
  },
  {
    path: 'src/App.jsx',
    content: `import React, { useState } from 'react'
import Timer from './components/Timer.jsx'
import TaskList from './components/TaskList.jsx'

export default function App() {
  const [done, setDone] = useState(0)
  return (
    <main className="app">
      <h1>Focus</h1>
      <Timer onComplete={() => setDone((n) => n + 1)} />
      <TaskList />
      <p className="stats">今日完成 {done} 个番茄</p>
    </main>
  )
}`,
  },
  {
    path: 'src/components/Timer.jsx',
    content: `import React, { useEffect, useState } from 'react'

export default function Timer({ onComplete }) {
  const [left, setLeft] = useState(25 * 60)
  const [run, setRun] = useState(false)
  useEffect(() => {
    if (!run) return
    const id = setInterval(() => {
      setLeft((v) => {
        if (v <= 1) { setRun(false); onComplete?.(); return 25 * 60 }
        return v - 1
      })
    }, 1000)
    return () => clearInterval(id)
  }, [run, onComplete])
  const m = String(Math.floor(left / 60)).padStart(2, '0')
  const s = String(left % 60).padStart(2, '0')
  return (
    <section>
      <div className="time">{m}:{s}</div>
      <button onClick={() => setRun((v) => !v)}>{run ? '暂停' : '开始'}</button>
    </section>
  )
}`,
  },
  {
    path: 'src/styles.css',
    content: `body { margin: 0; font-family: sans-serif; background: #111827; color: #f9fafb; }
.app { max-width: 420px; margin: 48px auto; }
.time { font-size: 64px; letter-spacing: 2px; }
button { background: #7c6af7; color: white; border: 0; padding: 10px 16px; border-radius: 10px; }`,
  },
]

function buildMockPreviewUrl(): string {
  const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Focus</title>
  <style>
    :root { color-scheme: dark; }
    body { margin: 0; font-family: Outfit, system-ui, sans-serif; background: #11131a; color: #eef0f5; }
    main { max-width: 420px; margin: 48px auto; padding: 0 20px; }
    h1 { font-size: 28px; margin: 0 0 8px; }
    .time { font-size: 72px; letter-spacing: 2px; margin: 24px 0 12px; }
    button { background: #7c6af7; color: white; border: 0; padding: 10px 18px; border-radius: 12px; cursor: pointer; }
    ul { padding: 0; list-style: none; }
    li { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #262c3a; }
    input { width: 100%; margin-top: 12px; padding: 8px 10px; border-radius: 8px; border: 1px solid #262c3a; background: #181c27; color: inherit; }
    .stats { color: #8b93a7; font-size: 13px; }
  </style>
</head>
<body>
  <main>
    <h1>Focus</h1>
    <p class="stats">番茄钟 · 今日完成 <span id="done">0</span></p>
    <div class="time" id="time">25:00</div>
    <button id="toggle">开始</button>
    <ul id="list"></ul>
    <input id="task" placeholder="添加任务，回车确认" />
  </main>
  <script>
    let left = 25 * 60, run = false, done = 0;
    const time = document.getElementById('time');
    const toggle = document.getElementById('toggle');
    const doneEl = document.getElementById('done');
    const list = document.getElementById('list');
    const input = document.getElementById('task');
    const pad = (n) => String(n).padStart(2, '0');
    const render = () => { time.textContent = pad(Math.floor(left/60)) + ':' + pad(left%60); };
    setInterval(() => {
      if (!run) return;
      left -= 1;
      if (left <= 0) { left = 25*60; run = false; toggle.textContent = '开始'; done += 1; doneEl.textContent = done; }
      render();
    }, 1000);
    toggle.onclick = () => { run = !run; toggle.textContent = run ? '暂停' : '开始'; };
    input.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter' || !input.value.trim()) return;
      const li = document.createElement('li');
      li.innerHTML = '<span>' + input.value + '</span><button style="background:transparent;color:#8b93a7">删除</button>';
      li.querySelector('button').onclick = () => li.remove();
      list.appendChild(li);
      input.value = '';
    });
  </script>
</body>
</html>`
  return URL.createObjectURL(new Blob([html], { type: 'text/html' }))
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      window.clearTimeout(timer)
      reject(new DOMException('aborted', 'AbortError'))
    })
  })
}

export async function playMockGeneration(signal?: AbortSignal) {
  const chat = useChatStore.getState()
  const project = useProjectStore.getState()
  const preview = usePreviewStore.getState()
  project.setStatus('generating')

  const emit = (event: string, data: Record<string, unknown>) => {
    chat.applyEvent(event, data)
    if (event === 'file_write') {
      project.applyFileWrite(String(data.path), String(data.content ?? ''), String(data.action ?? 'create'))
    }
    if (event === 'version') {
      project.setVersion(Number(data.version ?? 1))
      preview.setUrl(buildMockPreviewUrl())
    }
  }

  const steps: Array<[number, string, Record<string, unknown>]> = [
    [400, 'agent_start', { role: 'mike', title: '正在拆解需求' }],
    [
      700,
      'agent_message',
      {
        role: 'mike',
        content_md:
          '**执行计划**\n\n1. Emma 产出 PRD\n2. Bob 给出技术蓝图\n3. Alex 逐文件编码\n4. QA 静态验证\n\n变更级别：`major`（首次生成）',
      },
    ],
    [400, 'agent_start', { role: 'emma', title: '撰写 PRD' }],
    [
      800,
      'agent_message',
      {
        role: 'emma',
        content_md:
          '## 功能清单\n- 番茄钟计时器（25 / 5）\n- 任务列表（增删）\n- 今日完成统计\n\n## 页面清单\n- 主页面：计时器 + 任务\n\n## 交互说明\n- 点击开始 → 倒计时 → 结束自动计入完成数',
      },
    ],
    [400, 'agent_start', { role: 'bob', title: '设计技术蓝图' }],
    [
      700,
      'agent_message',
      {
        role: 'bob',
        content_md:
          '```json\n{\n  "stack": "react",\n  "file_tree": ["index.html", "src/App.jsx", "src/components/Timer.jsx"]\n}\n```',
      },
    ],
    [300, 'agent_start', { role: 'alex', title: '开始编码' }],
  ]

  for (const [delay, event, data] of steps) {
    await sleep(delay, signal)
    emit(event, data)
  }

  for (const file of MOCK_FILES) {
    await sleep(450, signal)
    emit('file_write', { path: file.path, size: file.content.length, action: 'create', content: file.content })
  }

  await sleep(400, signal)
  emit('agent_message', { role: 'alex', content_md: `已写入 ${MOCK_FILES.length} 个文件，准备交给 QA。` })
  await sleep(350, signal)
  emit('validation', { passed: true, issues: [] })
  await sleep(250, signal)
  emit('version', { version: 1, summary: '首次生成 · 番茄钟' })
  emit('done', { status: 'success', stats: { tokens: 12800, duration: 8 } })
}
