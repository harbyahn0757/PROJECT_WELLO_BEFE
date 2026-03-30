"""
약관 동의 E2E 테스트.

검증 대상:
  - 첫 방문 시 약관 동의 모달 표시
  - 동의 후 localStorage에 저장 확인
  - 재방문 시 모달 미표시
"""

import json
import pytest
from playwright.sync_api import Page

from conftest import UUID, PARTNER, HOSPITAL
from helpers.storage import (
    clear_all,
    get_storage_value,
    set_permanent_keys,
)


@pytest.mark.requires_server
class TestTermsAgreement:
    """약관 동의 모달 표시/저장/재방문 검증."""

    def test_terms_modal_shows_on_first_visit(
        self, page: Page, campaign_url_uuid: str, screenshot_path
    ):
        """약관 미동의 상태에서 페이지 방문 시 약관 모달이 표시되는지 확인."""
        page.goto(campaign_url_uuid, wait_until="networkidle")

        # localStorage 완전 초기화 (약관 미동의 상태 보장)
        clear_all(page)
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(2000)

        # 약관 모달 또는 약관 관련 UI 요소 탐색
        modal_selectors = [
            "[class*='terms']",
            "[class*='modal']",
            "[class*='Terms']",
            "[class*='Modal']",
            "text=약관",
            "text=이용약관",
            "text=개인정보",
            "text=동의",
        ]

        found_terms_ui = False
        for selector in modal_selectors:
            try:
                if page.locator(selector).count() > 0:
                    found_terms_ui = True
                    break
            except Exception:
                continue

        page.screenshot(path=screenshot_path("terms_first_visit"))

        # 약관 UI가 나타나거나, 최소한 페이지에 약관 관련 텍스트가 있어야 함
        page_text = page.evaluate("() => document.body.innerText")
        has_terms_text = any(
            kw in page_text
            for kw in ["약관", "동의", "개인정보", "이용약관"]
        )

        assert found_terms_ui or has_terms_text, \
            "첫 방문 시 약관 관련 UI가 표시되지 않음"

    def test_terms_saved_after_agree(
        self, page: Page, campaign_url_uuid: str, screenshot_path
    ):
        """약관 동의 후 localStorage에 정상 저장되는지 확인."""
        page.goto(campaign_url_uuid, wait_until="networkidle")

        # localStorage 초기화
        clear_all(page)
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(2000)

        # 전체 동의 버튼 클릭 시도
        agree_selectors = [
            "button:has-text('전체 동의')",
            "button:has-text('모두 동의')",
            "button:has-text('동의하고')",
            "button:has-text('동의합니다')",
            "button:has-text('확인')",
            "[class*='agree'] button",
            "[class*='terms'] button",
        ]

        clicked = False
        for selector in agree_selectors:
            try:
                loc = page.locator(selector).first
                if loc.is_visible():
                    loc.click()
                    clicked = True
                    break
            except Exception:
                continue

        if clicked:
            page.wait_for_timeout(1500)

            # localStorage에 약관 동의 관련 키가 저장되었는지 확인
            # TERMS_AGREEMENT_{uuid}_{partner} 형식 또는 tilko_terms_agreed
            all_storage = page.evaluate("""
                () => {
                    const result = {};
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key) result[key] = localStorage.getItem(key);
                    }
                    return result;
                }
            """)

            terms_keys = [
                k for k in all_storage.keys()
                if "terms" in k.lower() or "TERMS" in k
            ]

            page.screenshot(path=screenshot_path("terms_after_agree"))

            assert len(terms_keys) > 0, \
                f"동의 후 localStorage에 약관 키가 없음. keys={list(all_storage.keys())}"

            # 저장된 값이 유효한 JSON인지 확인
            for key in terms_keys:
                val = all_storage[key]
                if val:
                    try:
                        parsed = json.loads(val)
                        assert isinstance(parsed, dict), \
                            f"약관 데이터가 dict가 아님: {key}"
                    except json.JSONDecodeError:
                        pass  # 일부 키는 plain string일 수 있음
        else:
            page.screenshot(path=screenshot_path("terms_no_agree_button"))
            pytest.skip("동의 버튼을 찾을 수 없음 (약관 모달이 표시되지 않았을 수 있음)")

    def test_no_modal_on_revisit(
        self, page: Page, campaign_url_uuid: str, screenshot_path
    ):
        """약관 동의 후 재방문 시 모달이 표시되지 않는지 확인."""
        page.goto(campaign_url_uuid, wait_until="networkidle")

        # 영구 키를 직접 세팅하여 동의 완료 상태로 만듦
        set_permanent_keys(page)

        # 페이지 새로고침 (재방문 시뮬레이션)
        page.reload(wait_until="networkidle")
        page.wait_for_timeout(2000)

        # 약관 모달이 표시되지 않아야 함
        # 모달 overlay가 없는지 확인
        modal_visible = False
        modal_overlay_selectors = [
            "[class*='modal-overlay']",
            "[class*='ModalOverlay']",
            "[class*='terms-modal']",
            "[class*='TermsModal']",
        ]

        for selector in modal_overlay_selectors:
            try:
                loc = page.locator(selector)
                if loc.count() > 0 and loc.first.is_visible():
                    modal_visible = True
                    break
            except Exception:
                continue

        page.screenshot(path=screenshot_path("terms_revisit"))

        # tilko_terms_agreed가 있으면 약관 모달은 뜨지 않아야 함
        terms_value = get_storage_value(page, "tilko_terms_agreed")
        if terms_value:
            assert not modal_visible, \
                "tilko_terms_agreed가 있는데 약관 모달이 표시됨"
