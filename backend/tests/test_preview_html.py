from app.runtime.preview_html import rewrite_preview_html


def test_rewrites_react_jsx_app_for_iframe():
    html = """<!doctype html><html><head><title>天府</title></head>
<body><div id="root"></div>
<script type="module" src="/src/App.jsx"></script>
</body></html>"""
    files = [
        {"path": "index.html", "content": html},
        {
            "path": "src/App.jsx",
            "content": (
                "import React from 'react';\n"
                "import './styles.css';\n"
                "const App = () => <div className='poster'>成都天府新区</div>;\n"
                "export default App;\n"
            ),
        },
        {"path": "src/styles.css", "content": ".poster { color: red; }"},
    ]
    out = rewrite_preview_html(html, files=files)
    assert 'src="./src/App.jsx"' not in out or "text/babel" in out
    assert "/src/App.jsx" not in out
    assert "react.production.min.js" in out
    assert "text/babel" not in out
    assert "ReactDOM.createRoot" in out
    assert "React.createElement" in out
    assert "成都天府新区" in out
    assert "__atoms_boot" in out


def test_rewrites_vue_sfc_app_for_iframe():
    html = """<!doctype html><html><head><title>成都</title>
<link rel="stylesheet" href="./src/styles.css"></head>
<body><div id="app"></div>
<script src="./src/main.js"></script>
</body></html>"""
    files = [
        {"path": "index.html", "content": html},
        {"path": "src/main.js", "content": "import { createApp } from 'vue'; import App from './App.vue'; createApp(App).mount('#app');"},
        {
            "path": "src/App.vue",
            "content": "<template><div class='poster'><h1>成都·慢生活</h1></div></template>\n<script>export default { name: 'App' }</script>",
        },
        {"path": "src/styles.css", "content": ".poster { background: #f5f0eb; }"},
    ]
    out = rewrite_preview_html(html, files=files)
    assert "vue3-sfc-loader" not in out
    assert "vue.global.prod.js" in out
    assert "成都·慢生活" in out
    assert '<script src="./src/main.js">' not in out
    assert "createApp(App)" in out
    assert "__atoms_boot" in out


def test_dedupes_react_hooks_across_files():
    html = """<!doctype html><html><body><div id="root"></div>
<script type="module" src="./src/main.jsx"></script></body></html>"""
    files = [
        {"path": "index.html", "content": html},
        {
            "path": "src/main.jsx",
            "content": "import { createRoot } from 'react-dom/client';\nimport App from './App.jsx';\ncreateRoot(document.getElementById('root')).render(<App />);\n",
        },
        {
            "path": "src/App.jsx",
            "content": "import { useState } from 'react';\nexport default function App() { const [n, setN] = useState(0); return <p>{n}</p>; }\n",
        },
        {
            "path": "src/Timer.jsx",
            "content": "import { useState, useEffect } from 'react';\nexport default function Timer() { const [t, setT] = useState(0); useEffect(() => {}, []); return <span>{t}</span>; }\n",
        },
    ]
    out = rewrite_preview_html(html, files=files)
    assert out.count("useState") >= 1
    assert out.count("} = React;") == 1
    assert "useEffect" in out
    assert "const { createRoot } = ReactDOM;" in out
    assert out.count("const { createRoot }") == 1


def test_static_html_untouched():
    html = "<html><body><h1>hi</h1></body></html>"
    out = rewrite_preview_html(html, files=[{"path": "index.html", "content": html}])
    assert "text/babel" not in out
    assert "react.production.min.js" not in out


def test_rewrites_app_jsx_script_even_if_preview_marker_present():
    html = """<!DOCTYPE html>
<html lang="zh-CN" data-atoms-preview="1">
<head>
  <meta charset="UTF-8">
  <title>番茄钟工作法</title>
</head>
<body>
  <div id="root"></div>
  <script src="./src/App.jsx" type="module"></script>
</body>
</html>"""
    files = [
        {"path": "index.html", "content": html},
        {
            "path": "src/App.jsx",
            "content": (
                "import { useState } from 'react';\n"
                "export default function App() {\n"
                "  const [n, setN] = useState(0);\n"
                "  return <h1>番茄钟</h1>;\n"
                "}\n"
            ),
        },
    ]
    out = rewrite_preview_html(html, files=files)
    assert 'src="./src/App.jsx"' not in out
    assert "type=\"module\"" not in out or "importmap" in out
    assert "React.createElement" in out
    assert "番茄钟" in out
    assert "react.production.min.js" in out


def test_strips_inline_babel_and_does_not_double_createroot():
    html = """<!doctype html><html><head>
<script src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@babel/standalone@7.26.10/babel.min.js"></script>
</head><body><div id="root"></div>
<script type="text/babel" data-presets="react">
const { createRoot } = ReactDOM;
function App() { return <h1>欢迎</h1>; }
createRoot(document.getElementById('root')).render(<App />);
</script>
</body></html>"""
    files = [
        {"path": "index.html", "content": html},
        {
            "path": "src/App.jsx",
            "content": "import { createRoot } from 'react-dom/client';\nfunction App(){return <h1>欢迎</h1>;}\ncreateRoot(document.getElementById('root')).render(<App />);\n",
        },
    ]
    out = rewrite_preview_html(html, files=files)
    assert "text/babel" not in out
    assert "babel.min.js" not in out
    assert out.count("const { createRoot }") == 1
    assert "React.createElement" in out
    assert "欢迎" in out


def test_compiles_jsx_inside_plain_js_entry():
    html = """<!doctype html><html><body><div id="root"></div>
<script type="module" src="./src/index.js"></script></body></html>"""
    files = [
        {"path": "index.html", "content": html},
        {
            "path": "src/index.js",
            "content": (
                "import { createRoot } from 'react-dom/client';\n"
                "import App from './App.jsx';\n"
                "createRoot(document.getElementById('root')).render(<App />);\n"
            ),
        },
        {
            "path": "src/App.jsx",
            "content": "export default function App() { return <p>ok</p>; }\n",
        },
    ]
    out = rewrite_preview_html(html, files=files)
    assert "<App" not in out
    assert 'src="./src/index.js"' not in out
    assert "React.createElement(App" in out
