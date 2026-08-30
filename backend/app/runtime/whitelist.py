import re

ALLOWED_PACKAGES = {
    "react",
    "react-dom",
    "react-dom/client",
    "vue",
    "chart.js",
    "lucide",
}

ALLOWED_CDN = (
    "https://esm.sh/",
    "https://unpkg.com/",
    "https://cdn.jsdelivr.net/",
    "https://fonts.googleapis.com/",
    "https://fonts.gstatic.com/",
)

BLOCKER_PATTERNS = [
    (r"\bTODO\b", "Contains TODO placeholder"),
    (r"your-api-key", "Contains API key placeholder"),
    (r"document\.cookie", "Accesses document.cookie"),
    (r"\beval\s*\(", "Uses eval()"),
]

IMPORT_RE = re.compile(r"""(?:import|from)\s+['"]([^'"]+)['"]""")
FETCH_RE = re.compile(r"fetch\s*\(\s*['\"](https?://[^'\"]+)['\"]")


def _is_allowed_import(spec: str) -> bool:
    if spec.startswith(".") or spec.startswith("/"):
        return True
    if spec in ALLOWED_PACKAGES:
        return True
    return spec.startswith(ALLOWED_CDN)


def static_check(files: list[dict], blueprint: dict) -> dict:
    issues: list[dict] = []
    paths = {f.get("path", "") for f in files}
    if not any(path.endswith("index.html") or path == "index.html" for path in paths):
        issues.append({"file": "index.html", "severity": "blocker", "desc": "Missing HTML entry"})

    for file in files:
        path = file.get("path", "")
        content = file.get("content", "")
        for spec in IMPORT_RE.findall(content):
            if not _is_allowed_import(spec):
                issues.append({"file": path, "severity": "blocker", "desc": f"Import not in whitelist: {spec}"})
        for pattern, desc in BLOCKER_PATTERNS:
            if re.search(pattern, content):
                issues.append({"file": path, "severity": "blocker", "desc": desc})
        for url in FETCH_RE.findall(content):
            if not url.startswith(ALLOWED_CDN):
                issues.append({"file": path, "severity": "warning", "desc": f"External fetch: {url}"})
    return {"issues": issues, "passed": not any(i["severity"] == "blocker" for i in issues)}
