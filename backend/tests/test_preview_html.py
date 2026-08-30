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


def test_static_html_untouched():
    html = "<html><body><h1>hi</h1></body></html>"
    out = rewrite_preview_html(html, files=[{"path": "index.html", "content": html}])
    assert "text/babel" not in out
    assert "react.production.min.js" not in out
