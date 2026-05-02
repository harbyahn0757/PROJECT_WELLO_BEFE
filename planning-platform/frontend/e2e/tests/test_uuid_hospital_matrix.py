"""
WELNO v10 hotfix 8 케이스 매트릭스 E2E 검증.

검증 대상 (UUID × hospital_id 조합):
  c1: UUID O × hospital O × 데이터 O  → 정상 진입
  c2: UUID O × hospital O × 데이터 X  → 데이터 없음 안내 (회귀)
  c3: UUID O × hospital X × 데이터 O  → find_hospital_id_by_uuid 자동 조회
  c4: UUID O × hospital X × 신규     → PEERNINE 폴백 → 본인인증 redirect
  c5: UUID X × hospital O (TEST_E2E) → 메인 + hospital 컨텍스트 (회귀)
  c6: UUID X × hospital O (PEERNINE) → 메인 + 다른 hospital (회귀)
  c7: UUID X × hospital X            → 메인페이지 (회귀)
  c8: ?key=lookup_alimtalk           → lookup → seed1 UUID 매핑 (회귀)

시드 데이터: hospital_id='TEST_E2E' 격리. data-team이 INSERT, 테스트 후 DELETE.
"""

import pytest
from playwright.sync_api import Page

# ── 시드 상수 ─────────────────────────────────────────

TEST_E2E_HOSPITAL = "TEST_E2E"
SEED_C1 = "test-e2e-c1-uuid"
SEED_C2 = "test-e2e-c2-uuid"
SEED_C3 = "test-e2e-c3-uuid"
SEED_C4 = "test-e2e-c4-NOTEXIST-uuid"  # 의도적으로 시드 INSERT 없는 UUID — PEERNINE 폴백 발동용
SEED_KEY8 = "teste2e8"

CAMPAIGN_PATH = "/campaigns/checkup-design"


# ── 시드 사전 체크 (A7 가드, dev-reviewer 권고) ─────────

@pytest.fixture(scope="module", autouse=True)
def _seed_precheck():
    """TEST_E2E hospital row 200 확인. 미준비/5xx/도달불가 시 모듈 skip.
    macOS Python SSL 인증서 미신뢰 환경 대비: unverified context 사용 (테스트 전용)."""
    import os
    import ssl
    import urllib.request
    import urllib.error
    from conftest import BASE_URL  # type: ignore
    resolved_base = os.environ.get("WELNO_E2E_URL", BASE_URL)
    url = f"{resolved_base}/api/v1/welno/hospitals/TEST_E2E"
    ctx = ssl._create_unverified_context()  # noqa: S323 (e2e 검증용 sanity check)
    try:
        with urllib.request.urlopen(url, timeout=5, context=ctx) as r:
            if r.status == 200:
                return
            pytest.skip(f"BE 시드 응답 비정상 ({r.status})")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            pytest.skip("E2E 시드 미준비 (TEST_E2E hospital 404)")
        if 500 <= e.code < 600:
            pytest.skip(f"BE 5xx ({e.code}) — 일시 장애 skip")
        return  # 401/403 등은 테스트 본체가 판정
    except (urllib.error.URLError, TimeoutError, ConnectionError) as e:
        pytest.skip(f"BE 도달 불가 ({type(e).__name__}: {e}) — 네트워크 skip")


# (case_id, query_string, screenshot_name)
CASES = [
    ("c1", f"?uuid={SEED_C1}&hospital={TEST_E2E_HOSPITAL}", "matrix_c1_uuid_o_hospital_o_data_o"),
    ("c2", f"?uuid={SEED_C2}&hospital={TEST_E2E_HOSPITAL}", "matrix_c2_uuid_o_hospital_o_data_x"),
    ("c3", f"?uuid={SEED_C3}",                              "matrix_c3_uuid_o_hospital_x_autoresolve"),
    ("c4", f"?uuid={SEED_C4}",                              "matrix_c4_uuid_o_hospital_x_fallback"),
    ("c5", f"?hospital={TEST_E2E_HOSPITAL}",                "matrix_c5_uuid_x_hospital_test"),
    ("c6", "?hospital=PEERNINE",                            "matrix_c6_uuid_x_hospital_real"),
    ("c7", "",                                              "matrix_c7_uuid_x_hospital_x_main"),
    ("c8", f"?key={SEED_KEY8}",                             "matrix_c8_lookup_alimtalk"),
]


