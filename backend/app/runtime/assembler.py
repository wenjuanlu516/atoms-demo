from pathlib import Path

from app.config import get_settings
HOOK_TAG = '<script src="./__atoms_hook.js"></script>'


def _inject_html(html: str, *, inject_hook: bool, files: list[dict] | None = None) -> str:
    result = html
    if inject_hook and "__atoms_hook.js" not in result:
        snippet = HOOK_TAG
        if "</body>" in result:
            result = result.replace("</body>", snippet + "\n</body>", 1)
        else:
            result += snippet
    return result


def assemble(project_id: int, version: int, files: list[dict], *, publish: bool = False) -> Path:
    settings = get_settings()
    root = settings.publish_root if publish else settings.preview_root
    dest = root / str(project_id) / f"v{version}"
    dest.mkdir(parents=True, exist_ok=True)

    hook_src = Path(__file__).with_name("hook.js").read_text(encoding="utf-8")
    if not publish:
        (dest / "__atoms_hook.js").write_text(hook_src, encoding="utf-8")

    for file in files:
        path = dest / file["path"]
        path.parent.mkdir(parents=True, exist_ok=True)
        content = file["content"]
        if path.suffix in {".html", ".htm"}:
            content = _inject_html(content, inject_hook=not publish, files=files)
        path.write_text(content, encoding="utf-8")
    return dest
