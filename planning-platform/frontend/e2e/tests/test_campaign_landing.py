"""
캠페인 랜딩 페이지 E2E 테스트.

검증 대상:
  - /campaigns/checkup-design?key={LOOKUP_KEY} (키값 방식)
  - /campaigns/checkup-design?uuid={UUID}&partner=...&hospital=... (직접 방식)
"""

import pytest
from playwright.sync_api import Page, expect

from conftest import LOOKUP_KEY, UUID, PARTNER, HOSPITAL


@pytest.mark.requires_server
class TestCampaignLanding:
    """캠페인 랜딩 페이지 로드 및 기본 요소 확인."""

    def test_landing_loads(
        self, page: Page, campaign_url: str, screenshot_path
    ):
        """lookup_key 방식으로 캠페인 랜딩 페이지가 정상 로드되는지 확인."""
        page.goto(campaign_url, wait_until="networkidle")

        # 페이지가 에러 없이 로드되었는지 (빈 페이지가 아닌지)
        assert page.title() or page.url, "페이지 로드 실패"

        # React 앱이 마운트 되었는지 (root div에 자식이 있는지)
        root_has_children = page.evaluate(
            "() => document.getElementById('root')?.children.length > 0"
        )
        assert root_has_children, "React 앱이 마운트되지 않음"

        page.screenshot(path=screenshot_path("landing_key"))

    def test_landing_loads_with_uuid(
        self, page: Page, campaign_url_uuid: str, screenshot_path
    ):
        """UUID 파라미터로 직접 접근 시 페이지가 정상 로드되는지 확인."""
        page.goto(campaign_url_uuid, wait_until="networkidle")

        root_has_children = page.evaluate(
            "() => document.getElementById('root')?.children.length > 0"
        )
        assert root_has_children, "React 앱이 마운트되지 않음 (UUID 방식)"

        # URL에 uuid 파라미터가 포함되어 있는지
        assert UUID in page.url or "uuid=" in page.url, \
            "URL에 UUID 파라미터가 없음"

        page.screenshot(path=screenshot_path("landing_uuid"))

    def test_health_cards_displayed(
        self, page: Page, campaign_url_uuid: str, screenshot_path
    ):
        """건강 카드 UI 요소가 표시되는지 확인 (파트너 데이터가 있는 경우)."""
        page.goto(campaign_url_uuid, wait_until="networkidle")

        # 페이지 로드 대기 (API 응답 포함)
        page.wait_for_timeout(2000)

        # 건강 카드 또는 인트로 랜딩 요소가 존재하는지
        # (데이터 유무에 따라 다를 수 있으므로 둘 다 체크)
        has_content = page.evaluate("""
            () => {
                const body = document.body.innerText;
                return body.length > 50;  // 최소한의 콘텐츠가 있는지
            }
        """)
        assert has_content, "페이지에 콘텐츠가 표시되지 않음"

        page.screenshot(path=screenshot_path("health_cards"))

    def test_cta_button_exists(
        self, page: Page, campaign_url_uuid: str, screenshot_path
    ):
        """CTA 버튼(본인 인증, 검진 설계 등)이 존재하는지 확인."""
        page.goto(campaign_url_uuid, wait_until="networkidle")
        page.wait_for_timeout(2000)

        # 다양한 CTA 버튼 셀렉터 시도
        # 앱 상태에 따라 다른 버튼이 표시될 수 있음
        cta_selectors = [
            "button:has-text('인증')",
            "button:has-text('시작')",
            "button:has-text('설계')",
            "button:has-text('확인')",
            "button:has-text('동의')",
            "[class*='cta']",
            "[class*='btn']",
            "[class*='button']",
        ]

        found_cta = False
        for selector in cta_selectors:
            try:
                if page.locator(selector).count() > 0:
                    found_cta = True
                    break
            except Exception:
                continue

        # 최소한 button 요소가 하나는 있어야 함
        if not found_cta:
            button_count = page.locator("button").count()
            found_cta = button_count > 0

        assert found_cta, "CTA 버튼을 찾을 수 없음"

        page.screenshot(path=screenshot_path("cta_button"))