# ── 8 케이스 일괄 검증 ──────────────────────────────────

@pytest.mark.requires_server
@pytest.mark.parametrize("case_id,query,name", CASES, ids=[c[0] for c in CASES])
class TestUuidHospitalMatrix:
    """모든 케이스: URL 진입 → React 마운트 → 콘솔 에러 0 → 스크린샷."""

    def test_url_entry(
        self,
        page: Page,
        base_url: str,
        screenshot_path,
        case_id: str,
        query: str,
        name: str,
    ):
        url = f"{base_url}{CAMPAIGN_PATH}{query}"

        # 콘솔 에러 캡처
        console_errors: list[str] = []
        page.on(
            "console",
            lambda msg: console_errors.append(msg.text)
            if msg.type == "error" else None,
        )
        page_errors: list[str] = []
        page.on("pageerror", lambda exc: page_errors.append(str(exc)))

        # c8 lookup 흐름은 BE 추가 호출로 networkidle 도달 지연 → load + 추가 wait
        if case_id == "c8":
            page.goto(url, wait_until="load", timeout=30_000)
            page.wait_for_timeout(5000)
        else:
            page.goto(url, wait_until="networkidle", timeout=30_000)
            page.wait_for_timeout(2000)

        # React 마운트
        mounted = page.evaluate(
            "() => document.getElementById('root')?.children.length > 0"
        )
        assert mounted, f"[{case_id}] React not mounted at {url}"

        # 콘솔 에러 0 (favicon/DevTools 제외)
        ignore = ("favicon", "DevTools", "Download the React")
        critical = [e for e in console_errors if not any(s in e for s in ignore)]
        assert len(critical) == 0, \
            f"[{case_id}] console errors: {critical[:3]}"
        assert len(page_errors) == 0, \
            f"[{case_id}] page errors: {page_errors[:3]}"

        page.screenshot(path=screenshot_path(name), full_page=True)


# ── 케이스별 특이 검증 ──────────────────────────────────

@pytest.mark.requires_server
class TestUuidHospitalMatrixDeep:
    """v10 hotfix 핵심 분기 (case 3, 4, 8) 동작 확인."""

    def test_c4_peernine_fallback_lands_on_auth(
        self, page: Page, base_url: str, screenshot_path
    ):
        """Case 4: UUID 있고 hospital 없는 신규 환자 → PEERNINE 폴백 → 본인인증/시작 화면."""
        url = f"{base_url}{CAMPAIGN_PATH}?uuid={SEED_C4}"
        page.goto(url, wait_until="networkidle", timeout=30_000)
        page.wait_for_timeout(3000)

        body_text = page.evaluate("() => document.body.innerText")
        # v10: 폴백 후 redirect_to_auth → "본인인증" / "시작" / "동의" 키워드 존재
        keywords = ["인증", "본인", "동의", "시작", "검진"]
        matched = [k for k in keywords if k in body_text]
        assert matched, \
            f"Case 4 should reach auth/start, body[:300]={body_text[:300]}"

        page.screenshot(path=screenshot_path("matrix_c4_deep_auth"), full_page=True)

    def test_c3_autoresolve_proceeds(
        self, page: Page, base_url: str, screenshot_path
    ):
        """Case 3: hospital_id NULL인 row 진입 → BE가 자동 조회로 TEST_E2E 매핑 → 진입 가능."""
        url = f"{base_url}{CAMPAIGN_PATH}?uuid={SEED_C3}"
        page.goto(url, wait_until="networkidle", timeout=30_000)
        page.wait_for_timeout(3000)

        body_text = page.evaluate("() => document.body.innerText")
        # 데이터 있는 환자라 검진설계 진입 또는 약관/시작 화면
        assert len(body_text) > 50, \
            f"Case 3 page empty? body[:200]={body_text[:200]}"
        # "데이터 로딩 실패" 같은 fatal 에러 배너 부재 확인
        assert "오류가 발생" not in body_text and "데이터 로딩 실패" not in body_text, \
            f"Case 3 hit error banner: {body_text[:300]}"

        page.screenshot(path=screenshot_path("matrix_c3_deep_autoresolve"), full_page=True)

    def test_c8_lookup_key_resolves(
        self, page: Page, base_url: str, screenshot_path
    ):
        """Case 8: ?key=teste2e8 → seed1 UUID로 매핑 → React 마운트 + 에러 없음."""
        url = f"{base_url}{CAMPAIGN_PATH}?key={SEED_KEY8}"
        # lookup 흐름 BE 추가 호출 영향 → networkidle 의존 제거
        page.goto(url, wait_until="load", timeout=30_000)
        page.wait_for_timeout(5000)

        mounted = page.evaluate(
            "() => document.getElementById('root')?.children.length > 0"
        )
        assert mounted, "Case 8 React not mounted (lookup_key resolution failed)"

        body_text = page.evaluate("() => document.body.innerText")
        assert "잘못된 링크" not in body_text and "만료" not in body_text, \
            f"Case 8 lookup invalid: {body_text[:300]}"

        page.screenshot(path=screenshot_path("matrix_c8_deep_lookup"), full_page=True)


