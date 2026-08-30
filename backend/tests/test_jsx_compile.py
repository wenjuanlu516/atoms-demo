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


def test_compiles_jsx_after_call_paren():
    source = "root.render(<App />);"
    out = compile_jsx(source)
    assert "<App" not in out
    assert "React.createElement(App, null)" in out


def test_compiles_jsx_inside_map_block():
    source = """
    {last7Days.map(day => {
      const total = records[day] || 0;
      return (
        <div key={day} className="bar-item">
          <span>{total}</span>
        </div>
      );
    })}
    """
    out = compile_jsx(source)
    assert '")}' not in out
    assert "<div" not in out
    assert "React.createElement" in out
    assert "last7Days.map" in out
    assert out.count("}") >= out.count("{")
