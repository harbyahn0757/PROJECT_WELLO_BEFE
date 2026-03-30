"""
WELNO E2E Test Suite - pytest fixtures
Python Playwright 기반 (pip install playwright)

Usage:
    cd frontend/e2e
    pytest tests/ -v
    pytest tests/test_campaign_landing.py -v
    WELNO_E2E_URL=http://localhost:9282 pytest tests/ -v
"""

import os
import pytest
from playwright.sync_api import sync_playwright, Page, BrowserContext, Browser

# ── 상수 ──────────────────────────────────────────────

BASE_URL = "https://welno.kindhabit.com"
UUID = "831b1be7-677b-4899-803d-f69622f919dd"  # 안광수 실제 UUID
LOOKUP_KEY = "8b6dbc46"
PARTNER = "welno"
HOSPITAL = "PEERNINE"

DEFAULT_TIMEOUT = 15_000  # 15초

# clearStaleAuth 대상 세션 키 13개
STALE_AUTH_KEYS = [
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

# 영구 보존 키 2개
PERMANENT_KEYS = ["tilko_terms_agreed", "welno_intro_teaser_shown"]

# 스크린샷 디렉토리
SCREENSHOTS_DIR = os.path.join(os.path.dirname(__file__), "screenshots")
os.makedirs(SCREENSHOTS_DIR, exist_ok=True)


# ── Fixtures ──────────────────────────────────────────

@pytest.fixture(scope="session")
def browser():
    """세션 전체에서 재사용하는 Chromium 브라우저 인스턴스."""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        yield browser
        browser.close()


@pytest.fixture
def context(browser: Browser) -> BrowserContext:
    """iPhone 14 Pro 뷰포트 + 카카오톡 인앱 UA."""
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        user_agent=(
            "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) "
            "AppleWebKit/605.1.15 (KHTML, like Gecko) "
            "Mobile/15E148 KAKAOTALK 10.4.2"
        ),
    )
    ctx.set_default_timeout(DEFAULT_TIMEOUT)
    yield ctx
    ctx.close()


@pytest.fixture
def page(context: BrowserContext) -> Page:
    """새 탭 (테스트마다 격리)."""
    p = context.new_page()
    yield p
    p.close()


@pytest.fixture
def base_url() -> str:
    """환경변수 WELNO_E2E_URL 또는 기본 프로덕션 URL."""
    return os.environ.get("WELNO_E2E_URL", BASE_URL)


@pytest.fixture
def screenshot_path():
    """테스트 이름 기반 스크린샷 경로 팩토리."""
    def _make_path(name: str) -> str:
        return os.path.join(SCREENSHOTS_DIR, f"{name}.png")
    return _make_path


@pytest.fixture
def campaign_url(base_url: str) -> str:
    """lookup_key 방식 캠페인 랜딩 URL."""
    return f"{base_url}/campaigns/checkup-design?key={LOOKUP_KEY}"


@pytest.fixture
def campaign_url_uuid(base_url: str) -> str:
    """UUID 직접 방식 캠페인 랜딩 URL."""
    return (
        f"{base_url}/campaigns/checkup-design"
        f"?uuid={UUID}&partner={PARTNER}&hospital={HOSPITAL}"
    )
