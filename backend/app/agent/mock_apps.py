def _pomodoro() -> list[dict]:
    return [
        {
            "path": "index.html",
            "content": """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Focus · 番茄钟</title>
  <link rel="stylesheet" href="./src/styles.css" />
</head>
<body>
  <main class="app">
    <header>
      <p class="eyebrow">Pomodoro</p>
      <h1>Focus</h1>
      <p class="muted">今日完成 <strong id="done">0</strong> 个番茄</p>
    </header>
    <div class="time" id="time">25:00</div>
    <div class="row">
      <button id="toggle">开始</button>
      <button id="reset" class="ghost">重置</button>
    </div>
    <form id="form">
      <input id="task" placeholder="添加任务，回车确认" />
    </form>
    <ul id="list"></ul>
  </main>
  <script src="./src/main.js"></script>
</body>
</html>
""",
        },
        {
            "path": "src/main.js",
            "content": """const timeEl = document.getElementById('time');
const toggle = document.getElementById('toggle');
const reset = document.getElementById('reset');
const doneEl = document.getElementById('done');
const form = document.getElementById('form');
const input = document.getElementById('task');
const list = document.getElementById('list');
let left = 25 * 60;
let run = false;
let done = 0;
const pad = (n) => String(n).padStart(2, '0');
const render = () => { timeEl.textContent = pad(Math.floor(left / 60)) + ':' + pad(left % 60); };
setInterval(() => {
  if (!run) return;
  left -= 1;
  if (left <= 0) { left = 25 * 60; run = false; toggle.textContent = '开始'; done += 1; doneEl.textContent = String(done); }
  render();
}, 1000);
toggle.onclick = () => { run = !run; toggle.textContent = run ? '暂停' : '开始'; };
reset.onclick = () => { run = false; left = 25 * 60; toggle.textContent = '开始'; render(); };
form.onsubmit = (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  const li = document.createElement('li');
  li.innerHTML = '<span></span><button type="button">删除</button>';
  li.querySelector('span').textContent = text;
  li.querySelector('button').onclick = () => li.remove();
  list.appendChild(li);
  input.value = '';
};
render();
""",
        },
        {
            "path": "src/styles.css",
            "content": """:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin: 0; font-family: system-ui, sans-serif; background: #0f1117; color: #eef0f5; }
.app { max-width: 440px; margin: 48px auto; padding: 0 20px; }
.eyebrow { letter-spacing: 0.18em; text-transform: uppercase; color: #8b93a7; font-size: 12px; }
h1 { margin: 4px 0 8px; font-size: 36px; }
.muted { color: #8b93a7; }
.time { font-size: 80px; letter-spacing: 2px; margin: 20px 0; }
.row { display: flex; gap: 8px; }
button { background: #7c6af7; color: white; border: 0; padding: 10px 16px; border-radius: 12px; cursor: pointer; }
button.ghost { background: #232838; color: #c5cad6; }
form { margin-top: 20px; }
input { width: 100%; padding: 10px 12px; border-radius: 10px; border: 1px solid #262c3a; background: #181c27; color: inherit; }
ul { list-style: none; padding: 0; }
li { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #262c3a; }
li button { background: transparent; color: #8b93a7; padding: 0; }
""",
        },
    ]


