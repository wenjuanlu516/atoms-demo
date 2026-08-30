from app.runtime.jsx_compile import compile_jsx


def test_compiles_jsx_after_return_paren_newline():
    source = """
function App() {
  return (
    <div className="app">
      <h1>Hello World</h1>
    </div>
  );
}
"""
    out = compile_jsx(source)
    assert "<div" not in out
    assert "React.createElement" in out
    assert '"div"' in out
    assert '"h1"' in out
    assert "Hello World" in out


def test_does_not_eat_comparison():
    source = "const ok = count < limit && limit > 0;"
    assert compile_jsx(source) == source