# ── 분기 직접 증거 검증 (DOM 캡처 기반, 2회차 강화) ─────

from helpers.dom import get_local_storage, get_button_texts  # noqa: E402

DATA_OWNED_BTN = "나만의 검진 시작하기"   # 건강데이터 보유 분기
NEW_AUTH_BTN = "간편 인증하고 시작하기"  # 신규/데이터 X 분기


@pytest.mark.requires_server
@pytest.mark.parametrize(
    "case_id,query,expected_btn,expected_ls_keys",
    [
        ("c1", f"?uuid={SEED_C1}&hospital={TEST_E2E_HOSPITAL}", DATA_OWNED_BTN,
         ["welno_data_cache_test-e2e-c1-uuid"]),
        ("c2", f"?uuid={SEED_C2}&hospital={TEST_E2E_HOSPITAL}", NEW_AUTH_BTN,
         ["welno_data_cache_test-e2e-c2-uuid"]),
        ("c3", f"?uuid={SEED_C3}", DATA_OWNED_BTN,
         ["welno_patient_uuid"]),
        ("c4", f"?uuid={SEED_C4}", NEW_AUTH_BTN,
         ["welno_patient_uuid"]),
        ("c5", f"?hospital={TEST_E2E_HOSPITAL}", NEW_AUTH_BTN,
         ["welno_hospital_id"]),
        ("c6", "?hospital=PEERNINE", NEW_AUTH_BTN,
         ["welno_hospital_id"]),
        ("c8", f"?key={SEED_KEY8}", DATA_OWNED_BTN,
         ["welno_alimtalk_lookup_key", "welno_patient_uuid"]),
    ],
    ids=["c1", "c2", "c3", "c4", "c5", "c6", "c8"],
)
class TestUuidHospitalMatrixBranchEvidence:
    """분기 직접 증거 — CTA 버튼 텍스트 + localStorage 키 매칭."""

    def test_branch_signature(
        self, page: Page, base_url: str, screenshot_path,
        case_id: str, query: str, expected_btn: str, expected_ls_keys: list,
    ):
        url = f"{base_url}{CAMPAIGN_PATH}{query}"
        if case_id == "c8":
            page.goto(url, wait_until="load", timeout=30_000)
            page.wait_for_timeout(5000)
        else:
            page.goto(url, wait_until="networkidle", timeout=30_000)
            page.wait_for_timeout(2500)

        # CTA 버튼 분기 검증
        btn_texts = get_button_texts(page)
        matched_btn = [t for t in btn_texts if expected_btn in t]
        assert matched_btn, (
            f"[{case_id}] expected button '{expected_btn}' not found. "
            f"got: {btn_texts[:5]}"
        )

        # localStorage 분기 마커 검증
        ls = get_local_storage(page)
        for key in expected_ls_keys:
            assert key in ls, (
                f"[{case_id}] expected localStorage key '{key}' missing. "
                f"got keys: {list(ls.keys())}"
            )

        # c8: lookup_key 값 자체가 'teste2e8' 인지 검증 (resolve 직접 증거)
        if case_id == "c8":
            actual = ls.get("welno_alimtalk_lookup_key", "")
            assert actual == SEED_KEY8, (
                f"[c8] lookup_key value mismatch: "
                f"expected '{SEED_KEY8}', got '{actual}'"
            )

        page.screenshot(
            path=screenshot_path(f"matrix_branch_{case_id}"), full_page=True
        )