def _coffee() -> list[dict]:
    return [
        {
            "path": "index.html",
            "content": """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Lumen Coffee</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <header class="hero">
    <p class="brand">LUMEN</p>
    <h1>慢一点，<br/>让咖啡发光。</h1>
    <p>单产地手冲 · 城市里的安静角落</p>
    <a class="cta" href="#menu">查看系列</a>
  </header>
  <section id="menu">
    <h2>产品系列</h2>
    <div class="grid">
      <article><h3>晨雾 Ethiopia</h3><p>花香，柑橘，明亮。</p></article>
      <article><h3>夜航 Colombia</h3><p>可可，坚果，圆润。</p></article>
      <article><h3>雨季 Guatemala</h3><p>焦糖，柑皮，余韵长。</p></article>
    </div>
  </section>
  <section>
    <h2>订阅到家</h2>
    <form id="form"><input placeholder="你的邮箱" /><button>订阅月配</button></form>
    <p id="ok" hidden>已加入等待名单。</p>
  </section>
  <script src="./main.js"></script>
</body>
</html>
""",
        },
        {
            "path": "styles.css",
            "content": """body { margin: 0; font-family: Georgia, serif; background: #1b120d; color: #f6ead8; }
.hero { min-height: 70vh; padding: 64px 32px; background: radial-gradient(circle at top left, #5a3318, #1b120d); }
.brand { letter-spacing: 0.4em; }
h1 { font-size: clamp(40px, 8vw, 72px); line-height: 1.1; }
.cta, button { display: inline-block; margin-top: 20px; background: #e8b86d; color: #1b120d; padding: 12px 18px; text-decoration: none; border: 0; border-radius: 999px; }
section { padding: 48px 32px; }
.grid { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
article { padding: 16px; background: #2a1b14; border-radius: 16px; }
input { padding: 10px 12px; border-radius: 10px; border: 1px solid #5a3318; background: #2a1b14; color: inherit; }
""",
        },
        {
            "path": "main.js",
            "content": """document.getElementById('form').onsubmit = (event) => {
  event.preventDefault();
  document.getElementById('ok').hidden = false;
};
""",
        },
    ]


def _ledger() -> list[dict]:
    return [
        {
            "path": "index.html",
            "content": """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>记账本</title>
  <link rel="stylesheet" href="./styles.css" />
</head>
<body>
  <main>
    <h1>本月账本</h1>
    <p class="sum">支出合计 ¥<span id="total">0</span></p>
    <form id="form">
      <input id="name" placeholder="名称" required />
      <input id="amount" type="number" placeholder="金额" required />
      <select id="cat"><option>餐饮</option><option>交通</option><option>日用</option><option>娱乐</option></select>
      <button>记下</button>
    </form>
    <ul id="list"></ul>
    <div id="chart"></div>
  </main>
  <script src="./main.js"></script>
</body>
</html>
""",
        },
        {
            "path": "styles.css",
            "content": """body { margin: 0; font-family: system-ui, sans-serif; background: #0c1220; color: #e8eefc; }
main { max-width: 520px; margin: 40px auto; padding: 0 16px; }
.sum { color: #8aa0c8; }
form { display: grid; grid-template-columns: 1fr 100px 90px auto; gap: 8px; }
input, select, button { padding: 8px 10px; border-radius: 8px; border: 1px solid #243152; background: #151c2e; color: inherit; }
button { background: #3ee0c9; color: #08201c; border: 0; }
li { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #243152; }
.bar { height: 8px; background: #3ee0c9; border-radius: 99px; margin: 6px 0 12px; }
""",
        },
        {
            "path": "main.js",
            "content": """const items = [];
const form = document.getElementById('form');
const list = document.getElementById('list');
const totalEl = document.getElementById('total');
const chart = document.getElementById('chart');
const render = () => {
  list.innerHTML = '';
  const groups = {};
  items.forEach((item) => {
    groups[item.cat] = (groups[item.cat] || 0) + item.amount;
    const li = document.createElement('li');
    li.textContent = item.name + ' · ' + item.cat;
    const span = document.createElement('span');
    span.textContent = '¥' + item.amount;
    li.appendChild(span);
    list.appendChild(li);
  });
  const total = items.reduce((s, i) => s + i.amount, 0);
  totalEl.textContent = String(total);
  chart.innerHTML = Object.entries(groups).map(([k, v]) => {
    const w = total ? Math.round(v / total * 100) : 0;
    return '<p>' + k + ' ' + w + '%</p><div class="bar" style="width:' + w + '%"></div>';
  }).join('');
};
form.onsubmit = (event) => {
  event.preventDefault();
  items.push({ name: name.value, amount: Number(amount.value), cat: cat.value });
  form.reset();
  render();
};
render();
""",
        },
    ]


