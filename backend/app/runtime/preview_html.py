"""Make LLM-generated React/Vue previews runnable in a no-build iframe."""

from __future__ import annotations

import re
from pathlib import Path

from app.runtime.jsx_compile import compile_jsx
from app.runtime.vue_compile import compile_vue_app

IMPORT_MAP = """
<script type="importmap">
{
  "imports": {
    "react": "https://esm.sh/react@18.3.1",
    "react-dom": "https://esm.sh/react-dom@18.3.1",
    "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
    "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
    "vue": "https://esm.sh/vue@3.5.13",
    "chart.js": "https://esm.sh/chart.js@4.4.6",
    "lucide": "https://esm.sh/lucide@0.460.0"
  }
}
</script>
"""

REACT_RUNTIME = """
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
<link rel="preload" as="script" href="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js" />
<link rel="preload" as="script" href="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js" />
<script src="https://cdn.jsdelivr.net/npm/react@18.3.1/umd/react.production.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/react-dom@18.3.1/umd/react-dom.production.min.js"></script>
"""

VUE_RUNTIME = """
<link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin />
<link rel="preload" as="script" href="https://cdn.jsdelivr.net/npm/vue@3.5.13/dist/vue.global.prod.js" />
<script src="https://cdn.jsdelivr.net/npm/vue@3.5.13/dist/vue.global.prod.js"></script>
"""

BOOT_STYLE = """
<style>
#__atoms_boot{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;
background:var(--atoms-boot-bg,#f4f1ec);color:#8a8178;font:13px/1.4 -apple-system,BlinkMacSystemFont,sans-serif;z-index:2147483646}
#__atoms_boot span{opacity:.75}
</style>
"""

BOOT_HTML = '<div id="__atoms_boot"><span>正在渲染…</span></div>'

TEXT_SUFFIXES = {".html", ".htm", ".js", ".jsx", ".ts", ".tsx", ".css", ".mjs", ".vue", ".json"}
EMBED_SUFFIXES = {".vue", ".js", ".mjs", ".css", ".json", ".ts"}

ABS_ASSET = re.compile(
    r"""(?P<attr>src|href)=(?P<q>['"])/(?P<path>(?:src|assets|public)/[^'"]+)(?P=q)"""
)
JSX_SCRIPT = re.compile(
    r"""<script\b[^>]*\bsrc=['"][^'"]+\.(?:jsx|tsx)['"][^>]*>\s*</script>""",
    re.I,
)
LOCAL_APP_SCRIPT = re.compile(
    r"""<script\b[^>]*\bsrc=['"](?!https?:)(?![^'"]*__atoms_hook)[^'"]+\.(?:js|mjs|jsx|tsx|vue)['"][^>]*>\s*</script>""",
    re.I,
)
IMPORT_LINE = re.compile(
    r"""^import\s+(?:type\s+)?(?P<clause>.+?)\s+from\s+['"](?P<spec>[^'"]+)['"]\s*;?\s*$"""
    r"""|^import\s+['"](?P<bare>[^'"]+)['"]\s*;?\s*$""",
    re.M,
)
EXPORT_DEFAULT_FN = re.compile(r"export\s+default\s+function\s+(?P<name>\w+)")
EXPORT_DEFAULT_CLASS = re.compile(r"export\s+default\s+class\s+(?P<name>\w+)")
EXPORT_DEFAULT_NAME = re.compile(r"export\s+default\s+(?P<name>\w+)\s*;?")
EXPORT_KW = re.compile(r"export\s+(?=async\s+)?(?=function|class|const|let|var)\s*")
REACT_DESTRUCTURE = re.compile(
    r"^[ \t]*const[ \t]*\{([^}]+)\}[ \t]*=[ \t]*React[ \t]*;?[ \t]*$",
    re.M,
)
MODULE_SUFFIXES = {".jsx", ".tsx", ".js", ".mjs", ".ts"}


def _file_map_from_root(root: Path) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        if path.name.startswith("__"):
            continue
        rel = path.relative_to(root).as_posix()
        mapping[rel] = path.read_text(encoding="utf-8")
    return mapping


def _insert_in_head(html: str, snippet: str) -> str:
    if "<head>" in html:
        return html.replace("<head>", "<head>\n" + snippet, 1)
    return snippet + html


def _insert_before_body_end(html: str, snippet: str) -> str:
    if "</body>" in html:
        return html.replace("</body>", snippet + "\n</body>", 1)
    return html + snippet


def _rewrite_abs_paths(html: str) -> str:
    return ABS_ASSET.sub(lambda m: f"{m.group('attr')}={m.group('q')}./{m.group('path')}{m.group('q')}", html)


