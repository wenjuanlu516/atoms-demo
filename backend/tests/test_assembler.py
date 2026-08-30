from app.config import get_settings
from app.runtime.assembler import assemble


def test_assemble_injects_hook(tmp_path, monkeypatch):
    monkeypatch.setenv("DATA_DIR", str(tmp_path))
    get_settings.cache_clear()
    dest = assemble(
        1,
        1,
        [{"path": "index.html", "content": "<html><body>hi</body></html>"}],
        publish=False,
    )
    html = (dest / "index.html").read_text()
    assert "__atoms_hook.js" in html
    assert (dest / "__atoms_hook.js").exists()
    get_settings.cache_clear()