def _focus_prompt(prompt: str) -> str:
    for key in ("需求：", "用户需求："):
        if key in prompt:
            return prompt.split(key)[-1].splitlines()[0]
    return prompt.splitlines()[0] if prompt else ""


def _title_from_prompt(prompt: str) -> str:
    line = _focus_prompt(prompt)
    for prefix in ("帮我", "请", "制作", "做一个", "做个", "开发一个", "写一个"):
        if line.startswith(prefix):
            line = line[len(prefix) :]
    for sep in ("。", "，", ",", "；"):
        line = line.split(sep, 1)[0]
    return (line.strip("的 。") or "新应用")[:24]


def _generic(prompt: str) -> list[dict]:
    title = _title_from_prompt(prompt)
    return [
        {
            "path": "index.html",
            "content": f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <link rel="stylesheet" href="./src/styles.css" />
</head>
<body>
  <main class="app">
    <p class="eyebrow">Guide</p>
    <h1>{title}</h1>
    <p class="muted">按你的需求生成的页面，可继续对话改内容。</p>
    <section>
      <h2>看点</h2>
      <ul id="spots"><li>核心景点与路线</li><li>适合慢慢逛的街区</li></ul>
    </section>
    <section>
      <h2>美食</h2>
      <ul id="foods"><li>本地小吃</li><li>推荐餐厅</li></ul>
    </section>
    <form id="form">
      <input id="note" placeholder="记下想去的地方" />
      <button type="submit">添加</button>
    </form>
    <ul id="list"></ul>
  </main>
  <script src="./src/main.js"></script>
</body>
</html>
""",
        },
        {
            "path": "src/main.js",
            "content": """const form = document.getElementById('form');
const input = document.getElementById('note');
const list = document.getElementById('list');
form.onsubmit = (event) => {
  event.preventDefault();
  const text = input.value.trim();
  if (!text) return;
  const li = document.createElement('li');
  li.innerHTML = '<span></span><button type="button">删除</button>';
  li.querySelector('span').textContent = text;
  li.querySelector('button').onclick = () => li.remove();
  list.appendChild(li);
  input.value = '';
};
""",
        },
        {
            "path": "src/styles.css",
            "content": """:root { color-scheme: light; }
* { box-sizing: border-box; }
body { margin: 0; font-family: "Songti SC", "Noto Serif SC", serif; background: #f6efe4; color: #2c241c; }
.app { max-width: 640px; margin: 48px auto; padding: 0 20px 48px; }
.eyebrow { letter-spacing: 0.18em; text-transform: uppercase; color: #8a7460; font-size: 12px; }
h1 { margin: 4px 0 8px; font-size: 36px; }
h2 { margin: 28px 0 8px; font-size: 20px; }
.muted { color: #6f6256; }
section ul { padding-left: 18px; line-height: 1.8; }
form { display: flex; gap: 8px; margin-top: 24px; }
input { flex: 1; padding: 10px 12px; border: 1px solid #d8cbb8; background: #fffaf2; }
button { padding: 10px 14px; border: 0; background: #8b3a2a; color: #fff; }
#list { list-style: none; padding: 0; }
#list li { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #e6d8c6; }
""",
        },
    ]


def pick_files(prompt: str) -> list[dict]:
    text = _focus_prompt(prompt).lower()
    if any(key in text for key in ("番茄", "pomodoro", "专注", "计时")):
        return _pomodoro()
    if any(key in text for key in ("咖啡", "coffee", "落地页", "品牌")):
        return _coffee()
    if any(key in text for key in ("记账", "账本", "开销", "ledger")):
        return _ledger()
    return _generic(prompt)


def pick_stack(prompt: str) -> str:
    text = prompt.lower()
    if any(key in text for key in ("咖啡", "coffee", "落地页")):
        return "static"
    if any(key in text for key in ("记账", "账本", "图表")):
        return "static"
    return "static"
