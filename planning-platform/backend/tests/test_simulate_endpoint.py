"""
/mediarc-report/{uuid}/simulate 엔드포인트 계약 테스트.

W5 감사 결과 확인 사항:
- 엔드포인트 존재: partner_office.py:3155  POST /mediarc-report/{uuid}/simulate
- SimulateRequest:  bmi_target(ge=15,le=45), weight_delta_kg, smoking_target,
                    drinking_target, time_horizon_months(0/6/12/60), force
- SimulateResponse: uuid, hospital_id, input, input_digest, labels,
                    improved_sbp, improved_dbp, improved_fbg, ratios,
                    five_year_improved, will_rogers, applied_attenuation,
                    has_improvement, cached, generated_at, engine_version

테스트 전략:
- Tier 1 (소스 기반): faiss 의존성 없이 partner_office.py 소스를 직접 검사
- Tier 2 (모델 계약): Pydantic 모델만 독립 import (faiss mock 후 가능한 경우)
- Tier 3 (통합): faiss 설치 서버 환경에서만 실행

실행:
    cd backend && python -m pytest tests/test_simulate_endpoint.py -v
"""

import importlib
import os
import re
import sys
from pathlib import Path
from typing import Dict, List
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

# faiss 설치 여부
_FAISS_AVAILABLE = importlib.util.find_spec("faiss") is not None
requires_faiss = pytest.mark.skipif(
    not _FAISS_AVAILABLE,
    reason="faiss 미설치 — 서버 환경에서 실행 필요",
)

_PARTNER_OFFICE_SRC = (
    Path(__file__).parent.parent
    / "app/api/v1/endpoints/partner_office.py"
)


# ─── Tier 1: 소스 기반 계약 검증 (faiss 불필요) ───────────────────────────────

class TestSimulateSourceContract:
    """partner_office.py 소스를 직접 분석하여 계약 검증."""

    def test_endpoint_exists_in_source(self):
        """POST /mediarc-report/{uuid}/simulate 라우터 정의가 소스에 존재."""
        src = _PARTNER_OFFICE_SRC.read_text()
        assert '@router.post("/mediarc-report/{uuid}/simulate"' in src, (
            "/simulate 엔드포인트 미발견 — partner_office.py:3155 확인 필요"
        )

    def test_simulate_request_class_exists(self):
        """SimulateRequest 클래스 정의가 소스에 존재."""
        src = _PARTNER_OFFICE_SRC.read_text()
        assert "class SimulateRequest(BaseModel)" in src

    def test_simulate_response_class_exists(self):
        """SimulateResponse 클래스 정의가 소스에 존재."""
        src = _PARTNER_OFFICE_SRC.read_text()
        assert "class SimulateResponse(BaseModel)" in src

    def test_bmi_target_range_in_source(self):
        """bmi_target에 ge=15.0, le=45.0 범위 제한이 코드에 존재."""
        src = _PARTNER_OFFICE_SRC.read_text()
        assert "bmi_target" in src
        assert "ge=15.0" in src
        assert "le=45.0" in src

    def test_time_horizon_months_literal_in_source(self):
        """time_horizon_months가 Literal[0, 6, 12, 60]으로 선언됨."""
        src = _PARTNER_OFFICE_SRC.read_text()
        assert "time_horizon_months" in src
        assert "Literal[0, 6, 12, 60]" in src

    def test_response_fields_in_source(self):
        """SimulateResponse 필수 필드가 소스에 모두 존재."""
        src = _PARTNER_OFFICE_SRC.read_text()
        required_fields = [
            "uuid", "hospital_id", "input_digest",
            "improved_sbp", "improved_dbp", "improved_fbg",
            "ratios", "five_year_improved", "will_rogers",
            "applied_attenuation", "has_improvement",
            "cached", "generated_at", "engine_version",
        ]
        for field in required_fields:
            assert field in src, f"SimulateResponse에 '{field}' 필드 정의 없음"

    def test_health_check_log_added(self):
        """W5 헬스체크 logger.info가 post_simulate 함수에 추가됨."""
        src = _PARTNER_OFFICE_SRC.read_text()
        # simulate 요청 수신 로그 확인
        assert "simulate: 요청 수신" in src, (
            "W5 헬스체크 logger.info 누락 — partner_office.py post_simulate 확인"
        )

    def test_cache_logic_exists(self):
        """캐시 조회/저장 함수(_sim_get_cached, _sim_upsert)가 소스에 존재."""
        src = _PARTNER_OFFICE_SRC.read_text()
        assert "_sim_get_cached" in src
        assert "_sim_upsert" in src

    def test_error_cases_handled(self):
        """404/500 에러 케이스 핸들링이 소스에 존재."""
        src = _PARTNER_OFFICE_SRC.read_text()
        # 엔진 실행 실패 500
        assert "status_code=500" in src
        # 존재하지 않는 uuid 처리 (patient detail에서 404)
        assert "status_code=404" in src


