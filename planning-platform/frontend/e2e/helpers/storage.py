"""
localStorage 세팅/검증 헬퍼 함수.

Playwright Page 객체의 evaluate()를 사용하여
브라우저 컨텍스트 안에서 localStorage를 조작한다.
"""

import json
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

from playwright.sync_api import Page


# ── 상수 (conftest와 동일 목록 재정의, 독립 import용) ──

STALE_AUTH_KEYS: List[str] = [
    "tilko_info_confirming",
    "tilko_auth_waiting",
    "tilko_auth_completed",
    "tilko_auth_requested",
    "tilko_collecting_status",
    "tilko_manual_collect",
    "password_modal_open",
    "tilko_session_id",
    "tilko_session_data",
    "start_info_confirmation",
    "tilko_selected_auth_type",
    "tilko_auth_method_selection",
    "checkup_survey_panel_open",
]

PERMANENT_KEYS: List[str] = [
    "tilko_terms_agreed",
    "welno_intro_teaser_shown",
]


# ── JSON 빌더 ─────────────────────────────────────────

def make_terms_json() -> str:
    """tilko_terms_agreed에 저장할 올바른 JSON 문자열 생성."""
    now = datetime.now(timezone.utc)
    expires = now + timedelta(days=365)
    return json.dumps({
        "agreed_at": now.isoformat(),
        "expires_at": expires.isoformat(),
    })


def make_intro_teaser_json() -> str:
    """welno_intro_teaser_shown에 저장할 JSON 문자열 생성."""
    now = datetime.now(timezone.utc)
    return json.dumps({
        "shown": True,
        "shown_at": now.isoformat(),
    })


# ── 세팅 함수 ─────────────────────────────────────────

def set_stale_keys(page: Page) -> None:
    """세션(스테일) 키 13개를 dummy 값으로 세팅."""
    for key in STALE_AUTH_KEYS:
        page.evaluate(
            "(args) => localStorage.setItem(args.key, args.value)",
            {"key": key, "value": "test_dummy_value"},
        )


def set_permanent_keys(page: Page) -> None:
    """영구 키 2개를 올바른 JSON 형식으로 세팅."""
    page.evaluate(
        "(args) => localStorage.setItem(args.key, args.value)",
        {"key": "tilko_terms_agreed", "value": make_terms_json()},
    )
    page.evaluate(
        "(args) => localStorage.setItem(args.key, args.value)",
        {"key": "welno_intro_teaser_shown", "value": make_intro_teaser_json()},
    )


def set_all_keys(page: Page) -> None:
    """세션 키 + 영구 키 모두 세팅 (cleanup 테스트용)."""
    set_stale_keys(page)
    set_permanent_keys(page)


# ── 읽기 함수 ─────────────────────────────────────────

def get_all_storage(page: Page) -> Dict[str, Optional[str]]:
    """브라우저 localStorage 전체를 dict로 반환."""
    return page.evaluate("""
        () => {
            const result = {};
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key) result[key] = localStorage.getItem(key);
            }
            return result;
        }
    """)


def get_storage_value(page: Page, key: str) -> Optional[str]:
    """단일 키 값 조회."""
    return page.evaluate(
        "(key) => localStorage.getItem(key)",
        key,
    )


# ── 검증 함수 ─────────────────────────────────────────

def verify_stale_cleared(page: Page) -> bool:
    """세션 키 13개가 전부 삭제(null)되었는지 확인. 전부 없으면 True."""
    for key in STALE_AUTH_KEYS:
        val = get_storage_value(page, key)
        if val is not None:
            return False
    return True


def verify_permanent_kept(page: Page) -> bool:
    """영구 키 2개가 유지되어 있는지 확인. 전부 있으면 True."""
    for key in PERMANENT_KEYS:
        val = get_storage_value(page, key)
        if val is None:
            return False
    return True


def count_stale_remaining(page: Page) -> int:
    """아직 남아 있는 세션 키 수 반환 (디버그용)."""
    count = 0
    for key in STALE_AUTH_KEYS:
        if get_storage_value(page, key) is not None:
            count += 1
    return count


# ── 초기화 함수 ───────────────────────────────────────

def clear_all(page: Page) -> None:
    """localStorage 전체 삭제."""
    page.evaluate("() => localStorage.clear()")
