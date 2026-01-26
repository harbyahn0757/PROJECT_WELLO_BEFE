"""
WELNO 통합 상태 조회 API

환자의 건강검진/처방/리포트 데이터 상태를 통합 조회하고,
데이터 출처(Tilko/IndexedDB/파트너)별 정보를 제공합니다.
"""

from fastapi import APIRouter, HTTPException, Query
from app.services.welno_data_service import welno_data_service
import logging

router = APIRouter()
logger = logging.getLogger(__name__)

@router.get("/user-status")
async def get_user_status(
    uuid: str = Query(..., description="환자 UUID"),
    hospital_id: str = Query(..., description="병원 ID"),
    partner_id: str = Query(None, description="파트너 ID (선택, 결제 상태 확인용)")
):
    """
    통합 상태 조회 (데이터 출처 포함)
    
    **응답 구조**:
    - `status`: ACTION_REQUIRED | PAYMENT_REQUIRED | REPORT_PENDING | REPORT_READY | REPORT_EXPIRED
    - `data_sources`: {tilko, indexeddb, partner} 각각의 건수 및 마지막 동기화 시각
    - `primary_source`: 주 데이터 출처 (tilko | indexeddb | partner | null)
    - `has_checkup_data`: 건강검진 데이터 존재 여부
    - `has_prescription_data`: 처방전 데이터 존재 여부
    - `has_report`: 질병예측 리포트 존재 여부
    - `has_payment`: 결제 완료 여부 (파트너만)
    - `requires_payment`: 결제 필요 여부 (파트너 설정 기준)
    - `metric_count`: 건강 지표 개수
    - `is_sufficient`: 데이터 충족 여부 (metric_count >= 5)
    - `total_checkup_count`: 전체 검진 데이터 건수
    - `prescription_count`: 처방전 건수
    
    **상태 판단 로직**:
    1. `REPORT_READY`: 리포트 있음 + 만료되지 않음
    2. `REPORT_EXPIRED`: 리포트 있음 + 7일 초과 (URL 만료)
    3. `PAYMENT_REQUIRED`: 데이터 충분 + 결제 필요 + 미결제
    4. `REPORT_PENDING`: 데이터 충분 + 결제 완료 + 리포트 없음
    5. `ACTION_REQUIRED`: 데이터 부족 (metric_count < 5)
    """
    try:
        result = await welno_data_service.get_unified_status(uuid, hospital_id, partner_id)
        return {
            "success": True,
            **result
        }
    except Exception as e:
        logger.error(f"[통합상태조회] 오류: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"통합 상태 조회 실패: {str(e)}")