def _jsx_paths(file_map: dict[str, str]) -> list[str]:
    return sorted(p for p in file_map if p.endswith((".jsx", ".tsx")))


def _vue_paths(file_map: dict[str, str]) -> list[str]:
    return sorted(p for p in file_map if p.endswith(".vue"))


def _vue_entry(file_map: dict[str, str]) -> str | None:
    for name in ("src/App.vue", "App.vue", "src/app.vue"):
        if name in file_map:
            return f"./{name}"
    paths = _vue_paths(file_map)
    return f"./{paths[0]}" if paths else None


def _css_paths(file_map: dict[str, str]) -> list[str]:
    return sorted(p for p in file_map if p.endswith(".css"))


def _ensure_css_links(html: str, file_map: dict[str, str]) -> str:
    chunks = [file_map[path] for path in _css_paths(file_map)]
    if chunks:
        html = _insert_in_head(html, f"<style>\n{chr(10).join(chunks)}\n</style>\n")
    bg = _boot_bg(chunks)
    html = _insert_in_head(html, BOOT_STYLE.replace("#f4f1ec", bg))
    if 'id="__atoms_boot"' not in html:
        if "<body" in html:
            html = re.sub(r"(<body[^>]*>)", r"\1\n" + BOOT_HTML, html, count=1)
        else:
            html = BOOT_HTML + html
    return html


def _boot_bg(css_chunks: list[str]) -> str:
    blob = "\n".join(css_chunks)
    match = re.search(r"body\s*\{[^}]*background(?:-color)?\s*:\s*([^;]+)", blob)
    if match:
        return match.group(1).strip()
    return "#f4f1ec"


def _needs_import_map(html: str, file_map: dict[str, str]) -> bool:
    if "importmap" in html:
        return False
    blob = html + "\n".join(file_map.values())
    return "from 'react'" in blob or 'from "react"' in blob or "react-dom" in blob


def _collect_named(inner: str, dest: dict[str, str]) -> None:
    for part in inner.split(","):
        part = part.strip()
        if not part:
            continue
        if re.search(r"\sas\s", part):
            orig, alias = re.split(r"\s+as\s+", part, maxsplit=1)
            dest[alias.strip()] = orig.strip()
        elif ":" in part:
            orig, _, alias = part.partition(":")
            dest[alias.strip()] = orig.strip()
        else:
            dest[part] = part


def _parse_import_clause(
    clause: str, spec: str, react_binds: dict[str, str], dom_names: set[str]
) -> str:
    clause = clause.strip()
    if spec == "react/jsx-runtime":
        return ""
    if spec == "react":
        star = re.match(r"\*\s+as\s+(\w+)$", clause)
        if star:
            return f"var {star.group(1)} = React;"
        default, _, named = clause.partition("{")
        default = default.replace(",", "").strip()
        lines = []
        if default and default != "React":
            lines.append(f"var {default} = React;")
        if named:
            _collect_named(named.replace("}", ""), react_binds)
        return "\n".join(lines)
    if spec in {"react-dom", "react-dom/client"}:
        if "createRoot" in clause or "*" in clause:
            dom_names.add("createRoot")
        default, _, named = clause.partition("{")
        default = default.replace(",", "").strip()
        if default and default not in {"ReactDOM", "ReactDom"}:
            return f"var {default} = ReactDOM;"
        return ""
    return ""


def _hoist_react_destructures(source: str, react_binds: dict[str, str]) -> str:
    def take(match: re.Match[str]) -> str:
        _collect_named(match.group(1), react_binds)
        return ""

    return REACT_DESTRUCTURE.sub(take, source)


def _react_prelude(react_binds: dict[str, str], dom_names: set[str]) -> str:
    lines: list[str] = []
    same = sorted(name for name, orig in react_binds.items() if name == orig)
    if same:
        lines.append("const { " + ", ".join(same) + " } = React;")
    for name, orig in sorted(react_binds.items()):
        if name != orig:
            lines.append(f"const {name} = React.{orig};")
    if dom_names:
        lines.append("const { " + ", ".join(sorted(dom_names)) + " } = ReactDOM;")
    return ("\n".join(lines) + "\n") if lines else ""


