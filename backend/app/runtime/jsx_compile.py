"""Minimal JSX → React.createElement transform for no-build preview."""

from __future__ import annotations

import json


def compile_jsx(source: str) -> str:
    out: list[str] = []
    i = 0
    n = len(source)

    def peek(offset: int = 0) -> str:
        idx = i + offset
        return source[idx] if idx < n else ""

    def starts_jsx() -> bool:
        if peek() != "<":
            return False
        nxt = peek(1)
        if nxt in ("/", ">", "!"):
            return True
        return nxt.isalpha() or nxt in ("_", "$")

    def skip_ws() -> None:
        nonlocal i
        while i < n and source[i] in " \t\r\n":
            i += 1

    def read_ident() -> str:
        nonlocal i
        start = i
        while i < n and (source[i].isalnum() or source[i] in "_$:-"):
            i += 1
        return source[start:i]

    def read_string() -> str:
        nonlocal i
        quote = source[i]
        i += 1
        start = i
        while i < n and source[i] != quote:
            if source[i] == "\\":
                i += 2
                continue
            i += 1
        text = source[start:i]
        i += 1
        return quote + text + quote

    def parse_braces() -> str:
        nonlocal i
        assert source[i] == "{"
        i += 1
        depth = 1
        start = i
        while i < n and depth:
            if source[i] in "'\"":
                read_string()
                continue
            if source[i] == "`":
                parse_backtick()
                continue
            if source[i] == "{":
                depth += 1
            elif source[i] == "}":
                depth -= 1
                if depth == 0:
                    break
            elif source[i] == "<" and starts_jsx():
                before = source[start:i]
                inner = parse_element()
                start = i
                return before + inner + parse_after_nested()
            i += 1
        body = source[start:i]
        if i < n and source[i] == "}":
            i += 1
        return body

    def parse_after_nested() -> str:
        nonlocal i
        start = i
        depth = 1
        parts = [""]
        while i < n and depth:
            if source[i] == "{":
                depth += 1
                i += 1
            elif source[i] == "}":
                depth -= 1
                if depth == 0:
                    break
                i += 1
            elif source[i] == "<" and starts_jsx():
                parts.append(source[start:i])
                parts.append(parse_element())
                start = i
            else:
                i += 1
        parts.append(source[start:i])
        if i < n and source[i] == "}":
            i += 1
        return "".join(parts)

    def parse_backtick() -> None:
        nonlocal i
        i += 1
        while i < n and source[i] != "`":
            if source[i] == "\\":
                i += 2
                continue
            i += 1
        if i < n:
            i += 1

    def parse_element() -> str:
        nonlocal i
        assert source[i] == "<"
        i += 1
        if peek() == ">":
            i += 1
            children = parse_children("")
            return f"React.createElement(React.Fragment, null{children})"
        if peek() == "/":
            i += 1
            read_ident()
            skip_ws()
            if peek() == ">":
                i += 1
            return ""
        if peek() == "!":
            while i < n and source[i] != ">":
                i += 1
            if i < n:
                i += 1
            return "null"
        name = read_ident()
        tag = json_ident(name)
        props: list[str] = []
        spread: list[str] = []
        while True:
            skip_ws()
            if peek() == "/" and peek(1) == ">":
                i += 2
                return emit(tag, props, spread, "")
            if peek() == ">":
                i += 1
                kids = parse_children(name)
                return emit(tag, props, spread, kids)
            if peek() == "{":
                spread.append(parse_braces())
                continue
            attr = read_ident()
            if not attr:
                i += 1
                continue
            skip_ws()
            if peek() != "=":
                props.append(f"{js_key(attr)}: true")
                continue
            i += 1
            skip_ws()
            if peek() == "{":
                props.append(f"{js_key(attr)}: ({parse_braces()})")
            elif peek() in "'\"":
                props.append(f"{js_key(attr)}: {read_string()}")
            else:
                props.append(f"{js_key(attr)}: true")

    def parse_children(closing: str) -> str:
        nonlocal i
        parts: list[str] = []
        text: list[str] = []

        def flush() -> None:
            raw = "".join(text)
            text.clear()
            if raw.strip():
                parts.append(json.dumps(collapse(raw), ensure_ascii=False))

        while i < n:
            if source[i] == "<":
                if peek(1) == "/" or (peek(1) == ">" and closing == ""):
                    flush()
                    i += 1
                    if peek() == "/":
                        i += 1
                    read_ident()
                    skip_ws()
                    if peek() == ">":
                        i += 1
                    break
                if starts_jsx() or peek(1) == "!":
                    flush()
                    parts.append(parse_element())
                    continue
            if source[i] == "{":
                flush()
                expr = parse_braces()
                if not expr.strip().startswith("/*"):
                    parts.append(f"({expr})")
                continue
            text.append(source[i])
            i += 1
        flush()
        if not parts:
            return ""
        return ", " + ", ".join(parts)

    def emit(tag: str, props: list[str], spread: list[str], children: str) -> str:
        if not props and not spread:
            prop = "null"
        elif spread and not props:
            prop = spread[0] if len(spread) == 1 else f"Object.assign({{}}, {', '.join(spread)})"
        elif spread:
            prop = f"Object.assign({{ {', '.join(props)} }}, {', '.join(spread)})"
        else:
            prop = "{ " + ", ".join(props) + " }"
        return f"React.createElement({tag}, {prop}{children})"

    while i < n:
        if starts_jsx() and should_read_jsx(source, i):
            out.append(parse_element())
        else:
            out.append(source[i])
            i += 1
    return "".join(out)


def should_read_jsx(source: str, i: int) -> bool:
    nxt = source[i + 1] if i + 1 < len(source) else ""
    if not (nxt.isalpha() or nxt in "/!>_"):
        return False
    j = i - 1
    while j >= 0 and source[j].isspace():
        j -= 1
    if j < 0:
        return True
    ch = source[j]
    if ch.isalnum() or ch in ")]}.":
        k = j
        while k >= 0 and (source[k].isalnum() or source[k] == "_"):
            k -= 1
        word = source[k + 1 : j + 1]
        return word in {"return", "yield", "case", "else", "typeof", "void", "delete", "await", "new", "of", "in"}
    if ch == ">" and j >= 1 and source[j - 1] == "=":
        return True
    if ch == "&" and j >= 1 and source[j - 1] == "&":
        return True
    if ch == "|" and j >= 1 and source[j - 1] == "|":
        return True
    return True


def json_ident(name: str) -> str:
    if name and (name[0].islower() or "-" in name):
        return json.dumps(name)
    return name


def js_key(name: str) -> str:
    if name == "class":
        return "className"
    if name == "for":
        return "htmlFor"
    if "-" in name:
        return json.dumps(name)
    return name


def collapse(text: str) -> str:
    if text.strip() == "":
        return ""
    return text


