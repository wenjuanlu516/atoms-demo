from app.runtime.vue_compile import compile_vue_app


def test_compile_vue_options_api_app():
    files = {
        "src/App.vue": (
            "<template><div class='poster'><h1>成都·慢生活</h1><Carousel /></div></template>\n"
            "<script>\n"
            "import { ref } from 'vue';\n"
            "import Carousel from './components/Carousel.vue';\n"
            "export default { name: 'App', components: { Carousel }, setup() { const n = ref(0); return { n }; } };\n"
            "</script>"
        ),
        "src/components/Carousel.vue": (
            "<template><div class='c'>{{ title }}</div></template>\n"
            "<script>\n"
            "export default { name: 'Carousel', setup() { return { title: '轮播' }; } };\n"
            "</script>"
        ),
    }
    js = compile_vue_app(files)
    assert "const { createApp } = Vue" in js
    assert "const App = (function" in js
    assert "const Carousel = (function" in js
    assert "成都·慢生活" in js
    assert "createApp(App).mount" in js
    assert "from 'vue'" not in js
    assert "vue3-sfc-loader" not in js
