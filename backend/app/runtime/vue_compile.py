"""Compile Vue SFCs to a single createApp bundle (no browser SFC loader)."""

from __future__ import annotations

import json
import re
from pathlib import Path

IMPORT_LINE = re.compile(
    r"""^import\s+(?:type\s+)?(?P<clause>.+?)\s+from\s+['"](?P<spec>[^'"]+)['"]\s*;?\s*$"""
    r"""|^import\s+['"](?P<bare>[^'"]+)['"]\s*;?\s*$""",
    re.M,
)
EXPORT_DEFAULT_FN = re.compile(r"export\s+default\s+function\s+(?P<name>\w+)")
EXPORT_DEFAULT_NAME = re.compile(r"export\s+default\s+(?P<name>\w+)\s*;?")
EXPORT_FN = re.compile(r"export\s+(async\s+)?function\s+(\w+)")
EXPORT_CONST = re.compile(r"export\s+(const|let|var)\s+(\w+)")
EXPORT_LIST = re.compile(r"export\s+\{([^}]+)\}")
BLOCK = re.compile(
    r"<(?P<tag>template|script|style)(?P<attrs>[^>]*)>(?P<body>[\s\S]*?)</(?P=tag)>",
    re.I,
)


def _ident(path: str) -> str:
    rel = path[2:] if path.startswith("./") else path.lstrip("/")
    return "__mod_" + re.sub(r"[^A-Za-z0-9]", "_", rel)


def _comp_name(path: str) -> str:
    return Path(path).stem[0].upper() + Path(path).stem[1:] if Path(path).stem else "Comp"


def _resolve(from_path: str, spec: str, file_map: dict[str, str]) -> str | None:
    if not spec.startswith("."):
        return None
    base = (Path(from_path).parent / spec).as_posix()
    for candidate in (base, f"{base}.vue", f"{base}.js", f"{base}.mjs", f"{base}.ts"):
        norm = candidate[2:] if candidate.startswith("./") else candidate
        if norm in file_map:
            return norm
    return None


def parse_sfc(source: str) -> dict:
    template = ""
    script = ""
    setup = False
    styles: list[str] = []
    for match in BLOCK.finditer(source):
        tag = match.group("tag").lower()
        attrs = match.group("attrs") or ""
        body = match.group("body")
        if tag == "template" and not template:
            template = body
        elif tag == "script" and not script:
            script = body
            setup = "setup" in attrs
        elif tag == "style":
            styles.append(body)
    return {"template": template, "script": script, "setup": setup, "styles": styles}


def _rewrite_imports(script: str, path: str, file_map: dict[str, str]) -> str:
    lines: list[str] = []

    def repl(match: re.Match[str]) -> str:
        spec = match.group("spec") or match.group("bare") or ""
        clause = (match.group("clause") or "").strip()
        if spec.endswith(".css") or not spec:
            return ""
        if spec in {"vue", "vue/dist/vue"}:
            if not clause or clause == "Vue":
                return ""
            star = re.match(r"\*\s+as\s+(\w+)$", clause)
            if star:
                return f"const {star.group(1)} = Vue;"
            default, _, named = clause.partition("{")
            default = default.replace(",", "").strip()
            out = []
            if default and default != "Vue":
                out.append(f"const {default} = Vue;")
            if named:
                out.append(f"const {{{named.replace('}', '')}}} = Vue;")
            return "\n".join(out)
        resolved = _resolve(path, spec, file_map)
        if resolved:
            if resolved.endswith(".vue"):
                return ""
            if clause.startswith("{") or "{" in clause:
                names = clause[clause.find("{") :].replace("{", "").replace("}", "")
                return f"const {{{names}}} = {_ident(resolved)};"
            default = clause.split(",")[0].strip()
            if default:
                return f"const {default} = {_ident(resolved)}.default || {_ident(resolved)};"
            return ""
        return ""

    rewritten = IMPORT_LINE.sub(repl, script)
    for line in rewritten.splitlines():
        if line.strip():
            lines.append(line)
    return "\n".join(lines)


