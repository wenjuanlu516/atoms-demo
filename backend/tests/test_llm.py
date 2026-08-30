from app.services.llm import extract_json


def test_extract_json_fenced():
    assert extract_json('```json\n{"a": 1}\n```') == '{"a": 1}'


def test_extract_json_raw():
    assert extract_json('prefix {"a": 2} suffix') == '{"a": 2}'
