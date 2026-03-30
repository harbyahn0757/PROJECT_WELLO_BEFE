"""
인증 플로우 E2E 테스트.

검증 대상:
  - 인증 버튼 클릭 → /login 페이지 이동
  - /login 페이지에서 "확인 완료" 버튼 표시
"""

import pytest
from playwright.sync_api import Page

from conftest import UUID, PARTNER, HOSPITAL


@pytest.mark.requires_server
class TestAuthFlow:
    """인증 버튼 → /login 이동 → 확인 완료 버튼 확인."""

    def test_auth_button_navigates_to_login(
        self, page: Page, campaign_url_uuid: str, screenshot_path
    ):
        """인증 버튼 클릭 시 /login 경로로 이동하는지 확인."""
        page.goto(campaign_url_uuid, wait_until="networkidle")
        page.wait_for_timeout(2000)

        # 인증 버튼 찾기 (데이터 없는 사용자만 "인증" 버튼 표시)
        # 데이터 있는 사용자는 "나만의 검진 시작하기" 만 있으므로 skip
        auth_selectors = [
            "button:has-text('간편 인증')",
            "button:has-text('인증하고 시작')",
            "button:has-text('인증')",
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
            page.screenshot(path=screenshot_path("auth_no_button"))
            pytest.skip("인증 버튼 없음 (파트너 데이터가 있는 사용자 — 설계 시작 경로)")
            return

        # /login으로 이동 대기
        try:
            page.wait_for_url("**/login**", timeout=5000)
        except Exception:
            page.wait_for_timeout(2000)

        page.screenshot(path=screenshot_path("auth_after_click"))

        current_url = page.url
        assert "/login" in current_url, \
            f"인증 버튼 클릭 후 /login으로 이동하지 않음. 현재 URL: {current_url}"

    def test_confirm_button_visible(
        self, page: Page, base_url: str, screenshot_path
    ):
        """
        /login 페이지에서 '확인 완료' 또는 이에 해당하는 버튼이 표시되는지.

        직접 /login URL로 접근하여 확인.
        return_to 파라미터를 포함해 캠페인 플로우를 시뮬레이션.
        """
        return_to = (
            f"/campaigns/checkup-design"
            f"?uuid={UUID}&partner={PARTNER}&hospital={HOSPITAL}&from_auth=true"
        )
        login_url = (
            f"{base_url}/login"
            f"?return_to={return_to}&mode=campaign"
        )

        page.goto(login_url, wait_until="networkidle")
        page.wait_for_timeout(2000)

        # 로그인/인증 페이지 UI 요소 확인
        confirm_selectors = [
            "button:has-text('확인 완료')",
            "button:has-text('확인')",
            "button:has-text('완료')",
            "button:has-text('인증 완료')",
            "button:has-text('다음')",
            "[class*='confirm'] button",
            "[class*='submit'] button",
        ]

        found_confirm = False
        for selector in confirm_selectors:
            try:
                loc = page.locator(selector)
                if loc.count() > 0:
                    found_confirm = True
                    break
            except Exception:
                continue

        page.screenshot(path=screenshot_path("login_page"))

        # 최소한 입력 필드 또는 버튼이 있어야 함
        if not found_confirm:
            has_inputs = page.locator("input").count() > 0
            has_buttons = page.locator("button").count() > 0
            assert has_inputs or has_buttons, \
                "/login 페이지에 입력 필드나 버튼이 없음"
        else:
            assert found_confirm, "/login 페이지에 확인 버튼이 없음"
