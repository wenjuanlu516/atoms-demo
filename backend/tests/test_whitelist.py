from app.runtime.whitelist import static_check


def test_missing_entry_is_blocker():
    report = static_check([{"path": "app.js", "content": "console.log(1)"}], {})
    assert report["passed"] is False
    assert any(i["file"] == "index.html" for i in report["issues"])


def test_illegal_import_is_blocker():
    files = [
        {"path": "index.html", "content": "<html></html>"},
        {"path": "src/a.js", "content": "import x from 'lodash'"},
    ]
    report = static_check(files, {})
    assert any("lodash" in i["desc"] for i in report["issues"])


def test_relative_import_ok():
    files = [
        {"path": "index.html", "content": "<html></html>"},
        {"path": "src/a.js", "content": "import x from './b.js'"},
    ]
    report = static_check(files, {})
    assert report["passed"] is True
