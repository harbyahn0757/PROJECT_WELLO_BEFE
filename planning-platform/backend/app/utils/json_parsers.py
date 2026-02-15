"""JSONB 배열 필드 파싱 유틸리티."""
import json
from typing import Any


def safe_json_list(value: Any) -> list:
    """JSONB 배열 필드를 안전하게 파싱하여 list로 반환."""
    if not value:
        return []
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, list) else []
        except (json.JSONDecodeError, TypeError):
            return []
    return []


def format_interest_tags(value: Any) -> str:
    """interest_tags [{topic, intensity}] → '혈압(high), 당뇨(medium)' 문자열."""
    items = safe_json_list(value)
    parts = []
    for item in items:
        if isinstance(item, dict) and "topic" in item:
            intensity = item.get("intensity", "medium")
            parts.append(f"{item['topic']}({intensity})")
        elif isinstance(item, str):
            parts.append(item)
    return ", ".join(parts)


def format_tag_list(value: Any, separator: str = ", ") -> str:
    """일반 태그 배열 → 구분자 연결 문자열."""
    items = safe_json_list(value)
    return separator.join(str(item) for item in items if item)