def _compile_js_module(source: str, path: str, file_map: dict[str, str]) -> str:
    body = _rewrite_imports(source, path, file_map)
    exports: list[str] = []
    for _, name in EXPORT_FN.findall(body):
        exports.append(name)
    body = EXPORT_FN.sub(r"\1function \2", body)
    for _, name in EXPORT_CONST.findall(body):
        exports.append(name)
    body = EXPORT_CONST.sub(r"\1 \2", body)
    listed = EXPORT_LIST.search(body)
    if listed:
        exports.extend(item.split(" as ")[-1].strip() for item in listed.group(1).split(",") if item.strip())
        body = EXPORT_LIST.sub("", body)
    default = EXPORT_DEFAULT_FN.search(body)
    if default:
        body = EXPORT_DEFAULT_FN.sub(r"function \g<name>", body, count=1)
        exports.append("default: " + default.group("name"))
    named = EXPORT_DEFAULT_NAME.search(body)
    if named:
        body = EXPORT_DEFAULT_NAME.sub("", body)
        exports.append("default: " + named.group("name"))
    body = re.sub(r"export\s+default\s+", "const __default = ", body)
    if "__default" in body:
        exports.append("default: __default")
    export_obj = ", ".join(dict.fromkeys(exports))
    return f"const {_ident(path)} = (function () {{\n{body}\nreturn {{ {export_obj} }};\n}})();\n"


def _compile_sfc(source: str, path: str, file_map: dict[str, str]) -> str:
    parsed = parse_sfc(source)
    name = _comp_name(path)
    script = _rewrite_imports(parsed["script"], path, file_map)
    template_js = json.dumps(parsed["template"], ensure_ascii=False)
    if parsed["setup"]:
        names = re.findall(r"(?:const|let|var|function|class|async function)\s+([A-Za-z_]\w*)", script)
        returned = ", ".join(dict.fromkeys(names))
        inner = (
            f"const __comp = {{ name: {name!r}, setup() {{\n{script}\n"
            f"return {{ {returned} }};\n}} }};\n"
        )
    else:
        if EXPORT_DEFAULT_FN.search(script):
            script = EXPORT_DEFAULT_FN.sub(r"function \g<name>", script, count=1)
            inner = f"{script}\nconst __comp = {name};\n"
        elif EXPORT_DEFAULT_NAME.search(script):
            exported = EXPORT_DEFAULT_NAME.search(script).group("name")
            script = EXPORT_DEFAULT_NAME.sub("", script)
            inner = f"{script}\nconst __comp = {exported};\n"
        else:
            script = re.sub(r"export\s+default\s+", "const __comp = ", script, count=1)
            if "const __comp =" not in script:
                inner = f"{script}\nconst __comp = {{ name: {name!r} }};\n"
            else:
                inner = script + "\n"
    styles = "\n".join(parsed["styles"])
    style_js = ""
    if styles:
        style_js = (
            "const __s = document.createElement('style');"
            f"__s.textContent = {json.dumps(styles, ensure_ascii=False)};"
            "document.head.appendChild(__s);\n"
        )
    return (
        f"const {name} = (function () {{\n"
        f"{style_js}{inner}"
        f"__comp.name = __comp.name || {name!r};\n"
        f"__comp.template = {template_js};\n"
        f"return __comp;\n"
        f"}})();\n"
    )


def _topo(file_map: dict[str, str]) -> list[str]:
    paths = [
        p
        for p in file_map
        if p.endswith((".vue", ".js", ".mjs")) and Path(p).name not in {"main.js", "main.ts", "index.js"}
    ]
    deps: dict[str, set[str]] = {p: set() for p in paths}
    for path in paths:
        for spec in re.findall(r"""from\s+['"]([^'"]+)['"]""", file_map[path]):
            resolved = _resolve(path, spec, file_map)
            if resolved in deps:
                deps[path].add(resolved)
    ordered: list[str] = []
    pending = set(paths)
    while pending:
        ready = [p for p in pending if deps[p] <= set(ordered)]
        if not ready:
            ready = [next(iter(pending))]
        ready.sort()
        pick = ready[0]
        ordered.append(pick)
        pending.remove(pick)
    return ordered


def _entry_name(file_map: dict[str, str]) -> str:
    for name in ("src/App.vue", "App.vue", "src/app.vue"):
        if name in file_map:
            return _comp_name(name)
    vue = [p for p in file_map if p.endswith(".vue")]
    return _comp_name(vue[0]) if vue else "App"


def compile_vue_app(file_map: dict[str, str]) -> str:
    chunks = ["const { createApp } = Vue;"]
    for path in _topo(file_map):
        source = file_map[path]
        if path.endswith(".vue"):
            chunks.append(f"/* {path} */\n{_compile_sfc(source, path, file_map)}")
        else:
            chunks.append(f"/* {path} */\n{_compile_js_module(source, path, file_map)}")
    entry = _entry_name(file_map)
    chunks.append(
        f"""
const __mount = document.getElementById('app') || document.getElementById('root') || document.body;
createApp({entry}).mount(__mount);
document.getElementById('__atoms_boot')?.remove();
"""
    )
    return "\n".join(chunks)