def _demodule(
    source: str, react_binds: dict[str, str], dom_names: set[str]
) -> tuple[str, str | None]:
    default_name: str | None = None
    fn = EXPORT_DEFAULT_FN.search(source)
    if fn:
        default_name = fn.group("name")
        source = EXPORT_DEFAULT_FN.sub(r"function \g<name>", source, count=1)
    cls = EXPORT_DEFAULT_CLASS.search(source)
    if cls:
        default_name = default_name or cls.group("name")
        source = EXPORT_DEFAULT_CLASS.sub(r"class \g<name>", source, count=1)
    named = EXPORT_DEFAULT_NAME.search(source)
    if named:
        default_name = default_name or named.group("name")
        source = EXPORT_DEFAULT_NAME.sub("", source)
    source = re.sub(r"export\s+default\s+", "const __DefaultExport = ", source)
    source = EXPORT_KW.sub("", source)

    def repl(match: re.Match[str]) -> str:
        spec = match.group("spec") or match.group("bare") or ""
        if spec.endswith(".css") or not spec:
            return ""
        if spec.startswith(".") or spec.startswith("/"):
            return ""
        clause = match.group("clause")
        if clause:
            return _parse_import_clause(clause, spec, react_binds, dom_names)
        return ""

    source = IMPORT_LINE.sub(repl, source)
    source = _hoist_react_destructures(source, react_binds)
    return source, default_name


def _module_paths(file_map: dict[str, str]) -> list[str]:
    paths = [
        path
        for path in file_map
        if Path(path).suffix.lower() in MODULE_SUFFIXES and not Path(path).name.startswith("__")
    ]
    return sorted(paths)


def _topo_jsx(file_map: dict[str, str]) -> list[str]:
    paths = _module_paths(file_map)
    dependents: dict[str, set[str]] = {p: set() for p in paths}
    for path in paths:
        for spec in re.findall(r"""from\s+['"]([^'"]+)['"]""", file_map[path]):
            if not spec.startswith("."):
                continue
            base = str(Path(path).parent / spec).replace("\\", "/")
            for candidate in (base, f"{base}.jsx", f"{base}.tsx", f"{base}.js"):
                norm = candidate.lstrip("./")
                if norm in dependents:
                    dependents[path].add(norm)
    ordered: list[str] = []
    pending = set(paths)
    while pending:
        ready = [p for p in pending if dependents[p] <= set(ordered)]
        if not ready:
            ready = [next(iter(pending))]
        ready.sort()
        pick = ready[0]
        ordered.append(pick)
        pending.remove(pick)
    return ordered


def _bundle_jsx(file_map: dict[str, str]) -> str:
    chunks: list[str] = []
    default_name: str | None = None
    has_mount = False
    react_binds: dict[str, str] = {}
    dom_names: set[str] = set()
    for path in _topo_jsx(file_map):
        body, name = _demodule(file_map[path], react_binds, dom_names)
        default_name = name or default_name
        if "createRoot(" in body or "ReactDOM.render(" in body:
            has_mount = True
        chunks.append(f"/* {path} */\n{body.strip()}\n")
    bundle = _react_prelude(react_binds, dom_names) + "\n".join(chunks)
    bundle = compile_jsx(bundle)
    if not has_mount:
        component = default_name or "__DefaultExport"
        bundle += f"""
const __atomsRoot = document.getElementById('root');
if (__atomsRoot && typeof {component} !== 'undefined') {{
  ReactDOM.createRoot(__atomsRoot).render(React.createElement({component}));
}}
"""
    bundle += "\ndocument.getElementById('__atoms_boot')?.remove();\n"
    return bundle


def _script_tag(js: str) -> str:
    return "<script>\n" + js.replace("</", "<\\/") + "\n</script>"


def rewrite_preview_html(
    html: str,
    *,
    files: list[dict] | None = None,
    root: Path | None = None,
) -> str:
    file_map: dict[str, str] = {}
    if files:
        file_map = {f["path"].replace("\\", "/"): f.get("content", "") for f in files}
    elif root is not None:
        file_map = _file_map_from_root(root)

    if 'data-atoms-preview="1"' in html:
        return html
    result = _rewrite_abs_paths(html)
    jsx = _jsx_paths(file_map)
    vue = _vue_paths(file_map)
    if jsx:
        result = JSX_SCRIPT.sub("", result)
        result = LOCAL_APP_SCRIPT.sub("", result)
        result = _ensure_css_links(result, file_map)
        if "react.production.min.js" not in result:
            result = _insert_in_head(result, REACT_RUNTIME)
        if "__atomsRoot" not in result:
            result = _insert_before_body_end(result, _script_tag(_bundle_jsx(file_map)))
    elif vue:
        result = LOCAL_APP_SCRIPT.sub("", result)
        result = _ensure_css_links(result, file_map)
        if "vue.global.prod.js" not in result:
            result = _insert_in_head(result, VUE_RUNTIME)
        result = _insert_before_body_end(result, _script_tag(compile_vue_app(file_map)))
    elif _needs_import_map(result, file_map):
        result = _insert_in_head(result, IMPORT_MAP)
        result = _ensure_css_links(result, file_map)
    if "<html" in result:
        result = re.sub(r"<html\b", '<html data-atoms-preview="1"', result, count=1)
    else:
        result = '<!-- data-atoms-preview="1" -->' + result
    return result
