from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, HTMLResponse

from app.config import get_settings
from app.runtime.preview_html import rewrite_preview_html


router = APIRouter(tags=["preview"])

ALLOWED_SUFFIX = {
    ".html",
    ".htm",
    ".js",
    ".jsx",
    ".ts",
    ".tsx",
    ".css",
    ".json",
    ".svg",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".mjs",
    ".map",
    ".vue",
}


@router.get("/p/{slug}")
def published_index(slug: str):
    return published_file(slug, "index.html")


@router.get("/p/{slug}/{path:path}")
def published_file(slug: str, path: str):
    settings = get_settings()
    root = (settings.publish_root / slug).resolve()
    return _serve_static(root, path)


@router.get("/preview/{pid}/v{version}/{path:path}")
def preview_file(pid: int, version: int, path: str):
    settings = get_settings()
    root = (settings.preview_root / str(pid) / f"v{version}").resolve()
    return _serve_static(root, path)


def _serve_static(root, path: str):
    target = (root / path).resolve()
    if root not in target.parents and target != root:
        raise HTTPException(status_code=400, detail="Invalid path")
    if target.suffix.lower() not in ALLOWED_SUFFIX and target.name != "__atoms_hook.js":
        raise HTTPException(status_code=404, detail="Not allowed")
    if not target.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    if target.suffix.lower() in {".html", ".htm"}:
        html = rewrite_preview_html(target.read_text(encoding="utf-8"), root=root)
        return HTMLResponse(html, headers={"Cache-Control": "no-store"})
    return FileResponse(target)
