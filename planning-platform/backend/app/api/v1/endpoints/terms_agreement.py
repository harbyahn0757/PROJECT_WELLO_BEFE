"""
약관 동의 관리 API

- 약관 동의 여부 확인
- 각 약관별 개별 타임스탬프 관리
- 로컬/서버 동기화 지원
"""

import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Query

from ....core.config import settings
from ....core.database import db_manager

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/check")
async def check_terms_agreement(
    uuid: str = Query(..., description="사용자 UUID"),
    partner_id: str = Query(default="welno", description="파트너 ID")
):
    """
    약관 동의 여부 및 각 약관별 타임스탬프 확인
    
    Returns:
        - agreed: 모든 필수 약관 동의 여부
        - terms_detail: 각 약관별 상세 정보 (동의 여부, 타임스탬프)
    """
    try:
        logger.info(f"[약관체크] uuid={uuid}, partner={partner_id}")
        
        query = """
        SELECT 
            terms_agreement_detail,
            terms_agreed_at,
            updated_at
        FROM welno.welno_patients
        WHERE uuid = %s AND hospital_id = %s
        """
        
        result = await db_manager.execute_one(
            query, 
            (uuid, settings.welno_default_hospital_id)
        )
        
        if not result:
            logger.info(f"[약관체크] 환자 정보 없음: uuid={uuid}")
            return {
                "agreed": False,
                "terms_detail": None,
                "message": "환자 정보를 찾을 수 없습니다."
            }
        
        terms_detail = result.get('terms_agreement_detail')
        
        if not terms_detail:
            logger.info(f"[약관체크] 약관 동의 정보 없음: uuid={uuid}")
            return {
                "agreed": False,
                "terms_detail": None,
                "message": "약관 동의 정보가 없습니다."
            }
        
        # 필수 약관 체크
        required_terms = ['terms_service', 'terms_privacy', 'terms_sensitive']
        all_required_agreed = all(
            terms_detail.get(term, {}).get('agreed', False)
            for term in required_terms
        )
        
        logger.info(f"[약관체크] 결과: uuid={uuid}, agreed={all_required_agreed}")
        
        return {
            "agreed": all_required_agreed,
            "terms_detail": terms_detail,
            "terms_agreed_at": result.get('terms_agreed_at').isoformat() if result.get('terms_agreed_at') else None,
            "message": "약관 동의 정보 조회 완료"
        }
        
    except Exception as e:
        logger.error(f"[약관체크] 오류: uuid={uuid}, error={e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"약관 동의 정보 조회 중 오류가 발생했습니다: {str(e)}"
        )


@router.get("/status/{uuid}")
async def get_terms_status(
    uuid: str,
    partner_id: str = Query(default="kindhabit", description="파트너 ID")
):
    """
    약관 동의 상태 상세 조회 (디버깅용)
    
    Returns:
        각 약관별 상세 정보와 전체 통계
    """
    try:
        query = """
        SELECT 
            uuid,
            hospital_id,
            name,
            terms_agreement_detail,
            terms_agreed_at,
            created_at,
            updated_at
        FROM welno.welno_patients
        WHERE uuid = %s AND hospital_id = %s
        """
        
        # 파트너별 기본 병원 ID 조회
        from ....services.dynamic_config_service import dynamic_config
        default_hospital_id = await dynamic_config.get_default_hospital_id(partner_id)
        result = await db_manager.execute_one(query, (uuid, default_hospital_id))
        
        if not result:
            raise HTTPException(
                status_code=404,
                detail="환자 정보를 찾을 수 없습니다."
            )
        
        terms_detail = result.get('terms_agreement_detail') or {}
        
        # 각 약관별 상태 분석
        term_status = {}
        for term_type in ['terms_service', 'terms_privacy', 'terms_sensitive', 'terms_marketing']:
            term_data = terms_detail.get(term_type, {})
            term_status[term_type] = {
                "agreed": term_data.get('agreed', False),
                "agreed_at": term_data.get('agreed_at'),
                "version": term_data.get('version', 'unknown'),
            }
        
        return {
            "uuid": result['uuid'],
            "hospital_id": result['hospital_id'],
            "name": result['name'],
            "terms_status": term_status,
            "overall_agreed_at": result.get('terms_agreed_at').isoformat() if result.get('terms_agreed_at') else None,
            "created_at": result['created_at'].isoformat() if result.get('created_at') else None,
            "updated_at": result['updated_at'].isoformat() if result.get('updated_at') else None,
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[약관상태] 오류: uuid={uuid}, error={e}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"약관 상태 조회 중 오류가 발생했습니다: {str(e)}"
        )