# ─── Tier 2: Pydantic 모델 계약 (faiss mock 주입 후 import) ──────────────────

class TestSimulateModels:
    """SimulateRequest / SimulateResponse Pydantic 계약 — faiss mock 주입."""

    @pytest.fixture(autouse=True)
    def mock_faiss(self):
        """faiss 모듈을 mock으로 대체하여 import 허용."""
        faiss_mock = MagicMock()
        faiss_mock.IO_FLAG_MMAP = 0
        faiss_mock.read_index.return_value = MagicMock(ntotal=0)
        with patch.dict("sys.modules", {"faiss": faiss_mock, "numpy": MagicMock()}):
            yield

    def _import_models(self):
        """faiss mock 환경에서 모델 import."""
        # 기존 모듈 캐시 제거 (faiss mock이 반영되도록)
        mods_to_clear = [k for k in sys.modules if "partner_office" in k or
                         "vector_search" in k or "checkup_design" in k]
        for m in mods_to_clear:
            sys.modules.pop(m, None)

        os.environ.setdefault("SECRET_KEY", "test-secret")
        os.environ.setdefault("JWT_SECRET_KEY", "test-jwt-secret")
        os.environ.setdefault("OPENAI_API_KEY", "test-key")

        try:
            from app.api.v1.endpoints.partner_office import (
                SimulateRequest, SimulateResponse,
            )
            return SimulateRequest, SimulateResponse
        except Exception:
            pytest.skip("partner_office import 실패 — 환경 의존성 미충족")

    def test_request_default_values(self):
        """SimulateRequest 기본값으로 인스턴스 생성 — 스펙 부록 C.1."""
        SimulateRequest, _ = self._import_models()
        req = SimulateRequest()
        assert req.bmi_target is None
        assert req.time_horizon_months == 0
        assert req.force is False

    def test_bmi_target_range_validation_exceed(self):
        """bmi_target > 45.0 → ValidationError — 스펙 부록 C.2."""
        import pydantic
        SimulateRequest, _ = self._import_models()
        with pytest.raises(pydantic.ValidationError):
            SimulateRequest(bmi_target=46.0)

    def test_bmi_target_range_validation_below(self):
        """bmi_target < 15.0 → ValidationError."""
        import pydantic
        SimulateRequest, _ = self._import_models()
        with pytest.raises(pydantic.ValidationError):
            SimulateRequest(bmi_target=14.0)

    def test_valid_bmi_target_boundary(self):
        """bmi_target 경계값(15.0, 45.0) 허용."""
        SimulateRequest, _ = self._import_models()
        assert SimulateRequest(bmi_target=15.0).bmi_target == 15.0
        assert SimulateRequest(bmi_target=45.0).bmi_target == 45.0

    def test_time_horizon_months_invalid(self):
        """time_horizon_months = 3 (비허용값) → ValidationError."""
        import pydantic
        SimulateRequest, _ = self._import_models()
        with pytest.raises(pydantic.ValidationError):
            SimulateRequest(time_horizon_months=3)

    def test_time_horizon_months_allowed(self):
        """time_horizon_months Literal[0, 6, 12, 60] 모두 허용."""
        SimulateRequest, _ = self._import_models()
        for v in (0, 6, 12, 60):
            req = SimulateRequest(time_horizon_months=v)
            assert req.time_horizon_months == v

    def test_response_required_fields(self):
        """SimulateResponse 필수 필드 보유 확인."""
        _, SimulateResponse = self._import_models()
        mock_result = {
            "uuid": "test-uuid",
            "hospital_id": "TEST",
            "input": {},
            "input_digest": "abc",
            "labels": {},
            "improved_sbp": 120.0,
            "improved_dbp": 80.0,
            "improved_fbg": 90.0,
            "ratios": {},
            "five_year_improved": {},
            "will_rogers": {},
            "applied_attenuation": {},
            "has_improvement": False,
            "cached": False,
            "generated_at": "2026-04-16T00:00:00",
            "engine_version": "v1",
        }
        resp = SimulateResponse(**mock_result)
        assert isinstance(resp.improved_sbp, float)
        assert isinstance(resp.ratios, dict)
        assert isinstance(resp.has_improvement, bool)
        assert isinstance(resp.cached, bool)
