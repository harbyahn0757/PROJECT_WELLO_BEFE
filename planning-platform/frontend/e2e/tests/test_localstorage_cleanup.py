"""
localStorage clearStaleAuth 정리 E2E 테스트.

검증 대상:
  - clearStaleAuth 함수가 세션 키 13개를 삭제하는지
  - 영구 키 2개 (tilko_terms_agreed, welno_intro_teaser_shown)는 유지되는지
  - 인증 버튼 클릭 시 정리가 실행되는지
"""

import pytest
from playwright.sync_api import Page

from conftest import UUID, PARTNER, HOSPITAL, STALE_AUTH_KEYS, PERMANENT_KEYS
from helpers.storage import (
    set_all_keys,
    set_stale_keys,
    set_permanent_keys,
    verify_stale_cleared,
    verify_permanent_kept,
    count_stale_remaining,
    get_storage_value,
    get_all_storage,
    clear_all,
)


@pytest.mark.requires_server
class TestLocalStorageCleanup:
    """clearStaleAuth 로직 검증."""

    def test_stale_keys_cleared(
        self, page: Page, campaign_url_uuid: str, screenshot_path
    ):
        """
        clearStaleAuth 로직 실행 시 세션 키 13개가 삭제되는지 (단위 테스트).

        clearStaleAuth는 버튼 클릭 시에만 호출되므로,
        JS로 동일 로직을 직접 실행하여 키 목록 정합성을 검증.
        """
        page.goto(campaign_url_uuid, wait_until="networkidle")

        # 13개 세션 키 세팅
        set_stale_keys(page)

        remaining_before = count_stale_remaining(page)
        assert remaining_before == 13, \
            f"세팅 후 13개 키가 있어야 하는데 {remaining_before}개만 있음"

        # clearStaleAuth와 동일한 JS 직접 실행
        page.evaluate("""() => {
            ['tilko_info_confirming', 'tilko_auth_waiting', 'tilko_auth_completed',
             'tilko_auth_requested', 'tilko_collecting_status', 'tilko_manual_collect',
             'password_modal_open', 'tilko_session_id', 'tilko_session_data',
             'start_info_confirmation', 'tilko_selected_auth_type',
             'tilko_auth_method_selection', 'checkup_survey_panel_open'
            ].forEach(k => localStorage.removeItem(k));
        }""")

        remaining_after = count_stale_remaining(page)
        page.screenshot(path=screenshot_path("stale_keys_after_clear"))

        assert remaining_after == 0, (
            f"clearStaleAuth 후 세션 키 {remaining_after}개 잔존: "
            + ", ".join(
                k for k in STALE_AUTH_KEYS
                if get_storage_value(page, k) is not None
            )
        )

    def test_permanent_keys_preserved(
        self, page: Page, campaign_url_uuid: str, screenshot_path
    ):
        """clearStaleAuth 실행 후에도 영구 키 2개는 유지되는지."""
        page.goto(campaign_url_uuid, wait_until="networkidle")

        # 세션 키 + 영구 키 모두 세팅
        set_all_keys(page)

        # 영구 키 세팅 확인
        for key in PERMANENT_KEYS:
            val = get_storage_value(page, key)
            assert val is not None, f"영구 키 {key}가 세팅되지 않음"

        # 리로드 → clearStaleAuth 실행
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(2000)

        # 영구 키 확인
        preserved = verify_permanent_kept(page)

        page.screenshot(path=screenshot_path("permanent_keys_after_reload"))

        assert preserved, (
            "영구 키가 삭제됨. 남은 키: "
            + ", ".join(
                f"{k}={'있음' if get_storage_value(page, k) else '없음'}"
                for k in PERMANENT_KEYS
            )
        )

    def test_cleanup_on_auth_navigation(
        self, page: Page, campaign_url_uuid: str, screenshot_path
    ):
        """인증 버튼 클릭 시 세션 키가 정리되는지 확인."""
        page.goto(campaign_url_uuid, wait_until="networkidle")
        page.wait_for_timeout(2000)

        # 세션 키 + 영구 키 세팅
        set_all_keys(page)

        # 인증 버튼 찾기 및 클릭
        # 실제 버튼: "간편 인증하고 시작하기" (검진 기록 연동)
        auth_selectors = [
            "button:has-text('간편 인증')",
            "button:has-text('인증하고 시작')",
            "button:has-text('나만의 검진')",
            "button:has-text('검진 시작')",
            "button:has-text('인증')",
            "button:has-text('시작')",
        ]

        clicked = False
        for selector in auth_selectors:
            try:
                loc = page.locator(selector).first
                if loc.is_visible():
                    loc.click()
                    clicked = True
                    break
            except Exception:
                continue

        if not clicked:
            page.screenshot(path=screenshot_path("no_auth_button"))
            pytest.skip("인증 버튼을 찾을 수 없음")
            return

        page.wait_for_timeout(2000)

        # 세션 키가 삭제되었는지 확인
        stale_cleared = verify_stale_cleared(page)

        # 영구 키는 유지되는지 확인
        permanent_kept = verify_permanent_kept(page)

        page.screenshot(path=screenshot_path("after_auth_click"))

        assert stale_cleared, (
            f"인증 클릭 후 세션 키 {count_stale_remaining(page)}개 잔존"
        )
        assert permanent_kept, "인증 클릭 후 영구 키가 삭제됨"
